/** Run the real TypeScript sources on Node >=22.15 without a second mock implementation. */
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@dio-crm/contracts' || specifier.startsWith('@dio-crm/contracts/')) {
      const file = specifier === '@dio-crm/contracts' ? 'index' : specifier.slice('@dio-crm/contracts/'.length);
      return nextResolve(pathToFileURL(path.join(root, 'packages/contracts/src', `${file}.ts`)).href, context);
    }
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.') || !context.parentURL?.startsWith('file:')) throw error;
      const requested = fileURLToPath(new URL(specifier, context.parentURL));
      const candidates = requested.endsWith('.js') ? [requested.slice(0, -3) + '.ts'] : [requested + '.ts', path.join(requested, 'index.ts')];
      const file = candidates.find(existsSync);
      if (!file) throw error;
      return nextResolve(pathToFileURL(file).href, context);
    }
  }
});
