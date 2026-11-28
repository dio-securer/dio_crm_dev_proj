import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startHqServer} from './server.mjs';
const base='docs/crm-work-queue/20261108/opportunity/walkthrough/loading';await mkdir(base+'/screenshots',{recursive:true});const steps=[];
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
for(const [width,height] of [[1440,900],[1024,768],[768,1024],[390,844],[320,700]]){
 const runtime=await startHqServer({port:0,storageDir:false,autoAdvance:false});const context=await browser.newContext({viewport:{width,height},locale:'ko-KR'});const page=await context.newPage();page.setDefaultTimeout(8000);
 const record=async(id,title,actions,expected,fn)=>{let status='PASS',actual=expected;try{await fn()}catch(e){status='FAIL';actual=e.message}const image=`screenshots/${width}-${id}.png`;await page.screenshot({path:base+'/'+image,fullPage:true});steps.push({id:`${width}-${id}`,device:String(width),area:'목록 조회 복구',title,actions,expected,actual,status,screenshots:[image],note:'격리 브라우저에서 조회 응답을 지연하거나 500을 주입한 시험. 운영 장애 재현이 아님.'});await writeFile(base+'/steps.json',JSON.stringify(steps,null,2));console.log(width,status,title)};
 let release;const gate=new Promise(resolve=>release=resolve);let mode='hold';
 await page.route('**/api/opportunities',async route=>{if(route.request().method()!=='GET')return route.continue();if(mode==='hold')await gate;if(mode==='fail')return route.fulfill({status:500,headers:{'content-type':'application/json','x-hq-mock':'true'},body:JSON.stringify({error:'TEST_LIST_500',message:'TEST_LIST_500'})});return route.continue()});
 try{
  await page.goto(runtime.url+'/opportunities',{waitUntil:'domcontentloaded'});
  await record('loading','목록을 불러오는 동안 안내',['영업기회 메뉴를 연다.','조회 응답을 기다리는 동안 목록 영역을 확인한다.'],'불러오는 중 안내가 보이고 빈 결과로 오인하지 않는다.',async()=>{await page.getByText('불러오는 중...',{exact:true}).waitFor();assert.equal(await page.getByText('기회가 없습니다.',{exact:true}).count(),0)});
  mode='normal';release();await page.locator('.hq-sales-row').first().waitFor();mode='fail';await page.reload({waitUntil:'domcontentloaded'});
  await record('list-error','목록 조회 오류 표시',['영업기회 목록을 다시 연다.','조회 500 오류에 대한 안내를 확인한다.'],'조회 실패 안내와 다시 시도 버튼을 표시한다.',async()=>{await page.getByText('목록을 불러오지 못했습니다.',{exact:false}).waitFor();await page.getByRole('button',{name:'다시 시도',exact:true}).waitFor();assert.equal(await page.getByText('기회가 없습니다.',{exact:true}).count(),0)});
  mode='normal';await record('list-retry','목록 다시 시도',['조회 응답이 복구되면 다시 시도 버튼을 누른다.'],'기회 목록이 다시 나타난다.',async()=>{await page.getByRole('button',{name:'다시 시도',exact:true}).click();await page.locator('.hq-sales-row').first().waitFor()});
 }finally{release();await Promise.race([context.close(),new Promise(r=>setTimeout(r,3000))]);runtime.server.closeAllConnections();await runtime.close()}
}
await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);console.log(JSON.stringify({steps:steps.length,fail:steps.filter(x=>x.status==='FAIL').length}));process.exit(steps.some(x=>x.status!=='PASS')?1:0);
