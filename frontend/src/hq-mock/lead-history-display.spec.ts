import { describe, expect, it } from 'vitest';
import { leadHistoryDetails } from './lead-history-display';

describe('lead history details', () => {
  it('shows the stored field names for additional information updates', () => {
    expect(leadHistoryDetails({ action: 'LEAD.additional', fields: ['leadSource', 'interestProducts'] })).toEqual({ fields: ['leadSource', 'interestProducts'] });
  });
  it('shows the type of related record without exposing its name', () => {
    expect(leadHistoryDetails({ action: 'LEAD.related', kind: 'coordinate', name: 'private' })).toEqual({ kind: 'coordinate' });
  });
  it('preserves ordinary field changes', () => {
    expect(leadHistoryDetails({ changes: { chair_count: { before: 4, after: 6 } } })).toEqual({ chair_count: { before: 4, after: 6 } });
  });
  it('shows recorded additional values before and after', () => {
    const changes = { interestProducts: { before: 'A', after: 'B' } };
    expect(leadHistoryDetails({ action: 'LEAD.additional', fields: ['interestProducts'], additional_changes: changes })).toEqual(changes);
  });
});
