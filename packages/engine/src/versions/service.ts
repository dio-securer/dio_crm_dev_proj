// MetadataVersions: staging -> publish -> rollback over a VersionStore. Publish checks the metadata and its
// backward compatibility with the published version (diffBundles, including D05 row access widening).
import { bundleFromFiles, diffBundles } from '@dio-crm/contracts/metadata';
import type { MetadataFile } from '@dio-crm/contracts/metadata';
import { loadRuntimeModel } from '../model';
import { nextStatus } from './transitions';
import { VersionError, VersionRecord, VersionStore, VersionTx } from './types';

export type Clock = () => string;

async function must(tx: VersionTx, id: number): Promise<VersionRecord> {
  const v = await tx.get(id);
  if (!v) throw new VersionError('NOT_FOUND');
  return v;
}

export class MetadataVersions {
  constructor(private readonly store: VersionStore, private readonly clock: Clock = () => new Date().toISOString()) {}

  stage(files: MetadataFile[], actor: string, note?: string): Promise<number> {
    return this.store.transaction(async tx => {
      const at = this.clock();
      const id = await tx.insert({ status: 'staging', files: files.map(f => ({ path: f.path, content: f.content })), createdBy: actor, createdAt: at, ...(note ? { note } : {}) });
      await tx.addEvent({ versionId: id, action: 'stage', actor, at });
      return id;
    });
  }

  discard(id: number, actor: string): Promise<void> {
    return this.store.transaction(async tx => {
      await tx.lockPointer();
      const v = await must(tx, id);
      await tx.update(id, { status: nextStatus('discard', v.status) });
      await tx.addEvent({ versionId: id, action: 'discard', actor, at: this.clock() });
    });
  }

  publish(id: number, actor: string): Promise<VersionRecord> {
    return this.store.transaction(async tx => {
      const currentId = await tx.lockPointer();
      const v = await must(tx, id);
      const status = nextStatus('publish', v.status);
      const loaded = loadRuntimeModel(v.files);
      if (!loaded.model) throw new VersionError('INVALID_METADATA', loaded.issues.filter(i => i.severity === 'error'));
      const at = this.clock();
      if (currentId !== undefined) {
        const current = await must(tx, currentId);
        const base = bundleFromFiles(current.files).bundle;
        const errors = diffBundles(base, loaded.model.bundle).filter(i => i.severity === 'error');
        if (errors.length) throw new VersionError('INCOMPATIBLE', errors);
        await tx.update(currentId, { status: nextStatus('supersede', current.status) });
        await tx.addEvent({ versionId: currentId, action: 'supersede', actor, at });
      }
      await tx.update(id, { status, publishedAt: at, previousId: currentId });
      await tx.setPointer(id);
      await tx.addEvent({ versionId: id, action: 'publish', actor, at, fromVersionId: currentId });
      return must(tx, id);
    });
  }

  /** Back to the version that was published before the current one. That version passed its checks when it was published. */
  rollback(actor: string): Promise<VersionRecord> {
    return this.store.transaction(async tx => {
      const currentId = await tx.lockPointer();
      if (currentId === undefined) throw new VersionError('NO_PUBLISHED');
      const current = await must(tx, currentId);
      if (current.previousId === undefined) throw new VersionError('NO_PREVIOUS');
      const target = await must(tx, current.previousId);
      const at = this.clock();
      await tx.update(currentId, { status: nextStatus('rollback', current.status) });
      await tx.update(target.id, { status: nextStatus('restore', target.status) });
      await tx.setPointer(target.id);
      await tx.addEvent({ versionId: currentId, action: 'rollback', actor, at });
      await tx.addEvent({ versionId: target.id, action: 'restore', actor, at, fromVersionId: currentId });
      return must(tx, target.id);
    });
  }

  /** The published version, or undefined before the first publish. */
  published(): Promise<VersionRecord | undefined> {
    return this.store.transaction(async tx => {
      const id = await tx.lockPointer();
      return id === undefined ? undefined : tx.get(id);
    });
  }
}
