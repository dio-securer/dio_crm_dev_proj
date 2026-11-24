import { expect, it } from 'vitest';
import { opportunityTimeline } from './opportunity-timeline';
it('orders activity timestamps and follow-up deadlines chronologically without mutating originals',()=>{
 const activities=[{public_id:'a',planned_at:'2026-12-03T09:00:00+09:00',visit_purpose:'방문'}];
 const followUps=[{public_id:'f',due_date:'2026-12-01',title:'제안서 전달'}];
 const result=opportunityTimeline(activities,followUps);
 expect(result.map(x=>x.id)).toEqual(['f','a']);expect(result.map(x=>x.kind)).toEqual(['followUp','activity']);
 expect(activities).toHaveLength(1);expect(followUps).toHaveLength(1);
});
