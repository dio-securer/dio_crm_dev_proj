/**
 * H01: serializable HQ metadata and pure validation/policy contracts.
 * No transport, React, database, ERP call or country editor lives here.
 * Existing applications adopt these contracts in H02–H07; metadata is not
 * evidence that a screen or an API adapter has already been implemented.
 */
export type HqScalar = string | number | boolean | null;
export type HqCondition =
  | { kind: 'constant'; value: boolean }
  | { kind: 'present'; fieldKey: string }
  | { kind: 'equals'; fieldKey: string; value: HqScalar }
  | { kind: 'oneOf'; fieldKey: string; values: HqScalar[] }
  | { kind: 'all' | 'any'; conditions: HqCondition[] }
  | { kind: 'not'; condition: HqCondition };

export type HqEvidenceKind = 'observed' | 'training' | 'code' | 'assumption' | 'unknown';
export interface HqEvidence {
  evidenceKey: string;
  kind: HqEvidenceKind;
  source: string;
  analysisIds: string[];
  note: string;
}
export interface HqNamed {
  label: string;
  labelKey: string;
  evidenceKeys: string[];
}
export interface HqAccess {
  permissions: string[];
  features: string[];
}
export interface HqProcess extends HqNamed, HqAccess {
  processKey: string;
  enabled: boolean;
  order: number;
  screenKeys: string[];
  transitionKeys: string[];
  dependsOn: string[];
  startStates: string[];
  endStates: string[];
}
export interface HqScreen extends HqNamed, HqAccess {
  screenKey: string;
  routeKey: string;
  path: string;
  kind: 'page' | 'dashboard';
  devices: Array<'desktop' | 'mobile'>;
  enabled: boolean;
  processKeys: string[];
  tabKeys: string[];
  sectionKeys: string[];
  actionKeys: string[];
}
export interface HqMenuNode extends HqNamed, HqAccess {
  menuKey: string;
  parentKey: string | null;
  screenKey?: string;
  enabled: boolean;
  order: number;
}
export interface HqTab extends HqNamed {
  tabKey: string;
  screenKey: string;
  enabled: boolean;
  order: number;
  sectionKeys: string[];
}
export interface HqSection extends HqNamed {
  sectionKey: string;
  screenKey: string;
  tabKey?: string;
  kind: 'section' | 'detail' | 'dialog';
  enabled: boolean;
  order: number;
  fieldKeys: string[];
  actionKeys: string[];
}
export interface HqValueRule {
  type: 'string' | 'number' | 'boolean' | 'reference' | 'date' | 'rows';
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  integer?: boolean;
  options?: HqScalar[];
}
export type HqHiddenFallback =
  | { kind: 'default'; value: HqScalar }
  | { kind: 'field'; fieldKey: string }
  | { kind: 'excludedProcess'; processKey: string };
export interface HqField extends HqNamed {
  fieldKey: string;
  entity: string;
  /** Exactly one owner: an actual section, or an explicitly planned catalog row. */
  sectionKey?: string;
  plannedCatalogId?: string;
  uiType: string;
  valueRule: HqValueRule;
  observedRequired: boolean | 'unknown';
  requiredRule: HqCondition;
  visible: boolean;
  visibleWhen?: HqCondition;
  readOnly: boolean;
  readOnlyWhen?: HqCondition;
  readPermissions: string[];
  writePermissions: string[];
  /** Any one owning action's access/state gates must allow editing; input completeness is not required. */
  writeActionKeys?: string[];
  source: 'CRM' | 'ERP' | 'HIRA' | 'GPS' | 'DERIVED' | 'UNKNOWN';
  masking: 'none' | 'redact' | 'last4';
  unmaskPermission?: string;
  locked: boolean;
  overridePolicy: 'locked' | 'presentation' | 'restrict';
  defaultValue?: HqScalar;
  hiddenFallback?: HqHiddenFallback;
  current: { read: boolean; write: boolean; apiField?: string; dbField?: string; note: string };
  notes: string;
}
export interface HqAction extends HqNamed, HqAccess {
  actionKey: string;
  processKey: string;
  /** Exactly one owner; planned actions must remain disabled. */
  screenKey?: string;
  plannedCatalogId?: string;
  enabled: boolean;
  support: 'current' | 'api-only' | 'planned';
  inputFieldKeys: string[];
  requiredFieldKeys: string[];
  transitionKeys: string[];
  condition: HqCondition;
  endpoint?: string;
  result: string;
  errors: string[];
  notes: string;
}
export interface HqTransition {
  transitionKey: string;
  processKey: string;
  actionKey: string;
  stateFieldKey: string;
  /** Explicit selected destination for actions such as stage changes, not APPROVE/REJECT decisions. */
  targetFieldKey?: string;
  fromStates: string[];
  toState: string;
  requiredFieldKeys: string[];
  condition: HqCondition;
  evidenceKeys: string[];
}
export interface HqCoverage extends HqNamed {
  catalogId: string;
  origin: 'catalog' | 'additional';
  processKey: string;
  screenKeys: string[];
  sectionKeys: string[];
  fieldKeys: string[];
  actionKeys: string[];
  planned: boolean;
  enabled: boolean;
  status: 'partial' | 'unimplemented';
  implementationStage: 'H03' | 'H04' | 'H05' | 'H06' | 'H07';
  notes: string;
}
export interface HqStandard {
  schemaVersion: 1;
  standardKey: string;
  version: string;
  basedOnCommit: string;
  evidenceKeys: string[];
  processes: HqProcess[];
  screens: HqScreen[];
  menus: HqMenuNode[];
  tabs: HqTab[];
  sections: HqSection[];
  fields: HqField[];
  actions: HqAction[];
  transitions: HqTransition[];
  evidence: HqEvidence[];
  coverage: HqCoverage[];
  /** Set only on an explicit, validated country snapshot, never auto-updated. */
  parent?: { standardKey: string; version: string; overrideKey: string };
}
export interface HqScreenBinding { screenKey: string; routeKey: string; path: string }
export interface HqCapabilities {
  screens: readonly HqScreenBinding[];
  catalogIds: readonly string[];
  featureKeys: readonly string[];
}
export interface HqValidationIssue { code: string; path: string; message: string }
export interface HqValidationResult { valid: boolean; errors: HqValidationIssue[] }
export interface HqContext {
  activeProcesses: readonly string[];
  permissions: readonly string[];
  features: readonly string[];
  values: Readonly<Record<string, unknown>>;
  device?: 'desktop' | 'mobile';
}
export type HqOverrideTarget = 'process' | 'screen' | 'menu' | 'tab' | 'section' | 'field' | 'action';
export interface HqOverride {
  overrideKey: string;
  parentStandardKey: string;
  parentVersion: string;
  patches: Array<{ target: HqOverrideTarget; key: string; changes: Record<string, unknown> }>;
}
export interface HqOverrideResult extends HqValidationResult { standard?: HqStandard }

