import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from '../../frontend/node_modules/vite/dist/node/index.js';
import '../hq-standard/register.mjs';
const {resolveCompanyConfig,resolveActorPolicy}=await import('../../packages/contracts/src/crm-customization.ts');
const artifact=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-customization-baseline.json','utf8'));
const companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',releaseId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',rowId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const result={scope:'Real React components against browser-intercepted HTTP fixtures; no DB or deployment',status:'PASS',checks:[],screenshots:[],errors:[]};
const out='docs/admin-platform/customization/implementation/evidence/I02';
const entry="import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import '/src/i18n';import {changeLocale} from '/src/i18n';import {ConfiguredLeads} from '/src/customization/ConfiguredLeads';createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><button onClick={()=>changeLocale('en-US')}>English</button><button onClick={()=>changeLocale('ko-KR')}>한국어</button><ConfiguredLeads/></QueryClientProvider>);";
const server=await createServer({root:'frontend',resolve:{alias:[{find:'@dio-crm/contracts/crm-customization',replacement:process.cwd()+'/packages/contracts/src/crm-customization.ts'},{find:'@dio-crm/contracts/lead-grid-columns',replacement:process.cwd()+'/packages/contracts/src/lead-grid-columns.ts'},{find:'@dio-crm/contracts',replacement:process.cwd()+'/packages/contracts/src/index.ts'}]},configFile:false,logLevel:'error',plugins:[{name:'isolated-lead-ui-fixture',resolveId:id=>id==='lead-test'?'\0lead-test':undefined,load:id=>id==='\0lead-test'?{code:entry.replace('return never',''),map:null}:undefined,transform:async(code,id)=>id==='\0lead-test'?(await import('../../frontend/node_modules/vite/dist/node/index.js')).transformWithEsbuild(code,'fixture.tsx',{loader:'tsx',jsx:'transform'}):undefined}],server:{host:'127.0.0.1',port:5199,strictPort:true}});
server.middlewares.use('/__lead-test',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/__x00__lead-test"></script></body></html>');});
assert.equal(fs.existsSync('frontend/__phone-qa.html'),false);
fs.writeFileSync('frontend/__phone-qa.html','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/__x00__lead-test"></script></body></html>');
await server.listen();const browser=await chromium.launch({channel:'chrome',headless:true});
try {
for(const loginId of ['hq-admin','hq-sales','hq-branch','hq-division','hq-viewer']){
 const login=await fetch('http://127.0.0.1:3211/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId,password:'HQ-DEMO'})}).then(r=>r.json());
 const session=await fetch('http://127.0.0.1:3211/api/hq/session',{headers:{authorization:'Bearer '+login.accessToken}}).then(r=>r.json());
 const allowed=session.user.permissions;
 for(const width of [1440,390])for(const prop of ['label','readOnly','required','visible']){
 const rel=JSON.parse(fs.readFileSync('docs/Codex/work/phone-release-'+prop+'.json'));
 const page=await browser.newPage({viewport:{width,height:844}});page.setDefaultTimeout(5000);page.on('pageerror',console.error);
 try{
 const effective=resolveCompanyConfig(artifact.catalog,rel.config),policy=resolveActorPolicy(effective,companyId,{authenticated:true,companyId,allowed,denied:[]});
 const labels=Object.fromEntries(effective.entries.map(e=>[e.id,rel.config.translations['ko-KR']?.[e.labelKey]??artifact.translations['ko-KR'][e.labelKey]]));
 const row={version:'0x0000000000000001',public_id:rowId,hospital_name:'QA Clinic',status:'NEW',phone:'051-123-1111'};
 let writes=0;
 await page.route('**/api/**',async route=>{
 const req=route.request(),url=new URL(req.url()),headers={'X-Config-Release-Id':rel.id,'X-Config-Permission-Version':'1'};
 if(url.pathname.endsWith('/effective-config'))return route.fulfill({headers,json:{releaseId:rel.id,permissionVersion:1,leadExtensionsEnabled:false,policy,labels,translations:artifact.translations['ko-KR']}});
 if(req.method()==='PATCH'){writes++;row.phone=req.postDataJSON().phone;return route.fulfill({headers,json:row});}
 const data={...row};if(prop==='visible')delete data.phone;
 return route.fulfill({headers,json:url.pathname==='/api/leads'?[data]:data});
 });
 await page.goto('http://127.0.0.1:5199/__phone-qa.html');
 const open=()=>page.getByRole('button',{name:'상세',exact:true}).first().click();await open();
 const dialog=page.getByRole('dialog'),field=dialog.getByRole('textbox',{name:'대표 연락 전화',exact:true}),close=()=>dialog.getByRole('button',{name:'닫기',exact:true}).click();
 await dialog.getByText('QA Clinic',{exact:true}).or(dialog.locator('input[value="QA Clinic"]')).first().waitFor();
 if(prop==='visible'){assert.equal(await dialog.getByText('대표 연락 전화',{exact:true}).count(),0);assert.equal(await field.count(),0);}
 else if(prop==='readOnly'||!allowed.includes('LEAD.WRITE')){assert.equal(await field.count(),0);await dialog.getByText(row.phone,{exact:true}).waitFor();}
 else{
 await field.fill('051-999-1111');await close();await open();assert.equal(await field.inputValue(),row.phone);assert.equal(writes,0);
 if(prop==='required'){await field.fill('');assert.equal(await field.evaluate(e=>e.validity.valueMissing),true);assert.equal(await dialog.getByRole('button',{name:'저장',exact:true}).isDisabled(),true);await dialog.getByText('필수 항목: 대표 연락 전화').waitFor();assert.equal(writes,0);}
 await field.fill('051-999-2222');await dialog.getByRole('button',{name:'저장',exact:true}).click();await page.waitForResponse(()=>false,{timeout:100}).catch(()=>{});
 await page.reload();await open();assert.equal(await field.inputValue(),'051-999-2222');assert.equal(writes,1);
 }
 console.log('PASS',loginId,width,prop);
 }catch(error){console.error(String(error),await page.locator('body').innerText());throw error;}finally{await page.close();}
 }
}
}finally{await browser.close();fs.unlinkSync('frontend/__phone-qa.html');await server.close();}
