import type { HqRouteContext } from './app.js';
import type { HqRow } from './model.js';
/** Project configured delivery fields for every order read or mutation response. */
export function visibleOrderDelivery(c: HqRouteContext, row: HqRow): HqRow {
  const result = { ...row };
  for (const db of ['delivery_address_type', 'delivery_address', 'lab_public_id', 'express_yn', 'note']) {
    if (!Object.hasOwn(result, db)) continue;
    const field = c.app.standardFor(c.actor).fields.find(f => f.entity === 'order' && f.current.dbField === db);
    if (!field) { delete result[db]; continue; }
    const value = c.app.policyFor(c.actor).readField(field.fieldKey, c.app.context(c.actor, { ...c.app.values(row), [field.fieldKey]: row[db] }));
    if (value === undefined) delete result[db]; else result[db] = value;
  }
  // Recipient details share the existing delivery-address visibility boundary.
  if (!Object.hasOwn(result, 'delivery_address') || result.delivery_address !== row.delivery_address) {
    delete result.recipient_name; delete result.recipient_phone; delete result.postal_code;
  }
  return result;
}
