import {IntegrationPage} from './IntegrationPage';
import {NotificationsPage} from './NotificationsPage';
import {ApprovalsPage} from './ApprovalsPage';
import {MasterDataPages} from './MasterDataPages';
import { AccountDesigner } from './AccountDesigner';
import { AccountRuntimePage } from './AccountRuntimePage';
import { MockAccountRuntimePort } from './client/account-runtime-port';
import { ConfigurationPages } from './ConfigurationPages';
import React, { useState, useRef, useMemo } from 'react';
import { COMPANY_IDS } from '@dio-crm/contracts/admin';
import { BrowserAdminRepository } from './client/browser-repository';
import { AdminClient, BrowserMockAdminClient, HttpAdminClient } from './client/admin-client';
import { OrganizationClient } from './client/organization-client';
import { SecurityPages } from './SecurityPages';
import { BrowserSecurityClient } from './client/browser-security-client';
import { OrganizationPages } from './OrganizationPages';
export function MockEntry({ mode }: {
    mode: 'API_MOCK' | 'BROWSER_MOCK';
}) {
    const [integrationPage,setIntegrationPage]=useState(location.pathname.startsWith('/admin/integration'));
    const [notificationPage,setNotificationPage]=useState(location.pathname==='/notifications'||location.pathname==='/admin/notifications');
    const [approvalPage,setApprovalPage]=useState(location.pathname.startsWith('/approvals')||location.pathname.startsWith('/admin/approval'));
    const [company, setCompany] = useState('US_A'), [loginId, setLoginId] = useState('admin1'), [password, setPassword] = useState('DemoOnly!2026');
    const [client, setClient] = useState<AdminClient | null>(null), [orgClient, setOrgClient] = useState<OrganizationClient | null>(null), [memberships, setMemberships] = useState<any[]>([]), [rows, setRows] = useState<any[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const [managementCompanies, setManagementCompanies] = useState<any[]>([]), [sessionCompany, setSessionCompany] = useState('');
    const browserApi = useRef(new BrowserSecurityClient());
    const [pendingAuth, setPendingAuth] = useState<any>(null), [demoCode, setDemoCode] = useState(''), [securityPage, setSecurityPage] = useState(['/admin/roles','/admin/data-scopes','/admin/field-permissions','/admin/admin-delegation','/admin/security-policies','/admin/sessions','/admin/mfa-reset-requests'].includes(window.location.pathname));
    const [configPage, setConfigPage] = useState(['/admin/configuration', '/admin/releases'].includes(window.location.pathname));
    const [masterPage,setMasterPage]=useState(['/admin/translations','/admin/codes','/admin/numbering','/admin/calendars'].includes(window.location.pathname));
    const [accountPage,setAccountPage]=useState(['/admin/features','/admin/menus','/admin/screens','/admin/sections','/admin/conditions','/admin/fields','/admin/rules','/admin/list-views','/admin/actions','/admin/extension-fields','/accounts'].includes(window.location.pathname));
    const accountPort=useMemo(()=>client instanceof HttpAdminClient && orgClient ? new MockAccountRuntimePort(client,orgClient.actor.companyId):null,[client,orgClient]);
    const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
    const saveEditor = useRef<() => Promise<boolean>>(async () => true);
    const browserUser = useRef(''), httpToken = useRef(''), epoch = useRef(0), dirty = useRef(false);
    async function perform(fn: () => Promise<void>) {
        setBusy(true);
        setError('');
        try {
            await fn();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setBusy(false);
        }
    }
    async function acceptAuth(auth: any) { if (auth.state !== 'AUTHENTICATED') {
        setPendingAuth(auth);
        browserApi.current.pendingId = auth.pendingId;
        return;
    } setPendingAuth(null); await connectHttp(auth); }
    async function mfa(action: string) { await perform(async () => { const c = mode === 'BROWSER_MOCK' ? browserApi.current : new HttpAdminClient('', () => pendingAuth.pendingToken); const r = await c.request('/api/auth/mfa/' + action, 'POST', action === 'verify' ? { challengeId: pendingAuth.challengeId, demoCode } : {}, crypto.randomUUID()); if (action === 'enroll')
        setDemoCode(r.demoCode);
    else
        await acceptAuth(r); }); }
    async function connectHttp(auth: any) {
        const token = auth.accessToken;
        browserApi.current.sessionId = auth.sessionId;
        const c = mode === 'BROWSER_MOCK' ? browserApi.current : new HttpAdminClient('', () => token);
        const context = await c.request('/api/me/context');
        if (context.executionMode !== mode)
            throw Error('EXECUTION_MODE_MISMATCH');
        httpToken.current = token;
        setMemberships(context.memberships || []);
        setCompany(context.companyCode || company);
        setClient(c);
        setOrgClient(new OrganizationClient({ ...auth.context, userId: context.adminContext.userId }, c));
        setSessionCompany(auth.context.companyId);
        setManagementCompanies(auth.context.role === 'PLATFORM_ADMIN' ? (await c.request('/api/admin/companies')).items : []);
        setRows(!['COMPANY_ADMIN', 'PLATFORM_ADMIN'].includes(auth.context.role) ? [] : await c.listDrafts());
    }
    async function login() {
        await perform(async () => {
            if (mode === 'BROWSER_MOCK')
                await acceptAuth(await browserApi.current.login(company, loginId));
            else {
                const raw = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ homeCompanyCode: company, loginId, password }) });
                const auth = await raw.json();
                if (!raw.ok)
                    throw Error(auth.code);
                await acceptAuth(auth);
            }
        });
    }
    async function changeCompany(id: string, force = false) {
        if (dirty.current && !force) {
            setPendingSwitch(id);
            return;
        }
        await perform(async () => {
            epoch.current++;
            if (id.startsWith('manage:')) {
                setOrgClient(new OrganizationClient({ ...orgClient!.actor, companyId: id.slice(7) }, client instanceof HttpAdminClient ? client : undefined));
                dirty.current = false;
                return;
            }
            if (mode === 'BROWSER_MOCK')
                await acceptAuth(await browserApi.current.request('/api/me/company-context', 'POST', { companyId: id }));
            else {
                const c = new HttpAdminClient('', () => httpToken.current);
                await acceptAuth(await c.request('/api/me/company-context', 'POST', { companyId: id }, crypto.randomUUID()));
            }
            dirty.current = false;
        });
    }
    async function logout() { await perform(async () => { await (mode === 'BROWSER_MOCK' ? browserApi.current : new HttpAdminClient('', () => httpToken.current)).request('/api/auth/logout', 'POST', {}, crypto.randomUUID()).catch(() => undefined); epoch.current++; setClient(null); setOrgClient(null); setRows([]); httpToken.current = ''; browserUser.current = ''; }); }
    return <main style={{ maxWidth: 1100, margin: '24px auto', padding: 24 }}><h1>관리자 플랫폼 · DEMO</h1><p role="status">{mode} · 실제 ERP 연결 없음 · 브라우저 권한은 시연용</p>{error && <p role="alert">{error}</p>}{pendingAuth && <section role="dialog" aria-label="DEMO MFA"><h2>DEMO MFA · 실제 OTP 인증 아님</h2><p>{pendingAuth.state} · 5분 이내 입력</p><button onClick={() => void mfa('enroll')}>DEMO 등록 준비</button><label>DEMO 코드<input aria-label="DEMO 코드" value={demoCode} onChange={e => setDemoCode(e.target.value)}/></label><p>시연 코드: 123456</p><button onClick={() => void mfa('verify')}>인증 확인</button>{pendingAuth.canSkip && <button onClick={() => void mfa('skip')}>이번에는 건너뛰기</button>}<button onClick={() => setPendingAuth(null)}>취소</button></section>}{!client ? <form onSubmit={e => { e.preventDefault(); void login(); }}><label>법인 <select aria-label="법인" value={company} onChange={e => setCompany(e.target.value)}>{Object.keys(COMPANY_IDS).map(code => <option key={code}>{code}</option>)}</select></label><label>로그인 ID <input aria-label="로그인 ID" value={loginId} onChange={e => setLoginId(e.target.value)}/></label>{mode === 'API_MOCK' && <label>암호 <input aria-label="암호" type="password" value={password} onChange={e => setPassword(e.target.value)}/></label>}<button disabled={busy}>{mode === 'BROWSER_MOCK' ? '시연 시작' : '로그인'}</button></form> : <><label>현재 법인<select aria-label="현재 법인" disabled={busy} value={sessionCompany} onChange={e => void changeCompany(e.target.value)}>{memberships.map(m => <option key={m.id} value={m.companyId}>{m.code}</option>)}</select></label><button disabled={busy} onClick={() => void logout()}>종료</button>{managementCompanies.length > 0 && <><label>관리 대상 법인<select aria-label="관리 대상 법인" value={orgClient?.actor.companyId || ''} onChange={e => void changeCompany('manage:' + e.target.value)}>{managementCompanies.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label><button onClick={() => void perform(async () => setManagementCompanies(await orgClient!.list('companies')))}>관리 대상 갱신</button></>}{orgClient?.actor.role !== 'SALES' && orgClient?.actor.companyId === sessionCompany && <details><summary>공통 초안 실행 확인 (A01)</summary><button disabled={busy} onClick={() => void perform(async () => { await client.createDraft({ scope: 'COMPANY', scopeKey: orgClient!.actor.companyId, schemaVersion: 1, domain: 'FEATURE', stableKey: 'a01-sample', parentVersionIds: [], overrides: [{ op: 'SET', path: [{ property: 'items' }, { itemKey: 'account' }, { property: 'enabled' }], value: false }] }); setRows(await client.listDrafts()); })}>샘플 초안 생성</button><ul>{rows.map(row => <li key={row.id}>{row.stableKey} · revision {row.revision} <button disabled={busy} onClick={() => void perform(async () => { await client.updateDraft(row.id, { revision: row.revision, overrides: [{ op: 'SET', path: [{ property: 'items' }, { itemKey: 'account' }, { property: 'enabled' }], value: !row.overrides?.[0]?.value }] }); setRows(await client.listDrafts()); })}>기능 전환</button></li>)}</ul></details>}<button onClick={()=>{setMasterPage(!masterPage);setAccountPage(false);setConfigPage(false);}}>명칭·기준정보·번호·달력</button><button onClick={()=>setIntegrationPage(!integrationPage)}>ERP 연동</button><button onClick={()=>{setIntegrationPage(false);setNotificationPage(!notificationPage);}}>알림</button><button onClick={()=>{setIntegrationPage(false);setNotificationPage(false);setApprovalPage(notificationPage?true:!approvalPage);}}>프로세스·승인</button><button onClick={() => {setIntegrationPage(false);setNotificationPage(false);setApprovalPage(false);setIntegrationPage(false);setNotificationPage(false);setApprovalPage(false);setMasterPage(false);setAccountPage(!accountPage);setConfigPage(false);}}>거래처 화면·설정</button><button onClick={() => {setIntegrationPage(false);setNotificationPage(false);setApprovalPage(false);setMasterPage(false);setAccountPage(false);setConfigPage(!configPage);}}>{configPage ? '설정 닫기' : '설정 상속·게시'}</button><button onClick={() => { setIntegrationPage(false);setNotificationPage(false);setApprovalPage(false);setMasterPage(false); setAccountPage(false); setConfigPage(false); setSecurityPage(!securityPage); }}>{securityPage ? '조직 관리로' : '권한·보안 관리'}</button>{integrationPage && orgClient && client instanceof HttpAdminClient ? <IntegrationPage key={orgClient.actor.companyId} client={client} companyId={orgClient.actor.companyId}/> : notificationPage && orgClient && client instanceof HttpAdminClient ? <NotificationsPage key={orgClient.actor.companyId} client={client} companyId={orgClient.actor.companyId}/> : approvalPage && orgClient && client instanceof HttpAdminClient ? <ApprovalsPage key={orgClient.actor.companyId} client={client} companyId={orgClient.actor.companyId}/> : masterPage && orgClient && client instanceof HttpAdminClient ? <MasterDataPages key={orgClient.actor.companyId} client={client} companyId={orgClient.actor.companyId}/> : accountPage && orgClient && client instanceof HttpAdminClient && accountPort ? (['SALES','MANAGER'].includes(orgClient.actor.role) ? <AccountRuntimePage key={orgClient.actor.companyId} port={accountPort}/> : <AccountDesigner key={orgClient.actor.companyId} client={client} companyId={orgClient.actor.companyId}/>) : configPage && orgClient && client instanceof HttpAdminClient ? <ConfigurationPages key={orgClient.actor.companyId} client={client} companyId={orgClient.actor.companyId} platform={orgClient.actor.role === 'PLATFORM_ADMIN'} runtime={['SALES','MANAGER'].includes(orgClient.actor.role)}/> : securityPage && orgClient && client instanceof HttpAdminClient ? <SecurityPages key={orgClient.actor.companyId} client={client} companyId={orgClient.actor.companyId} platform={orgClient.actor.role === 'PLATFORM_ADMIN'}/> : orgClient && <OrganizationPages key={orgClient.actor.companyId} client={orgClient} onDirty={(value, save) => { dirty.current = value; saveEditor.current = save; }}/>}</>}{pendingSwitch && <div role="dialog" aria-label="법인 전환 확인" style={{ position: 'fixed', inset: '25% 25%', padding: 24, background: 'white', border: '2px solid #1e3a5f', zIndex: 20 }}><h2>편집 중인 내용을 어떻게 처리할까요?</h2><button onClick={() => void (async () => {
                if (await saveEditor.current()) {
                    const id = pendingSwitch;
                    setPendingSwitch(null);
                    await changeCompany(id, true);
                }
            })()}>저장 후 전환</button><button onClick={() => { const id = pendingSwitch; setPendingSwitch(null); void changeCompany(id, true); }}>폐기 후 전환</button><button onClick={() => setPendingSwitch(null)}>전환 취소</button></div>}<p>DEMO 설정·승인·알림 · 실제 ERP/EMAIL 전송 없음</p></main>;
}
