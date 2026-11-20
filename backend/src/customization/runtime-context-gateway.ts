import {Injectable} from '@nestjs/common';import {resolveLocale} from '@dio-crm/contracts/crm-customization';import type {MarketFeatureKey} from '@dio-crm/contracts';
import {CompanyConfigurationService,type ConfigActor} from './config-service';import {configAssert} from './config-store';
import {GlobalizationService} from '../globalization/globalization.service';import type {DatabaseService} from '../database/database.service';import type {AuthenticatedRequest} from '../security/security';
@Injectable()
export class ConfiguredRuntimeContextGateway{
 constructor(private readonly service:CompanyConfigurationService){}
 async handle(req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
  configAssert(req.method==='GET'&&req.path.replace(/\/$/,'')==='/api/me/context',404,'NOT_FOUND');configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
  return this.service.readRuntimeContext(actor,async(domain,config,policy)=>{
   const user=await domain.query<{user_name:string}>('SELECT user_name FROM crm_user WITH(HOLDLOCK) WHERE company_id=@companyKey AND user_id=@userKey AND public_id=@publicId AND is_active=1 AND deleted_yn=0',{companyKey:domain.companyKey,userKey,publicId:actor.id});configAssert(user.recordset.length===1,401,'IDENTITY_DISABLED');
   // Reuse the established profile resolver through this transaction's query, never a second connection.
   const resolver=new GlobalizationService({query:domain.query} as unknown as DatabaseService),globalization=await resolver.resolveCompany(domain.companyKey,userKey);
   globalization.locale=resolveLocale(globalization.locale,config.activeLocales,config.defaultLocale).locale;
   const enabled=new Set(policy.filter(p=>p.enabled&&p.readable).map(p=>p.id));
   const features:Record<MarketFeatureKey,string[]>={GPS_CHECKIN:['ACT.checkIn'],DIRECT_WORK:['HQ_DIRECT_WORK'],ACTIVITY_APPROVAL:['HQ_ACTIVITY_REPORT'],ERP_ACCOUNT_APPROVAL:['ACC.erpRequest'],HIRA_IMPORT:['section:lead.hira'],MONTHLY_STATEMENT:['section:statement.output']};
   for(const [feature,ids] of Object.entries(features) as Array<[MarketFeatureKey,string[]]>)globalization.features[feature]=globalization.features[feature]&&ids.every(id=>enabled.has(id));
   return {user:{userId:userKey,publicId:actor.id,name:user.recordset[0].user_name,companyId:domain.companyKey},globalization};
  });
 }
}
