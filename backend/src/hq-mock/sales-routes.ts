import {opportunityProductInfo,opportunityProductInfoKeys} from './opportunity-product-info.js';
import {syncOpportunityProductsToQuote} from './opportunity-quote-sync.js';
import {installOpportunityContactRoleRoutes} from './opportunity-contact-role-routes.js';
import {installOpportunityNoteRoutes} from './opportunity-note-routes.js';
import {installOpportunityContractProductRoutes} from './opportunity-contract-product-routes.js';
import {installOpportunityQuoteRoutes} from './opportunity-quote-routes.js';
import { HqApplication, hqActivityTargetReadable, hqCanRead, hqFind, hqNumber, hqOnlyKeys, hqReportForRead, hqRequire, hqText } from './app.js';
import type { HqRouteContext } from './app.js';
import { auditHq, canonicalHq, cloneHq, hqAssert, newHqId } from './model.js';
import type { HqDataset, HqRow } from './model.js';
import { enqueueInterface } from './interfaces.js';
import { opportunityCurrency, opportunityMutation, validateOpportunityCurrency } from './opportunity-contract.js';
import { visibleOrderDelivery } from './order-visibility.js';
import { contractAmountsReadable, visibleContractFields } from './contract-visibility.js';
import { createHash } from 'node:crypto';

