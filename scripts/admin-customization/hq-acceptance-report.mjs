import fs from 'node:fs';import {createHash} from 'node:crypto';
const dir='docs/admin-platform/customization',root=dir+'/implementation/evidence';
const matrix=JSON.parse(fs.readFileSync(root+'/I09/worker-b-hq-acceptance-matrix.json','utf8'));
const inventory=JSON.parse(fs.readFileSync(root+'/I02/hq-migration-inventory.json','utf8'));
const artifact=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-codes-review.json','utf8'));
const labels=Object.fromEntries(artifact.catalog.entries.map(e=>[e.id,artifact.translations['ko-KR'][e.labelKey]??e.id]));
const evidenceNames=['I03/platform-admin-ui-browser.json','I03/common-code-admin-ui-browser.json','I03/admin-ui-browser.json','I02/lead-ui-browser.json','I04/records-ui-browser.json','I05/workflow-ui-browser.json','I08/inspection-ui-browser.json','I07/activity-ui-browser.json','I07/approval-ui-browser.json','I08/reports-ui-browser.json','I02/navigation-ui-browser.json','I08/paging-ui-browser.json'];
const evidence=evidenceNames.filter(file=>fs.existsSync(root+'/'+file)).map(file=>{const bytes=fs.readFileSync(root+'/'+file),data=JSON.parse(bytes);return {file,status:data.status,checks:data.checks??[],scope:data.scope,sha256:createHash('sha256').update(bytes).digest('hex')};});
const additions=[
 ['ADM.users.save','사용자·조직 변경','공개 UUID·rowversion·현재 권한, identity 선행 잠금, 활성 의존성과 후속 승인자 보호','platform-admin.spec.ts / platform-admin-ui-browser.json'],
 ['ADM.codes.save','법인별 공통코드 편집','공통 원본 보존·법인 override, 다국어 및 metadata 보존, 버전 충돌과 재시도','common-code-admin.spec.ts / common-code-admin-ui-browser.json'],
 ['LEAD.create','리드 등록','법인·현재 담당자·입력/기본값 검증, 동일 요청 재시도','lead-lifecycle.spec.ts / lead-ui-browser.json'],
 ['LEAD.delete','리드 삭제','신규 상태·연결 활동 검사, 조회 버전 일치, 확인/취소 팝업','lead-lifecycle.spec.ts / lead-ui-browser.json'],
 ['REP.commentBranch','보고서 지점·본부 의견/반려','지정 승인자, 저장 의견, 반려 후 수정·재상신, 승인 회차와 변경 버전','activity-report-gateway.spec.ts / approval-ui-browser.json'],
 ['CONTACT.create','연락처 HQ 생성 경로','부모 거래처 권한 및 기존 생성 API와 멱등 처리 공유, 실제 HTTP 객체 헤더 보존','contact-http.spec.ts'],
 ['ops.checkedAt','운영 확인 시각','서버 UTC 검사 시각, 숨김 설정과 조회 권한 적용','platform-read-gateway.spec.ts'],
 ['ACT.planBulk','활동 일괄 계획 팝업','행별 대상 유형·참조 선택·날짜 입력, 전체 요청 재시도, 섹션 숨김 차단','activity-gateway.spec.ts / activity-ui-browser.json'],
 ['ACC.merge','거래처 병합 팝업','주 거래처 및 최대 2개 대상 선택, 기존 서버 병합 규칙, 동일 요청 재시도','account-merge.spec.ts / records-ui-browser.json']
].map(([id,title,scope,tests])=>({id,title,scope,tests,status:'IMPLEMENTED_LOCAL_VERIFICATION',acceptance:'INCOMPLETE'}));
const remaining=inventory.rows.filter(r=>r.status==='REQUIRES_MIGRATION');
const screenUpdates={
 HQ_ADMIN_USERS:'사용자·조직 이름/활성/조직 이동 편집 구현 및 독립 부분 검증 완료. 실제 SQL 동시성·기존 숫자 ID 계약 호환과 전체 관리자 인수 미완료.',
 HQ_ADMIN_CODES:'공통값 기반 법인 override 편집·ko/en 코드명 구현. override 제거/원본 복귀 및 실제 DDL019 인수 미완료.',
 HQ_LEAD:'등록·삭제 팝업 로컬 검증 완료. 기존 8개 탭, 전환 선택지, 이력·HIRA·마케팅 기능의 전체 동등성은 미완료.',
 HQ_ACCOUNT:'병합 선택·재시도 팝업 로컬 검증 완료. 병원 전용 저장·행별 일괄 수정, 중복 후보 미리보기와 기존 9개 탭은 미완료.',
 HQ_ACTIVITY:'일괄 계획 팝업 로컬 검증 완료. 기존 월별·지도 화면 및 전체 일정 조작 인수는 미완료.',
 HQ_ACTIVITY_REPORT:'의견·반려·수정·재상신 및 버전 충돌 로컬 검증 완료. futurePlan/accompaniedYn, 전체 이력·알림 표시와 실제 DB 인수는 미완료.',
 HQ_OPS:'서버 확인 시각 연결 및 필드 숨김 검증 완료. 실제 운영 데이터와 전체 섹션 권한 조합 인수는 미완료.'
};
const screens=matrix.screens.map(s=>({...s,...(screenUpdates[s.screenId]?{remaining:screenUpdates[s.screenId],status:'PARTIAL_ONLY',...(s.screenId==='HQ_ADMIN_CODES'?{managedSource:'frontend/src/customization/platform-admin-specs.ts',existingSyntheticEvidence:'common-code-admin-ui-browser.json'}:{})}:{})}));
const popups=matrix.popups.map(p=>p.id==='POP.LEAD.CREATE'?{...p,status:'IMPLEMENTED_LOCAL_VERIFICATION',remaining:'생성·권한·기본값·재시도 검증 완료. 전체 접근성·법인/언어 조합 및 실제 DB 인수는 미완료.'}:p.id==='POP.ACC.MERGE'?{...p,status:'IMPLEMENTED_LOCAL_VERIFICATION',remaining:'선택 개수 제한·동일 요청 재시도 독립 검증 완료. 중복 후보 미리보기 및 실제 DB 인수는 미완료.'}:p);
const reviews=['I02/worker-b-hq-platform-admin.json','I02/worker-b-hq-common-code-admin.json','I02/worker-b-hq-lead-lifecycle.json','I02/worker-b-hq-report-review.json','I02/worker-b-hq-alias-version.json','I07/worker-b-activity-bulk.json','I04/worker-b-account-merge-ui.json'].filter(file=>fs.existsSync(root+'/'+file)).map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(root+'/'+file)).digest('hex')}));
for(const [id,screenId,action] of [
 ['POP.ADMIN.USER','HQ_ADMIN_USERS','ADM.users.save'],
 ['POP.ADMIN.ORGANIZATION','HQ_ADMIN_USERS','ADM.organizations.save'],
 ['POP.ADMIN.CODE','HQ_ADMIN_CODES','ADM.codes.save'],
 ['POP.LEAD.DELETE','HQ_LEAD','LEAD.delete'],
 ['POP.REPORT.COMMENT_BRANCH','HQ_ACTIVITY_REPORT','REP.commentBranch'],
 ['POP.REPORT.COMMENT_DIVISION','HQ_ACTIVITY_REPORT','REP.commentDivision'],
 ['POP.REPORT.REJECT_BRANCH','HQ_ACTIVITY_REPORT','REP.rejectBranch'],
 ['POP.REPORT.REJECT_DIVISION','HQ_ACTIVITY_REPORT','REP.rejectDivision'],
 ['POP.ACTIVITY.BULK_PLAN','HQ_ACTIVITY','ACT.planBulk']
]) popups.push({id,screenId,actions:[action],status:'IMPLEMENTED_LOCAL_VERIFICATION',acceptance:'NOT_ACCEPTED',remaining:'현재 합성 검증 근거를 위 표에서 확인. 전체 접근성·법인/언어 조합과 실제 DB 인수는 미완료.'});
const report={atUtc:new Date().toISOString(),status:'INCOMPLETE',scope:'Local source and synthetic checks; no DB, publication, deployment or full business UAT.',counts:inventory.counts,additions,remaining,evidence,reviews,screens,popups,requiredCases:matrix.requiredCases,decisionGates:matrix.decisionGates};
fs.writeFileSync(root+'/I09/hq-acceptance-current.json',JSON.stringify(report,null,2)+'\n');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const table=(heads,rows)=>'<div class="scroll"><table><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const css=fs.readFileSync(dir+'/02_Work_Design.html','utf8').match(/<style>([\s\S]*?)<\/style>/)[1];
const html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HQ 이행 및 화면·팝업 인수</title><style>'+css+' td{overflow-wrap:anywhere} pre{white-space:pre-wrap}</style></head><body><main><header><h1>HQ 전용 기능 이행 · 화면·팝업 인수</h1><p>판정: 진행 중(INCOMPLETE). DB 연결·운영 배포 없이 소스와 합성 환경을 검증합니다.</p><p><a href="14_GitHub_Work_Queue.html">GitHub</a> | <a href="11_Autonomous_Execution.html">전체 작업 현황</a> · <a href="12_Operational_Readiness.html">운영 인수 조건</a></p></header>'+
 '<section><h2>이번 구현 범위</h2>'+table(['기능','구현·검증 범위','근거'],additions.map(a=>[a.title,a.scope,a.tests]))+'<p>로컬 통과와 전체 업무 인수는 구분합니다. 작업자 B의 범위별 검토 기록은 implementation/evidence에 보존합니다.</p></section>'+
 '<section><h2>화면·팝업 검증 근거</h2>'+table(['검증 파일','결과','검증 항목 수','범위'],evidence.map(e=>[e.file,e.status,e.checks.length,e.scope]))+'<ul>'+evidence.map(e=>'<li><a href="implementation/evidence/'+esc(e.file)+'">'+esc(e.file)+'</a></li>').join('')+'</ul></section>'+
 '<section><h2>전체 인수 기준</h2><p>화면 20개와 기존 팝업 7개를 기준으로 삼되, 신규 등록·삭제·의견·반려·일괄계획·병합 및 공통 상세·하위 항목 편집까지 포함합니다. 기존 탭 전체가 공통 화면으로 이행됐다고 판정하지 않습니다.</p><p>각 화면은 정상 조회/저장·취소·검증 오류·빈 결과·권한 회수·필드 숨김/읽기전용·버전 충돌·알 수 없는 결과 재시도·법인/세션 격리·다국어·모바일을 확인해야 합니다. 합성 검증은 실제 DB·업무 담당자 인수를 대체하지 않습니다.</p>'+table(['화면','인수 상태','현재 잔여 범위'],screens.map(s=>[labels[s.screenId]??s.screenId,s.acceptance,s.remaining]))+'</section>'+
 '<section><h2>팝업 인수 현황</h2>'+table(['ID','화면','구현 상태','잔여 범위'],popups.map(p=>[p.id,labels[p.screenId]??p.screenId,p.status,p.remaining]))+'</section>'+
 '<section><h2>작업자 B 검증 기록</h2><ul>'+reviews.map(r=>'<li><a href="implementation/evidence/'+esc(r.file)+'">'+esc(r.file)+'</a></li>').join('')+'</ul></section>'+
 '<section><h2>아직 남은 HQ 경로·필드 차이</h2><p>현재 '+remaining.length+'개입니다. ID·경로 등 정적 대응 '+inventory.counts.identityMatchOnly+'개 항목도 기능·권한·팝업의 전체 호환을 의미하지 않습니다.</p>'+table(['ID','이름','차이'],remaining.map(r=>[r.id,labels[r.id]??r.id,r.issues.join(', ')]))+'</section>'+
 '<section><h2>남은 작업 순서</h2><ol><li>관리자 사용자·조직·역할·코드 변경과 권한 회수 규칙을 공통 API에 연결</li><li>병원정보 전용 저장·행별 부분 성공 일괄 수정, 직출직퇴 재배정·ERP 실패 재전송</li><li>보고 추가 필드·계약 유형 및 홈 지표의 미확정 데이터 계약 반영</li><li>기존 리드/거래처 전체 탭, 활동 월별/지도, 참조 선택·첨부·전체 팝업 인수</li><li>별도 승인 시 격리 DB·실연계·출력·업무 담당자 인수</li></ol><p>018_report_review_round.sql은 승인 회차·의견·rowversion을 추가하는 소스 migration이며 실행하지 않았습니다. 새 보고서 API는 이 migration 및 변경 버전 필드가 있는 표준 계약이 필요합니다. 기존 초안 prepare는 편집 내용을 보존하며 최초 생성 때만 활동을 복사합니다.</p><p>홈 집계 정의(Q03), 역할과 membership/행 범위의 관계(Q01), 추가 필드의 업무 의미(Q02), 실연계·출력 환경(Q04~Q06)은 확정된 사실로 간주하지 않습니다. publicationReady=false 및 게시 allowlist 비어 있음은 유지합니다.</p></section></main></body></html>';
fs.writeFileSync(dir+'/13_HQ_Migration_Acceptance.html',html);console.log(JSON.stringify({status:report.status,remaining:remaining.length,evidence:evidence.length}));
