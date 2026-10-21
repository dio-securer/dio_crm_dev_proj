import { z } from 'zod';
export const uuid = z.string().uuid();
export const domains = ['COMPANY_PROFILE', 'FEATURE', 'MENU', 'SCREEN', 'FIELD', 'RULE', 'TERM', 'CODE', 'LIST_VIEW', 'ACTION', 'WORKFLOW', 'APPROVAL', 'NOTIFICATION', 'NUMBERING', 'CALENDAR', 'INTEGRATION', 'SECURITY'] as const;
export const companySchema = z.object({ id: uuid, code: z.string().min(1).max(40), name: z.string().min(1).max(200), countryCode: z.string().length(2), templateCode: z.enum(['HQ', 'GLOBAL']), defaultLocale: z.enum(['ko-KR', 'en-US']), currency: z.string().regex(/^[A-Z]{3}$/), timezone: z.string().refine(v => { try {
        new Intl.DateTimeFormat('en', { timeZone: v });
        return true;
    }
    catch {
        return false;
    } }), active: z.boolean(), revision: z.number().int().positive() }).strict();
export type Company = z.infer<typeof companySchema>;
export const configSchema = z.object({ id: uuid, companyId: uuid, domain: z.enum(domains), stableKey: z.string().min(1), revision: z.number().int().positive(), payload: z.record(z.unknown()), parentVersionIds: z.array(uuid) }).strict();
export type Config = z.infer<typeof configSchema>;
export type Collection = 'companies' | 'organizations' | 'users' | 'memberships' | 'roles' | 'delegations' | 'drafts' | 'releases' | 'accounts' | 'approvals' | 'tasks' | 'notifications' | 'requests' | 'sequences' | 'transfers' | 'deputies';
export interface Row {
    id: string;
    companyId?: string;
    revision: number;
    [key: string]: unknown;
}
export interface Envelope {
    schemaVersion: 1;
    datasetId: string;
    revision: number;
    collections: Record<string, Record<string, Row>>;
    events: Row[];
    receipts: Record<string, {
        hash: string;
        response: unknown;
    }>;
}
export interface Transaction {
    read(collection: Collection, id: string): Row | undefined;
    query(collection: Collection): Row[];
    insert(collection: Collection, row: Row): void;
    compareAndSwap(collection: Collection, id: string, revision: number, row: Row): void;
    appendEvent(event: Row): void;
    receipt(key: string, hash: string, response?: unknown): unknown;
}
export interface AdminRepository {
    snapshot(): Promise<Envelope>;
    transact<T>(companyId: string, run: (tx: Transaction) => Promise<T> | T): Promise<T>;
}
export class AdminError extends Error {
    constructor(public status: number, public code: string, public fieldErrors: {
        path: string;
        code: string;
        messageKey: string;
    }[] = []) { super(code); }
    toJSON() { return { code: this.code, messageKey: `admin.${this.code}`, fieldErrors: this.fieldErrors }; }
}
export function assert(value: unknown, status: number, code: string): asserts value { if (!value)
    throw new AdminError(status, code); }
export function canonical(value: unknown): string { if (Array.isArray(value))
    return '[' + value.map(canonical).join(',') + ']'; if (value !== null && typeof value === 'object')
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k])).join(',') + '}'; return JSON.stringify(value); }
export function transaction(state: Envelope, companyId: string): Transaction {
    const rows = (c: Collection) => state.collections[c] ?? (state.collections[c] = {});
    const visible = (r: Row | undefined) => r && (!r.companyId || r.companyId === companyId);
    return { read: (c, id) => { const r = rows(c)[id]; return visible(r) ? structuredClone(r) : undefined; }, query: c => Object.values(rows(c)).filter(visible).map(r => structuredClone(r)), insert(c, r) { assert(!rows(c)[r.id], 409, 'ALREADY_EXISTS'); assert(!r.companyId || r.companyId === companyId, 404, 'NOT_FOUND'); rows(c)[r.id] = structuredClone(r); }, compareAndSwap(c, id, rev, row) { const old = rows(c)[id]; assert(visible(old), 404, 'NOT_FOUND'); assert(old.revision === rev, 409, 'REVISION_CONFLICT'); assert(row.id === id && row.companyId === old.companyId, 422, 'IDENTITY_IMMUTABLE'); rows(c)[id] = { ...structuredClone(row), revision: rev + 1 }; }, appendEvent(e) { state.events.push(structuredClone(e)); }, receipt(key, hash, response) { const k = companyId + ':' + key, old = state.receipts[k]; if (old) {
            assert(old.hash === hash, 409, 'IDEMPOTENCY_CONFLICT');
            return structuredClone(old.response);
        } if (response !== undefined)
            state.receipts[k] = { hash, response: structuredClone(response) }; return undefined; } };
}
export const COMPANY_IDS = { HQ_DEMO: '10000000-0000-4000-8000-000000000001', US_A: '10000000-0000-4000-8000-000000000002', US_B: '10000000-0000-4000-8000-000000000003', MX_A: '10000000-0000-4000-8000-000000000004' } as const;
export function seed(): Envelope { const state: Envelope = { schemaVersion: 1, datasetId: 'ADMIN_DEMO_V1', revision: 1, collections: { companies: {} }, events: [], receipts: {} }; Object.entries(COMPANY_IDS).forEach(([code, id]) => { state.collections.companies[id] = companySchema.parse({ id, code, name: code, countryCode: code === 'HQ_DEMO' ? 'KR' : code === 'MX_A' ? 'MX' : 'US', templateCode: code === 'HQ_DEMO' ? 'HQ' : 'GLOBAL', defaultLocale: code === 'HQ_DEMO' ? 'ko-KR' : 'en-US', currency: code === 'HQ_DEMO' ? 'KRW' : 'USD', timezone: code === 'HQ_DEMO' ? 'Asia/Seoul' : 'America/New_York', active: true, revision: 1 }); }); return state; }
export function executionMode(value: string | undefined, production: boolean) { const mode = value ?? 'LEGACY'; assert(['LEGACY', 'API_MOCK', 'BROWSER_MOCK'].includes(mode), 422, 'UNKNOWN_EXECUTION_MODE'); assert(!production || mode === 'LEGACY', 403, 'MOCK_PRODUCTION_DISABLED'); return mode; }
