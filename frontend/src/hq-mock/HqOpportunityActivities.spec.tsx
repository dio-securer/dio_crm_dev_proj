import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({permissions:['ACTIVITY.READ','ACTIVITY.WRITE'],query:{} as Record<string,unknown>}));
vi.mock('./HqMockProvider',()=>({useHqMock:()=>({session:{user:{userId:1,permissions:state.permissions}}})}));
vi.mock('@tanstack/react-query',()=>({useQuery:()=>state.query,useQueryClient:()=>({invalidateQueries:vi.fn()})}));
import {HqOpportunityActivities} from './HqOpportunityActivities';
const show=(canEdit=true)=>renderToStaticMarkup(<HqOpportunityActivities opportunityId="test" canEdit={canEdit} onDirtyChange={()=>{}}/>);
describe('opportunity activities disclosure and lifecycle actions',()=>{
 beforeEach(()=>{state.permissions=['ACTIVITY.READ','ACTIVITY.WRITE'];state.query={data:{items:[],owners:[]},isPending:false,isError:false};});
 it('offers three lifecycle entry points only to writers',()=>{const html=show();expect(html).toContain('새 과업');expect(html).toContain('새 통화');expect(html).toContain('새 이벤트');expect(show(false)).not.toContain('새 과업');});
 it('does not disclose cached activities after permissions are removed',()=>{state.permissions=[];state.query={data:{items:[{kind:'TASK',subject:'sensitive task'}]}};const html=show();expect(html).toContain('활동 조회 권한이 없습니다');expect(html).not.toContain('sensitive task');expect(html).not.toContain('새 과업');});
 it('does not show stale cached rows or empty success on failed reload',()=>{state.query={isError:true,data:{items:[{subject:'stale task'}]}};const html=show();expect(html).toContain('활동을 불러오지 못했습니다');expect(html).not.toContain('stale task');expect(html).not.toContain('표시할 활동이 없습니다');});
 it('renders owner/status/priority with appropriate edit and delete actions',()=>{state.query={data:{items:[{public_id:'a',kind:'TASK',subject:'합성 과업',ownerName:'테스트 담당자',status:'PLANNED',priority:'HIGH',dueDate:'2026-12-20',note:'검증'}]}};const html=show();expect(html).toContain('테스트 담당자');expect(html).toContain('우선순위 높음');expect(html).toContain('과업 수정');expect(html).toContain('과업 삭제');});
});
