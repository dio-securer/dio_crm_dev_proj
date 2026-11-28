"""Export the reviewed visual editor design into a standalone local HTML document."""
from pathlib import Path
import html
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
work_instructions = '--work' in sys.argv
assessment = '--assessment' in sys.argv
w07 = '--w07' in sys.argv
execution = '--execution' in sys.argv
maps = '--maps' in sys.argv
SOURCE = ROOT / ('docs/admin-platform/customization/32_W07_Independent_Review.md' if w07 else 'docs/admin-platform/customization/31_E01_Lead_And_Persistence_Assessment.md' if assessment else 'docs/admin-platform/customization/30_Admin_Visual_Editor_Stage_Work_Instructions.md' if work_instructions else 'docs/admin-platform/customization/29_Admin_Visual_Editor_Extension_Design.md')
TARGET = SOURCE.with_suffix('.html')
if execution:
    SOURCE = ROOT / 'docs/admin-platform/customization/33_Continuous_Execution_Report.md'
    TARGET = SOURCE.with_suffix('.html')
if maps:
    SOURCE = ROOT / 'docs/admin-platform/customization/35_Company_Map_Provider_Design.md'
    TARGET = SOURCE.with_suffix('.html')
text = SOURCE.read_text(encoding='utf-8')
lines = text.splitlines()
inline_re = re.compile(r'\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|`([^`]+)`')


def inline(value):
    result, pos = [], 0
    for match in inline_re.finditer(value):
        result.append(html.escape(value[pos:match.start()]))
        label, url, strong, code = match.groups()
        if label is not None:
            result.append(f'<a href="{html.escape(url, quote=True)}">{html.escape(label)}</a>')
        elif strong is not None:
            result.append(f'<strong>{html.escape(strong)}</strong>')
        else:
            result.append(f'<code>{html.escape(code)}</code>')
        pos = match.end()
    result.append(html.escape(value[pos:]))
    return ''.join(result)


def table_cells(line):
    return [part.strip() for part in line.strip().strip('|').split('|')]


sections = []
for line in lines:
    match = re.match(r'^## (\d+)\.\s+(.+)$', line)
    if match:
        sections.append((match.group(1), match.group(2)))
if len(sections) != (6 if assessment or w07 or execution or maps else 14):
    raise ValueError('Unexpected numbered sections; update exporter for source changes.')

out = []
i = 1
in_section = False
while i < len(lines):
    line = lines[i]
    if not line.strip():
        i += 1
        continue
    heading = re.match(r'^(#{2,3})\s+(.+)$', line)
    if heading:
        depth, title = len(heading.group(1)), heading.group(2)
        if depth == 2:
            if in_section:
                out.append('</section>')
            number = re.match(r'^(\d+)\.', title).group(1)
            out.append(f'<section id="section-{number}"><h2>{inline(title)}</h2>')
            in_section = True
        else:
            out.append(f'<h3>{inline(title)}</h3>')
        i += 1
        continue
    if line.startswith('```'):
        kind = line[3:].strip()
        end = i + 1
        while end < len(lines) and not lines[end].startswith('```'):
            end += 1
        if end == len(lines):
            raise ValueError('Unclosed code block')
        content = '\n'.join(lines[i + 1:end])
        if kind == 'mermaid':
            out.append('<div class="flow" aria-label="관리자 사용 흐름"><span>법인 선택</span><span>작업 선택</span><span>화면·필드 편집</span><span>법인 작업본</span><span>저장·검증</span><span>게시</span><span>사용자 화면 적용 확인</span></div><p class="muted">프로세스·메뉴 설정과 화면·필드 편집은 같은 법인 작업본에 반영됩니다.</p>')
        else:
            out.append(f'<pre><code>{html.escape(content)}</code></pre>')
        i = end + 1
        continue
    if line.startswith('|') and i + 1 < len(lines) and re.match(r'^\|[\s:|-]+\|$', lines[i + 1]):
        headers = table_cells(line)
        rows = []
        i += 2
        while i < len(lines) and lines[i].startswith('|'):
            row = table_cells(lines[i])
            if len(row) != len(headers):
                raise ValueError(f'Unexpected table column count: {lines[i]}')
            rows.append(row)
            i += 1
        out.append('<div class="table-wrap"><table><thead><tr>' + ''.join(f'<th scope="col">{inline(c)}</th>' for c in headers) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in row) + '</tr>' for row in rows) + '</tbody></table></div>')
        continue
    ordered = re.match(r'^\d+\.\s+(.+)$', line)
    bullet = re.match(r'^-\s+(.+)$', line)
    if ordered or bullet:
        kind = 'ol' if ordered else 'ul'
        pattern = r'^\d+\.\s+(.+)$' if ordered else r'^-\s+(.+)$'
        items = []
        while i < len(lines):
            item = re.match(pattern, lines[i])
            if not item:
                break
            items.append(f'<li>{inline(item.group(1))}</li>')
            i += 1
        out.append(f'<{kind}>' + ''.join(items) + f'</{kind}>')
        continue
    out.append(f'<p>{inline(line)}</p>')
    i += 1
