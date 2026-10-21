import React, { useState, useRef } from 'react';
import { COMPANY_IDS } from '@dio-crm/contracts/admin';
import { BrowserAdminRepository } from './client/browser-repository';
import { AdminClient, BrowserMockAdminClient, HttpAdminClient } from './client/admin-client';
import { OrganizationClient } from './client/organization-client';
import { OrganizationPages } from './OrganizationPages';
export function MockEntry({ mode }: {
    mode: 'API_MOCK' | 'BROWSER_MOCK';
}) {
    const [company, setCompany] = useState('US_A'), [loginId, setLoginId] = useState('admin1'), [password, setPassword] = useState('DemoOnly!2026');
    const [client, setClient] = useState<AdminClient | null>(null), [orgClient, setOrgClient] = useState<OrganizationClient | null>(null), [memberships, setMemberships] = useState<any[]>([]), [rows, setRows] = useState<any[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const [managementCompanies, setManagementCompanies] = useState<any[]>([]), [sessionCompany, setSessionCompany] = useState('');
    const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
    const saveEditor = useRef<() => Promise<boolean>>(async () => true);
    const browserUser = useRef(''), httpToken = useRef(''), epoch = useRef(0), dirty = useRef(false);
    async function perform(fn: () => Promise<void>) { setBusy(true); setError(''); try {
        await fn();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
    }
    finally {
        setBusy(false);
    } }
    async function connectBrowser(companyId?: string) { const repo = new BrowserAdminRepository(), s = await repo.snapshot(); let user = browserUser.current ? s.collections.users[browserUser.current] : Object.values(s.collections.users).find(u => u.loginId === loginId && s.collections.companies[String(u.homeCompanyId)].code === company); if (!user?.active)
        throw Error('DEMO_USER_NOT_FOUND'); const allowed = Object.values(s.collections.memberships).filter(m => m.userId === user.id && m.active && s.collections.companies[String(m.companyId)]?.active); const membership = companyId ? allowed.find(m => m.companyId === companyId) : allowed[0]; if (!membership)
        throw Error('MEMBERSHIP_REQUIRED'); browserUser.current = user.id; const actor = { userId: user.id, companyId: String(membership.companyId), role: String(membership.role) }; setMemberships(allowed.map(m => ({ ...m, code: s.collections.companies[String(m.companyId)].code }))); setCompany(String(s.collections.companies[actor.companyId].code)); const c = new BrowserMockAdminClient(repo, { ...actor, canConfigure: ['COMPANY_ADMIN', 'PLATFORM_ADMIN'].includes(actor.role), platformAdmin: actor.role === 'PLATFORM_ADMIN' }); setClient(c); setOrgClient(new OrganizationClient(actor)); setSessionCompany(actor.companyId); setManagementCompanies(actor.role === 'PLATFORM_ADMIN' ? Object.values(s.collections.companies) : []); setRows(actor.role === 'SALES' ? [] : await c.listDrafts()); }
    async function connectHttp(auth: any) { const token = auth.accessToken; const c = new HttpAdminClient('', () => token); const context = await c.request('/api/me/context'); if (context.executionMode !== mode)
        throw Error('EXECUTION_MODE_MISMATCH'); httpToken.current = token; setMemberships(context.memberships || []); setCompany(context.companyCode || company); setClient(c); setOrgClient(new OrganizationClient({ ...auth.context, userId: context.adminContext.userId }, c)); setSessionCompany(auth.context.companyId); setManagementCompanies(auth.context.role === 'PLATFORM_ADMIN' ? (await c.request('/api/admin/companies')).items : []); setRows(auth.context.role === 'SALES' ? [] : await c.listDrafts()); }
    async function login() { await perform(async () => { if (mode === 'BROWSER_MOCK')
        await connectBrowser();
    else {
        const raw = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ homeCompanyCode: company, loginId, password }) });
        const auth = await raw.json();
        if (!raw.ok)
            throw Error(auth.code);
        await connectHttp(auth);
    } }); }
    async function changeCompany(id: string, force = false) { if (dirty.current && !force) {
        setPendingSwitch(id);
        return;
    } await perform(async () => { epoch.current++; if (id.startsWith('manage:')) {
        setOrgClient(new OrganizationClient({ ...orgClient!.actor, companyId: id.slice(7) }, client instanceof HttpAdminClient ? client : undefined));
        dirty.current = false;
        return;
    } if (mode === 'BROWSER_MOCK')
        await connectBrowser(id);
    else {
        const c = new HttpAdminClient('', () => httpToken.current);
        await connectHttp(await c.request('/api/me/company-context', 'POST', { companyId: id }, crypto.randomUUID()));
    } dirty.current = false; }); }
    async function logout() { await perform(async () => { if (mode === 'API_MOCK')
        await new HttpAdminClient('', () => httpToken.current).request('/api/auth/logout', 'POST', {}, crypto.randomUUID()); epoch.current++; setClient(null); setOrgClient(null); setRows([]); httpToken.current = ''; browserUser.current = ''; }); }
    return <main style={{ maxWidth: 1100, margin: '24px auto', padding: 24 }}><h1>관리자 플랫폼 · DEMO</h1><p role="status">{mode} · 실제 ERP 연결 없음 · 브라우저 권한은 시연용</p>{error && <p role="alert">{error}</p>}{!client ? <form onSubmit={e => { e.preventDefault(); void login(); }}><label>법인 <select aria-label="법인" value={company} onChange={e => setCompany(e.target.value)}>{Object.keys(COMPANY_IDS).map(code => <option key={code}>{code}</option>)}</select></label><label>로그인 ID <input aria-label="로그인 ID" value={loginId} onChange={e => setLoginId(e.target.value)}/></label>{mode === 'API_MOCK' && <label>암호 <input aria-label="암호" type="password" value={password} onChange={e => setPassword(e.target.value)}/></label>}<button disabled={busy}>{mode === 'BROWSER_MOCK' ? '시연 시작' : '로그인'}</button></form> : <><label>현재 법인<select aria-label="현재 법인" disabled={busy} value={sessionCompany} onChange={e => void changeCompany(e.target.value)}>{memberships.map(m => <option key={m.id} value={m.companyId}>{m.code}</option>)}</select></label><button disabled={busy} onClick={() => void logout()}>종료</button>{managementCompanies.length > 0 && <><label>관리 대상 법인<select aria-label="관리 대상 법인" value={orgClient?.actor.companyId || ''} onChange={e => void changeCompany('manage:' + e.target.value)}>{managementCompanies.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label><button onClick={() => void perform(async () => setManagementCompanies(await orgClient!.list('companies')))}>관리 대상 갱신</button></>}{orgClient?.actor.role !== 'SALES' && orgClient?.actor.companyId === sessionCompany && <details><summary>공통 초안 실행 확인 (A01)</summary><button disabled={busy} onClick={() => void perform(async () => { await client.createDraft({ scope: 'COMPANY', scopeKey: orgClient!.actor.companyId, schemaVersion: 1, domain: 'FEATURE', stableKey: 'a01-sample', parentVersionIds: [], overrides: [{ op: 'SET', path: [{ property: 'items' }, { itemKey: 'account' }, { property: 'enabled' }], value: false }] }); setRows(await client.listDrafts()); })}>샘플 초안 생성</button><ul>{rows.map(row => <li key={row.id}>{row.stableKey} · revision {row.revision} <button disabled={busy} onClick={() => void perform(async () => { await client.updateDraft(row.id, { revision: row.revision, overrides: [{ op: 'SET', path: [{ property: 'items' }, { itemKey: 'account' }, { property: 'enabled' }], value: !row.overrides?.[0]?.value }] }); setRows(await client.listDrafts()); })}>기능 전환</button></li>)}</ul></details>}{orgClient && <OrganizationPages key={orgClient.actor.companyId} client={orgClient} onDirty={(value, save) => { dirty.current = value; saveEditor.current = save; }}/>}</>}{pendingSwitch && <div role="dialog" aria-label="법인 전환 확인" style={{ position: 'fixed', inset: '25% 25%', padding: 24, background: 'white', border: '2px solid #1e3a5f', zIndex: 20 }}><h2>편집 중인 내용을 어떻게 처리할까요?</h2><button onClick={() => void (async () => { if (await saveEditor.current()) {
        const id = pendingSwitch;
        setPendingSwitch(null);
        await changeCompany(id, true);
    } })()}>저장 후 전환</button><button onClick={() => { const id = pendingSwitch; setPendingSwitch(null); void changeCompany(id, true); }}>폐기 후 전환</button><button onClick={() => setPendingSwitch(null)}>전환 취소</button></div>}<p>A02 구현 검증 중 · 설정 게시·승인·ERP 모의 엔진은 후속 단계입니다.</p></main>;
}
