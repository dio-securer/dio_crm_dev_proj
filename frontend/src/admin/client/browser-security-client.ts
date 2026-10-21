import { ApprovalEngine,approvalRequest, MasterDataEngine, masterDataRequest, ConfigurationEngine, configurationRequest, SecurityEngine, OrganizationCommands, createDraft, updateDraft, assert, securityHash, canonical, normalizeCommandError } from '@dio-crm/contracts/admin';
import { HttpAdminClient } from './admin-client';
import { BrowserAdminRepository } from './browser-repository';
export class BrowserSecurityClient extends HttpAdminClient {
    readonly repo = new BrowserAdminRepository();
    readonly engine = new SecurityEngine(this.repo);
    sessionId = '';
    pendingId = '';
    constructor() { super('', () => ''); }
    async login(company: string, login: string) { const state = await this.repo.snapshot(), u = Object.values(state.collections.users).find(u => u.loginId === login && state.collections.companies[String(u.homeCompanyId)].code === company); assert(u?.active, 401, 'INVALID_CREDENTIALS'); return this.engine.login(u.id); }
    async request(path: string, method = 'GET', body?: any, key = crypto.randomUUID(), revision?: number): Promise<any> { return this.dispatch(path, method, body, key, revision).catch(normalizeCommandError); }
    private async dispatch(path: string, method = 'GET', body?: any, key = crypto.randomUUID(), revision?: number): Promise<any> {
        const url=new URL(path,'http://demo.invalid'),query=Object.fromEntries(url.searchParams);path=url.pathname;
        if (path.startsWith('/api/auth/mfa/')) {
            const action = path.split('/').pop();
            if (action === 'enroll')
                return this.engine.enroll(this.pendingId);
            if (action === 'verify')
                return this.engine.verify(this.pendingId, body, key);
            return this.engine.skip(this.pendingId, key);
        }
        if (path === '/api/me/company-context')
            return this.engine.switchCompany(this.sessionId, body.companyId);
        if (path === '/api/auth/logout')
            return this.engine.logout(this.sessionId);
        const a = await this.engine.authenticate(this.sessionId);
        const approval=await approvalRequest(new ApprovalEngine(this.repo),a,url.pathname+url.search,method,body,key,revision?`"${revision}"`:undefined);if(approval!==undefined)return approval;
        if(url.pathname.endsWith('/approval-fixtures')&&method==='POST')return new ApprovalEngine(this.repo).request(a,url.pathname.split('/')[4],'fixtures','',body,key);
        if(url.pathname.endsWith('/approval-simulations')&&method==='POST')return new ApprovalEngine(this.repo).request(a,url.pathname.split('/')[4],'simulation','',body,key);
        const master=await masterDataRequest(new MasterDataEngine(this.repo),a,url.pathname+url.search,method,body,key);if(master!==undefined)return master;
        const config = await configurationRequest(new ConfigurationEngine(this.repo), a, path, method, body, key); if (config !== undefined) return config;
        const snap = await this.repo.snapshot();
        if (path === '/api/me/context')
            return { executionMode: 'BROWSER_MOCK', companyCode: snap.collections.companies[a.companyId].code, adminContext: {releaseId:snap.collections.companies[a.companyId].activeReleaseId || 'A03_BASELINE',userId:a.userId,companyId:a.companyId,membershipId:a.membershipId,permissionVersion:a.permissionVersion}, memberships: Object.values(snap.collections.memberships).filter(m => m.userId === a.userId && m.active && snap.collections.companies[String(m.companyId)]?.active).map(m => ({ ...m, code: snap.collections.companies[String(m.companyId)].code })) };
        const meta = { id: crypto.randomUUID(), requestId: crypto.randomUUID(), key, hash: await securityHash(canonical({ path, method, body })) };
        if (path.startsWith('/api/admin/config/drafts')) {
            if (method === 'GET') {
                await this.engine.permission(a, a.companyId, 'config.read');
            }
            if (method === 'GET')
                return { items: Object.values(snap.collections.drafts || {}).filter(d => a.role === 'PLATFORM_ADMIN' || d.companyId === a.companyId) };
            const id = path.split('/')[5], domain = id ? snap.collections.drafts[id]?.domain : body.domain;
            if(!id)await this.engine.draftAccess(a, String(domain), body.overrides);
            const actor = { ...a, platformAdmin: a.role === 'PLATFORM_ADMIN', canConfigure: true };
            return id ? updateDraft(this.engine.authorizedRepository(a, a.companyId, 'config.edit', String(domain), body.overrides,id), actor, id, body, `"${revision}"`, meta) : createDraft(this.engine.authorizedRepository(a, a.companyId, 'config.edit', String(domain), body.overrides), actor, body, meta);
        }
        if (path === '/api/admin/mfa-reset-requests')
            return { items: await this.engine.globalRequests(a) };
        let parts = path.split('/').filter(Boolean), company = parts[3], resource = parts[4], id = parts[5], action = parts[6];
        if (parts[2] === 'identities')
            return this.engine.command(a, a.companyId, 'reset', company, body, key, `"${revision}"`);
        if (parts[2] === 'mfa-reset-requests')
            return this.engine.command(a, a.companyId, 'decide', company, body, key, `"${revision}"`);
        if (resource === 'field-registry' && method === 'GET') return this.engine.accountFieldRegistry(a, company);
        if (resource === 'runtime' && id === 'account-context') return this.engine.accountContext(a, company);
        if (resource === 'runtime' && id === 'accounts') {
            return method === 'GET' ? this.engine.accounts(a, company, action,query) : this.engine.saveAccount(a, company, action, body, key, `"${revision}"`);
        }
        if (['roles', 'delegations', 'sessions', 'mfa-reset-requests'].includes(resource)) {
            if (method === 'GET')
                return { items: await this.engine.list(a, company, resource === 'mfa-reset-requests' ? 'mfaResetRequests' : resource) };
            return this.engine.command(a, company, resource === 'roles' ? 'role' : resource === 'delegations' ? 'delegation' : 'revoke', id, body, key, revision ? `"${revision}"` : undefined);
        }
        if (action === 'roles')
            return this.engine.command(a, company, 'assign', id, body, key, `"${revision}"`);
        if (action === 'mfa-reset-requests')
            return this.engine.command(a, company, 'resetRequest', id, body, key);
        const commands = new OrganizationCommands(this.repo, () => crypto.randomUUID());
        if (method === 'GET') {
            await this.engine.permission(a, company || a.companyId, !resource ? 'company.read' : resource === 'organizations' ? 'organization.read' : resource === 'transfers' ? 'ownershipTransfer.manage' : 'user.read');
            return { items: await commands.list({ ...a, role: a.role === 'PLATFORM_ADMIN' ? 'PLATFORM_ADMIN' : 'COMPANY_ADMIN' }, company || a.companyId, (resource || 'companies') as any) };
        }
        const op = !company ? 'company.create' : !resource ? 'company.update' : resource === 'template-change' ? 'template.' + id : resource === 'deactivate' || resource === 'reactivate' ? 'company.' + resource : resource === 'ownership-transfers' ? 'transfer.' + (id === 'preview' ? 'preview' : 'execute') : ({ organizations: 'organization', users: 'user', memberships: 'membership' } as any)[resource] + (method === 'PATCH' ? '.update' : '.create');
        const permission = op.startsWith('company') || op.startsWith('template') ? 'company.manage' : op.startsWith('organization') ? 'organization.manage' : op.startsWith('user') ? 'user.manage' : op.startsWith('membership') ? 'membership.assign' : 'ownershipTransfer.manage';
        return new OrganizationCommands(this.engine.authorizedRepository(a, company || a.companyId, permission), () => crypto.randomUUID()).command({ ...a, role: a.role === 'PLATFORM_ADMIN' ? 'PLATFORM_ADMIN' : 'COMPANY_ADMIN' }, company || a.companyId, op, id, body, revision ? `"${revision}"` : undefined, meta);
    }
}
