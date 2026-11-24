import React, { useState } from 'react';
import { HqModal } from './customer-shared';

type Product = { public_id: string; item_name?: string; erp_item_code?: string; base_price?: number; unit_price?: number };
export type ProductSelection = { packagePublicId: string; quantity: number; proposedUnitPrice: number };

export function HqOpportunityProductPicker({ catalog, busy, error, money, onClose, onSave, onReload }: {
  catalog: Product[]; busy: boolean; error: string; money: (value: number) => string;
  onClose: () => void; onSave: (items: ProductSelection[]) => Promise<void>; onReload?: () => void;
}) {
  const [search, setSearch] = useState(''), [review, setReview] = useState(false);
  const [selected, setSelected] = useState<Record<string, ProductSelection>>({});
  const items = Object.values(selected);
  const matches = catalog.filter(row => `${row.item_name ?? ''} ${row.erp_item_code ?? ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const valid = items.length > 0 && items.every(item => Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 9999 && Number.isFinite(item.proposedUnitPrice) && item.proposedUnitPrice >= 0);
  const change = (id: string, patch: Partial<ProductSelection>) => setSelected(previous => ({ ...previous, [id]: { ...previous[id], ...patch } }));
  const close = () => { if (items.length && !window.confirm('선택한 제품 입력을 버리시겠습니까?')) return; onClose(); };
  return <HqModal title={review ? '선택된 제품 편집' : '제품 검색·선택'} onClose={close} busy={busy} wide>
    {error && <p role="alert" className="hq-sales-error">{error}</p>}
    {error && onReload && <button type="button" disabled={busy} onClick={onReload}>최신 정보 다시 불러오기</button>}
    {!review ? <><label>제품명 또는 코드 검색<input value={search} onChange={event => setSearch(event.target.value)} /></label>
      <p role="status">검색 결과 {matches.length}개 · 선택 {items.length}개</p>
      <div className="hq-sales-products">{matches.map(row => <label className="hq-checkbox-row" key={row.public_id}>
        <input type="checkbox" checked={Boolean(selected[row.public_id])} onChange={event => setSelected(previous => {
          const next = { ...previous };
          if (event.target.checked) next[row.public_id] = { packagePublicId: row.public_id, quantity: 1, proposedUnitPrice: Number(row.base_price ?? row.unit_price ?? 0) };
          else delete next[row.public_id];
          return next;
        })} />{row.item_name} · {row.erp_item_code || '코드 없음'} · {money(Number(row.base_price ?? row.unit_price ?? 0))}
      </label>)}</div>{!matches.length && <p>일치하는 제품이 없습니다.</p>}
      <button disabled={!items.length} onClick={() => setReview(true)}>다음</button></> : <>
      <p>수량과 제안 단가를 확인하세요. 저장하면 선택된 제품을 함께 추가합니다.</p>
      {items.map(item => { const product = catalog.find(row => row.public_id === item.packagePublicId); return <section className="hq-sales-card" key={item.packagePublicId}>
        <h3>{product?.item_name}</h3><div className="hq-sales-fields">
          <label>{product?.item_name} 수량<input disabled={busy} type="number" min={1} max={9999} step={1} value={item.quantity} onChange={event => change(item.packagePublicId, { quantity: Number(event.target.value) })} /></label>
          <label>{product?.item_name} 제안 단가<input disabled={busy} type="number" min={0} value={item.proposedUnitPrice} onChange={event => change(item.packagePublicId, { proposedUnitPrice: Number(event.target.value) })} /></label>
          <span>금액 {money(item.quantity * item.proposedUnitPrice)}</span>
          <button disabled={busy} onClick={() => setSelected(previous => { const next = { ...previous }; delete next[item.packagePublicId]; return next; })}>선택 해제</button>
        </div></section>; })}
      <p>선택 제품 합계: {money(items.reduce((sum, item) => sum + item.quantity * item.proposedUnitPrice, 0))}</p>
      <button disabled={busy} onClick={() => setReview(false)}>이전</button>
      <button disabled={busy || !valid} onClick={() => void onSave(items)}>선택 제품 저장</button>
    </>}
    <button disabled={busy} onClick={close}>취소</button>
  </HqModal>;
}
