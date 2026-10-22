import { AdminRepository, Envelope, Transaction, seed, canonical, transaction, assert } from '@dio-crm/contracts/admin';
export class BrowserAdminRepository implements AdminRepository {
    readonly key = 'dio-crm:admin:v1:ADMIN_DEMO_V1';
    async snapshot(): Promise<Envelope> {
        const raw = localStorage.getItem(this.key);
        if (!raw)
            return seed();
        const value = JSON.parse(raw) as Envelope;
        assert(value.schemaVersion === 1 && value.datasetId === 'ADMIN_DEMO_V1', 409, 'STORAGE_VERSION_UNSUPPORTED');
        const defaults = seed();
        for (const [collection, rows] of Object.entries(defaults.collections))
            value.collections[collection] ??= rows;
        return value;
    }
    async transact<T>(companyId: string, run: (tx: Transaction) => Promise<T> | T): Promise<T> { assert(navigator.locks, 409, 'WEB_LOCKS_REQUIRED'); return navigator.locks.request(this.key, async () => { const raw = localStorage.getItem(this.key); const next = await this.snapshot(); const before = raw ? canonical(JSON.parse(raw)) : canonical(next); const result = await run(transaction(next, companyId)); if (canonical(next) !== before) {
        if (raw && !JSON.parse(raw).collections.users && !localStorage.getItem(this.key + ':backup:a01'))
            localStorage.setItem(this.key + ':backup:a01', raw);
        next.revision++;
        localStorage.setItem(this.key, JSON.stringify(next));
    } return result; }); }
}
