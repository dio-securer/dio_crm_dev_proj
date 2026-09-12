import React, { useEffect, useMemo, useState } from 'react';
import type { AccountSummary, MonthlyStatement, PackageLedger } from '@dio-crm/contracts';
import { apiDownload, apiGet, apiPostDownload, saveBlob } from './api';

type ContractOption = { public_id:string; contract_name:string; erp_contract_no?:string|null; contract_date?:string|null; contract_amount:number; status:string; };

function previousMonth() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { from: first.toISOString().slice(0,10), to: last.toISOString().slice(0,10) };
}

export function LedgerStatementsPage() {
  const defaults = useMemo(previousMonth, []);
  const [accounts,setAccounts] = useState<AccountSummary[]>([]);
  const [contracts,setContracts] = useState<ContractOption[]>([]);
  const [accountId,setAccountId] = useState('');
  const [contractId,setContractId] = useState('');
  const [general,setGeneral] = useState(false);
  const [from,setFrom] = useState(defaults.from);
  const [to,setTo] = useState(defaults.to);
  const [ledger,setLedger] = useState<PackageLedger|null>(null);
  const [statement,setStatement] = useState<MonthlyStatement|null>(null);
  const [selected,setSelected] = useState<string[]>([]);
  const [message,setMessage] = useState('');
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

  useEffect(() => { void apiGet<AccountSummary[]>('/api/accounts').then(x => { setAccounts(x); if (x[0]) setAccountId(x[0].public_id); }).catch(e=>setMessage(String(e))); }, []);
  useEffect(() => {
    if (!accountId) return;
    void apiGet<ContractOption[]>(`/api/analytics/accounts/${accountId}/contracts`).then(x => { setContracts(x); setContractId(x[0]?.public_id ?? ''); }).catch(e=>setMessage(String(e)));
  }, [accountId]);

  const qs = () => {
    const p = new URLSearchParams({ from, to });
    if (general) p.set('general','true'); else if (contractId) p.set('contractPublicId',contractId);
    return p.toString();
  };
  const ready = Boolean(accountId && (general || contractId));

  const loadLedger = async () => {
    if (!ready) return setMessage('거래처와 패키지 계약 또는 일반 거래내역을 선택하세요.');
    try { setLedger(await apiGet<PackageLedger>(`/api/analytics/accounts/${accountId}/ledger?${qs()}`)); setMessage('패키지원장 조회 완료'); }
    catch(e){ setMessage(String(e)); }
  };
  const loadStatement = async () => {
    if (!ready) return setMessage('거래처와 패키지 계약 또는 일반 거래내역을 선택하세요.');
    try { const x=await apiGet<MonthlyStatement>(`/api/analytics/accounts/${accountId}/statements?${qs()}`); setStatement(x); setSelected([]); setMessage(`거래명세서 ${x.summary.lineCount}건 조회`); }
    catch(e){ setMessage(String(e)); }
  };
  const excel = async () => {
    if (!ready) return;
    try { const out=await apiDownload(`/api/analytics/accounts/${accountId}/ledger.xlsx?${qs()}`); saveBlob(out.blob,out.filename??'package-ledger.xlsx'); }
    catch(e){ setMessage(String(e)); }
  };
  const pdf = async () => {
    if (!ready) return;
    try {
      const out=await apiPostDownload(`/api/analytics/accounts/${accountId}/statements/pdf`,{ contractPublicId:general?undefined:contractId, general, from, to, salesPublicIds: mobile || selected.length===0 ? undefined : selected });
      saveBlob(out.blob,out.filename??'statement.pdf');
    } catch(e){ setMessage(String(e)); }
  };

  return <section>
    <h2>패키지원장 / 월합 거래명세서</h2>
    <p style={{color:'#667085'}}>거래처 상세 기준으로 패키지 계약 또는 일반 거래내역을 조회합니다. 거래명세서 기본기간은 지난 달이며 조회 시작일은 2018-01-01입니다.</p>
    <div style={{display:'grid',gridTemplateColumns:'2fr 2fr 1fr 1fr',gap:8,alignItems:'end'}}>
      <label>거래처<select value={accountId} onChange={e=>setAccountId(e.target.value)} style={{width:'100%',padding:8}}>{accounts.map(a=><option key={a.public_id} value={a.public_id}>{a.account_name}</option>)}</select></label>
      <label>패키지 계약<select value={contractId} disabled={general} onChange={e=>setContractId(e.target.value)} style={{width:'100%',padding:8}}>{contracts.map(c=><option key={c.public_id} value={c.public_id}>{c.contract_name} {c.erp_contract_no?`(${c.erp_contract_no})`:''}</option>)}</select></label>
      <label>시작일<input type="date" min="2018-01-01" value={from} onChange={e=>setFrom(e.target.value)} style={{width:'100%',padding:8,boxSizing:'border-box'}}/></label>
      <label>종료일<input type="date" min="2018-01-01" value={to} onChange={e=>setTo(e.target.value)} style={{width:'100%',padding:8,boxSizing:'border-box'}}/></label>
    </div>
    <label style={{display:'block',margin:'10px 0'}}><input type="checkbox" checked={general} onChange={e=>setGeneral(e.target.checked)}/> 일반 거래내역 조회</label>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={loadLedger}>패키지원장 조회</button><button onClick={excel}>엑셀 다운로드</button><button onClick={loadStatement}>거래명세서 조회</button><button onClick={pdf}>PDF 다운로드</button></div>
    {message&&<p style={{background:'#f6f8fa',padding:10}}>{message}</p>}
    {ledger&&<div style={{marginTop:18}}><h3>패키지원장 상세 거래내역</h3><p>매출 {Number(ledger.summary.salesAmount).toLocaleString()} / 수금 {Number(ledger.summary.collectionAmount).toLocaleString()} / 반품·교환 {ledger.summary.returnExchangeCount}건</p>
      <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>일자</th><th>유형</th><th>참조번호</th><th>품목</th><th>수량</th><th>금액</th><th>상태</th></tr></thead><tbody>{ledger.rows.map(r=><tr key={`${r.txn_type}-${r.public_id}`}><td>{r.txn_date??'-'}</td><td>{r.txn_type}</td><td>{r.reference_no??'-'}</td><td>{r.item_name??r.item_code??'-'}</td><td>{r.quantity??'-'}</td><td>{r.amount==null?'-':Number(r.amount).toLocaleString()}</td><td>{r.status??'-'}</td></tr>)}</tbody></table>
    </div>}
    {statement&&<div style={{marginTop:22}}><h3>월합 거래명세서 미리보기</h3><p>{statement.period.from} ~ {statement.period.to} · {statement.summary.lineCount}건 · {Number(statement.summary.totalAmount).toLocaleString()}원</p>
      {mobile&&<p style={{color:'#667085'}}>모바일에서는 교육자료 기준 전체 내역 PDF만 생성합니다.</p>}
      <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{!mobile&&<th>선택</th>}<th>매출일</th><th>ERP 매출번호</th><th>품목</th><th>수량</th><th>금액</th></tr></thead><tbody>{statement.rows.map(r=><tr key={r.public_id}>{!mobile&&<td><input type="checkbox" checked={selected.includes(r.public_id)} onChange={e=>setSelected(e.target.checked?[...selected,r.public_id]:selected.filter(x=>x!==r.public_id))}/></td>}<td>{r.sales_date}</td><td>{r.erp_sales_no}</td><td>{r.item_name??r.item_code??'-'}</td><td>{r.quantity??'-'}</td><td>{Number(r.amount).toLocaleString()}</td></tr>)}</tbody></table>
    </div>}
  </section>;
}
