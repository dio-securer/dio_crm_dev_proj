// Admin-only metadata versions (F2-7): staging, publishing, rolling back and discarding are admin work.
// Requirements: only the CRM admin customises screens; the server checks it, not only the screen.
// Publish and rollback need the platform-wide publish permission (ADMIN_PERMISSIONS.publish).
import type { MetadataFile } from '@dio-crm/contracts/metadata';
import { ADMIN_PERMISSIONS } from '../security/permissions';
import type { MetadataVersions } from './service';
import { VersionError, VersionRecord } from './types';

export interface VersionActor { userId: string; permissions: readonly string[] }

function need(actor: VersionActor, permission: string): string {
  if (!actor || typeof actor.userId !== 'string' || !actor.userId || !Array.isArray(actor.permissions) || !actor.permissions.includes(permission)) {
    throw new VersionError('FORBIDDEN');
  }
  return actor.userId;
}

export class AdminVersions {
  constructor(private readonly versions: MetadataVersions) {}
  async stage(files: MetadataFile[], actor: VersionActor, note?: string): Promise<number> {
    return this.versions.stage(files, need(actor, ADMIN_PERMISSIONS.edit), note);
  }
  async discard(id: number, actor: VersionActor): Promise<void> { return this.versions.discard(id, need(actor, ADMIN_PERMISSIONS.edit)); }
  async publish(id: number, actor: VersionActor): Promise<VersionRecord> { return this.versions.publish(id, need(actor, ADMIN_PERMISSIONS.publish)); }
  async rollback(actor: VersionActor): Promise<VersionRecord> { return this.versions.rollback(need(actor, ADMIN_PERMISSIONS.publish)); }
}
