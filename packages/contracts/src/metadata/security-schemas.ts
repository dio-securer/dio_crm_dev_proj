// Security settings (F2-7): permission sets, profiles and the organisation chart, kept as values under metadata/security/.
// The engine reads them (packages/engine/src/security); the checks are in check-security.ts (S01..S11).
import { z } from 'zod';

const lowerSnake = z.string().max(100).regex(/^[a-z][a-z0-9_]*$/);
// Role names and org ids are repeated in declarations and messages: letters, digits, dot, underscore and hyphen only.
const SAFE = /^[A-Za-z0-9._-]+$/;
const key = z.string().min(1).max(100).regex(SAFE);
const id = z.string().min(1).max(100).regex(SAFE);

export const objectGrantSchema = z.object({ read: z.boolean().optional(), create: z.boolean().optional(), edit: z.boolean().optional(), delete: z.boolean().optional() }).strict();
export const fieldGrantSchema = z.object({ read: z.boolean().optional(), edit: z.boolean().optional() }).strict();
/** One permission set: object grants by object key, field grants by object key then field key (`*` = every field). */
export const permissionSetSchema = z.object({
  key: lowerSnake,
  name: z.string().min(1).max(200),
  objects: z.record(lowerSnake, objectGrantSchema).default({}),
  fields: z.record(lowerSnake, z.record(z.string().regex(/^(\*|[a-z][a-z0-9_]*)$/), fieldGrantSchema)).default({}),
}).strict();
export type PermissionSetDef = z.infer<typeof permissionSetSchema>;

/**
 * A profile gives its permission sets to every user who holds one of its roles (the membership role of the token).
 * `restrictions` are permission sets whose `true` actions are refused whatever any set allows (security first).
 */
export const profileSchema = z.object({
  key: lowerSnake,
  name: z.string().min(1).max(200),
  roles: z.array(key).min(1),
  permissionSets: z.array(lowerSnake).default([]),
  restrictions: z.array(lowerSnake).default([]),
}).strict();
export type ProfileDef = z.infer<typeof profileSchema>;

export const orgUnitSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  parentId: id.optional(),
  headUserId: id.optional(),
  erpOrgCode: z.string().min(1).max(100).optional(),
}).strict();
export const orgMemberSchema = z.object({ userId: id, unitId: id, name: z.string().min(1).max(200).optional(), erpUserCode: z.string().min(1).max(100).optional() }).strict();
/** The organisation of one company: units (with their heads) and the users assigned to them. */
export const orgChartSchema = z.object({
  key: lowerSnake,
  companyId: z.number().int(),
  units: z.array(orgUnitSchema).min(1),
  members: z.array(orgMemberSchema).default([]),
}).strict();
export type OrgChartDef = z.infer<typeof orgChartSchema>;

export const permissionSetsFileSchema = z.object({ items: z.array(permissionSetSchema) }).strict();
export const profilesFileSchema = z.object({ items: z.array(profileSchema) }).strict();
