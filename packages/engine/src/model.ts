// loadRuntimeModel: metadata file contents -> a validated, read-only model. No IO: the caller passes the files (G07).
import { bundleFromFiles, validateBundle } from '@dio-crm/contracts/metadata';
import type { FieldDef, Issue, MetadataBundle, MetadataFile, ObjectBundle } from '@dio-crm/contracts/metadata';

export interface CodeValue { code: string; labelKey: string; active: boolean; order: number }

export interface RuntimeModel {
  readonly bundle: MetadataBundle;
  objectKeys(): string[];
  object(key: string): ObjectBundle | undefined;
  /** Finds a field by key or by one of its aliases. */
  field(objectKey: string, fieldKey: string): FieldDef | undefined;
  /** The translated text, or undefined when the key has no text in that locale. */
  term(termKey: string, locale: string): string | undefined;
  codeValues(group: string): CodeValue[];
}

export interface RuntimeLoad { model?: RuntimeModel; issues: Issue[] }

export function loadRuntimeModel(files: MetadataFile[]): RuntimeLoad {
  const loaded = bundleFromFiles(files);
  const issues = [...loaded.issues];
  if (loaded.bundle) issues.push(...validateBundle(loaded.bundle));
  if (!loaded.bundle || issues.some(i => i.severity === 'error')) return { issues };
  return { model: buildModel(loaded.bundle), issues };
}

function buildModel(bundle: MetadataBundle): RuntimeModel {
  const objects = new Map(bundle.objects.map(o => [o.object.key, o] as const));
  const fields = new Map<string, Map<string, FieldDef>>();
  for (const o of bundle.objects) {
    const byKey = new Map<string, FieldDef>();
    for (const f of o.object.fields) for (const name of [f.key, ...f.aliases]) if (!byKey.has(name)) byKey.set(name, f);
    fields.set(o.object.key, byKey);
  }
  const texts = new Map<string, string>();
  for (const t of bundle.terms?.translations ?? []) texts.set(`${t.locale}\u0000${t.termKey}`, t.text);
  const groups = new Map((bundle.codes?.groups ?? []).map(g => [g.key, g.values] as const));
  return {
    bundle,
    objectKeys: () => [...objects.keys()].sort(),
    object: key => objects.get(key),
    field: (objectKey, fieldKey) => fields.get(objectKey)?.get(fieldKey),
    term: (termKey, locale) => texts.get(`${locale}\u0000${termKey}`),
    codeValues: group => [...(groups.get(group) ?? [])].sort((a, b) => a.order - b.order),
  };
}
