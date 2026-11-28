// The issue code table: one row per code with its severity. The documentation table in docs/framework/metamodel.md
// is rendered from this table (renderIssueCodeTable) and a test fails when the two differ.
import { CODE_TABLE_HEADER, ISSUE_MESSAGES } from './messages';

export type Severity = 'error' | 'warning';
export type IssueCode = keyof typeof ISSUE_MESSAGES;
export interface Issue { code: IssueCode; severity: Severity; path: string; message: string }

export const ISSUE_CODES: Record<IssueCode, { severity: Severity; check: string }> = {
  M01_SCHEMA_INVALID: { severity: 'error', check: 'validateBundle' },
  M02_OVERLAY_INVALID: { severity: 'error', check: 'validateBundle' },
  M03_OVERLAY_TARGET_MISSING: { severity: 'error', check: 'validateBundle' },
  R01_UNKNOWN_ENTITY: { severity: 'error', check: 'validateBundle' },
  R02_UNKNOWN_FIELD: { severity: 'error', check: 'validateBundle' },
  R03_UNKNOWN_SECTION: { severity: 'error', check: 'validateBundle' },
  R03_UNKNOWN_TAB: { severity: 'error', check: 'validateBundle' },
  R04_MISSING_TRANSLATION: { severity: 'error', check: 'validateBundle' },
  R05_UNKNOWN_CODE_GROUP: { severity: 'error', check: 'validateBundle' },
  R06_UNKNOWN_REFERENCE_OBJECT: { severity: 'error', check: 'validateBundle' },
  R07_UNKNOWN_ACTION: { severity: 'error', check: 'validateBundle' },
  R07_UNKNOWN_FEATURE: { severity: 'error', check: 'validateBundle' },
  R07_UNKNOWN_PERMISSION: { severity: 'error', check: 'validateBundle' },
  R07_UNKNOWN_STATE: { severity: 'error', check: 'validateBundle' },
  R07_UNKNOWN_MENU_PARENT: { severity: 'error', check: 'validateBundle' },
  R08_DUPLICATE_KEY: { severity: 'error', check: 'validateBundle' },
  R09_REPLACED_BY_MISSING: { severity: 'error', check: 'validateBundle' },
  R09_REPLACED_BY_DEPRECATED: { severity: 'error', check: 'validateBundle' },
  R09_DEPRECATED_REQUIRED: { severity: 'error', check: 'validateBundle' },
  R09_DEPRECATED_USE: { severity: 'warning', check: 'validateBundle' },
  R09_ALIAS_USE: { severity: 'warning', check: 'validateBundle' },
  R10_OPTION_NOT_ALLOWED: { severity: 'error', check: 'validateBundle' },
  R10_DECIMAL_SCALE: { severity: 'error', check: 'validateBundle' },
  R10_ENUM_NEEDS_GROUP: { severity: 'error', check: 'validateBundle' },
  R10_REFERENCE_NEEDS_OBJECT: { severity: 'error', check: 'validateBundle' },
  R10_OPERATOR_TYPE: { severity: 'error', check: 'validateBundle' },
  R10_REQUIRED_HIDDEN: { severity: 'error', check: 'validateBundle' },
  R11_ACCESS_FIELD_TYPE: { severity: 'error', check: 'validateBundle' },
  R11_ACCESS_NONE_MIXED: { severity: 'error', check: 'validateBundle' },
  F01_UNKNOWN_FILE: { severity: 'error', check: 'bundleFromFiles' },
  F02_MISPLACED_FILE: { severity: 'error', check: 'bundleFromFiles' },
  F03_INVALID_JSON: { severity: 'error', check: 'bundleFromFiles' },
  F04_TOO_LARGE: { severity: 'error', check: 'bundleFromFiles' },
  D01_REMOVED_WITHOUT_DEPRECATION: { severity: 'error', check: 'diffBundles' },
  D02_RENAMED_WITHOUT_ALIAS: { severity: 'error', check: 'diffBundles' },
  D03_TYPE_CHANGED: { severity: 'error', check: 'diffBundles' },
  D04_DEPRECATED_NEW_USE: { severity: 'warning', check: 'diffBundles' },
  D05_ACCESS_WIDENED: { severity: 'error', check: 'diffBundles' },
  D06_ALIAS_MERGES_FIELDS: { severity: 'error', check: 'diffBundles' },
};

export function issue(code: IssueCode, path: string, params: Record<string, string | number | undefined> = {}): Issue {
  const message = ISSUE_MESSAGES[code].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? '-'));
  return { code, severity: ISSUE_CODES[code].severity, path, message };
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Sorted by path, then code, then message, without duplicates: the same input always gives the same list. */
export function sortIssues(list: Issue[]): Issue[] {
  const seen = new Set<string>();
  return [...list].sort((a, b) => cmp(a.path, b.path) || cmp(a.code, b.code) || cmp(a.message, b.message))
    .filter(i => { const id = `${i.path}\u0000${i.code}\u0000${i.message}`; if (seen.has(id)) return false; seen.add(id); return true; });
}

const cell = (s: string) => s.replace(/\|/g, '\\|');
/** The Markdown table of every code, in code order. docs/framework/metamodel.md holds a copy between markers. */
export function renderIssueCodeTable(): string {
  const rows = (Object.keys(ISSUE_CODES) as IssueCode[]).sort().map(c => `| \`${c}\` | ${ISSUE_CODES[c].severity} | \`${ISSUE_CODES[c].check}\` | ${cell(ISSUE_MESSAGES[c])} |`);
  return [CODE_TABLE_HEADER, '| --- | --- | --- | --- |', ...rows].join('\n');
}
