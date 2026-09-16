import { describe, expect, it } from 'vitest';
import { nextDemoAccountCode } from './demo-account-repository';
import { DEMO_ACCOUNT_SEED } from './demo-data';

describe('CRM-DEMO-001 account mock repository', () => {
  it('generates the next country-prefixed business key', () => {
    expect(nextDemoAccountCode(DEMO_ACCOUNT_SEED, 'United States')).toBe('US-CUST-0002');
    expect(nextDemoAccountCode(DEMO_ACCOUNT_SEED, 'Mexico')).toBe('MX-CUST-0002');
    expect(nextDemoAccountCode(DEMO_ACCOUNT_SEED, 'India')).toBe('IN-CUST-0002');
  });

  it('uses a generic prefix for countries outside the demo seed', () => {
    expect(nextDemoAccountCode(DEMO_ACCOUNT_SEED, 'Other')).toBe('GL-CUST-0001');
  });
});
