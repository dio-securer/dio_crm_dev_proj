import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
// No source resolver hook: verify the built package used by real consumers.
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
test('consumer resolves emitted crm-customization package and declarations',()=>{
 const resolved=require.resolve('@dio-crm/contracts/crm-customization');assert.match(resolved.replaceAll('\\','/'),/packages\/contracts\/dist\/crm-customization\.js$/);
 const api=require('@dio-crm/contracts/crm-customization');assert.equal(typeof api.resolveCompanyConfig,'function');assert.equal(api.canonicalConfigJson({z:1,a:2}),'{"a":2,"z":1}');
 assert.ok(fs.readFileSync(resolved.replace(/\.js$/,'.d.ts'),'utf8').includes('resolveCompanyConfig'));
});
