import React from 'react';
import {it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const state=vi.hoisted(()=>({error:null as Error|null}));
vi.mock('./HqMockProvider',()=>({useHqMock:()=>({session:{user:{userId:1}}})}));
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({}),useQuery:()=>({data:{items:[{public_id:'note',version:1,title:'CODEX note',body:'<script>alert(1)</script>',createdByName:'테스트',modifiedByName:'테스트',updated_at:'2026-11-10'}]},isPending:false,error:state.error})}));
import {HqOpportunityNotes} from './HqOpportunityNotes';
it('plain text is escaped and readonly viewer has no write actions',()=>{const html=renderToStaticMarkup(<HqOpportunityNotes opportunityId="o" canEdit={false}/>);expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');expect(html).not.toContain('>노트 등록</button>');expect(html).not.toContain('>노트 삭제</button>');expect(html).toContain('>노트 보기</button>');});
it('permission refresh error hides cached note content',()=>{state.error=new Error('403');const html=renderToStaticMarkup(<HqOpportunityNotes opportunityId="o" canEdit={false}/>);expect(html).not.toContain('CODEX note');expect(html).not.toContain('alert(1)');state.error=null;});
