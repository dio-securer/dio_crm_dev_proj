// Row conversion of the record store and the unlocked read of the published version (F2-4), with a recording fake.
import type { FieldDef } from '@dio-crm/contracts/metadata';
import { readPublishedFiles, readPublishedId } from './crm-meta-published';
import { MetaQuery } from './crm-meta-version-store';
import { recordOf } from './crm-obj-store';

const field = (key: string, type: string, more: Partial<FieldDef> = {}): FieldDef =>
  ({ key, type, labelKey: 'x', required: false, system: false, aliases: [], ...more } as FieldDef);
function recording(answer: (text: string) => Record<string, unknown>[]) {
  const log: { text: string; params?: Record<string, unknown> }[] = [];
  const query: MetaQuery = async (text, params) => { log.push({ text, params }); return { recordset: answer(text) }; };
  return { log, transaction: <T>(work: (q: MetaQuery) => Promise<T>) => work(query) };
}

describe('record store', () => {
  it('turns SQL Server driver values into API values', () => {
    const object = { key: 'x', fields: [field('n', 'integer'), field('d', 'date'), field('t', 'datetime'), field('b', 'boolean'), field('c', 'boolean'),
      field('m', 'decimal'), field('s', 'text'), field('e', 'text'), field('updated_at', 'datetime', { system: true })] };
    const row = { id: '9007199254740', f_n: '42', f_d: new Date('2026-02-03T00:00:00Z'), f_t: new Date('2026-02-03T04:05:06.007Z'), f_b: true, f_c: 0,
      f_m: 12.5, f_s: 'x', f_e: null, updated_at: '2026-01-01T00:00:00.000Z' };
    expect(recordOf(object, row)).toEqual({ id: '9007199254740', values: { n: 42, d: '2026-02-03', t: '2026-02-03T04:05:06.007Z', b: true, c: false,
      m: 12.5, s: 'x', e: null, updated_at: '2026-01-01T00:00:00.000Z' } });
  });

  it('reads the published pointer without a lock, and only a version that is still published', async () => {
    const db = recording(text => (text.includes('crm_meta_pointer') ? [{ published_version_id: 3 }] : [{ id: 3, files_json: '[{"path":"a","content":"b"}]' }]));
    expect(await readPublishedId(db)).toBe(3);
    expect(await readPublishedFiles(db, 3)).toEqual({ id: 3, files: [{ path: 'a', content: 'b' }] });
    expect(db.log.map(l => l.text)).toEqual(['SELECT published_version_id FROM dbo.crm_meta_pointer WHERE id = 1',
      "SELECT id, files_json FROM dbo.crm_meta_version WHERE id = @id AND status = N'published'"]);
    expect(db.log[1].params).toEqual({ id: 3 });
    for (const l of db.log) expect(l.text).not.toMatch(/UPDLOCK|HOLDLOCK/);
    const none = recording(() => [{ published_version_id: null }]);
    expect(await readPublishedId(none)).toBeUndefined();
    expect(await readPublishedFiles(recording(() => []), 4)).toBeUndefined();
  });
});
