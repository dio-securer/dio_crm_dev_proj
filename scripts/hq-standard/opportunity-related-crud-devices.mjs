import {chromium} from 'playwright';
import {startHqServer} from './server.mjs';

const server = await startHqServer({port:0,storageDir:false,autoAdvance:false});
const browser = await chromium.launch({headless:true});
try {
 for (const [device,width,height] of [['PC',1440,900],['패드',768,1024],['모바일',390,844]]) {
  const page = await browser.newPage({viewport:{width,height}});
  try {
   await page.goto(server.url+'/opportunities');
   await page.getByRole('button',{name:'기회 등록',exact:true}).click();
   const form=page.locator('form.hq-sales-card');
   await form.getByLabel(/^거래처/).selectOption({index:1});
   await form.getByLabel(/^기회명/).fill(`격리 ${device} 관련 기능 검증`);
   await form.getByLabel(/^예상 마감일/).fill('2026-12-20');
   await form.getByRole('button',{name:'생성',exact:true}).click();
   await page.getByRole('heading',{name:'기회 상세'}).waitFor();
   const roles=page.getByRole('region',{name:'연락처 역할'});
   await roles.getByRole('button',{name:'연락처 역할 등록'}).click();
   let dialog=page.locator('dialog[open]');
   await dialog.getByLabel('기회 연락처').selectOption({index:1});
   await dialog.getByLabel('연락처 역할').selectOption({label:'구매 담당자'});
   await dialog.getByLabel('기본 연락처').check();
   await dialog.getByRole('button',{name:'연락처 역할 저장'}).click();
   await dialog.waitFor({state:'detached'});
   await roles.getByText('구매 담당자 · 기본 연락처').waitFor();
   await roles.getByRole('button',{name:'연락처 역할 수정'}).click();
   dialog=page.locator('dialog[open]');
   await dialog.getByLabel('연락처 역할').selectOption({label:'대표원장'});
   await dialog.getByRole('button',{name:'연락처 역할 저장'}).click();
   await dialog.waitFor({state:'detached'});
   await roles.getByText('대표원장 · 기본 연락처').waitFor();
   page.once('dialog',d=>d.accept());
   await roles.getByRole('button',{name:'연락처 역할 삭제'}).click();
   await roles.getByText('등록된 연락처 역할이 없습니다.').waitFor();
   console.log(`${device} PASS 연락처 역할 CRUD`);

   const products=page.getByRole('region',{name:'Contract Product'});
   await products.getByRole('button',{name:'Contract Product 등록'}).click();
   dialog=page.locator('dialog[open]');
   await dialog.getByLabel('Contract Product 수량').fill('2');
   await dialog.getByLabel('Contract Product 단가').fill('12500');
   await dialog.getByLabel('Contract Product 설명').fill('격리 계약 제품');
   await dialog.getByRole('button',{name:'Contract Product 저장'}).click();
   await dialog.waitFor({state:'detached'});
   await products.getByText('격리 계약 제품',{exact:true}).waitFor();
   await products.getByRole('button',{name:'Contract Product 수정'}).click();
   dialog=page.locator('dialog[open]');
   await dialog.getByLabel('Contract Product 수량').fill('3');
   await dialog.getByLabel('Contract Product 설명').fill('수정 계약 제품');
   await dialog.getByRole('button',{name:'Contract Product 저장'}).click();
   await dialog.waitFor({state:'detached'});
   await products.getByText('수정 계약 제품',{exact:true}).waitFor();
   page.once('dialog',d=>d.accept());
   await products.getByRole('button',{name:'Contract Product 삭제'}).click();
   await products.getByText('등록된 Contract Product가 없습니다.').waitFor();
   console.log(`${device} PASS 계약 제품 CRUD`);

   const activities=page.getByRole('region',{name:'기회 활동'});
   for(const kind of ['과업','통화','이벤트']) {
    await activities.getByRole('button',{name:`새 ${kind}`,exact:true}).click();
    dialog=page.locator('dialog[open]');
    await dialog.getByLabel('활동 제목').fill(`격리 ${kind}`);
    await dialog.getByLabel('활동 기한').fill('2026-12-20');
    await dialog.getByLabel('활동 우선순위').selectOption('HIGH');
    await dialog.getByLabel('활동 내용').fill('테스트 활동');
    if(kind==='이벤트'){
     await dialog.getByLabel('이벤트 시작').fill('2026-12-20T10:00');
     await dialog.getByLabel('이벤트 종료').fill('2026-12-20T11:00');
     await dialog.getByLabel('이벤트 장소').fill('테스트 장소');
    }
    await dialog.getByRole('button',{name:'활동 저장'}).click();
    await dialog.waitFor({state:'detached'});
    let card=activities.locator('article').filter({hasText:`격리 ${kind}`});
    await card.waitFor();
    await card.getByRole('button',{name:`${kind} 수정`}).click();
    dialog=page.locator('dialog[open]');
    await dialog.getByLabel('활동 제목').fill(`수정 ${kind}`);
    await dialog.getByRole('button',{name:'활동 저장'}).click();
    await dialog.waitFor({state:'detached'});
    card=activities.locator('article').filter({hasText:`수정 ${kind}`});
    await card.waitFor();
    page.once('dialog',d=>d.accept());
    await card.getByRole('button',{name:`${kind} 삭제`}).click();
    await card.waitFor({state:'detached'});
    console.log(`${device} PASS ${kind} CRUD`);
   }
  } finally {await page.close()}
 }
} finally {await browser.close();server.server.closeAllConnections();await server.close()}
