// @dio-crm/engine — the shared engine that turns metadata/ into running behaviour. F2-1: runtime model and row access.
export { loadRuntimeModel } from './model';
export type { RuntimeModel, RuntimeLoad } from './model';
export { canAccessRow, filterRows, accessPredicate, matchesPredicate } from './row-access';
export type { Actor, RowAccessRule, AccessPredicate, Row } from './row-access';
