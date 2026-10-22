import type {
  AccountInterfaceField, HqAction, HqCondition, HqCoverage, HqEvidence, HqField,
  HqProcess, HqScreenBinding, HqSection, HqStandard, HqTransition
} from '@dio-crm/contracts';
import type { AccountFieldProfile } from '../market/field-profiles/types';

/** Pure factory: callers supply the existing route/profile/interface assets. */
export interface HqRegistryDependencies {
  screenBindings: readonly HqScreenBinding[];
  accountInterfaceFields: readonly AccountInterfaceField[];
  accountFieldProfile: AccountFieldProfile;
  featureKeys: readonly string[];
}

export const HQ_CATALOG_IDS = [
  'SCR-HOME-001', 'SCR-LEAD-001', 'SCR-LEAD-002', 'SCR-LEAD-003',
  'SCR-ACC-001', 'SCR-ACC-002', 'SCR-ACC-003', 'SCR-ACC-004',
  'SCR-ACT-001', 'SCR-ACT-002', 'SCR-ACT-003', 'SCR-ACT-004', 'SCR-CAL-001',
  'SCR-REP-001', 'SCR-REP-002', 'SCR-REP-003', 'SCR-DW-001', 'SCR-DW-002',
  'SCR-OPP-001', 'SCR-OPP-002', 'SCR-OPP-003', 'SCR-CON-001', 'SCR-CON-002',
  'SCR-COL-001', 'SCR-ORD-001', 'SCR-ORD-002', 'SCR-LED-001', 'SCR-STM-001',
  'SCR-ANL-001', 'SCR-ADM-001', 'SCR-ADM-002', 'SCR-ADM-003', 'SCR-ADM-004', 'SCR-ADM-005'
] as const;

const yes = (): HqCondition => ({ kind: 'constant', value: true });
const no = (): HqCondition => ({ kind: 'constant', value: false });
const eq = (fieldKey: string, value: string | boolean): HqCondition => ({ kind: 'equals', fieldKey, value });
const oneOf = (fieldKey: string, values: string[]): HqCondition => ({ kind: 'oneOf', fieldKey, values });
const present = (fieldKey: string): HqCondition => ({ kind: 'present', fieldKey });
const not = (condition: HqCondition): HqCondition => ({ kind: 'not', condition });
const all = (...conditions: HqCondition[]): HqCondition => ({ kind: 'all', conditions });

const evidence = (): HqEvidence[] => [
  { evidenceKey: 'H00.COVERAGE', kind: 'code', source: 'docs/hq-standard/implementation/H00-coverage.md', analysisIds: [], note: 'H00 조사 및 작업자 B 보완 기준. 현재 UI 완료 증거와 다름.' },
  { evidenceKey: 'H00.FIELDS', kind: 'code', source: 'docs/hq-standard/implementation/H00-fields.md', analysisIds: [], note: '현재 지원/미지원 후보/목표 정책을 구분한 H00 필드·액션 재고.' },
  { evidenceKey: 'P0.CATALOG', kind: 'assumption', source: 'spec/screens/P0-08_screen_menu_catalog.md', analysisIds: [], note: '목표 카탈로그 및 장치 정책. 현 구현과 최종 인수는 별개.' },
  { evidenceKey: 'P0.INTERFACES', kind: 'assumption', source: 'spec/interfaces/P0-07_interface_catalog.md', analysisIds: [], note: 'ERP/HIRA 계약 목표. 실제 ERP 접속 검증 아님.' },
  { evidenceKey: 'CODE.ROUTES', kind: 'code', source: 'frontend/src/app/route-config.ts', analysisIds: [], note: '기존 HQ 14개 라우트를 변경하지 않음. / 는 Lead.' },
  { evidenceKey: 'CODE.CUSTOMER', kind: 'code', source: 'backend/src/modules/customer/customer.controller.ts', analysisIds: [], note: '현재 입력 스키마·권한. 영속 매핑은 customer.service.ts와 함께 대조.' },
  { evidenceKey: 'CODE.ACTIVITY', kind: 'code', source: 'backend/src/modules/activity/activity.controller.ts', analysisIds: [], note: '활동·보고·직출 요청 스키마·권한. 소유자/승인자 검사 등은 기존 service가 담당.' },
  { evidenceKey: 'CODE.OPPORTUNITY', kind: 'code', source: 'backend/src/modules/opportunity/opportunity.controller.ts', analysisIds: [], note: '기회·제품의 현재 입력·범위·권한.' },
  { evidenceKey: 'CODE.CONTRACT', kind: 'code', source: 'backend/src/modules/contract/contract.controller.ts', analysisIds: [], note: '계약/계획 요청 계약. 합계·잠금은 contract.service.ts/contract.rules.ts 참조.' },
  { evidenceKey: 'CODE.CONTRACT.RULES', kind: 'code', source: 'backend/src/modules/contract/contract.rules.ts', analysisIds: [], note: '금액 합계 오차 0.005 미만, 변경계획 잔여미수 전액 배분. H02/H05에서 실행 연결.' },
  { evidenceKey: 'CODE.ORDER', kind: 'code', source: 'backend/src/modules/order/order.controller.ts', analysisIds: [], note: '주문/배송/결과의 현재 요청 계약.' },
  { evidenceKey: 'CODE.ANALYTICS', kind: 'code', source: 'backend/src/modules/analytics/analytics.controller.ts', analysisIds: [], note: '원장·명세서·분석 조회 및 파일 API 권한.' },
  { evidenceKey: 'CODE.ACCOUNT.INTERFACE', kind: 'code', source: 'packages/contracts/src/account-interface.ts', analysisIds: [], note: '25개 계약 필드/13개 requiredOut 재사용. 실제 큐 payload 완전성을 뜻하지 않음.' },
  { evidenceKey: 'CODE.ACCOUNT.PROFILE', kind: 'code', source: 'frontend/src/market/field-profiles/HQ_ACCOUNT.ts', analysisIds: [], note: '표시/읽기전용 목표 프로필 재사용. cust_nm의 현 UI 편집 가능 충돌은 보존.' },
  { evidenceKey: 'CODE.FEATURES', kind: 'code', source: 'frontend/src/market/profiles/KR.ts', analysisIds: [], note: '기존 HQ 기능 키를 재사용하며 새 기능 키를 발명하지 않음.' },
  { evidenceKey: 'CODE.NEGOTIATION', kind: 'code', source: 'frontend/src/OpportunitiesPage.tsx', analysisIds: [], note: 'saveNegotiation은 PIPELINE 및 확률70/30 고정 샘플 저장. 자유입력 협상 UI 아님.' },
  { evidenceKey: 'CODE.OPS', kind: 'code', source: 'frontend/src/OpsStatusPage.tsx', analysisIds: [], note: '카탈로그 밖 현재 운영 상태 조회 진입점.' },
  { evidenceKey: 'DESIGN.H01', kind: 'assumption', source: 'docs/hq-standard/02_HQ_CRM_Mock_Implementation_Instructions.md', analysisIds: [], note: 'H01 표준 등록부 계약. 메타데이터 배치가 화면 구현 완료를 뜻하지 않음.' },
  { evidenceKey: 'UNKNOWN.POLICY', kind: 'unknown', source: 'docs/hq-standard/01_HQ_CRM_Mock_Work_Design.md', analysisIds: [], note: '역할별 최종 범위·미확정 본사 운영 정책은 H03–H07에서 별도 검증.' },
  { evidenceKey: 'TRAINING.LEAD', kind: 'observed', source: 'docs/hq-standard/implementation/H00-coverage.md', analysisIds: ['S02','S03','S04','S05','S06','S07','S08','S09','S10','S11','S12','S13'], note: 'H00에 기록된 교육 분석 관찰의 재사용. H01에서 원본 영상을 새로 인증한 것이 아님.' },
  { evidenceKey: 'TRAINING.ACCOUNT', kind: 'observed', source: 'docs/hq-standard/implementation/H00-coverage.md', analysisIds: ['S14','S15','S16','S17','S18','S19','S20'], note: '관련 탭/병원현황. 독립 메뉴로 자동 생성하지 않음.' },
  { evidenceKey: 'TRAINING.ERP.ACCOUNT', kind: 'training', source: 'docs/hq-standard/implementation/H00-coverage.md', analysisIds: ['S505'], note: 'ERP 등록 교육자료. 실 ERP 성공 관찰 아님.' },
  { evidenceKey: 'TRAINING.REPORT', kind: 'observed', source: 'docs/hq-standard/implementation/H00-coverage.md', analysisIds: ['S21','S22'], note: '목록에서 상세 열기와 최종 승인 동작 구분. 영상 최종 승인 성공 미확인.' },
  { evidenceKey: 'TRAINING.OPPORTUNITY', kind: 'observed', source: 'docs/hq-standard/implementation/H00-coverage.md', analysisIds: ['S44','S45','S46','S47','S48','S49','S50','S51','S501','S502'], note: '제품 S47–49와 수주 차단 S51 구분. 서로 다른 거래 사례를 합치지 않음.' },
  { evidenceKey: 'TRAINING.CONTRACT', kind: 'observed', source: 'docs/hq-standard/implementation/H00-coverage.md', analysisIds: ['S503','S504','S507','S508','S509','S510','S511','S512','S513','S514'], note: '계약·계획 시연 분석. 저장되지 않은 불일치 사례를 정상 저장으로 취급하지 않음.' },
  { evidenceKey: 'TRAINING.ORDER', kind: 'observed', source: 'docs/hq-standard/implementation/H00-coverage.md', analysisIds: ['S515','S516','S517','S518','S519','S520','S521','S522','S523','S524'], note: '06/07 중복 분석 단위는 동일 증거에 통합. PC/모바일은 같은 업무 ID.' },
  { evidenceKey: 'TRAINING.ORDER.RULES', kind: 'training', source: 'docs/hq-standard/implementation/H00-coverage.md', analysisIds: ['S527'], note: 'S527 중 주문 업무 규칙의 교육 설명. 후속 재조회 관찰과 분리하며 ERP 처리 성공의 증거로 취급하지 않음.' },
  { evidenceKey: 'OBSERVED.ORDER.REQUERY', kind: 'observed', source: 'docs/hq-standard/implementation/H00-coverage.md', analysisIds: ['S527'], note: 'S527 중 주문 후속 재조회 관찰. 같은 분석 단위의 교육 설명과 분리하며 신규 ERP 요청·처리 완료를 추론하지 않음.' },
  { evidenceKey: 'TRAINING.HOME', kind: 'observed', source: 'docs/hq-standard/implementation/H00-coverage.md', analysisIds: ['S01','S41','S42','S43'], note: '홈/분석 시연 분석. 현재 /는 홈이 아니라 Lead.' }
];

type ScreenSpec = [string, string, string[], string[], string[]?];
const SCREEN_SPECS: ScreenSpec[] = [
  ['HQ_LEAD','리드',['HQ.LEAD'],['LEAD.READ']],
  ['HQ_ACCOUNT','거래처',['HQ.ACCOUNT','HQ.LEAD'],['ACCOUNT.READ']],
  ['HQ_ACTIVITY','활동',['HQ.ACTIVITY'],['ACTIVITY.READ']],
  ['HQ_ACTIVITY_REPORT','활동보고',['HQ.REPORT'],['ACTIVITY.REPORT'],['ACTIVITY_APPROVAL']],
  ['HQ_DIRECT_WORK','직출·직퇴',['HQ.DIRECT_WORK'],['DIRECT_WORK.READ'],['DIRECT_WORK']],
  ['HQ_OPPORTUNITY','영업기회',['HQ.OPPORTUNITY'],['OPPORTUNITY.READ']],
  ['HQ_PIPELINE','파이프라인',['HQ.OPPORTUNITY'],['PIPELINE.READ']],
  ['HQ_CONTRACT','계약·수금',['HQ.CONTRACT','HQ.COLLECTION'],['CONTRACT.READ']],
  ['HQ_ORDER','주문',['HQ.ORDER'],['ORDER.READ']],
  ['HQ_FULFILLMENT','납품현황',['HQ.ORDER'],['ORDER.READ']],
  ['HQ_LEDGER','원장·명세서',['HQ.EVIDENCE'],['LEDGER.READ']],
  ['HQ_ACCOUNT360','거래처360',['HQ.ACCOUNT'],['ACCOUNT360.READ']],
  ['HQ_ANALYTICS','분석',['HQ.ANALYTICS'],['ANALYTICS.READ']],
  ['HQ_OPS','운영 상태',['HQ.OPS'],['OPS.READ']]
];

