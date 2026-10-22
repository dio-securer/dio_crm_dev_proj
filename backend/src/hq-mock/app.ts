import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { HqCapabilities, HqContext, HqStandard } from '@dio-crm/contracts';
import { createHqPolicy } from '@dio-crm/contracts';
import { HqRepository } from './repository.js';
import { HQ_COLLECTION_NAMES, HqMockError, hqAssert, auditHq, newHqId, cloneHq } from './model.js';
import type { HqActor, HqBusinessCollection, HqDataset, HqRow, HqInterfaceCode, HqInterfaceScenario, HqInterfaceResult } from './model.js';
import { HQ_INTERFACE_REGISTRY, enqueueInterface, advanceInterface, applyInterfaceResult, retryInterface } from './interfaces.js';

export type HqPersona = HqActor & { loginId: string; name: string; roles: string[] };
export type HqRequest = { method: string; path: string; token?: string; body?: unknown; headers?: Record<string, string | undefined> };
export type HqResponse = { status: number; body: unknown; headers?: Record<string, string> };
export type HqRouteContext = {
  app: HqApplication; actor: HqPersona; repository: HqRepository; datasetId: string;
  params: Record<string, string>; query: URLSearchParams; body: Record<string, unknown>;
  headers: Record<string, string | undefined>; scenario: HqInterfaceScenario;
};
export type HqHandler = (context: HqRouteContext) => unknown;
type Route = { method: string; pattern: string; regex: RegExp; names: string[]; score: number; handler: HqHandler };
type Session = { loginId: string; datasetId: string; expiresAt: number };
type Confirmation = { token: string; sessionToken: string; datasetId: string; generation: number; revision: number; expiresAt: number };
export interface HqApplicationOptions {
  standard: HqStandard; capabilities: HqCapabilities;
  repositoryFactory?: (datasetId: string) => HqRepository;
  datasetIds?: string[]; now?: () => number; storageLifetime?: 'PROCESS' | 'FILE';
  outboundAttemptCount?: () => number;
}

export const hqObject = (input: unknown): Record<string, unknown> => {
  hqAssert(input !== null && typeof input === 'object' && !Array.isArray(input), 400, 'ValidationError', 'JSON object is required');
  return input as Record<string, unknown>;
};
export function hqText(value: unknown, label: string, max = 300): string {
  hqAssert(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 400, 'ValidationError', `${label} is required (maximum ${max})`);
  return value.trim();
}
export function hqNumber(value: unknown, label: string, min = 0): number {
  hqAssert(typeof value === 'number' && Number.isFinite(value) && value >= min, 400, 'ValidationError', `${label} must be a finite number >= ${min}`);
  return value;
}
export function hqOnlyKeys(body: Record<string, unknown>, keys: readonly string[]) {
  const unexpected = Object.keys(body).filter(key => !keys.includes(key));
  hqAssert(!unexpected.length, 400, 'ValidationError', `Unsupported fields: ${unexpected.join(', ')}`);
}
export function hqRequire(actor: HqActor, permission: string) {
  hqAssert(actor.permissions.includes(permission), 403, 'PERMISSION_DENIED', `Permission required: ${permission}`);
}
export function hqCanRead(actor: HqActor, row: HqRow): boolean {
  if (row.company_id !== actor.companyId) return false;
  if (actor.scope === 'SELF' && row.owner_user_id !== undefined && row.owner_user_id !== actor.userId) return false;
  if (actor.scope === 'BRANCH' && Number(row.organization_id ?? (row.owner_user_id === 2 ? 20 : 10)) !== actor.organizationId) return false;
  return true;
}
export function hqFind(d: HqDataset, actor: HqActor, collection: HqBusinessCollection, id: string): HqRow {
  const row = d.collections[collection].find(item => item.public_id === id);
  hqAssert(row && hqCanRead(actor, row), 404, 'NOT_FOUND', `${collection} record was not found in your scope`);
  return row;
}
const scenarioMap: Record<string, HqInterfaceScenario> = {
  SUCCESS: 'SUCCESS', FAILURE: 'TRANSIENT_FAILURE', DELAY: 'DELAYED',
  BUSINESS_REJECTED: 'BUSINESS_REJECTED', TRANSIENT_FAILURE: 'TRANSIENT_FAILURE',
  TIMEOUT: 'TIMEOUT', DELAYED: 'DELAYED', DUPLICATE: 'DUPLICATE', OUT_OF_ORDER: 'OUT_OF_ORDER'
};
export function hqScenario(value: unknown): HqInterfaceScenario {
  const key = value === undefined ? 'SUCCESS' : String(value);
  hqAssert(Object.hasOwn(scenarioMap, key), 400, 'SCENARIO_INVALID');
  return scenarioMap[key];
}
const snake = (value: string) => value.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

