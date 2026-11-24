import {expect,it} from 'vitest';
import {filterReports} from './report-filters';
it('filters only supplied scoped reports by date, status, organization and reporter',()=>{
 const rows=[{report_date:'2026-12-01',status:'DRAFT',organization_id:10,owner_user_id:1},{report_date:'2026-12-02',status:'REQUESTED',organization_id:10,owner_user_id:2},{report_date:'2026-12-03',status:'REQUESTED',organization_id:20,owner_user_id:3}];
 expect(filterReports(rows,{from:'2026-12-01',to:'2026-12-03',status:'REQUESTED',organization:'10',owner:'2'})).toEqual([rows[1]]);
 expect(filterReports(rows,{from:'2026-12-03',to:'2026-12-01',status:'',organization:'',owner:''})).toEqual([]);
 expect(rows[0].status).toBe('DRAFT');
});
