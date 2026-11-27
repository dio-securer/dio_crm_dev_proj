// filesFromBundle: writes a MetadataBundle as metadata/ files. Deterministic: same bundle, same bytes, sorted by path.
import { MAX_FILE_BYTES, MAX_FILE_LINES, byteCount, canonicalJson, lineCount } from './canonical';
import { MetadataFile } from './files';
import { OBJECT_FILES, ROOT, chunkName, namespaceOf, safeName, scopeKeyToDir } from './layout';
import { FieldDef, MetadataBundle, MetadataBundleInput, metadataBundleSchema } from './schemas';
import { overlayName } from './validate';

/** Budget for one fields chunk, below the G03 limits so a chunk never needs a baseline entry. */
const CHUNK_LINES = MAX_FILE_LINES - 20, CHUNK_BYTES = MAX_FILE_BYTES - 1000;

function name(value: string): string {
  if (!safeName(value)) throw new Error(`UNSAFE_FILE_NAME:${value}`);
  return value;
}

/** fields.json when it fits; otherwise fields/01.json, fields/02.json, ... each within the budget. */
function fieldFiles(dir: string, fields: FieldDef[]): MetadataFile[] {
  const whole = canonicalJson({ fields });
  if (lineCount(whole) <= CHUNK_LINES && byteCount(whole) <= CHUNK_BYTES) return [{ path: `${dir}/fields.json`, content: whole }];
  const out: MetadataFile[] = [];
  let current: FieldDef[] = [];
  const flush = () => { if (current.length) out.push({ path: `${dir}/fields/${chunkName(out.length + 1)}`, content: canonicalJson({ fields: current }) }); current = []; };
  for (const f of fields) {
    const next = canonicalJson({ fields: [...current, f] });
    if (current.length && (lineCount(next) > CHUNK_LINES || byteCount(next) > CHUNK_BYTES)) flush();
    current.push(f);
  }
  flush();
  return out;
}

export function filesFromBundle(input: MetadataBundle | MetadataBundleInput): MetadataFile[] {
  const bundle = metadataBundleSchema.parse(input);
  const files: MetadataFile[] = [];
  const put = (path: string, value: unknown) => files.push({ path: ROOT + path, content: canonicalJson(value) });
  if (bundle.menu) put('menu.json', bundle.menu);
  if (bundle.features) put('features.json', bundle.features);
  if (bundle.deprecations.length) put('deprecations.json', { items: bundle.deprecations });
  for (const g of bundle.codes?.groups ?? []) put(`codes/${name(g.key)}.json`, g);
  if (bundle.terms?.terms.length) put('terms/semantic.json', { terms: bundle.terms.terms });
  const byFile = new Map<string, Record<string, string>>();
  for (const t of bundle.terms?.translations ?? []) {
    const path = `terms/${t.locale}/${name(namespaceOf(t.termKey))}.json`;
    const map = byFile.get(path) ?? {};
    map[t.termKey] = t.text;
    byFile.set(path, map);
  }
  for (const [path, map] of byFile) put(path, map);
  for (const ob of bundle.objects) {
    const key = name(ob.object.key), dir = `objects/${key}`;
    const { fields, ...object } = ob.object;
    put(`${dir}/object.json`, object);
    for (const f of fieldFiles(ROOT + dir, fields)) files.push(f);
    for (const s of ob.screens) put(`${dir}/screens/${name(s.screen.screenKey)}.json`, s);
    for (const [file, prop] of Object.entries(OBJECT_FILES)) if (ob[prop]) put(`${dir}/${file}`, ob[prop]);
  }
  const overlays = new Map<string, unknown[]>();
  for (const o of bundle.overlays) {
    const path = `overlays/${o.scope}/${name(scopeKeyToDir(o.scopeKey))}/${name(overlayName(o))}.json`;
    overlays.set(path, [...(overlays.get(path) ?? []), ...o.overrides]);
  }
  for (const [path, overrides] of overlays) put(path, { overrides });
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
