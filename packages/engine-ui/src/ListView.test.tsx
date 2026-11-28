import { describe, expect, it } from 'vitest';
import { ListView } from './ListView';
import type { EngineRoute } from './types';
import { CONTACT, LEADS, termOf, uiModel } from './testing/fixtures';
import { all, hostElements, html, textOfElement } from './testing/render';

const lead = uiModel('lead'), contact = uiModel('contact');
const page = (items = LEADS, limit = 25, offset = 0) => ({ items, limit, offset });
const headers = (markup: string) => all(markup, /<th[^>]*>([^<]*)<\/th>/g);
const noop = () => undefined;

describe('generic list: the real lead settings', () => {
  it('shows the view\'s columns with their labels, code labels for enum values, and escapes record text', () => {
    const markup = html(<ListView model={lead} page={page()} navigate={noop} display={{ timeZone: 'UTC' }} />);
    expect(markup).toContain('<h1>Leads</h1>');
    expect(headers(markup)).toEqual(['Hospital name', 'Status', 'Owner', 'Province', 'District', 'Phone', 'Business number', 'Updated at']);
    expect(all(markup, /<tr data-record-id="(\d+)"/g)).toEqual(['1', '2']);
    expect(markup).toContain('<td data-field="status">New</td>');
    expect(markup).toContain('<td data-field="status">Contact excluded</td>');
    expect(markup).toContain('Beta &lt;b&gt;Clinic&lt;/b&gt;');
    expect(markup).not.toContain('<b>Clinic</b>');
    expect(markup).toMatch(/<td data-field="updated_at">Nov 28, 2026, 1:02\sAM<\/td>/);
    expect(markup).toContain('<td data-field="sido"></td>');
  });

  it('takes every label from the ko-KR terms when the model is in ko-KR', () => {
    const ko = uiModel('lead', 'ko-KR');
    const markup = html(<ListView model={ko} page={page()} navigate={noop} />);
    expect(headers(markup).slice(0, 2)).toEqual([termOf('ko-KR', 'lead', 'lead.field.hospital_name'), termOf('ko-KR', 'lead', 'lead.field.status')]);
    expect(markup).toContain(`<h1>${termOf('ko-KR', 'lead', 'lead.plural')}</h1>`);
    expect(markup).toContain(`<td data-field="status">${termOf('ko-KR', 'lead', 'lead.status.NEW')}</td>`);
    expect(markup).toContain(termOf('ko-KR', 'engine', 'engine.action.new'));
    expect(markup).not.toMatch(/Hospital name|>New<|Previous/);
  });

  it('offers the other views, and shows the chosen view\'s columns', () => {
    const markup = html(<ListView model={lead} viewKey="excluded" page={page()} navigate={noop} />);
    expect(all(markup, /<option value="([^"]*)"/g)).toEqual(['hq_default', 'excluded']);
    expect(markup).toContain('<option value="excluded" selected="">Excluded leads</option>');
    expect(headers(markup)).toEqual(['Hospital name', 'Status', 'Owner', 'Contact exclusion reason', 'Updated at']);
  });
});

describe('generic list: behaviour', () => {
  it('shows the create button only when the user may create', () => {
    expect(html(<ListView model={lead} page={page()} navigate={noop} />)).toContain('>New</button>');
    expect(html(<ListView model={{ ...lead, access: { read: true, create: false } }} page={page()} navigate={noop} />)).not.toContain('>New</button>');
  });

  it('says so when there are no rows, and draws no table', () => {
    const markup = html(<ListView model={lead} page={page([])} navigate={noop} />);
    expect(markup).toContain('<p class="engine-empty">No records to show.</p>');
    expect(markup).not.toContain('<table');
  });

  it('opens a row, creates, changes the view and pages through navigate', () => {
    const seen: EngineRoute[] = [];
    const rows = [CONTACT, { id: '8', values: { name: null } }];
    const elements = hostElements(<ListView model={contact} viewKey="all" page={page(rows, 2, 2)} navigate={r => { seen.push(r); }} />);
    const buttons = elements.filter(e => e.type === 'button'), click = (label: string) => (buttons.find(b => textOfElement(b) === label)!.props.onClick as () => void)();
    click('Kim'); click('#8'); click('New'); click('Previous'); click('Next');
    (elements.find(e => e.type === 'select')!.props.onChange as (e: unknown) => void)({ target: { value: 'vip' } });
    expect(seen).toEqual([{ mode: 'detail', id: '7' }, { mode: 'detail', id: '8' }, { mode: 'create' }, { mode: 'list', view: 'all', offset: 0 }, { mode: 'list', view: 'all', offset: 4 }, { mode: 'list', view: 'vip' }]);
  });

  it('disables Previous on the first page and Next when the page is not full', () => {
    const disabled = (markup: string) => all(markup, /<button type="button" class="engine-button"( disabled="")?>(?:Previous|Next)/g).map(Boolean);
    expect(disabled(html(<ListView model={contact} page={page([CONTACT], 2, 0)} navigate={noop} />))).toEqual([true, true]);
    expect(disabled(html(<ListView model={contact} page={page([CONTACT, CONTACT], 2, 0)} navigate={noop} />))).toEqual([true, false]);
    expect(disabled(html(<ListView model={contact} page={page([CONTACT], 2, 2)} navigate={noop} />))).toEqual([false, true]);
    expect(html(<ListView model={contact} page={page([CONTACT], 2, 4)} navigate={noop} />)).toContain('<span>Page 3</span>');
  });
});
