import { z } from 'zod';
import { assert, Row, Transaction } from './core';
export const permissionCatalog = ['account.read', 'account.create', 'account.update', 'company.read', 'company.manage', 'organization.read', 'organization.manage', 'user.read', 'user.manage', 'membership.assign', 'ownershipTransfer.manage', 'role.read', 'role.manage', 'role.assign', 'delegation.manage', 'config.read', 'config.edit', 'config.validate', 'config.publish', 'config.publish.scope', 'security.manage', 'session.read', 'session.revoke', 'user.mfaReset.request'] as const;
const effect = z.enum(['UNSET', 'ALLOW', 'DENY']);
export const roleSchema = z.object({ code: z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/), name: z.string().min(1).max(100), active: z.boolean(), grants: z.array(z.enum(permissionCatalog)), denies: z.array(z.enum(permissionCatalog)), dataScopes: z.array(z.object({ entity: z.literal('account'), actions: z.array(z.enum(['read', 'create', 'update'])).min(1), scope: z.enum(['SELF', 'ORG', 'SUBTREE', 'COMPANY', 'SHARED']), orgIds: z.array(z.string().uuid()).default([]), sharedRecordIds: z.array(z.string().uuid()).default([]) }).strict()), fieldPermissions: z.array(z.object({ entity: z.literal('account'), field: z.enum(['name', 'phone', 'secret', 'ownerMembershipId']), readEffect: effect, writeEffect: effect, maskType: z.enum(['NONE', 'LAST4']) }).strict()), mfaPolicy: z.enum(['OFF', 'OPTIONAL', 'REQUIRED']).default('OFF') }).strict();
export type Role = z.infer<typeof roleSchema>;
export interface SecurityActor {
    id?: string;
    userId: string;
    companyId: string;
    membershipId: string;
    role: string;
    permissionVersion: number;
}
const builtinGrants: Record<string, readonly string[]> = { PLATFORM_ADMIN: permissionCatalog.filter(x => !x.startsWith('account.')), COMPANY_ADMIN: permissionCatalog.filter(x => x !== 'delegation.manage' && x !== 'config.publish.scope' && !x.startsWith('account.')), MANAGER: ['account.read', 'account.create', 'account.update'], SALES: ['account.read', 'account.create', 'account.update'] };
export function rolesFor(tx: Transaction, m: Row): Role[] {
    const codes = Array.isArray(m.roleCodes) ? m.roleCodes as string[] : [String(m.role)];
    return codes.flatMap(code => {
        const custom = tx.query('roles').find(r => r.code === code);
        if (custom)
            return custom.active ? [custom as unknown as Role] : [];
        return builtinGrants[code] ? [{ code, name: code, active: true, grants: [...builtinGrants[code]] as any, denies: [], dataScopes: [{ entity: 'account', actions: ['read', 'create', 'update'], scope: code === 'SALES' ? 'SELF' : code === 'MANAGER' ? 'SUBTREE' : 'COMPANY', orgIds: [], sharedRecordIds: [] }], fieldPermissions: code === 'SALES' ? [{ entity: 'account', field: 'secret', readEffect: 'DENY', writeEffect: 'DENY', maskType: 'NONE' }] : [], mfaPolicy: 'OFF' } as Role] : [];
    });
}
export function allowed(roles: Role[], permission: string) { return !roles.some(r => r.denies.includes(permission as any)) && roles.some(r => r.grants.includes(permission as any)); }
export function actorMembership(tx: Transaction, a: SecurityActor) { const m = tx.forCompany(a.companyId).read('memberships', a.membershipId); assert(m && m.userId === a.userId && m.active && m.permissionVersion === a.permissionVersion && tx.forCompany('*').read('users', a.userId)?.active && tx.forCompany('*').read('companies', a.companyId)?.active, 401, 'SESSION_REVOKED'); return m; }
export function requirePermission(tx: Transaction, a: SecurityActor, company: string, permission: string) { const m = actorMembership(tx, a); assert(a.role === 'PLATFORM_ADMIN' || a.companyId === company, 404, 'NOT_FOUND'); assert(allowed(rolesFor(tx.forCompany(a.companyId), m), permission), 403, 'FORBIDDEN'); }
export function fieldAccess(roles: Role[], field: string, action = 'update') {
    const rows = roles.flatMap(r => r.fieldPermissions.filter(f => f.entity === 'account' && f.field === field));
    const combine = (key: 'readEffect' | 'writeEffect', base: boolean) => rows.some(r => r[key] === 'DENY') ? false : rows.some(r => r[key] === 'ALLOW') ? true : base;
    const read = allowed(roles, 'account.read') && combine('readEffect', field !== 'secret');
    const write = read && field!=='ownerMembershipId' && allowed(roles, 'account.' + action) && combine('writeEffect', field !== 'ownerMembershipId');
    return { read, write, mask: rows.some(r => r.readEffect === 'ALLOW' && r.maskType === 'LAST4') ? 'LAST4' : 'NONE' };
}
export function dataAllowed(tx: Transaction, m: Row, roles: Role[], row: Row, action: string) { if (row.companyId !== m.companyId)
    return false; const owner = tx.read('memberships', String(row.ownerMembershipId)); return roles.flatMap(r => r.dataScopes).some(s => { if (s.entity !== 'account' || !s.actions.includes(action as any))
    return false; if (s.scope === 'COMPANY')
    return true; if (s.scope === 'SELF')
    return row.ownerMembershipId === m.id; if (s.scope === 'SHARED')
    return s.sharedRecordIds.includes(row.id); if (!owner?.organizationId)
    return false; const roots = s.orgIds.length ? s.orgIds : [String(m.organizationId)]; if (s.scope === 'ORG')
    return roots.includes(String(owner.organizationId)); let id = String(owner.organizationId); const seen = new Set<string>(); while (id && !seen.has(id)) {
    if (roots.includes(id))
        return true;
    seen.add(id);
    id = String(tx.read('organizations', id)?.parentId || '');
} return false; }); }
export function projectAccount(roles: Role[], row: Row) { const values: Record<string, unknown> = {}, maskedFields: Record<string, unknown> = {}; for (const field of ['name', 'phone', 'secret', 'ownerMembershipId']) {
    const p = fieldAccess(roles, field);
    if (!p.read)
        continue;
    if (p.mask === 'LAST4') {
        maskedFields[field] = { displayValue: row[field] == null ? '' : '••••' + String(row[field]).slice(-4), canReplace: p.write };
    }
    else if (row[field] !== undefined)
        values[field] = row[field];
} return { id: row.id, revision: row.revision, companyId: row.companyId, values, maskedFields }; }
