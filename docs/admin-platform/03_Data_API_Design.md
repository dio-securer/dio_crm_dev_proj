# 03. 데이터·API 상세설계

## 1. 공통 계약
식별자는 API에서는 public UUID, SQL 내부에서는 기존 bigint를 유지한다. companyId라는 API 속성은 회사 public UUID를 의미하며 내부 CompanyKey bigint와 혼용하지 않는다. 기존 API와 연결하는 adapter에서만 변환한다.
UTC ISO timestamp, decimal은 문자열로 전송한다. 날짜만 있는 값은 YYYY-MM-DD다. 정렬은 stableKey로 보조 정렬한다.

생성을 제외한 관리 갱신 요청에 revision/If-Match를 요구한다. 신규 변경 명령에는 Idempotency-Key를 요구한다. 상세 예외와 응답은 §7을 따른다. 검증 오류는 {code,messageKey,fieldErrors,requestId} 형식으로 반환한다.
HTTP: 400 구문, 401 인증, 403 권한, 404 미존재/타 법인 레코드, 409 revision·상태 충돌, 422 의미 검증. 서버는 payload의 companyId를 신뢰하지 않고 활성 membership과 경로 회사를 검증한다.

## 2. 핵심 TypeScript 계약 (제안)
~~~ts
type ConfigScope = 'COMMON'|'TEMPLATE'|'COUNTRY'|'COMPANY';
type Domain = 'FEATURE'|'MENU'|'SCREEN'|'FIELD'|'RULE'|'TERM'|'CODE'
  |'WORKFLOW'|'APPROVAL'|'NOTIFICATION'|'NUMBERING'|'CALENDAR'
  |'INTEGRATION'|'SECURITY'|'LIST_VIEW'|'ACTION';
interface ConfigDocument {
  id: string; scope: ConfigScope; scopeKey: string; domain: Domain;
  stableKey: string; schemaVersion: 1; revision: number;
  payload: unknown; // domain별 Zod schema로 parse 후 사용
  parentVersionIds: string[];
}
interface EffectiveContext {
  companyId: string; membershipId: string; locale: string;
  releaseId: string; permissionVersion: number; contextEpoch: number;
  features: string[]; permissions: string[];
}
interface AdminRepository {
  read(collection: string, companyId: string, id: string): Promise<unknown>;
  query(collection: string, companyId: string, filter: unknown): Promise<unknown[]>;
  transact<T>(companyId: string, run: (tx: AdminTransaction) => Promise<T>): Promise<T>;
}
interface AdminTransaction {
  insert(collection: string, row: unknown): Promise<void>;
  compareAndSwap(collection: string, id: string, revision: number, row: unknown): Promise<void>;
  appendEvent(event: unknown): Promise<void>;
}
~~~
collection은 코드 allowlist enum으로 구현한다. 사용자 입력 collection/table 이름을 SQL 식별자로 사용하지 않는다. Node memory adapter도 법인별 mutex와 copy-on-write rollback을 제공한다. Browser adapter는 04 §9.1의 dataset Web Lock 안에서 revision을 비교하고 단일 envelope를 저장한다.

## 3. 논리 데이터 사전
아래는 구현 대상 논리 모델이다. SQL 적용은 이번 범위가 아니며 신규 migration은 후속 요청 시 실제 다음 번호를 확인하고 작성한다.

모든 회사 소유 테이블: company_id FK, public_id UNIQUE, created_at/updated_at UTC, updated_by, row_version. 구성 payload는 schema_version과 ISJSON 검사를 사용한다. 아래 명시 외 필수 FK는 부모 소유 회사가 같은지 서비스에서 추가 검증한다.

