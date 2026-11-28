import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const base=path.resolve('docs/admin-platform/customization');
const files=['16_Visual_Editor_Prerequisites.md','17_Visual_Editor_Design.md','18_Visual_Editor_Work_Standard.md'];
for(const name of files){
 const file=path.join(base,name),body=fs.readFileSync(file,'utf8');
 for(const [,target] of body.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)){
  if(/^https?:\/\//.test(target))continue;
  assert(fs.existsSync(path.resolve(path.dirname(file),target)),`${name}: ${target}`);
 }
}
const plan=fs.readFileSync(path.resolve('docs/admin-platform/08_CRM_Customization_Implementation_Plan.html'),'utf8');
for(const name of files)assert(plan.includes(`customization/${name}`),`Plan link missing: ${name}`);
console.log('Visual editor prerequisite, design, work standard links PASS');
