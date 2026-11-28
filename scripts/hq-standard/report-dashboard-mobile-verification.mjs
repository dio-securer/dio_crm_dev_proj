import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startHqServer} from './server.mjs';
const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});
const browser=await chromium.launch({headless:true});
try{
 for(const width of [320,390]){
  const page=await browser.newPage({viewport:{width,height:844},locale:'ko-KR'});
  page.setDefaultTimeout(8000);
  try{
   await page.goto(server.url+'/activity-reports');
   await page.locator('.hq-report-page').waitFor();
   assert.equal(await page.locator('.hq-report-page h1').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
   const dates=page.locator('.hq-report-page input[type=date]');
   await dates.nth(1).fill('2026-12-31');await dates.nth(2).fill('2026-01-01');
   await page.getByText('종료일은 시작일보다 빠를 수 없습니다.').waitFor();
   assert.equal(await page.getByRole('button',{name:'조회',exact:true}).isDisabled(),true);
   await dates.nth(1).fill('');await dates.nth(2).fill('');
   await page.getByLabel('보고 상태').selectOption('DRAFT');await page.getByLabel('보고 상태').selectOption('');
   await page.getByLabel('소속 조직').selectOption('');await page.getByLabel('보고 담당자').selectOption('');
   const fail=r=>r.fulfill({status:500,headers:{'X-HQ-Mock':'true'},contentType:'application/json',body:JSON.stringify({message:'시험 조회 오류'})});
   await page.route(/\/api\/activity-reports(?:\?.*)?$/,fail);
   await page.getByRole('button',{name:'조회',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'시험 조회 오류'}).waitFor();
   await page.unroute(/\/api\/activity-reports(?:\?.*)?$/,fail);
   await page.getByRole('button',{name:'조회',exact:true}).click();
   await page.getByRole('status').filter({hasText:'총 '}).waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.goto(server.url+'/analytics');
   await page.locator('.h06-dashboard-page').waitFor();
   assert.equal(await page.locator('.h06-dashboard-page h1').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
   await page.locator('.h06-metric').first().waitFor();
   await page.getByRole('button',{name:'대시보드 목록'}).click();
   await page.getByRole('button',{name:'활동 대시보드'}).click();
   await page.getByRole('heading',{name:'활동 대시보드'}).waitFor();
   await page.getByRole('button',{name:'대시보드 목록'}).click();
   await page.getByRole('button',{name:'판매 대시보드'}).click();
   await page.getByRole('button',{name:'대시보드 편집'}).click();
   await page.getByRole('button',{name:'대시보드 저장'}).click();
   await page.getByText('표시 설정을 이 브라우저의 현재 사용자 설정으로 저장했습니다.').waitFor();
   const failDashboard=r=>r.fulfill({status:403,headers:{'X-HQ-Mock':'true'},contentType:'application/json',body:JSON.stringify({message:'시험 권한 오류'})});
   await page.route('**/api/analytics/dashboard?*',failDashboard);
   await page.getByRole('button',{name:'새로 고침'}).click();
   await page.getByRole('alert').filter({hasText:'시험 권한 오류'}).waitFor();
   assert.equal(await page.locator('.h06-metric').count(),0,'오류 시 이전 집계 숨김');
   await page.unroute('**/api/analytics/dashboard?*',failDashboard);
   await page.getByRole('button',{name:'새로 고침'}).click();
   await page.locator('.h06-metric').first().waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   console.log(`${width} PASS 활동보고·대시보드 조회 및 오류 복구`);
  }finally{await page.close()}
 }
}finally{await browser.close();server.server.closeAllConnections();await server.close()}
