import { MemoryAdminRepository } from './memory.repository';
import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { assert, AdminError, COMPANY_IDS, Row } from '@dio-crm/contracts/admin';
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
export interface Session {
    id: string;
    userId: string;
    membershipId: string;
    companyId: string;
    role: string;
    permissionVersion: number;
    expiresAt: number;
    revoked: boolean;
    refreshHash: string;
}
export interface IdentityRepository {
    find(company: string | undefined, login: string): Promise<Identity[]>;
    get(id: string): Promise<Identity | undefined>;
}
export interface SessionRepository {
    get(id: string): Session | undefined;
    put(session: Session): void;
    revoke(id: string): void;
}
export class MockIdentityRepository implements IdentityRepository {
    private readonly passwordHash = bcrypt.hashSync('DemoOnly!2026', 4);
    constructor(private readonly repo: MemoryAdminRepository) { }
    private async all(): Promise<Identity[]> { const state = await this.repo.snapshot(); return Object.values(state.collections.users).map(u => ({ id: u.id, homeCompanyCode: String(state.collections.companies[String(u.homeCompanyId)].code), loginId: String(u.loginId), passwordHash: this.passwordHash, active: !!u.active, memberships: Object.values(state.collections.memberships).filter(m => m.userId === u.id).map(m => ({ id: m.id, companyId: String(m.companyId), role: String(m.role), active: !!m.active && !!state.collections.companies[String(m.companyId)]?.active, permissionVersion: Number(m.permissionVersion) })) })); }
    async find(company: string | undefined, login: string) { return (await this.all()).filter(u => u.loginId === login && (!company || u.homeCompanyCode === company)); }
    async get(id: string) { return (await this.all()).find(u => u.id === id); }
}
export class MemorySessionRepository implements SessionRepository {
    rows = new Map<string, Session>();
    get(id: string) { return this.rows.get(id); }
    put(s: Session) { this.rows.set(s.id, s); }
    revoke(id: string) { const s = this.rows.get(id); if (s)
        s.revoked = true; }
}
@Injectable()
export class MockAuth {
    readonly jwt = new JwtService();
    readonly key: string;
    constructor(
    @Inject('ADMIN_IDENTITY_REPOSITORY')
    readonly identities: MockIdentityRepository, 
    @Inject('ADMIN_SESSION_REPOSITORY')
    readonly sessions: MemorySessionRepository) { this.key = process.env.CRM_MOCK_JWT_SECRET || ''; assert(this.key.length >= 32, 500, 'MOCK_KEY_REQUIRED'); assert(this.key !== process.env.JWT_ACCESS_SECRET && this.key !== process.env.JWT_REFRESH_SECRET, 500, 'MOCK_KEY_MUST_DIFFER'); }
    private options() { return { secret: this.key, issuer: 'dio-crm-api-mock', audience: 'dio-crm-api-mock' }; }
    async login(company: string | undefined, login: string, password: string) { const rows = await this.identities.find(company, login); assert(rows.length <= 1, 422, 'COMPANY_REQUIRED'); const user = rows[0]; assert(user && user.active && await bcrypt.compare(password, user.passwordHash), 401, 'INVALID_CREDENTIALS'); const membership = user.memberships.find(m => m.active); assert(membership, 403, 'MEMBERSHIP_INACTIVE'); return this.issue(user, membership.id); }
    async issue(user: Identity, membershipId: string) { const m = user.memberships.find(m => m.id === membershipId); assert(m && m.active, 403, 'MEMBERSHIP_INACTIVE'); const id = randomUUID(), refreshToken = randomBytes(32).toString('hex'); const s: Session = { id, userId: user.id, membershipId: m.id, companyId: m.companyId, role: m.role, permissionVersion: m.permissionVersion, expiresAt: Date.now() + 8 * 3600000, revoked: false, refreshHash: createHash('sha256').update(refreshToken).digest('hex') }; this.sessions.put(s); const accessToken = await this.jwt.signAsync({ sub: user.id, sessionId: id, tokenUse: 'ACCESS' }, { ...this.options(), expiresIn: '30m' }); return { state: 'AUTHENTICATED', accessToken, refreshToken: id + '.' + refreshToken, context: { companyId: s.companyId, membershipId: s.membershipId, permissionVersion: s.permissionVersion, role: s.role, executionMode: 'API_MOCK' } }; }
    async authenticate(header: string | undefined) { assert(header && header.startsWith('Bearer '), 401, 'AUTH_REQUIRED'); let claims: any; try {
        claims = await this.jwt.verifyAsync(header.slice(7), this.options());
    }
    catch {
        throw new AdminError(401, 'TOKEN_INVALID');
    } assert(claims.tokenUse === 'ACCESS', 403, 'MFA_REQUIRED'); const s = this.sessions.get(claims.sessionId); assert(s && !s.revoked && s.expiresAt > Date.now(), 401, 'SESSION_EXPIRED'); const u = await this.identities.get(s.userId), m = u?.memberships.find(m => m.id === s.membershipId); assert(u?.active && m?.active && m.permissionVersion === s.permissionVersion, 401, 'SESSION_REVOKED'); return s; }
    async switchCompany(header: string, companyId: string) { const current = await this.authenticate(header), user = await this.identities.get(current.userId); const membership = user?.memberships.find(m => m.companyId === companyId && m.active); assert(user && membership, 403, 'MEMBERSHIP_REQUIRED'); assert(!this.sessions.get(current.id)?.revoked, 401, 'SESSION_REVOKED'); this.sessions.revoke(current.id); return this.issue(user, membership.id); }
    async refresh(token: string) { const [id, raw] = token.split('.'), s = this.sessions.get(id); assert(s && !s.revoked && s.expiresAt > Date.now() && s.refreshHash === createHash('sha256').update(raw || '').digest('hex'), 401, 'REFRESH_INVALID'); const user = await this.identities.get(s.userId), m = user?.memberships.find(m => m.id === s.membershipId); assert(user?.active && m?.active && m.permissionVersion === s.permissionVersion, 401, 'SESSION_REVOKED'); assert(!this.sessions.get(id)?.revoked, 401, 'REFRESH_INVALID'); this.sessions.revoke(id); return this.issue(user, m.id); }
}