export const HQ_TRUE: HqCondition = { kind: 'constant', value: true };
export const HQ_FALSE: HqCondition = { kind: 'constant', value: false };

type JsonRecord = Record<string, unknown>;
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const object = (value: unknown): value is JsonRecord => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const scalar = (value: unknown): value is HqScalar => value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
const present = (value: unknown) => value !== undefined && value !== null && (typeof value !== 'string' || value.trim().length > 0) && (!Array.isArray(value) || value.length > 0);
const alwaysFalse = (condition: HqCondition) => condition.kind === 'constant' && !condition.value;
const alwaysTrue = (condition: HqCondition) => condition.kind === 'constant' && condition.value;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const allPermissions = (required: readonly string[], actual: readonly string[]) => required.every(key => actual.includes(key));

/** Zero and false are legitimate values. A missing property never equals null. */
export function evaluateHqCondition(condition: HqCondition, values: Readonly<Record<string, unknown>>, depth = 0): boolean {
  if (!object(values) || !validConditionShape(condition, () => undefined, '', depth)) return false;
  switch (condition.kind) {
    case 'constant': return condition.value === true;
    case 'present': return own(values, condition.fieldKey) && present(values[condition.fieldKey]);
    case 'equals': return own(values, condition.fieldKey) && values[condition.fieldKey] === condition.value;
    case 'oneOf': return own(values, condition.fieldKey) && Array.isArray(condition.values) && condition.values.some(value => values[condition.fieldKey] === value);
    case 'all': return Array.isArray(condition.conditions) && condition.conditions.length > 0 && condition.conditions.every(item => evaluateHqCondition(item, values, depth + 1));
    case 'any': return Array.isArray(condition.conditions) && condition.conditions.length > 0 && condition.conditions.some(item => evaluateHqCondition(item, values, depth + 1));
    case 'not': return validConditionShape(condition.condition, () => undefined, '', depth + 1) && !evaluateHqCondition(condition.condition, values, depth + 1);
    default: return false;
  }
}

/** Value validation is intentionally not an ERP/business transaction engine. */
export function validateHqFieldValue(field: HqField, value: unknown, required = false): string[] {
  if (!present(value)) return required ? ['REQUIRED'] : [];
  const rule = field.valueRule;
  const errors: string[] = [];
  if (rule.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) errors.push('TYPE');
  if (rule.type === 'boolean' && typeof value !== 'boolean') errors.push('TYPE');
  if (['string', 'reference', 'date'].includes(rule.type) && typeof value !== 'string') errors.push('TYPE');
  if (rule.type === 'rows' && !Array.isArray(value)) errors.push('TYPE');
  if (typeof value === 'number') {
    if (rule.integer && !Number.isInteger(value)) errors.push('INTEGER');
    if (rule.min !== undefined && value < rule.min) errors.push('MIN');
    if (rule.max !== undefined && value > rule.max) errors.push('MAX');
  }
  if (typeof value === 'string' || Array.isArray(value)) {
    if (rule.minLength !== undefined && value.length < rule.minLength) errors.push('MIN_LENGTH');
    if (rule.maxLength !== undefined && value.length > rule.maxLength) errors.push('MAX_LENGTH');
  }
  if (rule.options && !rule.options.some(option => option === value)) errors.push('OPTION');
  return errors;
}

/** Conservative proof that every required alternate value satisfies the hidden destination field. */
function compatibleFallbackDomain(alternate: HqField, destination: HqField): boolean {
  const source = alternate.valueRule; const target = destination.valueRule;
  if (source.type !== target.type) return false;
  if (source.options) return source.options.length > 0 && source.options.every(value => validateHqFieldValue(alternate, value, true).length === 0 && validateHqFieldValue(destination, value, true).length === 0);
  if (target.options) return source.type === 'boolean' && [false, true].every(value => validateHqFieldValue(destination, value, true).length === 0);
  if (source.type === 'number') {
    return (!target.integer || source.integer === true)
      && (source.min ?? -Infinity) >= (target.min ?? -Infinity)
      && (source.max ?? Infinity) <= (target.max ?? Infinity);
  }
  if (['string', 'reference', 'date', 'rows'].includes(source.type)) {
    return Math.max(1, source.minLength ?? 0) >= Math.max(1, target.minLength ?? 0)
      && (source.maxLength ?? Infinity) <= (target.maxLength ?? Infinity);
  }
  return true;
}

type IssueWriter = (code: string, path: string, message: string) => void;
function validConditionShape(value: unknown, add: IssueWriter, path: string, depth = 0): value is HqCondition {
  if (!object(value) || depth > 32) { add('CONDITION', path, 'Expected a bounded declarative condition'); return false; }
  let valid = true;
  const fail = () => { add('CONDITION', path, 'Invalid condition operation or operands'); valid = false; };
  const properties: Record<string, string[]> = { constant: ['kind', 'value'], present: ['kind', 'fieldKey'], equals: ['kind', 'fieldKey', 'value'], oneOf: ['kind', 'fieldKey', 'values'], all: ['kind', 'conditions'], any: ['kind', 'conditions'], not: ['kind', 'condition'] };
  const allowed = typeof value.kind === 'string' && own(properties, value.kind) ? properties[value.kind] : [];
  if (Object.keys(value).some(key => !allowed.includes(key))) fail();
  switch (value.kind) {
    case 'constant': if (typeof value.value !== 'boolean') fail(); break;
    case 'present': if (!text(value.fieldKey)) fail(); break;
    case 'equals': if (!text(value.fieldKey) || !own(value, 'value') || !scalar(value.value)) fail(); break;
    case 'oneOf': if (!text(value.fieldKey) || !Array.isArray(value.values) || !value.values.length || !value.values.every(scalar)) fail(); break;
    case 'all': case 'any':
      if (!Array.isArray(value.conditions) || !value.conditions.length) fail();
      else value.conditions.forEach((item, i) => { if (!validConditionShape(item, add, `${path}.conditions[${i}]`, depth + 1)) valid = false; });
      break;
    case 'not': if (!validConditionShape(value.condition, add, `${path}.condition`, depth + 1)) valid = false; break;
    default: fail();
  }
  return valid;
}

