import { createHash } from 'node:crypto';
import { hqCanRead, hqFind, hqOnlyKeys, hqRequire, hqText, type HqApplication, type HqRouteContext } from './app.js';
import { auditHq, hqAssert, newHqId, type HqDataset, type HqRow } from './model.js';

// JSON transport is limited to 1 MB; base64 and metadata must fit that envelope.
const MAX_FILE_BYTES = 512 * 1024;
type Attachment = {public_id:string;name:string;contentType:string;base64:string;size:number;version:number;created_at:string;deleted:boolean;requestKey:string;digest:string;note:string;updates?:{key:string;fingerprint:string}[]};
const files = (row:HqRow):Attachment[] => Array.isArray(row.mock_files) ? row.mock_files as Attachment[] : [];
const metadata = ({base64,requestKey,digest,updates,...file}:Attachment) => file;
export function requireAccountRelatedAccess(c:HqRouteContext,d:HqDataset,write=false):HqRow {
  hqRequire(c.actor,'ACCOUNT.READ');
  const row=hqFind(d,c.actor,'accounts',c.params.publicId);
  hqAssert(row.deleted_yn!==true&&row.account_status!=='MERGED',404,'NOT_FOUND');
  c.app.requireAction(c.actor,write?'ACC.save':'ACC.open',row);
  if(write){
    hqRequire(c.actor,'ACCOUNT.WRITE');
    const sharedEdit=Array.isArray(row.mock_shares)&&row.mock_shares.some((share:Record<string,unknown>)=>share.userId===c.actor.userId&&share.access==='EDIT'&&share.deleted!==true);
    if(!hqCanRead(c.actor,{...row,mock_shares:[]}))hqAssert(sharedEdit,403,'SHARE_READ_ONLY');
    hqAssert(sharedEdit||row.owner_user_id===c.actor.userId||c.actor.permissions.includes('ACCOUNT.MERGE'),403,'OWNER_REQUIRED');
  }
  return row;
}
function log(c:HqRouteContext,d:HqDataset,row:HqRow,action:string,file:Attachment) {
  const detail={fileId:file.public_id,fileName:file.name,size:file.size,version:file.version,changeNote:(file as Attachment & {changeNote?:string}).changeNote??''};
  row.history=[...(Array.isArray(row.history)?row.history:[]),{public_id:newHqId(d),action,at:d.clock,user_id:c.actor.userId,...detail}];
  auditHq(d,c.actor,action,row.public_id,detail);
}
function decodeFile(name:string,contentType:string,base64:unknown):Buffer {
    const extension=name.split('.').pop()?.toLowerCase();
    const allowed:Record<string,string>={txt:'text/plain',csv:'text/csv',pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'};
    hqAssert(extension&&allowed[extension]===contentType,400,'FILE_TYPE_INVALID');
    hqAssert(typeof base64==='string'&&base64.length<=Math.ceil(MAX_FILE_BYTES/3)*4&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64),400,'FILE_SIZE_OR_ENCODING_INVALID');
    const bytes=Buffer.from(base64 as string,'base64');hqAssert(bytes.length>0&&bytes.length<=MAX_FILE_BYTES,400,'FILE_SIZE_INVALID');
    if(contentType==='application/pdf')hqAssert(bytes.subarray(0,5).toString()==='%PDF-',400,'FILE_CONTENT_INVALID');
    if(contentType==='image/png')hqAssert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),400,'FILE_CONTENT_INVALID');
    if(contentType==='image/jpeg')hqAssert(bytes[0]===255&&bytes[1]===216&&bytes[2]===255,400,'FILE_CONTENT_INVALID');
    return bytes;
}
export function installAccountRelatedRoutes(app:HqApplication):void {
  type Share={public_id:string;userId:number;access:'READ'|'EDIT';teamRole:string;version:number;deleted:boolean;requestKey:string};
  const shares=(row:HqRow):Share[]=>Array.isArray(row.mock_shares)?row.mock_shares as Share[]:[];
  const manage=(c:HqRouteContext,d:HqDataset)=>{const row=requireAccountRelatedAccess(c,d,true);hqAssert(hqCanRead(c.actor,{...row,mock_shares:[]})&&(row.owner_user_id===c.actor.userId||c.actor.permissions.includes('ACCOUNT.MERGE')),403,'SHARE_MANAGE_DENIED');return row;};
  const shareAudit=(c:HqRouteContext,d:HqDataset,row:HqRow,action:string,share:Share)=>{const detail={recipientId:share.userId,access:share.access,teamRole:share.teamRole};row.history=[...(Array.isArray(row.history)?row.history:[]),{public_id:newHqId(d),action,at:d.clock,...detail}];auditHq(d,c.actor,action,row.public_id,detail);};
  app.route('GET','/api/accounts/:publicId/shares',c=>{
    const row=requireAccountRelatedAccess(c,c.repository.read());
    let actionAllowed=true;try{app.requireAction(c.actor,'ACC.save',row);}catch{actionAllowed=false;}
    const canManage=actionAllowed&&hqCanRead(c.actor,{...row,mock_shares:[]})&&c.actor.permissions.includes('ACCOUNT.WRITE')&&(row.owner_user_id===c.actor.userId||c.actor.permissions.includes('ACCOUNT.MERGE'));
    return {items:shares(row).filter(item=>!item.deleted).map(({requestKey,...item})=>({...item,name:app.personas.find(p=>p.companyId===c.actor.companyId&&p.userId===item.userId)?.name??'사용자'})),
      users:canManage?app.personas.filter(p=>p.companyId===c.actor.companyId&&p.active!==false&&p.permissions.includes('ACCOUNT.READ')).map(p=>({userId:p.userId,name:p.name,loginId:p.loginId,canEdit:p.permissions.includes('ACCOUNT.WRITE')})):[],canManage,opportunityAccess:'PRIVATE',serviceAccess:'PRIVATE',mode:'MOCK'};
  });
  app.route('POST','/api/accounts/:publicId/shares',c=>{
    hqOnlyKeys(c.body,['userId','access','teamRole','idempotencyKey']);const key=hqText(c.body.idempotencyKey,'idempotencyKey',200);
    return c.repository.transact(d=>{const row=manage(c,d),person=app.personas.find(p=>p.companyId===c.actor.companyId&&p.userId===c.body.userId&&p.active!==false);
      hqAssert(person&&person.permissions.includes('ACCOUNT.READ'),400,'SHARE_USER_INVALID');hqAssert(['READ','EDIT'].includes(String(c.body.access)),400,'SHARE_ACCESS_INVALID');hqAssert(c.body.access!=='EDIT'||person.permissions.includes('ACCOUNT.WRITE'),403,'SHARE_EXCEEDS_PERMISSION');
      const teamRole=typeof c.body.teamRole==='string'?c.body.teamRole.trim():'';hqAssert(teamRole.length<=80,400,'TEAM_ROLE_INVALID');
      const previous=shares(row).find(item=>item.requestKey===key);if(previous){hqAssert(previous.userId===person.userId&&previous.access===c.body.access&&previous.teamRole===teamRole,409,'IDEMPOTENCY_CONFLICT');return previous;}
      hqAssert(!shares(row).some(item=>!item.deleted&&item.userId===person.userId),409,'SHARE_EXISTS');
      const share:Share={public_id:newHqId(d),userId:person.userId,access:c.body.access as 'READ'|'EDIT',teamRole,version:1,deleted:false,requestKey:key};row.mock_shares=[...shares(row),share];shareAudit(c,d,row,'ACC.shareCreate',share);return share;
    },true);
  });
  for(const method of ['PATCH','DELETE'])app.route(method,'/api/accounts/:publicId/shares/:shareId',c=>{
    hqOnlyKeys(c.body,method==='PATCH'?['access','teamRole','expectedVersion','idempotencyKey']:['expectedVersion','idempotencyKey']);
    return c.repository.transact(d=>{const row=manage(c,d),share=shares(row).find(item=>item.public_id===c.params.shareId&&!item.deleted);hqAssert(share,404,'SHARE_NOT_FOUND');hqAssert(share.version===c.body.expectedVersion,409,'VERSION_CONFLICT');
      if(method==='DELETE')share.deleted=true;
      else{const person=app.personas.find(p=>p.companyId===c.actor.companyId&&p.userId===share.userId&&p.active!==false);hqAssert(person&&person.permissions.includes('ACCOUNT.READ'),400,'SHARE_USER_INVALID');hqAssert(['READ','EDIT'].includes(String(c.body.access)),400,'SHARE_ACCESS_INVALID');hqAssert(c.body.access!=='EDIT'||person.permissions.includes('ACCOUNT.WRITE'),403,'SHARE_EXCEEDS_PERMISSION');share.access=c.body.access as 'READ'|'EDIT';share.teamRole=typeof c.body.teamRole==='string'?c.body.teamRole.trim():'';hqAssert(share.teamRole.length<=80,400,'TEAM_ROLE_INVALID');}
      share.version++;shareAudit(c,d,row,method==='DELETE'?'ACC.shareDelete':'ACC.shareEdit',share);return share;
    },true);
  });
  app.route('GET','/api/accounts/:publicId/files',c=>({items:files(requireAccountRelatedAccess(c,c.repository.read())).filter(file=>!file.deleted).map(metadata),maxBytes:MAX_FILE_BYTES,mode:'MOCK'}));
  app.route('POST','/api/accounts/:publicId/files',c=>{
    hqOnlyKeys(c.body,['name','contentType','base64','note','idempotencyKey']);
    const name=hqText(c.body.name,'name',160),contentType=hqText(c.body.contentType,'contentType',80),key=hqText(c.body.idempotencyKey,'idempotencyKey',200);
    hqAssert(!/[\\/\x00-\x1f\x7f"]/.test(name),400,'FILE_NAME_INVALID');
    const bytes=decodeFile(name,contentType,c.body.base64);
    const note=typeof c.body.note==='string'?c.body.note.trim():'';hqAssert(note.length<=2000,400,'FILE_NOTE_TOO_LONG');
    const digest=createHash('sha256').update(name).update(contentType).update(bytes).update(note).digest('hex');
    return c.repository.transact(d=>{
      const row=requireAccountRelatedAccess(c,d,true),previous=files(row).find(file=>file.requestKey===key);
      if(previous){hqAssert(previous.digest===digest,409,'IDEMPOTENCY_CONFLICT');return metadata(previous);}
      hqAssert(files(row).filter(file=>!file.deleted).length<10,400,'FILE_LIMIT_REACHED');
      const file:Attachment={public_id:newHqId(d),name,contentType,base64:bytes.toString('base64'),size:bytes.length,version:1,created_at:d.clock,deleted:false,requestKey:key,digest,note};
      row.mock_files=[...files(row),file];log(c,d,row,'ACC.fileUpload',file);return metadata(file);
    },true);
  });
  app.route('GET','/api/accounts/:publicId/files/:fileId/download',c=>{
    const file=files(requireAccountRelatedAccess(c,c.repository.read())).find(item=>item.public_id===c.params.fileId&&!item.deleted);hqAssert(file,404,'FILE_NOT_FOUND');
    return {__hqBinary:true,bytes:Buffer.from(file.base64,'base64'),contentType:'application/octet-stream',filename:encodeURIComponent(file.name)};
  });
  app.route('POST','/api/accounts/:publicId/files/:fileId/version',c=>{
    hqOnlyKeys(c.body,['contentType','base64','changeNote','expectedVersion','idempotencyKey']);
    const changeNote=typeof c.body.changeNote==='string'?c.body.changeNote.trim():'';hqAssert(changeNote.length<=2000,400,'FILE_NOTE_TOO_LONG');
    const key=hqText(c.body.idempotencyKey,'idempotencyKey',200);
    return c.repository.transact(d=>{
      const row=requireAccountRelatedAccess(c,d,true),file=files(row).find(item=>item.public_id===c.params.fileId&&!item.deleted);hqAssert(file,404,'FILE_NOT_FOUND');
      hqAssert(c.body.contentType===file.contentType,400,'FILE_TYPE_IMMUTABLE');const bytes=decodeFile(file.name,file.contentType,c.body.base64);
      const fingerprint=createHash('sha256').update(bytes).update(changeNote).digest('hex');
      const updates=(file as Attachment & {updates?:{key:string;fingerprint:string}[]}).updates??[];
      const prior=updates.find(item=>item.key===key);if(prior){hqAssert(prior.fingerprint===fingerprint,409,'IDEMPOTENCY_CONFLICT');return metadata(file);}
      hqAssert(c.body.expectedVersion===file.version,409,'VERSION_CONFLICT');
      file.base64=bytes.toString('base64');file.size=bytes.length;file.version++;
      Object.assign(file,{updated_at:d.clock,changeNote,updates:[...updates,{key,fingerprint}]});
      log(c,d,row,'ACC.fileVersion',file);return metadata(file);
    },true);
  });
  app.route('DELETE','/api/accounts/:publicId/files/:fileId',c=>{
    hqOnlyKeys(c.body,['expectedVersion','idempotencyKey']);
    return c.repository.transact(d=>{
      const row=requireAccountRelatedAccess(c,d,true),file=files(row).find(item=>item.public_id===c.params.fileId&&!item.deleted);hqAssert(file,404,'FILE_NOT_FOUND');
      hqAssert(c.body.expectedVersion===file.version,409,'VERSION_CONFLICT');file.deleted=true;file.version++;file.base64='';log(c,d,row,'ACC.fileDelete',file);return {deleted:true};
    },true);
  });
  app.route('PATCH','/api/accounts/:publicId/files/:fileId',c=>{
    hqOnlyKeys(c.body,['name','note','expectedVersion','idempotencyKey']);
    const name=hqText(c.body.name,'name',160);hqAssert(!/[\\/\x00-\x1f\x7f"]/.test(name),400,'FILE_NAME_INVALID');
    return c.repository.transact(d=>{
      const row=requireAccountRelatedAccess(c,d,true),file=files(row).find(item=>item.public_id===c.params.fileId&&!item.deleted);hqAssert(file,404,'FILE_NOT_FOUND');
      hqAssert(c.body.expectedVersion===file.version,409,'VERSION_CONFLICT');
      hqAssert(name.split('.').pop()?.toLowerCase()===file.name.split('.').pop()?.toLowerCase(),400,'FILE_EXTENSION_IMMUTABLE');
      if(c.body.note!==undefined){hqAssert(typeof c.body.note==='string'&&c.body.note.length<=2000,400,'FILE_NOTE_TOO_LONG');file.note=c.body.note.trim();}file.name=name;file.version++;Object.assign(file,{updated_at:d.clock});log(c,d,row,'ACC.fileRename',file);return metadata(file);
    },true);
  });
}
