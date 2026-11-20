import React from 'react';
import {it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
vi.mock('./HqMockProvider',()=>({useHqMock:()=>({session:{user:{userId:1}}})}));
vi.mock('@tanstack/react-query',()=>({useQuery:()=>({data:[{public_id:'p1',contract_public_id:'c1',contract_name:'테스트 계약',installment_no:1,planned_date:'2026-11-10',collection_method:'BANK_TRANSFER',amount:undefined,correction_required_yn:false,erp_sync_status:'SUCCESS'}],isPending:false})}));
import {HqCollectionPlanList} from './HqCollectionPlanList';
it('수금 금액 권한 누락은 0으로 만들지 않으며 반응형 카드도 같은 계약으로 연결한다',()=>{
 const html=renderToStaticMarkup(<MemoryRouter><HqCollectionPlanList money={n=>`${n}원`}/></MemoryRouter>);
 expect(html).toContain('확인 불가');expect(html).not.toContain('0원');expect(html).toContain('hq-plan-cards');expect(html).toContain('/contracts?record=c1');expect(html).toContain('예정일 시작');
});
