export function opportunityRequestKeys(makeKey: () => string = () => crypto.randomUUID()) {
  const keys = new Map<string, string>();
  const signature = (method: string, path: string, body: unknown, version?: number) => JSON.stringify([method, path, body, version]);
  return {
    get(method: string, path: string, body: unknown, version?: number) {
      const id = signature(method, path, body, version); let key = keys.get(id);
      if (!key) { key = makeKey(); keys.set(id, key); }
      return key;
    },
    done(method: string, path: string, body: unknown, version?: number) { keys.delete(signature(method, path, body, version)); },
  };
}
