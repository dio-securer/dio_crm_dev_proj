// F2-7 wired: grants and the hierarchy come from the published settings (metadata/security), the token gives only roles.
// SQLite fake and the virtual domestic sales org of synthetic company -1. Never a real row.
import type { JwtPayload } from '../../security/security';
import { LEAD, engineFixture, readMetadata } from '../../../test/support/engine-fixture';
import { callerOf } from './actor';

const token = (publicId: string, roles: string[], companyId = -1, more: Partial<JwtPayload> = {}): JwtPayload =>
  ({ sub: 1, publicId, loginId: publicId, name: publicId, companyId, roles, permissions: [], scope: 'SELF', ...more });
const owners = (items: { values: Record<string, unknown> }[]) => items.map(i => i.values.owner_name).sort();
const S = ['SALES'], M = ['MANAGER'];

async function seeded() {
  const fx = await engineFixture(readMetadata({ security: true }));
  const people: [string, string[]][] = [['v-sales-gangnam-1', S], ['v-sales-gangnam-2', S], ['v-sales-jongno-1', S], ['v-sales-bundang-1', S],
    ['v-br-gangnam-head', M], ['v-div-cap-1-head', M], ['v-dom-head', M]];
  for (const [u, roles] of people) await fx.api.create(callerOf(token(u, roles)), 'lead', LEAD);
  const list = async (u: string, roles: string[], companyId = -1) => owners((await fx.api.list(callerOf(token(u, roles, companyId)), 'lead', {})).items);
  return { ...fx, list };
}

describe('security from the published settings', () => {
  it('salespeople see their own leads; heads see their subtree and nothing beside or above it', async () => {
    const { list } = await seeded();
    expect(await list('v-sales-gangnam-1', S)).toEqual(['v-sales-gangnam-1']);
    expect(await list('v-sales-jongno-1', S)).toEqual(['v-sales-jongno-1']);
    expect(await list('v-br-gangnam-head', M)).toEqual(['v-br-gangnam-head', 'v-sales-gangnam-1', 'v-sales-gangnam-2']);
    expect(await list('v-div-cap-1-head', M)).toEqual(['v-br-gangnam-head', 'v-div-cap-1-head', 'v-sales-gangnam-1', 'v-sales-gangnam-2', 'v-sales-jongno-1']);
    const region = await list('v-reg-cap-head', M);
    expect(region).toContain('v-sales-bundang-1');
    expect(region).not.toContain('v-dom-head');
  });

  it('a sibling branch lead is not found, and the same head id in another company sees nothing of company -1', async () => {
    const { api, list } = await seeded();
    const jongno = (await api.list(callerOf(token('v-sales-jongno-1', S)), 'lead', {})).items[0];
    await expect(api.get(callerOf(token('v-br-gangnam-head', M)), 'lead', String(jongno.id))).rejects.toMatchObject({ status: 404 });
    expect(await list('v-reg-cap-head', M, 7)).toEqual([]);
  });

  it('a role no profile names is closed; a salesperson cannot use manager rights', async () => {
    const { api } = await seeded();
    await expect(api.list(callerOf(token('v-sales-gangnam-1', ['GUEST'])), 'lead', {})).rejects.toMatchObject({ status: 403, code: 'OBJECT_ACCESS_DENIED' });
    await expect(api.list(callerOf(token('v-sales-gangnam-1', [])), 'lead', {})).rejects.toMatchObject({ status: 403 });
    const ui = await api.ui(callerOf(token('nobody', ['GUEST'])), 'lead', 'ko-KR');
    expect(ui.access).toEqual({ read: false, create: false });
  });

  it('a token cannot bring its own grants or subtree: callerOf takes only id, company, unit, permissions and roles', async () => {
    const { list } = await seeded();
    const forged = { ...token('v-sales-gangnam-1', S), grants: { sets: [{ key: 'x', objects: { lead: { read: true } } }] }, subtreeIds: ['v-sales-jongno-1'] } as unknown as JwtPayload;
    expect(Object.keys(callerOf(forged).actor).sort()).toEqual(['memberIds', 'permissions', 'roles', 'unitIds', 'userId']);
    expect(await list('v-sales-gangnam-1', S)).toEqual(['v-sales-gangnam-1']);
  });

  it('a head cannot hand a lead outside the subtree', async () => {
    const { api } = await seeded();
    const head = callerOf(token('v-br-gangnam-head', M));
    const mine = (await api.list(head, 'lead', {})).items.find(i => i.values.owner_name === 'v-sales-gangnam-1')!;
    await expect(api.update(head, 'lead', String(mine.id), { owner_name: 'v-sales-jongno-1' })).rejects.toMatchObject({ status: 403 });
  });
});
