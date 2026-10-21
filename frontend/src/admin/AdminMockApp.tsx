import React, { useMemo, useState } from 'react';
import { COMPANY_IDS, DraftInput } from '@dio-crm/contracts/admin';
import { AdminClient, BrowserMockAdminClient, HttpAdminClient } from './client/admin-client';
import { BrowserAdminRepository } from './client/browser-repository';

/** A01 adapter verification surface. Full administration pages are added in later stages. */
export default function AdminMockApp({mode}:{mode:'API_MOCK'|'BROWSER_MOCK'}) {
 const [company,setCompany]=useState<keyof typeof COMPANY_IDS>('US_A');
 const [token,setToken]=useState('');
 const [loginId,setLoginId]=useState('admin1');
 const [password,setPassword]=useState('');
 const [rows,setRows]=useState<any[]>([]);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [enabled,setEnabled]=useState(false);
 const client:AdminClient=useMemo(()=>mode==='BROWSER_MOCK'
  ?new BrowserMockAdminClient(new BrowserAdminRepository(),{companyId:COMPANY_IDS[company],userId:'browser-demo-admin-'+company,platformAdmin:false,canConfigure:true})
  :new HttpAdminClient(import.meta.env.VITE_ADMIN_API_URL??'http://127.0.0.1:3001',()=>token),[mode,company,token]);
 async function run(action:()=>Promise<void>){setBusy(true);setError('');try{await action()}catch(e:any){setError(`${e.status??''} ${e.code??e.message}`)}finally{setBusy(false)}}
 async function login(){const response=await fetch((import.meta.env.VITE_ADMIN_API_URL??'http://127.0.0.1:3001')+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({homeCompanyCode:company,loginId,password})});const result=await response.json();if(!response.ok)throw result;setToken(result.accessToken);setPassword('')}
 async function save(){const body:DraftInput={scope:'COMPANY',scopeKey:COMPANY_IDS[company],domain:'FEATURE',stableKey:'a01-verification',schemaVersion:1,parentVersionIds:[],overrides:[{op:'SET',path:[{property:'items'},{itemKey:'account'},{property:'enabled'}],value:enabled}]};const current=(await client.listDrafts()).find(row=>row.stableKey===body.stableKey);if(current)await client.updateDraft(current.id,{revision:current.revision,overrides:body.overrides});else await client.createDraft(body);setRows(await client.listDrafts())}
 return <main style={{maxWidth:840,margin:'40px auto',padding:24}}>
  <h1>관리자 목업 실행 기반</h1>
  <p>{mode} · A01 저장 계약 검증</p>
  <p role="note">{mode==='BROWSER_MOCK'?'브라우저 로컬 시연입니다. 실제 인증·권한 보호를 제공하지 않습니다.':'독립 목업 API를 사용합니다. 실제 ERP 및 운영 데이터에 연결하지 않습니다.'}</p>
  <label>시연 법인 <select aria-label="시연 법인" value={company} disabled={busy} onChange={e=>{setCompany(e.target.value as keyof typeof COMPANY_IDS);setRows([]);setToken('');setError('')}}>{Object.keys(COMPANY_IDS).map(code=><option key={code}>{code}</option>)}</select></label>
  {mode==='API_MOCK'&&!token&&<form onSubmit={e=>{e.preventDefault();void run(login)}}>
   <label>아이디 <input value={loginId} onChange={e=>setLoginId(e.target.value)} autoComplete="username"/></label>
   <label>비밀번호 <input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>
   <button disabled={busy}>목업 로그인</button>
  </form>}
  {(mode==='BROWSER_MOCK'||token)&&<section>
   <h2>기능 설정 초안</h2>
   <p>이 화면은 저장 어댑터 검증용입니다. 게시 및 업무 화면 적용은 아직 구현되지 않았습니다.</p>
   <label><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>거래처 기능 활성화</label>
   <button disabled={busy} onClick={()=>void run(save)}>초안 저장</button>
   <button disabled={busy} onClick={()=>void run(async()=>setRows(await client.listDrafts()))}>초안 조회</button>
   <ul>{rows.map(row=><li key={row.id}>{row.stableKey} · revision {row.revision} · {JSON.stringify(row.overrides)}</li>)}</ul>
  </section>}
  {error&&<p role="alert">{error}</p>}
 </main>
}
