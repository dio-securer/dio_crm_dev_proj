import { readFile, writeFile } from 'node:fs/promises';
const f='docs/crm-activity/full-walkthrough-20261108/activity/steps.json';
const rows=JSON.parse(await readFile(f,'utf8'));
for(const row of rows) if(row.title==='중복 IN/OUT 방지' && row.status==='BLOCKED') {
  row.title='다중 기기·동시 API 요청 경합';
  row.expected='여러 기기 또는 동시 API 요청에서 중복 IN/OUT이 안전하게 처리되는지 확인한다.';
  row.actual='다중 기기 및 동시 API 요청을 실행하지 않았다.';
  row.note='일반 사용자 화면의 진행 중 중복 IN 버튼 숨김은 세 화면 폭에서 통과했고, PC의 IN 요청 대기 중 중복 버튼과 복귀 잠금도 통과했다. 다중 기기·동시 API 경합은 미검증이다.';
}
await writeFile(f,JSON.stringify(rows,null,2));
console.log(rows.filter(row=>row.title==='다중 기기·동시 API 요청 경합').length);
