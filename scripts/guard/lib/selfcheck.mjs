// The guard checks the readability of its own code: no line in the folders below may be longer than MAX_LINE characters.
// (File length, 300 lines / 15,000 bytes, is already enforced for these files by G03.)
import { protectedEntry } from './codeowners.mjs';
import { countLines } from './files.mjs';

export const SELF_DIRS = ['scripts/guard/', 'tests/guard/', 'scripts/crm/'];
export const MAX_LINE = 160;

/** Returns [{ file, line, length }] for every too-long line, in file order. */
export function selfCheck(ctx) {
  const found = [];
  for (const file of ctx.files) {
    if (!SELF_DIRS.some(dir => file.startsWith(dir))) continue;
    const text = ctx.read(file);
    if (countLines(text) === 0) continue;
    text.split('\n').forEach((row, index) => {
      const length = row.replace(/\r$/, '').length;
      if (length > MAX_LINE) found.push({ file, line: index + 1, length });
    });
  }
  return found;
}

/**
 * Every package.json decides what `pnpm build` / `pnpm test` really run, so each one must be on the protected list.
 * Returns the ones that are not (a new workspace package must be added to protected-paths.json in the same change).
 */
export function unprotectedManifests(ctx, list) {
  return ctx.files.filter(file => (file === 'package.json' || file.endsWith('/package.json')) && protectedEntry(list, file) === null);
}
