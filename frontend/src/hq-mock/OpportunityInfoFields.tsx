import React from 'react';
import {configAnchor} from './config-anchor';

export const emptyOpportunityInfo = {
  interestProduct:'', description:'', ownedEquipment:'', competitorUsage:'', treatmentFeeInfo:'',
  specialTerms:'', stockStatus:'', paymentStatus:'', paymentDate:'', paymentMethod:'', installmentMonths:0
};
export type OpportunityInfo = typeof emptyOpportunityInfo;
export const opportunityPaymentMethods = ['역구매','현금 일시불','현금할부','카드 일시불(카드사 할부)','매월카드결제(카드할부)','기타','매입상계'];

export function OpportunityInfoFields({value,onChange,disabled,scope,recordType}:{value:OpportunityInfo;onChange:(value:OpportunityInfo)=>void;disabled:boolean;scope:'create'|'detail';recordType?:string}){
  const change = (key:keyof OpportunityInfo,next:string|number) => onChange({...value,[key]:next});
  return <>
    {([
      ['interestProduct','관심 제품',500],['description','설명',4000],['ownedEquipment','보유 장비 정보',2000],
      ['competitorUsage','타사 사용현황',2000],['treatmentFeeInfo','수가 정보',2000],['specialTerms','특약사항',4000]
    ] as const).map(([key,label,max])=><label key={key} {...configAnchor(`opportunity.${key}`,`${scope}.${key}`)}>{label}<textarea disabled={disabled} rows={3} maxLength={max} value={value[key]} onChange={event=>change(key,event.target.value)}/></label>)}
    {recordType === 'RECONTRACT' && ([['stockStatus','재고 상황'],['paymentStatus','결제 상황']] as const).map(([key,label])=><label key={key} {...configAnchor(`opportunity.${key}`,`${scope}.${key}`)}>{label}<textarea disabled={disabled} rows={3} maxLength={2000} value={value[key]} onChange={event=>change(key,event.target.value)}/></label>)}
    <label {...configAnchor('opportunity.paymentDate',`${scope}.paymentDate`)}>결제 일자<input disabled={disabled} type="date" value={value.paymentDate} onChange={event=>change('paymentDate',event.target.value)}/></label>
    <label {...configAnchor('opportunity.paymentMethod',`${scope}.paymentMethod`)}>결제 수단<select disabled={disabled} value={value.paymentMethod} onChange={event=>change('paymentMethod',event.target.value)}>
      <option value="">선택 안 함</option>
      {value.paymentMethod&&!opportunityPaymentMethods.includes(value.paymentMethod)&&<option value={value.paymentMethod}>{value.paymentMethod} (기존 값)</option>}
      {opportunityPaymentMethods.map(method=><option value={method} key={method}>{method}</option>)}
    </select></label>
    <label {...configAnchor('opportunity.installmentMonths',`${scope}.installmentMonths`)}>할부 개월수<input disabled={disabled} type="number" min={0} max={120} step={1} value={value.installmentMonths} onChange={event=>change('installmentMonths',Number(event.target.value))}/></label>
  </>;
}
