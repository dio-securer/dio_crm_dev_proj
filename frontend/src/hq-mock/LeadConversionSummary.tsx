import React from 'react';
export function LeadConversionSummary({account,contact,opportunity,owner}:{account:string;contact:string;opportunity:string;owner:string}) {
 return <section className="hq-customer-panel" aria-label="전환 선택 확인"><h3>전환 선택 확인 · MOCK</h3><dl><div><dt>거래처</dt><dd>{account}</dd></div><div><dt>연락처</dt><dd>{contact}</dd></div><div><dt>영업기회</dt><dd>{opportunity}</dd></div><div><dt>담당자</dt><dd>{owner}</dd></div></dl><p>기존값 충돌 여부는 확인되지 않았습니다. 권한과 연결은 서버가 재검증하며 실제 ERP 등록이나 승인은 진행되지 않습니다.</p></section>;
}
