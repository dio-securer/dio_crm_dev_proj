import { HQ_COLLECTION_NAMES, HQ_SCHEMA_VERSION, cloneHq, hqAssert, HqMockError } from './model.js';
import type { HqDataset, HqBusinessCollection, HqRow } from './model.js';
import { createHqSeed } from './seed.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const moneyFields = new Set(['amount', 'contract_amount', 'product_amount', 'goods_amount', 'order_amount', 'unit_price', 'base_price', 'proposed_unit_price', 'collection_amount', 'sales_amount']);
function serializable(value: unknown, path: string, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { hqAssert(Number.isFinite(value), 422, 'DATASET_NUMBER_INVALID', path); return; }
  hqAssert(typeof value === 'object' && !!value, 422, 'DATASET_NOT_SERIALIZABLE', path);
  hqAssert(!seen.has(value as object), 422, 'DATASET_CYCLE', path);
  hqAssert(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, 422, 'DATASET_OBJECT_INVALID', path);
  const next = new Set(seen); next.add(value as object);
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    hqAssert(!['__proto__', 'constructor', 'prototype'].includes(key), 422, 'DATASET_KEY_INVALID', `${path}.${key}`);
    if (moneyFields.has(key)) hqAssert(typeof child === 'number' && Number.isFinite(child) && child >= 0, 422, 'DATASET_MONEY_INVALID', `${path}.${key}`);
    serializable(child, `${path}.${key}`, next);
  }
}
/** Verifies every stored relationship, not merely the mutation being requested. */
export function validateHqDataset(value: unknown, expectedDatasetId?: string): asserts value is HqDataset {
  hqAssert(!!value && typeof value === 'object' && !Array.isArray(value), 422, 'DATASET_INVALID');
  const d = value as HqDataset;
  hqAssert(d.collections, 422, 'DATASET_INVALID');
  hqAssert(d.schemaVersion === HQ_SCHEMA_VERSION, 409, 'DATASET_SCHEMA_UNSUPPORTED');
  hqAssert(typeof d.datasetId === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(d.datasetId), 422, 'DATASET_ID_INVALID');
  hqAssert(!expectedDatasetId || d.datasetId === expectedDatasetId, 409, 'DATASET_ID_MISMATCH');
  hqAssert(d.mode === 'MOCK', 422, 'DATASET_MODE_INVALID');
  hqAssert(Number.isSafeInteger(d.generation) && d.generation > 0 && d.generation <= 0xffff, 422, 'DATASET_GENERATION_INVALID');
  hqAssert(Number.isSafeInteger(d.revision) && d.revision > 0, 422, 'DATASET_REVISION_INVALID');
  hqAssert(Number.isSafeInteger(d.sequence) && d.sequence >= 1000, 422, 'DATASET_SEQUENCE_INVALID');
  hqAssert(typeof d.clock === 'string' && Number.isFinite(Date.parse(d.clock)), 422, 'DATASET_CLOCK_INVALID');
  hqAssert(Object.keys(d.collections).length === HQ_COLLECTION_NAMES.length && Object.keys(d.collections).every(k => (HQ_COLLECTION_NAMES as readonly string[]).includes(k)), 422, 'DATASET_COLLECTION_INVALID');
  serializable(d, 'dataset');
  const globalIds = new Set<string>();
  for (const name of HQ_COLLECTION_NAMES) {
    hqAssert(Array.isArray(d.collections[name]), 422, 'DATASET_COLLECTION_INVALID', name);
    for (const item of d.collections[name]) {
      hqAssert(item && typeof item === 'object' && UUID.test(item.public_id), 422, 'DATASET_ROW_ID_INVALID', name);
      hqAssert(!globalIds.has(item.public_id), 422, 'DATASET_DUPLICATE_ID', item.public_id); globalIds.add(item.public_id);
      hqAssert(Number.isSafeInteger(item.company_id) && item.company_id > 0, 422, 'DATASET_COMPANY_INVALID');
      hqAssert(Number.isSafeInteger(item.version) && item.version > 0, 422, 'DATASET_ROW_VERSION_INVALID');
      if (item.owner_user_id !== undefined) hqAssert(Number.isSafeInteger(item.owner_user_id) && item.owner_user_id > 0, 422, 'DATASET_OWNER_INVALID');
    }
  }
  const ref = (item: HqRow, key: string, target: HqBusinessCollection, required = true) => {
    const id = item[key];
    if ((id === null || id === undefined || id === '') && !required) return;
    const found = d.collections[target].find(row => row.public_id === id);
    hqAssert(found && found.company_id === item.company_id, 422, 'DATASET_REFERENCE_INVALID', `${key}:${String(id)}`);
  };
  for (const item of d.collections.contacts) ref(item, 'account_public_id', 'accounts');
  for (const item of d.collections.opportunities) ref(item, 'account_public_id', 'accounts');
  for (const item of d.collections.contracts) {
    ref(item, 'account_public_id', 'accounts'); ref(item, 'opportunity_public_id', 'opportunities');
    const opportunity = d.collections.opportunities.find(row => row.public_id === item.opportunity_public_id)!;
    hqAssert(opportunity.account_public_id === item.account_public_id, 422, 'DATASET_CONTRACT_ACCOUNT_MISMATCH');
  }
  for (const item of d.collections.plans) ref(item, 'contract_public_id', 'contracts');
  for (const item of d.collections.orders) {
    ref(item, 'contract_public_id', 'contracts'); ref(item, 'account_public_id', 'accounts');
    const contract = d.collections.contracts.find(row => row.public_id === item.contract_public_id)!;
    hqAssert(contract.account_public_id === item.account_public_id, 422, 'DATASET_ORDER_ACCOUNT_MISMATCH');
    if (Array.isArray(item.items)) for (const line of item.items) {
      hqAssert(line && typeof line === 'object', 422, 'DATASET_ORDER_ITEM_INVALID');
      ref({ ...line, company_id: item.company_id } as HqRow, 'product_public_id', 'products');
      hqAssert(Number.isInteger(line.quantity) && line.quantity > 0, 422, 'DATASET_ORDER_QUANTITY_INVALID');
    }
  }
  for (const item of d.collections.deliveries) ref(item, 'order_public_id', 'orders');
  for (const item of d.collections.collections) ref(item, 'contract_public_id', 'contracts');
  for (const item of d.collections.sales) {
    ref(item, 'account_public_id', 'accounts'); ref(item, 'contract_public_id', 'contracts', false); ref(item, 'order_public_id', 'orders', false);
    if (item.contract_public_id) hqAssert(d.collections.contracts.find(row => row.public_id === item.contract_public_id)!.account_public_id === item.account_public_id, 422, 'DATASET_SALE_ACCOUNT_MISMATCH');
    if (item.order_public_id) hqAssert(d.collections.orders.find(row => row.public_id === item.order_public_id)!.account_public_id === item.account_public_id, 422, 'DATASET_SALE_ORDER_MISMATCH');
  }
  for (const item of d.collections.returns) ref(item, 'order_public_id', 'orders');
  for (const item of d.collections.directWorks) ref(item, 'activity_public_id', 'activities');
  for (const item of d.collections.activities) {
    const target: Record<string, HqBusinessCollection> = { LEAD: 'leads', ACCOUNT: 'accounts', OPPORTUNITY: 'opportunities' };
    hqAssert(target[String(item.related_type)], 422, 'DATASET_ACTIVITY_TARGET_INVALID');
    ref(item, 'related_public_id', target[String(item.related_type)]);
  }
  for (const log of d.collections.interfaceLogs) {
    hqAssert(log.requestId === log.public_id && log.datasetId === d.datasetId && log.generation === d.generation && log.mode === 'MOCK', 422, 'DATASET_INTERFACE_INVALID');
  }
}

