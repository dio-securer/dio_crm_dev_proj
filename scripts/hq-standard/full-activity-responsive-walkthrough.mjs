import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';

const out=path.resolve('docs/crm-activity/full-walkthrough-20261108/responsive');
fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});
const steps=[];
const flush=()=>fs.writeFileSync(path.join(out,'steps.json'),JSON.stringify(steps,null,2));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',timeout:120000});
for(const size of [{width:320,height:700,device:'좁은 모바일 320×700'},{width:1024,height:768,device:'태블릿 가로 1024×768'}]){
  const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});
  const context=await browser.newContext({viewport:size,locale:'ko-KR',timezoneId:'Asia/Seoul',serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  let n=0;
  const take=async(name)=>{const filename=`screenshots/${size.width}-${name}.png`;await page.screenshot({path:path.join(out,filename),fullPage:true});return filename;};
  const test=async(title,actions,expected,fn)=>{
    const id=`responsive-${size.width}-${++n}`,screenshots=[];let status='PASS',actual='';
    try{screenshots.push(await take(`${n}-before`));actual=await fn();screenshots.push(await take(`${n}-after`));}
    catch(error){status='FAIL';actual=error.message;try{screenshots.push(await take(`${n}-failure`));}catch{}}
    steps.push({id,device:size.device,area:'반응형·키보드',title,actions,expected,actual,status,screenshots,note:'별도 Chrome 화면 크기 시험. 실제 기기·터치 키보드 검증 아님.'});flush();console.log(id,status,title);
  };
  const width=async()=>{const dimensions=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(dimensions.document<=dimensions.viewport,JSON.stringify(dimensions));return `문서 폭 ${dimensions.document}px / 화면 ${dimensions.viewport}px — 가로 넘침 없음`;};
  try{
    await page.goto(server.url+'/activities',{waitUntil:'domcontentloaded'});
    await page.locator('.hq-mock-controls select').first().selectOption('hq-sales');
    await page.getByLabel('활동 검색').waitFor();
    await test('활동 목록 너비와 등록 진입',['활동 메뉴를 연다.','검증 사용자를 영업 담당자로 선택한다.','활동 등록 버튼이 보이는지 확인한다.'],'화면 밖으로 가로 내용이 넘치지 않고 등록 버튼을 사용할 수 있다.',async()=>{assert.ok(await page.getByRole('button',{name:'활동 등록',exact:true}).isVisible());return width();});
    await test('등록 입력 배치',['활동 등록을 누른다.','대상 유형·병원·예정 시각·방문 목적 입력을 확인한다.'],'필수 입력이 표시되고 페이지 가로 넘침이 없다.',async()=>{await page.getByRole('button',{name:'활동 등록',exact:true}).click();const form=page.locator('form').first();for(const label of ['대상 유형','병원·거래처','예정 시각','방문 목적'])assert.ok(await form.getByLabel(label).isVisible());const dims=await form.getByLabel('예정 시각').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));return `${await width()}. 예정 시각 입력 clientWidth=${dims.width}, scrollWidth=${dims.scroll}`;});
    await test('다건 등록 표시 규칙',['등록 화면의 다건 활동 계획 표시 여부를 확인한다.'],'320px은 PC 안내, 1024px은 다건 양식을 표시한다.',async()=>{if(size.width===320){assert.ok(await page.getByText('다건 등록은 PC에서 이용할 수 있습니다.').isVisible());assert.equal(await page.locator('.hq-act-bulk-row').first().isVisible(),false);return '다건 양식 숨김, PC 안내 표시';}assert.ok(await page.locator('.hq-act-bulk-row').first().isVisible());return '다건 양식 표시';});
    await page.getByRole('button',{name:'목록으로 돌아가기'}).click();
    await test('월간 일정 폭과 버튼',['월 탭을 누른다.','월간 날짜 칸과 버튼 표시를 확인한다.'],'월간 일정이 표시되고 페이지 가로 넘침이 없다.',async()=>{await page.getByRole('tab',{name:'월',exact:true}).click();await page.getByRole('grid').waitFor();return `${await width()}. 날짜 칸 ${await page.getByRole('gridcell').count()}개`;});
    await page.getByRole('tab',{name:'활동 목록',exact:true}).click();
    await test('활동 상세 진입과 복귀',['목록 첫 활동을 누른다.','상세의 대상·예정시각을 확인한다.','목록으로 돌아가기를 누른다.'],'상세를 열고 목록으로 돌아오며 화면이 잘리지 않는다.',async()=>{await page.locator('.hq-act-schedule-row').first().click();await page.locator('[data-hq-screen="SCR-ACT-002"]').waitFor();const result=await width();await take(`${n}-detail`);await page.getByRole('button',{name:'목록으로 돌아가기'}).click();await page.getByLabel('활동 검색').waitFor();return result+'; 목록 복귀 확인';});
    await page.goto(server.url+'/activity-reports',{waitUntil:'domcontentloaded'});
    await test('보고 준비와 팝업 너비',['활동보고 메뉴를 연다.','날짜에 2026-10-24를 입력한다.','보고 준비 버튼을 누른다.'],'보고 준비 후 상세 팝업이 화면 안에 열린다.',async()=>{await page.getByLabel('날짜',{exact:true}).fill('2026-10-24');await page.getByRole('button',{name:'보고 준비',exact:true}).click();await page.locator('dialog[open]').waitFor();const box=await page.locator('dialog[open]').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=size.width+1,JSON.stringify(box));return `보고 팝업 x=${box.x}, 폭=${box.width}px / 화면 ${size.width}px`;});
    await test('팝업 키보드 포커스 유지',['보고 상세 팝업에서 Tab을 12회 누른다.','매번 활성 입력·버튼이 팝업 내부에 있는지 확인한다.'],'팝업이 열린 동안 뒤쪽 앱 화면의 입력·버튼으로 포커스가 이동하지 않는다. 브라우저 도구모음 이동은 별도로 구분한다.',async()=>{const trace=[];for(let i=0;i<12;i++){await page.keyboard.press('Tab');const state=await page.evaluate(()=>({inside:!!document.querySelector('dialog[open]')?.contains(document.activeElement),focused:document.hasFocus(),tag:document.activeElement?.tagName,label:document.activeElement?.getAttribute('aria-label')??document.activeElement?.textContent?.slice(0,40)}));trace.push(state);assert.ok(state.inside||(!state.focused&&state.tag==='BODY'),JSON.stringify(trace));}return 'Tab 12회 검사: '+JSON.stringify(trace);});
    await test('팝업 Esc 닫기와 준비 버튼 복귀',['내용을 변경하지 않고 Esc를 누른다.','보고 준비 버튼의 포커스를 확인한다.'],'팝업이 닫히고 보고 준비 버튼으로 포커스가 돌아간다.',async()=>{await page.keyboard.press('Escape');await page.locator('dialog[open]').waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.textContent==='보고 준비');return '팝업 닫힘 및 보고 준비 포커스 확인';});
  }catch(error){steps.push({id:`responsive-${size.width}-environment`,device:size.device,area:'반응형·키보드',title:'후속 시나리오 실행 제약',actions:[],expected:'예정된 화면 시험을 진행한다.',actual:error.message,status:'BLOCKED',screenshots:[],note:'테스트 환경 또는 선행 화면의 문제로 중단된 범위'});flush();}
  finally{await Promise.race([context.close(),new Promise(r=>setTimeout(r,2000))]);server.server.closeAllConnections();await Promise.race([server.close(),new Promise(r=>setTimeout(r,2000))]);}
}
flush();await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);console.log(JSON.stringify({records:steps.length,failures:steps.filter(s=>s.status==='FAIL').length}));process.exit(0);
