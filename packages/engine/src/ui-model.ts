// buildUiModel: the published model of one object as the screens need it (F2-5): labels already translated, keys
// already canonical, screens and views in display order. Pure. It carries settings only: no rows, no access rules.
import { REQUIRED_LOCALES, isCreateScreen } from '@dio-crm/contracts/metadata';
import type { FieldDef, ObjectBundle } from '@dio-crm/contracts/metadata';
import type { RuntimeModel } from './model';
import { readOnlyFields } from './records/validate';

export interface UiOption { code: string; label: string }
export interface UiField {
  key: string; type: string; label: string; required: boolean; system: boolean;
  /** The API refuses to write this field (a system field, or read-only on some screen). */
  readOnly: boolean; deprecated: boolean;
  maxLength?: number; precision?: number; scale?: number; options?: UiOption[]; referenceObject?: string;
}
export interface UiScreenField { key: string; sectionId: string; label: string; visible: boolean; required: boolean; readOnly: boolean; order: number }
export interface UiScreen {
  key: string; create: boolean;
  tabs: { id: string; label: string; order: number }[];
  sections: { id: string; tabId: string; title: string; order: number; columns: number }[];
  fields: UiScreenField[];
}
export interface UiListView { key: string; label: string; columns: string[]; sort: { field: string; direction: 'ASC' | 'DESC' }[]; pageSize: number }
/** Records of `object` whose reference field `field` points at a record of this object. */
export interface UiRelated { object: string; field: string; label: string; fieldLabel: string }
export interface UiModel {
  locale: string;
  object: { key: string; label: string; pluralLabel: string };
  fields: UiField[];
  screens: UiScreen[];
  listViews: UiListView[];
  related: UiRelated[];
  /** Fixed screen texts (buttons, error messages): every term whose key starts with `engine.`. */
  texts: Record<string, string>;
}

export const UI_TEXT_PREFIX = 'engine.';
export const isUiLocale = (locale: unknown): locale is string => typeof locale === 'string' && REQUIRED_LOCALES.includes(locale);
const byOrder = <T extends { order: number }>(list: readonly T[]) => [...list].sort((a, b) => a.order - b.order);

function uiField(model: RuntimeModel, f: FieldDef, text: (key: string) => string, readOnly: ReadonlySet<string>): UiField {
  const out: UiField = { key: f.key, type: f.type, label: text(f.labelKey), required: f.required, system: f.system, readOnly: f.system || readOnly.has(f.key), deprecated: f.deprecated !== undefined };
  if (f.maxLength !== undefined) out.maxLength = f.maxLength;
  if (f.precision !== undefined) out.precision = f.precision;
  if (f.scale !== undefined) out.scale = f.scale;
  if (f.referenceObject !== undefined) out.referenceObject = f.referenceObject;
  if (f.type === 'enum' && f.enumCodeGroup) out.options = model.codeValues(f.enumCodeGroup).filter(c => c.active).map(c => ({ code: c.code, label: text(c.labelKey) }));
  return out;
}

function uiScreens(model: RuntimeModel, ob: ObjectBundle, text: (key: string) => string): UiScreen[] {
  const real = (name: string) => model.field(ob.object.key, name)?.key ?? name;
  return ob.screens.map(({ screen, fields }) => ({
    key: screen.screenKey,
    create: isCreateScreen(screen.screenKey),
    tabs: byOrder(screen.tabs).map(t => ({ id: t.id, label: text(t.labelKey), order: t.order })),
    sections: byOrder(screen.sections).map(s => ({ id: s.id, tabId: s.tabId, title: text(s.titleKey), order: s.order, columns: s.columns })),
    fields: byOrder(fields.fields).map(f => ({ key: real(f.key), sectionId: f.sectionId, label: text(f.labelKey), visible: f.visible, required: f.required, readOnly: f.readOnly, order: f.order })),
  }));
}

/** Reference fields of any object that point at `objectKey`, in object then field order. */
function related(model: RuntimeModel, objectKey: string, text: (key: string) => string): UiRelated[] {
  const out: UiRelated[] = [];
  for (const key of model.objectKeys()) {
    const other = model.object(key)!.object;
    for (const f of other.fields) {
      if (f.type === 'reference' && f.referenceObject === objectKey && !f.deprecated) out.push({ object: other.key, field: f.key, label: text(other.pluralLabelKey), fieldLabel: text(f.labelKey) });
    }
  }
  return out;
}

/** Undefined when the object is not in the model or the locale is not one every label is translated into. */
export function buildUiModel(model: RuntimeModel, objectKey: string, locale: string): UiModel | undefined {
  const ob = model.object(objectKey);
  if (!ob || !isUiLocale(locale)) return undefined;
  const text = (key: string) => model.term(key, locale) ?? key;
  const readOnly = readOnlyFields(model, objectKey);
  const real = (name: string) => model.field(objectKey, name)?.key ?? name;
  const texts: Record<string, string> = {};
  for (const t of model.bundle.terms?.translations ?? []) if (t.locale === locale && t.termKey.startsWith(UI_TEXT_PREFIX)) texts[t.termKey] = t.text;
  return {
    locale,
    object: { key: ob.object.key, label: text(ob.object.labelKey), pluralLabel: text(ob.object.pluralLabelKey) },
    fields: ob.object.fields.map(f => uiField(model, f, text, readOnly)),
    screens: uiScreens(model, ob, text),
    listViews: (ob.listViews?.views ?? []).map(v => ({ key: v.key, label: text(v.labelKey), columns: v.columns.map(real), sort: v.sort.map(s => ({ field: real(s.field), direction: s.direction })), pageSize: v.pageSize })),
    related: related(model, objectKey, text),
    texts,
  };
}
