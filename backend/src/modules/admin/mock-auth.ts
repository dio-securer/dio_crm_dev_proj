import { MemoryAdminRepository } from './memory.repository';
import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { assert, AdminError, COMPANY_IDS, Row, SecurityEngine } from '@dio-crm/contracts/admin';
export interface Identity {
    id: string;
    homeCompanyCode: string;
    loginId: string;
    passwordHash: string;
    active: boolean;
    memberships: {
        id: string;
        companyId: string;
        role: string;
        active: boolean;
        permissionVersion: number;
    }[];
}
export interface IdentityRepository {
    find(company: string | undefined, login: string): Promise<Identity[]>;
    get(id: string): Promise<Identity | undefined>;
}
export class MockIdentityRepository implements IdentityRepository {
    private readonly passwordHash = bcrypt.hashSync('DemoOnly!2026', 4);
    constructor(private readonly repo: MemoryAdminRepository) { }
    private async all(): Promise<Identity[]> { const state = await this.repo.snapshot(); return Object.values(state.collections.users).map(u => ({ id: u.id, homeCompanyCode: String(state.collections.companies[String(u.homeCompanyId)].code), loginId: String(u.loginId), passwordHash: this.passwordHash, active: !!u.active, memberships: Object.values(state.collections.memberships).filter(m => m.userId === u.id).map(m => ({ id: m.id, companyId: String(m.companyId), role: String(m.role), active: !!m.active && !!state.collections.companies[String(m.companyId)]?.active, permissionVersion: Number(m.permissionVersion) })) })); }
    async find(company: string | undefined, login: string) { return (await this.all()).filter(u => u.loginId === login && (!company || u.homeCompanyCode === company)); }
    async get(id: string) { return (await this.all()).find(u => u.id === id); }
}
@Injectable()
export class MockAuth {
    readonly jwt = new JwtService();
    readonly key: string;
    readonly engine: SecurityEngine;
    constructor(
    @Inject('ADMIN_IDENTITY_REPOSITORY')
    readonly identities: MockIdentityRepository,
readonly repo: MemoryAdminRepository) { this.key = process.env.CRM_MOCK_JWT_SECRET || ''; assert(this.key.length >= 32, 500, 'MOCK_KEY_REQUIRED'); assert(this.key !== process.env.JWT_ACCESS_SECRET && this.key !== process.env.JWT_REFRESH_SECRET, 500, 'MOCK_KEY_MUST_DIFFER'); this.engine = new SecurityEngine(repo, randomUUID); }
    private options(pending = false) { return { secret: this.key, issuer: 'dio-crm-api-mock', audience: pending ? 'dio-crm-api-mock-mfa' : 'dio-crm-api-mock' }; }
    async present(result: any) { if (result.state === 'AUTHENTICATED') {
        const accessToken = await this.jwt.signAsync({ sessionId: result.sessionId, tokenUse: 'ACCESS' }, { ...this.options(), expiresIn: '30m' });
        return { ...result, accessToken, context: { ...result.context, executionMode: 'API_MOCK' } };
    } return { ...result, pendingToken: await this.jwt.signAsync({ challengeId: result.pendingId, tokenUse: 'MFA_PENDING' }, { ...this.options(true), expiresIn: '5m' }) }; }
    async login(company: string | undefined, login: string, password: string) { const rows = await this.identities.find(company, login); assert(rows.length <= 1, 422, 'COMPANY_REQUIRED'); const user = rows[0]; if (!user?.active || !await bcrypt.compare(password, user.passwordHash)) {
        if (user)
            await this.engine.passwordFailure(user.id);
        throw new AdminError(401, 'INVALID_CREDENTIALS');
    } return this.present(await this.engine.login(user.id)); }
    async claims(header: string | undefined, pending = false) { assert(header?.startsWith('Bearer '), 401, 'AUTH_REQUIRED'); try {
        const c = await this.jwt.verifyAsync(header!.slice(7), this.options(pending));
        assert(c.tokenUse === (pending ? 'MFA_PENDING' : 'ACCESS'), 401, 'TOKEN_INVALID');
        return c;
    }
    catch (e) {
        if (!pending) {
            try {
                await this.jwt.verifyAsync(header!.slice(7), this.options(true));
                throw new AdminError(403, 'MFA_REQUIRED');
            }
            catch (p) {
                if (p instanceof AdminError && p.code === 'MFA_REQUIRED')
                    throw p;
            }
        }
        throw new AdminError(401, 'TOKEN_INVALID');
    } }
    async authenticate(header: string | undefined) { const c = await this.claims(header); return this.engine.authenticate(c.sessionId); }
    async switchCompany(header: string, companyId: string) { const c = await this.claims(header); return this.present(await this.engine.switchCompany(c.sessionId, companyId)); }
    async refresh(token: string) { return this.present(await this.engine.refresh(token)); }
}
