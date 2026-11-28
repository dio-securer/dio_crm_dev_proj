// Cross-reference checks inside one object bundle: data fields, screens, list views, actions, rules, workflow.
import { Context, at, checkCondition, checkFeatureAndPermission, checkLabel, checkUnique, fieldIndex, useField } from './context';
import { ObjectBundle, TEXT_TYPES } from './schemas';
import { KIND_LABELS } from './messages';

/** A create screen is one whose screenKey is `create` or starts with `create_` / `create-`. */
export const isCreateScreen = (screenKey: string) => /^create($|[_-])/.test(screenKey);

function checkDataFields(ctx: Context, ob: ObjectBundle, base: string) {
  const o = ob.object;
  checkLabel(ctx, o.labelKey, `${base}/object/labelKey`);
  checkLabel(ctx, o.pluralLabelKey, `${base}/object/pluralLabelKey`);
  const names: { name: string; path: string }[] = [];
  o.fields.forEach((f, i) => names.push({ name: f.key, path: `${base}/object/fields${at(f.key, i)}/key` }));
  o.fields.forEach((f, i) => f.aliases.forEach((a, j) => names.push({ name: a, path: `${base}/object/fields${at(f.key, i)}/aliases[#${j}]` })));
  ob.screens.forEach(s => s.fields.extensionDefinitions.forEach((x, j) => {
    if (!o.fields.some(f => f.key === x.key || f.aliases.includes(x.key))) return;
    names.push({ name: x.key, path: `${base}/screens[${s.screen.screenKey}]/fields/extensionDefinitions[#${j}]` });
  }));
  checkUnique(ctx, names, KIND_LABELS.field);
  const byKey = new Map(o.fields.map(f => [f.key, f]));
  o.fields.forEach((f, i) => {
    const p = `${base}/object/fields${at(f.key, i)}`;
    checkLabel(ctx, f.labelKey, `${p}/labelKey`);
    const option = (name: string, allowed: boolean) => { if ((f as any)[name] !== undefined && !allowed) ctx.add('R10_OPTION_NOT_ALLOWED', `${p}/${name}`, { field: f.key, type: f.type, option: name }); };
    option('maxLength', TEXT_TYPES.includes(f.type));
    option('precision', f.type === 'decimal');
    option('scale', f.type === 'decimal');
    option('enumCodeGroup', f.type === 'enum');
    option('referenceObject', f.type === 'reference');
    if (f.type === 'enum') {
      if (!f.enumCodeGroup) ctx.add('R10_ENUM_NEEDS_GROUP', p, { field: f.key });
      else if (!(ctx.bundle.codes?.groups ?? []).some(g => g.key === f.enumCodeGroup)) ctx.add('R05_UNKNOWN_CODE_GROUP', `${p}/enumCodeGroup`, { group: f.enumCodeGroup });
    }
    if (f.type === 'reference') {
      if (!f.referenceObject) ctx.add('R10_REFERENCE_NEEDS_OBJECT', p, { field: f.key });
      else if (!ctx.objects.has(f.referenceObject)) ctx.add('R06_UNKNOWN_REFERENCE_OBJECT', `${p}/referenceObject`, { entity: f.referenceObject });
    }
    const next = f.deprecated?.replacedBy;
    if (next !== undefined) {
      const target = byKey.get(next);
      if (!target) ctx.add('R09_REPLACED_BY_MISSING', `${p}/deprecated/replacedBy`, { key: f.key, replacedBy: next });
      else if (target.deprecated) ctx.add('R09_REPLACED_BY_DEPRECATED', `${p}/deprecated/replacedBy`, { key: f.key, replacedBy: next });
    }
  });
}

