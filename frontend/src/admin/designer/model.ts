import {canonical, resolveOverrides, upgradeAccountConfig, validateAccountConfig} from '@dio-crm/contracts/admin';
export type Config = Record<string, any>;
export const domains = ['SCREEN','FIELD','FEATURE','MENU','RULE','LIST_VIEW','ACTION'];
export const stable = (d:string)=>d==='FEATURE'?'platform':'account';
export const docKey = (d:string)=>`${d}:${stable(d)}`;
export const identity = (x:any)=>x.key??x.id;
export function changes(base:any,value:any,path:any[]=[]):any[]{
 if(canonical(base)===canonical(value))return [];
 if(Array.isArray(base)&&Array.isArray(value)&&[...base,...value].every(x=>x&&typeof x==='object'&&identity(x))){return [...base.filter(x=>!value.some(v=>identity(v)===identity(x))).map(x=>({op:'REMOVE_ITEM',path:[...path,{itemKey:identity(x)}]})),...value.flatMap(x=>{const old=base.find(v=>identity(v)===identity(x));return old?changes(old,x,[...path,{itemKey:identity(x)}]):[{op:'SET',path:[...path,{itemKey:identity(x)}],value:x}];})];}
 if(base&&value&&typeof base==='object'&&!Array.isArray(base))return Object.keys(base).some(k=>!(k in value))?[{op:'SET',path,value}]:Object.keys(value).flatMap(k=>changes(base[k],value[k],[...path,{property:k}]));
 return [{op:'SET',path,value}];
}
export function parentConfig(s:any){return upgradeAccountConfig(s.parentEffective,s.effective['SCREEN:account']?.screenKey==='HQ_ACCOUNT'?'HQ':'GLOBAL');}
export function assemble(s:any):Config{const c=structuredClone(s.effective),parent=parentConfig(s);for(const d of s.drafts.filter((d:any)=>domains.includes(d.domain)&&d.stableKey===stable(d.domain)))c[docKey(d.domain)]=resolveOverrides(parent[docKey(d.domain)],d.overrides).payload;return c;}
export const dirtyDomains=(base:Config,current:Config)=>domains.filter(d=>canonical(base[docKey(d)])!==canonical(current[docKey(d)]));
export function updateField(c:Config,key:string,patch:Config){const n=structuredClone(c);const f=n['FIELD:account'].fields.find((f:any)=>f.key===key);if(!f)throw Error('FIELD_NOT_REGISTERED');Object.assign(f,patch);return n;}
export function bulkFields(c:Config,keys:string[],patch:Config){let n=structuredClone(c);for(const key of keys)n=updateField(n,key,patch);validateAccountConfig(n);return n;}
export function reorder(c:Config,group:string,from:string,to:string){const n=structuredClone(c),rows=n['FIELD:account'].fields.filter((f:any)=>f.sectionId===group).sort((a:any,b:any)=>a.order-b.order||a.key.localeCompare(b.key));const i=rows.findIndex((f:any)=>f.key===from),j=rows.findIndex((f:any)=>f.key===to);if(i<0||j<0)throw Error('FIELD_NOT_REGISTERED');rows.splice(j,0,rows.splice(i,1)[0]);rows.forEach((f:any,i:number)=>f.order=(i+1)*10);return n;}
export function removeGroup(c:Config,id:string,target:string){const n=structuredClone(c),s=n['SCREEN:account'];if(target===id||target&&!s.sections.some((r:any)=>r.id===target))throw Error('GROUP_TARGET_REQUIRED');const rows=n['FIELD:account'].fields.filter((f:any)=>f.sectionId===id);if(rows.length&&!target)throw Error('GROUP_TARGET_REQUIRED');rows.forEach((f:any)=>f.sectionId=target);s.sections=s.sections.filter((g:any)=>g.id!==id);validateAccountConfig(n);return n;}
export interface Client{request:(path:string,method?:string,body?:any,key?:string)=>Promise<any>;createDraft:(input:any,key?:string)=>Promise<any>;updateDraft:(id:string,input:any,key?:string)=>Promise<any>}
export class DesignerWorkspace {
 state:any; working:Config={}; loaded:Config={}; published:Config={}; validation:any; validationFingerprint=''; validationAt=0;
 busy=false; blocked=false; error=''; statuses:Record<string,string>={}; history:Config[]=[]; future:Config[]=[]; conflict:any;
 private pending=new Map<string,{signature:string,key:string}>();private generation=0;private version=0;private listeners=new Set<()=>void>();
 constructor(public client:Client,public companyId:string){}
 subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);}};
 snapshot=()=>this.version;
 emit(){this.version++;this.listeners.forEach(f=>f());}
 dispose(){this.generation++;}
 get scope(){return `/api/admin/config/scopes/COMPANY/${this.companyId}`;}
 get dirty(){return dirtyDomains(this.loaded,this.working);}
 get drafts(){return (this.state?.drafts||[]).filter((d:any)=>domains.includes(d.domain)&&d.stableKey===stable(d.domain));}
 invalidate(){this.validation=null;this.validationFingerprint='';}
 async load(){const epoch=++this.generation;const s=await this.client.request(this.scope);if(epoch!==this.generation)return;const c=assemble(s);this.state=s;this.published=structuredClone(s.effective);this.loaded=structuredClone(c);this.working=c;this.history=[];this.future=[];this.statuses={};this.error='';this.blocked=false;this.conflict=null;this.pending.clear();this.invalidate();this.emit();}
 edit(next:Config){if(this.busy||this.blocked)throw Error('EDITOR_LOCKED');this.history=[...this.history.slice(-49),this.working];this.future=[];this.working=next;this.invalidate();this.error='';this.emit();}
 undo(){if(this.busy||!this.history.length)return;this.future.push(this.working);this.working=this.history.pop()!;this.invalidate();this.emit();}
 redo(){if(this.busy||!this.future.length)return;this.history.push(this.working);this.working=this.future.pop()!;this.invalidate();this.emit();}
 discard(){this.working=structuredClone(this.loaded);this.history=[];this.future=[];this.conflict=null;this.error='';this.statuses={};this.invalidate();this.emit();}
 fail(e:any){this.error=e.message||String(e);if(e.status===401||e.status===403)this.blocked=true;this.invalidate();this.emit();}
 fingerprint(s:any){return canonical({parents:s.parentVersionIds,version:s.currentVersionId,drafts:s.drafts});}
 async save(){if(this.busy||this.blocked)throw Error('EDITOR_LOCKED');const epoch=this.generation;this.busy=true;this.error='';this.invalidate();this.emit();
 try{for(const domain of this.dirty){const k=docKey(domain),value=structuredClone(this.working[k]),old=this.state.drafts.find((d:any)=>d.domain===domain&&d.stableKey===stable(domain));const overrides=changes(parentConfig(this.state)[k],value);const body=old?{revision:old.revision,overrides}:{scope:'COMPANY',scopeKey:this.companyId,domain,stableKey:stable(domain),schemaVersion:1,parentVersionIds:this.state.parentVersionIds,overrides};const signature=canonical({id:old?.id,body});let p=this.pending.get(domain);if(!p||p.signature!==signature){p={signature,key:crypto.randomUUID()};this.pending.set(domain,p);}
 this.statuses[domain]='saving';this.emit();try{const result=old?await this.client.updateDraft(old.id,body,p.key):await this.client.createDraft(body,p.key);if(epoch!==this.generation)return;const draft=result.data;this.state={...this.state,drafts:[...this.state.drafts.filter((d:any)=>d.domain!==domain||d.stableKey!==stable(domain)),draft]};this.loaded={...this.loaded,[k]:structuredClone(value)};this.pending.delete(domain);this.statuses[domain]='saved';// Saved domains cannot be undone through cross-domain history.
 this.history=[];this.future=[];this.emit();}catch(e:any){if(epoch!==this.generation)return;this.statuses[domain]='failed';if(e.status===409){const latest=await this.client.request(this.scope);if(epoch!==this.generation)return;this.conflict={latest,remote:assemble(latest),base:structuredClone(this.loaded),mine:structuredClone(this.working)};}throw e;}}
 }catch(e){if(epoch===this.generation)this.fail(e);throw e;}finally{if(epoch===this.generation){this.busy=false;this.emit();}}}
 async check(){if(this.dirty.length||this.blocked||this.conflict||this.busy)throw Error('SAVE_REQUIRED');this.busy=true;this.invalidate();this.emit();try{const latest=await this.client.request(this.scope);if(this.fingerprint(latest)!==this.fingerprint(this.state)){this.conflict={latest,remote:assemble(latest),base:structuredClone(this.loaded),mine:structuredClone(this.working)};throw Error('VALIDATION_STALE');}this.validation=await this.client.request('/api/admin/config/validate','POST',{companyId:this.companyId,draftIds:this.drafts.map((d:any)=>d.id),revisions:this.drafts.map((d:any)=>d.revision),expectedReleaseId:this.state.currentVersionId},crypto.randomUUID());this.validationAt=Date.now();this.validationFingerprint=this.fingerprint(latest);return this.validation;}catch(e){this.fail(e);throw e;}finally{this.busy=false;this.emit();}}
 async publish(reason:string){if(!reason.trim()||!this.validation||this.dirty.length||this.busy||this.blocked)throw Error('VALIDATION_REQUIRED');this.busy=true;this.emit();try{const latest=await this.client.request(this.scope);if(this.fingerprint(latest)!==this.validationFingerprint||Date.now()-this.validationAt>600000)throw Error('VALIDATION_STALE');await this.client.request(`/api/admin/companies/${this.companyId}/releases`,'POST',{validationId:this.validation.validationId,expectedReleaseId:this.state.currentVersionId,reason},crypto.randomUUID());await this.load();}catch(e){this.fail(e);throw e;}finally{this.busy=false;this.emit();}}
 resolve(choices:Record<string,boolean>){const c=this.conflict;if(!c)return;let next=structuredClone(c.remote);for(const d of domains){const k=docKey(d);for(const op of changes(c.base[k],c.mine[k])){const id=k+':'+canonical(op.path);if(choices[id])next[k]=resolveOverrides(next[k],[op]).payload;}}this.state=c.latest;this.published=structuredClone(c.latest.effective);this.loaded=structuredClone(c.remote);this.working=next;this.conflict=null;this.pending.clear();this.history=[];this.future=[];this.statuses={};this.error='';this.invalidate();this.emit();}
}
