// validateBundle: the pure cross-reference validator (no fs, no I/O). Deterministic output order (sortIssues).
import { resolveOverrides, validateResolved } from '../admin/resolver';
import { configDocumentSchema } from '../admin/versions';
import { checkGlobal } from './check-global';
import { checkObject } from './check-object';
import { checkSecurity } from './check-security';
import { Context, FieldUse, createContext } from './context';
import { Issue, issue, sortIssues } from './issues';
import { ENTITY_DOMAINS, MetadataBundle, Overlay, SCREEN_DOMAINS, metadataBundleSchema } from './schemas';
import { DETAILS } from './messages';

const zodDetail = (e: { path: (string | number)[]; message: string }) => `${e.path.join('.') || DETAILS.whole}: ${e.message}`;

/** Checks a parsed bundle without its overlays. */
function checkBase(bundle: MetadataBundle): Context {
  const ctx = createContext(bundle);
  checkGlobal(ctx);
  bundle.objects.forEach((ob, i) => checkObject(ctx, ob, i));
  checkSecurity(ctx);
  return ctx;
}

const ENTITY_PROP: Record<string, 'listViews' | 'actions' | 'rules' | 'workflow'> = { LIST_VIEW: 'listViews', ACTION: 'actions', RULE: 'rules', WORKFLOW: 'workflow' };
const GLOBAL_PROP: Record<string, 'menu' | 'codes' | 'terms' | 'features'> = { MENU: 'menu', CODE: 'codes', TERM: 'terms', FEATURE: 'features' };
const NIL = '00000000-0000-4000-8000-000000000000';
export const overlayName = (o: Overlay) => [o.domain, o.entity, o.screenKey].filter(Boolean).join('.');

/** Finds the payload an overlay changes, as a getter/setter pair on `bundle`, or reports why it cannot. */
function target(bundle: MetadataBundle, o: Overlay, path: string, out: Issue[]) {
  if (ENTITY_DOMAINS.includes(o.domain)) {
    const ob = bundle.objects.find(x => x.object.key === o.entity);
    if (!ob) { out.push(issue('R01_UNKNOWN_ENTITY', `${path}/entity`, { entity: o.entity })); return undefined; }
    if (SCREEN_DOMAINS.includes(o.domain)) {
      const entry = ob.screens.find(s => s.screen.screenKey === o.screenKey);
      if (!entry) { out.push(issue('M03_OVERLAY_TARGET_MISSING', `${path}/screenKey`, { target: overlayName(o) })); return undefined; }
      const prop = o.domain === 'SCREEN' ? 'screen' : 'fields';
      return { get: () => entry[prop] as any, set: (v: any) => { (entry as any)[prop] = v; } };
    }
    const prop = ENTITY_PROP[o.domain];
    if (!ob[prop]) { out.push(issue('M03_OVERLAY_TARGET_MISSING', path, { target: overlayName(o) })); return undefined; }
    return { get: () => ob[prop] as any, set: (v: any) => { (ob as any)[prop] = v; } };
  }
  const prop = GLOBAL_PROP[o.domain];
  if (o.entity !== undefined || o.screenKey !== undefined) { out.push(issue('M02_OVERLAY_INVALID', path, { detail: DETAILS.entityOnlyForObjects })); return undefined; }
  if (!bundle[prop]) { out.push(issue('M03_OVERLAY_TARGET_MISSING', path, { target: overlayName(o) })); return undefined; }
  return { get: () => bundle[prop] as any, set: (v: any) => { (bundle as any)[prop] = v; } };
}

/** Applies one overlay in place with the admin resolver; reports admin errors as M02. */
function applyOverlay(bundle: MetadataBundle, o: Overlay, path: string, out: Issue[]): void {
  const doc = configDocumentSchema.safeParse({ id: NIL, schemaVersion: 1, scope: o.scope, scopeKey: o.scopeKey, domain: o.domain, stableKey: overlayName(o), revision: 1, parentVersionIds: [], overrides: o.overrides });
  if (!doc.success) { for (const e of doc.error.issues) out.push(issue('M02_OVERLAY_INVALID', path, { detail: zodDetail(e) })); return; }
  if (ENTITY_DOMAINS.includes(o.domain) && !o.entity) { out.push(issue('M02_OVERLAY_INVALID', path, { detail: DETAILS.entityRequired })); return; }
  if (SCREEN_DOMAINS.includes(o.domain) && !o.screenKey) { out.push(issue('M02_OVERLAY_INVALID', path, { detail: DETAILS.screenKeyRequired })); return; }
  const t = target(bundle, o, path, out);
  if (!t) return;
  try {
    const { payload } = resolveOverrides(t.get(), o.overrides);
    t.set(validateResolved(o.domain, payload));
  } catch (error) {
    out.push(issue('M02_OVERLAY_INVALID', `${path}/overrides`, { detail: (error as { code?: string }).code ?? String((error as Error).message) }));
  }
}

/** Overlay layers: a COUNTRY layer `HQ:KR` sits on its TEMPLATE layer `HQ`; other layers sit on the base alone. */
function layers(bundle: MetadataBundle) {
  const map = new Map<string, { scope: string; scopeKey: string; items: { o: Overlay; i: number }[] }>();
  bundle.overlays.forEach((o, i) => {
    const id = `${o.scope}/${o.scopeKey}`;
    const layer = map.get(id) ?? { scope: o.scope, scopeKey: o.scopeKey, items: [] };
    layer.items.push({ o, i });
    map.set(id, layer);
  });
  const parentOf = (l: { scope: string; scopeKey: string }) => (l.scope === 'COUNTRY' ? map.get(`TEMPLATE/${l.scopeKey.split(':')[0]}`) : undefined);
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([id, l]) => ({ id, chain: [parentOf(l), l].filter(Boolean) as typeof l[] }));
}

function checkOverlays(bundle: MetadataBundle, baseIssues: Issue[]): Issue[] {
  const out: Issue[] = [];
  const known = new Set(baseIssues.map(i => `${i.path}\u0000${i.code}\u0000${i.message}`));
  for (const layer of layers(bundle)) {
    const effective: MetadataBundle = structuredClone({ ...bundle, overlays: [] });
    const before = out.length;
    for (const l of layer.chain) for (const { o, i } of l.items) applyOverlay(effective, o, `overlays[#${i}]`, out);
    if (out.length > before) continue;
    for (const found of checkBase(effective).issues) {
      if (!known.has(`${found.path}\u0000${found.code}\u0000${found.message}`)) out.push({ ...found, path: `overlays/${layer.id}/${found.path}` });
    }
  }
  return out;
}

export interface Analysis { bundle?: MetadataBundle; issues: Issue[]; uses: FieldUse[] }

/** Parses and checks; also returns where every field is used (diffBundles needs it). */
export function analyzeBundle(input: unknown): Analysis {
  const parsed = metadataBundleSchema.safeParse(input);
  if (!parsed.success) return { issues: sortIssues(parsed.error.issues.map(e => issue('M01_SCHEMA_INVALID', e.path.join('/') || DETAILS.whole, { detail: e.message }))), uses: [] };
  const ctx = checkBase(parsed.data);
  const issues = [...ctx.issues, ...checkOverlays(parsed.data, ctx.issues)];
  return { bundle: parsed.data, issues: sortIssues(issues), uses: ctx.uses };
}

/** Every problem of the bundle, errors and warnings, sorted by path, code and message. Empty means clean. */
export function validateBundle(input: unknown): Issue[] {
  return analyzeBundle(input).issues;
}
