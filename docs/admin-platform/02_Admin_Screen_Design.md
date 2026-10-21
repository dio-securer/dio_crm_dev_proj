# 02. 관리자 화면·기능 상세설계

## 1. 공통 화면 규칙
경로 prefix는 /admin, 각 화면은 ADM 번호를 식별자로 사용한다. 상단에 현재 법인·국가·템플릿·언어·MOCK 모드·적용 버전을 표시한다. 편집 시 초안 revision과 상속 원본을 함께 표시한다.
목록(검색/상태/정렬/페이지) → 상세 → 편집 패널을 기본으로 한다. 모바일에서는 목록/상세를 분리한다. 변경 중 법인 전환 시 저장/폐기/취소 선택. 키보드 이동, 입력 label, 오류 요약, 포커스 복원을 제공한다.

일반 버튼: 조회, 신규, 저장, 비활성화, 변경 취소. 설정 문서는 상속값 복원, 비교, 검증, 미리보기, 게시 요청을 추가한다.
참조 중 항목은 물리 삭제하지 않는다. 저장은 초안 저장이며 게시와 구분한다. 사용자 중지/권한 회수 같은 보안 명령은 즉시 적용하고 이력을 남긴다.

권한 표기: 각 화면의 resource에 read/manage를 부여하고 publish/assign/simulate 등 별도 액션을 사용한다. 읽기 전용 사용자에게 쓰기 버튼을 숨겨도 API는 동일하게 거부한다.

## 2. 법인·조직·사용자
| ADM/경로 | 주요 필드 | 이벤트·처리 | 검증·예외 | 권한 |
|---|---|---|---|---|
| 01 /companies | code, name, countryCode, templateCode, defaultLocale, currency, timezone, active | 등록→기본 초안 생성; 템플릿 변경→영향 분석; 중지 | code 불변/유일; 등록된 국가·언어·시간대만; 진행 중 건 존재 시 중지 영향 표시 | company.manage; 타 법인 생성은 platform |
| 02 /organizations | code, name, type, parentId, managerMembershipId, active | 트리 추가/이동/관리자 변경 | 동일 법인 부모, 순환 금지, 사용 중 하위 조직 삭제 금지 | organization.manage |
| 03 /users | loginId, name, email, memberships, primaryCompany, org, active | 합성 사용자 등록/수정/중지, 소속 추가, 세션 폐기 | loginId 기존 회사별 유일성 보존; 소속 없는 법인 접근 금지; 마지막 플랫폼 관리자 중지 금지 | user.manage; membership.assign |
| 30 /ownership-transfers | sourceUser, targetUser, entityTypes, recordFilter, reason | 사전 대상 조회→건수/충돌 확인→일괄 이관→결과 | 자기 법인·허용 데이터만, 대상 활성 사용자; 승인 과제는 자동 이관하지 않음; 부분 실패 목록 | ownership.transfer |

이관은 jobId로 추적하고 레코드별 이전 담당자/새 담당자/rowVersion을 기록한다. 동시 수정 건은 실패 목록에 남기며 성공 건을 반복 이관하지 않는다. 브라우저 목업은 작은 dataset에 한해 일괄 저장한다.

## 3. 권한·보안
| ADM/경로 | 주요 필드 | 이벤트·처리 | 검증·예외 | 권한 |
|---|---|---|---|---|
| 04 /roles | companyId, roleCode, name, grants, denies | 역할 편집/복제, 사용자 배정, 유효 권한 조회 | 권한 catalog에 있는 코드만; 위임 상한 초과 불가; 명시 deny 우선 | role.manage, role.assign |
| 05 /data-scopes | role, entity, actions, scope, orgIds, sharedRecordIds | 범위 편집, 사용자별 샘플 조회 미리보기 | SELF/ORG/SUBTREE/COMPANY, 법인 간 범위 자동 확장 금지 | scope.manage |
| 06 /admin-delegation | delegateRole, companyIds, editableDomains, allowedActions, lockedPaths, expiresAt | 위임·회수·만료, 변경 가능 경로 표시 | 자기 위임 확대 금지; 권한 부여자의 허용 범위 이하 | delegation.manage |
| 13 /field-permissions | entity, field, role, read, write, maskType | 필드 권한 매트릭스 저장·미리보기 | read=false면 write=false; 응답에서도 제거; 검색/필터/정렬에도 적용 | fieldPermission.manage |
| 28 /security-policies | idleTimeout, maxSessionAge, maxFailedAttempts, lockMinutes, mfaPolicy, loginMode | 정책 초안, 검증, 게시; 사용자 세션 해지 | 양수 범위; 미구현 인증 provider 활성화 금지; 임의 MFA 성공 처리 금지 | security.manage, session.revoke |

