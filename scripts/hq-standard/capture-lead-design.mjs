import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';
const {seedIDs} = await import('../../backend/src/hq-mock/seed.ts');
const root = 'docs/Codex/lead-design-captures-20261112';
const devices = [{id:'pc',label:'PC 1440×900',width:1440,height:900},{id:'tablet-landscape',label:'태블릿 가로 1024×768',width:1024,height:768},{id:'tablet-portrait',label:'태블릿 세로 768×1024',width:768,height:1024},{id:'mobile',label:'모바일 390×844',width:390,height:844}];
await mkdir(root,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
for (const d of devices) {
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});
 const context=await browser.newContext({viewport:{width:d.width,height:d.height},locale:'ko-KR',timezoneId:'Asia/Seoul',serviceWorkers:'block'});
 const page=await context.newPage();page.setDefaultTimeout(7000);
 const folder=`${root}/${d.id}`;await mkdir(folder,{recursive:true});
 const capture=async(name,fn,fullPage=true)=>{try{await fn();await page.screenshot({path:`${folder}/${name}.png`,fullPage});results.push({device:d.label,name,status:'captured',file:`${d.id}/${name}.png`});console.log(`OK ${d.id} ${name}`);}catch(e){results.push({device:d.label,name,status:'failed',reason:String(e.message)});console.log(`FAIL ${d.id} ${name}: ${e.message.split('\n')[0]}`);}};
 const open=async()=>{await page.goto(`${server.url}/leads?lead=${seedIDs.lead}`);await page.locator('.hq-lead-detail').waitFor();};
 try {
  await capture('01-list',async()=>{await page.goto(server.url+'/leads');await page.locator('.hq-lead-list').waitFor();});
  await capture('02-new-lead-top',async()=>{await page.getByRole('button',{name:'신규병원 등록'}).click();await page.locator('dialog[open]').waitFor();},false);
  await capture('02b-new-lead-middle',async()=>{await page.locator('dialog[open]').evaluate(el=>{el.scrollTop=(el.scrollHeight-el.clientHeight)/2});},false);
  await capture('03-new-lead-bottom',async()=>{await page.locator('dialog[open]').evaluate(el=>{el.scrollTop=el.scrollHeight});},false);
  await capture('04-detail-overview',async()=>{await open();});
  await capture('05-detail-information',async()=>{if(d.width<600)await page.getByRole('navigation',{name:'리드 화면 구역'}).getByRole('button',{name:'상세 정보'}).click();await page.locator('.lead-details-form:visible').first().waitFor();});
  for(const [key,name] of [['hira','06-hira'],['marketing','07-marketing'],['history','08-history']]) await capture(name,async()=>{if(d.width<600)await page.locator('.lead-mobile-sections').getByRole('button',{name:{hira:'심평원 인입정보',marketing:'마케팅 정보',history:'History'}[key]}).click();else await page.locator(`[role=tab][data-tab-key="${key}"]`).click();await page.waitForTimeout(200);});
  await capture('09-activity',async()=>{if(d.width<600)await page.getByRole('button',{name:'활동 등록',exact:true}).click();await page.locator('.lead-feed').waitFor({state:'visible'});});
  for(const [label,name] of [['과업','10-task'],['통화 기록','11-call'],['이벤트','12-event']]) {await capture(name,async()=>{await page.getByRole('button',{name:`새 ${label}`,exact:true}).click();await page.locator('dialog[open]').waitFor();},false);await capture(`${name}-bottom`,async()=>{await page.locator('dialog[open]').evaluate(el=>{el.scrollTop=el.scrollHeight});},false);await page.locator('dialog[open]').getByRole('button',{name:'닫기'}).click().catch(async()=>{await page.keyboard.press('Escape')});}
  await capture('13-related',async()=>{if(d.width<600)await page.getByRole('button',{name:'관련 정보',exact:true}).click();await page.locator('.lead-related').waitFor({state:'visible'});});
  for(const [label,name] of [['중복된 항목 보기','14-duplicates'],['캠페인에 추가','15-campaign'],['좌표 수정 요청','16-coordinate']]) {await capture(name,async()=>{await page.locator('.lead-related').getByRole('button',{name:label,exact:true}).click();await page.locator('dialog[open]').waitFor();},false);await page.locator('dialog[open]').getByRole('button',{name:'닫기'}).click().catch(async()=>{await page.keyboard.press('Escape')});}
  await capture('17-information-expanded',async()=>{await open();if(d.width<600)await page.getByRole('navigation',{name:'리드 화면 구역'}).getByRole('button',{name:'상세 정보'}).click();for(const button of await page.locator('.lead-details-form:visible .lead-section-toggle:visible').all())if(await button.getAttribute('aria-expanded')==='false')await button.click();});
  await capture('18-chatter',async()=>{if(d.width<600)await page.getByRole('button',{name:'활동 등록',exact:true}).click();await page.locator('.lead-feed').getByRole('tab',{name:'Chatter'}).click();});
  await capture('19-owner-change',async()=>{await open();if(d.width<600)await page.locator('.lead-more-toggle').click();await page.locator('.hq-lead-detail').getByRole('button',{name:'담당자 변경'}).click();await page.locator('dialog[open]').waitFor();},false);
  if(await page.locator('dialog[open]').count())await page.locator('dialog[open]').getByRole('button',{name:'닫기'}).click();
  await capture('20-conversion',async()=>{if(d.width<600 && await page.locator('.lead-more-toggle').getAttribute('aria-expanded')==='false')await page.locator('.lead-more-toggle').click();await page.locator('.hq-lead-detail').getByRole('button',{name:'고객 전환'}).click();await page.locator('dialog[open]').waitFor();},false);
  await capture('21-conversion-bottom',async()=>{await page.locator('dialog[open]').evaluate(el=>{el.scrollTop=el.scrollHeight});},false);
 } finally {await context.close();server.server.closeAllConnections();await server.close();}
}
await browser.close();await writeFile(`${root}/manifest.json`,JSON.stringify({created:'2026-11-12',source:'isolated HQ mock, synthetic seed data',devices,results},null,2));
console.log(JSON.stringify({captured:results.filter(x=>x.status==='captured').length,failed:results.filter(x=>x.status==='failed').length}));
