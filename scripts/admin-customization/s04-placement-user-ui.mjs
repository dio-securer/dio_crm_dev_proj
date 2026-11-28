import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer,transformWithEsbuild} from '../../frontend/node_modules/vite/dist/node/index.js';
import '../hq-standard/register.mjs';

const {resolveCompanyConfig,resolveActorPolicy}=await import('../../packages/contracts/src/crm-customization.ts');
const artifact=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-codes-review.json','utf8'));
const companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',releaseId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',rowId='cccccccc-cccc-4ccc-8ccc-cccccccccccc',fieldId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const out='.local-manual-review';fs.mkdirSync(out,{recursive:true});
const report={status:'PASS',scope:'Actual managed React UI, intercepted synthetic HTTP; no DB, migration or deployment',checks:[],errors:[]};
const entry="import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import '/src/i18n';import {ConfiguredLeads} from '/src/customization/ConfiguredLeads';createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ConfiguredLeads/></QueryClientProvider>);";
const server=await createServer({root:'frontend',resolve:{alias:[{find:'@dio-crm/contracts/crm-customization',replacement:process.cwd()+'/packages/contracts/src/crm-customization.ts'},{find:'@dio-crm/contracts/lead-grid-columns',replacement:process.cwd()+'/packages/contracts/src/lead-grid-columns.ts'},{find:'@dio-crm/contracts',replacement:process.cwd()+'/packages/contracts/src/index.ts'}]},configFile:false,logLevel:'error',plugins:[{name:'lead-extension-fixture',resolveId:id=>id==='lead-extension-fixture'?'\0lead-extension-fixture':undefined,load:id=>id==='\0lead-extension-fixture'?entry:undefined,transform:(code,id)=>id==='\0lead-extension-fixture'?transformWithEsbuild(code,'fixture.tsx',{loader:'tsx',jsx:'transform'}):undefined}],server:{host:'127.0.0.1',port:5196,strictPort:true}});
const fixture='frontend/__lead-extension-fixture.html';assert.equal(fs.existsSync(fixture),false);fs.writeFileSync(fixture,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/__x00__lead-extension-fixture"></script></body></html>');
let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:900}});page.setDefaultTimeout(10000);page.on('pageerror',e=>report.errors.push(String(e)));
  let metaFail=false,detailFail=false,failWrite=false,extensionValue='Saved note',revision=2;
  const commands=[];
  const row={public_id:rowId,hospital_name:'Existing clinic',status:'NEW',version:'0x0000000000000001'};
  const definition={id:fieldId,version:3,type:'text',required:false,labels:{'ko-KR':'본사 추가 메모','en-US':'HQ Note'},readable:true,writable:true,maxLength:30};
  await page.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),headers={'Content-Type':'application/json','X-Config-Release-Id':releaseId,'X-Config-Permission-Version':'1'};
   if(url.pathname==='/api/runtime/effective-config'){
    const effective=resolveCompanyConfig(artifact.catalog,{companyId,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[]});
    const allowed=[...new Set(artifact.catalog.entries.flatMap(e=>[...e.permissions,...e.readPermissions,...e.writePermissions]))];
    const policy=resolveActorPolicy(effective,companyId,{authenticated:true,companyId,allowed,denied:[]});
    const labels=Object.fromEntries(effective.entries.filter(e=>policy.find(p=>p.id===e.id)?.readable).map(e=>[e.id,artifact.translations['ko-KR'][e.labelKey]]));
    return route.fulfill({headers,body:JSON.stringify({releaseId,permissionVersion:1,leadExtensionsEnabled:true,buttonPresentation:{'lead.detail.save':'primary'},popupPresentation:{'POP.LEAD.CREATE':{title:'Configured lead creation',size:'small'}},placementPresentation:{'lead.create.basic.hospitalName':{label:'Create hospital',helpText:'Create help'},'lead.detail.basic.hospitalName':{label:'Detail hospital',helpText:'Detail help'}},policy,labels,translations:artifact.translations['ko-KR']})});
   }
   if(url.pathname==='/api/leads/extension-fields')return route.fulfill({status:metaFail?503:200,headers,body:JSON.stringify(metaFail?{code:'EXTENSION_ADAPTER_UNAVAILABLE'}:{definitions:[definition]})});
   if(url.pathname==='/api/leads'&&req.method()==='GET')return route.fulfill({headers,body:JSON.stringify([row])});
   if(url.pathname==='/api/leads/'+rowId&&req.method()==='GET'&&url.searchParams.get('extensions')==='1')return route.fulfill({status:detailFail?503:200,headers,body:JSON.stringify(detailFail?{code:'EXTENSION_ADAPTER_UNAVAILABLE'}:{...row,extensionRevision:revision,extensionFields:[definition],extensionValues:{[fieldId]:{definitionVersion:3,value:extensionValue}}})});
   if(req.method()==='POST'||req.method()==='PATCH'){
    commands.push({path:url.pathname,body:req.postDataJSON(),headers:req.headers()});
    if(failWrite){failWrite=false;return route.fulfill({status:503,headers,body:JSON.stringify({code:'TEMPORARY_FAILURE'})});}
    const body=req.postDataJSON();if(req.method()==='PATCH'){if(body.base.hospitalName)row.hospital_name=body.base.hospitalName;if(body.extensions[fieldId])extensionValue=body.extensions[fieldId].value;revision++;}
    return route.fulfill({headers,body:JSON.stringify({public_id:rowId,version:row.version,extensionRevision:revision})});
   }
   return route.fulfill({status:404,headers,body:'{}'});
  });
  await page.goto('http://127.0.0.1:5196/__lead-extension-fixture.html');await page.getByText('Existing clinic',{exact:true}).waitFor();
  const createName=artifact.translations['ko-KR'][artifact.catalog.entries.find(e=>e.id==='LEAD.create').labelKey];
  await page.getByRole('button',{name:createName,exact:true}).click();const dialog=page.getByRole('dialog',{name:'Configured lead creation'});await dialog.waitFor();const popupWidth=await dialog.evaluate(n=>n.getBoundingClientRect().width);assert.ok(Math.abs(popupWidth-(width===390?358:480))<2);
  await dialog.getByLabel('본사 추가 메모').waitFor();assert.equal(await dialog.getByLabel('Create hospital').getAttribute('aria-describedby'),'help-lead-create-basic-hospitalName');assert.equal(await dialog.locator('#help-lead-create-basic-hospitalName').innerText(),'Create help');await dialog.getByLabel('Create hospital',{exact:true}).fill('Created clinic');await dialog.getByLabel('본사 추가 메모').fill('First note');
  failWrite=true;await dialog.getByRole('button',{name:'저장',exact:true}).click();await dialog.getByRole('button',{name:'다시 시도',exact:true}).waitFor();await dialog.getByRole('button',{name:'다시 시도',exact:true}).click();await dialog.waitFor({state:'detached'});
  assert.equal(commands.at(-1).path,'/api/leads');assert.deepEqual(commands.at(-1).body,{base:{hospitalName:'Created clinic'},extensions:{[fieldId]:{definitionVersion:3,value:'First note'}}});assert.equal(commands.at(-1).headers['idempotency-key'],commands.at(-2).headers['idempotency-key']);report.checks.push(`${width}: create envelope and uncertain retry preserve body/key`);
  await page.getByRole('button',{name:'상세',exact:true}).click();await page.getByRole('dialog').getByLabel('본사 추가 메모').waitFor();assert.equal(await page.getByRole('dialog').getByLabel('Detail hospital').getAttribute('aria-describedby'),'help-lead-detail-basic-hospitalName');assert.equal(await page.getByRole('dialog').locator('#help-lead-detail-basic-hospitalName').innerText(),'Detail help');assert.equal(await page.getByRole('dialog').getByLabel('본사 추가 메모').inputValue(),'Saved note');
  const detailSave=page.getByRole('dialog').getByRole('button',{name:'저장',exact:true});assert.equal(await detailSave.isDisabled(),true);assert.equal(await detailSave.evaluate(n=>n.classList.contains('crm-button-emphasis-primary')),true);await page.getByRole('dialog').getByLabel('본사 추가 메모').fill('Edited note');assert.equal(await detailSave.isEnabled(),true);await detailSave.click();await page.getByRole('dialog').waitFor({state:'detached'});
  assert.deepEqual(commands.at(-1).body,{base:{},extensions:{[fieldId]:{definitionVersion:3,value:'Edited note'}},expectedBaseVersion:'0x0000000000000001',expectedExtensionRevision:2});
  await page.getByRole('button',{name:'상세',exact:true}).click();assert.equal(await page.getByRole('dialog').getByLabel('본사 추가 메모').inputValue(),'Edited note');report.checks.push(`${width}: extension-only detail edit and fresh read`);
  await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.close();
 }
 assert.deepEqual(report.errors,[]);
}catch(error){report.status='FAIL';report.errors.push(String(error));process.exitCode=1;}finally{if(browser)await browser.close();await server.close();fs.unlinkSync(fixture);fs.writeFileSync(out+'/s04-managed-ui-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
