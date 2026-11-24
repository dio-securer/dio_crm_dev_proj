import React from 'react';
import { CalendarClock } from 'lucide-react';
import { WorkspaceHeading } from './WorkspaceHeading';
import {useGlobalization} from '../market/globalization-context';
import {formatCurrency} from '../formatting/currency';
import {HqCollectionPlanList} from './HqCollectionPlanList';
import './hq-sales.css';
export function HqCollectionPlansPage(){
 const {globalization}=useGlobalization();
 return <main className="hq-sales-page hq-collection-page"><header><WorkspaceHeading icon={CalendarClock}>수금계획</WorkspaceHeading><p>계약별 현재 유효한 수금 회차를 조회하고 계약 상세에서 계획을 변경합니다. MOCK · 실제 금융 시스템에 연결하지 않습니다.</p></header><HqCollectionPlanList money={(amount,currency)=>formatCurrency(amount,globalization.locale,currency||'KRW')}/></main>;
}