function checkScreens(ctx: Context, ob: ObjectBundle, base: string) {
  const entity = ob.object.key, index = fieldIndex(ob);
  checkUnique(ctx, ob.screens.map((s, i) => ({ name: s.screen.screenKey, path: `${base}/screens${at(s.screen.screenKey, i)}/screen/screenKey` })), KIND_LABELS.screen);
  ob.screens.forEach((entry, i) => {
    const { screen, fields } = entry, key = screen.screenKey, p = `${base}/screens${at(key, i)}`;
    if (screen.entity !== entity) ctx.add('R01_UNKNOWN_ENTITY', `${p}/screen/entity`, { entity: screen.entity });
    if (fields.entity !== entity) ctx.add('R01_UNKNOWN_ENTITY', `${p}/fields/entity`, { entity: fields.entity });
    checkUnique(ctx, screen.tabs.map((t, j) => ({ name: t.id, path: `${p}/screen/tabs${at(t.id, j)}` })), KIND_LABELS.tab);
    checkUnique(ctx, screen.sections.map((s, j) => ({ name: s.id, path: `${p}/screen/sections${at(s.id, j)}` })), KIND_LABELS.section);
    screen.tabs.forEach((t, j) => checkLabel(ctx, t.labelKey, `${p}/screen/tabs${at(t.id, j)}/labelKey`));
    screen.sections.forEach((s, j) => {
      const sp = `${p}/screen/sections${at(s.id, j)}`;
      checkLabel(ctx, s.titleKey, `${sp}/titleKey`);
      if (!screen.tabs.some(t => t.id === s.tabId)) ctx.add('R03_UNKNOWN_TAB', `${sp}/tabId`, { screen: key, tab: s.tabId });
    });
    checkUnique(ctx, fields.fields.map((f, j) => ({ name: f.key, path: `${p}/fields/fields${at(f.key, j)}` })), KIND_LABELS.screenField);
    fields.extensionDefinitions.forEach((x, j) => checkLabel(ctx, x.labelKey, `${p}/fields/extensionDefinitions${at(x.key, j)}/labelKey`));
    fields.fields.forEach((f, j) => {
      const fp = `${p}/fields/fields${at(f.key, j)}`;
      const type = useField(ctx, entity, f.key, `${fp}/key`);
      checkLabel(ctx, f.labelKey, `${fp}/labelKey`);
      if (!screen.sections.some(s => s.id === f.sectionId)) ctx.add('R03_UNKNOWN_SECTION', `${fp}/sectionId`, { screen: key, section: f.sectionId });
      if (type && f.maxLength !== undefined && !TEXT_TYPES.includes(type)) ctx.add('R10_OPTION_NOT_ALLOWED', `${fp}/maxLength`, { field: f.key, type, option: 'maxLength' });
      const def = index.get(f.key)?.def;
      if (def?.deprecated && f.required) ctx.add('R09_DEPRECATED_REQUIRED', `${fp}/required`, { field: def.key, screen: key });
    });
  });
  const creates = ob.screens.filter(s => isCreateScreen(s.screen.screenKey));
  if (creates.length !== 1) return;
  const only = creates[0], ci = ob.screens.indexOf(only);
  for (const def of ob.object.fields) {
    if (!def.required || def.system || def.deprecated) continue;
    const shown = only.fields.fields.some(f => index.get(f.key)?.key === def.key && f.visible);
    if (!shown) ctx.add('R10_REQUIRED_HIDDEN', `${base}/screens${at(only.screen.screenKey, ci)}/fields/fields[${def.key}]`, { field: def.key, screen: only.screen.screenKey });
  }
}

