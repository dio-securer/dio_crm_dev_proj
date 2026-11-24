import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from '../../frontend/node_modules/vite/dist/node/index.js';
import '../hq-standard/register.mjs';
const {resolveCompanyConfig,resolveActorPolicy}=await import('../../packages/contracts/src/crm-customization.ts');
const artifact=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-codes-review.json','utf8'));
const companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',releaseId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',rowId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const result={scope:'Real React components against browser-intercepted HTTP fixtures; no DB or deployment',status:'PASS',checks:[],screenshots:[],errors:[]};
const out='docs/admin-platform/customization/implementation/evidence/I02';
const entry="import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import '/src/i18n';import {changeLocale} from '/src/i18n';import {ConfiguredLeads} from '/src/customization/ConfiguredLeads';createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><button onClick={()=>changeLocale('en-US')}>English</button><button onClick={()=>changeLocale('ko-KR')}>한국어</button><ConfiguredLeads/></QueryClientProvider>);";
const server=await createServer({root:'frontend',resolve:{alias:[{find:'@dio-crm/contracts/crm-customization',replacement:process.cwd()+'/packages/contracts/src/crm-customization.ts'},{find:'@dio-crm/contracts/lead-grid-columns',replacement:process.cwd()+'/packages/contracts/src/lead-grid-columns.ts'},{find:'@dio-crm/contracts',replacement:process.cwd()+'/packages/contracts/src/index.ts'}]},configFile:false,logLevel:'error',plugins:[{name:'isolated-lead-ui-fixture',resolveId:id=>id==='lead-test'?'\0lead-test':undefined,load:id=>id==='\0lead-test'?{code:entry.replace('return never',''),map:null}:undefined,transform:async(code,id)=>id==='\0lead-test'?(await import('../../frontend/node_modules/vite/dist/node/index.js')).transformWithEsbuild(code,'fixture.tsx',{loader:'tsx',jsx:'transform'}):undefined}],server:{host:'127.0.0.1',port:5187,strictPort:true}});
server.middlewares.use('/__lead-test',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/__x00__lead-test"></script></body></html>');});
assert.equal(fs.existsSync('frontend/__lead-test.html'),false);
fs.writeFileSync('frontend/__lead-test.html','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/__x00__lead-test"></script></body></html>');
await server.listen();const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});globalThis.fixturePage=page;page.setDefaultTimeout(10000);
 page.on('pageerror',e=>result.errors.push(String(e)));
 let customCodes=false,hideSave=false,hidePhone=true,denyConvert=false,version=1,failOnce=false,forcedStatus=0,delayConfig=false;
 const commands=[],queries=[];
 const row={version:'0x0000000000000001',public_id:rowId,hospital_name:'Policy Clinic',status:'NEW',owner_name:'Owner',owner_user_id:7,sido:'Seoul',sigungu:'Gangnam',phone:'010-secret',business_no:'123',updated_at:'2026-10-24T00:00:00Z'};
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),headers={'Content-Type':'application/json','X-Config-Release-Id':releaseId,'X-Config-Permission-Version':String(version)};
  if(url.pathname==='/api/runtime/effective-config'){
   if(delayConfig)await new Promise(resolve=>setTimeout(resolve,700));
   const effective=resolveCompanyConfig(artifact.catalog,{companyId,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[]});
   effective.entries.find(e=>e.id==='lead.phone').settings.visible=!hidePhone;
   if(hideSave)effective.entries.find(e=>e.id==='LEAD.save').settings.visible=false;
   if(denyConvert)effective.entries.find(e=>e.id==='LEAD.convert').settings.enabled=false;
   const allowed=[...new Set(artifact.catalog.entries.flatMap(e=>[...e.permissions,...e.readPermissions,...e.writePermissions]))];
   const policy=resolveActorPolicy(effective,companyId,{authenticated:true,companyId,allowed,denied:[]});
   const locale=url.searchParams.get('locale')==='en-US'?'en-US':'ko-KR';
   const labels=Object.fromEntries(effective.entries.filter(e=>policy.find(p=>p.id===e.id)?.readable).map(e=>[e.id,artifact.translations[locale][e.labelKey]]));
   if(customCodes){labels['code:lead.status:NEW']='Company new';labels['code:lead.statusFilter:NEW']='Company filter new';labels['code:lead.targetStatus:FIRST_VISIT']='Company first visit';}
   return route.fulfill({headers,body:JSON.stringify({releaseId,permissionVersion:version,leadExtensionsEnabled:false,policy,labels,translations:artifact.translations[locale]})});
  }
  if(req.method()==='GET'){queries.push(url.search);const data={...row};if(hidePhone)delete data.phone;return route.fulfill({headers,body:JSON.stringify(url.pathname==='/api/leads'?[data]:data)});}
  commands.push({path:url.pathname,headers:req.headers(),body:req.postDataJSON()});
  if(forcedStatus)return route.fulfill({status:forcedStatus,headers,body:JSON.stringify({code:'PERMISSION_DENIED'})});
  if(failOnce){failOnce=false;return route.fulfill({status:503,headers,body:JSON.stringify({code:'TEMPORARY_FAILURE'})});}
  if(req.headers()['x-config-permission-version']!==String(version))return route.fulfill({status:409,headers,body:JSON.stringify({code:'CONFIG_CHANGED'})});
  if(url.pathname.endsWith('/status'))row.status=req.postDataJSON().toStatus;
  if(req.method()==='PATCH'&&req.postDataJSON().hospitalName)row.hospital_name=req.postDataJSON().hospitalName;
  return route.fulfill({headers,body:JSON.stringify({public_id:rowId,status:row.status})});
 });
 await page.goto('http://127.0.0.1:5187/__lead-test.html');await page.getByText('Policy Clinic',{exact:true}).waitFor();
 await page.getByRole('button',{name:'English',exact:true}).click();
 await page.getByRole('button',{name:'Change status',exact:true}).waitFor();
 assert.equal(await page.getByText('010-secret',{exact:true}).count(),0);result.checks.push('hidden phone absent; English labels');
 await page.getByRole('button',{name:'Change status',exact:true}).click();
 await page.getByRole('dialog').getByRole('combobox').selectOption('FIRST_VISIT');
 failOnce=true;await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Retry',exact:true}).waitFor();
 assert.equal(await page.getByRole('dialog').getByRole('combobox').isDisabled(),true);
 await page.getByRole('dialog').getByRole('button',{name:'Retry',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'detached'});
 assert.equal(commands[0].headers['idempotency-key'],commands[1].headers['idempotency-key']);assert.deepEqual(commands[0].body,commands[1].body);result.checks.push('unknown result retry preserves payload and key');
 await page.getByRole('button',{name:'Assign owner',exact:true}).click();
 await page.getByRole('dialog').getByRole('spinbutton').fill('8');
 await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 assert.equal(commands.at(-1).body.ownerUserId,8);result.checks.push('assignment posts numeric ID and context headers');
 await page.getByRole('button',{name:'Convert lead',exact:true}).click();
 await page.getByRole('dialog').getByRole('textbox').fill('Opportunity');
 await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 assert.equal(commands.at(-1).body.accountMode,'NEW');result.checks.push('conversion sends required name');
 await page.screenshot({path:out+'/lead-ui-desktop.png'});result.screenshots.push('lead-ui-desktop.png');
 denyConvert=true;hidePhone=false;version++;await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await page.getByText('010-secret',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Convert lead',exact:true}).count(),0);result.checks.push('refresh applies current permission version and revoked action');
 await page.getByRole('button',{name:'Details',exact:true}).click();
 await page.getByRole('dialog').getByDisplayValue?.('Policy Clinic');
 await page.getByRole('dialog').locator('input').first().fill('Updated Clinic');
 await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 await page.getByText('Updated Clinic',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Details',exact:true}).click();
 assert.equal(await page.getByRole('dialog').locator('input').first().inputValue(),'Updated Clinic');await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();result.checks.push('detail PATCH saves changed fields and reopens with fresh values');
 hideSave=true;await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByRole('button',{name:'Details',exact:true}).click();await page.getByRole('dialog').getByText('Updated Clinic',{exact:true}).waitFor();assert.equal(await page.getByRole('dialog').locator('input').count(),0);assert.equal(await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).count(),0);await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();hideSave=false;await page.getByRole('button',{name:'Refresh',exact:true}).click();result.checks.push('Hidden Save action removes detail editing controls');
 for(const code of [401,403,409]){
  await page.getByRole('button',{name:'Assign owner',exact:true}).click();await page.getByRole('dialog').getByRole('spinbutton').fill('8');forcedStatus=code;
  await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('dialog').getByRole('alert').waitFor();assert.equal(await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).isDisabled(),true);
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();forcedStatus=0;
 }result.checks.push('401/403/409 require review; resubmission disabled');
 delayConfig=true;row.hospital_name='Session B Clinic';await page.evaluate(()=>localStorage.setItem('dio_crm_access_token','synthetic-session-b'));
 await page.getByText('Loading…',{exact:true}).waitFor();assert.equal(await page.getByText('Updated Clinic',{exact:true}).count(),0);await page.getByText('Session B Clinic',{exact:true}).waitFor();delayConfig=false;result.checks.push('token switch without reload removes old rows before new session response');
 row.status='NEW';customCodes=true;await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByRole('cell',{name:'Company new',exact:true}).waitFor();await page.getByRole('option',{name:'Company filter new',exact:true}).waitFor({state:'attached'});await page.getByRole('button',{name:'Change status',exact:true}).click();await page.getByRole('dialog').getByRole('option',{name:'Company first visit',exact:true}).waitFor({state:'attached'});await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();result.checks.push('Company code labels applied separately to list status, filter and change dialog');

 const actionLabel=id=>artifact.translations['en-US'][artifact.catalog.entries.find(e=>e.id===id).labelKey];
 await page.getByRole('button',{name:actionLabel('LEAD.create'),exact:true}).click();let lifecycleDialog=page.getByRole('dialog');await lifecycleDialog.getByLabel(artifact.translations['en-US'][artifact.catalog.entries.find(e=>e.id==='lead.hospitalName').labelKey],{exact:true}).fill('New managed clinic');failOnce=true;await lifecycleDialog.getByRole('button',{name:'Save',exact:true}).click();await lifecycleDialog.getByRole('button',{name:'Retry',exact:true}).click();await lifecycleDialog.waitFor({state:'detached'});assert.equal(commands.at(-1).path,'/api/leads');assert.deepEqual(commands.at(-1).body,{hospitalName:'New managed clinic'});assert.equal(commands.at(-1).headers['idempotency-key'],commands.at(-2).headers['idempotency-key']);result.checks.push('Create popup uses registered fields and retries identical POST/key');
 await page.getByRole('button',{name:actionLabel('LEAD.delete'),exact:true}).click();lifecycleDialog=page.getByRole('dialog');await lifecycleDialog.getByText('Session B Clinic',{exact:true}).waitFor();await lifecycleDialog.getByRole('button',{name:'Close',exact:true}).click();const beforeDelete=commands.length;await page.getByRole('button',{name:actionLabel('LEAD.delete'),exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});assert.equal(commands.length,beforeDelete+1);assert.equal(commands.at(-1).path,'/api/leads/'+rowId);assert.deepEqual(commands.at(-1).body,{expectedVersion:row.version});result.checks.push('Delete confirmation identifies row; cancel sends nothing and confirmation uses versioned DELETE');

 await page.getByRole('button',{name:'한국어',exact:true}).click();await page.getByRole('button',{name:'상태 변경',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/lead-ui-mobile.png'});result.screenshots.push('lead-ui-mobile.png');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);result.checks.push('Korean mobile no page overflow');
 assert.deepEqual(result.errors,[]);
}catch(e){if(globalThis.fixturePage){await globalThis.fixturePage.screenshot({path:out+'/lead-ui-failure.png'});fs.writeFileSync(out+'/lead-ui-failure.html',await globalThis.fixturePage.content());}result.status='FAIL';result.error=String(e);process.exitCode=1;}
finally{await browser.close();await server.close();fs.unlinkSync('frontend/__lead-test.html');fs.writeFileSync(out+'/lead-ui-browser.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));}
