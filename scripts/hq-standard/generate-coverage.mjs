import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHqApplication } from './runtime.mjs';

const app = createHqApplication();
const standard = app.standard;
const out = fileURLToPath(new URL('../../docs/hq-standard/implementation/coverage.md', import.meta.url));
const stageById = id => id.startsWith('SCR-ADM') || id === 'SCR-HOME-001' || id === 'HQ-OPS-ENTRY' ? 'H07'
  : /SCR-(LEAD|ACC)-/.test(id) ? 'H03'
  : /SCR-(ACT|CAL|REP|DW)-/.test(id) ? 'H04'
  : /SCR-(OPP|CON|COL)-/.test(id) ? 'H05' : 'H06';
const collectionByStage = { H03:'leads, accounts, contacts', H04:'activities, reports, directWorks', H05:'opportunities, contracts, plans, products', H06:'orders, deliveries, sales, collections, returns', H07:'동일 HQ_DEMO 데이터셋과 관리 설정' };
const extraApi = {
  'SCR-REP-002':'GET /api/activity-reports',
  'SCR-ORD-002':'GET /api/orders; GET /api/orders/:id/fulfillment',
  'SCR-ADM-001':'GET /api/hq/admin/organizations; PATCH /api/hq/admin/organizations/:id',
  'SCR-ADM-002':'GET /api/hq/admin/standard; POST /api/hq/admin/standard/{preview,draft,publish,restore}; POST /api/hq/admin/override/{preview,apply,clear}'
};
const extraFields = { 'SCR-ACT-004':'계획 행 배열', 'SCR-REP-002':'기간·승인 상태 필터' };
const md = ['# HQ 목업 최종 화면 대응표', '',
  '기준: `HQ_DEMO` 격리 데이터셋과 실행 등록부 `extendHqRuntimeStandard`. 이 표는 실행 등록부의 필드·액션·API를 생성 시점에 읽어 만든다. 증거의 PASS는 목업 자동 검증 범위이며 실 ERP·HIRA 접속을 뜻하지 않는다.', '',
  '| 카탈로그 ID | processKey / screenKey | 부모·진입 | 필드 | 액션·API | 목업 데이터 | 상태 | 동작 확인 증거 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |'];
for (const row of standard.coverage) {
  const screens = row.screenKeys.map(key => standard.screens.find(s => s.screenKey === key)).filter(Boolean);
  const actions = standard.actions.filter(a => row.actionKeys.includes(a.actionKey));
  const stage = stageById(row.catalogId);
  const fields = [...row.fieldKeys, ...(extraFields[row.catalogId] ? [extraFields[row.catalogId]] : [])];
  const api = [...new Set([...actions.map(a => a.endpoint).filter(Boolean), ...(extraApi[row.catalogId] ? extraApi[row.catalogId].split('; ') : [])])];
  const entry = screens.map(s => `${s.path ?? '내부'} (${s.screenKey})`).join('<br>');
  const process = [...new Set(screens.flatMap(s => s.processKeys))].join(', ');
  const evidence = stage === 'H03' ? '[H03 보고](./H03-report.md), [브라우저 25건](./evidence/h03-browser-results.json)'
    : `[${stage} 보고](./${stage}-report.md), [브라우저](./evidence/${stage.toLowerCase()}-browser-report.json)`;
  md.push(`| ${row.catalogId} | ${process}<br>${row.screenKeys.join(', ')} | ${entry}<br>${row.sectionKeys.join(', ')} | ${fields.join(', ') || '조회 조건은 해당 액션에서 검증'} | ${actions.map(a => a.actionKey).join(', ') || '목록 조회'}<br>${api.join('<br>') || '부모 화면 조회 API'} | ${collectionByStage[stage]} | 동작 확인 (목업) | ${evidence} |`);
}
md.push('', `등록부 대응: ${standard.coverage.length}개 행. 독립 메뉴는 상세·탭 수가 아니라 standard.menus에서 계산한다. 최종 실행 상태와 잔여 검증은 [인수 결과](./acceptance-results.md)를 따른다.`, '');
await writeFile(out, md.join('\n'), 'utf8');
console.log(`Wrote ${standard.coverage.length} coverage rows to ${out}`);