function checkViewsActions(ctx: Context, ob: ObjectBundle, base: string) {
  const entity = ob.object.key;
  const lv = ob.listViews;
  if (lv) {
    if (lv.entity !== entity) ctx.add('R01_UNKNOWN_ENTITY', `${base}/listViews/entity`, { entity: lv.entity });
    checkUnique(ctx, lv.views.map((v, i) => ({ name: v.key, path: `${base}/listViews/views${at(v.key, i)}` })), KIND_LABELS.listView);
    lv.views.forEach((v, i) => {
      const p = `${base}/listViews/views${at(v.key, i)}`;
      checkLabel(ctx, v.labelKey, `${p}/labelKey`);
      v.columns.forEach((c, j) => useField(ctx, entity, c, `${p}/columns[#${j}]`));
      v.sort.forEach((s, j) => useField(ctx, entity, s.field, `${p}/sort[#${j}]/field`));
      checkCondition(ctx, entity, v.filter, `${p}/filter`);
    });
  }
  const ac = ob.actions;
  if (ac) {
    if (ac.entity !== entity) ctx.add('R01_UNKNOWN_ENTITY', `${base}/actions/entity`, { entity: ac.entity });
    checkUnique(ctx, ac.actions.map((a, i) => ({ name: a.key, path: `${base}/actions/actions${at(a.key, i)}` })), KIND_LABELS.action);
    ac.actions.forEach((a, i) => {
      const p = `${base}/actions/actions${at(a.key, i)}`;
      checkLabel(ctx, a.labelKey, `${p}/labelKey`);
      checkLabel(ctx, a.confirmKey, `${p}/confirmKey`);
      checkFeatureAndPermission(ctx, a, p);
      checkCondition(ctx, entity, a.condition, `${p}/condition`);
    });
  }
}

function checkRulesWorkflow(ctx: Context, ob: ObjectBundle, base: string) {
  const entity = ob.object.key, actionKeys = new Set((ob.actions?.actions ?? []).map(a => a.key));
  const ru = ob.rules;
  if (ru) {
    if (ru.entity !== entity) ctx.add('R01_UNKNOWN_ENTITY', `${base}/rules/entity`, { entity: ru.entity });
    checkUnique(ctx, ru.rules.map((r, i) => ({ name: r.id, path: `${base}/rules/rules${at(r.id, i)}` })), KIND_LABELS.rule);
    ru.rules.forEach((r, i) => {
      const p = `${base}/rules/rules${at(r.id, i)}`;
      checkLabel(ctx, r.errorKey, `${p}/errorKey`);
      checkCondition(ctx, entity, r.condition, `${p}/condition`);
      r.effects.forEach((e, j) => {
        const ep = `${p}/effects[#${j}]/target`;
        const onlyAction = e.actionEnabled !== undefined && e.visible === undefined && e.required === undefined && e.readOnly === undefined;
        if (onlyAction) { if (!actionKeys.has(e.target)) ctx.add('R07_UNKNOWN_ACTION', ep, { action: e.target, entity }); }
        else useField(ctx, entity, e.target, ep);
      });
    });
  }
  const wf = ob.workflow;
  if (wf) {
    if (wf.entity !== entity) ctx.add('R01_UNKNOWN_ENTITY', `${base}/workflow/entity`, { entity: wf.entity });
    checkUnique(ctx, wf.states.map((s, i) => ({ name: s, path: `${base}/workflow/states[#${i}]` })), KIND_LABELS.state);
    const states = new Set(wf.states);
    if (!states.has(wf.startState)) ctx.add('R07_UNKNOWN_STATE', `${base}/workflow/startState`, { state: wf.startState });
    wf.transitions.forEach((t, i) => {
      const p = `${base}/workflow/transitions[#${i}]`;
      for (const end of ['from', 'to'] as const) if (!states.has(t[end])) ctx.add('R07_UNKNOWN_STATE', `${p}/${end}`, { state: t[end] });
      if (!actionKeys.has(t.actionKey)) ctx.add('R07_UNKNOWN_ACTION', `${p}/actionKey`, { action: t.actionKey, entity });
      checkCondition(ctx, entity, t.guard, `${p}/guard`);
    });
  }
}

export function checkObject(ctx: Context, ob: ObjectBundle, index: number): void {
  const base = `objects${at(ob.object.key, index)}`;
  checkDataFields(ctx, ob, base);
  checkScreens(ctx, ob, base);
  checkViewsActions(ctx, ob, base);
  checkRulesWorkflow(ctx, ob, base);
}
