import { afterEach, describe, expect, it } from 'vitest';
import { createSandboxLead, listSandboxLeads, resetSandboxLeads } from './lead-sandbox';

afterEach(() => {
  resetSandboxLeads();
});

describe('lead sandbox', () => {
  it('persists a quick-created lead', () => {
    const created = createSandboxLead({
      hospitalName: 'Sunrise Dental',
      country: 'US',
      phone: '+1-555-0100',
      contactName: 'Jane Doe',
      address: '12 Market St'
    });
    expect(created.public_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(created.status).toBe('NEW');
    expect(listSandboxLeads()[0]).toMatchObject({
      hospital_name: 'Sunrise Dental',
      phone: '+1-555-0100',
      sido: 'US',
      owner_name: 'Jane Doe'
    });
  });
});
