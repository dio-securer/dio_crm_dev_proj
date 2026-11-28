import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';
const out=path.resolve('docs/crm-activity/full-walkthrough-20261108/navigation');fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});const steps=[];
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',timeout:120000});
for(const size of [{width:1440,height:900,device:'PC'},{width:768,height:1024,device:'태블릿'},{width:390,height:844,device:'모바일'}]){
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});const context=await browser.newContext({viewport:size,locale:'ko-KR',timezoneId:'Asia/Seoul'});const page=await context.newPage();page.setDefaultTimeout(8000);let n=0;
 const test=async(title,actions,expected,fn)=>{const id=`nav-${size.width}-${++n}`,screenshots=[];let actual='',status='PASS';const shot=async(suffix)=>{const file=`screenshots/${id}-${suffix}.png`;await page.screenshot({path:path.join(out,file),fullPage:true});screenshots.push(file);};try{await shot('before');actual=await fn();await shot('after');}catch(e){status='FAIL';actual=e.message;await shot('failure').catch(()=>{});}steps.push({id,device:size.device,area:'메뉴 이동',title,actions,expected,actual,status,screenshots,note:'별도 메모리 서버, 실제 앱 메뉴를 클릭한 결과'});fs.writeFileSync(path.join(out,'steps.json'),JSON.stringify(steps,null,2));console.log(id,status,title);};
 try{
  await page.goto(server.url+'/activities',{waitUntil:'domcontentloaded'});await page.locator('.hq-mock-controls select').first().selectOption('hq-sales');await page.getByLabel('활동 검색').waitFor();
  if(size.width<1000){
   await test('더보기 메뉴 열기',['활동 화면 하단의 더보기를 누른다.'],'추가 메뉴가 열린다.',async()=>{await page.getByRole('button',{name:'더보기',exact:true}).click();await page.locator('.mobile-drawer').waitFor();return '추가 메뉴 표시';});
   await test('더보기 닫기 버튼',['추가 메뉴 오른쪽 위 닫기를 누른다.'],'추가 메뉴가 닫힌다.',async()=>{await page.locator('.mobile-drawer').getByRole('button',{name:'닫기',exact:true}).click();await page.locator('.mobile-drawer').waitFor({state:'hidden'});return '닫기 버튼으로 메뉴 닫힘';});
   await test('더보기 바깥 영역 닫기',['더보기를 다시 누른다.','메뉴 바깥 배경의 왼쪽 위를 누른다.'],'메뉴 바깥 클릭으로 닫힌다.',async()=>{await page.getByRole('button',{name:'더보기',exact:true}).click();await page.locator('.mobile-drawer-backdrop').click({position:{x:2,y:2}});await page.locator('.mobile-drawer').waitFor({state:'hidden'});return '배경 클릭으로 메뉴 닫힘';});
  }
  for(const [route,title] of [['/activity-reports','활동보고'],['/direct-work','직출·직퇴'],['/activities','활동']]){
   await test(`${title} 메뉴 이동`,[size.width<1000?'하단 더보기 또는 활동 메뉴를 사용한다.':'왼쪽 업무 메뉴를 사용한다.',`${title} 링크를 누른다.`],`${title} 화면으로 이동하고 영업 담당자 세션을 유지한다.`,async()=>{let link=page.locator(`a[href="${route}"]:visible`).first();if(!await link.count()){await page.getByRole('button',{name:'더보기',exact:true}).click();link=page.locator(`.mobile-drawer a[href="${route}"]`);}await link.click();await page.waitForURL(`**${route}`);assert.equal(await page.locator('.hq-mock-controls select').first().inputValue(),'hq-sales');return `${route} 이동, 영업 담당자 세션 유지`;});
  }
 }finally{await Promise.race([context.close(),new Promise(r=>setTimeout(r,2000))]);server.server.closeAllConnections();await Promise.race([server.close(),new Promise(r=>setTimeout(r,2000))]);}
}
await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);console.log(JSON.stringify({records:steps.length,failures:steps.filter(x=>x.status==='FAIL').length}));process.exit(0);