const collectionIds = {
  processes: 'processKey', screens: 'screenKey', menus: 'menuKey', tabs: 'tabKey',
  sections: 'sectionKey', fields: 'fieldKey', actions: 'actionKey', transitions: 'transitionKey',
  evidence: 'evidenceKey', coverage: 'catalogId'
} as const;
type Collection = keyof typeof collectionIds;
type Shape = Record<string, string>;
const named: Shape = { label: 'text', labelKey: 'text', evidenceKeys: 'keys' };
const access: Shape = { permissions: 'keys', features: 'keys' };
const shapes: Record<Collection, Shape> = {
  processes: { ...named, ...access, processKey: 'text', enabled: 'boolean', order: 'number', screenKeys: 'keys', transitionKeys: 'keys', dependsOn: 'keys', startStates: 'keys', endStates: 'keys' },
  screens: { ...named, ...access, screenKey: 'text', routeKey: 'text', path: 'text', kind: 'enum:page,dashboard', devices: 'keys', enabled: 'boolean', processKeys: 'keys', tabKeys: 'keys', sectionKeys: 'keys', actionKeys: 'keys' },
  menus: { ...named, ...access, menuKey: 'text', parentKey: 'nullableText', 'screenKey?': 'text', enabled: 'boolean', order: 'number' },
  tabs: { ...named, tabKey: 'text', screenKey: 'text', enabled: 'boolean', order: 'number', sectionKeys: 'keys' },
  sections: { ...named, sectionKey: 'text', screenKey: 'text', 'tabKey?': 'text', kind: 'enum:section,detail,dialog', enabled: 'boolean', order: 'number', fieldKeys: 'keys', actionKeys: 'keys' },
  fields: { ...named, fieldKey: 'text', entity: 'text', 'sectionKey?': 'text', 'plannedCatalogId?': 'text', uiType: 'text', valueRule: 'object', observedRequired: 'observed', requiredRule: 'condition', visible: 'boolean', 'visibleWhen?': 'condition', readOnly: 'boolean', 'readOnlyWhen?': 'condition', readPermissions: 'keys', writePermissions: 'keys', 'writeActionKeys?': 'keys', source: 'enum:CRM,ERP,HIRA,GPS,DERIVED,UNKNOWN', masking: 'enum:none,redact,last4', 'unmaskPermission?': 'text', locked: 'boolean', overridePolicy: 'enum:locked,presentation,restrict', 'defaultValue?': 'scalar', 'hiddenFallback?': 'object', current: 'object', notes: 'string' },
  actions: { ...named, ...access, actionKey: 'text', processKey: 'text', 'screenKey?': 'text', 'plannedCatalogId?': 'text', enabled: 'boolean', support: 'enum:current,api-only,planned', inputFieldKeys: 'keys', requiredFieldKeys: 'keys', transitionKeys: 'keys', condition: 'condition', 'endpoint?': 'text', result: 'text', errors: 'keys', notes: 'string' },
  transitions: { transitionKey: 'text', processKey: 'text', actionKey: 'text', stateFieldKey: 'text', 'targetFieldKey?': 'text', fromStates: 'keys', toState: 'text', requiredFieldKeys: 'keys', condition: 'condition', evidenceKeys: 'keys' },
  evidence: { evidenceKey: 'text', kind: 'enum:observed,training,code,assumption,unknown', source: 'text', analysisIds: 'keys', note: 'string' },
  coverage: { ...named, catalogId: 'text', origin: 'enum:catalog,additional', processKey: 'text', screenKeys: 'keys', sectionKeys: 'keys', fieldKeys: 'keys', actionKeys: 'keys', planned: 'boolean', enabled: 'boolean', status: 'enum:partial,unimplemented', implementationStage: 'enum:H03,H04,H05,H06,H07', notes: 'string' }
};

function checkShape(value: unknown, shape: Shape, path: string, add: IssueWriter): value is JsonRecord {
  if (!object(value)) { add('SHAPE', path, 'Expected an object'); return false; }
  const allowed = new Set(Object.keys(shape).map(key => key.replace(/\?$/, '')));
  for (const key of Object.keys(value)) if (!allowed.has(key)) add('UNKNOWN_PROPERTY', `${path}.${key}`, 'Property is not part of the contract');
  for (const [spec, type] of Object.entries(shape)) {
    const key = spec.replace(/\?$/, '');
    if (spec.endsWith('?') && !own(value, key)) continue;
    const item = value[key];
    let valid = false;
    if (type === 'condition') { validConditionShape(item, add, `${path}.${key}`); continue; }
    if (type === 'text') valid = text(item);
    else if (type === 'string') valid = typeof item === 'string';
    else if (type === 'nullableText') valid = item === null || text(item);
    else if (type === 'boolean') valid = typeof item === 'boolean';
    else if (type === 'number') valid = typeof item === 'number' && Number.isFinite(item);
    else if (type === 'scalar') valid = scalar(item);
    else if (type === 'object') valid = object(item);
    else if (type === 'observed') valid = item === true || item === false || item === 'unknown';
    else if (type === 'keys') valid = Array.isArray(item) && item.every(text) && new Set(item).size === item.length;
    else if (type === 'scalars') valid = Array.isArray(item) && item.length > 0 && item.every(scalar);
    else if (type === 'array') valid = Array.isArray(item);
    else if (type.startsWith('enum:')) valid = typeof item === 'string' && type.slice(5).split(',').includes(item);
    if (!valid) add('SHAPE', `${path}.${key}`, `Expected ${type}`);
  }
  return true;
}

function inspectHqJson(value: unknown, add: IssueWriter, path = '$', depth = 0, ancestors = new Set<object>()): void {
  if (scalar(value)) return;
  if (depth > 64 || (!object(value) && !Array.isArray(value)) || ancestors.has(value as object)) { add('JSON', path, 'Expected finite, acyclic JSON data'); return; }
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) { add('JSON', path, 'Expected a plain JSON object'); return; }
  ancestors.add(value as object);
  Object.entries(value as object).forEach(([key, item]) => inspectHqJson(item, add, `${path}.${key}`, depth + 1, ancestors));
  ancestors.delete(value as object);
}

