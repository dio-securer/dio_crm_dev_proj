import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  createDemoAccount,
  loadDemoAccounts,
  resetDemoAccounts,
  updateDemoAccount
} from './demo-account-repository';
import {
  DEMO_ACTIVITIES,
  DEMO_CONTRACTS,
  DEMO_LEADS,
  DEMO_OPPORTUNITIES,
  DEMO_ORDERS,
  DEMO_PRODUCTS,
  DEMO_REPORTS,
  type DemoAccount,
  type DemoAccountDraft
} from './demo-data';
import { EXECUTIVE_DEMO_LABEL } from './demo-mode';

const EMPTY_ACCOUNT: DemoAccountDraft = {
  accountName: '',
  country: 'India',
  customerType: 'Dental Clinic',
  phone: '',
  email: '',
  address: '',
  status: 'PROSPECT',
  owner: 'Global Sales Demo'
};

function DemoHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return <>
    <div className="demo-standard-banner">
      <div><strong>{EXECUTIVE_DEMO_LABEL}</strong><span>US / MX baseline · India reference draft</span></div>
      <span className="demo-prototype-pill">MOCK DATA</span>
    </div>
    <div className="page-header">
      <div><span className="page-kicker">GLOBAL · EXECUTIVE DEMO</span><h2>{title}</h2><small>{subtitle}</small></div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  </>;
}

function Metric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <div className="kpi-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function Status({ value }: { value: string }) {
  const normalized = value.toUpperCase();
  const tone = normalized.includes('APPROVED') || normalized.includes('ACTIVE') || normalized.includes('READY') ? 'success' : normalized.includes('DRAFT') || normalized.includes('PROSPECT') ? 'warning' : 'neutral';
  return <span className={`status-pill ${tone}`}>{value}</span>;
}

function EntityLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link className="demo-entity-link" to={to} onClick={event => event.stopPropagation()}>{children}</Link>;
}

export function DemoGlobalLeadPage() {
  return <section className="workspace-page">
    <DemoHeader title="Lead" subtitle="New registration → First visit → Keyman meeting → Convert / Contact excluded" />
    <div className="kpi-grid"><Metric label="Open leads" value="3" note="Executive prototype"/><Metric label="Keyman meetings" value="1" note="Ready for conversion"/><Metric label="First visits" value="1" note="In progress"/><Metric label="India sample" value="1" note="Fit/Gap discussion seed"/></div>
    <div className="data-card">
      <div className="data-card-header"><div><strong>Lead workspace</strong><small>Representative GLOBAL sales pipeline</small></div><button type="button">+ New Lead</button></div>
      <div className="table-scroll"><table><thead><tr><th>Lead</th><th>Business / Hospital</th><th>Country</th><th>Status</th><th>Owner</th></tr></thead><tbody>{DEMO_LEADS.map(row => <tr key={row.code}><td><strong>{row.code}</strong></td><td>{row.name}</td><td>{row.country}</td><td><Status value={row.status}/></td><td>{row.owner}</td></tr>)}</tbody></table></div>
    </div>
  </section>;
}

