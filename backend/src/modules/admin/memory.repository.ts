import { AdminRepository, Envelope, Transaction, seed, canonical, transaction } from '@dio-crm/contracts/admin';
export class MemoryAdminRepository implements AdminRepository {
    private state: Envelope;
    private tail: Promise<void> = Promise.resolve();
    constructor(initial = seed()) { this.state = structuredClone(initial); }
    async snapshot() { return structuredClone(this.state); }
    async transact<T>(companyId: string, run: (tx: Transaction) => Promise<T> | T): Promise<T> {
        let release!: () => void;
        const before = this.tail;
        this.tail = new Promise(r => release = r);
        await before;
        try {
            const next = structuredClone(this.state);
            const result = await run(transaction(next, companyId));
            if (canonical(next) !== canonical(this.state)) {
                next.revision++;
                this.state = next;
            }
            return structuredClone(result);
        }
        finally {
            release();
        }
    }
}
