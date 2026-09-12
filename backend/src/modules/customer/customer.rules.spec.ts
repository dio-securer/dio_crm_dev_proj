import { canTransitionLead } from './customer.rules';

describe('Lead state transition rules', () => {
  it('allows normal forward transition', () => {
    expect(canTransitionLead('NEW', 'FIRST_VISIT', [])).toEqual({ allowed: true, reverse: false });
  });

  it('blocks converted lead transitions', () => {
    expect(canTransitionLead('CONVERTED', 'KEYMAN_MEETING', [])).toMatchObject({ allowed: false });
  });

  it('requires admin permission and reason for reverse transition', () => {
    expect(canTransitionLead('KEYMAN_MEETING', 'FIRST_VISIT', [])).toMatchObject({ allowed: false, reverse: true });
    expect(canTransitionLead('KEYMAN_MEETING', 'FIRST_VISIT', ['LEAD.STATUS.REVERSE'])).toMatchObject({ allowed: false, reverse: true });
    expect(canTransitionLead('KEYMAN_MEETING', 'FIRST_VISIT', ['LEAD.STATUS.REVERSE'], '업무상 단계 수정')).toEqual({ allowed: true, reverse: true });
  });

  it('allows contact exclusion from an open stage', () => {
    expect(canTransitionLead('FIRST_VISIT', 'CONTACT_EXCLUDED', [])).toEqual({ allowed: true, reverse: false });
  });
});
