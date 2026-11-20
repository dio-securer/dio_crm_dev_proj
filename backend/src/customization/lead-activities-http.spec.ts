import fs from 'node:fs';
import path from 'node:path';
import {Test} from '@nestjs/testing';
import {ExpressAdapter} from '@nestjs/platform-express';
import {JwtService} from '@nestjs/jwt';
import {env} from '../config/env';
import {AuthGuard} from '../security/security';
import {DatabaseService} from '../database/database.service';
import {ConfigurationIdentity} from './config-http';
import {CompanyConfigurationService} from './config-service';
import {emptyConfigState} from './config-store';
import {ConfigurationLeadActivitiesController} from './lead-activities';
import {resolveCompanyConfig} from '@dio-crm/contracts/crm-customization';

const company='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',user='11111111-1111-4111-8111-111111111111',release='33333333-3333-4333-8333-333333333333',lead='55555555-5555-4555-8555-555555555555';
it('authenticated activity HTTP binds JWT identity and rejects user override',async()=>{
 const artifact=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../packages/contracts/catalogs/hq-codes-review.json'),'utf8'));
 const permissions=[...new Set(['runtime.read','LEAD.READ',...artifact.catalog.entries.flatMap((e:any)=>[...e.permissions,...e.readPermissions,...e.writePermissions])])].filter(x=>x!=='LEAD.MANAGE');
 const state:any=emptyConfigState(company,{[user]:{active:true,permissions,denied:[]}});state.activeReleaseId=release;const config={companyId:company,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[],activeLocales:['ko-KR'],defaultLocale:'ko-KR',translations:{}};state.releases[release]={id:release,companyId:company,config,effective:resolveCompanyConfig(artifact.catalog,config)};
 const calls:any[]=[],domain={companyKey:9,query:async(sql:string,p:any)=>{calls.push({sql,p});if(sql.includes('FROM crm_lead'))return {recordset:[{lead_id:3,company_id:9,owner_user_id:7}]};if(sql.includes('FROM crm_activity'))return {recordset:[{public_id:lead,subject:'Mine',planned_at:'2026-10-30T09:00:00',status:'PLANNED'}]};throw Error(sql);}};
 const service=new CompanyConfigurationService({transact:async(_c:any,_a:any,work:any)=>work({state,identityActive:true,domain})} as any,[]),jwt=new JwtService(),db={query:async(_sql:string,p:any)=>({recordset:p.userId===7&&p.publicId===user?[{public_id:user,company_public_id:company}]:[]})};
 const module=await Test.createTestingModule({controllers:[ConfigurationLeadActivitiesController],providers:[AuthGuard,{provide:JwtService,useValue:jwt},{provide:DatabaseService,useValue:db},ConfigurationIdentity,{provide:CompanyConfigurationService,useValue:service}]}).compile();const app=module.createNestApplication(new ExpressAdapter());await app.listen(0,'127.0.0.1');
 try{const url=await app.getUrl()+'/api/leads/'+lead+'/activities?from=2026-10-01&to=2026-10-30',token=(sub:number)=>jwt.sign({sub,publicId:user},{secret:env.JWT_ACCESS_SECRET});expect((await fetch(url)).status).toBe(401);expect((await fetch(url,{headers:{authorization:'Bearer '+token(8)}})).status).toBe(401);expect((await fetch(url,{headers:{authorization:'Bearer '+token(7)}})).status).toBe(200);expect(calls.at(-1).p).toMatchObject({companyKey:9,leadId:3,userKey:7});const activityReads=calls.filter(c=>c.sql.includes('FROM crm_activity')).length;state.members[user].denied.push('ACTIVITY.READ');expect((await fetch(url,{headers:{authorization:'Bearer '+token(7)}})).status).toBe(403);expect(calls.filter(c=>c.sql.includes('FROM crm_activity'))).toHaveLength(activityReads);expect((await fetch(url+'&ownerUserId=8',{headers:{authorization:'Bearer '+token(7)}})).status).toBeGreaterThanOrEqual(400);}finally{await app.close();}
});
