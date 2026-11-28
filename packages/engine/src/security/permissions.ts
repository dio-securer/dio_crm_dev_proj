// Object and field permissions (F2-7), in the shape of the requirements' permission matrix: closed by default
// (nothing is allowed unless a set allows it) and a restriction always wins over a grant.
// Pure. Final access = grants of the actor's role and additional sets - restrictions (security restriction first).

export type ObjectAction = 'read' | 'create' | 'edit' | 'delete';
export type FieldAction = 'read' | 'edit';
export type ObjectGrant = Partial<Record<ObjectAction, boolean>>;
export type FieldGrant = Partial<Record<FieldAction, boolean>>;
/** `*` as a field key stands for every field of the object that the same set does not name itself. */
export const ALL_FIELDS = '*';

export interface PermissionSet {
  key: string;
  objects?: Readonly<Record<string, ObjectGrant>>;
  fields?: Readonly<Record<string, Readonly<Record<string, FieldGrant>>>>;
}
export interface PermissionGrants {
  /** The role's set and any additional sets. Their allowances add up. */
  sets: readonly PermissionSet[];
  /** Security restrictions: an action marked true here is refused whatever the sets say. */
  restrictions?: readonly PermissionSet[];
}

const objectSays = (sets: readonly PermissionSet[], objectKey: string, action: ObjectAction) =>
  sets.some(s => s.objects?.[objectKey]?.[action] === true);
const fieldSays = (sets: readonly PermissionSet[], objectKey: string, field: string, action: FieldAction) =>
  sets.some(s => { const f = s.fields?.[objectKey]; return (f?.[field] ?? f?.[ALL_FIELDS])?.[action] === true; });

export function canObject(grants: PermissionGrants, objectKey: string, action: ObjectAction): boolean {
  if (objectSays(grants.restrictions ?? [], objectKey, action)) return false;
  return objectSays(grants.sets, objectKey, action);
}

export interface FieldAccess { read: boolean; edit: boolean }
/** Editing needs reading, and both need reading the object; editing also needs create or edit on the object. */
export function fieldAccess(grants: PermissionGrants, objectKey: string, field: string): FieldAccess {
  const denied = (a: FieldAction) => fieldSays(grants.restrictions ?? [], objectKey, field, a);
  const read = canObject(grants, objectKey, 'read') && !denied('read') && fieldSays(grants.sets, objectKey, field, 'read');
  const writable = canObject(grants, objectKey, 'edit') || canObject(grants, objectKey, 'create');
  const edit = read && writable && !denied('edit') && fieldSays(grants.sets, objectKey, field, 'edit');
  return { read, edit };
}

/** A field decision for one object, or undefined when the actor carries no grants (nothing to narrow). */
export type FieldAccessOf = (field: string) => FieldAccess;
export function fieldAccessOf(grants: PermissionGrants | undefined, objectKey: string): FieldAccessOf | undefined {
  return grants ? field => fieldAccess(grants, objectKey, field) : undefined;
}

/** The values without the fields the actor may not read. Keys are field keys. */
export function readableValues<V>(values: Readonly<Record<string, V>>, access: FieldAccessOf | undefined): Record<string, V> {
  const out: Record<string, V> = {};
  for (const [k, v] of Object.entries(values)) if (!access || access(k).read) out[k] = v;
  return out;
}

/** Permissions of the admin work on metadata (requirements: CRM_ADMIN manages screens). Keys are of the admin permission catalog. */
export const ADMIN_PERMISSIONS = { edit: 'config.edit', publish: 'config.publish' } as const;
