import { HQ_SCHEMA_VERSION, HQ_COLLECTION_NAMES } from './model.js';
import type { HqCollections, HqDataset, HqRow } from './model.js';

const id = (value: number) => `10000000-0000-4000-8000-${value.toString(16).padStart(12, '0')}`;
export const seedIDs = {
  approvedAccount: id(1), pendingAccount: id(2), duplicateAccount: id(3), otherOwnerAccount: id(4), otherCompanyAccount: id(5), noCoordinatesAccount: id(6),
  lead: id(10), duplicateLead: id(11), otherOwnerLead: id(12), otherCompanyLead: id(13), noCoordinatesLead: id(14), contact: id(20),
  activity: id(30), pendingReport: id(31), directWork: id(32),
  approvedOpportunity: id(40), pendingOpportunity: id(41), approvedContract: id(50), pendingContract: id(51), unpaidPlan: id(60), pendingPlan: id(61),
  product: id(70), zeroStockProduct: id(71), negativeStockProduct: id(72), unavailableProduct: id(73),
  readyOrder: id(80), pendingOrder: id(81), region: id(90)
} as const;
const row = (public_id: string, values: Record<string, unknown>, company_id = 1, owner_user_id = 1): HqRow => ({ public_id, company_id, owner_user_id, organization_id: company_id === 1 ? 10 : 20, version: 1, ...values });
export function createHqSeed(datasetId: string, generation = 1): HqDataset {
  const collections = Object.fromEntries(HQ_COLLECTION_NAMES.map(name => [name, []])) as unknown as HqCollections;
  const account = (publicId: string, name: string, approved: boolean, extra: Record<string, unknown> = {}, company = 1, owner = 1) => row(publicId, {
    account_name: name, account_status: approved ? 'ACTIVE' : 'NEW', account_grade: 'GENERAL', business_name: name,
    business_no: publicId === seedIDs.approvedAccount ? '617-81-10001' : `617-81-${publicId.slice(-5)}`,
    ceo_name: '목업 원장', phone: '051-555-1000', address: '부산광역시 해운대구 센텀서로 66',
    address_line1: '부산광역시 해운대구 센텀서로 66', address_line2: '2층', hospital_address: '부산광역시 해운대구 센텀서로 66', zip_code: '48058',
    tax_email: 'hq-mock@example.invalid', provider_no: 'MOCK-HIRA-001', encrypted_provider_no: 'MOCK-ENC-001', open_date: '2020-01-01',
    account_type: 'BC505600', erp_trade_code: approved ? 'BC5110' : null, erp_approval_code: approved ? 'CM840500' : 'CM840100',
    erp_customer_code: approved ? `MOCK-CUST-${publicId.slice(-4)}` : null, erp_approved_yn: approved, integration_status: approved ? 'SUCCESS' : 'NOT_REQUESTED',
    use_yn: '1', account_stat_code: approved ? '0' : '1', churn_risk_yn: false, company_code: 'DIO', owner_name: owner === 1 ? '본사 영업담당' : '다른 영업담당',
    latitude: 35.171, longitude: 129.127, updated_at: '2026-10-22T00:00:00.000Z', source_system: 'CRM', manual_fields: [], ...extra
  }, company, owner);
  collections.accounts = [
    account(seedIDs.approvedAccount, '본사 승인 치과', true), account(seedIDs.pendingAccount, '본사 신규 치과', false),
    account(seedIDs.duplicateAccount, '중복 후보 치과', false, { business_no: '617-81-10001' }),
    account(seedIDs.otherOwnerAccount, '다른 담당 치과', false, {}, 1, 2), account(seedIDs.otherCompanyAccount, '타법인 격리 치과', false, {}, 2, 21),
    account(seedIDs.noCoordinatesAccount, '좌표 미등록 치과', false, { latitude: null, longitude: null })
  ];
  const lead = (publicId: string, name: string, extra: Record<string, unknown> = {}, company = 1, owner = 1) => row(publicId, {
    hospital_name: name, status: 'KEYMAN_MEETING', owner_name: owner === 1 ? '본사 영업담당' : '다른 영업담당', business_no: '617-81-20001',
    phone: '051-555-2000', address: '부산광역시 해운대구 센텀서로 66', sido: '부산광역시', sigungu: '해운대구',
    latitude: 35.171, longitude: 129.127, encrypted_provider_no: `HIRA-${publicId.slice(-4)}`, provider_no: `P-${publicId.slice(-4)}`,
    keyman_name: '신규 원장', keyman_type: 'DOCTOR', keyman_mobile: '010-0000-1000', keyman_email: 'lead@example.invalid',
    school: '목업대학교', cohort: '2005', major: '치의학', main_system: 'DIO', sub_system: '', contact_exclude_reason: '', map_excluded_yn: false,
    source_system: 'HIRA', manual_fields: [], history: [], ...extra
  }, company, owner);
  collections.leads = [lead(seedIDs.lead, '본사 신규 리드'), lead(seedIDs.duplicateLead, '중복 확인 리드', { business_no: '617-81-10001' }),
    lead(seedIDs.otherOwnerLead, '다른 담당 리드', { status: 'NEW' }, 1, 2), lead(seedIDs.otherCompanyLead, '타법인 리드', {}, 2, 21),
    lead(seedIDs.noCoordinatesLead, '좌표 없는 리드', { latitude: null, longitude: null, status: 'NEW' })];
  collections.contacts = [row(seedIDs.contact, { account_public_id: seedIDs.approvedAccount, contact_name: '목업 원장', contact_type: 'DOCTOR', mobile: '010-0000-0001', email: 'contact@example.invalid', is_keyman: true })];
  collections.activities = [row(seedIDs.activity, { event_public_id: seedIDs.activity, activity_public_id: seedIDs.activity, subject: '본사 치과 방문',
    related_type: 'ACCOUNT', related_public_id: seedIDs.approvedAccount, related_name_snapshot: '본사 승인 치과',
    start_at: '2026-10-22T01:00:00.000Z', end_at: '2026-10-22T02:00:00.000Z', status: 'PLANNED', visit_purpose: '신제품 상담', consultation_content: '', in_at: null, out_at: null })];
  collections.reports = [row(seedIDs.pendingReport, { report_date: '2026-10-22', status: 'REQUESTED', branch_approver_user_id: 3, division_approver_user_id: 4, items: [], comments: [], history: [] })];
  collections.directWorks = [row(seedIDs.directWork, { activity_public_id: seedIDs.activity, work_date: '2026-10-22', direct_work_type: 'DIRECT_WORK', reason: '거래처 조기 방문',
    status: 'DRAFT', branch_approver_user_id: 3, division_approver_user_id: 4, integration_status: 'NOT_REQUESTED', erp_status: null, history: [] })];
  collections.products = [
    row(seedIDs.product, { item_type: 'PRODUCT', item_name: '목업 임플란트', erp_item_code: 'MOCK-P001', category: 'IMPLANT', unit_price: 100000, base_price: 100000, stock_qty: 100, order_available_yn: true, source_system: 'ERP' }),
    row(seedIDs.zeroStockProduct, { item_type: 'PRODUCT', item_name: '재고 0 품목', erp_item_code: 'MOCK-P002', category: 'IMPLANT', unit_price: 50000, base_price: 50000, stock_qty: 0, order_available_yn: true, source_system: 'ERP' }),
    row(seedIDs.negativeStockProduct, { item_type: 'PRODUCT', item_name: '재고 음수 품목', erp_item_code: 'MOCK-P003', category: 'IMPLANT', unit_price: 50000, base_price: 50000, stock_qty: -2, order_available_yn: true, source_system: 'ERP' }),
    row(seedIDs.unavailableProduct, { item_type: 'PACKAGE', item_name: '주문 불가 패키지', erp_item_code: 'MOCK-P004', category: 'PACKAGE', unit_price: 200000, base_price: 200000, stock_qty: 10, order_available_yn: false, source_system: 'ERP' })
  ];
  const items = [{ product_public_id: seedIDs.product, package_public_id: seedIDs.product, item_name: '목업 임플란트', quantity: 10, unit_price: 100000, proposed_unit_price: 100000, amount: 1000000 }];
  collections.opportunities = [row(seedIDs.approvedOpportunity, { account_public_id: seedIDs.approvedAccount, opportunity_name: '승인 거래처 기회', stage: 'CLOSED_WON', record_type: 'EXISTING', amount: 1000000, expected_close_date: '2026-10-22', success_probability: 100, forecast_category: 'COMMIT', contract_created_yn: true, products: structuredClone(items) }),
    row(seedIDs.pendingOpportunity, { account_public_id: seedIDs.pendingAccount, opportunity_name: '미승인 거래처 기회', stage: 'NEGOTIATION', record_type: 'NEW', amount: 1000000, expected_close_date: '2026-10-30', success_probability: 70, forecast_category: 'PIPELINE', contract_created_yn: true, products: structuredClone(items) })];
  collections.contracts = [row(seedIDs.approvedContract, { account_public_id: seedIDs.approvedAccount, opportunity_public_id: seedIDs.approvedOpportunity, contract_name: '본사 승인 계약', contract_date: '2026-10-22', contract_amount: 1000000, product_amount: 1000000, goods_amount: 0, status: 'ERP_APPROVED', erp_contract_no: 'MOCK-CON-001', erp_approval_status: 'APPROVED', integration_status: 'SUCCESS', close_yn: false, products: structuredClone(items) }),
    row(seedIDs.pendingContract, { account_public_id: seedIDs.pendingAccount, opportunity_public_id: seedIDs.pendingOpportunity, contract_name: '대기 계약 검증용', contract_date: '2026-10-22', contract_amount: 1000000, product_amount: 1000000, goods_amount: 0, status: 'DRAFT', erp_contract_no: null, erp_approval_status: 'NOT_REQUESTED', integration_status: 'NOT_REQUESTED', close_yn: false, products: structuredClone(items), fixture_note: 'ERP 미승인 거래처 차단 검증용 독립 사례' })];
  collections.plans = [row(seedIDs.unpaidPlan, { contract_public_id: seedIDs.approvedContract, plan_version: 1, installment_no: 1, collection_method: 'BANK_TRANSFER', amount: 1000000, planned_date: '2026-10-21', adjustment_type: 'ORIGINAL', is_current: true, erp_sync_status: 'SUCCESS', correction_required_yn: false }),
    row(seedIDs.pendingPlan, { contract_public_id: seedIDs.pendingContract, plan_version: 1, installment_no: 1, collection_method: 'BANK_TRANSFER', amount: 1000000, planned_date: '2026-11-22', adjustment_type: 'ORIGINAL', is_current: true, erp_sync_status: 'NOT_REQUESTED', correction_required_yn: false })];
  collections.orders = [row(seedIDs.readyOrder, { contract_public_id: seedIDs.approvedContract, account_public_id: seedIDs.approvedAccount, status: 'DRAFT', integration_status: 'NOT_REQUESTED', order_amount: 200000,
    items: [{ product_public_id: seedIDs.product, quantity: 2, unit_price: 100000, amount: 200000 }], delivery_address_type: 'ACCOUNT', delivery_address: '부산광역시 해운대구 센텀서로 66', express_yn: false, note: '', erp_order_no: null }),
    row(seedIDs.pendingOrder, { contract_public_id: seedIDs.pendingContract, account_public_id: seedIDs.pendingAccount, status: 'DRAFT', integration_status: 'NOT_REQUESTED', order_amount: 100000,
      items: [{ product_public_id: seedIDs.product, quantity: 1, unit_price: 100000, amount: 100000 }], delivery_address_type: 'DIRECT', delivery_address: '', express_yn: false, note: '', erp_order_no: null, fixture_note: '승인/배송 검증용 독립 사례' })];
  collections.regions = [row(seedIDs.region, { sido: '부산광역시', sigungu: '해운대구', assigned_user_id: 1, source_system: 'ERP' })];
  return { datasetId, schemaVersion: HQ_SCHEMA_VERSION, generation, revision: 1, sequence: 1000, clock: '2026-10-22T00:00:00.000Z', mode: 'MOCK', collections };
}
