import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=path.join(root,'docs/admin-platform/customization');
const evidence=path.join(dir,'evidence');
const read=n=>JSON.parse(fs.readFileSync(path.join(evidence,n),'utf8'));
const manifest=read('design-manifest.json'),baseline=read('baseline.json'),semantic=read('semantic-map.json');
const filename=path.join(dir,'02_Work_Design.html'),html=fs.readFileSync(filename,'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(ids.length,new Set(ids).size);
for(const section of manifest.sections)assert.ok(ids.includes(section.id));
assert.deepEqual(manifest.trace.map(x=>x.findingId).sort(),Array.from({length:15},(_,i)=>'G'+String(i+1).padStart(2,'0')));
for(const row of manifest.trace){for(const id of row.designIds)assert.ok(ids.includes(id));for(const id of row.testIds)assert.ok(manifest.tests.includes(id));}
assert.deepEqual(manifest.baseline.fields,semantic.fields.map(x=>x.fieldKey));
assert.deepEqual(manifest.baseline.actions,semantic.actions.map(x=>x.actionKey));
assert.deepEqual(manifest.baseline.popups,semantic.popups.map(x=>x.id));
assert.deepEqual(manifest.baseline.screens,baseline.standard.screens.map(x=>x.screenKey));
for(const id of [...manifest.tests,...manifest.decisions])assert.ok(html.includes(`<td>${id}</td>`));
const links=[...html.matchAll(/href="([^"]+)"/g)].map(x=>x[1]);
for(const link of links){if(link.startsWith('#'))assert.ok(ids.includes(link.slice(1)));else assert.ok(fs.existsSync(path.resolve(dir,link)),link);}
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
for(const item of baseline.baseline.sourceHashes)assert.equal(hash(fs.readFileSync(path.join(root,item.file))),item.sha256,`App source changed: ${item.file}`);
const result={stage:'C01',scope:'Document structure, traceability, source preservation and browser rendering only; no application acceptance',status:'PASS',atUtc:new Date().toISOString(),findings:manifest.trace.length,designSections:manifest.sections.length,links:links.length,preservedSourceHashes:baseline.baseline.sourceHashes.length,documentSha256:hash(html),viewports:[],pageErrors:[]};
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage();page.on('pageerror',error=>result.pageErrors.push(String(error)));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.goto(pathToFileURL(filename).href);
  const check={width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),h1:await page.locator('h1').count(),sections:await page.locator('section').count()};
  assert.equal(check.overflow,0);assert.equal(check.h1,1);assert.equal(check.sections,16);
  await page.screenshot({path:path.join(evidence,`c01-design-${width}.png`)});
  await page.locator('a[href="#D10"]').click();assert.ok(page.url().endsWith('#D10'));
  check.anchorNavigation='PASS';result.viewports.push(check);
 }
 assert.equal(result.pageErrors.length,0);
}catch(error){result.status='FAIL';result.error=String(error);process.exitCode=1;}
finally{fs.writeFileSync(path.join(evidence,'design-validation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(browser)await browser.close();}
