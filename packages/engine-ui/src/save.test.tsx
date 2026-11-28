import { describe, expect, it } from 'vitest';
import { EngineObjectPage } from './EngineObjectPage';
import { saveRecord } from './save';
import type { EngineClient } from './types';
import { CONTACT, uiModel } from './testing/fixtures';
import { html } from './testing/render';

const contact = uiModel('contact');
function client(answer: () => Promise<unknown>) {
  const calls: unknown[][] = [];
  const record = (name: string) => (...args: unknown[]) => { calls.push([name, ...args]); return answer() as Promise<never>; };
  const c: EngineClient = { model: record('model'), list: record('list'), get: record('get'), create: record('create'), update: record('update') };
  return { c, calls };
}

describe('saving through the client', () => {
  it('creates and updates on the object of the model and returns the saved record', async () => {
    const { c, calls } = client(async () => CONTACT);
    expect(await saveRecord(c, contact, 'create', { name: 'Kim' })).toEqual({ ok: true, record: CONTACT });
    expect(await saveRecord(c, contact, 'edit', { name: 'Lee' }, '7')).toEqual({ ok: true, record: CONTACT });
    expect(calls).toEqual([['create', 'contact', { name: 'Kim' }], ['update', 'contact', '7', { name: 'Lee' }]]);
  });

  it('turns a refusal into form errors mapped onto the fields of the screen that was used', async () => {
    const refused = Object.assign(new Error('INVALID_RECORD'), { statusCode: 400, errorCode: 'INVALID_RECORD', details: [{ code: 'REQUIRED', field: 'name' }, { code: 'SYSTEM_FIELD', field: 'updated_at' }] });
    const { c } = client(async () => { throw refused; });
    expect(await saveRecord(c, contact, 'create', {})).toEqual({ ok: false, errors: { form: ['Some values need to be corrected. See the marked fields.', 'EN updated_at: This field is filled in by the system.'], fields: { name: ['This field is required.'] } } });
    // updated_at is on the detail (edit) screen, so there the same error belongs to the field.
    expect(await saveRecord(c, contact, 'edit', {}, '7')).toMatchObject({ ok: false, errors: { fields: { name: ['This field is required.'], updated_at: ['This field is filled in by the system.'] } } });
    const down = client(async () => { throw new TypeError('network'); });
    expect(await saveRecord(down.c, contact, 'create', {})).toEqual({ ok: false, errors: { form: ['Something went wrong. Try again.'], fields: {} } });
  });
});

describe('the object page before anything has loaded', () => {
  it('shows a busy status in the model\'s language container and no text of its own', () => {
    const { c } = client(() => new Promise(() => undefined));
    const markup = html(<EngineObjectPage client={c} objectKey="contact" locale="en-US" route={{ mode: 'list' }} navigate={() => undefined} />);
    expect(markup).toBe('<div class="engine-ui" lang="en-US"><p class="engine-status" role="status" aria-busy="true"></p></div>');
  });
});
