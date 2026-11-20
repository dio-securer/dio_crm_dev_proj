import type { ConfigEntry, ConfigKind, ConfigProperty, ConfigValueRule } from './crm-customization.js';

/** Editor metadata only. Never serialized into CompanyConfig or release hashes. */
export type EditorPropertyKey = ConfigProperty | 'translation';
export type EditorPropertyDescriptor = {
  key: EditorPropertyKey;
  targetKind: ConfigKind;
  valueType: 'boolean' | 'integer' | 'scalar' | 'masking' | 'translation';
  supported: boolean;
  editable: boolean;
  reason: 'UNSUPPORTED_TARGET' | 'NOT_CAPABLE' | 'LOCKED' | null;
  storage: 'patch' | 'translation';
  standardValue: unknown;
  valueRule?: ConfigValueRule;
  authority: 'COMPANY_WITH_STANDARD_CAPABILITY';
};

const definitions: ReadonlyArray<readonly [EditorPropertyKey, EditorPropertyDescriptor['valueType']]> = [
  ['enabled', 'boolean'], ['visible', 'boolean'], ['readOnly', 'boolean'],
  ['required', 'boolean'], ['order', 'integer'], ['default', 'scalar'],
  ['masking', 'masking'], ['translation', 'translation'],
];
const kinds: ReadonlyArray<string> = ['MENU','SCREEN','TAB','POPUP','SECTION','FIELD','ACTION','CODE','OUTPUT'];

/** The caller supplies the trusted catalog entry, not an entry authored by a client. */
export function describeEditorProperty(entry: ConfigEntry, key: string): EditorPropertyDescriptor | null {
  const definition = definitions.find(([name]) => name === key);
  if (!definition || !kinds.includes(entry.kind)) return null;
  const property = definition[0];
  const supported = entry.support === 'supported';
  const capable = property === 'translation' || entry.capabilities.includes(property);
  const locked = property !== 'translation' && entry.locks.includes(property);
  const reason = !supported ? 'UNSUPPORTED_TARGET' : !capable ? 'NOT_CAPABLE' : locked ? 'LOCKED' : null;
  return {
    key: property, targetKind: entry.kind, valueType: definition[1],
    supported: supported && capable, editable: reason === null, reason,
    storage: property === 'translation' ? 'translation' : 'patch',
    // Undefined preserves absence. Translation resolves through locale resources, not settings.
    standardValue: property === 'translation' ? undefined : entry.settings[property],
    ...(entry.valueRule ? { valueRule: structuredClone(entry.valueRule) } : {}),
    authority: 'COMPANY_WITH_STANDARD_CAPABILITY',
  };
}

export function listEditorProperties(entry: ConfigEntry): EditorPropertyDescriptor[] {
  return definitions.map(([key]) => describeEditorProperty(entry, key)).filter((item): item is EditorPropertyDescriptor => item !== null);
}

/** Permission/capability gate only: value, dependency and publication validation remain
 * in resolveCompanyConfig/validateTranslations; actor/locale checks remain with callers. */
export function requireEditableEditorProperty(entry: ConfigEntry, key: string): EditorPropertyDescriptor {
  const property = describeEditorProperty(entry, key);
  if (!property) throw new Error('UNKNOWN_EDITOR_PROPERTY');
  if (!property.editable) throw new Error(property.reason ?? 'SETTING_LOCKED');
  return property;
}
