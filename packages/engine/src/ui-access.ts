// The screen model narrowed to one actor's permissions (F2-7): unreadable fields leave the model entirely (fields,
// screens, list columns); a list view whose filter or sort names an unreadable field is left out (its rows would reveal
// the hidden value); a related list is kept only if the actor reads the child object and the child's reference field
// (checked with the child object's grants). Readable but uneditable fields become read-only.
import type { RuntimeModel } from './model';
import { fieldAccessOf, canObject } from './security/permissions';
import type { FieldAccessOf, PermissionGrants } from './security/permissions';
import type { UiModel } from './ui-model';

/** Every `field` named anywhere in a view filter (a condition tree), as field keys (aliases resolved). */
export function filterFields(model: RuntimeModel, objectKey: string, filter: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (k === 'field' && typeof v === 'string') out.push(model.field(objectKey, v)?.key ?? v);
      else walk(v);
    }
  };
  walk(filter);
  return out;
}

/** Whether every field a view filters or sorts on is readable. Without `access` every view is readable. */
export function viewReadable(model: RuntimeModel, objectKey: string, viewKey: string, access: FieldAccessOf | undefined): boolean {
  if (!access) return true;
  const view = model.object(objectKey)?.listViews?.views.find(v => v.key === viewKey);
  if (!view) return false;
  const names = [...filterFields(model, objectKey, view.filter), ...(view.sort ?? []).map(s => model.field(objectKey, s.field)?.key ?? s.field)];
  return names.every(n => access(n).read);
}

export function restrictUiModel(ui: UiModel, grants: PermissionGrants | undefined, model: RuntimeModel): UiModel {
  if (!grants) return ui;
  const objectKey = ui.object.key;
  const access = fieldAccessOf(grants, objectKey)!;
  const readable = (key: string) => access(key).read;
  return {
    ...ui,
    fields: ui.fields.filter(f => readable(f.key)).map(f => (access(f.key).edit ? f : { ...f, readOnly: true })),
    screens: ui.screens.map(s => ({
      ...s,
      fields: s.fields.filter(f => readable(f.key)).map(f => (access(f.key).edit ? f : { ...f, readOnly: true })),
    })),
    listViews: ui.listViews.filter(v => viewReadable(model, objectKey, v.key, access)).map(v => ({ ...v, columns: v.columns.filter(readable) })),
    related: ui.related.filter(r => canObject(grants, r.object, 'read') && fieldAccessOf(grants, r.object)!(r.field).read),
  };
}
