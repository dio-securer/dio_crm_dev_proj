// F1-1 metamodel schemas. The admin payload schemas are imported, never copied: an object bundle stores the admin
// SCREEN/FIELD/LIST_VIEW/ACTION/RULE/WORKFLOW payloads as they are, and the global MENU/CODE/TERM/FEATURE payloads too.
// What is new here is only the DATA definition of an object (ObjectDef/FieldDef), deprecation records and overlays.
import { z } from 'zod';
import { payloadSchemas } from '../admin/schemas';
import { configDocumentBaseSchema, overrideOpSchema } from '../admin/versions';
import { orgChartSchema, permissionSetSchema, profileSchema } from './security-schemas';

const P = payloadSchemas;
/** Extension field types of the admin FIELD domain (text, decimal, date, boolean, enum), read from the admin schema. */
const extensionTypeSchema = (P.FIELD.shape.extensionDefinitions as any)._def.innerType.element.shape.type as z.ZodEnum<[string, ...string[]]>;
export const ADMIN_EXTENSION_TYPES = extensionTypeSchema.options as readonly string[];
/**
 * Types added on top of the admin extension types, each with the place that needs it:
 * - integer   : `integer` flag of HqValueRule (hq-standard.ts) and ConfigValueRule (crm-customization.ts); `order` in editor-property-registry.ts.
 * - datetime  : `createdAt: z.string().datetime()` in admin/versions.ts; record timestamps that a date cannot hold.
 * - reference : value type `reference` in HqValueRule (hq-standard.ts) and ConfigValueRule (crm-customization.ts).
 */
export const ADDED_FIELD_TYPES = ['integer', 'datetime', 'reference'] as const;
export const FIELD_TYPES = [...ADMIN_EXTENSION_TYPES, ...ADDED_FIELD_TYPES] as unknown as [string, ...string[]];
export const TEXT_TYPES: readonly string[] = ['text'];
/** A decimal field without precision or scale is DECIMAL(18,4). The checks, the engine and the record tables all read this. */
export const DECIMAL_DEFAULT = { precision: 18, scale: 4 } as const;
export const COMPARABLE_TYPES: readonly string[] = ['integer', 'decimal', 'date', 'datetime'];
/** The locales every label must be translated into, read from the admin TERM schema (no second list). */
export const REQUIRED_LOCALES = (P.TERM.shape.translations.element.shape.locale as z.ZodEnum<[string, ...string[]]>).options as readonly string[];
/** The admin scopes, outermost first (COMMON -> TEMPLATE -> COUNTRY -> COMPANY). */
export const SCOPES = configDocumentBaseSchema.shape.scope.options;

const lowerSnake = z.string().max(100).regex(/^[a-z][a-z0-9_]*$/);
const key = z.string().min(1).max(100);
export const deprecationSchema = z.object({ since: z.string().min(1).max(40), replacedBy: key.optional() }).strict();

export const fieldDefSchema = z.object({
  key: lowerSnake.refine(v => !v.startsWith('x_'), 'X_PREFIX_RESERVED'),
  type: z.enum(FIELD_TYPES),
  labelKey: key,
  required: z.boolean().default(false),
  system: z.boolean().default(false),
  maxLength: z.number().int().positive().max(4000).optional(),
  precision: z.number().int().min(1).max(38).optional(),
  scale: z.number().int().min(0).max(18).optional(),
  enumCodeGroup: key.optional(),
  referenceObject: lowerSnake.optional(),
  deprecated: deprecationSchema.optional(),
  aliases: z.array(lowerSnake).default([]),
}).strict();
export type FieldDef = z.infer<typeof fieldDefSchema>;

export const objectDefSchema = z.object({
  key: lowerSnake,
  labelKey: key,
  pluralLabelKey: key,
  fields: z.array(fieldDefSchema),
  deprecated: deprecationSchema.optional(),
  aliases: z.array(lowerSnake).default([]),
}).strict();
export type ObjectDef = z.infer<typeof objectDefSchema>;

/**
 * Row access (F2-2): which rows of an object an actor may see. Rules are ORed; an object without rules is closed.
 * `permission`: the rule counts only for an actor who has that permission (closed universe: admin permissionCatalog).
 */