| 테이블/집합 | 주요 컬럼·키 | 관계·제약 |
|---|---|---|
| crm_company (기존) | 기존 코드, country/profile 필드, active_release_id 추가 후보 | 국가와 법인 분리, code UNIQUE 보존 |
| crm_organization (기존) | parent, manager_membership_id 추가 후보 | 같은 회사 부모, 순환 방지 |
| crm_user (기존) | 기존 user_id/login/hash 보존 | 기존 company_id를 home company로 유지 |
| crm_user_membership (신규) | user_id, company_id, organization_id, active, permission_version | UNIQUE(user_id,company_id); 인증 identity 재작성 없이 복수 회사 지원 |
| crm_company_role (신규) | company_id, role_code, name, source_role_id | UNIQUE(company_id,role_code); 기존 전역 role을 template로 참조 |
| crm_membership_role (신규) | membership_id, company_role_id | PK 복합; 동일 회사 강제 |
| crm_role_grant (신규) | company_role_id, permission_code, effect, data_scope_json | UNIQUE(role,permission); effect ALLOW/DENY |
| crm_admin_delegation (신규) | grantor, target_role, domains_json, actions_json, locks_json, expires_at | 위임 상한 계산, 만료 즉시 제외 |
| crm_config_draft (신규) | scope_type, scope_key, domain, stable_key, payload_json, base_version_ids, revision | 같은 scope/domain/key의 active draft 유일 |
| crm_config_version (신규) | source_draft_id, revision, payload_json, content_hash, author | immutable; 삭제 금지 |
| crm_config_release (신규) | company_id, version_map_json, effective_json, hash, state, effective_at, reason | 설정 묶음 전체의 원자적 적용 단위 |
| crm_config_validation (신규) | draft_set_hash, dependency_hash, errors_json, preview_context, validated_at | 게시 시 hash 일치 필수 |
| crm_config_event (신규) | actor, action, target, before_hash, after_hash, reason, request_id | append-only, 보안 값은 마스킹 |
| crm_extension_definition (신규) | company_id, entity_type, field_key, type, config_version_id | UNIQUE(company,entity,key,version), 타입 변경 제한 |
| crm_extension_value (신규) | company_id, entity_type, entity_public_id, field_key, text/decimal/date/bool/enum_value | UNIQUE(company,entity,id,key), 타입에 해당하는 값만, 표준 필드 저장과 원자적 |
| crm_approval_instance (신규) | company, entity_type/id, document_revision, definition_snapshot_json, release_id, state, due_at | 진행 중 문서 중복 제출 차단, 승인 규칙 snapshot 불변 |
| crm_approval_task (신규) | instance_id, step_id, assignee_membership_id, state, decision, comment, decided_at | UNIQUE(instance,step,assignee), compare-and-swap 결정 |
| crm_approval_event (신규) | instance_id, task_id, event_type, actor, reason, at | 제출/결정/회수/대결 변경 추적 |
| crm_notification_outbox (신규) | event_id, recipient_membership, channel, locale, rendered_text, status, mock | UNIQUE(event,recipient,channel); EMAIL은 MOCK_SENT만 |
| crm_interface_log (기존 확장) | mode, scenario, idempotency_key, payload_hash, config_version_id, applied_at | mode MOCK/NONE; UNIQUE(company,interface,idempotency) |
| crm_interface_attempt (신규) | request_id, attempt_no, response_hash, result, event_time, error_code | UNIQUE(request,attempt); 원요청 불변 |
| crm_sequence (신규) | company, entity, period_key, next_value | UNIQUE(company,entity,period); 원자 증가 |
| crm_ownership_transfer (신규) | job_id, source, target, filter_snapshot, state, counts | 재시도 동일 job 재사용 |
| crm_ownership_transfer_item (신규) | job_id, entity/id, old_owner, new_owner, revision, result | UNIQUE(job,entity,id), 성공 건 재적용 금지 |
| crm_command_receipt (신규) | company, actor, operation, idempotency_key, payload_hash, response | 중복 명령에 기존 결과, 다른 payload면 409 |

필드·그룹·메뉴·번역·코드·보안정책·캘린더·번호 패턴은 config payload로 버전 관리한다. 데이터 행/승인 task/sequence를 설정 JSON에 섞지 않는다. read model index는 필요시 추가한다. 목업에서 사용하는 JSON shape와 SQL adapter 반환 shape를 동일하게 유지한다.

역할/사용자 중지/소속/위임 변경은 보안 트랜잭션으로 즉시 적용하고 permission_version 증가 및 세션 폐기한다. config release rollback 대상이 아니다. SECURITY domain에는 세션 정책 등 게시 가능한 정책만 들어간다.

