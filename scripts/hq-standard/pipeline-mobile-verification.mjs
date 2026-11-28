import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startHqServer} from './server.mjs';
const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});
const browser=await chromium.launch({headless:true});
const fixture={byStage:[{stage:'PROPOSAL',currency:'KRW',opportunity_count:2,amount:250000}],forecast:[{forecast_category:'BEST_CASE',currency:'KRW',opportunity_count:2,amount:250000}],overdueFollowUpCount:3,mockToday:'2026-11-13'};
try {
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});
  let status=200,writes=0,data=fixture;
  await page.route('**/api/**',async route=>{if(route.request().method()!=='GET'&&!route.request().url().endsWith('/api/hq/session'))writes++;if(route.request().url().includes('/pipeline/funnel'))return route.fulfill({status,headers:{'X-HQ-Mock':'true'},contentType:'application/json',body:JSON.stringify(status!==200?{message:'테스트 오류'}:data)});return route.continue()});
  await page.goto(server.url+'/pipeline');
  await page.locator('.hq-pipeline-page').waitFor();
  await page.getByText('3건 · 목업 기준일 2026-11-13 전 기한의 진행 예정 건').waitFor();
  await page.getByText('250,000',{exact:false}).first().waitFor();
  if(width<600){assert.equal(await page.locator('.hq-pipeline-page h1').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');await page.locator('.pipeline-mobile-label').getByText('제안',{exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  else if(width <= 1024) await page.locator('.pipeline-mobile-label').getByText('제안',{exact:true}).waitFor();
  else await page.locator('.pipeline-desktop-label').getByText('PROPOSAL',{exact:true}).waitFor();
  status=500;await page.reload();await page.getByRole('alert').waitFor();
  status=200;await page.getByRole('button',{name:'파이프라인 다시 조회'}).click();
  await page.getByText('3건 · 목업 기준일 2026-11-13 전 기한의 진행 예정 건').waitFor();
  status=403;await page.reload();await page.getByText('파이프라인 조회 권한이 없습니다.').waitFor();
  assert.equal(await page.getByText('3건 · 목업 기준일 2026-11-13 전 기한의 진행 예정 건').count(),0);
  data={byStage:[],forecast:[],overdueFollowUpCount:0,mockToday:'2026-11-13'};status=200;
  await page.getByRole('button',{name:'파이프라인 다시 조회'}).click();
  await page.getByText('조회 가능한 단계별 기회가 없습니다.').waitFor();
  await page.getByText('조회 가능한 예상 범주가 없습니다.').waitFor();
  assert.equal(writes,0);
  console.log(`${width} PASS 집계·오류 재조회`);await page.close();
 }
}finally{await browser.close();server.server.closeAllConnections();await server.close()}
