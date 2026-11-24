import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startHqServer} from './server.mjs';
import {createHqApplication,HqRepository} from './runtime.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
const standard=structuredClone(createHqApplication().standard);const field=standard.fields.find(x=>x.fieldKey==='order.deliveryAddress');field.masking='last4';delete field.unmaskPermission;
const secret='서울 비밀주소 1234',replacement='부산 새주소 9876';
const factory=datasetId=>{const repo=new HqRepository({datasetId});if(datasetId==='HQ_DEMO')repo.transact(d=>{const o=d.collections.orders.find(x=>x.public_id===seedIDs.readyOrder);o.delivery_address_type='DIRECT';o.delivery_address=secret;});return repo;};
const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{standard,repositoryFactory:factory}});
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();
try {
 await page.goto(server.url+'/orders');await page.getByRole('heading',{name:'주문 목록'}).waitFor();
 const target=page.locator('.h06-row').filter({hasText:'DRAFT'}).first();await target.click();
 const address=page.locator('label').filter({hasText:'보호된 주소'}).locator('input');await address.waitFor();assert.equal(await address.inputValue(),'');
 await page.getByLabel('비고',{exact:true}).fill('비고 변경');assert.equal(await page.getByRole('button',{name:'배송 저장'}).isDisabled(),true);
 assert.equal(server.app.repository('HQ_DEMO').read().collections.orders.find(x=>x.public_id===seedIDs.readyOrder).delivery_address,secret);
 const other=page.locator('.h06-row[aria-current="false"]').first();assert.ok(await other.count());
 page.once('dialog',d=>d.dismiss());await other.click();assert.equal(await page.getByLabel('비고',{exact:true}).inputValue(),'비고 변경');
 page.once('dialog',d=>d.accept());await other.click();await page.waitForFunction(id=>new URLSearchParams(location.search).get('record')!==id,seedIDs.readyOrder);
 await target.click();await address.waitFor();await page.getByLabel('비고',{exact:true}).fill('비고 변경');
 await address.fill(replacement);await page.getByRole('button',{name:'배송 저장'}).click();await page.getByText('배송 정보를 저장했습니다.').waitFor();
 assert.equal(server.app.repository('HQ_DEMO').read().collections.orders.find(x=>x.public_id===seedIDs.readyOrder).delivery_address,replacement);
 console.log('PASS protected input empty, note-only save blocked, full address reentry saved');
}finally{await context.close();await browser.close();server.server.closeAllConnections();await server.close();}
