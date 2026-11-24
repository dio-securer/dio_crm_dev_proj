import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startHqServer} from './server.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
const browser=await chromium.launch({headless:true});
const results=[];
for(const [name,width,height] of [['PC',1440,900],['패드',768,1024],['모바일',390,844]]){
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});
 const context=await browser.newContext({viewport:{width,height},locale:'ko-KR',serviceWorkers:'block'});
 const page=await context.newPage();
 try{
  await page.goto(`${server.url}/contracts?record=${seedIDs.pendingContract}`);
  await page.getByRole('heading',{name:'계약 상세'}).waitFor();
  await page.getByRole('button',{name:'최초 수금계획 편집'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('금액').first().fill('1000000');
  await dialog.getByLabel('예정일').first().fill('2026-12-31');
  const route='**/api/contracts/*/collection-plans';
  await page.route(route,r=>r.request().method()==='POST'?r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'TEST_FORBIDDEN'})}):r.continue());
  const failed=page.waitForResponse(r=>r.status()===403&&r.url().endsWith('/collection-plans'));
  await dialog.getByRole('button',{name:'최초 계획 저장'}).click();await failed;
  await dialog.getByRole('alert').waitFor();assert.equal(await dialog.getByLabel('금액').first().inputValue(),'1000000');
  await page.unroute(route);
  const saved=page.waitForResponse(r=>r.status()===200&&r.url().endsWith('/collection-plans')&&r.request().method()==='POST');
  await dialog.getByRole('button',{name:'최초 계획 저장'}).click();await saved;await dialog.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'1회차 삭제'}).click();
  const removed=page.waitForResponse(r=>r.status()===200&&r.request().method()==='DELETE'&&r.url().includes('/collection-plans/'));
  await page.getByRole('button',{name:'삭제 확인'}).click();await removed;
  await page.getByText('수금계획을 삭제했습니다.').waitFor();
  results.push({name,status:'PASS',detail:'403 주입 시 입력 보존, 계획 저장 및 삭제'});
 }catch(error){results.push({name,status:'FAIL',detail:String(error.message)});}
 finally{await context.close();server.server.closeAllConnections();await server.close();}
}
await browser.close();console.log(JSON.stringify(results,null,2));if(results.some(x=>x.status!=='PASS'))process.exitCode=1;
