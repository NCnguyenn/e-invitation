import test from 'node:test';
import assert from 'node:assert/strict';

const module = await import('../src/features/guest/entrance-state.ts');

test('first visit needs separate open and view actions', () => {
  assert.equal(typeof module.entranceTransition, 'function', 'entrance workflow exists');
  const next = module.entranceTransition;
  assert.equal(next('checking', 'new'), 'closed');
  assert.equal(next('closed', 'view'), 'closed');
  assert.equal(next('closed', 'open'), 'opening');
  assert.equal(next('opening', 'view'), 'opening');
  assert.equal(next('opening', 'settled'), 'opened');
  assert.equal(next('opened', 'view'), 'leaving');
  assert.equal(next('leaving', 'settled'), 'invitation');
});

test('repeated clicks cannot skip the letter or restart transitions', () => {
  assert.equal(typeof module.entranceTransition, 'function');
  const next = module.entranceTransition;
  assert.equal(next('opening', 'open'), 'opening');
  assert.equal(next('opened', 'open'), 'opened');
  assert.equal(next('leaving', 'view'), 'leaving');
  assert.equal(next('invitation', 'settled'), 'invitation');
});

test('a returning guest can enter directly and replay the closed envelope', () => {
  assert.equal(typeof module.entranceTransition, 'function');
  assert.equal(module.entranceTransition('checking', 'remembered'), 'invitation');
  assert.equal(module.entranceTransition('invitation', 'replay'), 'closed');
});

test('memory is per invitation and disabled in previews', () => {
  assert.equal(typeof module.rememberInvitation, 'function');
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  module.rememberInvitation(storage, 'guest-a');
  assert.equal(module.hasViewedInvitation(storage, 'guest-a'), true);
  assert.equal(module.hasViewedInvitation(storage, 'guest-b'), false);
  module.rememberInvitation(storage, undefined);
  assert.equal(module.hasViewedInvitation(storage, undefined), false);
  assert.equal(values.size, 1);
});

test('unavailable storage never blocks the invitation', () => {
  assert.equal(typeof module.rememberInvitation, 'function');
  const storage = { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } };
  assert.equal(module.hasViewedInvitation(storage, 'guest-a'), false);
  assert.doesNotThrow(() => module.rememberInvitation(storage, 'guest-a'));
  assert.equal(module.hasViewedInvitation(null, 'guest-a'), false);
  assert.doesNotThrow(() => module.rememberInvitation(null, 'guest-a'));
});
