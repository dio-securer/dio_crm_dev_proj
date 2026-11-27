// bundleFromFiles: reads the metadata/ files (given as contents; no fs here) into one MetadataBundle.
import { z } from 'zod';
import { fitsLimits, byteCount, lineCount } from './canonical';
import { Issue, issue, sortIssues } from './issues';
import {
  CHUNK_PATTERN, GLOBAL_FILES, GLOBAL_FILE_SCHEMAS, IGNORED_NAMES, OBJECT_FILES, OBJECT_FILE_SCHEMAS, ROOT, codeGroupFileSchema,
  deprecationsFileSchema, dirToScopeKey, fieldsFileSchema, namespaceOf, objectFileSchema, overlayFileSchema, screenEntrySchema,
  semanticFileSchema, translationFileSchema,
} from './layout';
import { DETAILS } from './messages';
import { MetadataBundle, OVERLAY_DOMAINS, REQUIRED_LOCALES, SCOPES, metadataBundleSchema } from './schemas';

export interface MetadataFile { path: string; content: string }
export interface LoadResult { bundle?: MetadataBundle; issues: Issue[] }

interface ObjectParts { object?: any; fields?: any[]; chunks: Map<number, any[]>; screens: any[]; rest: Record<string, any> }

export function bundleFromFiles(files: MetadataFile[]): LoadResult {
  const issues: Issue[] = [];
  const objects = new Map<string, ObjectParts>();
  const raw: Record<string, any> = { schemaVersion: 1, objects: [], deprecations: [], overlays: [] };
  const codeGroups: any[] = [], translations: any[] = [];
  const misplaced = (path: string, detail: string) => issues.push(issue('F02_MISPLACED_FILE', path, { detail }));
  const parse = <T extends z.ZodTypeAny>(schema: T, value: unknown, path: string): z.infer<T> | undefined => {
    const r = schema.safeParse(value);
    if (r.success) return r.data;
    for (const e of r.error.issues) issues.push(issue('M01_SCHEMA_INVALID', `${path}#${e.path.join('/')}`, { detail: e.message }));
    return undefined;
  };
  const partsOf = (key: string) => { let p = objects.get(key); if (!p) { p = { chunks: new Map(), screens: [], rest: {} }; objects.set(key, p); } return p; };

  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    const path = file.path;
    if (!path.startsWith(ROOT)) { issues.push(issue('F01_UNKNOWN_FILE', path)); continue; }
    const parts = path.slice(ROOT.length).split('/'), name = parts[parts.length - 1], depth = parts.length;
    if (IGNORED_NAMES.includes(name)) continue;
    if (!name.endsWith('.json')) { issues.push(issue('F01_UNKNOWN_FILE', path)); continue; }
    if (!fitsLimits(file.content)) issues.push(issue('F04_TOO_LARGE', path, { lines: lineCount(file.content), bytes: byteCount(file.content) }));
    let value: unknown;
    try { value = JSON.parse(file.content); } catch { issues.push(issue('F03_INVALID_JSON', path)); continue; }
    const stem = name.slice(0, -'.json'.length);
    if (depth === 1 && name in GLOBAL_FILES) { const prop = GLOBAL_FILES[name as keyof typeof GLOBAL_FILES]; raw[prop] = parse(GLOBAL_FILE_SCHEMAS[prop], value, path); }
    else if (depth === 1 && name === 'deprecations.json') raw.deprecations = parse(deprecationsFileSchema, value, path)?.items ?? [];
    else if (depth === 2 && parts[0] === 'codes') {
      const group = parse(codeGroupFileSchema, value, path);
      if (group && group.key !== stem) misplaced(path, DETAILS.nameMismatch); else if (group) codeGroups.push(group);
    } else if (depth === 2 && parts[0] === 'terms' && name === 'semantic.json') raw.semanticTerms = parse(semanticFileSchema, value, path)?.terms;
    else if (depth === 3 && parts[0] === 'terms') {
      const map = parse(translationFileSchema, value, path);
      if (!REQUIRED_LOCALES.includes(parts[1])) misplaced(path, DETAILS.unknownLocale);
      else if (map) for (const termKey of Object.keys(map).sort()) {
        if (namespaceOf(termKey) !== stem) misplaced(`${path}#${termKey}`, DETAILS.namespaceMismatch);
        else translations.push({ termKey, locale: parts[1], text: map[termKey] });
      }
    } else if (parts[0] === 'objects' && depth >= 3) readObjectFile(partsOf(parts[1]), parts, stem, value, path);
    else if (parts[0] === 'overlays' && depth === 4) {
      const scope = parts[1], [domain, entity, ...rest] = stem.split('.');
      if (!(SCOPES as readonly string[]).includes(scope)) { misplaced(path, DETAILS.unknownScope); continue; }
      if (!(OVERLAY_DOMAINS as readonly string[]).includes(domain)) { misplaced(path, DETAILS.overlayName); continue; }
      const body = parse(overlayFileSchema, value, path);
      if (body) raw.overlays.push({ scope, scopeKey: dirToScopeKey(parts[2]), domain, ...(entity ? { entity } : {}), ...(rest.length ? { screenKey: rest.join('.') } : {}), overrides: body.overrides });
    } else issues.push(issue('F01_UNKNOWN_FILE', path));
  }

  function readObjectFile(p: ObjectParts, parts: string[], stem: string, value: unknown, path: string) {
    const name = parts[parts.length - 1];
    if (parts.length === 3 && name === 'object.json') { p.object = parse(objectFileSchema, value, path); if (p.object && p.object.key !== parts[1]) misplaced(path, DETAILS.nameMismatch); }
    else if (parts.length === 3 && name === 'fields.json') p.fields = parse(fieldsFileSchema, value, path)?.fields ?? [];
    else if (parts.length === 3 && name in OBJECT_FILES) { const prop = OBJECT_FILES[name as keyof typeof OBJECT_FILES]; p.rest[prop] = parse(OBJECT_FILE_SCHEMAS[prop], value, path); }
    else if (parts.length === 4 && parts[2] === 'fields' && CHUNK_PATTERN.test(name)) p.chunks.set(Number(stem), parse(fieldsFileSchema, value, path)?.fields ?? []);
    else if (parts.length === 4 && parts[2] === 'screens') {
      const entry = parse(screenEntrySchema, value, path);
      if (entry && entry.screen.screenKey !== stem) misplaced(path, DETAILS.nameMismatch); else if (entry) p.screens.push(entry);
    } else issues.push(issue('F01_UNKNOWN_FILE', path));
  }

  for (const key of [...objects.keys()].sort()) {
    const p = objects.get(key)!, dir = `${ROOT}objects/${key}`;
    if (!p.object) { misplaced(`${dir}/object.json`, DETAILS.objectFileMissing); continue; }
    if (p.fields && p.chunks.size) misplaced(`${dir}/fields.json`, DETAILS.fieldsTwice);
    const numbers = [...p.chunks.keys()].sort((a, b) => a - b);
    if (numbers.some((n, i) => n !== i + 1)) misplaced(`${dir}/fields`, DETAILS.chunkGap);
    const fields = p.fields ?? numbers.flatMap(n => p.chunks.get(n)!);
    raw.objects.push({ object: { ...p.object, fields }, screens: p.screens, ...p.rest });
  }
  if (codeGroups.length) raw.codes = { groups: codeGroups };
  if (translations.length || raw.semanticTerms) raw.terms = { terms: raw.semanticTerms ?? [], translations };
  delete raw.semanticTerms;
  if (issues.length) return { issues: sortIssues(issues) };
  const bundle = metadataBundleSchema.safeParse(raw);
  if (!bundle.success) return { issues: sortIssues(bundle.error.issues.map(e => issue('M01_SCHEMA_INVALID', e.path.join('/') || DETAILS.whole, { detail: e.message }))) };
  return { bundle: bundle.data, issues: [] };
}

