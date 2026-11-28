// F2-7 over HTTP: only admins stage, publish, roll back and discard metadata versions (memory store, real AuthGuard).
import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AdminVersions, MetadataVersions, memoryVersionStore } from '@dio-crm/engine';
import { env } from '../../config/env';
import { AuthGuard } from '../../security/security';
import { readMetadata, editJson } from '../../../test/support/engine-fixture';
import { MetadataAdmin } from './metadata-admin';
import { MetadataAdminController, MetadataAdminService } from './metadata-admin.controller';

let app: INestApplication;
let base = '';
let jwt: JwtService;
const token = (publicId: string, permissions: string[] = []) =>
  jwt.sign({ sub: 1, publicId, loginId: publicId, name: publicId, companyId: -1, roles: [], permissions, scope: 'SELF' }, { secret: env.JWT_ACCESS_SECRET });
async function call(method: string, path: string, auth?: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
const ADMIN = ['config.edit', 'config.publish'];
const V = '/api/engine/metadata/versions';

beforeAll(async () => {
  const admin = new MetadataAdmin(new AdminVersions(new MetadataVersions(memoryVersionStore())));
  const moduleRef = await Test.createTestingModule({ imports: [JwtModule.register({})], controllers: [MetadataAdminController], providers: [AuthGuard, MetadataAdminService] })
    .overrideProvider(MetadataAdminService).useValue({ admin }).compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  base = await app.getUrl();
  jwt = moduleRef.get(JwtService);
});
afterAll(() => app.close());

describe('metadata versions are admin work', () => {
  it('needs a signed-in user', async () => {
    expect((await call('POST', V, undefined, { files: readMetadata() })).status).toBe(401);
  });

  it('a non-admin gets 403 on stage, publish, rollback and discard, even with a broken body', async () => {
    const user = token('u1', ['config.read', 'account.read']);
    expect((await call('POST', V, user, { files: readMetadata() })).status).toBe(403);
    expect((await call('POST', V, user, { nonsense: true })).status).toBe(403);
    const id = (await call('POST', V, token('ad', ADMIN), { files: readMetadata() })).body.id;
    expect((await call('POST', `${V}/${id}/publish`, user)).status).toBe(403);
    expect((await call('POST', `${V}/${id}/publish`, token('ed', ['config.edit']))).status).toBe(403);
    expect((await call('POST', `${V}/rollback`, user)).status).toBe(403);
    expect((await call('POST', `${V}/${id}/discard`, user)).status).toBe(403);
  });

  it('an admin stages, publishes and rolls back', async () => {
    const ad = token('ad', ADMIN);
    const v1 = (await call('POST', V, ad, { files: readMetadata() })).body.id;
    expect((await call('POST', `${V}/${v1}/publish`, ad))).toMatchObject({ status: 200, body: { id: v1, status: 'published' } });
    const files = editJson(readMetadata(), 'metadata/terms/en-US/lead.json', d => { d['lead.label'] = 'Prospect'; });
    const v2 = (await call('POST', V, ad, { files, note: 'relabel' })).body.id;
    expect((await call('POST', `${V}/${v2}/publish`, ad)).status).toBe(200);
    expect((await call('POST', `${V}/rollback`, ad))).toMatchObject({ status: 200, body: { id: v1 } });
    expect((await call('POST', `${V}/abc/publish`, ad)).status).toBe(404);
    expect((await call('POST', V, ad, { files: [] })).status).toBe(400);
  });
});
