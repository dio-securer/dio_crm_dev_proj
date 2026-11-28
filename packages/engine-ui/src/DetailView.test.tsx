import { describe, expect, it } from 'vitest';
import { DetailView } from './DetailView';
import { CONTACT, LEADS, termOf, uiModel } from './testing/fixtures';
import { all, html } from './testing/render';

const lead = uiModel('lead'), contact = uiModel('contact');
const noop = () => undefined;
const cells = (markup: string) => all(markup, /<div class="engine-cell" data-field="(\w+)"/g);

describe('generic detail: the real lead settings', () => {
  const record = { id: '1', values: { ...LEADS[0].values, keyman_surname: 'Park', main_system: 'Sys' } };
  it('shows the first tab\'s sections and fields with labels and values, titled by the first field', () => {
    const markup = html(<DetailView model={lead} record={record} navigate={noop} />);
    expect(markup).toContain('<p class="engine-kicker">Lead</p><h1>Alpha Clinic</h1>');
    expect(all(markup, /role="tab"[^>]*aria-selected="(true|false)"/g)).toEqual(['true', 'false']);
    expect(all(markup, /role="tab"[^>]*>([^<]+)<\/button>/g)).toEqual(['Basics', 'Key person']);
    expect(all(markup, /<h2>([^<]+)<\/h2>/g)).toEqual(['General', 'Region']);
    expect(markup).toContain('<dt>Hospital name</dt><dd>Alpha Clinic</dd>');
    expect(markup).toContain('<dt>Status</dt><dd>New</dd>');
    expect(markup).not.toContain('Park');
    expect(markup).toContain('grid-template-columns:repeat(2, minmax(0, 1fr))');
  });

  it('shows another tab when asked, and ko-KR labels for a ko-KR model', () => {
    const second = html(<DetailView model={lead} record={record} navigate={noop} initialTab="keyman" />);
    expect(all(second, /<h2>([^<]+)<\/h2>/g)).toEqual(['Key person details', 'Systems in use']);
    expect(second).toContain('<dd>Park</dd>');
    expect(second).not.toContain('<dt>Hospital name</dt>');
    const ko = html(<DetailView model={uiModel('lead', 'ko-KR')} record={record} navigate={noop} />);
    expect(ko).toContain(`<dt>${termOf('ko-KR', 'lead', 'lead.field.hospital_name')}</dt><dd>Alpha Clinic</dd>`);
    expect(ko).toContain(`>${termOf('ko-KR', 'engine', 'engine.action.edit')}</button>`);
    expect(ko).not.toMatch(/Hospital name|>Edit</);
  });
});

describe('generic detail: fixture object with every field type', () => {
  it('never shows a field the screen hides, and formats each type', () => {
    const markup = html(<DetailView model={contact} record={CONTACT} navigate={noop} initialTab="more" display={{ timeZone: 'UTC' }} />);
    expect(cells(markup)).toEqual(['amount', 'vip', 'born_on', 'met_at', 'locked', 'updated_at']);
    expect(markup).not.toContain('hidden-value');
    expect(markup).toContain('<dt>EN amount</dt><dd>1,234.5</dd>');
    expect(markup).toContain('<dt>EN vip</dt><dd>Yes</dd>');
    expect(markup).toContain('<dt>EN born_on</dt><dd>1990-02-03</dd>');
    expect(markup).toContain('grid-template-columns:repeat(3, minmax(0, 1fr))');
    const first = html(<DetailView model={contact} record={CONTACT} navigate={noop} />);
    expect(cells(first)).toEqual(['name', 'account_ref', 'grade', 'visits']);
    expect(first).toContain('<dt>EN grade</dt><dd>EN grade.B</dd>');
    expect(first).not.toContain('hidden-value');
  });

  it('falls back to the first tab for an unknown tab, titles an untitled record by its id, and renders related lists under the fields', () => {
    const markup = html(<DetailView model={contact} record={{ id: '9', values: {} }} navigate={noop} initialTab="nope"><p id="slot">related</p></DetailView>);
    expect(markup).toContain('<h1>EN contact #9</h1>');
    expect(cells(markup)).toEqual(['name', 'account_ref', 'grade', 'visits']);
    expect(markup.indexOf('id="slot"')).toBeGreaterThan(markup.indexOf('role="tabpanel"'));
  });
});
