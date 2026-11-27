// diffBundles: the backward-compatibility check of ADR 0004 between a base bundle and a head bundle. Pure.
import { Issue, issue, sortIssues } from './issues';
import { FieldDef, MetadataBundle, ObjectBundle } from './schemas';
import { analyzeBundle } from './validate';
import { KIND_LABELS } from './messages';

/**
 * Type changes that keep every stored value valid and every reader working:
 * - integer -> decimal : every integer is a decimal; comparisons and sorting keep their meaning.
 * - date -> datetime   : a date is the start of that day; date filters still compare correctly.
 * Anything else (for example text -> enum, decimal -> integer) can lose or reject stored values, so it is an error.
 */
export const SAFE_TYPE_WIDENINGS: readonly (readonly [string, string])[] = [['integer', 'decimal'], ['date', 'datetime']];
const safe = (from: string, to: string) => SAFE_TYPE_WIDENINGS.some(([a, b]) => a === from && b === to);

function findRenamed<T extends { key: string; aliases: string[] }>(list: T[], key: string) { return list.find(x => x.aliases.includes(key)); }

function diffFields(base: ObjectBundle, head: ObjectBundle, path: string, out: Issue[]) {
  const headKeys = new Set(head.object.fields.map(f => f.key)), baseKeys = new Set(base.object.fields.map(f => f.key));
  const added = head.object.fields.filter(f => !baseKeys.has(f.key));
  base.object.fields.forEach(f => {
    const p = `${path}/object/fields[${f.key}]`;
    const now: FieldDef | undefined = headKeys.has(f.key) ? head.object.fields.find(x => x.key === f.key) : findRenamed(head.object.fields, f.key);
    if (now) { if (now.type !== f.type && !safe(f.type, now.type)) out.push(issue('D03_TYPE_CHANGED', `${p}/type`, { key: f.key, from: f.type, to: now.type })); return; }
    if (f.deprecated) return;
    const guess = added.find(a => a.type === f.type);
    out.push(guess ? issue('D02_RENAMED_WITHOUT_ALIAS', p, { kind: KIND_LABELS.field, key: f.key, to: guess.key }) : issue('D01_REMOVED_WITHOUT_DEPRECATION', p, { kind: KIND_LABELS.field, key: f.key }));
  });
}

function diffKeyed(baseKeys: string[], headKeys: string[], label: string, isDeprecated: (key: string) => boolean, path: (key: string) => string, out: Issue[]) {
  const now = new Set(headKeys);
  for (const key of baseKeys) if (!now.has(key) && !isDeprecated(key)) out.push(issue('D01_REMOVED_WITHOUT_DEPRECATION', path(key), { kind: label, key }));
}

function diffObjects(base: MetadataBundle, head: MetadataBundle, out: Issue[]) {
  const headKeys = new Set(head.objects.map(o => o.object.key)), baseKeys = new Set(base.objects.map(o => o.object.key));
  const added = head.objects.filter(o => !baseKeys.has(o.object.key));
  const recorded = (kind: string, entity: string | undefined, key: string) => base.deprecations.some(d => d.kind === kind && (d.entity ?? '') === (entity ?? '') && d.key === key);
  for (const ob of base.objects) {
    const key = ob.object.key, p = `objects[${key}]`;
    const now = headKeys.has(key) ? head.objects.find(o => o.object.key === key) : head.objects.find(o => o.object.aliases.includes(key));
    if (!now) {
      if (ob.object.deprecated) continue;
      out.push(added.length ? issue('D02_RENAMED_WITHOUT_ALIAS', p, { kind: KIND_LABELS.object, key, to: added[0].object.key }) : issue('D01_REMOVED_WITHOUT_DEPRECATION', p, { kind: KIND_LABELS.object, key }));
      continue;
    }
    diffFields(ob, now, p, out);
    diffKeyed((ob.listViews?.views ?? []).map(v => v.key), (now.listViews?.views ?? []).map(v => v.key), KIND_LABELS.listView, k => recorded('LIST_VIEW', key, k), k => `${p}/listViews/views[${k}]`, out);
    diffKeyed((ob.actions?.actions ?? []).map(a => a.key), (now.actions?.actions ?? []).map(a => a.key), KIND_LABELS.action, k => recorded('ACTION', key, k), k => `${p}/actions/actions[${k}]`, out);
  }
  diffKeyed((base.menu?.nodes ?? []).map(n => n.id), (head.menu?.nodes ?? []).map(n => n.id), KIND_LABELS.menu, k => recorded('MENU', undefined, k), k => `menu/nodes[${k}]`, out);
}

/**
 * Errors for changes that break existing data or references (D01-D03), warnings for new uses of deprecated
 * fields (D04). Additions are always fine. Both inputs are parsed first; a bundle that does not parse gives M01.
 */
export function diffBundles(baseInput: unknown, headInput: unknown): Issue[] {
  const base = analyzeBundle(baseInput), head = analyzeBundle(headInput);
  const broken = [...base.issues.filter(i => i.code === 'M01_SCHEMA_INVALID').map(i => ({ ...i, path: `base:${i.path}` })),
    ...head.issues.filter(i => i.code === 'M01_SCHEMA_INVALID').map(i => ({ ...i, path: `head:${i.path}` }))];
  if (!base.bundle || !head.bundle) return sortIssues(broken);
  const out: Issue[] = [];
  diffObjects(base.bundle, head.bundle, out);
  const before = new Set(base.uses.map(u => `${u.entity}\u0000${u.field}\u0000${u.site}`));
  const deprecated = new Set(head.bundle.objects.flatMap(o => o.object.fields.filter(f => f.deprecated).map(f => `${o.object.key}\u0000${f.key}`)));
  for (const u of head.uses) {
    if (deprecated.has(`${u.entity}\u0000${u.field}`) && !before.has(`${u.entity}\u0000${u.field}\u0000${u.site}`)) out.push(issue('D04_DEPRECATED_NEW_USE', u.site, { field: u.field }));
  }
  return sortIssues(out);
}
