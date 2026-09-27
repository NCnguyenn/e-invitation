import test from 'node:test';
import assert from 'node:assert/strict';

const { decidePreviewTemplate: decide } = await import('../src/features/events/preview-template-policy.ts');
const { resolveTemplateKey } = await import('../src/features/template/resolve-key.ts');
const decidePreviewTemplate = (input) => decide(input, resolveTemplateKey);

const base = {
  requestedKey: undefined,
  ownEventKey: undefined,
  fallbackKey: 'wedding-floral-01',
};

test('anonymous production preview is not found', () => {
  assert.deepEqual(decidePreviewTemplate({ ...base, isDevelopment: false, hasHost: false }), { status: 'not_found' });
});

test('production host cannot select another registered template', () => {
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: false, hasHost: true, requestedKey: ' graduation-floral-01 ', ownEventKey: 'wedding-floral-01' }),
    { status: 'unavailable' },
  );
});

test('production host uses its own template when the query is absent or identical', () => {
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: false, hasHost: true, ownEventKey: 'wedding-floral-01' }),
    { status: 'selected', templateKey: 'wedding-floral-01' },
  );
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: false, hasHost: true, requestedKey: ' wedding-floral-01 ', ownEventKey: 'wedding-floral-01' }),
    { status: 'selected', templateKey: 'wedding-floral-01' },
  );
});

test('development designer can select a registered template without an event', () => {
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: true, hasHost: false, requestedKey: 'graduation-floral-01' }),
    { status: 'selected', templateKey: 'graduation-floral-01' },
  );
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: true, hasHost: false, requestedKey: 'graduation-editorial-01' }),
    { status: 'selected', templateKey: 'graduation-editorial-01' },
  );
});

test('production host without an event cannot inspect a client template', () => {
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: false, hasHost: true, requestedKey: 'graduation-floral-01' }),
    { status: 'unavailable' },
  );
});

test('an unregistered template is unavailable', () => {
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: true, hasHost: false, requestedKey: 'not-registered' }),
    { status: 'unavailable' },
  );
});

test('production does not fall back when the host event is missing or invalid', () => {
  for (const ownEventKey of [undefined, '', 'not-registered']) {
    assert.deepEqual(
      decidePreviewTemplate({ ...base, isDevelopment: false, hasHost: true, ownEventKey }),
      { status: 'unavailable' },
    );
  }
});

test('an explicit blank query is unavailable', () => {
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: false, hasHost: true, ownEventKey: 'wedding-floral-01', requestedKey: '  ' }),
    { status: 'unavailable' },
  );
});

test('development uses the fixture only when no key is requested or owned', () => {
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: true, hasHost: false }),
    { status: 'selected', templateKey: 'wedding-floral-01' },
  );
  assert.deepEqual(
    decidePreviewTemplate({ ...base, fallbackKey: undefined, isDevelopment: true, hasHost: false }),
    { status: 'unavailable' },
  );
});
