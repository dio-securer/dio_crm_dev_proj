// Which screen a renderer uses and how its tabs, sections and fields nest. Pure selectors over the screen model.
import type { UiListView, UiScreen, UiScreenField } from '@dio-crm/engine';
import type { EngineUiModel, UiField } from './types';
import { fieldOf } from './text';

export type FormMode = 'create' | 'edit';
export const DETAIL_SCREEN = 'detail';
export const EDIT_SCREEN = 'edit';

export const detailScreen = (model: EngineUiModel): UiScreen | undefined => model.screens.find(s => s.key === DETAIL_SCREEN);
/** Create: the create screen (`create`, else the first create_* screen). Edit: the `edit` screen if there is one, else `detail`. */
export function formScreen(model: EngineUiModel, mode: FormMode): UiScreen | undefined {
  if (mode === 'create') return model.screens.find(s => s.key === 'create') ?? model.screens.find(s => s.create);
  return model.screens.find(s => s.key === EDIT_SCREEN) ?? detailScreen(model);
}

export interface PlacedField { screen: UiScreenField; field: UiField }
export interface PlacedSection { id: string; title: string; columns: number; fields: PlacedField[] }
export interface PlacedTab { id: string; label: string; sections: PlacedSection[] }

/** Tabs in order, each with its sections in order, each with its visible fields in order. Empty sections and tabs are dropped. */
export function placeScreen(model: EngineUiModel, screen: UiScreen): PlacedTab[] {
  const sectionsOf = (tabId: string): PlacedSection[] => screen.sections.filter(s => s.tabId === tabId).map(s => ({
    id: s.id, title: s.title, columns: s.columns,
    fields: screen.fields.filter(f => f.sectionId === s.id && f.visible).flatMap(f => { const field = fieldOf(model, f.key); return field ? [{ screen: f, field }] : []; }),
  })).filter(s => s.fields.length > 0);
  return screen.tabs.map(t => ({ id: t.id, label: t.label, sections: sectionsOf(t.id) })).filter(t => t.sections.length > 0);
}

export const viewOf = (model: EngineUiModel, key: string | undefined): UiListView | undefined =>
  model.listViews.find(v => v.key === key) ?? model.listViews[0];

export const FALLBACK_COLUMNS = 5;
/** The columns of a view as fields; without any view, the first few non-system fields. `without` drops one field (a related list's own reference). */
export function columnsOf(model: EngineUiModel, view: UiListView | undefined, without?: string): UiField[] {
  const keys = view ? view.columns : model.fields.filter(f => !f.system && !f.deprecated).slice(0, FALLBACK_COLUMNS).map(f => f.key);
  return keys.filter(k => k !== without).flatMap(k => { const field = fieldOf(model, k); return field ? [field] : []; });
}
