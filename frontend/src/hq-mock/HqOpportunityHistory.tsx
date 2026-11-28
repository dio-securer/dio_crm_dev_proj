import React from 'react';
type Entry = Record<string, any>;
const labels: Record<string,string> = {record_type:'기회 레코드 유형',opportunity_name:'기회명',expected_close_date:'예상 마감일',success_probability:'성공 확률 (%)',forecast_category:'예측 범주',price_list_code:'가격 목록',interest_product:'관심 제품',description:'설명',owned_equipment:'보유 장비 정보',competitor_usage:'타사 사용현황',treatment_fee_info:'수가 정보',stock_status:'재고 상황',payment_status:'결제 상황',special_terms:'특약사항',payment_date:'결제 일자',payment_method:'결제 수단',installment_months:'할부 개월수'};
const values: Record<string,string> = {NEW:'신규',EXISTING:'기존',RECONTRACT:'재계약',NEEDS_ANALYSIS:'니즈파악',PROPOSAL:'제안',NEGOTIATION:'협상',CLOSED_WON:'수주 성공',CLOSED_LOST:'수주 실패',ERP_STANDARD:'ERP 표준가격',CUSTOM_QUOTE:'별도 제안가격',PIPELINE:'파이프라인',BEST_CASE:'최선 예상',COMMIT:'확약',OMITTED:'예측 제외'};
const valueText = (value: unknown): string => value == null || value === '' ? '비어 있음' : typeof value === 'boolean' ? value ? '예' : '아니요' : typeof value === 'object' ? JSON.stringify(value) : values[String(value)] ?? String(value);
const actionText: Record<string,string> = {INFORMATION_UPDATED:'기회 정보 변경',PRICE_LIST_CHANGED:'가격 목록 변경',PRODUCT_REORDER:'제품 순서 변경'};
export function HqOpportunityHistory({history}: {history: Entry[]}) {
 return <details className="hq-opportunity-history"><summary>기회 변경 이력</summary>{history.length === 0 ? <p>변경 이력이 없습니다.</p> : <ol style={{paddingInlineStart:24}}>{history.map((entry,index)=><li key={index} style={{marginBlock:16}}>
  <p><strong>{actionText[entry.action] ?? (entry.from !== undefined || entry.to !== undefined ? '단계 변경' : entry.action ?? '정보 변경')}</strong>{entry.at && <> · <time>{String(entry.at)}</time></>}</p>
  {Array.isArray(entry.changes) ? entry.changes.map((change:Entry,i:number)=><section key={i} aria-label={labels[change.field] ?? String(change.field ?? '항목')} style={{borderInlineStart:'3px solid #c7d6ec',paddingInlineStart:12,marginBlock:10,overflowWrap:'anywhere'}}>
   <strong>{labels[change.field] ?? String(change.field ?? '항목')}</strong>
   <dl style={{marginBlock:4}}><dt>변경 전</dt><dd style={{marginInlineStart:12,whiteSpace:'pre-wrap'}}>{valueText(change.before)}</dd><dt>변경 후</dt><dd style={{marginInlineStart:12,whiteSpace:'pre-wrap'}}>{valueText(change.after)}</dd></dl>
  </section>) : (entry.from !== undefined || entry.to !== undefined) && <p>{valueText(entry.from)} → {valueText(entry.to)}</p>}
  {entry.reason && <p>사유: {String(entry.reason)}</p>}
 </li>)}</ol>}</details>;
}
