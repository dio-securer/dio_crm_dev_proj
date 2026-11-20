import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('docs/crm-activity');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const sections = [
  ['목록에서 시작', '활동 메뉴를 열면 목록이 먼저 보입니다. 검색어와 활동 상태로 대상을 찾고 해당 행을 눌러 상세로 이동합니다. 신규 계획은 활동 등록 버튼을 누릅니다.', 'activity-list-width-1440.png'],
  ['계획 등록', '대상 유형을 선택한 뒤 병원·거래처, 예정 시각, 방문 목적을 입력합니다. 직출·직퇴를 선택한 경우 사유를 입력합니다. 등록에 성공하면 목록으로 돌아갑니다. 입력 중 목록으로 돌아갈 때 취소를 선택하면 입력을 유지합니다.', 'activity-register-width-1440.png'],
  ['방문 시작 전 상세', '예정 활동을 열어 대상과 예정 시각을 확인합니다. 이 시험에서는 병원 위치로 모의 IN을 눌렀습니다. 모의 위치 시험은 실제 현장의 GPS 검증을 대신하지 않습니다.', 'activity-step-detail-before-in.png'],
  ['상담 입력과 저장', 'IN 후 상담정보를 입력하고 상담 저장을 누릅니다. 저장하지 않은 내용이 있으면 OUT을 막고 먼저 저장하도록 안내합니다. 저장 성공을 확인한 다음 OUT을 진행합니다.', 'activity-step-consultation-before-save.png'],
  ['방문 종료', '시험에서는 병원 위치로 모의 OUT을 눌러 종료했습니다. 이력에서 IN·상담 저장·OUT을 확인하고 목록으로 돌아갑니다.', 'activity-step-detail-after-out.png'],
  ['태블릿 등록 화면', '768px 화면의 수정 후 등록 배치입니다. 예정 시각 입력 폭을 넓혀 날짜와 시간이 표시되도록 보완했습니다.', 'activity-register-final-768.png'],
  ['모바일 목록', '390px에서는 목록에서 활동을 선택하거나 활동 등록으로 이동합니다. 단건 등록을 사용하며 다건 등록은 기존 PC 안내를 표시합니다.', 'activity-list-width-390.png'],
  ['좁은 모바일 등록', '320px에서 등록 항목을 순서대로 입력하는 화면입니다. 화면 너비 확인과 실제 기기의 키보드·터치 사용성 검증은 구분합니다.', 'activity-register-width-320.png'],
  ['PC 보고 상세 팝업', '활동보고 메뉴에서 보고 상세를 엽니다. 상담 내용을 수정한 채 승인요청을 누르면 요청 전송을 차단합니다. 내용을 저장한 뒤 승인요청을 실행합니다. 독립 시험에서 저장 후 요청 HTTP 200을 확인했습니다.', 'activity-report-modal-final-1440.png'],
  ['태블릿 보고 상세 팝업', '768px에서도 같은 저장·승인 규칙을 적용합니다. 미저장 상태에서 Esc를 누르고 닫기 확인을 취소하면 입력이 유지됩니다. 닫기를 수락하면 원래 상세 버튼으로 포커스가 돌아옵니다.', 'activity-report-modal-final-768.png'],
  ['모바일 보고 상세 팝업', '390px에서 미저장 승인 차단, 닫기 취소 시 입력 유지, 닫기 수락 후 포커스 복귀, 저장 후 승인요청을 실행했습니다. 실제 휴대전화 Safari 시험은 아닙니다.', 'activity-report-modal-final-390.png'],
];
const figures = sections.map(([title, description, filename], i) => {
  const file = path.join(root, 'evidence/W00', filename);
  if (!fs.existsSync(file)) throw new Error(`Missing evidence: ${file}`);
  return `<section id="step-${i + 1}"><h2>${i + 1}. ${escape(title)}</h2><p>${escape(description)}</p><details><summary>화면 캡처 보기</summary><img alt="${escape(title)}" src="data:image/png;base64,${fs.readFileSync(file).toString('base64')}"><p class="source">${escape(filename)}</p></details></section>`;
}).join('\n');
const reports = '<section><h2>현재 연결 범위와 남은 작업</h2><p>목록·등록·상세 및 방문 수행의 기본 전환은 구현되어 있습니다. 완료 활동 상세에 활동보고 메뉴 이동을 추가했습니다. 보고 생성은 자동 실행하지 않습니다. 브라우저 뒤로가기·다른 메뉴 이동 시 미저장 보호, 지도·병원 상세·후속활동의 통합 흐름은 이 기록으로 완료 판정하지 않습니다.</p><p>기기별로 동일한 저장·상태 규칙을 사용하되 화면 배치를 조정합니다. 아래 다섯 크기의 목록·등록 점검은 레이아웃 검증이며, 최종 팝업 동작 시험 범위는 독립 검증 기록에 별도로 기재합니다.</p></section>' + process.argv.slice(2).map(relative => {
  const content = fs.readFileSync(path.resolve(relative), 'utf8');
  return `<section><h2>${escape(path.basename(relative))}</h2><pre>${escape(content)}</pre></section>`;
}).join('\n');
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>활동관리 업무 흐름 점검</title><style>body{margin:0;background:#f4f7fa;color:#172a3a;font:16px/1.7 system-ui,sans-serif}main{max-width:1050px;margin:auto;padding:24px}section,header{background:white;padding:24px;margin:18px 0;border:1px solid #dce3e8;border-radius:12px}h1{font-size:28px}h2{font-size:21px}img{max-width:100%;height:auto;border:1px solid #dce3e8}summary{cursor:pointer;padding:12px;background:#eaf3f4}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.7 system-ui,sans-serif}.source{color:#58677b;font-size:13px}.note{border-left:4px solid #087d7a;padding-left:16px}@media(max-width:650px){main{padding:10px}section,header{padding:16px}}</style><main><header><h1>활동관리 업무 흐름 점검</h1><p>2026-11-08 · 본사 CRM 목업 · 작업자 A 수정 / 작업자 B 독립 검증</p><p class="note">격리된 메모리 서버와 별도 Playwright Chrome에서 시험했습니다. 캡처는 점검 과정의 화면이며, 수정 전후 구분과 최종 판정은 아래 검증 기록을 우선합니다. 이 문서는 전체 활동관리 완성 판정이나 실기기 검증 완료를 뜻하지 않습니다.</p><p>기본 흐름: 목록 → 계획 등록 → 상세 → IN → 상담 저장 → OUT → 보고서 작성·저장 → 승인 요청. 목록 복귀, 취소, 오류, 미저장 입력도 업무 흐름에 포함합니다.</p></header>${figures}${reports}<footer>이미지가 포함된 단일 HTML 파일입니다. 별도 서버 없이 열람할 수 있습니다.</footer></main></html>`;
const output = path.join(root, 'activity-flow-review.html');
fs.writeFileSync(output, html, 'utf8');
console.log(JSON.stringify({ output, images: sections.length, reports: process.argv.length - 2, bytes: Buffer.byteLength(html) }));
