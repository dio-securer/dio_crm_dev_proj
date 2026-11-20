import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startHqServer} from './server.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
const browser=await chromium.launch({headless:true});
try{for(const width of [320,390]){
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});
 const page=await browser.newPage({viewport:{width,height:844},locale:'ko-KR'});page.setDefaultTimeout(9000);
 try{
  const login=await (await fetch(server.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:'hq-admin',password:'HQ-DEMO'})})).json();
  const setup=async(path,body)=>{const r=await fetch(server.url+path,{method:'POST',headers:{authorization:`Bearer ${login.accessToken}`,'content-type':'application/json'},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data};
  const queued=await setup('/api/hq/interfaces/request',{interfaceCode:'IF-ERP-002',entityType:'ACCOUNT',entityPublicId:seedIDs.noCoordinatesAccount,idempotencyKey:'isolated-failure',payload:{},scenario:'TRANSIENT_FAILURE'});
  assert.equal((await setup('/api/hq/interfaces/advance',{requestId:queued.requestId,scenario:'TRANSIENT_FAILURE'})).status,'FAILED');
  await page.goto(server.url+'/hq-admin/users');await page.locator('.hq-admin-page').waitFor();
  const user=page.locator('.hq-admin-page form').first();await user.getByLabel('사용자 ID').fill('1');await user.getByLabel('이름').fill(`검증 사용자 ${width}`);await user.getByRole('spinbutton',{name:'조직 ID'}).fill('10');
  const fail=r=>r.fulfill({status:403,headers:{'X-HQ-Mock':'true'},contentType:'application/json',body:JSON.stringify({message:'격리 권한 오류'})});
  await page.route('**/api/hq/admin/users/1',fail);await user.getByRole('button',{name:'사용자 저장'}).click();await page.getByRole('alert').filter({hasText:'격리 권한 오류'}).waitFor();assert.equal(await user.getByLabel('이름').inputValue(),`검증 사용자 ${width}`);
  await page.unroute('**/api/hq/admin/users/1',fail);await user.getByRole('button',{name:'사용자 저장'}).click();await page.getByRole('status').filter({hasText:'저장했습니다.'}).waitFor();
  await page.reload();await page.getByRole('cell',{name:`검증 사용자 ${width}`,exact:true}).waitFor();
  const org=page.locator('.hq-admin-page form').last();await org.getByLabel('조직 ID').fill('20');await org.getByLabel('조직명').fill(`검증 조직 ${width}`);await org.getByRole('button',{name:'조직 저장'}).click();await page.getByRole('status').filter({hasText:'저장했습니다.'}).waitFor();
  await page.goto(server.url+'/hq-admin/codes');await page.getByLabel('그룹',{exact:true}).fill('CODEX_TEST');await page.getByLabel('코드',{exact:true}).fill('MOBILE');await page.getByLabel('표시명').fill(`모바일 코드 ${width}`);await page.getByRole('button',{name:'저장',exact:true}).click();await page.getByRole('status').filter({hasText:'저장했습니다.'}).waitFor();await page.reload();await page.getByRole('cell',{name:`모바일 코드 ${width}`,exact:true}).waitFor();
  await page.goto(server.url+'/hq-admin/permissions');const permissionForm=page.locator('.hq-admin-page form').first();await permissionForm.locator('select').first().selectOption('HQ_VIEWER');await permissionForm.locator('select').last().selectOption('BRANCH');await page.getByRole('button',{name:'권한 저장'}).click();await page.getByRole('status').waitFor();
  assert.ok(await permissionForm.getByLabel('권한(쉼표 구분)').evaluate(e=>e.getBoundingClientRect().right<=innerWidth+1),'권한 입력란 모바일 폭');
  await page.getByLabel('작업본 JSON').fill('{');await page.getByRole('button',{name:'미리보기',exact:true}).click();await page.getByRole('alert').waitFor();
  await page.getByRole('button',{name:'현재 작업본 불러오기'}).click();const draft=page.getByLabel('작업본 JSON');const data=JSON.parse(await draft.inputValue());data.version=`7.${width}.1`;await draft.fill(JSON.stringify(data));
  await page.getByRole('button',{name:'미리보기',exact:true}).click();await page.getByRole('status').filter({hasText:'valid'}).waitFor();
  let response=page.waitForResponse(x=>x.url().endsWith('/standard/draft')&&x.request().method()==='POST');await page.getByRole('button',{name:'작업본 저장'}).click();assert.equal((await response).status(),200);
  response=page.waitForResponse(x=>x.url().endsWith('/standard/publish')&&x.request().method()==='POST');await page.getByRole('button',{name:'게시',exact:true}).click();assert.equal((await response).status(),200);
  await page.getByText(`현재 버전: 7.${width}.1`).waitFor();const restore=page.getByRole('button',{name:/복원$/}).first();await restore.waitFor();response=page.waitForResponse(x=>x.url().endsWith('/standard/restore')&&x.request().method()==='POST');await restore.click();assert.equal((await response).status(),200);
  await page.getByRole('button',{name:'현재 작업본 불러오기'}).click();const original=JSON.parse(await draft.inputValue());const order=original.menus.find(x=>x.screenKey==='HQ_ORDER');
  const override={overrideKey:'CODEX_MOBILE',parentStandardKey:original.standardKey,parentVersion:original.version,patches:[{target:'menu',key:order.menuKey,changes:{enabled:false}}]};
  await page.getByLabel('오버라이드 JSON').fill(JSON.stringify(override));
  await page.getByRole('button',{name:'적용 미리보기'}).click();await page.getByRole('status').filter({hasText:'valid'}).waitFor();
  response=page.waitForResponse(x=>x.url().endsWith('/override/apply')&&x.request().method()==='POST');await page.getByRole('button',{name:'회사 스냅샷 적용'}).click();assert.equal((await response).status(),200);
  response=page.waitForResponse(x=>x.url().endsWith('/override/clear')&&x.request().method()==='POST');await page.getByRole('button',{name:'회사 스냅샷 해제'}).click();assert.equal((await response).status(),200);
  await page.goto(server.url+'/hq-admin/audit');await page.getByLabel('이력 검색').fill('ADM.codes.save');await page.getByRole('cell',{name:'ADM.codes.save',exact:true}).first().waitFor();await page.locator('details').first().locator('summary').click();
  await page.goto(server.url+'/hq-admin/interfaces');await page.locator('.hq-admin-page').getByRole('heading',{name:'연계 모니터',exact:true}).waitFor();
  await page.locator('.hq-admin-page details').filter({hasText:queued.requestId}).locator('summary').click();
  const retry=page.locator('.hq-admin-page').getByRole('button',{name:`IF-ERP-002 재시도 · ${queued.requestId}`,exact:true});await retry.click();await page.getByRole('status').filter({hasText:'재시도 요청을 생성했습니다.'}).waitFor();
  await page.goto(server.url+'/ops');await page.getByRole('button',{name:'새로고침'}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  console.log(`${width} PASS 사용자·조직·코드·권한·표준·오버라이드·감사·연계 조회`);
 }finally{await page.close();server.server.closeAllConnections();await server.close()}
}}finally{await browser.close()}
