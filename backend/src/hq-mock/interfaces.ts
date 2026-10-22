import { HQ_INTERFACE_CODES, auditHq, canonicalHq, cloneHq, hqAssert, newHqId } from './model.js';
import type { HqActor, HqBusinessCollection, HqDataset, HqInterfaceCode, HqInterfaceLog, HqInterfaceResult, HqInterfaceScenario, HqRow } from './model.js';

/** Every catalog interface has an explicit payload and business-state handler. */
export const HQ_INTERFACE_REGISTRY: Record<HqInterfaceCode, { entity: string; collection?: HqBusinessCollection; response: HqInterfaceCode; direction: 'IN' | 'OUT' }> = {
  'IF-HIRA-001': { entity: 'HIRA_BATCH', response: 'IF-HIRA-001', direction: 'IN' },
  'IF-ERP-001': { entity: 'REGION', response: 'IF-ERP-001', direction: 'IN' },
  'IF-ERP-002': { entity: 'ACCOUNT', collection: 'accounts', response: 'IF-ERP-003', direction: 'OUT' },
  'IF-ERP-003': { entity: 'ACCOUNT', collection: 'accounts', response: 'IF-ERP-003', direction: 'IN' },
  'IF-ERP-004': { entity: 'CONTRACT', collection: 'contracts', response: 'IF-ERP-005', direction: 'OUT' },
  'IF-ERP-005': { entity: 'CONTRACT', collection: 'contracts', response: 'IF-ERP-005', direction: 'IN' },
  'IF-ERP-006': { entity: 'PRODUCT_CATALOG', response: 'IF-ERP-006', direction: 'IN' },
  'IF-ERP-007': { entity: 'ORDER', collection: 'orders', response: 'IF-ERP-008', direction: 'OUT' },
  'IF-ERP-008': { entity: 'ORDER', collection: 'orders', response: 'IF-ERP-008', direction: 'IN' },
  'IF-ERP-009': { entity: 'CONTRACT', collection: 'contracts', response: 'IF-ERP-009', direction: 'IN' },
  'IF-ERP-010': { entity: 'ACCOUNT', collection: 'accounts', response: 'IF-ERP-010', direction: 'IN' },
  'IF-ERP-011': { entity: 'CONTRACT', collection: 'contracts', response: 'IF-ERP-011', direction: 'OUT' },
  'IF-ERP-012': { entity: 'DIRECT_WORK', collection: 'directWorks', response: 'IF-ERP-013', direction: 'OUT' },
  'IF-ERP-013': { entity: 'DIRECT_WORK', collection: 'directWorks', response: 'IF-ERP-013', direction: 'IN' },
  'IF-ERP-014': { entity: 'ORDER', collection: 'orders', response: 'IF-ERP-014', direction: 'IN' }
};
const SCENARIOS: HqInterfaceScenario[] = ['SUCCESS', 'BUSINESS_REJECTED', 'TRANSIENT_FAILURE', 'TIMEOUT', 'DELAYED', 'DUPLICATE', 'OUT_OF_ORDER'];
const OBJECT = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function shape(value: unknown, allowed: string[], required: string[] = []): asserts value is Record<string, unknown> {
  hqAssert(OBJECT(value), 400, 'INTERFACE_PAYLOAD_INVALID');
  hqAssert(Object.keys(value).every(k => allowed.includes(k)), 400, 'INTERFACE_UNKNOWN_FIELD');
  for (const key of required) hqAssert(value[key] !== undefined && value[key] !== null && value[key] !== '', 400, 'INTERFACE_FIELD_REQUIRED', key);
}
function text(value: unknown, name: string, max = 500): asserts value is string { hqAssert(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 400, 'INTERFACE_TEXT_INVALID', name); }
function finite(value: unknown, name: string, min = 0): asserts value is number { hqAssert(typeof value === 'number' && Number.isFinite(value) && value >= min, 400, 'INTERFACE_NUMBER_INVALID', name); }
function date(value: unknown, name: string) {
  text(value, name, 40);
  hqAssert(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && Number.isFinite(Date.parse(value)), 400, 'INTERFACE_DATE_INVALID', name);
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  hqAssert(year >= 1000 && calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day, 400, 'INTERFACE_DATE_INVALID', name);
}
function uuid(value: unknown, name: string): asserts value is string { hqAssert(typeof value === 'string' && UUID.test(value), 400, 'INTERFACE_ID_INVALID', name); }
function rows(value: unknown, key: string): Record<string, unknown>[] { hqAssert(Array.isArray(value) && value.length > 0 && value.length <= 500 && value.every(OBJECT), 400, 'INTERFACE_ROWS_INVALID', key); return value; }
const get = (d: HqDataset, company: number, collection: HqBusinessCollection, id: unknown) => {
  const row = d.collections[collection].find(item => item.public_id === id && item.company_id === company);
  hqAssert(row, 404, 'INTERFACE_ENTITY_NOT_FOUND'); return row;
};
const idFields: Partial<Record<HqInterfaceCode, string>> = { 'IF-ERP-002': 'accountPublicId', 'IF-ERP-003': 'accountPublicId', 'IF-ERP-004': 'contractPublicId', 'IF-ERP-005': 'contractPublicId', 'IF-ERP-007': 'orderPublicId', 'IF-ERP-008': 'orderPublicId', 'IF-ERP-009': 'contractPublicId', 'IF-ERP-010': 'accountPublicId', 'IF-ERP-011': 'contractPublicId', 'IF-ERP-012': 'directWorkPublicId', 'IF-ERP-013': 'directWorkPublicId', 'IF-ERP-014': 'orderPublicId' };
const fieldLists: Record<HqInterfaceCode, string[]> = {
  'IF-HIRA-001': ['hospitals'], 'IF-ERP-001': ['regions'],
  'IF-ERP-002': ['accountPublicId', 'accountName', 'businessNo', 'businessName', 'ceoName', 'phone', 'address', 'zipCode', 'taxEmail', 'providerNo', 'accountType', 'ownerUserId', 'companyCode'],
  'IF-ERP-003': ['accountPublicId', 'erpCustomerCode', 'approved', 'message'],
  'IF-ERP-004': ['contractPublicId', 'contractName', 'amount', 'productAmount', 'goodsAmount', 'products', 'collectionPlans'],
  'IF-ERP-005': ['contractPublicId', 'erpContractNo', 'approved', 'message'],
  'IF-ERP-006': ['products'],
  'IF-ERP-007': ['orderPublicId', 'contractPublicId', 'amount', 'items', 'deliveryAddress', 'expressYn', 'note'],
  'IF-ERP-008': ['orderPublicId', 'erpOrderNo', 'status', 'deliveries', 'message'],
  'IF-ERP-009': ['contractPublicId', 'rows'],
  'IF-ERP-010': ['accountPublicId', 'rows'],
  'IF-ERP-011': ['contractPublicId', 'planVersion', 'rows', 'accepted'],
  'IF-ERP-012': ['directWorkPublicId', 'activityPublicId', 'workType', 'reason', 'outAt'],
  'IF-ERP-013': ['directWorkPublicId', 'erpReferenceNo', 'approved', 'message'],
  'IF-ERP-014': ['orderPublicId', 'rows']
};

