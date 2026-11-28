import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {packages} from './work-packages.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),dir=path.join(root,'docs/admin-platform/customization');
const e=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=items=>`<ul>${items.map(x=>`<li>${e(x)}</li>`).join('')}</ul>`;
const reviewFile=path.join(dir,'evidence/worker-b-C02.json'),review=fs.existsSync(reviewFile)?JSON.parse(fs.readFileSync(reviewFile,'utf8')):null;
const commands=[
['문서 생성','node scripts/admin-customization/render-instructions.mjs'],
['C02/C03 구조·추적 검사','node scripts/admin-customization/validate-workflow.mjs'],
['공통 계약 테스트 (I01-A에서 생성)','node --test scripts/admin-customization/contracts.test.mjs'],
['실제 등록부 대응·artifact 검사 (I01-B/D에서 생성)','node --test scripts/admin-customization/catalog.test.mjs'],
['서버/SQL·정책 경합 (I02에서 생성)','node --test scripts/admin-customization/config-service.test.mjs scripts/admin-customization/config-sql.test.mjs'],
['화면별 테스트 (I03 이후 생성)','node scripts/admin-customization/run-stage-checks.mjs I03'],
['계약 타입 검사','node frontend/node_modules/typescript/bin/tsc --noEmit -p packages/contracts/tsconfig.json'],
['계약 emit 빌드 — 프런트/서버 검사 및 번들 전에 필수','node frontend/node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json'],
['프런트 타입 검사','node frontend/node_modules/typescript/bin/tsc --noEmit -p frontend/tsconfig.json'],
['서버 타입 검사','node backend/node_modules/typescript/bin/tsc --noEmit --incremental false -p backend/tsconfig.json'],
['번역 키','node scripts/i18n/check.mjs'],
['기존 하드코딩 검사','node scripts/i18n/hardcode-check.mjs (C00 FAIL 기준선과 차이 기록; 기존 FAIL을 새 PASS로 표기 금지)']];
commands.push(['배포 계약 subpath 실제 로딩 검사 (I01에서 생성)','node --test scripts/admin-customization/contracts-export.test.mjs']);
const css=fs.readFileSync(path.join(dir,'02_Work_Design.html'),'utf8').match(/<style>([\s\S]*?)<\/style>/)[1];
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>C02 CRM 작업지시서</title><style>${css}</style></head><body><main><header><p>C02 · 2026-10-24 · 지시 버전 1.0</p><h1>CRM 법인별 설정·다국어 작업지시서</h1><p><a href="02_Work_Design.html">C01 설계</a> · <a href="01_Current_Comparison.html">C00 대조</a> · <a href="../08_CRM_Customization_Implementation_Plan.html">계획</a></p></header><div class="status">작업자 B: <strong>${e(review?.verdict??'검토 대기')}</strong> — 문서 실행 준비 판정이며 제품 인수 판정이 아닙니다.${review?'<p><a href="evidence/worker-b-C02.json">검증 기록</a></p>':''}</div><section id="rules"><h2>공통 작업 규칙</h2><ol><li>C02 독립 검증 → C03 문서 교차 검증 → I01 순서. 각 패키지 선행 게이트를 통과해야 다음 패키지 구현에 진입한다.</li><li>착수 시 git 상태·대상 파일 hash를 저장한다. 기존 staged/unstaged 변경 보존, reset/checkout 일괄 복원 금지. 새 변경은 파일별 diff로 구분한다.</li><li>작성자 구현/자체검증 → 작업자 B 독립검증 → 지적 보완 → 재검증 PASS. 부분작업 PASS는 패키지 전체 PASS가 아니다.</li><li>미확정 Q는 근거가 있는 코드/문서/연계 환경을 조사해 해소한다. 운영 정책·자격 증명을 추측하지 않는다. 차단 업무를 제외한 독립 작업·시험 준비는 계속한다.</li><li>산출물: 코드, ID 대응표, 변경 목록, 실행 명령/종료코드/log, acceptance case 결과, 영향·복구 기록, B 판정. evidence 경로는 implementation/evidence/&lt;stage&gt;/, 이전 실행은 보존한다.</li></ol></section><nav>${packages.map(p=>`<a href="#${p.id}">${p.id} ${e(p.title)}</a>`).join('')}</nav>${packages.map(p=>`<section id="${p.id}"><h2>${p.id}. ${e(p.title)}</h2><p><strong>선행:</strong> ${e(p.depends.join(', ')||'C03 PASS')} · <strong>설계:</strong> ${p.design.map(d=>`<a href="02_Work_Design.html#${d}">${d}</a>`).join(', ')} · <strong>검증:</strong> ${e(p.tests.join(', '))} · <strong>발견:</strong> ${e(p.gaps.join(', '))}</p><h3>수정 대상</h3>${list(p.files)}<h3>작업 지시</h3>${list(p.steps)}<h3>산출·통과 조건</h3>${list(p.accept)}<p><strong>B 게이트:</strong> ${e(p.gate)}</p><p><strong>되돌리기:</strong> ${e(p.rollback)}</p><h3>결정 게이트</h3>${list(p.questions)}</section>`).join('')}<section id="commands"><h2>검증 실행과 증거</h2>${commands.map(([label,cmd])=>`<h3>${e(label)}</h3><pre>${e(cmd)}</pre>`).join('')}<p>“생성” 표시는 현재 존재하지 않는 테스트의 필수 구현 지시다. 파일이 없거나 환경이 없으면 NOT_RUN/BLOCKED이며 PASS가 아니다. run-stage-checks는 해당 stage의 단위/HTTP/브라우저 case를 실행하고 실제 종료코드와 evidence를 저장하도록 I03에서 작성한다. I04–I09는 인자를 해당 ID로 바꾸고 단계별 case 목록을 추가한다.</p><p>회귀는 scripts/hq-standard의 기존 *.test.mjs 및 h0*-http.mjs를 Node --test에 파일 배열로 넘겨 실행한다(Windows glob을 shell에 의존하지 않음). frontend bundle은 frontend cwd에서 node node_modules/vite/bin/vite.js build. 브라우저는 격리 합성 데이터로 실제 build를 실행하고 저장/실패/직접 URL/API와 1440/390 폭을 검증한다. C00 캡처 스크립트를 다시 실행해 기준선 증거를 덮어쓰지 않는다.</p><p>SQL 테스트는 별도 테스트 DB 연결 여부를 검사하고 없으면 BLOCKED를 출력하고 비정상 종료한다. 실제 DB에 seed/migration을 자동 실행하지 않는다. 환경은 업무 코드 외부에서 주입하고 로그에 비밀값을 남기지 않는다.</p></section><section id="trace"><h2>설계·발견 사항 전수 추적</h2><p><a href="evidence/work-instructions.json">기계 판독 작업 패키지/검증/선행 관계</a></p><p>모든 D01–D15는 공통 규칙과 I01–I09에 연결하며 D01은 전체 범위, D14는 패키지 순서, D15는 Q 게이트로 적용한다. G01–G15 및 T01–T09가 하나 이상 패키지에 존재해야 한다. 업무별 필수 ID는 C00/C01 manifest를 계승하며 신규 ID도 동일 추적표에 추가한다.</p><p>C03에서는 08 계획·C00·C01·C02의 메뉴 숨김/사용·필드 보안·복원·표준 공급·영속 게이트·다국어·운영 범위를 대조하고 발견한 모순을 수정한 뒤 B 검증을 받는다.</p></section></main></body></html>`;
fs.writeFileSync(path.join(dir,'03_Work_Instructions.html'),html);
fs.writeFileSync(path.join(dir,'evidence/work-instructions.json'),JSON.stringify({stage:'C02',commonDesign:['D01','D13','D14','D15'],packages,commands},null,2)+'\n');
console.log('C02 rendered: '+packages.length+' packages');
