import {adminText} from './admin-text';
import React, { useEffect, useRef, useState } from 'react';
import { OrganizationClient, OrgResource } from './client/organization-client';
const names: Record<OrgResource, string> = { companies: adminText('text_1b413b16a3d2'), organizations: adminText('text_65e425a15b2d'), users: adminText('text_1ac6e422b7dc'), memberships: adminText('text_01603d13dd65'), transfers: adminText('text_e9bd6fd46acb') };
export function OrganizationPages({ client, onDirty }: {
    client: OrganizationClient;
    onDirty: (value: boolean, save: () => Promise<boolean>) => void;
}) {
    const route = window.location.pathname.split('/').pop();
    const initial = (route === 'ownership-transfers' ? 'transfers' : route) as OrgResource;
    const [page, setPage] = useState<OrgResource>(initial in names ? initial : 'companies'), [rows, setRows] = useState<any[]>([]), [orgs, setOrgs] = useState<any[]>([]), [members, setMembers] = useState<any[]>([]), [selected, setSelected] = useState<any>(null), [values, setValues] = useState<any>({}), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [search, setSearch] = useState(''), [preview, setPreview] = useState<any>(null);
    const epoch = useRef(0), errorRef = useRef<HTMLParagraphElement>(null);
    async function load() { const id = ++epoch.current; setBusy(true); try {
        const [data, organizations, memberships] = await Promise.all([client.list(page), client.list('organizations'), client.list('memberships')]);
        if (id === epoch.current) {
            setRows(data);
            setOrgs(organizations);
            setMembers(memberships);
        }
    }
    catch (e) {
        if (id === epoch.current)
            setError(e instanceof Error ? e.message : String(e));
    }
    finally {
        if (id === epoch.current)
            setBusy(false);
    } }
    useEffect(() => { void load(); return () => { epoch.current++; }; }, [page, client]);
    useEffect(() => { onDirty(editing, save); }, [editing, values, selected]);
    useEffect(() => { if (error)
        errorRef.current?.focus(); }, [error]);
    function navigate(next: OrgResource) { if (editing && !window.confirm(adminText('text_c88de5baec57')))
        return; setPage(next); setEditing(false); setSelected(null); setError(''); setPreview(null); window.history.pushState(null, '', '/admin/' + (next === 'transfers' ? 'ownership-transfers' : next)); }
    function edit(row?: any) { setError(''); setSelected(row || null); setEditing(true); setValues(row ? { ...row } : page === 'companies' ? { code: '', name: '', countryCode: 'US', templateCode: 'GLOBAL', defaultLocale: 'en-US', currency: 'USD', timezone: 'America/New_York', active: true } : page === 'organizations' ? { code: '', name: '', type: 'TEAM', parentId: null, managerMembershipId: null, active: true } : page === 'users' ? { loginId: '', name: '', email: '', organizationId: null, role: 'SALES' } : {}); }
    async function run(fn: () => Promise<void>) { setBusy(true); setError(''); try {
        await fn();
        await load();
        return true;
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
    }
    finally {
        setBusy(false);
    } }
    async function save() { return run(async () => { let body: any, op: string; if (page === 'companies') {
        op = selected ? 'company.update' : 'company.create';
        body = selected ? { revision: selected.revision, name: values.name, defaultLocale: values.defaultLocale, currency: values.currency, timezone: values.timezone } : values;
    }
    else if (page === 'organizations') {
        op = selected ? 'organization.update' : 'organization.create';
        body = { name: values.name, type: values.type, parentId: values.parentId || null, managerMembershipId: values.managerMembershipId || null, active: values.active, ...(selected ? { revision: selected.revision } : { code: values.code }) };
    }
    else if (page === 'users') {
        op = selected ? 'user.update' : 'user.create';
        body = selected ? { revision: selected.revision, name: values.name, email: values.email, active: values.active } : values;
    }
    else if (page === 'memberships') {
        op = selected ? 'membership.update' : 'membership.create';
        body = selected ? { revision: selected.revision, organizationId: values.organizationId || null, active: values.active } : { userId: values.userId, organizationId: values.organizationId || null, role: values.role || 'SALES' };
    }
    else
        return; await client.command(op, body, selected?.id); setEditing(false); setSelected(null); }); }
    const text = (key: string, label: string, type = 'text', disabled = false) => <label style={{ display: 'grid', gap: 5 }}>{label}<input aria-label={label} type={type} value={values[key] ?? ''} disabled={disabled} onChange={e => setValues({ ...values, [key]: e.target.value })} required/></label>;
    const select = (key: string, label: string, options: {
        value: string;
        label: string;
    }[]) => <label style={{ display: 'grid', gap: 5 }}>{label}<select aria-label={label} value={values[key] ?? ''} onChange={e => setValues({ ...values, [key]: e.target.value || null })}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
    return <section><nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>{(Object.keys(names) as OrgResource[]).map(p => <button key={p} onClick={() => navigate(p)} aria-current={page === p ? 'page' : undefined}>{names[p]}</button>)}</nav><h2>{names[page]}{adminText('text_00c15e198e27')}</h2>{error && <p role="alert" ref={errorRef} tabIndex={-1}>{error}{adminText('text_85576018d8b1')}</p>}
 {page === 'transfers' ? <><label>{adminText('text_45340f8e083f')}<select aria-label={adminText('text_45340f8e083f')} value={values.source || ''} onChange={e => { setValues({ ...values, source: e.target.value }); setPreview(null); }}><option value="">{adminText('text_8d1a750c9351')}</option>{members.map(m => <option key={m.id} value={m.id}>{m.role} · {m.userId}</option>)}</select></label><label>{adminText('text_56e61ecf57e2')}<select aria-label={adminText('text_56e61ecf57e2')} value={values.target || ''} onChange={e => { setValues({ ...values, target: e.target.value }); setPreview(null); }}><option value="">{adminText('text_8d1a750c9351')}</option>{members.map(m => <option key={m.id} value={m.id}>{m.role} · {m.userId}</option>)}</select></label><fieldset><legend>{adminText('text_afd195aadc41')}</legend>{['accounts', 'leads', 'opportunities', 'contracts', 'orders'].map(entity => <label key={entity}><input type="checkbox" checked={(values.entityTypes || ['accounts']).includes(entity)} onChange={e => { const current = values.entityTypes || ['accounts']; setValues({ ...values, entityTypes: e.target.checked ? [...current, entity] : current.filter((x: string) => x !== entity) }); setPreview(null); }}/>{entity}</label>)}</fieldset><label>{adminText('text_07b17dc0d3b1')}<textarea aria-label={adminText('text_7b50e73be751')} value={values.recordFilter || ''} onChange={e => { setValues({ ...values, recordFilter: e.target.value }); setPreview(null); }}/></label><button disabled={busy || !values.source || !values.target} onClick={() => void run(async () => setPreview((await client.command('transfer.preview', { source: values.source, target: values.target, entityTypes: values.entityTypes || ['accounts'], ...(values.recordFilter ? { recordIds: values.recordFilter.split(/[\s,]+/).filter(Boolean) } : {}) })).data))}>{adminText('text_63b5e48af724')}</button>{preview && <div><p>{adminText('text_e42cd77c217c')}{preview.items.length}{adminText('text_39dfc3e17f6e')}</p>{text('reason', adminText('text_cbc38ba5ca3d'))}<button disabled={busy || !values.reason} onClick={() => void run(async () => { await client.command('transfer.execute', { snapshotId: preview.id, reason: values.reason }); setPreview(null); })}>{adminText('text_7d4367e8b2b9')}</button></div>}</> : <><input aria-label={adminText('text_3e8e1ee3146b')} placeholder={adminText('text_7478bcf038c5')} value={search} onChange={e => setSearch(e.target.value)}/><button disabled={busy} onClick={() => void load()}>{adminText('text_5b1506e16bb1')}</button>{(page !== 'memberships' || client.actor.role === 'PLATFORM_ADMIN') && <button disabled={busy} onClick={() => edit()}>{adminText('text_c438d72ec151')}{names[page]}</button>}</>}
 <table style={{ width: '100%', marginTop: 16 }}><thead><tr><th>{adminText('text_6cf136cde9d8')}</th><th>{adminText('text_e10195a1239f')}</th><th>Revision</th><th>{adminText('text_01dfd369cfa7')}</th></tr></thead><tbody>{rows.filter(r => (String(r.name || r.loginId || r.code || r.userId || r.id)).toLowerCase().includes(search.toLowerCase())).map(row => <tr key={row.id}><td>{row.code || row.loginId || row.role || row.id} {row.name}</td><td>{row.status || (row.active ? adminText('text_d9ba6551c71e') : adminText('text_92cdef3c5bc0'))}{row.successCount !== undefined && (adminText('text_f009a42c9fa4') + (row.successCount) + adminText('text_cd0cd224687e') + (row.conflictCount) + "")}</td><td>{row.revision}{page === 'transfers' && row.results && <details><summary>{adminText('text_81f9744220a7')}</summary><ul>{row.results.map((r: any) => <li key={r.id}>{r.entity} · {r.id} · {r.status}</li>)}</ul></details>}</td><td>{page === 'companies' && <button disabled={busy} onClick={() => { const reason = window.prompt(adminText('text_db075df464d4')); if (reason)
        void run(async () => { await client.command(row.active ? 'company.deactivate' : 'company.reactivate', { revision: row.revision, reason }, row.id); }); }}>{row.active ? adminText('text_92cdef3c5bc0') : adminText('text_422cd7e0f5a9')}</button>}{page !== 'transfers' && <button disabled={busy} onClick={() => edit(row)}>{adminText('text_87b0acef85a7')}</button>}</td></tr>)}</tbody></table>
 {editing && <form onSubmit={e => { e.preventDefault(); void save(); }} style={{ display: 'grid', gap: 12, padding: 20, border: '1px solid #cbd5e1', marginTop: 20 }}><h3>{selected ? adminText('text_87b0acef85a7') : adminText('text_db1b1653b96b')}</h3>
 {page === 'companies' && <>{text('code', adminText('text_722aa32f3da5'), 'text', !!selected)}{text('name', adminText('text_6bb977cc7fd9'))}{text('countryCode', adminText('text_10a6c77fd1f3'), 'text', !!selected)}{select('templateCode', adminText('text_203cc67e9f10'), [{ value: 'HQ', label: 'HQ' }, { value: 'GLOBAL', label: 'GLOBAL' }])}{select('defaultLocale', adminText('text_489e872c77a4'), [{ value: 'ko-KR', label: adminText('text_ea3252281bc3') }, { value: 'en-US', label: 'English' }])}{text('currency', adminText('text_1566f907a6ca'))}{text('timezone', adminText('text_26e997a5196c'))}{selected && <><button type="button" disabled={busy} onClick={() => void run(async () => setPreview((await client.command('template.preview', { templateCode: values.templateCode, expectedRevision: selected.revision }, selected.id)).data))}>{adminText('text_0b3258776cf1')}</button>{preview && <div><p>{adminText('text_92284cb56425')}{preview.templateCode}{adminText('text_c62d6a1ea9e4')}{preview.companyRevision}{adminText('text_dfb8aecff01b')}</p><button type="button" disabled={busy} onClick={() => { const reason = window.prompt(adminText('text_00276cffa845')); if (reason)
            void run(async () => { await client.command('template.apply', { previewId: preview.id, revision: selected.revision, reason }, selected.id); setPreview(null); }); }}>{adminText('text_78ac5dedbc12')}</button></div>}</>}</>}
 {page === 'organizations' && <>{text('code', adminText('text_38bac461c17c'), 'text', !!selected)}{text('name', adminText('text_5086d9f969ea'))}{select('type', adminText('text_7d9555bd9e01'), ['DIVISION', 'DEPARTMENT', 'TEAM'].map(x => ({ value: x, label: x })))}{select('parentId', adminText('text_347260c85cd4'), [{ value: '', label: adminText('text_d8b14d7ac509') }, ...orgs.map(o => ({ value: o.id, label: o.name }))])}{select('managerMembershipId', adminText('text_63b70f4b4d3d'), [{ value: '', label: adminText('text_050d981c6c43') }, ...members.map(m => ({ value: m.id, label: m.role + ' ' + m.userId }))])}</>}
 {page === 'users' && <>{text('loginId', adminText('text_85f6a450a02d'), 'text', !!selected)}{text('name', adminText('text_cb2408aec4ed'))}{text('email', adminText('text_3b7dbc4c0c4c'), 'email')}{!selected && <>{select('organizationId', adminText('text_65e425a15b2d'), [{ value: '', label: adminText('text_050d981c6c43') }, ...orgs.map(o => ({ value: o.id, label: o.name }))])}{select('role', adminText('text_a5983af9a960'), ['SALES', 'MANAGER', 'COMPANY_ADMIN'].map(x => ({ value: x, label: x })))}</>}</>}
 {page === 'memberships' && <>{!selected && <>{text('userId', adminText('text_6d813dbfb268'))}{select('role', adminText('text_84d807f561cd'), ['SALES', 'MANAGER', 'COMPANY_ADMIN'].map(x => ({ value: x, label: x })))}</>}{select('organizationId', adminText('text_04575d921ecd'), [{ value: '', label: adminText('text_050d981c6c43') }, ...orgs.map(o => ({ value: o.id, label: o.name }))])}</>}
 {(page !== 'companies' && (selected || page === 'organizations')) && <label><input type="checkbox" checked={!!values.active} onChange={e => setValues({ ...values, active: e.target.checked })}/>{adminText('text_d9ba6551c71e')}</label>}<div><button disabled={busy}>{adminText('text_5fb926229090')}</button><button type="button" disabled={busy} onClick={() => setEditing(false)}>{adminText('text_be876433993a')}</button></div></form>}
 </section>;
}
