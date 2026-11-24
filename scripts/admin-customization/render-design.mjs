import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { findings } from './comparison-data.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=path.join(root,'docs/admin-platform/customization');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,'evidence',n),'utf8'));
const baseline=read('baseline.json'), semantic=read('semantic-map.json');
const reviewPath=path.join(dir,'evidence/worker-b-C01.json');
const review=fs.existsSync(reviewPath)?read('worker-b-C01.json'):null;
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const table=(heads,rows)=>`<div class="scroll"><table><thead><tr>${heads.map(x=>`<th scope="col">${e(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${e(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const sections=[];
const section=(id,title,body)=>sections.push({id,title,body});
section('D01','01. 목적·범위·문서 적용 순서',`
<p class="lead">동일한 표준 CRM에서 법인별로 메뉴·화면·필드·기능을 선택하고, 모든 표시 문구를 언어별로 관리한다. 사용자 화면과 API는 같은 게시 설정을 적용한다.</p>
<p>본 문서는 <strong>C01 작업설계서</strong>다. C00 대조 결과를 구현 계약과 인수 기준으로 구체화한다. C02 작업지시서의 작업 단위·수정 파일·실행 명령은 다음 단계에서 작성한다. 현재 설계는 구현 완료나 실사용 인수 판정이 아니다.</p>
${table(['구분','범위·결정'],[
['기준선','C00의 HQ 화면 20·필드 202·액션 84·팝업 7. 이는 최소 추적 집합이며 미등록 UI 114개와 실제 탭을 추가 분류해야 한다. 전체 팝업이 7개뿐이라는 뜻은 아니다.'],
['포함','고정 ID 등록부, 법인 설정, 관리자 편집/미리보기/검증/게시/이력/복원/표준 갱신, UI·API 정책 통일, 다국어, 업무 기능 결함 보완, 영속성·인수 설계.'],
['초기 언어','ko-KR·en-US, 시스템 기본 ko-KR. 신규 법인 초기 활성 언어는 두 언어. 법인 기본 언어는 활성 언어 중 선택. 추가 언어는 리소스·출력 검증을 완료한 뒤 활성화.'],
['별도 후속 범위','임의 사용자 정의 필드 생성, 자유 배치, 스크립트 실행, 승인 흐름 디자이너 전체, 예약/여러 법인 일괄 게시. 기존 업무 승인 실행은 유지·검증 대상.'],
['기존 문서와 관계','08 계획서 → C00 증거 → 본 C01 → 향후 C02 → C03 교차 검토 순서. 기존 01–07 관리자 설계의 공통 계약을 계승하되 아래 명시한 HQ 범위 축소·구체화가 이번 작업에 우선한다. 기존 문서는 삭제하거나 전체 구현 완료로 해석하지 않는다.'],
['명시적 범위 차이','기존 COMMON→TEMPLATE→COUNTRY→COMPANY 계층은 유지 가능한 manifest 구조로 두되 초기 HQ release는 고정 HQ 표준 + COMPANY override만 사용한다. COUNTRY 편집·예약 게시·확장 필드 생성은 C01에서 구현을 지시하지 않는다. GLOBAL/legacy는 별도 회귀 보호 대상.']])}
<div class="note">실제 법인·가격·재고·승인·연계 필수값은 임의 확정하지 않는다. §D15의 결정 목록으로 관리하며, 관련 업무의 운영 게시를 차단한다. 합성 법인 A/B는 테스트 전용이다.</div>`);
section('D02','02. 통합 구조와 재사용 경계',`
<div class="flow">표준 등록부·번역 → 법인 작업본 → 검증·미리보기 → 불변 release → 공통 resolver → 사용자 화면 / 업무 API</div>
${table(['계층','책임·연결 지점','변경 원칙'],[
['계약·resolver','packages/contracts의 신규 crm-customization 모듈 후보: 스키마, 고정 ID, 병합·의존성·권한 계산, 오류 코드','순수 함수와 직렬화 DTO 공유. 서버가 최종 판정하며 프런트 번들을 권한 근거로 신뢰하지 않음.'],
['HQ adapter','backend/src/hq-mock/app.ts 및 각 업무 route → 공통 policy 서비스','HQ 숫자 companyId와 새 public UUID를 매핑. 사용자 선택 companyId를 actor.companyId에 그대로 대입하지 않음. 기존 상태 전이·소유자 검사는 유지.'],
['설정 저장소','AdminConfigRepository: read / transact / compareAndSwap / appendAudit / enqueueInvalidation','목업은 회사 mutex+copy-on-write, 영속 구현은 SQL Server 트랜잭션. 현재 backend의 mssql 기반과 연결하되 기존 스키마 실제 조사 후 migration 번호 확정.'],
['사용자 UI','frontend/src/hq-mock 및 AccountsPage, app/screen-registry, AppShell','useEffectiveConfig / ConfiguredField / ConfiguredAction / ConfiguredRegion 공통 소비자 도입. 훅·컴포넌트 이름은 신규 설계안.'],
['관리자 UI','기존 ConfigurationPages, AccountDesigner, AdvancedDesigner의 트리/편집/차이 UI 재사용','브랜치 통째 병합 금지. 계약·권한 adapter를 먼저 맞추고 개별 이식. admin-text의 한국어 고정은 공통 번역 resolver로 교체.'],
['기존 관리자 기능','사용자·조직/권한/코드/연계/감사 HQ 화면 유지','법인 설정 권한과 회사 scope를 공유. 역할·사용자·위임 변경은 즉시 보안 트랜잭션이며 설정 복원 대상 아님.']])}
<p>회사 식별자는 관리 API의 <code>companyId = public UUID</code>, 내부 HQ는 <code>companyKey = number</code>로 구분한다. 서버가 활성 membership 또는 유효한 HQ 위임을 검증한 뒤 매핑한다. 합성 A/B도 별도 UUID와 내부 키를 사용한다. 매핑 실패는 404로 종료하며 기본 법인으로 대체하지 않는다.</p>
<p>기존 <code>/api/hq/admin/*</code>의 법인 설정 명령은 이행 기간 공통 서비스를 호출하는 adapter만 남긴다. 새 API와 별도 저장소를 두지 않는다. 읽기 및 권한 회귀 확인 후 구 JSON 편집 UI를 대체하고, 기존 법인 설정 쓰기 경로에도 새 CAS·검증·게시 규칙을 동일 적용한다. 기존 표준 JSON 직접 게시 경로는 D06의 검증된 표준 artifact 공급 경로로 이행한다.</p>`);
section('D03','03. 등록부와 설정 데이터 계약',`
${table(['객체','필수 데이터','제약'],[
['CatalogEntry','stableId, kind, parentId, entityKey, labelKey, helpKey, bindingKind, bindings[], capabilities, locks, dependencies, supportState','kind=MENU/SCREEN/TAB/POPUP/SECTION/FIELD/ACTION/CODE/OUTPUT. 기존 fieldKey/actionKey 유지. 부모·API·번역 참조 무결성 검사.'],
['FieldBinding','fieldId, bindingKind, apiPaths[], uiBindings[], actions[], type, constraints, source','bindingKind=DATA/QUERY/DERIVED/DEVICE. 검색 조건을 저장 필드로 보내지 않음. DATA만 쓰기 DTO에 연결; 계산값은 서버 산출, DEVICE도 서버 검증.'],
['StandardRelease','standardReleaseId(UUID), schemaVersion, catalogHash, translations, policy, lockedPaths, contentHash','불변. 사람이 보는 v1.x 표시는 별도 displayVersion이며 동시성 키가 아님.'],
['CompanyDraft','draftId, companyId, revision(int), baseStandardReleaseId, baseActiveReleaseId, patches, localeConfig, translations, updatedBy','법인별 활성 작업본 1개. revision 비교 후 증가. 작업본은 업무 조회에서 소비하지 않음.'],
['Patch','targetId, property, operation=set/reset, value','저장 시 reset은 override 항목 삭제. 값 누락=상속, false=명시 해제, null은 nullable 속성에서만 사용. 배열은 stableId 기준 병합.'],
['Validation','validationId, draftRevision, draftHash, standardReleaseId, catalogHash, dependencyHash, permissionVersion, dataImpactVersion, errors[], warnings[], createdAt','스냅샷에 바인딩. 데이터·권한은 게시 시 다시 검사. 경고는 코드·대상별 확인과 사유 기록; 오류는 무시 불가.'],
['CompanyRelease','releaseId(UUID), companyId, sourceDraftId, standardReleaseId, effectiveConfig, translations, contentHash, createdAt, actor, reason, restoredFrom','게시 내용 불변. ActivePointer(companyId, releaseId, revision)는 별도 CAS 갱신.'],
['Event / Outbox / Receipt','회사·행위자·명령·전후 hash·requestId·시각·사유 / 무효화 이벤트 / idempotency 응답','release 생성 + pointer 갱신 + 감사 + outbox + receipt를 한 트랜잭션에 기록. 비밀 값·업무 개인정보를 감사 diff에 평문 저장하지 않음.']])}
<p>속성별 <code>capabilities</code>가 허용한 변경만 편집할 수 있다. <code>lockedPaths</code>는 표준·법인의 하위 설정으로 해제할 수 없다. 관리자에게 각 값의 원천(표준/법인/권한/업무 상태)과 잠금 사유를 반환한다. 미등록 ID·허용하지 않은 속성·타입·범위·미구현 기능의 사용 설정은 422다.</p>
<p>탭은 실제 리드 8개·거래처 9개·활동 3뷰를 의미별 ID로 등록한다. C00 팝업 ID 7개는 추적 별칭으로 유지하고 구현 ID와 대응한다. 반복 UI 위치는 <code>uiBindingId</code>로 구분하되 같은 데이터 필드는 하나의 fieldId 정책을 공유한다. 미등록 UI 114개는 설정 대상 또는 고정 UI 동작으로 하나씩 분류하고 사유를 남긴다. 닫기·취소·오류 복구를 끄는 설정은 제공하지 않는다.</p>`);
section('D04','04. 상속·기능·필드 정책 계산',`
<ol><li>회사에 게시된 불변 표준/법인 release를 로드한다.</li><li>허용된 속성만 법인 override로 병합하고 잠금·참조·의존성을 검사한다.</li><li>활성 membership, 역할 allow 합집합, 명시 deny 우선, 위임 상한을 적용한다.</li><li>법인·조직·담당자 데이터 범위와 문서 상태·ERP 제약을 적용한다.</li><li>동일 정책 결과를 API에 강제하고 UI용 표시 상태·사유·번역 키를 반환한다.</li></ol>
${table(['속성','의미·계산','허용/차단 예'],[
['menu.visible','메뉴 탐색 표시만 제어. 대상 screen.enabled와 독립','메뉴 숨김+화면 사용이면 권한 있는 직접 URL 허용. 메뉴 표시+화면 중지 조합은 게시 오류.'],
['screen.enabled / action.enabled','업무 기능 사용 여부. screen off이면 소유 액션·직접 URL/API 거부','액션 실행 = 화면/기능 사용 ∧ 액션 사용 ∧ 권한 ∧ 데이터 범위 ∧ 업무 상태. 설정은 권한을 추가하지 못함.'],
['tab/section/popup.visible 또는 enabled','탭/영역은 표현 구성, 팝업은 연결 액션의 진입 형태','팝업 비활성화 시 유일한 필수 액션 경로가 사라지면 게시 차단. 같은 액션의 다른 정상 경로가 있으면 허용.'],
['field.visible','필드 표시 및 이번 범위의 사용자 데이터 노출 제어','false이면 공용 DATA field의 UI·조회·출력에서 제거하고 일반 사용자 쓰기도 금지. QUERY 필드는 입력/허용 쿼리에서 제거. DERIVED는 집계 출력에서도 제거.'],
['field.readOnly','설정 readOnly OR 권한 write 부재 OR 계산/ERP/상태 잠금','읽기전용 값 직접 전송은 403 FIELD_WRITE_DENIED. 서버 기본값·전용 상태 명령은 별도 검증된 경로만 허용.'],
['field.required','업무 invariant OR 조건부 ERP 필수 OR 법인 required','법인이 invariant를 false로 낮출 수 없음. create는 서버 기본값 적용 후 검사; update는 기존 행과 허용 patch를 병합한 최종 상태로 검사.'],
['field.order / default','같은 영역 안 order 오름차순, 동률 stableId; default는 등록된 타입의 값/서버 제공값','신규 입력만 default 적용. 조회/설정 게시로 기존 데이터 변경 금지. 외부 코드 실행·임의 식 평가 금지.'],
['masking / read permission','read 허용 범위에서 mask. read 불허는 속성 제거','표시용 마스크 문자열을 원본 쓰기값으로 돌려보내지 않음. 마스킹 필드는 일반 수정 불허, 별도 권한 액션이 있을 때만 수정.']])}
<p>설정 required와 숨김/읽기전용이 동시에 참이면, 모든 활성 생성·수정 경로에서 검증된 서버 제공값 또는 기존 유효값으로 충족할 수 있는지 검사한다. 충족 불가 시 <code>REQUIRED_UNREACHABLE</code>로 게시 차단한다. 본사 invariant 외의 필수 강화는 기존 빈 데이터의 영향 건수를 표시하고, 정리/보완 경로가 준비되기 전 게시하지 않는다.</p>
<p>필드가 여러 화면에 나오면 데이터 접근 정책은 공유하고 배치는 occurrence별 설정으로 분리한다. occurrence 숨김만으로 데이터 보안을 부여하지 않는다. 관리자 기본 “필드 사용 안 함”은 공용 field.visible=false로 동작하며, 배치만 숨기는 선택지는 별도 이름·도움말로 표시한다.</p>
${table(['의존 관계','기본 규칙'],[
['주문 → 거래처/제품 lookup','메뉴 표시 없이 lookup 사용은 가능하나 필요한 읽기 액션·필드가 살아 있어야 함. screen off로 해당 액션을 차단하면 주문 의존성 검증 실패. 조회 전용 capability 분리는 등록부에 명시한 경우만 허용.'],
['승인 중 문서 → 승인/회수','미처리 건이 있고 종료·회수 경로가 사라지는 액션 중지는 차단. 먼저 처리/이관 후 게시. 설정 변경으로 자동 승인하지 않음.'],
['ERP 사용 → 식별자/필수 코드','해당 연계의 필수 입력을 제거하거나 비활성 코드를 필수 기본값으로 지정하면 차단. 실제 필수 목록은 D15 결정 게이트.'],
['순환·삭제 참조','부모/필수 기능 dependency 순환, 삭제된 ID 참조, 이동 후 고아 필드는 차단. 상위 선택해제는 영향 목록만 제안하며 암묵적 전체 해제 금지.']])}`);
section('D05','05. 서버 강제와 정보 노출 방지',`
<p>모든 업무 경로는 <strong>인증 → 회사 접근 → 최신 release/권한 → 액션 → 행 범위 → 필드 → 업무 규칙</strong>을 검사한다. UI 숨김이나 프런트 writablePayload는 편의 기능이며 서버 검사를 대신하지 않는다.</p>
${table(['경로','설계 규칙','검증'],[
['목록·상세·lookup·관련 문서','회사를 쿼리 조건에 강제. 행 범위 적용 후 허용 필드 투영. 숨긴 필드의 검색/정렬/그룹 조건도 거부','직접 URL/API, 다른 법인의 실제 ID, 숨긴 검색 조건을 넣어 비노출 확인.'],
['생성·수정·일괄·가져오기','요청 명령별 field allowlist. 알 수 없는 필드 422, 숨김/읽기전용 필드 403; 조용히 제거 후 성공하지 않음','오류 시 원자적 실패. 일괄 부분 처리 기능은 기존 명시 계약에 한해서 행별 결과 제공; 실패 행 원본 유지.'],
['출력·다운로드·집계','동일 행 범위·필드 정책. 금지 필드를 포함한 합계/집계는 제거 또는 해당 리포트 차단','엑셀 숨김 열·PDF 메타·CSV 원문·분석 응답까지 점검. 출력 작업 실행/다운로드 시 현재 권한 재확인.'],
['인터페이스 내부 작업','별도 service principal·법인 scope·필드 allowlist. 사용자 숨김값을 내부 처리해도 응답에 재노출 금지','UI 정책 우회용 관리자 헤더 금지. 외부 전송은 등록 인터페이스 권한과 업무 계약 검증.'],
['오류·감사·미리보기','오류 code/messageKey/params/fieldErrors만 전달. params의 비공개 값 제거. 미리보기는 합성 데이터 기본','권한 없는 값이 오류 메시지·감사 diff·미리보기 payload에 섞이지 않음.']])}
<p>회사 범위 밖·미존재 자원은 404, 인증 실패 401, 허용 회사 안의 기능/권한 거부는 403, 상태/버전 충돌은 409, 입력/설정 의미 오류는 422다. 클라이언트는 번역된 오류와 requestId를 보여주며 저장 실패 시 입력을 유지한다.</p>`);
section('D06','06. 작업본·게시·복원·영속성',`
<div class="flow">DRAFT → VALIDATED → 게시 트랜잭션 → 새 RELEASE + ACTIVE POINTER<br>작업본 변경 → DRAFT / 검증 오류 → DRAFT / 게시 실패 → 기존 ACTIVE 유지</div>
<ol><li>저장은 draft revision CAS, actor의 현재 위임·편집 범위 확인, schema 검사 후 revision 증가. 이전 validation은 무효화한다.</li><li>검증은 표준/등록부 참조·의존·필수값·데이터 영향·활성 언어·미구현 binding을 검사한다. 경고 확인은 validationId에 묶는다.</li><li>게시 직전 현재 게시 권한, draft/hash/revision, baseStandardReleaseId, activeReleaseId, 데이터 영향 및 dependency를 재검증한다. 회사 잠금 안에서 TOCTOU를 방지한다.</li><li>한 트랜잭션에서 불변 release, ACTIVE pointer CAS, append-only 감사, outbox, 명령 receipt를 기록한다. 하나라도 실패하면 전부 rollback한다.</li><li>커밋 후 outbox를 전달한다. 알림 실패는 재시도하며 이미 커밋된 게시를 취소하지 않는다. 서버 요청은 현재 pointer를 기준으로 판단한다.</li></ol>
${table(['상황','처리'],[
['동시 저장·게시','draft/active 기대 revision 불일치 409. 먼저 성공한 내용 보존, 충돌 diff와 재조회 제공. 서버가 자동 덮어쓰기하지 않음.'],
['중복 명령','Idempotency-Key는 회사+행위자+operation 범위. 같은 키/같은 payload는 기존 결과, 다른 payload는 409 IDEMPOTENCY_CONFLICT. receipt도 영속 저장.'],
['표준 갱신','각 회사는 게시된 표준 버전에 고정. 새 표준 발표만으로 회사 ACTIVE를 변경하지 않음. old standard/new standard/company override 3방향 diff로 rebase draft 생성. 삭제/타입/잠금/번역 충돌은 수동 해결 후 재검증.'],
['이전 설정 복원','이전 회사 release 내용을 현재 회사의 채택 표준·현재 registry/권한/데이터에 맞춰 새 draft로 변환 → 검증 → 새 release. 이전 표준이 다르면 rebase가 필수. 과거 pointer로 직접 이동 금지.'],
['복원 제외','업무 데이터, 사용자/권한 회수, 완료 승인, 외부 전송, 번호 발급은 되돌리지 않음. 기존 release와 감사도 수정하지 않음.'],
['재시작·복구','저장소에서 ACTIVE와 불변 release/hash를 검증해 복구. hash 불일치·누락 시 설정 사용 경로를 차단하고 운영 진단 제공. 초기 seed로 조용히 덮어쓰기 금지.'],
['저장 adapter 인수','memory는 단위 테스트 전용. 실사용 게이트는 SQL Server 영속 adapter에서 재시작·커밋 중 장애·동시 게시·감사 원자성·백업복원 검증. 파일 목업은 이를 대신하지 못함.']])}
<h3>게시·업무 쓰기·권한 변경의 공통 커밋 경계</h3>
<p>설정 게시, 업무 생성/수정/승인/연계 요청 등록, membership·권한 회수 트랜잭션은 모두 동일한 <code>CompanyPolicyFence(companyId)</code>를 획득한다. 잠금 순서는 회사 fence → membership/security revision → ACTIVE pointer → draft/업무 행이다. 여러 회사를 다루는 보안 명령은 companyId 오름차순으로 잠그며 전역 사용자 중지는 identity 잠금을 먼저 획득한다. 해당 사용자의 모든 업무 명령도 identity 활성 상태를 같은 잠금/CAS 계약으로 확인한다. 목업은 공통 mutex, SQL은 트랜잭션 소유 잠금/행 잠금으로 구현한다.</p>
<p>요청 시작 시 검사만으로 쓰기를 허용하지 않는다. fence 안에서 커밋 직전 최신 activeReleaseId·permissionVersion·identity 상태·문서 revision·진행 중 업무 영향 버전을 다시 검사한다. 설정/권한이 먼저 커밋됐으면 오래된 업무 명령은 409 또는 권한 회수 403으로 실패하며 쓰기·외부 전송 outbox를 생성하지 않는다. 업무가 먼저 커밋됐으면 이후 게시가 새 진행 중 건을 포함해 영향 검증하고 종료 경로를 없애는 게시를 거부한다. 기존 입력을 승인 대기로 바꾸는 명령도 동일 경계에 포함한다.</p>
<p>외부 전송은 DB 안에서 직접 호출하지 않고 같은 트랜잭션의 outbox로 등록한다. 실행 직전 현재 설정·service principal 권한을 다시 검사해 취소/보류한다. 외부에서 이미 수락한 요청을 설정 복원으로 되돌릴 수는 없으므로 요청 ID·상태·결과를 감사에 남기고 진행 중 요청의 종료/조회 경로를 차단하는 게시를 막는다.</p>
<h3>표준 release 공급 방식</h3>
<p>초기 표준은 <strong>버전 관리되는 등록부·번역·제약 코드에서 빌드한 데이터 artifact</strong>로 공급한다. 임의 표준 JSON 편집기·새 업무 로직 디자이너는 초기 범위에 포함하지 않는다. 개발 변경 검토 및 작업자 B의 등록부/번역/의존성 검증을 통과한 artifact를 배포 bundle의 허용 목록에 등록한다. 본사 <code>standard.publish</code> 권한자가 artifactId·expectedCatalogHead·사유로 발행한다. 서버는 bundle 내부의 artifact만 읽고 임의 경로/코드/업로드 실행을 허용하지 않는다.</p>
<p>발행 시 schema·hash·ID·binding·필수 번역·잠금·호환성 검증 후 불변 StandardRelease와 감사/receipt를 전역 catalog 트랜잭션으로 저장한다. 동일 artifact hash 재요청은 같은 결과다. catalogHead CAS 충돌은 409다. 이 발행은 회사 ACTIVE를 변경하지 않으며 각 법인의 rebase·검증·게시가 별도로 필요하다. 모든 채택 표준을 계속 읽을 수 있게 보존하고, 폐기 ID는 호환 이행 없이 재사용하지 않는다.</p>
<p>구 표준 JSON 저장/게시 API는 신규 raw 변경을 수용하지 않는다. 이행 시 쓰기 호출과 UI 버튼을 제거하고 <code>410 STANDARD_ARTIFACT_REQUIRED</code> 및 새 경로 안내를 반환한다. 기존 구 표준 내용은 1회 baseline artifact로 변환·검증·보존한 뒤 이행하며 자동 운영 게시하지 않는다. 새 표준 편집 UI가 필요하면 별도 후속 범위로 확정한다.</p>
<p>SQL 논리 집합은 기존 관리자 설계의 crm_config_draft/version/release/validation/event, crm_command_receipt를 계승하고 회사 ACTIVE pointer·policy fence 및 outbox를 추가한다. FK 회사 일치, UNIQUE(company,active draft), revision CAS, immutable release hash를 강제한다. 회사 작업본은 DRAFT/VALIDATED 상태만 활성으로 계산하며 성공한 게시 트랜잭션에서 PUBLISHED로 닫는다. 다음 작업본은 새 ACTIVE를 기준으로 만든다. 폐기는 편집 권한·revision 검사 후 ABANDONED로 표시하고 감사만 보존한다. 세부 SQL migration은 실제 테이블·다음 번호 조사 후 C02에 지정하며 이 문서로 운영 DB를 변경하지 않는다.</p>`);
section('D07','07. API 계약과 오류',`
<p>새 설정 계약 prefix는 기존 관리자 설계와 같은 <code>/api/admin</code>다. 아래 경로는 <strong>구현 예정</strong>이며 현재 제공되는 API라는 뜻이 아니다. 모든 회사 접근은 서버 검증, 작업본 ID 접근도 저장된 companyId로 권한을 재검사한다.</p>
${table(['Method / 경로','입력·응답','권한/동시성'],[
['GET /companies','검색/페이지 → 접근 가능한 publicId/name 목록','config.read 또는 위임. 전체 회사 노출 금지'],
['GET /catalogs?standardReleaseId=…','등록부·capabilities·잠금·번역 키 → catalogHash','config.read; 허용 표준만'],
['POST /standards/releases','artifactId, expectedCatalogHead, reason → standardReleaseId/catalogHead','본사 standard.publish + Idempotency-Key. 허용 bundle artifact만, schema/hash 검증과 전역 catalog CAS'],
['GET /config/drafts?scope=COMPANY&scopeKey=…','현재 작업본/상속 출처/revision','config.read'],
['POST /config/drafts','companyId, baseStandardReleaseId, expectedActiveReleaseId → draftId/revision','config.edit + Idempotency-Key; 1개 활성 작업본 제약'],
['PATCH /config/drafts/:id','patches/locale/translations → 새 revision','config.edit + If-Match draft revision + Idempotency-Key'],
['POST /config/drafts/:id/abandon','reason → ABANDONED','config.edit + If-Match + Idempotency-Key. 게시 데이터는 유지'],
['POST /config/validate','draftIds[1], revisions[1] → validationId/errors/warnings/impact','config.edit; 단일 법인만. 변경 없는 평가 요청'],
['POST /config/preview','validationId, companyId, roleIds, locale → effective/provenance/sample','config.preview; 현재 hash 일치, 부작용 없음. 실제 업무 명령 실행 금지'],
['POST /companies/:company/releases','validationId, expectedReleaseId, reason, acknowledgedWarnings → releaseId','config.publish + Idempotency-Key; validation snapshot과 active CAS'],
['GET /companies/:company/releases 및 /:releaseId','페이지 이력 / 내용·diff·복원 가능성','config.read; 감사는 별도 audit.read'],
['POST /config/drafts/:id/rebase','targetStandardReleaseId → draftRevision/conflicts','config.edit + If-Match + Idempotency-Key; 미해결 충돌 게시 금지'],
['POST /companies/:company/releases/:id/rollback','targetReleaseId, expectedReleaseId, reason → 복원 draftId','config.restore + config.edit + Idempotency-Key. :id=현재 active, target=복원 원본. 여기서는 준비만 수행; validate 및 일반 publish를 거쳐 적용'],
['GET /api/runtime/effective-config','서버 인증 문맥 companyId/membership → releaseId/permissionVersion/epoch/policy/translations','업무 읽기 접근. 관리자 원문 overrides·다른 회사 설정은 반환하지 않음']])}
<p>기존 03 문서의 rollback 즉시 새 release 반환은 이번 UI의 <strong>복원 준비 → 검증 → 일반 게시</strong>로 구체화한다. 기존 소비자가 있으면 별도 adapter 버전으로 이행하며 조용히 응답 형식을 바꾸지 않는다. 예약 publishAt은 이번 API에서 허용하지 않고 422 UNSUPPORTED_OPTION을 반환한다.</p>
<pre>${e(JSON.stringify({code:'CONFIG_CHANGED',messageKey:'errors.configChanged',params:{},fieldErrors:[],requestId:'uuid',context:{releaseId:'new-release-uuid',permissionVersion:12}},null,2))}</pre>
<p>업무 변경 명령은 <code>X-Config-Release-Id</code>, <code>X-Permission-Version</code>, 기존 문서 revision을 전송한다. 누락은 428 PRECONDITION_REQUIRED, 오래된 값은 409 CONFIG_CHANGED/PERMISSIONS_CHANGED, 현재 권한 상실은 403을 우선한다. 오류 시 최신 컨텍스트와 허용된 변경 사유만 반환한다. 관리자 API의 If-Match는 HTTP 412 대신 기존 프로젝트의 revision 충돌 규칙인 409로 통일한다.</p>`);
section('D08','08. 클라이언트 갱신·진행 중 입력',`
<p>캐시 키는 <code>companyId + membershipId + releaseId + permissionVersion + locale + datasetGeneration</code>이다. <code>contextEpoch</code>는 화면 세션 전환마다 증가해 늦은 응답을 폐기한다. 정책·메뉴·업무 데이터·lookup·출력 모두 같은 컨텍스트를 사용한다.</p>
${table(['이벤트','동작'],[
['게시·복원','해당 회사 설정/번역/메뉴/업무 캐시 무효화. outbox 기반 알림은 빠른 갱신 수단. 포커스/재연결과 모든 API 응답의 context를 비교하고 서버는 항상 최신 pointer 사용.'],
['저장 중 정책 변경','서버 409 → 입력 자동 재전송 금지 → 최신 정책과 diff 표시. 여전히 허용된 입력만 보존하고 금지 필드는 메모리/오류 UI에서 제거. 사용자가 검토 후 다시 저장.'],
['법인 전환','미저장 변경 확인 → 이전 요청 취소·캐시 제거 → epoch 증가 → 새 context 로드 후 화면 표시. 이전 회사 응답/폼 데이터 재사용 금지.'],
['언어 전환','원본 코드·금액·문서 입력 유지. 번역/포맷 캐시만 갱신. 사용자 선택 언어를 서버 preference에 저장; 로그인 전 localStorage는 초기 힌트만 사용.'],
['권한 회수/세션 종료','다음 요청에서 즉시 재검사. 세션 무효화 알림/포커스 검사로 화면도 잠금. 화면에 이미 노출된 정보의 원격 회수를 보장한다고 표현하지 않음.'],
['통신·설정 로딩 실패','이전 회사나 한국어 기본 설정으로 성공 처리하지 않음. 재시도 UI 제공, 변경 명령 차단. 오래된 읽기 화면은 상태 표시 후 재검증.']])}`);
section('D09','09. 관리자 화면·상호작용 설계',`
<p>공통 머리글: 대상 법인 / 기준 표준 / 현재 게시 버전 / 작업본 revision / 저장 상태 / 편집·게시 권한. 왼쪽 메뉴·화면 트리, 오른쪽 설정과 번역, 아래 변경 영향·검증 결과를 배치한다.</p>
${table(['화면 ID(신규 제안)','내용·조작','실패/취소 처리'],[
['CFG.COMPANY','접근 가능한 법인 선택, 미저장 경고, 표준·게시 정보','권한 없는 법인 URL 거부. 법인 변경 전 저장/버리기/계속 편집 선택'],
['CFG.EDITOR','메뉴 표시 체크, 기능 사용 체크, 탭/영역/팝업; 필드 표시·편집·필수·순서; 액션 사용','상속/명시 사용/명시 미사용 3상태. 값은 체크로 바꾸고 “표준값 복원”으로 override 제거. 혼합 부모는 indeterminate'],
['CFG.EDITOR.LOCK','잠긴 필수 요소와 사유, 원천, 영향 의존 목록','일괄 선택도 잠금 우회 불가. 연쇄 변경은 영향 확인 후 명시 적용; 잘못된 임시 작업본 저장은 허용하되 게시 불가'],
['CFG.TRANSLATIONS','메뉴·탭·팝업·필드·도움말·버튼·코드·오류·출력 키 검색; 언어별 표준/법인 값','상속과 빈 값 구분. 필수 문구 빈 문자열 불가. 변경/복원, 누락 필터, 긴 문구 미리보기'],
['CFG.PREVIEW','법인·현재 허용 범위 내 역할·언어·PC/모바일 합성 데이터 미리보기','화면에 미리보기 표시. 저장/승인/ERP/번호 발급/다운로드 명령은 실행하지 않고 결과 시뮬레이션'],
['CFG.VALIDATION','ID·위치·원인·해결 방향, 영향 건수, 경고 확인','오류 항목 클릭해 편집 위치 이동. 오래된 validation 사용 불가'],
['CFG.PUBLISH','최종 diff, 법인, 표준, 권한, 영향·사유 확인 후 게시','중복 클릭 방지 및 idempotency. 충돌 시 새 diff, 성공이면 releaseId/감사 링크'],
['CFG.HISTORY','버전·작성/게시자·사유·전후 diff·복원 준비·표준 갱신','복원도 검증·게시 통과 필요. 삭제/기존 이력 수정 버튼 없음']])}
<p>편집자는 <code>config.edit</code>, 미리보기는 <code>config.preview</code>, 게시자는 <code>config.publish</code>, 복원 준비자는 <code>config.restore</code>를 각각 요구한다. 게시 permission이 편집 permission을 자동 포함하지 않는다. 동일 사용자의 편집·게시 겸임은 시스템적으로 허용하되 실제 법인의 역할 배정은 D15에서 확정한다. 위임은 회사·도메인·속성·기간 범위를 모두 검사한다.</p>
<p>체크박스에 프로그램 연결 label·혼합 상태·키보드 조작 제공. 잠금 사유는 hover 없이 읽을 수 있어야 한다. 팝업은 focus 진입/복원, Esc·닫기·취소·미저장 확인을 제공하고 저장 중 이중 제출을 막는다. 모바일은 편집 패널을 순차 표시하고 표는 내부 가로 스크롤로 제한한다.</p>`);
section('D10','10. 다국어·공통코드·출력',`
<p>언어 결정: <strong>사용자 명시 선택 → 법인 기본 → 시스템 기본 ko-KR</strong>. 사용자 선택이 해당 법인 비활성 언어이면 법인 기본으로 표시하고 이유를 알린다. 사용자 선호 자체를 덮어쓰지 않는다. 서버 globalization 응답은 이 결정의 결과이며 매번 사용자 선택을 강제 덮어쓰지 않는다.</p>
<p>키별 번역 조회: <strong>선택 언어의 법인 override → 선택 언어의 표준 → 법인 기본 언어의 override/표준 → 시스템 기본 표준</strong>. 중복 언어는 건너뛴다. 초기 HQ에서 템플릿/공통 기본 언어는 모두 ko-KR로 고정하며, 별도 COUNTRY/템플릿 계층을 활성화할 때 기존 04 문서의 계층 fallback을 확장한다.</p>
${table(['대상','설계·검증'],[
['안정된 키','semantic ID→labelKey/helpKey/errorKey/outputKey 연결. label/nameKo 직접 표시 제거. UI label, placeholder, tooltip, aria-label, toast, 빈 상태, 팝업 확인/취소, 서버 오류·검증을 모두 목록화.'],
['법인 명칭','기존 key의 locale별 문자열 override로 구현. 키 변경/업무 코드 변경과 분리. 선택 언어의 표준 문구가 있으면 다른 언어의 법인 문구보다 먼저 사용.'],
['필수 문구','메뉴·제목·필드·버튼·오류·코드명·사용 중 출력 머리글은 필수. 활성 언어마다 같은 언어에서 override 또는 표준 번역 존재 필수. fallback만으로 필수 누락 게시를 통과하지 못함.'],
['선택 문구','부가 도움말만 catalog.requiredTranslation=false로 지정 가능. 누락 fallback은 경고와 미리보기로 확인. 분류 미지정은 필수로 취급.'],
['문자열 검증','보간 변수 이름·개수 및 복수형 계약 일치, 미지원 HTML/스크립트 금지, 일반 텍스트로 렌더링. 키 자체 또는 원치 않는 한국어가 영어 화면에 노출되면 FAIL.'],
['공통코드','code는 불변, labelKey/locale 번역/active/order/allowedCompanyValues로 관리. 비활성값은 기존 문서에서 원래 코드·번역으로 조회, 신규 선택 금지. 기본값/필수 조건 참조가 있으면 비활성 게시 차단.'],
['원본 데이터','거래처명·입력 메모·사용자 이름은 번역하지 않음. 날짜만 YYYY-MM-DD, 시각은 UTC 저장+법인 시간대 표시. 숫자 decimal 문자열, 저장 통화 ISO code 유지; 언어 전환으로 환산 금지.'],
['출력','PDF에 지원 언어 글리프를 갖춘 배포 가능 폰트 포함, 표/줄바꿈/페이지 분리 확인. Excel 머리글·상태명·숫자 서식 번역. 요청 locale/release/행 범위/필드 정책 hash를 job에 snapshot. 생성·다운로드 시 최신 설정/권한/행 범위와 다시 비교. 변경 시 이전 파일을 폐기하고 409 OUTPUT_CONTEXT_CHANGED로 재생성을 요구한다.'],
['게시 검사','등록부 444회 참조는 중복을 제거한 실제 키 목록으로 관리. 현재 438회 누락/TSX 한국어 120행은 기준선 지표이지 목표 번역 개수가 아님. 동적 nameKo·서버/출력 리터럴도 검사. 사용자 원문·주석 예외는 근거를 기록.']])}`);
section('D11','11. 업무별 보완 설계·등록부 차이 해소',`
${table(['묶음','대상 화면','기능·차이 처리','통과 기준'],[
['W01 고객','HQ_LEAD / HQ_ACCOUNT / HQ_ACCOUNT360','리드 검색/생성/담당자/상태/전환, 거래처 등록/수정/연락처/원장 다중/병합/ERP 요청. lead.sido/sigungu를 주소 선택 UI와 API/저장 경로에 연결; 저장 필드가 없으면 주소 파생 읽기값으로 명시하고 임의 저장 API를 만들지 않음.','필드 성격과 행정코드 원천 확정 후 binding 완성. 생성→재조회→전환/병합 및 실패 rollback, 연락처 팝업 오류·취소 검증.'],
['W02 활동','HQ_ACTIVITY / HQ_ACTIVITY_REPORT / HQ_DIRECT_WORK','보고 futurePlan/accompaniedYn을 등록부 타입·API 검증에 맞춰 입력/조회에 추가. 일정 3뷰·보고 승인/반려·직출직퇴 위치/시간 실패 대응.','저장·재조회·승인 시 같은 데이터, 승인 상태별 편집 차단, 권한/시간대/위치 거부 검증.'],
['W03 판매','HQ_OPPORTUNITY / HQ_PIPELINE / HQ_CONTRACT','기회 competitorUsage/ownedEquipment/treatmentFeeInfo/installmentMonths, 계약 contractType 입력·조회·서버 계약 연결. 제품 수정 PATCH/삭제 DELETE 분리. 계약·수금 상태 전이 유지.','누락 5필드와 코드/타입 검증, 기회→계약→수금 연결, 상태·금액·읽기전용 부정 검증.'],
['W04 주문·출력','HQ_ORDER / HQ_FULFILLMENT / HQ_LEDGER / HQ_ANALYTICS','주문 생성/제출/연계/납품, 원장/명세서/분석과 다운로드에 필드·행 범위 정책 및 locale/currency 적용.','금액/통화 의미 보존, 실패 재시도·중복 전송 차단, PDF/Excel 언어별 시각 검증.'],
['W05 홈·운영·관리자','HQ_HOME / HQ_OPS / HQ_ADMIN_USERS / HQ_ADMIN_PERMISSIONS / HQ_ADMIN_CODES / HQ_ADMIN_INTERFACES / HQ_ADMIN_AUDIT','홈 3지표 전용 응답을 정의하고 일반 전체 counts로 대체하지 않음. ops.checkedAt은 실제 서버 검사 시각에 연결. 관리자 5화면도 법인 scope·번역·오류·권한 검사.','홈 데이터 범위/집계 정의 확정 후 경계 테스트. 감사/연계에서 타 법인·비공개 필드 비노출.']])}
<h3>API 차이의 결정</h3><p><code>CONTACT.create</code>의 대표 경로는 현재 UI의 <code>POST /api/accounts/:id/contacts</code>로 정한다. 기존 <code>POST /api/contacts</code>는 같은 서비스·회사/부모 거래처 권한 검사를 호출하는 호환 alias로 유지하고 이중 구현하지 않는다. <code>ACC360.open</code>의 대표 읽기는 현재 <code>GET /api/accounts/:id/customer-detail</code>로 정하고 등록부를 맞춘다. 기존 analytics/360 경로는 실제 소비자 조사 후 호환 adapter 또는 명시 폐기 대상으로 C02에 기록한다. 서로 다른 의미의 응답을 무조건 합치지 않는다.</p>
<h3>홈·운영 필드</h3><p>home.newLeadCount는 신규 기준, home.todayActivityCount는 법인 시간대 “오늘”과 포함 상태, home.pipelineAmount는 대상 단계·통화 집계 정책이 필요하다. D15에서 업무 정의 확정 전 UI에 임의 숫자를 넣지 않고 지원 미확정으로 표시한다. 다중 통화 합산은 환율 계약 없이는 금지하고 통화별 집계한다. ops.checkedAt은 클라이언트 렌더 시각이 아닌 서버 검사 결과의 UTC 시각이다.</p>
<h3>전체 세부 동작</h3><p>모든 화면과 팝업은 진입·정상 저장·재조회·필수/형식 오류·서버 오류·취소·미저장 변경·이중 제출·권한 거부·동시 수정·닫기/포커스 복원을 적용 가능한 항목별로 기록한다. 화면/소스 존재만으로 PASS를 부여하지 않는다. UI 미등록 동작은 분류를 마치기 전 해당 업무 묶음을 완료 처리하지 않는다.</p>`);
section('D12','12. 두 법인 시나리오와 잘못된 설정',`
<p>아래는 합성 테스트 fixture의 설계 예시다. 실제 고객 법인이나 운영 역할 정책으로 확정한 값이 아니다. 실제 fieldId는 C00 등록 ID와 대조해 C02 fixture에 고정한다.</p>
${table(['설정','법인 A','법인 B'],[
['거래처 화면/메뉴','enabled=true / menu.visible=true','enabled=true / menu.visible=false; 권한 있는 직접 URL은 허용'],
['병원 규모 선택 필드','표시·선택 입력','field.visible=false; 조회/쓰기/출력 제외'],
['연락처 이메일','필수(생성/수정 UI 및 서버)','선택 입력'],
['ACC.merge','사용; 권한 있는 역할만 실행','미사용; 버튼·직접 API 차단'],
['메뉴 번역','ko 거래처 / en Account 표준 상속','ko 고객사 / en Customer override; 메뉴 재표시 시 적용'],
['기본 언어','ko-KR; 사용자 en-US 선택 가능','en-US; 사용자 ko-KR 선택 가능'],
['역할','편집자: 필드 수정 허용, 병합 권한 없음','조회자: 표시 필드도 쓰기 불가']])}
${table(['거부 사례','오류/기대 결과'],[
['타 법인 draftId 직접 수정','404. 자기 법인으로 재할당해 처리하지 않음'],
['required=true + 숨김 + 서버 기본값 없음','422 REQUIRED_UNREACHABLE'],
['ERP 필수 식별값 사용 해제','422 LOCKED_PROPERTY 또는 DEPENDENCY_MISSING'],
['주문은 사용, 필수 거래처 lookup 사용 중지','422 DEPENDENCY_MISSING'],
['영어 활성 상태에서 필수 버튼 번역이 한국어만 존재','422 TRANSLATION_REQUIRED; fallback으로 우회 불가'],
['작업본 검증 뒤 다른 편집자가 수정','409 VALIDATION_STALE'],
['과거 ACTIVE 기준으로 두 명이 동시 게시','하나 성공, 다른 명령 409 RELEASE_CONFLICT'],
['권한 회수된 게시자가 기존 validation으로 게시','403. validation 발급 당시 권한으로 게시하지 않음'],
['B에서 숨긴 필드 원본을 PATCH/검색/다운로드로 요청','403/허용 목록 위반. 원본 값 미노출'],
['필수 경로가 없는 팝업 비활성화 또는 승인 중 기능 중지','422 DEPENDENCY_MISSING 또는 ACTIVE_WORK_BLOCKED']])}`);
section('D13','13. 검증 설계와 완료 판정',`
${table(['검증 ID','시나리오·관찰 기준','증거'],[
['T01','설정 3상태·잠금·배열 stableId·정렬·참조·순환·required 충돌. 같은 입력은 같은 effective hash','resolver 단위 결과/fixture'],
['T02','법인 A/B, 편집/조회/게시 역할의 메뉴·URL·API·필드·lookup·export 접근 및 직접 우회 요청','HTTP 요청/응답, 비밀값 제거된 로그'],
['T03','동시 저장/게시·idempotency·validation stale·커밋 중 장애·감사 원자성·재시작·백업 복원','영속 adapter 통합 로그와 전후 release/hash'],
['T04','게시/복원/표준 rebase/권한 회수/법인 전환 중 폼 저장·늦은 응답·캐시·오프라인 실패','브라우저 trace와 HTTP context 비교'],
['T05','모든 등록부/실제 UI 문자열 및 코드/서버 오류/접근성 문구. ko/en, 긴 문구·날짜·숫자·통화·PDF/Excel','키 검사+동적 렌더+언어별 스크린샷/출력 원본'],
['T06','C00 필드 202/액션 84/팝업 7 및 추가 등록 요소의 기능별 정상·오류·취소·상태 분기','ID별 검증표. source만 확인한 항목은 SOURCE_ONLY, 미실행 NOT_RUN'],
['T07','미등록 UI 114개 전수 분류, 실제 탭, G15 누락 11개 및 미확인 2개, endpoint alias','등록부 diff와 실기능 재조회 증거'],
['T08','기존 GLOBAL/legacy·기존 HQ 업무·관리자 경로 회귀, 두 법인 데이터 격리','기준선 대비 테스트 결과; 과거 기록 합산 금지'],
['T09','실인증·영속 DB·ERP/HIRA/외부 서비스·운영 폰트·실기기·DEV/UAT·복구','실환경 담당자와 시각·버전·시나리오·결과. 목업 결과로 대체 불가']])}
<p><strong>T03/T04 필수 경합 사례:</strong> 오래된 폼 저장과 기능 중지 게시 동시 실행, 승인 대기 생성과 승인 기능 중지 동시 실행, 권한 회수와 게시/업무 변경 동시 실행을 양쪽 커밋 순서로 검증한다. 새 정책이 먼저 커밋되면 옛 정책 쓰기는 실패해야 하며, 업무가 먼저 커밋되면 게시가 새 데이터 영향을 검사해야 한다. 잠금 교착·재시도·부작용 중복도 확인한다. T03에는 표준 artifact 변조/미허용 ID/동시 발행 거부 및 기존 회사 ACTIVE 불변을 포함한다.</p>
<p><strong>T02/T05 출력 회귀:</strong> 파일 생성 뒤 필드 숨김·역할 회수·행 소유권 변경·기능 중지 후 다운로드를 시도한다. 과거 파일이 반환되면 FAIL이다. 출력 저장소는 비공개이며 인증 없는 장기 URL을 제공하지 않는다. 다운로드 허용 검사는 같은 회사 fence에서 수행하고 당시 문맥으로 일회성 스트림을 연다. 이미 전달된 바이트의 회수는 보장할 수 없고 이후 요청은 차단한다.</p>
<p>검증 레코드: caseId, requirementId, stableId/uiBindingId, companyFixture, role, locale, viewport/device, precondition, steps, expected, actual, status(PASS/FAIL/NOT_RUN/BLOCKED), evidence, codeRevision, configReleaseId, reviewer. 소스 대응은 별도 sourceStatus로 분리한다.</p>
<p>필수 기능·필드 저장/재조회·모든 액션·모든 팝업 분기는 전수 확인한다. 공통 렌더 조합은 대표 조합으로 축소할 수 있으나 권한 경계·법인 격리·상태 전이·각 활성 언어·PC/모바일은 별도 케이스를 둔다. 제외/N/A는 사유와 작업자 B 확인이 필요하다.</p>
<p><strong>단계 게이트:</strong> 작성자 자체 점검 → 작업자 B 독립 검증 → 지적 보완 → 재검증 PASS → 다음 단계. blocker/높은 영향 결함은 남긴 채 진행하지 않는다. C01 PASS는 C02 작성 준비, 업무 묶음 PASS는 해당 목업 범위, 운영 PASS는 T09까지 통과한 실사용 범위로 구분한다.</p>`);
const trace={G01:['D02','T08'],G02:['D09','T02'],G03:['D03,D04','T01,T06'],G04:['D04','T01,T06'],G05:['D08','T04'],G06:['D06,D07','T03'],G07:['D10','T05'],G08:['D08,D10','T04,T05'],G09:['D04','T02'],G10:['D03,D11','T06,T07'],G11:['D05','T02'],G12:['D10','T05'],G13:['D15','T09'],G14:['D13','T06,T08'],G15:['D11','T07']};
section('D14','14. C00 발견 사항 추적과 구현 순서',`
${table(['발견 ID','발견 사항','설계 위치','검증 ID'],findings.map(f=>[f.id,f.title,...trace[f.id]]))}
<p>구현 순서는 <strong>I01 등록부/계약/다국어 기반 → I02 resolver/API/영속 저장 → I03 관리자 최소 편집·검증·게시 + 사용자 공통 소비 → I04 고객 W01 → I05 활동 W02 → I06 판매 W03 → I07 주문·출력 W04 → I08 홈·운영·관리자 W05 및 이력/rebase 완성 → I09 통합·운영 인수</strong>다. 각 업무 묶음은 기능·설정·다국어·API 검증을 함께 완료한다. 다국어를 마지막 단계로 미루지 않는다.</p>
<p>C02에서는 이 순서를 작업 패키지로 나누고 입력/출력·변경 파일·회귀 범위·테스트 명령·롤백·작업자 B 통과 조건을 지정한다. I01에서 ID 대응과 미등록 UI 분류, I02에서 영속 adapter, I04 이후에서 기능별 상세 검증을 반드시 포함한다. 일정/완료율은 추정해 기입하지 않는다.</p>`);
section('D15','15. 미확정 업무 결정과 다음 단계 게이트',`
${table(['결정 ID','확정할 내용','담당 역할·시점','미확정 시 차단/계속 가능 범위'],[
['Q01','실제 대상 법인·membership·편집/게시/복원 위임 및 겸임 정책','본사 시스템 관리자/보안 담당; 실제 법인 onboarding 전','실제 법인 권한 배포 차단. 합성 A/B 및 권한별 거부 테스트 가능'],
['Q02','본사 필수 필드·ERP 식별자·가격/재고/승인 정책','업무 책임자+연계 담당; 해당 W01–W04 상세 작업 착수 전','해당 기능의 운영 설정/인수 차단. 기존 invariant 보존·추가 잠금 구조 구현 가능'],
['Q03','신규 리드/오늘 활동/파이프라인 집계 정의, 시도·시군구 코드 원천','영업 운영 담당+데이터 담당; W01 주소/W05 집계 구현 전','해당 지표/주소 쓰기 기능 완료 판정 차단. 임의 집계/가짜 입력 금지'],
['Q04','운영 DB 스키마·migration 순서·복구 목표·배포 환경','DB/운영 담당; I02 영속 adapter 배포 계획 확정 전','운영 migration/성능·복구 인수 차단. repository 계약과 격리 테스트 가능'],
['Q05','추가 언어·번역 검수자·PDF 폰트 배포 권리·법인 시간대/거래 통화','법인 운영/번역 담당; 해당 언어/법인 활성화 전','추가 언어와 실제 법인 출력 운영 게시 차단. ko/en 합성 fixture 설계 가능'],
['Q06','실 ERP/HIRA/지도/메일 테스트 계정·계약·실인증·UAT 담당','연계/보안/현업 담당; 연계 구현 및 I09 전','실연계·운영 PASS 차단. 명시 목업 테스트 가능']])}
<p>Q01–Q06은 실제 담당자 확인 전 “역할”만 지정한 결정 목록이다. 사용자의 업무 확인을 받으면 근거·결정일·영향 문서를 기록한다. 이 항목들은 C01/C02 문서 작성을 막지 않지만 해당 구현/운영 게이트에서 반드시 해소해야 한다.</p>
<h3>C01 완료 조건</h3><ul><li>G01–G15 모두 설계·검증 ID에 연결.</li><li>상속·권한·영속 게시·API·다국어·관리자 UI·업무 차이·운영 한계와 두 법인 예시 명시.</li><li>작업자 B의 blocker 해소 및 PASS 기록.</li><li>문서 링크·ID·반응형 표시 검사 통과. 애플리케이션 동작 검증과 구분.</li></ul>
<p>다음 산출물은 <strong>C02 작업지시서</strong>다. 이후 C03에서 계획서·C00·C01·C02 간 누락·모순을 검토한 뒤 단계별 구현을 시작한다.</p>`);
const manifest={stage:'C01',schemaVersion:1,scope:'Design readiness for C02; not application acceptance',sections:sections.map(({id,title})=>({id,title})),trace:findings.map(f=>({findingId:f.id,designIds:trace[f.id][0].split(','),testIds:trace[f.id][1].split(',')})),baseline:{screens:baseline.standard.screens.map(x=>x.screenKey),fields:semantic.fields.map(x=>x.fieldKey),actions:semantic.actions.map(x=>x.actionKey),popups:semantic.popups.map(x=>x.id)},decisions:['Q01','Q02','Q03','Q04','Q05','Q06'],tests:Array.from({length:9},(_,i)=>'T0'+(i+1))};
fs.writeFileSync(path.join(dir,'evidence/design-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>C01 CRM 법인별 설정·다국어 작업설계서</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f6fa;color:#203349;font:15px/1.85 "Malgun Gothic",sans-serif;overflow-wrap:anywhere}main{max-width:1200px;margin:auto;padding:32px 24px 64px}header{background:#173b58;color:white;padding:34px;border-radius:18px}h1{font-size:30px;line-height:1.45}h2{font-size:23px;line-height:1.5;margin-top:0}h3{font-size:18px}section{background:white;padding:28px;border:1px solid #d8e2eb;border-radius:14px;margin:22px 0;scroll-margin-top:15px}nav{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0}nav a{background:white;padding:8px 12px;border:1px solid #d8e2eb;border-radius:7px}a{color:#245eb3}header a{color:#bce7ff}.lead{font-size:18px;font-weight:bold}.note{padding:15px;background:#edf5ff;border-left:4px solid #3274b6}.status{padding:18px;background:#fff4da;border-radius:10px;margin-top:18px}.flow{padding:20px;background:#eaf5f3;color:#125d53;font-weight:bold;border-radius:9px}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:12px;border-bottom:1px solid #dbe5ee;text-align:left;vertical-align:top;min-width:135px}th{background:#edf3f9}code{font-size:13px;background:#eef3f7;padding:2px 4px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eef3f7;padding:16px}li{margin:8px 0}.muted{font-size:13px;color:#52677c}header .muted{color:#c7dfef}button{font:inherit;padding:8px 15px;cursor:pointer}a:focus-visible,button:focus-visible{outline:3px solid #008b9a;outline-offset:3px}@media(max-width:700px){main{padding:14px}header,section{padding:20px}h1{font-size:25px}h2{font-size:21px}nav{display:block}nav a{display:block;margin-bottom:7px}}@media print{body{background:white}main{padding:0}header{color:#203349;background:white;border:1px solid #ddd}header a{color:#245eb3}nav,button{display:none}section{border:0;padding:10px}.scroll{overflow:visible}th,td{font-size:10pt;min-width:0}h2,h3{break-after:avoid}tr{break-inside:avoid}}
</style></head><body><main><header><p>C01 · 작업설계서 · 2026-10-24 · 설계 버전 1.0</p><h1>표준 CRM의 법인별 설정과<br>다국어 적용 작업설계서</h1><p>현재 구현 대조 → <strong>작업설계서</strong> → 작업지시서 → 문서 교차 검토 → 단계별 구현</p><p><a href="../08_CRM_Customization_Implementation_Plan.html">전체 계획</a> · <a href="01_Current_Comparison.html">C00 대조서</a> · <a href="evidence/design-manifest.json">설계 추적 목록</a></p><p class="muted">기준선: C00 독립 검증 PASS. 아래는 구현할 목표 계약이며 현재 기능 완료를 의미하지 않습니다.</p></header><div class="status"><strong>작업자 B 검증: ${e(review?.verdict??'검토 대기')}</strong><p>${e(review?.scope??'초안 작성 후 독립 검토를 진행합니다.')}</p>${review?'<a href="evidence/worker-b-C01.json">독립 검증 기록</a>':''}</div><nav aria-label="설계서 목차">${sections.map(s=>`<a href="#${s.id}">${e(s.title)}</a>`).join('')}</nav>${sections.map(s=>`<section id="${s.id}"><h2>${e(s.title)}</h2>${s.body}</section>`).join('')}<section id="references"><h2>근거와 기존 설계</h2><p><a href="evidence/worker-b-C00.json">C00 작업자 B 판정</a> · <a href="evidence/semantic-map.json">필드·액션·팝업 대응</a> · <a href="../03_Data_API_Design.md">기존 데이터·API 설계</a> · <a href="../04_Runtime_Design.md">기존 런타임 설계</a></p><p>기존 브랜치는 C00의 캐시된 ref와 소스 표본 기준입니다. 원격 최신 구현이나 운영 동작을 확인했다고 주장하지 않습니다. 본 단계는 문서·검증 자료만 작성하며 제품 코드를 변경하지 않습니다.</p></section><button type="button" onclick="window.print()">인쇄 / PDF 저장</button></main></body></html>`;
fs.writeFileSync(path.join(dir,'02_Work_Design.html'),html);
console.log(JSON.stringify({file:'02_Work_Design.html',sections:sections.length,findings:manifest.trace.length,characters:html.length,sha256:crypto.createHash('sha256').update(html).digest('hex')},null,2));
