// Shared file helpers for the guard. Zero dependencies: node built-ins + git only.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from './ts.mjs';

export const CODE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];
export const STYLE_EXT = ['.css', '.scss'];

/** Plain code-unit ordering: identical on every machine and locale. */
export const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function git(root, args) {
  return execFileSync('git', args, { cwd: root, maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
}

/** Extension of the basename, lower-cased ('' when none, '.gitkeep' style names return ''). */
export function extOf(file) {
  const base = file.slice(file.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot).toLowerCase();
}

export const hasExt = (file, list) => list.includes(extOf(file));

/**
 * The test roots that exist in the repo today. This list EXEMPTS code from G06/G07, so it is explicit:
 * a folder merely named test/ tests/ __tests__/ e2e/ somewhere else is NOT a test root.
 */
export const TEST_ROOTS = ['backend/test/', 'tests/'];
const TEST_NAME = /\.(spec|test)\.[cm]?[jt]sx?$/i;
const TESTISH_DIR = /(^|\/)(__tests__|tests?|e2e|specs?|__mocks__)\//i;

/** Test file by its name alone (`*.spec.*` / `*.test.*`). */
export const isTestName = file => TEST_NAME.test(file);

/** Test file for EXEMPTION purposes: by name suffix, or inside one of the explicit TEST_ROOTS. */
export const isTestFile = file => isTestName(file) || TEST_ROOTS.some(root => file.startsWith(root));

/** Wider net for rules that CHECK tests (G08): also any folder that merely looks like a test folder. */
export const looksLikeTest = file => isTestFile(file) || TESTISH_DIR.test(file);

/** Glob -> RegExp. Supports **, *, ?, {a,b}. Paths always use '/'. */
export function globToRegExp(glob, flags = '') {
  let out = '';
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') { out += '(?:.*/)?'; i += 2; } else { out += '.*'; i += 1; }
      } else out += '[^/]*';
    } else if (ch === '?') out += '[^/]';
    else if (ch === '{') out += '(?:';
    else if (ch === '}') out += ')';
    else if (ch === ',') out += '|';
    else out += ch.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`, flags);
}

export function matcher(globs, flags = '') {
  const list = globs.map(glob => globToRegExp(glob, flags));
  return file => list.some(re => re.test(file));
}

/** Number of lines the way `wc -l` counts them, plus one for an unterminated last line. */
export function countLines(text) {
  if (text.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < text.length; i += 1) if (text.charCodeAt(i) === 10) n += 1;
  return text.charCodeAt(text.length - 1) === 10 ? n : n + 1;
}

/** All matches of a global regex with 1-based line numbers. `at` picks the reported offset. */
export function scan(text, regex, at = m => m.index) {
  if (!regex.global) throw new Error(`guard: regex must be global: ${regex}`);
  const hits = [];
  let line = 1;
  let cursor = 0;
  regex.lastIndex = 0;
  for (let m = regex.exec(text); m; m = regex.exec(text)) {
    if (m[0].length === 0) regex.lastIndex += 1;
    const offset = at(m);
    for (; cursor < offset; cursor += 1) if (text.charCodeAt(cursor) === 10) line += 1;
    hits.push({ line, offset, text: m[0], match: m });
  }
  return hits;
}

/**
 * The file universe: tracked files plus untracked-but-not-ignored files that exist on disk.
 * Untracked files are included on purpose, so a violation is caught before it is committed.
 */
export function createContext(root) {
  const listed = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean);
  const files = [...new Set(listed)].filter(file => {
    try { return fs.lstatSync(path.join(root, file)).isFile(); } catch { return false; }
  }).sort(byCodeUnit);
  const cache = new Map();
  const read = file => {
    if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
    return cache.get(file);
  };
  const size = file => fs.statSync(path.join(root, file)).size;
  // Each file is parsed once; every AST rule shares the same tree. A syntax error throws (see ts.mjs).
  const trees = new Map();
  const ast = file => {
    if (!trees.has(file)) trees.set(file, parse(file, read(file)));
    return trees.get(file);
  };
  // Per-file derived data (for example the import list) computed once and shared between rules.
  const derived = new Map();
  const memo = (key, file, make) => {
    const id = `${key}\0${file}`;
    if (!derived.has(id)) derived.set(id, make());
    return derived.get(id);
  };
  return { root, files, fileSet: new Set(files), read, size, ast, memo };
}

/** Short one-line excerpt for reports. */
export const excerpt = (value, max = 80) => {
  const flat = String(value).replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

/**
 * Deterministic JSON writer. Objects/arrays at depth >= inlineDepth are printed on one line,
 * so files grouped by directory stay short and diff per directory.
 */
export function stableJson(value, inlineDepth, depth = 0, indent = '') {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (depth >= inlineDepth) return JSON.stringify(value);
  const next = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[\n${value.map(item => next + stableJson(item, inlineDepth, depth + 1, next)).join(',\n')}\n${indent}]`;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) return '{}';
  return `{\n${keys.map(key => `${next}${JSON.stringify(key)}: ${stableJson(value[key], inlineDepth, depth + 1, next)}`).join(',\n')}\n${indent}}`;
}

/** { 'a/b/c.ts': 1 } -> { 'a/b': { 'c.ts': 1 } } with sorted keys, and back. */
export function groupByDir(flat) {
  const grouped = {};
  for (const file of Object.keys(flat).sort(byCodeUnit)) {
    const cut = file.lastIndexOf('/');
    const dir = cut < 0 ? '.' : file.slice(0, cut);
    (grouped[dir] ??= {})[file.slice(cut + 1)] = flat[file];
  }
  return Object.fromEntries(Object.keys(grouped).sort(byCodeUnit).map(dir => [dir, grouped[dir]]));
}

export function flattenDirs(grouped) {
  const flat = {};
  for (const [dir, names] of Object.entries(grouped ?? {})) {
    for (const [name, value] of Object.entries(names)) flat[dir === '.' ? name : `${dir}/${name}`] = value;
  }
  return flat;
}
