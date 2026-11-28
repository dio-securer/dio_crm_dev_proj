import React from 'react';
import {collectionMethods} from './contract-methods';
export function ContractCollectionMethod({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  return <select value={value} required onChange={event=>onChange(event.target.value)}>
    <option value="">선택</option>
    {value && !collectionMethods.some(method=>method===value) && <option value={value}>{value} (기존 값)</option>}
    {collectionMethods.map(method=><option key={method} value={method}>{method}</option>)}
  </select>;
}