ADM-28은 세션 만료·계정 잠금·권한 회수와 MFA_REQUIRED 상태/챌린지 시뮬레이션을 구현한다. 실제 SSO/메일/OTP 서비스 연결은 제외한다. DEMO 챌린지임을 표시하며 보안 인증을 완료한 것으로 보고하지 않는다.
법인별 권한 편집에는 현재/변경 후 허용 기능과 영향 사용자 수를 표시한다. 금액/고객 데이터가 없는 관리자라도 운영 권한만으로 업무 데이터 전체를 조회하지 못한다.

## 4. 법인별 설정·메뉴·화면
| ADM/경로 | 주요 필드 | 이벤트·처리 | 검증·예외 | 권한 |
|---|---|---|---|---|
| 07 /configuration | scope, parentVersionIds, overrides, locks | 계층 비교, override 설정·해제 | 순환 상속 금지; 고정 경로 수정 금지; 부모 버전 명시 | config.manage |
| 08 /features | featureKey, enabled, dependencies | 기능 on/off, 의존성 미리보기 | 계약 요구 기능 없이 주문 활성화 등 registry 의존성 위반 차단 | feature.manage |
| 09 /menus | id, parentId, labelKey, iconKey, routeKey, order, featureKey, permission | 트리 편집·순서 변경·역할 미리보기 | 메뉴 순환, 중복 route, 미등록 화면, 권한 없는 링크 차단 | menu.manage |
| 10 /screens | screenKey, entity, template, list/detail/form variants, tabs | 등록된 화면 선택, 법인별 연결, 미리보기 | 임의 컴포넌트 URL 불가; 미등록 screenKey 게시 불가 | screen.manage |
| 11 /sections | sectionId, titleKey, tabId, order, columns, visible | 그룹 추가/정렬/필드 이동 | 고아 필드·중복 배치 차단; 모바일 columns 제한 | section.manage |
| 12 /fields | fieldKey, visible, required, readOnly, order, default, maxLength, helpKey | 속성 변경, 유효 결과/출처 확인 | 숨김+필수 충돌, 표준 필드 타입 변경 금지, 기본값 타입 검사 | field.manage |
| 16 /list-views | entity, columns, filters, sort, pageSize, shared | 공용 보기 설정, 역할별 미리보기 | 읽기 불가 필드를 검색/정렬/목록에 사용 금지 | listView.manage |
| 17 /actions | actionKey, labelKey, featureKey, permission, condition, confirmKey | 버튼 노출/실행 조건 설정, 모의 실행 | 서버 등록 액션만, 실행 권한 없는 사용자 차단 | action.manage |
| 18 /rules | ruleId, entity, trigger, condition, effect, errorKey | 조건 편집, 샘플 데이터 평가, 충돌 검사 | allowlist AST만, 순환 의존·상반 effect 금지 | rule.manage |
| 34 /extension-fields | stableKey, entity, type, labelKey, enumSet, searchable, active | 확장 필드 등록·배치·비활성화 | key 불변, x_ prefix, 값 존재 시 타입 변경 금지, 무제한 개수 금지 | extension.manage |

초기 확장 필드 type: text, decimal, date, boolean, enum. 파일·관계형 lookup·계산식 필드는 제외한다. 초깃값으로 법인/엔티티당 50개, text 1,000자, 조건 트리 깊이 5/노드 50을 제안하며 운영 조정값으로 관리한다.

**필드 이벤트 예시**
1. 법인 US_A 거래처 화면에서 taxNo.required=false, visitGroup.visible=true 저장.
2. 미리보기에서 역할 SALES, 언어 ko-KR 선택.
3. 저장은 초안만 변경. 게시 후 신규 화면 요청에 적용.
4. US_B에는 영향이 없고 언어 변경도 taxNo 규칙을 바꾸지 않는다.
5. hidden 필드의 변조 payload 전송은 서버가 거부한다. 수정 요청에 없는 기존 값은 유지한다.

