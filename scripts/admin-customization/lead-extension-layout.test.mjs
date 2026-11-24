import test from 'node:test';
import assert from 'node:assert/strict';
import '../hq-standard/register.mjs';
const {validLeadExtensionLayout}=await import('../../packages/contracts/src/lead-extension-layout.ts');
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const selected=[{id:a,version:1},{id:b,version:2}];
const layout={schemaVersion:1,placements:[{fieldId:a,definitionVersion:1,visible:true,readOnly:false,required:true,createRegion:'basic',detailRegion:'basic',createOrder:1,detailOrder:0},{fieldId:b,definitionVersion:2,visible:true,readOnly:true,required:false,createRegion:'hospital',detailRegion:'hospital'}],listColumns:[a]};
test('HQ-selected definition IDs and versions determine valid company placement',()=>{
 assert.equal(validLeadExtensionLayout(layout,selected),true);
 for(const candidate of [
  {...layout,placements:[layout.placements[0]]},
  {...layout,placements:[{...layout.placements[0],definitionVersion:2},layout.placements[1]]},
  {...layout,listColumns:[a,a]},
  {...layout,listColumns:[b,b]},
  {...layout,placements:[{...layout.placements[0],readOnly:true},layout.placements[1]]},
  {...layout,placements:[{...layout.placements[0],detailRegion:undefined},layout.placements[1]]},
 ])assert.equal(validLeadExtensionLayout(candidate,selected),false);
});