function AccountForm({ draft, setDraft, onSave, onCancel, title }: { draft: DemoAccountDraft; setDraft: React.Dispatch<React.SetStateAction<DemoAccountDraft>>; onSave: () => void; onCancel: () => void; title: string }) {
  const set = <K extends keyof DemoAccountDraft>(key: K, value: DemoAccountDraft[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  return <div className="data-card demo-editor-card">
    <div className="data-card-header"><div><strong>{title}</strong><small>Prototype changes are stored only in this browser.</small></div></div>
    <div className="account-form-grid demo-form-grid">
      <label>Account name *<input value={draft.accountName} onChange={e => set('accountName', e.target.value)} /></label>
      <label>Country<select value={draft.country} onChange={e => set('country', e.target.value)}><option>United States</option><option>Mexico</option><option>India</option><option>Other</option></select></label>
      <label>Customer type<select value={draft.customerType} onChange={e => set('customerType', e.target.value)}><option>Dental Clinic</option><option>Hospital</option><option>Distributor</option><option>Partner</option></select></label>
      <label>Status<select value={draft.status} onChange={e => set('status', e.target.value as DemoAccountDraft['status'])}><option value="PROSPECT">PROSPECT</option><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></label>
      <label>Phone<input value={draft.phone} onChange={e => set('phone', e.target.value)} /></label>
      <label>Email<input value={draft.email} onChange={e => set('email', e.target.value)} /></label>
      <label className="full">Address<input value={draft.address} onChange={e => set('address', e.target.value)} /></label>
      <label>Owner<input value={draft.owner} onChange={e => set('owner', e.target.value)} /></label>
    </div>
    <div className="account-form-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="button-primary" disabled={!draft.accountName.trim()} onClick={onSave}>Save</button></div>
  </div>;
}

function accountDraft(row: DemoAccount): DemoAccountDraft {
  return {
    accountName: row.accountName,
    country: row.country,
    customerType: row.customerType,
    phone: row.phone,
    email: row.email,
    address: row.address,
    status: row.status,
    owner: row.owner
  };
}

export function DemoGlobalAccountPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<DemoAccount[]>(() => loadDemoAccounts());
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DemoAccountDraft>({ ...EMPTY_ACCOUNT });
  const [message, setMessage] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(row => [row.accountCode, row.accountName, row.country, row.owner].some(value => value.toLowerCase().includes(term)));
  }, [rows, search]);
  const selected = rows.find(row => row.publicId === selectedId) ?? null;

  useEffect(() => {
    const requested = searchParams.get('account');
    if (!requested) return;
    const match = rows.find(row => row.accountCode === requested || row.publicId === requested);
    if (match) setSelectedId(match.publicId);
  }, [rows, searchParams]);

  function select(row: DemoAccount) {
    setSelectedId(row.publicId);
    setEditing(false);
    setMessage('');
    const next = new URLSearchParams(searchParams);
    next.set('account', row.accountCode);
    setSearchParams(next, { replace: true });
  }

  function startNew() {
    setSelectedId(null);
    setDraft({ ...EMPTY_ACCOUNT });
    setEditing(true);
    setMessage('');
  }

  function startEdit() {
    if (!selected) return;
    setDraft(accountDraft(selected));
    setEditing(true);
  }

  function save() {
    if (!draft.accountName.trim()) return;
    if (selected) {
      const next = updateDemoAccount(rows, selected.publicId, draft);
      setRows(next);
      setMessage(`Updated ${selected.accountCode}.`);
    } else {
      const next = createDemoAccount(rows, draft);
      setRows(next);
      const created = next[0];
      setSelectedId(created.publicId);
      setMessage(`Created ${created.accountCode}.`);
    }
    setEditing(false);
  }

  function reset() {
    const next = resetDemoAccounts();
    setRows(next);
    setSelectedId(null);
    setEditing(false);
    setSearch('');
    setMessage('Mock data reset.');
    setSearchParams({}, { replace: true });
  }

  return <section className="workspace-page demo-account-page">
    <DemoHeader title="Account" subtitle="Global account master · mock Create / Read / Update for the executive prototype" actions={<><input className="search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search account"/><button type="button" className="button-primary" onClick={startNew}>+ New Account</button></>} />
    <div className="demo-account-layout">
      <div className="data-card demo-account-list">
        <div className="data-card-header"><div><strong>Accounts</strong><small>{filtered.length} mock records · click a business key to inspect</small></div><button type="button" className="text-link" onClick={reset}>Reset demo</button></div>
        <div className="table-scroll"><table><thead><tr><th>Account code</th><th>Account name</th><th>Country</th><th>Status</th><th>Owner</th></tr></thead><tbody>{filtered.map(row => <tr key={row.publicId} onClick={() => select(row)} className={selectedId === row.publicId ? 'demo-selected-row' : ''}><td><button type="button" className="demo-link-button" onClick={() => select(row)}>{row.accountCode}</button></td><td><strong>{row.accountName}</strong></td><td>{row.country}</td><td><Status value={row.status}/></td><td>{row.owner}</td></tr>)}</tbody></table></div>
      </div>

      {selected && !editing && <aside className="data-card demo-detail-card">
        <div className="data-card-header"><div><small>{selected.accountCode}</small><strong>{selected.accountName}</strong></div><button type="button" onClick={startEdit}>Edit</button></div>
        <dl className="demo-detail-list"><div><dt>Country</dt><dd>{selected.country}</dd></div><div><dt>Customer type</dt><dd>{selected.customerType}</dd></div><div><dt>Status</dt><dd><Status value={selected.status}/></dd></div><div><dt>Phone</dt><dd>{selected.phone || '-'}</dd></div><div><dt>Email</dt><dd>{selected.email || '-'}</dd></div><div><dt>Address</dt><dd>{selected.address || '-'}</dd></div><div><dt>Owner</dt><dd>{selected.owner}</dd></div></dl>
        <div className="demo-related"><strong>Related workspace</strong><EntityLink to="/opportunities">Opportunities</EntityLink><EntityLink to="/contracts">Contracts</EntityLink><EntityLink to="/orders">Orders</EntityLink></div>
      </aside>}
    </div>
    {editing && <AccountForm title={selected ? `Edit ${selected.accountCode}` : 'New Account'} draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setEditing(false)} />}
    {message && <p className="notice info">{message}</p>}
  </section>;
}

