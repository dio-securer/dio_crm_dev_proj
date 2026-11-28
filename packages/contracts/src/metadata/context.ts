// Shared lookups for the cross-reference checks. Built once per bundle; pure.
import { permissionCatalog } from '../admin/permissions';
import { Issue, IssueCode, issue } from './issues';
import { COMPARABLE_TYPES, FieldDef, MetadataBundle, ObjectBundle, REQUIRED_LOCALES } from './schemas';

export interface FieldRef { key: string; type: string; def?: FieldDef }
/** A place where a field is used; diffBundles compares these between two bundles (D04). */
export interface FieldUse { entity: string; field: string; site: string }

export interface Context {
  bundle: MetadataBundle;
  objects: Map<string, ObjectBundle>;
  issues: Issue[];
  uses: FieldUse[];
  add(code: IssueCode, path: string, params?: Record<string, string | number | undefined>): void;
}

export function createContext(bundle: MetadataBundle): Context {
  const objects = new Map<string, ObjectBundle>();
  for (const ob of bundle.objects) if (!objects.has(ob.object.key)) objects.set(ob.object.key, ob);
  const ctx: Context = { bundle, objects, issues: [], uses: [], add: (code, path, params) => { ctx.issues.push(issue(code, path, params)); } };
  return ctx;
}

/** Path segment for one item of a keyed list: `[key]`, or `[#index]` when the item has no usable key. */
export const at = (key: unknown, index: number) => (typeof key === 'string' && key ? `[${key}]` : `[#${index}]`);

/** Every name a field of the object can be referred by: data field keys, their aliases, and x_ extension fields. */
export function fieldIndex(ob: ObjectBundle): Map<string, FieldRef & { alias?: string }> {
  const map = new Map<string, FieldRef & { alias?: string }>();
  for (const def of ob.object.fields) if (!map.has(def.key)) map.set(def.key, { key: def.key, type: def.type, def });
  for (const def of ob.object.fields) for (const alias of def.aliases) if (!map.has(alias)) map.set(alias, { key: def.key, type: def.type, def, alias });
  for (const entry of ob.screens) for (const ext of entry.fields.extensionDefinitions ?? []) if (!map.has(ext.key)) map.set(ext.key, { key: ext.key, type: ext.type });
  return map;
}

/** Resolves a field name used at `path`; reports R02 / R09 warnings and records the use. Returns the field type. */
export function useField(ctx: Context, entity: string, name: string, path: string): string | undefined {
  const ob = ctx.objects.get(entity);
  if (!ob) return undefined;
  const found = fieldIndex(ob).get(name);
  if (!found) { ctx.add('R02_UNKNOWN_FIELD', path, { entity, field: name }); return undefined; }
  if (found.alias) ctx.add('R09_ALIAS_USE', path, { alias: found.alias, field: found.key });
  if (found.def?.deprecated) ctx.add('R09_DEPRECATED_USE', path, { field: found.key, replacedBy: found.def.deprecated.replacedBy });
  ctx.uses.push({ entity, field: found.key, site: path });
  return found.type;
}

/** Walks an admin condition tree (all / any / not / leaf) and checks every leaf field and operator. */
export function checkCondition(ctx: Context, entity: string, node: any, path: string): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node.args)) node.args.forEach((arg: unknown, i: number) => checkCondition(ctx, entity, arg, `${path}/args[#${i}]`));
  else if (node.arg) checkCondition(ctx, entity, node.arg, `${path}/arg`);
  else if (typeof node.field === 'string') {
    const type = useField(ctx, entity, node.field, `${path}/field`);
    if (type && ['gt', 'gte', 'lt', 'lte'].includes(node.op) && !COMPARABLE_TYPES.includes(type)) ctx.add('R10_OPERATOR_TYPE', `${path}/op`, { field: node.field, type, op: node.op });
  }
}

/** termKey -> locales that have a translation; semanticKey -> termKey. */
function termIndex(bundle: MetadataBundle) {
  const translated = new Map<string, Set<string>>();
  for (const t of bundle.terms?.translations ?? []) { const set = translated.get(t.termKey) ?? new Set<string>(); set.add(t.locale); translated.set(t.termKey, set); }
  const semantic = new Map<string, string>();
  for (const t of bundle.terms?.terms ?? []) if (!semantic.has(t.semanticKey)) semantic.set(t.semanticKey, t.termKey);
  return { translated, semantic };
}
const termCache = new WeakMap<MetadataBundle, ReturnType<typeof termIndex>>();

/** R04: the label key (or the term it maps to) must be translated into every locale of the admin TERM schema. */
export function checkLabel(ctx: Context, labelKey: string | undefined, path: string): void {
  if (!labelKey) return;
  let index = termCache.get(ctx.bundle);
  if (!index) { index = termIndex(ctx.bundle); termCache.set(ctx.bundle, index); }
  const termKey = index.semantic.get(labelKey) ?? labelKey;
  const have = index.translated.get(termKey);
  for (const locale of REQUIRED_LOCALES) if (!have?.has(locale)) ctx.add('R04_MISSING_TRANSLATION', path, { labelKey, locale });
}

/** R08 for one list: reports every name after its first appearance. */
export function checkUnique(ctx: Context, names: { name: string; path: string }[], kind: string): void {
  const seen = new Set<string>();
  for (const n of names) { if (seen.has(n.name)) ctx.add('R08_DUPLICATE_KEY', n.path, { key: n.name, kind }); seen.add(n.name); }
}

export const featureKeys = (ctx: Context) => new Set((ctx.bundle.features?.items ?? []).map(i => i.key));
const permissions: ReadonlySet<string> = new Set(permissionCatalog);
/** R07 for feature and permission keys. Both universes are closed: FEATURE of the bundle, permissionCatalog of admin. */
export function checkFeatureAndPermission(ctx: Context, item: { featureKey: string; permission: string }, path: string): void {
  if (!featureKeys(ctx).has(item.featureKey)) ctx.add('R07_UNKNOWN_FEATURE', `${path}/featureKey`, { feature: item.featureKey });
  checkPermission(ctx, item.permission, `${path}/permission`);
}
/** R07 for one permission key against the admin permissionCatalog. */
export function checkPermission(ctx: Context, permission: string, path: string): void {
  if (!permissions.has(permission)) ctx.add('R07_UNKNOWN_PERMISSION', path, { permission });
}
