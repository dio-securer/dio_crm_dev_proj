import {effectiveFields,fieldDefinitions,runtimeFieldAccess,rolesFor,validateAccountConfig} from '@dio-crm/contracts/admin';
import {Config} from './model';
export function previewFields(config:Config,companyId:string,role:string,samples:Config,customRoles:any[]=[]):any[]{
 validateAccountConfig(config);
 const membership={role,roleCodes:[role],companyId},roles=rolesFor({query:()=>customRoles} as any,membership as any),defs=fieldDefinitions(config),values:Config={...Object.fromEntries(config['FIELD:account'].fields.map((f:any)=>[f.key,f.default])),...samples,'actor.roleCodes':[role],'context.companyId':companyId,'document.state':'DRAFT'};
 return effectiveFields(config,values).flatMap((f:any)=>{const access=runtimeFieldAccess(roles,f.key,companyId),def=defs[f.key];if(!f.visible||!access.read||def.active===false)return [];return [{...f,type:def.type,enumValues:def.enumValues,readOnly:!!f.readOnly||!access.write,mask:access.mask,value:access.mask==='LAST4'?'••••':values[f.key]??''}];});
}
