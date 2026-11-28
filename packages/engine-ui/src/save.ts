// Saving a form through the client: the saved record, or the refusal as form errors. No React here, so it is tested directly.
import type { EngineClient, EngineUiModel, FieldValue, RecordData } from './types';
import { FormMode, formScreen, placeScreen } from './layout';
import { FormErrors, mapErrors } from './form-values';
import { failureOf } from './text';

export type SaveResult = { ok: true; record: RecordData } | { ok: false; errors: FormErrors };

export async function saveRecord(client: EngineClient, model: EngineUiModel, mode: FormMode, values: Record<string, FieldValue>, id?: string): Promise<SaveResult> {
  try {
    const record = mode === 'create' ? await client.create(model.object.key, values) : await client.update(model.object.key, String(id), values);
    return { ok: true, record };
  } catch (error) {
    const screen = formScreen(model, mode);
    return { ok: false, errors: mapErrors(model, screen ? placeScreen(model, screen) : [], failureOf(error)) };
  }
}
