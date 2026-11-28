// @dio-crm/contracts/metadata — the F1-1 metamodel: schemas, cross-reference validator, compatibility diff, file layout.
export * from './schemas';
export * from './issues';
export * from './messages';
export * from './canonical';
export { analyzeBundle, validateBundle, overlayName } from './validate';
export type { Analysis } from './validate';
export type { FieldUse } from './context';
export { isCreateScreen } from './check-object';
export { diffBundles, SAFE_TYPE_WIDENINGS } from './diff';
export { bundleFromFiles } from './files';
export type { MetadataFile, LoadResult } from './files';
export { filesFromBundle } from './write';
export * from './layout';
export { fieldNames, resolveByNames } from './field-names';
export type { NamedField, NameResolution } from './field-names';
