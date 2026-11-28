// @dio-crm/engine — the shared engine that turns metadata/ into running behaviour: runtime model, row access, versions, records.
export { loadRuntimeModel } from './model';
export type { RuntimeModel, RuntimeLoad } from './model';
export { canAccessRow, filterRows, accessPredicate, matchesPredicate } from './row-access';
export type { Actor, RowAccessRule, AccessPredicate, Row } from './row-access';
export * from './versions';
export * from './records';
export { buildUiModel, isUiLocale, UI_TEXT_PREFIX } from './ui-model';
export type { UiModel, UiField, UiOption, UiScreen, UiScreenField, UiListView, UiRelated } from './ui-model';
export * from './security';
export { restrictUiModel } from './ui-access';
