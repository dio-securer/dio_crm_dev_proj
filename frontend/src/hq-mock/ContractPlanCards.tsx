import React from 'react';
type Plan={public_id:string;installment_no?:number;amount?:number;currency?:string;planned_date?:string;collection_method?:string;erp_sync_status?:string;plan_version?:number;adjustment_type?:string};
export function ContractPlanCards({rows,amountLabel}:{rows:Plan[];amountLabel:(amount:number|undefined,currency:string|undefined)=>string}){
 return <div className="contract-plan-cards">{rows.map(row=><article className="contract-plan-card" key={row.public_id}><strong>{row.installment_no??'—'}회차</strong><strong>{amountLabel(row.amount,row.currency)}</strong><dl><div><dt>예정일</dt><dd>{row.planned_date||'확인 불가'}</dd></div><div><dt>방법</dt><dd>{row.collection_method||'확인 불가'}</dd></div><div><dt>계획 버전 / 유형</dt><dd>{row.plan_version??'—'} / {row.adjustment_type||'확인 불가'}</dd></div><div><dt>ERP 동기화</dt><dd>{row.erp_sync_status||'확인 불가'}</dd></div></dl></article>)}</div>;
}
