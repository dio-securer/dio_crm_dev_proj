import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from './api';

type Opportunity = { public_id:string; opportunity_name:string; stage:string; amount:number; account_name:string; erp_approved_yn:boolean; contract_created_yn:boolean };
type Contract = { public_id:string; contract_name:string; contract_amount:number; status:string; integration_status:string; erp_contract_no?:string|null; account_name:string; opportunity_name:string };
type Reconciliation = { contractAmount:number; currentPlanTotal:number; actualTotal:number; overduePlanTotal:number; outstandingAmount:number; correctionRequired:boolean };

export function ContractsPage() {
  const [contracts,setContracts]=useState<Contract[]>([]);
  const [opportunities,setOpportunities]=useState<Opportunity[]>([]);
  const [selected,setSelected]=useState('');
  const [oppId,setOppId]=useState('');
  const [productAmount,setProductAmount]=useState('0');
  const [goodsAmount,setGoodsAmount]=useState('0');
  const [planDate,setPlanDate]=useState('');
  const [recon,setRecon]=useState<Reconciliation|null>(null);
  const [message,setMessage]=useState('');

  const load=async()=>{
    try{
      const [c,o]=await Promise.all([apiGet<Contract[]>('/api/contracts'),apiGet<Opportunity[]>('/api/opportunities')]);
      setContracts(c); setOpportunities(o.filter(x=>x.stage==='CLOSED_WON'&&!x.contract_created_yn));
      if(!selected&&c[0]) setSelected(c[0].public_id);
      if(!oppId){ const first=o.find(x=>x.stage==='CLOSED_WON'&&!x.contract_created_yn); if(first){setOppId(first.public_id);setProductAmount(String(first.amount||0));setGoodsAmount('0');} }
    }catch(e){setMessage(String(e));}
  };
  useEffect(()=>{void load();},[]);
  const current=useMemo(()=>contracts.find(x=>x.public_id===selected),[contracts,selected]);

  const create=async()=>{
    if(!oppId) return setMessage('Closed Won Opportunity를 선택하세요.');
    try{await apiPost('/api/contracts',{opportunityPublicId:oppId,productAmount:Number(productAmount)||0,goodsAmount:Number(goodsAmount)||0});setMessage('Contract 생성 완료');await load();}
    catch(e){setMessage(String(e));}
  };
  const savePlan=async()=>{
    if(!current||!planDate) return setMessage('Contract와 수금예정일을 선택하세요.');
    try{await apiPost(`/api/contracts/${current.public_id}/collection-plans`,{rows:[{installmentNo:1,collectionMethod:'BANK_TRANSFER',amount:Number(current.contract_amount),plannedDate:planDate}]});setMessage('최초 수금계획 저장 완료');}
    catch(e){setMessage(String(e));}
  };
  const requestErp=async()=>{
    if(!current) return;
    try{const r=await apiPost<{requestId:string}>(`/api/contracts/${current.public_id}/erp-request`);setMessage(`ERP 계약요청 Queue 생성: ${r.requestId}`);await load();}
    catch(e){setMessage(String(e));}
  };
  const loadRecon=async()=>{
    if(!current) return;
    try{setRecon(await apiGet<Reconciliation>(`/api/contracts/${current.public_id}/reconciliation`));}
    catch(e){setMessage(String(e));}
  };

  return <section>
    <h2>Contract / Collection</h2>
    <p style={{color:'#667085'}}>Closed Won + ERP 승인 Account만 계약 생성 가능. 최초 수금계획 합계는 계약금액과 일치해야 하며 ERP 승인 후 최초계획은 잠깁니다.</p>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:18}}>
      <div style={{border:'1px solid #dde3ea',padding:14,borderRadius:10}}>
        <h3>Contract 생성</h3>
        <select value={oppId} onChange={e=>{setOppId(e.target.value);const x=opportunities.find(o=>o.public_id===e.target.value);if(x){setProductAmount(String(x.amount));setGoodsAmount('0');}}} style={{width:'100%',padding:8}}>
          {opportunities.map(o=><option key={o.public_id} value={o.public_id}>{o.account_name} · {o.opportunity_name} · {Number(o.amount).toLocaleString()}</option>)}
        </select>
        <div style={{display:'flex',gap:8,marginTop:8}}><input type="number" value={productAmount} onChange={e=>setProductAmount(e.target.value)} placeholder="제품금액"/><input type="number" value={goodsAmount} onChange={e=>setGoodsAmount(e.target.value)} placeholder="상품금액"/></div>
        <button onClick={create} style={{marginTop:8}}>Contract 생성</button>
      </div>
      <div style={{border:'1px solid #dde3ea',padding:14,borderRadius:10}}>
        <h3>선택 Contract</h3>
        <div>{current ? `${current.contract_name} / ${current.status} / ${Number(current.contract_amount).toLocaleString()}원` : '선택 없음'}</div>
        <input type="date" value={planDate} onChange={e=>setPlanDate(e.target.value)} style={{margin:'8px 8px 8px 0'}}/><button onClick={savePlan}>1회 최초 수금계획</button>
        <div style={{marginTop:8,display:'flex',gap:8}}><button onClick={requestErp}>ERP 계약 등록요청</button><button onClick={loadRecon}>수금대사</button></div>
      </div>
    </div>
    {recon&&<div style={{padding:12,background:'#f6f8fa',borderRadius:8,marginBottom:12}}>계약 {recon.contractAmount.toLocaleString()} / 실수금 {recon.actualTotal.toLocaleString()} / 미수 {recon.outstandingAmount.toLocaleString()} / 수정필요 {recon.correctionRequired?'Y':'N'}</div>}
    {message&&<div style={{padding:10,background:'#fff7ed',marginBottom:12}}>{message}</div>}
    <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>Contract</th><th>Account</th><th>Opportunity</th><th>금액</th><th>상태</th><th>ERP 계약번호</th></tr></thead><tbody>
      {contracts.map(c=><tr key={c.public_id} onClick={()=>setSelected(c.public_id)} style={{cursor:'pointer',background:selected===c.public_id?'#eef4fb':'transparent'}}><td style={{padding:8,borderBottom:'1px solid #eee'}}>{c.contract_name}</td><td>{c.account_name}</td><td>{c.opportunity_name}</td><td>{Number(c.contract_amount).toLocaleString()}</td><td>{c.status}</td><td>{c.erp_contract_no??'-'}</td></tr>)}
    </tbody></table>
  </section>;
}
