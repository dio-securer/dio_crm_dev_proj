import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startHqServer} from './server.mjs';
const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});
const browser=await chromium.launch({headless:true});
const results=[];
try{
 for(const [name,width,height] of [['PC',1440,900],['패드',768,1024],['모바일',390,844]]){
  const context=await browser.newContext({viewport:{width,height},locale:'ko-KR',serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(8000);
  try{
   await page.route('**/api/orders/eligible-contracts',route=>route.fulfill({status:200,contentType:'application/json',headers:{'X-HQ-Mock':'true'},body:'[]'}));
   await page.goto(server.url+'/orders');
   await page.getByRole('button',{name:'새 주문',exact:true}).click();
   await page.getByText('주문 가능한 패키지 계약이 없습니다.').waitFor();
   assert.equal(await page.getByRole('button',{name:'주문 초안 만들기'}).isDisabled(),true);
   results.push({name,status:'PASS'});
  }catch(error){results.push({name,status:'FAIL',error:error.message});}
  finally{await context.close();}
 }
}finally{await browser.close();server.server.closeAllConnections();await server.close();}
console.log(JSON.stringify(results,null,2));if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
