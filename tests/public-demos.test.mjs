import test from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_DEMO_KEYS, getPublicDemo } from '../src/features/template/public-demos.ts';

test('only the two approved samples are publicly selectable', () => {
  assert.deepEqual(PUBLIC_DEMO_KEYS, ['graduation-floral-01', 'graduation-editorial-01']);
  for (const key of PUBLIC_DEMO_KEYS) {
    const demo = getPublicDemo(key);
    assert.ok(demo?.title);
    assert.equal(demo.invitation.event.templateKey, key);
    assert.equal(demo.invitation.event.hasMusic, false);
    assert.equal(demo.invitation.status, 'pending');
    assert.equal(demo.invitation.receipt, null);
    assert.equal(demo.invitation.guestName, 'Bạn và Người thương');
  }
});

test('registered aliases and private or malformed keys are not public demos', () => {
  for (const key of ['wedding-floral-01', 'graduation-private-client', '', '__proto__', 'constructor', '../preview', 'GRADUATION-FLORAL-01', 'graduation-floral-01 ']) {
    assert.equal(getPublicDemo(key), null, key);
  }
});

test('demo invitations are fresh sample objects with no cross-request state', () => {
  const first = getPublicDemo('graduation-floral-01');
  first.invitation.guestName = 'A private guest';
  first.invitation.event.title = 'A private event';
  first.invitation.event.hasMusic = true;
  const second = getPublicDemo('graduation-floral-01');
  assert.equal(second.invitation.guestName, 'Bạn và Người thương');
  assert.equal(second.invitation.event.title, 'Lễ tốt nghiệp của Mai Hoa');
  assert.equal(second.invitation.event.hasMusic, false);
  assert.equal(second.invitation.event.id, 'public-demo-graduation-floral-01');
  assert.notEqual(getPublicDemo('graduation-editorial-01').invitation.event.id, second.invitation.event.id);
});
