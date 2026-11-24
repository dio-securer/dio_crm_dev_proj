import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startHqServer} from './server.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
const browser=await chromium.launch({headless:true});
try {
 for(const width of [320,390]){
  const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});
  const page=await browser.newPage({viewport:{width,height:844},locale:'ko-KR'});
  let outbound=0;
  await page.route('**/api/orders/*/submit',r=>{outbound++;return r.abort()});
  await page.route('**/api/contracts/*/erp-request',r=>{outbound++;return r.abort()});
  await page.route('**/api/contracts/*/collection-plans/change',r=>{outbound++;return r.abort()});
  try{
   await page.goto(server.url+'/collection-plans');
   await page.locator('.hq-collection-page').waitFor();
   assert.equal(await page.locator('.hq-collection-page h1').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
   await page.getByLabel('수금계획 계약 검색').fill('없는 계약');
   await page.getByText('조회 결과가 없습니다.').waitFor();
   await page.getByLabel('예정일 시작').fill('2026-12-31');
   await page.getByLabel('예정일 종료').fill('2026-01-01');
   await page.getByText('예정일 종료는 시작일 이후여야 합니다.').waitFor();
   await page.getByLabel('수금계획 목록').selectOption('corrections');
   await page.getByLabel('예정일 정렬').selectOption('date-desc');
   await page.getByRole('button',{name:'조회 조건 초기화'}).click();
   assert.equal(await page.getByLabel('수금계획 계약 검색').inputValue(),'');
   await page.getByRole('button',{name:'계획 목록 새로 고침'}).click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.goto(`${server.url}/contracts?record=${seedIDs.pendingContract}`);
   await page.getByRole('button',{name:'최초 수금계획 편집'}).click();
   const d=page.getByRole('dialog',{name:'최초 수금계획 편집'});
   await d.getByLabel('방법').first().selectOption({label:'현금 일시불'});
   await d.getByLabel('금액').first().fill('1000000');
   await d.getByLabel('예정일').first().fill('2026-12-31');
   const blockPlan=r=>r.request().method()==='POST'?r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'테스트 권한 오류'})}):r.continue();
   await page.route('**/api/contracts/*/collection-plans',blockPlan);
   await d.getByRole('button',{name:'최초 계획 저장'}).click();
   await d.getByRole('alert').waitFor();
   assert.equal(await d.getByLabel('금액').first().inputValue(),'1000000');
   assert.equal(await d.getByLabel('예정일').first().inputValue(),'2026-12-31');
   await page.unroute('**/api/contracts/*/collection-plans',blockPlan);
   await d.getByRole('button',{name:'최초 계획 저장'}).click();
   await d.waitFor({state:'hidden'});
   await page.getByText('최초 수금계획을 저장했습니다.').waitFor();
   await page.goto(server.url+'/collection-plans');
   const savedCard=page.locator('.hq-plan-cards article').filter({hasText:'2026-12-31'}).first();
   await savedCard.waitFor();
   await savedCard.getByRole('link').click();
   await page.getByRole('heading',{name:'계약 상세'}).waitFor();
   await page.goto(server.url+'/fulfillment');
   await page.locator('.h06-fulfillment-page').waitFor();
   assert.equal(await page.locator('.h06-fulfillment-page > h1').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
   await page.getByLabel('주문',{exact:true}).selectOption({index:0});
   await page.getByRole('heading',{name:'품목별 납품 수량 · MOCK'}).waitFor();
   for(const title of ['납품','매출','수금','반품·교환'])await page.getByRole('heading',{name:title,exact:true}).waitFor();
   const failFulfillment=r=>r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'조회 테스트 오류'})});
   await page.route('**/api/orders/*/fulfillment',failFulfillment);
   await page.reload();
   await page.getByRole('alert').waitFor();
   await page.unroute('**/api/orders/*/fulfillment',failFulfillment);
   await page.getByRole('button',{name:'납품 정보 다시 조회'}).click();
   await page.getByRole('heading',{name:'품목별 납품 수량 · MOCK'}).waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.equal(outbound,0,'ERP 전송 없음');
   console.log(`${width} PASS 수금계획 검색·초기화·저장 및 주문납품 조회`);
  }finally{await page.close();server.server.closeAllConnections();await server.close()}
 }
}finally{await browser.close()}
