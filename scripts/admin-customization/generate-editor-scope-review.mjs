import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'docs/admin-platform/customization');
const baseline = JSON.parse(await fs.readFile(path.join(root, 'packages/contracts/catalogs/hq-customization-baseline.json'), 'utf8'));
const review = JSON.parse(await fs.readFile(path.join(root, 'packages/contracts/catalogs/hq-codes-review.json'), 'utf8'));
const registry = await fs.readFile(path.join(root, 'frontend/src/app/screen-registry.tsx'), 'utf8');
const app = await fs.readFile(path.join(root, 'frontend/src/App.tsx'), 'utf8');
const managed = await fs.readFile(path.join(root, 'frontend/src/customization/managed-routes.tsx'), 'utf8');
const profile = await fs.readFile(path.join(root, 'frontend/src/app/screen-profile.ts'), 'utf8');
const routeConfig = await fs.readFile(path.join(root, 'frontend/src/app/route-config.ts'), 'utf8');

const registered = new Set([...registry.matchAll(/\['((?:HQ|GLOBAL)_[A-Z0-9_]+)',/g)].map(match => match[1]));
const routes = new Map();
const routeSlots = new Map([...routeConfig.matchAll(/\{ path: '([^']+)', to: '[^']+', slot: '([^']+)'/g)].map(match => [match[2], match[1]]));
for (const [family, block] of [['HQ', profile.split('export const HQ_SCREEN_PROFILE:')[1]?.split('export const GLOBAL_SCREEN_PROFILE:')[0]], ['GLOBAL', profile.split('export const GLOBAL_SCREEN_PROFILE:')[1]?.split('const SCREEN_PROFILES')[0]]]) {
  for (const match of block?.matchAll(/(\w+): '((?:HQ|GLOBAL)_[A-Z0-9_]+)'/g) ?? []) {
    if (!match[2].startsWith(family + '_')) continue;
    const route = routeSlots.get(match[1]);
    if (route) routes.set(match[2], family === 'HQ' && match[1] === 'lead' ? '/leads' : route);
  }
}
for (const match of app.matchAll(/screenKey: '(HQ_[A-Z0-9_]+)', path: '([^']+)'/g)) routes.set(match[1], match[2]);
const managedRoutes = new Map([...managed.matchAll(/screen:'(HQ_[A-Z0-9_]+)',path:'([^']+)'/g)].map(match => [match[1], match[2]]));
const baselineIds = new Set(baseline.catalog.entries.map(entry => entry.id));
const reviewScreens = review.catalog.entries.filter(entry => entry.kind === 'SCREEN').map(entry => entry.id);
const globalScreens = [...registered].filter(id => id.startsWith('GLOBAL_'));
const ids = [...new Set([...reviewScreens, ...globalScreens])];
const variants = {
  HQ_LEAD: ['목록', '상세', '등록', '담당자 변경', '전환'],
  HQ_ACCOUNT: ['목록', '상세', '등록', '연락처', '일괄 수정', '병합']
};
const screenshots = {
  HQ_LEAD: 'evidence/w01/pc-lead-detail.png',
  HQ_ACCOUNT: 'evidence/w01/pc-account-bulk-popup.png',
  HQ_ACTIVITY: '../../hq-standard/implementation/evidence/h04-pc-month-detail.png',
  HQ_ACTIVITY_REPORT: '../../hq-standard/implementation/evidence/h04-pc-report-approval.png',
  HQ_DIRECT_WORK: '../../hq-standard/implementation/evidence/h04-pc-direct-work.png',
  HQ_OPPORTUNITY: '../../hq-standard/implementation/evidence/h05-pc-opportunity.png',
  HQ_CONTRACT: '../../hq-standard/implementation/evidence/h05-pc-contract.png',
  HQ_ORDER: '../../hq-standard/implementation/evidence/h06-pc-orders.png',
  HQ_FULFILLMENT: '../../hq-standard/implementation/evidence/h06-pc-fulfillment.png',
  HQ_LEDGER: '../../hq-standard/implementation/evidence/h06-pc-ledger-statements.png',
  HQ_ANALYTICS: '../../hq-standard/implementation/evidence/h06-pc-analytics.png',
  HQ_HOME: '../../hq-standard/implementation/evidence/h07-pc-home.png',
  HQ_OPS: '../../hq-standard/implementation/evidence/h07-pc-ops.png',
  HQ_ADMIN_USERS: '../../hq-standard/implementation/evidence/h07-pc-users.png',
  HQ_ADMIN_PERMISSIONS: '../../hq-standard/implementation/evidence/h07-pc-permissions.png',
  HQ_ADMIN_CODES: '../../hq-standard/implementation/evidence/h07-pc-codes.png',
  HQ_ADMIN_INTERFACES: '../../hq-standard/implementation/evidence/h07-pc-interfaces.png',
  HQ_ADMIN_AUDIT: '../../hq-standard/implementation/evidence/h07-pc-audit.png'
};
const processes = {
  HQ_HOME:'시작', HQ_LEAD:'고객', HQ_ACCOUNT:'고객', HQ_ACTIVITY:'활동', HQ_ACTIVITY_REPORT:'활동', HQ_DIRECT_WORK:'활동',
  HQ_OPPORTUNITY:'영업', HQ_PIPELINE:'영업', HQ_CONTRACT:'영업', HQ_ORDER:'주문·납품', HQ_FULFILLMENT:'주문·납품', HQ_PRODUCT_PACKAGE:'주문·납품',
  HQ_LEDGER:'수금·분석', HQ_ACCOUNT360:'수금·분석', HQ_ANALYTICS:'수금·분석', HQ_OPS:'운영', HQ_NOTIFICATIONS:'운영',
  HQ_ADMIN_USERS:'관리자', HQ_ADMIN_PERMISSIONS:'관리자', HQ_ADMIN_CODES:'관리자', HQ_ADMIN_INTERFACES:'관리자', HQ_ADMIN_AUDIT:'관리자',
  HQ_APPROVAL_ROUTE:'경로 미확정', HQ_REFERENCE:'경로 미확정', HQ_ATTACHMENTS:'경로 미확정'
};
const count = (entries, kind) => entries.filter(entry => entry.kind === kind).length;
const screens = ids.map(id => {
  const belongsToScreen = entry => entry.screenId === id || (entry.kind === 'SCREEN' && entry.id === id);
  const entries = review.catalog.entries.filter(belongsToScreen);
  const baselineEntries = baseline.catalog.entries.filter(belongsToScreen);
  const runtime = registered.has(id) ? 'screen-registry' : managedRoutes.has(id) ? 'managed-route' : 'not-routed';
  return {
    id, family: id.startsWith('HQ_') ? 'HQ' : 'GLOBAL', process: processes[id] ?? 'GLOBAL',
    route: managedRoutes.get(id) ?? routes.get(id) ?? null,
    screenshot: screenshots[id] ?? null,
    runtime, previewVariants: variants[id] ?? [],
    reviewCount: entries.length, baselineCount: baselineEntries.length,
    kinds: Object.fromEntries(['SCREEN', 'MENU', 'SECTION', 'TAB', 'POPUP', 'FIELD', 'ACTION', 'CODE'].map(kind => [kind, count(entries, kind)])),
    unsupported: entries.filter(entry => entry.support === 'unsupported').length,
    decisionPending: entries.filter(entry => entry.support === 'decision_pending').length,
    entries: entries.map(entry => ({
      id: entry.id, kind: entry.kind, parentId: entry.parentId ?? null, screenId: entry.screenId,
      labelKey: entry.labelKey, ko: review.translations['ko-KR']?.[entry.labelKey] ?? entry.id,
      en: review.translations['en-US']?.[entry.labelKey] ?? entry.id,
      support: entry.support, settings: entry.settings, capabilities: entry.capabilities, locks: entry.locks,
      dependencies: entry.dependencies, permissions: entry.permissions, readPermissions: entry.readPermissions,
      writePermissions: entry.writePermissions, bindingKind: entry.bindingKind ?? null, apiField: entry.apiField ?? null,
      valueRule: entry.valueRule ?? null, requiredWhen: entry.requiredWhen ?? null,
      requiredTranslation: entry.requiredTranslation, inBaseline: baselineIds.has(entry.id)
    }))
  };
});
const unassigned = review.catalog.entries.filter(entry => entry.kind !== 'SCREEN' && !entry.screenId).map(entry => ({ id: entry.id, kind: entry.kind }));
const inventory = {
  source: { baseline: baseline.catalog.standardReleaseId, baselinePublicationReady: baseline.publicationReady, review: review.catalog.standardReleaseId, reviewPublicationReady: review.publicationReady },
  summary: { hqRegistered: screens.filter(screen => screen.family === 'HQ' && screen.runtime === 'screen-registry').length, hqManagedExtra: screens.filter(screen => screen.family === 'HQ' && screen.runtime === 'managed-route').length, hqUnrouted: screens.filter(screen => screen.family === 'HQ' && screen.runtime === 'not-routed').length, globalRegistered: screens.filter(screen => screen.family === 'GLOBAL' && screen.runtime === 'screen-registry').length, visualPreview: screens.filter(screen => screen.previewVariants.length).length, baselineEntries: baseline.catalog.entries.length, reviewEntries: review.catalog.entries.length, unassigned },
  screens
};
await fs.writeFile(path.join(output, 'evidence/editor-full-scope-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');

const safe = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const inlineData = JSON.stringify(inventory).replace(/</g, '\\u003c');
const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>화면형 설정 편집기 · 전체 범위 설계 검토</title>
<style>
:root{--ink:#1b3045;--muted:#53677d;--line:#d9e3ee;--blue:#2055c7;--bg:#f3f6fa;--panel:#fff;--amber:#9d631c}*{box-sizing:border-box}body{margin:0;color:var(--ink);background:var(--bg);font:15px/1.55 "Malgun Gothic","Apple SD Gothic Neo",sans-serif}button,input,select{font:inherit}button{cursor:pointer}a{color:var(--blue)}header{background:#153151;color:white;padding:20px 28px}header h1{font-size:24px;margin:0 0 5px}header p{margin:0;color:#dce9f7}.notice{background:#fff5df;border-bottom:1px solid #e9c788;padding:9px 28px;color:#704b17}.layout{display:grid;grid-template-columns:250px minmax(0,1fr) 320px;gap:12px;padding:12px;min-height:calc(100vh - 130px)}aside,main{background:var(--panel);border:1px solid var(--line);border-radius:12px;min-width:0;padding:16px}.sidebar{max-height:calc(100vh - 155px);overflow:auto}.sidebar h2,.inspector h2{font-size:17px;margin:0 0 10px}.sidebar h3{font-size:13px;color:var(--muted);margin:18px 0 6px}.sidebar button{display:block;width:100%;text-align:left;border:0;background:transparent;border-radius:7px;padding:6px 8px}.sidebar button[aria-current="true"]{background:#e8f0ff;color:#164cae;font-weight:bold}.sidebar small{display:block;color:var(--muted)}.headrow{display:flex;justify-content:space-between;gap:10px;align-items:start}.headrow h2{margin:0;font-size:21px}.status{display:inline-block;border-radius:6px;padding:3px 7px;background:#eaf1ff;color:#2251ad;font-size:12px;font-weight:bold}.status.warn{background:#fff0d8;color:#8c570c}.meta{color:var(--muted);font-size:13px}.strip{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.strip span{background:#eef3f8;border:1px solid var(--line);border-radius:6px;padding:4px 8px;font-size:12px}.reference{display:flex;align-items:center;gap:12px;background:#f7f9fc;border:1px solid var(--line);border-radius:8px;padding:10px;margin:14px 0}.reference img{max-width:420px;max-height:260px;object-fit:contain;border:1px solid var(--line)}.reference p{margin:0}.controls{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.controls label{display:grid;gap:3px;font-size:12px;font-weight:bold}.controls input,.controls select{border:1px solid #b9cadd;border-radius:6px;padding:7px;background:white}.items{max-height:58vh;overflow:auto;border:1px solid var(--line);border-radius:8px}.items button{display:flex;gap:8px;align-items:center;width:100%;text-align:left;border:0;border-bottom:1px solid #ecf0f5;background:white;padding:9px 10px}.items button[aria-current="true"]{background:#eef4ff}.items button small{color:var(--muted);margin-left:auto}.items button em{font-style:normal;color:#9b6215;font-size:12px}.inspector{max-height:calc(100vh - 155px);overflow:auto}.inspector h3{font-size:17px;margin:14px 0 5px}.inspector p{margin:5px 0}.inspector code{overflow-wrap:anywhere}.property{padding:10px 0;border-bottom:1px solid var(--line)}.property label{display:flex;gap:8px;align-items:center;font-weight:bold}.property small{display:block;color:var(--muted)}.property input[type=number],.property input[type=text]{width:100%;padding:6px;border:1px solid #b9cadd;border-radius:5px}.property button{border:1px solid var(--line);background:white;border-radius:5px;padding:3px 7px;font-size:12px;margin-top:5px}.property[data-unavailable="true"]{opacity:.6}.detail{border-top:1px solid var(--line);padding-top:10px;margin-top:12px;font-size:13px}.changes{margin-top:14px;padding:12px;background:#edf4ff;border-radius:8px}.changes ul{padding-left:18px;max-height:140px;overflow:auto}.changes button{border:1px solid var(--line);border-radius:5px;background:white;padding:4px 8px}.empty{padding:20px;color:var(--muted)}:focus-visible{outline:3px solid #2594b7;outline-offset:2px}@media(max-width:1100px){.layout{grid-template-columns:210px minmax(0,1fr)}.inspector{grid-column:1/-1;max-height:none}}@media(max-width:650px){.layout{display:block}.layout>*{margin-bottom:12px}.sidebar{max-height:220px}.items{max-height:400px}header,.notice{padding:16px}.reference{display:block}.reference img{max-width:100%;margin-bottom:8px}}
</style></head><body><header><h1>화면형 설정 편집기 · 전체 범위 설계 검토</h1><p>실제 구현 전, 모든 화면 ID와 속성 계약을 탐색하고 편집 흐름을 검토하는 자료</p></header><div class="notice"><strong>설계 검토용:</strong> 오른쪽 속성 변경은 이 페이지의 메모리에서만 시뮬레이션합니다. 작업본 저장·검증·게시나 실제 CRM에 반영되지 않습니다.</div>
<div class="layout"><aside class="sidebar"><h2>프로세스 · 단위화면</h2><input id="screenSearch" type="search" placeholder="화면 이름·ID 검색" aria-label="화면 검색" style="width:100%;padding:7px;border:1px solid var(--line);border-radius:6px"><div id="screenList"></div></aside><main><div id="screenDetail"></div><div class="controls"><label>요소 종류<select id="kindFilter"><option value="">전체 종류</option><option>SCREEN</option><option>MENU</option><option>SECTION</option><option>TAB</option><option>POPUP</option><option>FIELD</option><option>ACTION</option><option>CODE</option></select></label><label>설정 상태<select id="stateFilter"><option value="">전체 상태</option><option value="editable">변경 가능</option><option value="locked">본사 잠금·미지원</option><option value="review">검토판에만 있음</option></select></label><label>요소 검색<input id="entrySearch" type="search" placeholder="필드·버튼·ID"></label></div><div id="entryCount" class="meta"></div><div id="entryList" class="items"></div></main><aside class="inspector"><h2>선택 요소 · 속성</h2><div id="propertyDetail" class="empty">왼쪽에서 화면을 고르고 가운데에서 요소를 선택하세요.</div><div class="changes"><strong>검토 중인 변경</strong><p class="meta">화면별 작업본에 어떻게 표시할지 확인하는 예시입니다.</p><ul id="changes"></ul><button id="resetChanges" type="button">시뮬레이션 초기화</button></div></aside></div>
<script id="inventory" type="application/json">${inlineData}</script><script>
const data=JSON.parse(document.getElementById('inventory').textContent),byId=new Map(data.screens.map(s=>[s.id,s]));let screenId='HQ_LEAD',entryId=null;const edits=new Map();
const safe=${safe.toString()};const $=id=>document.getElementById(id);const current=()=>byId.get(screenId);const item=()=>current()?.entries.find(x=>x.id===entryId);const effective=(entry,property)=>edits.has(entry.id+'/'+property)?edits.get(entry.id+'/'+property):entry.settings[property];
function renderScreens(){const q=$('screenSearch').value.toLowerCase();let html='';for(const group of ['시작','고객','활동','영업','주문·납품','수금·분석','운영','관리자','경로 미확정','GLOBAL']){const xs=data.screens.filter(s=>s.process===group&&(s.id.toLowerCase().includes(q)||s.entries.some(e=>e.ko.toLowerCase().includes(q))));if(!xs.length)continue;html+='<h3>'+safe(group)+' ('+xs.length+')</h3>'+xs.map(s=>'<button data-screen="'+safe(s.id)+'" aria-current="'+(s.id===screenId)+'">'+safe(s.id)+'<small>'+safe(s.route??'라우트 없음')+' · '+s.reviewCount+'개 항목 · '+safe(s.runtime)+(s.previewVariants.length?' · 실제 미리보기':'')+'</small></button>').join('');}$('screenList').innerHTML=html;document.querySelectorAll('[data-screen]').forEach(button=>button.onclick=()=>{screenId=button.dataset.screen;entryId=null;render();});}
function renderDetail(){const s=current();const preview=s.previewVariants.length>0;const status=preview?'현행 W06에서 미리보기 연결':s.family==='GLOBAL'?'HQ 설정 계약 없음':s.runtime==='not-routed'?'실행 경로 미확인':'화면별 실제 미리보기 미연결';const image=s.screenshot;$('screenDetail').innerHTML='<div class="headrow"><div><h2>'+safe(s.id)+'</h2><p class="meta">'+safe(s.route??'실행 경로 없음')+' · '+safe(s.runtime)+' · 검토 카탈로그 '+s.reviewCount+'개 / 현재 기준 '+s.baselineCount+'개</p></div><span class="status '+(preview?'':'warn')+'">'+safe(status)+'</span></div><div class="strip">'+['SCREEN','MENU','SECTION','TAB','POPUP','FIELD','ACTION','CODE'].map(k=>'<span>'+k+' '+s.kinds[k]+'</span>').join('')+'<span>미지원 '+s.unsupported+'</span><span>정책 대기 '+s.decisionPending+'</span></div><div class="reference">'+(image?'<a href="'+safe(image)+'" target="_blank" rel="noopener"><img src="'+safe(image)+'" alt="'+safe(s.id)+' 실제 화면 참고 캡처"></a>':'')+'<p>'+(image?'실제 화면 검증 당시의 참고 캡처입니다. 클릭하면 크게 볼 수 있습니다. 요소 목록과 일대일 위치 연결을 보장하지 않습니다.':'이 화면의 실제 위치·상태별 DOM anchor 대조가 필요합니다. 카탈로그 항목을 실제 화면으로 위장하지 않습니다.')+'<br><strong>검토할 단위 상태:</strong> '+safe(s.previewVariants.length?s.previewVariants.join(' · '):'목록·상세·등록·수정·팝업·오류 상태를 화면별로 조사')+'</p></div>';}
function renderEntries(){const s=current(),q=$('entrySearch').value.toLowerCase(),kind=$('kindFilter').value,filter=$('stateFilter').value;const xs=s.entries.filter(e=>(!kind||e.kind===kind)&&(!q||e.id.toLowerCase().includes(q)||e.ko.toLowerCase().includes(q))&&(!filter||filter==='editable'&&e.support==='supported'&&e.capabilities.some(p=>!e.locks.includes(p))||filter==='locked'&&(e.support!=='supported'||e.locks.length)||filter==='review'&&!e.inBaseline));$('entryCount').textContent=xs.length+' / '+s.entries.length+'개 요소 · 구조와 속성 계약을 보여 줍니다. 실제 화면 위치 연결 여부는 별도 검증입니다.';$('entryList').innerHTML=xs.length?xs.map(e=>'<button data-entry="'+safe(e.id)+'" aria-current="'+(e.id===entryId)+'"><span class="status">'+e.kind+'</span><span>'+safe(e.ko)+'<br><small>'+safe(e.id)+(e.parentId?' · '+safe(e.parentId):'')+'</small></span><small>'+safe(e.support)+'</small>'+(e.inBaseline?'':'<em>검토판</em>')+'</button>').join(''):'<p class="empty">조건에 맞는 요소가 없습니다. 이 화면의 카탈로그 연결이 없는 경우도 포함됩니다.</p>';document.querySelectorAll('[data-entry]').forEach(button=>button.onclick=()=>{entryId=button.dataset.entry;renderEntries();renderProperty();});}
function renderProperty(){const e=item();if(!e){$('propertyDetail').innerHTML='<p>요소를 선택하면 허용 속성, 잠금, 의존관계, 권한과 번역이 표시됩니다.</p>';return;}const code=e.kind==='CODE';const props=['enabled','visible','readOnly','required','order','default','masking'];let html='<h3>'+safe(e.ko)+'</h3><p><code>'+safe(e.id)+'</code> · '+e.kind+'</p><p class="meta">'+safe(e.support)+(e.inBaseline?' · 현재 기준에도 있음':' · 검토 카탈로그에만 있음')+'</p>'+(code?'<p class="status warn">공통코드는 현재 설정 patch 속성이 없습니다. 별도 코드 편집 정책이 필요합니다.</p>':'');for(const p of props){const allowed=e.support==='supported'&&e.capabilities.includes(p)&&!e.locks.includes(p)&&!code;const reason=code?'코드 전용 정책 필요':e.support!=='supported'?'미지원·정책 대기':e.locks.includes(p)?'본사 잠금':!e.capabilities.includes(p)?'이 항목의 계약에 없음':'변경 가능';const value=effective(e,p);let control;if(['enabled','visible','readOnly','required'].includes(p))control='<input type="checkbox" data-property="'+p+'" '+(value?'checked':'')+' '+(allowed?'':'disabled')+'>';else if(p==='order')control='<input type="number" min="0" step="1" data-property="order" value="'+safe(value??0)+'" '+(allowed?'':'disabled')+'>';else control='<input type="text" data-property="'+p+'" value="'+safe(value??'')+'" '+(allowed?'':'disabled')+'>';html+='<div class="property" data-unavailable="'+(!allowed)+'"><label>'+control+' '+p+'</label><small>표준값 '+safe(e.settings[p]??'없음')+' · '+safe(reason)+(edits.has(e.id+'/'+p)?' · 검토 변경':'')+'</small>'+(edits.has(e.id+'/'+p)?'<button data-reset="'+p+'">상속 복원</button>':'')+'</div>';}html+='<div class="property"><label>법인별 표시명 (선택 언어)</label><input type="text" data-translation="true" value="'+safe(effective(e,'label')??'')+'" placeholder="'+safe(e.ko)+'" '+(code||e.support!=='supported'?'disabled':'')+'><small>표준 번역 키 '+safe(e.labelKey)+' · 번역 누락·토큰은 게시 전 검증</small></div><div class="detail"><strong>설정 영향 근거</strong><p>상위: '+safe(e.parentId??'없음')+' · 의존: '+safe(e.dependencies.join(', ')||'없음')+'</p><p>권한: '+safe([...e.permissions,...e.readPermissions,...e.writePermissions].join(', ')||'없음')+'</p><p>데이터 연결: '+safe(e.bindingKind??'없음')+' / '+safe(e.apiField??'없음')+'</p><p>값 규칙: '+safe(e.valueRule?JSON.stringify(e.valueRule):'없음')+'</p><p>조건부 필수: '+safe(e.requiredWhen?JSON.stringify(e.requiredWhen):'없음')+'</p></div>';$('propertyDetail').innerHTML=html;document.querySelectorAll('[data-property]').forEach(input=>input.onchange=()=>{const p=input.dataset.property;const value=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value;edits.set(e.id+'/'+p,value);renderProperty();renderChanges();});const translation=document.querySelector('[data-translation]');translation.onchange=()=>{edits.set(e.id+'/label',translation.value);renderChanges();};document.querySelectorAll('[data-reset]').forEach(button=>button.onclick=()=>{edits.delete(e.id+'/'+button.dataset.reset);renderProperty();renderChanges();});}
function renderChanges(){$('changes').innerHTML=edits.size?[...edits].map(([key,value])=>'<li><code>'+safe(key)+'</code> → '+safe(value)+'</li>').join(''):'<li>변경 없음</li>';}
function render(){renderScreens();renderDetail();renderEntries();renderProperty();renderChanges();}for(const id of ['screenSearch','entrySearch','kindFilter','stateFilter'])$(id).oninput=()=>id==='screenSearch'?renderScreens():renderEntries();$('resetChanges').onclick=()=>{edits.clear();renderProperty();renderChanges();};render();
</script></body></html>`;
await fs.writeFile(path.join(output, '25_Editor_Full_Scope_Review.html'), html);
console.log(JSON.stringify({ summary: inventory.summary, output: path.relative(root, output) }, null, 2));
