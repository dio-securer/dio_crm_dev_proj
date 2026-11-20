import type { HqApplication, HqRouteContext } from './app.js';
import { hqActivityTargetReadable, hqCanRead, hqDirectWorkTargetReadable, hqFind, hqOnlyKeys, hqReportForRead, hqRequire, hqText } from './app.js';
import { auditHq, canonicalHq, cloneHq, hqAssert, newHqId } from './model.js';
import type { HqDataset, HqRow } from './model.js';
import { enqueueInterface, retryInterface } from './interfaces.js';
import { installOpportunityActivityRoutes } from './opportunity-activity-routes.js';

const date = (value: unknown, label: string) => {
  const parsed = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00Z`) : NaN;
  hqAssert(typeof value === 'string' && Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value, 400, 'DATE_INVALID', label);
  return value;
};
const timestamp = (value: unknown) => {
  hqAssert(typeof value === 'string' && value.length >= 16 && value.slice(11, 14) !== '24:', 400, 'PLANNED_AT_INVALID');
  date(value.slice(0,10),'plannedAt');
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}+09:00`;
  hqAssert(Number.isFinite(Date.parse(zoned)), 400, 'PLANNED_AT_INVALID');
  return new Date(zoned).toISOString();
};
const optionalText = (value: unknown, max: number, label: string) => {
  hqAssert(value === undefined || (typeof value === 'string' && value.length <= max), 400, 'VALIDATION_ERROR', label);
  return value as string | undefined;
};
const coordinate = (value: unknown, min: number, max: number, label: string) => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  hqAssert(typeof number === 'number' && Number.isFinite(number) && number >= min && number <= max, 400, 'GPS_INVALID', label);
  return number;
};
const distance = (a: number, b: number, c: number, d: number) => {
  const rad = (n: number) => n * Math.PI / 180;
  const x = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(x)));
};
const owner = (c: HqRouteContext, row: HqRow) => hqAssert(row.owner_user_id === c.actor.userId, 403, 'OWNER_REQUIRED');
const event = (d: HqDataset, row: HqRow, action: string, actor: number, detail: Record<string, unknown> = {}) => {
  row.history = [...(Array.isArray(row.history) ? row.history : []), { at: d.clock, action, actorUserId: actor, ...detail }];
  row.version += 1;
};
const activity = (c: HqRouteContext, d: HqDataset, id: string) => {
  const row = hqFind(d, c.actor, 'activities', id);
  hqAssert(hqActivityTargetReadable(c, d, row), 404, 'NOT_FOUND');
  return row;
};
const report = (c: HqRouteContext, d: HqDataset, id: string) => hqFind(d, c.actor, 'reports', id);
const directWork = (c: HqRouteContext, d: HqDataset, id: string) => {
  const row = hqFind(d, c.actor, 'directWorks', id);
  hqAssert(hqDirectWorkTargetReadable(c, d, row), 404, 'NOT_FOUND');
  return row;
};
const relatedScreen = (type: string) => ({ LEAD: 'HQ_LEAD', ACCOUNT: 'HQ_ACCOUNT', OPPORTUNITY: 'HQ_OPPORTUNITY' } as const)[type as 'LEAD' | 'ACCOUNT' | 'OPPORTUNITY'];
const relatedScreenAllowed = (c: HqRouteContext, type: string) => {
  const screen = relatedScreen(type);
  return Boolean(screen && c.app.screenAllowed(c.actor, screen) && (type !== 'OPPORTUNITY' || c.app.screenAllowed(c.actor, 'HQ_ACCOUNT')));
};
const related = (c: HqRouteContext, d: HqDataset, type: string, id: string) => {
  const collection = ({ LEAD: 'leads', ACCOUNT: 'accounts', OPPORTUNITY: 'opportunities' } as const)[type as 'LEAD' | 'ACCOUNT' | 'OPPORTUNITY'];
  hqAssert(collection, 400, 'RELATED_TYPE_INVALID');
  hqAssert(relatedScreenAllowed(c, type), 403, 'SCREEN_ACCESS_DENIED', relatedScreen(type));
  hqRequire(c.actor, `${type}.READ`);
  const row = hqFind(d, c.actor, collection, id);
  if (type === 'OPPORTUNITY') hqRequire(c.actor, 'ACCOUNT.READ');
  const account = type === 'OPPORTUNITY' ? hqFind(d, c.actor, 'accounts', String(row.account_public_id)) : row;
  return { row, name: String(row.hospital_name ?? row.account_name ?? row.opportunity_name), latitude: account.latitude, longitude: account.longitude };
};
const serial = (d: HqDataset) => newHqId(d);