if in_section:
    out.append('</section>')

toc = ''.join(f'<a href="#section-{number}"><span>{number.zfill(2)}</span>{html.escape(title)}</a>' for number, title in sections)
document = '''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>법인 CRM 화면 편집기 확장 설계안</title>
<style>
:root{--ink:#172c40;--muted:#526477;--blue:#2358cf;--line:#dce4ed;--bg:#f3f6fa;--navy:#132f50}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.8 "Malgun Gothic","Apple SD Gothic Neo",sans-serif;word-break:keep-all}a{color:var(--blue)}a:focus-visible,button:focus-visible{outline:3px solid #238aab;outline-offset:3px}.wrap{max-width:1500px;margin:auto;padding:26px 24px 64px}.toolbar{display:flex;justify-content:flex-end;gap:9px;margin-bottom:12px}.toolbar button,.toolbar a{font:inherit;font-size:13px;background:#fff;border:1px solid #cbd8e7;border-radius:8px;padding:7px 12px;text-decoration:none;cursor:pointer}.hero{background:var(--navy);color:#fff;padding:42px 46px;border-radius:20px}.eyebrow{color:#8edcd5;font-size:12px;font-weight:700;letter-spacing:.12em}.hero h1{font-size:32px;line-height:1.35;margin:12px 0}.hero p{color:#d8e4f3;max-width:900px;margin:10px 0}.hero .meta{font-size:13px;color:#bed0e4}.callout{margin:18px 0;background:#fff8e9;border:1px solid #eed7a8;color:#714e1c;border-radius:10px;padding:14px 18px}.grid{display:grid;grid-template-columns:245px minmax(0,1fr);gap:20px;align-items:start}.toc{position:sticky;top:16px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:15px;max-height:calc(100vh - 32px);overflow:auto}.grid>*{min-width:0}.toc a{min-width:0;overflow-wrap:anywhere}.toc h2{font-size:14px;margin:0 0 9px}.toc a{display:flex;gap:9px;padding:6px;border-radius:6px;text-decoration:none;color:#40556a;font-size:13px;line-height:1.5}.toc a:hover{background:#edf4ff;color:var(--blue)}.toc a span{font-size:11px;font-weight:bold;color:#6d83a0;padding-top:2px}.content>p{padding:0 4px}.content section{background:#fff;border:1px solid var(--line);border-radius:14px;padding:28px 30px;margin:0 0 16px;scroll-margin-top:18px}.content h2{margin:0 0 15px;font-size:22px;line-height:1.4}.content h3{margin:24px 0 10px;font-size:17px}.content p{margin:10px 0 14px}.content li{margin:7px 0}.content ol,.content ul{padding-left:24px}.table-wrap{overflow-x:auto;margin:15px 0}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;vertical-align:top;padding:11px 12px;border-bottom:1px solid var(--line)}th{background:#edf3fa;color:#294363;white-space:nowrap}td:first-child{font-weight:700}code{font-family:Consolas,monospace;font-size:.9em;background:#edf2f8;padding:2px 4px;border-radius:4px;overflow-wrap:anywhere}pre{overflow:auto;background:#102d4c;color:#e6eef8;padding:18px;border-radius:8px;line-height:1.5}pre code{background:none;padding:0;color:inherit;overflow-wrap:normal}.flow{display:flex;flex-wrap:wrap;gap:9px;margin:16px 0}.flow span{border:1px solid #cbdaf0;background:#f1f6ff;color:#244d89;padding:9px 12px;border-radius:8px;font-size:13px;font-weight:bold}.flow span:not(:last-child)::after{content:" →";color:#7190bc}.muted{color:var(--muted);font-size:13px}footer{color:var(--muted);font-size:13px;padding:8px 4px}@media(max-width:850px){.grid{grid-template-columns:1fr}.toc{position:static;max-height:none}.toc nav{display:flex;flex-wrap:wrap}.toc a{width:50%;min-width:0;overflow-wrap:anywhere}.hero{padding:28px}.hero h1{font-size:26px}.content section{padding:22px 18px}th,td{min-width:130px}}@media print{body{background:#fff;font-size:10pt}.wrap{max-width:none;padding:0}.toolbar,.toc{display:none}.grid{display:block}.hero{background:white;color:var(--ink);border:1px solid var(--line);padding:18px}.hero p,.hero .meta,.eyebrow{color:var(--muted)}.content section{border:0;border-top:1px solid var(--line);padding:16px 0;border-radius:0}.table-wrap{overflow:visible}table{font-size:9pt}tr,pre{break-inside:avoid}a{color:inherit;text-decoration:none}}
</style></head><body><main class="wrap"><div class="toolbar"><a href="28_Admin_Workspace_Prototype.html">관리자 시안 보기</a><a href="29_Admin_Visual_Editor_Extension_Design.md">원본 Markdown</a><button type="button" onclick="window.print()">인쇄 / PDF 저장</button></div><header class="hero"><div class="eyebrow">DIO CRM · VISUAL EDITOR DESIGN</div><h1>법인 CRM 화면 편집기<br>확장 설계안</h1><p>프로세스부터 화면·팝업·필드·버튼까지, 관리자 편집과 검증·게시 흐름을 하나의 작업본으로 연결합니다.</p><div class="meta">2026.10.28 KST · 검토안 · 구현 완료 보고서가 아닙니다</div></header><div class="callout"><strong>검토 기준</strong> · 기존 화면 편집기에서 신규 필드 생성, 영역 배치, 팝업과 액션 연결까지 확장하기 위한 설계입니다. 법인별 정책과 실제 운영 연결은 별도 확인이 필요합니다.</div><div class="grid"><aside class="toc" aria-label="문서 목차"><h2>문서 목차</h2><nav>__TOC__</nav></aside><article class="content">__CONTENT__</article></div><footer>기준 문서: <a href="29_Admin_Visual_Editor_Extension_Design.md">화면 편집기 확장 설계안 원본</a> · <a href="28_Admin_Workspace_Prototype.html">관리자 화면 시안</a></footer></main></body></html>'''
if work_instructions:
    document = document.replace('법인 CRM 화면 편집기 확장 설계안', '법인 CRM 화면 편집기 단계별 작업지시서')
    document = document.replace('법인 CRM 화면 편집기<br>확장 설계안', '법인 CRM 화면 편집기<br>단계별 작업지시서')
    document = document.replace('프로세스부터 화면·팝업·필드·버튼까지, 관리자 편집과 검증·게시 흐름을 하나의 작업본으로 연결합니다.', '관리자 화면, DB 영속 저장, 사용자 화면 적용까지 E01~E08 단계별 작업과 완료 기준을 정리합니다.')
    document = document.replace('2026.10.28 KST · 검토안 · 구현 완료 보고서가 아닙니다', '2026.10.28 KST · 작업 계획 · 구현 완료 보고서가 아닙니다')
    document = document.replace('기존 화면 편집기에서 신규 필드 생성, 영역 배치, 팝업과 액션 연결까지 확장하기 위한 설계입니다. 법인별 정책과 실제 운영 연결은 별도 확인이 필요합니다.', '단계별 구현·검증과 독립 검증을 위한 지시서입니다. 실제 DB 연결과 운영 배포는 별도 승인과 환경이 필요합니다.')
    document = document.replace('29_Admin_Visual_Editor_Extension_Design.md', '30_Admin_Visual_Editor_Stage_Work_Instructions.md')
    document = document.replace('28_Admin_Workspace_Prototype.html', '29_Admin_Visual_Editor_Extension_Design.html')
    document = document.replace('관리자 시안 보기', '확장 설계안 보기').replace('관리자 화면 시안', '화면 편집기 확장 설계안').replace('화면 편집기 확장 설계안 원본', '단계별 작업지시서 원본')
