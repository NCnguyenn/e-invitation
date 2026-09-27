import test from 'node:test';
import assert from 'node:assert/strict';

test('metric scopes distinguish credentials without exposing them', async () => {
  const { brevoMetricScope, metricEnvironment } = await import('../src/features/admin/metrics/context.ts');
  assert.equal(brevoMetricScope(''), 'not-connected');
  assert.equal(brevoMetricScope(' key-a '), brevoMetricScope('key-a'));
  assert.notEqual(brevoMetricScope('key-a'), brevoMetricScope('key-b'));
  assert.ok(!brevoMetricScope('key-a').includes('key-a'));
  assert.equal(metricEnvironment({ CONTEXT: 'production' }), 'production');
  assert.equal(metricEnvironment({ CONTEXT: 'deploy-preview' }), 'staging');
  assert.equal(metricEnvironment({ NODE_ENV: 'production' }), 'production');
  assert.equal(metricEnvironment({ METRICS_ENVIRONMENT: 'staging' }), 'staging');
});
