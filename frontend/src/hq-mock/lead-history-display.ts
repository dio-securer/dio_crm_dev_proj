export function leadHistoryDetails(item: Record<string, unknown>): unknown {
  if (item.changes && typeof item.changes === 'object') return item.changes;
  if (item.action === 'LEAD.additional' && item.additional_changes && typeof item.additional_changes === 'object') return item.additional_changes;
  if (item.action === 'LEAD.additional' && Array.isArray(item.fields)) return { fields: item.fields.filter(field => typeof field === 'string') };
  if (item.action === 'LEAD.related' && (item.kind === 'coordinate' || item.kind === 'campaign')) return { kind: item.kind };
  return { from: item.from_status ?? item.from_owner_user_id, to: item.to_status ?? item.to_owner_user_id, reason: item.reason, conversion: item.conversion };
}
