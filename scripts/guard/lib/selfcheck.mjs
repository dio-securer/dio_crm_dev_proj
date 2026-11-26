// The guard checks its own readability: no line in scripts/guard/** may be longer than MAX_LINE characters.
// (File length, 300 lines / 15,000 bytes, is already enforced for these files by G03.)
import { countLines } from './files.mjs';

export const SELF_DIR = 'scripts/guard/';
export const MAX_LINE = 160;

/** Returns [{ file, line, length }] for every too-long line, in file order. */
export function selfCheck(ctx) {
  const found = [];
  for (const file of ctx.files) {
    if (!file.startsWith(SELF_DIR)) continue;
    const text = ctx.read(file);
    if (countLines(text) === 0) continue;
    text.split('\n').forEach((row, index) => {
      const length = row.replace(/\r$/, '').length;
      if (length > MAX_LINE) found.push({ file, line: index + 1, length });
    });
  }
  return found;
}
