import { expect, it, vi } from 'vitest';
import { decideOpportunityPop } from './opportunity-navigation-guard';
it('restores only a known earlier SPA history entry when discarding is refused', () => {
  const confirm = vi.fn(() => false);
  expect(decideOpportunityPop(4, 2, confirm)).toEqual({ kind: 'restore', delta: 2 });
  expect(decideOpportunityPop(4, undefined, confirm)).toEqual({ kind: 'allow' });
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(decideOpportunityPop(4, 2, () => true)).toEqual({ kind: 'allow' });
});
