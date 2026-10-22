/** H02 isolated, serializable HQ mock contracts. No SQL, HTTP or browser dependencies. */
export const HQ_SCHEMA_VERSION = 1 as const;
export type HqScope = 'SELF' | 'BRANCH' | 'DIVISION' | 'ALL' | 'SYSTEM';
export interface HqActor {
  userId: number;
  companyId: number;
  organizationId?: number;
  loginId?: string;
  name?: string;
  roles?: string[];
  permissions: string[];
  scope: HqScope;
}
export interface HqRow extends Record<string, unknown> {
  public_id: string;
  company_id: number;
  owner_user_id?: number;
  version: number;
}
export const HQ_COLLECTION_NAMES = [
  'leads', 'accounts', 'contacts', 'activities', 'reports', 'directWorks',
  'opportunities', 'contracts', 'plans', 'products', 'orders', 'deliveries',
  'collections', 'sales', 'returns', 'interfaceLogs', 'auditLogs', 'regions'
] as const;
export type HqCollectionName = typeof HQ_COLLECTION_NAMES[number];
export type HqBusinessCollection = Exclude<HqCollectionName, 'interfaceLogs' | 'auditLogs'>;
export const HQ_INTERFACE_CODES = [
  'IF-HIRA-001', 'IF-ERP-001', 'IF-ERP-002', 'IF-ERP-003', 'IF-ERP-004',
  'IF-ERP-005', 'IF-ERP-006', 'IF-ERP-007', 'IF-ERP-008', 'IF-ERP-009',
  'IF-ERP-010', 'IF-ERP-011', 'IF-ERP-012', 'IF-ERP-013', 'IF-ERP-014'
] as const;
export type HqInterfaceCode = typeof HQ_INTERFACE_CODES[number];
export type HqInterfaceScenario = 'SUCCESS' | 'BUSINESS_REJECTED' | 'TRANSIENT_FAILURE' | 'TIMEOUT' | 'DELAYED' | 'DUPLICATE' | 'OUT_OF_ORDER';
export type HqInterfaceState = 'REQUESTING' | 'SUCCESS' | 'FAILED' | 'TIMED_OUT' | 'SUPERSEDED';
export interface HqBusinessKey { entityType: string; entityId: string }
export interface HqInterfaceEnvelope {
  requestId: string;
  interfaceCode: HqInterfaceCode;
  datasetId: string;
  generation: number;
  sourceSystem: 'CRM' | 'ERP' | 'HIRA';
  targetSystem: 'CRM' | 'ERP';
  requestedAt: string;
  businessKey: HqBusinessKey;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  mode: 'MOCK';
}
export interface HqInterfaceResult {
  requestId: string;
  resultId: string;
  interfaceCode: HqInterfaceCode;
  generation: number;
  businessKey: HqBusinessKey;
  success: boolean;
  payload: Record<string, unknown>;
  version?: number;
  message?: string;
}
export interface HqInterfaceEvent {
  eventId: string;
  at: string;
  kind: 'ENQUEUED' | 'DELAYED' | 'RESULT' | 'DUPLICATE' | 'STALE' | 'RETRIED' | 'TIMEOUT';
  resultId?: string;
  message?: string;
  version?: number;
}
export interface HqInterfaceLog extends HqRow, HqInterfaceEnvelope {
  status: HqInterfaceState;
  scenario: HqInterfaceScenario;
  requestRevision: number;
  attempt: number;
  retryOf?: string;
  supersededBy?: string;
  payloadFingerprint: string;
  result?: HqInterfaceResult;
  resultFingerprints: Record<string, string>;
  resultVersion: number;
  events: HqInterfaceEvent[];
  respondedAt?: string;
}
export type HqCollections = Record<Exclude<HqCollectionName, 'interfaceLogs'>, HqRow[]> & { interfaceLogs: HqInterfaceLog[] };
export interface HqDataset {
  datasetId: string;
  schemaVersion: typeof HQ_SCHEMA_VERSION;
  generation: number;
  revision: number;
  sequence: number;
  clock: string;
  mode: 'MOCK';
  collections: HqCollections;
}
export class HqMockError extends Error {
  readonly statusCode: number;
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  constructor(status: number, code: string, message = code, details?: Record<string, unknown>) {
    super(message);
    this.name = 'HqMockError';
    this.statusCode = status;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export function hqAssert(condition: unknown, status: number, code: string, message = code): asserts condition {
  if (!condition) throw new HqMockError(status, code, message);
}
export const cloneHq = <T>(value: T): T => structuredClone(value);
export function canonicalHq(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalHq).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => `${JSON.stringify(key)}:${canonicalHq(val)}`).join(',')}}`;
}
/** New IDs are deterministic within a dataset generation, and never collide with seed IDs. */
export function newHqId(dataset: HqDataset): string {
  dataset.sequence += 1;
  hqAssert(Number.isSafeInteger(dataset.sequence) && dataset.sequence < 0xffffffffffff, 507, 'ID_SEQUENCE_EXHAUSTED');
  return `e0000000-${dataset.generation.toString(16).padStart(4, '0')}-4000-8000-${dataset.sequence.toString(16).padStart(12, '0')}`;
}
export function advanceHqClock(dataset: HqDataset, milliseconds: number): string {
  hqAssert(Number.isSafeInteger(milliseconds) && milliseconds >= 0, 400, 'CLOCK_DELTA_INVALID');
  const next = Date.parse(dataset.clock) + milliseconds;
  hqAssert(Number.isFinite(next) && next <= 8640000000000000, 400, 'CLOCK_INVALID');
  dataset.clock = new Date(next).toISOString();
  return dataset.clock;
}
export function auditHq(dataset: HqDataset, actor: HqActor, action: string, entityId: string, detail: Record<string, unknown> = {}): HqRow {
  const row: HqRow = { public_id: newHqId(dataset), company_id: actor.companyId, owner_user_id: actor.userId, version: 1,
    action, entity_id: entityId, at: dataset.clock, mode: 'MOCK', detail: cloneHq(detail) };
  dataset.collections.auditLogs.push(row);
  return row;
}
