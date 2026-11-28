// Shapes the generic screens work with (F2-5). The screens know nothing about the network or the router: the host
// application gives them an EngineClient (how to reach the engine API) and a navigate callback.
import type { UiField, UiModel } from '@dio-crm/engine';

export type FieldValue = string | number | boolean | null;
export interface RecordData { id: string; values: Record<string, FieldValue> }
/** The engine API's screen model: the object's settings in one language and what the signed-in user may do. */
export type EngineUiModel = UiModel & { access: { read: boolean; create: boolean } };
export type { UiField };

export interface ListQuery { view?: string; limit?: number; offset?: number; ref?: { field: string; value: string } }
export interface ListPage { items: RecordData[]; limit: number; offset: number }
export interface EngineClient {
  model(object: string, locale: string): Promise<EngineUiModel>;
  list(object: string, query: ListQuery): Promise<ListPage>;
  get(object: string, id: string): Promise<RecordData>;
  create(object: string, values: Record<string, FieldValue>): Promise<RecordData>;
  update(object: string, id: string, values: Record<string, FieldValue>): Promise<RecordData>;
}

export interface FieldError { code: string; field?: string }
/** A refused request: the HTTP status, the engine's code and, for INVALID_RECORD, one entry per wrong field. */
export interface Failure { status: number; code: string; errors: FieldError[] }

export type EngineRoute =
  | { mode: 'list'; view?: string; offset?: number }
  | { mode: 'detail'; id: string }
  | { mode: 'create' }
  | { mode: 'edit'; id: string };
/** Where to go: a route of this object, or of another object (a related record). */
export type Navigate = (route: EngineRoute, object?: string) => void;
