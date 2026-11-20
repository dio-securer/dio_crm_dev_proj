import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {createServer,transformWithEsbuild} from '../../frontend/node_modules/vite/dist/node/index.js';
import '../hq-standard/register.mjs';

const {resolveCompanyConfig,resolveActorPolicy}=await import('../../packages/contracts/src/crm-customization.ts');
const artifact=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-codes-review.json','utf8'));
const company='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',release='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',createdId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const standard=resolveCompanyConfig(artifact.catalog,{companyId:company,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[]});
assert.equal(standard.ok,true,JSON.stringify(standard.issues));
const grants=[...new Set(artifact.catalog.entries.flatMap(e=>[...e.permissions,...e.readPermissions,...e.writePermissions]))];
const policy=resolveActorPolicy(standard,company,{authenticated:true,companyId:company,allowed:grants,denied:[]});
const labels=Object.fromEntries(standard.entries.map(e=>[e.id,artifact.translations['ko-KR'][e.labelKey]??e.id]));
const cfg={releaseId:release,permissionVersion:1,leadExtensionsEnabled:false,policy,labels,translations:artifact.translations['ko-KR']};
const port=Number(process.env.LEAD_KEYMAN_CREATE_TEST_PORT??5202),name='lead-keyman-create-fixture-'+port,html=`frontend/__lead-keyman-create-fixture-${port}.html`;
assert.equal(fs.existsSync(html),false);
const entry="import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import '/src/i18n';import {ConfiguredLeads} from '/src/customization/ConfiguredLeads';createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ConfiguredLeads/></QueryClientProvider>);";
const server=await createServer({root:'frontend',resolve:{alias:[{find:'@dio-crm/contracts/crm-customization',replacement:process.cwd()+'/packages/contracts/src/crm-customization.ts'},{find:'@dio-crm/contracts/lead-grid-columns',replacement:process.cwd()+'/packages/contracts/src/lead-grid-columns.ts'},{find:'@dio-crm/contracts',replacement:process.cwd()+'/packages/contracts/src/index.ts'}]},configFile:false,logLevel:'error',plugins:[{name,resolveId:x=>x===name?'\0'+name:undefined,load:x=>x==='\0'+name?entry:undefined,transform:(code,x)=>x==='\0'+name?transformWithEsbuild(code,name+'.tsx',{loader:'tsx',jsx:'transform'}):undefined}],server:{host:'127.0.0.1',port,strictPort:true}});
fs.writeFileSync(html,`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/__x00__${name}"></script></body></html>`);
const report={scope:'Managed lead create React with synthetic HTTP; no real authentication or DB',checks:[],errors:[]};let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:900}});page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(String(e)));
  const rows=[],requests=[],headers={'Content-Type':'application/json','X-Config-Release-Id':release,'X-Config-Permission-Version':'1'};
  await page.route('**/api/**',route=>{const req=route.request(),url=new URL(req.url());if(url.pathname==='/api/runtime/effective-config')return route.fulfill({headers,body:JSON.stringify(cfg)});if(url.pathname==='/api/leads'&&req.method()==='GET')return route.fulfill({headers,body:JSON.stringify(rows)});if(url.pathname==='/api/leads'&&req.method()==='POST'){const body=req.postDataJSON();requests.push(body);const row={public_id:createdId,hospital_name:body.hospitalName,phone:body.phone??null,address:body.address??null,business_no:body.businessNo??null,keyman_name:body.keymanName??null,keyman_type:body.keymanType??null,keyman_mobile:body.keymanMobile??null,keyman_email:body.keymanEmail??null,school:body.school??null,cohort:body.cohort??null,major:body.major??null};rows.push(row);return route.fulfill({headers,body:JSON.stringify(row)});}if(url.pathname==='/api/leads/'+createdId&&req.method()==='GET')return route.fulfill({headers,body:JSON.stringify(rows[0])});return route.fulfill({status:404,headers,body:'{}'});});
  await page.goto(`http://127.0.0.1:${port}/__lead-keyman-create-fixture-${port}.html`);
  await page.getByRole('button',{name:labels['LEAD.create']}).click();const dialog=page.getByRole('dialog');
  const values=[['hospitalName','Created clinic'],['keymanSurname','Kim'],['keymanType','Dentist'],['keymanMobile','0102'],['keymanEmail','kim@example.com'],['keymanSchool','School'],['keymanClassYear','2022'],['keymanMajor','Pediatrics']];
  for(const [fieldId,value] of values)await dialog.getByRole('textbox',{name:labels['lead.'+fieldId]}).fill(value);
  await dialog.getByRole('button',{name:'저장',exact:true}).click();await dialog.waitFor({state:'detached'});
  assert.deepEqual(requests,[{hospitalName:'Created clinic',keymanName:'Kim',keymanType:'Dentist',keymanMobile:'0102',keymanEmail:'kim@example.com',school:'School',cohort:'2022',major:'Pediatrics'}]);
  await page.getByRole('row').filter({hasText:'Created clinic'}).getByRole('button',{name:'상세',exact:true}).click();const detail=page.getByRole('dialog');await detail.getByRole('tab',{name:labels['tab:HQ_LEAD.keyman']}).click();
  for(const [fieldId,value] of values.slice(1))assert.equal(await detail.getByRole('textbox',{name:labels['lead.'+fieldId]}).inputValue(),value,fieldId);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);report.checks.push(`${width}: seven keyman fields created and re-read; unchanged basic field preserved`);await page.close();
 }
 assert.deepEqual(report.errors,[]);
}catch(e){report.errors.push(String(e));process.exitCode=1;}finally{if(browser)await browser.close();await server.close();fs.unlinkSync(html);fs.mkdirSync('.local-manual-review',{recursive:true});fs.writeFileSync('.local-manual-review/lead-keyman-create-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
