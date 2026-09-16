type JsonObject = Record<string, unknown>;

/** Shallow-safe deep merge for i18n resource objects (nested keys only). */
export function mergeTranslations(...parts: JsonObject[]): JsonObject {
  return parts.reduce<JsonObject>((acc, part) => deepMerge(acc, part), {});
}

function deepMerge(target: JsonObject, source: JsonObject): JsonObject {
  const out: JsonObject = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key] as JsonObject, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
