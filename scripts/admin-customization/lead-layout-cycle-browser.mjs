import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer,transformWithEsbuild} from '../../frontend/node_modules/vite/dist/node/index.js';
import '../hq-standard/register.mjs';
const {resolveCompanyConfig,resolveActorPolicy}=await import('../../packages/contracts/src/crm-customization.ts');
const artifact=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-codes-review.json','utf8'));
const companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',releaseId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const entry="import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import '/src/i18n';import {ConfiguredLeads} from '/src/customization/ConfiguredLeads';createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ConfiguredLeads/></QueryClientProvider>);";
const server=await createServer({root:'frontend',resolve:{alias:[{find:'@dio-crm/contracts/crm-customization',replacement:process.cwd()+'/packages/contracts/src/crm-customization.ts'},{find:'@dio-crm/contracts/lead-grid-columns',replacement:process.cwd()+'/packages/contracts/src/lead-grid-columns.ts'},{find:'@dio-crm/contracts',replacement:process.cwd()+'/packages/contracts/src/index.ts'}]},configFile:false,logLevel:'error',plugins:[{name:'grid-test',resolveId:id=>id==='grid-test'?'\0grid-test':undefined,load:id=>id==='\0grid-test'?entry:undefined,transform:(code,id)=>id==='\0grid-test'?transformWithEsbuild(code,'fixture.tsx',{loader:'tsx',jsx:'transform'}):undefined}],server:{host:'127.0.0.1',port:5198,strictPort:true}});
const fixture='frontend/__layout-qa-fixture.html';assert.equal(fs.existsSync(fixture),false);fs.writeFileSync(fixture,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/__x00__grid-test"></script></body></html>');
let browser;const report={checks:[],errors:[]};

const A=companyId,B='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const root=process.env.LEAD_GRID_TEST_URL_ORIGIN ?? 'http://127.0.0.1:3213';
async function api(path, method='GET', body, extras={}) {
 const r=await fetch(root+path,{method,headers:{Authorization:'Bearer W06_SYNTHETIC_ADMIN','Content-Type':'application/json',...extras},body:body&&JSON.stringify(body)});
 const value=await r.json();assert.ok(r.ok,JSON.stringify(value));return value;
}
const state=c=>api('/api/admin/config/drafts?scopeKey='+c);
const original=['lead.hospitalName','lead.status','lead.ownerName','lead.phone','lead.businessNo','lead.keymanMobile','lead.keymanEmail'];
const edited=[original[0],original[6],...original.slice(1,5)];
async function draft(c,order){
 const st=await state(c);let d=st.drafts[0]??await api('/api/admin/config/drafts','POST',{companyId:c,expectedActiveReleaseId:st.activeReleaseId,baseStandardReleaseId:st.releases.at(-1).config.baseStandardReleaseId});
 return api('/api/admin/config/drafts/'+d.id,'PATCH',{...d.config,leadListOrder:order,leadGridColumns:order.filter(k=>k.includes('keyman'))},{'If-Match':'"'+d.revision+'"'});
}
async function publish(c,d){
 const v=await api('/api/admin/config/validate','POST',{companyId:c,draftIds:[d.id],revisions:[d.revision]});assert.deepEqual(v.errors,[]);
 await api('/api/admin/config/preview','POST',{companyId:c,validationId:v.id});
 return api('/api/admin/companies/'+c+'/releases','POST',{companyId:c,validationId:v.id,expectedReleaseId:(await state(c)).activeReleaseId,reason:'layout QA'});
}
async function preview(c,order,width){
 const p=await browser.newPage({viewport:{width,height:900}});try{
 p.setDefaultTimeout(8000);await p.goto(root+'/admin/customization');await p.locator('main select').first().selectOption(c);
 await p.locator('select').filter({has:p.locator('option[value=mobile]')}).selectOption({label:width===390?'모바일 390px':'PC'}); const headers=p.locator('.visual-preview-stage iframe').last().contentFrame().locator('.hq-lead-list thead th');
 await headers.nth(order.length-1).waitFor();
 const actual=await headers.evaluateAll(ns=>ns.map(n=>n.dataset.configId));assert.deepEqual(actual,order);console.log('preview',width,actual.join(','));
 }finally{await p.close();}
}
async function user(c,order,width){
 const release=(await state(c)).releases.at(-1);const cfg=release.config;const releaseId=release.id;
 const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(8000);const queries=[];let size,density,sortDirection;
 await page.route('**/api/**',async route=>{const req=route.request(),url=new URL(req.url()),headers={'Content-Type':'application/json','X-Config-Release-Id':releaseId,'X-Config-Permission-Version':'1'};
  if(url.pathname==='/api/runtime/effective-config'){const effective=resolveCompanyConfig(artifact.catalog,{companyId,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[]});const allowed=[...new Set(artifact.catalog.entries.flatMap(e=>[...e.permissions,...e.readPermissions,...e.writePermissions]))];const policy=resolveActorPolicy(effective,companyId,{authenticated:true,companyId,allowed,denied:[]});const labels=Object.fromEntries(effective.entries.filter(e=>policy.find(p=>p.id===e.id)?.readable).map(e=>[e.id,artifact.translations['ko-KR'][e.labelKey]]));return route.fulfill({headers,json:{releaseId,permissionVersion:1,leadExtensionsEnabled:false,leadListOrder:cfg.leadListOrder,leadGridColumns:cfg.leadGridColumns,policy,labels,translations:artifact.translations['ko-KR'],...(size?{leadColumnWidths:{schemaVersion:1,values:{'lead.hospitalName':{mode:'min',widthPx:320}}},leadColumnAlignments:{schemaVersion:1,values:{'lead.hospitalName':'center'}},leadGrid:{schemaVersion:1,pageSize:size,density,...(sortDirection?{defaultSort:{fieldId:'lead.updatedAt',direction:sortDirection}}:{})}}:{})}});}
  if(url.pathname==='/api/leads'){const offset=Number(url.searchParams.get('offset')),limit=Number(url.searchParams.get('limit'));queries.push({offset,limit,keys:[...url.searchParams.keys()].sort()});const rows=Array.from({length:offset===0?limit:1},(_,i)=>{const index=offset+(sortDirection==='desc'?limit-1-i:i);return {public_id:`00000000-0000-4000-8000-${String(index).padStart(12,'0')}`,keyman_email:'qa@example.invalid',keyman_mobile:'010-QA',hospital_name:`병원 ${index}`,status:'NEW'};});return route.fulfill({headers,json:rows});}return route.fulfill({status:404,headers,json:{}});
 });

 try {await page.goto('http://127.0.0.1:5198/__layout-qa-fixture.html');await page.getByText('병원 0',{exact:true}).waitFor();
 const cells=await page.locator('.table-scroll tbody tr').first().locator('td').allTextContents();
 assert.equal(cells.indexOf('qa@example.invalid'),order.indexOf('lead.keymanEmail'));assert.equal(cells.indexOf('010-QA'),order.indexOf('lead.keymanMobile'));console.log('user',width,c,release.id,cells);
 }finally{await page.close();}
}
try {await server.listen();browser=await chromium.launch({channel:'chrome'});
 for(const c of [A,B])await publish(c,await draft(c,original));
 const before=(await state(A)).releases.at(-1);const other=(await state(B)).activeReleaseId;
 for(const order of [edited,before.config.leadListOrder]){
 let d;
 if (order === edited) d = await draft(A,order);
 else {
   const p=await browser.newPage();
   try {
     await p.goto(root+'/admin/customization');
     await p.locator('main select').first().selectOption(A);
     await p.getByLabel('변경 사유').fill('리드 목록 원래 열 복원');
     const old=(await state(A)).activeReleaseId;
     const [response]=await Promise.all([p.waitForResponse(r=>r.url().endsWith('/rollback')),p.getByRole('button',{name:'복원 작업본 생성'}).first().click()]);
     assert.ok(response.ok());d=await response.json();
     assert.deepEqual(d.config.leadListOrder,original);
     assert.equal((await state(A)).activeReleaseId,old);
     console.log('restore button created draft; edited release still active');
   } finally {await p.close();}
 }
for(const w of [1440,390])await preview(A,order,w);
 await publish(A,d);for(const w of [1440,390]){await user(A,order,w);await user(B,original,w);}
 assert.equal((await state(B)).activeReleaseId,other);
 }
}finally{await browser?.close();fs.unlinkSync(fixture);server.httpServer?.closeAllConnections();await server.close();}
