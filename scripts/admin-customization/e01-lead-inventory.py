"""Create a traceable E01 lead inventory from the preserved W01/W02 evidence."""
from pathlib import Path
import csv
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/admin-platform/customization/evidence'
mapping_path = EVIDENCE / 'lead-account-element-map.json'
w02_path = EVIDENCE / 'w02/results.json'
mapping = json.loads(mapping_path.read_text(encoding='utf-8'))
w02 = json.loads(w02_path.read_text(encoding='utf-8'))
entries = [item for item in mapping['entries'] if item.get('screenId') == 'HQ_LEAD']
observed = set(w02['observedIds'])
files = {}
rows = []

def api_evidence(entry, location):
    """Describe HQ mock connections; this is not proof of managed SQL coverage."""
    identifier = entry['id']
    variant = (location or {}).get('variant', '')
    instance = (location or {}).get('instanceId', '')
    fixed = {
        'LEAD.create': 'POST /api/leads', 'LEAD.save': 'GET/PATCH /api/leads/:id',
        'LEAD.open': 'GET /api/leads/:id', 'LEAD.search': 'GET /api/leads',
        'LEAD.changeStage': 'POST /api/leads/:id/status', 'LEAD.reverse': 'POST /api/leads/:id/status',
        'LEAD.assignOwner': 'GET /api/leads/options; POST /api/leads/:id/assign-owner',
        'LEAD.convert': 'GET /api/leads/:id/conversion-options; POST /api/leads/:id/convert',
        'LEAD.delete': 'DELETE /api/leads/:id', 'POP.LEAD.CREATE': 'POST /api/leads',
        'POP.LEAD.OWNER': 'GET /api/leads/options; POST /api/leads/:id/assign-owner',
        'POP.LEAD.CONVERT': 'GET /api/leads/:id/conversion-options; POST /api/leads/:id/convert',
        'lead.targetStatus': 'POST /api/leads/:id/status',
        'lead.reason': 'POST /api/leads/:id/status', 'lead.history': 'GET /api/leads/:id/history',
    }
    if identifier in fixed:
        return fixed[identifier], 'lead' if identifier != 'lead.history' else 'lead history'
    if identifier.startswith('conversion.'):
        return 'GET /api/leads/:id/conversion-options; POST /api/leads/:id/convert', 'conversion request / related entity' if identifier.startswith('conversion.') else 'lead or conversion context; review separately'
    if 'owner' in variant or identifier == 'lead.ownerUserId':
        return 'GET /api/leads/options; POST /api/leads/:id/assign-owner', 'lead / assignment request'
    if 'history' in variant:
        return 'GET /api/leads/:id/history', 'lead history'
    if 'activities' in variant:
        return 'GET /api/activities?relatedType=LEAD', 'activity'
    if identifier.startswith('hiraInput.') or identifier == 'HIRA.import':
        return 'server-only HIRA ingestion; exact endpoint not established', 'HIRA input'
    if 'popup' in variant or variant.startswith('configured:'):
        return 'conditional popup/configured view: element-specific API needs review', 'needs review'
    if variant.startswith('list'):
        return 'GET /api/leads', 'lead'
    if variant.startswith('create') or variant == 'popup:create':
        return 'POST /api/leads', 'lead'
    if variant.startswith('detail'):
        if entry['kind'] == 'FIELD':
            form_fields = {'lead.hospitalName','lead.phone','lead.address','lead.businessNo','lead.keymanSurname','lead.keymanType','lead.keymanMobile','lead.keymanEmail','lead.keymanSchool','lead.keymanClassYear','lead.keymanMajor','lead.keymanNote','lead.hospitalSize','lead.doctorCount','lead.chairCount','lead.mainSystem','lead.subSystem','lead.mapExcluded','lead.hiraExcluded','lead.exclusionReason','lead.exclusionDetail'}
            if instance.startswith(('detail.basic.', 'detail.keyman.', 'detail.hospital.', 'detail.exclusions.')) and identifier in form_fields:
                return 'GET /api/leads/:id; PATCH /api/leads/:id (subject to field/row policy)', 'lead'
            return 'GET /api/leads/:id; other command mapping requires review', 'lead / derived value; exact source requires review'
        return 'screen/region; element-specific server policy needs review', 'lead / screen'
    return 'not established; see exclusion reason or source', 'needs review'
