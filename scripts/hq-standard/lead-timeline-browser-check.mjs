import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startHqServer } from './server.mjs';
const s=await startHqServer({port:0,storageDir:false,autoAdvance:false});const browser=await chromium.launch({headless:true});
try {
 for(const width of [1440,1024,768,390]){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.goto(s.url+'/leads');
  await page.getByRole('button',{name:'신규병원 등록'}).click();
  const create=page.locator('dialog[open]');await create.locator('[data-field-key="hospitalName"]').fill('CODEX 활동 '+width);
  await create.getByRole('button',{name:'생성',exact:true}).click();await page.locator('.hq-lead-detail').waitFor();
  for(const label of ['과업','통화 기록','이벤트']){
   await page.getByRole('button',{name:'새 '+label,exact:true}).click();
   let modal=page.locator('dialog[open]');await modal.getByLabel('제목').fill(label+' 시험');await modal.getByLabel('내용').fill('처음');
   await modal.getByRole('button',{name:'저장',exact:true}).click();await modal.waitFor({state:'detached'});
   const item=page.locator('details').filter({hasText:label+' · '+label+' 시험'});await item.locator('summary').click();
   await item.getByRole('button',{name:'수정',exact:true}).click();modal=page.locator('dialog[open]');
   await modal.getByLabel('제목').fill(label+' 수정');await modal.getByRole('button',{name:'저장',exact:true}).click();await modal.waitFor({state:'detached'});
   const updated=page.locator('details').filter({hasText:label+' · '+label+' 수정'});if(!await updated.evaluate(e=>e.open))await updated.locator('summary').click();
   page.once('dialog',d=>d.accept());await updated.getByRole('button',{name:'삭제',exact:true}).click();
   await updated.waitFor({state:'detached'});
  }
  assert.equal(await page.locator('.lead-timeline details').count(),0);console.log(width+' PASS');await page.close();
 }
}finally{await browser.close();s.server.closeAllConnections();await s.close();}
