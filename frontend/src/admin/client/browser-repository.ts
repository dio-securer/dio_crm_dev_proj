import { AdminRepository, Envelope, Transaction, seed, transaction, assert } from '@dio-crm/contracts/admin';
export class BrowserAdminRepository implements AdminRepository {
    readonly key = 'dio-crm:admin:v1:ADMIN_DEMO_V1';
    async snapshot(): Promise<Envelope> { const raw = localStorage.getItem(this.key); if (!raw)
        return seed(); const value = JSON.parse(raw) as Envelope; assert(value.schemaVersion === 1 && value.datasetId === 'ADMIN_DEMO_V1', 409, 'STORAGE_VERSION_UNSUPPORTED'); return value; }
    async transact<T>(companyId: string, run: (tx: Transaction) => Promise<T> | T): Promise<T> { assert(navigator.locks, 409, 'WEB_LOCKS_REQUIRED'); return navigator.locks.request(this.key, async () => { const next = await this.snapshot(); const result = await run(transaction(next, companyId)); next.revision++; localStorage.setItem(this.key, JSON.stringify(next)); return result; }); }
}
