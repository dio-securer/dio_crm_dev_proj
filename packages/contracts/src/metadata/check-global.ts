// Cross-reference checks across the whole bundle: object keys and aliases, menu, codes, features, terms, deprecations.
import { Context, at, checkFeatureAndPermission, checkLabel, checkUnique } from './context';
import { KIND_LABELS } from './messages';

function checkObjects(ctx: Context) {
  const names: { name: string; path: string }[] = [];
  ctx.bundle.objects.forEach((ob, i) => names.push({ name: ob.object.key, path: `objects${at(ob.object.key, i)}/object/key` }));
  ctx.bundle.objects.forEach((ob, i) => ob.object.aliases.forEach((a, j) => names.push({ name: a, path: `objects${at(ob.object.key, i)}/object/aliases[#${j}]` })));
  checkUnique(ctx, names, KIND_LABELS.object);
  ctx.bundle.objects.forEach((ob, i) => {
    const next = ob.object.deprecated?.replacedBy;
    if (next === undefined) return;
    const p = `objects${at(ob.object.key, i)}/object/deprecated/replacedBy`, target = ctx.objects.get(next);
    if (!target) ctx.add('R09_REPLACED_BY_MISSING', p, { key: ob.object.key, replacedBy: next });
    else if (target.object.deprecated) ctx.add('R09_REPLACED_BY_DEPRECATED', p, { key: ob.object.key, replacedBy: next });
  });
}

function checkMenu(ctx: Context) {
  const nodes = ctx.bundle.menu?.nodes ?? [];
  checkUnique(ctx, nodes.map((n, i) => ({ name: n.id, path: `menu/nodes${at(n.id, i)}` })), KIND_LABELS.menu);
  const ids = new Set(nodes.map(n => n.id));
  nodes.forEach((n, i) => {
    const p = `menu/nodes${at(n.id, i)}`;
    checkLabel(ctx, n.labelKey, `${p}/labelKey`);
    if (n.parentId !== null && !ids.has(n.parentId)) ctx.add('R07_UNKNOWN_MENU_PARENT', `${p}/parentId`, { parent: n.parentId });
    checkFeatureAndPermission(ctx, n, p);
  });
}

function checkCodesFeaturesTerms(ctx: Context) {
  const groups = ctx.bundle.codes?.groups ?? [];
  checkUnique(ctx, groups.map((g, i) => ({ name: g.key, path: `codes/groups${at(g.key, i)}` })), KIND_LABELS.codeGroup);
  groups.forEach((g, i) => {
    const p = `codes/groups${at(g.key, i)}`;
    checkUnique(ctx, g.values.map((v, j) => ({ name: v.code, path: `${p}/values${at(v.code, j)}` })), KIND_LABELS.codeValue);
    g.values.forEach((v, j) => checkLabel(ctx, v.labelKey, `${p}/values${at(v.code, j)}/labelKey`));
  });
  const items = ctx.bundle.features?.items ?? [];
  checkUnique(ctx, items.map((f, i) => ({ name: f.key, path: `features/items${at(f.key, i)}` })), KIND_LABELS.feature);
  const terms = ctx.bundle.terms;
  if (terms) {
    checkUnique(ctx, terms.terms.map((t, i) => ({ name: t.semanticKey, path: `terms/terms${at(t.semanticKey, i)}` })), KIND_LABELS.semanticKey);
    checkUnique(ctx, terms.translations.map((t, i) => ({ name: `${t.termKey}:${t.locale}`, path: `terms/translations[#${i}]` })), KIND_LABELS.translation);
  }
}

function checkDeprecations(ctx: Context) {
  const list = ctx.bundle.deprecations;
  checkUnique(ctx, list.map((d, i) => ({ name: `${d.kind}:${d.entity ?? ''}:${d.key}`, path: `deprecations[#${i}]` })), KIND_LABELS.deprecation);
  const exists = (kind: string, entity: string | undefined, key: string) => {
    if (kind === 'MENU') return (ctx.bundle.menu?.nodes ?? []).some(n => n.id === key);
    const ob = entity ? ctx.objects.get(entity) : undefined;
    if (!ob) return false;
    return kind === 'ACTION' ? (ob.actions?.actions ?? []).some(a => a.key === key) : (ob.listViews?.views ?? []).some(v => v.key === key);
  };
  const deprecated = new Set(list.map(d => `${d.kind}:${d.entity ?? ''}:${d.key}`));
  list.forEach((d, i) => {
    const p = `deprecations[#${i}]`;
    if (d.kind !== 'MENU' && (!d.entity || !ctx.objects.has(d.entity))) ctx.add('R01_UNKNOWN_ENTITY', `${p}/entity`, { entity: d.entity });
    if (d.replacedBy === undefined) return;
    if (!exists(d.kind, d.entity, d.replacedBy)) ctx.add('R09_REPLACED_BY_MISSING', `${p}/replacedBy`, { key: d.key, replacedBy: d.replacedBy });
    else if (deprecated.has(`${d.kind}:${d.entity ?? ''}:${d.replacedBy}`)) ctx.add('R09_REPLACED_BY_DEPRECATED', `${p}/replacedBy`, { key: d.key, replacedBy: d.replacedBy });
  });
}

export function checkGlobal(ctx: Context): void {
  checkObjects(ctx);
  checkMenu(ctx);
  checkCodesFeaturesTerms(ctx);
  checkDeprecations(ctx);
}
