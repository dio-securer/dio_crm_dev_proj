import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet } from '../api';
import { useHqMock } from './HqMockProvider';

type Order = { public_id: string; status: string; integration_status: string; erp_order_no?: string; order_amount: number };
type Return = { public_id: string; order_public_id: string; erp_reference_no?: string; transaction_type: string; status: string; amount?: number };
export function HqContractOrders({ contractId, money }: { contractId: string; money: (amount: number) => string }) {
  const { session } = useHqMock();
  const result = useQuery({ queryKey: ['hq-sales', 'contract-orders', contractId, session?.user.userId],
    queryFn: () => apiGet<{ orders: Order[]; returns: Return[] }>(`/api/contracts/${contractId}/orders`), retry: false });
  return <section className="hq-sales-card"><h2>주문 &amp; 반품정보</h2>
    <button disabled={result.isFetching} onClick={() => void result.refetch()}>관련정보 새로 고침</button>
    {result.error && <p role="alert">{String(result.error)}</p>}{result.isPending && <p>불러오는 중…</p>}
    {result.data && <><h3>주문요청</h3>{result.data.orders.length ? result.data.orders.map(order => <p key={order.public_id}>
      <Link to={`/orders?record=${order.public_id}`}>{order.erp_order_no || `주문 ${order.public_id.slice(-8)}`}</Link> · {order.status} · {order.integration_status} · {money(order.order_amount)}
    </p>) : <p>연결된 주문이 없습니다.</p>}<h3>반품·교환</h3>{result.data.returns.length ? result.data.returns.map(item => <p key={item.public_id}>
      <Link to={`/orders?record=${item.order_public_id}`}>{item.erp_reference_no || '관련 주문'}</Link> · {item.transaction_type} · {item.status} · {money(item.amount ?? 0)}
    </p>) : <p>연결된 반품·교환이 없습니다.</p>}</>}
  </section>;
}