export interface HqRepositoryOptions {
  datasetId: string;
  load?: () => HqDataset | undefined;
  save?: (dataset: HqDataset) => void;
}
export class HqRepository {
  private current: HqDataset;
  private busy = false;
  private readonly options: HqRepositoryOptions;
  constructor(options: HqRepositoryOptions) {
    this.options = options;
    const loaded = options.load?.();
    const initial = loaded ?? createHqSeed(options.datasetId);
    validateHqDataset(initial, options.datasetId);
    if (!loaded) options.save?.(cloneHq(initial));
    this.current = cloneHq(initial);
  }
  read(): HqDataset { return cloneHq(this.current); }
  transact<T>(work: (draft: HqDataset) => T): T {
    hqAssert(!this.busy, 409, 'DATASET_TRANSACTION_REENTRANT');
    this.busy = true;
    try {
      const draft = cloneHq(this.current);
      const result = work(draft);
      hqAssert(!(result && typeof (result as { then?: unknown }).then === 'function'), 500, 'DATASET_ASYNC_TRANSACTION_FORBIDDEN');
      hqAssert(draft.datasetId === this.current.datasetId && draft.schemaVersion === this.current.schemaVersion && draft.generation === this.current.generation, 409, 'DATASET_IDENTITY_IMMUTABLE');
      hqAssert(draft.sequence >= this.current.sequence && Date.parse(draft.clock) >= Date.parse(this.current.clock), 409, 'DATASET_CLOCK_OR_SEQUENCE_REVERSED');
      draft.revision = this.current.revision + 1;
      validateHqDataset(draft, this.options.datasetId);
      // Persistence must succeed before exposing the new state. The persistence adapter must write atomically.
      this.options.save?.(cloneHq(draft));
      this.current = cloneHq(draft);
      return cloneHq(result);
    } finally { this.busy = false; }
  }
  reset(expectedGeneration?: number): HqDataset {
    hqAssert(!this.busy, 409, 'DATASET_TRANSACTION_REENTRANT');
    if (expectedGeneration !== undefined) hqAssert(expectedGeneration === this.current.generation, 409, 'DATASET_GENERATION_CONFLICT');
    this.busy = true;
    try {
      const next = createHqSeed(this.options.datasetId, this.current.generation + 1);
      next.revision = this.current.revision + 1;
      validateHqDataset(next, this.options.datasetId);
      this.options.save?.(cloneHq(next));
      this.current = cloneHq(next);
      return this.read();
    } finally { this.busy = false; }
  }
}
export { HqMockError };
