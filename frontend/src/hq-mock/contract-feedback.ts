export function contractBalanceLabel(value: unknown, money: (amount: number) => string): string {
 return typeof value === 'number' && Number.isFinite(value) ? money(value) : '확인 불가';
}
export function planDifference(target: number, amounts: number[]): {amount: number; direction: '부족' | '초과' | '일치'} {
 const delta = target - amounts.reduce((sum, amount) => sum + amount, 0);
 return { amount: Math.abs(delta), direction: Math.abs(delta) < 0.005 ? '일치' : delta > 0 ? '부족' : '초과' };
}
export function receiptAmountLabel(value: unknown, currency: unknown, money: (amount: number, currency?: string) => string): string {
 if (typeof value !== 'number' || !Number.isFinite(value)) return '확인 불가';
 return typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? money(value, currency) : `${value.toLocaleString('ko-KR')} · 통화 미확인`;
}
