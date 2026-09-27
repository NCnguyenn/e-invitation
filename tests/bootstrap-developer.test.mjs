import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('developer bootstrap requires an explicit password for a new account', async () => {
  const source = await readFile(new URL('../scripts/bootstrap-developer.mjs', import.meta.url), 'utf8');
  assert.match(source, /createdPassword\s*=\s*process\.argv\[3\]\?\.trim\(\);/);
  assert.match(source, /if\s*\(!createdPassword\)\s*\{\s*console\.error/);
  assert.doesNotMatch(source, /process\.argv\[3\]\s*\|\|/);
});
