// A mock of the engine API for the browser check (F2-5). It is not the backend: it keeps rows in memory and has no
// row access and no SQL. What it shares with the real API is the engine itself: the screen model is built by
// buildUiModel from metadata files, and writes are checked by validateWrite, so the screens see real models and real
// error codes. The list filter of a view is evaluated by a small JavaScript reading of the same condition language.
const empty = v => v === null || v === undefined || v === '';
function matches(c, row) {
  if (c.op === 'all') return c.args.every(a => matches(a, row));
  if (c.op === 'any') return c.args.some(a => matches(a, row));
  if (c.op === 'not') return !matches(c.arg, row);
  const v = row[c.field];
  switch (c.op) {
    case 'isEmpty': return empty(v);
    case 'eq': return empty(c.value) ? empty(v) : v === c.value;
    case 'ne': return empty(c.value) ? !empty(v) : v !== c.value;
    case 'in': return c.value.includes(v);
    case 'gt': return !empty(v) && v > c.value;
    case 'gte': return !empty(v) && v >= c.value;
    case 'lt': return !empty(v) && v < c.value;
    case 'lte': return !empty(v) && v <= c.value;
    default: return false;
  }
}

export function mockEngineApi(engine, files, { userId = 'mock-user', now = () => new Date().toISOString() } = {}) {
  const loaded = engine.loadRuntimeModel(files);
  if (!loaded.model) throw new Error(`mock metadata does not load: ${loaded.issues.map(i => `${i.code} ${i.path}`).join('; ')}`);
  const model = loaded.model, rows = new Map(), log = [];
  const tableOf = object => { if (!rows.has(object)) rows.set(object, []); return rows.get(object); };
  const answer = (status, body) => ({ status, body });
  const refuse = (status, code, errors = []) => answer(status, { statusCode: status, error: code, errors });
  const stored = (object, values) => {
    const full = {};
    for (const f of model.object(object).object.fields) full[f.key] = values[f.key] ?? null;
    return full;
  };
  function write(object, id, body, mode) {
    const checked = engine.validateWrite(model, object, body, mode);
    if (!checked.ok) return refuse(400, 'INVALID_RECORD', checked.errors);
    const table = tableOf(object);
    if (mode === 'create') {
      const values = engine.withOwnerDefault(model.rowAccess(object), { userId, permissions: [] }, checked.values);
      const record = { id: String(table.length + 1), values: stored(object, { ...values, updated_at: now() }) };
      table.push(record);
      return answer(201, record);
    }
    const record = table.find(r => r.id === id);
    if (!record) return refuse(404, 'RECORD_NOT_FOUND');
    record.values = stored(object, { ...record.values, ...checked.values, updated_at: now() });
    return answer(200, record);
  }
  function list(object, query) {
    let items = [...tableOf(object)];
    let limit = 50;
    const viewKey = query.get('view');
    if (viewKey !== null) {
      const view = model.object(object).listViews?.views.find(v => v.key === viewKey);
      if (!view) return refuse(400, 'BAD_VIEW');
      items = items.filter(r => matches(view.filter, r.values));
      for (const s of [...view.sort].reverse()) items.sort((a, b) => (a.values[s.field] < b.values[s.field] ? -1 : a.values[s.field] > b.values[s.field] ? 1 : 0) * (s.direction === 'DESC' ? -1 : 1));
      limit = view.pageSize;
    }
    for (const [name, value] of query) {
      if (!name.startsWith('ref.')) continue;
      const field = model.field(object, name.slice(4));
      if (!field || field.type !== 'reference') return refuse(400, 'BAD_FILTER');
      items = items.filter(r => r.values[field.key] === value);
    }
    if (query.get('limit') !== null) limit = Number(query.get('limit'));
    const offset = Number(query.get('offset') ?? 0);
    return answer(200, { object, versionId: 1, items: items.slice(offset, offset + limit), limit, offset });
  }
  /** One request. Returns { status, body }, or undefined for a path that is not the engine API. */
  function handle(method, url, body) {
    const { pathname, searchParams } = new URL(url, 'http://mock');
    const m = /^\/api\/engine\/objects\/([^/]+)\/(ui|records)(?:\/([^/]+))?$/.exec(pathname);
    if (!m) return undefined;
    const object = decodeURIComponent(m[1]), id = m[3] === undefined ? undefined : decodeURIComponent(m[3]);
    log.push({ method, path: pathname, query: searchParams.toString(), body });
    if (!model.object(object)) return refuse(404, 'OBJECT_NOT_FOUND');
    if (m[2] === 'ui') {
      const ui = engine.buildUiModel(model, object, searchParams.get('locale') ?? '');
      return ui ? answer(200, { ...ui, versionId: 1, access: { read: true, create: true } }) : refuse(400, 'BAD_LOCALE');
    }
    if (method === 'GET' && id === undefined) return list(object, searchParams);
    if (method === 'GET') { const record = tableOf(object).find(r => r.id === id); return record ? answer(200, record) : refuse(404, 'RECORD_NOT_FOUND'); }
    if (method === 'POST' && id === undefined) return write(object, undefined, body, 'create');
    if (method === 'PATCH' && id !== undefined) return write(object, id, body, 'update');
    return refuse(404, 'NOT_FOUND');
  }
  return { handle, log, model, seed: (object, values) => { const t = tableOf(object); const r = { id: String(t.length + 1), values: stored(object, values) }; t.push(r); return r; } };
}
