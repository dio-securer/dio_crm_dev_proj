import React from 'react';
type Quote = Record<string, any>;
export function QuotePrintView({quote}:{quote:Quote}) {
 const money=(value:unknown)=>`${Number(value??0).toLocaleString('ko-KR')} ${quote.currency??'KRW'}`;
 return <div className="quote-print-document"><h1>견적서</h1><h2>{quote.name}</h2><p>발행일: {quote.issueDate||'미지정'} · 만료일: {quote.expiryDate||'미지정'}</p><table><thead><tr><th>제품</th><th>수량</th><th>단가</th><th>금액</th></tr></thead><tbody>{(quote.lines??[]).map((line:Quote,index:number)=><tr key={line.public_id??index}><td>{line.item_name??line.package_name??'제품'}</td><td>{line.quantity}</td><td>{money(line.proposed_unit_price)}</td><td>{money(line.amount)}</td></tr>)}</tbody></table><p>소계 {money(quote.subtotal)} · 세금 {money(quote.tax)} · 배송비 {money(quote.shipping)}</p><strong>합계 {money(quote.total)}</strong><p>납품 조건: {quote.deliveryTerms||'미지정'}</p><p>결제 조건: {quote.paymentTerms||'미지정'}</p><p>{quote.notes}</p></div>;
}
