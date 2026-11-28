export function orderErrorMessage(reason: unknown): string {
  if (reason && typeof reason === 'object' && 'errorCode' in reason && ['DESTINATION_NOT_FOUND','DESTINATION_VERSION_CONFLICT'].includes(String(reason.errorCode))) return '선택한 직송지가 변경되었거나 삭제되었습니다. 입력은 유지됩니다. 직송지 목록을 새로 고친 뒤 다시 선택해 주세요.';
  if (reason && typeof reason === 'object' && 'errorCode' in reason && reason.errorCode === 'ORDER_PRICE_CHANGED') return '품목의 단가가 변경되었습니다. 품목 유형을 선택해 최신 단가를 확인한 뒤 해당 품목을 삭제하고 다시 추가해 주세요. 배송 정보와 다른 품목은 유지됩니다.';
  if (reason && typeof reason === 'object' && 'errorCode' in reason && reason.errorCode === 'VERSION_CONFLICT') return '주문이 다른 곳에서 변경되었습니다. 입력은 유지됩니다. 확인 창을 닫고 배송 정보 최신 조회로 저장된 내용을 확인해 주세요.';
  return reason instanceof Error ? reason.message : String(reason);
}
export function formatOrderAmount(value: unknown, currency: unknown): string {
  const code = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : '통화 미확인';
  return `${Number(value ?? 0).toLocaleString('ko-KR')} ${code}`;
}
type OrderConfirmation = { items: Array<{ item_name?: string; quantity: number; unit_price: number; currency?: string }>; order_amount: number; delivery_address: string; currency?: string };
export function orderConfirmation(order: OrderConfirmation): string {
  const rows = order.items.map(item => `${item.item_name ?? '품목'} · 수량 ${item.quantity} · 단가 ${formatOrderAmount(item.unit_price, item.currency)}`).join('\n');
  return `MOCK 주문 요청 확인\n${rows}\n총액 ${formatOrderAmount(order.order_amount, order.currency)}\n배송지 ${order.delivery_address}\n실제 ERP 주문이 전송되지 않습니다.`;
}
type OrderFilter = { search: string; status: string; from: string; to: string; contract: string; owner: string; product: string };
export function filterOrders<T extends Record<string, any>>(rows: T[], filter: OrderFilter): T[] {
  const contains = (value: unknown, query: string) => String(value ?? '').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  return rows.filter(row => (!filter.status || row.status === filter.status)
    && (!filter.from || String(row.created_at ?? '').slice(0,10) >= filter.from)
    && (!filter.to || (!!row.created_at && String(row.created_at).slice(0,10) <= filter.to))
    && contains(row.account_name, filter.search) && contains(row.contract_name, filter.contract)
    && (!filter.owner || String(row.owner_user_id ?? '') === filter.owner.trim())
    && (!filter.product.trim() || (Array.isArray(row.items) && row.items.some((line: Record<string, unknown>) => contains(`${line.item_name ?? ''} ${line.erp_item_code ?? ''}`, filter.product)))));
}
