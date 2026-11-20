import { describe, expect, it } from 'vitest';
import { filterLeadActivities } from './lead-activity-filter';
const rows = [{ version: 1, public_id: '1', related_type: 'LEAD', related_public_id: 'a', subject: '방문', status: 'PLANNED' }, { version: 1, public_id: '2', related_type: 'LEAD', related_public_id: 'a', subject: '통화', status: 'COMPLETED' }, { version: 1, public_id: '3', related_type: 'LEAD', related_public_id: 'b', subject: '다른 리드', status: 'PLANNED' }];
describe('lead activity filtering', () => {
  it('shows only activities for the selected lead and chosen status', () => {
    expect(filterLeadActivities(rows, 'a', 'PLANNED').map(row => row.public_id)).toEqual(['1']);
    expect(filterLeadActivities(rows, 'a', '').map(row => row.public_id)).toEqual(['1', '2']);
  });
});