for entry in entries:
    w01 = entry.get('w01') or {}
    locations = w01.get('locations') or [None]
    for location in locations:
        source = (location or {}).get('source') or {}
        relative = source.get('file') or ''
        needle = source.get('needle') or ''
        path = ROOT / relative if relative else None
        if path and path.is_file():
            if relative not in files:
                content = path.read_text(encoding='utf-8')
                files[relative] = content.splitlines()
            matches = [str(index) for index, line in enumerate(files[relative], 1) if needle and needle in line]
            status = 'MATCH' if matches else 'NEEDLE_NOT_FOUND'
        else:
            matches = []
            status = 'SOURCE_NOT_RECORDED' if not relative else 'SOURCE_MISSING'
        api, owner = api_evidence(entry, location)
        row = {
            'screen': entry['screenId'], 'kind': entry['kind'], 'config_id': entry['id'],
            'support': entry['support'], 'w01_disposition': w01.get('disposition', ''),
            'variant': (location or {}).get('variant', ''),
            'instance_id_w01': (location or {}).get('instanceId', ''),
            'condition': (location or {}).get('condition', ''),
            'fixture': (location or {}).get('stateFixtureId', ''),
            'source_file': relative, 'w01_line': source.get('line', ''),
            'source_needle': needle, 'current_source_lines': ','.join(matches),
            'current_source_check': status, 'w02_id_observed_historical': 'yes' if entry['id'] in observed else 'no',
            'translation_key': entry.get('labelKey') or '', 'api_field': entry.get('apiField') or '',
            'permission_all': ','.join((entry.get('permissions') or {}).get('all') or []),
            'permission_read': ','.join((entry.get('permissions') or {}).get('read') or []),
            'permission_write': ','.join((entry.get('permissions') or {}).get('write') or []),
            'hq_mock_api_evidence': api, 'data_owner': owner,
            'policy_evidence': 'catalog permissions and HQ mock source; verify effective actor/row policy before implementation',
            'exclusion_reason': w01.get('reason') or '',
        }
        rows.append(row)

assert len(entries) == len({item['id'] for item in entries}) == 101
output = EVIDENCE / 'e01-lead-inventory.csv'
with output.open('w', encoding='utf-8-sig', newline='') as stream:
    writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
