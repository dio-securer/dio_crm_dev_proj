// Metadata versions (F2-3): records, the storage port and the errors. No IO here; adapters implement the port.
import type { Issue, MetadataFile } from '@dio-crm/contracts/metadata';

export type VersionStatus = 'staging' | 'published' | 'superseded' | 'rolled_back' | 'discarded';
export type VersionAction = 'stage' | 'publish' | 'supersede' | 'rollback' | 'restore' | 'discard';

export interface VersionRecord {
  id: number;
  status: VersionStatus;
  files: MetadataFile[];
  createdBy: string;
  createdAt: string;
  publishedAt?: string;
  /** The version that was published when this one was published; rollback returns to it. */
  previousId?: number;
  note?: string;
}
export type NewVersion = Omit<VersionRecord, 'id'>;

export interface VersionEvent { versionId: number; action: VersionAction; actor: string; at: string; fromVersionId?: number }

/** One transaction of the store. Every call of one service operation runs inside a single transaction. */
export interface VersionTx {
  /** The published version id, read with a lock that serialises every publish and rollback. */
  lockPointer(): Promise<number | undefined>;
  setPointer(id: number | undefined): Promise<void>;
  get(id: number): Promise<VersionRecord | undefined>;
  insert(version: NewVersion): Promise<number>;
  update(id: number, change: Partial<Pick<VersionRecord, 'status' | 'publishedAt' | 'previousId'>>): Promise<void>;
  addEvent(event: VersionEvent): Promise<void>;
}
export interface VersionStore { transaction<T>(work: (tx: VersionTx) => Promise<T>): Promise<T> }

export type VersionErrorCode = 'NOT_FOUND' | 'BAD_STATE' | 'INVALID_METADATA' | 'INCOMPATIBLE' | 'NO_PREVIOUS' | 'NO_PUBLISHED' | 'FORBIDDEN';
export class VersionError extends Error {
  constructor(readonly code: VersionErrorCode, readonly issues: Issue[] = []) { super(code); this.name = 'VersionError'; }
}
