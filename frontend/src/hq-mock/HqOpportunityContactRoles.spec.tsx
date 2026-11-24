import React from 'react';
import {it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const state=vi.hoisted(()=>({error:null as Error|null}));
vi.mock('./HqMockProvider',()=>({useHqMock:()=>({session:{user:{userId:1}}})}));
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({}),useQuery:()=>({data:{items:[{public_id:'role',version:1,contactPublicId:'contact',contactName:'CODEX 담당자',role:'구매 담당자',isPrimary:true,contactAvailable:true}],contacts:[],roles:[]},isPending:false,error:state.error})}));
import {HqOpportunityContactRoles} from './HqOpportunityContactRoles';
it('read-only viewer sees roles but no create/edit/delete buttons',()=>{const html=renderToStaticMarkup(<HqOpportunityContactRoles opportunityId="o" canEdit={false}/>);expect(html).toContain('구매 담당자');expect(html).toContain('기본 연락처');expect(html).not.toContain('>연락처 역할 등록</button>');expect(html).not.toContain('>연락처 역할 삭제</button>');});
it('permission refresh error hides cached name',()=>{state.error=new Error('403');const html=renderToStaticMarkup(<HqOpportunityContactRoles opportunityId="o" canEdit={false}/>);expect(html).not.toContain('CODEX 담당자');state.error=null;});
