import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describeEditorProperty,listEditorProperties,requireEditableEditorProperty,resolveCompanyConfig,canonicalConfigJson} from '../../packages/contracts/dist/crm-customization.js';
import {editSetting} from '../../frontend/src/customization/draft-editor.ts';

const artifact=JSON.parse(readFileSync(new URL('../../packages/contracts/catalogs/hq-customization-baseline.json',import.meta.url),'utf8'));
const fields=artifact.catalog.entries.filter(e=>e.kind==='FIELD'&&e.screenId==='HQ_LEAD');
const keys=['enabled','visible','readOnly','required','order','default','masking'];
const hash=x=>createHash('sha256').update(canonicalConfigJson(x)).digest('hex');
const entry=()=>({id:'lead.test',kind:'FIELD',screenId:'HQ_LEAD',labelKey:'lead.test',support:'supported',bindingKind:'DATA',settings:{enabled:true,visible:true,readOnly:false,required:false,order:0},capabilities:[...keys],locks:[],dependencies:[],permissions:[],readPermissions:[],writePermissions:[],requiredTranslation:false,valueRule:{type:'string',nullable:true,minLength:1,maxLength:50,options:['one','two']}});
const config=()=>({companyId:'company-A',baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{}});

test('all 42 baseline lead fields preserve capability/lock decisions and serialized policy result',()=>{
 assert.equal(fields.length,42);const before=canonicalConfigJson(artifact),c=config(),resolved=resolveCompanyConfig(artifact.catalog,c),releaseHash=hash({config:c,effective:resolved});
 for(const e of fields){const descriptors=listEditorProperties(e);assert.equal(descriptors.length,8);
  for(const key of keys){const d=describeEditorProperty(e,key);assert.equal(d.editable,e.support==='supported'&&e.capabilities.includes(key)&&!e.locks.includes(key));assert.deepEqual(d.standardValue,e.settings[key]);assert.deepEqual(d.valueRule,e.valueRule);}
 }
 assert.equal(canonicalConfigJson(artifact),before);assert.deepEqual(resolveCompanyConfig(artifact.catalog,c),resolved);assert.equal(hash({config:c,effective:resolveCompanyConfig(artifact.catalog,c)}),releaseHash);
});

test('descriptors cannot mutate catalog valueRule including options and legacy constraints',()=>{
 const e=entry(),before=structuredClone(e);const d=describeEditorProperty(e,'default');d.valueRule.options.push('forged');d.valueRule.nullable=false;d.valueRule.minLength=99;assert.deepEqual(e,before);
});

test('absence, false, zero and null are not collapsed by descriptor projection',()=>{
 const e=entry();assert.equal(describeEditorProperty(e,'default').standardValue,undefined);assert.equal(describeEditorProperty(e,'required').standardValue,false);assert.equal(describeEditorProperty(e,'order').standardValue,0);e.settings.default=null;assert.equal(describeEditorProperty(e,'default').standardValue,null);
});

test('unknown keys and unimplemented object kinds fail closed even with forged capabilities',()=>{
 const e=entry();e.capabilities.push('width');assert.equal(describeEditorProperty(e,'width'),null);assert.throws(()=>requireEditableEditorProperty(e,'width'),/UNKNOWN_EDITOR_PROPERTY/);assert.throws(()=>editSetting(config(),e,'width',100),/UNKNOWN_EDITOR_PROPERTY/);
 for(const kind of ['GRID','COLUMN','OBJECT'])assert.equal(describeEditorProperty({...e,kind},'visible'),null);
});

test('locked, incapable, unsupported and decision-pending targets cannot be edited',()=>{
 const e=entry();e.locks=['visible'];assert.equal(describeEditorProperty(e,'visible').reason,'LOCKED');assert.throws(()=>editSetting(config(),e,'visible',false),/LOCKED/);
 e.capabilities=[];assert.equal(describeEditorProperty(e,'required').reason,'NOT_CAPABLE');assert.throws(()=>requireEditableEditorProperty(e,'required'),/NOT_CAPABLE/);
 for(const support of ['unsupported','decision_pending']){e.support=support;assert.throws(()=>requireEditableEditorProperty(e,'translation'),/UNSUPPORTED_TARGET/);}
});

test('setting edit/reset keeps legacy patch representation and does not add metadata',()=>{
 const e=entry(),c=config();const edited=editSetting(c,e,'visible',false);assert.deepEqual(edited,{...c,patches:[{targetId:e.id,property:'visible',operation:'set',value:false}]});assert.deepEqual(editSetting(edited,e,'visible',undefined),c);assert.deepEqual(c,config());
});

test('translation descriptor is distinct from settings and does not fabricate locale defaults',()=>{
 const e=entry();e.capabilities=[];const d=requireEditableEditorProperty(e,'translation');assert.equal(d.storage,'translation');assert.equal(d.standardValue,undefined);assert.equal(d.valueType,'translation');
});