export class HqApplication {
  readonly standard: HqStandard;
  readonly capabilities: HqCapabilities;
  readonly storageLifetime: 'PROCESS' | 'FILE';
  readonly personas: HqPersona[];
  readonly routes: Route[] = [];
  private readonly options: HqApplicationOptions;
  private readonly repositories = new Map<string, HqRepository>();
  private readonly sessions = new Map<string, Session>();
  private readonly confirmations = new Map<string, Confirmation>();
  private readonly policy: ReturnType<typeof createHqPolicy>;
  private readonly now: () => number;

  constructor(options: HqApplicationOptions) {
    this.options = options; this.now = options.now ?? Date.now;
    this.standard = cloneHq(options.standard); this.capabilities = cloneHq(options.capabilities);
    this.policy = createHqPolicy(this.standard, this.capabilities);
    this.storageLifetime = options.storageLifetime ?? 'PROCESS';
    const permissions = [...new Set([
      ...this.standard.actions.flatMap(x => x.permissions), ...this.standard.screens.flatMap(x => x.permissions),
      ...this.standard.fields.flatMap(x => [...x.readPermissions, ...x.writePermissions]),
      'HQ.RESET','INTERFACE.READ','INTERFACE.MANAGE','AUDIT.READ','USER.READ','ORG.READ','OPS.READ',
      'CONTACT.READ','CONTACT.WRITE','ADMIN.WRITE','STANDARD.PUBLISH','STANDARD.READ'
    ])];
    const readOnly = permissions.filter(x => x.endsWith('.READ') || x === 'ACTIVITY.REPORT');
    const sales = permissions.filter(x => !/APPROVE|MANAGE|RESET|ADMIN|PUBLISH|AUDIT|INTERFACE|USER\.|ORG\.|OPS\./.test(x));
    this.personas = [
      { userId:99, loginId:'hq-admin', name:'본사 관리자', companyId:1, organizationId:10, roles:['HQ_ADMIN'], scope:'SYSTEM', permissions },
      { userId:1, loginId:'hq-sales', name:'본사 영업담당', companyId:1, organizationId:10, roles:['HQ_SALES'], scope:'SELF', permissions:sales },
      { userId:3, loginId:'hq-branch', name:'지점장', companyId:1, organizationId:10, roles:['HQ_BRANCH'], scope:'BRANCH', permissions:permissions.filter(x => !/DIVISION|RESET|ADMIN|PUBLISH/.test(x)) },
      { userId:4, loginId:'hq-division', name:'본부장', companyId:1, organizationId:10, roles:['HQ_DIVISION'], scope:'DIVISION', permissions:permissions.filter(x => !/RESET|ADMIN|PUBLISH/.test(x)) },
      { userId:5, loginId:'hq-viewer', name:'조회 담당', companyId:1, organizationId:10, roles:['HQ_VIEWER'], scope:'ALL', permissions:readOnly }
    ];
    this.installFoundationRoutes();
  }

