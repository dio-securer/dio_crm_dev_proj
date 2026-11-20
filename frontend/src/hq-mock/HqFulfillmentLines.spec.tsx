import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FulfillmentLines } from './HqFulfillmentLines';
describe('납품 품목 수량', () => {
 it('확인된 수량과 미납 수량을 명확히 표시한다', () => {
   const html = renderToStaticMarkup(<FulfillmentLines items={[{public_id:'a', item_name:'제품 A'}]} lines={[{lineId:'a', orderedQty:10, shippedQty:6, deliveredQty:4, remainingQty:6, issue:null}]} />);
   expect(html).toContain('제품 A'); expect(html).toContain('주문 10'); expect(html).toContain('출고 6'); expect(html).toContain('납품 4'); expect(html).toContain('미납 6');
 });
 it('원천 단위가 불명확할 때 임의의 잔량을 표시하지 않는다', () => {
   const html = renderToStaticMarkup(<FulfillmentLines items={[{public_id:'a', item_name:'제품 A'}]} lines={[{lineId:'a', orderedQty:10, shippedQty:null, deliveredQty:null, remainingQty:null, issue:'단위 확인 필요'}]} />);
   expect(html).toContain('단위 확인 필요'); expect(html).not.toContain('미납 10');
 });
});
