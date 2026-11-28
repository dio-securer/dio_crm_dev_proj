import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {createServer,transformWithEsbuild} from '../../frontend/node_modules/vite/dist/node/index.js';
import '../hq-standard/register.mjs';

const {resolveCompanyConfig,resolveActorPolicy}=await import('../../packages/contracts/src/crm-customization.ts');
const artifact=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-codes-review.json','utf8'));
const company='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',release='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',leadId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const standard=resolveCompanyConfig(artifact.catalog,{companyId:company,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[]});
assert.equal(standard.ok,true,JSON.stringify(standard.issues));
const grants=[...new Set(artifact.catalog.entries.flatMap(e=>[...e.permissions,...e.readPermissions,...e.writePermissions]))];
const policy=resolveActorPolicy(standard,company,{authenticated:true,companyId:company,allowed:grants,denied:[]});
const labels=Object.fromEntries(standard.entries.map(e=>[e.id,artifact.translations['ko-KR'][e.labelKey]??e.id]));
const cfg={releaseId:release,permissionVersion:1,leadExtensionsEnabled:false,policy,labels,translations:artifact.translations['ko-KR']};
const port=Number(process.env.LEAD_COMMAND_TEST_PORT??5208),name='lead-command-fixture-'+port,html=`frontend/__lead-command-fixture-${port}.html`;
assert.equal(fs.existsSync(html),false);
const entry="import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import '/src/i18n';import {ConfiguredLeads} from '/src/customization/ConfiguredLeads';createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ConfiguredLeads/></QueryClientProvider>);";
const server=await createServer({root:'frontend',resolve:{alias:[{find:'@dio-crm/contracts/crm-customization',replacement:process.cwd()+'/packages/contracts/src/crm-customization.ts'},{find:'@dio-crm/contracts/lead-grid-columns',replacement:process.cwd()+'/packages/contracts/src/lead-grid-columns.ts'},{find:'@dio-crm/contracts',replacement:process.cwd()+'/packages/contracts/src/index.ts'}]},configFile:false,logLevel:'error',plugins:[{name,resolveId:x=>x===name?'\0'+name:undefined,load:x=>x==='\0'+name?entry:undefined,transform:(code,x)=>x==='\0'+name?transformWithEsbuild(code,name+'.tsx',{loader:'tsx',jsx:'transform'}):undefined}],server:{host:'127.0.0.1',port,strictPort:true}});
fs.writeFileSync(html,`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/__x00__${name}"></script></body></html>`);
const report={scope:'Synthetic managed lead command UI; no DB or external integration',checks:[],errors:[]};let browser;
try{
 await server.listen();browser=await chromium.launch({channel:process.env.HQ_BROWSER_CHANNEL??'msedge',headless:true});
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:900}});page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(String(e)));
  let row={public_id:leadId,hospital_name:'Clinic',status:'KEYMAN_MEETING',owner_user_id:7,owner_name:'Owner 7',phone:'010-1000-1000',business_no:'123-45-67890',version:'0x0000000000000001'};
  const calls=[],headers={'Content-Type':'application/json','X-Config-Release-Id':release,'X-Config-Permission-Version':'1'};let failOnce=true;
  await page.route('**/api/**',route=>{const request=route.request(),url=new URL(request.url());if(url.pathname==='/api/runtime/effective-config')return route.fulfill({headers,body:JSON.stringify(cfg)});if(url.pathname==='/api/leads'&&request.method()==='GET')return route.fulfill({headers,body:JSON.stringify([row])});if(url.pathname==='/api/leads/'+leadId&&request.method()==='GET')return route.fulfill({headers,body:JSON.stringify(row)});if(url.pathname.startsWith('/api/leads/'+leadId)&&request.method()==='POST'){const body=request.postDataJSON(),action=url.pathname.split('/').at(-1),key=request.headers()['idempotency-key'];calls.push({action,body,key});if(action==='assign-owner'&&failOnce){failOnce=false;return route.fulfill({status:503,headers,body:JSON.stringify({code:'TEMPORARY'})});}assert.equal(body.expectedVersion,row.version);if(action==='assign-owner')row={...row,owner_user_id:body.ownerUserId,owner_name:'Owner '+body.ownerUserId};if(action==='status')row={...row,status:body.toStatus};if(action==='convert')row={...row,status:'CONVERTED'};row.version='0x0000000000000002';return route.fulfill({headers,body:JSON.stringify({status:row.status})});}return route.fulfill({status:404,headers,body:'{}'});});
  await page.goto(`http://127.0.0.1:${port}/__lead-command-fixture-${port}.html`);
  const action=id=>page.locator(`button[data-config-id="${id}"]`).first();
  await page.getByRole('row').filter({hasText:'Clinic'}).locator('button').first().click();const details=page.getByRole('dialog');await details.locator('button[data-config-instance="detail.action.assign"]').waitFor();await details.locator('button[data-config-instance="detail.action.convert"]').waitFor();await details.locator('button[type=button]').last().click();
  await action('LEAD.changeStage').click();assert.equal(await page.getByRole('dialog').count(),1);assert.deepEqual(await page.getByRole('dialog').locator('select option').evaluateAll(items=>items.map(item=>item.value)),['CONTACT_EXCLUDED']);await page.getByRole('dialog').locator('button[type=button]').last().click();assert.equal(calls.length,0);
  await action('LEAD.assignOwner').click();const assign=page.getByRole('dialog');await assign.locator('input[type=number]').fill('8');await assign.locator('button[type=submit]').click();assert.equal(await assign.count(),1);assert.equal(await assign.locator('input[type=number]').inputValue(),'8');await assign.locator('button[type=submit]').click();await assign.waitFor({state:'detached'});assert.equal(calls[0].key,calls[1].key);assert.deepEqual(calls[0].body,calls[1].body);assert.equal(row.owner_user_id,8);
  await action('LEAD.convert').click();const convert=page.getByRole('dialog');await convert.locator('input[type=text]').last().fill('Opportunity');await convert.locator('button[type=submit]').click();await convert.waitFor({state:'detached'});assert.equal(row.status,'CONVERTED');assert.equal(calls.at(-1).body.expectedVersion,'0x0000000000000002');assert.equal(await action('LEAD.convert').count(),0);
  report.checks.push(`${width}: detail top actions; cancel no request; failed owner save retains input and retry key; refresh uses new version; conversion hides after save`);await page.close();
 }
 assert.deepEqual(report.errors,[]);
}catch(e){report.errors.push(String(e));process.exitCode=1;}finally{if(browser)await browser.close();await server.close();fs.unlinkSync(html);fs.mkdirSync('.local-manual-review',{recursive:true});fs.writeFileSync('.local-manual-review/lead-command-dialog-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