## 4. 설정 payload 계약
| Domain | 필수 구조 |
|---|---|
| FEATURE | items[{key,enabled}], dependencyOverrides는 허용하지 않음 |
| MENU | nodes[{id,parentId,routeKey,labelKey,order,featureKey,permission}] |
| SCREEN | entity,screenKey,tabs[{id,labelKey,order}],sections[{id,tabId,titleKey,order,columns}] |
| FIELD | entity,fields[{key,sectionId,visible,required,readOnly,labelKey,default,maxLength,order}] |
| RULE | entity,rules[{id,trigger,condition,effects,errorKey}] |
| TERM | terms[{semanticKey,termKey}],translations[{termKey,locale,text}] |
| CODE | groups[{key,values[{code,labelKey,active,order}]}] |
| WORKFLOW | entity,startState,states,transitions[{from,to,actionKey,guard}] |
| APPROVAL | policies[{id,priority,condition,routeKey}],routes[{key,steps}] |
| NOTIFICATION | events[{eventKey,recipientSelector,channels,templateKey}] |
| NUMBERING | entity,prefix,periodFormat,padding,resetPolicy |
| CALENDAR | timezone,workingWeekdays,holidays |
| INTEGRATION | interfaceCode,mode,enabled,scenario,fieldMapping,delayMs |
| SECURITY | idleTimeoutMinutes,maxSessionMinutes,maxFailedAttempts,lockMinutes,mfaPolicy |

배열은 위치가 아니라 id/key로 병합하며 관리자에게 원시 JSON 편집을 요구하지 않는다.

## 5. API 목록
기본 prefix: /api/admin. :company는 검증된 회사 publicId.
| Method/경로 | 입력 | 결과·주요 권한 |
|---|---|---|
| GET /companies | page,search | 접근 가능한 회사만 |
| POST /companies | code,name,country,template | companyId,revision; company.manage |
| GET/POST /companies/:company/organizations | filter 또는 조직 DTO | 조직 목록/생성 |
| PATCH /companies/:company/organizations/:id | 변경 필드,revision | 순환 검증 후 저장 |
| GET/POST /companies/:company/users | filter 또는 사용자 DTO | 사용자 목록/합성 사용자 생성 |
| PATCH /companies/:company/users/:id | name,active,revision | 사용자 변경·세션 무효화 |
| POST /companies/:company/memberships | userId,orgId | 소속 생성; membership.assign |
| PATCH /companies/:company/memberships/:id | orgId,active,revision | 소속 변경·권한 버전 갱신 |
| GET/POST /companies/:company/roles | filter 또는 역할 DTO | 역할 목록/생성 |
| PATCH /companies/:company/roles/:id | grants,denies,revision | 위임 상한 검사 |
| POST /companies/:company/role-assignments | membershipId,roleId | 배정; role.assign |
| POST /companies/:company/role-assignments/:id/revoke | reason,revision | 회수 |
| GET/POST/PATCH /companies/:company/delegations[/:id] | 위임 DTO | 위임 조회·추가·변경; 비활성으로 회수 |
| GET /companies/:company/effective-permissions | membershipId | 액션·데이터·필드별 유효 권한/출처 |
| GET /catalogs | type | 등록 화면·액션·필드·조건 연산자 목록 |
| GET /config/drafts | scope,scopeKey,domain | 편집 권한 있는 초안 목록 |
| POST /config/drafts | scope,scopeKey,domain,stableKey,baseVersions,payload | draftId,revision |
| PATCH /config/drafts/:id | payload,revision | 초안 저장, validation 무효화 |
| POST /config/validate | draftIds,revisions | validationId,errors,warnings,impact |
| POST /config/preview | validationId,company,role,locale,sample | effectiveConfig,provenance,issues; 부작용 없음 |
| POST /companies/:company/releases | validationId,expectedReleaseId,publishAt,reason | releaseId,ACTIVE/SCHEDULED |
| POST /companies/:company/releases/:id/cancel | reason,revision | 예약 취소만 |
| POST /companies/:company/releases/:id/rollback | targetReleaseId,reason,expectedReleaseId | 이전 내용을 새 release로 게시 |
| GET /companies/:company/releases | page | 버전·상태·적용 이력 |
| POST /companies/:company/ownership-transfers/preview | source,target,filter | snapshotId,counts,conflicts |
| POST /companies/:company/ownership-transfers | snapshotId,reason | jobId,results |
| POST /companies/:company/numbering/preview | pattern,sampleDate | sampleNumber; 번호 소모 없음 |
| POST /companies/:company/numbering/allocate | entity | number; 번호 발급 권한 |
| POST /companies/:company/calendars/calculate | start,businessDays | dueAt |
| POST /companies/:company/sessions/:id/revoke | reason | 세션 폐기 |
| POST /companies/:company/approval-simulations | sampleDocument | 승인 인스턴스 생성 |
| GET /companies/:company/approvals | assignedTo,status | 권한 범위 승인 목록 |
| POST /companies/:company/approvals/:id/decisions | taskId,decision,comment,revision | 인스턴스·과제 상태 |
| POST /companies/:company/approvals/:id/withdraw | reason,revision | 회수 |
| POST /companies/:company/approvals/:id/resubmit | documentRevision,reason | 새 instanceId |
| POST /companies/:company/approvals/:id/reassign | taskId,toMembershipId,reason,revision | 새 과제 배정 이력 |
| GET /companies/:company/notifications | unread,page | 본인 알림 |
| POST /companies/:company/notifications/:id/read | revision | 읽음 처리 |
| POST /companies/:company/notifications/preview | templateKey,sample,locale | 렌더링 결과 |
| GET /companies/:company/mock-erp/requests | state,entity | 요청 목록 |
| POST /companies/:company/mock-erp/requests | interfaceCode,entityId,payload,scenario | requestId,REQUESTING,mode=MOCK |
| POST /companies/:company/mock-erp/requests/:id/respond | outcome,eventId,expectedRevision | 모의 응답 적용 |
| POST /companies/:company/mock-erp/requests/:id/retry | reason | 기존 idempotency identity 유지한 새 attempt |
| POST /mock-datasets/:id/reset | expectedRevision,reason | 접근 가능한 목업 dataset 초기화 |