export function DemoGlobalActivityPage() {
  return <section className="workspace-page">
    <DemoHeader title="Activity" subtitle="Activity Plan → Map / Log → GPS IN → Consultation → GPS OUT" />
    <div className="demo-two-column">
      <div className="data-card demo-map-card"><div className="demo-map-visual"><span>MAP / GPS</span><strong>Provider not connected in prototype</strong><small>Live provider selection remains an integration decision.</small></div></div>
      <div className="data-card"><div className="data-card-header"><div><strong>Today's activity</strong><small>Representative visits for the demo</small></div></div><div className="demo-activity-list">{DEMO_ACTIVITIES.map(row => <div key={`${row.time}-${row.account}`}><time>{row.time}</time><div><strong>{row.account}</strong><small>{row.type}</small></div><Status value={row.state}/></div>)}</div></div>
    </div>
  </section>;
}

export function DemoGlobalActivityReportPage() {
  return <section className="workspace-page">
    <DemoHeader title="Activity Report" subtitle="Completed activity + next 5 days plan · approval request baseline" />
    <div className="data-card"><div className="data-card-header"><div><strong>Reports</strong><small>Approver organization is intentionally not fixed in this prototype.</small></div><button type="button" className="button-primary">Prepare Today</button></div><div className="table-scroll"><table><thead><tr><th>Date</th><th>Completed</th><th>Next plans</th><th>Status</th></tr></thead><tbody>{DEMO_REPORTS.map(row => <tr key={row.date}><td><strong>{row.date}</strong></td><td>{row.completed}</td><td>{row.nextPlans}</td><td><Status value={row.status}/></td></tr>)}</tbody></table></div></div>
  </section>;
}

export function DemoGlobalOpportunityPage() {
  return <section className="workspace-page">
    <DemoHeader title="Opportunity" subtitle="Needs analysis → Proposal → Negotiation → Closed Won / Lost" />
    <div className="data-card"><div className="data-card-header"><div><strong>Open opportunities</strong><small>Account business keys demonstrate reference navigation.</small></div><button type="button">+ New Opportunity</button></div><div className="table-scroll"><table><thead><tr><th>Opportunity</th><th>Account</th><th>Name</th><th>Stage</th><th>Amount</th><th>Owner</th></tr></thead><tbody>{DEMO_OPPORTUNITIES.map(row => <tr key={row.no}><td><strong>{row.no}</strong></td><td><EntityLink to={`/accounts?account=${encodeURIComponent(row.accountCode)}`}>{row.accountCode}</EntityLink></td><td>{row.name}</td><td><Status value={row.stage}/></td><td>{row.amount}</td><td>{row.owner}</td></tr>)}</tbody></table></div></div>
  </section>;
}

