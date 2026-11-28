import { describe, expect, it } from 'vitest';
import { orderErrorMessage } from './order-feedback';
describe('주문 오류 안내', () => {
  it('단가 변경 시 입력을 지키며 최신 품목을 확인하고 다시 추가하도록 안내한다', () => {
    expect(orderErrorMessage({ errorCode: 'ORDER_PRICE_CHANGED', message: 'conflict' })).toContain('최신 단가');
    expect(orderErrorMessage({ errorCode: 'ORDER_PRICE_CHANGED', message: 'conflict' })).toContain('삭제');
    expect(orderErrorMessage({ errorCode: 'ORDER_PRICE_CHANGED', message: 'conflict' })).toContain('다시 추가');
  });
  it('다른 오류 메시지는 그대로 보존한다', () => expect(orderErrorMessage(new Error('network'))).toBe('network'));
  it('주문 버전 충돌을 다시 확인하도록 안내한다', () => expect(orderErrorMessage({ errorCode: 'VERSION_CONFLICT' })).toContain('최신'));
});
import { orderConfirmation } from './order-feedback';
describe('주문 요청 전 확인', () => {
 it('MOCK, 품목, 수량, 단가, 총액 및 저장 배송지를 확인한다', () => {
  const text = orderConfirmation({ items: [{ item_name: '임플란트', quantity: 2, unit_price: 100000 }], order_amount: 200000, delivery_address: '부산' });
  for (const part of ['MOCK','임플란트','2','100,000','200,000','부산']) expect(text).toContain(part);
 });
});
import { formatOrderAmount } from './order-feedback';
describe('주문 통화 표시', () => {
 it('원천 통화를 표시하고 미확인일 때 원화로 추측하지 않는다', () => {
  expect(formatOrderAmount(1000,'USD')).toContain('USD'); expect(formatOrderAmount(1000,null)).toContain('통화 미확인'); expect(formatOrderAmount(1000,null)).not.toContain('원');
 });
});
import { filterOrders } from './order-feedback';
describe('주문 목록 검색', () => {
 it('상태·날짜·고객·계약·담당·품목을 모두 적용한다', () => {
  const rows=[{public_id:'1',status:'DRAFT',created_at:'2026-10-22',account_name:'디오치과',contract_name:'계약 A',owner_user_id:1,items:[{item_name:'임플란트'}]}, {public_id:'2',status:'ACCEPTED',created_at:'2026-10-23',account_name:'다른병원',contract_name:'계약 B',owner_user_id:2,items:[]}];
  const result=filterOrders(rows,{search:'디오',status:'DRAFT',from:'2026-10-01',to:'2026-10-31',contract:'계약 A',owner:'1',product:'임플란트'}); expect(result.map(row=>row.public_id)).toEqual(['1']);
 });
});
