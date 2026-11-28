import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
const root='docs/Codex/account-design-captures-20261112';
const devices=[{id:'pc',label:'PC 1440×900',width:1440,height:900},{id:'tablet-landscape',label:'태블릿 가로 1024×768',width:1024,height:768},{id:'tablet-portrait',label:'태블릿 세로 768×1024',width:768,height:1024},{id:'mobile',label:'모바일 390×844',width:390,height:844}];
const tabs=[['basic','기본 정보·수정'],['erp','ERP 정보'],['hospital','병원 정보'],['contacts','연락처'],['sales','영업·계약·매출'],['order','주문'],['service','서비스'],['timeline','변경 이력'],['analytics','분석 지표'],['files','파일'],['sharing','공유 및 팀'],['activities','활동내역'],['destinations','직송지'],['rentals','렌탈장비']];
await mkdir(root,{recursive:true});const browser=await chromium.launch({headless:true}),results=[];
for(const d of devices){
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});
 const context=await browser.newContext({viewport:{width:d.width,height:d.height},locale:'ko-KR',timezoneId:'Asia/Seoul',serviceWorkers:'block'});const page=await context.newPage();page.setDefaultTimeout(7000);const folder=`${root}/${d.id}`;await mkdir(folder,{recursive:true});
 const capture=async(name,label,work,full=false)=>{try{await work();await page.screenshot({path:`${folder}/${name}.png`,fullPage:full});results.push({device:d.label,name,label,status:'captured',file:`${d.id}/${name}.png`});console.log(`OK ${d.id} ${name}`);}catch(e){results.push({device:d.label,name,label,status:'failed',reason:String(e.message)});console.log(`FAIL ${d.id} ${name}: ${e.message.split('\n')[0]}`);}};
 const scroller=()=>page.locator(d.width<=920?'.mob-layer':'.pc-window-backdrop').first();
 const positions=async(name,label)=>{const scroll=scroller();const sizes=await scroll.evaluate(el=>({height:el.scrollHeight,client:el.clientHeight}));if(sizes.height>sizes.client+50){await capture(`${name}-middle`,`${label} · 중간`,async()=>{await scroll.evaluate(el=>{el.scrollTop=(el.scrollHeight-el.clientHeight)/2});});await capture(`${name}-bottom`,`${label} · 하단`,async()=>{await scroll.evaluate(el=>{el.scrollTop=el.scrollHeight});});}};
 try {
  await capture('01-list','거래처 목록',async()=>{await page.goto(server.url+'/accounts');await page.locator(d.width<=920?'.account-mobile':'.pc-table-card').waitFor();},true);
  await capture('02-register','거래처 등록 · 상단',async()=>{await page.locator(d.width<=920?'.mob-new':'[data-config-instance="pc.create"]').click();await scroller().waitFor();});
  if(await scroller().isVisible().catch(()=>false))await positions('02-register','거래처 등록');
  await page.goto(`${server.url}/accounts?record=${seedIDs.approvedAccount}&tab=basic`);await page.locator('.hq-account-workspace').waitFor();
  for(const [key,label] of tabs){await capture(`tab-${key}`,`${label} · 상단`,async()=>{const tab=page.locator(`.hq-account-workspace [role=tab][data-tab-key="${key}"]`);await tab.click();await page.waitForTimeout(200);await scroller().evaluate(el=>{el.scrollTop=0});});if(await page.locator(`.hq-account-workspace [data-tab-key="${key}"][aria-selected="true"]`).count())await positions(`tab-${key}`,label);}
  await capture('contact-new','연락처 등록',async()=>{await page.locator('.hq-account-workspace [data-tab-key="contacts"]').click();await page.getByTestId('new-contact').click();await page.locator('dialog[open]').waitFor();});
  if(await page.locator('dialog[open]').count())await page.locator('dialog[open] header button').first().click();
  await capture('destination-new','직송지 등록',async()=>{await page.locator('.hq-account-workspace [data-tab-key="destinations"]').click();await page.getByRole('button',{name:'새 직송지'}).first().click();await page.locator('.account-logistics form').waitFor();});
  await capture('rental-new','렌탈장비 등록',async()=>{await page.locator('.hq-account-workspace [data-tab-key="rentals"]').click();await page.getByRole('button',{name:'새 렌탈장비'}).first().click();await page.locator('.account-logistics form').waitFor();});
 } finally {await context.close();server.server.closeAllConnections();await server.close();}
}
await browser.close();await writeFile(`${root}/manifest.json`,JSON.stringify({created:'2026-11-12',source:'isolated HQ mock, synthetic seed data',devices,results},null,2));console.log(JSON.stringify({captured:results.filter(x=>x.status==='captured').length,failed:results.filter(x=>x.status==='failed').length}));