// Optional metadata keeps legacy HQ mock clients compatible; new UI sends both.
function reportMutation<T>(c:HqRouteContext, action:string, keys:string[], work:(c:HqRouteContext,d:HqDataset,row:HqRow)=>T):T {
  c.app.requireActionAccess(c.actor,action);
  hqOnlyKeys(c.body,[...keys,'expectedVersion','idempotencyKey']);
  const {expectedVersion,idempotencyKey,...body}=c.body;
  const key=idempotencyKey===undefined?undefined:hqText(idempotencyKey,'idempotencyKey',200);
  const fingerprint=canonicalHq({action,params:c.params,body,expectedVersion:expectedVersion??null});
  return c.repository.transact(d=>{
    const row=report(c,d,c.params.publicId);owner(c,row);
    if(action==='REP.edit')hqAssert((hqReportForRead(c,d,row).items as Record<string,unknown>[]).some(item=>item.report_item_id===Number(c.params.itemId)),404,'REPORT_ITEM_NOT_FOUND');
    if(key){const receipt=d.collections.auditLogs.find(entry=>entry.action==='REPORT_MUTATION_RECEIPT'&&entry.company_id===c.actor.companyId&&entry.owner_user_id===c.actor.userId&&(entry.detail as Record<string,unknown>)?.key===key);
      if(receipt){const detail=receipt.detail as Record<string,unknown>;hqAssert(detail.fingerprint===fingerprint,409,'IDEMPOTENCY_CONFLICT');return cloneHq(detail.response) as T;}}
    if(expectedVersion!==undefined){hqAssert(Number.isSafeInteger(expectedVersion)&&Number(expectedVersion)>0,400,'EXPECTED_VERSION_INVALID');hqAssert(row.version===expectedVersion,409,'VERSION_CONFLICT','다른 작업에서 보고서를 수정했습니다.');}
    if(action==='REP.edit')hqAssert(['DRAFT','BRANCH_REJECTED','DIVISION_REJECTED'].includes(String(row.status)),409,'REPORT_LOCKED');
    const clean={...c,body};c.app.requireAction(c.actor,action,row,body);
    const result=work(clean,d,row);
    if(key)auditHq(d,c.actor,'REPORT_MUTATION_RECEIPT',row.public_id,{key,fingerprint,response:cloneHq(result)});
    return result;
  },true);
}

function createPlan(c: HqRouteContext, d: HqDataset, body: Record<string, unknown>) {
  c.app.requireAction(c.actor, 'ACT.planOne', {}, body);
  hqOnlyKeys(body, ['relatedType', 'relatedPublicId', 'plannedAt', 'visitPurpose', 'subject', 'directWorkType', 'directWorkReason']);
  const type = hqText(body.relatedType, 'relatedType');
  const targetId = hqText(body.relatedPublicId, 'relatedPublicId');
  const at = timestamp(body.plannedAt);
  const plannedDate = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
  date(plannedDate, 'plannedAt');
  const purpose = optionalText(body.visitPurpose, 500, 'visitPurpose') ?? '';
  const subject = optionalText(body.subject, 200, 'subject');
  hqAssert(body.directWorkType === undefined || ['DIRECT_WORK', 'DIRECT_LEAVE'].includes(String(body.directWorkType)), 400, 'DIRECT_WORK_TYPE_INVALID');
  const reason = optionalText(body.directWorkReason, 500, 'directWorkReason');
  if (body.directWorkType) { hqAssert(c.app.capabilities.featureKeys.includes('DIRECT_WORK'), 403, 'FEATURE_DISABLED'); hqAssert(Boolean(reason?.trim()), 400, 'DIRECT_WORK_REASON_REQUIRED'); }
  else hqAssert(!reason, 400, 'DIRECT_WORK_TYPE_REQUIRED');
  const target = related(c, d, type, targetId);
  hqAssert(!d.collections.activities.some(a => a.company_id === c.actor.companyId && a.owner_user_id === c.actor.userId && a.related_type === type && a.related_public_id === targetId && a.planned_date === plannedDate), 409, 'ACTIVITY_PLAN_DUPLICATE');
  const id = serial(d);
  const row: HqRow = { public_id: id, activity_public_id: id, event_public_id: serial(d), company_id: c.actor.companyId, organization_id: c.actor.organizationId ?? 10,
    owner_user_id: c.actor.userId, version: 1, subject: subject?.trim() || `${target.name} 방문`, related_type: type, related_public_id: targetId,
    related_name_snapshot: target.name, target_latitude: target.latitude ?? null, target_longitude: target.longitude ?? null,
    planned_at: at, planned_date: plannedDate, start_at: at, end_at: new Date(Date.parse(at) + 3600000).toISOString(), visit_purpose: purpose,
    consultation_content: '', status: 'PLANNED', in_at: null, out_at: null, history: [] };
  d.collections.activities.push(row);
  let directWorkPublicId: string | null = null;
  if (body.directWorkType) {
    directWorkPublicId = serial(d);
    d.collections.directWorks.push({ public_id: directWorkPublicId, company_id: c.actor.companyId, organization_id: c.actor.organizationId ?? 10,
      owner_user_id: c.actor.userId, version: 1, activity_public_id: id, work_date: plannedDate, work_type: body.directWorkType, related_name_snapshot: target.name,
      direct_work_type: body.directWorkType, reason: reason!.trim(), status: 'DRAFT', approval_round: 1,
      branch_approver_user_id: 3, division_approver_user_id: 4, integration_status: 'NOT_REQUESTED', erp_sync_status: 'NOT_REQUESTED', erp_status: null, history: [] });
  }
  auditHq(d, c.actor, 'ACT.planOne', id, { relatedType: type, relatedPublicId: targetId, directWorkPublicId });
  return { eventPublicId: row.event_public_id, activityPublicId: id, directWorkPublicId, status: 'PLANNED', mode: 'MOCK' };
}

