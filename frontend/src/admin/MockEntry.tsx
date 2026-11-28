import {Modal} from './designer/Modal';
import {text} from './designer/labels';
import {DatasetResetPanel} from './DatasetResetPanel';
import {adminText} from './admin-text';
import {IntegrationPage} from './IntegrationPage';
import {NotificationsPage} from './NotificationsPage';
import {ApprovalsPage} from './ApprovalsPage';
import {MasterDataPages} from './MasterDataPages';
import { AccountDesigner } from './AccountDesigner';
import { AccountRuntimePage } from './AccountRuntimePage';
import { MockAccountRuntimePort } from './client/account-runtime-port';
import { ConfigurationPages } from './ConfigurationPages';
import React, { useEffect, useState, useRef, useMemo } from 'react';
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
    const [approvalPage,setApprovalPage]=useState(location.pathname==='/admin/workflows'||location.pathname.startsWith('/approvals')||location.pathname.startsWith('/admin/approval'));
    const [company, setCompany] = useState('US_A'), [loginId, setLoginId] = useState('admin1'), [password, setPassword] = useState('DemoOnly!2026');
    const [client, setClient] = useState<AdminClient | null>(null), [orgClient, setOrgClient] = useState<OrganizationClient | null>(null), [memberships, setMemberships] = useState<any[]>([]), [rows, setRows] = useState<any[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const [managementCompanies, setManagementCompanies] = useState<any[]>([]), [sessionCompany, setSessionCompany] = useState('');
    const browserApi = useRef(new BrowserSecurityClient());
    const [pendingAuth, setPendingAuth] = useState<any>(null), [demoCode, setDemoCode] = useState(''), [securityPage, setSecurityPage] = useState(['/admin/roles','/admin/data-scopes','/admin/field-permissions','/admin/admin-delegation','/admin/security-policies','/admin/sessions','/admin/mfa-reset-requests'].includes(window.location.pathname));
    const [configPage, setConfigPage] = useState(['/admin/configuration', '/admin/releases'].includes(window.location.pathname));
    const [masterPage,setMasterPage]=useState(['/admin/translations','/admin/codes','/admin/numbering','/admin/calendars'].includes(window.location.pathname));
    const [accountPage,setAccountPage]=useState(['/admin/features','/admin/menus','/admin/screens','/admin/sections','/admin/conditions','/admin/fields','/admin/rules','/admin/list-views','/admin/actions','/admin/extension-fields','/accounts'].includes(window.location.pathname));
    const accountPort=useMemo(()=>client instanceof HttpAdminClient && orgClient ? new MockAccountRuntimePort(client,orgClient.actor.companyId):null,[client,orgClient]);
    const [pendingNavigation,setPendingNavigation]=useState<HTMLButtonElement|null>(null),[navigationSaving,setNavigationSaving]=useState(false);const replayNavigation=useRef(false);
    const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
    const saveEditor = useRef<() => Promise<boolean>>(async () => true);
    const browserUser = useRef(''), httpToken = useRef(''), epoch = useRef(0), dirty = useRef(false);
    useEffect(()=>{const edit=(e:Event)=>{const d=(e as CustomEvent).detail;dirty.current=d.dirty;saveEditor.current=d.save;};const failed=()=>setPendingSwitch(null);window.addEventListener('admin-editor',edit);window.addEventListener('admin-save-failed',failed);return()=>{window.removeEventListener('admin-editor',edit);window.removeEventListener('admin-save-failed',failed);};},[]);
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
    return <main onClickCapture={e=>{const button=(e.target as HTMLElement).closest('button');if(button?.parentElement===e.currentTarget&&document.querySelector('.designer-shell')&&dirty.current&&!replayNavigation.current){e.preventDefault();e.stopPropagation();setPendingNavigation(button);}replayNavigation.current=false;}} style={{ maxWidth: 1100, margin: '24px auto', padding: 24 }}><h1>{adminText('text_7370108f730d')}</h1><p role="status">{mode}{adminText('text_202df85617a4')}</p>{error && <p role="alert">{error}</p>}{pendingAuth && <section role="dialog" aria-label="DEMO MFA"><h2>{adminText('text_e891b98b225e')}</h2><p>{pendingAuth.state}{adminText('text_9377e4e1191a')}</p><button onClick={() => void mfa('enroll')}>{adminText('text_ce799ebedd61')}</button><label>{adminText('text_5a7c7fe0c702')}<input aria-label={adminText('text_5a7c7fe0c702')} value={demoCode} onChange={e => setDemoCode(e.target.value)}/></label><p>{adminText('text_471996164eeb')}</p><button onClick={() => void mfa('verify')}>{adminText('text_ec6c19e47978')}</button>{pendingAuth.canSkip && <button onClick={() => void mfa('skip')}>{adminText('text_e1635b74cf14')}</button>}<button onClick={() => setPendingAuth(null)}>{adminText('text_be876433993a')}</button></section>}{!client ? <form onSubmit={e => { e.preventDefault(); void login(); }}><label>{adminText('text_fb8320d5d696')}<select aria-label={adminText('text_1b413b16a3d2')} value={company} onChange={e => setCompany(e.target.value)}>{Object.keys(COMPANY_IDS).map(code => <option key={code}>{code}</option>)}</select></label><label>{adminText('text_2611b6d95806')}<input aria-label={adminText('text_e467f4afb0f3')} value={loginId} onChange={e => setLoginId(e.target.value)}/></label>{mode === 'API_MOCK' && <label>{adminText('text_f7db21c7682e')}<input aria-label={adminText('text_8bfc5598386f')} type="password" value={password} onChange={e => setPassword(e.target.value)}/></label>}<button disabled={busy}>{mode === 'BROWSER_MOCK' ? adminText('text_0aff34f439db') : adminText('text_6d253673db90')}</button></form> : <><label>{adminText('text_c54c0c5644d1')}<select aria-label={adminText('text_c54c0c5644d1')} disabled={busy} value={sessionCompany} onChange={e => void changeCompany(e.target.value)}>{memberships.map(m => <option key={m.id} value={m.companyId}>{m.code}</option>)}</select></label><button disabled={busy} onClick={() => void logout()}>{adminText('text_086bb5335d17')}</button>{managementCompanies.length > 0 && client instanceof HttpAdminClient && <DatasetResetPanel client={client} onReset={logout}/>} {managementCompanies.length > 0 && <><label>{adminText('text_db3dd046be25')}<select aria-label={adminText('text_db3dd046be25')} value={orgClient?.actor.companyId || ''} onChange={e => void changeCompany('manage:' + e.target.value)}>{managementCompanies.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label><button onClick={() => void perform(async () => setManagementCompanies(await orgClient!.list('companies')))}>{adminText('text_50ad7be39697')}</button></>}{orgClient?.actor.role !== 'SALES' && orgClient?.actor.companyId === sessionCompany && <details><summary>{adminText('text_10dc2dbc7255')}</summary><button disabled={busy} onClick={() => void perform(async () => { await client.createDraft({ scope: 'COMPANY', scopeKey: orgClient!.actor.companyId, schemaVersion: 1, domain: 'FEATURE', stableKey: 'a01-sample', parentVersionIds: [], overrides: [{ op: 'SET', path: [{ property: 'items' }, { itemKey: 'account' }, { property: 'enabled' }], value: false }] }); setRows(await client.listDrafts()); })}>{adminText('text_5aca756e64f1')}</button><ul>{rows.map(row => <li key={row.id}>{row.stableKey} · revision {row.revision} <button disabled={busy} onClick={() => void perform(async () => { await client.updateDraft(row.id, { revision: row.revision, overrides: [{ op: 'SET', path: [{ property: 'items' }, { itemKey: 'account' }, { property: 'enabled' }], value: !row.overrides?.[0]?.value }] }); setRows(await client.listDrafts()); })}>{adminText('text_71e9feb5219a')}</button></li>)}</ul></details>}<button onClick={()=>{setMasterPage(!masterPage);setAccountPage(false);setConfigPage(false);}}>{adminText('text_6514b7b8e6d4')}</button><button onClick={()=>setIntegrationPage(!integrationPage)}>{adminText('text_7e554fd76b0d')}</button><button onClick={()=>{setIntegrationPage(false);setNotificationPage(!notificationPage);}}>{adminText('text_12ddd6ca6906')}</button><button onClick={()=>{setIntegrationPage(false);setNotificationPage(false);setApprovalPage(notificationPage?true:!approvalPage);}}>{adminText('text_ae8d8dcbf08a')}</button><button onClick={() => {setIntegrationPage(false);setNotificationPage(false);setApprovalPage(false);setIntegrationPage(false);setNotificationPage(false);setApprovalPage(false);setMasterPage(false);setAccountPage(!accountPage);setConfigPage(false);}}>{adminText('text_363267679571')}</button><button onClick={() => {setIntegrationPage(false);setNotificationPage(false);setApprovalPage(false);setMasterPage(false);setAccountPage(false);setConfigPage(!configPage);}}>{configPage ? adminText('text_a2bb7c58e3af') : adminText('text_b40b843276d3')}</button><button onClick={() => { setIntegrationPage(false);setNotificationPage(false);setApprovalPage(false);setMasterPage(false); setAccountPage(false); setConfigPage(false); setSecurityPage(!securityPage); }}>{securityPage ? adminText('text_4eeae0584d37') : adminText('text_bda3c6876d05')}</button>{integrationPage && orgClient && client instanceof HttpAdminClient ? <IntegrationPage key={orgClient.actor.companyId} client={client} companyId={orgClient.actor.companyId}/> : notificationPage && orgClient && client instanceof HttpAdminClient ? <NotificationsPage key={orgClient.actor.companyId} client={client} companyId={orgClient.actor.companyId}/> : approvalPage && orgClient && client instanceof HttpAdminClient ? <ApprovalsPage key={orgClient.actor.companyId} client={client} companyId={orgClient.actor.companyId}/> : masterPage && orgClient && client instanceof HttpAdminClient ? <MasterDataPages key={orgClient.actor.companyId} client={client} companyId={orgClient.actor.companyId}/> : accountPage && orgClient && client instanceof HttpAdminClient && accountPort ? (['SALES','MANAGER'].includes(orgClient.actor.role) ? <AccountRuntimePage key={orgClient.actor.companyId} port={accountPort}/> : <AccountDesigner key={orgClient.actor.companyId} client={client} companyId={orgClient.actor.companyId}/>) : configPage && orgClient && client instanceof HttpAdminClient ? <ConfigurationPages key={orgClient.actor.companyId} client={client} companyId={orgClient.actor.companyId} platform={orgClient.actor.role === 'PLATFORM_ADMIN'} runtime={['SALES','MANAGER'].includes(orgClient.actor.role)}/> : securityPage && orgClient && client instanceof HttpAdminClient ? <SecurityPages key={orgClient.actor.companyId} client={client} companyId={orgClient.actor.companyId} platform={orgClient.actor.role === 'PLATFORM_ADMIN'}/> : orgClient && <OrganizationPages key={orgClient.actor.companyId} client={orgClient} onDirty={(value, save) => { dirty.current = value; saveEditor.current = save; }}/>}</>}{pendingNavigation&&<Modal title={text('ko-KR')('leaveTitle')} onClose={()=>{if(!navigationSaving)setPendingNavigation(null);}}><button disabled={navigationSaving} onClick={()=>void(async()=>{setNavigationSaving(true);const ok=await saveEditor.current();setNavigationSaving(false);if(ok){const b=pendingNavigation;setPendingNavigation(null);replayNavigation.current=true;b.click();}})()}>{text('ko-KR')('saveLeave')}</button><button disabled={navigationSaving} onClick={()=>{const b=pendingNavigation;setPendingNavigation(null);replayNavigation.current=true;b.click();}}>{text('ko-KR')('discardLeave')}</button><button disabled={navigationSaving} onClick={()=>setPendingNavigation(null)}>{text('ko-KR')('cancel')}</button></Modal>}{pendingSwitch && <div role="dialog" aria-label={adminText('text_52776115290a')} style={{ position: 'fixed', inset: '20% 5%' , padding: 24, background: 'white', border: '2px solid #1e3a5f', zIndex: 20 }}><h2>{adminText('text_08624e33ffc2')}</h2><button onClick={() => void (async () => {
                if (await saveEditor.current()) {
                    const id = pendingSwitch;
                    setPendingSwitch(null);
                    await changeCompany(id, true);
                }
            })()}>{adminText('text_ff60a6ce3573')}</button><button onClick={() => { const id = pendingSwitch; setPendingSwitch(null); void changeCompany(id, true); }}>{adminText('text_a7ad77354def')}</button><button onClick={() => setPendingSwitch(null)}>{adminText('text_4b11ad8eef10')}</button></div>}<p>{adminText('text_589f8bbea782')}</p></main>;
}
