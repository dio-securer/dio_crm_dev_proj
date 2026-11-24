from pathlib import Path
import html
import re

root = Path(__file__).resolve().parents[2]
source = root / 'docs/admin-platform/customization/77_Lead_Detailed_Work_Instructions.md'
target = source.with_suffix('.html')

def inline(value):
    value = html.escape(value)
    value = re.sub(r'\[([^]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', value)
    return re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', value)

parts = []
for line in source.read_text(encoding='utf-8').splitlines():
    if not line.strip():
        continue
    if line.startswith('### '):
        parts.append('<h3>' + inline(line[4:]) + '</h3>')
    elif line.startswith('## '):
        parts.append('<h2>' + inline(line[3:]) + '</h2>')
    elif line.startswith('# '):
        parts.append('<h1>' + inline(line[2:]) + '</h1>')
    elif line.startswith('- [ ] '):
        value = line[6:]
        match = re.match(r'\*\*(S\d{2}-[IV]\d{2})\*\*', value)
        if not match:
            raise ValueError('Checklist item missing ID: ' + line)
        key = match.group(1)
        parts.append('<div class="check"><label><input type="checkbox" data-key="' + key + '"> <span>' + inline(value) + '</span></label><input class="evidence" type="text" data-evidence="' + key + '" aria-label="' + key + ' 검증 결과 및 증거" placeholder="결과 · 검증자 · 증거 경로"></div>')
    else:
        parts.append('<p>' + inline(line) + '</p>')

page = '''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>리드 편집기 상세 작업지시서</title><style>
*{box-sizing:border-box}body{margin:0;background:#f2f5fa;color:#1b3045;font:16px/1.7 "Malgun Gothic",sans-serif;word-break:keep-all}main{max-width:1080px;margin:auto;padding:30px 24px 80px}header{background:#173554;color:white;padding:26px;border-radius:16px}header p{color:#dbe9f8}h1{font-size:30px}h2{margin-top:38px;padding:14px 18px;background:#173554;color:white;border-radius:9px;font-size:21px}h3{font-size:17px;color:#1d4b8b}p{margin:12px 0}a{color:#165dc4}.check{background:#fff;border:1px solid #d7e1ed;border-radius:9px;padding:12px 14px;margin:8px 0}.check label{display:flex;gap:9px;align-items:baseline}.check input[type=checkbox]{width:17px;height:17px;flex:none}.evidence{display:block;width:100%;margin:9px 0 0;padding:8px;border:1px solid #bdcddd;border-radius:5px;font:inherit;font-size:14px}button{font:inherit;border:1px solid #a8bad0;background:white;padding:8px 14px;border-radius:7px;cursor:pointer}.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.notice{background:#e9f2ff;padding:14px;border-radius:8px}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #2c7ce5;outline-offset:2px}@media(max-width:600px){main{padding:15px}h1{font-size:23px}}@media print{body{background:white}main{max-width:none;padding:0}.toolbar{display:none}.check{break-inside:avoid}h2{background:#eee;color:#111}}
</style></head><body><main><header><div>DIO CRM · LEAD</div><p>단계별 구현 및 독립 검증</p></header><div class="toolbar"><button type="button" onclick="window.print()">인쇄 / PDF</button><button type="button" id="clear">이 브라우저의 체크 초기화</button><span id="count" aria-live="polite"></span></div><p class="notice">체크와 증거 메모는 이 브라우저의 로컬 저장소에만 보관됩니다. 다른 사용자와 공유되지 않으며 체크만으로 PASS가 되지 않습니다. 공식 결과는 단계별 실행 기록에 남기세요.</p>''' + '\n'.join(parts) + '''</main><script>
const prefix='dio-lead-instructions-77-v1:';const checks=[...document.querySelectorAll('[data-key]')];const notes=[...document.querySelectorAll('[data-evidence]')];function read(k){try{return localStorage.getItem(prefix+k)}catch(e){return null}}function write(k,v){try{localStorage.setItem(prefix+k,v)}catch(e){document.getElementById('count').textContent='브라우저 저장을 사용할 수 없습니다.'}}function count(){document.getElementById('count').textContent='체크 '+checks.filter(x=>x.checked).length+' / '+checks.length}checks.forEach(x=>{x.checked=read(x.dataset.key)==='1';x.addEventListener('change',()=>{write(x.dataset.key,x.checked?'1':'0');count()})});notes.forEach(x=>{x.value=read('note:'+x.dataset.evidence)||'';x.addEventListener('input',()=>write('note:'+x.dataset.evidence,x.value))});document.getElementById('clear').addEventListener('click',()=>{if(!confirm('이 브라우저에 저장된 체크와 메모를 모두 지우시겠습니까?'))return;checks.forEach(x=>{x.checked=false;write(x.dataset.key,'0')});notes.forEach(x=>{x.value='';write('note:'+x.dataset.evidence,'')});count()});count();</script></body></html>'''
target.write_text(page, encoding='utf-8')
print(f'Generated {target.relative_to(root)} with {len(re.findall(r"data-key=", page))} checks')
