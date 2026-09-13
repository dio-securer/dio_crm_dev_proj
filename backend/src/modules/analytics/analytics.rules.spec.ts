import { ledgerFilename, previousMonthRange, statementFilename, validateStatementRange } from './analytics.rules';

describe('Phase 7 analytics rules', () => {
  it('uses previous month as the default statement period', () => {
    expect(previousMonthRange(new Date('2026-09-12T00:00:00Z'))).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  });

  it('does not allow statement lookup before 2018-01-01', () => {
    expect(validateStatementRange('2017-12-31','2018-01-31').allowed).toBe(false);
    expect(validateStatementRange('2018-01-01','2018-01-31').allowed).toBe(true);
  });

  it('builds source-compatible statement and ledger filenames', () => {
    expect(statementFilename('2026-08-31','PKG/001')).toBe('2026-08_월합_거래명세서_PKG_001.pdf');
    expect(statementFilename('2026-08-31',null,true)).toBe('2026-08_월합_거래명세서_GENERAL.pdf');
    expect(ledgerFilename('디오 치과','PKG/001')).toContain('패키지원장');
  });

  it('builds English filenames when an English locale is selected', () => {
    expect(statementFilename('2026-08-31','PKG/001',false,'en-US')).toBe('2026-08_monthly_statement_PKG_001.pdf');
    expect(ledgerFilename('DIO Dental','PKG/001',false,'en-US')).toContain('package_ledger');
  });
});
