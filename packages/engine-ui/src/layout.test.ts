import { describe, expect, it } from 'vitest';
import { columnsOf, detailScreen, formScreen, placeScreen, viewOf } from './layout';
import { FIXTURE_FILES, readMetadata, uiModel } from './testing/fixtures';

const contact = uiModel('contact'), lead = uiModel('lead');
const keys = (model: typeof contact, screenKey: string) => placeScreen(model, model.screens.find(s => s.key === screenKey)!).map(t => [t.id, t.sections.map(s => [s.id, s.columns, s.fields.map(f => f.field.key)])]);

describe('screen layout', () => {
  it('nests tabs, sections and visible fields in order, and drops hidden fields', () => {
    expect(keys(contact, 'detail')).toEqual([['main', [['basic', 2, ['name', 'account_ref', 'grade', 'visits']]]], ['more', [['extra', 3, ['amount', 'vip', 'born_on', 'met_at', 'locked', 'updated_at']]]]]);
    expect(JSON.stringify(keys(contact, 'detail'))).not.toContain('secret');
  });

  it('lays out the real lead screens: two tabs on detail, one on create', () => {
    const detail = placeScreen(lead, detailScreen(lead)!), create = placeScreen(lead, formScreen(lead, 'create')!);
    expect(detail.map(t => [t.label, t.sections.map(s => s.title)])).toEqual([['Basics', ['General', 'Region']], ['Key person', ['Key person details', 'Systems in use']]]);
    expect(create.map(t => t.sections.map(s => s.fields.map(f => f.field.key)))).toEqual([[['hospital_name', 'status', 'owner_name', 'phone', 'business_no'], ['sido', 'sigungu', 'address']]]);
  });

  it('drops a section, and then a tab, that has no visible field', () => {
    const files = [...readMetadata(), ...FIXTURE_FILES].map(f => {
      if (f.path !== 'metadata/objects/contact/screens/detail.json') return f;
      const doc = JSON.parse(f.content);
      for (const x of doc.fields.fields) if (x.sectionId === 'extra') x.visible = false;
      return { ...f, content: JSON.stringify(doc) };
    });
    expect(keys(uiModel('contact', 'en-US', undefined, files), 'detail').map(t => t[0])).toEqual(['main']);
  });

  it('edits on the detail screen unless there is an edit screen, and creates on the create screen', () => {
    expect([formScreen(contact, 'create')?.key, formScreen(contact, 'edit')?.key, detailScreen(contact)?.key]).toEqual(['create', 'detail', 'detail']);
    const withEdit = { ...contact, screens: [...contact.screens, { ...contact.screens[0], key: 'edit', create: false }] };
    expect(formScreen(withEdit, 'edit')?.key).toBe('edit');
    const quick = { ...contact, screens: [{ ...contact.screens[0], key: 'create_quick', create: true }] };
    expect([formScreen(quick, 'create')?.key, formScreen(quick, 'edit'), detailScreen(quick)]).toEqual(['create_quick', undefined, undefined]);
  });

  it('picks the asked view or the first one, and its columns as fields', () => {
    expect([viewOf(contact, 'vip')?.key, viewOf(contact, 'nope')?.key, viewOf(contact, undefined)?.key]).toEqual(['vip', 'all', 'all']);
    expect(columnsOf(contact, viewOf(contact, 'all')).map(f => f.key)).toEqual(['name', 'account_ref', 'grade', 'vip', 'amount']);
    expect(columnsOf(contact, viewOf(contact, 'all'), 'account_ref').map(f => f.key)).toEqual(['name', 'grade', 'vip', 'amount']);
    expect(columnsOf(lead, viewOf(lead, 'excluded')).map(f => f.label)).toEqual(['Hospital name', 'Status', 'Owner', 'Contact exclusion reason', 'Updated at']);
    const account = uiModel('account');
    expect(viewOf(account, undefined)).toBeUndefined();
    expect(columnsOf(account, undefined).map(f => f.key)).toEqual(['title', 'grade']);
  });
});