GET /api/me/context는 기존 응답 및 숫자 companyId를 보존하고 adminContext에 신규 UUID 기반 문맥을 추가한다. 법인 전환은 POST /api/me/company-context {companyId}에서 membership 확인 후 새 token/context를 발급한다.
ADM-05/13의 dataScopes/fieldPermissions는 role DTO의 typed 하위 구조로 저장하고 ADM-07~24의 구성은 domain별 config API를 사용한다. 확장 필드 정의도 FIELD payload의 extensionDefinitions로 초안 관리하고 게시 시 definition read model을 생성한다.

## 6. 트랜잭션과 인덱스
- 게시: validation hash 확인 → 현재 active 비교 → 불변 version/release 삽입 → active 포인터 교체 → event 기록을 한 transaction에서 수행.
- 승인: task revision 조건 UPDATE → 집계 → instance 상태 변경 → notification outbox를 한 transaction에서 수행.
- 모의 응답: company/request/event/idempotency 확인 → 업무 상태 반영 → log applied_at → outbox를 한 transaction에서 수행.
- API memory에서도 동일 rollback 계약을 테스트한다.
- 주요 조회 index: company+active, company+entity+state, instance+task state, company+request status, scope+domain+stableKey.
- 모든 쿼리·검색·확장 필드 조회는 회사 조건을 포함하며 company filter를 마지막 UI 단계에만 적용하지 않는다.

## 7. v1.1 계약 보완