export function DemoGlobalContractPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = DEMO_CONTRACTS.find(row => row.no === searchParams.get('contract')) ?? null;
  return <section className="workspace-page">
    <DemoHeader title="Contract" subtitle="Won opportunity → Contract / Collection Plan → ERP registration request" />
    <div className="data-card"><div className="data-card-header"><div><strong>Contracts</strong><small>Contract No. is a representative transaction drill-down key.</small></div></div><div className="table-scroll"><table><thead><tr><th>Contract No.</th><th>Account</th><th>Opportunity</th><th>Package</th><th>Amount</th><th>Status</th></tr></thead><tbody>{DEMO_CONTRACTS.map(row => <tr key={row.no} className={selected?.no === row.no ? 'demo-selected-row' : ''}><td><button type="button" className="demo-link-button" onClick={() => setSearchParams({ contract: row.no })}>{row.no}</button></td><td><EntityLink to={`/accounts?account=${encodeURIComponent(row.accountCode)}`}>{row.accountCode}</EntityLink></td><td>{row.opportunityNo}</td><td>{row.packageName}</td><td>{row.amount}</td><td><Status value={row.status}/></td></tr>)}</tbody></table></div></div>
    {selected && <div className="data-card demo-contract-detail"><div className="data-card-header"><div><small>Contract detail</small><strong>{selected.no}</strong></div></div><dl className="demo-detail-list demo-detail-grid"><div><dt>Account</dt><dd><EntityLink to={`/accounts?account=${encodeURIComponent(selected.accountCode)}`}>{selected.accountCode}</EntityLink></dd></div><div><dt>Opportunity</dt><dd>{selected.opportunityNo}</dd></div><div><dt>Package</dt><dd>{selected.packageName}</dd></div><div><dt>Amount</dt><dd>{selected.amount}</dd></div><div><dt>Payment plan</dt><dd>{selected.payment}</dd></div><div><dt>ERP status</dt><dd><Status value={selected.status}/></dd></div></dl></div>}
  </section>;
}

export function DemoGlobalOrderPage() {
  const [productCode, setProductCode] = useState<string | null>(null);
  const product = DEMO_PRODUCTS.find(row => row.code === productCode) ?? null;
  return <section className="workspace-page">
    <DemoHeader title="Order" subtitle="Contract reference → Product → Delivery → Submit" />
    <div className="notice info">Reference-link demo: click Account Code, Contract No. or Product Code to inspect the related entity.</div>
    <div className="data-card"><div className="data-card-header"><div><strong>Orders</strong><small>Representative transaction data only</small></div><button type="button">+ New Order</button></div><div className="table-scroll"><table><thead><tr><th>Order No.</th><th>Account</th><th>Contract</th><th>Product</th><th>Qty</th><th>Amount</th><th>Status</th></tr></thead><tbody>{DEMO_ORDERS.map(row => <tr key={row.no}><td><strong>{row.no}</strong></td><td><EntityLink to={`/accounts?account=${encodeURIComponent(row.accountCode)}`}>{row.accountCode}</EntityLink></td><td><EntityLink to={`/contracts?contract=${encodeURIComponent(row.contractNo)}`}>{row.contractNo}</EntityLink></td><td><button type="button" className="demo-link-button" onClick={() => setProductCode(row.productCode)}>{row.productCode}</button></td><td>{row.qty}</td><td>{row.amount}</td><td><Status value={row.status}/></td></tr>)}</tbody></table></div></div>
    {product && <div className="data-card demo-product-quickview"><div className="data-card-header"><div><small>Product quick view</small><strong>{product.code}</strong></div><button type="button" onClick={() => setProductCode(null)}>Close</button></div><dl className="demo-detail-list demo-detail-grid"><div><dt>Product name</dt><dd>{product.name}</dd></div><div><dt>Category</dt><dd>{product.category}</dd></div><div><dt>Unit price</dt><dd>{product.unitPrice}</dd></div><div><dt>Detail route</dt><dd>Reserved for Product master expansion</dd></div></dl></div>}
  </section>;
}
