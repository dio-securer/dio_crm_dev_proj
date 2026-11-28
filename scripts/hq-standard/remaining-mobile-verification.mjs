import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startHqServer} from './server.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
const browser=await chromium.launch({headless:true});
try{for(const width of [320,390]){
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});
 const page=await browser.newPage({viewport:{width,height:844},locale:'ko-KR',timezoneId:'Asia/Seoul'});page.setDefaultTimeout(10000);
 try{
  const auth=await (await fetch(server.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:'hq-sales',password:'HQ-DEMO'})})).json();
  const r=await fetch(server.url+'/api/activities/plans',{method:'POST',headers:{authorization:`Bearer ${auth.accessToken}`,'content-type':'application/json'},body:JSON.stringify({relatedType:'ACCOUNT',relatedPublicId:seedIDs.approvedAccount,plannedAt:'2026-10-24T09:00:00+09:00',directWorkType:'DIRECT_WORK',directWorkReason:'모바일 격리 테스트'})});assert.equal(r.status,200);
  let erp=0;await page.route('**/api/direct-work/*/erp/retry',route=>{erp++;return route.abort()});
  await page.goto(server.url+'/direct-work');await page.locator('.hq-direct-page').waitFor();
  await page.locator('.hq-mock-controls select').first().selectOption('hq-sales');
  const row=page.locator('.hq-act-list-row').filter({hasText:'2026-10-24'}).first();await row.getByTestId('direct-work-open').click();
  const detail=page.locator('[data-hq-screen="SCR-DW-002"]');await detail.getByText('모바일 격리 테스트').waitFor();
  const response=page.waitForResponse(x=>x.url().endsWith('/request-approval')&&x.request().method()==='POST');
  await detail.getByRole('button',{name:/승인요청/}).click();assert.equal((await response).status(),200);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.goto(server.url+'/ledger-statements');await page.locator('.h06-ledger-page').waitFor();
  await page.getByRole('button',{name:'지난달'}).click();await page.getByRole('button',{name:'이번 달'}).click();
  await page.locator('.h06-ledger-page .h06-card select').first().selectOption(seedIDs.approvedAccount);
  await page.getByLabel('시작일').fill('2026-01-01');await page.getByLabel('종료일').fill('2026-12-31');
  await page.getByRole('button',{name:'조회',exact:true}).click();await page.getByRole('heading',{name:'원장',exact:true}).waitFor();
  await page.getByRole('heading',{name:'월합 명세서',exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.goto(server.url+'/account360');await page.locator('.hq-account360-page').waitFor();
  await page.locator('.hq-account360-page>label select').selectOption(seedIDs.approvedAccount);
  await page.getByRole('tab',{name:'활동내역'}).click();assert.equal(await page.getByRole('tab',{name:'활동내역'}).getAttribute('aria-selected'),'true');
  await page.getByRole('tab',{name:'직송지'}).click();await page.getByRole('tab',{name:'렌탈장비'}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.goto(server.url+'/ops');await page.locator('.hq-mock-controls select').first().selectOption('hq-admin');await page.locator('.hq-admin-page').waitFor();
  await page.getByRole('button',{name:'새로고침'}).click();
  for(const path of ['/hq-admin/users','/hq-admin/permissions','/hq-admin/codes','/hq-admin/interfaces','/hq-admin/audit']){
   await page.goto(server.url+path);await page.locator('.hq-mock-controls select').first().selectOption('hq-admin');await page.locator('.hq-admin-page').waitFor();
   if(path==='/hq-admin/users'){
    await page.getByRole('textbox',{name:'조직 ID',exact:true}).fill('10');
    await page.getByLabel('조직명',{exact:true}).fill(`격리 조직 ${width}`);
    const saved=page.waitForResponse(x=>x.request().method()==='PATCH'&&x.url().includes('/admin/organizations/10'));
    await page.getByRole('button',{name:'조직 저장'}).click();assert.equal((await saved).status(),200);
    await page.getByRole('status').filter({hasText:'저장했습니다.'}).waitFor();
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${path} 가로 넘침`);
  }
  assert.equal(erp,0);console.log(`${width} PASS 직출 요청·원장 조회·거래처360 탭·관리 화면`);
 }finally{await page.close();server.server.closeAllConnections();await server.close()}
}}finally{await browser.close()}
