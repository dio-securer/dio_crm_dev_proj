// The pinned snapshot of everything that decides what the guard covers and what it lets through: every exported list,
// number and pattern of scripts/guard (and of the crm verify steps), every regular expression and every number written
// in their source, the protected paths and the change-id start point. pins.test.mjs compares this with pins.json.
// A change to any of them therefore needs a matching change of pins.json, which sits in a protected folder: the
// approver sees "the coverage of a rule changed" as its own line in the diff.
//   node tests/guard/pins.mjs --write     rewrite pins.json from the code (only after a person approved the change)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { K, parse, unwrap, walk } from '../../scripts/guard/lib/ts.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PINS_FILE = 'tests/guard/pins.json';
// Folders whose modules are loaded and whose exported values are pinned. A new file in them is pinned automatically.
const MODULE_DIRS = ['scripts/guard/lib', 'scripts/guard/rules'];
const MODULES = ['scripts/crm/lib/run.mjs', 'scripts/crm/lib/steps.mjs', 'scripts/crm/lib/verify.mjs'];
// Programs that run when they are loaded: only their source is read (top-level names, patterns, numbers).
const PROGRAMS = ['scripts/guard/run.mjs', 'scripts/guard/legacy-scan.mjs', 'scripts/crm/cli.mjs'];
// Exported values that are not this repository's own data (the TypeScript API itself).
const FOREIGN = { 'scripts/guard/lib/ts.mjs': ['K', 'ts'] };
const RULE_KEYS = ['id', 'name', 'baseline', 'defaultRun'];
const LONG = 90;
const PIECE = 50;

/** A value as plain JSON data. Order is kept: a reordered list is a change too. */
function plain(value) {
  if (value instanceof RegExp) return { $regex: text(value.source), flags: value.flags };
  if (value instanceof Set) return { $set: [...value].map(plain) };
  if (value instanceof Map) return { $map: [...value].map(plain) };
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'function') return '(function)';
  if (typeof value === 'string') return text(value);
  if (value === null || typeof value !== 'object') return value ?? null;
  // A rule object: its long descriptions are pinned by docs/framework/guard-rules.md, its kind and name here.
  const keys = typeof value.forbids === 'string' ? RULE_KEYS.filter(key => key in value) : Object.keys(value);
  return Object.fromEntries(keys.map(key => [key, plain(value[key])]));
}

/** A long text is cut into pieces so that no line of pins.json is too long for the guard's own line check. */
const text = value => (JSON.stringify(value).length <= LONG ? value : { $text: value.match(new RegExp(`[^]{1,${PIECE}}`, 'g')) });

const isFunction = node => { const n = unwrap(node); return n.kind === K.ArrowFunction || n.kind === K.FunctionExpression; };

/** What the source of one file holds: top-level values by name, every regular expression, every number except 0 and 1. */
function sourceOf(file) {
  const sf = parse(file, fs.readFileSync(path.join(root, file), 'utf8'));
  const names = { exported: [], local: [] };
  for (const statement of sf.statements) {
    if (statement.kind !== K.VariableStatement) continue;
    const exported = (statement.modifiers ?? []).some(item => item.kind === K.ExportKeyword);
    for (const item of statement.declarationList.declarations) {
      if (item.initializer && isFunction(item.initializer)) continue;
      const name = item.name.kind === K.Identifier ? item.name.text : sf.text.slice(item.name.pos, item.name.end).trim();
      names[exported ? 'exported' : 'local'].push(name);
    }
  }
  const patterns = [];
  const numbers = {};
  walk(sf, node => {
    if (node.kind === K.RegularExpressionLiteral) patterns.push(text(node.text));
    if (node.kind === K.NumericLiteral && !['0', '1'].includes(node.text)) numbers[node.text] = (numbers[node.text] ?? 0) + 1;
  });
  return { names, patterns, numbers: Object.fromEntries(Object.keys(numbers).sort().map(key => [key, numbers[key]])) };
}

async function moduleOf(file) {
  const source = sourceOf(file);
  const loaded = await import(pathToFileURL(path.join(root, file)).href);
  const foreign = FOREIGN[file] ?? [];
  const values = {};
  for (const name of Object.keys(loaded).sort()) {
    if (typeof loaded[name] !== 'function' && !foreign.includes(name)) values[name] = plain(loaded[name]);
  }
  // Every top-level value of the file is either pinned by value above or named here, so a new list cannot appear unseen.
  const notPinned = [...source.names.local, ...source.names.exported.filter(name => !(name in values))].sort();
  return { values, notPinned, patterns: source.patterns, numbers: source.numbers };
}

const filesOf = dir => fs.readdirSync(path.join(root, dir)).filter(name => name.endsWith('.mjs')).sort().map(name => `${dir}/${name}`);
const json = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

/** Everything that is pinned, computed from the code as it is now. */
export async function collectPins() {
  const modules = {};
  for (const file of [...MODULE_DIRS.flatMap(filesOf), ...MODULES]) modules[file] = await moduleOf(file);
  const programs = {};
  for (const file of PROGRAMS) {
    const source = sourceOf(file);
    programs[file] = { notPinned: [...source.names.local, ...source.names.exported].sort(), patterns: source.patterns, numbers: source.numbers };
  }
  const list = json('scripts/guard/protected-paths.json');
  const start = json('scripts/guard/commit-id-start.json').lastExemptCommit;
  const data = { protectedOwner: list.owner, protectedPaths: list.paths.map(item => item.path), commitIdStart: start };
  return { note: 'Pinned coverage of the guard. Made by: node tests/guard/pins.mjs --write. See tests/guard/pins.mjs.', modules, programs, data };
}

export const readPins = () => json(PINS_FILE);

/** A pinned value back as a list, text or pattern: { $set } / { $map } / { $text } / { $regex } are unwrapped. */
export function unpin(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if ('$text' in value) return value.$text.join('');
    if ('$regex' in value) return new RegExp(unpin(value.$regex), value.flags);
    if ('$set' in value || '$map' in value) return (value.$set ?? value.$map).map(unpin);
  }
  return Array.isArray(value) ? value.map(unpin) : value;
}

/** The pinned value of one exported name, read from pins.json (never from the code under test). */
export function pinned(file, name) {
  const found = readPins().modules[file]?.values;
  if (!found || !(name in found)) throw new Error(`pins.json has no ${file} ${name}`);
  return unpin(found[name]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== '--write' || process.argv.length !== 3) {
    console.error('usage: node tests/guard/pins.mjs --write');
    process.exit(2);
  }
  fs.writeFileSync(path.join(root, PINS_FILE), `${JSON.stringify(await collectPins(), null, 1)}\n`);
  console.log(`wrote ${PINS_FILE}`);
}
