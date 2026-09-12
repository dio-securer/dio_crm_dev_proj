import { canTransitionOpportunity } from './opportunity.rules';

describe('Opportunity stage rules', () => {
  it('allows forward open-stage transition', () => {
    expect(canTransitionOpportunity('NEEDS_ANALYSIS', 'PROPOSAL', { canReopen: false, contractCreated: false }).allowed).toBe(true);
  });

  it('requires reason for reverse open-stage transition', () => {
    expect(canTransitionOpportunity('NEGOTIATION', 'PROPOSAL', { canReopen: false, contractCreated: false }).allowed).toBe(false);
    expect(canTransitionOpportunity('NEGOTIATION', 'PROPOSAL', { canReopen: false, contractCreated: false, reason: '고객 조건 재검토' }).allowed).toBe(true);
  });

  it('requires reopen permission for closed lost', () => {
    expect(canTransitionOpportunity('CLOSED_LOST', 'NEGOTIATION', { canReopen: false, contractCreated: false, reason: '재협상' }).allowed).toBe(false);
    expect(canTransitionOpportunity('CLOSED_LOST', 'NEGOTIATION', { canReopen: true, contractCreated: false, reason: '재협상' }).allowed).toBe(true);
  });

  it('blocks reopening won opportunity after contract creation', () => {
    expect(canTransitionOpportunity('CLOSED_WON', 'NEGOTIATION', { canReopen: true, contractCreated: true, reason: '재협상' }).allowed).toBe(false);
  });
});
