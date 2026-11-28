// The one rule for "which stored thing does this field mean" (ADR 0004). A field is known by its key and then by its
// aliases, in that order. The compatibility diff (which base field does a head field continue) and the storage
// (which recorded column does a field use) both resolve through resolveByNames, so they cannot disagree.
export interface NamedField { key: string; aliases: readonly string[] }
export const fieldNames = (field: NamedField): string[] => [field.key, ...field.aliases];

export interface NameResolution<T> { value: T | undefined; ambiguous: boolean }
/**
 * What the field's names are already known as. `value` is what the first known name (key first, then aliases) means.
 * `ambiguous` says that the names mean more than one distinct thing: such a field would merge two stored columns,
 * so it continues neither - the callers refuse it.
 */
export function resolveByNames<T>(field: NamedField, known: (name: string) => T | undefined): NameResolution<T> {
  const found: T[] = [];
  for (const name of fieldNames(field)) {
    const hit = known(name);
    if (hit !== undefined && !found.includes(hit)) found.push(hit);
  }
  return { value: found[0], ambiguous: found.length > 1 };
}