/** Check unknown JSON safely before semantic checks; accumulate actionable paths. */
export function validateHqStandard(input: unknown, capabilities: HqCapabilities): HqValidationResult {
  const errors: HqValidationIssue[] = [];
  const add: IssueWriter = (code, path, message) => { errors.push({ code, path, message }); };
  const result = () => ({ valid: errors.length === 0, errors });
  inspectHqJson(input, add);
  if (!object(input)) add('SHAPE', '$', 'Expected an HQ standard object');
  if (errors.length || !object(input)) return result();
  const rootShape: Shape = { schemaVersion: 'number', standardKey: 'text', version: 'text', basedOnCommit: 'text', evidenceKeys: 'keys', 'parent?': 'object' };
  Object.keys(collectionIds).forEach(key => { rootShape[key] = 'collection'; });
  const rootCopy = { ...input };
  for (const key of Object.keys(collectionIds)) delete rootCopy[key];
  const basicShape = { ...rootShape };
  for (const key of Object.keys(collectionIds)) delete basicShape[key];
  checkShape(rootCopy, basicShape, '$', add);
  if (input.schemaVersion !== 1) add('VERSION', '$.schemaVersion', 'Unsupported schema version');
  if (input.parent) checkShape(input.parent, { standardKey: 'text', version: 'text', overrideKey: 'text' }, '$.parent', add);
  for (const collection of Object.keys(collectionIds) as Collection[]) {
    const rows = input[collection];
    if (!Array.isArray(rows)) { add('SHAPE', collection, 'Expected an array'); continue; }
    const ids = new Set<string>();
    rows.forEach((row, index) => {
      const path = `${collection}[${index}]`;
      if (!checkShape(row, shapes[collection], path, add)) return;
      const id = row[collectionIds[collection]];
      if (typeof id === 'string') {
        if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(id)) add('ID', path, 'Use a stable nonblank identifier, not a label');
        if (ids.has(id)) add('DUPLICATE_ID', path, `Duplicate ${id}`);
        ids.add(id);
      }
      if (collection === 'fields') {
        checkShape(row.current, { read: 'boolean', write: 'boolean', 'apiField?': 'text', 'dbField?': 'text', note: 'string' }, `${path}.current`, add);
        checkShape(row.valueRule, { type: 'enum:string,number,boolean,reference,date,rows', 'min?': 'number', 'max?': 'number', 'minLength?': 'number', 'maxLength?': 'number', 'integer?': 'boolean', 'options?': 'scalars' }, `${path}.valueRule`, add);
        if (row.hiddenFallback) {
          const fallback = row.hiddenFallback as JsonRecord;
          const spec: Shape = fallback.kind === 'default' ? { kind: 'enum:default', value: 'scalar' } : fallback.kind === 'field' ? { kind: 'enum:field', fieldKey: 'text' } : { kind: 'enum:excludedProcess', processKey: 'text' };
          checkShape(fallback, spec, `${path}.hiddenFallback`, add);
        }
      }
    });
  }
  if (errors.length) return result();
  const standard = input as unknown as HqStandard;
  const indexes = Object.fromEntries((Object.keys(collectionIds) as Collection[]).map(key => [key, new Map((standard[key] as unknown as JsonRecord[]).map(row => [row[collectionIds[key]], row]))])) as Record<Collection, Map<string, JsonRecord>>;
  const ref = (collection: Collection, key: string, path: string) => { if (!indexes[collection].has(key)) add('MISSING_REF', path, `Unknown ${collection} reference: ${key}`); };
  const refs = (collection: Collection, keys: readonly string[], path: string) => keys.forEach((key, i) => ref(collection, key, `${path}[${i}]`));
  const conditionRefs = (condition: HqCondition, path: string) => {
    if ('fieldKey' in condition) ref('fields', condition.fieldKey, `${path}.fieldKey`);
    if ('conditions' in condition) condition.conditions.forEach((item, i) => conditionRefs(item, `${path}.conditions[${i}]`));
    if ('condition' in condition) conditionRefs(condition.condition, `${path}.condition`);
  };
  refs('evidence', standard.evidenceKeys, 'evidenceKeys');
  if (!standard.evidenceKeys.length) add('EVIDENCE', 'evidenceKeys', 'A baseline needs evidence');
  for (const collection of Object.keys(collectionIds) as Collection[]) {
    standard[collection].forEach((row, i) => {
      if ('evidenceKeys' in row) {
        refs('evidence', row.evidenceKeys, `${collection}[${i}].evidenceKeys`);
        if (!row.evidenceKeys.length) add('EVIDENCE', `${collection}[${i}]`, 'Every definition needs evidence');
      }
      if ('features' in row) row.features.forEach(key => { if (!capabilities.featureKeys.includes(key)) add('FEATURE', `${collection}[${i}].features`, `Unknown feature ${key}`); });
    });
  }
  const screenMap = new Map(standard.screens.map(item => [item.screenKey, item]));
  const processMap = new Map(standard.processes.map(item => [item.processKey, item]));
  const sectionMap = new Map(standard.sections.map(item => [item.sectionKey, item]));
  const tabMap = new Map(standard.tabs.map(item => [item.tabKey, item]));
  const fieldMap = new Map(standard.fields.map(item => [item.fieldKey, item]));
  const actionMap = new Map(standard.actions.map(item => [item.actionKey, item]));
  const coverageMap = new Map(standard.coverage.map(item => [item.catalogId, item]));
  const paths = new Set<string>();
  const routes = new Set<string>();
  standard.screens.forEach((screen, i) => {
    const at = `screens[${i}]`;
    const binding = capabilities.screens.find(item => item.screenKey === screen.screenKey);
    if (!binding || !screen.screenKey.startsWith('HQ_')) add('UNREGISTERED_SCREEN', at, `No registered HQ renderer for ${screen.screenKey}`);
    else if (binding.path !== screen.path || binding.routeKey !== screen.routeKey) add('ROUTE_BINDING', at, 'Route and slot must match the existing renderer');
    if (paths.has(screen.path) || routes.has(screen.routeKey)) add('DUPLICATE_ROUTE', at, 'Duplicate path or route key');
    paths.add(screen.path); routes.add(screen.routeKey);
    if (!screen.devices.length || screen.devices.some(device => !['desktop', 'mobile'].includes(device))) add('DEVICE', `${at}.devices`, 'Unknown or missing device');
    if (!screen.processKeys.length) add('PROCESS', `${at}.processKeys`, 'Screens must belong to at least one process');
    refs('processes', screen.processKeys, `${at}.processKeys`);
    refs('tabs', screen.tabKeys, `${at}.tabKeys`);
    refs('sections', screen.sectionKeys, `${at}.sectionKeys`);
    refs('actions', screen.actionKeys, `${at}.actionKeys`);
    screen.processKeys.forEach(key => { if (processMap.has(key) && !processMap.get(key)!.screenKeys.includes(screen.screenKey)) add('OWNERSHIP', at, `Process ${key} does not reference this screen`); });
    screen.tabKeys.forEach(key => { if (tabMap.has(key) && tabMap.get(key)!.screenKey !== screen.screenKey) add('OWNERSHIP', at, `Tab ${key} belongs to a different screen`); });
    screen.sectionKeys.forEach(key => { if (sectionMap.has(key) && sectionMap.get(key)!.screenKey !== screen.screenKey) add('OWNERSHIP', at, `Section ${key} belongs to a different screen`); });
    screen.actionKeys.forEach(key => { if (actionMap.has(key) && actionMap.get(key)!.screenKey !== screen.screenKey) add('OWNERSHIP', at, `Action ${key} belongs to a different screen`); });
  });
  capabilities.screens.forEach(binding => { if (!screenMap.has(binding.screenKey)) add('SCREEN_COVERAGE', 'screens', `Missing renderer ${binding.screenKey}`); });
  standard.processes.forEach((process, i) => {
    const at = `processes[${i}]`;
    refs('screens', process.screenKeys, `${at}.screenKeys`); refs('transitions', process.transitionKeys, `${at}.transitionKeys`); refs('processes', process.dependsOn, `${at}.dependsOn`);
    if (process.enabled && !process.screenKeys.length) add('PROCESS', at, 'An enabled process requires a registered screen');
    process.screenKeys.forEach(key => { if (screenMap.has(key) && !screenMap.get(key)!.processKeys.includes(process.processKey)) add('OWNERSHIP', at, `Screen ${key} does not reference this process`); });
    process.transitionKeys.forEach(key => { const transition = standard.transitions.find(item => item.transitionKey === key); if (transition && transition.processKey !== process.processKey) add('OWNERSHIP', at, 'Transition belongs to another process'); });
  });
  const cycleCheck = (collection: 'menus' | 'processes', edges: (row: JsonRecord) => string[]) => {
    const done = new Set<string>(); const stack = new Set<string>();
    const visit = (key: string) => {
      if (stack.has(key)) { add('CYCLE', collection, `Cycle involving ${key}`); return; }
      if (done.has(key)) return;
      stack.add(key);
      const row = indexes[collection].get(key);
      if (row) edges(row).forEach(visit);
      stack.delete(key); done.add(key);
    };
    indexes[collection].forEach((_, key) => visit(key));
  };
  standard.menus.forEach((menu, i) => {
    if (menu.parentKey !== null) ref('menus', menu.parentKey, `menus[${i}].parentKey`);
    if (menu.screenKey) ref('screens', menu.screenKey, `menus[${i}].screenKey`);
  });
  cycleCheck('menus', row => row.parentKey ? [row.parentKey as string] : []);
  cycleCheck('processes', row => row.dependsOn as string[]);
  standard.tabs.forEach((tab, i) => {
    ref('screens', tab.screenKey, `tabs[${i}].screenKey`); refs('sections', tab.sectionKeys, `tabs[${i}].sectionKeys`);
    if (screenMap.has(tab.screenKey) && !screenMap.get(tab.screenKey)!.tabKeys.includes(tab.tabKey)) add('OWNERSHIP', `tabs[${i}]`, 'Parent screen does not contain tab');
    tab.sectionKeys.forEach(key => { if (sectionMap.has(key) && sectionMap.get(key)!.tabKey !== tab.tabKey) add('OWNERSHIP', `tabs[${i}]`, 'Section belongs to another tab'); });
  });
  standard.sections.forEach((section, i) => {
    const at = `sections[${i}]`;
    ref('screens', section.screenKey, `${at}.screenKey`); refs('fields', section.fieldKeys, `${at}.fieldKeys`); refs('actions', section.actionKeys, `${at}.actionKeys`);
    if (screenMap.has(section.screenKey) && !screenMap.get(section.screenKey)!.sectionKeys.includes(section.sectionKey)) add('OWNERSHIP', at, 'Parent screen does not contain section');
    if (section.tabKey) {
      ref('tabs', section.tabKey, `${at}.tabKey`);
      const tab = tabMap.get(section.tabKey);
      if (tab && (tab.screenKey !== section.screenKey || !tab.sectionKeys.includes(section.sectionKey))) add('OWNERSHIP', at, 'Tab and section must have the same parent screen');
    }
    section.fieldKeys.forEach(key => { if (fieldMap.has(key) && fieldMap.get(key)!.sectionKey !== section.sectionKey) add('OWNERSHIP', at, `Field ${key} belongs to another section`); });
    section.actionKeys.forEach(key => { if (actionMap.has(key) && actionMap.get(key)!.screenKey !== section.screenKey) add('OWNERSHIP', at, 'Action belongs to another screen'); });
  });
  const potentiallyHidden = (field: HqField): boolean => {
    if (!field.sectionKey) return true;
    const section = sectionMap.get(field.sectionKey); const screen = section && screenMap.get(section.screenKey);
    return !field.visible || (!!field.visibleWhen && !alwaysTrue(field.visibleWhen)) || !section?.enabled || !screen?.enabled || (!!section?.tabKey && !tabMap.get(section.tabKey)?.enabled);
  };
  const fieldConsumers = (key: string) => standard.actions.filter(action => action.inputFieldKeys.includes(key) || standard.transitions.some(transition => transition.actionKey === action.actionKey && transition.requiredFieldKeys.includes(key)));
  const hasActiveConsumer = (field: HqField) => fieldConsumers(field.fieldKey).some(action => action.enabled && processMap.get(action.processKey)?.enabled);
  const validFallback = (field: HqField, seen = new Set<string>()): boolean => {
    if (seen.has(field.fieldKey)) return false;
    seen.add(field.fieldKey);
    const fallback = field.hiddenFallback;
    if (!fallback) return false;
    if (fallback.kind === 'default') return validateHqFieldValue(field, fallback.value, true).length === 0;
    if (fallback.kind === 'excludedProcess') return processMap.has(fallback.processKey) && !processMap.get(fallback.processKey)!.enabled && fieldConsumers(field.fieldKey).every(action => action.processKey === fallback.processKey || !action.enabled || !processMap.get(action.processKey)?.enabled);
    const alternate = fieldMap.get(fallback.fieldKey);
    return !!alternate && compatibleFallbackDomain(alternate, field) && !potentiallyHidden(alternate) && alwaysTrue(alternate.requiredRule) && !seen.has(alternate.fieldKey) && (!alternate.hiddenFallback || validFallback(alternate, seen));
  };
  standard.fields.forEach((field, i) => {
    const at = `fields[${i}]`;
    if (!!field.sectionKey === !!field.plannedCatalogId) add('OWNER', at, 'A field needs exactly one actual or planned owner');
    if (field.sectionKey) {
      ref('sections', field.sectionKey, `${at}.sectionKey`);
      if (sectionMap.has(field.sectionKey) && !sectionMap.get(field.sectionKey)!.fieldKeys.includes(field.fieldKey)) add('OWNERSHIP', at, 'Parent section does not contain field');
    }
    if (field.plannedCatalogId) { ref('coverage', field.plannedCatalogId, `${at}.plannedCatalogId`); const row = coverageMap.get(field.plannedCatalogId); if (row && (!row.planned || !row.fieldKeys.includes(field.fieldKey))) add('OWNER', at, 'Planned field requires a planned coverage owner'); }
    conditionRefs(field.requiredRule, `${at}.requiredRule`);
    if (field.visibleWhen) conditionRefs(field.visibleWhen, `${at}.visibleWhen`);
    if (field.readOnlyWhen) conditionRefs(field.readOnlyWhen, `${at}.readOnlyWhen`);
    if (field.writeActionKeys) {
      refs('actions', field.writeActionKeys, `${at}.writeActionKeys`);
      if (!field.writeActionKeys.length) add('WRITE_ACTION', `${at}.writeActionKeys`, 'An explicit editing policy needs at least one action');
      field.writeActionKeys.forEach(key => {
        const action = actionMap.get(key); const section = field.sectionKey && sectionMap.get(field.sectionKey);
        if (action && (!section || action.screenKey !== section.screenKey || !action.inputFieldKeys.includes(field.fieldKey))) add('WRITE_ACTION', `${at}.writeActionKeys`, 'Editing action must own this input on the same screen');
      });
    }
    const rule = field.valueRule;
    if ((rule.min !== undefined && rule.max !== undefined && rule.min > rule.max) || (rule.minLength !== undefined && rule.maxLength !== undefined && rule.minLength > rule.maxLength)) add('RANGE', `${at}.valueRule`, 'Minimum exceeds maximum');
    for (const key of ['minLength', 'maxLength'] as const) if (rule[key] !== undefined && (!Number.isInteger(rule[key]) || rule[key]! < 0)) add('RANGE', `${at}.valueRule.${key}`, 'Length must be a nonnegative integer');
    if (own(field, 'defaultValue') && validateHqFieldValue(field, field.defaultValue, false).length) add('DEFAULT', `${at}.defaultValue`, 'Default violates value constraints');
    if (field.hiddenFallback) {
      if (field.hiddenFallback.kind === 'field') ref('fields', field.hiddenFallback.fieldKey, `${at}.hiddenFallback.fieldKey`);
      if (field.hiddenFallback.kind === 'excludedProcess') ref('processes', field.hiddenFallback.processKey, `${at}.hiddenFallback.processKey`);
      if (!validFallback(field)) add('FALLBACK', `${at}.hiddenFallback`, 'Fallback must supply a valid value or exclude every consuming step');
    }
    if (!field.plannedCatalogId && potentiallyHidden(field) && (!alwaysFalse(field.requiredRule) || hasActiveConsumer(field) && (standard.transitions.some(item => item.requiredFieldKeys.includes(field.fieldKey)) || standard.actions.some(item => item.enabled && processMap.get(item.processKey)?.enabled && item.requiredFieldKeys.includes(field.fieldKey)))) && !validFallback(field)) add('REQUIRED_HIDDEN', at, 'Required input is hidden by its field, section, tab or screen without a verified fallback');
    if (field.current.write && !field.current.apiField) add('CURRENT_MAPPING', `${at}.current`, 'Current write support needs an explicit API field mapping');
  });
  standard.actions.forEach((action, i) => {
    const at = `actions[${i}]`;
    ref('processes', action.processKey, `${at}.processKey`); refs('fields', action.inputFieldKeys, `${at}.inputFieldKeys`); refs('fields', action.requiredFieldKeys, `${at}.requiredFieldKeys`); refs('transitions', action.transitionKeys, `${at}.transitionKeys`); conditionRefs(action.condition, `${at}.condition`);
    action.requiredFieldKeys.forEach(key => { if (!action.inputFieldKeys.includes(key)) add('ACTION_INPUT', `${at}.requiredFieldKeys`, `Required field ${key} is not an input`); });
    if (!!action.screenKey === !!action.plannedCatalogId) add('OWNER', at, 'An action needs exactly one actual or planned owner');
    if (action.screenKey) {
      ref('screens', action.screenKey, `${at}.screenKey`);
      const screen = screenMap.get(action.screenKey);
      if (screen && (!screen.actionKeys.includes(action.actionKey) || !screen.processKeys.includes(action.processKey))) add('OWNERSHIP', at, 'Action must belong to its screen and process');
    }
    if (action.plannedCatalogId) { ref('coverage', action.plannedCatalogId, `${at}.plannedCatalogId`); const row = coverageMap.get(action.plannedCatalogId); if (row && (!row.planned || !row.actionKeys.includes(action.actionKey))) add('OWNER', at, 'Planned action requires a planned coverage owner'); }
    if ((action.support === 'planned' || action.plannedCatalogId) && action.enabled) add('PLANNED_ENABLED', at, 'Unimplemented actions cannot be executable');
    action.transitionKeys.forEach(key => { const transition = standard.transitions.find(item => item.transitionKey === key); if (transition && transition.actionKey !== action.actionKey) add('OWNERSHIP', at, 'Transition belongs to another action'); });
  });
  standard.transitions.forEach((transition, i) => {
    const at = `transitions[${i}]`;
    ref('processes', transition.processKey, `${at}.processKey`); ref('actions', transition.actionKey, `${at}.actionKey`); ref('fields', transition.stateFieldKey, `${at}.stateFieldKey`); refs('fields', transition.requiredFieldKeys, `${at}.requiredFieldKeys`); conditionRefs(transition.condition, `${at}.condition`);
    const action = actionMap.get(transition.actionKey); const process = processMap.get(transition.processKey);
    const stateField = fieldMap.get(transition.stateFieldKey);
    const stateScreen = stateField?.sectionKey ? sectionMap.get(stateField.sectionKey)?.screenKey : undefined;
    const domain = stateField?.valueRule.options;
    if (stateField && (!stateField.current.read || !stateField.readOnly || stateField.valueRule.type !== 'string' || !domain?.length || !domain.every(text))) add('STATE_DOMAIN', `${at}.stateFieldKey`, 'A transition needs a readable, read-only string-enum state field');
    if (stateField && (!stateScreen || action?.screenKey !== stateScreen || !process?.screenKeys.includes(stateScreen))) add('OWNERSHIP', `${at}.stateFieldKey`, 'State field must belong to the transition action screen and process');
    if (domain && [...transition.fromStates, transition.toState].some(state => !domain.includes(state))) add('STATE_DOMAIN', at, 'Transition start and destination must exist in the declared state domain');
    if (transition.targetFieldKey) {
      ref('fields', transition.targetFieldKey, `${at}.targetFieldKey`);
      const target = fieldMap.get(transition.targetFieldKey);
      const targetScreen = target?.sectionKey ? sectionMap.get(target.sectionKey)?.screenKey : undefined;
      if (target && (!target.current.write || target.readOnly || target.valueRule.type !== 'string' || !target.valueRule.options?.length || !target.valueRule.options.every(text) || !target.valueRule.options.includes(transition.toState))) add('TRANSITION_TARGET', `${at}.targetFieldKey`, 'Selected destination must be a writable string enum containing this destination');
      if (target && (target.fieldKey === transition.stateFieldKey || target.entity !== stateField?.entity || targetScreen !== stateScreen)) add('OWNERSHIP', `${at}.targetFieldKey`, 'Selected destination must be a separate input on the same entity and screen');
      if (!action?.inputFieldKeys.includes(transition.targetFieldKey) || !transition.requiredFieldKeys.includes(transition.targetFieldKey)) add('TRANSITION_TARGET', `${at}.targetFieldKey`, 'Selected destination must be a required input of this transition and action');
    }
    if (!transition.fromStates.length) add('TRANSITION', at, 'Transition requires a start state');
    if (action && (action.processKey !== transition.processKey || !action.transitionKeys.includes(transition.transitionKey))) add('OWNERSHIP', at, 'Transition action/process mismatch');
    if (process && !process.transitionKeys.includes(transition.transitionKey)) add('OWNERSHIP', at, 'Process does not contain transition');
    transition.requiredFieldKeys.forEach(key => { const field = fieldMap.get(key); if (field?.plannedCatalogId || action && !action.inputFieldKeys.includes(key)) add('TRANSITION_INPUT', at, `Transition input ${key} is missing from its executable action`); });
  });
  capabilities.catalogIds.forEach(key => { const row = coverageMap.get(key); if (!row || row.origin !== 'catalog') add('CATALOG_COVERAGE', 'coverage', `Missing catalog row ${key}`); });
  standard.coverage.forEach((row, i) => {
    const at = `coverage[${i}]`;
    ref('processes', row.processKey, `${at}.processKey`); refs('screens', row.screenKeys, `${at}.screenKeys`); refs('sections', row.sectionKeys, `${at}.sectionKeys`); refs('fields', row.fieldKeys, `${at}.fieldKeys`); refs('actions', row.actionKeys, `${at}.actionKeys`);
    if (row.origin === 'catalog' && !capabilities.catalogIds.includes(row.catalogId)) add('CATALOG_COVERAGE', at, 'Unknown catalog ID');
    if (row.planned && (row.enabled || row.screenKeys.length || row.sectionKeys.length || row.status !== 'unimplemented')) add('PLANNED_ENABLED', at, 'Missing renderers must be explicitly planned and disabled');
    if (!row.planned && !row.screenKeys.length) add('CATALOG_COVERAGE', at, 'Mapped coverage requires a registered screen');
    row.sectionKeys.forEach(key => { const section = sectionMap.get(key); if (section && !row.screenKeys.includes(section.screenKey)) add('OWNERSHIP', at, 'Coverage section is outside its mapped screens'); });
  });
  capabilities.screens.forEach(binding => {
    if (!standard.coverage.some(row => !row.planned && row.screenKeys.includes(binding.screenKey))) add('ENTRY_COVERAGE', 'coverage', `Missing coverage for current entry ${binding.screenKey}`);
  });
  return result();
}