  repository(datasetId: string): HqRepository {
    hqAssert((this.options.datasetIds ?? ['HQ_DEMO', 'HQ_OTHER']).includes(datasetId), 404, 'DATASET_NOT_REGISTERED');
    let repository = this.repositories.get(datasetId);
    if (!repository) { repository = this.options.repositoryFactory?.(datasetId) ?? new HqRepository({ datasetId }); this.repositories.set(datasetId, repository); }
    return repository;
  }
  route(method: string, pattern: string, handler: HqHandler): void {
    hqAssert(!this.routes.some(x => x.method === method && x.pattern === pattern), 500, 'DUPLICATE_ROUTE', pattern);
    const names: string[] = []; let score = 0;
    const regex = new RegExp('^' + pattern.split('/').map(part => {
      if (part.startsWith(':')) { names.push(part.slice(1)); return '([^/]+)'; }
      score += part.length; return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('/') + '$');
    this.routes.push({ method, pattern, handler, names, score, regex });
    this.routes.sort((a,b) => b.score - a.score);
  }
  replaceRoute(method: string, pattern: string, handler: HqHandler): void {
    const existing = this.routes.find(x => x.method === method && x.pattern === pattern);
    hqAssert(existing, 500, 'ROUTE_NOT_REGISTERED'); existing.handler = handler;
  }
  values(row: Record<string, unknown>, input: Record<string, unknown> = {}): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const field of this.standard.fields) {
      const leaf = field.fieldKey.split('.').at(-1)!;
      const names = [field.fieldKey, field.current.apiField, field.current.dbField, leaf, snake(leaf)].filter((x): x is string => !!x);
      const inputName = names.find(name => Object.hasOwn(input, name));
      const rowName = names.find(name => Object.hasOwn(row, name));
      if (inputName !== undefined) values[field.fieldKey] = input[inputName];
      else if (rowName !== undefined) values[field.fieldKey] = row[rowName];
      else if (field.defaultValue !== undefined) values[field.fieldKey] = field.defaultValue;
    }
    return values;
  }
  context(actor: HqActor, values: Record<string, unknown> = {}, device: 'desktop' | 'mobile' = 'desktop'): HqContext {
    return { activeProcesses:this.standard.processes.filter(x => x.enabled).map(x=>x.processKey), permissions:actor.permissions,
      features:this.capabilities.featureKeys, values, device };
  }
  requireAction(actor: HqActor, actionKey: string, row: Record<string, unknown> = {}, input: Record<string, unknown> = {}): void {
    const action = this.standard.actions.find(x => x.actionKey === actionKey);
    hqAssert(action?.enabled && action.support !== 'planned', 409, 'ACTION_NOT_REGISTERED', actionKey);
    action.permissions.forEach(p => hqRequire(actor,p));
    hqAssert(this.policy.actionAllowed(actionKey, this.context(actor,this.values(row,input))), 422, 'ACTION_NOT_ALLOWED', `${actionKey}: fields or current state do not allow this action`);
  }
  requireTransition(actor: HqActor, transitionKey: string, row: Record<string, unknown>, input: Record<string, unknown>): void {
    hqAssert(this.policy.transitionAllowed(transitionKey,this.context(actor,this.values(row,input))),409,'TRANSITION_NOT_ALLOWED',transitionKey);
  }
  meta(d: HqDataset) { return { mode:'MOCK', datasetId:d.datasetId, schemaVersion:d.schemaVersion, generation:d.generation, revision:d.revision, storageLifetime:this.storageLifetime }; }
  status(repository: HqRepository) {
    const d = repository.read();
    return { ...this.meta(d), dataset:this.meta(d), counts:Object.fromEntries(HQ_COLLECTION_NAMES.map(k => [k,d.collections[k].length])), outboundCalls:this.options.outboundAttemptCount?.() ?? 0, now:d.clock };
  }
  async handle(request: HqRequest): Promise<HqResponse> {
    try {
      hqAssert(request.path.startsWith('/api/') && !request.path.startsWith('//') && !request.path.includes('\\'),400,'PATH_INVALID');
      const url = new URL(request.path,'http://hq.invalid');
      const body = request.body === undefined ? {} : hqObject(request.body);
      if (request.method === 'GET' && url.pathname === '/api/hq/bootstrap') return { status:200, body:{ mode:'MOCK', mock:true, datasetId:'HQ_DEMO', personas:this.personas.map(x=>({loginId:x.loginId,name:x.name})), storageLifetime:this.storageLifetime } };
      if (request.method === 'POST' && url.pathname === '/api/hq/session') {
        hqOnlyKeys(body,['loginId','password','datasetId']);
        const password = Buffer.from(String(body.password ?? '')); const expected = Buffer.from('HQ-DEMO');
        hqAssert(password.length === expected.length && timingSafeEqual(password,expected),401,'INVALID_MOCK_CREDENTIALS');
        const persona = this.personas.find(x=>x.loginId === body.loginId);
        hqAssert(persona,401,'INVALID_MOCK_CREDENTIALS');
        const datasetId = hqText(body.datasetId ?? 'HQ_DEMO','datasetId',80); const repository = this.repository(datasetId);
        const token = `hq_${randomBytes(32).toString('hex')}`;
        this.sessions.set(token,{loginId:persona.loginId,datasetId,expiresAt:this.now()+8*60*60*1000});
        return {status:200,body:{mode:'MOCK',accessToken:token,user:cloneHq(persona),dataset:this.meta(repository.read())}};
      }
      const session = request.token ? this.sessions.get(request.token) : undefined;
      hqAssert(session && session.expiresAt > this.now(),401,'UNAUTHORIZED','A valid HQ MOCK session is required');
      const actor = this.personas.find(x=>x.loginId === session.loginId)!;
      const repository = this.repository(session.datasetId);
      const headers = request.headers ?? {};
      if (headers['x-hq-dataset']) hqAssert(headers['x-hq-dataset'] === session.datasetId,409,'DATASET_ID_MISMATCH');
      if (headers['x-hq-schema-version']) hqAssert(Number(headers['x-hq-schema-version']) === repository.read().schemaVersion,409,'DATASET_SCHEMA_UNSUPPORTED');
      if (request.method === 'GET' && url.pathname === '/api/hq/session') return {status:200,body:{mode:'MOCK',user:cloneHq(actor),dataset:this.meta(repository.read())}};
      if (request.method === 'POST' && url.pathname === '/api/hq/logout') { this.sessions.delete(request.token!); return {status:200,body:{success:true,mode:'MOCK'}}; }
      if (request.method === 'POST' && url.pathname === '/api/hq/reset/preview') {
        hqRequire(actor,'HQ.RESET'); hqOnlyKeys(body,[]);
        const d = repository.read(); const token = randomBytes(24).toString('hex');
        this.confirmations.set(token,{token,sessionToken:request.token!,datasetId:session.datasetId,generation:d.generation,revision:d.revision,expiresAt:this.now()+120000});
        return {status:200,body:{confirmationToken:token,datasetId:d.datasetId,generation:d.generation,revision:d.revision,counts:this.status(repository).counts,mode:'MOCK'}};
      }
      if (request.method === 'POST' && url.pathname === '/api/hq/reset') {
        hqRequire(actor,'HQ.RESET'); hqOnlyKeys(body,['confirmationToken']);
        const confirmation = this.confirmations.get(String(body.confirmationToken)); const d = repository.read();
        hqAssert(confirmation && confirmation.sessionToken === request.token && confirmation.datasetId === session.datasetId && confirmation.expiresAt > this.now(),409,'RESET_CONFIRMATION_INVALID');
        hqAssert(confirmation.generation === d.generation && confirmation.revision === d.revision,409,'RESET_PREVIEW_STALE');
        repository.reset(); this.confirmations.delete(confirmation.token);
        return {status:200,body:this.status(repository)};
      }
      const route = this.routes.find(x=>x.method === request.method && x.regex.test(url.pathname));
      hqAssert(route,404,'API_NOT_REGISTERED','This endpoint has no HQ mock handler');
      const match = route.regex.exec(url.pathname)!;
      const params = Object.fromEntries(route.names.map((name,i)=>[name,decodeURIComponent(match[i+1])]));
      const result = await route.handler({app:this,actor,repository,datasetId:session.datasetId,params,query:url.searchParams,body,headers,scenario:hqScenario(headers['x-hq-scenario'])});
      return {status:200,body:result};
    } catch (error) {
      if (error instanceof HqMockError) return {status:error.statusCode,body:{statusCode:error.statusCode,error:error.code,message:error.message,details:error.details ?? {},mode:'MOCK'}};
      return {status:500,body:{statusCode:500,error:'HQ_INTERNAL_ERROR',message:error instanceof Error ? error.message : 'HQ mock error',mode:'MOCK'}};
    }
  }
  flushReady(datasetId: string): void {
    const repository = this.repository(datasetId); const admin = this.personas[0];
    const jobs = repository.read().collections.interfaceLogs.filter(log=>log.status === 'REQUESTING' && log.scenario !== 'DELAYED');
    for (const log of jobs) repository.transact(d=>advanceInterface(d,{...admin,companyId:log.company_id},log.requestId,log.scenario));
  }
  /** The generic monitor is another entry point to the same business rules, not an approval shortcut. */
  guardInterface(c:HqRouteContext,d:HqDataset,code:string,entityId:string,replay=false) {
    const config=HQ_INTERFACE_REGISTRY[code as HqInterfaceCode];
    hqAssert(config,400,'INTERFACE_NOT_REGISTERED');
    if(!config.collection) {hqAssert(['SYSTEM','ALL'].includes(c.actor.scope),403,'INTERFACE_SCOPE_DENIED');return;}
    const row=hqFind(d,c.actor,config.collection,entityId);
    if(config.direction!=='OUT' || replay)return;
    if(code==='IF-ERP-002')this.requireAction(c.actor,'ACC.erpRequest',row);
    if(code==='IF-ERP-004' || code==='IF-ERP-007') {
      const contract=code==='IF-ERP-004' ? row:hqFind(d,c.actor,'contracts',String(row.contract_public_id));
      const account=hqFind(d,c.actor,'accounts',String(contract.account_public_id));
      this.requireAction(c.actor,code==='IF-ERP-004'?'CON.erpRequest':'ORD.submit',{
        ...row,'contract.status':contract.status,'account.erpApprovedYn':account.erp_approved_yn,'order.status':row.status
      });
    }
    if(code==='IF-ERP-011') {
      const plans=d.collections.plans.filter(p=>p.company_id===c.actor.companyId && p.contract_public_id===row.public_id && p.is_current===true);
      hqAssert(plans.length>0,422,'ERP_PLAN_REQUIRED');
      for(const plan of plans)this.requireAction(c.actor,'COL.planChange',{...row,...plan,'contract.status':row.status});
    }
    if(code==='IF-ERP-012')hqRequire(c.actor,'DIRECT_WORK.APPROVE.DIVISION');
  }
  guardInterfaceLog(c:HqRouteContext,d:HqDataset,requestId:string,retry=false,idempotencyKey?:string) {
    const log=d.collections.interfaceLogs.find(x=>x.requestId===requestId && x.company_id===c.actor.companyId);
    hqAssert(log,404,'INTERFACE_REQUEST_NOT_FOUND');
    const replay=retry && d.collections.interfaceLogs.some(x=>x.retryOf===requestId && x.idempotencyKey===idempotencyKey && x.company_id===c.actor.companyId);
    this.guardInterface(c,d,log.interfaceCode,log.businessKey.entityId,!retry||replay);
    return log;
  }
  private installFoundationRoutes() {
    this.route('GET','/api/hq/status',c=>this.status(c.repository));
    this.route('GET','/api/hq/snapshot',c=>{hqRequire(c.actor,'HQ.RESET');return c.repository.read();});
    this.route('GET','/api/hq/policy',c=>({standard:this.standard,capabilities:this.capabilities,context:this.context(c.actor)}));
    this.route('POST','/api/hq/actions/validate',c=>{
      const key = hqText(c.body.actionKey,'actionKey'); const values = hqObject(c.body.values ?? {});
      hqAssert(this.standard.actions.some(x=>x.actionKey === key),409,'ACTION_NOT_REGISTERED');
      return {mode:'MOCK',allowed:this.policy.actionAllowed(key,this.context(c.actor,values))};
    });
    this.route('GET','/api/me/context',c=>({user:{userId:c.actor.userId,publicId:`00000000-0000-4000-8000-${String(c.actor.userId).padStart(12,'0')}`,name:c.actor.name,companyId:c.actor.companyId},globalization:{locale:'ko-KR',countryCode:'KR',currencyCode:'KRW',timezone:'Asia/Seoul',marketProfileCode:'KR_SALES',marketTemplateCode:'HQ_TEMPLATE',screenProfileCode:'HQ_SCREEN_PROFILE',fieldProfileCode:'HQ_FIELD_PROFILE',featureProfileCode:'HQ_FEATURE_PROFILE',workflowProfileCode:'KR_SALES_APPROVAL',integrationProfileCode:'HQ_INTEGRATION_PROFILE',mapProfileCode:'HQ_MOCK_MAP',features:Object.fromEntries(this.capabilities.featureKeys.map(k=>[k,true]))},mode:'MOCK'}));
    const lists: Array<[string,HqBusinessCollection,string,string?]> = [
      ['/api/leads','leads','LEAD.READ','LEAD.search'], ['/api/accounts','accounts','ACCOUNT.READ','ACC.search'],
      ['/api/contacts','contacts','CONTACT.READ'], ['/api/opportunities','opportunities','OPPORTUNITY.READ'],
      ['/api/contracts','contracts','CONTRACT.READ'], ['/api/orders','orders','ORDER.READ'],
      ['/api/product-packages','products','OPPORTUNITY.READ'], ['/api/order-products','products','PRODUCT_ORDER.READ'],
      ['/api/activity-reports','reports','ACTIVITY.REPORT'], ['/api/direct-work','directWorks','DIRECT_WORK.READ'],
      ['/api/sales','sales','SALES.READ']
    ];
    for (const [path,collection,permission,action] of lists) {
      this.route('GET',path,c=>{
        hqRequire(c.actor,permission); if(action) this.requireAction(c.actor,action,{},Object.fromEntries(c.query));
        const search = (c.query.get('search') ?? '').toLocaleLowerCase();
        return c.repository.read().collections[collection].filter(row=>hqCanRead(c.actor,row) && (!search || JSON.stringify(row).toLocaleLowerCase().includes(search)) && (!c.query.get('status') || row.status === c.query.get('status')));
      });
      this.route('GET',`${path}/:publicId`,c=>{hqRequire(c.actor,permission);return hqFind(c.repository.read(),c.actor,collection,c.params.publicId);});
    }
    const accountFields: Record<string,string> = {accountName:'account_name',accountStatus:'account_status',accountGrade:'account_grade',businessNo:'business_no',businessName:'business_name',ceoName:'ceo_name',phone:'phone',fax:'fax',homepage:'homepage',address:'address',addressLine1:'address_line1',addressLine2:'address_line2',hospitalAddress:'hospital_address',zipCode:'zip_code',taxEmail:'tax_email',providerNo:'provider_no',encryptedProviderNo:'encrypted_provider_no',openDate:'open_date',doctorLicenseNo:'doctor_license_no',accountType:'account_type',useYn:'use_yn',churnRiskYn:'churn_risk_yn',accountStatCode:'account_stat_code'};
    const saveAccount = (c:HqRouteContext, create:boolean) => c.repository.transact(d=>{
      hqRequire(c.actor,'ACCOUNT.WRITE'); hqOnlyKeys(c.body,[...Object.keys(accountFields),'expectedVersion']);
      const row:HqRow = create ? {public_id:newHqId(d),company_id:c.actor.companyId,owner_user_id:c.actor.userId,organization_id:c.actor.organizationId ?? 10,version:1,account_name:hqText(c.body.accountName,'accountName'),account_status:'NEW',erp_approved_yn:false,integration_status:'NOT_REQUESTED',erp_customer_code:null} : hqFind(d,c.actor,'accounts',c.params.publicId);
      if(c.body.expectedVersion !== undefined) hqAssert(c.body.expectedVersion === row.version,409,'VERSION_CONFLICT');
      if(c.body.accountName !== undefined) hqText(c.body.accountName,'accountName');
      this.requireAction(c.actor,create ? 'ACC.create' : 'ACC.save',row,c.body);
      for(const [key,value] of Object.entries(c.body)) if(accountFields[key]) row[accountFields[key]] = value;
      row.updated_at = d.clock; if(create)d.collections.accounts.push(row);else row.version++;
      auditHq(d,c.actor,create ? 'ACC.create':'ACC.save',row.public_id,{fields:Object.keys(c.body)});
      return {...row,publicId:row.public_id,mode:'MOCK'};
    });
    this.route('POST','/api/accounts',c=>saveAccount(c,true));
    this.route('PATCH','/api/accounts/:publicId',c=>saveAccount(c,false));
    this.route('GET','/api/users',c=>{hqRequire(c.actor,'USER.READ');return this.personas.map(x=>({user_id:x.userId,user_name:x.name,public_id:`00000000-0000-4000-8000-${String(x.userId).padStart(12,'0')}`,organization_id:x.organizationId}));});
    this.route('GET','/api/organizations',c=>{hqRequire(c.actor,'ORG.READ');return [{organization_id:10,organization_name:'본사 영업부',company_id:1},{organization_id:20,organization_name:'타 지점',company_id:1}];});
    this.route('GET','/api/common-codes/:groupCode',()=>[]);
    this.route('GET','/api/interface-logs',c=>{hqRequire(c.actor,'INTERFACE.READ');const d=c.repository.read();return d.collections.interfaceLogs.filter(x=>{
      if(x.company_id!==c.actor.companyId)return false;
      const collection=HQ_INTERFACE_REGISTRY[x.interfaceCode].collection;
      if(!collection)return ['SYSTEM','ALL'].includes(c.actor.scope);
      const target=d.collections[collection].find(row=>row.public_id===x.businessKey.entityId);
      return !!target && hqCanRead(c.actor,target);
    });});
    this.route('GET','/api/audit-logs',c=>{hqRequire(c.actor,'AUDIT.READ');return c.repository.read().collections.auditLogs.filter(x=>hqCanRead(c.actor,x));});
    this.route('GET','/api/ops/status',c=>{hqRequire(c.actor,'OPS.READ');return {...this.status(c.repository),status:'MOCK',database:{status:'NOT_CONNECTED',mock:true},interfaces:{outboundCalls:this.options.outboundAttemptCount?.() ?? 0}};});
    this.route('POST','/api/hq/interfaces/request',c=>{
      hqRequire(c.actor,'INTERFACE.MANAGE'); hqOnlyKeys(c.body,['interfaceCode','entityType','entityPublicId','idempotencyKey','payload','scenario']);
      return c.repository.transact(d=>{
        const code=hqText(c.body.interfaceCode,'interfaceCode'),id=hqText(c.body.entityPublicId,'entityPublicId'),key=hqText(c.body.idempotencyKey,'idempotencyKey');
        const replay=d.collections.interfaceLogs.some(x=>x.interfaceCode===code && x.idempotencyKey===key && x.company_id===c.actor.companyId);
        this.guardInterface(c,d,code,id,replay);
        return enqueueInterface(d,c.actor,{interfaceCode:code as HqInterfaceCode,entityType:hqText(c.body.entityType,'entityType'),entityPublicId:id,idempotencyKey:key,payload:hqObject(c.body.payload ?? {}),scenario:hqScenario(c.body.scenario ?? c.scenario)});
      });
    });
    this.route('POST','/api/hq/interfaces/result',c=>{hqRequire(c.actor,'INTERFACE.MANAGE');return c.repository.transact(d=>{hqAssert(c.body.datasetId===d.datasetId,409,'INTERFACE_DATASET_MISMATCH');hqAssert(c.body.generation===d.generation,409,'INTERFACE_GENERATION_MISMATCH');this.guardInterfaceLog(c,d,hqText(c.body.requestId,'requestId'));return applyInterfaceResult(d,c.actor,c.body as unknown as HqInterfaceResult);});});
    this.route('POST','/api/hq/interfaces/advance',c=>{hqRequire(c.actor,'INTERFACE.MANAGE');hqOnlyKeys(c.body,['requestId','scenario']);return c.repository.transact(d=>{this.guardInterfaceLog(c,d,hqText(c.body.requestId,'requestId'));return advanceInterface(d,c.actor,String(c.body.requestId),hqScenario(c.body.scenario ?? 'SUCCESS'));});});
    this.route('POST','/api/hq/interfaces/retry',c=>{hqRequire(c.actor,'INTERFACE.MANAGE');hqOnlyKeys(c.body,['requestId','idempotencyKey','scenario']);return c.repository.transact(d=>{const id=hqText(c.body.requestId,'requestId'),key=hqText(c.body.idempotencyKey,'idempotencyKey');this.guardInterfaceLog(c,d,id,true,key);return retryInterface(d,c.actor,id,key,hqScenario(c.body.scenario ?? c.scenario));});});
    this.route('POST','/api/erp-accounts/:publicId/request',c=>c.repository.transact(d=>{
      const row = hqFind(d,c.actor,'accounts',c.params.publicId); this.requireAction(c.actor,'ACC.erpRequest',row);
      const log = enqueueInterface(d,c.actor,{interfaceCode:'IF-ERP-002',entityType:'ACCOUNT',entityPublicId:row.public_id,idempotencyKey:String(c.body.requestId ?? `account:${row.public_id}:${row.version}`),payload:{accountPublicId:row.public_id,accountName:row.account_name,businessNo:row.business_no},scenario:c.scenario});
      return {requestId:log.requestId,status:log.status,mode:'MOCK'};
    }));
  }
}