unregistered = [
    ('list','header','title and introduction','frontend/src/hq-mock/HqLeadsPage.tsx',"t('hqCustomer.leadIntro')",'display text; translation/settings scope to decide','none; GET /api/leads is list data'),
    ('list','filter','scope and recent rule','frontend/src/hq-mock/HqLeadsPage.tsx',"t('hqCustomer.recentRule'",'scope anchor unsupported; rule text has no separate ID','GET /api/leads; GET /api/hq/status'),
    ('list','grid','five standard column headers','frontend/src/hq-mock/HqLeadsPage.tsx',"key: 'hospital_name'",'HqRows header anchor independently rechecked on PC/mobile; per-column order contract remains E04','GET /api/leads'),
    ('create','popup','cancel button','frontend/src/hq-mock/HqLeadsPage.tsx',"onClick={() => setCreating(false)} disabled={command.busy}",'common close behavior; separate configuration policy pending','local close; no API'),
    ('create/owner/convert','popup','shared dialog close button','frontend/src/hq-mock/customer-shared.tsx','onClick={onClose}','common dialog close; separate configuration policy pending','local close; no API'),
    ('detail','header','back control and public ID','frontend/src/hq-mock/HqLeadsPage.tsx','onClick={onBack}>{t(\'account.back\')}','navigation/system identifier; placement and configuration policy pending','local navigation; GET /api/leads/:id'),
    ('detail','header','record title','frontend/src/hq-mock/HqLeadsPage.tsx','<h2>{recordLabel(row)}</h2>','record value rendered as title; separate anchor/placement pending','GET /api/leads/:id'),
    ('detail','stage','saved and selected stage explanatory text','frontend/src/hq-mock/HqLeadsPage.tsx',"t('hqCustomer.selectedStage'",'localized status text; selectable configuration scope pending','GET /api/leads/:id'),
    ('detail','status','concurrent change warning and reload','frontend/src/hq-mock/HqLeadsPage.tsx',"t('hqCustomer.changedElsewhere')",'conditional safety message and local reload; preserve conflict behavior','GET /api/leads/:id; no reload mutation'),
    ('detail','status','success and error messages','frontend/src/hq-mock/HqLeadsPage.tsx','<HqError error={command.error ?? policy.error} />','conditional runtime feedback; translation/error mapping to review','related GET/PATCH/POST/DELETE lead requests'),
    ('detail.hira','summary','source, source updated and manual fields','frontend/src/hq-mock/HqLeadsPage.tsx',"key: 'source_system'",'read-only metadata; no separate anchor in summary mapping','GET /api/leads/:id'),
    ('detail.marketing','summary','calculation status','frontend/src/hq-mock/HqLeadsPage.tsx',"key: 'calculation_status'",'derived status; calculation and separate anchor policy pending','GET /api/leads/:id'),
    ('detail.history','grid','history at/action/user/changes headers and cells','frontend/src/hq-mock/HqLeadsPage.tsx',"key: 'at', label:",'history collection, distinct source; no per-column configId','GET /api/leads/:id/history'),
    ('detail.activities','grid','activity subject/start/status/consultation columns','frontend/src/hq-mock/HqLeadsPage.tsx',"key: 'consultation_content'",'related activity entity; no per-column configId','GET /api/activities?relatedType=LEAD'),
    ('convert','popup','duplicate warning and candidates','frontend/src/hq-mock/HqLeadsPage.tsx','data-testid="conversion-duplicates"','conditional related records; separate configuration pending','GET /api/leads/:id/conversion-options'),
    ('convert','popup','simulate failure checkbox','frontend/src/hq-mock/HqLeadsPage.tsx','data-testid="conversion-simulate-failure"','mock fixture control; production exposure/design decision pending','POST /api/leads/:id/convert in mock'),
    ('convert','popup','cancel button','frontend/src/hq-mock/HqLeadsPage.tsx','onClick={onClose} disabled={command.busy}','common close behavior; separate configuration policy pending','local close; no API'),
    ('convert.result','popup','result links and close','frontend/src/hq-mock/HqLeadsPage.tsx','data-testid="conversion-account-link"','related record links and result close; behavior/placement pending','POST /api/leads/:id/convert then local navigation'),
]
additional_path = EVIDENCE / 'e01-lead-unregistered-elements.csv'
with additional_path.open('w', encoding='utf-8-sig', newline='') as stream:
    writer = csv.writer(stream)
    writer.writerow(['variant','region','element','source_file','source_needle','current_source_lines','config_id','classification_and_followup','hq_mock_api'])
    for variant, region, element, relative, needle, reason, api in unregistered:
        source_lines = files.setdefault(relative, (ROOT / relative).read_text(encoding='utf-8').splitlines())
        matches = [str(index) for index, line in enumerate(source_lines, 1) if needle in line]
        assert matches, f'Additional E01 source not found: {relative} {needle}'
        config_ids = 'lead.hospitalName;lead.status;lead.ownerName;lead.phone;lead.businessNo' if element == 'five standard column headers' else ''
        writer.writerow([variant,region,element,relative,needle,','.join(matches),config_ids,reason,api])
summary = {
    'purpose': 'E01 source cross-check; W02 observations are historical, not current browser results',
    'inputs': {str(path.relative_to(ROOT)).replace('\\', '/'): hashlib.sha256(path.read_bytes()).hexdigest() for path in (mapping_path, w02_path)},
    'lead_ids': len(entries), 'location_rows': len(rows), 'supplemental_screen_groups': len(unregistered),
    'source_checks': {status: sum(row['current_source_check'] == status for row in rows) for status in ('MATCH', 'NEEDLE_NOT_FOUND', 'SOURCE_NOT_RECORDED', 'SOURCE_MISSING')},
    'historical_w02_ids_observed': sum(item['id'] in observed for item in entries),
}
(EVIDENCE / 'e01-lead-inventory-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(summary, ensure_ascii=False))