function validatePayload(code: HqInterfaceCode, payload: Record<string, unknown>, response: boolean): void {
  shape(payload, fieldLists[code]);
  const id = idFields[code]; if (id && payload[id] !== undefined) uuid(payload[id], id);
  for (const key of ['approved', 'accepted', 'expressYn']) if (payload[key] !== undefined) hqAssert(typeof payload[key] === 'boolean', 400, 'INTERFACE_BOOLEAN_INVALID', key);
  for (const key of ['amount', 'productAmount', 'goodsAmount', 'planVersion', 'ownerUserId']) if (payload[key] !== undefined) finite(payload[key], key);
  for (const key of ['accountName', 'businessNo', 'businessName', 'ceoName', 'phone', 'address', 'zipCode', 'taxEmail', 'providerNo', 'accountType', 'companyCode', 'contractName', 'deliveryAddress', 'erpCustomerCode', 'erpContractNo', 'erpOrderNo', 'erpReferenceNo', 'reason', 'workType', 'outAt', 'message', 'note']) {
    if (payload[key] !== undefined && payload[key] !== null) hqAssert(typeof payload[key] === 'string' && String(payload[key]).length <= 4000, 400, 'INTERFACE_TEXT_INVALID', key);
  }
  if (code === 'IF-HIRA-001' && payload.hospitals !== undefined) for (const row of rows(payload.hospitals, 'hospitals')) {
    shape(row, ['encryptedProviderNo', 'providerNo', 'hospitalName', 'phone', 'address', 'sido', 'sigungu', 'latitude', 'longitude', 'openDate'], ['encryptedProviderNo', 'hospitalName']);
    for (const [k, v] of Object.entries(row)) if (!['latitude', 'longitude'].includes(k) && v !== null) text(v, k);
    if (row.latitude !== undefined && row.latitude !== null) { finite(row.latitude, 'latitude', -90); hqAssert(row.latitude <= 90, 400, 'INTERFACE_LATITUDE_INVALID'); }
    if (row.longitude !== undefined && row.longitude !== null) { finite(row.longitude, 'longitude', -180); hqAssert(row.longitude <= 180, 400, 'INTERFACE_LONGITUDE_INVALID'); }
  }
  if (code === 'IF-ERP-001' && payload.regions !== undefined) for (const row of rows(payload.regions, 'regions')) {
    shape(row, ['sido', 'sigungu', 'ownerUserId'], ['sido', 'sigungu', 'ownerUserId']); text(row.sido, 'sido'); text(row.sigungu, 'sigungu'); finite(row.ownerUserId, 'ownerUserId', 1); hqAssert(Number.isInteger(row.ownerUserId), 400, 'INTERFACE_OWNER_INVALID');
  }
  if (code === 'IF-ERP-006' && payload.products !== undefined) for (const row of rows(payload.products, 'products')) {
    shape(row, ['productPublicId', 'erpItemCode', 'itemName', 'itemType', 'category', 'unitPrice', 'stockQty', 'orderAvailable'], ['erpItemCode', 'itemName', 'itemType', 'unitPrice', 'stockQty', 'orderAvailable']);
    if (row.productPublicId !== undefined) uuid(row.productPublicId, 'productPublicId');
    text(row.erpItemCode, 'erpItemCode'); text(row.itemName, 'itemName'); if (row.category !== undefined) text(row.category, 'category');
    hqAssert(['PACKAGE', 'PRODUCT'].includes(String(row.itemType)), 400, 'INTERFACE_PRODUCT_TYPE_INVALID'); finite(row.unitPrice, 'unitPrice'); finite(row.stockQty, 'stockQty', -9999999); hqAssert(typeof row.orderAvailable === 'boolean', 400, 'INTERFACE_BOOLEAN_INVALID');
  }
  if ((code === 'IF-ERP-004' && payload.products !== undefined) || (code === 'IF-ERP-007' && payload.items !== undefined)) {
    const source = code === 'IF-ERP-004' ? payload.products : payload.items;
    for (const row of rows(source, code === 'IF-ERP-004' ? 'products' : 'items')) {
      shape(row, ['public_id', 'product_public_id', 'package_public_id', 'item_name', 'quantity', 'unit_price', 'proposed_unit_price', 'amount', 'note'], ['quantity']);
      hqAssert(typeof (row.product_public_id ?? row.package_public_id) === 'string', 400, 'INTERFACE_PRODUCT_ID_REQUIRED');
      for (const key of ['public_id', 'product_public_id', 'package_public_id']) if (row[key] !== undefined) uuid(row[key], key);
      finite(row.quantity, 'quantity', 1); hqAssert(Number.isInteger(row.quantity), 400, 'INTERFACE_QUANTITY_INVALID');
      for (const key of ['unit_price', 'proposed_unit_price', 'amount']) if (row[key] !== undefined) finite(row[key], key);
      for (const key of ['item_name', 'note']) if (row[key] !== undefined) hqAssert(typeof row[key] === 'string', 400, 'INTERFACE_TEXT_INVALID', key);
    }
  }
  if (code === 'IF-ERP-004' && payload.collectionPlans !== undefined) for (const row of rows(payload.collectionPlans, 'collectionPlans')) {
    shape(row, ['installmentNo', 'amount', 'plannedDate', 'collectionMethod'], ['installmentNo', 'amount', 'plannedDate', 'collectionMethod']);
    finite(row.installmentNo, 'installmentNo', 1); hqAssert(Number.isInteger(row.installmentNo), 400, 'INTERFACE_INSTALLMENT_INVALID');
    finite(row.amount, 'amount', 0.01); date(row.plannedDate, 'plannedDate'); text(row.collectionMethod, 'collectionMethod');
  }
  if (code === 'IF-ERP-007' && payload.contractPublicId !== undefined) uuid(payload.contractPublicId, 'contractPublicId');
  if (code === 'IF-ERP-012' && payload.activityPublicId !== undefined) uuid(payload.activityPublicId, 'activityPublicId');
  if (code === 'IF-ERP-008') {
    if (payload.status !== undefined) hqAssert(['ACCEPTED', 'PROCESSING', 'COMPLETED', 'FAILED'].includes(String(payload.status)), 400, 'INTERFACE_ORDER_STATUS_INVALID');
    if (payload.deliveries !== undefined) for (const row of rows(payload.deliveries, 'deliveries')) {
      shape(row, ['erpDeliveryNo', 'deliveryStatus', 'shippedAt', 'deliveredAt'], ['erpDeliveryNo', 'deliveryStatus']); text(row.erpDeliveryNo, 'erpDeliveryNo');
      hqAssert(['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(String(row.deliveryStatus)), 400, 'INTERFACE_DELIVERY_STATUS_INVALID');
      if (row.shippedAt !== undefined) date(row.shippedAt, 'shippedAt'); if (row.deliveredAt !== undefined) date(row.deliveredAt, 'deliveredAt');
    }
  }
  if (code === 'IF-ERP-009' && payload.rows !== undefined) for (const row of rows(payload.rows, 'rows')) {
    shape(row, ['erpCollectionNo', 'amount', 'collectedAt', 'version'], ['erpCollectionNo', 'amount', 'collectedAt']); text(row.erpCollectionNo, 'erpCollectionNo'); finite(row.amount, 'amount', 0.01); date(row.collectedAt, 'collectedAt'); if (row.version !== undefined) { finite(row.version, 'version', 1); hqAssert(Number.isInteger(row.version), 400, 'INTERFACE_VERSION_INVALID'); }
  }
  if (code === 'IF-ERP-010' && payload.rows !== undefined) for (const row of rows(payload.rows, 'rows')) {
    shape(row, ['erpSalesNo', 'salesDate', 'amount', 'contractPublicId', 'orderPublicId', 'itemCode', 'itemName', 'quantity', 'version'], ['erpSalesNo', 'salesDate', 'amount']); text(row.erpSalesNo, 'erpSalesNo'); date(row.salesDate, 'salesDate'); finite(row.amount, 'amount');
    for (const k of ['contractPublicId', 'orderPublicId']) if (row[k] !== undefined) uuid(row[k], k);
    if (row.quantity !== undefined) finite(row.quantity, 'quantity', 0);
    for (const k of ['itemCode', 'itemName']) if (row[k] !== undefined) text(row[k], k);
    if (row.version !== undefined) { finite(row.version, 'version', 1); hqAssert(Number.isInteger(row.version), 400, 'INTERFACE_VERSION_INVALID'); }
  }
  if (code === 'IF-ERP-011') {
    if (payload.planVersion !== undefined) hqAssert(Number.isInteger(payload.planVersion) && Number(payload.planVersion) > 0, 400, 'INTERFACE_PLAN_VERSION_INVALID');
    if (payload.rows !== undefined) for (const row of rows(payload.rows, 'rows')) { shape(row, ['installmentNo', 'amount', 'plannedDate', 'collectionMethod'], ['installmentNo', 'amount', 'plannedDate', 'collectionMethod']); finite(row.installmentNo, 'installmentNo', 1); hqAssert(Number.isInteger(row.installmentNo), 400, 'INTERFACE_INSTALLMENT_INVALID'); finite(row.amount, 'amount', 0.01); date(row.plannedDate, 'plannedDate'); text(row.collectionMethod, 'collectionMethod'); }
  }
  if (code === 'IF-ERP-014' && payload.rows !== undefined) for (const row of rows(payload.rows, 'rows')) {
    shape(row, ['erpReferenceNo', 'transactionType', 'status', 'erpSalesNo', 'itemCode', 'quantity', 'amount', 'processedAt', 'version'], ['erpReferenceNo', 'transactionType', 'status', 'quantity', 'processedAt']);
    text(row.erpReferenceNo, 'erpReferenceNo'); hqAssert(['RETURN', 'EXCHANGE'].includes(String(row.transactionType)), 400, 'INTERFACE_RETURN_TYPE_INVALID');
    hqAssert(['REQUESTED', 'PROCESSING', 'COMPLETED', 'REJECTED'].includes(String(row.status)), 400, 'INTERFACE_RETURN_STATUS_INVALID'); finite(row.quantity, 'quantity', 1); hqAssert(Number.isInteger(row.quantity), 400, 'INTERFACE_QUANTITY_INVALID'); date(row.processedAt, 'processedAt');
    if (row.amount !== undefined) finite(row.amount, 'amount'); if (row.version !== undefined) { finite(row.version, 'version', 1); hqAssert(Number.isInteger(row.version), 400, 'INTERFACE_VERSION_INVALID'); }
    for (const k of ['erpSalesNo', 'itemCode']) if (row[k] !== undefined) text(row[k], k);
  }
  if (response) {
    const required: Partial<Record<HqInterfaceCode, string[]>> = { 'IF-HIRA-001': ['hospitals'], 'IF-ERP-001': ['regions'], 'IF-ERP-003': ['erpCustomerCode'], 'IF-ERP-005': ['erpContractNo'], 'IF-ERP-006': ['products'], 'IF-ERP-008': ['erpOrderNo', 'status'], 'IF-ERP-009': ['rows'], 'IF-ERP-010': ['rows'], 'IF-ERP-011': ['planVersion', 'accepted'], 'IF-ERP-013': ['erpReferenceNo', 'approved'], 'IF-ERP-014': ['rows'] };
    for (const key of required[code] ?? []) hqAssert(payload[key] !== undefined && payload[key] !== null && payload[key] !== '', 400, 'INTERFACE_RESULT_REQUIRED', key);
  }
}

export interface EnqueueInterfaceInput {
  interfaceCode: HqInterfaceCode;
  entityType: string;
  entityPublicId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  scenario?: HqInterfaceScenario;
}
function sourceSnapshot(d: HqDataset, actor: HqActor, code: HqInterfaceCode, entity: HqRow | undefined, input: Record<string, unknown>): Record<string, unknown> {
  if (!entity || HQ_INTERFACE_REGISTRY[code].direction === 'IN') return cloneHq(input);
  if (code === 'IF-ERP-002') {
    const values = { accountPublicId: entity.public_id, accountName: entity.account_name, businessNo: entity.business_no, businessName: entity.business_name, ceoName: entity.ceo_name, phone: entity.phone, address: entity.address, zipCode: entity.zip_code, taxEmail: entity.tax_email, providerNo: entity.provider_no, accountType: entity.account_type, ownerUserId: entity.owner_user_id, companyCode: entity.company_code };
    for (const key of ['accountName', 'businessNo', 'ceoName', 'address']) text(values[key as keyof typeof values], key);
    return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
  }
  if (code === 'IF-ERP-004' || code === 'IF-ERP-011') {
    const plans = d.collections.plans.filter(r => r.company_id === actor.companyId && r.contract_public_id === entity.public_id && r.is_current === true);
    const planRows = plans.map(r => ({ installmentNo: r.installment_no, amount: r.amount, plannedDate: r.planned_date, collectionMethod: r.collection_method }));
    if (code === 'IF-ERP-011') return { contractPublicId: entity.public_id, planVersion: Math.max(0, ...plans.map(r => Number(r.plan_version))), rows: planRows };
    return { contractPublicId: entity.public_id, contractName: entity.contract_name, amount: entity.contract_amount, productAmount: entity.product_amount ?? 0, goodsAmount: entity.goods_amount ?? 0, products: cloneHq(entity.products ?? []), collectionPlans: planRows };
  }
  if (code === 'IF-ERP-007') return { orderPublicId: entity.public_id, contractPublicId: entity.contract_public_id, amount: entity.order_amount, items: cloneHq(entity.items ?? []), deliveryAddress: entity.delivery_address, expressYn: entity.express_yn ?? false, note: entity.note ?? '' };
  if (code === 'IF-ERP-012') { const a = get(d, actor.companyId, 'activities', entity.activity_public_id); return { directWorkPublicId: entity.public_id, activityPublicId: a.public_id, workType: entity.direct_work_type, reason: entity.reason, outAt: a.out_at ?? '' }; }
  return cloneHq(input);
}
function outboundEligible(d: HqDataset, a: HqActor, code: HqInterfaceCode, e: HqRow) {
  if (code === 'IF-ERP-002') hqAssert(e.erp_approved_yn !== true && e.integration_status !== 'REQUESTING', 409, 'ERP_ACCOUNT_ALREADY_PENDING_OR_APPROVED');
  if (code === 'IF-ERP-004') {
    hqAssert(['DRAFT', 'ERP_FAILED'].includes(String(e.status)), 409, 'ERP_CONTRACT_STATE_INVALID');
    hqAssert(get(d, a.companyId, 'accounts', e.account_public_id).erp_approved_yn === true, 409, 'ERP_ACCOUNT_APPROVAL_REQUIRED');
    const plans = d.collections.plans.filter(r => r.company_id === a.companyId && r.contract_public_id === e.public_id && r.is_current === true);
    hqAssert(plans.length > 0 && Math.abs(plans.reduce((s, p) => s + Number(p.amount), 0) - Number(e.contract_amount)) < 0.005, 422, 'ERP_PLAN_TOTAL_MISMATCH');
  }
  if (code === 'IF-ERP-007') {
    hqAssert(['DRAFT', 'FAILED'].includes(String(e.status)), 409, 'ERP_ORDER_STATE_INVALID');
    const contract = get(d, a.companyId, 'contracts', e.contract_public_id);
    hqAssert(contract.status === 'ERP_APPROVED' && !contract.close_yn && get(d, a.companyId, 'accounts', e.account_public_id).erp_approved_yn === true, 409, 'ERP_ORDER_APPROVAL_REQUIRED');
    text(e.delivery_address, 'deliveryAddress'); const items = rows(e.items, 'items');
    let total = 0;
    for (const item of items) { const product = get(d, a.companyId, 'products', item.product_public_id); finite(item.quantity, 'quantity', 1); hqAssert(Number.isInteger(item.quantity), 422, 'ORDER_QUANTITY_INVALID'); finite(item.unit_price, 'unitPrice'); hqAssert(product.order_available_yn === true && Number(product.stock_qty) >= item.quantity, 409, 'ORDER_PRODUCT_UNAVAILABLE'); total += item.quantity * item.unit_price; }
    hqAssert(Math.abs(total - Number(e.order_amount)) < 0.005, 422, 'ORDER_AMOUNT_MISMATCH');
    const reserved = d.collections.orders.filter(r => r.company_id === a.companyId && r.contract_public_id === contract.public_id && r.public_id !== e.public_id && ['REQUESTING', 'ACCEPTED', 'PROCESSING', 'COMPLETED'].includes(String(r.status))).reduce((s, r) => s + Number(r.order_amount), 0);
    hqAssert(total + reserved <= Number(contract.contract_amount) + 0.004, 409, 'ORDER_CONTRACT_BALANCE_EXCEEDED');
  }
  if (code === 'IF-ERP-011') {
    hqAssert(e.status === 'ERP_APPROVED', 409, 'ERP_CONTRACT_APPROVAL_REQUIRED');
    const plans = d.collections.plans.filter(p => p.company_id === a.companyId && p.contract_public_id === e.public_id && p.is_current === true);
    const actual = d.collections.collections.filter(r => r.company_id === a.companyId && r.contract_public_id === e.public_id).reduce((s, r) => s + Number(r.amount), 0);
    const outstanding = Number(e.contract_amount) - actual;
    hqAssert(outstanding > 0 && plans.length > 0 && Math.abs(plans.reduce((s, p) => s + Number(p.amount), 0) - outstanding) < 0.005, 422, 'ERP_CHANGED_PLAN_TOTAL_MISMATCH');
  }
  if (code === 'IF-ERP-012') { const activity = get(d, a.companyId, 'activities', e.activity_public_id); hqAssert(activity.status === 'COMPLETED' && !!activity.out_at && e.status === 'DIVISION_APPROVED', 409, 'DIRECT_WORK_APPROVAL_AND_OUT_REQUIRED'); }
}
export function enqueueInterface(d: HqDataset, actor: HqActor, input: EnqueueInterfaceInput): HqInterfaceLog {
  shape(input, ['interfaceCode', 'entityType', 'entityPublicId', 'idempotencyKey', 'payload', 'scenario'], ['interfaceCode', 'entityType', 'entityPublicId', 'idempotencyKey', 'payload']);
  hqAssert((HQ_INTERFACE_CODES as readonly string[]).includes(input.interfaceCode), 400, 'INTERFACE_NOT_REGISTERED');
  const config = HQ_INTERFACE_REGISTRY[input.interfaceCode];
  hqAssert(input.entityType === config.entity, 400, 'INTERFACE_BUSINESS_TYPE_MISMATCH'); uuid(input.entityPublicId, 'entityPublicId'); text(input.idempotencyKey, 'idempotencyKey', 200);
  hqAssert(SCENARIOS.includes(input.scenario ?? 'SUCCESS'), 400, 'INTERFACE_SCENARIO_INVALID');
  validatePayload(input.interfaceCode, input.payload, false);
  const idField = idFields[input.interfaceCode]; if (idField && input.payload[idField] !== undefined) hqAssert(input.payload[idField] === input.entityPublicId, 400, 'INTERFACE_BUSINESS_KEY_MISMATCH');
  const fingerprint = canonicalHq({ interfaceCode: input.interfaceCode, entityType: input.entityType, entityPublicId: input.entityPublicId, payload: input.payload, scenario: input.scenario ?? 'SUCCESS' });
  const prior = d.collections.interfaceLogs.find(r => r.company_id === actor.companyId && r.interfaceCode === input.interfaceCode && r.idempotencyKey === input.idempotencyKey);
  if (prior) { hqAssert(prior.payloadFingerprint === fingerprint, 409, 'INTERFACE_IDEMPOTENCY_CONFLICT'); return prior; }
  const entity = config.collection ? get(d, actor.companyId, config.collection, input.entityPublicId) : undefined;
  if (entity && config.direction === 'OUT') outboundEligible(d, actor, input.interfaceCode, entity);
  const snapshot = sourceSnapshot(d, actor, input.interfaceCode, entity, input.payload);
  validatePayload(input.interfaceCode, snapshot, false);
  const earlier = d.collections.interfaceLogs.filter(r => r.company_id === actor.companyId && r.businessKey.entityId === input.entityPublicId && HQ_INTERFACE_REGISTRY[r.interfaceCode].response === config.response);
  const requestId = newHqId(d);
  const log: HqInterfaceLog = { public_id: requestId, requestId, company_id: actor.companyId, owner_user_id: actor.userId, version: 1,
    datasetId: d.datasetId, generation: d.generation, mode: 'MOCK', interfaceCode: input.interfaceCode,
    sourceSystem: config.direction === 'OUT' ? 'CRM' : input.interfaceCode === 'IF-HIRA-001' ? 'HIRA' : 'ERP', targetSystem: config.direction === 'OUT' ? 'ERP' : 'CRM',
    businessKey: { entityType: input.entityType, entityId: input.entityPublicId }, idempotencyKey: input.idempotencyKey, payload: snapshot,
    requestedAt: d.clock, status: 'REQUESTING', scenario: input.scenario ?? 'SUCCESS', requestRevision: Math.max(0, ...earlier.map(r => r.requestRevision)) + 1,
    attempt: 1, payloadFingerprint: fingerprint, resultFingerprints: {}, resultVersion: 0, events: [] };
  log.events.push({ eventId: newHqId(d), at: d.clock, kind: 'ENQUEUED' });
  d.collections.interfaceLogs.push(log);
  if (entity && config.direction === 'OUT') {
    entity.integration_status = 'REQUESTING'; entity.integration_request_id = requestId; entity.version += 1;
    if (input.interfaceCode === 'IF-ERP-004') entity.status = 'ERP_REQUESTED';
    if (input.interfaceCode === 'IF-ERP-007') entity.status = 'REQUESTING';
    if (input.interfaceCode === 'IF-ERP-011') for (const p of d.collections.plans.filter(p => p.contract_public_id === entity.public_id && p.company_id === actor.companyId && p.is_current === true)) { p.erp_sync_status = 'REQUESTING'; p.version += 1; }
  }
  auditHq(d, actor, 'INTERFACE_ENQUEUED', input.entityPublicId, { requestId, interfaceCode: input.interfaceCode });
  return log;
}

function eventUpsert(d: HqDataset, a: HqActor, collection: 'collections' | 'sales' | 'returns' | 'deliveries', key: string, externalId: string, values: Record<string, unknown>, eventVersion: number, owner?: number): void {
  const prior = d.collections[collection].find(row => row.company_id === a.companyId && row[key] === externalId);
  const fingerprint = canonicalHq(values);
  if (prior) {
    for (const id of ['contract_public_id', 'account_public_id', 'order_public_id']) if (values[id] !== undefined && prior[id] !== undefined) hqAssert(values[id] === prior[id], 409, 'INTERFACE_EXTERNAL_KEY_CONFLICT');
    const beforeVersion = Number(prior.external_version ?? 1);
    if (eventVersion < beforeVersion) return;
    if (eventVersion === beforeVersion) { hqAssert(prior.external_fingerprint === fingerprint, 409, 'INTERFACE_EVENT_VERSION_CONFLICT'); return; }
    Object.assign(prior, cloneHq(values), { external_version: eventVersion, external_fingerprint: fingerprint, version: prior.version + 1 });
  } else {
    d.collections[collection].push({ public_id: newHqId(d), company_id: a.companyId, ...(owner ? { owner_user_id: owner } : {}), organization_id: a.organizationId ?? 10, version: 1,
      ...cloneHq(values), [key]: externalId, source_system: 'ERP', external_version: eventVersion, external_fingerprint: fingerprint });
  }
}
function applyBusiness(d: HqDataset, actor: HqActor, log: HqInterfaceLog, result: HqInterfaceResult): void {
  const code = result.interfaceCode, p = result.payload, config = HQ_INTERFACE_REGISTRY[log.interfaceCode];
  const entity = config.collection ? get(d, actor.companyId, config.collection, log.businessKey.entityId) : undefined;
  const resultVersion = result.version ?? 1;
  if (!result.success) {
    if (entity) {
      entity.integration_status = 'FAILED'; entity.version += 1;
      if (code === 'IF-ERP-005') entity.status = 'ERP_FAILED';
      if (code === 'IF-ERP-008') entity.status = 'FAILED';
      if (code === 'IF-ERP-013') entity.erp_status = 'FAILED';
      if (code === 'IF-ERP-011') for (const plan of d.collections.plans.filter(row => row.company_id === actor.companyId && row.contract_public_id === entity.public_id && row.is_current)) { plan.erp_sync_status = 'FAILED'; plan.version += 1; }
    }
    return;
  }
  if (code === 'IF-ERP-003') {
    hqAssert(p.approved !== false, 422, 'INTERFACE_APPROVAL_SUCCESS_MISMATCH');
    Object.assign(entity!, { erp_customer_code: p.erpCustomerCode, erp_approved_yn: true, integration_status: 'SUCCESS', erp_approval_code: 'CM840500', erp_trade_code: 'BC5110', account_status: 'ACTIVE', updated_at: d.clock, version: entity!.version + 1 });
  } else if (code === 'IF-ERP-005') {
    hqAssert(p.approved !== false, 422, 'INTERFACE_APPROVAL_SUCCESS_MISMATCH');
    hqAssert(get(d, actor.companyId, 'accounts', entity!.account_public_id).erp_approved_yn === true, 409, 'ERP_ACCOUNT_APPROVAL_REQUIRED');
    Object.assign(entity!, { erp_contract_no: p.erpContractNo, status: 'ERP_APPROVED', erp_approval_status: 'APPROVED', integration_status: 'SUCCESS', version: entity!.version + 1 });
  } else if (code === 'IF-ERP-008') {
    hqAssert(p.status !== 'FAILED', 422, 'INTERFACE_ORDER_SUCCESS_MISMATCH');
    const contract = get(d, actor.companyId, 'contracts', entity!.contract_public_id);
    hqAssert(contract.status === 'ERP_APPROVED', 409, 'ERP_CONTRACT_APPROVAL_REQUIRED');
    Object.assign(entity!, { erp_order_no: p.erpOrderNo, status: p.status, integration_status: 'SUCCESS', version: entity!.version + 1 });
    for (const row of (p.deliveries ?? []) as Record<string, unknown>[]) eventUpsert(d, actor, 'deliveries', 'erp_delivery_no', String(row.erpDeliveryNo), {
      order_public_id: entity!.public_id, delivery_status: row.deliveryStatus,
      ...(row.shippedAt ? { shipped_at: row.shippedAt } : {}), ...(row.deliveredAt ? { delivered_at: row.deliveredAt } : {})
    }, resultVersion, entity!.owner_user_id);
  } else if (code === 'IF-ERP-009') {
    for (const row of p.rows as Record<string, unknown>[]) eventUpsert(d, actor, 'collections', 'erp_collection_no', String(row.erpCollectionNo), {
      contract_public_id: entity!.public_id, amount: row.amount, collected_at: row.collectedAt
    }, Number(row.version ?? resultVersion), entity!.owner_user_id);
  } else if (code === 'IF-ERP-010') {
    for (const row of p.rows as Record<string, unknown>[]) {
      if (row.contractPublicId) hqAssert(get(d, actor.companyId, 'contracts', row.contractPublicId).account_public_id === entity!.public_id, 422, 'INTERFACE_ACCOUNT_RELATION_MISMATCH');
      if (row.orderPublicId) { const order = get(d, actor.companyId, 'orders', row.orderPublicId); hqAssert(order.account_public_id === entity!.public_id && (!row.contractPublicId || order.contract_public_id === row.contractPublicId), 422, 'INTERFACE_ORDER_RELATION_MISMATCH'); }
      eventUpsert(d, actor, 'sales', 'erp_sales_no', String(row.erpSalesNo), { account_public_id: entity!.public_id, sales_date: row.salesDate, amount: row.amount,
        ...(row.contractPublicId ? { contract_public_id: row.contractPublicId } : {}), ...(row.orderPublicId ? { order_public_id: row.orderPublicId } : {}),
        ...(row.itemCode ? { item_code: row.itemCode } : {}), ...(row.itemName ? { item_name: row.itemName } : {}), ...(row.quantity !== undefined ? { quantity: row.quantity } : {})
      }, Number(row.version ?? resultVersion), entity!.owner_user_id);
    }
  } else if (code === 'IF-ERP-011') {
    hqAssert(p.accepted === true, 422, 'INTERFACE_PLAN_SUCCESS_MISMATCH');
    const plans = d.collections.plans.filter(row => row.company_id === actor.companyId && row.contract_public_id === entity!.public_id && row.is_current === true);
    hqAssert(plans.length > 0 && plans.every(row => row.plan_version === p.planVersion), 409, 'INTERFACE_PLAN_VERSION_CONFLICT');
    for (const row of plans) { row.erp_sync_status = 'SUCCESS'; row.version += 1; }
    entity!.integration_status = 'SUCCESS'; entity!.version += 1;
  } else if (code === 'IF-ERP-013') {
    hqAssert(p.approved === true, 422, 'INTERFACE_APPROVAL_SUCCESS_MISMATCH');
    hqAssert(entity!.status === 'DIVISION_APPROVED', 409, 'DIRECT_WORK_APPROVAL_REQUIRED');
    Object.assign(entity!, { erp_reference_no: p.erpReferenceNo, erp_status: 'APPROVED', integration_status: 'SUCCESS', version: entity!.version + 1 });
  } else if (code === 'IF-ERP-014') {
    for (const row of p.rows as Record<string, unknown>[]) {
      if (row.erpSalesNo) hqAssert(d.collections.sales.some(s => s.company_id === actor.companyId && s.erp_sales_no === row.erpSalesNo && (!s.order_public_id || s.order_public_id === entity!.public_id)), 422, 'INTERFACE_SALES_REFERENCE_INVALID');
      eventUpsert(d, actor, 'returns', 'erp_reference_no', String(row.erpReferenceNo), { order_public_id: entity!.public_id, transaction_type: row.transactionType, status: row.status, quantity: row.quantity, processed_at: row.processedAt,
        ...(row.amount !== undefined ? { amount: row.amount } : {}), ...(row.itemCode ? { item_code: row.itemCode } : {}), ...(row.erpSalesNo ? { erp_sales_no: row.erpSalesNo } : {})
      }, Number(row.version ?? resultVersion), entity!.owner_user_id);
    }
  } else if (code === 'IF-ERP-001') {
    for (const region of p.regions as Record<string, unknown>[]) {
      let current = d.collections.regions.find(row => row.company_id === actor.companyId && row.sido === region.sido && row.sigungu === region.sigungu);
      if (!current) { current = { public_id: newHqId(d), company_id: actor.companyId, version: 1 }; d.collections.regions.push(current); }
      Object.assign(current, { sido: region.sido, sigungu: region.sigungu, assigned_user_id: region.ownerUserId, source_system: 'ERP', version: current.version + 1 });
      for (const lead of d.collections.leads.filter(row => row.company_id === actor.companyId && row.sido === region.sido && row.sigungu === region.sigungu && !((row.manual_fields ?? []) as string[]).includes('owner_user_id'))) { lead.owner_user_id = Number(region.ownerUserId); lead.version += 1; }
    }
  } else if (code === 'IF-HIRA-001') {
    const mapping: Record<string, string> = { encryptedProviderNo: 'encrypted_provider_no', providerNo: 'provider_no', hospitalName: 'hospital_name', phone: 'phone', address: 'address', sido: 'sido', sigungu: 'sigungu', latitude: 'latitude', longitude: 'longitude', openDate: 'open_date' };
    for (const hospital of p.hospitals as Record<string, unknown>[]) {
      let lead = d.collections.leads.find(row => row.company_id === actor.companyId && row.encrypted_provider_no === hospital.encryptedProviderNo);
      if (!lead) { lead = { public_id: newHqId(d), company_id: actor.companyId, organization_id: actor.organizationId ?? 10, version: 1, status: 'NEW', manual_fields: [], history: [], source_system: 'HIRA' }; d.collections.leads.push(lead); }
      const targets = [lead, ...d.collections.accounts.filter(row => row.company_id === actor.companyId && row.encrypted_provider_no === hospital.encryptedProviderNo)];
      for (const target of targets) {
        const manual = (target.manual_fields ?? []) as string[];
        for (const [key, value] of Object.entries(hospital)) { const field = key === 'hospitalName' && target !== lead ? 'account_name' : mapping[key]; if (!manual.includes(field) && !manual.includes(key)) target[field] = value; }
        target.version += 1;
      }
      const region = d.collections.regions.find(row => row.company_id === actor.companyId && row.sido === hospital.sido && row.sigungu === hospital.sigungu);
      if (region && !((lead.manual_fields ?? []) as string[]).includes('owner_user_id')) lead.owner_user_id = Number(region.assigned_user_id);
    }
  } else if (code === 'IF-ERP-006') {
    for (const product of p.products as Record<string, unknown>[]) {
      let current = d.collections.products.find(row => row.company_id === actor.companyId && row.erp_item_code === product.erpItemCode);
      if (product.productPublicId) {
        const byId = get(d, actor.companyId, 'products', product.productPublicId);
        hqAssert(byId.erp_item_code === product.erpItemCode && (!current || byId.public_id === current.public_id), 409, 'INTERFACE_PRODUCT_KEY_CONFLICT'); current = byId;
      }
      if (!current) { current = { public_id: newHqId(d), company_id: actor.companyId, version: 1 }; d.collections.products.push(current); }
      Object.assign(current, { erp_item_code: product.erpItemCode, item_name: product.itemName, item_type: product.itemType, category: product.category ?? '', unit_price: product.unitPrice, base_price: product.unitPrice,
        stock_qty: product.stockQty, order_available_yn: product.orderAvailable, source_system: 'ERP', erp_synced_at: d.clock, version: current.version + 1 });
    }
  }
}
export function applyInterfaceResult(d: HqDataset, actor: HqActor, result: HqInterfaceResult): HqInterfaceLog {
  shape(result, ['requestId', 'resultId', 'interfaceCode', 'generation', 'businessKey', 'success', 'payload', 'version', 'message'], ['requestId', 'resultId', 'interfaceCode', 'generation', 'businessKey', 'success', 'payload']);
  uuid(result.requestId, 'requestId'); text(result.resultId, 'resultId', 200);
  hqAssert(result.generation === d.generation, 409, 'INTERFACE_GENERATION_MISMATCH');
  hqAssert(typeof result.success === 'boolean', 400, 'INTERFACE_BOOLEAN_INVALID');
  hqAssert(Number.isSafeInteger(result.version ?? 1) && Number(result.version ?? 1) > 0, 400, 'INTERFACE_VERSION_INVALID');
  const log = d.collections.interfaceLogs.find(r => r.requestId === result.requestId && r.company_id === actor.companyId);
  hqAssert(log, 404, 'INTERFACE_REQUEST_NOT_FOUND');
  shape(result.businessKey, ['entityType', 'entityId'], ['entityType', 'entityId']);
  hqAssert(canonicalHq(result.businessKey) === canonicalHq(log.businessKey), 409, 'INTERFACE_BUSINESS_KEY_MISMATCH');
  hqAssert(result.interfaceCode === HQ_INTERFACE_REGISTRY[log.interfaceCode].response, 400, 'INTERFACE_RESPONSE_CODE_MISMATCH');
  validatePayload(result.interfaceCode, result.payload, result.success);
  const key = idFields[result.interfaceCode]; if (key && result.payload[key] !== undefined) hqAssert(result.payload[key] === log.businessKey.entityId, 409, 'INTERFACE_BUSINESS_KEY_MISMATCH');
  const fingerprint = canonicalHq(result), prior = log.resultFingerprints[result.resultId];
  if (prior) {
    hqAssert(prior === fingerprint, 409, 'INTERFACE_RESULT_ID_CONFLICT');
    log.events.push({ eventId: newHqId(d), at: d.clock, kind: 'DUPLICATE', resultId: result.resultId }); return log;
  }
  const version = result.version ?? 1;
  const stateful = ['IF-ERP-003', 'IF-ERP-005', 'IF-ERP-008', 'IF-ERP-011', 'IF-ERP-013', 'IF-HIRA-001', 'IF-ERP-001', 'IF-ERP-006'].includes(result.interfaceCode);
  const newer = stateful && d.collections.interfaceLogs.find(r => r.company_id === actor.companyId && r.businessKey.entityId === log.businessKey.entityId && HQ_INTERFACE_REGISTRY[r.interfaceCode].response === result.interfaceCode && r.requestRevision > log.requestRevision);
  if (newer || version < log.resultVersion || (version === log.resultVersion && log.result)) {
    if (version === log.resultVersion && log.result && !newer) hqAssert(canonicalHq({ ...log.result, resultId: '' }) === canonicalHq({ ...result, resultId: '' }), 409, 'INTERFACE_RESULT_VERSION_CONFLICT');
    log.resultFingerprints[result.resultId] = fingerprint;
    if (newer) { log.status = 'SUPERSEDED'; log.supersededBy = newer.requestId; }
    log.events.push({ eventId: newHqId(d), at: d.clock, kind: 'STALE', resultId: result.resultId, version });
    return log;
  }
  applyBusiness(d, actor, log, result);
  log.result = cloneHq(result); log.resultFingerprints[result.resultId] = fingerprint; log.resultVersion = version;
  log.status = result.success ? 'SUCCESS' : 'FAILED'; log.respondedAt = d.clock; log.version += 1;
  log.events.push({ eventId: newHqId(d), at: d.clock, kind: 'RESULT', resultId: result.resultId, version });
  auditHq(d, actor, result.success ? 'INTERFACE_RESULT_APPLIED' : 'INTERFACE_RESULT_FAILED', log.businessKey.entityId, { requestId: log.requestId, resultId: result.resultId, interfaceCode: result.interfaceCode, resultVersion: version });
  return log;
}

function defaultPayload(d: HqDataset, a: HqActor, log: HqInterfaceLog): Record<string, unknown> {
  const code = HQ_INTERFACE_REGISTRY[log.interfaceCode].response;
  const entity = HQ_INTERFACE_REGISTRY[log.interfaceCode].collection ? get(d, a.companyId, HQ_INTERFACE_REGISTRY[log.interfaceCode].collection!, log.businessKey.entityId) : undefined;
  const suffix = log.businessKey.entityId.slice(-6);
  if (code === 'IF-ERP-003') return { accountPublicId: log.businessKey.entityId, erpCustomerCode: `MOCK-CUST-${suffix}`, approved: true };
  if (code === 'IF-ERP-005') return { contractPublicId: log.businessKey.entityId, erpContractNo: `MOCK-CON-${suffix}`, approved: true };
  if (code === 'IF-ERP-008') return { orderPublicId: log.businessKey.entityId, erpOrderNo: `MOCK-ORD-${suffix}`, status: log.interfaceCode === 'IF-ERP-007' ? 'ACCEPTED' : 'COMPLETED',
    ...(log.interfaceCode === 'IF-ERP-008' ? { deliveries: [{ erpDeliveryNo: `MOCK-DEL-${suffix}`, deliveryStatus: 'DELIVERED', shippedAt: d.clock, deliveredAt: d.clock }], ...cloneHq(log.payload) } : {}) };
  if (code === 'IF-ERP-011') return { contractPublicId: log.businessKey.entityId, planVersion: log.payload.planVersion, accepted: true };
  if (code === 'IF-ERP-013') return { directWorkPublicId: log.businessKey.entityId, erpReferenceNo: `MOCK-DW-${suffix}`, approved: true };
  if (code === 'IF-HIRA-001') return Object.keys(log.payload).length ? cloneHq(log.payload) : { hospitals: [{ encryptedProviderNo: `MOCK-HIRA-${suffix}`, hospitalName: 'ERP 연계 신규 치과', phone: '051-000-0000', address: '부산광역시 해운대구 센텀서로 66', sido: '부산광역시', sigungu: '해운대구', latitude: 35.171, longitude: 129.127 }] };
  if (code === 'IF-ERP-001') return Object.keys(log.payload).length ? cloneHq(log.payload) : { regions: d.collections.regions.filter(row => row.company_id === a.companyId).map(row => ({ sido: row.sido, sigungu: row.sigungu, ownerUserId: row.assigned_user_id })) };
  if (code === 'IF-ERP-006') return Object.keys(log.payload).length ? cloneHq(log.payload) : { products: d.collections.products.filter(row => row.company_id === a.companyId).map(row => ({ productPublicId: row.public_id, erpItemCode: row.erp_item_code, itemName: row.item_name, itemType: row.item_type, category: row.category ?? '', unitPrice: row.unit_price, stockQty: row.stock_qty, orderAvailable: row.order_available_yn })) };
  if (code === 'IF-ERP-009') return log.payload.rows ? cloneHq(log.payload) : { contractPublicId: log.businessKey.entityId, rows: [{ erpCollectionNo: `MOCK-COL-${suffix}`, amount: Math.min(Number(entity!.contract_amount), 100000), collectedAt: d.clock }] };
  if (code === 'IF-ERP-010') {
    if (log.payload.rows) return cloneHq(log.payload);
    const order = d.collections.orders.find(row => row.company_id === a.companyId && row.account_public_id === entity!.public_id && ['ACCEPTED', 'PROCESSING', 'COMPLETED'].includes(String(row.status)));
    return { accountPublicId: entity!.public_id, rows: [{ erpSalesNo: `MOCK-SALE-${suffix}`, salesDate: d.clock.slice(0, 10), amount: Number(order?.order_amount ?? 100000), ...(order ? { orderPublicId: order.public_id, contractPublicId: order.contract_public_id } : {}) }] };
  }
  if (code === 'IF-ERP-014') return log.payload.rows ? cloneHq(log.payload) : { orderPublicId: log.businessKey.entityId, rows: [{ erpReferenceNo: `MOCK-RETURN-${suffix}`, transactionType: 'RETURN', status: 'COMPLETED', quantity: 1, processedAt: d.clock }] };
  hqAssert(false, 400, 'INTERFACE_NOT_REGISTERED');
}
export function advanceInterface(d: HqDataset, actor: HqActor, requestId: string, scenario?: HqInterfaceScenario): HqInterfaceLog {
  const log = d.collections.interfaceLogs.find(r => r.company_id === actor.companyId && r.requestId === requestId);
  hqAssert(log, 404, 'INTERFACE_REQUEST_NOT_FOUND');
  const selected = scenario ?? log.scenario;
  hqAssert(SCENARIOS.includes(selected), 400, 'INTERFACE_SCENARIO_INVALID');
  if (log.status === 'SUCCESS' || log.status === 'SUPERSEDED') return log;
  hqAssert(log.status === 'REQUESTING', 409, 'INTERFACE_RETRY_REQUIRED');
  if (selected === 'DELAYED') { log.events.push({ eventId: newHqId(d), at: d.clock, kind: 'DELAYED' }); return log; }
  const result: HqInterfaceResult = { requestId, resultId: `${requestId}:result:${log.resultVersion + 1}`, generation: d.generation,
    interfaceCode: HQ_INTERFACE_REGISTRY[log.interfaceCode].response, businessKey: cloneHq(log.businessKey), success: !['BUSINESS_REJECTED', 'TRANSIENT_FAILURE', 'TIMEOUT'].includes(selected),
    payload: ['BUSINESS_REJECTED', 'TRANSIENT_FAILURE', 'TIMEOUT'].includes(selected) ? {} : defaultPayload(d, actor, log), version: log.resultVersion + 1 };
  if (selected === 'OUT_OF_ORDER') { result.version = 2; result.resultId = `${requestId}:result:2`; }
  const applied = applyInterfaceResult(d, actor, result);
  if (selected === 'TIMEOUT') { applied.status = 'TIMED_OUT'; applied.events.push({ eventId: newHqId(d), at: d.clock, kind: 'TIMEOUT' }); }
  if (selected === 'DUPLICATE') applyInterfaceResult(d, actor, cloneHq(result));
  if (selected === 'OUT_OF_ORDER') {
    applyInterfaceResult(d, actor, { ...cloneHq(result), resultId: `${requestId}:late:1`, version: 1 });
  }
  return applied;
}
export function retryInterface(d: HqDataset, actor: HqActor, requestId: string, idempotencyKey: string, scenario: HqInterfaceScenario = 'SUCCESS'): HqInterfaceLog {
  const old = d.collections.interfaceLogs.find(r => r.company_id === actor.companyId && r.requestId === requestId);
  hqAssert(old, 404, 'INTERFACE_REQUEST_NOT_FOUND');
  const replay = d.collections.interfaceLogs.find(r => r.company_id === actor.companyId && r.retryOf === requestId && r.idempotencyKey === idempotencyKey);
  if (replay) { hqAssert(replay.scenario === scenario, 409, 'INTERFACE_IDEMPOTENCY_CONFLICT'); return replay; }
  hqAssert(['FAILED', 'TIMED_OUT'].includes(old.status) && !old.supersededBy, 409, 'INTERFACE_NOT_RETRYABLE');
  hqAssert(idempotencyKey !== old.idempotencyKey, 409, 'INTERFACE_RETRY_NEW_KEY_REQUIRED');
  const next = enqueueInterface(d, actor, { interfaceCode: old.interfaceCode, entityType: old.businessKey.entityType, entityPublicId: old.businessKey.entityId,
    idempotencyKey, payload: HQ_INTERFACE_REGISTRY[old.interfaceCode].direction === 'OUT' ? {} : cloneHq(old.payload), scenario });
  next.retryOf = old.requestId; next.attempt = old.attempt + 1; old.supersededBy = next.requestId;
  old.events.push({ eventId: newHqId(d), at: d.clock, kind: 'RETRIED', message: next.requestId });
  return next;
}
