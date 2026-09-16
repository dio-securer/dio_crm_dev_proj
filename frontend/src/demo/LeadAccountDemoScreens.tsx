import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  createDemoAccount,
  loadDemoAccounts,
  resetDemoAccounts,
  updateDemoAccount
} from './demo-account-repository';
import type { DemoAccount, DemoAccountDraft } from './demo-data';
import { EXECUTIVE_DEMO_LABEL } from './demo-mode';

type LeadStage = 'NEW' | 'FIRST_VISIT' | 'KEYMAN_MEETING' | 'CONTACT_EXCLUDED' | 'CONVERTED';

type DemoLead = {
  code: string;
  name: string;
  country: string;
  stage: LeadStage;
  owner: string;
  openDate: string;
  address: string;
  website: string;
  phone: string;
  email: string;
  interest: string;
  keymanCustomerType: string;
  keymanName: string;
  keymanPhone: string;
  keymanEmail: string;
  keymanSchool: string;
  keymanMajor: string;
  keymanClass: string;
  leadNote: string;
  totalDoctors: string;
  specialistCount: string;
  mainSystem: string;
  subSystem: string;
  businessNo: string;
  excludedReason: string;
  excludedDetail: string;
  convertedAccountCode?: string;
};

type DemoContact = {
  publicId: string;
  accountCode: string;
  sourceLeadCode?: string;
  name: string;
  customerType: string;
  phone: string;
  email: string;
  birthDate: string;
  married: string;
  interest: string;
  tendency: string;
  plannedOpenDate: string;
  preferredRegion: string;
};

type AccountProfile = {
  accountCode: string;
  sourceLeadCode?: string;
  grade: string;
  integrationStatus: 'BEFORE_REQUEST' | 'REQUESTING' | 'SUCCESS' | 'FAILED';
  businessOwner: string;
  businessNo: string;
  legalRepresentative: string;
  medicalInstitutionCode: string;
  invoiceEmail: string;
  postalCode: string;
  openDate: string;
  erpCustomerCode: string;
  erpApproved: string;
};

type ConversionRecord = {
  leadCode: string;
  accountCode: string;
  contactId: string;
  opportunityName: string;
};

const LEAD_KEY = 'dio_crm_demo_leads_v2';
const CONTACT_KEY = 'dio_crm_demo_contacts_v2';
const PROFILE_KEY = 'dio_crm_demo_account_profiles_v2';
const CONVERSION_KEY = 'dio_crm_demo_conversions_v2';

const STAGE_LABEL: Record<LeadStage, string> = {
  NEW: 'New registration',
  FIRST_VISIT: 'First visit',
  KEYMAN_MEETING: 'Keyman meeting',
  CONTACT_EXCLUDED: 'Contact excluded',
  CONVERTED: 'Converted'
};

const LEAD_SEED: DemoLead[] = [
  {
    code: 'LD-US-0042', name: 'West Coast Dental Studio', country: 'United States', stage: 'FIRST_VISIT', owner: 'Emily Carter',
    openDate: '2022-04-15', address: 'San Diego, CA', website: 'westcoast.demo', phone: '+1 619 555 0110', email: 'hello@westcoast.demo', interest: 'Implant package',
    keymanCustomerType: 'Doctor', keymanName: 'Dr. William Park', keymanPhone: '+1 619 555 0111', keymanEmail: 'william@westcoast.demo', keymanSchool: '', keymanMajor: '', keymanClass: '', leadNote: 'Initial visit completed.',
    totalDoctors: '4', specialistCount: '2', mainSystem: 'Implant System A', subSystem: 'System B', businessNo: '', excludedReason: '', excludedDetail: ''
  },
  {
    code: 'LD-MX-0018', name: 'Sonrisa Medical Center', country: 'Mexico', stage: 'KEYMAN_MEETING', owner: 'Daniel Ruiz',
    openDate: '2020-11-02', address: 'Monterrey', website: 'sonrisa.demo', phone: '+52 81 5555 0110', email: 'info@sonrisa.demo', interest: 'Clinic starter package',
    keymanCustomerType: 'Doctor', keymanName: 'Dr. Maria Lopez', keymanPhone: '+52 81 5555 0111', keymanEmail: 'maria@sonrisa.demo', keymanSchool: 'Demo Dental School', keymanMajor: 'Prosthodontics', keymanClass: '2014', leadNote: 'Keyman confirmed.',
    totalDoctors: '6', specialistCount: '3', mainSystem: 'System C', subSystem: 'System D', businessNo: 'MX-DEMO-0018', excludedReason: '', excludedDetail: ''
  },
  {
    code: 'LD-IN-0001', name: 'India Expansion Sample', country: 'India', stage: 'NEW', owner: 'Global Sales Demo',
    openDate: '', address: 'Bengaluru, Karnataka', website: '', phone: '+91 80 5555 0110', email: 'lead@india.demo', interest: 'Implant',
    keymanCustomerType: 'Doctor', keymanName: '', keymanPhone: '', keymanEmail: '', keymanSchool: '', keymanMajor: '', keymanClass: '', leadNote: '',
    totalDoctors: '', specialistCount: '', mainSystem: '', subSystem: '', businessNo: '', excludedReason: '', excludedDetail: ''
  }
];

