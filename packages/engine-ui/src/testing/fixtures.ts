// Screen models for the renderer tests, built the way the API builds them: metadata files -> runtime model -> UI model.
// `lead` is the repository's real metadata. `account` (parent) and `contact` (child, one field of every type, a
// reference to account) are fixture objects, because the repository has no reference field yet.
import fs from 'node:fs';
import path from 'node:path';
import { buildUiModel, loadRuntimeModel } from '@dio-crm/engine';
import type { EngineUiModel, RecordData } from '../types';

type File = { path: string; content: string };
const repo = path.resolve(__dirname, '../../../..');
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
export const termOf = (locale: string, file: string, key: string): string =>
  JSON.parse(fs.readFileSync(path.join(repo, `metadata/terms/${locale}/${file}.json`), 'utf8'))[key];

const json = (file: string, value: unknown): File => ({ path: `metadata/${file}`, content: JSON.stringify(value) });
const field = (key: string, type: string, more: Record<string, unknown> = {}) => ({ aliases: [], key, labelKey: `fx.${key}`, required: false, system: false, type, ...more });
const placed = (key: string, sectionId: string, order: number, more: Record<string, unknown> = {}) => ({ key, sectionId, order, labelKey: `fx.${key}`, visible: true, required: false, readOnly: false, ...more });
const screen = (entity: string, screenKey: string, fields: unknown[]) => json(`objects/${entity}/screens/${screenKey}.json`, {
  screen: { entity, screenKey, tabs: [{ id: 'main', labelKey: 'fx.tab.main', order: 0 }, { id: 'more', labelKey: 'fx.tab.more', order: 1 }],
    sections: [{ id: 'basic', tabId: 'main', titleKey: 'fx.section.basic', order: 0, columns: 2 }, { id: 'extra', tabId: 'more', titleKey: 'fx.section.extra', order: 0, columns: 3 }] },
  fields: { entity, fields },
});
const CONTACT_FIELDS = [field('name', 'text', { required: true, maxLength: 40 }), field('account_ref', 'reference', { referenceObject: 'account' }), field('grade', 'enum', { enumCodeGroup: 'fx_grade' }),
  field('visits', 'integer'), field('amount', 'decimal', { precision: 9, scale: 2 }), field('vip', 'boolean'), field('born_on', 'date'), field('met_at', 'datetime'),
  field('secret', 'text'), field('locked', 'text'), field('updated_at', 'datetime', { system: true })];
const CONTACT_PLACED = [placed('name', 'basic', 0, { required: true }), placed('account_ref', 'basic', 1), placed('grade', 'basic', 2), placed('visits', 'basic', 3), placed('amount', 'extra', 0),
  placed('vip', 'extra', 1), placed('born_on', 'extra', 2), placed('met_at', 'extra', 3), placed('secret', 'extra', 4, { visible: false }), placed('locked', 'extra', 5, { readOnly: true }),
  placed('updated_at', 'extra', 6)];
const terms = (prefix: string) => {
  const keys = ['fx.account', 'fx.accounts', 'fx.contact', 'fx.contacts', 'fx.tab.main', 'fx.tab.more', 'fx.section.basic', 'fx.section.extra', 'fx.view.all', 'fx.view.vip', 'fx.grade.A', 'fx.grade.B', 'fx.grade.OLD',
    'fx.title', ...CONTACT_FIELDS.map(f => f.labelKey)];
  return Object.fromEntries(keys.map(k => [k, `${prefix}${k.slice('fx.'.length)}`]));
};

export const FIXTURE_FILES: File[] = [
  json('objects/account/object.json', { aliases: [], key: 'account', labelKey: 'fx.account', pluralLabelKey: 'fx.accounts' }),
  json('objects/account/fields.json', { fields: [field('title', 'text', { required: true }), field('grade', 'enum', { enumCodeGroup: 'fx_grade' })] }),
  screen('account', 'detail', [placed('title', 'basic', 0), placed('grade', 'basic', 1)]),
  screen('account', 'create', [placed('title', 'basic', 0, { required: true })]),
  json('objects/account/access.json', { entity: 'account', rules: [{ kind: 'all' }] }),
  json('objects/contact/object.json', { aliases: [], key: 'contact', labelKey: 'fx.contact', pluralLabelKey: 'fx.contacts' }),
  json('objects/contact/fields.json', { fields: CONTACT_FIELDS }),
  screen('contact', 'detail', CONTACT_PLACED),
  screen('contact', 'create', CONTACT_PLACED.filter(f => f.key !== 'updated_at')),
  json('objects/contact/list-views.json', { entity: 'contact', views: [
    { key: 'all', labelKey: 'fx.view.all', columns: ['name', 'account_ref', 'grade', 'vip', 'amount'], filter: { op: 'not', arg: { op: 'isEmpty', field: 'name' } }, sort: [{ field: 'name', direction: 'ASC' }], pageSize: 2, shared: true },
    { key: 'vip', labelKey: 'fx.view.vip', columns: ['name', 'met_at'], filter: { op: 'eq', field: 'vip', value: true }, sort: [], pageSize: 10, shared: true }] }),
  json('codes/fx_grade.json', { key: 'fx_grade', values: [{ code: 'A', labelKey: 'fx.grade.A', active: true, order: 1 }, { code: 'B', labelKey: 'fx.grade.B', active: true, order: 0 }, { code: 'OLD', labelKey: 'fx.grade.OLD', active: false, order: 2 }] }),
  json('terms/en-US/fx.json', terms('EN ')),
  json('terms/ko-KR/fx.json', terms('KO ')),
];

export function uiModel(objectKey: string, locale = 'en-US', access = { read: true, create: true }, files: File[] = [...readMetadata(), ...FIXTURE_FILES]): EngineUiModel {
  const loaded = loadRuntimeModel(files);
  const errors = loaded.issues.filter(i => i.severity === 'error');
  if (!loaded.model || errors.length) throw new Error(`fixture metadata does not load: ${errors.map(i => `${i.code} ${i.path}`).join('; ')}`);
  const ui = buildUiModel(loaded.model, objectKey, locale);
  if (!ui) throw new Error(`no ui model for ${objectKey} ${locale}`);
  return { ...ui, access };
}

export const CONTACT: RecordData = { id: '7', values: { name: 'Kim', account_ref: '3', grade: 'B', visits: 1200, amount: 1234.5, vip: true, born_on: '1990-02-03', met_at: '2026-11-28T01:02:00.000Z',
  secret: 'hidden-value', locked: 'L', updated_at: '2026-11-28T03:04:05.000Z' } };
export const LEADS: RecordData[] = [
  { id: '1', values: { hospital_name: 'Alpha Clinic', status: 'NEW', owner_name: 'u1', sido: null, sigungu: null, phone: '010', business_no: null, updated_at: '2026-11-28T01:02:03.000Z' } },
  { id: '2', values: { hospital_name: 'Beta <b>Clinic</b>', status: 'CONTACT_EXCLUDED', owner_name: 'u1', sido: 'S', sigungu: null, phone: null, business_no: null, updated_at: '2026-11-27T01:02:03.000Z' } },
];
