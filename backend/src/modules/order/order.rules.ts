export type OrderEligibilityContext = {
  contractStatus: string;
  contractClosed: boolean;
  accountErpApproved: boolean;
};

export function validateOrderEligibility(ctx: OrderEligibilityContext) {
  if (ctx.contractStatus !== 'ERP_APPROVED') return { allowed: false, error: 'ERP-approved Contract is required' };
  if (ctx.contractClosed) return { allowed: false, error: 'Closed Contract cannot be ordered' };
  if (!ctx.accountErpApproved) return { allowed: false, error: 'ERP-approved Account is required' };
  return { allowed: true as const };
}

export function validateOrderItems(rows: Array<{ quantity: number; orderAvailable: boolean }>) {
  if (!rows.length) return { allowed: false, error: 'At least one order item is required' };
  if (rows.some(r => !Number.isInteger(r.quantity) || r.quantity <= 0)) return { allowed: false, error: 'Order quantity must be a positive integer' };
  if (rows.some(r => !r.orderAvailable)) return { allowed: false, error: 'Order contains unavailable item' };
  return { allowed: true as const };
}

export function canEditOrder(status: string) {
  return status === 'DRAFT' || status === 'FAILED';
}
