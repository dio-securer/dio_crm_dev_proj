import fs from 'node:fs';import path from 'node:path';
import {ConfiguredRuntimeContextGateway} from './runtime-context-gateway';import {CompanyConfigurationService} from './config-service';import {emptyConfigState} from './config-store';import {resolveCompanyConfig} from '@dio-crm/contracts/crm-customization';
const artifact=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../packages/contracts/catalogs/hq-approval-route-review.json'),'utf8')),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',companyId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',actor={id,companyId};
describe('configured application bootstrap',()=>{
 function fixture(){
  const permissions=[...new Set(['runtime.read',...artifact.catalog.entries.flatMap((e:any)=>[...e.permissions,...e.readPermissions,...e.writePermissions])])];const state:any=emptyConfigState(companyId,{[id]:{active:true,permissions:permissions as string[],denied:[]}}),config={companyId,baseStandardReleaseId:artifact.catalog.standardReleaseId,patches:[],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR'};state.activeReleaseId=id;state.releases[id]={id,config,effective:resolveCompanyConfig(artifact.catalog,config as any)};const queries:string[]=[],f={active:true,country:'KR',preferred:'en-US'};
  const repo={transact:async(_c:any,_a:any,work:any)=>work({state,identityActive:true,domain:{companyKey:9,query:async(sql:string,p:any)=>{
   queries.push(sql);if(sql.startsWith('SELECT user_name')){expect(p).toMatchObject({companyKey:9,userKey:7,publicId:id});return {recordset:f.active?[{user_name:'Current name'}]:[]};}
   expect(p).toMatchObject({companyId:9,userId:7});return {recordset:[{country_code:f.country,default_locale:'ko-KR',default_currency:'KRW',default_timezone:'Asia/Seoul',market_profile_code:null,preferred_locale:f.preferred}]};
  }}})};
  const gateway=new ConfiguredRuntimeContextGateway(new CompanyConfigurationService(repo as any,[])),run=()=>gateway.handle({method:'GET',path:'/api/me/context',query:{},authUser:{companyId:999,name:'Old name'}} as any,actor,7);
  return {run,queries,state,f};
 }
 it('reads current identity and fenced company rather than JWT stale values',async()=>{const f=fixture(),r=await f.run();expect(r.data.user).toEqual({userId:7,publicId:id,name:'Current name',companyId:9});expect(r.data.globalization.locale).toBe('en-US');expect(r.data.globalization.features.GPS_CHECKIN).toBe(true);});
 it('language preference outside active locales falls back to tenant default',async()=>{const f=fixture();f.f.preferred='fr-FR';const r=await f.run();expect(r.data.globalization.locale).toBe('ko-KR');});
 it('disabled company action disables market feature in bootstrap',async()=>{const f=fixture();f.state.releases[id].effective.entries.find((e:any)=>e.id==='ACT.checkIn').settings.enabled=false;expect((await f.run()).data.globalization.features.GPS_CHECKIN).toBe(false);});
 it('inactive identity cannot bootstrap',async()=>{const f=fixture();f.f.active=false;await expect(f.run()).rejects.toMatchObject({code:'IDENTITY_DISABLED'});});
 it('revoked runtime permission denies before domain query',async()=>{const f=fixture();f.state.members[id].denied=['runtime.read'];await expect(f.run()).rejects.toMatchObject({code:'PERMISSION_DENIED'});expect(f.queries).toHaveLength(0);});
 it('unsupported country never receives HQ context',async()=>{const f=fixture();f.f.country='XX';await expect(f.run()).rejects.toThrow('COUNTRY_PROFILE_NOT_ACTIVE');});
});
