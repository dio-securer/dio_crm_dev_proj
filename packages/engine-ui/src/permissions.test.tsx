// F2-7: the renderers over a screen model narrowed by field permissions (as the API sends it): an unreadable field is
// drawn nowhere, even if a record still carried its value; a readable but uneditable field is disabled and never sent.
import { describe, expect, it } from 'vitest';
import { fieldAccessOf, restrictUiModel } from '@dio-crm/engine';
import { DetailView } from './DetailView';
import { ListView } from './ListView';
import { RecordForm } from './RecordForm';
import { editableFields } from './form-values';
import { formScreen, placeScreen } from './layout';
import { LEADS, uiModel } from './testing/fixtures';
import { all, html } from './testing/render';
import type { EngineUiModel } from './types';

const grants = {
  sets: [{ key: 'sales', objects: { lead: { read: true, edit: true, create: true } }, fields: { lead: { '*': { read: true, edit: true }, phone: { read: true } } } }],
  restrictions: [{ key: 'pii', fields: { lead: { business_no: { read: true } } } }],
};
const full = uiModel('lead');
const lead: EngineUiModel = { ...restrictUiModel(full, fieldAccessOf(grants, 'lead')), access: full.access };
const leaky = { ...LEADS[0], values: { ...LEADS[0].values, business_no: 'SECRET-123' } };
const noop = () => undefined;

describe('renderers under field permissions', () => {
  it('the detail view does not draw an unreadable field or its value', () => {
    const markup = html(<DetailView model={lead} record={leaky} navigate={noop} />);
    expect(all(markup, /data-field="(\w+)"/g)).not.toContain('business_no');
    expect(markup).not.toContain('SECRET-123');
    expect(all(html(<DetailView model={full} record={leaky} navigate={noop} />), /data-field="(\w+)"/g)).toContain('business_no');
  });

  it('the list drops an unreadable column', () => {
    const page = { items: [leaky], limit: 50, offset: 0 };
    const markup = html(<ListView model={lead} page={page} navigate={noop} />);
    expect(markup).not.toContain('SECRET-123');
  });

  it('the form leaves out an unreadable field, disables a read-only one and never sends it', () => {
    const markup = html(<RecordForm model={lead} mode="edit" record={leaky} onSubmit={noop} onCancel={noop} />);
    expect(all(markup, /data-field="(\w+)"/g)).not.toContain('business_no');
    expect(/<input[^>]*id="engine-field-phone"[^>]*>/.exec(markup)?.[0]).toContain('disabled=""');
    const tabs = placeScreen(lead, formScreen(lead, 'edit')!);
    expect(editableFields(tabs).map(f => f.key)).not.toContain('phone');
    expect(editableFields(tabs).map(f => f.key)).toContain('hospital_name');
  });
});
