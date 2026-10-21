import { afterEach, describe, expect, it } from 'vitest';
import { convertLeadToMock, resetLeadConversionMocks } from '../lead/lead-conversion-mock';
import {
  addAccountActivity,
  addAccountContact,
  getAccountRelationSummary,
  resetAccountRelationMocks
} from './account-relations-mock';

const EXISTING_ACCOUNT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

afterEach(() => {
  resetAccountRelationMocks();
  resetLeadConversionMocks();
});

describe('account relation mock', () => {
  it('persists Account contacts and activities by account id', () => {
    addAccountContact(EXISTING_ACCOUNT_ID, {
      name: 'Jane Doe',
      role: 'Keyman',
      phone: '+82-10-1000-2000',
      email: 'jane@example.com'
    });
    addAccountActivity(EXISTING_ACCOUNT_ID, 'Owner One', {
      type: 'VISIT',
      subject: 'Demo visit',
      note: 'Completed',
      occurredAt: '2026-09-16T06:00:00.000Z'
    });

    const summary = getAccountRelationSummary(EXISTING_ACCOUNT_ID);
    expect(summary.contactCount).toBe(1);
    expect(summary.activityCount).toBe(1);
    expect(summary.contacts[0]).toMatchObject({ name: 'Jane Doe', source: 'MANUAL' });
    expect(summary.activities[0]).toMatchObject({ type: 'VISIT', subject: 'Demo visit' });
    expect(summary.latestActivityAt).toBe('2026-09-16T06:00:00.000Z');
  });

  it('surfaces Lead conversion Contact and Opportunity on the linked Account', () => {
    convertLeadToMock({
      leadId: 'lead-for-account-relations',
      organizationName: 'Conversion Dental',
      contactName: 'Dr. Kim',
      phone: '010-1234-5678',
      email: 'doctor@example.com',
      address: 'Busan',
      country: 'KR',
      ownerName: 'Owner One',
      expectedAmount: 30000000
    }, {
      accountMode: 'EXISTING',
      existingAccountId: EXISTING_ACCOUNT_ID,
      createContact: true,
      createOpportunity: true,
      opportunityName: 'Implant Opportunity'
    });

    const summary = getAccountRelationSummary(EXISTING_ACCOUNT_ID);
    expect(summary.contactCount).toBe(1);
    expect(summary.opportunityCount).toBe(1);
    expect(summary.contacts[0]).toMatchObject({ name: 'Dr. Kim', source: 'LEAD_CONVERSION' });
    expect(summary.opportunities[0]).toMatchObject({ name: 'Implant Opportunity', expectedAmount: 30000000 });
  });
});
