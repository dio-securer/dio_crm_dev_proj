import test from 'node:test';
import assert from 'node:assert/strict';
import '../hq-standard/register.mjs';
const {placedExtensionFields,requiredExtensionMissing}=await import('../../frontend/src/customization/lead-extension-layout.ts');
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const fields=[{id:a,version:1,readable:true,writable:true},{id:b,version:1,readable:true,writable:true}];
const layout={schemaVersion:1,placements:[{fieldId:a,definitionVersion:1,visible:true,readOnly:false,required:true,createRegion:'basic',detailRegion:'hospital',createOrder:2,detailOrder:1},{fieldId:b,definitionVersion:1,visible:true,readOnly:true,required:false,createRegion:'basic',detailRegion:'basic',createOrder:1,detailOrder:0}],listColumns:[]};
test('create order, detail tab and read-only view follow the published layout',()=>{
 assert.deepEqual(placedExtensionFields(fields,layout,'create','basic').map(f=>f.id),[b,a]);
 assert.deepEqual(placedExtensionFields(fields,layout,'detail','hospital').map(f=>f.id),[a]);
 assert.equal(placedExtensionFields(fields,layout,'detail','basic')[0].writable,false);
 assert.deepEqual(requiredExtensionMissing(fields,layout,{}),[a]);
 assert.deepEqual(requiredExtensionMissing(fields,layout,{[a]:'value'}),[]);
});
