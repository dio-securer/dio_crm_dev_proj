import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startHqServer} from './server.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});const browser=await chromium.launch({headless:true});
try{for(const width of [320,390]){const page=await browser.newPage({viewport:{width,height:844}});try{
 await page.goto(`${server.url}/contracts?record=${seedIDs.approvedContract}`);
 const group=page.locator('.hq-contract-detail-actions').first();const order=group.getByRole('button',{name:'주문 작성'});const sales=group.getByRole('button',{name:'매출현황 조회'});await order.waitFor();await sales.waitFor();
 const g=await group.boundingBox(),a=await order.boundingBox(),b=await sales.boundingBox();assert.ok(g&&a&&b);assert.ok(Math.abs(a.width-b.width)<2);assert.ok(Math.abs(a.x-g.x)<2&&Math.abs((b.x+b.width)-(g.x+g.width))<2);
 const plans=page.locator('.hq-contract-detail-actions').last();const view=plans.getByRole('button',{name:'수금계획 조회'}),edit=plans.getByRole('button',{name:'변경 수금계획 편집'});await edit.waitFor();const pg=await plans.boundingBox(),pv=await view.boundingBox(),pe=await edit.boundingBox();assert.ok(pg&&pv&&pe);assert.ok(Math.abs(pv.width-pe.width)<2);assert.ok(Math.abs((pe.x+pe.width)-(pg.x+pg.width))<2);
 await view.click();await page.getByRole('dialog',{name:'수금계획 조회'}).getByRole('button',{name:'닫기',exact:true}).last().click();await edit.click();await page.getByRole('dialog',{name:'변경 수금계획 편집'}).getByRole('button',{name:'취소',exact:true}).last().click();
 await sales.click();await page.getByRole('dialog',{name:'매출현황 조회'}).getByRole('button',{name:'취소'}).click();
 await order.click();await page.getByRole('dialog').getByRole('heading',{name:/주문/}).first().waitFor();
 console.log(`${width} PASS 계약 상세 버튼 폭·동작`);
 }finally{await page.close()}}}finally{await browser.close();server.server.closeAllConnections();await server.close()}
