import React from 'react';
type Row=Record<string,unknown>;
export function ContractObservedFields({row,money}:{row:Row;money:(amount:number)=>string}){
 const text=(value:unknown)=>value==null||value===''?'확인 불가':String(value);
 const amount=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?money(value):'확인 불가';
 return <section aria-label="계약 기본 속성"><h3>계약 기본 속성</h3><dl className="hq-sales-summary"><div><dt>계약일자</dt><dd>{text(row.contract_date)}</dd></div><div><dt>패키지 구분</dt><dd>{text(row.package_classification)}</dd></div><div><dt>제품 금액</dt><dd>{amount(row.product_amount)}</dd></div><div><dt>상품 금액</dt><dd>{amount(row.goods_amount)}</dd></div><div><dt>특약사항</dt><dd style={{whiteSpace:'pre-wrap'}}>{text(row.special_terms)}</dd></div></dl></section>;
}
