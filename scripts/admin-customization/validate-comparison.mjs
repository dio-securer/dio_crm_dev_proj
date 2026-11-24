import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=path.join(root,'docs/admin-platform/customization');
const json=name=>JSON.parse(fs.readFileSync(path.join(dir,'evidence',name),'utf8'));
const b=json('baseline.json'),s=json('semantic-map.json'),v=json('verification.json'),browser=json('browser-baseline.json');
assert.deepEqual(s.fields.map(x=>x.fieldKey).sort(),b.standard.fields.map(x=>x.fieldKey).sort());
assert.deepEqual(s.actions.map(x=>x.actionKey).sort(),b.standard.actions.map(x=>x.actionKey).sort());
assert.ok(s.fields.every(x=>x.reason&&x.runtimeStatus==='NOT_INDIVIDUALLY_TESTED'));
assert.ok(s.actions.every(x=>x.sourceEvidence.length>0));
for(const [key,callee] of [['OPP.product.edit','apiPatch'],['OPP.product.remove','apiDelete']]){
  const triggers=s.actions.find(x=>x.actionKey===key).triggerControls;
  assert.equal(triggers.length,1);assert.ok(triggers[0].behaviour.includes(callee));
}
assert.ok(s.actions.find(x=>x.actionKey==='CONTACT.create').triggerControls.some(x=>x.tag==='form'));
assert.ok(s.popups.every(x=>x.triggerEvidence.length&&x.componentEvidence.length));
assert.ok(s.controls.every(x=>x.semanticMapping!=='PENDING_MANUAL_MAPPING'));
assert.ok(s.dynamicFields.every(x=>x.fieldIds.length));
assert.equal(v.browser,undefined);assert.equal(v.build,undefined);
assert.ok(v.executionScope&&v.companionEvidence);
assert.equal(browser.fatal,undefined);assert.equal(browser.failed,0);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
for(const entry of b.baseline.sourceHashes)assert.equal(hash(fs.readFileSync(path.join(root,entry.file))),entry.sha256,`Source changed: ${entry.file}`);
const file=path.join(dir,'01_Current_Comparison.html'),html=fs.readFileSync(file,'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length);
const links=[...html.matchAll(/href="([^"]+)"/g)].map(x=>x[1]);
for(const link of links){if(link.startsWith('#'))assert.ok(ids.includes(link.slice(1)),link);else assert.ok(fs.existsSync(path.resolve(dir,link)),link);}
const result={status:'PASS',atUtc:new Date().toISOString(),scope:'Document consistency, inventory coverage, source hashes and local links. Not a product behavior acceptance.',
 fields:s.fields.length,actions:s.actions.length,popups:s.popups.length,dynamicFields:s.dynamicFields.length,hqControls:s.controls.length,sourceHashes:b.baseline.sourceHashes.length,links:links.length};
fs.writeFileSync(path.join(dir,'evidence/document-validation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
