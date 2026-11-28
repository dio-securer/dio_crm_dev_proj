import { describe, expect, it } from 'vitest';
import { RecordForm } from './RecordForm';
import { CONTACT, LEADS, termOf, uiModel } from './testing/fixtures';
import { all, html } from './testing/render';

const lead = uiModel('lead'), contact = uiModel('contact');
const noop = () => undefined;
const input = (markup: string, key: string) => new RegExp(`<(?:input|select)[^>]*id="engine-field-${key}"[^>]*>`).exec(markup)?.[0] ?? '';

describe('generic form: the real lead create screen', () => {
  it('draws the create screen\'s sections and fields as inputs, marks required fields, and offers the active codes', () => {
    const markup = html(<RecordForm model={lead} mode="create" onSubmit={noop} onCancel={noop} />);
    expect(markup).toContain('data-engine="form" data-mode="create" data-object="lead"');
    expect(markup).toContain('<h1>Lead · New</h1>');
    expect(all(markup, /<h2>([^<]+)<\/h2>/g)).toEqual(['General', 'Region']);
    expect(all(markup, /data-field="(\w+)"/g)).toEqual(['hospital_name', 'status', 'owner_name', 'phone', 'business_no', 'sido', 'sigungu', 'address']);
    expect(markup).toMatch(/<label for="engine-field-hospital_name">Hospital name<span class="engine-required" title="required"> \*<\/span><\/label>/);
    expect(markup).toContain('<label for="engine-field-phone">Phone</label>');
    expect(input(markup, 'hospital_name')).toMatch(/type="text"/);
    expect(input(markup, 'hospital_name')).toContain('required=""');
    expect(input(markup, 'phone')).not.toContain('required');
    expect(input(markup, 'status')).toMatch(/^<select/);
    expect(all(markup, /<option value="([^"]*)"/g)).toEqual(['', 'NEW', 'FIRST_VISIT', 'KEYMAN_MEETING', 'CONTACT_EXCLUDED', 'CONVERTED']);
    expect(markup).toContain('<option value="NEW">New</option>');
    expect(markup).not.toContain('role="alert"');
    expect(markup).not.toContain('<legend>');
  });

  it('uses the ko-KR terms for labels, codes and buttons when the model is ko-KR', () => {
    const markup = html(<RecordForm model={uiModel('lead', 'ko-KR')} mode="create" onSubmit={noop} onCancel={noop} />);
    expect(markup).toContain(`<label for="engine-field-phone">${termOf('ko-KR', 'lead', 'lead.field.phone')}</label>`);
    expect(markup).toContain(`<option value="NEW">${termOf('ko-KR', 'lead', 'lead.status.NEW')}</option>`);
    expect(markup).toContain(`>${termOf('ko-KR', 'engine', 'engine.action.save')}</button>`);
    expect(markup).not.toMatch(/>Save<|>Phone<|>New</);
  });

  it('edits on the detail screen with the record\'s values; a field the API refuses is disabled', () => {
    const markup = html(<RecordForm model={lead} mode="edit" record={LEADS[0]} onSubmit={noop} onCancel={noop} />);
    expect(markup).toContain('data-mode="edit"');
    expect(markup).toContain('<h1>Lead · Edit</h1>');
    expect(input(markup, 'hospital_name')).toContain('value="Alpha Clinic"');
    expect(markup).toContain('<option value="NEW" selected="">New</option>');
    expect(all(markup, /<legend>([^<]+)<\/legend>/g)).toEqual(['Basics', 'Key person']);
    expect(input(markup, 'updated_at')).toContain('disabled=""');
    expect(input(markup, 'hospital_name')).not.toContain('disabled');
  });
});

describe('generic form: fixture object with every field type', () => {
  const markup = html(<RecordForm model={contact} mode="edit" record={CONTACT} onSubmit={noop} onCancel={noop} />);
  it('picks the input by field type and fills it from the record', () => {
    expect(input(markup, 'name')).toMatch(/type="text"[^>]*maxLength="40"[^>]*value="Kim"|maxLength="40"/);
    expect(input(markup, 'name')).toContain('value="Kim"');
    expect(input(markup, 'visits')).toMatch(/type="number"/);
    expect(input(markup, 'visits')).toContain('step="1"');
    expect(input(markup, 'amount')).toContain('step="any"');
    expect(input(markup, 'vip')).toMatch(/type="checkbox"[^>]*checked=""/);
    expect(input(markup, 'born_on')).toMatch(/type="date"[^>]*value="1990-02-03"/);
    expect(input(markup, 'met_at')).toMatch(/type="datetime-local"[^>]*value="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}"/);
    expect(input(markup, 'account_ref')).toMatch(/type="text"[^>]*value="3"/);
    expect(markup).toContain('<option value="B" selected="">EN grade.B</option>');
  });

  it('leaves hidden fields out, disables read-only ones, and does not mark a disabled field as required', () => {
    expect(markup).not.toContain('engine-field-secret');
    expect(markup).not.toContain('hidden-value');
    expect(input(markup, 'locked')).toContain('disabled=""');
    expect(input(markup, 'updated_at')).toContain('disabled=""');
    expect(input(markup, 'name')).not.toContain('disabled');
  });

  it('keeps a stored code that is no longer active selectable, so opening the form does not change it', () => {
    const old = html(<RecordForm model={contact} mode="edit" record={{ ...CONTACT, values: { ...CONTACT.values, grade: 'OLD' } }} onSubmit={noop} onCancel={noop} />);
    expect(old).toContain('<option value="OLD" selected="">OLD</option>');
    expect(markup).not.toContain('value="OLD"');
  });

  it('shows a refused save: field errors under their inputs (linked for screen readers), the rest on top', () => {
    const errors = { form: ['Some values need to be corrected. See the marked fields.', 'ghost: This field does not exist.'], fields: { name: ['This field is required.'], visits: ['The value has the wrong format.'] } };
    const refused = html(<RecordForm model={contact} mode="create" errors={errors} initialInput={{ visits: '12abc' }} onSubmit={noop} onCancel={noop} />);
    expect(refused).toContain('<div class="engine-banner" role="alert"><p>Some values need to be corrected. See the marked fields.</p><p>ghost: This field does not exist.</p></div>');
    expect(refused).toContain('<p id="engine-field-name-error" class="engine-error" role="alert">This field is required.</p>');
    expect(input(refused, 'name')).toContain('aria-invalid="true"');
    expect(input(refused, 'name')).toContain('aria-describedby="engine-field-name-error"');
    expect(input(refused, 'visits')).toContain('value="12abc"');
    expect(input(refused, 'grade')).not.toContain('aria-invalid');
    expect(all(refused, /class="engine-cell engine-invalid" data-field="(\w+)"/g)).toEqual(['name', 'visits']);
  });

  it('disables every input and both buttons while a save is running', () => {
    const busy = html(<RecordForm model={contact} mode="create" busy onSubmit={noop} onCancel={noop} />);
    const controls = all(busy, /(<(?:input|select|button)\b[^>]*>)/g);
    expect(controls.length).toBe(11);
    expect(controls.filter(tag => !tag.includes(' disabled=""'))).toEqual([]);
    const idle = all(html(<RecordForm model={contact} mode="create" onSubmit={noop} onCancel={noop} />), /(<(?:input|select|button)\b[^>]*>)/g);
    expect(idle.filter(tag => tag.includes(' disabled=""'))).toHaveLength(1);
  });
});