const accessPermission = { permission: key.optional() };
export const rowAccessRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all'), ...accessPermission }).strict(),
  z.object({ kind: z.literal('none') }).strict(),
  z.object({ kind: z.literal('own'), ownerField: lowerSnake, ...accessPermission }).strict(),
  z.object({ kind: z.literal('members'), ownerField: lowerSnake, ...accessPermission }).strict(),
  z.object({ kind: z.literal('unit'), unitField: lowerSnake, ...accessPermission }).strict(),
  /** F2-7: rows owned by anyone in the subtree of the units the actor heads (metadata/security/org). */
  z.object({ kind: z.literal('subtree'), ownerField: lowerSnake, ...accessPermission }).strict(),
]);
export type RowAccessRule = z.infer<typeof rowAccessRuleSchema>;
export const objectAccessSchema = z.object({ entity: lowerSnake, rules: z.array(rowAccessRuleSchema).min(1) }).strict();
export type ObjectAccess = z.infer<typeof objectAccessSchema>;
/** Field types that can hold a user or unit id, so they can be an ownerField / unitField. */
export const ACCESS_FIELD_TYPES: readonly string[] = ['text', 'reference'];

/** One screen: the admin SCREEN payload and the admin FIELD payload whose sectionIds point into that screen. */
export const screenEntrySchema = z.object({ screen: P.SCREEN, fields: P.FIELD }).strict();
export type ScreenEntry = z.infer<typeof screenEntrySchema>;

export const objectBundleSchema = z.object({
  object: objectDefSchema,
  screens: z.array(screenEntrySchema).default([]),
  listViews: P.LIST_VIEW.optional(),
  actions: P.ACTION.optional(),
  rules: P.RULE.optional(),
  workflow: P.WORKFLOW.optional(),
  access: objectAccessSchema.optional(),
}).strict();
export type ObjectBundle = z.infer<typeof objectBundleSchema>;

/** Admin LIST_VIEW, ACTION and MENU items have no deprecation field, so their deprecation is recorded here. */
export const deprecationRecordSchema = z.object({
  kind: z.enum(['LIST_VIEW', 'ACTION', 'MENU']),
  entity: lowerSnake.optional(),
  key,
  since: z.string().min(1).max(40),
  replacedBy: key.optional(),
}).strict();
export type DeprecationRecord = z.infer<typeof deprecationRecordSchema>;

export const OVERLAY_DOMAINS = ['MENU', 'CODE', 'TERM', 'FEATURE', 'SCREEN', 'FIELD', 'LIST_VIEW', 'ACTION', 'RULE', 'WORKFLOW'] as const;
export const ENTITY_DOMAINS: readonly string[] = ['SCREEN', 'FIELD', 'LIST_VIEW', 'ACTION', 'RULE', 'WORKFLOW'];
export const SCREEN_DOMAINS: readonly string[] = ['SCREEN', 'FIELD'];
/**
 * An overlay changes one payload for one scope with the admin override operations (SET, REMOVE_ITEM, RESET).
 * "Remove this menu for this company" is `{ op: 'REMOVE_ITEM', path: [{ property: 'nodes' }, { itemKey: '<menu id>' }] }`.
 * Object data definitions (ObjectDef) cannot be overlaid: a company hides a field, it does not delete the data field.
 */
export const overlaySchema = z.object({
  scope: configDocumentBaseSchema.shape.scope,
  scopeKey: z.string().min(1).max(100),
  domain: z.enum(OVERLAY_DOMAINS),
  entity: lowerSnake.optional(),
  screenKey: key.optional(),
  overrides: z.array(overrideOpSchema).min(1),
}).strict();
export type Overlay = z.infer<typeof overlaySchema>;

export const METADATA_SCHEMA_VERSION = 1;
export const metadataBundleSchema = z.object({
  schemaVersion: z.literal(METADATA_SCHEMA_VERSION),
  objects: z.array(objectBundleSchema),
  menu: P.MENU.optional(),
  codes: P.CODE.optional(),
  terms: P.TERM.optional(),
  features: P.FEATURE.optional(),
  deprecations: z.array(deprecationRecordSchema).default([]),
  overlays: z.array(overlaySchema).default([]),
  permissionSets: z.array(permissionSetSchema).default([]),
  profiles: z.array(profileSchema).default([]),
  orgCharts: z.array(orgChartSchema).default([]),
}).strict();
export type MetadataBundle = z.infer<typeof metadataBundleSchema>;
export type MetadataBundleInput = z.input<typeof metadataBundleSchema>;