## 5. 명칭·언어·기준정보
| ADM/경로 | 주요 필드 | 이벤트·처리 | 검증·예외 | 권한 |
|---|---|---|---|---|
| 14 /translations | semanticKey, companyTermKey, locale, text, placeholders | 번역 편집, 누락 조회, 언어 미리보기 | placeholder 일치, key 불변, 텍스트 escape, 빈 필수 번역 차단 | translation.manage |
| 15 /codes | groupKey, valueCode, labelKey, order, active, scope | 코드 추가/중지, 법인 override | 저장 값과 표시 명칭 분리, 참조 중 코드 삭제 금지 | code.manage |
| 33 /numbering | entity, prefix, periodFormat, padding, resetPolicy, timezone | 번호 패턴 편집, 예시 생성 | 법인+엔티티+기간 유일성, 예약 번호 재사용 금지 | numbering.manage |
| 37 /calendars | calendarKey, timezone, weekdays, holidays, effectiveFrom | 휴일 편집, 기한 계산 미리보기 | 날짜 중복, 시간대 누락 검사; 기존 승인 dueAt 변경 금지 | calendar.manage |

번호 미리보기는 실제 번호를 소모하지 않는다. 초기 정책은 연도/월/미초기화 중 선택하고 날짜 계산은 법인 시간대를 사용한다. 번호 시퀀스는 설정 rollback으로 되돌리지 않는다.

## 6. 프로세스·승인·알림
| ADM/경로 | 주요 필드 | 이벤트·처리 | 검증·예외 | 권한 |
|---|---|---|---|---|
| 19 /workflows | definitionKey, entity, states, transitions, guards, actions | 단계/전이 편집, 모의 문서 실행 | 시작 상태 1개, 종료 상태 존재, 도달 불가 상태 검사, 등록 액션만 | workflow.manage |
| 20 /approval-policies | entity, condition, priority, routeKey, allowAutoApprove | 조건/우선순위 편집, 매칭 테스트 | 동일 우선순위 다중 매칭 차단; 승인필수인데 규칙 없으면 제출 차단 | approvalPolicy.manage |
| 21 /approval-routes | stepId, order, mode, approverType, selector, quorum, deputy, expiry | 순차/병렬 결재선, 승인자 해석·대결 시험 | 활성 승인자, 같은 법인/허용 membership, 자기 승인 금지 기본, 빈 승인자 금지 | approvalRoute.manage |
| 22 /approval-operations | instanceId, documentVersion, status, tasks, comments | 승인·반려·회수·재상신·과제 재배정 | 배정자만 결정, 완료 task 재처리 금지, 사유 필수, 문서 수정 충돌 | approval.decide, approval.reassign |
| 23 /notifications | eventKey, recipients, channels, templateKey, localePolicy, delay | 미리보기, IN_APP 생성, EMAIL mock outbox 확인 | 중복 수신 방지, 수신자/placeholder 검증, 외부 발송 없음 | notification.manage |

ADM-22의 일반 승인함은 업무 사용자도 접근하며 설정 관리 권한을 요구하지 않는다. 관리자 강제 재배정은 별도 권한/사유/이력 필수다. 기존 activity 승인과 새 일반 승인을 동시에 동일 문서에 실행하지 않는다.

## 7. ERP 모의 연계·설정 적용
| ADM/경로 | 주요 필드 | 이벤트·처리 | 검증·예외 | 권한 |
|---|---|---|---|---|
| 24 /integration-profiles | companyId, interfaceCode, enabled, mode=MOCK, scenario, delayMs, fieldMapping | profile 편집, payload 미리보기 | LIVE 선택 불가, 필수 매핑 누락 차단, 등록 인터페이스만 | integration.manage |
| 25 /integration-runs | requestId, entity, state, attempts, response, mockFlag | 요청 조회, 성공/실패 응답 주입, 재시도, 중복/지연 재현 | terminal 결과 덮어쓰기 금지, 다른 법인 요청 접근 금지 | integration.read/simulate/retry |
| 26 /releases | draftId, revision, baseVersions, validation, impact, publishAt, reason | 검증→미리보기→게시/예약→적용; 이전 버전 복원 | 검증 후 변경 시 재검증, stale base 거부, 한 법인 원자적 활성 포인터 교체 | config.validate/publish/rollback |

복원은 이전 버전 내용을 새 릴리스로 게시한다. 진행 중 업무/승인, 발급 번호, 확장 필드 저장값, 사용자 중지/권한 회수 상태를 되감지 않는다.

## 8. 메뉴 및 폼 사용성
관리자 왼쪽 메뉴는 위 7개 그룹으로 구성한다. 설정 상속 화면에서 각 속성은 공통/템플릿/국가/법인 출처를 보여준다. 목록에는 초안 유무, 적용 버전, 마지막 변경자·일시를 표시한다.
오류는 저장 실패 toast만 띄우지 않고 해당 필드와 상단 요약에 함께 표시한다. 409 충돌 시 서버 최신 버전과 사용자 편집을 비교하고 자동 덮어쓰기하지 않는다. 미리보기는 읽기 전용 컨텍스트로 실행하며 실제 업무 저장/알림/연계 부작용을 발생시키지 않는다.

