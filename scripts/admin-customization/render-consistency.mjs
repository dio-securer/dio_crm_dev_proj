import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),dir=path.join(root,'docs/admin-platform/customization');
const e=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rows=[
['X01','메뉴 표시/기능 사용','08 범위/ C00 G09 / C01 D04 / C02 I01,I02,I03','일치','menu.visible은 탐색만, screen/action.enabled는 URL/API 차단. 필수 lookup 의존성 검증.'],
['X02','필드 숨김/필수/읽기전용','08 범위 / G03,G04,G11 / D03–D05 / I01,I02,I04–I08','일치','공유 데이터 접근과 occurrence 배치 구분. 서버 투영·쓰기 allowlist·required 도달성.'],
['X03','전체 다국어','08 language / G07,G08,G12 / D10 / I01,I03–I08','일치','ko/en 초기 언어, 법인/표준 동일 언어 우선, 필수 번역 fallback 게시 불가. 코드·오류·접근성·출력 포함.'],
['X04','목업/운영 판정','08 acceptance / G13,G14 / D13,D15 / I02,I09','일치','C00 PASS는 설계 입력. 영속 adapter/실연계 미검증은 운영 PASS 불가.'],
['X05','상속 계층/예약/확장 필드','기존 03/04 / 08 scope / D01,D07 / I01–I03','명시적 범위 축소','초기 HQ 표준+법인 override. COUNTRY 편집·예약·자유 필드 생성은 별도 범위. 기존 문서의 전체 범위를 이번 완료 기준으로 가져오지 않음.'],
['X06','복원 API 의미','기존 03 즉시 release / C01 D06,D07 / I02,I08','명시적 변경','복원 draft 준비→검증→일반 게시. 새 release이며 보안/업무 데이터는 복원 제외. 기존 소비자는 adapter로 이행.'],
['X07','표준 편집과 공급','C00 JSON standard / D02,D06,D07 / I01-D,I02-B','명시적 변경','코드 빌드 artifact→본사 standard.publish. raw JSON 표준 쓰기410. 사용자 요구의 법인별 체크 UI는 I03에서 제공.'],
['X08','동시성/출력 정책','C01 B 보완 D06,D10,D13 / I02,I07','일치','공통 fence와 commit 재검사, 최신 설정으로 오래된 출력 폐기/409.'],
['X09','C00 UI 차이','G10,G15 / D03,D11 / I01-B,I04–I08','일치','11차이/주소2미확인, 실제 탭·팝업·114 UI 추적. API 대표경로/alias 대응.'],
['X10','Q01–Q06','D15 / C02 각 패키지 questions','일치','실제 권한/업무/집계/DB/언어폰트/연계는 게이트. 합성 예시를 운영 정책으로 변환 금지.'],
['X11','계약 패키지 소비','C02 B01 / I01-A / commands','보완 완료','subpath dist export와 emit build→실제 import→소비자 검사→bundle 순서.'],
['X12','단계별 검증','사용자 지시 / 08 execution-status / D13 / C02 rules','일치','각 단계 B PASS 필요. 부분작업 PASS는 전체 PASS가 아님. 미통과 선행을 건너뛰지 않음.']
];
const reviewPath=path.join(dir,'evidence/worker-b-C03.json'),review=fs.existsSync(reviewPath)?JSON.parse(fs.readFileSync(reviewPath,'utf8')):null;
const sources=['../08_CRM_Customization_Implementation_Plan.html','01_Current_Comparison.html','02_Work_Design.html','03_Work_Instructions.html'];
const hashes=sources.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.resolve(dir,file))).digest('hex')}));
const css=fs.readFileSync(path.join(dir,'02_Work_Design.html'),'utf8').match(/<style>([\s\S]*?)<\/style>/)[1];
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>C03 문서 누락·모순 검토</title><style>${css}</style></head><body><main><header><p>C03 · 2026-10-24</p><h1>문서 간 누락·모순 검토서</h1><p>계획 → 구현 대조 → 작업설계 → 작업지시의 연결 확인</p></header><div class="status"><strong>작업자 B: ${e(review?.verdict??'검토 대기')}</strong><p>문서의 구현 착수 적합성 판정이며 제품 기능 인수 판정이 아닙니다.</p>${review?'<a href="evidence/worker-b-C03.json">검증 기록</a>':''}</div><section id="matrix"><h2>교차 검토 결과</h2><div class="scroll"><table><thead><tr>${['ID','검토 주제','근거 위치','작성자 판정','결정/유지할 제약'].map(x=>`<th>${e(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${e(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section><section id="coverage"><h2>누락 검사</h2><p>validate-workflow가 D01–D15, G01–G15, T01–T09의 작업 패키지 연결과 선행 순서를 검사합니다. 20화면·202필드·84액션·7팝업의 전수 추적은 C01 manifest에서 계승합니다. 미등록 UI114 분류는 I01-B의 필수 산출물이며 문서 완료만으로 구현된 것으로 처리하지 않습니다.</p><p>기존 설계와의 차이 X05–X07은 C01에 이미 명시한 적용 범위/변경 계약입니다. 계획서의 기존 7개 구현 단계는 새 9개 작업 묶음으로 세분화했으며 요구사항을 삭제하지 않았습니다.</p></section><section id="gate"><h2>착수 게이트</h2><p>C02 B PASS와 본 C03 B PASS 후 I01-A부터 구현합니다. I01 전체 전수대응/번역/artifact 게이트까지 완료한 뒤 I02로 진입합니다. Q 미확정 업무는 지원 미확정으로 명시하고 활성화를 거부합니다. 운영 환경이 없는 상태를 memory PASS로 대체하지 않습니다.</p><p>기존 애플리케이션의 dirty 변경을 보존합니다. 단계별 수정 전 대상 파일 hash와 diff를 보관하고 새 코드·증거·B 판정을 implementation 아래에 기록합니다.</p></section><section id="sources"><h2>검토 문서</h2>${sources.map(s=>`<p><a href="${e(s)}">${e(s)}</a></p>`).join('')}<p><a href="evidence/document-consistency.json">검토 항목·문서 hash</a> · <a href="evidence/workflow-validation.json">구조/추적/브라우저 검사</a></p></section></main></body></html>`;
fs.writeFileSync(path.join(dir,'04_Document_Consistency_Review.html'),html);
fs.writeFileSync(path.join(dir,'evidence/document-consistency.json'),JSON.stringify({stage:'C03',authorVerdict:'READY_FOR_REVIEW',scope:'Cross-document consistency, not application acceptance',rows,hashes},null,2)+'\n');
console.log('C03 rendered');
