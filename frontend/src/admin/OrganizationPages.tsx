import React, { useEffect, useRef, useState } from 'react';
import { OrganizationClient, OrgResource } from './client/organization-client';
const names: Record<OrgResource, string> = { companies: '법인', organizations: '조직', users: '사용자', memberships: '소속', transfers: '담당자 이관' };
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
    function navigate(next: OrgResource) { if (editing && !window.confirm('저장하지 않은 입력을 폐기하고 이동하시겠습니까?'))
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
    return <section><nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>{(Object.keys(names) as OrgResource[]).map(p => <button key={p} onClick={() => navigate(p)} aria-current={page === p ? 'page' : undefined}>{names[p]}</button>)}</nav><h2>{names[page]} 관리</h2>{error && <p role="alert" ref={errorRef} tabIndex={-1}>{error} · 입력은 유지됩니다. 충돌이면 취소 후 최신 목록에서 다시 편집하세요.</p>}
 {page === 'transfers' ? <><label>기존 담당 소속<select aria-label="기존 담당 소속" value={values.source || ''} onChange={e => { setValues({ ...values, source: e.target.value }); setPreview(null); }}><option value="">선택</option>{members.map(m => <option key={m.id} value={m.id}>{m.role} · {m.userId}</option>)}</select></label><label>신규 담당 소속<select aria-label="신규 담당 소속" value={values.target || ''} onChange={e => { setValues({ ...values, target: e.target.value }); setPreview(null); }}><option value="">선택</option>{members.map(m => <option key={m.id} value={m.id}>{m.role} · {m.userId}</option>)}</select></label><fieldset><legend>이관 업무</legend>{['accounts', 'leads', 'opportunities', 'contracts', 'orders'].map(entity => <label key={entity}><input type="checkbox" checked={(values.entityTypes || ['accounts']).includes(entity)} onChange={e => { const current = values.entityTypes || ['accounts']; setValues({ ...values, entityTypes: e.target.checked ? [...current, entity] : current.filter((x: string) => x !== entity) }); setPreview(null); }}/>{entity}</label>)}</fieldset><label>선택 레코드 UUID (비우면 전체)<textarea aria-label="선택 레코드 UUID" value={values.recordFilter || ''} onChange={e => { setValues({ ...values, recordFilter: e.target.value }); setPreview(null); }}/></label><button disabled={busy || !values.source || !values.target} onClick={() => void run(async () => setPreview((await client.command('transfer.preview', { source: values.source, target: values.target, entityTypes: values.entityTypes || ['accounts'], ...(values.recordFilter ? { recordIds: values.recordFilter.split(/[\s,]+/).filter(Boolean) } : {}) })).data))}>이관 미리보기</button>{preview && <div><p>거래처 {preview.items.length}건 · 승인 과제는 변경하지 않습니다.</p>{text('reason', '이관 사유')}<button disabled={busy || !values.reason} onClick={() => void run(async () => { await client.command('transfer.execute', { snapshotId: preview.id, reason: values.reason }); setPreview(null); })}>이관 실행</button></div>}</> : <><input aria-label="목록 검색" placeholder="이름·코드 검색" value={search} onChange={e => setSearch(e.target.value)}/><button disabled={busy} onClick={() => void load()}>목록 갱신</button>{(page !== 'memberships' || client.actor.role === 'PLATFORM_ADMIN') && <button disabled={busy} onClick={() => edit()}>신규 {names[page]}</button>}</>}
 <table style={{ width: '100%', marginTop: 16 }}><thead><tr><th>코드 / 이름</th><th>상태</th><th>Revision</th><th>작업</th></tr></thead><tbody>{rows.filter(r => (String(r.name || r.loginId || r.code || r.userId || r.id)).toLowerCase().includes(search.toLowerCase())).map(row => <tr key={row.id}><td>{row.code || row.loginId || row.role || row.id} {row.name}</td><td>{row.status || (row.active ? '활성' : '중지')}{row.successCount !== undefined && ` 성공 ${row.successCount} / 충돌 ${row.conflictCount}`}</td><td>{row.revision}{page === 'transfers' && row.results && <details><summary>레코드별 결과</summary><ul>{row.results.map((r: any) => <li key={r.id}>{r.entity} · {r.id} · {r.status}</li>)}</ul></details>}</td><td>{page === 'companies' && <button disabled={busy} onClick={() => { const reason = window.prompt('상태 변경 사유'); if (reason)
        void run(async () => { await client.command(row.active ? 'company.deactivate' : 'company.reactivate', { revision: row.revision, reason }, row.id); }); }}>{row.active ? '중지' : '재개'}</button>}{page !== 'transfers' && <button disabled={busy} onClick={() => edit(row)}>편집</button>}</td></tr>)}</tbody></table>
 {editing && <form onSubmit={e => { e.preventDefault(); void save(); }} style={{ display: 'grid', gap: 12, padding: 20, border: '1px solid #cbd5e1', marginTop: 20 }}><h3>{selected ? '편집' : '신규 등록'}</h3>
 {page === 'companies' && <>{text('code', '법인 코드', 'text', !!selected)}{text('name', '법인명')}{text('countryCode', '국가', 'text', !!selected)}{select('templateCode', '템플릿', [{ value: 'HQ', label: 'HQ' }, { value: 'GLOBAL', label: 'GLOBAL' }])}{select('defaultLocale', '기본 언어', [{ value: 'ko-KR', label: '한국어' }, { value: 'en-US', label: 'English' }])}{text('currency', '통화')}{text('timezone', '시간대')}{selected && <><button type="button" disabled={busy} onClick={() => void run(async () => setPreview((await client.command('template.preview', { templateCode: values.templateCode, expectedRevision: selected.revision }, selected.id)).data))}>템플릿 영향 분석</button>{preview && <div><p>대상 템플릿: {preview.templateCode} · 현재 revision: {preview.companyRevision} · 적용은 초안 작성이며 게시가 아닙니다.</p><button type="button" disabled={busy} onClick={() => { const reason = window.prompt('템플릿 변경 사유'); if (reason)
            void run(async () => { await client.command('template.apply', { previewId: preview.id, revision: selected.revision, reason }, selected.id); setPreview(null); }); }}>템플릿 변경 초안 생성</button></div>}</>}</>}
 {page === 'organizations' && <>{text('code', '조직 코드', 'text', !!selected)}{text('name', '조직명')}{select('type', '조직 유형', ['DIVISION', 'DEPARTMENT', 'TEAM'].map(x => ({ value: x, label: x })))}{select('parentId', '상위 조직', [{ value: '', label: '최상위' }, ...orgs.map(o => ({ value: o.id, label: o.name }))])}{select('managerMembershipId', '조직 관리자', [{ value: '', label: '미지정' }, ...members.map(m => ({ value: m.id, label: m.role + ' ' + m.userId }))])}</>}
 {page === 'users' && <>{text('loginId', '사용자 ID', 'text', !!selected)}{text('name', '사용자명')}{text('email', '이메일', 'email')}{!selected && <>{select('organizationId', '조직', [{ value: '', label: '미지정' }, ...orgs.map(o => ({ value: o.id, label: o.name }))])}{select('role', '시연 역할', ['SALES', 'MANAGER', 'COMPANY_ADMIN'].map(x => ({ value: x, label: x })))}</>}</>}
 {page === 'memberships' && <>{!selected && <>{text('userId', '기존 사용자 UUID')}{select('role', '소속 역할', ['SALES', 'MANAGER', 'COMPANY_ADMIN'].map(x => ({ value: x, label: x })))}</>}{select('organizationId', '소속 조직', [{ value: '', label: '미지정' }, ...orgs.map(o => ({ value: o.id, label: o.name }))])}</>}
 {(page !== 'companies' && (selected || page === 'organizations')) && <label><input type="checkbox" checked={!!values.active} onChange={e => setValues({ ...values, active: e.target.checked })}/>활성</label>}<div><button disabled={busy}>저장</button><button type="button" disabled={busy} onClick={() => setEditing(false)}>취소</button></div></form>}
 </section>;
}
