import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),dir=path.join(root,'docs/admin-platform/customization');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,'evidence',n),'utf8'));
const work=read('work-instructions.json'),design=read('design-manifest.json');
const all=p=>new Set(work.packages.flatMap(x=>x[p]));
for(const d of design.sections)assert.ok(all('design').has(d.id)||work.commonDesign.includes(d.id),d.id);
for(const t of design.tests)assert.ok(all('tests').has(t),t);
for(const g of design.trace)assert.ok(all('gaps').has(g.findingId),g.findingId);
const seen=new Set();for(const p of work.packages){for(const dep of p.depends)assert.ok(seen.has(dep));seen.add(p.id);for(const key of ['steps','accept','files','questions'])assert.ok(p[key].length);assert.ok(p.rollback&&p.gate);}
const result={stage:'C02/C03',status:'PASS',scope:'Document references, coverage and rendering; not implementation acceptance',atUtc:new Date().toISOString(),documents:[],pageErrors:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();page.on('pageerror',err=>result.pageErrors.push(String(err)));
 for(const name of ['03_Work_Instructions.html','04_Document_Consistency_Review.html','05_Implementation_Progress.html','06_I02_Extension_Report.html','07_I02_Legacy_Standard_Report.html','08_I02_Lead_List_Report.html','09_I02_Lead_Filter_Completion.html','10_I02_Lead_Commands_Report.html','11_Autonomous_Execution.html','12_Operational_Readiness.html','13_HQ_Migration_Acceptance.html','14_GitHub_Work_Queue.html']){
  const target=path.join(dir,name);if(!fs.existsSync(target))continue;
  const html=fs.readFileSync(target,'utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length);
  for(const [,href] of html.matchAll(/href="([^"]+)"/g)){
   if(/^https?:\/\//.test(href)){const url=new URL(href);assert.ok(['http:','https:'].includes(url.protocol));continue;}
   const [file,anchor]=href.split('#');const other=file?path.resolve(dir,file):target;assert.ok(fs.existsSync(other),href);
   if(anchor)assert.ok(fs.readFileSync(other,'utf8').includes(`id="${anchor}"`),href);
  }
  const doc={name,sha256:crypto.createHash('sha256').update(html).digest('hex'),viewports:[]};
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await page.goto(pathToFileURL(target).href);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.equal(overflow,0);assert.equal(await page.locator('h1').count(),1);
   await page.screenshot({path:path.join(dir,'evidence',`${name.slice(0,2)}-${width}.png`)});doc.viewports.push({width,overflow});
  }
  result.documents.push(doc);
 }
 assert.equal(result.pageErrors.length,0);
}catch(err){result.status='FAIL';result.error=String(err);process.exitCode=1;}
finally{fs.writeFileSync(path.join(dir,'evidence/workflow-validation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));await browser.close();}
