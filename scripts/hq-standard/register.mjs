/** Run the real TypeScript sources on Node >=22.15 without a second mock implementation. */
import { createRequire, registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const adminContracts = pathToFileURL(path.join(root, 'packages/contracts/src/admin') + path.sep).href;
let typescript;
registerHooks({
  load(url, context, nextLoad) {
    // The admin contracts rely on compiler-only syntax (parameter properties, elided type imports) that type stripping cannot run.
    if (!url.startsWith(adminContracts) || !url.endsWith('.ts')) return nextLoad(url, context);
    typescript ??= createRequire(path.join(root, 'packages/contracts/package.json'))('typescript');
    const { outputText } = typescript.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { fileName: fileURLToPath(url), compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 } });
    return { format: 'module', shortCircuit: true, source: outputText };
  },
  resolve(specifier, context, nextResolve) {
    // Frontend JSON imports are accepted by Vite; Node's source test host needs an explicit attribute.
    if (specifier.endsWith('.json') && context.parentURL?.startsWith(pathToFileURL(path.join(root, 'frontend') + path.sep).href)) {
      return { ...nextResolve(specifier, context), importAttributes: { ...context.importAttributes, type: 'json' } };
    }
    if (specifier === '@dio-crm/contracts' || specifier.startsWith('@dio-crm/contracts/')) {
      const file = specifier === '@dio-crm/contracts' ? 'index' : specifier.slice('@dio-crm/contracts/'.length);
      const source = path.join(root, 'packages/contracts/src', `${file}.ts`);
      // Directory subpaths such as @dio-crm/contracts/admin export src/admin/index.ts.
      const indexSource = path.join(root, 'packages/contracts/src', file, 'index.ts');
      return nextResolve(pathToFileURL(!existsSync(source) && existsSync(indexSource) ? indexSource : source).href, context);
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
