import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startHqServer} from './server.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
const browser=await chromium.launch({headless:true});
try {for(const width of [320,390]){
 const runtime=await startHqServer({port:0,storageDir:false,autoAdvance:false});
 const page=await browser.newPage({viewport:{width,height:844},locale:'ko-KR',timezoneId:'Asia/Seoul'});page.setDefaultTimeout(10000);
 try{
  const auth=await (await fetch(runtime.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:'hq-sales',password:'HQ-DEMO'})})).json();
  const call=async(path,body)=>{const r=await fetch(runtime.url+path,{method:'POST',headers:{authorization:`Bearer ${auth.accessToken}`,'content-type':'application/json'},body:JSON.stringify(body)});const value=await r.json();assert.equal(r.status,200,JSON.stringify(value));return value};
  const a=await call('/api/activities/plans',{relatedType:'ACCOUNT',relatedPublicId:seedIDs.approvedAccount,plannedAt:'2026-10-24T09:00:00+09:00',visitPurpose:'승인 검증'});
  for(const action of ['check-in','check-out'])await call(`/api/activities/${a.activityPublicId}/${action}`,{latitude:35.171,longitude:129.127,isMocked:true});
  await call('/api/activity-reports/prepare',{reportDate:'2026-10-24'});
  await page.goto(runtime.url+'/activity-reports');
  const persona=page.locator('.hq-mock-controls select').first();const row=()=>page.locator('.hq-act-list-row').filter({hasText:'2026-10-24'}).first();const d=()=>page.locator('dialog[open]');
  const open=async(id)=>{await persona.selectOption(id);await row().waitFor();await row().getByRole('button',{name:/상세 열기/}).click();await d().waitFor()};
  const close=async()=>{await d().getByRole('button',{name:'닫기'}).click();await d().waitFor({state:'hidden'})};
  const clickAction=async(button,suffix)=>{const res=page.waitForResponse(r=>r.url().endsWith(suffix)&&r.request().method()==='POST');await d().getByRole('button',{name:button,exact:true}).click();assert.equal((await res).status(),200);};
  await open('hq-sales');await clickAction('승인요청','/request-approval');await d().getByText('1회차',{exact:false}).waitFor();await close();
  await open('hq-branch');
  assert.notEqual(await d().getByRole('button',{name:'승인 완료'}).evaluate(e=>getComputedStyle(e).backgroundColor),await d().getByRole('button',{name:'반려',exact:true}).evaluate(e=>getComputedStyle(e).backgroundColor),'승인과 반려 버튼 색 구분');
  await d().getByLabel('승인 의견').fill('지점 보완 요청');
  const block=r=>r.fulfill({status:500,headers:{'X-HQ-Mock':'true'},contentType:'application/json',body:JSON.stringify({message:'의견 저장 시험 오류'})});
  await page.route('**/api/activity-reports/*/comment/branch',block);await d().getByRole('button',{name:'의견만 저장'}).click();
  await d().getByText('의견 저장 시험 오류',{exact:false}).waitFor();assert.equal(await d().getByLabel('승인 의견').inputValue(),'지점 보완 요청');
  await page.unroute('**/api/activity-reports/*/comment/branch',block);await clickAction('의견만 저장','/comment/branch');
  await d().getByText('지점 보완 요청',{exact:false}).first().waitFor();await clickAction('반려','/reject/branch');await close();
  await open('hq-sales');await clickAction('승인요청','/request-approval');await d().getByText('2회차',{exact:false}).waitFor();await close();
  await open('hq-branch');await clickAction('승인 완료','/approve/branch');await close();
  await open('hq-division');await d().getByLabel('승인 의견').fill('본부 보완 요청');await clickAction('의견만 저장','/comment/division');await d().getByText('본부 보완 요청',{exact:false}).first().waitFor();await clickAction('반려','/reject/division');await close();
  await open('hq-sales');await clickAction('승인요청','/request-approval');await d().getByText('3회차',{exact:false}).waitFor();await close();
  await open('hq-branch');await clickAction('승인 완료','/approve/branch');await close();
  await open('hq-division');await d().getByLabel('승인 의견').fill('최종 검토 완료');await clickAction('승인 완료','/approve/division');
  await d().getByText('최종 검토 완료',{exact:false}).first().waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  console.log(`${width} PASS 지점·본부 의견, 반려, 재요청, 최종 승인 및 저장 실패 보존`);
 }finally{await page.close();runtime.server.closeAllConnections();await runtime.close()}
}}finally{await browser.close()}
