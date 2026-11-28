import { describe, expect, it } from 'vitest';
import { displayValue, errorText, failureOf, fieldOf, textOf } from './text';
import { termOf, uiModel } from './testing/fixtures';

const contact = uiModel('contact'), f = (key: string) => fieldOf(contact, key);

describe('texts', () => {
  it('come from the model in its language; a key without a translation is shown as the key', () => {
    const en = uiModel('lead', 'en-US'), ko = uiModel('lead', 'ko-KR');
    expect(textOf(en, 'engine.action.save')).toBe('Save');
    expect(textOf(ko, 'engine.action.save')).toBe(termOf('ko-KR', 'engine', 'engine.action.save'));
    expect(textOf(en, 'engine.nope')).toBe('engine.nope');
    expect(errorText(en, 'REQUIRED')).toBe('This field is required.');
    expect(errorText(ko, 'REQUIRED')).toBe(termOf('ko-KR', 'engine', 'engine.error.REQUIRED'));
    expect(errorText(en, 'SOMETHING_NEW')).toBe('Something went wrong. Try again. (SOMETHING_NEW)');
  });
});

describe('value display', () => {
  it('shows code labels, yes / no, numbers and date-times in the model language, and nothing for empty values', () => {
    expect(displayValue(contact, f('grade'), 'B')).toBe('EN grade.B');
    expect(displayValue(contact, f('grade'), 'OLD')).toBe('OLD');
    expect([displayValue(contact, f('vip'), true), displayValue(contact, f('vip'), false)]).toEqual(['Yes', 'No']);
    expect(displayValue(contact, f('visits'), 1200)).toBe('1,200');
    expect(displayValue(contact, f('amount'), 1234.5)).toBe('1,234.5');
    expect(displayValue(contact, f('born_on'), '1990-02-03')).toBe('1990-02-03');
    expect(displayValue(contact, f('met_at'), '2026-11-28T01:02:00.000Z', { timeZone: 'UTC' })).toMatch(/^Nov 28, 2026, 1:02\sAM$/);
    expect(displayValue(contact, f('met_at'), '2026-11-28T01:02:00.000Z', { timeZone: 'Asia/Seoul' })).toMatch(/10:02\sAM$/);
    expect(displayValue(contact, f('met_at'), 'not a date')).toBe('not a date');
    for (const empty of [null, undefined, '']) expect(displayValue(contact, f('name'), empty)).toBe('');
    expect(displayValue(contact, undefined, 5)).toBe('5');
    expect(displayValue(uiModel('contact', 'ko-KR'), f('vip'), true)).toBe(termOf('ko-KR', 'engine', 'engine.yes'));
  });
});

describe('failures', () => {
  it('reads the status, code and field errors from the usual spellings', () => {
    expect(failureOf({ status: 400, code: 'INVALID_RECORD', errors: [{ code: 'REQUIRED', field: 'name' }, { code: 'EMPTY' }] }))
      .toEqual({ status: 400, code: 'INVALID_RECORD', errors: [{ code: 'REQUIRED', field: 'name' }, { code: 'EMPTY' }] });
    expect(failureOf({ statusCode: 403, errorCode: 'ACCESS_DENIED', details: undefined })).toEqual({ status: 403, code: 'ACCESS_DENIED', errors: [] });
    expect(failureOf({ statusCode: 400, errorCode: 'INVALID_RECORD', details: [{ code: 'TYPE', field: 'visits' }, 'junk', { field: 'x' }, null] }).errors).toEqual([{ code: 'TYPE', field: 'visits' }]);
    for (const odd of [undefined, null, 'boom', new Error('x'), 5]) expect(failureOf(odd)).toEqual({ status: 0, code: 'UNKNOWN', errors: [] });
  });
});
