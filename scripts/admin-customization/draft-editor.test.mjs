import test from 'node:test';import assert from 'node:assert/strict';import '../hq-standard/register.mjs';
const {editSetting,editTranslation}=await import('../../frontend/src/customization/draft-editor.ts');
const entry={id:'field',kind:'FIELD',support:'supported',settings:{enabled:true,visible:true,readOnly:false,required:false,order:0},locks:[],capabilities:['visible','required']};
const cfg={companyId:'c',baseStandardReleaseId:'s',activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{},patches:[]};
test('override updates preserve other properties and reset restores inheritance',()=>{
 let next=editSetting(cfg,entry,'visible',false);next=editSetting(next,entry,'required',true);next=editSetting(next,entry,'visible',true);
 assert.equal(next.patches.length,2);next=editSetting(next,entry,'visible',undefined);assert.deepEqual(next.patches.map(p=>p.property),['required']);assert.deepEqual(cfg.patches,[]);
});
test('locked unsupported and non-capable controls cannot be changed',()=>{
 assert.throws(()=>editSetting(cfg,{...entry,locks:['visible']},'visible',false));assert.throws(()=>editSetting(cfg,{...entry,support:'unsupported'},'visible',false));assert.throws(()=>editSetting(cfg,entry,'default','x'));
});
test('locale overrides are isolated and clearing restores the standard translation',()=>{
 const next=editTranslation(cfg,'ko-KR','label','표시');assert.equal(next.translations['ko-KR'].label,'표시');assert.equal(next.translations['en-US'],undefined);
 assert.equal(editTranslation(next,'ko-KR','label','').translations['ko-KR'].label,undefined);assert.deepEqual(cfg.translations,{});assert.throws(()=>editTranslation(cfg,'fr-FR','label','x'));
});
