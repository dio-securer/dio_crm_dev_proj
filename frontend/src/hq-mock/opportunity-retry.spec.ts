import { expect, it } from 'vitest';
import { opportunityRequestKeys } from './opportunity-retry';
it('reuses a retry key for the same payload and version, and replaces it after success', () => {
  let n = 0; const keys = opportunityRequestKeys(() => `key-${++n}`);
  const a = keys.get('PATCH', '/api/opportunities/a', { opportunityName: 'x' }, 3);
  expect(keys.get('PATCH', '/api/opportunities/a', { opportunityName: 'x' }, 3)).toBe(a);
  expect(keys.get('PATCH', '/api/opportunities/a', { opportunityName: 'y' }, 3)).not.toBe(a);
  expect(keys.get('PATCH', '/api/opportunities/a', { opportunityName: 'x' }, 4)).not.toBe(a);
  keys.done('PATCH', '/api/opportunities/a', { opportunityName: 'x' }, 3);
  expect(keys.get('PATCH', '/api/opportunities/a', { opportunityName: 'x' }, 3)).not.toBe(a);
});
