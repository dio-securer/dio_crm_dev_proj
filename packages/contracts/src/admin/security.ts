import {normalizeOverrides} from './resolver';
import {masterBaseline} from './master-data';
import { activeAccountConfig, fieldDefinitions, runtimeFieldAccess, conditionFields, evaluateCondition, effectiveFields, validateValue, projectRuntimeAccount } from './account-runtime';
import { z } from 'zod';
import { DemoMfaProvider, MfaProvider, MfaChallenge } from './identity';
import { AdminRepository, Transaction, Row, assert, AdminError, canonical, domains } from './core';
import { SecurityActor, roleSchema, rolesFor, allowed, requirePermission, actorMembership, dataAllowed, fieldAccess, projectAccount, permissionCatalog, Role } from './permissions';
export async function securityHash(value: string) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join(''); }
const levels = ['OFF', 'OPTIONAL', 'REQUIRED'];
const revision = z.number().int().positive(), reason = z.string().trim().min(1).max(500);
export class SecurityEngine {
    constructor(readonly repo: AdminRepository, readonly id: () => string = () => crypto.randomUUID(), readonly now: () => number = () => Date.now(), readonly provider: MfaProvider = new DemoMfaProvider()) { assert(provider.name === 'DEMO', 422, 'MFA_PROVIDER_UNSUPPORTED'); }
    private put(tx: Transaction, c: any, row: Row, changes: Record<string, unknown>) { tx.compareAndSwap(c, row.id, row.revision, { ...row, ...changes }); return tx.read(c, row.id)!; }
    policy(tx: Transaction, m: Row) { const policies = tx.query('securityPolicies').filter(p => p.companyId === '*' || p.companyId === m.companyId); const roles = rolesFor(tx.forCompany(String(m.companyId)), m); const ranks = [0, ...policies.flatMap(p=>{const config=p.mfaPolicy as any;return [levels.indexOf(String(config?.default??p.policy)),...(config?.roleOverrides||[]).filter((r:any)=>roles.some(role=>role.code===r.roleCode)).map((r:any)=>levels.indexOf(r.policy))];}), ...roles.map(r => levels.indexOf(r.mfaPolicy))]; return { mode: levels[Math.max(...ranks)], version: canonical(policies.map(p => [p.id, p.revision, p.policy, p.mfaPolicy]).sort()) }; }
    private identity(tx: Transaction, userId: string, memberId: string) { const u = tx.read('users', userId), m = tx.read('memberships', memberId); assert(u?.active && m?.active && m.userId === userId && tx.read('companies', String(m.companyId))?.active, 401, 'SESSION_REVOKED'); return { u, m }; }
    private enrollment(tx: Transaction, user: string) { return tx.query('mfaEnrollments').find(e => e.userId === user && e.active); }
    private lock(tx: Transaction, user: string) { const a = tx.query('authAttempts').find(a => a.userId === user); assert(!a || Number(a.lockedUntil) <= this.now(), 429, 'AUTH_LOCKED'); }
    private async issue(tx: Transaction, m: Row, verifiedAt: number | null, maxUntil?: number) { const raw = this.id() + this.id(), id = this.id(), p = this.policy(tx, m); const s: Row = { id, companyId: m.companyId, revision: 1, userId: m.userId, membershipId: m.id, role: m.role, permissionVersion: m.permissionVersion, securityVersion: p.version, mfaVerifiedAt: verifiedAt, provider: verifiedAt ? 'DEMO' : null, createdAt: this.now(), lastSeenAt: this.now(), expiresAt: maxUntil || this.now() + 8 * 3600000, revoked: false, refreshHash: await securityHash(raw) }; tx.insert('sessions', s); return { state: 'AUTHENTICATED', sessionId: id, refreshToken: id + '.' + raw, context: { companyId: m.companyId, membershipId: m.id, userId: m.userId, role: m.role, permissionVersion: m.permissionVersion } }; }
    private challenge(tx: Transaction, u: Row, m: Row, sourceSessionId?: string) { const p = this.policy(tx, m), enrolled = !!this.enrollment(tx, u.id), id = this.id(); const c: Row = { id, revision: 1, companyId: m.companyId, userId: u.id, targetMembershipId: m.id, purpose: sourceSessionId ? 'COMPANY_SWITCH' : enrolled ? 'VERIFY' : 'ENROLL', expiresAt: this.now() + 300000, attemptCount: 0, consumedAt: null, securityVersion: p.version, identityRevision: u.revision, permissionVersion: m.permissionVersion, enrolled, sourceSessionId: sourceSessionId || null }; tx.insert('mfaChallenges', c); return { state: enrolled ? 'MFA_REQUIRED' : 'MFA_ENROLL_REQUIRED', pendingId: id, challengeId: id, expiresAt: c.expiresAt, canSkip: p.mode === 'OPTIONAL' && !enrolled, provider: 'DEMO' }; }
    async login(userId: string) { return this.repo.transact('*', async (tx) => { const u = tx.read('users', userId); assert(u?.active, 401, 'INVALID_CREDENTIALS'); this.lock(tx, userId); const attempt = tx.query('authAttempts').find(a => a.userId === userId); if (attempt)
        this.put(tx, 'authAttempts', attempt, { failures: 0, lockedUntil: 0 }); this.expireDelegations(tx); const m = tx.query('memberships').find(m => m.userId === userId && m.active && tx.read('companies', String(m.companyId))?.active); assert(m, 403, 'MEMBERSHIP_INACTIVE'); return this.policy(tx, m).mode === 'OFF' ? this.issue(tx, m, null) : this.challenge(tx, u, m); }); }
    async passwordFailure(userId: string) { const locked = await this.repo.transact('*', tx => { this.lock(tx, userId); const old = tx.query('authAttempts').find(x => x.userId === userId), count = Number(old?.failures || 0) + 1, changes = { failures: count, lockedUntil: count >= 5 ? this.now() + 900000 : 0 }; if (old)
        this.put(tx, 'authAttempts', old, changes);
    else
        tx.insert('authAttempts', { id: this.id(), companyId: '*', revision: 1, userId, ...changes }); return count >= 5; }); assert(!locked, 429, 'AUTH_LOCKED'); }
    private checkSession(tx: Transaction, id: string, allowMfa = false) { const s = tx.read('sessions', id); assert(s && !s.revoked && Number(s.expiresAt) > this.now() && Number(s.lastSeenAt) + 1800000 > this.now(), 401, 'SESSION_EXPIRED'); const { m } = this.identity(tx, String(s.userId), String(s.membershipId)); assert(m.permissionVersion === s.permissionVersion, 401, 'SESSION_REVOKED'); const p = this.policy(tx, m), needs = p.mode === 'REQUIRED' || (p.mode === 'OPTIONAL' && !!this.enrollment(tx, String(s.userId))); assert(allowMfa || !needs || (s.mfaVerifiedAt !== null && Number(s.mfaVerifiedAt) + 1800000 > this.now()), 403, 'MFA_REQUIRED'); this.expireDelegations(tx); assert(tx.read('memberships', m.id)?.permissionVersion === s.permissionVersion, 401, 'SESSION_REVOKED'); return { s, m, p }; }
    async authenticate(id: string) { const result = await this.repo.transact('*', tx => { this.expireDelegations(tx); try {
        const { s, p } = this.checkSession(tx, id);
        return this.put(tx, 'sessions', s, { lastSeenAt: this.now(), securityVersion: p.version });
    }
    catch (e) {
        if (e instanceof AdminError)
            return { failure: { status: e.status, code: e.code } };
        throw e;
    } }); if ('failure' in result)
        throw new AdminError((result.failure as any).status, (result.failure as any).code); return result as Row & SecurityActor; }
    async logout(id: string) { return this.repo.transact('*', tx => { const { s } = this.checkSession(tx, id, true); this.put(tx, 'sessions', s, { revoked: true }); return { success: true }; }); }
    async refresh(token: string) { const [id, raw] = token.split('.'), hash = await securityHash(raw || ''); return this.repo.transact('*', async (tx) => { const { s, m } = this.checkSession(tx, id); assert(s.refreshHash === hash, 401, 'REFRESH_INVALID'); this.put(tx, 'sessions', s, { revoked: true }); return this.issue(tx, m, s.mfaVerifiedAt as number | null, Number(s.expiresAt)); }); }
    async switchCompany(id: string, companyId: string) { return this.repo.transact('*', async (tx) => { const { s } = this.checkSession(tx, id, true), m = tx.query('memberships').find(m => m.userId === s.userId && m.companyId === companyId && m.active && tx.read('companies', companyId)?.active); assert(m, 403, 'MEMBERSHIP_REQUIRED'); const u = tx.read('users', String(s.userId))!, p = this.policy(tx, m); if (p.mode !== 'OFF' && (!s.mfaVerifiedAt || Number(s.mfaVerifiedAt) + 1800000 <= this.now()))
        return this.challenge(tx, u, m, id); this.put(tx, 'sessions', s, { revoked: true }); return this.issue(tx, m, s.mfaVerifiedAt as number | null); }); }
    private pending(tx: Transaction, id: string) { const c = tx.read('mfaChallenges', id); assert(c, 401, 'TOKEN_INVALID'); assert(c.expiresAt as number > this.now(), 401, 'MFA_EXPIRED'); assert(c.consumedAt === null, 409, 'MFA_ALREADY_USED'); this.lock(tx, String(c.userId)); const { u, m } = this.identity(tx, String(c.userId), String(c.targetMembershipId)); assert(u.revision === c.identityRevision && m.permissionVersion === c.permissionVersion && this.policy(tx, m).version === c.securityVersion, 401, 'MFA_STALE'); if (c.sourceSessionId)
        this.checkSession(tx, String(c.sourceSessionId), true); return { c, u, m }; }
    async enroll(id: string) { return this.repo.transact('*', tx => { const { c } = this.pending(tx, id); assert(!c.enrolled, 409, 'MFA_ALREADY_ENROLLED'); return { enrollmentId: c.id, challengeId: c.id, expiresAt: c.expiresAt, provider: 'DEMO', demoCode: '123456' }; }); }
    async verify(id: string, body: unknown, key: string) {
        const b = z.object({ challengeId: z.string().uuid(), demoCode: z.string() }).strict().parse(body);
        assert(key, 400, 'IDEMPOTENCY_REQUIRED');
        const hash = await securityHash(canonical(b));
        const result = await this.repo.transact('*', async (tx) => {
            const prior = tx.receipt('mfa:' + id + ':' + key, hash);
            if (prior) {
                const c = tx.read('mfaChallenges', id), r = prior as any;
                assert(c && !c.revoked && Number(c.expiresAt) > this.now(), 401, 'SESSION_REVOKED');
                if (!r.failure)
                    this.checkSession(tx, r.sessionId);
                return prior;
            }
            const { c, u, m } = this.pending(tx, id);
            assert(b.challengeId === id, 403, 'CHALLENGE_MISMATCH');
            if (!await this.provider.verify(c as unknown as MfaChallenge, b.demoCode)) {
                const count = Number(c.attemptCount) + 1;
                this.put(tx, 'mfaChallenges', c, { attemptCount: count, ...(count >= 5 ? { consumedAt: this.now() } : {}) });
                if (count >= 5) {
                    const old = tx.query('authAttempts').find(a => a.userId === u.id);
                    if (old)
                        this.put(tx, 'authAttempts', old, { lockedUntil: this.now() + 900000 });
                    else
                        tx.insert('authAttempts', { id: this.id(), companyId: '*', revision: 1, userId: u.id, lockedUntil: this.now() + 900000 });
                }
                const failure = { failure: { status: count >= 5 ? 429 : 401, code: count >= 5 ? 'AUTH_LOCKED' : 'MFA_INVALID' } };
                tx.receipt('mfa:' + id + ':' + key, hash, failure);
                return failure;
            }
            if (!this.enrollment(tx, u.id))
                tx.insert('mfaEnrollments', { id: this.id(), companyId: '*', revision: 1, userId: u.id, active: true, provider: 'DEMO' });
            this.put(tx, 'mfaChallenges', c, { consumedAt: this.now() });
            if (c.sourceSessionId) {
                const old = tx.read('sessions', String(c.sourceSessionId))!;
                this.put(tx, 'sessions', old, { revoked: true });
            }
            const response = await this.issue(tx, m, this.now());
            tx.receipt('mfa:' + id + ':' + key, hash, response);
            return response;
        });
        if ((result as any).failure)
            throw new AdminError((result as any).failure.status, (result as any).failure.code);
        return result;
    }
    async skip(id: string, key: string) { assert(key, 400, 'IDEMPOTENCY_REQUIRED'); return this.repo.transact('*', async (tx) => { const receipt = 'mfa-skip:' + id + ':' + key, prior = tx.receipt(receipt, 'skip') as any; if (prior) {
        this.checkSession(tx, prior.sessionId);
        return prior;
    } const { c, u, m } = this.pending(tx, id); assert(this.policy(tx, m).mode === 'OPTIONAL' && !this.enrollment(tx, u.id), 403, 'MFA_SKIP_FORBIDDEN'); this.put(tx, 'mfaChallenges', c, { consumedAt: this.now() }); if (c.sourceSessionId)
        this.put(tx, 'sessions', tx.read('sessions', String(c.sourceSessionId))!, { revoked: true }); const result = await this.issue(tx, m, null); tx.receipt(receipt, 'skip', result); return result; }); }
    private bump(tx: Transaction, company: string) { for (const m of tx.query('memberships').filter(m => m.companyId === company))
        this.put(tx, 'memberships', m, { permissionVersion: Number(m.permissionVersion) + 1 }); }
    private expireDelegations(tx: Transaction) { for (const d of tx.query('delegations').filter(d => d.active && Number(d.expiresAt) <= this.now())) {
        this.put(tx, 'delegations', d, { active: false });
        this.bump(tx, String(d.companyId));
    } }
    async permission(actor: SecurityActor, company: string, permission: string) { return this.repo.transact('*', tx => requirePermission(tx, actor, company, permission)); }
    private guard(tx: Transaction, a: SecurityActor, company: string, permission: string) { if (a.id)
        this.checkSession(tx, a.id); requirePermission(tx, a, company, permission); }
    authorizedRepository(a: SecurityActor, company: string, permission: string, domain?: string, overrides: any[] = [], draftId?:string): AdminRepository { return { snapshot: () => this.repo.snapshot(), transact: (scope, run) => this.repo.transact(scope, tx => { const global = tx.forCompany('*'); this.guard(global, a, company, permission); if (domain)
            {let changed=overrides;if(domain==='APPROVAL'&&draftId){const old=global.read('drafts',draftId);assert(old,404,'NOT_FOUND');const before=(old.overrides||[]) as any[],after=normalizeOverrides(before,overrides);changed=[...before.filter(o=>!after.some(n=>canonical(n)===canonical(o))),...after.filter(n=>!before.some(o=>canonical(n)===canonical(o)))];if(!changed.length){this.guard(global,a,a.companyId,'config.edit');return run(tx);}}this.checkDraft(global,a,domain,changed);} return run(tx); }) }; }
    async draftAccess(a: SecurityActor, domain: string, overrides: any[] = []) { return this.repo.transact('*', tx => this.checkDraft(tx, a, domain, overrides)); }
    checkDraft(tx: Transaction, a: SecurityActor, domain: string, overrides: any[] = []) { assert(Array.isArray(overrides), 422, 'VALIDATION_ERROR'); this.guard(tx, a, a.companyId, 'config.edit'); const masterPermission:Record<string,string>={INTEGRATION:'integration.manage',NOTIFICATION:'notification.manage',WORKFLOW:'workflow.manage',TERM:'translation.manage',CODE:'code.manage',NUMBERING:'numbering.manage',CALENDAR:'calendar.manage'};if(masterPermission[domain])this.guard(tx,a,a.companyId,masterPermission[domain]);if(domain==='APPROVAL'){if(!overrides.length||overrides.some(o=>o.path?.[0]?.property==='policies'))this.guard(tx,a,a.companyId,'approvalPolicy.manage');if(!overrides.length||overrides.some(o=>o.path?.[0]?.property==='routes'))this.guard(tx,a,a.companyId,'approvalRoute.manage');} if(domain==='SECURITY'){for(const op of overrides){assert(Array.isArray(op.path),422,'VALIDATION_ERROR');const path=op.path.map((p:any)=>p.property).join('.');assert(['idleTimeoutMinutes','maxSessionMinutes','maxFailedAttempts','lockMinutes','mfaPolicy.default','mfaPolicy.provider','mfaPolicy.roleOverrides'].includes(path),422,'SECURITY_PATH_INVALID');assert(op.op==='SET'||op.op==='RESET',422,'SECURITY_OPERATION_INVALID');if(op.op==='SET'){if(path==='mfaPolicy.default')z.enum(['OFF','OPTIONAL','REQUIRED']).parse(op.value);else if(path==='mfaPolicy.provider')z.literal('DEMO').parse(op.value);else if(path==='mfaPolicy.roleOverrides')z.array(z.object({roleCode:z.string().min(1),policy:z.enum(['OFF','OPTIONAL','REQUIRED'])}).strict()).parse(op.value);else z.number().int().positive().parse(op.value);}}} if (a.role === 'PLATFORM_ADMIN')
        return; const rows = tx.query('delegations').filter(d => d.companyId === a.companyId); if (!rows.length) {
        assert(domain !== 'SECURITY', 403, 'DELEGATION_REQUIRED');
        return;
    } assert(rows.some(d => d.active && Number(d.expiresAt) > this.now() && rolesFor(tx.forCompany(a.companyId), actorMembership(tx, a)).some(r => r.code === d.targetRole) && (d.domains as string[]).includes(domain) && (d.actions as string[]).includes('EDIT') && !overrides.some(o => (d.lockedPaths as string[] || []).some(lock => { const path = (o.path || []).map((p: any) => p.property || p.itemKey).join('.'); return path === lock || path.startsWith(lock + '.') || lock.startsWith(path + '.'); }))), 403, 'DELEGATION_FORBIDDEN'); }
    async list(a: SecurityActor, company: string, resource: string) { return this.repo.transact('*', tx => { this.guard(tx, a, company, resource === 'sessions' ? 'session.read' : resource === 'mfaResetRequests' ? 'user.mfaReset.request' : resource === 'delegations' ? 'delegation.manage' : 'role.read'); const rows = tx.query(resource as any).filter(r => r.companyId === company); if (resource === 'sessions')
        return rows.map(({ id, userId, membershipId, createdAt, expiresAt, revoked, revision }) => ({ id, userId, membershipId, createdAt, expiresAt, revoked, revision })); if (resource === 'mfaResetRequests')
        return rows.map(({ id, status, reason, revision, expiresAt }) => ({ id, status: status === 'PENDING' && Number(expiresAt) <= this.now() ? 'EXPIRED' : status, reason, revision, expiresAt })); return rows; }); }
    async command(a: SecurityActor, company: string, op: string, id: string | undefined, body: unknown, key: string, match?: string) {
        assert(key, 400, 'IDEMPOTENCY_REQUIRED');
        const hash = await securityHash(canonical({ op, id, body }));
        return this.repo.transact('*', tx => {
            const permissions: Record<string, string> = { role: 'role.manage', assign: 'role.assign', delegation: 'delegation.manage', revoke: 'session.revoke', resetRequest: 'user.mfaReset.request', reset: 'security.manage', decide: 'security.manage' };
            this.guard(tx, a, company, permissions[op]);
            const receipt = a.userId + ':security:' + company + ':' + key, prior = tx.receipt(receipt, hash);
            if (prior)
                return prior;
            let data: any;
            const check = (old: Row, b: any) => { assert(match === `"${b.revision}"`, 400, 'REVISION_MISMATCH'); assert(old.revision === b.revision, 409, 'REVISION_CONFLICT'); };
            if (op === 'role') {
                const b = z.object({ revision: revision.optional(), ...roleSchema.shape }).strict().parse(body);
                assert(!['PLATFORM_ADMIN', 'COMPANY_ADMIN'].includes(b.code), 403, 'PLATFORM_ROLE_RESERVED');
                const own = rolesFor(tx.forCompany(a.companyId), actorMembership(tx, a));
                this.grantCeiling(tx, a, own, [b]);
                for (const scope of b.dataScopes)
                    for (const org of scope.orgIds)
                        assert(tx.forCompany(company).read('organizations', org), 422, 'ORGANIZATION_INVALID');
                assert(new Set(b.fieldPermissions.map(f => f.field)).size === b.fieldPermissions.length, 422, 'DUPLICATE_FIELD');
                const existing = tx.query('roles').find(r => r.companyId === company && r.code === b.code && r.id !== id);
                assert(!existing, 409, 'ROLE_EXISTS');
                if (id) {
                    const old = tx.forCompany(company).read('roles', id);
                    assert(old, 404, 'NOT_FOUND');
                    check(old, b);
                    assert(old.code === b.code, 422, 'IDENTITY_IMMUTABLE');
                    data = this.put(tx, 'roles', old, b);
                }
                else {
                    data = { ...b, id: this.id(), companyId: company, revision: 1 };
                    tx.insert('roles', data);
                }
                this.bump(tx, company);
            }
            else if (op === 'assign') {
                const b = z.object({ revision, roleCodes: z.array(z.string()).min(1) }).strict().parse(body), m = tx.forCompany(company).read('memberships', id!);
                assert(m, 404, 'NOT_FOUND');
                check(m, b);
                if (['PLATFORM_ADMIN', 'COMPANY_ADMIN'].includes(String(m.role)))
                    assert(b.roleCodes.includes(String(m.role)), 409, 'ADMIN_ROLE_PROTECTED');
                assert(b.roleCodes.every(code => !['PLATFORM_ADMIN', 'COMPANY_ADMIN'].includes(code) || code === m.role), 403, 'GRANT_CEILING');
                for (const code of b.roleCodes)
                    assert(['SALES', 'MANAGER', 'COMPANY_ADMIN', 'PLATFORM_ADMIN'].includes(code) || tx.query('roles').some(r => r.companyId === company && r.code === code && r.active), 422, 'ROLE_INVALID');
                const own = rolesFor(tx.forCompany(a.companyId), actorMembership(tx, a)), assigned = rolesFor(tx.forCompany(company), { ...m, roleCodes: b.roleCodes });
                this.grantCeiling(tx, a, own, assigned, m);
                data = this.put(tx, 'memberships', m, { roleCodes: b.roleCodes, permissionVersion: Number(m.permissionVersion) + 1 });
            }
            else if (op === 'delegation') {
                assert(a.role === 'PLATFORM_ADMIN', 403, 'PLATFORM_REQUIRED');
                const b = z.object({ revision: revision.optional(), targetRole: z.string(), domains: z.array(z.enum(domains)).min(1), actions: z.array(z.literal('EDIT')).min(1), expiresAt: z.number().int(), active: z.boolean(), lockedPaths: z.array(z.string()).default([]) }).strict().parse(body);
                assert(!b.domains.includes('SECURITY') && b.expiresAt > this.now(), 403, 'DELEGATION_CEILING');
                if (id) {
                    const old = tx.forCompany(company).read('delegations', id);
                    assert(old, 404, 'NOT_FOUND');
                    check(old, b);
                    data = this.put(tx, 'delegations', old, b);
                }
                else {
                    data = { ...b, id: this.id(), companyId: company, revision: 1 };
                    tx.insert('delegations', data);
                }
                this.bump(tx, company);
            }
            else if (op === 'revoke') {
                const b = z.object({ revision: revision.optional(), reason }).strict().parse(body), s = tx.forCompany(company).read('sessions', id!);
                assert(s, 404, 'NOT_FOUND');
                data = this.put(tx, 'sessions', s, { revoked: true });
                data = { id: s.id, revoked: true };
            }
            else if (op === 'resetRequest') {
                const b = z.object({ reason }).strict().parse(body), u = tx.read('users', id!);
                assert(u && tx.query('memberships').some(m => m.userId === id && m.companyId === company && m.active), 404, 'NOT_FOUND');
                assert(!tx.query('mfaResetRequests').some(r => r.userId === id && r.status === 'PENDING' && Number(r.expiresAt) > this.now()), 409, 'RESET_REQUEST_EXISTS');
                data = { id: this.id(), companyId: company, revision: 1, userId: id, identityRevision: u.revision, status: 'PENDING', reason: b.reason, requestedBy: a.userId, expiresAt: this.now() + 86400000 };
                tx.insert('mfaResetRequests', data);
            }
            else if (op === 'reset' || op === 'decide') {
                assert(a.role === 'PLATFORM_ADMIN' && tx.read('users', a.userId)?.platformAdmin, 403, 'GLOBAL_RESET_FORBIDDEN');
                const b = z.object({ revision, reason, decision: z.enum(['APPROVE', 'REJECT']).optional() }).strict().parse(body);
                let userId = id!;
                if (op === 'decide') {
                    const r = tx.read('mfaResetRequests', id!);
                    assert(r, 404, 'NOT_FOUND');
                    check(r, b);
                    assert(r.status === 'PENDING', 409, 'RESET_REQUEST_FINALIZED');
                    assert(Number(r.expiresAt) > this.now(), 409, 'RESET_REQUEST_EXPIRED');
                    const u = tx.read('users', String(r.userId));
                    assert(u?.revision === r.identityRevision, 409, 'RESET_REQUEST_STALE');
                    assert(b.decision, 422, 'DECISION_REQUIRED');
                    userId = String(r.userId);
                    data = this.put(tx, 'mfaResetRequests', r, { status: b.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', decidedBy: a.userId, decisionReason: b.reason });
                }
                else {
                    const u = tx.read('users', userId);
                    assert(u, 404, 'NOT_FOUND');
                    check(u, b);
                }
                if (op === 'reset' || b.decision === 'APPROVE') {
                    this.reset(tx, userId);
                    data = data || { id: userId, reset: true };
                }
            }
            else
                throw new AdminError(501, 'MOCK_CAPABILITY_UNAVAILABLE');
            tx.appendEvent({ id: this.id(), companyId: company, revision: 1, action: 'SECURITY_' + op, actor: a.userId, target: id || data.id, reason: (body as any).reason || null, requestCompanyId: op === 'decide' ? tx.read('mfaResetRequests', id!)?.companyId : company, affectedMemberships: op === 'reset' || op === 'decide' ? tx.query('memberships').filter(m => m.userId === (data.userId || id)).length : undefined });
            const response = { data, meta: { revision: data.revision, requestId: this.id() } };
            tx.receipt(receipt, hash, response);
            return response;
        });
    }
    private grantCeiling(tx: Transaction, a: SecurityActor, own: Role[], assigned: Role[], target?: Row) {
        const definitions:Record<string,any>={...fieldDefinitions(activeAccountConfig(tx,a.companyId).config),ownerMembershipId:{type:'text'}};
        for(const role of assigned)for(const f of role.fieldPermissions){assert(f.field in definitions,422,'FIELD_UNKNOWN');assert(f.maskType!=='LAST4'||definitions[f.field].type==='text',422,'MASK_TYPE_INVALID');}
        // Administrative assignment authority does not imply personal business-record visibility.
        if (a.role === 'PLATFORM_ADMIN' || a.role === 'COMPANY_ADMIN') {
            assert(assigned.every(r=>r.grants.every(p=>allowed(own,p)||p.startsWith('account.'))),403,'GRANT_CEILING');return;
        }
        assert(assigned.every(r => r.grants.every(p => allowed(own, p))), 403, 'GRANT_CEILING');
        for (const field of new Set([...Object.keys(definitions),...own.flatMap(r=>r.fieldPermissions.map(f=>f.field)),...assigned.flatMap(r=>r.fieldPermissions.map(f=>f.field))])) {
            const before = fieldAccess(own, field), after = fieldAccess(assigned, field);
            assert((!after.read || before.read) && (!after.write || before.write) && (!after.read || before.mask !== 'LAST4' || after.mask === 'LAST4'), 403, 'FIELD_CEILING');
        }
        const actor = actorMembership(tx, a), local = tx.forCompany(a.companyId);
        for (const scope of assigned.flatMap(r => r.dataScopes))
            assert(own.flatMap(r => r.dataScopes).some(upper => {
                if (upper.entity !== scope.entity || !scope.actions.every(action => upper.actions.includes(action)))
                    return false;
                if (upper.scope === 'COMPANY')
                    return true;
                if (upper.scope !== scope.scope)
                    return false;
                if (scope.scope === 'SELF')
                    return !target || target.id === a.membershipId;
                if (scope.scope === 'SHARED')
                    return scope.sharedRecordIds.every(id => upper.sharedRecordIds.includes(id));
                if (!target && scope.orgIds.length === 0 && upper.orgIds.length > 0)
                    return false;
                const roots = upper.orgIds.length ? upper.orgIds : [String(actor.organizationId)], targets = scope.orgIds.length ? scope.orgIds : [String((target || actor).organizationId)];
                return targets.every(id => { const seen = new Set<string>(); while (id && !seen.has(id)) {
                    if (roots.includes(id))
                        return true;
                    if (upper.scope !== 'SUBTREE')
                        return false;
                    seen.add(id);
                    id = String(local.read('organizations', id)?.parentId || '');
                } return false; });
            }), 403, 'SCOPE_CEILING');
    }
    private reset(tx: Transaction, user: string) { const u = tx.read('users', user)!; this.put(tx, 'users', u, {}); for (const c of ['sessions', 'mfaChallenges', 'mfaEnrollments'] as const)
        for (const r of tx.query(c).filter(r => r.userId === user))
            this.put(tx, c, r, c === 'sessions' ? { revoked: true } : c === 'mfaEnrollments' ? { active: false } : { revoked: true, consumedAt: this.now(), expiresAt: 0 }); }
    async globalRequests(a: SecurityActor) { return this.repo.transact('*', tx => { this.guard(tx, a, a.companyId, 'security.manage'); assert(a.role === 'PLATFORM_ADMIN', 403, 'GLOBAL_RESET_FORBIDDEN'); return tx.query('mfaResetRequests').map(r => ({ ...r, status: r.status === 'PENDING' && Number(r.expiresAt) <= this.now() ? 'EXPIRED' : r.status, affectedMemberships: tx.query('memberships').filter(m => m.userId === r.userId).map(m => ({ id: m.id, companyId: m.companyId, active: m.active })) })); }); }
    async accountFieldRegistry(a: SecurityActor, company: string) { return this.repo.transact('*',tx=>{this.guard(tx,a,company,'role.read');return {items:Object.entries({...fieldDefinitions(activeAccountConfig(tx,company).config),ownerMembershipId:{type:'text'}} as Record<string,any>).map(([key,def])=>({key,type:def.type,active:def.active!==false}))};}); }
    async accountContext(a: SecurityActor, company: string) { return this.repo.transact('*', tx => {
        this.guard(tx,a,company,'account.read'); assert(company===a.companyId,404,'NOT_FOUND');
        const {config,releaseId}=activeAccountConfig(tx,company),roles=rolesFor(tx.forCompany(company),actorMembership(tx,a));
        const fields=config['FIELD:account'].fields.filter((f:any)=>runtimeFieldAccess(roles,f.key,company).read).map((f:any)=>{const p=runtimeFieldAccess(roles,f.key,company),safe={...f,...p,createWrite:runtimeFieldAccess(roles,f.key,company,'create').write};if(p.mask!=='NONE'||!f.visible)delete safe.default;return safe;});
        const readable=new Set(fields.map((f:any)=>f.key)),plain=new Set(fields.filter((f:any)=>f.mask==='NONE').map((f:any)=>f.key));
        const safeCondition=(n:any)=>conditionFields(n).every(k=>plain.has(k)||['context.companyId','actor.roleCodes','document.state'].includes(k));
        return {canRequestErp:allowed(roles,'account.requestErp'),releaseId,companyId:company,roleCodes:roles.map(r=>r.code),screen:config['SCREEN:account'],fields,extensions:config['FIELD:account'].extensionDefinitions.filter((x:any)=>readable.has(x.key)).map((x:any)=>x.key==='x_priority'?{...x,enumValues:(config['CODE:codes']||masterBaseline()['CODE:codes']).groups.find((g:any)=>g.key==='priority').values.filter((v:any)=>v.active).map((v:any)=>v.code)}:x),rules:config['RULE:account'].rules.filter((r:any)=>safeCondition(r.condition)).map((r:any)=>({...r,effects:r.effects.filter((e:any)=>readable.has(e.target)||e.target.startsWith('account.'))})),views:config['LIST_VIEW:account'].views.map((v:any)=>({key:v.key,labelKey:v.labelKey,columns:v.columns.filter((k:string)=>fields.some((f:any)=>f.key===k&&f.visible)&&config['FIELD:account'].extensionDefinitions.find((x:any)=>x.key===k)?.active!==false)})),menus:config['MENU:account'].nodes.filter((n:any)=>allowed(roles,n.permission)&&config['FEATURE:platform'].items.some((f:any)=>f.key===n.featureKey&&f.enabled)),actions:config['ACTION:account'].actions.filter((x:any)=>allowed(roles,x.permission)&&safeCondition(x.condition)),featureEnabled:config['FEATURE:platform'].items.some((f:any)=>f.key==='account'&&f.enabled)};
    }); }
    async accounts(a: SecurityActor, company: string, id?: string, query: Record<string, string> = {}) { return this.repo.transact('*', tx => {
        this.guard(tx,a,company,'account.read'); assert(company===a.companyId,404,'NOT_FOUND');
        const {config,releaseId}=activeAccountConfig(tx,company);assert(config['FEATURE:platform'].items.some((f:any)=>f.key==='account'&&f.enabled),403,'FEATURE_DISABLED');
        const local=tx.forCompany(company),m=actorMembership(tx,a),roles=rolesFor(local,m),defs=fieldDefinitions(config);
        const canQuery=(field:string)=>{assert(field in defs,422,'FIELD_UNKNOWN');const p=runtimeFieldAccess(roles,field,company);assert(p.read&&p.mask==='NONE'&&defs[field].visible&&defs[field].active!==false,403,p.mask==='LAST4'?'MASKED_FIELD_QUERY_DENIED':'FIELD_QUERY_DENIED');assert(defs[field].searchable!==false,422,'FIELD_NOT_SEARCHABLE');};
        for(const key of Object.keys(query)){assert(['field','value','sort','filter','aggregate','view','page'].includes(key),422,'QUERY_INVALID');if(['field','sort','filter','aggregate'].includes(key))canQuery(query[key]);}assert(!query.aggregate,501,'AGGREGATION_NOT_IMPLEMENTED');
        let rows=local.query('accounts').filter(r=>dataAllowed(local,m,roles,r,'read'));
        if(id){const row=rows.find(r=>r.id===id);assert(row,404,'NOT_FOUND');return {...projectRuntimeAccount(config,roles,row),releaseId};}
        const view=config['LIST_VIEW:account'].views.find((v:any)=>v.key===(query.view||'default'));assert(view,422,'VIEW_UNKNOWN');
        for(const key of conditionFields(view.filter))if(!['context.companyId','actor.roleCodes','document.state'].includes(key))canQuery(key);for(const s of view.sort)canQuery(s.field);
        rows=rows.filter(r=>evaluateCondition(view.filter,{...r,'context.companyId':company,'actor.roleCodes':roles.map(r=>r.code),'document.state':'DRAFT'},defs));const filter=query.field||query.filter;if(filter)rows=rows.filter(r=>String(r[filter]??'').includes(query.value||''));
        const sorts=query.sort?[{field:query.sort,direction:'ASC'}]:view.sort;rows.sort((a,b)=>{for(const s of sorts){const av=a[s.field],bv=b[s.field];let c=0;if(av==null||bv==null){c=av==null&&bv==null?0:av==null?1:-1;}else{c=evaluateCondition({op:'eq',field:s.field,value:bv},{[s.field]:av},defs)?0:evaluateCondition({op:'gt',field:s.field,value:bv},{[s.field]:av},defs)?1:-1;}if(c)return c*(s.direction==='DESC'?-1:1);}return a.id.localeCompare(b.id);});
        const page=Number(query.page||1);assert(Number.isInteger(page)&&page>0,422,'PAGE_INVALID');return {items:rows.slice((page-1)*view.pageSize,page*view.pageSize).map(r=>projectRuntimeAccount(config,roles,r)),total:rows.length,page,pageSize:view.pageSize,releaseId};
    }); }
    async saveAccount(a: SecurityActor, company: string, id: string | undefined, body: unknown, key: string, match?: string) {
        const b=z.object({revision:revision.optional(),releaseId:z.string().min(1),values:z.record(z.unknown()),fieldReplacements:z.array(z.object({field:z.string(),value:z.unknown()}).strict()).default([])}).strict().parse(body);assert(key,400,'IDEMPOTENCY_REQUIRED');const hash=await securityHash(canonical({id,body}));
        return this.repo.transact('*',tx=>{this.guard(tx,a,company,id?'account.update':'account.create');assert(company===a.companyId,404,'NOT_FOUND');const {config,releaseId}=activeAccountConfig(tx,company);assert(config['FEATURE:platform'].items.some((f:any)=>f.key==='account'&&f.enabled),403,'FEATURE_DISABLED');
        const receipt='account:'+a.userId+':'+company+':'+key,prior=tx.receipt(receipt,hash);if(prior)return prior;assert(b.releaseId===releaseId,409,'CONFIG_CHANGED');
        const local=tx.forCompany(company),m=actorMembership(tx,a),roles=rolesFor(local,m),old=id?local.read('accounts',id):undefined;if(id){assert(old&&dataAllowed(local,m,roles,old,'update'),404,'NOT_FOUND');assert(match===`"${b.revision}"`&&old.revision===b.revision,409,'REVISION_CONFLICT');}
        const values={...b.values};for(const f of b.fieldReplacements){assert(!(f.field in values),422,'DUPLICATE_FIELD_WRITE');values[f.field]=f.value;}
        const defs=fieldDefinitions(config),merged:Record<string,any>={...old};for(const f of config['FIELD:account'].fields)if(merged[f.key]===undefined&&f.default!==undefined)merged[f.key]=structuredClone(f.default);Object.assign(merged,values);
        const context={...merged,'context.companyId':company,'actor.roleCodes':roles.map(r=>r.code),'document.state':'DRAFT'};
        const action=config['ACTION:account'].actions.find((x:any)=>x.key===(id?'account.update':'account.create'));assert(action?.enabled&&evaluateCondition(action.condition,context,defs),403,'ACTION_DISABLED');
        for(const r of config['RULE:account'].rules)if(r.trigger==='ACTION'&&evaluateCondition(r.condition,context,defs))assert(!r.effects.some((e:any)=>e.target===action.key&&e.actionEnabled===false),403,'ACTION_DISABLED');
        const fields=effectiveFields(config,context);
        for(const [field,value]of Object.entries(values)){const def=defs[field],f=fields.find((x:any)=>x.key===field);assert(def&&f&&field!=='ownerMembershipId',422,'FIELD_UNKNOWN');const p=runtimeFieldAccess(roles,field,company,id?'update':'create');assert(p.read&&p.write&&f.visible,403,'FIELD_WRITE_DENIED');assert(!f.readOnly,422,'FIELD_READ_ONLY');assert(def.active!==false,422,'EXTENSION_INACTIVE');if(field in b.values)assert(p.mask!=='LAST4',422,'MASKED_FIELD_REPLACEMENT_REQUIRED');validateValue(def,value);}
        for(const f of fields)if(f.required&&defs[f.key].active!==false)assert(merged[f.key]!==undefined&&merged[f.key]!==null&&merged[f.key]!=='',422,f.key==='name'?'NAME_REQUIRED':'FIELD_REQUIRED');
        if(!old||merged.x_priority!==old.x_priority){const codes=(config['CODE:codes']||masterBaseline()['CODE:codes']).groups.find((g:any)=>g.key==='priority').values;assert(codes.some((v:any)=>v.code===merged.x_priority&&v.active),422,'CODE_INACTIVE');}
        assert(typeof merged.name==='string'&&merged.name.trim().length>0,422,'NAME_REQUIRED');
        let row:Row;if(old)row=this.put(tx,'accounts',old,values);else{row={...merged,id:this.id(),companyId:company,revision:1,ownerMembershipId:m.id};assert(dataAllowed(local,m,roles,row,'create'),403,'DATA_SCOPE_DENIED');tx.insert('accounts',row);}
        const response={data:{...projectRuntimeAccount(config,roles,row),releaseId}};tx.appendEvent({id:this.id(),companyId:company,revision:1,action:id?'ACCOUNT_UPDATED':'ACCOUNT_CREATED',actor:a.userId,target:row.id});tx.receipt(receipt,hash,response);return response;});
    }

}
