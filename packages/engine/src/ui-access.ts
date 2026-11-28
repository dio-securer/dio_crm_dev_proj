// The screen model narrowed to one actor's field permissions (F2-7): unreadable fields leave the model entirely
// (fields, screens, list columns, related lists that point through them); readable but uneditable fields become read-only.
import type { FieldAccessOf } from './security/permissions';
import type { UiModel } from './ui-model';

export function restrictUiModel(ui: UiModel, access: FieldAccessOf | undefined): UiModel {
  if (!access) return ui;
  const readable = (key: string) => access(key).read;
  return {
    ...ui,
    fields: ui.fields.filter(f => readable(f.key)).map(f => (access(f.key).edit ? f : { ...f, readOnly: true })),
    screens: ui.screens.map(s => ({
      ...s,
      fields: s.fields.filter(f => readable(f.key)).map(f => (access(f.key).edit ? f : { ...f, readOnly: true })),
    })),
    listViews: ui.listViews.map(v => ({ ...v, columns: v.columns.filter(readable), sort: v.sort.filter(x => readable(x.field)) })),
  };
}
