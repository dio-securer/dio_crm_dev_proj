import { MemoryAdminRepository } from './memory.repository';
import { COMPANY_IDS, companySchema, executionMode, canonical, AdminError, draftInputSchema, configDocumentSchema } from '@dio-crm/contracts/admin';
const company = COMPANY_IDS.US_A;
const row = { id: '20000000-0000-4000-8000-000000000001', companyId: company, revision: 1, name: 'before' };
describe('admin repository contract', () => {
    it('rejects malformed DTOs and unknown properties', () => { expect(companySchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false); expect(companySchema.safeParse({ id: company, code: 'A', name: 'A', countryCode: 'US', templateCode: 'GLOBAL', defaultLocale: 'en-US', currency: 'USD', timezone: 'Invalid', active: true, revision: 1 }).success).toBe(false); });
    it('rolls back data, events and receipts together', async () => { const repo = new MemoryAdminRepository(); await expect(repo.transact(company, tx => { tx.insert('accounts', row); tx.appendEvent(row); tx.receipt('x', 'hash', { ok: true }); throw new Error('fault'); })).rejects.toThrow('fault'); const s = await repo.snapshot(); expect(s.collections.accounts).toBeUndefined(); expect(s.events).toEqual([]); expect(s.receipts).toEqual({}); expect(s.revision).toBe(1); });
    it('allows exactly one concurrent update for the same revision', async () => { const repo = new MemoryAdminRepository(); await repo.transact(company, tx => tx.insert('accounts', row)); const results = await Promise.allSettled([1, 2].map(n => repo.transact(company, async (tx) => { const old = tx.read('accounts', row.id)!; await Promise.resolve(); tx.compareAndSwap('accounts', row.id, 1, { ...old, name: 'after' + n }); }))); expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(results.filter(r => r.status === 'rejected')).toHaveLength(1); expect((await repo.snapshot()).collections.accounts[row.id].revision).toBe(2); });
    it('does not read or update other company rows', async () => { const repo = new MemoryAdminRepository(); await repo.transact(company, tx => tx.insert('accounts', row)); await repo.transact(COMPANY_IDS.US_B, tx => { expect(tx.query('accounts')).toEqual([]); expect(tx.read('accounts', row.id)).toBeUndefined(); expect(() => tx.compareAndSwap('accounts', row.id, 1, row)).toThrow(AdminError); }); });
    it('preserves false and zero and rejects conflicting idempotency payloads', async () => { const repo = new MemoryAdminRepository(); await repo.transact(company, tx => { tx.insert('accounts', { ...row, enabled: false, amount: 0 }); tx.receipt('actor:save:key', 'h', { ok: true }); }); await repo.transact(company, tx => { expect(tx.receipt('actor:save:key', 'h')).toEqual({ ok: true }); expect(() => tx.receipt('actor:save:key', 'changed')).toThrow('IDEMPOTENCY_CONFLICT'); expect(tx.read('accounts', row.id)).toMatchObject({ enabled: false, amount: 0 }); }); });
    it('does not expose mutable references from snapshots', async () => { const repo = new MemoryAdminRepository(); const snap = await repo.snapshot(); snap.collections.companies[company].name = 'bad'; expect((await repo.snapshot()).collections.companies[company].name).toBe('US_A'); });
    it('uses deterministic seed and refuses mock in production', async () => { expect(await new MemoryAdminRepository().snapshot()).toEqual(await new MemoryAdminRepository().snapshot()); expect(() => executionMode('API_MOCK', true)).toThrow('MOCK_PRODUCTION_DISABLED'); expect(() => executionMode('typo', false)).toThrow('UNKNOWN_EXECUTION_MODE'); expect(executionMode(undefined, true)).toBe('LEGACY'); expect(canonical({ b: 0, a: false })).toBe(canonical({ a: false, b: 0 })); });
    it('keeps reads and idempotency replay revision-neutral', async () => {
        const repo = new MemoryAdminRepository();
        await repo.transact(company, tx => { tx.query('drafts'); tx.read('companies', company); });
        expect((await repo.snapshot()).revision).toBe(1);
        await repo.transact(company, tx => tx.receipt('key', 'hash', { success: true }));
        const before = await repo.snapshot();
        await repo.transact(company, tx => tx.receipt('key', 'hash', { success: true }));
        expect(await repo.snapshot()).toEqual(before);
    });
    it('isolates company rows even without a companyId field', async () => {
        const repo = new MemoryAdminRepository();
        await repo.transact(company, tx => {
            expect(tx.query('companies').map(row => row.id)).toEqual([company]);
            expect(tx.read('companies', COMPANY_IDS.US_B)).toBeUndefined();
            expect(() => tx.compareAndSwap('companies', COMPANY_IDS.US_B, 1, {id:COMPANY_IDS.US_B,revision:1})).toThrow('NOT_FOUND');
        });
    });
    it('rejects COMPANY_PROFILE outside COMPANY and conflicting override paths', () => {
        const base = {domain:'COMPANY_PROFILE',stableKey:'profile',schemaVersion:1,parentVersionIds:[],overrides:[]};
        for (const [scope,scopeKey] of [['TEMPLATE','GLOBAL'],['COUNTRY','GLOBAL:US']]) {
            expect(draftInputSchema.safeParse({...base,scope,scopeKey}).success).toBe(false);
            const {schemaVersion,...document}=base;
            expect(configDocumentSchema.safeParse({...document,id:row.id,revision:1,scope,scopeKey}).success).toBe(false);
        }
        expect(draftInputSchema.safeParse({...base,domain:'FEATURE',scope:'COMPANY',scopeKey:company,overrides:[{op:'SET',path:[{property:'items'}],value:[]},{op:'SET',path:[{property:'items'},{itemKey:'account'}],value:{}}]}).success).toBe(false);
    });
});
