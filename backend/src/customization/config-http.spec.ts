import 'reflect-metadata';
import {Test} from '@nestjs/testing';
import {ExpressAdapter} from '@nestjs/platform-express';
import {JwtService} from '@nestjs/jwt';
import type {INestApplication} from '@nestjs/common';
import {AuthGuard} from '../security/security';
import {ConfigurationController,ConfigurationRuntimeController,ConfigurationIdentity,StandardPublicationController} from './config-http';
import {StandardPublicationService,MemoryStandardRepository} from './standard-service';
import {CompanyConfigurationService,makeStandardArtifact} from './config-service';
import {MemoryAdminConfigRepository,emptyConfigState} from './config-store';
import type {ConfigCatalog} from '@dio-crm/contracts/crm-customization';
const company='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',user='abcdefab-abcd-4abc-8abc-abcdefabcdef';
const catalog:ConfigCatalog={schemaVersion:1,standardReleaseId:'standard.1',entries:[{id:'screen',kind:'SCREEN',labelKey:'screen',support:'supported',settings:{enabled:true,visible:true,readOnly:false,required:false,order:0},capabilities:['enabled'],locks:[],dependencies:[],permissions:[],readPermissions:[],writePermissions:[],requiredTranslation:true}]};
describe('Configuration HTTP with signed identity and current store permissions',()=>{
 // Jest's host structuredClone creates objects outside its VM realm. These HTTP fixtures
 // are JSON-only; clone inside this realm. Native clone/non-JSON checks run in the Node suite.
 const nativeClone=global.structuredClone;
 beforeAll(()=>{global.structuredClone=(value:any)=>JSON.parse(JSON.stringify(value));});
 afterAll(()=>{global.structuredClone=nativeClone;});
 let app:INestApplication,url:string,token:string,repo:MemoryAdminConfigRepository,standards:MemoryStandardRepository;
 const permissions=['config.read','config.edit','config.preview','config.publish','config.restore','runtime.read'];
 beforeEach(async()=>{
  repo=new MemoryAdminConfigRepository([emptyConfigState(company,{[user]:{active:true,permissions,denied:[]}})]);
  const service=new CompanyConfigurationService(repo,[makeStandardArtifact('artifact',catalog,{'ko-KR':{screen:'화면'},'en-US':{screen:'Screen'}},true)]);
  standards=new MemoryStandardRepository();standards.permissions.set(user,{active:true,publish:true,read:true});const publication=new StandardPublicationService(standards,[makeStandardArtifact('artifact',catalog,{'ko-KR':{screen:'화면'},'en-US':{screen:'Screen'}},true)]);
  const jwt=new JwtService({secret:'isolated-test-secret-never-production'});token=await jwt.signAsync({sub:1,publicId:user,companyId:1},{expiresIn:60});
  const module=await Test.createTestingModule({controllers:[ConfigurationController,ConfigurationRuntimeController,StandardPublicationController],providers:[AuthGuard,{provide:StandardPublicationService,useValue:publication},{provide:JwtService,useValue:{verifyAsync:(value:string)=>jwt.verifyAsync(value)}},{provide:CompanyConfigurationService,useValue:service},{provide:ConfigurationIdentity,useValue:{actor:async(req:any,id?:string)=>({id:req.authUser.publicId,companyId:id??company})}}]}).compile();
  app=module.createNestApplication(new ExpressAdapter());await app.listen(0,'127.0.0.1');url=await app.getUrl();
 });
 afterEach(async()=>{await app?.close();});
 const call=async(path:string,method='GET',body?:unknown,headers:Record<string,string>={})=>{const response=await fetch(url+path,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json() as any};};
 const create=()=>call('/api/admin/config/drafts','POST',{companyId:company,baseStandardReleaseId:'standard.1',expectedActiveReleaseId:null},{'idempotency-key':'create'});
 it('advertises account support but rejects presentation absent from selected standard and malformed metadata',async()=>{
  expect((await call('/api/admin/config/drafts?scope=COMPANY&scopeKey='+company)).body.capabilities.accountPlacementPresentation).toBe(true);
  const d=(await create()).body,body={companyId:company,patches:[],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{}};
  for(const [i,metadata]of [{label:'Account'},{label:3},{helpText:'<script>'},{width:100}].entries())expect((await call('/api/admin/config/drafts/'+d.id,'PATCH',{...body,placementPresentation:{schemaVersion:1,values:{'account.create.basic.crmName':{'ko-KR':metadata}}}},{'idempotency-key':'account-'+i,'if-match':'"1"'})).status).toBe(422);
 });
 it('rejects missing/forged identity and cross-company access',async()=>{
  expect((await call('/api/admin/config/drafts?scope=COMPANY&scopeKey='+company,'GET',undefined,{authorization:''})).status).toBe(401);
  expect((await call('/api/admin/config/drafts?scope=COMPANY&scopeKey='+company,'GET',undefined,{authorization:'Bearer forged'})).status).toBe(401);
  expect((await call('/api/admin/config/drafts?scope=COMPANY&scopeKey='+other)).status).toBe(404);
 });
 it('requires idempotency and revision, rejects unsupported options before mutation',async()=>{
  expect((await call('/api/admin/config/drafts','POST',{companyId:company,baseStandardReleaseId:'standard.1',expectedActiveReleaseId:null})).status).toBe(428);
  const d=(await create()).body;expect(d.revision).toBe(1);
  const body={companyId:company,patches:[],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{}};
  expect((await call('/api/admin/config/drafts/'+d.id,'PATCH',body,{'idempotency-key':'save'})).status).toBe(428);
  expect((await call('/api/admin/config/drafts/'+d.id,'PATCH',{...body,publishAt:'tomorrow'},{'idempotency-key':'save','if-match':'"1"'})).status).toBe(422);
  expect((await call('/api/admin/config/drafts/'+d.id,'PATCH',body,{'idempotency-key':'save','if-match':'"1"'})).body.revision).toBe(2);
 });
 it('rejects invalid grid DTO and unregistered grid screen before mutation',async()=>{
  const d=(await create()).body,body={companyId:company,patches:[],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{}};
  for(const leadGrid of [{schemaVersion:1,pageSize:30},{schemaVersion:2,pageSize:25},{schemaVersion:1,pageSize:25,sort:'name'},{schemaVersion:1,pageSize:25}])expect((await call('/api/admin/config/drafts/'+d.id,'PATCH',{...body,leadGrid},{'idempotency-key':'grid','if-match':'"1"'})).status).toBe(422);
  expect(repo.snapshot(company).drafts[d.id].revision).toBe(1);
  const reset=await call('/api/admin/config/drafts/'+d.id,'PATCH',{...body,leadGrid:null},{'idempotency-key':'grid-reset','if-match':'"1"'});expect(reset.status).toBe(200);expect(Object.hasOwn(reset.body.config,'leadGrid')).toBe(false);
 });
 it('strict column width commands reject arbitrary CSS and unknown targets, allow explicit reset',async()=>{
  const d=(await create()).body,body={companyId:company,patches:[],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{}};
  for(const value of [{mode:'min',widthPx:79},{mode:'min',widthPx:'120'},{mode:'fixed',widthPx:120},{mode:'auto',style:'color:red'},{mode:'min',widthPx:120}])expect((await call('/api/admin/config/drafts/'+d.id,'PATCH',{...body,leadColumnWidths:{schemaVersion:1,values:{'lead.unknown':value}}},{'idempotency-key':'width','if-match':'"1"'})).status).toBe(422);
  expect((await call('/api/admin/config/drafts/'+d.id,'PATCH',{...body,leadColumnWidths:null},{'idempotency-key':'reset-width','if-match':'"1"'})).status).toBe(200);
 });
 it('column alignment DTO rejects arbitrary CSS and accepts inheritance reset',async()=>{
  const d=(await create()).body,body={companyId:company,patches:[],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{}};
  for(const value of ['left','center;display:none',{},'end'])expect((await call('/api/admin/config/drafts/'+d.id,'PATCH',{...body,leadColumnAlignments:{schemaVersion:1,values:{'lead.unknown':value}}},{'idempotency-key':'align','if-match':'"1"'})).status).toBe(422);
  expect((await call('/api/admin/config/drafts/'+d.id,'PATCH',{...body,leadColumnAlignments:null},{'idempotency-key':'reset-align','if-match':'"1"'})).status).toBe(200);
 });
 it('popup appearance rejects arbitrary sizes markup unknown IDs and allows whole reset',async()=>{
  const d=(await create()).body,body={companyId:company,patches:[],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{}};
  for(const value of [{size:'900px'},{titles:{'ko-KR':'<script>'}},{size:'small'}])expect((await call('/api/admin/config/drafts/'+d.id,'PATCH',{...body,popupPresentation:{schemaVersion:1,values:{'POP.LEAD.CREATE':value}}},{'idempotency-key':'popup','if-match':'"1"'})).status).toBe(422);
  expect((await call('/api/admin/config/drafts/'+d.id,'PATCH',{...body,popupPresentation:null},{'idempotency-key':'popup-reset','if-match':'"1"'})).status).toBe(200);
 });
 it('button style accepts only reviewed emphasis and placement with explicit reset',async()=>{const d=(await create()).body,body={companyId:company,patches:[],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{}};for(const values of [{'lead.detail.save':'danger'},{'lead.detail.owner':'primary'},{'lead.detail.save':'primary'}])expect((await call('/api/admin/config/drafts/'+d.id,'PATCH',{...body,buttonPresentation:{schemaVersion:1,values}},{'idempotency-key':'button','if-match':'"1"'})).status).toBe(422);expect((await call('/api/admin/config/drafts/'+d.id,'PATCH',{...body,buttonPresentation:null},{'idempotency-key':'button-reset','if-match':'"1"'})).status).toBe(200);});
 it('validates previews publishes and prepares restore without moving active release',async()=>{
  const d=(await create()).body;
  const v=(await call('/api/admin/config/validate','POST',{companyId:company,draftIds:[d.id],revisions:[1]})).body;
  expect(v.errors).toEqual([]);
  expect((await call('/api/admin/config/preview','POST',{companyId:company,validationId:v.id})).body.sideEffects).toBe(false);
  const r=(await call(`/api/admin/companies/${company}/releases`,'POST',{validationId:v.id,expectedReleaseId:null,reason:'Test publish'},{'idempotency-key':'publish'})).body;
  expect((await call('/api/runtime/effective-config')).body.releaseId).toBe(r.id);
  const restore=await call(`/api/admin/companies/${company}/releases/${r.id}/rollback`,'POST',{targetReleaseId:r.id,expectedReleaseId:r.id,reason:'Test restore'},{'idempotency-key':'restore'});
  expect(restore.body.state).toBe('DRAFT');expect(repo.snapshot(company).activeReleaseId).toBe(r.id);
 });
 it('revoked identity is rejected even with an unexpired signed token',async()=>{await create();await repo.setIdentityActive(user,false);expect((await create()).status).toBe(401);});
 it('publishes allowlisted standard via HTTP without changing any company active pointer',async()=>{const body={artifactId:'artifact',expectedCatalogHead:null,reason:'Reviewed bundle'};expect((await call('/api/admin/standards/releases','POST',{...body,artifact:{uploaded:'forbidden'}},{'idempotency-key':'standard'})).status).toBe(422);const published=await call('/api/admin/standards/releases','POST',body,{'idempotency-key':'standard'});expect(published.status).toBe(201);expect(published.body.id).toBe('standard.1');expect(repo.snapshot(company).activeReleaseId).toBeNull();expect((await call('/api/admin/standards/releases')).body.catalogHead).toBe('standard.1');});
 it('standard publication replay rechecks current HQ grant',async()=>{const body={artifactId:'artifact',expectedCatalogHead:null,reason:'Reviewed bundle'};expect((await call('/api/admin/standards/releases','POST',body,{'idempotency-key':'standard'})).status).toBe(201);standards.permissions.set(user,{active:true,publish:false,read:true});expect((await call('/api/admin/standards/releases','POST',body,{'idempotency-key':'standard'})).status).toBe(403);});
 it('runtime returns resolved labels for permitted locale without admin override records',async()=>{const d=(await create()).body,v=(await call('/api/admin/config/validate','POST',{companyId:company,draftIds:[d.id],revisions:[1]})).body;await call(`/api/admin/companies/${company}/releases`,'POST',{validationId:v.id,expectedReleaseId:null,reason:'Test locale'},{'idempotency-key':'publish'});const response=await call('/api/runtime/effective-config?locale=en-US');expect(response.body.translations.screen).toBe('Screen');expect(response.body.config).toBeUndefined();expect(response.body.locale.locale).toBe('en-US');});
});
describe('Configuration identity DB boundary',()=>{
 it('uses current DB company instead of token company and ignores token permissions',async()=>{const query=jest.fn().mockResolvedValue({recordset:[{public_id:user,company_public_id:company}]});const identity=new ConfigurationIdentity({query} as any);const request={authUser:{sub:7,publicId:user,companyId:999,permissions:['*']}} as any;expect(await identity.actor(request)).toEqual({id:user,companyId:company});expect(query.mock.calls[0][1]).toEqual({userId:7,publicId:user});});
 it('denies missing/currently inactive DB identity',async()=>{const identity=new ConfigurationIdentity({query:jest.fn().mockResolvedValue({recordset:[]})} as any);await expect(identity.actor({authUser:{sub:7,publicId:user}} as any)).rejects.toMatchObject({code:'IDENTITY_DISABLED'});});
});
