/** Company placement of HQ-published lead fields. Definitions and values live elsewhere. */
export type LeadExtensionRegion = 'basic' | 'keyman' | 'hospital' | 'exclusions';
export type LeadExtensionPlacement = {
  fieldId: string;
  definitionVersion: number;
  createRegion?: LeadExtensionRegion;
  detailRegion?: LeadExtensionRegion;
  createOrder?: number;
  detailOrder?: number;
  visible: boolean;
  readOnly: boolean;
  required: boolean;
};
export type LeadExtensionLayout = {
  schemaVersion: 1;
  placements: LeadExtensionPlacement[];
  /** Display-only columns. Filtering and sorting require separately reviewed adapters. */
  listColumns: string[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const regions = new Set<LeadExtensionRegion>(['basic','keyman','hospital','exclusions']);
export function validLeadExtensionLayout(raw: unknown, selected?: ReadonlyArray<{id:string;version:number}>): raw is LeadExtensionLayout {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const layout = raw as Record<string, unknown>;
  if (Object.keys(layout).some(key => !['schemaVersion','placements','listColumns'].includes(key)) || layout.schemaVersion !== 1 || !Array.isArray(layout.placements) || !Array.isArray(layout.listColumns) || layout.placements.length > 100 || layout.listColumns.length > 100) return false;
  const seen = new Set<string>();
  for (const value of layout.placements) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const item = value as Record<string, unknown>;
    if (Object.keys(item).some(key => !['fieldId','definitionVersion','createRegion','detailRegion','createOrder','detailOrder','visible','readOnly','required'].includes(key))) return false;
    if (typeof item.fieldId !== 'string' || !uuid.test(item.fieldId) || item.fieldId !== item.fieldId.toLowerCase() || seen.has(item.fieldId)) return false;
    seen.add(item.fieldId);
    if (!Number.isSafeInteger(item.definitionVersion) || Number(item.definitionVersion) < 1 || typeof item.visible !== 'boolean' || typeof item.readOnly !== 'boolean' || typeof item.required !== 'boolean') return false;
    if (item.createRegion !== undefined && !regions.has(item.createRegion as LeadExtensionRegion) || item.detailRegion !== undefined && !regions.has(item.detailRegion as LeadExtensionRegion)) return false;
    if (item.createOrder !== undefined && (!Number.isSafeInteger(item.createOrder) || Number(item.createOrder) < 0 || Number(item.createOrder) > 100) || item.detailOrder !== undefined && (!Number.isSafeInteger(item.detailOrder) || Number(item.detailOrder) < 0 || Number(item.detailOrder) > 100)) return false;
    if ((item.createOrder !== undefined && item.createRegion === undefined) || (item.detailOrder !== undefined && item.detailRegion === undefined)) return false;
    if (item.required && (!item.visible || item.readOnly || !item.createRegion || !item.detailRegion)) return false;
  }
  const columns = layout.listColumns as unknown[];
  if (columns.some(id => typeof id !== 'string' || !uuid.test(id) || id !== id.toLowerCase() || !seen.has(id) || !(layout.placements as LeadExtensionPlacement[]).some(p => p.fieldId === id && p.visible && p.detailRegion))) return false;
  if (new Set(columns).size !== columns.length) return false;
  if (selected && (seen.size !== selected.length || selected.some(ref => !seen.has(ref.id) || !(layout.placements as LeadExtensionPlacement[]).some(p => p.fieldId === ref.id && p.definitionVersion === ref.version)))) return false;
  return true;
}
