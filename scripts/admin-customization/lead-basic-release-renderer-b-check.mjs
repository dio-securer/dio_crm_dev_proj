// One process owns both configuration service and browser fixture. No SQL or deployment.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { createServer, transformWithEsbuild } from '../../frontend/node_modules/vite/dist/node/index.js';
import '../hq-standard/register.mjs';
const { MemoryAdminConfigRepository, emptyConfigState } = await import('../../backend/src/customization/config-store.ts');
const { CompanyConfigurationService, makeStandardArtifact } = await import('../../backend/src/customization/config-service.ts');
const companyA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',companyB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const admin='11111111-1111-4111-8111-111111111111',limited='22222222-2222-4222-8222-222222222222',rowId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const makeEntry=(id,kind,extra={})=>({id,kind,labelKey:id,support:'supported',settings:{enabled:true,visible:true,readOnly:false,required:false,order:0},capabilities:['enabled','visible','order'],locks:[],dependencies:[],permissions:[],readPermissions:[],writePermissions:[],requiredTranslation:true,...extra});
const names={hospitalName:'Hospital',phone:'Phone',address:'Address',businessNo:'Business number'};
const entries=[makeEntry('HQ_LEAD','SCREEN'),makeEntry('LEAD.save','ACTION',{screenId:'HQ_LEAD'}),...Object.keys(names).map(k=>makeEntry('lead.'+k,'FIELD',{screenId:'HQ_LEAD',bindingKind:'DATA',apiField:k,...(k==='phone'?{readPermissions:['lead.phone.read']}:{})}))];
const catalog={schemaVersion:1,standardReleaseId:'lead-basic.1',entries},translations={'ko-KR':Object.fromEntries(entries.map(e=>[e.id,names[e.id.slice(5)]??'Label '+e.id]))};
const permissions=['config.read','config.edit','config.preview','config.publish','runtime.read','lead.phone.read'];
const members={[admin]:{active:true,permissions,denied:[]},[limited]:{active:true,permissions:['runtime.read'],denied:['lead.phone.read']}};
const repo=new MemoryAdminConfigRepository([emptyConfigState(companyA,members),emptyConfigState(companyB,members)]);
const service=new CompanyConfigurationService(repo,[makeStandardArtifact('lead-basic',catalog,translations,true)]);
const actor=c=>({companyId:c,id:admin});
async function publish(c,config={},expected=null,suffix='initial',inspectBefore){const a=actor(c);let d=await service.createDraft(a,'lead-basic.1',expected,'create-'+c+suffix);d=await service.saveDraft(a,d.id,d.revision,{patches:[],activeLocales:['ko-KR'],defaultLocale:'ko-KR',translations:{},...config},'save-'+c+suffix);const validation=await service.validate(a,d.id,d.revision);assert.deepEqual(validation.errors,[]);await service.preview(a,validation.id);if(inspectBefore)await inspectBefore();return service.publish(a,validation.id,expected,'test','publish-'+c+suffix);}
await publish(companyB);
const bBefore=await service.effective(actor(companyB));
const baseline=await publish(companyA);const aBefore=await service.effective(actor(companyA));
await publish(companyA,{placementOrders:{'lead.detail.basic':['lead.phone','lead.hospitalName','lead.address','lead.businessNo']},placementPresentation:{schemaVersion:1,values:{'lead.detail.basic.phone':{'ko-KR':{label:'Local phone',helpText:'Contact at clinic'}}}}},baseline.id,'changed',async()=>assert.deepEqual(await service.effective(actor(companyA)),aBefore));
const a=await service.effective(actor(companyA)),b=await service.effective(actor(companyB)),restricted=await service.effective({companyId:companyA,id:limited});
assert.deepEqual(b.placementOrders,bBefore.placementOrders);assert.equal(b.placementPresentation,undefined);
assert.equal(a.placementPresentation['lead.detail.basic.phone'].label,'Local phone');assert.equal(restricted.placementPresentation?.['lead.detail.basic.phone'],undefined);
assert.equal(restricted.policy.find(p=>p.id==='lead.phone').readable,false);
const entry="import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import '/src/i18n';import {ConfiguredLeads} from '/src/customization/ConfiguredLeads';createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ConfiguredLeads/></QueryClientProvider>);";
const virtual='lead-basic-release-b-fixture';
const server=await createServer({root:'frontend',resolve:{alias:[{find:'@dio-crm/contracts/crm-customization',replacement:process.cwd()+'/packages/contracts/src/crm-customization.ts'},{find:'@dio-crm/contracts/lead-grid-columns',replacement:process.cwd()+'/packages/contracts/src/lead-grid-columns.ts'},{find:'@dio-crm/contracts',replacement:process.cwd()+'/packages/contracts/src/index.ts'}]},configFile:false,logLevel:'error',plugins:[{name:virtual,resolveId:id=>id===virtual?'\0'+virtual:undefined,load:id=>id==='\0'+virtual?entry:undefined,transform:(code,id)=>id==='\0'+virtual?transformWithEsbuild(code,virtual+'.tsx',{loader:'tsx',jsx:'transform'}):undefined}],server:{host:'127.0.0.1',port:5299,strictPort:true}});
const html='frontend/__lead-basic-release-b-fixture.html';assert.equal(fs.existsSync(html),false);fs.writeFileSync(html,`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/__x00__${virtual}"></script></body></html>`);
const report={scope:'Memory configuration service actual release and effective; intercepted synthetic read endpoint; actual managed React renderer; no actual DB, authentication or HTTP server',checks:[],errors:[]};let browser;
try{await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 for(const [name,effective] of [['A',a],['B',b],['limited',restricted]]){
  const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(10000);page.on('pageerror',error=>report.errors.push(String(error)));
  const headers={'Content-Type':'application/json','X-Config-Release-Id':effective.releaseId,'X-Config-Permission-Version':String(effective.permissionVersion)};
  const permitted=new Set(effective.policy.filter(p=>p.readable).map(p=>p.id));
  const detail={public_id:rowId,hospital_name:'Example clinic',phone:'010-0000',address:'Address value',business_no:'1234'};
  // B check: deliberately send phone despite restricted policy to verify renderer boundary.
  await page.route('**/api/**',route=>{const url=new URL(route.request().url());if(url.pathname==='/api/runtime/effective-config')return route.fulfill({headers,body:JSON.stringify(effective)});if(url.pathname==='/api/leads')return route.fulfill({headers,body:JSON.stringify([detail])});if(url.pathname==='/api/leads/'+rowId)return route.fulfill({headers,body:JSON.stringify(detail)});return route.fulfill({status:404,headers,body:'{}'});});
  await page.goto('http://127.0.0.1:5299/__lead-basic-release-b-fixture.html');await page.getByRole('button',{name:'상세',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
  const labels=await dialog.locator('dl dt').allTextContents();
  if(name==='A'){assert.deepEqual(labels.slice(0,4),['Local phone','Hospital','Address','Business number']);assert.equal(await dialog.locator('#help-lead-detail-basic-phone').innerText(),'Contact at clinic');}
  if(name==='B'){assert.deepEqual(labels.slice(0,4),['Hospital','Phone','Address','Business number']);assert.equal(await dialog.getByText('Local phone').count(),0);}
  if(name==='limited'){assert.deepEqual(labels.slice(0,3),['Hospital','Address','Business number']);assert.equal(await dialog.getByText('Local phone').count(),0);}
  report.checks.push(`${name}: service effective rendered; expected ordering/labels and read boundary`);await page.close();
 }
 assert.deepEqual(report.errors,[]);
}catch(error){report.errors.push(String(error));process.exitCode=1;}finally{if(browser)await browser.close();await server.close();fs.unlinkSync(html);fs.mkdirSync('.local-manual-review',{recursive:true});fs.writeFileSync('.local-manual-review/lead-basic-release-renderer-b.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}