type SectionSpec = [string, string, string, HqSection['kind']?];
const SECTION_SPECS: SectionSpec[] = [
  ['lead.list','HQ_LEAD','리드 목록'], ['lead.basic','HQ_LEAD','리드 기본','detail'],
  ['lead.keyman','HQ_LEAD','키맨','detail'], ['lead.hospital','HQ_LEAD','병원 현황','detail'],
  ['lead.exclusion','HQ_LEAD','제외 사유','detail'], ['lead.hira','HQ_LEAD','심평원 인입','detail'],
  ['lead.marketing','HQ_LEAD','마케팅','detail'], ['lead.history','HQ_LEAD','변경 이력','detail'],
  ['lead.conversion','HQ_LEAD','리드 전환','dialog'],
  ['account.basic','HQ_ACCOUNT','거래처 기본','detail'], ['account.hospital','HQ_ACCOUNT','병원 현황','detail'],
  ['account.contacts','HQ_ACCOUNT','연락처','detail'], ['account.merge','HQ_ACCOUNT','중복 병합','dialog'],
  ['activity.plan','HQ_ACTIVITY','활동 계획'], ['activity.detail','HQ_ACTIVITY','활동 상세','detail'],
  ['activity.map','HQ_ACTIVITY','활동 지도'], ['activity.bulk','HQ_ACTIVITY','다건 계획','dialog'],
  ['activity.calendar','HQ_ACTIVITY','캘린더'], ['report.write','HQ_ACTIVITY_REPORT','보고 작성'],
  ['report.approval','HQ_ACTIVITY_REPORT','보고 승인','detail'], ['directWork.detail','HQ_DIRECT_WORK','직출·직퇴','detail'],
  ['opportunity.basic','HQ_OPPORTUNITY','기회 상세','detail'], ['opportunity.products','HQ_OPPORTUNITY','기회 제품','dialog'],
  ['pipeline.summary','HQ_PIPELINE','파이프라인'], ['contract.basic','HQ_CONTRACT','계약 기본','detail'],
  ['contract.erp','HQ_CONTRACT','ERP 계약','detail'], ['collection.plan','HQ_CONTRACT','수금계획','dialog'],
  ['collection.actual','HQ_CONTRACT','수금실적'], ['order.items','HQ_ORDER','주문 품목','dialog'],
  ['order.delivery','HQ_ORDER','배송'], ['order.result','HQ_ORDER','주문 결과'],
  ['fulfillment.result','HQ_FULFILLMENT','납품·매출·반품','detail'], ['ledger.filters','HQ_LEDGER','원장 조건'],
  ['statement.output','HQ_LEDGER','명세서'], ['account360.summary','HQ_ACCOUNT360','거래처360'],
  ['analytics.filters','HQ_ANALYTICS','분석 조건'], ['ops.status','HQ_OPS','운영 상태']
];

const PROCESS_NAMES: Record<string, string> = {
  'HQ.LEAD':'리드 육성·전환', 'HQ.ACCOUNT':'거래처·ERP 등록', 'HQ.ACTIVITY':'활동 계획·수행',
  'HQ.REPORT':'활동보고·승인', 'HQ.DIRECT_WORK':'직출·직퇴 승인', 'HQ.OPPORTUNITY':'기회·수주',
  'HQ.CONTRACT':'계약·ERP 승인', 'HQ.COLLECTION':'수금계획·수금', 'HQ.ORDER':'주문·납품',
  'HQ.EVIDENCE':'원장·명세서', 'HQ.ANALYTICS':'분석', 'HQ.OPS':'운영 상태', 'HQ.HOME':'홈', 'HQ.ADMIN':'관리자'
};