### 7.1 식별자·저장·HTTP
- 신규 admin API의 companyId/userId 등 id는 UUID 문자열이다. 기존 JWT.companyId와 기존 업무 API 숫자 ID는 유지하고 companyPublicId/membershipId/sessionId/tokenUse를 추가한다. /api/me/context의 기존 companyId를 UUID로 덮어쓰지 않고 adminContext.companyId에 새 계약을 둔다.
- 신규 로그인은 homeCompanyCode+loginId로 identity를 찾는다. 기존 company 없는 로그인은 일치 identity가 정확히 하나일 때만 허용하고 복수이면 422 COMPANY_REQUIRED를 반환한다. 임의 TOP 1 선택 금지.
- 생성은 If-Match 없이 수행, 갱신은 If-Match: "revision"과 동일 body.revision을 요구한다. 누락/헤더-body 불일치는 400 REVISION_REQUIRED/REVISION_MISMATCH, 현재 revision 불일치는 409 REVISION_CONFLICT.
- 성공: 조회/갱신/명령 200, 리소스 생성 201, 대기 job 202. 단건 {data,meta:{revision,requestId}}, 목록 {items,page,pageSize,total,requestId}. page 기본 1, pageSize 기본 20/최대 100. sort는 허용 필드+id 보조 정렬, 검색·total 계산 전에 회사/행/필드 권한 적용.
- 오류 {code,messageKey,fieldErrors:[{path,code,messageKey}],requestId}; 타 법인/비가시 레코드는 404, 액션 권한 위반은 403, 정책 readOnly 위반은 422 FIELD_READ_ONLY. hidden 또는 write=false 필드 전송은 403 FIELD_WRITE_DENIED.
- PATCH의 누락 필드는 유지, null은 nullable일 때만 삭제값으로 허용. 알 수 없는 속성은 422 UNKNOWN_FIELD. 설정 payload 갱신은 부분 deep merge가 아니라 해당 domain 문서 전체 교체이며 상속 patch는 별도 overrides 구조로 표현한다.
- 모든 신규 변경 명령에 Idempotency-Key를 사용한다. receipt 키는 (company 또는 명시 global scope, actor, operation, key). payload hash는 method/path/body를 key 순서 정규화한 JSON의 SHA-256으로 산출한다. 회사·권한·세션 검사를 먼저 수행하고 성공 receipt만 재사용한다. 같은 key/다른 hash는 409 IDEMPOTENCY_CONFLICT. 저장·event·receipt는 같은 transaction이다. 실패/rollback에는 성공 receipt를 남기지 않는다. 목업 receipt는 dataset reset까지 보존한다.

### 7.2 누락 domain 구조
기존 Domain union에 LIST_VIEW, ACTION을 추가한다. SECTION은 SCREEN.sections, EXTENSION은 FIELD.extensionDefinitions, field permission/data scope는 즉시 반영하는 role 하위 구조다.

| 대상 | 확정 구조 |
|---|---|
| LIST_VIEW | entity, views[{key,labelKey,columns:string[],filter:ConditionNode,sort:[{field,direction:ASC 또는 DESC}],pageSize,shared:boolean}] |
| ACTION | entity, actions[{key,labelKey,featureKey,permission,condition:ConditionNode,confirmKey,enabled:boolean}] |
| FIELD 추가 | extensionDefinitions[{key,type,labelKey,nullable,active,searchable,maxLength?,precision?,scale?,enumValues?}] |
| role 추가 | dataScopes[{entity,actions,scope,orgIds,sharedRecordIds}], fieldPermissions[{entity,field,read,write,maskType}] |
| APPROVAL.steps | [{id,order,mode,approvers:[{type:MEMBERSHIP 또는 ROLE,key}],dueBusinessDays,alternateMembershipId?}] |
| SECURITY.mfaPolicy | {default:OFF 또는 OPTIONAL 또는 REQUIRED,roleOverrides:[{roleCode,policy}],provider:DEMO} |

JSON optional은 누락 허용, nullable은 명시 null 허용이다. enumValues는 중복 없는 stable code 배열. decimal은 precision 18/scale 4 문자열, 지수 표기·NaN 거부, 범위 초과/다섯째 소수 자리 입력은 422(묵시 반올림 없음). date는 실제 달력 날짜만 허용한다. text 기본 최대 1000자, boolean은 true/false만 허용한다. 활성/비활성 포함 법인·엔티티별 확장 정의 최대 50개다. maskType은 NONE/LAST4, LAST4는 text에만 허용하며 원문 대신 마스킹 값만 응답한다.

ConditionNode는 {op:all|any,args:ConditionNode[]} 또는 {op:not,arg:ConditionNode} 또는 {op:eq|ne|in|isEmpty|gt|gte|lt|lte,field:string,value?:scalar|scalar[]}의 판별 union이다. all/any는 빈 배열 금지, in은 같은 타입의 비어 있지 않은 배열, isEmpty는 value 금지다. 필드 참조는 registry allowlist이며 decimal/date/문자열 타입의 암묵 변환을 금지한다.

