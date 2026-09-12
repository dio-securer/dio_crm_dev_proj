import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPatch, apiPost } from './api';

type Opportunity = {
  public_id: string; opportunity_name: string; stage: string; record_type: string; amount: number;
  expected_close_date?: string | null; success_probability?: number | null; forecast_category?: string | null;
  account_name: string; account_public_id: string; erp_approved_yn: boolean; contract_created_yn: boolean;
};
type Account = { public_id: string; account_name: string };
type Catalog = { public_id: string; item_type: string; item_name: string; base_price: number };

const stages = ['NEEDS_ANALYSIS','PROPOSAL','NEGOTIATION','CLOSED_WON','CLOSED_LOST'];
const stageName: Record<string,string> = { NEEDS_ANALYSIS:'니즈파악', PROPOSAL:'제안', NEGOTIATION:'협상', CLOSED_WON:'수주성공', CLOSED_LOST:'수주실패' };

export function OpportunitiesPage() {
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [catalog, setCatalog] = useState<Catalog[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [accountPublicId, setAccountPublicId] = useState('');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [productId, setProductId] = useState('');
  const [price, setPrice] = useState('0');
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const [o, a, c] = await Promise.all([
        apiGet<Opportunity[]>('/api/opportunities'), apiGet<Account[]>('/api/accounts'), apiGet<Catalog[]>('/api/product-packages')
      ]);
      setRows(o); setAccounts(a); setCatalog(c);
      if (!accountPublicId && a[0]) setAccountPublicId(a[0].public_id);
      if (!selected && o[0]) setSelected(o[0].public_id);
      if (!productId && c[0]) { setProductId(c[0].public_id); setPrice(String(c[0].base_price ?? 0)); }
    } catch (e) { setMessage(String(e)); }
  };
  useEffect(() => { void load(); }, []);

  const current = useMemo(() => rows.find(x => x.public_id === selected), [rows, selected]);

  const create = async () => {
    if (!accountPublicId || !name.trim()) return setMessage('Account와 기회명을 입력하세요.');
    try { await apiPost('/api/opportunities', { accountPublicId, opportunityName: name, recordType: 'EXISTING' }); setName(''); setMessage('Opportunity 생성 완료'); await load(); }
    catch (e) { setMessage(String(e)); }
  };
  const move = async (toStage: string) => {
    if (!selected) return;
    try { await apiPost(`/api/opportunities/${selected}/stage`, { toStage, reason: reason || undefined }); setReason(''); setMessage(`${stageName[toStage]} 단계 변경 완료`); await load(); }
    catch (e) { setMessage(String(e)); }
  };
  const addProduct = async () => {
    if (!selected || !productId) return;
    try { await apiPost(`/api/opportunities/${selected}/products`, { packagePublicId: productId, quantity: 1, proposedUnitPrice: Number(price) || 0 }); setMessage('제안 패키지/제품 반영 완료'); await load(); }
    catch (e) { setMessage(String(e)); }
  };
  const saveNegotiation = async () => {
    if (!selected) return;
    try { await apiPatch(`/api/opportunities/${selected}`, { forecastCategory: 'PIPELINE', successProbability: current?.stage === 'NEGOTIATION' ? 70 : 30 }); setMessage('협상/Forecast 정보 저장 완료'); await load(); }
    catch (e) { setMessage(String(e)); }
  };

  return <section>
    <h2>Opportunity / Sales Pipeline</h2>
    <p style={{color:'#667085'}}>니즈파악 → 제안 → 협상 → 수주성공/실패. Closed Won은 ERP 승인 Account만 허용됩니다.</p>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:18}}>
      <div style={{border:'1px solid #dde3ea',padding:14,borderRadius:10}}>
        <h3>신규 Opportunity</h3>
        <select value={accountPublicId} onChange={e=>setAccountPublicId(e.target.value)} style={{width:'100%',padding:8,marginBottom:8}}>{accounts.map(a=><option key={a.public_id} value={a.public_id}>{a.account_name}</option>)}</select>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Opportunity 명" style={{width:'100%',boxSizing:'border-box',padding:8,marginBottom:8}}/>
        <button onClick={create}>생성</button>
      </div>
      <div style={{border:'1px solid #dde3ea',padding:14,borderRadius:10}}>
        <h3>선택 Opportunity 작업</h3>
        <div>{current ? `${current.opportunity_name} / ${stageName[current.stage]} / ${Number(current.amount||0).toLocaleString()}원` : '선택 없음'}</div>
        <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="역전이/재오픈 사유" style={{width:'100%',boxSizing:'border-box',padding:8,margin:'8px 0'}}/>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{stages.map(s=><button key={s} onClick={()=>move(s)}>{stageName[s]}</button>)}</div>
        <button onClick={saveNegotiation} style={{marginTop:8}}>협상/Forecast 샘플값 저장</button>
      </div>
    </div>
    <div style={{border:'1px solid #dde3ea',padding:14,borderRadius:10,marginBottom:18}}>
      <h3>제안 패키지/제품</h3>
      <select value={productId} onChange={e=>{setProductId(e.target.value); const x=catalog.find(c=>c.public_id===e.target.value); if(x) setPrice(String(x.base_price||0));}}>{catalog.map(c=><option key={c.public_id} value={c.public_id}>{c.item_type} · {c.item_name}</option>)}</select>
      <input type="number" value={price} onChange={e=>setPrice(e.target.value)} style={{marginLeft:8,width:140}}/>
      <button onClick={addProduct} style={{marginLeft:8}}>제안에 추가</button>
    </div>
    {message && <div style={{padding:10,background:'#f6f8fa',marginBottom:12}}>{message}</div>}
    <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>Opportunity</th><th>Account</th><th>단계</th><th>금액</th><th>ERP승인</th><th>예상마감</th></tr></thead><tbody>
      {rows.map(r=><tr key={r.public_id} onClick={()=>setSelected(r.public_id)} style={{cursor:'pointer',background:selected===r.public_id?'#eef4fb':'transparent'}}>
        <td style={{padding:8,borderBottom:'1px solid #eee'}}>{r.opportunity_name}</td><td>{r.account_name}</td><td>{stageName[r.stage]??r.stage}</td><td>{Number(r.amount||0).toLocaleString()}</td><td>{r.erp_approved_yn?'Y':'N'}</td><td>{r.expected_close_date??'-'}</td>
      </tr>)}
    </tbody></table>
  </section>;
}