export function createHqStandardRegistry(deps: HqRegistryDependencies): HqStandard {
  const fields: HqField[] = [];
  const actions: HqAction[] = [];
  const transitions: HqTransition[] = [];
  const sections: HqSection[] = SECTION_SPECS.map(([sectionKey,screenKey,label,kind], order) => ({
    sectionKey, screenKey, label, labelKey:`hq.section.${sectionKey}`, kind:kind ?? 'section',
    tabKey:`${screenKey}.main`, enabled:true, order:(order + 1)*10,
    fieldKeys:[], actionKeys:[], evidenceKeys:['H00.COVERAGE','DESIGN.H01']
  }));
  for (const [index, section] of deps.accountFieldProfile.sections.entries()) {
    sections.push({ sectionKey:`account.profile.${section.code}`, screenKey:'HQ_ACCOUNT', tabKey:'HQ_ACCOUNT.main',
      label:section.code, labelKey:section.titleKey, kind:'section', enabled:section.visible, order:500 + index*10,
      fieldKeys:[], actionKeys:[], evidenceKeys:['CODE.ACCOUNT.PROFILE'] });
  }

  type FieldOptions = Partial<Omit<HqField,'fieldKey'|'label'|'sectionKey'|'plannedCatalogId'|'current'>> & { current?: Partial<HqField['current']> };
  const addField = (fieldKey:string,label:string,owner:string,options:FieldOptions = {}) => {
    const planned = owner.startsWith('SCR-');
    const { current, ...rest } = options;
    const field: HqField = {
      fieldKey, entity:fieldKey.split('.')[0], label, labelKey:`hq.field.${fieldKey}`,
      ...(planned ? {plannedCatalogId:owner} : {sectionKey:owner}),
      uiType:'text', valueRule:{type:'string'}, observedRequired:'unknown', requiredRule:no(),
      visible:!planned, readOnly:false, readPermissions:[], writePermissions:[], source:'CRM', masking:'none',
      locked:false, overridePolicy:'restrict', evidenceKeys:['H00.FIELDS'],
      notes:'H01 등록부 메타데이터. 실제 화면/저장 연결은 해당 H03–H07 인수에서 확인.',
      ...rest,
      current:{read:false,write:false,note:'현재 API 지원이 확인되지 않은 요구 후보.',...current}
    };
    fields.push(field);
    if (field.sectionKey) sections.find(s=>s.sectionKey === field.sectionKey)?.fieldKeys.push(fieldKey);
    return field;
  };
  const customer = ['H00.FIELDS','CODE.CUSTOMER'];
  const writable = (apiField:string, dbField = apiField): HqField['current'] => ({read:true,write:true,apiField,dbField,note:'현재 API 수용 및 서비스 매핑 확인. 세부 업무/소유자 검사는 기존 서비스에 유지.'});
  const read = (dbField:string): HqField['current'] => ({read:true,write:false,dbField,note:'현재 조회/원천 결과. 일반 사용자 쓰기 API로 취급하지 않음.'});
  const candidate = (stage:string, note:string): FieldOptions => ({visible:false,readOnly:true,current:{read:false,write:false,note},notes:`현재 미지원 요구 후보; ${stage} 구현·검증 대상. ${note}`, evidenceKeys:['H00.FIELDS','UNKNOWN.POLICY']});

  addField('lead.search','검색','lead.list',{current:{read:false,write:true,apiField:'search',note:'목록 GET 검색조건이며 업무 레코드 저장 필드 아님.'},writePermissions:['LEAD.READ']});
  addField('lead.hospitalName','병원명','lead.basic',{observedRequired:true,valueRule:{type:'string',minLength:1},current:writable('hospitalName','hospital_name'),writePermissions:['LEAD.WRITE'],evidenceKeys:customer,notes:'PATCH 제공 시 1자 이상; 현재 생성 API 없음. 화면 별표만으로 생성 필수를 추론하지 않음.'});
  addField('lead.status','리드상태','lead.basic',{uiType:'select',valueRule:{type:'string',options:['NEW','FIRST_VISIT','KEYMAN_MEETING','CONTACT_EXCLUDED','CONVERTED']},observedRequired:true,current:writable('toStatus','status'),readOnly:true,locked:true,overridePolicy:'locked',evidenceKeys:customer,notes:'일반 필드 저장 대신 상태 액션 사용. 역행/사유/소유자 검사는 customer.rules/service에서 유지.'});
  fields.find(f=>f.fieldKey === 'lead.status')!.current=read('status');
  addField('lead.targetStatus','선택한 리드 단계','lead.basic',{uiType:'select',valueRule:{type:'string',options:['NEW','FIRST_VISIT','KEYMAN_MEETING','CONTACT_EXCLUDED','CONVERTED']},current:{read:false,write:true,apiField:'toStatus',note:'저장된 lead.status와 분리한 상태변경 요청 입력.'},writePermissions:['LEAD.WRITE'],evidenceKeys:customer});
  addField('lead.ownerUserId','소유자','lead.basic',{uiType:'reference',valueRule:{type:'number',integer:true,min:1},current:writable('ownerUserId','owner_user_id'),writePermissions:['LEAD.MANAGE'],evidenceKeys:customer});
  for (const [key,label,api,db] of [
    ['phone','전화','phone','phone'],['address','주소','address','address'],['businessNo','사업자번호','businessNo','business_no']
  ]) addField(`lead.${key}`,label,'lead.basic',{current:writable(api,db),writePermissions:['LEAD.WRITE'],evidenceKeys:customer});
  for (const [key,label] of [['sido','시도'],['sigungu','시군구']]) addField(`lead.${key}`,label,'lead.basic',{source:'HIRA',readOnly:true,current:read(key),evidenceKeys:customer,notes:'HIRA 인입에서만 갱신; 현재 수동 PATCH 미지원.'});
  for (const [key,label,api,db] of [
    ['keymanSurname','성','keymanName','keyman_name'],['keymanType','유형','keymanType','keyman_type'],
    ['keymanMobile','휴대폰','keymanMobile','keyman_mobile'],['keymanEmail','이메일','keymanEmail','keyman_email'],
    ['keymanSchool','출신교','school','school'],['keymanClassYear','기수','cohort','cohort'],['keymanMajor','전공','major','major']
  ]) addField(`lead.${key}`,label,'lead.keyman',{observedRequired:key === 'keymanSurname' ? true : 'unknown',current:writable(api,db),writePermissions:['LEAD.WRITE'],evidenceKeys:customer,
    notes:key === 'keymanSurname' ? '현재 keymanName은 전체 이름이며 성 분리 아님. H03에서 의미/매핑을 확정한다.' : 'nullable·선택 string; 코드에 없는 최대 길이/정규식을 만들지 않음.'});
  addField('lead.keymanNote','특이사항','lead.keyman',candidate('H03','현재 PATCH 및 DB 갱신 매핑 없음.'));
  for (const [key,label,db] of [['mainSystem','메인 시스템','main_system'],['subSystem','서브 시스템','sub_system']]) addField(`lead.${key}`,label,'lead.hospital',{current:writable(key,db),writePermissions:['LEAD.WRITE'],evidenceKeys:customer});
  addField('lead.exclusionReason','컨택제외 사유','lead.exclusion',{current:writable('contactExcludeReason','contact_exclude_reason'),writePermissions:['LEAD.WRITE'],evidenceKeys:customer});
  addField('lead.exclusionDetail','상세사유','lead.exclusion',candidate('H03','별도 상세사유 PATCH/DB 매핑 없음.'));
  addField('lead.mapExcluded','지도조회제외','lead.exclusion',{...candidate('H03','수동 저장 API 없음.'),uiType:'checkbox',valueRule:{type:'boolean'}});
  addField('lead.hiraExcluded','심평원 연동제외','lead.hira',{uiType:'checkbox',valueRule:{type:'boolean'},source:'HIRA',readOnly:true,current:read('hira_sync_exclude_yn'),evidenceKeys:customer,notes:'현재 상세 DB 값 및 인입 제외 조건. 수동 변경 API 없음.'});
  addField('lead.hiraCheckNeeded','연동체크 확인필요','lead.hira',{...candidate('H03','계산/조회 계약 미확인.'),valueRule:{type:'boolean'}});
  addField('lead.engagementScore','점수','lead.marketing',{...candidate('H03','현재 점수 원천/계산 API 미확인.'),valueRule:{type:'number'}});
  addField('lead.history','변경내역','lead.history',{...candidate('H03','상태/전환 이력 저장은 존재하나 getLead 상세 이력 응답 연결 없음.'),uiType:'grid',valueRule:{type:'rows'}});
  addField('conversion.accountMode','신규·기존 거래처','lead.conversion',{uiType:'select',valueRule:{type:'string',options:['NEW','EXISTING']},requiredRule:yes(),current:{read:false,write:true,apiField:'accountMode',note:'현재 전환 API 필수 분기.'},writePermissions:['LEAD.CONVERT'],evidenceKeys:customer});
  addField('conversion.existingAccountPublicId','기존 거래처','lead.conversion',{uiType:'reference',valueRule:{type:'reference'},requiredRule:eq('conversion.accountMode','EXISTING'),current:{read:false,write:true,apiField:'existingAccountPublicId',note:'EXISTING 분기 UUID.'},writePermissions:['LEAD.CONVERT'],evidenceKeys:customer});
  addField('conversion.opportunityName','생성 기회명','lead.conversion',{valueRule:{type:'string',maxLength:200},current:{read:false,write:true,apiField:'opportunityName',note:'현재 전환 선택 입력. 기회는 항상 신규 생성.'},writePermissions:['LEAD.CONVERT'],evidenceKeys:customer});
  for (const [key,label] of [['contactMode','신규·기존 연락처'],['opportunityMode','생성·기존·생략'],['ownerUserId','변환 소유자']]) addField(`conversion.${key}`,label,'lead.conversion',candidate('H03','현재 convert API 수용하지 않음. 키맨이 있으면 Contact 신규 생성, Opportunity 신규 생성, Lead 소유자 승계.'));
  for (const [key,label,section] of [['contactName','연락처명','account.contacts'],['hospitalSize','규모','account.hospital'],['mainSystem','메인 시스템','account.hospital'],['subSystem','서브 시스템','account.hospital'],['dioProductUsage','디오 사용현황','account.hospital']]) addField(`account.${key}`,label,section,candidate('H03','Account 저장 스키마/서비스 매핑 없음. Lead의 동명 필드와 구분.'));
  addField('account.accountStatus','거래처 상태','account.basic',{uiType:'select',valueRule:{type:'string',options:['ACTIVE','NEW','NON_TRADING','NON_TRADING_OPP','CHURN_RISK','CHURNED','CLOSED']},defaultValue:'ACTIVE',current:writable('accountStatus','account_status'),writePermissions:['ACCOUNT.WRITE'],evidenceKeys:customer});
  addField('account.accountGrade','거래처 등급','account.basic',{valueRule:{type:'string',maxLength:30},defaultValue:'GENERAL',current:writable('accountGrade','account_grade'),writePermissions:['ACCOUNT.WRITE'],evidenceKeys:customer});
  addField('account.erpApprovedYn','ERP 승인','account.basic',{uiType:'checkbox',valueRule:{type:'boolean'},readOnly:true,source:'ERP',locked:true,overridePolicy:'locked',current:read('erp_approved_yn'),evidenceKeys:['CODE.CONTRACT']});
  addField('account.integrationStatus','ERP 연계 상태','account.basic',{readOnly:true,source:'ERP',locked:true,overridePolicy:'locked',current:read('integration_status'),evidenceKeys:['CODE.CONTRACT']});
  addField('merge.primaryPublicId','병합 대표 거래처','account.merge',{uiType:'reference',valueRule:{type:'reference'},requiredRule:yes(),current:{read:false,write:true,apiField:'primaryPublicId',note:'병합 API의 대표 거래처 UUID 요청 입력. 거래처 속성 PATCH와 다름.'},writePermissions:['ACCOUNT.MERGE'],evidenceKeys:customer,notes:'H01은 참조형·필수 여부를 검사. UUID 형식·회사 범위·병합 적합성 최종 검사는 기존 API에 유지.'});
  addField('merge.duplicatePublicIds','병합할 중복 거래처','account.merge',{uiType:'grid',valueRule:{type:'rows',minLength:1,maxLength:2},requiredRule:yes(),current:{read:false,write:true,apiField:'duplicatePublicIds',note:'병합 API의 중복 거래처 UUID 배열(1~2개) 요청 입력.'},writePermissions:['ACCOUNT.MERGE'],evidenceKeys:customer,notes:'H01은 배열형·필수·1~2개 길이를 검사. 개별 UUID 형식·중복 대상 검사는 기존 API에 유지.'});

  const accountApi: Record<string,[string,number?]> = {
    encrypted_provider_no:['encryptedProviderNo',100],business_name:['businessName',300],business_no:['businessNo',20],ceo_name:['ceoName',50],
    zip_code:['zipCode',20],address_line1:['addressLine1',400],address_line2:['addressLine2',400],hospital_address:['hospitalAddress',400],
    provider_no:['providerNo',50],open_date:['openDate',10],doctor_license_no:['doctorLicenseNo',500],tax_email:['taxEmail',100],
    account_type:['accountType',20],phone:['phone',50],fax:['fax',50],homepage:['homepage',100],account_name:['accountName',300],
    use_yn:['useYn'],churn_risk_yn:['churnRiskYn'],account_stat_code:['accountStatCode']
  };
  for (const contract of deps.accountInterfaceFields) {
    const profileSection = deps.accountFieldProfile.sections.find(s=>s.fields.some(f=>f.code === contract.code));
    const rule = profileSection?.fields.find(f=>f.code === contract.code);
    const mapped = contract.crmField ? accountApi[contract.crmField] : undefined;
    const boolField = contract.code === 'mgt_yn';
    const readonly = rule?.readonly ?? contract.direction !== 'OUT';
    const options = contract.code === 'sal_kd' ? ['BC505600','BC505800'] : contract.code === 'use_yn' ? ['0','1'] : contract.code === 'stat_bc' ? ['0','1','2','3'] : undefined;
    addField(`account.erp.${contract.code}`,contract.nameKo,`account.profile.${profileSection?.code ?? contract.group}`,{
      uiType:boolField ? 'checkbox' : options ? 'select' : contract.code === 'open_dt' ? 'date' : 'text',
      valueRule:{type:boolField ? 'boolean' : 'string',...(mapped?.[1] ? {maxLength:mapped[1]} : {}),...(options ? {options} : {}),...(contract.code === 'cust_nm' ? {minLength:1} : {})},
      observedRequired:'unknown', requiredRule:contract.code === 'cust_nm' ? yes() : no(),
      visible:profileSection?.visible !== false && rule?.visible !== false,
      readOnly:readonly, readPermissions:['ACCOUNT.READ'], writePermissions:['ACCOUNT.WRITE'],
      source:contract.direction === 'IN' ? 'ERP' : contract.direction === 'DERIVED' ? 'DERIVED' : ['U_Key','hosp_nm','medical_care_no','open_dt'].includes(contract.code) ? 'HIRA' : 'CRM',
      locked:readonly, overridePolicy:readonly ? 'locked' : 'restrict',
      ...(contract.code === 'co_cd' ? {defaultValue:'DIO',hiddenFallback:{kind:'default' as const,value:'DIO'}} : {}),
      current:{read:true,write:Boolean(mapped),...(mapped ? {apiField:mapped[0]} : {}),...(contract.crmField ? {dbField:contract.crmField} : {}),
        note:contract.code === 'cust_nm' ? '현재 account_name→accountName API/실제 폼은 편집 가능. HQ 프로필 readonly와 충돌하며 H03에서 해소.' : mapped ? '현재 Account 저장 매핑 확인. source/target readOnly와 현 쓰기 지원은 독립 정보.' : '일반 Account 쓰기 영속 매핑 없음. schema가 허용하는 trade_bc/appr_bc도 실제 쓰기 미지원.'},
      evidenceKeys:['CODE.ACCOUNT.INTERFACE','CODE.ACCOUNT.PROFILE','CODE.CUSTOMER',...(!rule?.readonly && contract.direction === 'IN' ? ['DESIGN.H01','UNKNOWN.POLICY'] : [])],
      notes:`ERP ${contract.direction}; requiredOut=${contract.requiredOut}. requiredOut은 ACC.erpRequest 입력에서 검사하며 화면 생성 필수와 다름. 현재 요청 큐 payload 누락은 H02/H03 인계.${rule?.readonly === undefined && contract.direction === 'IN' ? ' 현 HQ 프로필의 readonly 미지정(기본 편집 가능)보다 엄격한 ERP 원천 보호 목표를 적용한 설계 가정. use_yn/mgt_yn/stat_bc의 현재 저장 가능과 구분하며 H03에서 정책 확정. 기존 UI는 바꾸지 않음.' : ''}`
    });
  }

  const activity = ['H00.FIELDS','CODE.ACTIVITY'];
  addField('activity.relatedType','대상 유형','activity.plan',{uiType:'select',valueRule:{type:'string',options:['LEAD','ACCOUNT','OPPORTUNITY']},requiredRule:yes(),current:writable('relatedType','related_type'),writePermissions:['ACTIVITY.WRITE'],evidenceKeys:activity,notes:'API는 OPPORTUNITY 포함 3종; 현 UI 선택지는 LEAD/ACCOUNT.'});
  addField('activity.relatedPublicId','병원','activity.plan',{uiType:'reference',valueRule:{type:'reference'},observedRequired:true,requiredRule:yes(),current:writable('relatedPublicId','related_id'),writePermissions:['ACTIVITY.WRITE'],evidenceKeys:activity});
  addField('activity.plannedAt','예정시간','activity.plan',{uiType:'datetime',valueRule:{type:'string',minLength:16},observedRequired:true,requiredRule:yes(),current:writable('plannedAt','planned_at'),writePermissions:['ACTIVITY.WRITE'],evidenceKeys:activity});
  addField('activity.visitPurpose','방문목적','activity.plan',{valueRule:{type:'string',maxLength:500},current:writable('visitPurpose','visit_purpose'),writePermissions:['ACTIVITY.WRITE'],evidenceKeys:activity});
  addField('activity.directWorkType','직출직퇴','activity.plan',{uiType:'select',valueRule:{type:'string',options:['DIRECT_WORK','DIRECT_LEAVE']},current:writable('directWorkType','direct_work_type'),writePermissions:['ACTIVITY.WRITE'],evidenceKeys:activity});
  addField('activity.directWorkReason','사유','activity.plan',{valueRule:{type:'string',maxLength:500},requiredRule:present('activity.directWorkType'),current:writable('directWorkReason','direct_work_reason'),writePermissions:['ACTIVITY.WRITE'],evidenceKeys:activity,notes:'유형 선택 시 사유 필수는 현재 폼/서비스 조건. 유형 없는 활동에는 요구하지 않음.'});
  addField('activity.status','진행 상태','activity.detail',{valueRule:{type:'string',options:['PLANNED','IN_PROGRESS','COMPLETED']},readOnly:true,locked:true,overridePolicy:'locked',current:read('status'),evidenceKeys:activity});
  for (const [key,label,db] of [['inAt','IN 시각','in_at'],['outAt','OUT 시각','out_at']]) addField(`activity.${key}`,label,'activity.detail',{uiType:'datetime',valueRule:{type:'date'},readOnly:true,current:read(db),evidenceKeys:activity});
  addField('activity.consultation','상담내용','activity.detail',{uiType:'textarea',valueRule:{type:'string',maxLength:10000},current:writable('consultationContent','consultation_content'),writePermissions:['ACTIVITY.WRITE'],evidenceKeys:activity});
  for (const [key,label,min,max] of [['latitude','위도',-90,90],['longitude','경도',-180,180]] as const) addField(`activity.${key}`,label,'activity.map',{valueRule:{type:'number',min,max},source:'GPS',readOnly:true,current:{read:true,write:true,apiField:key,note:'GPS check-in/out 요청 입력. 일반 수동 편집과 구분.'},evidenceKeys:activity});
  addField('activity.mapDate','지도 조회일','activity.map',{uiType:'date',valueRule:{type:'date'},requiredRule:yes(),current:{read:false,write:true,apiField:'date',note:'map/today GET의 필수 조회조건. 업무 데이터 저장 필드 아님.'},writePermissions:['ACTIVITY.READ'],evidenceKeys:activity,notes:'현재 API의 yyyy-MM-dd 형식 검사는 서버에 유지. GPS 두 좌표와 함께 요청해야 함.'});
  for (const [key,label,apiField] of [['calendarFrom','캘린더 시작일','from'],['calendarTo','캘린더 종료일','to']]) addField(`activity.${key}`,label,'activity.calendar',{uiType:'date',valueRule:{type:'date'},requiredRule:yes(),current:{read:false,write:true,apiField,note:'calendar GET의 필수 조회조건. 활동 날짜 변경 API와 다름.'},writePermissions:['ACTIVITY.READ'],evidenceKeys:activity,notes:'현재 API의 yyyy-MM-dd 형식 검사는 서버에 유지. 확인되지 않은 기간 길이 제한을 만들지 않음.'});
  addField('report.date','보고일','report.write',{uiType:'date',valueRule:{type:'date'},requiredRule:yes(),current:writable('reportDate','report_date'),writePermissions:['ACTIVITY.REPORT'],evidenceKeys:activity,notes:'API yyyy-MM-dd 정규식. 업무상 허용기간은 미확정.'});
  addField('report.consultationSnapshot','활동결과','report.write',{uiType:'textarea',valueRule:{type:'string',maxLength:10000},current:writable('consultationContent','consultation_snapshot'),writePermissions:['ACTIVITY.REPORT'],evidenceKeys:activity});
  addField('report.futurePlan','향후 계획','report.write',{uiType:'grid',valueRule:{type:'rows'},readOnly:true,current:{read:true,write:false,note:'prepare가 미래 활동을 PLAN 행으로 스냅샷. 별도 futurePlan 단일 필드 저장 API 아님.'},evidenceKeys:activity});
  addField('report.status','승인 상태','report.approval',{valueRule:{type:'string',options:['DRAFT','REQUESTED','BRANCH_APPROVED','FINAL_APPROVED']},readOnly:true,locked:true,overridePolicy:'locked',current:read('status'),evidenceKeys:activity});
  for (const [key,label,permission] of [['branchComment','지점장 의견','ACTIVITY.REPORT.APPROVE.BRANCH'],['divisionComment','본부장 의견','ACTIVITY.REPORT.APPROVE.DIVISION']]) addField(`report.${key}`,label,'report.approval',{uiType:'textarea',valueRule:{type:'string',maxLength:1000},current:{read:false,write:true,apiField:'comment',note:'승인 API 입력. 현재 UI는 빈 body 전송; 의견 단독저장과 다름.'},writePermissions:[permission],evidenceKeys:activity});
  addField('report.accompaniedYn','동행 여부','report.approval',{...candidate('H04','현재 approve/updateReportItem 스키마에 없음.'),valueRule:{type:'boolean'}});
  addField('directWork.type','유형','directWork.detail',{valueRule:{type:'string',options:['DIRECT_WORK','DIRECT_LEAVE']},readOnly:true,current:read('work_type'),evidenceKeys:activity,notes:'활동 계획을 통해 생성. 직출 상세 유형 PATCH API 없음.'});
  addField('directWork.reason','사유','directWork.detail',{readOnly:true,current:read('reason'),evidenceKeys:activity});
  addField('directWork.status','승인 상태','directWork.detail',{valueRule:{type:'string',options:['DRAFT','REQUESTED','BRANCH_APPROVED','DIVISION_APPROVED','BRANCH_REJECTED','DIVISION_REJECTED']},readOnly:true,locked:true,overridePolicy:'locked',current:read('status'),evidenceKeys:activity});
  addField('directWork.comment','의견','directWork.detail',{valueRule:{type:'string',maxLength:1000},current:{read:false,write:true,apiField:'comment',note:'승인/반려 API 입력. 목록 응답에 단일 comment 필드는 없음.'},writeActionKeys:['DW.decision.branch','DW.decision.division'],evidenceKeys:activity,notes:'해당 현재 상태에서 지점장 또는 본부장 결정 액션의 권한·조건을 충족할 때만 편집 가능. 조회권한만으로는 허용하지 않음.'});
  addField('directWork.decision','승인·반려 결정','directWork.detail',{uiType:'select',valueRule:{type:'string',options:['APPROVE','REJECT']},current:{read:false,write:true,apiField:'action',note:'결정 요청의 action 입력. 저장된 directWork.status와 분리.'},writeActionKeys:['DW.decision.branch','DW.decision.division'],evidenceKeys:activity,notes:'해당 현재 상태에서 지점장 또는 본부장 결정 액션의 권한·조건을 충족할 때만 편집 가능. APPROVE/REJECT는 결과 저장 상태와 다른 요청값.'});
  addField('directWork.erpStatus','ERP 상태','directWork.detail',{source:'ERP',readOnly:true,locked:true,overridePolicy:'locked',current:read('erp_sync_status'),evidenceKeys:activity});

  const opportunity = ['H00.FIELDS','CODE.OPPORTUNITY'];
  addField('opportunity.name','기회명','opportunity.basic',{valueRule:{type:'string',minLength:1,maxLength:200},requiredRule:yes(),current:writable('opportunityName','opportunity_name'),writePermissions:['OPPORTUNITY.WRITE'],evidenceKeys:opportunity,notes:'생성 필수, PATCH는 제공 시 검사. 화면 전체값과 부분 PATCH를 구분.'});
  addField('opportunity.accountPublicId','거래처','opportunity.basic',{uiType:'reference',valueRule:{type:'reference'},requiredRule:yes(),current:writable('accountPublicId','account_id'),writePermissions:['OPPORTUNITY.WRITE'],evidenceKeys:opportunity,notes:'생성 시 UUID 필수. 기존 기회의 거래처 변경 PATCH는 미지원.'});
  addField('opportunity.expectedCloseDate','마감일','opportunity.basic',{uiType:'date',valueRule:{type:'string'},current:writable('expectedCloseDate','expected_close_date'),writePermissions:['OPPORTUNITY.WRITE'],evidenceKeys:opportunity,notes:'현재 API는 날짜 정규식 없는 선택 string.'});
  addField('opportunity.stage','단계','opportunity.basic',{uiType:'select',valueRule:{type:'string',options:['NEEDS_ANALYSIS','PROPOSAL','NEGOTIATION','CLOSED_WON','CLOSED_LOST']},readOnly:true,locked:true,overridePolicy:'locked',current:writable('toStage','stage'),evidenceKeys:opportunity});
  fields.find(f=>f.fieldKey === 'opportunity.stage')!.current=read('stage');
  addField('opportunity.targetStage','선택한 기회 단계','opportunity.basic',{uiType:'select',valueRule:{type:'string',options:['NEEDS_ANALYSIS','PROPOSAL','NEGOTIATION','CLOSED_WON','CLOSED_LOST']},current:{read:false,write:true,apiField:'toStage',note:'선택만 한 단계는 저장된 opportunity.stage를 바꾸지 않음.'},writePermissions:['OPPORTUNITY.STAGE'],evidenceKeys:opportunity});
  addField('opportunity.successProbability','성공확률','opportunity.basic',{valueRule:{type:'number',min:0,max:100},current:writable('successProbability','success_probability'),writePermissions:['OPPORTUNITY.WRITE'],evidenceKeys:opportunity});
  addField('opportunity.forecastCategory','예상 범주','opportunity.basic',{uiType:'select',valueRule:{type:'string',options:['PIPELINE','BEST_CASE','COMMIT','OMITTED']},current:writable('forecastCategory','forecast_category'),writePermissions:['OPPORTUNITY.WRITE'],evidenceKeys:opportunity});
  addField('opportunity.reason','단계 사유','opportunity.basic',{valueRule:{type:'string',maxLength:1000},current:{read:false,write:true,apiField:'reason',note:'상태 액션 입력. 역행/재오픈 시 별도 규칙에서 요구.'},writePermissions:['OPPORTUNITY.STAGE'],evidenceKeys:opportunity});
  addField('opportunity.productPublicId','제품','opportunity.products',{uiType:'reference',valueRule:{type:'reference'},requiredRule:yes(),current:{read:false,write:true,apiField:'packagePublicId',note:'제품 추가 packagePublicId이며 이미 생성된 제품행 publicId와 구분.'},writePermissions:['OPPORTUNITY.PRODUCT.WRITE'],evidenceKeys:opportunity});
  addField('opportunity.quantity','수량','opportunity.products',{valueRule:{type:'number',integer:true,min:1,max:9999},defaultValue:1,current:writable('quantity','quantity'),writePermissions:['OPPORTUNITY.PRODUCT.WRITE'],evidenceKeys:opportunity,notes:'API 기본1, 현 UI 추가는1 고정. 사용자 수량 편집 UI 완료 아님.'});
  addField('opportunity.price','단가','opportunity.products',{valueRule:{type:'number',min:0},requiredRule:yes(),current:writable('proposedUnitPrice','proposed_unit_price'),writePermissions:['OPPORTUNITY.PRODUCT.WRITE'],evidenceKeys:opportunity});

  const contractEvidence = ['H00.FIELDS','CODE.CONTRACT','CODE.CONTRACT.RULES'];
  addField('contract.opportunityPublicId','원본 기회','contract.basic',{uiType:'reference',valueRule:{type:'reference'},requiredRule:yes(),current:writable('opportunityPublicId','opportunity_id'),writePermissions:['CONTRACT.WRITE'],evidenceKeys:contractEvidence});
  for (const [key,label,other] of [['productAmount','제품 금액','goodsAmount'],['goodsAmount','상품 금액','productAmount']]) addField(`contract.${key}`,label,'contract.basic',{valueRule:{type:'number',min:0},requiredRule:not(present(`contract.${other}`)),current:writable(key,key === 'productAmount' ? 'product_amount' : 'goods_amount'),writePermissions:['CONTRACT.WRITE'],readOnlyWhen:oneOf('contract.status',['ERP_REQUESTED','ERP_APPROVED','CLOSED']),evidenceKeys:contractEvidence,notes:'생성 시 둘 중 하나 이상 제출. 합계=기회 금액 오차0.005 미만은 기존 서비스 규칙; 본 H01 평가기는 금액 계산엔진 아님.'});
  addField('contract.contractAmount','계약 금액','contract.basic',{valueRule:{type:'number',min:0},source:'DERIVED',readOnly:true,locked:true,overridePolicy:'locked',current:read('contract_amount'),evidenceKeys:contractEvidence});
  addField('contract.contractDate','계약일자','contract.basic',{uiType:'date',valueRule:{type:'string'},current:writable('contractDate','contract_date'),writePermissions:['CONTRACT.WRITE'],evidenceKeys:contractEvidence,notes:'현재 API 선택 string; 관찰 별표로 필수화하지 않음.'});
  addField('contract.contractType','계약유형','contract.basic',candidate('H05','현재 생성 schema에 계약유형 필드 없음. packageClassification과 동등하다고 가정하지 않음.'));
  addField('contract.terms','특약','contract.basic',{uiType:'textarea',valueRule:{type:'string',maxLength:4000},current:writable('specialTerms','special_terms'),writePermissions:['CONTRACT.WRITE'],evidenceKeys:contractEvidence});
  addField('contract.erpContractNo','ERP 계약번호','contract.erp',{source:'ERP',readOnly:true,locked:true,overridePolicy:'locked',current:read('erp_contract_no'),evidenceKeys:contractEvidence});
  addField('contract.status','계약 상태','contract.erp',{valueRule:{type:'string',options:['DRAFT','ERP_REQUESTED','ERP_APPROVED','ERP_FAILED','CLOSED']},readOnly:true,locked:true,overridePolicy:'locked',current:read('status'),evidenceKeys:contractEvidence});
  addField('plan.planVersion','버전','collection.plan',{valueRule:{type:'number',integer:true,min:1},source:'DERIVED',readOnly:true,current:read('plan_version'),evidenceKeys:contractEvidence});
  addField('plan.installmentNo','회차','collection.plan',{valueRule:{type:'number',integer:true,min:1},requiredRule:yes(),current:writable('installmentNo','installment_no'),writePermissions:['COLLECTION.PLAN.WRITE'],evidenceKeys:contractEvidence});
  addField('plan.collectionMethod','방법','collection.plan',{valueRule:{type:'string',minLength:1,maxLength:100},observedRequired:true,requiredRule:yes(),current:writable('collectionMethod','collection_method'),writePermissions:['COLLECTION.PLAN.WRITE'],evidenceKeys:contractEvidence});
  addField('plan.amount','금액','collection.plan',{valueRule:{type:'number',min:Number.MIN_VALUE},observedRequired:true,requiredRule:yes(),current:writable('amount','amount'),writePermissions:['COLLECTION.PLAN.WRITE'],evidenceKeys:contractEvidence,notes:'각 행 유한 양수. 원본/변경계획 잠금은 COL.planOriginal/COL.planChange 액션별로 구분.'});
  addField('plan.plannedDate','일자','collection.plan',{uiType:'date',valueRule:{type:'string',minLength:8,maxLength:30},observedRequired:true,requiredRule:yes(),current:writable('plannedDate','planned_date'),writePermissions:['COLLECTION.PLAN.WRITE'],evidenceKeys:contractEvidence});
  addField('plan.adjustmentType','조정유형','collection.plan',{valueRule:{type:'string',options:['ORIGINAL','SPLIT','ARREARS_REALLOCATION']},readOnly:true,current:read('adjustment_type'),evidenceKeys:contractEvidence,notes:'DTO SPLIT 존재와 입력 API 지원은 별개. 현 변경 API는 ARREARS_REALLOCATION.'});
  for (const [key,label,type,db] of [['erpCollectionNo','ERP 수금번호','string','erp_collection_no'],['amount','수금액','number','amount'],['collectedAt','수금일','date','collected_at']] as const) addField(`actual.${key}`,label,'collection.actual',{valueRule:{type},source:'ERP',readOnly:true,locked:true,overridePolicy:'locked',current:read(db),evidenceKeys:contractEvidence});

  const order = ['H00.FIELDS','CODE.ORDER'];
  addField('order.contractPublicId','승인 계약','order.items',{uiType:'reference',valueRule:{type:'reference'},requiredRule:yes(),current:writable('contractPublicId','contract_id'),writePermissions:['ORDER.WRITE'],evidenceKeys:order});
  addField('order.itemType','품목 유형','order.items',{uiType:'select',valueRule:{type:'string',options:['PACKAGE','PRODUCT']},observedRequired:true,current:{read:true,write:true,apiField:'itemType',note:'현재 GET 품목 조회 조건; API는 유형 미선택도 허용. 교육의 검색 선행 조건은 목표.'},evidenceKeys:order});
  addField('order.category','분류','order.items',candidate('H06','조회 응답 category는 존재하나 현재 검색 API의 독립 category 필터 미지원.'));
  addField('order.search','검색어','order.items',{current:{read:false,write:true,apiField:'search',note:'GET 검색 조건. 교육상3자 제한은 현 API 제약 아님.'},evidenceKeys:order});
  addField('order.productPublicId','품목','order.items',{uiType:'reference',valueRule:{type:'reference'},requiredRule:yes(),current:writable('productPublicId','product_package_id'),writePermissions:['ORDER.WRITE'],evidenceKeys:order});
  addField('order.quantity','수량','order.items',{valueRule:{type:'number',integer:true,min:1,max:9999},defaultValue:1,requiredRule:yes(),current:writable('quantity','quantity'),writePermissions:['ORDER.WRITE'],evidenceKeys:order});
  addField('order.unitPrice','단가','order.items',{valueRule:{type:'number',min:0},source:'ERP',readOnly:true,current:writable('unitPrice','unit_price'),evidenceKeys:order,notes:'현재 addItem API는 선택 unitPrice를 받음. ERP 원천 읽기전용 목표와 현 API 차이는 H06 정책 검증 대상.'});
  addField('order.stockQty','재고','order.items',{valueRule:{type:'number'},source:'ERP',readOnly:true,locked:true,overridePolicy:'locked',current:read('stock_qty'),evidenceKeys:order});
  addField('order.orderAvailableYn','주문 가능','order.items',{valueRule:{type:'boolean'},source:'ERP',readOnly:true,locked:true,overridePolicy:'locked',current:read('order_available_yn'),evidenceKeys:order});
  addField('order.deliveryAddressType','배송 유형','order.delivery',{uiType:'select',valueRule:{type:'string',options:['ACCOUNT','DIRECT']},requiredRule:yes(),current:writable('deliveryAddressType','delivery_address_type'),writePermissions:['ORDER.WRITE'],evidenceKeys:order});
  addField('order.deliveryAddress','배송지','order.delivery',{valueRule:{type:'string',maxLength:500},requiredRule:eq('order.deliveryAddressType','DIRECT'),current:writable('deliveryAddress','delivery_address'),writePermissions:['ORDER.WRITE'],evidenceKeys:order,notes:'DIRECT 직접입력은 공백 아닌 주소 필수. ACCOUNT 선택 시 거래처 주소를 서버에서 가져오므로 이 입력을 필수로 만들지 않으며, 원천 주소 존재 여부는 기존 service가 검사.'});
  addField('order.lab','기공소','order.delivery',candidate('H06','현재 배송 API는 ACCOUNT/DIRECT만 지원하며 기공소 필드 미지원.'));
  addField('order.expressYn','특송','order.delivery',{uiType:'checkbox',valueRule:{type:'boolean'},defaultValue:false,current:writable('expressYn','express_yn'),writePermissions:['ORDER.WRITE'],evidenceKeys:order});
  addField('order.note','비고','order.delivery',{uiType:'textarea',valueRule:{type:'string',maxLength:2000},current:writable('note','note'),writePermissions:['ORDER.WRITE'],evidenceKeys:order});
  addField('order.status','주문 상태','order.result',{valueRule:{type:'string',options:['DRAFT','REQUESTING','ACCEPTED','PROCESSING','COMPLETED','FAILED']},readOnly:true,locked:true,overridePolicy:'locked',current:read('status'),evidenceKeys:order});
  addField('order.erpOrderNo','ERP 주문번호','order.result',{source:'ERP',readOnly:true,locked:true,overridePolicy:'locked',current:read('erp_order_no'),evidenceKeys:order});
  for (const [key,label,type,db] of [['delivery.erpDeliveryNo','납품번호','string','erp_delivery_no'],['delivery.deliveryStatus','납품상태','string','delivery_status'],['sales.erpSalesNo','매출번호','string','erp_sales_no'],['sales.amount','매출액','number','amount'],['return.transactionType','반품·교환','string','transaction_type']] as const) addField(key,label,'fulfillment.result',{valueRule:{type,...(key === 'return.transactionType' ? {options:['RETURN','EXCHANGE']} : {})},source:'ERP',readOnly:true,locked:true,overridePolicy:'locked',current:read(db),evidenceKeys:order});
  for (const [key,label,type] of [['accountPublicId','거래처','reference'],['contractPublicId','계약','reference'],['from','시작일','date'],['to','종료일','date'],['general','일반 거래','boolean']] as const) addField(`ledger.${key}`,label,'ledger.filters',{valueRule:{type},...(key === 'accountPublicId' ? {requiredRule:yes()} : {}),current:{read:false,write:true,apiField:key,note:'조회 조건. 업무 레코드 저장/권한과 구분.'},writePermissions:['LEDGER.READ'],evidenceKeys:['H00.FIELDS','CODE.ANALYTICS']});
  addField('statement.selectedRows','선택 행','statement.output',{uiType:'selection',valueRule:{type:'rows',maxLength:1000},current:{read:false,write:true,apiField:'salesPublicIds',note:'PDF 출력 선택 UUID 배열. 모바일 정책은 P0 목표와 별도 확인.'},writePermissions:['STATEMENT.EXPORT'],evidenceKeys:['H00.FIELDS','CODE.ANALYTICS']});
  for (const [key,label] of [['from','시작일'],['to','종료일']]) addField(`analytics.${key}`,label,'analytics.filters',{uiType:'date',valueRule:{type:'string'},current:{read:false,write:true,apiField:key,note:'현재 선택 조회조건 string.'},writePermissions:['ANALYTICS.READ'],evidenceKeys:['CODE.ANALYTICS']});
  for (const [key,label,id] of [['userId','사용자','SCR-ADM-001'],['organizationId','조직','SCR-ADM-001'],['permissionCode','권한','SCR-ADM-002'],['scope','조회범위','SCR-ADM-002'],['commonCode','공통코드','SCR-ADM-003'],['interfaceStatus','연계 상태','SCR-ADM-004'],['auditAt','감사 시각','SCR-ADM-005']]) addField(`admin.${key}`,label,id,{readOnly:true,current:{read:['userId','organizationId','commonCode','interfaceStatus','auditAt'].includes(key),write:false,note:'일부 읽기 API 존재. 현재 main 관리자 renderer/편집 UI 없음.'},evidenceKeys:['H00.FIELDS','P0.CATALOG'],notes:'H07 관리자 브랜치 재사용/통합 검증. 기존 화면으로 위장하지 않음.'});
  for (const [key,label] of [['newLeadCount','신규 리드'],['todayActivityCount','오늘 활동'],['pipelineAmount','파이프라인 금액'],['pendingApprovalCount','승인 대기']]) addField(`home.${key}`,label,'SCR-HOME-001',{valueRule:{type:'number'},source:'DERIVED',readOnly:true,evidenceKeys:['P0.CATALOG','TRAINING.HOME'],notes:'H07 실제 홈 renderer 필요. 현재 / Lead 화면에 가짜로 연결하지 않음.'});
  addField('ops.status','상태','ops.status',{valueRule:{type:'string'},source:'DERIVED',readOnly:true,current:{read:true,write:false,apiField:'database.healthy',note:'database.healthy에서 UP/DEGRADED로 표시하는 카드용 파생 상태. 전체 JSON 객체를 rows라고 취급하지 않음.'},evidenceKeys:['CODE.OPS']});
  addField('ops.checkedAt','확인 시각','ops.status',{valueRule:{type:'date'},readOnly:true,current:{read:true,write:false,apiField:'at',note:'현재 OpsStatus 응답의 at 시각.'},evidenceKeys:['CODE.OPS']});

  type ActionOptions = Partial<Omit<HqAction,'actionKey'|'label'|'processKey'|'screenKey'|'plannedCatalogId'>>;
  const addAction = (actionKey:string,label:string,processKey:string,owner:string,inputFieldKeys:string[],endpoint:string|undefined,permissions:string[],options:ActionOptions = {}) => {
    const planned = owner.startsWith('SCR-');
    const action:HqAction = { actionKey,label,labelKey:`hq.action.${actionKey}`,processKey,
      ...(planned ? {plannedCatalogId:owner} : {screenKey:owner}),enabled:!planned,support:planned ? 'planned' : 'current',
      inputFieldKeys,requiredFieldKeys:[],transitionKeys:[],condition:yes(),...(endpoint ? {endpoint} : {}),permissions,features:[],
      result:'요청 결과를 해당 목록/상세에 반영. H01은 실제 호출 어댑터를 추가하지 않음.',errors:['기존 API 인증·권한·입력·업무 상태 오류'],
      notes:'현재 코드/API 존재와 브라우저 동작 인수 완료를 구분.',evidenceKeys:['H00.FIELDS'],...options };
    actions.push(action);
    return action;
  };
  addAction('HOME.refresh','홈 새로고침','HQ.HOME','SCR-HOME-001',[],undefined,[],{notes:'실제 홈 renderer/API 연결은 H07.'});
  addAction('LEAD.search','리드 검색','HQ.LEAD','HQ_LEAD',['lead.search'],'GET /api/leads',['LEAD.READ'],{evidenceKeys:customer});
  addAction('LEAD.open','리드 상세','HQ.LEAD','HQ_LEAD',[],'GET /api/leads/:id',['LEAD.READ'],{support:'api-only',evidenceKeys:customer});
  addAction('LEAD.create','리드 생성','HQ.LEAD','HQ_LEAD',['lead.hospitalName'],undefined,[],{enabled:false,support:'planned',notes:'현재 생성 API/UI 없음. H03 확장.'});
  addAction('LEAD.save','리드 저장','HQ.LEAD','HQ_LEAD',fields.filter(f=>f.fieldKey.startsWith('lead.') && f.current.write && !['lead.search','lead.targetStatus','lead.status','lead.ownerUserId'].includes(f.fieldKey)).map(f=>f.fieldKey),'PATCH /api/leads/:id',['LEAD.WRITE'],{support:'api-only',condition:not(eq('lead.status','CONVERTED')),evidenceKeys:customer,notes:'소유자 또는 LEAD.MANAGE 검사, 일반 PATCH History 미연결. 별도 미지원 후보는 payload 제외.'});
  addAction('LEAD.changeStage','리드 단계 저장','HQ.LEAD','HQ_LEAD',['lead.targetStatus'],'POST /api/leads/:id/status',['LEAD.WRITE'],{support:'api-only',requiredFieldKeys:['lead.targetStatus'],condition:not(eq('lead.status','CONVERTED')),evidenceKeys:customer});
  addAction('LEAD.assignOwner','소유자 배정','HQ.LEAD','HQ_LEAD',['lead.ownerUserId'],'POST /api/leads/:id/assign-owner',['LEAD.MANAGE'],{support:'api-only',requiredFieldKeys:['lead.ownerUserId'],condition:not(eq('lead.status','CONVERTED')),evidenceKeys:customer});
  addAction('LEAD.convert','리드 전환','HQ.LEAD','HQ_LEAD',['conversion.accountMode','conversion.existingAccountPublicId','conversion.opportunityName'],'POST /api/leads/:id/convert',['LEAD.CONVERT'],{support:'api-only',condition:all(eq('lead.status','KEYMAN_MEETING'),present('lead.ownerUserId')),evidenceKeys:customer,notes:'현 NEW/EXISTING Account만 지원. Contact/Opportunity 선택/생략/별도 owner 후보는 입력에서 제외.'});
  addAction('ACC.search','거래처 검색','HQ.ACCOUNT','HQ_ACCOUNT',[],'GET /api/accounts',['ACCOUNT.READ'],{evidenceKeys:customer});
  addAction('ACC.open','거래처 상세','HQ.ACCOUNT','HQ_ACCOUNT',[],'GET /api/accounts/:id',['ACCOUNT.READ'],{evidenceKeys:customer});
  const accountWritable = fields.filter(f=>f.entity === 'account' && f.current.write).map(f=>f.fieldKey);
  addAction('ACC.create','거래처 생성','HQ.ACCOUNT','HQ_ACCOUNT',accountWritable,'POST /api/accounts',['ACCOUNT.WRITE'],{evidenceKeys:customer});
  addAction('ACC.save','거래처 저장','HQ.ACCOUNT','HQ_ACCOUNT',accountWritable,'PATCH /api/accounts/:id',['ACCOUNT.WRITE'],{evidenceKeys:customer,notes:'현재 쓰기 지원 목록. ERP 원천 읽기전용 목표와의 충돌은 H03에서 해소; H01은 기존 UI/API 변경 안 함.'});
  const erpRequired = deps.accountInterfaceFields.filter(f=>f.requiredOut).map(f=>`account.erp.${f.code}`);
  addAction('ACC.erpRequest','ERP 거래처 요청','HQ.ACCOUNT','HQ_ACCOUNT',erpRequired,'POST /api/erp-accounts/:id/request',['ERP_ACCOUNT.REQUEST'],{requiredFieldKeys:erpRequired,features:['ERP_ACCOUNT_APPROVAL'],condition:all(not(eq('account.integrationStatus','REQUESTING')),not(all(eq('account.integrationStatus','SUCCESS'),eq('account.erpApprovedYn',true)))),evidenceKeys:['H00.FIELDS','CODE.ACCOUNT.INTERFACE','CODE.CONTRACT'],notes:'13개 requiredOut 검사 계약. REQUESTING 또는 SUCCESS+ERP 승인인 경우 현재 service와 같이 재요청 차단. 현재 큐 payload는 부분 필드이며 H02/H03에서 맞춰야 함. 요청=승인 아님.'});
  addAction('ACC.merge','거래처 병합','HQ.ACCOUNT','HQ_ACCOUNT',['merge.primaryPublicId','merge.duplicatePublicIds'],'POST /api/accounts/merge',['ACCOUNT.MERGE'],{requiredFieldKeys:['merge.primaryPublicId','merge.duplicatePublicIds'],support:'api-only',evidenceKeys:customer,notes:'대표 UUID 1개+중복 UUID 배열 1~2개 필수. H01은 참조/배열형·필수·길이까지만 검사하며 UUID 형식 최종 검사는 API에 유지. 사용자 필드선택 병합은 현재 API 미지원.'});
  addAction('ACC.fromLead','전환 결과 거래처 조회','HQ.LEAD','HQ_ACCOUNT',[],'GET /api/accounts/:id',['ACCOUNT.READ'],{support:'api-only',evidenceKeys:customer,notes:'공유화면이 열려도 HQ.LEAD 비활성 시 이 프로세스 액션은 차단.'});
  addAction('ACC360.open','거래처360 조회','HQ.ACCOUNT','HQ_ACCOUNT360',[],'GET /api/analytics/accounts/:id/360',['ACCOUNT360.READ'],{evidenceKeys:['CODE.ANALYTICS']});
  const planInput=['activity.relatedType','activity.relatedPublicId','activity.plannedAt','activity.visitPurpose','activity.directWorkType','activity.directWorkReason'];
  addAction('ACT.planOne','단건 계획','HQ.ACTIVITY','HQ_ACTIVITY',planInput,'POST /api/activities/plans',['ACTIVITY.WRITE'],{evidenceKeys:activity});
  addAction('ACT.planBulk','다건 계획','HQ.ACTIVITY','HQ_ACTIVITY',planInput,'POST /api/activities/plans/bulk',['ACTIVITY.WRITE'],{support:'api-only',evidenceKeys:activity,notes:'PC-only 목표; 현재 UI 없음. API plans1–100개. H04 인수.'});
  addAction('ACT.map','주변 활동 조회','HQ.ACTIVITY','HQ_ACTIVITY',['activity.mapDate','activity.latitude','activity.longitude'],'GET /api/activities/map/today',['ACTIVITY.READ'],{requiredFieldKeys:['activity.mapDate','activity.latitude','activity.longitude'],evidenceKeys:activity,notes:'조회일과 위도·경도 필수. 반경 미지정은 현재 API 기본 10km이며 위치 0은 유효값.'});
  addAction('ACT.calendar','캘린더 조회','HQ.ACTIVITY','HQ_ACTIVITY',['activity.calendarFrom','activity.calendarTo'],'GET /api/activities/calendar',['ACTIVITY.READ'],{requiredFieldKeys:['activity.calendarFrom','activity.calendarTo'],evidenceKeys:activity,notes:'from/to 필수 GET 조회조건. 날짜 형식·허용 조회 범위 최종 검사는 기존 API에 유지.'});
  addAction('ACT.checkIn','IN 등록','HQ.ACTIVITY','HQ_ACTIVITY',['activity.latitude','activity.longitude'],'POST /api/activities/:id/check-in',['ACTIVITY.CHECKIN'],{features:['GPS_CHECKIN'],condition:eq('activity.status','PLANNED'),evidenceKeys:activity});
  addAction('ACT.consultation','상담 저장','HQ.ACTIVITY','HQ_ACTIVITY',['activity.consultation'],'PATCH /api/activities/:id',['ACTIVITY.WRITE'],{condition:eq('activity.status','IN_PROGRESS'),evidenceKeys:activity});
  addAction('ACT.checkOut','OUT 등록','HQ.ACTIVITY','HQ_ACTIVITY',['activity.latitude','activity.longitude'],'POST /api/activities/:id/check-out',['ACTIVITY.CHECKOUT'],{condition:eq('activity.status','IN_PROGRESS'),evidenceKeys:activity});
  addAction('REP.prepare','보고 준비','HQ.REPORT','HQ_ACTIVITY_REPORT',['report.date'],'POST /api/activity-reports/prepare',['ACTIVITY.REPORT'],{features:['ACTIVITY_APPROVAL'],evidenceKeys:activity});
  addAction('REP.edit','보고 항목 저장','HQ.REPORT','HQ_ACTIVITY_REPORT',['report.consultationSnapshot'],'PATCH /api/activity-reports/:id/items/:itemId',['ACTIVITY.REPORT'],{features:['ACTIVITY_APPROVAL'],condition:oneOf('report.status',['DRAFT','REQUESTED']),evidenceKeys:activity});
  addAction('REP.request','보고 승인요청','HQ.REPORT','HQ_ACTIVITY_REPORT',[],'POST /api/activity-reports/:id/request-approval',['ACTIVITY.REPORT'],{features:['ACTIVITY_APPROVAL'],condition:eq('report.status','DRAFT'),evidenceKeys:activity});
  addAction('REP.approveBranch','지점장 승인','HQ.REPORT','HQ_ACTIVITY_REPORT',['report.branchComment'],'POST /api/activity-reports/:id/approve/branch',['ACTIVITY.REPORT.APPROVE.BRANCH'],{features:['ACTIVITY_APPROVAL'],condition:eq('report.status','REQUESTED'),evidenceKeys:activity});
  addAction('REP.approveDivision','본부장 승인','HQ.REPORT','HQ_ACTIVITY_REPORT',['report.divisionComment'],'POST /api/activity-reports/:id/approve/division',['ACTIVITY.REPORT.APPROVE.DIVISION'],{features:['ACTIVITY_APPROVAL'],condition:eq('report.status','BRANCH_APPROVED'),evidenceKeys:activity});
  addAction('DW.request','직출 승인요청','HQ.DIRECT_WORK','HQ_DIRECT_WORK',[],'POST /api/direct-work/:id/request-approval',['DIRECT_WORK.REQUEST'],{features:['DIRECT_WORK'],condition:oneOf('directWork.status',['DRAFT','BRANCH_REJECTED','DIVISION_REJECTED']),evidenceKeys:activity});
  for (const [step,permission,state] of [['branch','DIRECT_WORK.APPROVE.BRANCH','REQUESTED'],['division','DIRECT_WORK.APPROVE.DIVISION','BRANCH_APPROVED']]) addAction(`DW.decision.${step}`,`${step === 'branch' ? '지점장' : '본부장'} 결정`,'HQ.DIRECT_WORK','HQ_DIRECT_WORK',['directWork.decision','directWork.comment'],`POST /api/direct-work/:id/decision/${step}`,[permission],{requiredFieldKeys:['directWork.decision'],features:['DIRECT_WORK'],condition:eq('directWork.status',state),evidenceKeys:activity,notes:'body action APPROVE/REJECT 필수. 전이키로 결정 분리. 재할당 및 실제 ERP 송신은 H04/H02.'});
  addAction('OPP.create','기회 생성','HQ.OPPORTUNITY','HQ_OPPORTUNITY',['opportunity.accountPublicId','opportunity.name','opportunity.expectedCloseDate'],'POST /api/opportunities',['OPPORTUNITY.WRITE'],{evidenceKeys:opportunity});
  addAction('OPP.stage','기회 단계 저장','HQ.OPPORTUNITY','HQ_OPPORTUNITY',['opportunity.targetStage','opportunity.reason'],'POST /api/opportunities/:id/stage',['OPPORTUNITY.STAGE'],{requiredFieldKeys:['opportunity.targetStage'],condition:{kind:'any',conditions:[not(eq('opportunity.targetStage','CLOSED_WON')),eq('account.erpApprovedYn',true)]},evidenceKeys:opportunity,notes:'역행/재오픈 권한·사유와 계약 생성 후 재오픈 제한은 기존 rules/service가 유지. 등록 전이는 정상 순방향 부분집합; H05에서 역행/재오픈을 포함해 통합.'});
  addAction('OPP.saveNegotiation','예상정보 샘플 저장','HQ.OPPORTUNITY','HQ_OPPORTUNITY',['opportunity.successProbability','opportunity.forecastCategory'],'PATCH /api/opportunities/:id',['OPPORTUNITY.WRITE'],{evidenceKeys:['CODE.NEGOTIATION','CODE.OPPORTUNITY'],notes:"현재 forecastCategory='PIPELINE'; stage NEGOTIATION이면 successProbability70, 그 외30. 사용자 자유입력 완성 아님."});
  fields.find(f=>f.fieldKey === 'opportunity.price')!.requiredRule=no();
  for (const [suffix,verb] of [['add','POST'],['edit','PATCH'],['remove','DELETE']]) addAction(`OPP.product.${suffix}`,`기회 제품 ${suffix}`,'HQ.OPPORTUNITY','HQ_OPPORTUNITY',suffix === 'remove' ? [] : suffix === 'add' ? ['opportunity.productPublicId','opportunity.quantity','opportunity.price'] : ['opportunity.quantity','opportunity.price'],`${verb} /api/opportunities/:id/products${suffix === 'add' ? '' : '/:productId'}`,['OPPORTUNITY.PRODUCT.WRITE'],{requiredFieldKeys:suffix === 'add' ? ['opportunity.productPublicId','opportunity.price'] : [],support:suffix === 'add' ? 'current' : 'api-only',evidenceKeys:opportunity});
  addAction('PIPELINE.refresh','파이프라인 조회','HQ.OPPORTUNITY','HQ_PIPELINE',[],'GET /api/opportunities/pipeline/funnel',['PIPELINE.READ'],{evidenceKeys:opportunity});
  addAction('CON.create','계약 생성','HQ.CONTRACT','HQ_CONTRACT',['contract.opportunityPublicId','contract.productAmount','contract.goodsAmount','contract.contractDate','contract.terms'],'POST /api/contracts',['CONTRACT.WRITE'],{condition:all(eq('opportunity.stage','CLOSED_WON'),eq('account.erpApprovedYn',true)),evidenceKeys:contractEvidence,notes:'미계약·기회 제품1개 이상·금액 합계도 기존 서비스에서 검사. 조건만으로 전체 업무 승인이라고 주장하지 않음.'});
  addAction('CON.erpRequest','ERP 계약 요청','HQ.CONTRACT','HQ_CONTRACT',[],'POST /api/contracts/:id/erp-request',['CONTRACT.ERP_REQUEST'],{condition:all(oneOf('contract.status',['DRAFT','ERP_FAILED']),eq('account.erpApprovedYn',true)),evidenceKeys:contractEvidence,notes:'DRAFT/ERP_FAILED 재요청. 현재 계획 합계 검사/요청 큐와 외부 승인결과는 별개.'});
  const planFields=['plan.installmentNo','plan.collectionMethod','plan.amount','plan.plannedDate'];
  addAction('COL.planOriginal','최초 수금계획','HQ.COLLECTION','HQ_CONTRACT',planFields,'POST /api/contracts/:id/collection-plans',['COLLECTION.PLAN.WRITE'],{condition:oneOf('contract.status',['DRAFT','ERP_FAILED']),evidenceKeys:contractEvidence,notes:'1–60행, 최초 합계=계약금액. ERP_REQUESTED/ERP_APPROVED/CLOSED 원본 잠금.'});
  addAction('COL.planChange','변경 수금계획','HQ.COLLECTION','HQ_CONTRACT',planFields,'POST /api/contracts/:id/collection-plans/change',['COLLECTION.PLAN.WRITE'],{support:'api-only',condition:eq('contract.status','ERP_APPROVED'),evidenceKeys:contractEvidence,notes:'잔여미수>0 및 전액배분 합계는 서비스 검사. 버전+1, ARREARS_REALLOCATION, IF-ERP-011 REQUESTING. 실제ERP완료 아님.'});
  addAction('ORD.catalog','주문 품목 조회','HQ.ORDER','HQ_ORDER',['order.itemType','order.search'],'GET /api/order-products',['PRODUCT_ORDER.READ'],{evidenceKeys:order});
  addAction('ORD.draft','주문 초안','HQ.ORDER','HQ_ORDER',['order.contractPublicId'],'POST /api/orders',['ORDER.WRITE'],{condition:all(eq('contract.status','ERP_APPROVED'),eq('account.erpApprovedYn',true)),evidenceKeys:order,notes:'계약 close_yn 및 실제 계정 관계는 기존 서비스가 추가검사.'});
  addAction('ORD.items.add','주문 품목 추가','HQ.ORDER','HQ_ORDER',['order.productPublicId','order.quantity','order.unitPrice'],'POST /api/orders/:id/items',['ORDER.WRITE'],{condition:oneOf('order.status',['DRAFT','FAILED']),evidenceKeys:order});
  addAction('ORD.items.remove','주문 품목 삭제','HQ.ORDER','HQ_ORDER',[],'DELETE /api/orders/:id/items/:itemId',['ORDER.WRITE'],{condition:oneOf('order.status',['DRAFT','FAILED']),evidenceKeys:order});
  addAction('ORD.delivery','배송정보 저장','HQ.ORDER','HQ_ORDER',['order.deliveryAddressType','order.deliveryAddress','order.expressYn','order.note'],'PATCH /api/orders/:id/delivery',['ORDER.WRITE'],{condition:oneOf('order.status',['DRAFT','FAILED']),evidenceKeys:order});
  addAction('ORD.submit','주문 요청','HQ.ORDER','HQ_ORDER',[],'POST /api/orders/:id/submit',['ORDER.SUBMIT'],{condition:all(oneOf('order.status',['DRAFT','FAILED']),eq('contract.status','ERP_APPROVED'),eq('account.erpApprovedYn',true)),evidenceKeys:order,notes:'DRAFT/FAILED 요청 가능. 주문 가능/수량/배송/잔액/계약마감 등은 서비스 추가검사. REQUESTING은 외부 출고 완료 아님.'});
  addAction('FUL.open','납품현황 상세','HQ.ORDER','HQ_FULFILLMENT',[],'GET /api/orders/:id/fulfillment',['ORDER.READ'],{evidenceKeys:order});
  const ledgerFields=['ledger.accountPublicId','ledger.contractPublicId','ledger.from','ledger.to','ledger.general'];
  addAction('LED.search','원장 조회','HQ.EVIDENCE','HQ_LEDGER',ledgerFields,'GET /api/analytics/accounts/:id/ledger',['LEDGER.READ'],{evidenceKeys:['CODE.ANALYTICS']});
  addAction('LED.export','원장 Excel','HQ.EVIDENCE','HQ_LEDGER',ledgerFields,'GET /api/analytics/accounts/:id/ledger.xlsx',['LEDGER.EXPORT'],{evidenceKeys:['CODE.ANALYTICS','P0.CATALOG'],notes:'PC-only 업무 목표. 파일 생성/금액 인수는 H06.'});
  addAction('STM.search','명세서 조회','HQ.EVIDENCE','HQ_LEDGER',ledgerFields,'GET /api/analytics/accounts/:id/statements',['STATEMENT.READ'],{features:['MONTHLY_STATEMENT'],evidenceKeys:['CODE.ANALYTICS']});
  addAction('STM.export','명세서 PDF','HQ.EVIDENCE','HQ_LEDGER',[...ledgerFields,'statement.selectedRows'],'POST /api/analytics/accounts/:id/statements/pdf',['STATEMENT.EXPORT'],{features:['MONTHLY_STATEMENT'],evidenceKeys:['CODE.ANALYTICS','P0.CATALOG'],notes:'모바일 전체내역 PDF 목표; 실제 출력 범위/파일 인수 H06.'});
  addAction('ANL.search','분석 조회','HQ.ANALYTICS','HQ_ANALYTICS',['analytics.from','analytics.to'],'GET /api/analytics/dashboard',['ANALYTICS.READ'],{evidenceKeys:['CODE.ANALYTICS']});
  addAction('OPS.refresh','운영 상태 새로고침','HQ.OPS','HQ_OPS',[],'GET /api/ops/status',['OPS.READ'],{evidenceKeys:['CODE.OPS']});
  for (const [id,permission,endpoint] of [['SCR-ADM-001','USER.READ','GET /api/users'],['SCR-ADM-002','',''],['SCR-ADM-003','','GET /api/common-codes/:group'],['SCR-ADM-004','INTERFACE.READ','GET /api/interface-logs'],['SCR-ADM-005','AUDIT.READ','GET /api/audit-logs']]) addAction(`ADM.${id}.read`,'관리자 조회','HQ.ADMIN',id,fields.filter(f=>f.plannedCatalogId === id).map(f=>f.fieldKey),endpoint || undefined,permission ? [permission] : [],{notes:'일부 읽기 API 존재하나 현재 main renderer 없음. H07 통합. 권한 미확인 항목을 공개로 간주하지 않고 planned disabled.'});
  for (const [id,suffix,label,note] of [
    ['SCR-ADM-001','edit','사용자·조직 편집','현재 main 변경 API/UI 없음. 사용자/조직/역할 쓰기 권한 확인 후 H07 통합.'],
    ['SCR-ADM-002','edit','역할·권한·범위 편집','현재 main 권한관리 API/UI 없음. 권한 완화 승인 정책 확인 후 H07 통합.'],
    ['SCR-ADM-003','edit','공통코드 편집','현재 main 쓰기 API/UI 없음. 기존 읽기 API와 별도 계약 필요.'],
    ['SCR-ADM-004','retry','실패 연계 재처리','현재 main 재처리 UI/권한 미확정. 중복 전송·감사·ERP 어댑터 경계 H02/H07 검증.'],
    ['SCR-ADM-005','inspect','감사 검색·상세','현재 main 조회 API 일부만 존재. 감사 원본 로그 수정 요구로 해석하지 않음.']
  ]) addAction(`ADM.${id}.${suffix}`,label,'HQ.ADMIN',id,[],undefined,[],{notes:`${note} 미확정 권한·endpoint를 발명하지 않고 planned disabled 유지.`});

  const transition = (key:string,actionKey:string,stateFieldKey:string,fromStates:string[],toState:string,requiredFieldKeys:string[] = [],condition:HqCondition = yes(),targetFieldKey?:string) => {
    const action=actions.find(a=>a.actionKey === actionKey)!;
    transitions.push({transitionKey:key,processKey:action.processKey,actionKey,stateFieldKey,...(targetFieldKey ? {targetFieldKey} : {}),fromStates,toState,requiredFieldKeys,condition,evidenceKeys:[...action.evidenceKeys]});
    action.transitionKeys.push(key);
  };
  transition('LEAD.firstVisit','LEAD.changeStage','lead.status',['NEW'],'FIRST_VISIT',['lead.targetStatus'],eq('lead.targetStatus','FIRST_VISIT'),'lead.targetStatus');
  transition('LEAD.keymanMeeting','LEAD.changeStage','lead.status',['FIRST_VISIT'],'KEYMAN_MEETING',['lead.targetStatus'],eq('lead.targetStatus','KEYMAN_MEETING'),'lead.targetStatus');
  transition('LEAD.exclude','LEAD.changeStage','lead.status',['NEW','FIRST_VISIT','KEYMAN_MEETING'],'CONTACT_EXCLUDED',['lead.targetStatus'],eq('lead.targetStatus','CONTACT_EXCLUDED'),'lead.targetStatus');
  transition('LEAD.converted','LEAD.convert','lead.status',['KEYMAN_MEETING'],'CONVERTED',['conversion.accountMode']);
  transition('ACT.in','ACT.checkIn','activity.status',['PLANNED'],'IN_PROGRESS',['activity.latitude','activity.longitude']);
  transition('ACT.out','ACT.checkOut','activity.status',['IN_PROGRESS'],'COMPLETED',['activity.latitude','activity.longitude']);
  transition('REP.requested','REP.request','report.status',['DRAFT'],'REQUESTED');
  transition('REP.branchApproved','REP.approveBranch','report.status',['REQUESTED'],'BRANCH_APPROVED');
  transition('REP.finalApproved','REP.approveDivision','report.status',['BRANCH_APPROVED'],'FINAL_APPROVED');
  transition('DW.requested','DW.request','directWork.status',['DRAFT','BRANCH_REJECTED','DIVISION_REJECTED'],'REQUESTED');
  transition('DW.branchApproved','DW.decision.branch','directWork.status',['REQUESTED'],'BRANCH_APPROVED',['directWork.decision'],eq('directWork.decision','APPROVE'));
  transition('DW.branchRejected','DW.decision.branch','directWork.status',['REQUESTED'],'BRANCH_REJECTED',['directWork.decision'],eq('directWork.decision','REJECT'));
  transition('DW.divisionApproved','DW.decision.division','directWork.status',['BRANCH_APPROVED'],'DIVISION_APPROVED',['directWork.decision'],eq('directWork.decision','APPROVE'));
  transition('DW.divisionRejected','DW.decision.division','directWork.status',['BRANCH_APPROVED'],'DIVISION_REJECTED',['directWork.decision'],eq('directWork.decision','REJECT'));
  transition('OPP.proposal','OPP.stage','opportunity.stage',['NEEDS_ANALYSIS'],'PROPOSAL',['opportunity.targetStage'],eq('opportunity.targetStage','PROPOSAL'),'opportunity.targetStage');
  transition('OPP.negotiation','OPP.stage','opportunity.stage',['NEEDS_ANALYSIS','PROPOSAL'],'NEGOTIATION',['opportunity.targetStage'],eq('opportunity.targetStage','NEGOTIATION'),'opportunity.targetStage');
  transition('OPP.won','OPP.stage','opportunity.stage',['NEEDS_ANALYSIS','PROPOSAL','NEGOTIATION'],'CLOSED_WON',['opportunity.targetStage'],all(eq('opportunity.targetStage','CLOSED_WON'),eq('account.erpApprovedYn',true)),'opportunity.targetStage');
  transition('OPP.lost','OPP.stage','opportunity.stage',['NEEDS_ANALYSIS','PROPOSAL','NEGOTIATION'],'CLOSED_LOST',['opportunity.targetStage'],eq('opportunity.targetStage','CLOSED_LOST'),'opportunity.targetStage');
  transition('CON.requested','CON.erpRequest','contract.status',['DRAFT','ERP_FAILED'],'ERP_REQUESTED');
  transition('ORD.requested','ORD.submit','order.status',['DRAFT','FAILED'],'REQUESTING');

  const screens = SCREEN_SPECS.map(([screenKey,label,processKeys,permissions,features]) => {
    const binding=deps.screenBindings.find(b=>b.screenKey === screenKey);
    return {screenKey,label,labelKey:`hq.screen.${screenKey}`,routeKey:binding?.routeKey ?? '',path:binding?.path ?? '',
      kind:screenKey === 'HQ_ANALYTICS' ? 'dashboard' as const : 'page' as const,devices:['desktop','mobile'] as Array<'desktop'|'mobile'>,
      enabled:true,processKeys:[...processKeys],permissions:[...permissions],features:[...(features ?? [])],
      tabKeys:[`${screenKey}.main`],sectionKeys:sections.filter(s=>s.screenKey === screenKey).map(s=>s.sectionKey),
      actionKeys:actions.filter(a=>a.screenKey === screenKey).map(a=>a.actionKey),evidenceKeys:['CODE.ROUTES','H00.COVERAGE']};
  });
  const endpoints:Record<string,{start:string[];end:string[]}> = {
    'HQ.LEAD':{start:['NEW'],end:['CONVERTED','CONTACT_EXCLUDED']},
    'HQ.ACTIVITY':{start:['PLANNED'],end:['COMPLETED']},
    'HQ.REPORT':{start:['DRAFT'],end:['FINAL_APPROVED']},
    'HQ.DIRECT_WORK':{start:['DRAFT'],end:['DIVISION_APPROVED','BRANCH_REJECTED','DIVISION_REJECTED']},
    'HQ.OPPORTUNITY':{start:['NEEDS_ANALYSIS'],end:['CLOSED_WON','CLOSED_LOST']},
    'HQ.CONTRACT':{start:['DRAFT'],end:['ERP_APPROVED','ERP_FAILED','CLOSED']},
    'HQ.ORDER':{start:['DRAFT'],end:['COMPLETED','FAILED']}
  };
  const processes:HqProcess[] = Object.entries(PROCESS_NAMES).map(([processKey,label],index)=>({
    processKey,label,labelKey:`hq.process.${processKey}`,enabled:!['HQ.HOME','HQ.ADMIN'].includes(processKey),order:(index+1)*10,
    screenKeys:screens.filter(s=>s.processKeys.includes(processKey)).map(s=>s.screenKey),
    transitionKeys:transitions.filter(t=>t.processKey === processKey).map(t=>t.transitionKey),dependsOn:[],
    startStates:endpoints[processKey]?.start ?? [],
    endStates:endpoints[processKey]?.end ?? [],
    permissions:[],features:processKey === 'HQ.REPORT' ? ['ACTIVITY_APPROVAL'] : processKey === 'HQ.DIRECT_WORK' ? ['DIRECT_WORK'] : [],
    evidenceKeys:['H00.COVERAGE','DESIGN.H01']
  }));
  const tabs=screens.map(screen=>({tabKey:`${screen.screenKey}.main`,screenKey:screen.screenKey,label:'기본',labelKey:'hq.tab.main',enabled:true,order:10,sectionKeys:[...screen.sectionKeys],evidenceKeys:['DESIGN.H01']}));
  // Sections describe target placement; assigning them never mounts a UI component.
  for (const section of sections) section.actionKeys=actions.filter(a=>a.screenKey === section.screenKey && (a.inputFieldKeys.some(f=>section.fieldKeys.includes(f)) || sections.find(s=>s.screenKey === section.screenKey)?.sectionKey === section.sectionKey)).map(a=>a.actionKey);

  type CoverageSpec = [string,string,string,string[],string[],string[],HqCoverage['implementationStage'],boolean?];
  const accountSections=sections.filter(s=>s.screenKey === 'HQ_ACCOUNT').map(s=>s.sectionKey);
  const specs:CoverageSpec[] = [
    ['SCR-HOME-001','홈 대시보드','HQ.HOME',[],[],['HOME.refresh'],'H07',true],
    ['SCR-LEAD-001','리드 목록','HQ.LEAD',['HQ_LEAD'],['lead.list'],['LEAD.search'],'H03'],
    ['SCR-LEAD-002','리드 상세','HQ.LEAD',['HQ_LEAD'],['lead.basic','lead.keyman','lead.hospital','lead.exclusion','lead.hira','lead.marketing','lead.history'],['LEAD.open','LEAD.create','LEAD.save','LEAD.changeStage','LEAD.assignOwner'],'H03',true],
    ['SCR-LEAD-003','리드 전환','HQ.LEAD',['HQ_LEAD'],['lead.conversion'],['LEAD.convert'],'H03',true],
    ['SCR-ACC-001','거래처 목록','HQ.ACCOUNT',['HQ_ACCOUNT'],accountSections,['ACC.search','ACC.create','ACC.save'],'H03'],
    ['SCR-ACC-002','거래처360','HQ.ACCOUNT',['HQ_ACCOUNT','HQ_ACCOUNT360'],['account.basic','account.hospital','account.contacts','account360.summary'],['ACC.open','ACC360.open'],'H03'],
    ['SCR-ACC-003','ERP 거래처 등록','HQ.ACCOUNT',['HQ_ACCOUNT'],accountSections,['ACC.erpRequest'],'H03'],
    ['SCR-ACC-004','거래처 병합','HQ.ACCOUNT',['HQ_ACCOUNT'],['account.merge'],['ACC.merge'],'H03',true],
    ['SCR-ACT-001','활동 지도','HQ.ACTIVITY',['HQ_ACTIVITY'],['activity.map'],['ACT.map'],'H04'],
    ['SCR-ACT-002','활동 상세','HQ.ACTIVITY',['HQ_ACTIVITY'],['activity.detail'],['ACT.checkIn','ACT.consultation','ACT.checkOut'],'H04'],
    ['SCR-ACT-003','단건 계획','HQ.ACTIVITY',['HQ_ACTIVITY'],['activity.plan'],['ACT.planOne'],'H04'],
    ['SCR-ACT-004','다건 계획','HQ.ACTIVITY',['HQ_ACTIVITY'],['activity.bulk'],['ACT.planBulk'],'H04',true],
    ['SCR-CAL-001','캘린더','HQ.ACTIVITY',['HQ_ACTIVITY'],['activity.calendar'],['ACT.calendar'],'H04'],
    ['SCR-REP-001','활동보고 요청','HQ.REPORT',['HQ_ACTIVITY_REPORT'],['report.write'],['REP.prepare','REP.edit','REP.request'],'H04'],
    ['SCR-REP-002','보고 승인 목록','HQ.REPORT',['HQ_ACTIVITY_REPORT'],['report.approval'],[],'H04'],
    ['SCR-REP-003','보고 승인 상세','HQ.REPORT',['HQ_ACTIVITY_REPORT'],['report.approval'],['REP.approveBranch','REP.approveDivision'],'H04'],
    ['SCR-DW-001','직출·직퇴 목록','HQ.DIRECT_WORK',['HQ_DIRECT_WORK'],['directWork.detail'],['DW.request'],'H04'],
    ['SCR-DW-002','직출·직퇴 승인','HQ.DIRECT_WORK',['HQ_DIRECT_WORK'],['directWork.detail'],['DW.decision.branch','DW.decision.division'],'H04'],
    ['SCR-OPP-001','기회 목록','HQ.OPPORTUNITY',['HQ_OPPORTUNITY','HQ_PIPELINE'],['opportunity.basic','pipeline.summary'],['OPP.create','PIPELINE.refresh'],'H05'],
    ['SCR-OPP-002','기회 상세','HQ.OPPORTUNITY',['HQ_OPPORTUNITY'],['opportunity.basic'],['OPP.stage','OPP.saveNegotiation'],'H05'],
    ['SCR-OPP-003','기회 제품','HQ.OPPORTUNITY',['HQ_OPPORTUNITY'],['opportunity.products'],['OPP.product.add','OPP.product.edit','OPP.product.remove'],'H05'],
    ['SCR-CON-001','계약 생성','HQ.CONTRACT',['HQ_CONTRACT'],['contract.basic'],['CON.create'],'H05'],
    ['SCR-CON-002','계약 상세','HQ.CONTRACT',['HQ_CONTRACT'],['contract.basic','contract.erp'],['CON.erpRequest'],'H05'],
    ['SCR-COL-001','수금계획','HQ.COLLECTION',['HQ_CONTRACT'],['collection.plan','collection.actual'],['COL.planOriginal','COL.planChange'],'H05'],
    ['SCR-ORD-001','주문','HQ.ORDER',['HQ_ORDER'],['order.items','order.delivery','order.result'],['ORD.catalog','ORD.draft','ORD.items.add','ORD.items.remove','ORD.delivery','ORD.submit'],'H06'],
    ['SCR-ORD-002','납품현황','HQ.ORDER',['HQ_FULFILLMENT'],['fulfillment.result'],['FUL.open'],'H06'],
    ['SCR-LED-001','패키지원장','HQ.EVIDENCE',['HQ_LEDGER'],['ledger.filters'],['LED.search','LED.export'],'H06'],
    ['SCR-STM-001','월합 명세서','HQ.EVIDENCE',['HQ_LEDGER'],['ledger.filters','statement.output'],['STM.search','STM.export'],'H06'],
    ['SCR-ANL-001','분석','HQ.ANALYTICS',['HQ_ANALYTICS'],['analytics.filters'],['ANL.search'],'H06'],
    ...(['SCR-ADM-001','SCR-ADM-002','SCR-ADM-003','SCR-ADM-004','SCR-ADM-005'].map((id)=>[id,'관리자','HQ.ADMIN',[],[],[`ADM.${id}.read`],'H07',true] as CoverageSpec)),
    ['HQ-OPS-ENTRY','운영 상태','HQ.OPS',['HQ_OPS'],['ops.status'],['OPS.refresh'],'H07']
  ];
  const coverage:HqCoverage[] = specs.map(([catalogId,label,processKey,screenKeys,sectionKeys,actionKeys,implementationStage,unimplemented])=>({
    catalogId,label,labelKey:`hq.catalog.${catalogId}`,origin:catalogId === 'HQ-OPS-ENTRY' ? 'additional' : 'catalog',
    processKey,screenKeys,sectionKeys,actionKeys:[...new Set([...actionKeys,...actions.filter(a=>a.plannedCatalogId === catalogId).map(a=>a.actionKey)])],
    fieldKeys:fields.filter(f=>f.plannedCatalogId === catalogId || (f.sectionKey && sectionKeys.includes(f.sectionKey))).map(f=>f.fieldKey),
    planned:screenKeys.length === 0,enabled:screenKeys.length > 0,status:unimplemented ? 'unimplemented' : 'partial',implementationStage,
    notes:screenKeys.length ? 'H00 현재 판정 유지. 등록된 부모/영역은 동작 완료의 증거가 아니며 해당 단계에서 화면 인수.' : '현재 renderer 미등록. 의도적으로 disabled/planned이며 route 또는 가짜 컴포넌트를 발명하지 않음.',
    evidenceKeys:['H00.COVERAGE','P0.CATALOG']
  }));
  const evidenceList=evidence();
  const analysis:Record<string,string[]> = {
    'SCR-HOME-001':['S01','S41','S42','S43'], 'SCR-LEAD-001':['S02','S03','S04'],
    'SCR-LEAD-002':['S04','S05','S06','S07','S08','S09','S11','S12'], 'SCR-LEAD-003':['S10','S13'],
    'SCR-ACC-001':['S20'], 'SCR-ACC-002':['S13','S14','S15','S16','S17','S18','S19','S44','S520'], 'SCR-ACC-003':['S14'],
    'SCR-REP-002':['S21'], 'SCR-REP-003':['S22'],
    'SCR-OPP-001':['S41','S42','S43','S44','S45','S501'], 'SCR-OPP-002':['S44','S45','S46','S50','S51','S501','S502'],
    'SCR-OPP-003':['S47','S48','S49','S502'], 'SCR-CON-001':['S503','S504'],
    'SCR-CON-002':['S504','S507','S508','S510','S513','S520','S524'], 'SCR-COL-001':['S511','S512','S513','S514'],
    'SCR-ORD-001':['S517','S518','S519','S520','S521','S522','S523','S524'], 'SCR-ORD-002':['S521','S522','S523','S524'],
    'SCR-LED-001':['S515','S516'], 'SCR-STM-001':['S515','S516'], 'SCR-ANL-001':['S19','S41','S42','S43']
  };
  const training:Record<string,string[]> = {'SCR-ACC-003':['S505'],'SCR-OPP-002':['S506'],'SCR-CON-001':['S506'],'SCR-CON-002':['S526'],'SCR-COL-001':['S525']};
  for (const row of coverage) {
    if (row.catalogId === 'SCR-REP-001') {
      row.evidenceKeys.push('CODE.ACTIVITY');
      row.notes += ' 작성·요청은 P0 및 현재 API 코드 근거이며 S21–S22의 승인 맥락을 작성 성공 시연으로 사용하지 않음.';
    }
    if (row.catalogId === 'SCR-ORD-001' || row.catalogId === 'SCR-ORD-002') row.evidenceKeys.push('TRAINING.ORDER.RULES','OBSERVED.ORDER.REQUERY');
    for (const [kind,map] of [['observed',analysis],['training',training]] as const) {
      const analysisIds=map[row.catalogId];
      if (!analysisIds) continue;
      const evidenceKey=`${kind}.${row.catalogId}`;
      evidenceList.push({evidenceKey,kind,source:'docs/hq-standard/implementation/H00-coverage.md',analysisIds:[...analysisIds],
        note:kind === 'training' ? '교육 설명의 근거; 운영 성공 시연으로 취급하지 않음.' : 'H00 개별 분석 연결을 재사용. 원본 영상 재검증 아님. 06/07 반복 구간과 S701–704 별칭을 추가 화면으로 세지 않음.'});
      row.evidenceKeys.push(evidenceKey);
    }
  }
  const menus=screens.map((screen,index)=>({menuKey:`menu.${screen.screenKey}`,parentKey:null,screenKey:screen.screenKey,
    label:screen.label,labelKey:screen.labelKey,enabled:true,order:(index+1)*10,permissions:[],features:[],evidenceKeys:['CODE.ROUTES','DESIGN.H01']}));
  return {schemaVersion:1,standardKey:'HQ_CRM',version:'1.0.0-h01',basedOnCommit:'e111138dbf50c46aca41c7097e156840fcd59069',
    evidenceKeys:['H00.COVERAGE','H00.FIELDS','DESIGN.H01'],processes,screens,menus,tabs,sections,fields,actions,transitions,evidence:evidenceList,coverage};
}
