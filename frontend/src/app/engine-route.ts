// URLs of the generic engine screens (F2-5): /engine/<object>, /engine/<object>/new, /engine/<object>/<id>,
// /engine/<object>/<id>/edit. A list keeps its view and offset in the query string.
import type { EngineRoute } from '@dio-crm/engine-ui';

export const ENGINE_BASE = '/engine';
const ID = /^[1-9][0-9]{0,14}$/;
const VIEW = /^[\w.-]{1,100}$/;

/** The route named by the part of the path after the object, or undefined when it is not one of the four screens. */
export function parseEngineRoute(rest: string, search: URLSearchParams): EngineRoute | undefined {
  const parts = rest.split('/').filter(Boolean);
  if (parts.length === 0) {
    const view = search.get('view'), offset = Number(search.get('offset') ?? 0);
    return { mode: 'list', ...(view && VIEW.test(view) ? { view } : {}), ...(Number.isSafeInteger(offset) && offset > 0 ? { offset } : {}) };
  }
  if (parts.length === 1 && parts[0] === 'new') return { mode: 'create' };
  if (parts.length === 1 && ID.test(parts[0])) return { mode: 'detail', id: parts[0] };
  if (parts.length === 2 && ID.test(parts[0]) && parts[1] === 'edit') return { mode: 'edit', id: parts[0] };
  return undefined;
}

export function enginePath(object: string, route: EngineRoute): string {
  const base = `${ENGINE_BASE}/${encodeURIComponent(object)}`;
  if (route.mode === 'create') return `${base}/new`;
  if (route.mode === 'detail') return `${base}/${encodeURIComponent(route.id)}`;
  if (route.mode === 'edit') return `${base}/${encodeURIComponent(route.id)}/edit`;
  const query = new URLSearchParams();
  if (route.view) query.set('view', route.view);
  if (route.offset) query.set('offset', String(route.offset));
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}

/** The engine API paths the screens call. Values go through encodeURIComponent / URLSearchParams, never string joins. */
export const engineApi = {
  model: (object: string, locale: string) => `/api/engine/objects/${encodeURIComponent(object)}/ui?${new URLSearchParams({ locale })}`,
  record: (object: string, id: string) => `/api/engine/objects/${encodeURIComponent(object)}/records/${encodeURIComponent(id)}`,
  records(object: string, query: { view?: string; limit?: number; offset?: number; ref?: { field: string; value: string } } = {}) {
    const q = new URLSearchParams();
    if (query.view) q.set('view', query.view);
    if (query.limit !== undefined) q.set('limit', String(query.limit));
    if (query.offset) q.set('offset', String(query.offset));
    if (query.ref) q.set(`ref.${query.ref.field}`, query.ref.value);
    const text = q.toString();
    return `/api/engine/objects/${encodeURIComponent(object)}/records${text ? `?${text}` : ''}`;
  },
};
