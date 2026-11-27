// Loads the repository's own metamodel (packages/contracts/src/metadata) for G12 and P6, without a build:
// each TypeScript source is transpiled in memory with the typescript package the guard already uses (ts.mjs),
// and `zod` is taken from packages/contracts. Every failure throws: a validator that cannot load never passes.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { ts } from './ts.mjs';

export const METADATA_DIR = 'metadata/';
export const VALIDATOR_DIR = 'packages/contracts/src/metadata';
const HOST = 'packages/contracts/package.json';
// Files under metadata/ that are documentation, not configuration (bundleFromFiles ignores them as well).
const IGNORED = ['README.md', '.gitkeep'];

/** True when the path is a metadata file that the validator reads (anything but README.md and .gitkeep). */
export const isMetadataContent = file => file.startsWith(METADATA_DIR) && !IGNORED.includes(file.slice(file.lastIndexOf('/') + 1));

const loaded = new Map();

/** The exports of packages/contracts/src/metadata/index.ts of the repository at `root`. */
export function loadMetamodel(root) {
  if (loaded.has(root)) return loaded.get(root);
  if (!ts) throw new Error('typescript 패키지를 찾을 수 없어 메타데이터 검사기를 읽을 수 없습니다. pnpm install 을 먼저 실행하세요.');
  const entry = path.join(root, VALIDATOR_DIR, 'index.ts');
  if (!fs.existsSync(entry)) throw new Error(`메타데이터 검사기(${VALIDATOR_DIR}/index.ts)가 없습니다. metadata/ 의 설정을 검사할 수 없습니다.`);
  let external;
  try { external = createRequire(path.join(root, HOST)); } catch (error) { throw new Error(`${HOST} 를 읽을 수 없습니다: ${error.message}`); }
  const modules = new Map();
  const resolve = (from, spec) => {
    const base = path.resolve(path.dirname(from), spec);
    for (const file of [`${base}.ts`, path.join(base, 'index.ts'), base.replace(/\.js$/, '.ts')]) {
      if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
    }
    throw new Error(`메타데이터 검사기의 import "${spec}" 를 찾을 수 없습니다 (${path.relative(root, from)}).`);
  };
  const load = file => {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} };
    modules.set(file, module);
    const options = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true };
    const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: options, fileName: file, reportDiagnostics: true });
    if (out.diagnostics?.length) {
      const why = ts.flattenDiagnosticMessageText(out.diagnostics[0].messageText, ' ');
      throw new Error(`${path.relative(root, file)} 를 읽을 수 없습니다: ${why}`);
    }
    const run = vm.compileFunction(out.outputText, ['exports', 'require', 'module', '__filename', '__dirname'], { filename: file });
    const require = spec => (spec.startsWith('.') ? load(resolve(file, spec)) : external(spec));
    run(module.exports, require, module, file, path.dirname(file));
    return module.exports;
  };
  const api = load(entry);
  for (const name of ['bundleFromFiles', 'validateBundle', 'diffBundles']) {
    if (typeof api[name] !== 'function') throw new Error(`메타데이터 검사기에 ${name} 이 없습니다.`);
  }
  loaded.set(root, api);
  return api;
}

/** Issue -> one line a person can read: code, where, and the validator's own Korean message. */
export const issueText = item => `${item.code} ${item.path}: ${item.message}`;