const CONTACT_SEED: DemoContact[] = [
  { publicId: 'ct-demo-us-001', accountCode: 'US-CUST-0001', name: 'Dr. Sarah Miller', customerType: 'Doctor', phone: '+1 213 555 0121', email: 'sarah@brightsmile.demo', birthDate: '', married: 'Yes', interest: 'Implant', tendency: 'Clinical evidence focused', plannedOpenDate: '', preferredRegion: '', sourceLeadCode: 'LD-US-0042' },
  { publicId: 'ct-demo-mx-001', accountCode: 'MX-CUST-0001', name: 'Dr. Diego Flores', customerType: 'Doctor', phone: '+52 55 5555 0121', email: 'diego@dentalnova.demo', birthDate: '', married: 'No', interest: 'Prosthetic', tendency: 'Value focused', plannedOpenDate: '', preferredRegion: '' }
];

const PROFILE_SEED: AccountProfile[] = [
  { accountCode: 'US-CUST-0001', grade: 'A', integrationStatus: 'SUCCESS', businessOwner: 'Bright Smile Dental Group', businessNo: 'US-DEMO-0001', legalRepresentative: 'Demo Representative', medicalInstitutionCode: 'MED-US-0001', invoiceEmail: 'billing@brightsmile.demo', postalCode: '90001', openDate: '2018-06-01', erpCustomerCode: 'ERP-US-0001', erpApproved: 'Yes' },
  { accountCode: 'MX-CUST-0001', grade: 'B', integrationStatus: 'REQUESTING', businessOwner: 'Clinica Dental Nova', businessNo: 'MX-DEMO-0001', legalRepresentative: 'Demo Representative', medicalInstitutionCode: 'MED-MX-0001', invoiceEmail: 'billing@dentalnova.demo', postalCode: '01000', openDate: '2020-09-10', erpCustomerCode: '', erpApproved: 'Pending' },
  { accountCode: 'IN-CUST-0001', grade: '-', integrationStatus: 'BEFORE_REQUEST', businessOwner: '', businessNo: '', legalRepresentative: '', medicalInstitutionCode: '', invoiceEmail: '', postalCode: '', openDate: '', erpCustomerCode: '', erpApproved: 'No' }
];

function clone<T>(rows: T[]): T[] { return rows.map(row => ({ ...row })); }
function loadRows<T>(key: string, seed: T[]): T[] {
  if (typeof window === 'undefined') return clone(seed);
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    const seeded = clone(seed);
    window.localStorage.setItem(key, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : clone(seed);
  } catch { return clone(seed); }
}
function saveRows<T>(key: string, rows: T[]) { if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(rows)); }

function nextLeadCode(rows: DemoLead[], country: string) {
  const prefix = country === 'India' ? 'IN' : country === 'Mexico' ? 'MX' : country === 'United States' ? 'US' : 'GL';
  const max = rows.filter(row => row.code.startsWith(`LD-${prefix}-`)).map(row => Number(row.code.split('-').at(-1))).filter(Number.isFinite).reduce((a, b) => Math.max(a, b), 0);
  return `LD-${prefix}-${String(max + 1).padStart(4, '0')}`;
}

