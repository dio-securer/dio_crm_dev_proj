import {createHqCommonPolicy} from '@dio-crm/contracts/hq-common-policy';
import type {ConfigResult} from '@dio-crm/contracts/crm-customization';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { HqCapabilities, HqContext, HqStandard } from '@dio-crm/contracts';
import { applyHqOverride, createHqPolicy, validateHqStandard } from '@dio-crm/contracts';
import { HqRepository } from './repository.js';
import { HQ_COLLECTION_NAMES, HqMockError, hqAssert, auditHq, newHqId, cloneHq } from './model.js';
import type { HqActor, HqBusinessCollection, HqDataset, HqRow, HqInterfaceCode, HqInterfaceScenario, HqInterfaceResult } from './model.js';
import { HQ_INTERFACE_REGISTRY, enqueueInterface, advanceInterface, applyInterfaceResult, retryInterface } from './interfaces.js';

export type HqPersona = HqActor & { loginId: string; name: string; roles: string[]; active?: boolean };
export type HqRequest = { method: string; path: string; token?: string; body?: unknown; headers?: Record<string, string | undefined> };
export type HqResponse = { status: number; body: unknown; headers?: Record<string, string> };
export type HqBinaryResult = { __hqBinary: true; bytes: Uint8Array; contentType: string; filename: string };
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
  if (actor.permissions.includes('ACCOUNT.READ') && Array.isArray(row.mock_shares) && row.mock_shares.some((share:Record<string,unknown>)=>share.userId===actor.userId&&share.deleted!==true&&['READ','EDIT'].includes(String(share.access)))) return true;
  if (actor.scope === 'SELF' && row.owner_user_id !== undefined && row.owner_user_id !== actor.userId) return false;
  if (actor.scope === 'BRANCH' && Number(row.organization_id ?? (row.owner_user_id === 2 ? 20 : 10)) !== actor.organizationId) return false;
  return true;
}
export function hqActivityTargetReadable(c: HqRouteContext, d: HqDataset, activity: HqRow): boolean {
  const type = String(activity.related_type);
  const collection = ({ LEAD: 'leads', ACCOUNT: 'accounts', OPPORTUNITY: 'opportunities' } as const)[type as 'LEAD' | 'ACCOUNT' | 'OPPORTUNITY'];
  const screen = ({ LEAD: 'HQ_LEAD', ACCOUNT: 'HQ_ACCOUNT', OPPORTUNITY: 'HQ_OPPORTUNITY' } as const)[type as 'LEAD' | 'ACCOUNT' | 'OPPORTUNITY'];
  if (!collection || !screen || !c.actor.permissions.includes(`${type}.READ`) || !c.app.screenAllowed(c.actor, screen)) return false;
  const target = d.collections[collection].find(row => row.public_id === activity.related_public_id);
  if (!target || !hqCanRead(c.actor, target)) return false;
  if (type !== 'OPPORTUNITY') return true;
  const account = d.collections.accounts.find(row => row.public_id === target.account_public_id);
  return c.actor.permissions.includes('ACCOUNT.READ') && c.app.screenAllowed(c.actor, 'HQ_ACCOUNT') && Boolean(account && hqCanRead(c.actor, account));
}
export function hqReportForRead(c: HqRouteContext, d: HqDataset, report: HqRow): HqRow {
  const mayReadItem = (item: Record<string,unknown>) => {
    const activity = d.collections.activities.find(row => row.public_id === item.activity_public_id);
    return Boolean(activity && hqActivityTargetReadable(c, d, activity) && hqActivityTargetReadable(c,d,{...activity,related_type:item.related_type,related_public_id:item.related_public_id}));
  };
  const items = (Array.isArray(report.items) ? report.items : []).filter(mayReadItem);
  const submission_snapshots = (Array.isArray(report.submission_snapshots) ? report.submission_snapshots : []).map(snapshot=>({...snapshot,items:(Array.isArray(snapshot.items)?snapshot.items:[]).filter(mayReadItem)}));
  const opportunityIds = new Set(items.filter(item=>item.related_type==='OPPORTUNITY').map(item=>String(item.related_public_id)));
  const followUps = c.actor.permissions.includes('OPPORTUNITY.READ') && c.app.screenAllowed(c.actor,'HQ_OPPORTUNITY') && c.actor.permissions.includes('ACCOUNT.READ') && c.app.screenAllowed(c.actor,'HQ_ACCOUNT')
    ? d.collections.followUps.filter(row=>opportunityIds.has(String(row.opportunity_public_id)) && hqCanRead(c.actor,row) && d.collections.opportunities.some(opp=>opp.public_id===row.opportunity_public_id && opp.account_public_id===row.account_public_id && hqCanRead(c.actor,opp)) && d.collections.accounts.some(account=>account.public_id===row.account_public_id && hqCanRead(c.actor,account))).map(row=>({public_id:row.public_id,opportunity_public_id:row.opportunity_public_id,title:row.title,due_date:row.due_date,status:row.status})) : [];
  const reporter = c.app.personas.find(user => user.userId === (report.reporter_user_id ?? report.owner_user_id));
  const organization = c.app.organizations.find(org => org.company_id === c.actor.companyId && org.organization_id === report.organization_id);
  return { ...report, items, submission_snapshots, followUps, reporter_name: reporter?.name ?? null,
    organization_name: organization?.organization_name ?? null,
    visit_account_count: new Set(items.filter(item=>item.item_type==='RESULT').map(item=>item.account_public_id_snapshot ?? (item.related_type==='ACCOUNT' ? item.related_public_id : item.related_type==='OPPORTUNITY' ? d.collections.opportunities.find(opp=>opp.public_id===item.related_public_id)?.account_public_id : null)).filter(Boolean)).size };
}
export function hqDirectWorkTargetReadable(c: HqRouteContext, d: HqDataset, directWork: HqRow): boolean {
  const activity = d.collections.activities.find(row => row.public_id === directWork.activity_public_id);
  return Boolean(activity && hqActivityTargetReadable(c, d, activity));
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
  standard: HqStandard;
  readonly capabilities: HqCapabilities;
  readonly storageLifetime: 'PROCESS' | 'FILE';
  readonly personas: HqPersona[];
  readonly routes: Route[] = [];
  private readonly options: HqApplicationOptions;
  private readonly repositories = new Map<string, HqRepository>();
  private readonly sessions = new Map<string, Session>();
  private readonly confirmations = new Map<string, Confirmation>();
  private policy: ReturnType<typeof createHqPolicy>;
  private readonly commonConfigurations=new Map<number,{companyId:string;effective:ConfigResult}>();
  /** Trusted migration host only; no browser endpoint installs policy snapshots. */
  installCommonConfiguration(companyKey:number,companyId:string,effective:ConfigResult):void {
    hqAssert(Number.isSafeInteger(companyKey)&&companyKey>0&&!!companyId&&effective.ok,422,'COMMON_CONFIGURATION_INVALID');
    this.commonConfigurations.set(companyKey,{companyId,effective:cloneHq(effective)});
  }
  draftStandard: HqStandard;
  readonly publishedHistory: HqStandard[] = [];
  readonly companySnapshots = new Map<number, { standard: HqStandard; policy: ReturnType<typeof createHqPolicy> }>();
  readonly organizations = [{organization_id:10,organization_name:'본사 영업부',company_id:1,active:true},
    {organization_id:20,organization_name:'지점',company_id:1,active:true}];
  readonly commonCodes = new Map<string, Array<{code:string;label:string;active:boolean}>>();
  private readonly now: () => number;

  constructor(options: HqApplicationOptions) {
    this.options = options; this.now = options.now ?? Date.now;
    this.standard = cloneHq(options.standard); this.capabilities = cloneHq(options.capabilities);
    this.policy = createHqPolicy(this.standard, this.capabilities);
    this.draftStandard = cloneHq(this.standard);
    this.storageLifetime = options.storageLifetime ?? 'PROCESS';
    const permissions = [...new Set([
      ...this.standard.actions.flatMap(x => x.permissions), ...this.standard.screens.flatMap(x => x.permissions),
      ...this.standard.fields.flatMap(x => [...x.readPermissions, ...x.writePermissions]),
      'HQ.RESET','INTERFACE.READ','INTERFACE.MANAGE','AUDIT.READ','USER.READ','ORG.READ','OPS.READ',
      'CONTACT.READ','CONTACT.WRITE','COLLECTION.READ','SALES.READ','ADMIN.WRITE','STANDARD.PUBLISH','STANDARD.READ'
    ])];
    const readOnly = permissions.filter(x => x.endsWith('.READ') || x === 'ACTIVITY.REPORT');
    const sales = permissions.filter(x => !/APPROVE|MANAGE|RESET|ADMIN|PUBLISH|AUDIT|INTERFACE|STATUS\.REVERSE|USER\.|ORG\.|OPS\./.test(x));
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
  standardFor(actor: HqActor): HqStandard { return this.companySnapshots.get(actor.companyId)?.standard ?? this.standard; }
  policyFor(actor: HqActor): ReturnType<typeof createHqPolicy> {
    const common=this.commonConfigurations.get(actor.companyId);
    if(common)return createHqCommonPolicy(this.standardFor(actor),this.capabilities,common.effective,common.companyId,{authenticated:true,companyId:common.companyId,allowed:actor.permissions,denied:[]});
    return this.companySnapshots.get(actor.companyId)?.policy ?? this.policy;
  }
  publishStandard(standard: HqStandard): void {
    const next = cloneHq(standard), policy = createHqPolicy(next, this.capabilities);
    this.publishedHistory.push(cloneHq(this.standard)); this.standard = next; this.policy = policy; this.draftStandard = cloneHq(next);
  }
  applyCompanySnapshot(companyId: number, standard: HqStandard): void {
    const next = cloneHq(standard); this.companySnapshots.set(companyId, { standard: next, policy: createHqPolicy(next, this.capabilities) });
  }
  values(row: Record<string, unknown>, input: Record<string, unknown> = {}, standard: HqStandard = this.standard): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const field of standard.fields) {
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
    return { activeProcesses:this.standardFor(actor).processes.filter(x => x.enabled).map(x=>x.processKey), permissions:actor.permissions,
      features:this.capabilities.featureKeys, values, device };
  }
  requireScreen(actor: HqActor, screenKey: string): void {
    hqAssert(this.screenAllowed(actor, screenKey), 403, 'SCREEN_ACCESS_DENIED', screenKey);
  }
  screenAllowed(actor: HqActor, screenKey: string): boolean {
    const standard = this.standardFor(actor), policy = this.policyFor(actor);
    const screen = standard.screens.find(x => x.screenKey === screenKey);
    const menu=standard.menus.find(x=>x.screenKey===screenKey);
    const menuEnabled=(key:string,seen=new Set<string>()):boolean=>{
      const item=standard.menus.find(x=>x.menuKey===key);
      if(!item||seen.has(key)||!item.enabled||!item.permissions.every(x=>actor.permissions.includes(x))||!item.features.every(x=>this.capabilities.featureKeys.includes(x)))return false;
      return !item.parentKey||menuEnabled(item.parentKey,new Set([...seen,key]));
    };
    return Boolean(screen?.enabled && screen.processKeys.some(key => standard.processes.find(p => p.processKey === key)?.enabled)
      && (!menu||menuEnabled(menu.menuKey))
      && screen.permissions.every(permission => actor.permissions.includes(permission))
      && screen.features.every(feature => this.capabilities.featureKeys.includes(feature))
      && policy.screenAllowed(screenKey, this.context(actor)));
  }
  requireAction(actor: HqActor, actionKey: string, row: Record<string, unknown> = {}, input: Record<string, unknown> = {}): void {
    this.requireActionAccess(actor, actionKey);
    const standard = this.standardFor(actor), policy = this.policyFor(actor);
    hqAssert(policy.actionAllowed(actionKey, this.context(actor,this.values(row,input,standard))), 422, 'ACTION_NOT_ALLOWED', `${actionKey}: fields or current state do not allow this action`);
  }
  requireActionAccess(actor: HqActor, actionKey: string): void {
    const standard = this.standardFor(actor);
    const action = standard.actions.find(x => x.actionKey === actionKey);
    hqAssert(action?.enabled && action.support !== 'planned', 409, 'ACTION_NOT_REGISTERED', actionKey);
    hqAssert(action.screenKey, 409, 'ACTION_SCREEN_NOT_REGISTERED', actionKey);
    this.requireScreen(actor, action.screenKey);
    hqAssert(standard.processes.find(process => process.processKey === action.processKey)?.enabled, 403, 'PROCESS_ACCESS_DENIED', action.processKey);
    action.permissions.forEach(p => hqRequire(actor,p));
  }
  requireTransition(actor: HqActor, transitionKey: string, row: Record<string, unknown>, input: Record<string, unknown>): void {
    hqAssert(this.policyFor(actor).transitionAllowed(transitionKey,this.context(actor,this.values(row,input,this.standardFor(actor)))),409,'TRANSITION_NOT_ALLOWED',transitionKey);
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
        hqAssert(persona && persona.active !== false,401,'INVALID_MOCK_CREDENTIALS');
        const datasetId = hqText(body.datasetId ?? 'HQ_DEMO','datasetId',80); const repository = this.repository(datasetId);
        const token = `hq_${randomBytes(32).toString('hex')}`;
        this.sessions.set(token,{loginId:persona.loginId,datasetId,expiresAt:this.now()+8*60*60*1000});
        return {status:200,body:{mode:'MOCK',accessToken:token,user:cloneHq(persona),dataset:this.meta(repository.read())}};
      }
      const session = request.token ? this.sessions.get(request.token) : undefined;
      hqAssert(session && session.expiresAt > this.now(),401,'UNAUTHORIZED','A valid HQ MOCK session is required');
      const actor = this.personas.find(x=>x.loginId === session.loginId)!;
      hqAssert(actor?.active !== false,401,'UNAUTHORIZED');
      const repository = this.repository(session.datasetId);
      const headers = request.headers ?? {};
      if (headers['x-hq-dataset']) hqAssert(headers['x-hq-dataset'] === session.datasetId,409,'DATASET_ID_MISMATCH');
      if (headers['x-hq-schema-version']) hqAssert(Number(headers['x-hq-schema-version']) === repository.read().schemaVersion,409,'DATASET_SCHEMA_UNSUPPORTED');
      if (request.method === 'GET' && url.pathname === '/api/hq/session') return {status:200,body:{mode:'MOCK',user:cloneHq(actor),dataset:this.meta(repository.read())}};
      if (request.method === 'POST' && url.pathname === '/api/hq/logout') { this.sessions.delete(request.token!); return {status:200,body:{success:true,mode:'MOCK'}}; }
      // A common-policy company must use managed Nest business adapters. The mock DTOs
      // and mutations have not been accepted against that contract; never fall back.
      if(this.commonConfigurations.has(actor.companyId))hqAssert(request.method==='GET'&&url.pathname==='/api/hq/menu',409,'HQ_MANAGED_RUNTIME_REQUIRED');
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
      const gate: Array<[string,string]> = [
        ['/api/opportunities/pipeline/funnel','HQ_PIPELINE'],
        ['/api/analytics/dashboard','HQ_ANALYTICS'],['/api/analytics/accounts','HQ_ACCOUNT360'],
        ['/api/ops/status','HQ_OPS'],['/api/interface-logs','HQ_ADMIN_INTERFACES'],['/api/audit-logs','HQ_ADMIN_AUDIT'],
        ['/api/erp-accounts','HQ_ACCOUNT'],
        ['/api/leads','HQ_LEAD'],['/api/accounts','HQ_ACCOUNT'],['/api/contacts','HQ_ACCOUNT'],
        ['/api/activities','HQ_ACTIVITY'],['/api/activity-reports','HQ_ACTIVITY_REPORT'],['/api/direct-work','HQ_DIRECT_WORK'],
        ['/api/opportunities','HQ_OPPORTUNITY'],['/api/contracts','HQ_CONTRACT'],['/api/orders','HQ_ORDER'],
        ['/api/product-packages','HQ_OPPORTUNITY'],['/api/order-products','HQ_ORDER'],['/api/fulfillment','HQ_FULFILLMENT'],
        ['/api/ledger','HQ_LEDGER'],['/api/sales','HQ_FULFILLMENT'],['/api/analytics','HQ_ANALYTICS']
      ];
      const special=/^\/api\/analytics\/accounts\/[^/]+\/(ledger|statements)(\/|\.|$)/.test(url.pathname) ? 'HQ_LEDGER'
        : /^\/api\/orders\/[^/]+\/fulfillment$/.test(url.pathname)||/^\/api\/contracts\/[^/]+\/sales$/.test(url.pathname) ? 'HQ_FULFILLMENT' : undefined;
      const target=special ? [url.pathname,special] : gate.find(([prefix])=>url.pathname===prefix||url.pathname.startsWith(`${prefix}/`));
      if(target)this.requireScreen(actor,target[1]);
      const match = route.regex.exec(url.pathname)!;
      const params = Object.fromEntries(route.names.map((name,i)=>[name,decodeURIComponent(match[i+1])]));
      const result = await route.handler({app:this,actor,repository,datasetId:session.datasetId,params,query:url.searchParams,body,headers,scenario:hqScenario(headers['x-hq-scenario'])});
      if (result && typeof result === 'object' && '__hqBinary' in result && result.__hqBinary === true) {
        const file = result as HqBinaryResult;
        return { status: 200, body: file.bytes, headers: { 'Content-Type': file.contentType,
          'Content-Disposition': `attachment; filename="${file.filename}"` } };
      }
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
    this.route('GET','/api/hq/policy',c=>({standard:this.standardFor(c.actor),capabilities:this.capabilities,context:this.context(c.actor)}));
    this.route('GET','/api/hq/menu',c=>{
      const standard=this.standardFor(c.actor),policy=this.policyFor(c.actor),context=this.context(c.actor);
      return standard.menus.filter(menu=>policy.menuVisible(menu.menuKey,context)).sort((a,b)=>a.order-b.order).map(menu=>({
        menuKey:menu.menuKey,parentKey:menu.parentKey,screenKey:menu.screenKey,label:menu.label,labelKey:menu.labelKey,
        path:standard.screens.find(screen=>screen.screenKey===menu.screenKey)?.path
      }));
    });
    this.route('GET','/api/hq/home',c=>{
      this.requireAction(c.actor,'HOME.refresh');
      const d=c.repository.read();
      return {mode:'MOCK',counts:{leads:d.collections.leads.filter(x=>hqCanRead(c.actor,x)).length,
        accounts:d.collections.accounts.filter(x=>hqCanRead(c.actor,x)).length,
        opportunities:d.collections.opportunities.filter(x=>hqCanRead(c.actor,x)).length,
        contracts:d.collections.contracts.filter(x=>hqCanRead(c.actor,x)).length,
        orders:d.collections.orders.filter(x=>hqCanRead(c.actor,x)).length},
        pendingReports:d.collections.reports.filter(x=>hqCanRead(c.actor,x)&&x.status==='SUBMITTED').length};
    });
    this.route('POST','/api/hq/actions/validate',c=>{
      const key = hqText(c.body.actionKey,'actionKey'); const values = hqObject(c.body.values ?? {});
      hqAssert(this.standardFor(c.actor).actions.some(x=>x.actionKey === key),409,'ACTION_NOT_REGISTERED');
      return {mode:'MOCK',allowed:this.policyFor(c.actor).actionAllowed(key,this.context(c.actor,values))};
    });
    this.route('GET','/api/hq/admin/standard',c=>{
      this.requireScreen(c.actor,'HQ_ADMIN_PERMISSIONS'); hqRequire(c.actor,'STANDARD.READ');
      return {published:this.standard,draft:this.draftStandard,history:this.publishedHistory.map((x,i)=>({index:i,version:x.version,standardKey:x.standardKey})),
        companySnapshot:this.companySnapshots.get(c.actor.companyId)?.standard ?? null};
    });
    this.route('POST','/api/hq/admin/standard/preview',c=>{
      this.requireScreen(c.actor,'HQ_ADMIN_PERMISSIONS'); hqRequire(c.actor,'STANDARD.READ');
      const standard=c.body.standard ?? this.draftStandard;
      const validation=validateHqStandard(standard,this.capabilities);
      if(!validation.valid)return validation;
      const preview=createHqPolicy(standard,this.capabilities),context=this.context(c.actor);
      return {...validation,menu:(standard as HqStandard).menus.filter(x=>preview.menuVisible(x.menuKey,context)).map(x=>x.screenKey),
        visibleFields:(standard as HqStandard).fields.filter(x=>preview.fieldVisible(x.fieldKey,context)).map(x=>x.fieldKey),
        allowedActions:(standard as HqStandard).actions.filter(x=>preview.actionAllowed(x.actionKey,context)).map(x=>x.actionKey)};
    });
    this.route('POST','/api/hq/admin/standard/draft',c=>{
      this.requireScreen(c.actor,'HQ_ADMIN_PERMISSIONS'); hqRequire(c.actor,'STANDARD.PUBLISH');
      const checked=validateHqStandard(c.body.standard,this.capabilities);
      hqAssert(checked.valid,422,'STANDARD_INVALID',JSON.stringify(checked.errors));
      this.draftStandard=cloneHq(c.body.standard as HqStandard);
      c.repository.transact(d=>auditHq(d,c.actor,'ADM.standard.draft',this.draftStandard.standardKey,{version:this.draftStandard.version}));
      return {valid:true,version:this.draftStandard.version};
    });
    this.route('POST','/api/hq/admin/standard/publish',c=>{
      this.requireAction(c.actor,'ADM.standard.publish');
      hqAssert(c.body.expectedVersion===this.standard.version,409,'STANDARD_VERSION_CONFLICT');
      const checked=validateHqStandard(this.draftStandard,this.capabilities);
      hqAssert(checked.valid,422,'STANDARD_INVALID',JSON.stringify(checked.errors));
      this.publishStandard(this.draftStandard);
      c.repository.transact(d=>auditHq(d,c.actor,'ADM.standard.publish',this.standard.standardKey,{version:this.standard.version}));
      return {published:this.standard.version,companySnapshotsPreserved:this.companySnapshots.size};
    });
    this.route('POST','/api/hq/admin/standard/restore',c=>{
      this.requireAction(c.actor,'ADM.standard.publish');
      const index=Number(c.body.index);
      hqAssert(Number.isInteger(index)&&index>=0&&index<this.publishedHistory.length,404,'STANDARD_HISTORY_NOT_FOUND');
      this.publishStandard(this.publishedHistory[index]);
      c.repository.transact(d=>auditHq(d,c.actor,'ADM.standard.restore',this.standard.standardKey,{index,version:this.standard.version}));
      return {published:this.standard.version,historyCount:this.publishedHistory.length};
    });
    this.route('POST','/api/hq/admin/override/preview',c=>{
      this.requireScreen(c.actor,'HQ_ADMIN_PERMISSIONS'); hqRequire(c.actor,'STANDARD.READ');
      const result=applyHqOverride(this.standard,c.body.override,this.capabilities);
      if(!result.valid||!result.standard)return result;
      const policy=createHqPolicy(result.standard,this.capabilities),context=this.context(c.actor);
      return {...result,menu:result.standard.menus.filter(x=>policy.menuVisible(x.menuKey,context)).map(x=>x.screenKey),
        visibleFields:result.standard.fields.filter(x=>policy.fieldVisible(x.fieldKey,context)).map(x=>x.fieldKey),
        allowedActions:result.standard.actions.filter(x=>policy.actionAllowed(x.actionKey,context)).map(x=>x.actionKey)};
    });
    this.route('POST','/api/hq/admin/override/apply',c=>{
      this.requireScreen(c.actor,'HQ_ADMIN_PERMISSIONS'); hqRequire(c.actor,'STANDARD.PUBLISH');
      const result=applyHqOverride(this.standard,c.body.override,this.capabilities);
      hqAssert(result.valid&&result.standard,422,'OVERRIDE_INVALID',JSON.stringify(result.errors));
      this.applyCompanySnapshot(c.actor.companyId,result.standard);
      c.repository.transact(d=>auditHq(d,c.actor,'ADM.override.apply',String(c.body.overrideKey??'company'),{parentVersion:this.standard.version}));
      return {applied:true,parentVersion:this.standard.version};
    });
    this.route('POST','/api/hq/admin/override/clear',c=>{
      hqRequire(c.actor,'STANDARD.PUBLISH'); this.companySnapshots.delete(c.actor.companyId);
      c.repository.transact(d=>auditHq(d,c.actor,'ADM.override.clear',String(c.actor.companyId),{}));
      return {cleared:true};
    });
    this.route('GET','/api/me/context',c=>({user:{userId:c.actor.userId,publicId:`00000000-0000-4000-8000-${String(c.actor.userId).padStart(12,'0')}`,name:c.actor.name,companyId:c.actor.companyId},globalization:{locale:'ko-KR',countryCode:'KR',currencyCode:'KRW',timezone:'Asia/Seoul',marketProfileCode:'KR_SALES',marketTemplateCode:'HQ_TEMPLATE',screenProfileCode:'HQ_SCREEN_PROFILE',fieldProfileCode:'HQ_FIELD_PROFILE',featureProfileCode:'HQ_FEATURE_PROFILE',workflowProfileCode:'KR_SALES_APPROVAL',integrationProfileCode:'HQ_INTEGRATION_PROFILE',mapProfileCode:'HQ_MOCK_MAP',features:Object.fromEntries(this.capabilities.featureKeys.map(k=>[k,true]))},mode:'MOCK'}));
    const lists: Array<[string,HqBusinessCollection,string,string?]> = [
      ['/api/leads','leads','LEAD.READ','LEAD.search'], ['/api/accounts','accounts','ACCOUNT.READ','ACC.search'],
      ['/api/contacts','contacts','CONTACT.READ'], ['/api/activities','activities','ACTIVITY.READ'], ['/api/opportunities','opportunities','OPPORTUNITY.READ'],
      ['/api/contracts','contracts','CONTRACT.READ'], ['/api/orders','orders','ORDER.READ'],
      ['/api/product-packages','products','OPPORTUNITY.READ'], ['/api/order-products','products','PRODUCT_ORDER.READ'],
      ['/api/activity-reports','reports','ACTIVITY.REPORT'], ['/api/direct-work','directWorks','DIRECT_WORK.READ'],
      ['/api/sales','sales','SALES.READ']
    ];
    for (const [path,collection,permission,action] of lists) {
      this.route('GET',path,c=>{
        hqRequire(c.actor,permission);
        const screen = collection === 'activities' ? 'HQ_ACTIVITY' : collection === 'reports' ? 'HQ_ACTIVITY_REPORT' : collection === 'directWorks' ? 'HQ_DIRECT_WORK' : undefined;
        if(screen) this.requireScreen(c.actor,screen);
        if(action) this.requireAction(c.actor,action,{},Object.fromEntries(c.query));
        const search = (c.query.get('search') ?? '').toLocaleLowerCase();
        if(collection==='reports') {
          const from=c.query.get('from'),to=c.query.get('to');
          for(const value of [from,to]) if(value){const parsed=/^\d{4}-\d{2}-\d{2}$/.test(value)?Date.parse(`${value}T00:00:00Z`):NaN;hqAssert(Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,10)===value,400,'DATE_INVALID');}
          hqAssert(!from||!to||from<=to,400,'DATE_RANGE_INVALID');
          for(const key of ['companyId','organizationId','ownerUserId']){const value=c.query.get(key);if(value)hqAssert(/^[1-9]\d*$/.test(value),400,'FILTER_INVALID',key);}
          if(c.query.get('companyId'))hqAssert(Number(c.query.get('companyId'))===c.actor.companyId,403,'COMPANY_ACCESS_DENIED');
        }
        const dataset = c.repository.read();
        return dataset.collections[collection].filter(row=>hqCanRead(c.actor,row) && (collection !== 'activities' || hqActivityTargetReadable(c,dataset,row)) && (collection !== 'directWorks' || hqDirectWorkTargetReadable(c,dataset,row))).map(row => collection === 'reports' ? hqReportForRead(c,dataset,row) : row).filter(row => (!search || JSON.stringify(row).toLocaleLowerCase().includes(search)) && (!c.query.get('status') || row.status === c.query.get('status')) && (!c.query.get('relatedType') || row.related_type === c.query.get('relatedType')) && (!c.query.get('relatedPublicId') || row.related_public_id === c.query.get('relatedPublicId')) && (collection!=='reports' || ((!c.query.get('from') || String(row.report_date)>=c.query.get('from')!) && (!c.query.get('to') || String(row.report_date)<=c.query.get('to')!) && (!c.query.get('organizationId') || Number(row.organization_id)===Number(c.query.get('organizationId'))) && (!c.query.get('ownerUserId') || Number(row.reporter_user_id??row.owner_user_id)===Number(c.query.get('ownerUserId'))))));
      });
      this.route('GET',`${path}/:publicId`,c=>{
        hqRequire(c.actor,permission);
        const screen = collection === 'activities' ? 'HQ_ACTIVITY' : collection === 'reports' ? 'HQ_ACTIVITY_REPORT' : collection === 'directWorks' ? 'HQ_DIRECT_WORK' : undefined;
        if(screen) this.requireScreen(c.actor,screen);
        const dataset = c.repository.read();
        const row = hqFind(dataset,c.actor,collection,c.params.publicId);
        if (collection === 'activities') hqAssert(hqActivityTargetReadable(c,dataset,row),404,'NOT_FOUND');
        if (collection === 'directWorks') hqAssert(hqDirectWorkTargetReadable(c,dataset,row),404,'NOT_FOUND');
        return collection === 'reports' ? hqReportForRead(c,dataset,row) : row;
      });
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
    this.route('GET','/api/hq/admin/users',c=>{this.requireScreen(c.actor,'HQ_ADMIN_USERS');hqRequire(c.actor,'USER.READ');return this.personas.filter(x=>x.companyId===c.actor.companyId).map(x=>({userId:x.userId,loginId:x.loginId,name:x.name,organizationId:x.organizationId,roles:x.roles,scope:x.scope,permissions:x.permissions,active:x.active!==false}));});
    this.route('PATCH','/api/hq/admin/users/:id',c=>{
      this.requireAction(c.actor,'ADM.users.save');hqOnlyKeys(c.body,['name','organizationId','active']);
      const user=this.personas.find(x=>x.userId===Number(c.params.id)&&x.companyId===c.actor.companyId);hqAssert(user,404,'USER_NOT_FOUND');
      if(c.body.name!==undefined)user.name=hqText(c.body.name,'name',100);
      if(c.body.organizationId!==undefined){const id=Number(c.body.organizationId);hqAssert(this.organizations.some(x=>x.organization_id===id&&x.company_id===c.actor.companyId&&x.active),422,'ORG_NOT_FOUND');user.organizationId=id;}
      if(c.body.active!==undefined){hqAssert(typeof c.body.active==='boolean',400,'ValidationError');hqAssert(user.userId!==c.actor.userId||c.body.active,409,'SELF_DISABLE_DENIED');user.active=c.body.active;}
      c.repository.transact(d=>auditHq(d,c.actor,'ADM.users.save',String(user.userId),{fields:Object.keys(c.body)}));
      return {userId:user.userId,name:user.name,organizationId:user.organizationId,active:user.active!==false};
    });
    this.route('GET','/api/hq/admin/organizations',c=>{this.requireScreen(c.actor,'HQ_ADMIN_USERS');hqRequire(c.actor,'ORG.READ');return this.organizations.filter(x=>x.company_id===c.actor.companyId);});
    this.route('PATCH','/api/hq/admin/organizations/:id',c=>{
      this.requireAction(c.actor,'ADM.organizations.save');hqOnlyKeys(c.body,['name','active']);
      const org=this.organizations.find(x=>x.organization_id===Number(c.params.id)&&x.company_id===c.actor.companyId);hqAssert(org,404,'ORG_NOT_FOUND');
      if(c.body.name!==undefined)org.organization_name=hqText(c.body.name,'name',100);
      if(c.body.active!==undefined){hqAssert(typeof c.body.active==='boolean',400,'ValidationError');org.active=c.body.active;}
      c.repository.transact(d=>auditHq(d,c.actor,'ADM.organizations.save',String(org.organization_id),{fields:Object.keys(c.body)}));return org;
    });
    this.route('GET','/api/hq/admin/roles',c=>{this.requireScreen(c.actor,'HQ_ADMIN_PERMISSIONS');hqRequire(c.actor,'ADMIN.READ');return this.personas.filter(x=>x.companyId===c.actor.companyId).map(x=>({roleKey:x.roles[0],userId:x.userId,permissions:x.permissions,scope:x.scope}));});
    this.route('PATCH','/api/hq/admin/roles/:id',c=>{
      this.requireAction(c.actor,'ADM.permissions.save');hqOnlyKeys(c.body,['permissions','scope']);
      const role=this.personas.find(x=>x.roles.includes(c.params.id)&&x.companyId===c.actor.companyId);hqAssert(role,404,'ROLE_NOT_FOUND');
      if(c.body.permissions!==undefined){hqAssert(Array.isArray(c.body.permissions)&&c.body.permissions.every(x=>typeof x==='string')&&new Set(c.body.permissions).size===c.body.permissions.length,422,'PERMISSIONS_INVALID');
        const known=new Set([...this.standard.actions.flatMap(x=>x.permissions),...this.standard.screens.flatMap(x=>x.permissions),...this.personas.flatMap(x=>x.permissions),'HQ.RESET','STANDARD.READ','STANDARD.PUBLISH']);
        hqAssert(c.body.permissions.every(x=>known.has(x)),422,'PERMISSIONS_INVALID');role.permissions=[...c.body.permissions as string[]];}
      if(c.body.scope!==undefined){hqAssert(['SELF','BRANCH','DIVISION','ALL','SYSTEM'].includes(String(c.body.scope)),422,'SCOPE_INVALID');role.scope=c.body.scope as HqActor['scope'];}
      c.repository.transact(d=>auditHq(d,c.actor,'ADM.permissions.save',c.params.id,{fields:Object.keys(c.body)}));return {roleKey:c.params.id,permissions:role.permissions,scope:role.scope};
    });
    this.route('GET','/api/hq/admin/common-codes',c=>{this.requireScreen(c.actor,'HQ_ADMIN_CODES');hqRequire(c.actor,'ADMIN.READ');return Object.fromEntries(this.commonCodes);});
    this.route('POST','/api/hq/admin/common-codes',c=>{
      this.requireAction(c.actor,'ADM.codes.save');hqOnlyKeys(c.body,['groupCode','code','label','active']);
      const group=hqText(c.body.groupCode,'groupCode',60),code=hqText(c.body.code,'code',60),label=hqText(c.body.label,'label',120);
      hqAssert(c.body.active===undefined||typeof c.body.active==='boolean',400,'ValidationError');
      const items=this.commonCodes.get(group)??[];const existing=items.find(x=>x.code===code);
      if(existing){existing.label=label;existing.active=c.body.active!==false;}else items.push({code,label,active:c.body.active!==false});this.commonCodes.set(group,items);
      c.repository.transact(d=>auditHq(d,c.actor,'ADM.codes.save',`${group}:${code}`,{label}));return {groupCode:group,code,label,active:c.body.active!==false};
    });
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