function queueDirectWork(c: HqRouteContext, d: HqDataset, row: HqRow) {
  const a = activity(c, d, String(row.activity_public_id));
  if (row.status !== 'DIVISION_APPROVED' || a.status !== 'COMPLETED' || row.integration_status !== 'NOT_REQUESTED') return null;
  const log = enqueueInterface(d, c.actor, { interfaceCode: 'IF-ERP-012', entityType: 'DIRECT_WORK', entityPublicId: row.public_id,
    idempotencyKey: `direct-work:${row.public_id}:${row.approval_round}`, payload: {}, scenario: c.scenario });
  row.erp_sync_status = 'REQUESTING';
  event(d, row, 'ERP_REQUESTED', c.actor.userId, { requestId: log.requestId });
  return log.requestId;
}

export function installActivityRoutes(app: HqApplication): void {
  installOpportunityActivityRoutes(app);
  app.route('POST', '/api/activities/plans', c => c.repository.transact(d => createPlan(c, d, c.body)));
  app.route('POST', '/api/activities/plans/bulk', c => c.repository.transact(d => {
    hqOnlyKeys(c.body, ['plans']);
    hqAssert(Array.isArray(c.body.plans) && c.body.plans.length > 0 && c.body.plans.length <= 100, 400, 'BULK_PLAN_SIZE_INVALID');
    hqAssert(c.body.plans.every(input => input !== null && typeof input === 'object' && !Array.isArray(input)), 400, 'BULK_PLAN_ITEM_INVALID');
    c.app.requireAction(c.actor, 'ACT.planBulk', {}, c.body.plans[0] as Record<string, unknown>);
    const items = c.body.plans.map(input => createPlan(c, d, input as Record<string, unknown>));
    return { createdCount: items.length, items, mode: 'MOCK' };
  }));
  app.route('GET', '/api/activities/calendar', c => {
    hqRequire(c.actor, 'ACTIVITY.READ'); const from = date(c.query.get('from'), 'from'), to = date(c.query.get('to'), 'to');
    c.app.requireAction(c.actor, 'ACT.calendar', {}, Object.fromEntries(c.query));
    hqAssert(from <= to, 400, 'DATE_RANGE_INVALID');
    const requestedOwner = c.query.get('ownerUserId') ? Number(c.query.get('ownerUserId')) : c.actor.userId;
    if (requestedOwner !== c.actor.userId) hqRequire(c.actor, 'ACTIVITY.MANAGE');
    const d = c.repository.read();
    return d.collections.activities.filter(row => row.company_id === c.actor.companyId && row.owner_user_id === requestedOwner && String(row.planned_date) >= from && String(row.planned_date) <= to && hqActivityTargetReadable(c, d, row)).sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
  });
  app.route('GET', '/api/activities/map/today', c => {
    hqRequire(c.actor, 'ACTIVITY.READ'); const d = c.repository.read(), on = date(c.query.get('date'), 'date');
    const lat = coordinate(c.query.get('latitude'), -90, 90, 'latitude'), lng = coordinate(c.query.get('longitude'), -180, 180, 'longitude');
    const radius = c.query.get('radiusKm') === null ? 10 : coordinate(c.query.get('radiusKm'), 0.1, 50, 'radiusKm');
    c.app.requireAction(c.actor, 'ACT.map', {}, { ...Object.fromEntries(c.query), latitude: lat, longitude: lng });
    const plans = d.collections.activities.filter(row => row.company_id === c.actor.companyId && row.owner_user_id === c.actor.userId && row.planned_date === on && hqActivityTargetReadable(c, d, row)
      && (row.related_type !== 'LEAD' || !d.collections.leads.some(lead => lead.public_id === row.related_public_id && lead.map_excluded_yn === true)));
    const nearbyHospitals = ([...d.collections.leads.map(row => ({ row, type: 'LEAD', name: row.hospital_name })), ...d.collections.accounts.map(row => ({ row, type: 'ACCOUNT', name: row.account_name }))])
      .filter(({ row, type }) => c.actor.permissions.includes(`${type}.READ`) && relatedScreenAllowed(c, type) && hqCanRead(c.actor, row)
        && row.map_excluded_yn !== true && row.latitude != null && row.longitude != null)
      .map(({ row, type, name }) => ({ public_id: row.public_id, related_type: type, name, latitude: row.latitude, longitude: row.longitude,
        distance_m: distance(lat, lng, Number(row.latitude), Number(row.longitude)) }))
      .filter(row => row.distance_m <= radius * 1000).sort((a, b) => a.distance_m - b.distance_m).slice(0, 200);
    return { date: on, userLocation: { latitude: lat, longitude: lng }, plans, nearbyHospitals, mapProvider: 'HQ_MOCK' };
  });
  app.route('POST', '/api/activities/:publicId/check-in', c => c.repository.transact(d => {
    const row = activity(c, d, c.params.publicId); owner(c, row); c.app.requireAction(c.actor, 'ACT.checkIn', row);
    hqOnlyKeys(c.body, ['latitude', 'longitude', 'accuracyM', 'isMocked']);
    const lat = coordinate(c.body.latitude, -90, 90, 'latitude'), lng = coordinate(c.body.longitude, -180, 180, 'longitude');
    hqAssert(row.target_latitude != null && row.target_longitude != null, 422, 'TARGET_COORDINATES_MISSING');
    hqAssert(!d.collections.activities.some(a => a.company_id === c.actor.companyId && a.owner_user_id === c.actor.userId && a.status === 'IN_PROGRESS' && a.public_id !== row.public_id), 409, 'OTHER_ACTIVITY_OPEN');
    const meters = distance(lat, lng, Number(row.target_latitude), Number(row.target_longitude));
    hqAssert(meters <= 200, 422, 'GPS_DISTANCE_EXCEEDED');
    row.status = 'IN_PROGRESS'; row.in_at = d.clock; row.in_latitude = lat; row.in_longitude = lng; row.in_distance_m = meters;
    event(d, row, 'CHECK_IN', c.actor.userId, { distanceM: meters }); auditHq(d, c.actor, 'ACT.checkIn', row.public_id);
    return { publicId: row.public_id, status: row.status, distanceM: meters, allowedDistanceM: 200 };
  }));
  app.route('PATCH', '/api/activities/:publicId', c => c.repository.transact(d => {
    const row = activity(c, d, c.params.publicId); owner(c, row); c.app.requireAction(c.actor, 'ACT.consultation', row);
    hqOnlyKeys(c.body, ['visitPurpose', 'consultationContent']);
    if (c.body.visitPurpose !== undefined) row.visit_purpose = optionalText(c.body.visitPurpose, 500, 'visitPurpose');
    if (c.body.consultationContent !== undefined) row.consultation_content = optionalText(c.body.consultationContent, 10000, 'consultationContent');
    event(d, row, 'CONSULTATION_SAVED', c.actor.userId); auditHq(d, c.actor, 'ACT.consultation', row.public_id); return row;
  }));
  app.route('POST', '/api/activities/:publicId/check-out', c => c.repository.transact(d => {
    const row = activity(c, d, c.params.publicId); owner(c, row); c.app.requireAction(c.actor, 'ACT.checkOut', row);
    hqOnlyKeys(c.body, ['latitude', 'longitude', 'accuracyM', 'isMocked']);
    row.out_latitude = coordinate(c.body.latitude, -90, 90, 'latitude'); row.out_longitude = coordinate(c.body.longitude, -180, 180, 'longitude');
    row.status = 'COMPLETED'; row.out_at = d.clock; event(d, row, 'CHECK_OUT', c.actor.userId); auditHq(d, c.actor, 'ACT.checkOut', row.public_id);
    const dw = d.collections.directWorks.find(x => x.company_id === c.actor.companyId && x.activity_public_id === row.public_id);
    if (dw) queueDirectWork(c, d, dw);
    return { publicId: row.public_id, status: row.status };
  }));
  app.route('POST', '/api/activity-reports/prepare', c => c.repository.transact(d => {
    c.app.requireAction(c.actor, 'REP.prepare', {}, c.body); hqRequire(c.actor, 'ACTIVITY.WRITE'); hqOnlyKeys(c.body, ['reportDate']);
    const on = date(c.body.reportDate, 'reportDate');
    let row = d.collections.reports.find(x => x.company_id === c.actor.companyId && x.owner_user_id === c.actor.userId && x.report_date === on);
    if (!row) { row = { public_id: serial(d), company_id: c.actor.companyId, organization_id: c.actor.organizationId ?? 10, owner_user_id: c.actor.userId,
      reporter_user_id: c.actor.userId, version: 1, report_date: on, status: 'DRAFT', items: [], comments: [], history: [] }; d.collections.reports.push(row); }
    if (row.status === 'DRAFT') {
      const source = d.collections.activities.filter(a => a.company_id === c.actor.companyId && a.owner_user_id === c.actor.userId && hqActivityTargetReadable(c, d, a) && ((a.planned_date === on && a.status === 'COMPLETED') || (a.status !== 'CANCELLED' && String(a.planned_date) > on && String(a.planned_date) <= new Date(Date.parse(`${on}T00:00:00Z`) + 5 * 86400000).toISOString().slice(0, 10))));
      const previous = (Array.isArray(row.items) ? row.items : []) as Record<string,unknown>[];
      const visibleIds = new Set((hqReportForRead(c,d,row).items as Record<string,unknown>[]).map(item=>item.report_item_id));
      const hidden = previous.filter(item=>!visibleIds.has(item.report_item_id));
      const hiddenActivityIds = new Set(hidden.map(item=>item.activity_public_id));
      let nextItemId = Math.max(0,...previous.map(item=>Number(item.report_item_id)||0))+1;
      row.items = source.filter(a=>!hiddenActivityIds.has(a.public_id)).map(a => { const old=previous.find(item=>item.activity_public_id===a.public_id);const edited=Array.isArray(old?.edited_fields)?old.edited_fields:old?['visitPurpose','consultationContent']:[];
        return { report_item_id: old?.report_item_id ?? nextItemId++, item_type: a.planned_date === on ? 'RESULT' : 'PLAN', activity_public_id: a.public_id,
        planned_at_snapshot: a.planned_at, in_at_snapshot: a.in_at ?? null, out_at_snapshot: a.out_at ?? null, related_type: a.related_type, related_public_id: a.related_public_id, related_name_snapshot: a.related_name_snapshot, account_public_id_snapshot:a.related_type === 'ACCOUNT' ? a.related_public_id : a.related_type === 'OPPORTUNITY' ? d.collections.opportunities.find(opp=>opp.public_id===a.related_public_id)?.account_public_id ?? null : null,
        visit_purpose_snapshot: edited.includes('visitPurpose') ? old?.visit_purpose_snapshot ?? '' : a.visit_purpose, consultation_snapshot: edited.includes('consultationContent') ? old?.consultation_snapshot ?? '' : a.consultation_content, edited_fields:edited, activity_version_snapshot:a.version, owner_user_id: a.owner_user_id }; });
      (row.items as Record<string,unknown>[]).push(...hidden);
      event(d, row, 'REPORT_PREPARED', c.actor.userId);
    }
    return hqReportForRead(c, d, row);
  }));
  app.route('PATCH', '/api/activity-reports/:publicId/items/:itemId', c => reportMutation(c,'REP.edit',['visitPurpose','consultationContent'],(c,d,row) => {
    hqAssert(['DRAFT', 'BRANCH_REJECTED', 'DIVISION_REJECTED'].includes(String(row.status)), 409, 'REPORT_LOCKED');
    const item = (row.items as Record<string, unknown>[]).find(x => x.report_item_id === Number(c.params.itemId)); hqAssert(item, 404, 'REPORT_ITEM_NOT_FOUND');
    if (c.body.visitPurpose !== undefined) item.visit_purpose_snapshot = optionalText(c.body.visitPurpose, 500, 'visitPurpose');
    if (c.body.consultationContent !== undefined) item.consultation_snapshot = optionalText(c.body.consultationContent, 10000, 'consultationContent');
    item.edited_fields=[...new Set([...(Array.isArray(item.edited_fields)?item.edited_fields:[]),...Object.keys(c.body)])];
    event(d, row, 'REPORT_ITEM_SAVED', c.actor.userId, { itemId: Number(c.params.itemId) }); return { reportPublicId: row.public_id, itemId: Number(c.params.itemId), updated: true };
  }));
  app.route('POST', '/api/activity-reports/:publicId/request-approval', c => reportMutation(c,'REP.request',[],(c,d,row) => {
    hqAssert(['DRAFT', 'BRANCH_REJECTED', 'DIVISION_REJECTED'].includes(String(row.status)), 409, 'REPORT_REQUEST_NOT_ALLOWED');
    hqAssert((Array.isArray(row.items)?row.items:[]).length === (hqReportForRead(c,d,row).items as unknown[]).length,409,'REPORT_SOURCE_NOT_READABLE','조회할 수 없는 활동이 포함되어 승인 요청할 수 없습니다.');
    hqAssert(!d.collections.activities.some(a => a.company_id === c.actor.companyId && a.owner_user_id === c.actor.userId && a.planned_date === row.report_date && a.status === 'IN_PROGRESS'), 409, 'ACTIVITY_OUT_REQUIRED');
    row.status = 'REQUESTED'; row.branch_approver_user_id = 3; row.division_approver_user_id = 4; row.requested_at = d.clock;
    row.approval_round = Number(row.approval_round ?? 0) + 1;
    row.submission_snapshots = [...(Array.isArray(row.submission_snapshots) ? row.submission_snapshots : []), { snapshot_public_id:serial(d), approval_round:row.approval_round, submitted_at:d.clock, report_date:row.report_date, timezone:'Asia/Seoul', standard_version:c.app.standardFor(c.actor).version, branch_approver_user_id:row.branch_approver_user_id, division_approver_user_id:row.division_approver_user_id, items:cloneHq(row.items ?? []) }];
    event(d, row, 'REPORT_REQUESTED', c.actor.userId); return { reportPublicId: row.public_id, status: row.status };
  }));
  app.route('POST', '/api/activity-reports/:publicId/comment/:step', c => c.repository.transact(d => {
    const row = report(c, d, c.params.publicId), step = c.params.step.toUpperCase();
    hqAssert(step === 'BRANCH' || step === 'DIVISION', 400, 'APPROVAL_STEP_INVALID'); hqRequire(c.actor, `ACTIVITY.REPORT.APPROVE.${step}`);
    c.app.requireAction(c.actor, step === 'BRANCH' ? 'REP.commentBranch' : 'REP.commentDivision', row, c.body);
    hqAssert(row[step === 'BRANCH' ? 'branch_approver_user_id' : 'division_approver_user_id'] === c.actor.userId, 403, 'APPROVER_REQUIRED');
    hqAssert(row.status === (step === 'BRANCH' ? 'REQUESTED' : 'BRANCH_APPROVED'), 409, 'REPORT_STEP_INVALID');
    hqOnlyKeys(c.body, ['comment']); const comment = hqText(c.body.comment, 'comment', 1000);
    row[step === 'BRANCH' ? 'branch_comment' : 'division_comment'] = comment;
    event(d, row, 'COMMENT_SAVED', c.actor.userId, { step }); return hqReportForRead(c, d, row);
  }));
  app.route('POST','/api/activity-reports/:publicId/items/:itemId/accompany/:step',c => {
    const step=c.params.step.toUpperCase();hqAssert(step==='BRANCH'||step==='DIVISION',400,'APPROVAL_STEP_INVALID');
    hqRequire(c.actor,`ACTIVITY.REPORT.APPROVE.${step}`);const action=step==='BRANCH'?'REP.commentBranch':'REP.commentDivision';c.app.requireActionAccess(c.actor,action);
    hqOnlyKeys(c.body,['accompany','expectedVersion','idempotencyKey']);
    const {accompany,expectedVersion,idempotencyKey}=c.body;hqAssert(typeof accompany==='boolean',400,'ACCOMPANIMENT_INVALID');
    hqAssert(Number.isSafeInteger(expectedVersion)&&Number(expectedVersion)>0,400,'EXPECTED_VERSION_INVALID');
    const key=idempotencyKey===undefined?undefined:hqText(idempotencyKey,'idempotencyKey',200);
    const fingerprint=canonicalHq({action:'ACCOMPANY',params:c.params,accompany,expectedVersion});
    return c.repository.transact(d=>{
      const row=report(c,d,c.params.publicId);hqAssert(row[step==='BRANCH'?'branch_approver_user_id':'division_approver_user_id']===c.actor.userId,403,'APPROVER_REQUIRED');
      const visible=hqReportForRead(c,d,row);hqAssert((visible.items as Record<string,unknown>[]).some(item=>item.report_item_id===Number(c.params.itemId)),404,'NOT_FOUND');
      if(key){const receipt=d.collections.auditLogs.find(entry=>entry.action==='REPORT_ACCOMPANY_RECEIPT'&&entry.company_id===c.actor.companyId&&entry.owner_user_id===c.actor.userId&&(entry.detail as Record<string,unknown>)?.key===key);if(receipt){const detail=receipt.detail as Record<string,unknown>;hqAssert(detail.fingerprint===fingerprint,409,'IDEMPOTENCY_CONFLICT');return cloneHq(detail.response);}}
      hqAssert(row.version===expectedVersion,409,'VERSION_CONFLICT','다른 작업에서 보고서를 수정했습니다.');
      c.app.requireAction(c.actor,action,row,{});hqAssert(row.status===(step==='BRANCH'?'REQUESTED':'BRANCH_APPROVED'),409,'REPORT_STEP_INVALID');
      const item=(row.items as Record<string,unknown>[]).find(entry=>entry.report_item_id===Number(c.params.itemId));hqAssert(item&&item.item_type==='PLAN',400,'ACCOMPANIMENT_PLAN_REQUIRED');
      item[step==='BRANCH'?'branch_accompany_yn':'division_accompany_yn']=accompany;event(d,row,'ACCOMPANIMENT_SAVED',c.actor.userId,{step,itemId:Number(c.params.itemId),accompany});
      const result={reportPublicId:row.public_id,itemId:Number(c.params.itemId),step,accompany,version:row.version};if(key)auditHq(d,c.actor,'REPORT_ACCOMPANY_RECEIPT',row.public_id,{key,fingerprint,response:cloneHq(result)});return result;
    },true);
  });
  for (const step of ['branch', 'division'] as const) for (const decision of ['approve', 'reject'] as const) {
    app.route('POST', `/api/activity-reports/:publicId/${decision}/${step}`, c => c.repository.transact(d => {
      const row = report(c, d, c.params.publicId), upper = step.toUpperCase(); hqRequire(c.actor, `ACTIVITY.REPORT.APPROVE.${upper}`);
      c.app.requireAction(c.actor, decision === 'approve' ? (step === 'branch' ? 'REP.approveBranch' : 'REP.approveDivision') : (step === 'branch' ? 'REP.rejectBranch' : 'REP.rejectDivision'), row, c.body);
      hqAssert(row[step === 'branch' ? 'branch_approver_user_id' : 'division_approver_user_id'] === c.actor.userId, 403, 'APPROVER_REQUIRED');
      hqAssert(row.status === (step === 'branch' ? 'REQUESTED' : 'BRANCH_APPROVED'), 409, 'REPORT_STEP_INVALID');
      hqOnlyKeys(c.body, ['comment']); const comment = optionalText(c.body.comment, 1000, 'comment');
      if (decision === 'reject') hqAssert(Boolean(comment?.trim() || row[step === 'branch' ? 'branch_comment' : 'division_comment']), 400, 'REJECTION_REASON_REQUIRED');
      if (comment?.trim()) row[step === 'branch' ? 'branch_comment' : 'division_comment'] = comment.trim();
      row.status = decision === 'reject' ? (step === 'branch' ? 'BRANCH_REJECTED' : 'DIVISION_REJECTED') : (step === 'branch' ? 'BRANCH_APPROVED' : 'FINAL_APPROVED');
      if (row.status === 'FINAL_APPROVED') row.final_approved_at = d.clock;
      event(d, row, `REPORT_${decision.toUpperCase()}`, c.actor.userId, { step: upper, comment: row[step === 'branch' ? 'branch_comment' : 'division_comment'] ?? '' });
      auditHq(d, c.actor, `REP.${decision}.${step}`, row.public_id); return { reportPublicId: row.public_id, status: row.status };
    }));
  }
  app.route('POST', '/api/direct-work/:publicId/request-approval', c => c.repository.transact(d => {
    const row = directWork(c, d, c.params.publicId); owner(c, row); c.app.requireAction(c.actor, 'DW.request', row);
    hqAssert(['DRAFT', 'BRANCH_REJECTED', 'DIVISION_REJECTED'].includes(String(row.status)), 409, 'DIRECT_WORK_REQUEST_NOT_ALLOWED');
    if (row.status !== 'DRAFT') row.approval_round = Number(row.approval_round) + 1;
    row.status = 'REQUESTED'; row.branch_approver_user_id = 3; row.division_approver_user_id = 4; row.requested_at = d.clock;
    event(d, row, 'DIRECT_WORK_REQUESTED', c.actor.userId); return { publicId: row.public_id, status: row.status, approvalRound: row.approval_round };
  }));
  for (const step of ['branch', 'division'] as const) app.route('POST', `/api/direct-work/:publicId/decision/${step}`, c => c.repository.transact(d => {
    const row = directWork(c, d, c.params.publicId), upper = step.toUpperCase(); hqRequire(c.actor, `DIRECT_WORK.APPROVE.${upper}`);
    c.app.requireAction(c.actor, `DW.decision.${step}`, row, c.body);
    hqAssert(row[step === 'branch' ? 'branch_approver_user_id' : 'division_approver_user_id'] === c.actor.userId, 403, 'APPROVER_REQUIRED');
    hqAssert(row.status === (step === 'branch' ? 'REQUESTED' : 'BRANCH_APPROVED'), 409, 'DIRECT_WORK_STEP_INVALID');
    hqOnlyKeys(c.body, ['action', 'comment']); hqAssert(c.body.action === 'APPROVE' || c.body.action === 'REJECT', 400, 'DECISION_INVALID');
    const comment = optionalText(c.body.comment, 1000, 'comment');
    if (c.body.action === 'REJECT') hqAssert(Boolean(comment?.trim()), 400, 'REJECTION_REASON_REQUIRED');
    row.status = c.body.action === 'REJECT' ? (step === 'branch' ? 'BRANCH_REJECTED' : 'DIVISION_REJECTED') : (step === 'branch' ? 'BRANCH_APPROVED' : 'DIVISION_APPROVED');
    event(d, row, `DIRECT_WORK_${c.body.action}`, c.actor.userId, { step: upper, comment: comment ?? '' });
    if (row.status === 'DIVISION_APPROVED') queueDirectWork(c, d, row);
    return { publicId: row.public_id, status: row.status, approvalRound: row.approval_round };
  }));
  app.route('GET', '/api/direct-work/approvers', c => {
    hqRequire(c.actor, 'DIRECT_WORK.MANAGE'); c.app.requireScreen(c.actor, 'HQ_DIRECT_WORK');
    const step = hqText(c.query.get('step'), 'step'); hqAssert(['BRANCH', 'DIVISION'].includes(step), 400, 'APPROVAL_STEP_INVALID');
    return app.personas.filter(user => user.companyId === c.actor.companyId && user.permissions.includes(`DIRECT_WORK.APPROVE.${step}`))
      .map(user => ({ userId: user.userId, name: user.name, organizationId: user.organizationId }));
  });
  app.route('POST', '/api/direct-work/:publicId/reassign', c => c.repository.transact(d => {
    const row = directWork(c, d, c.params.publicId); hqRequire(c.actor, 'DIRECT_WORK.MANAGE');
    c.app.requireAction(c.actor, 'DW.reassign', row, c.body);
    hqOnlyKeys(c.body, ['step', 'approverUserId', 'reason']);
    const step = hqText(c.body.step, 'step'); hqAssert(['BRANCH', 'DIVISION'].includes(step), 400, 'APPROVAL_STEP_INVALID');
    hqAssert(row.status === (step === 'BRANCH' ? 'REQUESTED' : 'BRANCH_APPROVED'), 409, 'DIRECT_WORK_STEP_INVALID');
    const id = c.body.approverUserId; hqAssert(Number.isInteger(id) && Number(id) > 0, 400, 'APPROVER_INVALID');
    const candidate = app.personas.find(user => user.userId === id && user.companyId === c.actor.companyId && user.permissions.includes(`DIRECT_WORK.APPROVE.${step}`));
    hqAssert(candidate && (step !== 'BRANCH' || candidate.organizationId === row.organization_id), 400, 'APPROVER_INVALID');
    const reason = hqText(c.body.reason, 'reason', 500);
    const key = step === 'BRANCH' ? 'branch_approver_user_id' : 'division_approver_user_id';
    const before = row[key]; row[key] = id;
    event(d, row, 'DIRECT_WORK_REASSIGNED', c.actor.userId, { step, before, after: id, reason });
    auditHq(d, c.actor, 'DW.reassign', row.public_id, { step, before, after: id }); return row;
  }));
  app.route('POST', '/api/direct-work/:publicId/erp/retry', c => c.repository.transact(d => {
    const row = directWork(c, d, c.params.publicId); hqRequire(c.actor, 'DIRECT_WORK.APPROVE.DIVISION');
    c.app.requireAction(c.actor, 'DW.erpRetry', row, c.body);
    hqAssert(row.status === 'DIVISION_APPROVED' && activity(c, d, String(row.activity_public_id)).status === 'COMPLETED', 409, 'DIRECT_WORK_APPROVAL_AND_OUT_REQUIRED');
    const prior = d.collections.interfaceLogs.filter(x => x.businessKey.entityId === row.public_id && x.interfaceCode === 'IF-ERP-012').at(-1);
    hqAssert(prior && ['FAILED', 'TIMED_OUT'].includes(prior.status), 409, 'INTERFACE_NOT_RETRYABLE');
    hqOnlyKeys(c.body, ['idempotencyKey']); const key = hqText(c.body.idempotencyKey, 'idempotencyKey');
    const next = retryInterface(d, c.actor, prior.requestId, key, c.scenario); row.erp_sync_status = 'REQUESTING';
    event(d, row, 'ERP_RETRIED', c.actor.userId, { requestId: next.requestId }); return { requestId: next.requestId, status: next.status };
  }));
}
