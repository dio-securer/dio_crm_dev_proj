import { describe, expect, it } from 'vitest';
import { contractBalanceLabel } from './contract-feedback';
import { planDifference } from './contract-feedback';
import { receiptAmountLabel } from './contract-feedback';
describe('계약잔액 표시', () => {
 it('권한이 부족한 집계는 0으로 표시하지 않는다', () => { expect(contractBalanceLabel(null, n=>`${n}원`)).toBe('확인 불가'); });
 it('확인된 0과 양수는 그대로 표시한다', () => { expect(contractBalanceLabel(0,n=>`${n}원`)).toBe('0원'); expect(contractBalanceLabel(12,n=>`${n}원`)).toBe('12원'); });
});
describe('수금 원천 통화', () => { it('통화가 없으면 계약 통화로 추정하지 않는다', () => expect(receiptAmountLabel(10, undefined, () => 'KRW 10')).toBe('10 · 통화 미확인')); });
describe('수금계획 차이', () => {
 it('100만 계약에 50만과 40만을 입력하면 부족액 10만을 표시한다', () => expect(planDifference(1000000,[500000,400000])).toEqual({ amount:100000, direction:'부족' }));
 it('일치와 초과를 구분한다', () => { expect(planDifference(1000000,[500000,500000])).toEqual({ amount:0,direction:'일치' }); expect(planDifference(100,[120])).toEqual({amount:20,direction:'초과'}); });
});
