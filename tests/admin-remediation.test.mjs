import test from 'node:test';
import assert from 'node:assert/strict';
import { canFetchProviders, measuredCount } from '../src/features/admin/metrics/integrity.ts';
import { bounceTotal } from '../src/features/admin/metrics/brevo.ts';
import { emailsById } from '../src/features/admin/operations/auth-directory.ts';
import { selectHostPage } from '../src/features/admin/operations/host-page.ts';
import { planMaintenanceRetry, requireWriteData } from '../src/features/admin/operations/delete-policy.ts';
import { assertResolvableUnknown } from '../src/features/admin/operations/reconciliation-policy.ts';

test('measured count keeps a real zero and refuses a failed or missing count', () => {
  assert.equal(measuredCount(0, null), 0);
  assert.equal(measuredCount(null, null), null);
  assert.equal(measuredCount(undefined, null), null);
  assert.equal(measuredCount(4, { message: 'permission denied' }), null);
});

test('Brevo bounce total is null unless both bounce fields are numbers', () => {
  assert.equal(bounceTotal(1, 2), 3);
  assert.equal(bounceTotal(0, 0), 0);
  assert.equal(bounceTotal(1, undefined), null);
  assert.equal(bounceTotal(undefined, 2), null);
  assert.equal(bounceTotal(undefined, undefined), null);
});

test('provider sync does not call upstream APIs without a held lease', () => {
  assert.equal(canFetchProviders({ tableAvailable: true, leaseError: false, acquired: true }), true);
  assert.equal(canFetchProviders({ tableAvailable: true, leaseError: true, acquired: false }), false);
  assert.equal(canFetchProviders({ tableAvailable: true, leaseError: false, acquired: false }), false);
  assert.equal(canFetchProviders({ tableAvailable: false, leaseError: false, acquired: true }), false);
});

test('auth email lookup continues past the first page and does not invent an email from the user id', async () => {
  const pages = [
    [{ id: 'user-1', email: 'one@example.com' }],
    [{ id: 'user-2', email: 'two@example.com' }],
    [],
  ];
  const emails = await emailsById(async (page) => ({ users: pages[page - 1] ?? [], error: null }), ['user-2'], {
    perPage: 1,
  });
  assert.equal(emails.get('user-2'), 'two@example.com');
  assert.equal(emails.has('user-2') && emails.get('user-2') !== 'user-2', true);
});

test('auth email lookup fails closed when a page errors or the scan is truncated', async () => {
  await assert.rejects(
    emailsById(async () => ({ users: [], error: { message: 'auth down' } }), ['user-1']),
    /auth down/,
  );
  await assert.rejects(
    emailsById(async () => ({ users: [{ id: 'user-1', email: 'a@example.com' }], error: null }), ['missing-user'], {
      perPage: 1,
      maxPages: 1,
    }),
    /Không đủ/,
  );
});

test('host search filters the full set before pagination', () => {
  const hosts = Array.from({ length: 60 }, (_, index) => ({
    userId: `user-${index}`,
    email: index === 55 ? 'needle@example.com' : `host-${index}@example.com`,
  }));
  const page = selectHostPage(hosts, 'needle', 1, 50);
  assert.equal(page.totalCount, 1);
  assert.equal(page.hosts[0]?.email, 'needle@example.com');
});

test('maintenance retry finishes the original deletion and refuses a job that is not failed', () => {
  assert.deepEqual(planMaintenanceRetry({ status: 'failed', kind: 'delete_host' }), {
    cleanupStorage: true,
    deleteAuthUser: true,
    deleteEventRow: false,
  });
  assert.deepEqual(planMaintenanceRetry({ status: 'failed', kind: 'delete_event' }), {
    cleanupStorage: true,
    deleteAuthUser: false,
    deleteEventRow: true,
  });
  assert.throws(() => planMaintenanceRetry({ status: 'completed', kind: 'delete_host' }), /failed/);
  assert.deepEqual(planMaintenanceRetry({ status: 'running', kind: 'delete_event' }), {
    cleanupStorage: true,
    deleteAuthUser: false,
    deleteEventRow: true,
  });
});

test('a Supabase write error is a failure even when the client does not throw', () => {
  assert.throws(() => requireWriteData({ data: null, error: { message: 'insert failed' } }, 'job'), /insert failed/);
  assert.deepEqual(requireWriteData({ data: { id: 'job-1' }, error: null }, 'job'), { id: 'job-1' });
});

test('unknown reconciliation only resolves an open unknown attempt and only reopens an unknown invitation', () => {
  assert.doesNotThrow(() => assertResolvableUnknown({
    status: 'unknown',
    resolved_at: null,
    invitationEmailStatus: 'unknown',
    allowResend: true,
  }));
  assert.throws(() => assertResolvableUnknown({
    status: 'unknown',
    resolved_at: '2026-09-27T00:00:00Z',
    invitationEmailStatus: 'unknown',
    allowResend: false,
  }), /đã đối soát/);
  assert.throws(() => assertResolvableUnknown({
    status: 'accepted',
    resolved_at: null,
    invitationEmailStatus: 'sent',
    allowResend: true,
  }), /unknown/);
  assert.throws(() => assertResolvableUnknown({
    status: 'unknown',
    resolved_at: null,
    invitationEmailStatus: 'sent',
    allowResend: true,
  }), /unknown/);
});
