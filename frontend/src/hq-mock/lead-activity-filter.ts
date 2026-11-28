import type { CustomerRecord } from './customer-model';
export function filterLeadActivities(rows: CustomerRecord[], leadId: string, status: string): CustomerRecord[] {
  return rows.filter(row => row.related_type === 'LEAD' && row.related_public_id === leadId && (!status || row.status === status));
}