### 7.3 Repository·세션 모델
IdentityRepository: findByHomeCompanyAndLogin, findById, listMemberships, readMembership, updateIdentity, updateMembership.
SessionRepository: create, readActive, rotateRefresh, revoke, revokeForIdentity, revokeForMembership, consumeMfaChallenge.
운영 값은 config JSON과 분리하여 sessions, mfaEnrollments, mfaChallenges, authAttempts 집합에 저장한다. 세션은 userId/membershipId/tokenUse/permissionVersion/securityVersion/mfaVerifiedAt/provider/expiresAt/revokedAt을 가진다. 챌린지는 userId/targetMembershipId/purpose/expiresAt/attemptCount/consumedAt/securityVersion을 가진다. 인증값은 공개 DTO와 감사 이벤트에서 제외한다.
AdminRepository.transact의 tx에 read/query도 포함하여 비교와 갱신을 같은 잠금 내에서 수행한다. 다회사 identity 회수는 identity lock → company UUID 오름차순 lock으로 처리하며 다른 순서 잠금은 금지한다.

### 7.4 추가 API (신규 구현 대상)
아래 /api/admin prefix는 명시된 /api/auth, /api/me 외 경로에 적용한다.

| Method/경로 | 입력/결과 | 권한·규칙 |
|---|---|---|
| POST /api/auth/login | homeCompanyCode,loginId,password → AUTHENTICATED 또는 MFA_ENROLL_REQUIRED/MFA_REQUIRED | 중간 응답에 access/refresh 없음 |
| POST /api/auth/mfa/enroll | 제한 token → enrollmentId/challengeId/expiresAt | DEMO 등록 준비만, 검증 전 등록 완료 아님 |
| POST /api/auth/mfa/verify | 제한 token,challengeId,demoCode → 업무 token/context | 원자적 1회 소비 |
| POST /companies/:company/users/:id/mfa-reset | reason,revision → 등록 해제 | security.mfa.reset, 모든 identity 세션/챌린지 회수 |
| GET /companies/:company/sessions | userId,page → 세션 요약 | session.read, token 원문 없음 |
| GET/POST /companies/:company/runtime/accounts | 목록 조건 또는 {values,releaseId} | account.read/create, 필드·회사 검증 |
| GET/PATCH /companies/:company/runtime/accounts/:id | 변경 시 {values,revision,releaseId} | account.read/update |
| POST /companies/:company/runtime/accounts/:id/erp-requests | revision,releaseId,scenario | account.requestErp, 서버에서 업무 payload 구성 |
| GET/POST /companies/:company/runtime/approval-documents | 목록 또는 합성 문서 | approvalDocument.read/create |
| PATCH /companies/:company/runtime/approval-documents/:id | values,revision,releaseId | 작성자이며 잠기지 않은 상태 |
| POST /companies/:company/runtime/approval-documents/:id/submit | revision,releaseId | approvalDocument.submit |
| GET /companies/:company/approvals/:id | instance/task/event 상세 | 작성자/배정 승인자/명시 운영 조회 권한 |
| GET /companies/:company/mock-erp/requests/:id | request/attempt/event 상세 | integration.read |
| POST /mock-datasets/:id/clock/advance | expectedRevision,seconds | mock.clock.advance, API_MOCK 한정 |

기존 approval-simulations API는 합성 문서 생성+submit의 운영자용 facade다. 일반 사용자 제출과 같은 엔진을 호출한다. 일반 업무 사용자의 ERP 요청은 simulate 권한 없이 profile의 시나리오를 사용하며, 임의 scenario 지정/응답 주입은 integration.simulate만 허용한다.

§7.4 보충: POST /api/auth/mfa/skip은 OPTIONAL/미등록 제한 세션만 허용하고 업무 token/context를 반환한다(04 §9.2). 인증/세션 폐기/시계 전진 같은 append-only 명령은 대상 revision이 없는 경우 If-Match를 요구하지 않으며 활성 세션·challenge 또는 expectedRevision을 원자 검증한다. approval decision은 {taskRevision,revision} 둘 다 받고 If-Match는 instance revision이다. 새 문서가 없는 approval resubmit은 명시 documentRevision을 검증한다. 위 예외를 제외한 mutable 리소스 갱신은 §7.1 규칙을 적용한다.
