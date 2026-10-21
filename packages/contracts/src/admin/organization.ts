import { z } from 'zod';
import { canonical, AdminRepository, Row, Collection, Transaction, uuid, companySchema, assert } from './core';
import { CommandMeta } from './drafts';
export interface OrganizationActor {
    userId: string;
    companyId: string;
    role: string;
}
const orgInput = z.object({ code: z.string().min(1), name: z.string().min(1), type: z.enum(['DIVISION', 'DEPARTMENT', 'TEAM']), parentId: uuid.nullable(), managerMembershipId: uuid.nullable(), active: z.boolean() }).strict();
const userInput = z.object({ loginId: z.string().min(1), name: z.string().min(1), email: z.string().email(), organizationId: uuid.nullable(), role: z.enum(['SALES', 'MANAGER', 'COMPANY_ADMIN']) }).strict();
const mutable = z.object({ revision: z.number().int().positive() });
const transferInput = z.object({ source: uuid, target: uuid, entityTypes: z.array(z.enum(['accounts', 'leads', 'opportunities', 'contracts', 'orders'])).min(1), recordIds: z.array(uuid).optional() }).strict();
export class OrganizationCommands {
    constructor(private repo: AdminRepository, private id: () => string, private now: () => number = Date.now) { }
    private authorize(actor: OrganizationActor, companyId: string, write = false) { assert(actor.role === 'PLATFORM_ADMIN' || actor.companyId === companyId, 404, 'NOT_FOUND'); if (write)
        assert(['PLATFORM_ADMIN', 'COMPANY_ADMIN'].includes(actor.role), 403, 'FORBIDDEN'); }
    async list(actor: OrganizationActor, companyId: string, resource: 'companies' | 'organizations' | 'users' | 'memberships' | 'transfers') {
        this.authorize(actor, companyId, true);
        return this.repo.transact(companyId, tx => { if (resource === 'companies')
            return tx.forCompany('*').query('companies').filter(c => actor.role === 'PLATFORM_ADMIN' || c.id === companyId); if (resource === 'users') {
            const ids = new Set(tx.query('memberships').map(m => m.userId));
            return tx.query('users').filter(u => ids.has(u.id)).map(u => ({ ...u, identityActive: u.active, active: actor.role === 'PLATFORM_ADMIN' ? u.active : tx.query('memberships').find(m => m.userId === u.id)?.active, memberships: tx.query('memberships').filter(m => m.userId === u.id) }));
        } return tx.query(resource); });
    }
    private activeMember(tx: Transaction, id: string) { const m = tx.read('memberships', id); assert(m && m.active && tx.read('users', String(m.userId))?.active, 422, 'ACTIVE_MEMBERSHIP_REQUIRED'); return m; }
    private orgValid(tx: Transaction, id: string, body: any) {
        if (body.parentId) {
            assert(body.parentId !== id, 422, 'ORGANIZATION_CYCLE');
            let p = tx.read('organizations', body.parentId);
            assert(p, 422, 'PARENT_COMPANY_MISMATCH');
            const seen = new Set([id]);
            while (p) {
                assert(!seen.has(p.id), 422, 'ORGANIZATION_CYCLE');
                seen.add(p.id);
                p = p.parentId ? tx.read('organizations', String(p.parentId)) : undefined;
            }
        }
        if (body.managerMembershipId)
            this.activeMember(tx, body.managerMembershipId);
        if (!body.active)
            assert(!tx.query('organizations').some(o => o.active && o.parentId === id) && !tx.query('memberships').some(m => m.active && m.organizationId === id), 422, 'ORGANIZATION_IN_USE');
    }
    private protectLastAdmin(tx: Transaction, user: Row, membership?: Row) {
        if (user.platformAdmin)
            assert(tx.forCompany('*').query('companies').filter(c => c.active).some(c => tx.forCompany(c.id).query('memberships').some(m => m.active && m.role === 'PLATFORM_ADMIN' && (membership ? m.id !== membership.id : m.userId !== user.id) && tx.forCompany('*').query('users').some(u => u.id === m.userId && u.active && u.platformAdmin))), 409, 'LAST_PLATFORM_ADMIN');
        const memberships = membership ? [membership] : tx.forCompany('*').query('companies').flatMap(c => tx.forCompany(c.id).query('memberships')).filter(m => m.userId === user.id && m.active);
        for (const m of memberships)
            if (m.role === 'COMPANY_ADMIN')
                assert(tx.forCompany(String(m.companyId)).query('memberships').some(other => other.id !== m.id && other.userId !== user.id && other.active && other.role === 'COMPANY_ADMIN' && tx.forCompany(String(m.companyId)).read('users', String(other.userId))?.active), 409, 'LAST_COMPANY_ADMIN');
    }
    async command(actor: OrganizationActor, companyId: string, operation: string, resourceId: string | undefined, input: unknown, match: string | undefined, meta: CommandMeta): Promise<any> {
        this.authorize(actor, companyId, true);
        assert(meta.key, 400, 'IDEMPOTENCY_REQUIRED');
        return this.repo.transact(companyId, tx => {
            const receipt = actor.userId + ':' + operation + ':' + (resourceId || '') + ':' + meta.key;
            const previous = tx.receipt(receipt, meta.hash);
            if (previous)
                return previous;
            const update = (collection: Collection, id: string, body: any) => { assert(match, 400, 'REVISION_REQUIRED'); assert(match === `"${body.revision}"`, 400, 'REVISION_MISMATCH'); const old = tx.read(collection, id); assert(old, 404, 'NOT_FOUND'); assert(old.revision === body.revision, 409, 'REVISION_CONFLICT'); return old; };
            let data: Row | Record<string, unknown>;
            if (operation === 'company.create') {
                assert(actor.role === 'PLATFORM_ADMIN', 403, 'FORBIDDEN');
                const b = companySchema.omit({ id: true, revision: true }).parse(input);
                assert(!tx.forCompany('*').query('companies').some(c => c.code === b.code), 409, 'COMPANY_CODE_EXISTS');
                data = { ...b, id: this.id(), revision: 1 };
                tx.forCompany('*').insert('companies', data as Row);
                const targetTx = tx.forCompany(String(data.id));
                targetTx.insert('drafts', { id: this.id(), companyId: String(data.id), revision: 1, schemaVersion: 1, scope: 'COMPANY', scopeKey: String(data.id), domain: 'COMPANY_PROFILE', stableKey: 'profile', parentVersionIds: [], overrides: [{ op: 'SET', path: [{ property: 'defaultLocale' }], value: b.defaultLocale }, { op: 'SET', path: [{ property: 'currency' }], value: b.currency }, { op: 'SET', path: [{ property: 'timezone' }], value: b.timezone }] });
            }
            else if (operation === 'company.update') {
                const b = z.object({ revision: z.number().int().positive(), name: z.string().min(1).optional(), defaultLocale: z.enum(['ko-KR', 'en-US']).optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional(), timezone: z.string().optional() }).strict().parse(input);
                const old = update('companies', companyId, b);
                companySchema.parse({ ...old, ...b });
                const profileKeys = ['defaultLocale', 'currency', 'timezone'] as const;
                const changed = profileKeys.filter(k => b[k] !== undefined && b[k] !== old[k]);
                if (changed.some(k => k === 'currency' || k === 'timezone'))
                    assert(!(['accounts', 'leads', 'opportunities', 'contracts', 'orders', 'sequences', 'approvals'] as Collection[]).some(c => tx.query(c).length > 0), 409, 'COMPANY_PROFILE_IN_USE');
                const createdDraftIds: string[] = [];
                if (changed.length) {
                    assert(!tx.query('drafts').some(d => d.domain === 'COMPANY_PROFILE'), 409, 'DRAFTS_PENDING');
                    const draftId = this.id();
                    tx.insert('drafts', { id: draftId, companyId, revision: 1, schemaVersion: 1, scope: 'COMPANY', scopeKey: companyId, domain: 'COMPANY_PROFILE', stableKey: 'profile', parentVersionIds: [], overrides: changed.map(k => ({ op: 'SET', path: [{ property: k }], value: b[k] })) });
                    createdDraftIds.push(draftId);
                }
                tx.compareAndSwap('companies', companyId, b.revision, { ...old, ...(b.name !== undefined ? { name: b.name } : {}) });
                const company = tx.read('companies', companyId)!;
                data = { id: company.id, company, revision: company.revision, createdDraftIds };
            }
            else if (operation === 'company.deactivate' || operation === 'company.reactivate') {
                const b = z.object({ revision: z.number().int().positive(), reason: z.string().min(1) }).strict().parse(input);
                const old = update('companies', companyId, b);
                const active = operation === 'company.reactivate';
                if (!active) {
                    const companies = tx.forCompany('*').query('companies');
                    const platformUsers = tx.forCompany('*').query('users').filter(u => u.active && u.platformAdmin);
                    if (tx.query('memberships').some(m => m.active && m.role === 'PLATFORM_ADMIN' && platformUsers.some(u => u.id === m.userId)))
                        assert(companies.filter(c => c.id !== companyId && c.active).some(c => tx.forCompany(c.id).query('memberships').some(m => m.active && m.role === 'PLATFORM_ADMIN' && platformUsers.some(u => u.id === m.userId))), 409, 'LAST_PLATFORM_ADMIN');
                    assert(!tx.query('approvals').some(r => !['APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED', 'COMPLETE'].includes(String(r.state || r.status))) && !tx.query('requests').some(r => !['SUCCESS', 'FAILED', 'REJECTED', 'CANCELLED', 'COMPLETE'].includes(String(r.state || r.status))) && !tx.query('releases').some(r => r.state === 'SCHEDULED' || r.status === 'SCHEDULED'), 409, 'COMPANY_IN_USE');
                    for (const m of tx.query('memberships'))
                        tx.compareAndSwap('memberships', m.id, m.revision, { ...m, permissionVersion: Number(m.permissionVersion) + 1 });
                }
                tx.compareAndSwap('companies', companyId, b.revision, { ...old, active });
                data = tx.read('companies', companyId)!;
            }
            else if (operation === 'template.preview') {
                const b = z.object({ templateCode: z.enum(['HQ', 'GLOBAL']), expectedRevision: z.number().int().positive() }).strict().parse(input);
                const company = tx.read('companies', companyId);
                assert(company, 404, 'NOT_FOUND');
                assert(company.revision === b.expectedRevision, 409, 'REVISION_CONFLICT');
                data = { id: this.id(), companyId, revision: 1, actor: actor.userId, templateCode: b.templateCode, companyRevision: company.revision, releaseId: company.activeReleaseId || null, draftRevisions: tx.query('drafts').map(d => ({ id: d.id, revision: d.revision })), expiresAt: this.now() + 600000, status: 'PREVIEW', diff: { from: company.templateCode, to: b.templateCode }, conflicts: [], parentVersionIds: company.parentVersionIds || [] };
                data.previewId = data.id;
                tx.insert('previews', data as Row);
            }
            else if (operation === 'template.apply') {
                const b = z.object({ previewId: uuid, revision: z.number().int().positive(), reason: z.string().min(1) }).strict().parse(input);
                const p = tx.read('previews', b.previewId), company = tx.read('companies', companyId);
                assert(p && p.actor === actor.userId, 404, 'NOT_FOUND');
                assert(match === `"${b.revision}"`, 400, 'REVISION_MISMATCH');
                assert(company && b.revision === company.revision && p.companyRevision === company.revision && p.releaseId === (company.activeReleaseId || null) && Number(p.expiresAt) > this.now() && canonical(p.draftRevisions) === canonical(tx.query('drafts').map(d => ({ id: d.id, revision: d.revision }))), 409, 'TEMPLATE_PREVIEW_STALE');
                assert(tx.query('drafts').length === 0, 409, 'DRAFTS_PENDING');
                data = { id: this.id(), companyId, revision: 1, schemaVersion: 1, scope: 'COMPANY', scopeKey: companyId, domain: 'COMPANY_PROFILE', stableKey: 'profile', parentVersionIds: [], overrides: [{ op: 'SET', path: [{ property: 'templateCode' }], value: p.templateCode }] };
                tx.insert('drafts', data as Row);
                data = { ...data, draftIds: [data.id] };
            }
            else if (operation === 'organization.create' || operation === 'organization.update') {
                const b = operation.endsWith('create') ? orgInput.parse(input) : orgInput.omit({ code: true }).partial().extend({ revision: z.number().int().positive() }).strict().parse(input);
                const old = resourceId ? update('organizations', resourceId, b) : null, id = old?.id || this.id();
                const row: Row = { ...old, ...b, id, companyId, revision: old?.revision || 1 };
                this.orgValid(tx, id, row);
                assert(!tx.query('organizations').some(o => o.id !== id && o.code === row.code), 409, 'ORGANIZATION_CODE_EXISTS');
                if (old)
                    tx.compareAndSwap('organizations', id, old.revision, row);
                else
                    tx.insert('organizations', row);
                data = tx.read('organizations', id)!;
            }
            else if (operation === 'user.create') {
                const b = userInput.parse(input);
                if (b.organizationId)
                    assert(tx.read('organizations', b.organizationId)?.active, 422, 'ORGANIZATION_INVALID');
                assert(!tx.query('users').some(u => u.homeCompanyId === companyId && u.loginId === b.loginId), 409, 'LOGIN_EXISTS');
                const id = this.id();
                data = { id, revision: 1, homeCompanyId: companyId, loginId: b.loginId, name: b.name, email: b.email, active: true };
                tx.insert('users', data as Row);
                tx.insert('memberships', { id: this.id(), companyId, userId: id, revision: 1, organizationId: b.organizationId, role: b.role, active: true, permissionVersion: 1 });
            }
            else if (operation === 'user.update') {
                const b = z.object({ revision: z.number().int().positive(), name: z.string().min(1).optional(), email: z.string().email().optional(), active: z.boolean().optional() }).strict().parse(input);
                const old = update('users', resourceId!, b);
                assert(tx.query('memberships').some(m => m.userId === old.id), 404, 'NOT_FOUND');
                assert(actor.role === 'PLATFORM_ADMIN' || !old.platformAdmin, 403, 'FORBIDDEN');
                const own = tx.query('memberships').find(m => m.userId === old.id)!;
                if (actor.role !== 'PLATFORM_ADMIN' && b.active !== undefined) {
                    if (!b.active)
                        this.protectLastAdmin(tx, old, own);
                    tx.compareAndSwap('memberships', own.id, own.revision, { ...own, active: b.active, permissionVersion: Number(own.permissionVersion) + 1 });
                }
                else if (b.active === false) {
                    this.protectLastAdmin(tx, old);
                    for (const c of tx.forCompany('*').query('companies')) {
                        const companyTx = tx.forCompany(c.id);
                        for (const m of companyTx.query('memberships').filter(m => m.userId === old.id))
                            companyTx.compareAndSwap('memberships', m.id, m.revision, { ...m, permissionVersion: Number(m.permissionVersion) + 1 });
                    }
                }
                const { active, ...otherChanges } = b;
                tx.compareAndSwap('users', old.id, b.revision, { ...old, ...otherChanges, ...(actor.role === 'PLATFORM_ADMIN' && active !== undefined ? { active } : {}) });
                data = tx.read('users', old.id)!;
            }
            else if (operation === 'membership.create') {
                assert(actor.role === 'PLATFORM_ADMIN', 403, 'FORBIDDEN');
                const b = z.object({ userId: uuid, organizationId: uuid.nullable(), role: z.enum(['SALES', 'MANAGER', 'COMPANY_ADMIN']) }).strict().parse(input);
                assert(tx.forCompany('*').read('users', b.userId)?.active, 422, 'USER_INACTIVE');
                assert(!tx.query('memberships').some(m => m.userId === b.userId), 409, 'MEMBERSHIP_EXISTS');
                if (b.organizationId)
                    assert(tx.read('organizations', b.organizationId)?.active, 422, 'ORGANIZATION_INVALID');
                data = { ...b, id: this.id(), companyId, revision: 1, permissionVersion: 1, active: true };
                tx.insert('memberships', data as Row);
            }
            else if (operation === 'membership.update') {
                const b = z.object({ revision: z.number().int().positive(), organizationId: uuid.nullable().optional(), active: z.boolean().optional() }).strict().parse(input);
                const old = update('memberships', resourceId!, b);
                if (b.organizationId)
                    assert(tx.read('organizations', b.organizationId)?.active, 422, 'ORGANIZATION_INVALID');
                if (b.active === false)
                    this.protectLastAdmin(tx, tx.read('users', String(old.userId))!, old);
                tx.compareAndSwap('memberships', old.id, b.revision, { ...old, ...b, permissionVersion: Number(old.permissionVersion) + 1 });
                data = tx.read('memberships', old.id)!;
            }
            else if (operation === 'transfer.preview') {
                const b = transferInput.parse(input);
                assert(b.source !== b.target, 422, 'TRANSFER_SAME_USER');
                const source = tx.read('memberships', b.source);
                assert(source, 422, 'SOURCE_INVALID');
                this.activeMember(tx, b.target);
                const items = b.entityTypes.flatMap(entity => tx.query(entity).filter(r => r.ownerMembershipId === b.source && (!b.recordIds || b.recordIds.includes(r.id))).map(r => ({ entity, id: r.id, revision: r.revision })));
                data = { ...b, id: this.id(), companyId, revision: 1, actor: actor.userId, expiresAt: this.now() + 600000, items, status: 'PREVIEW' };
                tx.insert('transfers', data as Row);
            }
            else if (operation === 'transfer.execute') {
                const b = z.object({ snapshotId: uuid, reason: z.string().min(1) }).strict().parse(input);
                const job = tx.read('transfers', b.snapshotId);
                assert(job && job.actor === actor.userId, 404, 'NOT_FOUND');
                if (job.status === 'COMPLETE')
                    data = job;
                else {
                    assert(Number(job.expiresAt) > this.now(), 409, 'TRANSFER_PREVIEW_EXPIRED');
                    this.activeMember(tx, String(job.target));
                    const results = (job.items as any[]).map(item => { const row = tx.read(item.entity, item.id); if (!row || row.revision !== item.revision || row.ownerMembershipId !== job.source)
                        return { ...item, status: 'CONFLICT' }; tx.compareAndSwap(item.entity, item.id, item.revision, { ...row, ownerMembershipId: job.target }); return { ...item, status: 'SUCCESS' }; });
                    tx.compareAndSwap('transfers', job.id, job.revision, { ...job, status: 'COMPLETE', reason: b.reason, results, successCount: results.filter(r => r.status === 'SUCCESS').length, conflictCount: results.filter(r => r.status === 'CONFLICT').length });
                    data = tx.read('transfers', job.id)!;
                }
            }
            else
                throw new Error('UNKNOWN_ORGANIZATION_OPERATION');
            tx.appendEvent({ id: meta.requestId, companyId, revision: 1, actor: actor.userId, action: operation, target: data.id });
            const result = { data, meta: { revision: data.revision, requestId: meta.requestId } };
            tx.receipt(receipt, meta.hash, result);
            return result;
        });
    }
}