/**
 * Returns a policy over a detached, validated snapshot. The caller must provide
 * authenticated server context, not trust permissions submitted by a browser.
 * H01 does not install these checks as HTTP middleware or replace current UI.
 */
export function createHqPolicy(input: unknown, capabilities: HqCapabilities) {
  const checked = validateHqStandard(input, capabilities);
  if (!checked.valid) throw new Error(`HQ_STANDARD_INVALID: ${checked.errors.map(item => `${item.code}@${item.path}`).join(', ')}`);
  const standard = clone(input as HqStandard);
  const processes = new Map(standard.processes.map(item => [item.processKey, item]));
  const screens = new Map(standard.screens.map(item => [item.screenKey, item]));
  const menus = new Map(standard.menus.map(item => [item.menuKey, item]));
  const sections = new Map(standard.sections.map(item => [item.sectionKey, item]));
  const tabs = new Map(standard.tabs.map(item => [item.tabKey, item]));
  const fields = new Map(standard.fields.map(item => [item.fieldKey, item]));
  const actions = new Map(standard.actions.map(item => [item.actionKey, item]));
  const transitions = new Map(standard.transitions.map(item => [item.transitionKey, item]));
  const access = (rule: HqAccess, context: HqContext) => allPermissions(rule.permissions, context.permissions) && allPermissions(rule.features, context.features);
  const processAllowed = (key: string, context: HqContext, stack = new Set<string>()): boolean => {
    const process = processes.get(key);
    if (!process?.enabled || stack.has(key) || !context.activeProcesses.includes(key) || !access(process, context)) return false;
    const next = new Set(stack); next.add(key);
    return process.dependsOn.every(parent => processAllowed(parent, context, next));
  };
  const screenAllowed = (key: string, context: HqContext): boolean => {
    const screen = screens.get(key);
    return !!screen?.enabled && access(screen, context) && (!context.device || screen.devices.includes(context.device)) && screen.processKeys.some(process => processAllowed(process, context));
  };
  const menuAncestorsAllowed = (key: string, context: HqContext): boolean => {
    const menu = menus.get(key);
    return !!menu?.enabled && access(menu, context) && (!menu.screenKey || screenAllowed(menu.screenKey, context)) && (!menu.parentKey || menuAncestorsAllowed(menu.parentKey, context));
  };
  const menuVisible = (key: string, context: HqContext): boolean => {
    const menu = menus.get(key);
    if (!menu || !menuAncestorsAllowed(key, context)) return false;
    return menu.screenKey ? screenAllowed(menu.screenKey, context) : standard.menus.some(child => child.parentKey === key && menuVisible(child.menuKey, context));
  };
  const fieldVisible = (key: string, context: HqContext): boolean => {
    const field = fields.get(key);
    if (!field?.visible || !field.sectionKey || !allPermissions(field.readPermissions, context.permissions)) return false;
    if (field.visibleWhen && !evaluateHqCondition(field.visibleWhen, context.values)) return false;
    const section = sections.get(field.sectionKey);
    return !!section?.enabled && (!section.tabKey || tabs.get(section.tabKey)?.enabled === true) && screenAllowed(section.screenKey, context);
  };
  const actionAccessAllowed = (action: HqAction | undefined, context: HqContext): boolean => !!action?.enabled && action.support !== 'planned' && !!action.screenKey && screenAllowed(action.screenKey, context) && processAllowed(action.processKey, context) && access(action, context) && evaluateHqCondition(action.condition, context.values);
  const fieldWritable = (key: string, context: HqContext): boolean => {
    const field = fields.get(key);
    return !!field && fieldVisible(key, context) && field.current.write && !field.readOnly && (!field.readOnlyWhen || !evaluateHqCondition(field.readOnlyWhen, context.values)) && allPermissions(field.writePermissions, context.permissions) && (!field.writeActionKeys || field.writeActionKeys.some(action => actionAccessAllowed(actions.get(action), context)));
  };
  const readField = (key: string, context: HqContext): unknown => {
    const field = fields.get(key);
    if (!field || !fieldVisible(key, context) || !field.current.read || !own(context.values, key)) return undefined;
    const value = context.values[key];
    if (field.masking === 'none' || field.unmaskPermission && context.permissions.includes(field.unmaskPermission)) return value === undefined ? undefined : clone(value);
    if (value === null || value === undefined) return value;
    const str = String(value);
    return field.masking === 'last4' && str.length > 4 ? `${'•'.repeat(str.length - 4)}${str.slice(-4)}` : '••••';
  };
  const valueFor = (field: HqField, context: HqContext, seen = new Set<string>()): unknown => {
    if (seen.has(field.fieldKey)) return undefined;
    seen.add(field.fieldKey);
    const direct = own(context.values, field.fieldKey) ? context.values[field.fieldKey] : undefined;
    if (present(direct)) return direct;
    const fallback = field.hiddenFallback;
    if (fallback?.kind === 'default') return fallback.value;
    if (fallback?.kind === 'field') { const alternate = fields.get(fallback.fieldKey); return alternate ? valueFor(alternate, context, seen) : undefined; }
    return undefined;
  };
  const actionAllowed = (key: string, context: HqContext): boolean => {
    const action = actions.get(key);
    if (!action || !actionAccessAllowed(action, context)) return false;
    return action.inputFieldKeys.every(fieldKey => {
      const field = fields.get(fieldKey)!;
      const required = action.requiredFieldKeys.includes(fieldKey) || evaluateHqCondition(field.requiredRule, context.values);
      return validateHqFieldValue(field, valueFor(field, context), required).length === 0;
    });
  };
  const transitionAllowed = (key: string, context: HqContext): boolean => {
    const transition = transitions.get(key);
    if (!transition || !actionAllowed(transition.actionKey, context) || !processAllowed(transition.processKey, context) || !transition.fromStates.includes(String(context.values[transition.stateFieldKey] ?? '')) || !evaluateHqCondition(transition.condition, context.values)) return false;
    if (transition.targetFieldKey && valueFor(fields.get(transition.targetFieldKey)!, context) !== transition.toState) return false;
    return transition.requiredFieldKeys.every(fieldKey => validateHqFieldValue(fields.get(fieldKey)!, valueFor(fields.get(fieldKey)!, context), true).length === 0);
  };
  return { screenAllowed, menuVisible, actionAllowed, transitionAllowed, fieldVisible, fieldWritable, readField };
}