if assessment:
    document = document.replace('법인 CRM 화면 편집기 확장 설계안', 'E01 리드 화면과 DB/API 대조 결과')
    document = document.replace('법인 CRM 화면 편집기<br>확장 설계안', 'E01 리드 화면과<br>DB/API 대조 결과')
    document = document.replace('프로세스부터 화면·팝업·필드·버튼까지, 관리자 편집과 검증·게시 흐름을 하나의 작업본으로 연결합니다.', '실제 리드 화면과 팝업의 설정 ID, 목록 API, DB 저장 경로와 미결정 정책을 대조합니다.')
    document = document.replace('2026.10.28 KST · 검토안 · 구현 완료 보고서가 아닙니다', '2026.10.28 KST · 대표 범위 독립 검증 통과 · 실제 DB 미검증')
    document = document.replace('기존 화면 편집기에서 신규 필드 생성, 영역 배치, 팝업과 액션 연결까지 확장하기 위한 설계입니다. 법인별 정책과 실제 운영 연결은 별도 확인이 필요합니다.', '현재 화면과 저장 경로를 대조하고 작업자 B가 대표 범위를 독립 검증했습니다. 실제 DB와 운영 연결은 미검증입니다.')
    document = document.replace('29_Admin_Visual_Editor_Extension_Design.md', '31_E01_Lead_And_Persistence_Assessment.md')
    document = document.replace('28_Admin_Workspace_Prototype.html', '30_Admin_Visual_Editor_Stage_Work_Instructions.html')
    document = document.replace('관리자 시안 보기', '단계별 작업지시서').replace('관리자 화면 시안', '단계별 작업지시서').replace('화면 편집기 확장 설계안 원본', 'E01 대조 결과 원본')
