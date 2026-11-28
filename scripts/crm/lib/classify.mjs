// `crm classify`: the form an agent fills in BEFORE writing code. It decides which zone a request belongs to.
// The rule of thumb: solve the request in the lowest type that works (A before B before C before D).

export const ZONES = Object.freeze({
  config: { name: '설정 구역', path: 'metadata/', rule: 'G01', what: '값만 둔다. 코드는 둘 수 없다.' },
  engine: { name: '엔진 구역', path: 'packages/engine*/', rule: 'G02, G04, G06, G07', what: '모든 회사가 같이 쓰는 공통 코드. 회사·국가로 갈라질 수 없다.' },
  extension: { name: '확장 구역', path: 'extensions/<이름>/', rule: 'G02, G04, G07', what: '설정으로 안 되는 회사 전용 코드. 자기 폴더와 계약·엔진만 쓸 수 있다.' },
  legacy: { name: '이관 대상(legacy)', path: 'legacy-files.json 에 적힌 파일', rule: 'G10', what: '새 파일을 만들 수 없다. 기존 파일 수정만 된다.' },
});

export const TYPES = Object.freeze([
  {
    id: 'A', name: '설정 변경', zone: 'config',
    when: '이미 있는 화면·필드·목록·권한의 값을 바꾸는 요청. 예: 필드 이름, 필수 여부, 목록 열 순서.',
    work: '설정 파일(`metadata/`)만 고친다. 코드 파일을 고치면 A 가 아니다.',
    evidence: ['`pnpm crm verify` 증거 꾸러미(합성)', '바뀐 파일이 설정 구역 안에만 있다는 것(변경 파일 목록)'],
  },
  {
    id: 'B', name: '기존 능력의 새 조합', zone: 'config',
    when: '엔진이 이미 할 수 있는 일을 새로 엮는 요청. 예: 새 개체, 새 화면, 새 목록, 새 승인 경로를 기존 부품으로 만든다.',
    work: '설정 파일(`metadata/`)을 새로 만든다. 엔진이나 화면 코드를 고쳐야 하면 B 가 아니라 C 다.',
    evidence: ['`pnpm crm verify` 증거 꾸러미(합성)', '새 설정이 실제 화면·API 에서 동작한다는 테스트 결과'],
  },
  {
    id: 'C', name: '새 능력', zone: 'engine',
    when: '지금 엔진이 못 하는 일이 필요하고, 모든 회사가 쓸 수 있는 요청. 예: 새 필드 종류, 새 계산 방식.',
    work: '엔진(`packages/engine*/`)과 계약(`packages/contracts/`)에 공통 기능으로 넣고, 요청 자체는 설정으로 푼다.',
    evidence: ['`pnpm crm verify` 증거 꾸러미(합성)', '새 능력의 테스트', '계약이나 결정이 바뀌면 ADR(`docs/framework/adr/`)', '사람 승인'],
  },
  {
    id: 'D', name: '진짜 예외', zone: 'extension',
    when: 'A·B·C 로 풀 수 없고 한 회사·국가에만 필요한 요청. 왜 A·B·C 가 안 되는지 적을 수 있어야 한다.',
    work: '확장(`extensions/<이름>/`)에 둔다. 엔진·화면 코드에 회사별 분기를 넣지 않는다.',
    evidence: ['`pnpm crm verify` 증거 꾸러미(합성)', '확장의 테스트', 'A·B·C 가 안 되는 이유', '사람 승인'],
  },
]);

export const classifyData = () => ({
  schemaVersion: 1,
  rule: '가장 낮은 유형으로 푼다 (A → B → C → D 순서로 따져 본다).',
  zones: ZONES,
  types: TYPES.map(type => ({ ...type, zonePath: ZONES[type.zone].path })),
  form: ['요청 ID', '요청 한 줄 요약', '유형 (A/B/C/D)', '이 유형인 이유', '더 낮은 유형으로 안 되는 이유', '고칠 구역과 파일', '낼 증거', '사람 승인이 필요한가'],
});

export function renderClassify() {
  const out = [
    '# 요청 분류서', '',
    '코드를 쓰기 전에 채운다. 가장 낮은 유형으로 푼다: A 로 되면 A, 안 되면 B, 그다음 C, 마지막이 D.', '',
    '## 유형', '',
    '| 유형 | 이름 | 이런 요청 | 가는 구역 | 하는 일 | 필요한 증거 |', '| --- | --- | --- | --- | --- | --- |',
    ...TYPES.map(type => {
      const zone = ZONES[type.zone];
      return `| ${type.id} | ${type.name} | ${type.when} | ${zone.name} \`${zone.path}\` | ${type.work} | ${type.evidence.join('; ')} |`;
    }),
    '', '## 구역', '',
    '| 구역 | 경로 | 무엇을 두나 | 지키는 가드 규칙 |', '| --- | --- | --- | --- |',
    ...Object.values(ZONES).map(zone => `| ${zone.name} | \`${zone.path}\` | ${zone.what} | ${zone.rule} |`),
    '', '## 채울 칸', '',
    '- 요청 ID (예: REQ-12):',
    '- 요청 한 줄 요약:',
    '- 유형 (A / B / C / D):',
    '- 이 유형인 이유:',
    '- 더 낮은 유형으로 안 되는 이유 (A 면 비워 둔다):',
    '- 고칠 구역과 파일:',
    '- 낼 증거 (합성/실증을 구분해 적는다):',
    '- 사람 승인이 필요한가 (C·D 는 예):',
    '',
  ];
  return out.join('\n');
}
