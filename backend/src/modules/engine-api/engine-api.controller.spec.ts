// HTTP layer of the automatic API (F2-4): the real AuthGuard and controller over the engine records on the SQLite fake.
import { HttpException, INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { env } from '../../config/env';
import { AuthGuard } from '../../security/security';
import { LEAD, engineFixture } from '../../../test/support/engine-fixture';
import { callerOf } from './actor';
import { EngineApiController } from './engine-api.controller';
import { EngineApiService, toHttp } from './engine-api.service';
import { AccessTooWideError } from '../../database/crm-obj-sql';

let app: INestApplication;
let base = '';
let jwt: JwtService;
const token = (publicId: string, companyId = 1, more: Record<string, unknown> = {}) =>
  jwt.sign({ sub: 1, publicId, loginId: publicId, name: publicId, companyId, roles: ['SALES'], permissions: [], scope: 'SELF', ...more }, { secret: env.JWT_ACCESS_SECRET });
async function call(method: string, path: string, auth?: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  const { api } = await engineFixture();
  const moduleRef = await Test.createTestingModule({ imports: [JwtModule.register({})], controllers: [EngineApiController], providers: [AuthGuard, EngineApiService] })
    .overrideProvider(EngineApiService).useValue({ records: api }).compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  base = await app.getUrl();
  jwt = moduleRef.get(JwtService);
});
afterAll(() => app.close());

describe('engine API over HTTP', () => {
  it('needs a valid access token', async () => {
    expect((await call('GET', '/api/engine/objects/lead/records')).status).toBe(401);
    expect((await call('GET', '/api/engine/objects/lead/records', 'not-a-token')).status).toBe(401);
  });

  it('creates, reads, updates and lists for the signed-in user only', async () => {
    const created = await call('POST', '/api/engine/objects/lead/records', token('pub-1'), LEAD);
    expect(created.status).toBe(201);
    expect(created.body.values.owner_name).toBe('pub-1');
    const path = `/api/engine/objects/lead/records/${created.body.id}`;
    expect((await call('GET', path, token('pub-1'))).body.values.hospital_name).toBe('H1');
    expect((await call('PATCH', path, token('pub-1'), { phone: '010' })).body.values.phone).toBe('010');
    expect((await call('GET', path, token('pub-2'))).status).toBe(404);
    expect((await call('GET', path, token('pub-1', 2))).status).toBe(404);
    expect((await call('GET', '/api/engine/objects/lead/records', token('pub-2'))).body.items).toEqual([]);
  });

  it('answers field errors with 400 and their codes, and other engine errors with their status', async () => {
    const bad = await call('POST', '/api/engine/objects/lead/records', token('pub-1'), { ...LEAD, updated_at: '2026-01-01T00:00:00Z' });
    expect(bad).toEqual({ status: 400, body: { statusCode: 400, error: 'INVALID_RECORD', errors: [{ code: 'SYSTEM_FIELD', field: 'updated_at' }] } });
    expect((await call('POST', '/api/engine/objects/lead/records', token('pub-1'), { ...LEAD, owner_name: 'pub-2' })).status).toBe(403);
    expect((await call('GET', '/api/engine/objects/nope/records', token('pub-1'))).body.error).toBe('OBJECT_NOT_FOUND');
    expect((await call('GET', '/api/engine/objects/lead/records?limit=500', token('pub-1'))).body.error).toBe('BAD_PAGE');
  });

  it('serves the screen model and a list view to a signed-in user only', async () => {
    expect((await call('GET', '/api/engine/objects/lead/ui?locale=en-US')).status).toBe(401);
    const ui = await call('GET', '/api/engine/objects/lead/ui?locale=en-US', token('pub-1'));
    expect(ui.status).toBe(200);
    expect(ui.body).toMatchObject({ locale: 'en-US', object: { key: 'lead', label: 'Lead', pluralLabel: 'Leads' }, access: { read: true, create: true } });
    expect((await call('GET', '/api/engine/objects/lead/ui', token('pub-1'))).body.error).toBe('BAD_LOCALE');
    const view = await call('GET', '/api/engine/objects/lead/records?view=hq_default', token('pub-1'));
    expect([view.status, view.body.limit]).toEqual([200, 25]);
    expect((await call('GET', '/api/engine/objects/lead/records?view=nope', token('pub-1'))).body.error).toBe('BAD_VIEW');
    expect((await call('GET', '/api/engine/objects/lead/records?ref.phone=1', token('pub-1'))).body.error).toBe('BAD_FILTER');
  });

  it('turns the data layer\'s too-wide refusal into 403 with its code, and leaves unknown errors to Nest (500)', () => {
    const http = toHttp(new AccessTooWideError()) as HttpException;
    expect([http.getStatus(), http.getResponse()]).toEqual([403, { statusCode: 403, error: 'ACCESS_TOO_WIDE', errors: [] }]);
    const other = new Error('boom');
    expect(toHttp(other)).toBe(other);
  });
});

describe('caller from the access token', () => {
  const user = { sub: 1, publicId: 'p', loginId: 'l', name: 'n', companyId: 3, organizationId: 9, roles: [], permissions: ['a'], scope: 'SELF' as const };
  it('uses publicId, the company, the organization as the only unit, and no members', () => {
    expect(callerOf(user)).toEqual({ companyId: 3, actor: { userId: 'p', permissions: ['a'], roles: [], unitIds: ['9'], memberIds: [] } });
    expect(callerOf({ ...user, organizationId: undefined }).actor.unitIds).toEqual([]);
  });
  it('refuses a token without a user id or company', () => {
    expect(() => callerOf(undefined)).toThrow('ENGINE_API_NO_ACTOR');
    expect(() => callerOf({ ...user, publicId: '' })).toThrow('ENGINE_API_NO_ACTOR');
    expect(() => callerOf({ ...user, companyId: '3' as unknown as number })).toThrow('ENGINE_API_NO_ACTOR');
  });
});
