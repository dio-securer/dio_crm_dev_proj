export type LeadStatus = 'NEW' | 'FIRST_VISIT' | 'KEYMAN_MEETING' | 'CONTACT_EXCLUDED' | 'CONVERTED';

const forward: Record<LeadStatus, LeadStatus[]> = {
  NEW: ['FIRST_VISIT', 'CONTACT_EXCLUDED'],
  FIRST_VISIT: ['KEYMAN_MEETING', 'CONTACT_EXCLUDED'],
  KEYMAN_MEETING: ['CONVERTED', 'CONTACT_EXCLUDED'],
  CONTACT_EXCLUDED: [],
  CONVERTED: []
};

export function canTransitionLead(
  from: LeadStatus,
  to: LeadStatus,
  permissions: string[],
  reason?: string
): { allowed: boolean; reverse: boolean; error?: string } {
  if (from === 'CONVERTED') return { allowed: false, reverse: false, error: 'Converted lead is terminal' };
  if (from === to) return { allowed: true, reverse: false };
  if (forward[from].includes(to)) return { allowed: true, reverse: false };
  const canReverse = permissions.includes('LEAD.STATUS.REVERSE');
  if (!canReverse) return { allowed: false, reverse: true, error: 'Reverse transition requires LEAD.STATUS.REVERSE' };
  if (!reason?.trim()) return { allowed: false, reverse: true, error: 'Reverse transition reason is required' };
  return { allowed: true, reverse: true };
}
