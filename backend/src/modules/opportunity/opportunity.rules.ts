export type OpportunityStage = 'NEEDS_ANALYSIS' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';

const OPEN_ORDER: Record<Exclude<OpportunityStage, 'CLOSED_WON' | 'CLOSED_LOST'>, number> = {
  NEEDS_ANALYSIS: 10,
  PROPOSAL: 20,
  NEGOTIATION: 30
};

export type OpportunityTransitionDecision = {
  allowed: boolean;
  reverse: boolean;
  error?: string;
};

export function canTransitionOpportunity(
  from: OpportunityStage,
  to: OpportunityStage,
  options: { canReopen: boolean; contractCreated: boolean; reason?: string }
): OpportunityTransitionDecision {
  if (from === to) return { allowed: false, reverse: false, error: 'Opportunity is already in the requested stage' };

  const fromOpen = from in OPEN_ORDER;
  const toOpen = to in OPEN_ORDER;

  if (fromOpen && toOpen) {
    const reverse = OPEN_ORDER[to as keyof typeof OPEN_ORDER] < OPEN_ORDER[from as keyof typeof OPEN_ORDER];
    if (reverse && !options.reason?.trim()) {
      return { allowed: false, reverse: true, error: 'Reverse stage transition requires a reason' };
    }
    return { allowed: true, reverse };
  }

  if (fromOpen && (to === 'CLOSED_WON' || to === 'CLOSED_LOST')) {
    return { allowed: true, reverse: false };
  }

  if ((from === 'CLOSED_WON' || from === 'CLOSED_LOST') && toOpen) {
    if (!options.canReopen) return { allowed: false, reverse: true, error: 'Reopen permission is required' };
    if (from === 'CLOSED_WON' && options.contractCreated) {
      return { allowed: false, reverse: true, error: 'Closed Won opportunity with a contract cannot be reopened' };
    }
    if (!options.reason?.trim()) return { allowed: false, reverse: true, error: 'Reopen requires a reason' };
    return { allowed: true, reverse: true };
  }

  return { allowed: false, reverse: false, error: 'Unsupported opportunity stage transition' };
}
