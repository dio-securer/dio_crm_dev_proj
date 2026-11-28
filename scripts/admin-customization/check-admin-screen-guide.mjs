import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=path.resolve('docs/admin-platform/customization');
const file=path.join(base,'15_Admin_Functions_Screen_Guide.html');
const html=fs.readFileSync(file,'utf8');
for(const [,target] of html.matchAll(/(?:src|href)="([^"]+)"/g)){
 if(target.startsWith('#'))continue;
 assert(fs.existsSync(path.resolve(base,target)),`Missing guide asset: ${target}`);
}
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.goto(pathToFileURL(file).href);
  await page.locator('img').first().waitFor();
  await page.evaluate(async()=>{await Promise.all([...document.images].map(image=>{image.loading='eager';return image.decode();}));});
  const result=await page.evaluate(()=>({broken:[...document.images].filter(image=>!image.complete||image.naturalWidth===0).map(image=>image.src),overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.deepEqual(result.broken,[]);
  assert.equal(result.overflow,false,`Horizontal overflow at ${width}px`);
  await page.close();
 }
 console.log('Admin screen guide: links, images, 1440/390 layout PASS');
}finally{await browser.close();}
