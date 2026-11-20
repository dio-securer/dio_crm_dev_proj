import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost } from '../api';
import { useHqMock } from './HqMockProvider';
import { Activity, ClipboardList, Code2, Home, Network, ShieldCheck, Users, UserRoundPlus, Building2, BriefcaseBusiness, FileSignature, ShoppingCart, Clock3 } from 'lucide-react';
import { WorkspaceHeading } from './WorkspaceHeading';

type RecordValue = Record<string, unknown>;
function useAdminData<T>(key: string, path: string) {
  const { session } = useHqMock();
  return useQuery<T>({ queryKey: ['h07', key, session?.user.loginId], queryFn: () => apiGet<T>(path), enabled: !!session });
}
function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  const icons: Record<string, typeof Home> = { '본사 홈': Home, '운영 상태': Activity, '사용자·조직': Users, '권한·본사 표준': ShieldCheck, '공통코드': Code2, '연계 모니터': Network, '감사 이력': ClipboardList };
  return <main className="hq-admin-page"><WorkspaceHeading icon={icons[title] ?? Home}>{title}</WorkspaceHeading>{children}</main>;
}
function Status({ error, message }: { error?: unknown; message?: string }) {
  return <>{error && <p role="alert">{error instanceof Error ? error.message : String(error)}</p>}{message && <p role="status">{message}</p>}</>;
}
function DataTable({ rows, columns }: { rows: RecordValue[]; columns: string[] }) {
  return <div style={{ overflowX: 'auto' }}><table><thead><tr>{columns.map(key => <th key={key} scope="col">{key}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={String(row.public_id ?? row.userId ?? row.requestId ?? index)}>{columns.map(key => <td key={key}>{Array.isArray(row[key]) ? row[key].join(', ') : String(row[key] ?? '')}</td>)}</tr>)}</tbody></table></div>;
}
export function HqHomePage() {
  const data = useAdminData<{ counts: Record<string, number>; pendingReports: number }>('home', '/api/hq/home');
  const labels: Record<string, string> = { leads: '리드', accounts: '거래처', opportunities: '영업기회', contracts: '계약', orders: '주문' };
  const icons: Record<string, typeof Home> = { leads: UserRoundPlus, accounts: Building2, opportunities: BriefcaseBusiness, contracts: FileSignature, orders: ShoppingCart };
  return <Frame title="본사 홈"><Status error={data.error} /><button disabled={data.isFetching} onClick={() => void data.refetch()}>새로 고침</button>
    {data.isPending ? <p>불러오는 중…</p> : data.data && <><p>본사 업무 현황</p>
    <div className="hq-home-metrics" aria-label="본사 업무 현황">{Object.entries(data.data.counts).map(([name, count]) => { const Icon = icons[name] ?? Activity; return <article key={name}><span className="hq-home-metric-label"><i><Icon size={19} aria-hidden="true" /></i>{labels[name] ?? name}</span><strong>{count.toLocaleString()}건</strong></article>; })}<article><span className="hq-home-metric-label"><i><Clock3 size={19} aria-hidden="true" /></i>승인 대기 활동보고</span><strong>{data.data.pendingReports.toLocaleString()}건</strong></article></div></>}</Frame>;
}
export function HqMockOpsPage() {
  const data = useAdminData<{ datasetId: string; generation: number; revision: number; counts: Record<string, number>; outboundCalls: number; database: { status: string } }>('ops', '/api/ops/status');
  return <Frame title="운영 상태"><Status error={data.error} />
    {data.isPending ? <p>불러오는 중…</p> : <>
      <p>데이터셋: {data.data?.datasetId} · 세대: {data.data?.generation} · 버전: {data.data?.revision}</p>
      <p>저장소: {data.data?.database.status} · 외부 송신 시도: {data.data?.outboundCalls ?? 0}</p>
      <DataTable rows={Object.entries(data.data?.counts ?? {}).map(([name, count]) => ({ name, count }))} columns={['name', 'count']} />
      <button type="button" onClick={() => void data.refetch()}>새로고침</button>
    </>}
  </Frame>;
}
export function HqAdminUsersPage() {
  const client = useQueryClient();
  const users = useAdminData<RecordValue[]>('users', '/api/hq/admin/users');
  const orgs = useAdminData<RecordValue[]>('organizations', '/api/hq/admin/organizations');
  const [userId, setUserId] = useState(''); const [name, setName] = useState(''); const [organizationId, setOrganizationId] = useState(''); const [userActive, setUserActive] = useState(true);
  const [orgId, setOrgId] = useState(''); const [orgName, setOrgName] = useState(''); const [orgActive, setOrgActive] = useState(true);
  const [message, setMessage] = useState(''); const [error, setError] = useState<unknown>();
  async function save(path: string, body: RecordValue) {
    try { await apiPatch(path, body); await client.invalidateQueries({ queryKey: ['h07'] }); setMessage('저장했습니다.'); setError(undefined); }
    catch (reason) { setError(reason); setMessage(''); }
  }
  return <Frame title="사용자·조직"><Status error={error ?? users.error ?? orgs.error} message={message} />
    <h2>사용자</h2><DataTable rows={users.data ?? []} columns={['userId','loginId','name','organizationId','roles','scope','active']} />
    <form onSubmit={e => { e.preventDefault(); void save(`/api/hq/admin/users/${userId}`, {name,organizationId:Number(organizationId),active:userActive}); }}>
      <label>사용자 ID <input required value={userId} onChange={e=>{setUserId(e.target.value);const row=users.data?.find(x=>String(x.userId)===e.target.value);if(row){setName(String(row.name??''));setOrganizationId(String(row.organizationId??''));setUserActive(row.active!==false);}}} /></label>{' '}
      <label>이름 <input required value={name} onChange={e=>setName(e.target.value)} /></label>{' '}
      <label>조직 ID <input required type="number" value={organizationId} onChange={e=>setOrganizationId(e.target.value)} /></label>{' '}
      <label>사용 여부 <select value={String(userActive)} onChange={e=>setUserActive(e.target.value==='true')}><option value="true">사용</option><option value="false">미사용</option></select></label>{' '}
      <button type="submit">사용자 저장</button></form>
    <h2>조직</h2><DataTable rows={orgs.data ?? []} columns={['organization_id','organization_name','active']} />
    <form onSubmit={e => { e.preventDefault(); void save(`/api/hq/admin/organizations/${orgId}`, {name:orgName,active:orgActive}); }}>
      <label>조직 ID <input required value={orgId} onChange={e=>{setOrgId(e.target.value);const row=orgs.data?.find(x=>String(x.organization_id)===e.target.value);if(row){setOrgName(String(row.organization_name??''));setOrgActive(row.active!==false);}}} /></label>{' '}
      <label>조직명 <input required value={orgName} onChange={e=>setOrgName(e.target.value)} /></label>{' '}
      <label>사용 여부 <select value={String(orgActive)} onChange={e=>setOrgActive(e.target.value==='true')}><option value="true">사용</option><option value="false">미사용</option></select></label>{' '}
      <button type="submit">조직 저장</button></form>
  </Frame>;
}
type StandardState = { published: RecordValue; draft: RecordValue; history: Array<{ index: number; version: string }>; companySnapshot: RecordValue | null };
export function HqAdminPermissionsPage() {
  const client=useQueryClient(); const roles=useAdminData<RecordValue[]>('roles','/api/hq/admin/roles');
  const standard=useAdminData<StandardState>('standard','/api/hq/admin/standard');
  const [roleKey,setRoleKey]=useState('');const [permissions,setPermissions]=useState('');const [scope,setScope]=useState('SELF');
  const [draft,setDraft]=useState('');const [override,setOverride]=useState('');
  const [message,setMessage]=useState('');const [error,setError]=useState<unknown>();
  async function run(task:()=>Promise<unknown>) {try {const result=await task();setMessage(JSON.stringify(result));setError(undefined);await client.invalidateQueries({queryKey:['h07']});await client.invalidateQueries({queryKey:['hq-menu']});}catch(reason){setError(reason);setMessage('');}}
  const published=standard.data?.published;
  return <Frame title="권한·본사 표준"><Status error={error ?? roles.error ?? standard.error} message={message} />
    <h2>역할과 권한</h2><DataTable rows={roles.data??[]} columns={['roleKey','userId','scope','permissions']} />
    <form onSubmit={e=>{e.preventDefault();void run(()=>apiPatch(`/api/hq/admin/roles/${roleKey}`,{permissions:permissions.split(',').map(x=>x.trim()).filter(Boolean),scope}));}}>
      <label>역할 <select required value={roleKey} onChange={e=>{setRoleKey(e.target.value);const selected=(roles.data??[]).find(x=>x.roleKey===e.target.value);setPermissions(selected?.permissions?.toString()??'');setScope(String(selected?.scope??'SELF'));}}><option value="">선택</option>{roles.data?.map(x=><option key={String(x.roleKey)} value={String(x.roleKey)}>{String(x.roleKey)}</option>)}</select></label>{' '}
      <label>권한(쉼표 구분) <input style={{minWidth:320}} value={permissions} onChange={e=>setPermissions(e.target.value)} /></label>{' '}
      <label>범위 <select value={scope} onChange={e=>setScope(e.target.value)}>{['SELF','BRANCH','DIVISION','ALL','SYSTEM'].map(x=><option key={x}>{x}</option>)}</select></label>{' '}
      <button type="submit">권한 저장</button></form>
    <h2>게시 표준</h2><p>현재 버전: {String(published?.version??'')}</p>
    <label>작업본 JSON<textarea style={{display:'block',width:'100%',minHeight:170}} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="작업본 JSON을 붙여넣으세요" /></label>
    <button type="button" onClick={()=>setDraft(JSON.stringify(standard.data?.draft??{},null,2))}>현재 작업본 불러오기</button>{' '}
    <button type="button" onClick={()=>void run(()=>apiPost('/api/hq/admin/standard/preview',{standard:JSON.parse(draft)}))}>미리보기</button>{' '}
    <button type="button" onClick={()=>void run(()=>apiPost('/api/hq/admin/standard/draft',{standard:JSON.parse(draft)}))}>작업본 저장</button>{' '}
    <button type="button" onClick={()=>void run(()=>apiPost('/api/hq/admin/standard/publish',{expectedVersion:published?.version}))}>게시</button>
    <h3>이전 게시본</h3>{standard.data?.history.map(x=><button type="button" key={x.index} onClick={()=>void run(()=>apiPost('/api/hq/admin/standard/restore',{index:x.index}))}>{x.version} 복원</button>)}
    <h2>회사별 오버라이드</h2><p>현재 스냅샷: {standard.data?.companySnapshot ? '적용됨' : '없음'}</p>
    <label>오버라이드 JSON<textarea style={{display:'block',width:'100%',minHeight:120}} value={override} onChange={e=>setOverride(e.target.value)} placeholder="{&quot;overrideKey&quot;:&quot;...&quot;,&quot;parentStandardKey&quot;:&quot;...&quot;,&quot;parentVersion&quot;:&quot;...&quot;,&quot;patches&quot;:[]}" /></label>
    <button type="button" onClick={()=>void run(()=>apiPost('/api/hq/admin/override/preview',{override:JSON.parse(override)}))}>적용 미리보기</button>{' '}
    <button type="button" onClick={()=>void run(()=>apiPost('/api/hq/admin/override/apply',{override:JSON.parse(override)}))}>회사 스냅샷 적용</button>{' '}
    <button type="button" onClick={()=>void run(()=>apiPost('/api/hq/admin/override/clear',{}))}>회사 스냅샷 해제</button>
  </Frame>;
}
export function HqAdminCodesPage() {
  const client=useQueryClient();const data=useAdminData<Record<string,RecordValue[]>>('codes','/api/hq/admin/common-codes');
  const [groupCode,setGroupCode]=useState('');const [code,setCode]=useState('');const [label,setLabel]=useState('');const [active,setActive]=useState(true);
  const [message,setMessage]=useState('');const [error,setError]=useState<unknown>();
  return <Frame title="공통코드"><Status error={error??data.error} message={message}/>
    {Object.entries(data.data??{}).map(([group,rows])=><section key={group}><h2>{group}</h2><DataTable rows={rows} columns={['code','label','active']}/></section>)}
    <form onSubmit={e=>{e.preventDefault();void apiPost('/api/hq/admin/common-codes',{groupCode,code,label,active}).then(async()=>{await client.invalidateQueries({queryKey:['h07','codes']});setMessage('저장했습니다.');setError(undefined);}).catch(setError);}}>
      <label>그룹 <input required value={groupCode} onChange={e=>setGroupCode(e.target.value)}/></label>{' '}
      <label>코드 <input required value={code} onChange={e=>setCode(e.target.value)}/></label>{' '}
      <label>표시명 <input required value={label} onChange={e=>setLabel(e.target.value)}/></label>{' '}
      <label>사용 여부 <select value={String(active)} onChange={e=>setActive(e.target.value==='true')}><option value="true">사용</option><option value="false">미사용</option></select></label>{' '}
      <button type="submit">저장</button></form></Frame>;
}
export function HqAdminInterfacesPage() {
  const client=useQueryClient();const data=useAdminData<RecordValue[]>('interfaces','/api/interface-logs');
  const [message,setMessage]=useState('');const [error,setError]=useState<unknown>();
  return <Frame title="연계 모니터"><Status error={error??data.error} message={message}/>
    <DataTable rows={data.data??[]} columns={['requestId','interfaceCode','status','scenario','attempt','respondedAt']}/>
    {(data.data??[]).map(row=><details key={String(row.requestId)}><summary>{String(row.interfaceCode)} · {String(row.status)} · {String(row.requestId)}</summary>
      <pre style={{overflowX:'auto'}}>{JSON.stringify({result:row.result,events:row.events},null,2)}</pre></details>)}
    {(data.data??[]).filter(x=>['FAILED','TIMED_OUT'].includes(String(x.status))).map(x=><button type="button" key={String(x.requestId)} onClick={()=>void apiPost('/api/hq/interfaces/retry',{requestId:x.requestId,idempotencyKey:`h07:${x.requestId}:${Date.now()}`,scenario:'SUCCESS'}).then(async()=>{await client.invalidateQueries({queryKey:['h07','interfaces']});setMessage('재시도 요청을 생성했습니다.');setError(undefined);}).catch(setError)}>{String(x.interfaceCode)} 재시도 · {String(x.requestId)}</button>)}
  </Frame>;
}
export function HqAdminAuditPage() {
  const data=useAdminData<RecordValue[]>('audit','/api/audit-logs');
  const [query,setQuery]=useState('');
  const rows=(data.data??[]).filter(row=>JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  return <Frame title="감사 이력"><Status error={data.error}/>
    <label>이력 검색 <input value={query} onChange={e=>setQuery(e.target.value)} /></label>
    <DataTable rows={rows} columns={['at','action','entityId','actorUserId']}/>
    {rows.map((row,index)=><details key={String(row.public_id??index)}><summary>{String(row.action??'이력')} · {String(row.entityId??'')}</summary><pre style={{overflowX:'auto'}}>{JSON.stringify(row.details??{},null,2)}</pre></details>)}
  </Frame>;
}
