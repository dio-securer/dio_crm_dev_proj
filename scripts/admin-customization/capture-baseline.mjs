// Stage 1: read-only application inspection. Writes evidence only under docs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHqApplication } from '../hq-standard/runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'docs/admin-platform/customization/evidence');
fs.mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
const ts = require(path.join(root, 'frontend/node_modules/typescript/lib/typescript.js'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 }).trim();
const hash = content => crypto.createHash('sha256').update(content).digest('hex');
function files(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
}
const sourceFiles = ['frontend/src', 'backend/src', 'packages/contracts/src', 'scripts/hq-standard'].flatMap(files).filter(f => /\.(tsx?|mjs)$/.test(f)).sort();
const sourceHashes = [...sourceFiles, 'frontend/src/i18n/locales/ko-KR/common.json', 'frontend/src/i18n/locales/en-US/common.json'].map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) }));
const app = createHqApplication({ storageLifetime: 'PROCESS' });
const standard = app.standard;
const locales = Object.fromEntries(['ko-KR', 'en-US'].map(locale => [locale, JSON.parse(read(`frontend/src/i18n/locales/${locale}/common.json`))]));
const lookup = (obj, key) => key.split('.').reduce((o, k) => o?.[k], obj);
const idKeys = { processes:'processKey', screens:'screenKey', menus:'menuKey', tabs:'tabKey', sections:'sectionKey', fields:'fieldKey', actions:'actionKey', coverage:'catalogId' };
const registryTranslations = Object.keys(idKeys).flatMap(kind => standard[kind].map(item => ({
  kind, id: item[idKeys[kind]],
  label: item.label, labelKey: item.labelKey,
  missingIn: Object.entries(locales).filter(([, value]) => typeof lookup(value, item.labelKey) !== 'string').map(([locale]) => locale)
})));
// Source occurrences are NOT semantic functions or proof of effective-config support.
// Dynamic map-generated controls are represented by their source occurrence.
const controls = [], calls = [], translations = [], dynamicDefinitions = [], functions = [], parseErrors = [];
const controlTags = new Set(['button', 'input', 'select', 'textarea', 'form', 'dialog', 'details', 'HqModal', 'HqTabs', 'HqFields']);
const runtimeGroup = file => file.includes('/hq-mock/') ? 'HQ_MOCK' : file.includes('/demo/') ? 'GLOBAL_DEMO'
  : file.includes('/templates/global/') ? 'GLOBAL' : /^frontend\/src\/[^/]+Page\.tsx$/.test(file) ? 'HQ_LEGACY_OR_WRAPPER' : 'SHARED';
