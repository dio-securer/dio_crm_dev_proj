import {upgradeApprovalConfig,validateApprovalConfig} from './approval-config';
import {upgradeMasterConfig,validateMasterConfig} from './master-data';
import { accountBaseline, upgradeAccountConfig, validateAccountConfig, conditionFields, activeAccountConfig } from './account-runtime';
import { z } from 'zod';
import { AdminRepository, Row, Transaction, assert, canonical, COMPANY_IDS } from './core';
import { SecurityActor, requirePermission, rolesFor, actorMembership, fieldAccess } from './permissions';
import { SecurityEngine, securityHash } from './security';
import { DraftInput, draftInputSchema } from './drafts';
import { normalizeOverrides, resolveOverrides, validateResolved, Path } from './resolver';
const scopes = ['COMMON', 'TEMPLATE', 'COUNTRY', 'COMPANY'] as const;
const scopeSchema = z.enum(scopes), id = z.string().uuid(), reason = z.string().trim().min(1).max(500);
const refs = z.object({ draftIds: z.array(id).min(1), revisions: z.array(z.number().int().positive()).min(1) });
const validateInput = refs.extend({ expectedVersionId: id.nullable().optional(), expectedReleaseId: id.nullable().optional() }).strict();
const publishInput = z.object({ validationId: id, expectedVersionId: id.nullable().optional(), expectedReleaseId: id.nullable().optional(), reason }).strict();
const locks: Record<string, Path[]> = { 'FIELD:account': [[{ property: 'fields' }, { itemKey: 'taxId' }]] };
const baseline = accountBaseline();
const documentKey = (d: any) => `${d.domain}:${d.stableKey}`;
export class ConfigurationEngine {
    constructor(private repo: AdminRepository, private makeId: () => string = () => crypto.randomUUID(), private now = () => Date.now()) {}
    private event(tx: Transaction, actor: SecurityActor, action: string, target: string, why?: string) { tx.appendEvent({ id: this.makeId(), companyId: actor.companyId, revision: 1, actor: actor.userId, action, target, reason: why || '', at: this.now() }); }
    async initialize(tx: Transaction) {
        const add = async (scope: string, scopeKey: string, parents: string[]) => {
            const existing = tx.read('configScopes', `${scope}:${scopeKey}`); if (existing) return String(existing.currentVersionId);
            if (parents.length) { const immediate = tx.read('scopeVersions', parents[parents.length - 1])!; parents = [...immediate.parentVersionIds as string[], immediate.id]; }
            const versionId = this.makeId(); let inherited = parents.length ? tx.read('scopeVersions', parents[parents.length - 1])!.effective : baseline;
            if (scope === 'TEMPLATE' && scopeKey === 'HQ') { const hq=accountBaseline('HQ'); inherited={...structuredClone(inherited as any),'SCREEN:account':hq['SCREEN:account'],'FIELD:account':hq['FIELD:account']}; }
            const documents = scope === 'COMMON' ? Object.entries(baseline).map(([key, payload]) => ({ scope, scopeKey, domain: key.split(':')[0], stableKey: key.split(':')[1], schemaVersion: 1, parentVersionIds: [], payload })) : [];
            tx.insert('scopeVersions', { id: versionId, revision: 1, scope, scopeKey, parentVersionIds: parents, documentVersionIds: [], documents, effective: inherited, provenance: {}, contentHash: await securityHash(canonical(inherited)), createdAt: new Date(this.now()).toISOString(), createdBy: '00000000-0000-4000-8000-000000000000' });
            tx.insert('configScopes', { id: `${scope}:${scopeKey}`, revision: 1, scope, scopeKey, currentVersionId: versionId }); return versionId;
        };
        const common = await add('COMMON', 'COMMON', []);
        const templates: Record<string, string> = {}; const countries: Record<string, string> = {};
        for (const c of tx.query('companies')) {
            const template = String(c.templateCode), country = `${template}:${c.countryCode}`;
            templates[template] ||= await add('TEMPLATE', template, [common]);
            countries[country] ||= await add('COUNTRY', country, [common, templates[template]]);
            if (!tx.read('configScopes', `COMPANY:${c.id}`)) { const countryVersion = tx.read('scopeVersions', countries[country])!; tx.insert('configScopes', { id: `COMPANY:${c.id}`, revision: 1, scope: 'COMPANY', scopeKey: c.id, profileBaseline: { defaultLocale: c.defaultLocale, currency: c.currency, timezone: c.timezone, templateCode: c.templateCode }, parentVersionIds: [...countryVersion.parentVersionIds as string[], countryVersion.id] }); }
        }
    }
    private access(tx: Transaction, a: SecurityActor, scope: string, key: string, permission: string) {
        scopeSchema.parse(scope); const company = scope === 'COMPANY' ? key : a.companyId;
        requirePermission(tx, a, company, permission);
        if (scope !== 'COMPANY') assert(a.role === 'PLATFORM_ADMIN', 403, 'SCOPE_FORBIDDEN');
        if (scope === 'COMPANY') assert(tx.read('companies', key)?.active, 404, 'NOT_FOUND');
        else assert(tx.read('configScopes', `${scope}:${key}`), 404, 'NOT_FOUND');
    }
    private current(tx: Transaction, scope: string, key: string): string | null { return String(scope === 'COMPANY' ? tx.read('companies', key)?.activeReleaseId || '' : tx.read('configScopes', `${scope}:${key}`)?.currentVersionId || '') || null; }
    private snapshot(tx: Transaction, scope: string, key: string): any { const current = this.current(tx, scope, key); return current ? tx.read(scope === 'COMPANY' ? 'releases' : 'scopeVersions', current) : undefined; }
    private parents(tx: Transaction, scope: string, key: string): string[] {
        const old = this.snapshot(tx, scope, key); if (old) return old.parentVersionIds as string[];
        const c = tx.read('companies', key)!; const pin = tx.read('configScopes', `COMPANY:${key}`); if (pin) return pin.parentVersionIds as string[]; const country = tx.read('configScopes', `COUNTRY:${c.templateCode}:${c.countryCode}`); assert(country, 409, 'PARENT_VERSION_REQUIRED');
        const v = tx.read('scopeVersions', String(country.currentVersionId))!; return [...v.parentVersionIds as string[], v.id];
    }
    private checkParents(tx: Transaction, scope: string, key: string, parents: string[]) {
        assert(parents.length === scopes.indexOf(scope as any), 409, 'STALE_BASE');
        let template = ''; let country = '';
        if (scope === 'COMPANY') { const c = tx.read('companies', key)!; template = String(c.templateCode); country = `${template}:${c.countryCode}`; }
        else if (scope === 'COUNTRY') template = key.split(':')[0];
        for (let i = 0; i < parents.length; i++) { const p = tx.read('scopeVersions', parents[i]); assert(p && p.scope === scopes[i] && canonical(p.parentVersionIds) === canonical(parents.slice(0, i)), 409, 'STALE_BASE'); if (i === 1) assert(p.scopeKey === template, 409, 'STALE_BASE'); if (i === 2) assert(p.scopeKey === country, 409, 'STALE_BASE'); }
    }
    private resolve(tx: Transaction, scope: string, key: string, parents: string[], documents: any[]) {
        this.checkParents(tx, scope, key, parents);
        const inherited: Record<string, any> = parents.length ? upgradeAccountConfig(tx.read('scopeVersions', parents[parents.length - 1])!.effective as any, scope === 'COMPANY' ? String(tx.read('companies',key)!.templateCode) : key.startsWith('HQ') ? 'HQ' : 'GLOBAL') : {};
        const effective=upgradeApprovalConfig(upgradeMasterConfig(inherited,scope==='COMPANY'?String(tx.read('companies',key)!.timezone):key.startsWith('HQ')?'Asia/Seoul':'America/New_York'));
        if(scope==='TEMPLATE'&&key==='HQ'){const hq=accountBaseline('HQ');effective['SCREEN:account']=hq['SCREEN:account'];effective['FIELD:account']=hq['FIELD:account'];}
        if (scope === 'COMPANY') { const c = tx.read('companies', key)!; effective['COMPANY_PROFILE:profile'] = structuredClone(tx.read('configScopes', `COMPANY:${key}`)?.profileBaseline || { defaultLocale: c.defaultLocale, currency: c.currency, timezone: c.timezone, templateCode: c.templateCode }); }
        if(scope==='COMPANY'&&key===COMPANY_IDS.US_B){const f=effective['FIELD:account'].fields.find((f:any)=>f.key==='x_visitGroup');if(f)f.visible=false;}
        const provenance: Record<string, any> = parents.length ? structuredClone(tx.read('scopeVersions', parents[parents.length - 1])!.provenance as any || {}) : {};
        for (const d of documents) {
            const k = documentKey(d); assert(d.domain !== 'SECURITY', 422, 'SECURITY_PUBLISH_A10');
            if (d.domain === 'COMPANY_PROFILE') assert(!(d.overrides || []).some((o: any) => o.path[0]?.property === 'templateCode'), 422, 'TEMPLATE_CHANGE_A10');
            if (scope === 'COMMON') { effective[k] = validateResolved(d.domain, d.payload); provenance[k] = { source: 'COMMON', paths: {} }; }
            else { assert(effective[k], 422, 'BASE_DOCUMENT_REQUIRED'); const r = resolveOverrides(effective[k], d.overrides || [], locks[k]); effective[k] = validateResolved(d.domain, r.payload); provenance[k] = { source: `${scope}:${key}`, paths: { ...(provenance[k]?.paths || {}), ...Object.fromEntries(Object.keys(r.provenance).map(p => [p, `${scope}:${key}`])) } }; }
        }
        // Mandatory registry values stay protected even when COMMON is edited.
        const field = effective['FIELD:account']; assert(field?.fields?.some((f: any) => f.key === 'taxId' && f.visible && f.required), 422, 'LOCKED_PATH');
        const upgraded = upgradeAccountConfig(effective, scope === 'COMPANY' ? String(tx.read('companies',key)!.templateCode) : key.startsWith('HQ') ? 'HQ' : 'GLOBAL'); validateApprovalConfig(upgraded); validateMasterConfig(upgraded,scope==='COMPANY'?tx:undefined,scope==='COMPANY'?key:undefined); validateAccountConfig(upgraded, scope === 'COMPANY' ? tx : undefined, scope === 'COMPANY' ? key : undefined); return { effective: upgraded, provenance };
    }
    private validateViews(tx: Transaction, a: SecurityActor, config: any) {
        let roles=rolesFor(tx.forCompany(a.companyId),actorMembership(tx,a));
        // Configuration authority may author business views without receiving record access.
        if(a.role==='PLATFORM_ADMIN'||a.role==='COMPANY_ADMIN')roles=roles.map(r=>({...r,grants:[...r.grants,'account.read']}));
        for(const view of config['LIST_VIEW:account'].views)if(view.shared){
            for(const key of [...view.columns,...conditionFields(view.filter),...view.sort.map((s:any)=>s.field)])assert(['context.companyId','actor.roleCodes','document.state'].includes(key)||fieldAccess(roles,key).read,422,'FIELD_NOT_READABLE');
            for(const key of [...conditionFields(view.filter),...view.sort.map((s:any)=>s.field)])assert(fieldAccess(roles,key).mask==='NONE',422,'FIELD_NOT_READABLE');
        }
    }
    private draftSet(tx: Transaction, scope: string, key: string, body: any) {
        assert(body.draftIds.length === body.revisions.length && new Set(body.draftIds).size === body.draftIds.length, 422, 'DRAFT_SET_INVALID');
        const drafts = body.draftIds.map((value: string, i: number) => { const d = tx.read('drafts', value); assert(d && d.scope === scope && d.scopeKey === key, 404, 'NOT_FOUND'); assert(d.revision === body.revisions[i], 409, 'REVISION_CONFLICT'); return d; });
        assert(new Set(drafts.map(documentKey)).size === drafts.length, 422, 'DUPLICATE_DOCUMENT');
        const parents = drafts[0].parentVersionIds;
        assert(drafts.every((d: any) => canonical(d.parentVersionIds) === canonical(parents)), 409, 'STALE_BASE');
        const old = this.snapshot(tx, scope, key); const documents = new Map<string, any>((old?.documents || []).map((d: any) => [documentKey(d), d]));
        for (const d of drafts) documents.set(documentKey(d), d);
        return { drafts, documents: [...documents.values()], parents };
    }
    async read(a: SecurityActor, scope: string, key: string, runtime = false) {
        const repo = new SecurityEngine(this.repo).authorizedRepository(a, scope === 'COMPANY' ? key : a.companyId, runtime ? 'account.read' : 'config.read');
        return repo.transact('*', async tx => {
            await this.initialize(tx); this.access(tx, a, scope, key, runtime ? 'account.read' : 'config.read');
            const active = this.snapshot(tx, scope, key); const parents = this.parents(tx, scope, key);
            const inherited = parents.length ? tx.read('scopeVersions', parents[parents.length - 1]) : undefined;
            if (runtime) return { releaseId: active?.id || 'A03_BASELINE', contentHash: active?.contentHash || inherited?.contentHash, effectiveConfig: {'FEATURE:platform':(active?.effective || inherited?.effective || baseline)['FEATURE:platform']} };
            const localDrafts = tx.query('drafts').filter(d => d.scope === scope && d.scopeKey === key);
            let draftEffective: any = null; try { if (localDrafts.length) draftEffective = this.resolve(tx, scope, key, localDrafts[0].parentVersionIds as string[], localDrafts).effective; } catch {}
            return { draftEffective, parentEffective: inherited?.effective || baseline, currentVersionId: this.current(tx, scope, key), parentVersionIds: parents, effective: upgradeMasterConfig(upgradeAccountConfig((scope==='COMPANY'?activeAccountConfig(tx,key).config:(active?.effective || inherited?.effective || baseline)) as any, scope === 'COMPANY' ? String(tx.read('companies',key)!.templateCode) : key.startsWith('HQ') ? 'HQ' : 'GLOBAL'),scope==='COMPANY'?String(tx.read('companies',key)!.timezone):key.startsWith('HQ')?'Asia/Seoul':'America/New_York'), provenance: active?.provenance || inherited?.provenance || {}, lockedPaths: locks, drafts: tx.query('drafts').filter(d => d.scope === scope && d.scopeKey === key), versions: tx.query(scope === 'COMPANY' ? 'releases' : 'scopeVersions').filter(v => v.scope === scope && v.scopeKey === key), availableParents: a.role === 'PLATFORM_ADMIN' ? tx.query('scopeVersions') : tx.query('scopeVersions').filter(v => parents.includes(v.id) || (v.scope === 'COUNTRY' && v.scopeKey === `${tx.read('companies', key)!.templateCode}:${tx.read('companies', key)!.countryCode}`)) };
        });
    }
    async version(a: SecurityActor, versionId: string) {
        return new SecurityEngine(this.repo).authorizedRepository(a, a.companyId, 'config.read').transact('*', tx => {
            const row = tx.read('scopeVersions', versionId) || tx.read('configVersions', versionId); assert(row, 404, 'NOT_FOUND'); this.access(tx, a, String(row.scope), String(row.scopeKey), 'config.read'); return { data: row };
        });
    }
    async preview(a: SecurityActor, validationId: string) {
        return new SecurityEngine(this.repo).authorizedRepository(a, a.companyId, 'config.read').transact('*', async tx => {
            const v: any = tx.read('configValidations', validationId); assert(v && v.actorId === a.userId, 404, 'NOT_FOUND'); this.access(tx, a, v.scope, v.scopeKey, 'config.read'); const set = this.draftSet(tx, v.scope, v.scopeKey, v); assert(await securityHash(canonical(set.drafts)) === v.draftHash, 409, 'VALIDATION_STALE'); return { effectiveConfig: v.effective, provenance: v.provenance, issues: [] };
        });
    }
    async applyRebase(a: SecurityActor, body: unknown, key: string) {
        const b = z.object({ previewId: id, expectedDraftRevisions: z.array(z.number().int().positive()), reason }).strict().parse(body);
        const p = await new SecurityEngine(this.repo).authorizedRepository(a, a.companyId, 'config.edit').transact('*', tx => { const row = tx.read('previews', b.previewId); assert(row && row.actorId === a.userId, 404, 'NOT_FOUND'); return row; });
        return this.command(a, String(p.scope), String(p.scopeKey), 'rebase-apply', b, key);
    }
    async command(a: SecurityActor, scope: string, scopeKey: string, operation: string, body: any, key: string): Promise<any> {
        assert(key, 400, 'IDEMPOTENCY_REQUIRED'); const permission = operation === 'publish' || operation === 'rollback' ? (scope === 'COMPANY' ? 'config.publish' : 'config.publish.scope') : operation === 'validate' ? 'config.validate' : 'config.edit';
        const repo = new SecurityEngine(this.repo).authorizedRepository(a, scope === 'COMPANY' ? scopeKey : a.companyId, permission);
        const hash = await securityHash(canonical({ scope, scopeKey, operation, body }));
        return repo.transact('*', async tx => {
            await this.initialize(tx); this.access(tx, a, scope, scopeKey, permission);
            const receipt = `config:${a.userId}:${scope}:${scopeKey}:${operation}:${key}`, prior = tx.receipt(receipt, hash); if (prior) return prior;
            const current = this.current(tx, scope, scopeKey);
            const checkDocuments = (documents: any[]) => { for (const d of documents) new SecurityEngine(this.repo).checkDraft(tx, a, d.domain, d.overrides || []); };
            let result: any;
            if (operation === 'validate') {
                const b = validateInput.parse(body); const expected = scope === 'COMPANY' ? b.expectedReleaseId : b.expectedVersionId; assert(expected !== undefined && expected === current, 409, 'VERSION_CONFLICT');
                const set = this.draftSet(tx, scope, scopeKey, b); checkDocuments(set.documents); const resolved = this.resolve(tx, scope, scopeKey, set.parents, set.documents); this.validateViews(tx,a,resolved.effective);
                const row = { id: this.makeId(), revision: 1, scope, scopeKey, actorId: a.userId, current, draftIds: b.draftIds, revisions: b.revisions, draftHash: await securityHash(canonical(set.drafts)), ...set, ...resolved, contentHash: await securityHash(canonical(resolved.effective)), registryVersion: 1 };
                tx.insert('configValidations', row); result = { validationId: row.id, errors: [], ...resolved, contentHash: row.contentHash };
            } else if (operation === 'publish') {
                const b = publishInput.parse(body); const v: any = tx.read('configValidations', b.validationId); assert(v && v.scope === scope && v.scopeKey === scopeKey && v.actorId === a.userId, 404, 'NOT_FOUND');
                assert((scope === 'COMPANY' ? b.expectedReleaseId : b.expectedVersionId) === current && v.current === current, 409, 'VERSION_CONFLICT');
                const set = this.draftSet(tx, scope, scopeKey, v); assert(await securityHash(canonical(set.drafts)) === v.draftHash && v.registryVersion === 1, 409, 'VALIDATION_STALE');
                checkDocuments(set.documents); const resolved = this.resolve(tx, scope, scopeKey, set.parents, set.documents); this.validateViews(tx,a,resolved.effective); result = await this.publish(tx, a, scope, scopeKey, set.parents, set.documents, resolved, b.reason);
            } else if (operation === 'rollback') {
                assert(scope === 'COMPANY', 422, 'USE_COMPANY_RELEASE_API'); const b = z.object({ targetReleaseId: id, expectedReleaseId: id, reason }).strict().parse(body); assert(current === b.expectedReleaseId, 409, 'VERSION_CONFLICT');
                const target: any = tx.read('releases', b.targetReleaseId); assert(target?.companyId === scopeKey, 404, 'NOT_FOUND');
                checkDocuments(target.documents); const resolved = this.resolve(tx, scope, scopeKey, target.parentVersionIds, target.documents); this.validateViews(tx,a,resolved.effective); result = await this.publish(tx, a, scope, scopeKey, target.parentVersionIds, target.documents, resolved, b.reason, target.id);
            } else if (operation === 'rebase-preview') {
                const b = refs.extend({ targetParentVersionIds: z.array(id) }).strict().parse(body); const set = this.draftSet(tx, scope, scopeKey, b); checkDocuments(set.documents); let resolved: any; let conflicts: any[] = []; try { resolved = this.resolve(tx, scope, scopeKey, b.targetParentVersionIds, set.documents); } catch (e) { conflicts = [{ code: (e as Error).message }]; resolved = { effective: null }; }
                const row = { id: this.makeId(), revision: 1, scope, scopeKey, actorId: a.userId, current, draftIds: b.draftIds, revisions: b.revisions, baseHash: await securityHash(canonical(set.drafts)), targetParentVersionIds: b.targetParentVersionIds, expiresAt: this.now() + 600000, effective: resolved.effective, conflicts, applied: false };
                tx.insert('previews', row); result = { previewId: row.id, baseVersions: set.parents, targetParentVersionIds: row.targetParentVersionIds, conflicts, before: this.resolve(tx, scope, scopeKey, set.parents, set.documents).effective, after: resolved.effective, expiresAt: row.expiresAt };
            } else if (operation === 'rebase-apply') {
                const b = z.object({ previewId: id, expectedDraftRevisions: z.array(z.number().int().positive()), reason }).strict().parse(body); const p: any = tx.read('previews', b.previewId);
                assert(p && p.actorId === a.userId && p.scope === scope && p.scopeKey === scopeKey, 404, 'NOT_FOUND'); assert(!p.applied && p.expiresAt > this.now() && p.current === current && canonical(p.revisions) === canonical(b.expectedDraftRevisions), 409, 'REBASE_STALE');
                const drafts = p.draftIds.map((i: string) => tx.read('drafts', i)); assert(await securityHash(canonical(drafts)) === p.baseHash, 409, 'REBASE_STALE');
                const set = this.draftSet(tx, scope, scopeKey, p); checkDocuments(set.documents); assert(!p.conflicts?.length, 409, 'REBASE_CONFLICT'); try { this.resolve(tx, scope, scopeKey, p.targetParentVersionIds, set.documents); } catch { assert(false, 409, 'REBASE_CONFLICT'); }
                for (const d of drafts) tx.compareAndSwap('drafts', d.id, d.revision, { ...d, parentVersionIds: p.targetParentVersionIds }); tx.compareAndSwap('previews', p.id, p.revision, { ...p, applied: true }); result = { items: drafts.map((d: any) => tx.read('drafts', d.id)) };
                this.event(tx, a, 'CONFIG_REBASED', p.id, b.reason);
            } else assert(false, 404, 'NOT_FOUND');
            tx.receipt(receipt, hash, result); return result;
        });
    }
    private async publish(tx: Transaction, a: SecurityActor, scope: string, scopeKey: string, parents: string[], documents: any[], resolved: any, reason: string, rollbackOf?: string) {
        const documentVersionIds = documents.map(d => { const versionId = this.makeId(); tx.insert('configVersions', { ...d, id: versionId, revision: 1, sourceDraftId: d.id || null }); return versionId; });
        const row: Row = { id: this.makeId(), revision: 1, scope, scopeKey, ...(scope === 'COMPANY' ? { companyId: scopeKey } : {}), parentVersionIds: parents, documentVersionIds, documents, ...resolved, contentHash: await securityHash(canonical(resolved.effective)), reason, rollbackOf: rollbackOf || null, createdBy: a.userId, createdAt: new Date(this.now()).toISOString() };
        tx.insert(scope === 'COMPANY' ? 'releases' : 'scopeVersions', row);
        if (scope === 'COMPANY') { const c = tx.read('companies', scopeKey)!; const profile = resolved.effective['COMPANY_PROFILE:profile']; if (profile && (profile.currency !== c.currency || profile.timezone !== c.timezone)) assert(!(['accounts','leads','opportunities','contracts','orders','sequences','approvals'] as const).some(name => tx.forCompany(scopeKey).query(name).length), 409, 'COMPANY_PROFILE_IN_USE'); tx.compareAndSwap('companies', c.id, c.revision, { ...c, ...profile, activeReleaseId: row.id }); }
        else { const p = tx.read('configScopes', `${scope}:${scopeKey}`)!; tx.compareAndSwap('configScopes', p.id, p.revision, { ...p, currentVersionId: row.id }); }
        this.event(tx, a, rollbackOf ? 'CONFIG_ROLLED_BACK' : 'CONFIG_PUBLISHED', row.id, reason); return { data: row, releaseId: scope === 'COMPANY' ? row.id : undefined, versionId: row.id };
    }
}
