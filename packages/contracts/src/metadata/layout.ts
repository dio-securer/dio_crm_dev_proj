// The on-disk layout of metadata/: which file holds what. Shared by the reader (files.ts) and the writer (write.ts).
// Every path is relative to the repository root and starts with `metadata/`.
import { z } from 'zod';
import { payloadSchemas } from '../admin/schemas';
import { deprecationRecordSchema, objectAccessSchema, fieldDefSchema, objectDefSchema, overlaySchema, screenEntrySchema } from './schemas';

export const ROOT = 'metadata/';
/** Files that may sit anywhere under metadata/ and are not part of the bundle. */
export const IGNORED_NAMES: readonly string[] = ['README.md', '.gitkeep'];
/** Per-object files, by file name (under metadata/objects/<object>/). */
export const OBJECT_FILES = { 'list-views.json': 'listViews', 'actions.json': 'actions', 'rules.json': 'rules', 'workflow.json': 'workflow', 'access.json': 'access' } as const;
export const OBJECT_FILE_SCHEMAS = { listViews: payloadSchemas.LIST_VIEW, actions: payloadSchemas.ACTION, rules: payloadSchemas.RULE, workflow: payloadSchemas.WORKFLOW, access: objectAccessSchema };
/** Global files, by path under metadata/. */
export const GLOBAL_FILES = { 'menu.json': 'menu', 'features.json': 'features' } as const;
export const GLOBAL_FILE_SCHEMAS = { menu: payloadSchemas.MENU, features: payloadSchemas.FEATURE };

export const objectFileSchema = objectDefSchema.omit({ fields: true });
export const fieldsFileSchema = z.object({ fields: z.array(fieldDefSchema) }).strict();
export const codeGroupFileSchema = payloadSchemas.CODE.shape.groups.element;
export const semanticFileSchema = z.object({ terms: payloadSchemas.TERM.shape.terms }).strict();
export const translationFileSchema = z.record(payloadSchemas.TERM.shape.translations.element.shape.text);
export const deprecationsFileSchema = z.object({ items: z.array(deprecationRecordSchema) }).strict();
export const overlayFileSchema = z.object({ overrides: overlaySchema.shape.overrides }).strict();
export { screenEntrySchema };

/** Namespace of a term key: the part before the first dot, or `_root` for a key without a dot. */
export const ROOT_NAMESPACE = '_root';
export const namespaceOf = (termKey: string) => (termKey.includes('.') ? termKey.slice(0, termKey.indexOf('.')) : ROOT_NAMESPACE);
/** A scope key as a folder name: `:` (as in COUNTRY `HQ:KR`) is written as `~`. */
export const scopeKeyToDir = (scopeKey: string) => scopeKey.split(':').join('~');
export const dirToScopeKey = (dir: string) => dir.split('~').join(':');
/** Field chunk files: fields/01.json, fields/02.json, ... used only when fields.json would be too large. */
export const chunkName = (n: number) => `${String(n).padStart(2, '0')}.json`;
export const CHUNK_PATTERN = /^\d{2}\.json$/;
/** A name used as a file or folder name must not leave its folder. */
export const safeName = (name: string) => name.length > 0 && !/[\\/]/.test(name) && name !== '.' && name !== '..';
