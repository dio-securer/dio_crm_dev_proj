import { randomUUID } from 'node:crypto';
import { configAssert } from './config-store.js';

/** E06 local contract. No public controller is registered until the field-creation policy is decided. */
export type ExtensionField = { id:string;companyId:string;key:string;entity:'lead';version:number;type:'text'|'number'|'boolean'|'date';labels:Record<string,string>;maxLength?:number;min?:number;max?:number;required:false;state:'ACTIVE'|'RETIRED' };
export type ExtensionValues = { companyId:string;recordId:string;revision:number;values:Record<string,{definitionVersion:number;value:string|number|boolean|null}> };
export type ExtensionActor={id:string;companyId:string};
export interface ExtensionTransaction {
 authorize?(actor:ExtensionActor,operation:'define'|'read'|'write',recordId?:string,fieldId?:string):Promise<boolean>;
 definition(id:string):Promise<ExtensionField|null>;
 definitions():Promise<ExtensionField[]>;
 putDefinition(field:ExtensionField,expectedVersion:number|null):Promise<void>;
 values(recordId:string):Promise<ExtensionValues>;
 putValues(value:ExtensionValues,expectedRevision:number):Promise<void>;
 audit(event:{id:string;actorId:string;operation:string;targetId:string;at:string}):Promise<void>;
}
export interface ExtensionRepository { transaction<T>(companyId:string,work:(tx:ExtensionTransaction)=>Promise<T>):Promise<T> }
/** Must re-read current membership and record/field access inside the same transaction. Never accept these grants from HTTP. */
export type ExtensionAuthorize=(tx:ExtensionTransaction,actor:ExtensionActor,operation:'define'|'read'|'write',recordId?:string,fieldId?:string)=>Promise<boolean>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function valueValid(field:ExtensionField,value:unknown):boolean {
 if(value===null)return !field.required;
 if(field.type==='text')return typeof value==='string'&&value.length<=(field.maxLength??500);
 if(field.type==='number')return typeof value==='number'&&Number.isFinite(value)&&(field.min===undefined||value>=field.min)&&(field.max===undefined||value<=field.max);
 if(field.type==='boolean')return typeof value==='boolean';
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value;
}
export class ExtensionFieldService {
 constructor(private readonly repository:ExtensionRepository,private readonly authorize:ExtensionAuthorize=async(tx,actor,operation,recordId,fieldId)=>await tx.authorize?.(actor,operation,recordId,fieldId)??false){}
 private actor(actor:ExtensionActor){configAssert(uuid.test(actor.companyId)&&uuid.test(actor.id),400,'INVALID_CONTEXT');return {...actor,id:actor.id.toLowerCase(),companyId:actor.companyId.toLowerCase()};}
 async define(inputActor:ExtensionActor,input:{key:string;type:ExtensionField['type'];labels:Record<string,string>;maxLength?:number;min?:number;max?:number}){
  const actor=this.actor(inputActor);
  configAssert(input&&Object.keys(input).every(k=>['key','type','labels','maxLength','min','max'].includes(k)),422,'INVALID_FIELD_DEFINITION');
  configAssert(/^x_[a-z][a-z0-9_]{0,60}$/.test(input.key)&&['text','number','boolean','date'].includes(input.type),422,'INVALID_FIELD_DEFINITION');
  configAssert(input.labels&&typeof input.labels==='object'&&!Array.isArray(input.labels)&&Object.keys(input.labels).length<=20&&['ko-KR','en-US'].every(l=>typeof input.labels[l]==='string'&&input.labels[l].trim().length>0)&&Object.entries(input.labels).every(([k,v])=>/^[a-z]{2}-[A-Z]{2}$/.test(k)&&typeof v==='string'&&v.trim().length>0&&v.length<=200&&!/[<>]/.test(v)),422,'INVALID_FIELD_DEFINITION');
  configAssert(input.maxLength===undefined||input.type==='text'&&Number.isSafeInteger(input.maxLength)&&input.maxLength>0&&input.maxLength<=4000,422,'INVALID_FIELD_DEFINITION');
  configAssert([input.min,input.max].every(v=>v===undefined||input.type==='number'&&Number.isFinite(v))&&(input.min===undefined||input.max===undefined||input.min<=input.max),422,'INVALID_FIELD_DEFINITION');
  return this.repository.transaction(actor.companyId,async tx=>{
   configAssert(await this.authorize(tx,actor,'define'),403,'PERMISSION_DENIED');
   configAssert(!(await tx.definitions()).some(f=>f.key===input.key),409,'FIELD_KEY_EXISTS');
   const field:ExtensionField={...structuredClone(input),id:randomUUID(),companyId:actor.companyId,entity:'lead',version:1,required:false,state:'ACTIVE'};
   await tx.putDefinition(field,null);await tx.audit({id:randomUUID(),actorId:actor.id,operation:'field.define',targetId:field.id,at:new Date().toISOString()});return field;
  });
 }
 async read(inputActor:ExtensionActor,recordId:string){const actor=this.actor(inputActor);configAssert(uuid.test(recordId),422,'INVALID_RECORD');recordId=recordId.toLowerCase();return this.repository.transaction(actor.companyId,async tx=>{
  configAssert(await this.authorize(tx,actor,'read',recordId),404,'NOT_FOUND');const row=await tx.values(recordId);const values:ExtensionValues['values']={};
  for(const [id,value] of Object.entries(row.values)){const field=await tx.definition(id);if(field&&field.companyId===actor.companyId&&field.state==='ACTIVE'&&await this.authorize(tx,actor,'read',recordId,id))values[id]=value;}
  return {...row,values};
 });}
 async write(inputActor:ExtensionActor,recordId:string,expectedRevision:number,input:ExtensionValues['values']){const actor=this.actor(inputActor);configAssert(uuid.test(recordId)&&Number.isSafeInteger(expectedRevision)&&expectedRevision>=0&&expectedRevision<2147483647,422,'INVALID_RECORD');recordId=recordId.toLowerCase();configAssert(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).length>0&&Object.keys(input).length<=100,422,'INVALID_FIELD_VALUES');return this.repository.transaction(actor.companyId,async tx=>{
  configAssert(await this.authorize(tx,actor,'write',recordId),404,'NOT_FOUND');const row=await tx.values(recordId);configAssert(row.revision===expectedRevision,409,'RECORD_CONFLICT');
  const values=structuredClone(row.values);
  const seen=new Set<string>();
  for(const [rawId,entry] of Object.entries(input)){
   const id=rawId.toLowerCase();
   configAssert(uuid.test(id)&&!seen.has(id)&&entry&&typeof entry==='object'&&!Array.isArray(entry)&&Object.keys(entry).every(k=>['definitionVersion','value'].includes(k)),422,'INVALID_FIELD_VALUES');seen.add(id);
   const field=await tx.definition(id);configAssert(field&&field.companyId===actor.companyId&&field.state==='ACTIVE',422,'FIELD_NOT_AVAILABLE');
   configAssert(await this.authorize(tx,actor,'write',recordId,id),403,'FIELD_WRITE_DENIED');configAssert(field.version===entry.definitionVersion,409,'FIELD_VERSION_CHANGED');configAssert(valueValid(field,entry.value),422,'INVALID_FIELD_VALUE');values[id]=structuredClone(entry);
  }
  const saved={...row,revision:row.revision+1,values};await tx.putValues(saved,expectedRevision);await tx.audit({id:randomUUID(),actorId:actor.id,operation:'field.values.write',targetId:recordId,at:new Date().toISOString()});return {revision:saved.revision};
 });}
}

