import { validateChangedPlan, validateContractCreation, validatePlanTotal } from './contract.rules';

describe('Phase 5 contract rules', () => {
  it('requires Closed Won, ERP-approved Account and products', () => {
    expect(validateContractCreation({ opportunityStage: 'NEGOTIATION', accountErpApproved: true, contractCreated: false, productCount: 1 }).allowed).toBe(false);
    expect(validateContractCreation({ opportunityStage: 'CLOSED_WON', accountErpApproved: false, contractCreated: false, productCount: 1 }).allowed).toBe(false);
    expect(validateContractCreation({ opportunityStage: 'CLOSED_WON', accountErpApproved: true, contractCreated: false, productCount: 1 }).allowed).toBe(true);
  });

  it('requires collection plan total to equal contract amount', () => {
    expect(validatePlanTotal(1000, [{ amount: 500 }, { amount: 500 }]).allowed).toBe(true);
    expect(validatePlanTotal(1000, [{ amount: 400 }, { amount: 500 }]).allowed).toBe(false);
  });

  it('requires changed plan to allocate all outstanding amount', () => {
    expect(validateChangedPlan(300, [{ amount: 100 }, { amount: 200 }]).allowed).toBe(true);
    expect(validateChangedPlan(300, [{ amount: 200 }]).allowed).toBe(false);
  });
});
