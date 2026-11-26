// Import specifier extraction by regex (no TypeScript dependency at the repo root).
import { scan } from './files.mjs';

const LITERAL = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\brequire\s*(?:\.\s*resolve\s*)?\(\s*)(['"`])([^'"`\n]*)\1/g;
const DYNAMIC = /\b(?:import|require)\s*\(\s*(?!['"`]|\s*\))[^\s)]/g;

/**
 * Returns [{ line, specifier, dynamic }]. `dynamic: true` means the target is computed at run time
 * (a variable or a template with ${...}) and therefore cannot be verified statically.
 */
export function extractImports(text) {
  const found = scan(text, LITERAL).map(hit => {
    const specifier = hit.match[2];
    return { line: hit.line, specifier, dynamic: specifier.includes('${') };
  });
  for (const hit of scan(text, DYNAMIC)) found.push({ line: hit.line, specifier: '', dynamic: true });
  return found.sort((a, b) => a.line - b.line);
}

/** 'node:https' -> 'https', '@scope/pkg/sub' -> '@scope/pkg', 'pkg/sub' -> 'pkg'. */
export function packageName(specifier) {
  const bare = specifier.replace(/^node:/, '');
  const parts = bare.split('/');
  return bare.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Resolve a relative specifier against the importing file. Returns a repo-relative path (may start with '..'). */
export function resolveRelative(fromFile, specifier) {
  const stack = fromFile.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') { if (stack.length && stack[stack.length - 1] !== '..') stack.pop(); else stack.push('..'); } else stack.push(part);
  }
  return stack.join('/');
}