const stages = ['NEEDS_ANALYSIS', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'];
const date = (value: unknown, label: string) => {
  const parsed = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00Z`) : NaN;
  hqAssert(typeof value === 'string' && Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value, 400, 'DATE_INVALID', label);
  return value;
};
const optionalText = (value: unknown, label: string, max: number) => {
  hqAssert(typeof value === 'string' && value.length <= max, 400, 'TEXT_INVALID', label);
  return value.trim();
};
// 2000-character renewal limits are local storage/input safeguards, not measured Salesforce limits.
const opportunityTextFields = { interestProduct: 500, description: 4000, specialTerms: 4000, paymentMethod: 100, competitorUsage: 2000, ownedEquipment: 2000, treatmentFeeInfo: 2000, stockStatus: 2000, paymentStatus: 2000 };
const paymentMethods = ['', '역구매', '현금 일시불', '현금할부', '카드 일시불(카드사 할부)', '매월카드결제(카드할부)', '기타', '매입상계'];
const opportunityInfoKeys = [...Object.keys(opportunityTextFields), 'paymentDate', 'installmentMonths'];
const opportunityInfo = (input: Record<string, unknown>, existing?: HqRow): Record<string, unknown> => {
  const output: Record<string, unknown> = {};
  for (const [key, max] of Object.entries(opportunityTextFields)) {
    if (input[key] === undefined) continue;
    const value = optionalText(input[key], key, max);
    // Preserve unchanged legacy values, but new choices use the observed Salesforce list.
    if (key === 'paymentMethod') hqAssert(paymentMethods.includes(value) || value === existing?.payment_method, 400, 'PAYMENT_METHOD_INVALID');
    output[key.replace(/[A-Z]/g, x => `_${x.toLowerCase()}`)] = value;
  }
  if (input.paymentDate !== undefined) output.payment_date = input.paymentDate === '' ? '' : date(input.paymentDate, 'paymentDate');
  if (input.installmentMonths !== undefined) {
    const months = hqNumber(input.installmentMonths, 'installmentMonths');
    hqAssert(Number.isInteger(months) && months <= 120, 400, 'INSTALLMENT_MONTHS_INVALID'); output.installment_months = months;
  }
  return output;
};
const owned = (c: HqRouteContext, row: HqRow, permission: string) => {
  hqRequire(c.actor, permission);
  hqAssert(row.owner_user_id === c.actor.userId || c.actor.scope === 'SYSTEM' || c.actor.scope === 'ALL', 403, 'OWNER_WRITE_DENIED');
};
const opportunity = (c: HqRouteContext, d: HqDataset, id: string) => {
  const row = hqFind(d, c.actor, 'opportunities', id);
  hqFind(d, c.actor, 'accounts', String(row.account_public_id));
  return row;
};
const contract = (c: HqRouteContext, d: HqDataset, id: string) => {
  const row = hqFind(d, c.actor, 'contracts', id);
  hqFind(d, c.actor, 'accounts', String(row.account_public_id));
  return row;
};
const visibleOpportunity = (c: HqRouteContext, d: HqDataset, row: HqRow) => {
  const account = hqFind(d, c.actor, 'accounts', String(row.account_public_id));
  const nextFollowUp = d.collections.followUps.filter(item => item.opportunity_public_id === row.public_id && item.account_public_id === row.account_public_id && item.status === 'OPEN' && hqCanRead(c.actor,item)).sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date)))[0];
  const { mock_timeline: _timeline, mock_quotes: _quotes, mock_contract_products: _contractProducts, mock_contact_roles: _contactRoles, mock_notes: _notes, ...publicRow } = row;
  if (Array.isArray(row.history)) publicRow.history = row.history.map((entry: Record<string, unknown>) => {
    if (!Array.isArray(entry.changes)) return entry;
    const changes = entry.changes.filter((change: Record<string, unknown>) => {
      const field = c.app.standardFor(c.actor).fields.find(f => f.entity === 'opportunity' && f.fieldKey === change.fieldKey);
      if (!field || !field.visible) return false;
      return ['before', 'after'].every(key => {
        const value = change[key];
        const projected = c.app.policyFor(c.actor).readField(field.fieldKey, c.app.context(c.actor, { ...c.app.values(row), [field.fieldKey]: value }));
        return projected !== undefined && canonicalHq(projected) === canonicalHq(value);
      });
    });
    return { ...entry, changes };
  }).filter((entry: Record<string, unknown>) => !Array.isArray(entry.changes) || entry.changes.length > 0);
  return { ...publicRow, next_follow_up: nextFollowUp ? { public_id:nextFollowUp.public_id,title:nextFollowUp.title,due_date:nextFollowUp.due_date } : null, currency: opportunityCurrency(row), mode: 'MOCK', products: (Array.isArray(row.products) ? row.products : []).map(line => ({ ...line, currency: line.currency ?? opportunityCurrency(row) })), account_name: account.account_name, erp_approved_yn: account.erp_approved_yn, erp_customer_code: account.erp_customer_code ?? null,
    win_allowed: account.erp_approved_yn === true, order_allowed: account.erp_approved_yn === true };
};
const visibleContract = (c: HqRouteContext, d: HqDataset, row: HqRow) => {
  const account = hqFind(d, c.actor, 'accounts', String(row.account_public_id));
  const opp = opportunity(c, d, String(row.opportunity_public_id));
  return { ...visibleContractFields(c, row), currency: opportunityCurrency(row), mode: 'MOCK', account_name: account.account_name, opportunity_name: opp.opportunity_name };
};
type ContractFile = { public_id:string; name:string; contentType:string; base64:string; size:number; note:string; version:number; created_at:string; deleted:boolean; requestKey:string; digest:string };
const contractFiles = (row:HqRow):ContractFile[] => Array.isArray(row.mock_files) ? row.mock_files as ContractFile[] : [];
const contractFileMetadata = ({base64, requestKey, digest, ...metadata}:ContractFile) => metadata;
const planRows = (body: Record<string, unknown>, target: number, allowSigned = false) => {
  hqOnlyKeys(body, ['rows', 'expectedVersion']);
  hqAssert(Array.isArray(body.rows) && body.rows.length >= 1 && body.rows.length <= 60, 400, 'PLAN_ROWS_INVALID');
  const seen = new Set<number>();
  const rows = body.rows.map((input: unknown) => {
    hqAssert(input !== null && typeof input === 'object' && !Array.isArray(input), 400, 'PLAN_ROW_INVALID');
    const row = input as Record<string, unknown>;
    hqOnlyKeys(row, allowSigned ? ['publicId', 'installmentNo', 'collectionMethod', 'amount', 'plannedDate'] : ['installmentNo', 'collectionMethod', 'amount', 'plannedDate']);
    if (row.publicId !== undefined) hqText(row.publicId, 'publicId', 64);
    const installmentNo = hqNumber(row.installmentNo, 'installmentNo', 1);
    hqAssert(Number.isInteger(installmentNo) && !seen.has(installmentNo), 400, 'PLAN_INSTALLMENT_INVALID'); seen.add(installmentNo);
    return { publicId: row.publicId as string | undefined, installment_no: installmentNo, collection_method: hqText(row.collectionMethod, 'collectionMethod', 100),
      amount: hqNumber(row.amount, 'amount', allowSigned ? -Number.MAX_VALUE : Number.MIN_VALUE), planned_date: date(row.plannedDate, 'plannedDate') };
  });
  hqAssert(Math.abs(rows.reduce((sum, row) => sum + row.amount, 0) - target) < 0.005, 422, 'PLAN_TOTAL_MISMATCH');
  return rows;
};
const planExpectedVersion = (body: Record<string, unknown>, row: HqRow) => {
  if (body.expectedVersion === undefined) return;
  hqAssert(Number.isSafeInteger(body.expectedVersion) && Number(body.expectedVersion) > 0, 400, 'VERSION_INVALID');
  hqAssert(body.expectedVersion === row.version, 409, 'VERSION_CONFLICT');
};
const reconciliation = (d: HqDataset, row: HqRow) => {
  const current = d.collections.plans.filter(p => p.contract_public_id === row.public_id && p.is_current === true);
  const actual = d.collections.collections.filter(p => p.contract_public_id === row.public_id);
  const actualTotal = actual.reduce((sum, p) => sum + Number(p.amount), 0);
  const currentPlanTotal = current.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstandingAmount = Math.max(0, Number(row.contract_amount) - actualTotal);
  const overCollectionAmount = Math.max(0, actualTotal - Number(row.contract_amount));
  return { contractAmount: Number(row.contract_amount), currentPlanTotal, actualTotal, outstandingAmount, overCollectionAmount,
    overduePlanTotal: current.filter(p => String(p.planned_date) < d.clock.slice(0, 10)).reduce((sum, p) => sum + Number(p.amount), 0),
    correctionRequired: overCollectionAmount >= 0.005 || Math.abs(currentPlanTotal - (row.status === 'ERP_APPROVED' && current.some(p => Number(p.plan_version) > 1) ? outstandingAmount : Number(row.contract_amount))) >= 0.005 };
};
const visiblePlan = (c: HqRouteContext, row: HqRow): HqRow => {
  const result = { ...row };
  for (const field of c.app.standardFor(c.actor).fields.filter(f => f.entity === 'plan' && f.current.dbField)) {
    const db = field.current.dbField!; if (!Object.hasOwn(row, db)) continue;
    const value = c.app.policyFor(c.actor).readField(field.fieldKey, c.app.context(c.actor, { ...c.app.values(row), [field.fieldKey]: row[db] }));
    if (value === undefined) delete result[db]; else result[db] = value;
  }
  return result;
};
const collectionCurrencyMismatch = (d: HqDataset, row: HqRow) => typeof row.currency !== 'string' || [...d.collections.plans, ...d.collections.collections]
  .filter(p => p.contract_public_id === row.public_id && p.company_id === row.company_id)
  .some(p => typeof row.currency !== 'string' || typeof p.currency !== 'string' || p.currency !== row.currency);
const completeCollectionAccess = (c: HqRouteContext, d: HqDataset, row: HqRow) => {
  const plans = d.collections.plans.filter(p => p.contract_public_id === row.public_id && p.company_id === row.company_id && p.deleted_yn !== true);
  const actual = d.collections.collections.filter(p => p.contract_public_id === row.public_id && p.company_id === row.company_id);
  return !collectionCurrencyMismatch(d, row) && contractAmountsReadable(c, row) && [...plans, ...actual].every(p => hqCanRead(c.actor, p)) && plans.every(p => visiblePlan(c, p).amount === p.amount);
};

export function installSalesRoutes(app: HqApplication): void {
  installOpportunityQuoteRoutes(app);
  installOpportunityContractProductRoutes(app);
  installOpportunityContactRoleRoutes(app);
  installOpportunityNoteRoutes(app);
  app.replaceRoute('GET', '/api/product-packages', c => {
    hqRequire(c.actor, 'OPPORTUNITY.READ'); app.requireScreen(c.actor, 'HQ_OPPORTUNITY');
    return c.repository.read().collections.products.filter(row => hqCanRead(c.actor, row)).map(row => ({ ...row, currency: opportunityCurrency(row) }));
  });
  app.replaceRoute('GET', '/api/product-packages/:publicId', c => {
    hqRequire(c.actor, 'OPPORTUNITY.READ'); app.requireScreen(c.actor, 'HQ_OPPORTUNITY');
    return hqFind(c.repository.read(), c.actor, 'products', c.params.publicId);
  });
  app.replaceRoute('GET', '/api/opportunities', c => {
    hqRequire(c.actor, 'OPPORTUNITY.READ'); app.requireScreen(c.actor, 'HQ_OPPORTUNITY');
    const d = c.repository.read(); return d.collections.opportunities.filter(row => hqCanRead(c.actor, row) && d.collections.accounts.some(a => a.public_id === row.account_public_id && hqCanRead(c.actor, a))).map(row => visibleOpportunity(c, d, row));
  });
  app.replaceRoute('GET', '/api/opportunities/:publicId', c => {
    hqRequire(c.actor, 'OPPORTUNITY.READ'); app.requireScreen(c.actor, 'HQ_OPPORTUNITY');
    const d = c.repository.read(); return visibleOpportunity(c, d, opportunity(c, d, c.params.publicId));
  });
  app.route('GET', '/api/opportunities/:publicId/related', c => {
    hqRequire(c.actor, 'OPPORTUNITY.READ'); app.requireScreen(c.actor, 'HQ_OPPORTUNITY');
    const d = c.repository.read(), row = opportunity(c, d, c.params.publicId);
    const activities = c.actor.permissions.includes('ACTIVITY.READ') && app.screenAllowed(c.actor, 'HQ_ACTIVITY')
      ? d.collections.activities.filter(item => item.related_type === 'OPPORTUNITY' && item.related_public_id === row.public_id && hqCanRead(c.actor, item) && hqActivityTargetReadable(c, d, item)) : [];
    const reports = c.actor.permissions.includes('ACTIVITY.REPORT') && app.screenAllowed(c.actor, 'HQ_ACTIVITY_REPORT')
      ? d.collections.reports.filter(item => hqCanRead(c.actor, item)).map(item => hqReportForRead(c, d, item))
        .filter(item => (item.items as Record<string, unknown>[]).some(line => line.related_type === 'OPPORTUNITY' && line.related_public_id === row.public_id)) : [];
    const contracts = c.actor.permissions.includes('CONTRACT.READ') && app.screenAllowed(c.actor, 'HQ_CONTRACT')
      ? d.collections.contracts.filter(item => item.opportunity_public_id === row.public_id && item.account_public_id === row.account_public_id && hqCanRead(c.actor, item)).map(item => visibleContract(c, d, item)) : [];
    const followUps = d.collections.followUps.filter(item => item.opportunity_public_id === row.public_id && item.account_public_id === row.account_public_id && hqCanRead(c.actor, item)).sort((a,b) => String(a.due_date).localeCompare(String(b.due_date)));
    return { activities, reports, followUps, contracts, mode: 'MOCK' };
  });
  const followUpForRead = (c: HqRouteContext, d: HqDataset, id: string) => {
    const item = hqFind(d, c.actor, 'followUps', id);
    const parent = opportunity(c, d, String(item.opportunity_public_id));
    hqAssert(parent.account_public_id === item.account_public_id, 404, 'FOLLOWUP_NOT_FOUND');
    return { item, parent };
  };
  app.route('GET', '/api/follow-ups/:publicId', c => {
    hqRequire(c.actor, 'OPPORTUNITY.READ'); app.requireScreen(c.actor, 'HQ_OPPORTUNITY');
    const d = c.repository.read(), {item, parent} = followUpForRead(c,d,c.params.publicId);
    return { ...item, opportunity_name: parent.opportunity_name, mode: 'MOCK' };
  });
  const followUpMutation = (c: HqRouteContext, create: boolean) => {
    hqRequire(c.actor, 'OPPORTUNITY.WRITE'); app.requireScreen(c.actor, 'HQ_OPPORTUNITY');
    app.requireActionAccess(c.actor, 'OPP.saveNegotiation');
    hqOnlyKeys(c.body, create ? ['title','dueDate','idempotencyKey'] : ['title','dueDate','status','expectedVersion','idempotencyKey']);
    const { idempotencyKey, expectedVersion, ...values } = c.body;
    const key = idempotencyKey === undefined ? undefined : hqText(idempotencyKey,'idempotencyKey',200);
    const fingerprint = canonicalHq({ create, params:c.params, values, expectedVersion:expectedVersion ?? null });
    return c.repository.transact(d => {
      const existing = create ? undefined : followUpForRead(c,d,c.params.publicId).item;
      const parent = create ? opportunity(c,d,c.params.publicId) : opportunity(c,d,String(existing!.opportunity_public_id));
      owned(c,parent,'OPPORTUNITY.WRITE'); if (existing) owned(c,existing,'OPPORTUNITY.WRITE');
      app.requireAction(c.actor, 'OPP.saveNegotiation', parent, values);
      if (key) {
        const receipt = d.collections.auditLogs.find(entry => entry.action === 'FOLLOWUP_MUTATION_RECEIPT' && entry.company_id === c.actor.companyId && entry.owner_user_id === c.actor.userId && (entry.detail as Record<string,unknown>)?.key === key);
        if (receipt) { const detail = receipt.detail as Record<string,unknown>; hqAssert(detail.fingerprint === fingerprint,409,'IDEMPOTENCY_CONFLICT'); return cloneHq(detail.response); }
      }
      if (!create) {
        hqAssert(Number.isSafeInteger(expectedVersion) && Number(expectedVersion)>0,400,'EXPECTED_VERSION_INVALID');
        hqAssert(existing!.version === expectedVersion,409,'VERSION_CONFLICT','다른 작업에서 후속조치를 수정했습니다.');
      }
      const title = values.title === undefined && existing ? existing.title : hqText(values.title,'title',200);
      const dueDate = values.dueDate === undefined && existing ? existing.due_date : date(values.dueDate,'dueDate');
      const status = values.status === undefined ? existing?.status ?? 'OPEN' : values.status;
      hqAssert(status === 'OPEN' || status === 'COMPLETED',400,'FOLLOWUP_STATUS_INVALID');
      const item: HqRow = existing ?? {public_id:newHqId(d),company_id:parent.company_id,owner_user_id:c.actor.userId,organization_id:parent.organization_id,version:1,opportunity_public_id:parent.public_id,account_public_id:parent.account_public_id,created_at:d.clock};
      item.title=title; item.due_date=dueDate; item.status=status; item.updated_at=d.clock;
      if (existing) item.version++; else d.collections.followUps.push(item);
      auditHq(d,c.actor,create ? 'FOLLOWUP.create' : 'FOLLOWUP.update',item.public_id,{opportunityPublicId:parent.public_id});
      const response={...item,opportunity_name:parent.opportunity_name,mode:'MOCK'};
      if(key) auditHq(d,c.actor,'FOLLOWUP_MUTATION_RECEIPT',item.public_id,{key,fingerprint,response:cloneHq(response)});
      return response;
    },true);
  };
  app.route('POST','/api/opportunities/:publicId/follow-ups',c => followUpMutation(c,true));
  app.route('PATCH','/api/follow-ups/:publicId',c => followUpMutation(c,false));
  app.route('POST', '/api/opportunities', request => opportunityMutation(request, 'OPPORTUNITY.WRITE', 'CREATE', (c, d) => {
    hqRequire(c.actor, 'OPPORTUNITY.WRITE'); hqOnlyKeys(c.body, ['accountPublicId', 'opportunityName', 'recordType', 'expectedCloseDate', 'currency', ...opportunityInfoKeys]);
    const account = hqFind(d, c.actor, 'accounts', hqText(c.body.accountPublicId, 'accountPublicId'));
    const name = hqText(c.body.opportunityName, 'opportunityName', 200);
    const expectedCloseDate = date(c.body.expectedCloseDate ?? d.clock.slice(0, 10), 'expectedCloseDate');
    const recordType = String(c.body.recordType ?? 'EXISTING'); hqAssert(['NEW', 'EXISTING', 'RECONTRACT'].includes(recordType), 400, 'OPPORTUNITY_TYPE_INVALID');
    const info = opportunityInfo(c.body);
    app.requireAction(c.actor, 'OPP.create', {}, { ...c.body, accountPublicId: account.public_id, opportunityName: name, expectedCloseDate });
    const row: HqRow = { public_id: newHqId(d), company_id: c.actor.companyId, owner_user_id: c.actor.userId, organization_id: c.actor.organizationId ?? 10,
      version: 1, account_public_id: account.public_id, opportunity_name: name, record_type: recordType, stage: 'NEEDS_ANALYSIS', amount: 0, currency: validateOpportunityCurrency(c.body.currency ?? opportunityCurrency(account)),
      expected_close_date: expectedCloseDate, success_probability: 0, forecast_category: 'PIPELINE', price_list_code: 'ERP_STANDARD', contract_created_yn: false, products: [], history: [], created_at: d.clock, ...info };
    d.collections.opportunities.push(row); auditHq(d, c.actor, 'OPP.create', row.public_id, {}); return visibleOpportunity(c, d, row);
  }));
  // Conservative local deletion rule until Salesforce cascade policy is verified.
  app.route('DELETE', '/api/opportunities/:publicId', c => {
    hqRequire(c.actor, 'OPPORTUNITY.WRITE'); app.requireActionAccess(c.actor, 'OPP.delete');
    hqOnlyKeys(c.body, ['expectedVersion', 'idempotencyKey']);
    hqAssert(Number.isSafeInteger(c.body.expectedVersion) && Number(c.body.expectedVersion) > 0, 400, 'EXPECTED_VERSION_INVALID');
    const key = c.body.idempotencyKey === undefined ? undefined : hqText(c.body.idempotencyKey, 'idempotencyKey', 200);
    const fingerprint = canonicalHq({ publicId: c.params.publicId, expectedVersion: c.body.expectedVersion });
    return c.repository.transact(d => {
      const receipt = key && d.collections.auditLogs.find(log => log.action === 'OPPORTUNITY_DELETE_RECEIPT' && log.company_id === c.actor.companyId && log.owner_user_id === c.actor.userId && (log.detail as Record<string, unknown>)?.key === key);
      if (receipt) {
        const detail = receipt.detail as Record<string, any>, authorization = detail.authorization as HqRow;
        hqAssert(hqCanRead(c.actor, authorization), 404, 'NOT_FOUND'); owned(c, authorization, 'OPPORTUNITY.WRITE');
        hqFind(d, c.actor, 'accounts', String(authorization.account_public_id)); app.requireAction(c.actor, 'OPP.delete', authorization, {});
        hqAssert(detail.fingerprint === fingerprint, 409, 'IDEMPOTENCY_CONFLICT'); return cloneHq(detail.response);
      }
      const row = opportunity(c, d, c.params.publicId); owned(c, row, 'OPPORTUNITY.WRITE'); app.requireAction(c.actor, 'OPP.delete', row, {});
      hqAssert(row.version === c.body.expectedVersion, 409, 'VERSION_CONFLICT', '다른 작업에서 기회가 변경되었습니다. 최신 내용을 확인해 주세요.');
      const referenced = row.contract_created_yn === true || d.collections.contracts.some(x => x.opportunity_public_id === row.public_id)
        || d.collections.activities.some(x => x.related_type === 'OPPORTUNITY' && x.related_public_id === row.public_id)
        || d.collections.followUps.some(x => x.opportunity_public_id === row.public_id)
        || d.collections.reports.some(x => Array.isArray(x.items) && x.items.some((item: Record<string, unknown>) => item.related_type === 'OPPORTUNITY' && item.related_public_id === row.public_id))
        || (Array.isArray(row.mock_timeline) && row.mock_timeline.some((x: Record<string, unknown>) => !x.deleted))
        || (Array.isArray(row.mock_quotes) && row.mock_quotes.some((x: Record<string, unknown>) => !x.deleted))
        || (Array.isArray(row.mock_contract_products) && row.mock_contract_products.some((x: Record<string, unknown>) => !x.deleted))
        || (Array.isArray(row.mock_contact_roles) && row.mock_contact_roles.some((x: Record<string, unknown>) => !x.deleted))
        || (Array.isArray(row.mock_notes) && row.mock_notes.some((x: Record<string, unknown>) => !x.deleted));
      hqAssert(!referenced, 409, 'OPPORTUNITY_DELETE_REFERENCED', '연결된 계약·활동·후속조치가 있어 삭제할 수 없습니다. 관련 기록을 먼저 확인해 주세요.');
      d.collections.opportunities = d.collections.opportunities.filter(x => x.public_id !== row.public_id);
      const response = { publicId: row.public_id, deleted: true, mode: 'MOCK' };
      auditHq(d, c.actor, 'OPP.delete', row.public_id, { productCount: Array.isArray(row.products) ? row.products.length : 0 });
      if (key) auditHq(d, c.actor, 'OPPORTUNITY_DELETE_RECEIPT', row.public_id, { key, fingerprint, response, authorization: { public_id: row.public_id, company_id: row.company_id, owner_user_id: row.owner_user_id, organization_id: row.organization_id, account_public_id: row.account_public_id, version: row.version } });
      return response;
    }, true);
  });
  app.route('PATCH', '/api/opportunities/:publicId', request => opportunityMutation(request, 'OPPORTUNITY.WRITE', 'UPDATE', (c, d) => {
    const row = opportunity(c, d, c.params.publicId); owned(c, row, 'OPPORTUNITY.WRITE');
    hqOnlyKeys(c.body, ['opportunityName', 'recordType', 'expectedCloseDate', 'successProbability', 'forecastCategory', 'priceListCode', ...opportunityInfoKeys]);
    const beforeInfo = cloneHq(row);
    const info = opportunityInfo(c.body, row);
    if (c.body.recordType !== undefined) hqAssert(typeof c.body.recordType === 'string' && ['NEW', 'EXISTING', 'RECONTRACT'].includes(c.body.recordType), 400, 'OPPORTUNITY_TYPE_INVALID');
    app.requireAction(c.actor, 'OPP.saveNegotiation', row, c.body);
    if (c.body.recordType !== undefined) row.record_type = c.body.recordType;
    if (c.body.opportunityName !== undefined) row.opportunity_name = hqText(c.body.opportunityName, 'opportunityName', 200);
    if (c.body.expectedCloseDate !== undefined) row.expected_close_date = date(c.body.expectedCloseDate, 'expectedCloseDate');
    if (c.body.successProbability !== undefined) row.success_probability = hqNumber(c.body.successProbability, 'successProbability');
    hqAssert(Number(row.success_probability) <= 100, 400, 'PROBABILITY_INVALID');
    if (c.body.forecastCategory !== undefined) { hqAssert(['PIPELINE', 'BEST_CASE', 'COMMIT', 'OMITTED'].includes(String(c.body.forecastCategory)), 400, 'FORECAST_INVALID'); row.forecast_category = c.body.forecastCategory; }
    if (c.body.priceListCode !== undefined) {
      const next = String(c.body.priceListCode), previous = String(row.price_list_code ?? 'ERP_STANDARD');
      hqAssert(['ERP_STANDARD', 'CUSTOM_QUOTE'].includes(next), 400, 'PRICE_LIST_INVALID');
      if (next !== previous) {
        hqAssert(!['CLOSED_WON', 'CLOSED_LOST'].includes(String(row.stage)) && row.contract_created_yn !== true, 409, 'PRICE_LIST_LOCKED');
        if (next === 'ERP_STANDARD') {
          for (const line of row.products as Record<string, unknown>[]) {
            const product = hqFind(d, c.actor, 'products', String(line.product_public_id));
            hqAssert(opportunityCurrency(product) === opportunityCurrency(row), 422, 'PRODUCT_CURRENCY_MISMATCH');
            line.proposed_unit_price = Number(product.base_price ?? product.unit_price);
            line.amount = Number(line.quantity) * Number(line.proposed_unit_price);
          }
          row.amount = (row.products as Record<string, unknown>[]).reduce((sum, line) => sum + Number(line.amount), 0);
        }
        row.history = [...(row.history as unknown[] ?? []), { action: 'PRICE_LIST_CHANGED', from: previous, to: next, at: d.clock, actorUserId: c.actor.userId }];
        row.price_list_code = next;
        syncOpportunityProductsToQuote(c,d,row);
      }
    }
    Object.assign(row, info);
    const changes = Object.keys(c.body).map(key => {
      const db = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      return { field: db, fieldKey: `opportunity.${key}`, before: beforeInfo[db] ?? null, after: row[db] ?? null };
    }).filter(change => canonicalHq(change.before) !== canonicalHq(change.after));
    if (changes.length) row.history = [...(row.history as unknown[] ?? []), { action: 'INFORMATION_UPDATED', at: d.clock, actorUserId: c.actor.userId, changes }];
    row.version++; auditHq(d, c.actor, 'OPP.saveNegotiation', row.public_id, { fields: Object.keys(c.body) }); return visibleOpportunity(c, d, row);
  }));
  app.route('POST', '/api/opportunities/:publicId/stage', request => opportunityMutation(request, 'OPPORTUNITY.STAGE', 'STAGE', (c, d) => {
    const row = opportunity(c, d, c.params.publicId); owned(c, row, 'OPPORTUNITY.STAGE'); hqOnlyKeys(c.body, ['toStage', 'reason']);
    const target = String(c.body.toStage); hqAssert(stages.includes(target) && target !== row.stage, 400, 'STAGE_INVALID');
    const account = hqFind(d, c.actor, 'accounts', String(row.account_public_id));
    app.requireAction(c.actor, 'OPP.stage', { ...row, 'account.erpApprovedYn': account.erp_approved_yn }, c.body);
    const from = String(row.stage), reverse = stages.indexOf(target) < stages.indexOf(from) || from.startsWith('CLOSED_');
    if (reverse) hqAssert(typeof c.body.reason === 'string' && c.body.reason.trim().length > 0, 422, 'STAGE_REASON_REQUIRED');
    if (from === 'CLOSED_WON') hqAssert(row.contract_created_yn !== true, 409, 'OPPORTUNITY_CONTRACT_EXISTS');
    if (from === 'CLOSED_LOST') hqAssert(c.actor.permissions.includes('OPPORTUNITY.STATUS.REVERSE') || c.actor.scope === 'SYSTEM', 403, 'REOPEN_PERMISSION_REQUIRED');
    if (target === 'CLOSED_WON') hqAssert(account.erp_approved_yn === true && (row.products as unknown[]).length > 0 && Number(row.amount) > 0, 422, 'OPPORTUNITY_WIN_NOT_READY');
    row.stage = target; if (target === 'CLOSED_WON') { row.success_probability = 100; row.forecast_category = 'COMMIT'; }
    row.version++; row.history = [...(row.history as unknown[] ?? []), { from, to: target, reason: c.body.reason ?? '', at: d.clock, actorUserId: c.actor.userId }];
    auditHq(d, c.actor, 'OPP.stage', row.public_id, { from, to: target }); return visibleOpportunity(c, d, row);
  }));
  const addProduct = (c: HqRouteContext, d: HqDataset, input: Record<string, unknown>) => {
    const row = opportunity(c, d, c.params.publicId); owned(c, row, 'OPPORTUNITY.PRODUCT.WRITE');
    hqOnlyKeys(input, ['packagePublicId', 'quantity', 'proposedUnitPrice', 'note', ...opportunityProductInfoKeys]);
    const productInfo=opportunityProductInfo(input);
    const product = hqFind(d, c.actor, 'products', hqText(input.packagePublicId, 'packagePublicId'));
    hqAssert(opportunityCurrency(product) === opportunityCurrency(row), 422, 'PRODUCT_CURRENCY_MISMATCH', '기회와 제품 통화가 달라 합산할 수 없습니다.');
    const quantity = hqNumber(input.quantity ?? 1, 'quantity', 1), price = hqNumber(input.proposedUnitPrice, 'proposedUnitPrice');
    hqAssert(Number.isInteger(quantity) && quantity <= 9999, 400, 'QUANTITY_INVALID');
    app.requireAction(c.actor, 'OPP.product.add', row, { ...input, productPublicId: product.public_id, quantity, proposedUnitPrice: price });
    hqAssert(!['CLOSED_WON', 'CLOSED_LOST'].includes(String(row.stage)), 409, 'OPPORTUNITY_CLOSED');
    const line = { public_id: newHqId(d), product_public_id: product.public_id, package_public_id: product.public_id, item_name: product.item_name,
      quantity, unit_price: Number(product.unit_price), proposed_unit_price: price, amount: quantity * price, currency: opportunityCurrency(row), note: input.note ? hqText(input.note, 'note', 1000) : '', ...productInfo };
    row.products = [...(row.products as unknown[] ?? []), line]; row.amount = (row.products as typeof line[]).reduce((sum, p) => sum + Number(p.amount), 0);
    row.version++; syncOpportunityProductsToQuote(c,d,row); auditHq(d, c.actor, 'OPP.product.add', row.public_id, { productPublicId: line.public_id }); return line;
  };
  app.route('POST', '/api/opportunities/:publicId/products', request => opportunityMutation(request, 'OPPORTUNITY.PRODUCT.WRITE', 'PRODUCT_ADD', (c, d) => addProduct(c, d, c.body)));
  app.route('POST', '/api/opportunities/:publicId/products/batch', request => opportunityMutation(request, 'OPPORTUNITY.PRODUCT.WRITE', 'PRODUCT_BATCH', (c, d) => {
    hqOnlyKeys(c.body, ['items']);
    hqAssert(Array.isArray(c.body.items) && c.body.items.length > 0 && c.body.items.length <= 100, 400, 'PRODUCT_SELECTION_INVALID');
    const items = c.body.items as Record<string, unknown>[];
    hqAssert(items.every(item => item && typeof item === 'object' && !Array.isArray(item)), 400, 'PRODUCT_SELECTION_INVALID');
    hqAssert(new Set(items.map(item => item.packagePublicId)).size === items.length, 400, 'PRODUCT_SELECTION_DUPLICATE');
    return items.map(item => addProduct(c, d, item));
  }));
  app.route('POST', '/api/opportunities/:publicId/products/reorder', request => opportunityMutation(request, 'OPPORTUNITY.PRODUCT.WRITE', 'PRODUCT_REORDER', (c, d) => {
    const row = opportunity(c, d, c.params.publicId); owned(c, row, 'OPPORTUNITY.PRODUCT.WRITE');
    hqOnlyKeys(c.body, ['productPublicIds']);
    hqAssert(!['CLOSED_WON', 'CLOSED_LOST'].includes(String(row.stage)) && row.contract_created_yn !== true, 409, 'OPPORTUNITY_CLOSED');
    app.requireAction(c.actor, 'OPP.product.edit', row, {});
    const lines = row.products as Record<string, unknown>[], ids = c.body.productPublicIds;
    hqAssert(Array.isArray(ids) && ids.length === lines.length && ids.every(id => typeof id === 'string') && new Set(ids).size === ids.length && ids.every(id => lines.some(line => line.public_id === id)), 400, 'PRODUCT_ORDER_INVALID');
    row.products = ids.map(id => lines.find(line => line.public_id === id)!); row.version++; syncOpportunityProductsToQuote(c,d,row);
    auditHq(d, c.actor, 'OPP.product.reorder', row.public_id, { productPublicIds: ids }); return visibleOpportunity(c, d, row);
  }));
  const changeProduct = (request: HqRouteContext, remove: boolean) => opportunityMutation(request, 'OPPORTUNITY.PRODUCT.WRITE', remove ? 'PRODUCT_DELETE' : 'PRODUCT_UPDATE', (c, d) => {
    const row = opportunity(c, d, c.params.publicId); owned(c, row, 'OPPORTUNITY.PRODUCT.WRITE');
    hqAssert(!['CLOSED_WON', 'CLOSED_LOST'].includes(String(row.stage)), 409, 'OPPORTUNITY_CLOSED');
    const lines = row.products as Record<string, unknown>[]; const index = lines.findIndex(p => p.public_id === c.params.productId);
    hqAssert(index >= 0, 404, 'PRODUCT_LINE_NOT_FOUND');
    app.requireAction(c.actor, remove ? 'OPP.product.remove' : 'OPP.product.edit', row, c.body);
    if (remove) { hqOnlyKeys(c.body, []); lines.splice(index, 1); }
    else { hqOnlyKeys(c.body, ['quantity', 'proposedUnitPrice', 'note', ...opportunityProductInfoKeys]); const line = lines[index]; Object.assign(line,opportunityProductInfo(c.body));
      if (c.body.quantity !== undefined) { const quantity = hqNumber(c.body.quantity, 'quantity', 1); hqAssert(Number.isInteger(quantity) && quantity <= 9999, 400, 'QUANTITY_INVALID'); line.quantity = quantity; }
      if (c.body.proposedUnitPrice !== undefined) line.proposed_unit_price = hqNumber(c.body.proposedUnitPrice, 'proposedUnitPrice');
      if (c.body.note !== undefined) line.note = hqText(c.body.note, 'note', 1000);
      line.amount = Number(line.quantity) * Number(line.proposed_unit_price);
    }
    row.amount = lines.reduce((sum, p) => sum + Number(p.amount), 0); row.version++; syncOpportunityProductsToQuote(c,d,row);
    auditHq(d, c.actor, remove ? 'OPP.product.remove' : 'OPP.product.edit', row.public_id, { productPublicId: c.params.productId }); return visibleOpportunity(c, d, row);
  });
  app.route('PATCH', '/api/opportunities/:publicId/products/:productId', c => changeProduct(c, false));
  app.route('DELETE', '/api/opportunities/:publicId/products/:productId', c => changeProduct(c, true));
  app.route('GET', '/api/opportunities/pipeline/funnel', c => {
    hqRequire(c.actor, 'OPPORTUNITY.READ'); app.requireScreen(c.actor, 'HQ_PIPELINE');
    const d = c.repository.read(), rows = d.collections.opportunities.filter(row => hqCanRead(c.actor, row) && d.collections.accounts.some(a => a.public_id === row.account_public_id && hqCanRead(c.actor, a)));
    const currencies = [...new Set(rows.map(opportunityCurrency))];
    const byStage = currencies.flatMap(currency => stages.map(stage => { const group = rows.filter(r => r.stage === stage && opportunityCurrency(r) === currency); return { stage, currency, opportunity_count: group.length, amount: group.reduce((s, r) => s + Number(r.amount), 0) }; }));
    const forecast = currencies.flatMap(currency => ['PIPELINE', 'BEST_CASE', 'COMMIT', 'OMITTED'].map(forecast_category => { const group = rows.filter(r => r.forecast_category === forecast_category && opportunityCurrency(r) === currency); return { forecast_category, currency, opportunity_count: group.length, amount: group.reduce((s, r) => s + Number(r.amount), 0) }; }));
    const mockToday = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d.clock));
    const visibleIds = new Set(rows.map(row=>row.public_id));
    const overdueFollowUpCount = app.screenAllowed(c.actor,'HQ_OPPORTUNITY') ? d.collections.followUps.filter(item=>item.status === 'OPEN' && String(item.due_date)<mockToday && hqCanRead(c.actor,item) && visibleIds.has(String(item.opportunity_public_id))).length : 0;
    return { byStage, forecast, overdueFollowUpCount, mockToday, mode: 'MOCK', weightedForecastEnabled: false };
  });
  app.replaceRoute('GET', '/api/contracts', c => { hqRequire(c.actor, 'CONTRACT.READ'); app.requireScreen(c.actor, 'HQ_CONTRACT'); const d = c.repository.read(); return d.collections.contracts.filter(row => hqCanRead(c.actor, row) && d.collections.accounts.some(a => a.public_id === row.account_public_id && hqCanRead(c.actor, a))).map(row => visibleContract(c, d, row)); });
  app.replaceRoute('GET', '/api/contracts/:publicId', c => { hqRequire(c.actor, 'CONTRACT.READ'); app.requireScreen(c.actor, 'HQ_CONTRACT'); const d = c.repository.read(); return visibleContract(c, d, contract(c, d, c.params.publicId)); });
  app.route('PATCH', '/api/contracts/:publicId', c => c.repository.transact(d => {
    hqOnlyKeys(c.body, ['expectedVersion','contractName','contractDate','packageClassification','productAmount','goodsAmount','specialTerms','description']);
    const row = contract(c,d,c.params.publicId); owned(c,row,'CONTRACT.WRITE');
    hqAssert(c.body.expectedVersion !== undefined,400,'VERSION_REQUIRED'); planExpectedVersion(c.body,row);
    hqAssert(['DRAFT','ERP_FAILED'].includes(String(row.status)),409,'CONTRACT_EDIT_LOCKED');
    hqAssert(contractAmountsReadable(c,row),403,'CONTRACT_AMOUNT_ACCESS_DENIED');
    const {expectedVersion: _version,...input}=c.body; app.requireAction(c.actor,'CON.save',{...row,'contract.status':row.status},input);
    if(input.contractName !== undefined) row.contract_name=hqText(input.contractName,'contractName',200);
    if(input.contractDate !== undefined) row.contract_date=date(input.contractDate,'contractDate');
    if(input.packageClassification !== undefined) row.package_classification=optionalText(input.packageClassification,'packageClassification',100);
    if(input.productAmount !== undefined) row.product_amount=hqNumber(input.productAmount,'productAmount');
    if(input.goodsAmount !== undefined) row.goods_amount=hqNumber(input.goodsAmount,'goodsAmount');
    if(input.specialTerms !== undefined) row.special_terms=optionalText(input.specialTerms,'specialTerms',4000);
    if(input.description !== undefined) row.description=optionalText(input.description,'description',4000);
    row.version++; auditHq(d,c.actor,'CON.save',row.public_id,{fields:Object.keys(input)});return visibleContract(c,d,row);
  }));
  app.route('GET', '/api/contracts/:publicId/files', c => { hqRequire(c.actor,'CONTRACT.READ'); app.requireScreen(c.actor,'HQ_CONTRACT'); const row=contract(c,c.repository.read(),c.params.publicId); return {items:contractFiles(row).filter(file=>!file.deleted).map(contractFileMetadata),maxBytes:512*1024,mode:'MOCK'}; });
  app.route('POST', '/api/contracts/:publicId/files', c => {
    hqRequire(c.actor,'CONTRACT.WRITE'); app.requireScreen(c.actor,'HQ_CONTRACT'); hqOnlyKeys(c.body,['name','contentType','base64','note','idempotencyKey']);
    const name=hqText(c.body.name,'name',160), contentType=hqText(c.body.contentType,'contentType',80), key=hqText(c.body.idempotencyKey,'idempotencyKey',200);
    const allowed:Record<string,string>={txt:'text/plain',csv:'text/csv',pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'};
    hqAssert(!/[\\/\x00-\x1f\x7f\"]/.test(name) && allowed[name.split('.').pop()?.toLowerCase()??'']===contentType,400,'FILE_TYPE_INVALID');
    const base64=c.body.base64; hqAssert(typeof base64==='string' && base64.length<=Math.ceil((512*1024)/3)*4 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64),400,'FILE_ENCODING_INVALID');
    const bytes=Buffer.from(base64 as string,'base64'); hqAssert(bytes.length>0 && bytes.length<=512*1024,400,'FILE_SIZE_INVALID');
    if(contentType==='application/pdf') hqAssert(bytes.subarray(0,5).toString()==='%PDF-',400,'FILE_CONTENT_INVALID');
    if(contentType==='image/png') hqAssert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),400,'FILE_CONTENT_INVALID');
    if(contentType==='image/jpeg') hqAssert(bytes[0]===255&&bytes[1]===216&&bytes[2]===255,400,'FILE_CONTENT_INVALID');
    hqAssert(c.body.note===undefined || (typeof c.body.note==='string'&&c.body.note.length<=2000),400,'FILE_NOTE_INVALID');
    const note=typeof c.body.note==='string'?c.body.note.trim():''; const digest=createHash('sha256').update(name).update(contentType).update(bytes).update(note).digest('hex');
    return c.repository.transact(d=>{const row=contract(c,d,c.params.publicId); owned(c,row,'CONTRACT.WRITE'); const existing=contractFiles(row).find(file=>file.requestKey===key); if(existing){hqAssert(existing.digest===digest,409,'IDEMPOTENCY_CONFLICT');return contractFileMetadata(existing);} hqAssert(contractFiles(row).filter(file=>!file.deleted).length<10,400,'FILE_LIMIT_REACHED');
      const file:ContractFile={public_id:newHqId(d),name,contentType,base64:bytes.toString('base64'),size:bytes.length,note,version:1,created_at:d.clock,deleted:false,requestKey:key,digest}; row.mock_files=[...contractFiles(row),file];auditHq(d,c.actor,'CON.fileUpload',row.public_id,{fileId:file.public_id});return contractFileMetadata(file);
    },true);
  });
  app.route('GET','/api/contracts/:publicId/files/:fileId/download',c=>{hqRequire(c.actor,'CONTRACT.READ');app.requireScreen(c.actor,'HQ_CONTRACT');const row=contract(c,c.repository.read(),c.params.publicId);const file=contractFiles(row).find(f=>f.public_id===c.params.fileId&&!f.deleted);hqAssert(file,404,'FILE_NOT_FOUND');return {__hqBinary:true,bytes:Buffer.from(file.base64,'base64'),contentType:'application/octet-stream',filename:encodeURIComponent(file.name)};});
  app.route('DELETE','/api/contracts/:publicId/files/:fileId',c=>{hqRequire(c.actor,'CONTRACT.WRITE');app.requireScreen(c.actor,'HQ_CONTRACT');hqOnlyKeys(c.body,['expectedVersion']);return c.repository.transact(d=>{const row=contract(c,d,c.params.publicId);owned(c,row,'CONTRACT.WRITE');const file=contractFiles(row).find(f=>f.public_id===c.params.fileId&&!f.deleted);hqAssert(file,404,'FILE_NOT_FOUND');hqAssert(file.version===c.body.expectedVersion,409,'VERSION_CONFLICT');file.deleted=true;file.base64='';file.version++;auditHq(d,c.actor,'CON.fileDelete',row.public_id,{fileId:file.public_id});return {deleted:true};},true);});
  app.route('POST','/api/opportunities/:publicId/contracts',c=>c.repository.transact(d=>{
    hqOnlyKeys(c.body,['expectedVersion','rows']);hqRequire(c.actor,'CONTRACT.WRITE');app.requireScreen(c.actor,'HQ_CONTRACT');
    const opp=opportunity(c,d,c.params.publicId);owned(c,opp,'CONTRACT.WRITE');
    hqAssert(Number.isSafeInteger(c.body.expectedVersion),400,'VERSION_REQUIRED');hqAssert(c.body.expectedVersion===opp.version,409,'VERSION_CONFLICT');
    const account=hqFind(d,c.actor,'accounts',String(opp.account_public_id));
    hqAssert(opp.stage==='CLOSED_WON' && account.erp_approved_yn===true,422,'CONTRACT_NOT_READY');
    hqAssert(opp.contract_created_yn!==true && !d.collections.contracts.some(x=>x.opportunity_public_id===opp.public_id),409,'CONTRACT_ALREADY_EXISTS');
    const products=Array.isArray(opp.products)?opp.products as Record<string,unknown>[]:[];
    hqAssert(products.length>0 && Array.isArray(c.body.rows) && c.body.rows.length===products.length,400,'CONTRACT_ROWS_INVALID');
    const seen=new Set<string>(); const rows=(c.body.rows as unknown[]).map(input=>{
      hqAssert(input && typeof input==='object' && !Array.isArray(input),400,'CONTRACT_ROW_INVALID');const value=input as Record<string,unknown>;
      hqOnlyKeys(value,['productLineId','contractName','productAmount','goodsAmount','contractDate','packageClassification','specialTerms']);
      const id=hqText(value.productLineId,'productLineId',64);hqAssert(!seen.has(id),400,'CONTRACT_PRODUCT_DUPLICATE');seen.add(id);
      const product=products.find(p=>p.public_id===id);hqAssert(product,400,'CONTRACT_PRODUCT_INVALID');
      const productAmount=hqNumber(value.productAmount,'productAmount'),goodsAmount=hqNumber(value.goodsAmount,'goodsAmount');const total=hqNumber(product.amount,'amount');
      hqAssert(Math.abs(productAmount+goodsAmount-total)<0.005,422,'CONTRACT_AMOUNT_MISMATCH');
      const contractName=hqText(value.contractName,'contractName',200),contractDate=date(value.contractDate??d.clock.slice(0,10),'contractDate');
      const packageClassification=optionalText(value.packageClassification??'','packageClassification',100),specialTerms=optionalText(value.specialTerms??'','specialTerms',4000);
      app.requireAction(c.actor,'CON.create',{...opp,'opportunity.stage':opp.stage,'account.erpApprovedYn':account.erp_approved_yn},{opportunityPublicId:opp.public_id,contractName,contractDate,productAmount,goodsAmount,packageClassification,specialTerms});
      return {product,productAmount,goodsAmount,total,contractName,contractDate,packageClassification,specialTerms};
    });
    const created=rows.map(v=>{const row:HqRow={public_id:newHqId(d),company_id:c.actor.companyId,owner_user_id:opp.owner_user_id,organization_id:opp.organization_id,version:1,currency:opportunityCurrency(opp),account_public_id:account.public_id,opportunity_public_id:opp.public_id,contract_name:v.contractName,contract_date:v.contractDate,contract_amount:v.total,product_amount:v.productAmount,goods_amount:v.goodsAmount,package_classification:v.packageClassification,special_terms:v.specialTerms,status:'DRAFT',integration_status:'NOT_REQUESTED',erp_approval_status:'NOT_REQUESTED',erp_contract_no:null,close_yn:false,products:[cloneHq(v.product)],source_product_line_id:v.product.public_id,created_at:d.clock};d.collections.contracts.push(row);auditHq(d,c.actor,'CON.create',row.public_id,{opportunityPublicId:opp.public_id,productLineId:v.product.public_id});return visibleContract(c,d,row);});
    opp.contract_created_yn=true;opp.version++;return created;
  }));
  app.route('POST', '/api/contracts', c => c.repository.transact(d => {
    hqRequire(c.actor, 'CONTRACT.WRITE'); hqOnlyKeys(c.body, ['opportunityPublicId', 'productAmount', 'goodsAmount', 'contractName', 'contractDate', 'packageClassification', 'specialTerms']);
    const opp = opportunity(c, d, hqText(c.body.opportunityPublicId, 'opportunityPublicId')); owned(c, opp, 'CONTRACT.WRITE');
    const account = hqFind(d, c.actor, 'accounts', String(opp.account_public_id));
    hqAssert(opp.stage === 'CLOSED_WON' && account.erp_approved_yn === true && Number(opp.amount) > 0, 422, 'CONTRACT_NOT_READY');
    hqAssert(opp.contract_created_yn !== true && !d.collections.contracts.some(row => row.opportunity_public_id === opp.public_id), 409, 'CONTRACT_ALREADY_EXISTS');
    hqAssert(Array.isArray(opp.products) && opp.products.length > 0, 422, 'CONTRACT_PRODUCTS_REQUIRED');
    hqAssert(c.body.productAmount !== undefined || c.body.goodsAmount !== undefined, 400, 'CONTRACT_AMOUNT_REQUIRED');
    const productAmount = c.body.productAmount === undefined ? Math.max(0, Number(opp.amount) - hqNumber(c.body.goodsAmount, 'goodsAmount')) : hqNumber(c.body.productAmount, 'productAmount');
    const goodsAmount = c.body.goodsAmount === undefined ? Math.max(0, Number(opp.amount) - productAmount) : hqNumber(c.body.goodsAmount, 'goodsAmount');
    hqAssert(Math.abs(productAmount + goodsAmount - Number(opp.amount)) < 0.005, 422, 'CONTRACT_AMOUNT_MISMATCH');
    const contractDate = date(c.body.contractDate ?? d.clock.slice(0, 10), 'contractDate');
    app.requireAction(c.actor, 'CON.create', { ...opp, 'opportunity.stage': opp.stage, 'account.erpApprovedYn': account.erp_approved_yn }, { opportunityPublicId: opp.public_id, productAmount, goodsAmount, contractDate, specialTerms: c.body.specialTerms ?? '' });
    const row: HqRow = { public_id: newHqId(d), company_id: c.actor.companyId, owner_user_id: opp.owner_user_id, organization_id: opp.organization_id,
      version: 1, currency: opportunityCurrency(opp), account_public_id: account.public_id, opportunity_public_id: opp.public_id, contract_name: c.body.contractName === undefined ? `${opp.opportunity_name} 계약` : hqText(c.body.contractName, 'contractName', 200),
      contract_date: contractDate, contract_amount: Number(opp.amount), product_amount: productAmount, goods_amount: goodsAmount,
      package_classification: c.body.packageClassification === undefined ? null : hqText(c.body.packageClassification, 'packageClassification', 100),
      special_terms: c.body.specialTerms === undefined ? opp.special_terms ?? '' : String(c.body.specialTerms), status: 'DRAFT', integration_status: 'NOT_REQUESTED', erp_approval_status: 'NOT_REQUESTED', erp_contract_no: null,
      close_yn: false, products: cloneHq(opp.products), created_at: d.clock };
    hqAssert(String(row.special_terms).length <= 4000, 400, 'TERMS_TOO_LONG');
    d.collections.contracts.push(row); opp.contract_created_yn = true; opp.version++; auditHq(d, c.actor, 'CON.create', row.public_id, { opportunityPublicId: opp.public_id }); return visibleContract(c, d, row);
  }));
  app.route('GET', '/api/contracts/:publicId/collection-plans', c => {
    hqRequire(c.actor, 'COLLECTION.READ'); app.requireScreen(c.actor, 'HQ_CONTRACT'); const d = c.repository.read(), row = contract(c, d, c.params.publicId);
    return d.collections.plans.filter(p => p.contract_public_id === row.public_id && p.deleted_yn !== true && hqCanRead(c.actor, p)).sort((a, b) => Number(a.plan_version) - Number(b.plan_version) || Number(a.installment_no) - Number(b.installment_no)).map(p => { const visible = visiblePlan(c, p); if (!contractAmountsReadable(c, row)) delete visible.amount; return visible; });
  });
  app.route('GET', '/api/collection-plans', c => {
    hqRequire(c.actor, 'COLLECTION.READ'); hqRequire(c.actor, 'CONTRACT.READ'); app.requireScreen(c.actor, 'HQ_CONTRACT');
    const d = c.repository.read();
    const contracts = new Map(d.collections.contracts.filter(row => hqCanRead(c.actor, row)
      && d.collections.accounts.some(account => account.public_id === row.account_public_id && hqCanRead(c.actor, account))).map(row => [row.public_id, row]));
    return d.collections.plans.filter(row => row.is_current === true && contracts.has(String(row.contract_public_id)) && hqCanRead(c.actor, row))
      .map(row => { const contract = contracts.get(String(row.contract_public_id))!; const visible = visiblePlan(c, row); if (!contractAmountsReadable(c, contract)) delete visible.amount; return { ...visible, contract_name: contract.contract_name }; });
  });
  app.route('POST', '/api/contracts/:publicId/collection-plans', c => c.repository.transact(d => {
    const row = contract(c, d, c.params.publicId); owned(c, row, 'COLLECTION.PLAN.WRITE');
    hqAssert(completeCollectionAccess(c, d, row), 403, 'COLLECTION_SCOPE_INCOMPLETE');
    planExpectedVersion(c.body, row);
    hqAssert(['DRAFT', 'ERP_FAILED'].includes(String(row.status)), 409, 'ORIGINAL_PLAN_LOCKED');
    const input = planRows(c.body, Number(row.contract_amount), true);
    for (const line of input) app.requireAction(c.actor, 'COL.planOriginal', { ...row, 'contract.status': row.status }, { installmentNo: line.installment_no, collectionMethod: line.collection_method, amount: line.amount, plannedDate: line.planned_date });
    const existing = d.collections.plans.filter(p => p.contract_public_id === row.public_id && p.adjustment_type === 'ORIGINAL' && p.is_current === true);
    const ids = input.flatMap(line => line.publicId ? [line.publicId] : []);
    hqAssert(new Set(ids).size === ids.length && ids.every(id => existing.some(p => p.public_id === id)), 400, 'PLAN_ID_INVALID');
    if (ids.length) hqAssert(c.body.expectedVersion !== undefined, 400, 'VERSION_REQUIRED');
    for (const old of existing) { if (!ids.includes(old.public_id)) { old.is_current = false; old.deleted_yn = true; old.version++; } }
    d.collections.plans = d.collections.plans.filter(p => !ids.includes(p.public_id));
    const rows = input.map(({ publicId, ...line }) => { const previous = existing.find(p => p.public_id === publicId); return previous ? { ...previous, ...line, version: Number(previous.version) + 1 } : ({ ...line, public_id: newHqId(d), company_id: c.actor.companyId, owner_user_id: row.owner_user_id, version: 1,
      contract_public_id: row.public_id, ...(typeof row.currency === 'string' ? { currency: row.currency } : {}), plan_version: 1, adjustment_type: 'ORIGINAL', is_current: true, erp_sync_status: 'NOT_REQUESTED', correction_required_yn: false }); });
    d.collections.plans.push(...rows); row.version++; auditHq(d, c.actor, 'COL.planOriginal', row.public_id, { count: rows.length }); return rows.map(plan => visiblePlan(c, plan));
  }));
  app.route('DELETE', '/api/contracts/:publicId/collection-plans/:planId', c => c.repository.transact(d => {
    hqOnlyKeys(c.body, ['expectedVersion']);
    const row = contract(c, d, c.params.publicId); owned(c, row, 'COLLECTION.PLAN.WRITE');
    hqAssert(completeCollectionAccess(c, d, row), 403, 'COLLECTION_SCOPE_INCOMPLETE');
    hqAssert(c.body.expectedVersion !== undefined, 400, 'VERSION_REQUIRED'); planExpectedVersion(c.body, row);
    hqAssert(['DRAFT', 'ERP_FAILED'].includes(String(row.status)), 409, 'ORIGINAL_PLAN_LOCKED');
    app.requireActionAccess(c.actor, 'COL.planOriginal');
    const plan = d.collections.plans.find(p => p.public_id === c.params.planId && p.contract_public_id === row.public_id && p.adjustment_type === 'ORIGINAL' && p.is_current === true && p.deleted_yn !== true);
    hqAssert(plan, 404, 'PLAN_NOT_FOUND');
    plan.is_current = false; plan.deleted_yn = true; plan.version++; row.version++;
    auditHq(d, c.actor, 'COL.planDelete', row.public_id, { planId: plan.public_id });
    return { deleted: true, contractVersion: row.version, mode: 'MOCK' };
  }));
  app.route('POST', '/api/contracts/:publicId/erp-request', c => c.repository.transact(d => {
    hqOnlyKeys(c.body, ['idempotencyKey', 'expectedVersion']); const row = contract(c, d, c.params.publicId); owned(c, row, 'CONTRACT.ERP_REQUEST');
    hqAssert(completeCollectionAccess(c, d, row), 403, 'COLLECTION_SCOPE_INCOMPLETE');
    app.requireActionAccess(c.actor, 'CON.erpRequest');
    const requestKey = String(c.body.idempotencyKey ?? `contract:${row.public_id}:${row.version}`);
    const prior = d.collections.interfaceLogs.find(log => log.company_id === c.actor.companyId && log.interfaceCode === 'IF-ERP-004' && log.idempotencyKey === requestKey);
    if (prior) {
      if (Object.hasOwn(prior, 'request_expected_version')) hqAssert(prior.request_expected_version === (c.body.expectedVersion ?? null), 409, 'INTERFACE_IDEMPOTENCY_CONFLICT');
      else hqAssert(c.body.expectedVersion === undefined, 409, 'INTERFACE_IDEMPOTENCY_CONFLICT');
      const replay = enqueueInterface(d, c.actor, { interfaceCode: 'IF-ERP-004', entityType: 'CONTRACT', entityPublicId: row.public_id, idempotencyKey: requestKey, payload: {}, scenario: c.scenario });
      return { requestId: replay.requestId, status: replay.status, mode: 'MOCK' };
    }
    planExpectedVersion(c.body, row);
    const account = hqFind(d, c.actor, 'accounts', String(row.account_public_id));
    app.requireAction(c.actor, 'CON.erpRequest', { ...row, 'contract.status': row.status, 'account.erpApprovedYn': account.erp_approved_yn });
    const log = enqueueInterface(d, c.actor, { interfaceCode: 'IF-ERP-004', entityType: 'CONTRACT', entityPublicId: row.public_id,
      idempotencyKey: requestKey, payload: {}, scenario: c.scenario });
    log.request_expected_version = c.body.expectedVersion ?? null;
    return { requestId: log.requestId, status: log.status, mode: 'MOCK' };
  }, true));
  app.route('GET', '/api/contracts/:publicId/reconciliation', c => {
    hqRequire(c.actor, 'COLLECTION.READ'); app.requireScreen(c.actor, 'HQ_CONTRACT'); const d = c.repository.read(), row = contract(c, d, c.params.publicId);
    if (!completeCollectionAccess(c, d, row)) return { contractAmount: contractAmountsReadable(c, row) ? Number(row.contract_amount) : null, currentPlanTotal: null, actualTotal: null, outstandingAmount: null, overCollectionAmount: null, overduePlanTotal: null, correctionRequired: null, complete: false, mode: 'MOCK', asOf: d.clock };
    return { ...reconciliation(d, row), complete: true, mode: 'MOCK', asOf: d.clock };
  });
  app.route('GET', '/api/contracts/:publicId/collections', c => {
    hqRequire(c.actor, 'COLLECTION.READ'); app.requireScreen(c.actor, 'HQ_CONTRACT'); const d = c.repository.read(), row = contract(c, d, c.params.publicId);
    return d.collections.collections.filter(p => p.contract_public_id === row.public_id && hqCanRead(c.actor, p));
  });
  app.route('GET', '/api/contracts/:publicId/sales', c => {
    hqRequire(c.actor, 'SALES.READ'); app.requireScreen(c.actor, 'HQ_CONTRACT'); const d = c.repository.read(), row = contract(c, d, c.params.publicId);
    return d.collections.sales.filter(p => p.contract_public_id === row.public_id && hqCanRead(c.actor, p));
  });
  app.route('GET', '/api/contracts/:publicId/orders', c => {
    app.requireAction(c.actor, 'FUL.open'); app.requireScreen(c.actor, 'HQ_CONTRACT');
    const d = c.repository.read(), row = contract(c, d, c.params.publicId);
    const orders = d.collections.orders.filter(item => item.contract_public_id === row.public_id && hqCanRead(c.actor, item));
    const ids = new Set(orders.map(item => item.public_id));
    return { orders: orders.map(item => visibleOrderDelivery(c, item)), returns: d.collections.returns.filter(item => ids.has(String(item.order_public_id)) && hqCanRead(c.actor, item)) };
  });
  app.route('POST', '/api/contracts/:publicId/collection-plans/change', c => c.repository.transact(d => {
    const row = contract(c, d, c.params.publicId); owned(c, row, 'COLLECTION.PLAN.WRITE');
    hqAssert(completeCollectionAccess(c, d, row), 403, 'COLLECTION_SCOPE_INCOMPLETE');
    planExpectedVersion(c.body, row);
    hqAssert(row.status === 'ERP_APPROVED', 409, 'CONTRACT_APPROVAL_REQUIRED');
    hqAssert(!d.collections.plans.some(p => p.contract_public_id === row.public_id && p.is_current === true && p.erp_sync_status === 'REQUESTING'), 409, 'PLAN_SYNC_PENDING');
    const outstanding = reconciliation(d, row).outstandingAmount; hqAssert(outstanding > 0, 422, 'NO_OUTSTANDING_BALANCE');
    const input = planRows(c.body, outstanding);
    for (const line of input) app.requireAction(c.actor, 'COL.planChange', { ...row, 'contract.status': row.status }, { installmentNo: line.installment_no, collectionMethod: line.collection_method, amount: line.amount, plannedDate: line.planned_date });
    const version = Math.max(1, ...d.collections.plans.filter(p => p.contract_public_id === row.public_id).map(p => Number(p.plan_version))) + 1;
    for (const prior of d.collections.plans.filter(p => p.contract_public_id === row.public_id && p.is_current === true)) { prior.is_current = false; prior.version++; }
    const rows = input.map(({ publicId: _publicId, ...line }) => ({ ...line, public_id: newHqId(d), company_id: c.actor.companyId, owner_user_id: row.owner_user_id, version: 1,
      contract_public_id: row.public_id, ...(typeof row.currency === 'string' ? { currency: row.currency } : {}), plan_version: version, adjustment_type: 'ARREARS_REALLOCATION', is_current: true, erp_sync_status: 'NOT_REQUESTED', correction_required_yn: false }));
    d.collections.plans.push(...rows);
    const log = enqueueInterface(d, c.actor, { interfaceCode: 'IF-ERP-011', entityType: 'CONTRACT', entityPublicId: row.public_id,
      idempotencyKey: `plan:${row.public_id}:${version}`, payload: {}, scenario: c.scenario });
    auditHq(d, c.actor, 'COL.planChange', row.public_id, { version, requestId: log.requestId }); return { rows: rows.map(plan => visiblePlan(c, plan)), requestId: log.requestId, status: log.status, planVersion: version, mode: 'MOCK' };
  }));
}
