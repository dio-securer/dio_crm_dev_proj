// Fixture of the automatic API tests: the repository metadata published through the engine's version service
// (memory store), the record store on the SQLite fake, and actors. Synthetic: no SQL Server is involved.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MetadataVersions, memoryVersionStore } from '@dio-crm/engine';
import { applyObjectSchema } from '../../src/database/crm-obj-schema';
import { SqlObjectRecords } from '../../src/database/crm-obj-store';
import { Caller, EngineRecords } from '../../src/modules/engine-api/engine-records';
import { PublishedModels } from '../../src/modules/engine-api/published-model';
import { sqliteDb } from './sqlite-db';

type File = { path: string; content: string };
const repo = path.resolve(__dirname, '../../..');
export function readMetadata(): File[] {
  const out: File[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(repo, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel); else out.push({ path: rel, content: fs.readFileSync(path.join(repo, rel), 'utf8') });
    }
  };
  walk('metadata');
  return out;
}
export function editJson(files: File[], file: string, edit: (doc: any) => void): File[] {
  return files.map(f => { if (f.path !== file) return f; const doc = JSON.parse(f.content); edit(doc); return { ...f, content: JSON.stringify(doc) }; });
}
export const ACCESS = 'metadata/objects/lead/access.json';
export const caller = (userId: string, companyId = 1, more: Partial<Caller['actor']> = {}): Caller =>
  ({ companyId, actor: { userId, permissions: [], memberIds: [], unitIds: [], ...more } });
export const NOW = new Date('2026-11-28T01:02:03.000Z');

export async function engineFixture(files: File[] | null = readMetadata()) {
  const db = sqliteDb();
  const versions = new MetadataVersions(memoryVersionStore(), () => NOW.toISOString());
  const publish = async (f: File[]) => (await versions.publish(await versions.stage(f, 'test'), 'test')).id;
  if (files) await publish(files);
  const ports = {
    readId: async () => (await versions.published())?.id,
    readFiles: async (id: number) => { const v = await versions.published(); return v && v.id === id ? { id, files: v.files } : undefined; },
    ensureTables: (objects: any[]) => applyObjectSchema(db, objects),
  };
  const api = new EngineRecords(new PublishedModels(ports), new SqlObjectRecords(db), () => NOW);
  return { db, versions, publish, api };
}
export const LEAD = { hospital_name: 'H1', status: 'NEW' };
