import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startHqServer} from './server.mjs';
const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});const browser=await chromium.launch({headless:true});
try {for(const width of [320,390]){
 const page=await browser.newPage({viewport:{width,height:844}});
 try{
  for(const [route,name,primary] of [['/opportunities','기회 등록',true],['/orders','새 주문',true],['/contracts','계약 등록',true],['/collection-plans','조회 조건 초기화',false]]){
   await page.goto(server.url+route);const button=page.getByRole('button',{name,exact:true});await button.waitFor();
   assert.equal(await button.evaluate(e=>getComputedStyle(e).fontSize),'15px',`${route} ${name} 글자 크기`);
   await button.hover();await page.waitForFunction(({name,primary})=>{const el=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===name);if(!el)return false;const s=getComputedStyle(el);return s.backgroundColor===(primary?'rgb(255, 255, 255)':'rgb(7, 88, 215)')&&s.color===(primary?'rgb(7, 88, 215)':'rgb(255, 255, 255)')},{name,primary},{timeout:5000});
   console.log(`${width} ${route} ${name} PASS`);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  console.log(`${width} PASS 주요 버튼 반전·글자 크기`);
 }finally{await page.close()}
}}finally{await browser.close();server.server.closeAllConnections();await server.close()}
