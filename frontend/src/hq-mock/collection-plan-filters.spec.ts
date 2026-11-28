import {describe,it,expect} from 'vitest';
import {filterCollectionPlans} from './collection-plan-filters';
const rows=[{public_id:'b',contract_name:'Alpha',planned_date:'2026-11-20',correction_required_yn:false},{public_id:'a',contract_name:'Beta',planned_date:'2026-11-10',correction_required_yn:true}];
describe('수금계획 목록 조회 조건',()=>{
 it('계약 검색·보정·포함 날짜 범위를 조합한다',()=>{expect(filterCollectionPlans(rows,{search:'be',corrections:true,from:'2026-11-10',to:'2026-11-10',sort:'date-asc'}).map(x=>x.public_id)).toEqual(['a']);});
 it('원본 배열을 바꾸지 않고 예정일 정렬한다',()=>{expect(filterCollectionPlans(rows,{search:'',corrections:false,from:'',to:'',sort:'date-asc'}).map(x=>x.public_id)).toEqual(['a','b']);expect(rows[0].public_id).toBe('b');});
 it('날짜 역전은 결과를 만들지 않는다',()=>{expect(filterCollectionPlans(rows,{search:'',corrections:false,from:'2026-11-30',to:'2026-11-01',sort:'date-desc'})).toEqual([]);});
});
