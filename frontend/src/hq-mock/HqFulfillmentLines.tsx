import React from 'react';
type Line = { lineId: string; orderedQty: number; shippedQty: number | null; deliveredQty: number | null; remainingQty: number | null; issue: string | null };
export function FulfillmentLines({ items, lines }: { items: Array<{ public_id: string; item_name?: string }>; lines: Line[] }) {
  return <section className="h06-card"><h2>품목별 납품 수량 · MOCK</h2>{lines.length === 0 && <p>품목 정보가 없습니다.</p>}{lines.map(line => <div className="h06-line" key={line.lineId}><strong>{items.find(item => item.public_id === line.lineId)?.item_name ?? line.lineId}</strong><span>주문 {line.orderedQty}</span>{line.issue ? <span>계산 보류: {line.issue}</span> : <><span>출고 {line.shippedQty}</span><span>납품 {line.deliveredQty}</span><span>미납 {line.remainingQty}</span></>}</div>)}</section>;
}
