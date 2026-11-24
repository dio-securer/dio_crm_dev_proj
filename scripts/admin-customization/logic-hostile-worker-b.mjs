import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import '../hq-standard/register.mjs';
import { startHqServer } from '../hq-standard/server.mjs';

const A='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', B='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ids={[A]:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',[B]:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'};
const artifact=JSON.parse(await fs.readFile('packages/contracts/catalogs/hq-customization-baseline.json','utf8'));
const html=await fs.readFile('frontend/dist/index.html','utf8');
const config=companyId=>({companyId,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{}});
let runtime,browser;
try {
 runtime=await startHqServer({port:0,storageDir:false});
 const {chromium}=await import('playwright');
 browser=await chromium.launch({headless:true,...(process.env.HQ_BROWSER_CHANNEL?{channel:process.env.HQ_BROWSER_CHANNEL}:{})});
 for(const width of [1440,390]){
  const state=new Map([[A,{revision:0,items:[]}],[B,{revision:0,items:[]}]]), calls=[];let firstSave=true,allowProvider=false;
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(()=>{try{localStorage.setItem('dio_crm_access_token','SYNTHETIC_ADMIN')}catch{}});
  const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/admin/customization',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
  await page.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url());const answer=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
   if(url.pathname==='/api/admin/companies')return answer({items:[{id:A,name:'Fixture A'},{id:B,name:'Fixture B'}],nextCursor:null});
   if(url.pathname==='/api/admin/hq/fields')return answer({code:'UNAVAILABLE'},503);
   if(url.pathname==='/api/admin/config/drafts'&&req.method()==='GET'){const companyId=url.searchParams.get('scopeKey');return answer({activeReleaseId:null,capabilities:{edit:true,preview:true,publish:true},drafts:[{id:ids[companyId],revision:1,state:'DRAFT',config:config(companyId)}],releases:[]});}
   if(url.pathname==='/api/admin/catalogs')return answer(artifact);
   if(url.pathname==='/api/admin/logic-drafts'){
    if(!allowProvider)return answer({code:'UNAVAILABLE'},503);
    if(req.method()==='GET'){
     const companyId=url.searchParams.get('companyId'),draftId=url.searchParams.get('draftId'),entry=state.get(companyId);
     return answer({companyId,draftId,configRevision:1,revision:entry.revision,items:entry.items,runtimeStatus:'not-implemented',releaseBinding:'not-connected',capabilities:{edit:companyId===A}});
    }
    if(req.method()==='PUT'){
     const body=req.postDataJSON(),key=req.headers()['idempotency-key'];calls.push({body,key});
     if(firstSave){firstSave=false;return answer({code:'SYNTHETIC_UNKNOWN'},503);}
     const entry=state.get(body.companyId);entry.revision++;entry.items=body.items.map(item=>({...item,sourceHash:'synthetic-hash'}));
     return answer({companyId:body.companyId,draftId:body.draftId,configRevision:1,revision:entry.revision,items:entry.items,runtimeStatus:'not-implemented',releaseBinding:'not-connected',capabilities:{edit:true}});
    }
   }
   return answer({code:'UNEXPECTED_TEST_REQUEST'},404);
  });
  console.log(`${width}: opening`);await page.goto(runtime.url+'/admin/customization',{waitUntil:'domcontentloaded'});
  await page.getByLabel('법인',{exact:true}).selectOption({label:'Fixture A'});
  const details=page.locator('.logic-draft-editor');await details.locator('summary').click();
  await details.getByRole('button',{name:'로직 작업본 열기'}).click();
  await details.getByText('이 환경에서는 로직 작업본 저장을 지원하지 않습니다.').waitFor();
  assert.equal(await details.locator('textarea').count(),0,'provider-off must not enable editor');
  allowProvider=true;await details.getByRole('button',{name:'로직 작업본 열기'}).click();
  const source=details.getByLabel('스크립트 코드');await source.waitFor();
  await source.fill('</textarea><img src=x onerror=window.__LOGIC_SHOULD_NOT_EXECUTE=1><script>window.__LOGIC_SHOULD_NOT_EXECUTE=2</script>');
  const select=details.getByLabel('이벤트');await select.selectOption('lead.detail.before-save.v1');
  await source.fill('return { errors: [] };');await select.selectOption('lead.create.field-change.v1');
  assert.equal(await source.inputValue(),'</textarea><img src=x onerror=window.__LOGIC_SHOULD_NOT_EXECUTE=1><script>window.__LOGIC_SHOULD_NOT_EXECUTE=2</script>');
  assert.equal(await page.evaluate(()=>window.__LOGIC_SHOULD_NOT_EXECUTE),undefined,'source must not run');
  page.once('dialog',dialog=>dialog.dismiss());await page.getByLabel('법인',{exact:true}).selectOption({label:'Fixture B'});
  assert.equal(await source.inputValue(),'</textarea><img src=x onerror=window.__LOGIC_SHOULD_NOT_EXECUTE=1><script>window.__LOGIC_SHOULD_NOT_EXECUTE=2</script>','company switch cancellation preserves source');
  await details.getByRole('button',{name:'로직 작업본 저장'}).click();
  await details.getByRole('button',{name:'같은 요청 다시 시도'}).waitFor();
  assert.equal(await source.isDisabled(),true,'uncertain request locks source');
  await page.waitForFunction(()=>document.querySelector('select[aria-label="법인"]')?.disabled===true);
  const beforeUrl=page.url();await page.evaluate(()=>{const link=document.createElement('a');link.href='/blocked-navigation';link.id='synthetic-navigation';link.textContent='navigation';document.body.append(link);});
  await page.locator('#synthetic-navigation').click();assert.equal(page.url(),beforeUrl,'uncertain result must prevent internal navigation');
  await details.getByRole('button',{name:'같은 요청 다시 시도'}).click();
  await details.getByText(/로직 작업본만 저장했습니다/).waitFor();
  assert.equal(calls.length,2);assert.equal(calls[0].key,calls[1].key);assert.deepEqual(calls[0].body,calls[1].body);assert.equal(calls[1].body.items.length,2);
  assert.equal(await page.getByText('로직 작업본은 현재 설정 게시에 포함되지 않으며 실행되지 않습니다.').count(),1);
  await details.getByRole('button',{name:'서버 작업본 다시 조회'}).click();
  await page.waitForFunction(()=>{const el=document.querySelector('.logic-draft-editor textarea');return el&&!el.disabled;});
  assert.equal(await source.inputValue(),'</textarea><img src=x onerror=window.__LOGIC_SHOULD_NOT_EXECUTE=1><script>window.__LOGIC_SHOULD_NOT_EXECUTE=2</script>','saved code reloaded');
  await page.getByLabel('법인',{exact:true}).selectOption({label:'Fixture B'});
  const detailsB=page.locator('.logic-draft-editor');await detailsB.getByRole('button',{name:'로직 작업본 열기',includeHidden:true}).waitFor({state:'attached'});if(!await detailsB.evaluate(node=>node.open))await detailsB.locator('summary').click();await detailsB.getByRole('button',{name:'로직 작업본 열기'}).click();
  const sourceB=detailsB.getByLabel('스크립트 코드');await sourceB.waitFor();assert.equal(await sourceB.inputValue(),'');assert.equal(await sourceB.isDisabled(),true,'read-only permission must lock code');
  assert.deepEqual(errors,[]);console.log(`${width}: provider/permission, event buffer, nonexecution, unsaved, retry and company isolation PASS`);
  await page.close({runBeforeUnload:false});await context.close();console.log(`${width}: closed`);
 }
} catch(error){console.error(error);process.exitCode=1;} finally {await browser?.close();console.log('browser closed');runtime?.server.closeAllConnections();await runtime?.close();console.log('server closed');}
