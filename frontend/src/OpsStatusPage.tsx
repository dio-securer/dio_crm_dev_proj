import React, { useEffect, useState } from 'react';
import { apiGet } from './api';

type OpsStatus = {
  service: { version:string; uptimeSec:number; nodeEnv:string };
  database: { connected:boolean; connecting:boolean; healthy:boolean; poolMax:number; requestTimeoutMs:number };
  interface: { failed24h:number; stuckRequesting:number; success24h:number; circuits:Record<string,{failures:number;open:boolean;openedAt:number|null}> };
  audit24h:number;
  memory:{rssMb:number;heapUsedMb:number;heapTotalMb:number};
  at:string;
};

export function OpsStatusPage() {
  const [data, setData] = useState<OpsStatus | null>(null);
  const [error, setError] = useState('');
  const load = () => apiGet<OpsStatus>('/api/ops/status').then(setData).catch(e => setError(String(e)));
  useEffect(() => { load(); }, []);
  return <section>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div><h2>운영상태</h2><p style={{color:'#667085'}}>DB / Interface / Runtime 상태를 운영자가 확인합니다.</p></div>
      <button onClick={load}>새로고침</button>
    </div>
    {error && <p style={{color:'#b42318'}}>{error}</p>}
    {data && <>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:12}}>
        <Card title="Database" value={data.database.healthy ? 'UP' : 'DEGRADED'} detail={`pool max ${data.database.poolMax}`} />
        <Card title="ERP 실패 24h" value={data.interface.failed24h} detail={`stuck ${data.interface.stuckRequesting}`} />
        <Card title="ERP 성공 24h" value={data.interface.success24h} detail="Interface Log" />
        <Card title="Memory RSS" value={`${data.memory.rssMb} MB`} detail={`heap ${data.memory.heapUsedMb}/${data.memory.heapTotalMb} MB`} />
      </div>
      <h3 style={{marginTop:24}}>Circuit Breaker</h3>
      <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>Interface</th><th>Open</th><th>Failures</th></tr></thead><tbody>
        {Object.entries(data.interface.circuits).map(([name,c]) => <tr key={name}><td>{name}</td><td>{c.open ? 'OPEN' : 'CLOSED'}</td><td>{c.failures}</td></tr>)}
      </tbody></table>
      <p style={{color:'#667085',marginTop:16}}>version {data.service.version} · uptime {data.service.uptimeSec}s · audit 24h {data.audit24h} · {data.at}</p>
    </>}
  </section>;
}

function Card({title,value,detail}:{title:string;value:string|number;detail:string}) {
  return <div style={{border:'1px solid #d0d5dd',borderRadius:10,padding:14}}><div style={{color:'#667085',fontSize:12}}>{title}</div><div style={{fontSize:24,fontWeight:700,margin:'6px 0'}}>{value}</div><div style={{fontSize:12}}>{detail}</div></div>;
}