if w07:
    document = document.replace('법인 CRM 화면 편집기 확장 설계안', 'W07 화면형 편집기 작업자 B 독립 검증')
    document = document.replace('법인 CRM 화면 편집기<br>확장 설계안', 'W07 화면형 편집기<br>작업자 B 독립 검증')
    document = document.replace('프로세스부터 화면·팝업·필드·버튼까지, 관리자 편집과 검증·게시 흐름을 하나의 작업본으로 연결합니다.', '리드·거래처의 실제 화면, 작업본, 권한 및 게시 흐름을 독립 검증하고 지적 사항을 재확인했습니다.')
    document = document.replace('2026.10.28 KST · 검토안 · 구현 완료 보고서가 아닙니다', '2026.10.28 KST · 대표 범위 PASS · 전체 판정 보류')
    document = document.replace('기존 화면 편집기에서 신규 필드 생성, 영역 배치, 팝업과 액션 연결까지 확장하기 위한 설계입니다. 법인별 정책과 실제 운영 연결은 별도 확인이 필요합니다.', '합성 환경의 대표 조합과 수정 결과를 독립 검증했습니다. 남은 상태별 fixture와 실제 DB·운영 검증은 별도로 기록합니다.')
    document = document.replace('29_Admin_Visual_Editor_Extension_Design.md', '32_W07_Independent_Review.md')
    document = document.replace('28_Admin_Workspace_Prototype.html', '30_Admin_Visual_Editor_Stage_Work_Instructions.html')
    document = document.replace('관리자 시안 보기', '단계별 작업지시서').replace('관리자 화면 시안', '단계별 작업지시서').replace('화면 편집기 확장 설계안 원본', 'W07 독립 검증 원본')
