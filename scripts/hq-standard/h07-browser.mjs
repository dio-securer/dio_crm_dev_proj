import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHqServer } from './server.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const evidence=path.join(root,'docs/hq-standard/implementation/evidence');
const report={stage:'H07',viewports:[{width:1440,height:1000},{width:834,height:1194},{width:390,height:844}],checks:[],screenshots:[],pageErrors:[],externalRequests:[]};
let runtime,browser;
async function check(name,fn){const row={name,status:'NOT_RUN'};report.checks.push(row);try{row.detail=await fn();row.status='PASS';console.log(`PASS ${name}`);}catch(error){row.status='FAIL';row.error=String(error);throw error;}}
try{
  await mkdir(evidence,{recursive:true});runtime=await startHqServer({port:0,storageDir:false,autoAdvance:true});
  const {chromium}=await import('playwright');browser=await chromium.launch({headless:true,...(process.env.HQ_BROWSER_CHANNEL?{channel:process.env.HQ_BROWSER_CHANNEL}:{})});report.browserVersion=browser.version();
  for(const [index,viewport] of report.viewports.entries()){
    const context=await browser.newContext({viewport,locale:'ko-KR',timezoneId:'Asia/Seoul',serviceWorkers:'block'});
    const page=await context.newPage();const label=['PC','tablet','390px'][index];
    page.on('pageerror',error=>report.pageErrors.push(`${label}: ${error.message}`));
    page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:'))report.externalRequests.push(`${label}: ${request.url()}`);});
    for(const [route,title] of [['/','본사 홈'],['/hq-admin/users','사용자·조직'],['/hq-admin/permissions','권한·본사 표준'],['/hq-admin/codes','공통코드'],['/hq-admin/interfaces','연계 모니터'],['/hq-admin/audit','감사 이력'],['/ops','운영 상태']]){
      await check(`${label} ${route} renders and fits`,async()=>{
        await page.goto(runtime.url+route);await page.locator('.hq-mock-controls').waitFor();
        await page.locator('main').getByRole('heading',{name:title,exact:true}).waitFor();
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
        assert.ok(overflow<=1,`${route}: horizontal overflow ${overflow}px`);
        const filename=`h07-${['pc','tablet','mobile'][index]}-${route==='/'?'home':route.split('/').at(-1)}.png`;
        await page.screenshot({path:path.join(evidence,filename),fullPage:true});report.screenshots.push(filename);
        return {route,overflow};
      });
    }
    await check(`${label} user edit appears in audit`,async()=>{
      await page.goto(runtime.url+'/hq-admin/users');await page.locator('main').getByRole('heading',{name:'사용자·조직'}).waitFor();
      await page.getByLabel('사용자 ID').fill('1');await page.getByLabel('이름').fill('H07 검수');await page.getByRole('spinbutton',{name:'조직 ID'}).fill('10');
      await page.getByRole('button',{name:'사용자 저장'}).click();await page.getByRole('status').getByText('저장했습니다.').waitFor();
      await page.goto(runtime.url+'/hq-admin/audit');await page.getByText('ADM.users.save').first().waitFor();return true;
    });
    await check(`${label} organization save and reload`,async()=>{
      await page.goto(runtime.url+'/hq-admin/users');
      await page.getByLabel('조직 ID', {exact:true}).last().fill('20');
      await page.getByLabel('조직명', {exact:true}).fill(`시험 지점 ${label}`);
      await page.getByRole('button',{name:'조직 저장'}).click();
      await page.getByRole('status').getByText('저장했습니다.').waitFor();
      await page.reload();
      await page.getByRole('cell',{name:`시험 지점 ${label}`,exact:true}).waitFor();
    });
    await check(`${label} common code save and reload`,async()=>{
      await page.goto(runtime.url+'/hq-admin/codes');
      await page.getByLabel('그룹', {exact:true}).fill(`TEST_UI_${index}`);
      await page.getByLabel('코드', {exact:true}).fill('A');
      await page.getByLabel('표시명', {exact:true}).fill(`화면 검증 ${label}`);
      await page.getByRole('button',{name:'저장',exact:true}).click();
      await page.getByRole('status').getByText('저장했습니다.').waitFor();
      await page.reload();
      await page.getByRole('cell',{name:`화면 검증 ${label}`,exact:true}).waitFor();
    });
    if(index===2)await check('390px hidden admin URL is denied for sales',async()=>{
      await page.goto(runtime.url+'/');await page.locator('.hq-mock-controls').waitFor();
      await page.locator('.hq-mock-controls select').first().selectOption('hq-sales');
      await page.locator('main').getByRole('heading',{name:'본사 홈'}).waitFor();
      await page.goto(runtime.url+'/hq-admin/users');await page.getByRole('alert').getByText('SCREEN_ACCESS_DENIED').waitFor();
      assert.equal(await page.getByRole('link',{name:'사용자·조직'}).count(),0);return true;
    });
    await context.close();
  }
  await check('No page exception or external request',()=>{assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.externalRequests,[]);return true;});
}catch(error){report.fatal=error instanceof Error?error.stack:String(error);process.exitCode=1;}
finally{report.passed=report.checks.filter(x=>x.status==='PASS').length;report.failed=report.checks.filter(x=>x.status==='FAIL').length;
  let closeTimedOut=false;
  if(browser){let timer;closeTimedOut=await Promise.race([browser.close().then(()=>false,()=>true),new Promise(resolve=>{timer=setTimeout(()=>resolve(true),10000);})]);clearTimeout(timer);}
  if(runtime){runtime.server.closeAllConnections();await runtime.close();}
  if(closeTimedOut)report.cleanupWarning='System Chrome did not close within 10 seconds; assertions completed.';
  await writeFile(path.join(evidence,'h07-browser-report.json'),JSON.stringify(report,null,2));console.log(`H07 browser: ${report.passed}/${report.checks.length} PASS`);
  process.exit(report.failed||report.fatal?1:0);
}