function Header({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return <>
    <div className="demo-standard-banner"><div><strong>{EXECUTIVE_DEMO_LABEL}</strong><span>US / MX baseline · India reference draft</span></div><span className="demo-prototype-pill">MOCK DATA</span></div>
    <div className="page-header"><div><span className="page-kicker">GLOBAL · EXECUTIVE DEMO</span><h2>{title}</h2><small>{subtitle}</small></div>{actions && <div className="page-actions">{actions}</div>}</div>
  </>;
}

function Pill({ value }: { value: string }) {
  const upper = value.toUpperCase();
  const tone = upper.includes('SUCCESS') || upper.includes('ACTIVE') || upper.includes('CONVERTED') ? 'success' : upper.includes('FAILED') || upper.includes('EXCLUDED') ? 'danger' : upper.includes('REQUEST') || upper.includes('PROSPECT') || upper.includes('KEYMAN') ? 'warning' : 'neutral';
  return <span className={`status-pill ${tone}`}>{value}</span>;
}

function StageFlow({ stage }: { stage: LeadStage }) {
  const stages: LeadStage[] = ['NEW', 'FIRST_VISIT', 'KEYMAN_MEETING', 'CONVERTED'];
  return <div className="demo-la-stage-flow">{stages.map((item, index) => <React.Fragment key={item}><div className={`demo-la-stage ${item === stage ? 'active' : stages.indexOf(stage) > index ? 'done' : ''}`}><span>{index + 1}</span><small>{STAGE_LABEL[item]}</small></div>{index < stages.length - 1 && <i />}</React.Fragment>)}</div>;
}

function LeadForm({ value, onChange, onSave, onCancel, title }: { value: DemoLead; onChange: (next: DemoLead) => void; onSave: () => void; onCancel: () => void; title: string }) {
  const set = <K extends keyof DemoLead>(key: K, next: DemoLead[K]) => onChange({ ...value, [key]: next });
  return <div className="data-card demo-la-editor">
    <div className="data-card-header"><div><strong>{title}</strong><small>Quick registration first; stage details can be completed as sales activity progresses.</small></div></div>
    <div className="demo-la-form-section"><h4>Quick registration</h4><div className="demo-la-form-grid">
      <label>Hospital / Account name *<input value={value.name} onChange={e => set('name', e.target.value)} /></label>
      <label>Country<select value={value.country} onChange={e => set('country', e.target.value)}><option>United States</option><option>Mexico</option><option>India</option><option>Other</option></select></label>
      <label>Stage<select value={value.stage} onChange={e => set('stage', e.target.value as LeadStage)}><option value="NEW">New registration</option><option value="FIRST_VISIT">First visit</option><option value="KEYMAN_MEETING">Keyman meeting</option><option value="CONTACT_EXCLUDED">Contact excluded</option></select></label>
      <label>Owner<input value={value.owner} onChange={e => set('owner', e.target.value)} /></label>
      <label>Phone<input value={value.phone} onChange={e => set('phone', e.target.value)} /></label>
      <label>Email<input value={value.email} onChange={e => set('email', e.target.value)} /></label>
      <label className="full">Address<input value={value.address} onChange={e => set('address', e.target.value)} /></label>
      <label>Open date<input type="date" value={value.openDate} onChange={e => set('openDate', e.target.value)} /></label>
      <label>Website<input value={value.website} onChange={e => set('website', e.target.value)} /></label>
      <label className="full">Interest<input value={value.interest} onChange={e => set('interest', e.target.value)} /></label>
    </div></div>
    <details open><summary>Keyman information</summary><div className="demo-la-form-grid">
      <label>Customer type<input value={value.keymanCustomerType} onChange={e => set('keymanCustomerType', e.target.value)} /></label>
      <label>Keyman name<input value={value.keymanName} onChange={e => set('keymanName', e.target.value)} /></label>
      <label>Mobile<input value={value.keymanPhone} onChange={e => set('keymanPhone', e.target.value)} /></label>
      <label>Email<input value={value.keymanEmail} onChange={e => set('keymanEmail', e.target.value)} /></label>
      <label>School<input value={value.keymanSchool} onChange={e => set('keymanSchool', e.target.value)} /></label>
      <label>Major<input value={value.keymanMajor} onChange={e => set('keymanMajor', e.target.value)} /></label>
      <label>Class / Year<input value={value.keymanClass} onChange={e => set('keymanClass', e.target.value)} /></label>
      <label className="full">Keyman / Sales note<textarea value={value.leadNote} onChange={e => set('leadNote', e.target.value)} /></label>
    </div></details>
    <details><summary>Hospital scale & system</summary><div className="demo-la-form-grid">
      <label>Total doctors<input value={value.totalDoctors} onChange={e => set('totalDoctors', e.target.value)} /></label>
      <label>Dental specialists<input value={value.specialistCount} onChange={e => set('specialistCount', e.target.value)} /></label>
      <label>Main system<input value={value.mainSystem} onChange={e => set('mainSystem', e.target.value)} /></label>
      <label>Sub system<input value={value.subSystem} onChange={e => set('subSystem', e.target.value)} /></label>
    </div></details>
    <details><summary>Business / Exclusion</summary><div className="demo-la-form-grid">
      <label>Business No.<input value={value.businessNo} onChange={e => set('businessNo', e.target.value)} /></label>
      <label>Exclude reason<input value={value.excludedReason} onChange={e => set('excludedReason', e.target.value)} /></label>
      <label className="full">Exclude detail<textarea value={value.excludedDetail} onChange={e => set('excludedDetail', e.target.value)} /></label>
    </div></details>
    <div className="account-form-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="button-primary" disabled={!value.name.trim()} onClick={onSave}>Save</button></div>
  </div>;
}

function emptyLead(rows: DemoLead[]): DemoLead {
  return { code: nextLeadCode(rows, 'India'), name: '', country: 'India', stage: 'NEW', owner: 'Global Sales Demo', openDate: '', address: '', website: '', phone: '', email: '', interest: '', keymanCustomerType: 'Doctor', keymanName: '', keymanPhone: '', keymanEmail: '', keymanSchool: '', keymanMajor: '', keymanClass: '', leadNote: '', totalDoctors: '', specialistCount: '', mainSystem: '', subSystem: '', businessNo: '', excludedReason: '', excludedDetail: '' };
}

function profileFor(accountCode: string, profiles: AccountProfile[]) {
  return profiles.find(row => row.accountCode === accountCode) ?? { accountCode, grade: '-', integrationStatus: 'BEFORE_REQUEST' as const, businessOwner: '', businessNo: '', legalRepresentative: '', medicalInstitutionCode: '', invoiceEmail: '', postalCode: '', openDate: '', erpCustomerCode: '', erpApproved: 'No' };
}

export function DemoGlobalLeadPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<DemoLead[]>(() => loadRows(LEAD_KEY, LEAD_SEED));
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | LeadStage>('ALL');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DemoLead>(() => emptyLead(rows));
  const [convertOpen, setConvertOpen] = useState(false);
  const [opportunityName, setOpportunityName] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const requested = searchParams.get('lead');
    if (requested && rows.some(row => row.code === requested)) setSelectedCode(requested);
  }, [rows, searchParams]);

  const selected = rows.find(row => row.code === selectedCode) ?? null;
  const filtered = useMemo(() => rows.filter(row => {
    const term = search.trim().toLowerCase();
    const matchesText = !term || [row.code, row.name, row.keymanName, row.phone, row.owner].some(value => value.toLowerCase().includes(term));
    return matchesText && (filter === 'ALL' || row.stage === filter);
  }), [rows, search, filter]);

  function select(row: DemoLead) {
    setSelectedCode(row.code); setEditing(false); setConvertOpen(false); setMessage('');
    const next = new URLSearchParams(searchParams); next.set('lead', row.code); setSearchParams(next, { replace: true });
  }
  function startNew() { const next = emptyLead(rows); setSelectedCode(null); setDraft(next); setEditing(true); setConvertOpen(false); }
  function startEdit() { if (!selected) return; setDraft({ ...selected }); setEditing(true); }
  function save() {
    if (!draft.name.trim()) return;
    const exists = rows.some(row => row.code === draft.code);
    const next = exists ? rows.map(row => row.code === draft.code ? { ...draft } : row) : [{ ...draft, code: nextLeadCode(rows, draft.country) }, ...rows];
    saveRows(LEAD_KEY, next); setRows(next); setEditing(false); setSelectedCode(next.find(row => row.name === draft.name)?.code ?? draft.code); setMessage(exists ? 'Lead updated.' : 'Lead created.');
  }
  function openConvert() {
    if (!selected) return;
    setOpportunityName(selected.interest ? `${selected.name} - ${selected.interest}` : `${selected.name} - Package proposal`);
    setConvertOpen(true);
  }
  function convert() {
    if (!selected) return;
    const accounts = loadDemoAccounts();
    const accountDraft: DemoAccountDraft = { accountName: selected.name, country: selected.country, customerType: 'Dental Clinic', phone: selected.phone, email: selected.email, address: selected.address, status: 'PROSPECT', owner: selected.owner };
    const nextAccounts = createDemoAccount(accounts, accountDraft);
    const account = nextAccounts[0];
    const contacts = loadRows(CONTACT_KEY, CONTACT_SEED);
    const contact: DemoContact = { publicId: `ct-demo-${Date.now()}`, accountCode: account.accountCode, sourceLeadCode: selected.code, name: selected.keymanName || 'Keyman TBD', customerType: selected.keymanCustomerType || 'Contact', phone: selected.keymanPhone, email: selected.keymanEmail, birthDate: '', married: '', interest: selected.interest, tendency: selected.leadNote, plannedOpenDate: '', preferredRegion: '' };
    const nextContacts = [contact, ...contacts]; saveRows(CONTACT_KEY, nextContacts);
    const profiles = loadRows(PROFILE_KEY, PROFILE_SEED);
    const profile: AccountProfile = { accountCode: account.accountCode, sourceLeadCode: selected.code, grade: '-', integrationStatus: 'BEFORE_REQUEST', businessOwner: selected.name, businessNo: selected.businessNo, legalRepresentative: '', medicalInstitutionCode: '', invoiceEmail: selected.email, postalCode: '', openDate: selected.openDate, erpCustomerCode: '', erpApproved: 'No' };
    saveRows(PROFILE_KEY, [profile, ...profiles.filter(row => row.accountCode !== account.accountCode)]);
    const conversions = loadRows<ConversionRecord>(CONVERSION_KEY, []);
    saveRows(CONVERSION_KEY, [{ leadCode: selected.code, accountCode: account.accountCode, contactId: contact.publicId, opportunityName }, ...conversions]);
    const nextLeads = rows.map(row => row.code === selected.code ? { ...row, stage: 'CONVERTED' as LeadStage, convertedAccountCode: account.accountCode } : row);
    saveRows(LEAD_KEY, nextLeads); setRows(nextLeads); setConvertOpen(false);
    navigate(`/accounts?account=${encodeURIComponent(account.accountCode)}`);
  }

  return <section className="workspace-page demo-la-page">
    <Header title="Lead" subtitle="Potential customer discovery · stage-based qualification · Account / Contact conversion" actions={<><input className="search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search lead"/><select value={filter} onChange={e => setFilter(e.target.value as 'ALL' | LeadStage)}><option value="ALL">All stages</option>{Object.entries(STAGE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" className="button-primary" onClick={startNew}>+ New Lead</button></>} />
    <div className="demo-la-layout">
      <div className="data-card demo-la-list"><div className="data-card-header"><div><strong>Lead pipeline</strong><small>{filtered.length} records · key fields only for fast scanning</small></div></div><div className="table-scroll"><table><thead><tr><th>Lead / Hospital</th><th>Stage</th><th>Keyman</th><th>Phone</th><th>Owner</th></tr></thead><tbody>{filtered.map(row => <tr key={row.code} className={row.code === selectedCode ? 'demo-selected-row' : ''} onClick={() => select(row)}><td><button className="demo-link-button" type="button" onClick={() => select(row)}>{row.name}</button><small>{row.code}</small></td><td><Pill value={STAGE_LABEL[row.stage]} /></td><td>{row.keymanName || '-'}</td><td>{row.phone || '-'}</td><td>{row.owner}</td></tr>)}</tbody></table></div></div>
      {selected && !editing && <aside className="data-card demo-la-detail"><div className="data-card-header"><div><small>{selected.code}</small><strong>{selected.name}</strong></div><div className="demo-la-actions"><button type="button" onClick={startEdit}>Edit</button>{selected.stage !== 'CONVERTED' && selected.stage !== 'CONTACT_EXCLUDED' && <button type="button" className="button-primary" onClick={openConvert}>Convert</button>}</div></div><div className="demo-la-detail-body"><StageFlow stage={selected.stage}/><div className="demo-la-summary-grid"><div><span>Phone</span><strong>{selected.phone || '-'}</strong></div><div><span>Email</span><strong>{selected.email || '-'}</strong></div><div><span>Address</span><strong>{selected.address || '-'}</strong></div><div><span>Interest</span><strong>{selected.interest || '-'}</strong></div></div><section><h4>Keyman</h4><dl><div><dt>Name</dt><dd>{selected.keymanName || '-'}</dd></div><div><dt>Customer type</dt><dd>{selected.keymanCustomerType || '-'}</dd></div><div><dt>School / Major</dt><dd>{[selected.keymanSchool, selected.keymanMajor].filter(Boolean).join(' / ') || '-'}</dd></div></dl></section><section><h4>Hospital & System</h4><dl><div><dt>Doctors / Specialists</dt><dd>{selected.totalDoctors || '-'} / {selected.specialistCount || '-'}</dd></div><div><dt>Main / Sub system</dt><dd>{[selected.mainSystem, selected.subSystem].filter(Boolean).join(' / ') || '-'}</dd></div></dl></section>{selected.convertedAccountCode && <div className="demo-la-converted"><span>Converted Account</span><Link to={`/accounts?account=${encodeURIComponent(selected.convertedAccountCode)}`}>{selected.convertedAccountCode}</Link></div>}</div></aside>}
    </div>
    {editing && <LeadForm title={selected ? `Edit ${selected.code}` : 'New Lead'} value={draft} onChange={setDraft} onSave={save} onCancel={() => setEditing(false)} />}
    {convertOpen && selected && <div className="data-card demo-la-convert"><div className="data-card-header"><div><strong>Convert Lead</strong><small>Hospital → Account · Keyman → Contact · Interest → Opportunity seed</small></div></div><div className="demo-la-convert-grid"><div><span>Account</span><strong>{selected.name}</strong></div><div><span>Contact</span><strong>{selected.keymanName || 'Keyman TBD'}</strong></div><label>Opportunity name<input value={opportunityName} onChange={e => setOpportunityName(e.target.value)} /></label></div><div className="account-form-actions"><button type="button" onClick={() => setConvertOpen(false)}>Cancel</button><button type="button" className="button-primary" onClick={convert}>Convert & open Account</button></div></div>}
    {message && <p className="notice info">{message}</p>}
  </section>;
}

function accountDraft(row: DemoAccount): DemoAccountDraft { return { accountName: row.accountName, country: row.country, customerType: row.customerType, phone: row.phone, email: row.email, address: row.address, status: row.status, owner: row.owner }; }
const EMPTY_ACCOUNT: DemoAccountDraft = { accountName: '', country: 'India', customerType: 'Dental Clinic', phone: '', email: '', address: '', status: 'PROSPECT', owner: 'Global Sales Demo' };

function ContactForm({ value, onChange, onSave, onCancel }: { value: DemoContact; onChange: (next: DemoContact) => void; onSave: () => void; onCancel: () => void }) {
  const set = <K extends keyof DemoContact>(key: K, next: DemoContact[K]) => onChange({ ...value, [key]: next });
  return <div className="demo-la-contact-editor"><div className="demo-la-form-grid"><label>Name *<input value={value.name} onChange={e => set('name', e.target.value)} /></label><label>Customer type<input value={value.customerType} onChange={e => set('customerType', e.target.value)} /></label><label>Phone<input value={value.phone} onChange={e => set('phone', e.target.value)} /></label><label>Email<input value={value.email} onChange={e => set('email', e.target.value)} /></label><label>Birth date<input type="date" value={value.birthDate} onChange={e => set('birthDate', e.target.value)} /></label><label>Married<select value={value.married} onChange={e => set('married', e.target.value)}><option value="">-</option><option>Yes</option><option>No</option></select></label><label>Interest<input value={value.interest} onChange={e => set('interest', e.target.value)} /></label><label>Tendency<input value={value.tendency} onChange={e => set('tendency', e.target.value)} /></label><label>Planned opening date<input type="date" value={value.plannedOpenDate} onChange={e => set('plannedOpenDate', e.target.value)} /></label><label>Preferred region<input value={value.preferredRegion} onChange={e => set('preferredRegion', e.target.value)} /></label></div><div className="account-form-actions"><button type="button" onClick={onCancel}>Cancel</button><button className="button-primary" type="button" disabled={!value.name.trim()} onClick={onSave}>Save Contact</button></div></div>;
}

export function DemoGlobalAccountPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<DemoAccount[]>(() => loadDemoAccounts());
  const [profiles, setProfiles] = useState<AccountProfile[]>(() => loadRows(PROFILE_KEY, PROFILE_SEED));
  const [contacts, setContacts] = useState<DemoContact[]>(() => loadRows(CONTACT_KEY, CONTACT_SEED));
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'SUMMARY' | 'CONTACTS' | 'ERP'>('SUMMARY');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DemoAccountDraft>({ ...EMPTY_ACCOUNT });
  const [contactDraft, setContactDraft] = useState<DemoContact | null>(null);
  const [message, setMessage] = useState('');

  const filtered = useMemo(() => { const term = search.trim().toLowerCase(); return !term ? rows : rows.filter(row => [row.accountCode, row.accountName, row.phone, row.owner].some(value => value.toLowerCase().includes(term))); }, [rows, search]);
  const selected = rows.find(row => row.publicId === selectedId) ?? null;
  const profile = selected ? profileFor(selected.accountCode, profiles) : null;
  const selectedContacts = selected ? contacts.filter(row => row.accountCode === selected.accountCode) : [];
  const conversions = loadRows<ConversionRecord>(CONVERSION_KEY, []);
  const conversion = selected ? conversions.find(row => row.accountCode === selected.accountCode) : undefined;

  useEffect(() => { const requested = searchParams.get('account'); if (!requested) return; const match = rows.find(row => row.accountCode === requested || row.publicId === requested); if (match) setSelectedId(match.publicId); }, [rows, searchParams]);

  function select(row: DemoAccount) { setSelectedId(row.publicId); setEditing(false); setContactDraft(null); setTab('SUMMARY'); const next = new URLSearchParams(searchParams); next.set('account', row.accountCode); setSearchParams(next, { replace: true }); }
  function startNew() { setSelectedId(null); setDraft({ ...EMPTY_ACCOUNT }); setEditing(true); setMessage(''); }
  function saveAccount() {
    if (!draft.accountName.trim()) return;
    if (selected) { const next = updateDemoAccount(rows, selected.publicId, draft); setRows(next); setMessage(`Updated ${selected.accountCode}.`); }
    else { const next = createDemoAccount(rows, draft); setRows(next); const created = next[0]; setSelectedId(created.publicId); const nextProfiles = [{ ...profileFor(created.accountCode, profiles) }, ...profiles.filter(row => row.accountCode !== created.accountCode)]; setProfiles(nextProfiles); saveRows(PROFILE_KEY, nextProfiles); setMessage(`Created ${created.accountCode}.`); }
    setEditing(false);
  }
  function reset() { const next = resetDemoAccounts(); setRows(next); const nextProfiles = clone(PROFILE_SEED); const nextContacts = clone(CONTACT_SEED); saveRows(PROFILE_KEY, nextProfiles); saveRows(CONTACT_KEY, nextContacts); saveRows(LEAD_KEY, clone(LEAD_SEED)); saveRows(CONVERSION_KEY, []); setProfiles(nextProfiles); setContacts(nextContacts); setSelectedId(null); setEditing(false); setContactDraft(null); setSearch(''); setSearchParams({}, { replace: true }); setMessage('Mock data reset.'); }
  function newContact() { if (!selected) return; setContactDraft({ publicId: `ct-demo-${Date.now()}`, accountCode: selected.accountCode, name: '', customerType: 'Doctor', phone: '', email: '', birthDate: '', married: '', interest: '', tendency: '', plannedOpenDate: '', preferredRegion: '' }); }
  function saveContact() { if (!contactDraft?.name.trim()) return; const next = [contactDraft, ...contacts.filter(row => row.publicId !== contactDraft.publicId)]; saveRows(CONTACT_KEY, next); setContacts(next); setContactDraft(null); setMessage('Contact saved.'); }
  function updateProfile(key: keyof AccountProfile, value: string) { if (!profile) return; const nextProfile = { ...profile, [key]: value } as AccountProfile; const next = [nextProfile, ...profiles.filter(row => row.accountCode !== profile.accountCode)]; setProfiles(next); saveRows(PROFILE_KEY, next); }
  function requestErp() { if (!profile) return; updateProfile('integrationStatus', 'REQUESTING'); setMessage('Mock ERP registration request started. No external ERP call was made.'); }

  const readiness = selected && profile ? [profile.businessOwner, profile.businessNo, profile.legalRepresentative, profile.medicalInstitutionCode, profile.invoiceEmail || selected.email, selected.customerType, selected.phone, profile.postalCode, selected.address, profile.openDate].filter(Boolean).length : 0;

  return <section className="workspace-page demo-la-page">
    <Header title="Account / Contact" subtitle="Customer master · related contacts · ERP registration readiness" actions={<><input className="search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search account"/><button type="button" className="button-primary" onClick={startNew}>+ New Account</button></>} />
    <div className="demo-la-layout">
      <div className="data-card demo-la-list"><div className="data-card-header"><div><strong>Accounts</strong><small>{filtered.length} records · essential attributes for quick review</small></div><button type="button" className="text-link" onClick={reset}>Reset demo</button></div><div className="table-scroll"><table><thead><tr><th>Account</th><th>Status</th><th>ERP integration</th><th>Phone</th><th>Owner</th></tr></thead><tbody>{filtered.map(row => { const p = profileFor(row.accountCode, profiles); return <tr key={row.publicId} className={selectedId === row.publicId ? 'demo-selected-row' : ''} onClick={() => select(row)}><td><button type="button" className="demo-link-button" onClick={() => select(row)}>{row.accountName}</button><small>{row.accountCode}</small></td><td><Pill value={row.status}/></td><td><Pill value={p.integrationStatus}/></td><td>{row.phone || '-'}</td><td>{row.owner}</td></tr>; })}</tbody></table></div></div>
      {selected && !editing && profile && <aside className="data-card demo-la-detail"><div className="data-card-header"><div><small>{selected.accountCode}</small><strong>{selected.accountName}</strong></div><button type="button" onClick={() => { setDraft(accountDraft(selected)); setEditing(true); }}>Edit</button></div><div className="demo-la-tabs"><button className={tab === 'SUMMARY' ? 'active' : ''} onClick={() => setTab('SUMMARY')}>Summary</button><button className={tab === 'CONTACTS' ? 'active' : ''} onClick={() => setTab('CONTACTS')}>Contacts ({selectedContacts.length})</button><button className={tab === 'ERP' ? 'active' : ''} onClick={() => setTab('ERP')}>Management / ERP</button></div><div className="demo-la-detail-body">
        {tab === 'SUMMARY' && <><div className="demo-la-summary-grid"><div><span>Status</span><strong><Pill value={selected.status}/></strong></div><div><span>Grade</span><strong>{profile.grade}</strong></div><div><span>ERP integration</span><strong><Pill value={profile.integrationStatus}/></strong></div><div><span>Owner</span><strong>{selected.owner}</strong></div><div><span>Phone</span><strong>{selected.phone || '-'}</strong></div><div><span>Email</span><strong>{selected.email || '-'}</strong></div><div className="wide"><span>Address</span><strong>{selected.address || '-'}</strong></div></div>{profile.sourceLeadCode && <div className="demo-la-converted"><span>Source Lead</span><Link to={`/?lead=${encodeURIComponent(profile.sourceLeadCode)}`}>{profile.sourceLeadCode}</Link></div>}{conversion && <div className="demo-la-related-card"><span>Conversion result</span><strong>{conversion.opportunityName}</strong><small>Opportunity seed from Lead interest</small></div>}</>}
        {tab === 'CONTACTS' && <><div className="demo-la-section-head"><div><strong>Contacts</strong><small>People related to this Account</small></div><button type="button" onClick={newContact}>+ New Contact</button></div>{contactDraft && <ContactForm value={contactDraft} onChange={setContactDraft} onSave={saveContact} onCancel={() => setContactDraft(null)} />}<div className="demo-la-contact-list">{selectedContacts.map(contact => <div key={contact.publicId}><div><strong>{contact.name}</strong><small>{contact.customerType}</small></div><span>{contact.phone || '-'}</span><span>{contact.email || '-'}</span>{contact.sourceLeadCode && <Link to={`/?lead=${encodeURIComponent(contact.sourceLeadCode)}`}>{contact.sourceLeadCode}</Link>}</div>)}</div></>}
        {tab === 'ERP' && <><div className="demo-la-readiness"><div><span>ERP registration readiness</span><strong>{readiness} / 10</strong></div><progress max="10" value={readiness}/><small>Required fields are based on the overseas training material. Prototype action does not call ERP.</small></div><div className="demo-la-form-grid demo-la-inline-form"><label>Business owner<input value={profile.businessOwner} onChange={e => updateProfile('businessOwner', e.target.value)} /></label><label>Business No.<input value={profile.businessNo} onChange={e => updateProfile('businessNo', e.target.value)} /></label><label>Legal representative<input value={profile.legalRepresentative} onChange={e => updateProfile('legalRepresentative', e.target.value)} /></label><label>Medical institution code<input value={profile.medicalInstitutionCode} onChange={e => updateProfile('medicalInstitutionCode', e.target.value)} /></label><label>Invoice email<input value={profile.invoiceEmail} onChange={e => updateProfile('invoiceEmail', e.target.value)} /></label><label>Postal code<input value={profile.postalCode} onChange={e => updateProfile('postalCode', e.target.value)} /></label><label>Open date<input type="date" value={profile.openDate} onChange={e => updateProfile('openDate', e.target.value)} /></label><label>ERP customer code<input value={profile.erpCustomerCode} onChange={e => updateProfile('erpCustomerCode', e.target.value)} /></label></div><div className="account-form-actions"><button type="button" className="button-primary" disabled={readiness < 10 || profile.integrationStatus === 'REQUESTING'} onClick={requestErp}>Request registration (Mock)</button></div></>}
      </div></aside>}
    </div>
    {editing && <div className="data-card demo-la-editor"><div className="data-card-header"><div><strong>{selected ? `Edit ${selected.accountCode}` : 'New Account'}</strong><small>Keep initial registration short; management / ERP fields can be completed later.</small></div></div><div className="demo-la-form-grid"><label>Account name *<input value={draft.accountName} onChange={e => setDraft({ ...draft, accountName: e.target.value })}/></label><label>Country<select value={draft.country} onChange={e => setDraft({ ...draft, country: e.target.value })}><option>United States</option><option>Mexico</option><option>India</option><option>Other</option></select></label><label>Customer type<input value={draft.customerType} onChange={e => setDraft({ ...draft, customerType: e.target.value })}/></label><label>Status<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as DemoAccountDraft['status'] })}><option value="PROSPECT">PROSPECT</option><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></label><label>Phone<input value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })}/></label><label>Email<input value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}/></label><label className="full">Address<input value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })}/></label><label>Owner<input value={draft.owner} onChange={e => setDraft({ ...draft, owner: e.target.value })}/></label></div><div className="account-form-actions"><button type="button" onClick={() => setEditing(false)}>Cancel</button><button type="button" className="button-primary" disabled={!draft.accountName.trim()} onClick={saveAccount}>Save</button></div></div>}
    {message && <p className="notice info">{message}</p>}
  </section>;
}
