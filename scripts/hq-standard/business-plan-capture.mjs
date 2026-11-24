import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const dir = 'docs/business-plan-2027/screenshots';
const base = 'http://127.0.0.1:3210';
const leadId = '10000000-0000-4000-8000-00000000000a';
const accountId = '10000000-0000-4000-8000-000000000001';
const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const manifest = {capturedAt: new Date().toISOString(), source: base, note:'격리 브라우저에서 서버 MOCK 데이터 조회. 세션 발급 POST만 허용하고 기타 변경 요청은 차단. 브라우저 뷰포트 시뮬레이션이며 실기기 촬영이 아님. 5173 포트는 응답이 조기 종료되어 3210 사용.', captures:[]};
await mkdir(dir,{recursive:true});
try {
  for (const [device,width,height] of [['mobile',390,844],['tablet',768,1024],['pc',1440,900]]) {
    const context = await browser.newContext({viewport:{width,height}});
    await context.route('**/*', route => ['GET','HEAD','OPTIONS'].includes(route.request().method()) || (route.request().method() === 'POST' && new URL(route.request().url()).pathname === '/api/hq/session') ? route.continue() : route.abort());
    const page = await context.newPage();
    for (const type of ['lead','account']) {
      const url = `${base}/${type === 'lead' ? 'leads' : 'accounts'}?hq=1`;
      await page.goto(url,{waitUntil:'domcontentloaded'});
      const list = type === 'lead' ? '.hq-lead-list' : 'table, .mob-account-row';
      await page.locator(list).first().waitFor({state:'attached',timeout:20000});
      const name = `${type}-${device}-list.png`;
      await page.screenshot({path:`${dir}/${name}`});
      manifest.captures.push({file:name,device,width,height,screen:type+' 목록',url:page.url()});
      const id = type === 'lead' ? leadId : accountId;
      if (type === 'lead') await page.locator(`[data-lead-id="${id}"]:visible`).first().click();
      else await page.goto(`${base}/accounts?record=${id}&hq=1`,{waitUntil:'domcontentloaded'});
      await page.locator(type === 'lead' ? '.hq-lead-detail' : '.hq-account-workspace').waitFor({timeout:20000});
      if (type === 'account') await page.locator('.hq-account-workspace').getByText('불러오는 중...', {exact:true}).waitFor({state:'hidden',timeout:20000});
      const detail = `${type}-${device}-detail.png`;
      await page.screenshot({path:`${dir}/${detail}`});
      manifest.captures.push({file:detail,device,width,height,screen:type+' 상세',url:page.url(),note:type === 'account' ? '기본 제공 본사 데모 레코드. PC는 상세 정보가 거래처 편집 모달 안에 표시됨.' : '기본 제공 본사 데모 레코드'});
      console.log(device,type,'complete');
    }
    await context.close();
  }
} finally {
  await writeFile(`${dir}/manifest.json`,JSON.stringify(manifest,null,2),'utf8');
  await browser.close();
}
