import { canEditOrder, validateOrderEligibility, validateOrderItems } from './order.rules';

describe('Phase 6 order rules', () => {
  it('requires ERP-approved and open Contract', () => {
    expect(validateOrderEligibility({ contractStatus:'DRAFT', contractClosed:false, accountErpApproved:true }).allowed).toBe(false);
    expect(validateOrderEligibility({ contractStatus:'ERP_APPROVED', contractClosed:true, accountErpApproved:true }).allowed).toBe(false);
    expect(validateOrderEligibility({ contractStatus:'ERP_APPROVED', contractClosed:false, accountErpApproved:false }).allowed).toBe(false);
    expect(validateOrderEligibility({ contractStatus:'ERP_APPROVED', contractClosed:false, accountErpApproved:true }).allowed).toBe(true);
  });

  it('requires positive and available order items', () => {
    expect(validateOrderItems([]).allowed).toBe(false);
    expect(validateOrderItems([{ quantity:1, orderAvailable:false }]).allowed).toBe(false);
    expect(validateOrderItems([{ quantity:2, orderAvailable:true }]).allowed).toBe(true);
  });

  it('only edits draft or failed orders', () => {
    expect(canEditOrder('DRAFT')).toBe(true);
    expect(canEditOrder('FAILED')).toBe(true);
    expect(canEditOrder('REQUESTING')).toBe(false);
  });
});