for (const file of sourceFiles.filter(f => f.startsWith('frontend/src/') && /\.tsx?$/.test(f))) {
  const source = read(file), sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  for (const d of sf.parseDiagnostics) parseErrors.push({ file, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') });
  const loc = node => ({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
  function visit(node, owner = '(module)') {
    if (ts.isFunctionDeclaration(node) && node.name) {
      owner = node.name.text;
      functions.push({ ...loc(node), owner, runtimeGroup: runtimeGroup(file) });
    }
    if (ts.isVariableDeclaration(node) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) owner = node.name.getText(sf);
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf);
      const attributes = Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(a => [a.name.getText(sf), a.initializer?.getText(sf) ?? 'true']));
      if (controlTags.has(tag) || /dialog|tab/.test(attributes.role ?? '')) {
        const parent = ts.isJsxElement(node.parent) ? node.parent : node;
        const children = ts.isJsxElement(parent) ? parent.children.filter(c => ts.isJsxText(c) || ts.isJsxExpression(c)).map(c => c.getText(sf).trim()).filter(Boolean).join(' ').slice(0, 400) : '';
        controls.push({ id: `SRC:${file}:${node.getStart(sf)}`, ...loc(node), owner, runtimeGroup: runtimeGroup(file), tag, attributes, labelExpression: children,
          assessment: 'SOURCE_PRESENT_RUNTIME_NOT_VERIFIED', semanticMapping: 'PENDING_MANUAL_MAPPING' });
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sf);
      if (/^(apiGet|apiPost|apiPatch|apiDelete|apiDownload|apiPostDownload)$/.test(callee) || /^(window\.)?(confirm|prompt|alert)$/.test(callee) || ['command.run','hqCommand.run'].includes(callee)) {
        calls.push({ ...loc(node), owner, runtimeGroup: runtimeGroup(file), callee, arguments: node.arguments.map(a => a.getText(sf).slice(0, 700)) });
      }
      if (callee === 't' || callee.endsWith('.t')) translations.push({ ...loc(node), owner, keyExpression: node.arguments[0]?.getText(sf) });
    }
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isArrayLiteralExpression(node.initializer) && /FIELD|TAB|COLUMN|SECTION/i.test(node.name.getText(sf))) {
      dynamicDefinitions.push({ ...loc(node), name: node.name.getText(sf), source: node.initializer.getText(sf) });
    }
    ts.forEachChild(node, child => visit(child, owner));
  }
  visit(sf);
}
const hardcodedKorean = sourceFiles.filter(f => f.endsWith('.tsx')).flatMap(file => read(file).split(/\r?\n/).flatMap((line, i) => /[가-힣]/.test(line) ? [{ file, line: i + 1, excerpt: line.trim().slice(0, 240) }] : []));
const branches = ['origin/feat/admin-platform-a00-a11', 'origin/feat/admin-designer-u01-u07'].map(ref => {
  const sha = git('rev-parse', ref);
  const branchFiles = git('ls-tree', '-r', '--name-only', ref, 'frontend/src/admin', 'packages/contracts/src/admin', 'backend/src/modules/admin', 'tests/admin').split('\n');
  const inspected = ['frontend/src/admin/ConfigurationPages.tsx', 'frontend/src/admin/AccountDesigner.tsx', 'frontend/src/admin/admin-text.ts', 'packages/contracts/src/admin/configuration.ts', 'backend/src/modules/admin/mock.module.ts'];
  if (ref.includes('designer')) inspected.push('frontend/src/admin/AdvancedDesigner.tsx');
  const samples = inspected.map(file => {
    const source = git('show', `${ref}:${file}`);
    const evidenceFile = `${ref.includes('designer') ? 'designer' : 'platform'}--${file.replaceAll('/', '__')}.txt`;
    fs.writeFileSync(path.join(out, evidenceFile), source + '\n');
    return { file, sha256: hash(source), evidenceFile };
  });
  return { ref, sha, remoteRefFreshness: 'LOCAL_CACHED_REF_NO_FETCH', branchFiles, inspected: samples, executionStatus: 'NOT_RUN' };
});
const historicalReports = files('docs/hq-standard/implementation/evidence').filter(f => /h0[2-7]-browser-(report|results)\.json$/.test(f)).map(file => {
  const body = JSON.parse(read(file));
  return { file, sha256: hash(read(file)), classification: 'HISTORICAL_NOT_REEXECUTED', report: body };
});
const counts = Object.fromEntries(['processes', 'screens', 'menus', 'tabs', 'sections', 'fields', 'actions', 'transitions', 'coverage'].map(k => [k, standard[k].length]));
const payload = {
  schemaVersion: 1, stage: 'C00_CURRENT_COMPARISON', capturedAtUtc: new Date().toISOString(), reportDateKst: '2026-10-24',
  baseline: { head: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'), dirty: Boolean(git('status', '--porcelain')), node: process.version, sourceHashes },
  methodology: { inventory: 'Runtime registry + TypeScript AST occurrences + cached remote branch source comparison',
    limitation: 'AST occurrence is not an exhaustive semantic UI function inventory. Repeated/generated controls, field-to-control mappings, exact API/permission/translation join, effective configuration behavior and runtime popup branches remain explicit follow-up work. No business data or external services are accessed.' },
  counts: { ...counts, apiRoutes: app.routes.length, sourceFiles: sourceHashes.length, controlOccurrences: controls.length, callOccurrences: calls.length,
    hardcodedKoreanLines: hardcodedKorean.length, missingRegistryLabelOccurrences: registryTranslations.filter(x => x.missingIn.length).length },
  standard, apiRoutes: app.routes.map(({ method, pattern }) => ({ method, pattern })), registryTranslations,
  controls, calls, translations, dynamicDefinitions, functions, parseErrors, hardcodedKorean, branches, historicalReports
};
fs.writeFileSync(path.join(out, 'baseline.json'), JSON.stringify(payload, null, 2) + '\n');
if (parseErrors.length) throw new Error(`TypeScript parse errors: ${parseErrors.length}`);
console.log(JSON.stringify({ output: 'docs/admin-platform/customization/evidence/baseline.json', counts: payload.counts, parseErrors: parseErrors.length }, null, 2));
