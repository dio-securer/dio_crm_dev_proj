import { describe, expect, it } from 'vitest';
import { engineApi, enginePath, parseEngineRoute } from './engine-route';

const q = (text = '') => new URLSearchParams(text);

describe('engine screen URLs', () => {
  it('reads the four screens from the path and the list state from the query', () => {
    expect(parseEngineRoute('', q())).toEqual({ mode: 'list' });
    expect(parseEngineRoute('', q('view=excluded&offset=50'))).toEqual({ mode: 'list', view: 'excluded', offset: 50 });
    expect(parseEngineRoute('new', q())).toEqual({ mode: 'create' });
    expect(parseEngineRoute('12', q())).toEqual({ mode: 'detail', id: '12' });
    expect(parseEngineRoute('12/edit', q())).toEqual({ mode: 'edit', id: '12' });
  });

  it('refuses paths that are not a screen and drops query values that are not a view key or an offset', () => {
    for (const rest of ['abc', '0', '-1', '12/remove', '12/edit/x', 'new/12', '1e3', '12345678901234567']) expect(parseEngineRoute(rest, q())).toBeUndefined();
    expect(parseEngineRoute('', q('view=a%20b&offset=-5'))).toEqual({ mode: 'list' });
    expect(parseEngineRoute('', q('offset=1.5'))).toEqual({ mode: 'list' });
  });

  it('writes a path that reads back as the same route', () => {
    for (const route of [{ mode: 'list' }, { mode: 'list', view: 'hq_default', offset: 25 }, { mode: 'create' }, { mode: 'detail', id: '7' }, { mode: 'edit', id: '7' }] as const) {
      const url = new URL(enginePath('lead', route), 'http://x');
      expect(url.pathname.startsWith('/engine/lead')).toBe(true);
      expect(parseEngineRoute(url.pathname.slice('/engine/lead'.length), url.searchParams)).toEqual(route);
    }
    expect(enginePath('lead', { mode: 'list' })).toBe('/engine/lead');
  });

  it('builds engine API paths with every value encoded', () => {
    expect(engineApi.model('lead', 'ko-KR')).toBe('/api/engine/objects/lead/ui?locale=ko-KR');
    expect(engineApi.record('lead', '7')).toBe('/api/engine/objects/lead/records/7');
    expect(engineApi.records('lead')).toBe('/api/engine/objects/lead/records');
    expect(engineApi.records('visit', { view: 'v', limit: 20, offset: 40, ref: { field: 'lead_ref', value: '7&x=1' } })).toBe('/api/engine/objects/visit/records?view=v&limit=20&offset=40&ref.lead_ref=7%26x%3D1');
    expect(engineApi.record('a/b', '../1')).toBe('/api/engine/objects/a%2Fb/records/..%2F1');
  });
});
