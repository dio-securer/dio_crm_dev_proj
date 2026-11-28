import { z } from 'zod';
import { uuid } from './core';
export const membershipSchema = z.object({ id: uuid, companyId: uuid, userId: uuid, organizationId: uuid.nullable(), active: z.boolean(), permissionVersion: z.number().int().positive(), revision: z.number().int().positive() }).strict();
export const identitySchema = z.object({ id: uuid, homeCompanyId: uuid, loginId: z.string().min(1), displayName: z.string().min(1), active: z.boolean(), revision: z.number().int().positive() }).strict();
export type Membership = z.infer<typeof membershipSchema>;
export type IdentitySummary = z.infer<typeof identitySchema>;
export interface IdentityRepositoryPort {
    findByHomeCompanyAndLogin(homeCompanyId: string | undefined, loginId: string): Promise<IdentitySummary[]>;
    findById(id: string): Promise<IdentitySummary | undefined>;
    listMemberships(userId: string): Promise<Membership[]>;
    readMembership(id: string): Promise<Membership | undefined>;
    updateIdentity(id: string, revision: number, changes: Partial<Pick<IdentitySummary, 'displayName' | 'active'>>): Promise<IdentitySummary>;
    updateMembership(id: string, revision: number, changes: Partial<Pick<Membership, 'organizationId' | 'active'>>): Promise<Membership>;
}
export interface AuthSession {
    id: string;
    userId: string;
    membershipId: string;
    companyId: string;
    tokenUse: 'ACCESS';
    permissionVersion: number;
    securityVersion: number;
    mfaVerifiedAt: string | null;
    provider: 'DEMO' | null;
    expiresAt: string;
    revokedAt: string | null;
}
export interface MfaChallenge {
    id: string;
    userId: string;
    targetMembershipId: string;
    purpose: 'ENROLL' | 'VERIFY' | 'COMPANY_SWITCH';
    expiresAt: string;
    attemptCount: number;
    consumedAt: string | null;
    securityVersion: number;
}
export interface SessionRepositoryPort {
    create(session: AuthSession): Promise<void>;
    readActive(id: string, at: string): Promise<AuthSession | undefined>;
    rotateRefresh(id: string, expectedHash: string, nextHash: string): Promise<boolean>;
    revoke(id: string, at: string): Promise<void>;
    revokeForIdentity(userId: string, at: string): Promise<void>;
    revokeForMembership(membershipId: string, at: string): Promise<void>;
    consumeMfaChallenge(id: string, at: string, securityVersion: number): Promise<MfaChallenge>;
}
export interface MfaProvider {
    readonly name: 'DEMO';
    verify(challenge: MfaChallenge, response: string): Promise<boolean>;
}
export class DemoMfaProvider implements MfaProvider {
    readonly name = 'DEMO' as const;
    async verify(_challenge: MfaChallenge, response: string) { return response === '123456'; }
}
