import type { LeadInterest, LeadRecord, LeadSource, LeadStage } from './lead-model';

const BASE_LEADS: LeadRecord[] = [
  {
    leadId: 'LD000001', leadNo: 'L-2026-000101', leadName: '이정민 원장', organizationName: '서울치과병원', organizationType: '치과병원', jobTitle: '대표원장',
    phone: '010-2345-6789', email: 'leejm@seouldental.co.kr', country: 'KR', region: '서울 강남구', address: '서울특별시 강남구 테헤란로 123',
    stage: 'CONSULTING', interestLevel: 'HIGH', source: 'EXHIBITION', ownerUserId: 'USER001', ownerName: '김지훈', expectedAmount: 30000000, expectedDate: '2026-10-31',
    lastActivityAt: '2026-09-16T14:30:00+09:00', nextAction: '제품 데모 방문', nextActionAt: '2026-09-18T14:00:00+09:00',
    tags: ['임플란트', '디지털가이드', 'VIP'], noteSummary: '디지털 진료 시스템 도입을 검토 중이며 워크플로우 연동성을 중요하게 확인하고 있음.', opportunityCount: 1,
    contacts: [
      { id: 'CT001', name: '이정민 원장', role: '의사결정자', phone: '010-2345-6789', email: 'leejm@seouldental.co.kr', primary: true },
      { id: 'CT002', name: '박지연 실장', role: '실무 담당', phone: '010-9876-5432', email: 'pj@seouldental.co.kr' }
    ],
    activities: [
      { id: 'A001', type: 'CALL', occurredAt: '2026-09-16T14:30:00+09:00', title: '전화 통화', summary: '제품 데모 일정 논의, 9/18 방문 예정', ownerName: '김지훈' },
      { id: 'A002', type: 'EMAIL', occurredAt: '2026-09-15T10:20:00+09:00', title: '이메일 발송', summary: '제품 소개서 및 레퍼런스 자료 전달', ownerName: '김지훈' },
      { id: 'A003', type: 'MEETING', occurredAt: '2026-09-12T16:00:00+09:00', title: '미팅', summary: '병원 현장 미팅 및 니즈 확인', ownerName: '김지훈' },
      { id: 'A004', type: 'NOTE', occurredAt: '2026-09-10T11:20:00+09:00', title: '메모', summary: '디지털 가이드에 높은 관심', ownerName: '김지훈' }
    ],
    createdAt: '2026-09-08T09:00:00+09:00', updatedAt: '2026-09-16T14:30:00+09:00'
  },
  {
    leadId: 'LD000002', leadNo: 'L-2026-000102', leadName: '박수현 원장', organizationName: '부산미소치과', organizationType: '치과의원', phone: '010-3312-7788', email: 'park@misodental.co.kr', country: 'KR', region: '부산 해운대구',
    stage: 'PROPOSAL', interestLevel: 'HIGH', source: 'REFERRAL', ownerUserId: 'USER002', ownerName: '이서연', expectedAmount: 22000000, lastActivityAt: '2026-09-15T11:10:00+09:00', nextAction: '견적안 전달', nextActionAt: '2026-09-17T10:00:00+09:00',
    tags: ['임플란트'], noteSummary: '소개 고객. 가격 조건 검토 중.', opportunityCount: 1, contacts: [], activities: [
      { id: 'A005', type: 'EMAIL', occurredAt: '2026-09-15T11:10:00+09:00', title: '이메일 발송', summary: '1차 제안서 전달', ownerName: '이서연' }
    ], createdAt: '2026-09-05T09:00:00+09:00', updatedAt: '2026-09-15T11:10:00+09:00'
  },
  {
    leadId: 'LD000003', leadNo: 'L-2026-000103', leadName: '김태우 원장', organizationName: '대전스마트덴탈', organizationType: '치과의원', phone: '010-4555-9012', country: 'KR', region: '대전 유성구',
    stage: 'REVIEW', interestLevel: 'MEDIUM', source: 'WEB', ownerUserId: 'USER003', ownerName: '박준호', expectedAmount: 18000000, lastActivityAt: '2026-09-14T16:00:00+09:00', nextAction: '의사결정자 확인', nextActionAt: '2026-09-19T11:00:00+09:00',
    tags: ['CT'], noteSummary: '원내 검토 중.', opportunityCount: 0, contacts: [], activities: [
      { id: 'A006', type: 'MEETING', occurredAt: '2026-09-14T16:00:00+09:00', title: '미팅', summary: '제품 구성 검토', ownerName: '박준호' }
    ], createdAt: '2026-09-06T09:00:00+09:00', updatedAt: '2026-09-14T16:00:00+09:00'
  },
  {
    leadId: 'LD000004', leadNo: 'L-2026-000104', leadName: '최민정 원장', organizationName: '광주하나치과', organizationType: '치과의원', phone: '010-7777-1212', country: 'KR', region: '광주 서구',
    stage: 'CONSULTING', interestLevel: 'HIGH', source: 'EXHIBITION', ownerUserId: 'USER001', ownerName: '김지훈', expectedAmount: 27000000, lastActivityAt: '2026-09-14T10:30:00+09:00', nextAction: '제품 자료 보완', nextActionAt: '2026-09-17T15:00:00+09:00',
    tags: ['디지털가이드'], noteSummary: '전시회 상담 후 후속 미팅 진행 중.', opportunityCount: 0, contacts: [], activities: [], createdAt: '2026-09-04T09:00:00+09:00', updatedAt: '2026-09-14T10:30:00+09:00'
  },
  {
    leadId: 'LD000005', leadNo: 'L-2026-000105', leadName: '정현수 원장', organizationName: '수원연세치과', organizationType: '치과의원', phone: '010-1010-3232', country: 'KR', region: '경기 수원시',
    stage: 'CONTACTED', interestLevel: 'MEDIUM', source: 'PHONE', ownerUserId: 'USER002', ownerName: '이서연', lastActivityAt: '2026-09-13T09:40:00+09:00', nextAction: '니즈 파악 전화', nextActionAt: '2026-09-18T09:30:00+09:00',
    tags: [], noteSummary: '초기 접촉 단계.', opportunityCount: 0, contacts: [], activities: [], createdAt: '2026-09-07T09:00:00+09:00', updatedAt: '2026-09-13T09:40:00+09:00'
  },
  {
    leadId: 'LD000006', leadNo: 'L-2026-000106', leadName: '한지수 원장', organizationName: '인천예본치과', organizationType: '치과의원', phone: '010-2020-4242', country: 'KR', region: '인천 남동구',
    stage: 'ON_HOLD', interestLevel: 'LOW', source: 'WEB', ownerUserId: 'USER003', ownerName: '박준호', lastActivityAt: '2026-09-11T13:20:00+09:00',
    tags: [], noteSummary: '예산 재검토로 보류.', opportunityCount: 0, contacts: [], activities: [], createdAt: '2026-09-01T09:00:00+09:00', updatedAt: '2026-09-11T13:20:00+09:00'
  },
  {
    leadId: 'LD000007', leadNo: 'L-2026-000107', leadName: '오민규 원장', organizationName: '대구스마일치과', organizationType: '치과의원', phone: '010-3030-5252', country: 'KR', region: '대구 수성구',
    stage: 'NEGOTIATION', interestLevel: 'HIGH', source: 'REFERRAL', ownerUserId: 'USER001', ownerName: '김지훈', expectedAmount: 41000000, lastActivityAt: '2026-09-10T17:00:00+09:00', nextAction: '계약 조건 협의', nextActionAt: '2026-09-17T16:00:00+09:00',
    tags: ['VIP', '임플란트'], noteSummary: '가격 및 유지보수 조건 협의 중.', opportunityCount: 1, contacts: [], activities: [], createdAt: '2026-08-28T09:00:00+09:00', updatedAt: '2026-09-10T17:00:00+09:00'
  },
  {
    leadId: 'LD000008', leadNo: 'L-2026-000108', leadName: '서은영 원장', organizationName: '울산드림치과', organizationType: '치과의원', phone: '010-4040-6262', country: 'KR', region: '울산 남구',
    stage: 'NEW', interestLevel: 'MEDIUM', source: 'WEB', ownerUserId: 'USER002', ownerName: '이서연', tags: [], noteSummary: '웹 문의 신규 Lead.', opportunityCount: 0, contacts: [], activities: [], createdAt: '2026-09-16T08:10:00+09:00', updatedAt: '2026-09-16T08:10:00+09:00'
  }
];

