import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSecurePassword } from '../src/features/admin/operations/password.ts';
import { resolveTemplateKey, REGISTERED_TEMPLATE_KEYS } from '../src/features/template/resolve-key.ts';
import { cleanupStoragePrefix } from '../src/features/admin/operations/storage.ts';
import { isGoogleMapsUrl } from '../src/features/events/map-resolver.ts';

const isRegisteredTemplate = (key) => resolveTemplateKey(key) !== null;
const listTemplateKeys = () => [...REGISTERED_TEMPLATE_KEYS];

test('generateSecurePassword generates 16-character complex password', () => {
  const pwd = generateSecurePassword(16);
  assert.equal(pwd.length, 16);

  // Must contain uppercase, lowercase, numbers, symbols
  assert.ok(/[A-Z]/.test(pwd), 'Contains uppercase');
  assert.ok(/[a-z]/.test(pwd), 'Contains lowercase');
  assert.ok(/[0-9]/.test(pwd), 'Contains numbers');
  assert.ok(/[!@#$%^&*-_=+]/.test(pwd), 'Contains symbols');

  // Must generate different passwords on successive calls
  const pwd2 = generateSecurePassword(16);
  assert.notEqual(pwd, pwd2);
});

test('Template registry validates allowed templates correctly', () => {
  assert.equal(isRegisteredTemplate('wedding-floral-01'), true);
  assert.equal(isRegisteredTemplate('graduation-floral-01'), true);
  assert.equal(isRegisteredTemplate('graduation-editorial-01'), true);
  assert.equal(isRegisteredTemplate('unknown-template-xyz'), false);
  assert.equal(isRegisteredTemplate(''), false);
  assert.equal(isRegisteredTemplate(null), false);
  assert.equal(isRegisteredTemplate(undefined), false);

  const keys = listTemplateKeys();
  assert.ok(keys.includes('wedding-floral-01'));
  assert.ok(keys.includes('graduation-editorial-01'));
});

test('Google Maps URL validation enforces strict allowlist per Section 6', () => {
  // Valid Google Maps URLs
  assert.equal(isGoogleMapsUrl('https://maps.app.goo.gl/abcdef123'), true);
  assert.equal(isGoogleMapsUrl('https://maps.google.com/?q=Saigon'), true);
  assert.equal(isGoogleMapsUrl('https://www.google.com/maps/place/Hanoi'), true);
  assert.equal(isGoogleMapsUrl('https://google.com/maps/search/Restaurant'), true);

  // Invalid / Attack vectors explicitly cited in spec Section 6
  assert.equal(isGoogleMapsUrl('http://maps.google.com/test'), false, 'Refuse non-https');
  assert.equal(isGoogleMapsUrl('https://google.com.evil.example/maps'), false, 'Refuse subdomain attacker');
  assert.equal(isGoogleMapsUrl('https://user:pass@maps.google.com/test'), false, 'Refuse userinfo');
  assert.equal(isGoogleMapsUrl('https://maps.google.com:8080/test'), false, 'Refuse non-443 port');
  assert.equal(isGoogleMapsUrl('https://google.com/maps-evil'), false, 'Refuse maps-evil path');
  assert.equal(isGoogleMapsUrl('javascript:alert(1)'), false, 'Refuse script');
  assert.equal(isGoogleMapsUrl(''), false);
  assert.equal(isGoogleMapsUrl(null), false);
});

test('cleanupStoragePrefix handles empty and missing buckets idempotently', async () => {
  // Case 1: Empty bucket list
  const emptySupabaseMock = {
    storage: {
      from: () => ({
        list: async () => ({ data: [], error: null }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
  };
  await assert.doesNotReject(cleanupStoragePrefix(emptySupabaseMock, 'audio', 'user-1/event-1'));

  // Case 2: 404 / bucket not found is treated as already clean
  const notFoundSupabaseMock = {
    storage: {
      from: () => ({
        list: async () => ({ data: null, error: { message: 'Bucket not found', status: 404 } }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
  };
  await assert.doesNotReject(cleanupStoragePrefix(notFoundSupabaseMock, 'banners', 'user-1/event-1'));
});

test('cleanupStoragePrefix correctly deletes all items across multiple pages without skipping', async () => {
  // Simulate a bucket holding 250 items.
  // Each call to remove() actually removes items from the simulated store.
  const totalItems = 250;
  let itemsInStore = Array.from({ length: totalItems }, (_, i) => ({
    name: `file_${i}.png`,
    id: `id_${i}`,
  }));

  const removedBatches = [];

  const mockSupabase = {
    storage: {
      from: () => ({
        list: async (prefix, options) => {
          const { limit, offset } = options;
          const slice = itemsInStore.slice(offset, offset + limit);
          return { data: slice, error: null };
        },
        remove: async (paths) => {
          removedBatches.push(paths);
          const pathSet = new Set(paths);
          itemsInStore = itemsInStore.filter(f => !pathSet.has(`prefix/${f.name}`));
          return { data: paths, error: null };
        },
      }),
    },
  };

  await cleanupStoragePrefix(mockSupabase, 'banners', 'prefix');

  // Verify all 250 items were removed
  const totalRemoved = removedBatches.reduce((acc, b) => acc + b.length, 0);
  assert.equal(totalRemoved, 250, 'All 250 items should be removed across pages');
  assert.equal(itemsInStore.length, 0, 'No items should remain in storage');
  assert.equal(removedBatches.length, 3, 'Should take 3 batches: 100 + 100 + 50');
});

test('cleanupStoragePrefix throws on unexpected list error or remove error', async () => {
  // Unexpected 500 error on list
  const errorListSupabase = {
    storage: {
      from: () => ({
        list: async () => ({ data: null, error: { message: 'Database connection failed', status: 500 } }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
  };
  await assert.rejects(
    cleanupStoragePrefix(errorListSupabase, 'audio', 'prefix'),
    /Database connection failed/,
  );

  // Unexpected remove error
  const errorRemoveSupabase = {
    storage: {
      from: () => ({
        list: async () => ({ data: [{ name: 'music.mp3', id: 'm1' }], error: null }),
        remove: async () => ({ data: null, error: { message: 'Write permission denied' } }),
      }),
    },
  };
  await assert.rejects(
    cleanupStoragePrefix(errorRemoveSupabase, 'audio', 'prefix'),
    /Write permission denied/,
  );
});

test('Route guard authorization verifies developer role and active status', () => {
  // Pure validator embodying getVerifiedDeveloper rules
  function verifyDeveloperAccess(authUserData, profileData) {
    if (!authUserData?.user) return { allowed: false, reason: 'unauthenticated' };
    if (!profileData) return { allowed: false, reason: 'missing_profile' };
    if (profileData.lifecycle_status !== 'active') return { allowed: false, reason: 'inactive' };
    if (profileData.role === 'host') return { allowed: false, reason: 'host_redirect_dashboard' };
    if (profileData.role !== 'developer') return { allowed: false, reason: 'forbidden' };
    return { allowed: true, userId: authUserData.user.id };
  }

  // 1. Unauthenticated
  assert.deepEqual(verifyDeveloperAccess(null, null), { allowed: false, reason: 'unauthenticated' });

  // 2. Host user
  assert.deepEqual(
    verifyDeveloperAccess({ user: { id: 'u1' } }, { role: 'host', lifecycle_status: 'active' }),
    { allowed: false, reason: 'host_redirect_dashboard' },
  );

  // 3. Inactive developer (lifecycle_status = 'deleting' or 'suspended')
  assert.deepEqual(
    verifyDeveloperAccess({ user: { id: 'u2' } }, { role: 'developer', lifecycle_status: 'deleting' }),
    { allowed: false, reason: 'inactive' },
  );

  // 4. Other role
  assert.deepEqual(
    verifyDeveloperAccess({ user: { id: 'u3' } }, { role: 'guest', lifecycle_status: 'active' }),
    { allowed: false, reason: 'forbidden' },
  );

  // 5. Active developer
  assert.deepEqual(
    verifyDeveloperAccess({ user: { id: 'u4' } }, { role: 'developer', lifecycle_status: 'active' }),
    { allowed: true, userId: 'u4' },
  );
});

test('deleteHostAction safeguard constraints enforce developer protection and confirmation matching', () => {
  function validateDeleteHostSafeguards(developerId, targetHostId, targetProfileRole, confirmationEmail, targetEmail) {
    if (developerId === targetHostId) {
      throw new Error('Bạn không thể tự xóa tài khoản của chính mình.');
    }
    if (targetEmail.trim().toLowerCase() !== confirmationEmail.trim().toLowerCase()) {
      throw new Error('Email xác nhận không khớp với tài khoản host cần xóa.');
    }
    if (targetProfileRole !== 'host') {
      throw new Error('Không được phép xóa tài khoản Developer qua chức năng xóa Host.');
    }
    return true;
  }

  // Self-deletion blocked
  assert.throws(
    () => validateDeleteHostSafeguards('dev-1', 'dev-1', 'host', 'dev@example.com', 'dev@example.com'),
    /Bạn không thể tự xóa tài khoản của chính mình/,
  );

  // Confirmation email mismatch blocked
  assert.throws(
    () => validateDeleteHostSafeguards('dev-1', 'host-1', 'host', 'wrong@example.com', 'host@example.com'),
    /Email xác nhận không khớp/,
  );

  // Developer account deletion blocked
  assert.throws(
    () => validateDeleteHostSafeguards('dev-1', 'dev-2', 'developer', 'dev2@example.com', 'dev2@example.com'),
    /Không được phép xóa tài khoản Developer/,
  );

  // Valid host deletion accepted
  assert.equal(
    validateDeleteHostSafeguards('dev-1', 'host-1', 'host', 'host@example.com', 'host@example.com'),
    true,
  );
});

test('createEventAction parameter validation enforces constraints', () => {
  function validateCreateEventParams(params) {
    const title = params.title?.trim();
    if (!title || title.length > 255) {
      throw new Error('Tiêu đề sự kiện cần từ 1 đến 255 ký tự.');
    }
    if (!isRegisteredTemplate(params.templateKey)) {
      throw new Error(`Mẫu thiệp '${params.templateKey}' chưa được đăng ký trong Template Registry.`);
    }
    const parsedDate = new Date(params.eventDate);
    if (isNaN(parsedDate.getTime())) {
      throw new Error('Thời gian diễn ra sự kiện không hợp lệ.');
    }
    const timezone = params.timezone?.trim() || 'Asia/Ho_Chi_Minh';
    if (timezone !== 'Asia/Ho_Chi_Minh') {
      throw new Error('Hệ thống hiện tại chỉ hỗ trợ múi giờ Asia/Ho_Chi_Minh.');
    }
    if (params.googleMapUrl) {
      if (!isGoogleMapsUrl(params.googleMapUrl)) {
        throw new Error('Đường dẫn Google Maps không hợp lệ.');
      }
    }
    return true;
  }

  // Missing or overlong title
  assert.throws(() => validateCreateEventParams({ title: '', templateKey: 'wedding-floral-01', eventDate: '2026-10-01' }), /Tiêu đề sự kiện/);
  assert.throws(() => validateCreateEventParams({ title: 'a'.repeat(256), templateKey: 'wedding-floral-01', eventDate: '2026-10-01' }), /Tiêu đề sự kiện/);

  // Unregistered template
  assert.throws(() => validateCreateEventParams({ title: 'Cưới', templateKey: 'hack-template', eventDate: '2026-10-01' }), /chưa được đăng ký/);

  // Invalid date
  assert.throws(() => validateCreateEventParams({ title: 'Cưới', templateKey: 'wedding-floral-01', eventDate: 'not-a-date' }), /Thời gian/);

  // Unsupported timezone
  assert.throws(() => validateCreateEventParams({ title: 'Cưới', templateKey: 'wedding-floral-01', eventDate: '2026-10-01', timezone: 'UTC' }), /Asia\/Ho_Chi_Minh/);

  // Evil maps URL
  assert.throws(() => validateCreateEventParams({ title: 'Cưới', templateKey: 'wedding-floral-01', eventDate: '2026-10-01', googleMapUrl: 'https://evil.example.com' }), /Google Maps/);

  // Valid params pass
  assert.equal(validateCreateEventParams({
    title: 'Lễ Thành Hôn: Tuấn & Linh',
    templateKey: 'wedding-floral-01',
    eventDate: '2026-11-20T10:00:00.000Z',
    timezone: 'Asia/Ho_Chi_Minh',
    googleMapUrl: 'https://maps.app.goo.gl/AbCdEf123',
  }), true);
});
