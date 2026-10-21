import { Module, Controller, Post, Get, Patch, Body, Headers, Param, Req, Query } from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { assert, canonical, createDraft, updateDraft, OrganizationCommands } from '@dio-crm/contracts/admin';
import { MemoryAdminRepository } from './memory.repository';
import { MockAuth, MockIdentityRepository } from './mock-auth';
@Controller('api')
class MockController {
    constructor(private readonly auth: MockAuth, private readonly repo: MemoryAdminRepository) { }
    @Post('auth/login')
    login(
    @Body()
    body: unknown) { const b = z.object({ homeCompanyCode: z.string().optional(), loginId: z.string(), password: z.string() }).strict().parse(body); return this.auth.login(b.homeCompanyCode, b.loginId, b.password); }
    @Post('auth/refresh')
    refresh(
    @Body()
    body: unknown) { return this.auth.refresh(z.object({ refreshToken: z.string() }).strict().parse(body).refreshToken); }
    @Post('auth/logout')
    async logout(
    @Headers('authorization')
    header: string) { const s = await this.auth.authenticate(header); return this.auth.engine.logout(s.id); }
    @Get('me/context')
    async context(
    @Headers('authorization')
    header: string) { const s = await this.auth.authenticate(header); const identity = await this.auth.identities.get(s.userId); const snap = await this.repo.snapshot(); return { executionMode: 'API_MOCK', companyCode: snap.collections.companies[s.companyId].code, memberships: identity!.memberships.filter(m => m.active).map(m => ({ id: m.id, companyId: m.companyId, code: snap.collections.companies[m.companyId].code })), adminContext: { userId: s.userId, companyId: s.companyId, membershipId: s.membershipId, permissionVersion: s.permissionVersion } }; }
    @Post('me/company-context')
    switchCompany(
    @Headers('authorization')
    header: string,
    @Body()
    body: unknown) { const b = z.object({ companyId: z.string().uuid() }).strict().parse(body); return this.auth.switchCompany(header, b.companyId); }
    @Get('admin/companies')
    async companies(
    @Headers('authorization')
    header: string) { const s = await this.auth.authenticate(header); await this.auth.engine.permission(s, s.companyId, 'company.read'); const items = await new OrganizationCommands(this.repo, randomUUID).list(s, s.companyId, 'companies'); return { items, total: items.length, page: 1, pageSize: 20, requestId: randomUUID() }; }
    @Post('admin/companies')
    async createCompany(
    @Headers('authorization')
    h: string,
    @Headers('idempotency-key')
    key: string,
    @Body()
    body: unknown) { const s = await this.auth.authenticate(h); return this.orgCommand(s, s.companyId, 'company.create', undefined, body, undefined, key); }
    @Patch('admin/companies/:company')
    async patchCompany(
    @Headers('authorization')
    h: string,
    @Headers('idempotency-key')
    key: string,
    @Headers('if-match')
    match: string,
    @Param('company')
    company: string,
    @Body()
    body: unknown) { const s = await this.auth.authenticate(h); return this.orgCommand(s, company, 'company.update', undefined, body, match, key); }
    @Get('admin/companies/:company/:resource')
    async orgList(
    @Headers('authorization')
    h: string,
    @Param('company')
    company: string,
    @Param('resource')
    resource: string) { const s = await this.auth.authenticate(h); if (['roles', 'delegations', 'sessions', 'mfa-reset-requests'].includes(resource))
        return { items: await this.auth.engine.list(s, company, resource === 'mfa-reset-requests' ? 'mfaResetRequests' : resource) }; await this.auth.engine.permission(s, company, resource === 'organizations' ? 'organization.read' : resource === 'transfers' ? 'ownershipTransfer.manage' : 'user.read'); const name = z.enum(['organizations', 'users', 'memberships', 'transfers']).parse(resource); const items = await new OrganizationCommands(this.repo, randomUUID).list({ ...s, role: s.role === 'PLATFORM_ADMIN' ? 'PLATFORM_ADMIN' : 'COMPANY_ADMIN' }, company, name); return { items, total: items.length, page: 1, pageSize: 20, requestId: randomUUID() }; }
    @Post('admin/companies/:company/:resource')
    async orgCreate(
    @Headers('authorization')
    h: string,
    @Headers('idempotency-key')
    key: string,
    @Headers('if-match')
    match: string,
    @Param('company')
    company: string,
    @Param('resource')
    resource: string,
    @Body()
    body: unknown) { const s = await this.auth.authenticate(h); if (['roles', 'delegations'].includes(resource))
        return this.auth.engine.command(s, company, resource === 'roles' ? 'role' : 'delegation', undefined, body, key, match); const op: Record<string, string> = { organizations: 'organization.create', users: 'user.create', memberships: 'membership.create', 'ownership-transfers': 'transfer.execute', deactivate: 'company.deactivate', reactivate: 'company.reactivate' }; assert(op[resource], 501, 'MOCK_CAPABILITY_UNAVAILABLE'); return this.orgCommand(s, company, op[resource], undefined, body, match, key); }
    @Patch('admin/companies/:company/:resource/:id')
    async orgUpdate(
    @Headers('authorization')
    h: string,
    @Headers('idempotency-key')
    key: string,
    @Headers('if-match')
    match: string,
    @Param('company')
    company: string,
    @Param('resource')
    resource: string,
    @Param('id')
    id: string,
    @Body()
    body: unknown) { const s = await this.auth.authenticate(h); if (['roles', 'delegations'].includes(resource))
        return this.auth.engine.command(s, company, resource === 'roles' ? 'role' : 'delegation', id, body, key, match); const op: Record<string, string> = { organizations: 'organization.update', users: 'user.update', memberships: 'membership.update' }; assert(op[resource], 501, 'MOCK_CAPABILITY_UNAVAILABLE'); return this.orgCommand(s, company, op[resource], id, body, match, key); }
    @Post('admin/companies/:company/ownership-transfers/preview')
    async previewTransfer(
    @Headers('authorization')
    h: string,
    @Headers('idempotency-key')
    key: string,
    @Param('company')
    company: string,
    @Body()
    body: unknown) { const s = await this.auth.authenticate(h); return this.orgCommand(s, company, 'transfer.preview', undefined, body, undefined, key); }
    @Post('admin/companies/:company/template-change/:action')
    async template(
    @Headers('authorization')
    h: string,
    @Headers('idempotency-key')
    key: string,
    @Headers('if-match')
    match: string,
    @Param('company')
    company: string,
    @Param('action')
    action: string,
    @Body()
    body: unknown) { const s = await this.auth.authenticate(h); assert(['preview', 'apply'].includes(action), 501, 'MOCK_CAPABILITY_UNAVAILABLE'); return this.orgCommand(s, company, 'template.' + action, undefined, body, match, key); }
    private async orgCommand(s: any, company: string, op: string, id: string | undefined, body: unknown, match: string | undefined, key: string) { const permission = op.startsWith('company.') || op.startsWith('template.') ? 'company.manage' : op.startsWith('organization.') ? 'organization.manage' : op.startsWith('user.') ? 'user.manage' : op.startsWith('membership.') ? 'membership.assign' : 'ownershipTransfer.manage'; return new OrganizationCommands(this.auth.engine.authorizedRepository(s, company, permission), randomUUID).command({ ...s, role: s.role === 'PLATFORM_ADMIN' ? 'PLATFORM_ADMIN' : 'COMPANY_ADMIN' }, company, op, id, body, match, this.meta(op, company + '/' + (id || ''), body, key)); }
    @Get('admin/config/drafts')
    async drafts(
    @Headers('authorization')
    header: string) { const actor = await this.auth.authenticate(header); await this.auth.engine.permission(actor, actor.companyId, 'config.read'); const items = await this.repo.transact(actor.companyId, tx => tx.query('drafts')); return { items, total: items.length, page: 1, pageSize: 20, requestId: randomUUID() }; }
    @Post('admin/config/drafts')
    async create(
    @Headers('authorization')
    header: string,
    @Headers('idempotency-key')
    key: string,
    @Body()
    body: unknown) { const s = await this.auth.authenticate(header); await this.auth.engine.draftAccess(s, String((body as any).domain), (body as any).overrides); return createDraft(this.auth.engine.authorizedRepository(s, s.companyId, 'config.edit', String((body as any).domain), (body as any).overrides), this.actor(s), body, this.meta('POST', '/api/admin/config/drafts', body, key)); }
    @Patch('admin/config/drafts/:id')
    async update(
    @Headers('authorization')
    header: string,
    @Headers('if-match')
    match: string,
    @Headers('idempotency-key')
    key: string,
    @Param('id')
    id: string,
    @Body()
    body: unknown) { const s = await this.auth.authenticate(header); const old = (await this.repo.snapshot()).collections.drafts?.[id]; assert(old && old.companyId === s.companyId, 404, 'NOT_FOUND'); await this.auth.engine.draftAccess(s, String(old.domain), (body as any).overrides); return updateDraft(this.auth.engine.authorizedRepository(s, s.companyId, 'config.edit', String(old.domain), (body as any).overrides), this.actor(s), id, body, match, this.meta('PATCH', '/api/admin/config/drafts/' + id, body, key)); }
    @Post('auth/mfa/:action')
    async mfa(
    @Headers('authorization')
    h: string,
    @Headers('idempotency-key')
    key: string,
    @Param('action')
    action: string,
    @Body()
    body: unknown) { const c = await this.auth.claims(h, true); if (action === 'enroll')
        return this.auth.engine.enroll(c.challengeId); if (action === 'verify')
        return this.auth.present(await this.auth.engine.verify(c.challengeId, body, key)); if (action === 'skip')
        return this.auth.present(await this.auth.engine.skip(c.challengeId, key)); assert(false, 404, 'NOT_FOUND'); }
    @Get('admin/companies/:company/runtime/accounts')
    async accounts(
    @Headers('authorization')
    h: string,
    @Param('company')
    company: string,
    @Query()
    query: Record<string, string>) { return this.auth.engine.accounts(await this.auth.authenticate(h), company, undefined, query); }
    @Get('admin/companies/:company/runtime/accounts/:id')
    async account(
    @Headers('authorization')
    h: string,
    @Param('company')
    company: string,
    @Param('id')
    id: string,
    @Query()
    query: Record<string, string>) { return this.auth.engine.accounts(await this.auth.authenticate(h), company, id, query); }
    @Post('admin/companies/:company/runtime/accounts')
    async createAccount(
    @Headers('authorization')
    h: string,
    @Headers('idempotency-key')
    key: string,
    @Param('company')
    company: string,
    @Body()
    body: unknown) { return this.auth.engine.saveAccount(await this.auth.authenticate(h), company, undefined, body, key); }
    @Patch('admin/companies/:company/runtime/accounts/:id')
    async patchAccount(
    @Headers('authorization')
    h: string,
    @Headers('idempotency-key')
    key: string,
    @Headers('if-match')
    match: string,
    @Param('company')
    company: string,
    @Param('id')
    id: string,
    @Body()
    body: unknown) { return this.auth.engine.saveAccount(await this.auth.authenticate(h), company, id, body, key, match); }
    @Post('admin/companies/:company/memberships/:id/roles')
    async assign(
    @Headers('authorization')
    h: string,
    @Headers('idempotency-key')
    key: string,
    @Headers('if-match')
    match: string,
    @Param('company')
    company: string,
    @Param('id')
    id: string,
    @Body()
    body: unknown) { return this.auth.engine.command(await this.auth.authenticate(h), company, 'assign', id, body, key, match); }
    @Post('admin/companies/:company/sessions/:id/revoke')
    async revoke(
    @Headers('authorization')
    h: string,
    @Headers('idempotency-key')
    key: string,
    @Headers('if-match')
    match: string,
    @Param('company')
    company: string,
    @Param('id')
    id: string,
    @Body()
    body: unknown) { return this.auth.engine.command(await this.auth.authenticate(h), company, 'revoke', id, body, key, match); }
    @Post('admin/companies/:company/users/:id/mfa-reset-requests')
    async resetRequest(
    @Headers('authorization')
    h: string,
    @Headers('idempotency-key')
    key: string,
    @Param('company')
    company: string,
    @Param('id')
    id: string,
    @Body()
    body: unknown) { return this.auth.engine.command(await this.auth.authenticate(h), company, 'resetRequest', id, body, key); }
    @Post('admin/identities/:id/mfa-reset')
    async reset(
    @Headers('authorization')
    h: string,
    @Headers('idempotency-key')
    key: string,
    @Headers('if-match')
    match: string,
    @Param('id')
    id: string,
    @Body()
    body: unknown) { const s = await this.auth.authenticate(h); return this.auth.engine.command(s, s.companyId, 'reset', id, body, key, match); }
    @Get('admin/mfa-reset-requests')
    async requests(
    @Headers('authorization')
    h: string) { return { items: await this.auth.engine.globalRequests(await this.auth.authenticate(h)) }; }
    @Post('admin/mfa-reset-requests/:id/decide')
    async decide(
    @Headers('authorization')
    h: string,
    @Headers('idempotency-key')
    key: string,
    @Headers('if-match')
    match: string,
    @Param('id')
    id: string,
    @Body()
    body: unknown) { const s = await this.auth.authenticate(h); return this.auth.engine.command(s, s.companyId, 'decide', id, body, key, match); }
    private actor(s: any) { return { userId: s.userId, companyId: s.companyId, platformAdmin: s.role === 'PLATFORM_ADMIN', canConfigure: true }; }
    private meta(method: string, path: string, body: unknown, key: string) { return { key, hash: createHash('sha256').update(canonical({ method, path, body })).digest('hex'), id: randomUUID(), requestId: randomUUID() }; }
}
@Module({ controllers: [MockController], providers: [MockAuth, { provide: 'ADMIN_IDENTITY_REPOSITORY', useFactory: (repo: MemoryAdminRepository) => new MockIdentityRepository(repo), inject: [MemoryAdminRepository] }, { provide: MemoryAdminRepository, useFactory: () => new MemoryAdminRepository() }] })
export class MockAppModule {
}
