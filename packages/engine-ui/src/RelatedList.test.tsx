import { describe, expect, it } from 'vitest';
import { RelatedList } from './RelatedList';
import type { EngineRoute } from './types';
import { CONTACT, uiModel } from './testing/fixtures';
import { all, hostElements, html, textOfElement } from './testing/render';

const account = uiModel('account'), contact = uiModel('contact');
const related = account.related[0];
const rows = [CONTACT, { id: '8', values: { name: 'Lee', account_ref: '3', grade: 'A', vip: false, amount: null } }];

describe('generic related list (relation derived from a reference field)', () => {
  it('lists the child rows under the child\'s plural label, with the child view\'s columns minus the reference itself', () => {
    expect(related).toEqual({ object: 'contact', field: 'account_ref', label: 'EN contacts', fieldLabel: 'EN account_ref' });
    const markup = html(<RelatedList related={related} model={contact} rows={rows} navigate={() => undefined} />);
    expect(markup).toContain('data-engine="related" data-object="contact" data-field="account_ref"');
    expect(markup).toContain('<h2>EN contacts <span class="engine-count">2</span></h2>');
    expect(all(markup, /<th[^>]*>([^<]*)<\/th>/g)).toEqual(['EN name', 'EN grade', 'EN vip', 'EN amount']);
    expect(all(markup, /<tr data-record-id="(\d+)"/g)).toEqual(['7', '8']);
    expect(markup).toContain('<td data-field="grade">EN grade.A</td>');
    expect(markup).toContain('<td data-field="vip">No</td>');
  });

  it('says so when nothing refers to the record', () => {
    const markup = html(<RelatedList related={related} model={contact} rows={[]} navigate={() => undefined} />);
    expect(markup).toContain('No related records.');
    expect(markup).toContain('<span class="engine-count">0</span>');
    expect(markup).not.toContain('<table');
  });

  it('opens a row as a record of the child object', () => {
    const seen: [EngineRoute, string | undefined][] = [];
    const buttons = hostElements(<RelatedList related={related} model={contact} rows={rows} navigate={(r, o) => { seen.push([r, o]); }} />).filter(e => e.type === 'button');
    (buttons.find(b => textOfElement(b) === 'Lee')!.props.onClick as () => void)();
    expect(seen).toEqual([[{ mode: 'detail', id: '8' }, 'contact']]);
  });

  it('uses the first fields of a child that has no list view', () => {
    const markup = html(<RelatedList related={{ object: 'account', field: 'grade', label: 'X', fieldLabel: 'Y' }} model={account} rows={[{ id: '1', values: { title: 'T', grade: 'A' } }]} navigate={() => undefined} />);
    expect(all(markup, /<th[^>]*>([^<]*)<\/th>/g)).toEqual(['EN title']);
  });
});
