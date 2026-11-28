import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect} from 'vitest';
import {ContractPlanCards} from './ContractPlanCards';
it('수금 회차와 금액을 읽기 쉬운 카드로 표시한다',()=>{let html=renderToStaticMarkup(<ContractPlanCards rows={[{public_id:'a',installment_no:2,amount:500000,currency:'KRW',planned_date:'2026-11-11',collection_method:'BANK_TRANSFER',erp_sync_status:'NOT_REQUESTED'}]} amountLabel={(n)=>`${n}원`}/>);expect(html).toContain('2회차');expect(html).toContain('500000원');expect(html).toContain('2026-11-11');});
