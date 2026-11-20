import {z} from 'zod';
import {CompanyConfigurationService,type ConfigActor,type SqlReportSection} from './config-service';
import type {AuthenticatedRequest} from '../security/security';
import {haversineMeters} from '../modules/activity/activity.rules';
import {configAssert} from './config-store';
import type {FieldBinding} from './field-policy';
const binding=(fieldId:string,column:string):FieldBinding=>({fieldId,input:column,column,output:column});
export async function readActivityMap(service:CompanyConfigurationService,req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
 const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
 const q=z.object({date,latitude:z.coerce.number().finite().min(-90).max(90),longitude:z.coerce.number().finite().min(-180).max(180),radiusKm:z.coerce.number().finite().min(0.1).max(50).default(10)}).strict().parse(req.query);
 const params={userKey,date:q.date};
 const nearby=(kind:'lead'|'account'):SqlReportSection=>{
  const lead=kind==='lead',name=lead?'hospital_name':'account_name',sourceName=lead?'hospitalName':'crmName';
  return {visibilityId:'section:activity.map',bindings:['public_id','name','latitude','longitude','address','distance_m'].map((c,i)=>binding('activityMap.'+['publicId','name','latitude','longitude','address','distanceM'][i],c)),sourceFields:[kind+'.'+sourceName,kind+'.latitude',kind+'.longitude',kind+'.'+(lead?'address':'crmAddress')],
   load:async domain=>{
    // SQL owns both company and owner scope; identities are never emitted before field/source policy.
    const r=await domain.query<Record<string,unknown>>('SELECT CONVERT(varchar(36),public_id) public_id,'+name+' name,latitude,longitude,address FROM crm_'+kind+' WITH(HOLDLOCK) WHERE company_id=@companyKey AND owner_user_id=@userKey AND deleted_yn=0 AND latitude IS NOT NULL AND longitude IS NOT NULL'+(lead?'':" AND account_status<>'MERGED'"),{companyKey:domain.companyKey,userKey});
    return r.recordset.map(row=>{const lat=Number(row.latitude),lng=Number(row.longitude);configAssert(Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lng)&&Math.abs(lng)<=180,409,'INVALID_FIELD_VALUE');return {...row,distance_m:Math.round(haversineMeters(q.latitude,q.longitude,lat,lng))};}).filter(row=>row.distance_m<=q.radiusKm*1000).sort((a,b)=>a.distance_m-b.distance_m).slice(0,200);
   }};
 };
 return service.readSqlReport(actor,'HQ_ACTIVITY',{
  plans:{visibilityId:'section:activity.map',bindings:[binding('activityMap.publicId','public_id'),...['status','plannedAt','relatedName','targetLatitude','targetLongitude','visitPurpose','inAt','outAt'].map((id,i)=>binding('activity.'+id,['status','planned_at','related_name_snapshot','target_latitude','target_longitude','visit_purpose','in_at','out_at'][i]))],sourceFields:['activity.plannedAt'],load:async domain=>(await domain.query<Record<string,unknown>>("SELECT CONVERT(varchar(36),public_id) public_id,status,CONVERT(varchar(19),planned_at,126) planned_at,related_name_snapshot,target_latitude,target_longitude,visit_purpose,CONVERT(varchar(19),in_at,126)+'Z' in_at,CONVERT(varchar(19),out_at,126)+'Z' out_at FROM crm_activity WITH(HOLDLOCK) WHERE company_id=@companyKey AND owner_user_id=@userKey AND planned_date=@date ORDER BY planned_at,activity_id",{companyKey:domain.companyKey,...params})).recordset},
  leads:nearby('lead'),accounts:nearby('account')
 },['activity.latitude','activity.longitude'],['activity.mapDate','activityMap.radiusKm'],['ACT.map']);
}
