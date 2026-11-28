import React from 'react';
import { Building2, Phone, ChevronRight, UserRound, CalendarDays } from 'lucide-react';
import type { CustomerRecord } from './customer-model';

export function LeadMobileCards({ rows, onOpen, statusLabel }: { rows: CustomerRecord[]; onOpen: (id: string) => void; statusLabel: (status: unknown) => string }) {
  return <div className="lead-mobile-cards" aria-label="리드 카드 목록">
    {rows.length === 0 ? <p>데이터가 없습니다.</p> : rows.map(row => {
      const phone = String(row.phone ?? row.keyman_mobile ?? '').trim();
      const safePhone = /^[+\d\s().-]+$/.test(phone) ? phone : '';
      return <article className="lead-mobile-card" key={row.public_id}>
        <span className="lead-card-icon" aria-hidden="true"><Building2 size={22}/></span><button type="button" className="lead-mobile-card-title" data-lead-id={row.public_id} onClick={() => onOpen(row.public_id)}>{String(row.hospital_name ?? '—')}</button>
        <span className="lead-mobile-status">{statusLabel(row.status)}</span>
        <dl><div><dt><UserRound size={14} aria-hidden="true"/> 이름</dt><dd>{String(row.keyman_name || '—')}</dd></div><div><dt><UserRound size={14} aria-hidden="true"/> 담당자</dt><dd>{String(row.owner_name ?? '—')}</dd></div><div><dt><CalendarDays size={14} aria-hidden="true"/> 최근 활동</dt><dd>{String(row.last_activity_date ?? '—')}</dd></div></dl>
        <div className="lead-mobile-card-actions"><button type="button" onClick={() => onOpen(row.public_id)}><ChevronRight size={16} aria-hidden="true"/> 상세 보기</button>{safePhone && <><a href={`tel:${safePhone}`} aria-label={`${String(row.hospital_name ?? '리드')} 전화`}><Phone size={16} aria-hidden="true"/> 전화</a></>}</div>
      </article>;
    })}
  </div>;
}