type MemoryState={definitions:ExtensionField[];records:Record<string,ExtensionValues>;audit:Array<{id:string;actorId:string;operation:string;targetId:string;at:string}>};
/** Serial transaction and rollback mirror the repository contract, not real database durability. */
export class MemoryExtensionRepository implements ExtensionRepository {
 private data:Record<string,MemoryState>;private tail:Promise<unknown>=Promise.resolve();
 constructor(snapshot:Record<string,MemoryState>={}){this.data=structuredClone(snapshot);}
 snapshot(){return structuredClone(this.data);}
 async transaction<T>(companyId:string,work:(tx:ExtensionTransaction)=>Promise<T>):Promise<T>{
  const run=this.tail.then(async()=>{const state=structuredClone(this.data[companyId]??{definitions:[],records:{},audit:[]});
   const tx:ExtensionTransaction={definition:async id=>structuredClone(state.definitions.find(f=>f.id===id)??null),definitions:async()=>structuredClone(state.definitions),putDefinition:async(field,expected)=>{const previous=state.definitions.find(f=>f.id===field.id);configAssert(field.companyId===companyId&&(previous?.version??null)===expected,409,'FIELD_VERSION_CHANGED');state.definitions=state.definitions.filter(f=>f.id!==field.id);state.definitions.push(structuredClone(field));},values:async id=>structuredClone(state.records[id]??{companyId,recordId:id,revision:0,values:{}}),putValues:async(row,revision)=>{configAssert(row.companyId===companyId&&(state.records[row.recordId]?.revision??0)===revision,409,'RECORD_CONFLICT');state.records[row.recordId]=structuredClone(row);},audit:async event=>{state.audit.push(event);}};
   const result=await work(tx);this.data[companyId]=state;return structuredClone(result);
  });this.tail=run.catch(()=>{});return run;
 }
}