if maps:
    document = document.replace('법인 CRM 화면 편집기 확장 설계안', '법인별 지도 공급자 및 표시 설정 설계')
    document = document.replace('법인 CRM 화면 편집기<br>확장 설계안', '법인별 지도 공급자<br>및 표시 설정 설계')
    document = document.replace('프로세스부터 화면·팝업·필드·버튼까지, 관리자 편집과 검증·게시 흐름을 하나의 작업본으로 연결합니다.', '법인별 지도 공급자 선택과 공급자별 기능·표시·데이터 이용을 설정하고 검증합니다.')
    document = document.replace('2026.10.28 KST · 검토안 · 구현 완료 보고서가 아닙니다', '2026.10.29 KST · 요구사항 및 설계 · 실제 지도 연동 미구현')
    document = document.replace('기존 화면 편집기에서 신규 필드 생성, 영역 배치, 팝업과 액션 연결까지 확장하기 위한 설계입니다. 법인별 정책과 실제 운영 연결은 별도 확인이 필요합니다.', '서비스별 기능과 이용 조건을 확인하고 법인별 설정·게시 및 데이터 보관 기준을 확정해야 합니다.')
    document = document.replace('29_Admin_Visual_Editor_Extension_Design.md', '35_Company_Map_Provider_Design.md')
    document = document.replace('28_Admin_Workspace_Prototype.html', '30_Admin_Visual_Editor_Stage_Work_Instructions.html')
    document = document.replace('관리자 시안 보기', '단계별 작업지시서').replace('관리자 화면 시안', '단계별 작업지시서').replace('화면 편집기 확장 설계안 원본', '지도 설정 설계 원본')
if execution:
    document = document.replace('법인 CRM 화면 편집기 확장 설계안', '관리자 화면 편집기 연속 구현 결과')
    document = document.replace('법인 CRM 화면 편집기<br>확장 설계안', '관리자 화면 편집기<br>연속 구현 결과')
    document = document.replace('프로세스부터 화면·팝업·필드·버튼까지, 관리자 편집과 검증·게시 흐름을 하나의 작업본으로 연결합니다.', '단계별 구현·독립 검증·수정 결과와 정책 대기 및 실제 DB 미검증 범위를 함께 확인합니다.')
    document = document.replace('2026.10.28 KST · 검토안 · 구현 완료 보고서가 아닙니다', '2026.10.28 KST · 로컬 연속 구현 · 전체 운영 인수 미완료')
    document = document.replace('기존 화면 편집기에서 신규 필드 생성, 영역 배치, 팝업과 액션 연결까지 확장하기 위한 설계입니다. 법인별 정책과 실제 운영 연결은 별도 확인이 필요합니다.', '한정 범위 통과와 전체 완료를 구분합니다. 실제 DB·외부 연계·운영 배포는 실행하지 않았습니다.')
    document = document.replace('29_Admin_Visual_Editor_Extension_Design.md', '33_Continuous_Execution_Report.md')
    document = document.replace('28_Admin_Workspace_Prototype.html', '30_Admin_Visual_Editor_Stage_Work_Instructions.html')
    document = document.replace('관리자 시안 보기', '단계별 작업지시서').replace('관리자 화면 시안', '단계별 작업지시서').replace('화면 편집기 확장 설계안 원본', '연속 구현 결과 원본')
TARGET.write_text(document.replace('__TOC__', toc).replace('__CONTENT__', '\n'.join(out)), encoding='utf-8')
print(f'Generated {TARGET.relative_to(ROOT)}: {len(sections)} sections')
