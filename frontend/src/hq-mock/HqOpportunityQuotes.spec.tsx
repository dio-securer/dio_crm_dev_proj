import React from 'react';
import {it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const queryState=vi.hoisted(()=>({error:null as Error|null,syncing:false,permissions:[] as string[]}));
vi.mock('./HqMockProvider',()=>({useHqMock:()=>({session:{user:{userId:1,permissions:queryState.permissions}}})}));
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({}),useQuery:()=>({data:{items:[{public_id:'q1',version:1,name:'CODEX quote',syncing:queryState.syncing,total:305000,subtotal:300000,tax:3000,shipping:2000,currency:'KRW',lines:[]}]},isPending:false,error:queryState.error})}));
import {HqOpportunityQuotes} from './HqOpportunityQuotes';
it('quote exposes observed total and explicit unimplemented actions without offering forbidden writes',()=>{
 const html=renderToStaticMarkup(<HqOpportunityQuotes opportunityId="op1" opportunityVersion={1} canEdit={false}/>);
 expect(html).toContain('305,000 KRW');expect(html).toContain('초안');expect(html).toContain('동기화 안 함');expect(html).not.toContain('>견적 등록</button>');expect(html).not.toContain('>견적 삭제</button>');expect(html).toContain('PDF');
});

it('failed permission refresh hides previously cached quote values',()=>{queryState.error=new Error('403');const html=renderToStaticMarkup(<HqOpportunityQuotes opportunityId="op1" opportunityVersion={1} canEdit={false}/>);expect(html).not.toContain('CODEX quote');expect(html).not.toContain('305,000 KRW');queryState.error=null;});

it('sync control reflects state and product permission without enabling active quote deletion',()=>{queryState.permissions=['OPPORTUNITY.PRODUCT.WRITE'];queryState.syncing=true;const html=renderToStaticMarkup(<HqOpportunityQuotes opportunityId="op1" opportunityVersion={1} canEdit={true}/>);expect(html).toContain('동기화 중지');expect(html).toContain('견적 제품 추가');expect(html).toMatch(/disabled="">견적 삭제/);queryState.syncing=false;queryState.permissions=[];const noProduct=renderToStaticMarkup(<HqOpportunityQuotes opportunityId="op1" opportunityVersion={1} canEdit={true}/>);expect(noProduct).not.toContain('>동기화 시작</button>');expect(noProduct).not.toContain('>견적 제품 추가</button>');});
