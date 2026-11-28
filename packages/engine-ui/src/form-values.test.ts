import { describe, expect, it } from 'vitest';
import { editableFields, fromInput, initialState, mapErrors, payloadOf, toInput, toLocalInput } from './form-values';
import { formScreen, placeScreen } from './layout';
import { fieldOf } from './text';
import { CONTACT, uiModel } from './testing/fixtures';

const contact = uiModel('contact'), f = (key: string) => fieldOf(contact, key)!;
const createTabs = placeScreen(contact, formScreen(contact, 'create')!), editTabs = placeScreen(contact, formScreen(contact, 'edit')!);

describe('input values', () => {
  it('turns stored values into input text and back', () => {
    expect([toInput(f('name'), 'Kim'), toInput(f('visits'), 12), toInput(f('amount'), 1.5), toInput(f('born_on'), '1990-02-03'), toInput(f('grade'), 'A')]).toEqual(['Kim', '12', '1.5', '1990-02-03', 'A']);
    expect([toInput(f('vip'), true), toInput(f('vip'), null), toInput(f('vip'), undefined)]).toEqual([true, false, false]);
    expect([toInput(f('name'), null), toInput(f('visits'), undefined), toInput(f('met_at'), null)]).toEqual(['', '', '']);
    expect([fromInput(f('name'), ' Kim '), fromInput(f('visits'), '12'), fromInput(f('amount'), '1.50'), fromInput(f('vip'), true), fromInput(f('vip'), false), fromInput(f('born_on'), '1990-02-03')])
      .toEqual([' Kim ', 12, 1.5, true, false, '1990-02-03']);
    expect([fromInput(f('name'), ''), fromInput(f('name'), '   '), fromInput(f('visits'), ''), fromInput(f('met_at'), '')]).toEqual([null, null, null, null]);
  });

  it('sends text that is not a number or a date as it is, so the server names the error', () => {
    expect([fromInput(f('visits'), '12abc'), fromInput(f('amount'), '1,5'), fromInput(f('met_at'), 'soon')]).toEqual(['12abc', '1,5', 'soon']);
  });

  it('keeps a date-time through the local input and back (to the minute), whatever the time zone', () => {
    for (const iso of ['2026-11-28T01:02:00.000Z', '1000-01-01T00:00:00.000Z', '2024-02-29T23:59:00.000Z']) {
      const local = toLocalInput(iso);
      expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(fromInput(f('met_at'), local)).toBe(iso);
    }
    expect(toLocalInput('junk')).toBe('');
  });
});

describe('request body', () => {
  it('create sends every filled field and nothing else: no blanks, no unchecked boxes, no hidden or read-only fields', () => {
    const initial = initialState(createTabs);
    expect(initial).toMatchObject({ name: '', vip: false, visits: '' });
    expect(initial).not.toHaveProperty('secret');
    const state = { ...initial, name: 'Kim', visits: '3', grade: 'A', vip: true, locked: 'tried', secret: 'tried', amount: '  ' };
    expect(payloadOf(createTabs, 'create', state, initial)).toEqual({ name: 'Kim', visits: 3, grade: 'A', vip: true });
    expect(payloadOf(createTabs, 'create', initial, initial)).toEqual({});
    expect(editableFields(createTabs).map(x => x.key)).toEqual(['name', 'account_ref', 'grade', 'visits', 'amount', 'vip', 'born_on', 'met_at']);
  });

  it('edit sends only the fields whose input changed; a cleared field goes as null', () => {
    const initial = initialState(editTabs, CONTACT);
    expect(initial).toMatchObject({ name: 'Kim', visits: '1200', vip: true, grade: 'B', born_on: '1990-02-03', locked: 'L' });
    expect(payloadOf(editTabs, 'edit', initial, initial)).toEqual({});
    const state = { ...initial, name: 'Lee', visits: '', vip: false, locked: 'changed', updated_at: '2020-01-01T00:00' };
    expect(payloadOf(editTabs, 'edit', state, initial)).toEqual({ name: 'Lee', visits: null, vip: false });
    // Read-only on this screen only (the field itself is writable elsewhere): still not sent from this screen.
    const frozen = editTabs.map(t => ({ ...t, sections: t.sections.map(x => ({ ...x, fields: x.fields.map(y => (y.field.key === 'name' ? { ...y, screen: { ...y.screen, readOnly: true } } : y)) })) }));
    expect(payloadOf(frozen, 'edit', state, initial)).toEqual({ visits: null, vip: false });
  });
});

describe('a refused save', () => {
  it('puts field errors under fields the form shows and everything else on top, in the model language', () => {
    const failure = { status: 400, code: 'INVALID_RECORD', errors: [{ code: 'REQUIRED', field: 'name' }, { code: 'TYPE', field: 'visits' }, { code: 'TOO_LONG', field: 'name' },
      { code: 'READ_ONLY_FIELD', field: 'secret' }, { code: 'UNKNOWN_FIELD', field: 'ghost' }, { code: 'EMPTY' }] };
    expect(mapErrors(contact, createTabs, failure)).toEqual({
      form: ['Some values need to be corrected. See the marked fields.', 'EN secret: This field cannot be changed.', 'ghost: This field does not exist.', 'Nothing was changed.'],
      fields: { name: ['This field is required.', 'The value is too long.'], visits: ['The value has the wrong format.'] },
    });
    expect(mapErrors(contact, createTabs, { status: 403, code: 'ACCESS_DENIED', errors: [] })).toEqual({ form: ['You are not allowed to do this.'], fields: {} });
  });
});
