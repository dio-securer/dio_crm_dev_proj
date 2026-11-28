import { AdminError, DraftActor, DraftInput, AdminRepository, createDraft, updateDraft, canonical, normalizeCommandError } from '@dio-crm/contracts/admin';
export interface AdminClient {
    listDrafts(): Promise<any[]>;
    createDraft(input: DraftInput, key?: string): Promise<any>;
    updateDraft(id: string, input: {
        revision: number;
        payload?: Record<string, unknown>;
        overrides?: DraftInput['overrides'];
    }, key?: string): Promise<any>;
}
export class HttpAdminClient implements AdminClient {
    constructor(private baseUrl: string, private token: () => string) { }
    async request(path: string, method = 'GET', body?: unknown, key?: string, revision?: number) { const response = await fetch(this.baseUrl + path, { method, headers: { Authorization: 'Bearer ' + this.token(), 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}), ...(revision ? { 'If-Match': `"${revision}"` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); const data = await response.json(); if (!response.ok)
        throw new AdminError(response.status, data.code, data.fieldErrors); return data; }
    async listDrafts() { return (await this.request('/api/admin/config/drafts')).items; }
    createDraft(input: DraftInput, key = crypto.randomUUID()) { return this.request('/api/admin/config/drafts', 'POST', input, key); }
    updateDraft(id: string, input: {
        revision: number;
        payload?: Record<string, unknown>;
        overrides?: DraftInput['overrides'];
    }, key = crypto.randomUUID()) { return this.request('/api/admin/config/drafts/' + id, 'PATCH', input, key, input.revision); }
}
export class BrowserMockAdminClient implements AdminClient {
    constructor(private repo: AdminRepository, private actor: DraftActor) { }
    async meta(method: string, path: string, body: unknown, key: string) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical({ method, path, body }))); return { key, hash: Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join(''), requestId: crypto.randomUUID(), id: crypto.randomUUID() }; }
    async listDrafts() { if (!this.actor.canConfigure)
        throw new AdminError(403, 'FORBIDDEN'); return this.repo.transact(this.actor.companyId, tx => tx.query('drafts')); }
    async createDraft(input: DraftInput, key = crypto.randomUUID()) { return createDraft(this.repo, this.actor, input, await this.meta('POST', '/api/admin/config/drafts', input, key)).catch(normalizeCommandError); }
    async updateDraft(id: string, input: {
        revision: number;
        payload?: Record<string, unknown>;
        overrides?: DraftInput['overrides'];
    }, key = crypto.randomUUID()) { return updateDraft(this.repo, this.actor, id, input, `"${input.revision}"`, await this.meta('PATCH', '/api/admin/config/drafts/' + id, input, key)).catch(normalizeCommandError); }
}