/** Explicit reapplication against the exact HQ version; never mutates its parent. */
export function applyHqOverride(base: unknown, input: unknown, capabilities: HqCapabilities): HqOverrideResult {
  const checked = validateHqStandard(base, capabilities);
  if (!checked.valid) return checked;
  const errors: HqValidationIssue[] = [];
  const add: IssueWriter = (code, path, message) => { errors.push({ code, path, message }); };
  inspectHqJson(input, add);
  if (errors.length || !checkShape(input, { overrideKey: 'text', parentStandardKey: 'text', parentVersion: 'text', patches: 'array' }, '$', add)) return { valid: false, errors };
  if (!Array.isArray(input.patches)) { add('SHAPE', 'patches', 'Expected an array of stable-ID patches'); return { valid: false, errors }; }
  const parent = base as HqStandard;
  if (input.parentStandardKey !== parent.standardKey || input.parentVersion !== parent.version) add('PARENT_VERSION', 'parentVersion', 'HQ parent changed; revalidation and explicit reapplication are required');
  const snapshot = clone(parent);
  const targets: Record<HqOverrideTarget, Collection> = { process: 'processes', screen: 'screens', menu: 'menus', tab: 'tabs', section: 'sections', field: 'fields', action: 'actions' };
  const seen = new Set<string>();
  input.patches.forEach((raw, index) => {
    const path = `patches[${index}]`;
    if (!checkShape(raw, { target: 'enum:process,screen,menu,tab,section,field,action', key: 'text', changes: 'object' }, path, add) || !object(raw.changes) || typeof raw.target !== 'string' || !own(targets, raw.target)) return;
    const target = raw.target as HqOverrideTarget;
    const collection = targets[target]; const stableId = collectionIds[collection];
    const row = (snapshot[collection] as unknown as JsonRecord[]).find(item => item[stableId] === raw.key);
    if (!row) { add('OVERRIDE_REF', path, 'Override target is not a registered stable ID'); return; }
    const identity = `${target}:${raw.key}`;
    if (seen.has(identity)) add('DUPLICATE_PATCH', path, 'Combine changes for a stable ID into one patch');
    seen.add(identity);
    const allowed = target === 'field' ? ['label', 'labelKey', 'visible', 'readOnly', 'masking'] : target === 'menu' || target === 'tab' || target === 'section' || target === 'process' ? ['label', 'labelKey', 'enabled', 'order'] : ['label', 'labelKey', 'enabled'];
    for (const [property, value] of Object.entries(raw.changes)) {
      const at = `${path}.changes.${property}`;
      if (!allowed.includes(property)) { add('OVERRIDE_PROPERTY', at, 'Identity, ownership, routes, rules and permission requirements are not overridable'); continue; }
      if (target === 'field') {
        const field = row as unknown as HqField;
        if ((field.locked || field.overridePolicy === 'locked') && JSON.stringify(value) !== JSON.stringify(row[property])) { add('LOCKED', at, 'Locked definition cannot be overridden'); continue; }
        if (field.overridePolicy === 'presentation' && !['label', 'labelKey', 'visible'].includes(property)) { add('OVERRIDE_POLICY', at, 'Only presentation changes are allowed'); continue; }
        if (property === 'readOnly' && field.readOnly && value !== true) { add('LOCK_RELAXATION', at, 'Read-only protection cannot be relaxed'); continue; }
        const strength: Record<string, number> = { none: 0, last4: 1, redact: 2 };
        if (property === 'masking' && (typeof value !== 'string' || !own(strength, value) || strength[value] < strength[field.masking])) { add('MASK_RELAXATION', at, 'Masking cannot be weakened'); continue; }
      }
      row[property] = value;
    }
  });
  if (errors.length) return { valid: false, errors };
  snapshot.parent = { standardKey: parent.standardKey, version: parent.version, overrideKey: input.overrideKey as string };
  const final = validateHqStandard(snapshot, capabilities);
  return final.valid ? { valid: true, errors: [], standard: snapshot } : final;
}
