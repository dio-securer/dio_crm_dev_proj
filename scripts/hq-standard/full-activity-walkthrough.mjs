import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startHqServer } from './server.mjs';

const root = path.resolve('docs/crm-activity/full-walkthrough-20261108/activity');
await mkdir(path.join(root, 'screenshots'), { recursive: true });
const steps = []; let serial = 0;
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', timeout: 90000 });
for (const device of [{ id: 'pc', width: 1440, height: 900 }, { id: 'tablet', width: 768, height: 1024 }, { id: 'mobile', width: 390, height: 844 }]) {
  const runtime = await startHqServer({ port: 0, storageDir: false, autoAdvance: false });
  const context = await browser.newContext({ viewport: { width: device.width, height: device.height }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  const page = await context.newPage(); page.setDefaultTimeout(7000);
  let lastDialog = ''; page.on('dialog', dialog => { lastDialog = `${dialog.type()}: ${dialog.message()}`; });
  const shot = async id => { const file = `screenshots/${id}.png`; await page.screenshot({ path: path.join(root, file), fullPage: true }); return file; };
  const step = async (area, title, expected, action) => {
    const id = `${device.id}-${String(++serial).padStart(3, '0')}`; const screenshots = []; let status = 'PASS', actual = '', note = ''; lastDialog = '';
    try { screenshots.push(await shot(`${id}-before`)); actual = await action(); screenshots.push(await shot(`${id}-after`)); }
    catch (error) { status = 'FAIL'; actual = error.message.split('\n')[0]; try { screenshots.push(await shot(`${id}-failure`)); } catch {} }
    if (lastDialog) note = `브라우저 기본 대화상자: ${lastDialog}. 대화상자는 페이지 캡처에 표시되지 않을 수 있다.`;
    steps.push({ id, device: device.id, area, title, actions: [title], expected, actual, status, screenshots, note });
    console.log(`${id} ${status} ${title}`);
  };
  const blocked = (area, title, reason, status = 'BLOCKED') => steps.push({ id: `${device.id}-${String(++serial).padStart(3, '0')}`, device: device.id, area, title, actions: [], expected: '해당 기능의 동작과 결과를 확인한다.', actual: '실행하지 못함', status, screenshots: [], note: reason });
  try {
    await page.goto(`${runtime.url}/activities`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('.hq-mock-controls select').first().selectOption('hq-sales');
    await page.getByRole('tab', { name: '활동 목록' }).waitFor();
    await step('목록', '활동 목록 첫 화면 확인', '목록, 검색, 상태, 등록 진입이 보인다.', async () => { await page.getByLabel('활동 검색').waitFor(); await page.getByRole('button', { name: '활동 등록' }).waitFor(); return `활동 행 ${await page.locator('.hq-act-schedule-row').count()}개와 검색·등록 확인`; });
    await step('목록', '검색 결과 없음 확인', '일치하는 활동이 없다는 메시지를 표시한다.', async () => { await page.getByLabel('활동 검색').fill('없는-병원-TEST-20261108'); await page.getByText('조회된 활동이 없습니다.').waitFor(); return '빈 결과 메시지 표시'; });
    await step('목록', '검색 초기화', '검색을 지우면 활동이 다시 나타난다.', async () => { await page.getByLabel('활동 검색').fill(''); await page.locator('.hq-act-schedule-row').first().waitFor(); return '활동 목록 표시'; });
    for (const [code, label] of [['PLANNED','예정'], ['IN_PROGRESS','진행중'], ['COMPLETED','완료'], ['CANCELLED','취소']]) await step('목록', `상태 ${label} 선택`, '선택한 상태에 해당하는 결과 또는 빈 결과를 표시한다.', async () => { const pending = page.waitForResponse(r => r.url().includes('/api/activities?') && new URL(r.url()).searchParams.get('status') === code); await page.getByLabel('활동 상태').selectOption(code); const res = await pending; const rows = await res.json(); if (!rows.every(r => r.status === code)) throw Error('다른 상태가 포함됨'); return `HTTP ${res.status()}, ${rows.length}건`; });
    await page.getByLabel('활동 상태').selectOption('');
    for (const [name, label] of [['일','일간 일정'], ['월','월간 일정'], ['지도','지도']]) await step('보기', `${label} 보기`, '선택한 보기가 표시된다.', async () => { await page.getByRole('tab', { name, exact: true }).click(); if (name === '월') await page.getByRole('grid').waitFor(); if (name === '지도') await page.getByRole('button', { name: '현재 위치로 조회' }).waitFor(); return `${label} 탭 표시`; });
    await step('지도', '위치 권한 거부 후 조회', '위치 확인 실패가 안내된다.', async () => { await context.clearPermissions(); await context.grantPermissions([]); await page.getByRole('button', { name: '현재 위치로 조회' }).click(); await page.getByText(/위치를 확인할 수 없습니다|GPS를 사용할 수 없습니다/).first().waitFor(); return '위치 확인 실패 메시지 표시'; });
    await step('지도', '모의 위치 허용 후 조회', '모의 위치를 사용해 목업 지도가 표시된다.', async () => { await context.grantPermissions(['geolocation']); await context.setGeolocation({ latitude: 35.171, longitude: 129.127 }); await page.getByRole('button', { name: '현재 위치로 조회' }).click(); await page.locator('svg.hq-act-map').waitFor(); return '브라우저 모의 위치로 지도 표시; 실제 GPS 아님'; });
    await page.getByRole('tab', { name: '활동 목록' }).click();
    await step('상세', '목록에서 활동 상세 열기', '선택한 활동 상세와 동작을 표시한다.', async () => { await page.locator('.hq-act-schedule-row').first().click(); await page.locator('[data-hq-screen="SCR-ACT-002"]').waitFor(); return '활동 상세 표시'; });
    await step('상세', '모의 위치 IN', '방문이 시작되고 상담 입력이 표시된다.', async () => { await page.getByRole('button', { name: '병원 위치로 모의 IN' }).click(); await page.getByLabel('상담정보').waitFor(); return '모의 좌표 IN 후 상담 입력 표시'; });
    await step('상세', '미저장 상담 OUT 차단', '저장 전 종료를 막고 입력을 보존한다.', async () => { await page.getByLabel('상담정보').fill(`검증 상담 ${device.id}`); await page.getByRole('button', { name: '병원 위치로 모의 OUT' }).click(); await page.getByText('상담 내용을 저장한 뒤 방문을 종료해 주세요.').waitFor(); return `미저장 입력 유지: ${await page.getByLabel('상담정보').inputValue()}`; });
    await step('상세', '미저장 상담 이탈 취소', '이탈을 취소하면 입력이 유지된다.', async () => { page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: '목록으로 돌아가기' }).click(); return `상담 내용 유지: ${await page.getByLabel('상담정보').inputValue()}`; });
    await step('상세', '상담 저장', '상담 내용을 저장한다.', async () => { await page.getByRole('button', { name: '상담 저장' }).click(); await page.getByText('상담 내용을 저장했습니다.').waitFor(); return '상담 저장 성공 메시지'; });
    await step('상세', '모의 위치 OUT', '방문이 완료되고 상담이 보인다.', async () => { await page.getByRole('button', { name: '병원 위치로 모의 OUT' }).click(); await page.getByText('OUT을 등록했습니다.').waitFor(); await page.getByText(`검증 상담 ${device.id}`).waitFor(); return 'OUT 완료 및 저장 상담 표시'; });
    await step('상세', '완료 활동에서 보고 메뉴 이동', '활동보고 화면으로 이동한다.', async () => { await page.getByRole('link', { name: '활동보고로 이동' }).click(); await page.waitForURL('**/activity-reports'); return `이동 주소 ${new URL(page.url()).pathname}`; });
    await page.goto(`${runtime.url}/activities`, { waitUntil: 'domcontentloaded' }); await page.getByRole('tab', { name: '활동 목록' }).waitFor();
    await step('등록', '단건 등록 화면 열기', '등록 항목과 목록 복귀가 보인다.', async () => { await page.getByRole('button', { name: '활동 등록' }).click(); await page.getByText('단건 활동 계획').waitFor(); return '단건 등록 표시'; });
    await step('등록', '대상 미선택 필수검증', '대상을 선택하지 않으면 브라우저가 제출을 막는다.', async () => { const form = page.locator('form').first(); await form.getByRole('button', { name: '등록', exact: true }).click(); const valid = await form.getByLabel('병원·거래처').evaluate(el => el.validity.valid); if (valid) throw Error('미선택 검증 실패'); return '대상 필수 입력으로 제출 차단'; });
    await step('등록', '직출 선택과 사유 표시', '직출 선택 시 사유 입력이 나타난다.', async () => { const form = page.locator('form').first(); await form.getByLabel('직출·직퇴').selectOption('DIRECT_WORK'); await form.getByLabel('사유').waitFor(); return '직출 사유 표시'; });
    await step('등록', '직퇴 선택과 사유 표시', '직퇴 선택 시 사유 입력이 나타난다.', async () => { const form = page.locator('form').first(); await form.getByLabel('직출·직퇴').selectOption('DIRECT_LEAVE'); await form.getByLabel('사유').waitFor(); return '직퇴 사유 표시'; });
    await step('등록', '미저장 등록 복귀 거부', '취소하면 입력이 남는다.', async () => { const form = page.locator('form').first(); await form.getByLabel('방문 목적').fill('임시 계획'); page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: '목록으로 돌아가기' }).click(); return `유지된 입력: ${await form.getByLabel('방문 목적').inputValue()}`; });
    await step('등록', '미저장 등록 복귀 수락', '입력을 버리고 목록으로 돌아간다.', async () => { page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '목록으로 돌아가기' }).click(); await page.getByLabel('활동 검색').waitFor(); return '목록 복귀'; });
    if (device.id === 'mobile') blocked('다건 등록', '다건 등록', '모바일에서는 다건 양식이 숨겨지고 PC 이용 안내가 표시되는 설계다.', 'NOT_APPLICABLE');
    else blocked('다건 등록', '다건 행 추가·삭제·저장', '이번 실행에서 실제 행 변경과 저장을 수행하지 않았다.');
    await step('권한', '조회 전용 사용자 등록 제한', '조회 전용 사용자에게 등록 버튼이 보이지 않는다.', async () => { await page.locator('.hq-mock-controls select').first().selectOption('hq-viewer'); await page.waitForFunction(() => document.querySelector('.hq-mock-controls select')?.value === 'hq-viewer'); if (await page.getByRole('button', { name: '활동 등록' }).count()) throw Error('등록 버튼 표시됨'); return '등록 버튼 미표시'; });
  } catch (error) { blocked('환경', '이후 단계 실행', `화면 준비 또는 시나리오 진행 실패: ${error.message.split('\n')[0]}`); }
  for (const [area, title, reason] of [
    ['목록','조회 오류와 재시도','별도 오류 응답 주입 및 재시도 시나리오를 실행하지 않았다.'],
    ['보기','날짜 변경과 일정 결과 비교','날짜 입력 변경 전후의 서버 결과 비교를 실행하지 않았다.'],
    ['등록','리드·거래처·영업기회 대상 연동','유형별 선택과 대상 목록 대조를 실행하지 않았다.'],
    ['등록','직출·직퇴 사유 누락 검증','사유가 빈 상태에서 제출 결과를 실행하지 않았다.'],
    ['등록','단건 저장 실패 입력 보존','서버 오류 주입 후 입력 보존을 실행하지 않았다.'],
    ['등록','단건 저장 성공','실제 단건 등록을 실행하지 않았다.'],
    ['상세','중복 IN/OUT 방지','중복 요청 또는 동시성 시험을 실행하지 않았다.'],
    ['상세','미저장 상담 이탈 수락','상담 변경 후 폐기 확인을 실행하지 않았다.'],
    ['이탈','브라우저 뒤로가기 입력 손실','브라우저 뒤로가기 동작을 실행하지 않았다.'],
    ['지도','실제 GPS','데스크톱 브라우저에서 모의 좌표만 사용했으며 실제 기기 GPS는 시험하지 않았다.']
  ]) blocked(area, title, reason);
  await context.close(); runtime.server.closeAllConnections(); await runtime.close();
  await writeFile(path.join(root, 'steps.json'), JSON.stringify(steps, null, 2));
}
await browser.close();
await writeFile(path.join(root, 'steps.json'), JSON.stringify(steps, null, 2));
console.log(`완료: ${steps.length} steps`);
process.exit(0);