const EXTRA_NAMES = ['강민호', '윤서진', '조현우', '임다은', '신재호', '송예린', '백승현', '문지아'];
const EXTRA_HOSPITALS = ['한빛치과', '센트럴치과', '프라임덴탈', '굿모닝치과', '서울탑치과', '미래치과', '우리치과', '스마트치과'];
const EXTRA_REGIONS = ['서울 송파구', '경기 성남시', '부산 수영구', '대전 서구', '대구 달서구', '광주 북구', '인천 연수구', '경남 창원시'];
const EXTRA_STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'CONSULTING', 'PROPOSAL', 'REVIEW', 'NEGOTIATION', 'ON_HOLD', 'DISQUALIFIED'];
const EXTRA_INTERESTS: LeadInterest[] = ['HIGH', 'MEDIUM', 'LOW'];
const EXTRA_SOURCES: LeadSource[] = ['WEB', 'EXHIBITION', 'REFERRAL', 'PHONE', 'OTHER'];
const EXTRA_OWNERS = [
  { id: 'USER001', name: '김지훈' },
  { id: 'USER002', name: '이서연' },
  { id: 'USER003', name: '박준호' }
];

const EXTRA_LEADS: LeadRecord[] = Array.from({ length: 32 }, (_, index) => {
  const sequence = index + 109;
  const owner = EXTRA_OWNERS[index % EXTRA_OWNERS.length];
  const stage = EXTRA_STAGES[index % EXTRA_STAGES.length];
  const day = 15 - (index % 15);
  const hasActivity = index % 7 !== 0;
  const lastActivityAt = hasActivity ? `2026-09-${String(day).padStart(2, '0')}T${String(9 + (index % 8)).padStart(2, '0')}:20:00+09:00` : undefined;
  const nextDay = 17 + (index % 10);
  const nextActionAt = stage === 'DISQUALIFIED' ? undefined : `2026-09-${String(nextDay).padStart(2, '0')}T${String(9 + (index % 7)).padStart(2, '0')}:00:00+09:00`;
  const nextAction = stage === 'DISQUALIFIED' ? undefined : ['후속 전화', '제품 소개', '방문 일정 협의', '견적 확인', '키맨 미팅'][index % 5];

  return {
    leadId: `LD${String(sequence).padStart(6, '0')}`,
    leadNo: `L-2026-${String(sequence).padStart(6, '0')}`,
    leadName: `${EXTRA_NAMES[index % EXTRA_NAMES.length]} 원장`,
    organizationName: `${EXTRA_REGIONS[index % EXTRA_REGIONS.length].split(' ')[0]} ${EXTRA_HOSPITALS[index % EXTRA_HOSPITALS.length]}`,
    organizationType: '치과의원',
    phone: `010-${String(5100 + index).padStart(4, '0')}-${String(7100 + index).padStart(4, '0')}`,
    country: 'KR',
    region: EXTRA_REGIONS[index % EXTRA_REGIONS.length],
    stage,
    interestLevel: EXTRA_INTERESTS[index % EXTRA_INTERESTS.length],
    source: EXTRA_SOURCES[index % EXTRA_SOURCES.length],
    ownerUserId: owner.id,
    ownerName: owner.name,
    expectedAmount: 12000000 + (index % 8) * 5000000,
    lastActivityAt,
    nextAction,
    nextActionAt,
    tags: index % 4 === 0 ? ['신규문의'] : [],
    noteSummary: '',
    opportunityCount: index % 5 === 0 ? 1 : 0,
    contacts: [],
    activities: [],
    createdAt: `2026-08-${String(10 + (index % 20)).padStart(2, '0')}T09:00:00+09:00`,
    updatedAt: lastActivityAt ?? `2026-09-${String(day).padStart(2, '0')}T08:00:00+09:00`
  };
});

export const MOCK_LEAD_SEED: LeadRecord[] = [...BASE_LEADS, ...EXTRA_LEADS];
