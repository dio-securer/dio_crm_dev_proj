type RecordLike = Record<string, unknown>;
export function summarizeFulfillment(lines: RecordLike[], events: RecordLike[], complete = true) {
  return lines.map(line => {
    const lineId = String(line.public_id ?? line.product_public_id ?? '');
    const orderedQty = Number(line.quantity);
    const relevant = events.filter(event => event.order_line_public_id === lineId);
    const unique = new Map<string, RecordLike>();
    let issue: string | null = !complete ? '전체 납품 정보 확인 불가' : !lineId || !Number.isFinite(orderedQty) || !line.unit ? '주문 품목 단위 또는 수량 확인 필요' : null;
    if (events.some(event => !event.order_line_public_id)) issue = '품목이 연결되지 않은 납품 원천 정보 확인 필요';
    if (!relevant.length) issue = '납품 수량 원천 정보 없음';
    for (const event of relevant) {
      const id = String(event.erp_delivery_no ?? '');
      if (!id) { issue = '납품 원천번호 확인 필요'; continue; }
      const prior = unique.get(id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(event)) issue = '동일 납품번호 정보 불일치';
      else if (!prior) unique.set(id, event);
    }
    let shippedQty = 0, deliveredQty = 0;
    for (const event of unique.values()) {
      const shipped = event.shipped_qty, delivered = event.delivered_qty;
      if (event.delivery_status === 'CANCELLED' || event.unit !== line.unit || typeof shipped !== 'number' || !Number.isFinite(shipped) || shipped < 0 || typeof delivered !== 'number' || !Number.isFinite(delivered) || delivered < 0) { issue = '취소·단위·수량 확인 필요'; continue; }
      if (!['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(String(event.delivery_status)) || (event.delivery_status !== 'DELIVERED' && delivered > 0)) { issue = '납품 상태와 수량 확인 필요'; continue; }
      shippedQty += shipped; deliveredQty += delivered;
    }
    if (deliveredQty > orderedQty) issue = '주문 수량을 초과한 납품 확인 필요';
    return { lineId, orderedQty, shippedQty: issue ? null : shippedQty, deliveredQty: issue ? null : deliveredQty, remainingQty: issue ? null : orderedQty - deliveredQty, issue };
  });
}
