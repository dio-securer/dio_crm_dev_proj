export const leadMockKo = {
  shellV2: { home: '홈' },
  leadV2: {
    title: 'Lead',
    subtitle: '잠재 고객을 발굴하고 다음 액션과 전환 준비 상태를 한 화면에서 관리합니다.',
    mockMode: 'Mock Mode',
    searchPlaceholder: '이름, 기관명, 연락처로 검색',
    newLead: '+ 신규 Lead',
    resetMock: 'Mock 초기화',
    listTitle: 'Lead 목록',
    count: '{{count}}건',
    filters: { allStage: '전체 단계', allInterest: '전체 관심도', allOwner: '전체 담당자' },
    columns: { lead: 'Lead / 기관', interest: '관심도', stage: '단계', owner: '담당자', recent: '최근 활동' },
    actions: { call: '전화', email: '메일', meeting: '미팅', convert: '전환', back: '목록으로' },
    tabs: { overview: '개요', activity: '활동', contacts: '연락처', opportunities: '기회', notes: '메모', attachments: '첨부' },
    sections: {
      basic: '기본 정보', recentActivity: '최근 활동 타임라인', nextAction: '다음 액션', contacts: '관련 담당자', tags: '태그', note: '메모 요약',
      opportunities: '연결된 Opportunity', attachments: '첨부 자료'
    },
    fields: {
      organization: '기관명', organizationType: '기관 유형', phone: '연락처', email: '이메일', region: '지역', address: '주소',
      interest: '관심도', stage: 'Lead 단계', owner: '담당자', source: '유입경로', expectedAmount: '예상 매출', lastActivity: '최근 활동일', nextAction: '다음 액션'
    },
    quick: {
      title: '새로운 Lead 등록', help: '기본 정보만 입력해 빠르게 등록하고 상세 정보는 이후 보강합니다.', name: '이름', organization: '기관명', phone: '연락처',
      source: '유입경로', owner: '담당자', create: '빠른 등록', createDetail: '저장 후 상세 정보 입력', cancel: '취소', required: '이름과 기관명을 입력하세요.'
    },
    interest: { HIGH: '높음', MEDIUM: '보통', LOW: '낮음' },
    stage: { NEW: '신규', CONTACTED: '초기접촉', CONSULTING: '상담중', PROPOSAL: '제안', REVIEW: '검토중', NEGOTIATION: '계약협의', ON_HOLD: '보류', CONVERTED: '전환완료', DISQUALIFIED: '제외' },
    source: { WEB: '웹사이트', EXHIBITION: '전시회', REFERRAL: '소개', PHONE: '전화', OTHER: '기타' },
    activityType: { CALL: '전화', EMAIL: '이메일', MEETING: '미팅', NOTE: '메모' },
    empty: { selection: '목록에서 Lead를 선택하세요.', activity: '등록된 활동이 없습니다.', contacts: '등록된 관련 담당자가 없습니다.', opportunities: '연결된 Opportunity가 없습니다.', attachments: '첨부 자료가 없습니다.' },
    toast: { created: 'Lead가 등록되었습니다.', stageUpdated: 'Lead 단계가 변경되었습니다.', conversionPlanned: 'Lead 전환은 M7에서 실제 흐름으로 연결합니다.', meetingPlanned: '미팅 등록은 Activity 단계에서 연결합니다.', reset: 'Mock 데이터를 초기화했습니다.' },
    opportunityCount: '{{count}}건의 Opportunity',
    lastUpdated: '최근 수정 {{date}}'
  }
} as const;