## 9. v1.1 화면 실행 계약

이 절은 위 표의 개략 필드를 구체화한다. 모든 31개 ADM 항목은 위 /admin 경로에서 독립적으로 접근할 수 있어야 한다. 도메인별 편집기 공유는 가능하지만 원시 JSON 입력만으로 구현 완료 처리하지 않는다.

- 화면 상태: LOADING → EMPTY 또는 READY → EDITING → SAVING → READY. 실패 시 ERROR와 기존 입력을 유지한다. 409는 CONFLICT로 전환하여 최신값/입력값 비교와 다시 불러오기/수동 재적용을 제공한다.
- 신규 저장은 생성 계약, 기존 저장은 If-Match와 revision을 사용한다. 중복 클릭은 진행 중 비활성화하고 같은 Idempotency-Key를 유지한다.
- 사용자·조직·역할·필드 권한·위임·담당자 이관은 즉시 반영하는 운영 데이터다. 메뉴·필드 배치·코드·규칙·승인 정의·보안 정책은 초안→검증→게시 대상이다. 따라서 §1의 “저장은 초안”은 설정 문서에만 적용한다.
- 법인 중지: 진행 중 승인/ERP/예약 게시 건이 있으면 409 COMPANY_IN_USE로 거부한다. 없으면 활성 세션 폐기 후 중지한다. 마지막 활성 플랫폼 관리자와 마지막 활성 법인 관리자의 소속 중지는 거부한다.
- /users의 법인 관리자 중지는 해당 membership만 중지한다. 전역 identity 중지는 플랫폼 관리자만 수행하며 모든 소속 세션을 회수한다.
- 일반 승인함은 /approvals, 알림함은 /notifications로 노출한다. ADM-22와 동일 service를 사용하되 admin 메뉴 권한을 요구하지 않는다.
- ADM-20 allowAutoApprove는 이번 목업에서 false로 고정한다. ADM-21 mode는 SEQUENTIAL/ALL/ANY만 지원하며 quorum 임의 숫자는 입력 불가다.
- 미리보기의 role 선택은 합성 fixture만 사용한다. 다른 사용자의 실제 데이터 조회/토큰 발급/권한 가장을 허용하지 않는다.

### MFA UI와 영업사원 로그인
ADM-28: 기본 policy 및 roleOverrides의 OFF/OPTIONAL/REQUIRED, DEMO provider, 잠금/만료 설정을 편집한다. ADM-03: MFA 등록 여부·마지막 인증 시각·초기화 버튼을 표시한다. 초기화는 security.mfa.reset 권한과 사유를 요구하고 비밀값/챌린지 값을 조회하지 않는다.
로그인은 법인 코드+loginId+비밀번호 → 필요 시 DEMO 등록/챌린지 → 업무 화면 순서다. OPTIONAL이며 미등록이면 “DEMO 등록/이번 로그인 건너뛰기”를 제공하고, 등록된 사용자는 챌린지를 거친다. REQUIRED는 건너뛰기 불가. 만료/실패/사용 완료/초기화 상태를 별도 메시지로 표시한다. 회사 전환 중 MFA가 요구되면 목적 회사 화면은 인증 완료 후에만 연다.

### 거래처 수직 시연 필드
기존 account 필드 key는 A00 adapter 매핑으로 보존한다. 아래 추가 항목은 명시적으로 등록하는 합성 fixture 필드이며 기존 DB 컬럼이라고 가정하지 않는다.

| key | 타입/초기값 | 시연 차이 |
|---|---|---|
| x_priority | enum NORMAL/HIGH, 기본 NORMAL | US_A/US_B 공통 |
| x_nextContactDate | date, nullable | HIGH일 때 필수 |
| x_visitGroup | text, 최대 100자 | US_A 표시, US_B 숨김 |
| x_creditLimit | decimal, nullable | US_B read=false 역할 검증 |
| x_optIn | boolean, 기본 false | false가 상속·저장 과정에서 보존되는지 검증 |

조건 예시는 x_priority→x_nextContactDate를 사용한다. 위 필드는 FIELD.extensionDefinitions와 registry에 명시적으로 등록한 후 배치한다. taxNo 같은 기존 표의 예시는 실제 key/불변식 확인 전 사용하지 않으며 기본 업무 필수값을 해제하지 않는다.
