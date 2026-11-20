import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';
const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,dist:process.env.OPPORTUNITY_REVIEW_DIST ?? 'frontend/dist'});
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
const auth=await(await fetch(server.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:'hq-sales',password:'HQ-DEMO'})})).json();
await fetch(server.url+'/api/opportunities',{method:'POST',headers:{authorization:`Bearer ${auth.accessToken}`,'content-type':'application/json'},body:JSON.stringify({accountPublicId:seedIDs.approvedAccount,opportunityName:'Independent original',expectedCloseDate:'2026-12-20'})});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',timeout:120000});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900},locale:'ko-KR'});page.setDefaultTimeout(12000);
 await page.goto(server.url+'/opportunities',{waitUntil:'domcontentloaded'});await page.locator('.hq-mock-controls select').first().selectOption('hq-sales');await page.locator('.hq-sales-row').filter({hasText:'Independent original'}).click();
 const name=page.getByLabel('기회명');await name.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(e=>e.value==='Independent original'));
 const trigger=page.getByRole('button',{name:'제품 검색·복수 선택'});await trigger.focus();await trigger.click();const dialog=page.locator('dialog[open]');await dialog.waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await trigger.evaluate(e=>new Promise((resolve,reject)=>{let n=0;const i=setInterval(()=>{if(document.activeElement===e){clearInterval(i);resolve()}else if(++n>40){clearInterval(i);reject(Error('focus not restored'))}},100)}));console.log('PASS modal escape focus');
 await name.fill('Independent change');assert.equal(await name.inputValue(),'Independent change');
 const first=page.waitForEvent('dialog',{timeout:10000});await page.evaluate(()=>history.back());const popup=await first;console.log('CONFIRM',popup.message());await popup.dismiss();await page.waitForURL(/record=/);assert.equal(await name.inputValue(),'Independent change');console.log('PASS browser back cancel preserves draft');
 const second=page.waitForEvent('dialog',{timeout:10000});await page.evaluate(()=>history.back());const again=await second;await again.accept();await page.getByRole('heading',{name:'기회 목록'}).waitFor();console.log('PASS browser back accept navigates');
} finally { await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);server.server.closeAllConnections();await server.close(); }
