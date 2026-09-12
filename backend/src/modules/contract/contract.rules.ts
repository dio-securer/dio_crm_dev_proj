export type ContractCreationContext = {
  opportunityStage: string;
  accountErpApproved: boolean;
  contractCreated: boolean;
  productCount: number;
};

export function validateContractCreation(ctx: ContractCreationContext) {
  if (ctx.opportunityStage !== 'CLOSED_WON') return { allowed: false, error: 'Closed Won Opportunity is required' };
  if (!ctx.accountErpApproved) return { allowed: false, error: 'ERP-approved Account is required' };
  if (ctx.contractCreated) return { allowed: false, error: 'Contract already created for Opportunity' };
  if (ctx.productCount < 1) return { allowed: false, error: 'At least one Opportunity Product is required' };
  return { allowed: true as const };
}

export function sameMoney(a: number, b: number) {
  return Math.abs(Number(a) - Number(b)) < 0.005;
}

export function validatePlanTotal(contractAmount: number, rows: Array<{ amount: number }>) {
  if (!rows.length) return { allowed: false, error: 'At least one collection plan row is required' };
  if (rows.some(r => !Number.isFinite(r.amount) || r.amount <= 0)) return { allowed: false, error: 'Collection plan amount must be positive' };
  const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
  if (!sameMoney(total, contractAmount)) return { allowed: false, error: 'Collection plan total must equal contract amount', total };
  return { allowed: true as const, total };
}

export function validateChangedPlan(outstandingAmount: number, rows: Array<{ amount: number }>) {
  if (outstandingAmount <= 0) return { allowed: false, error: 'No outstanding amount remains' };
  const result = validatePlanTotal(outstandingAmount, rows);
  if (!result.allowed) return { ...result, error: 'Changed collection plan must allocate the full outstanding amount' };
  return result;
}
