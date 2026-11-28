import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { HqApplication, hqCanRead, hqFind, hqRequire, hqText } from './app.js';
import type { HqBinaryResult, HqRouteContext } from './app.js';
import { hqAssert } from './model.js';
import type { HqDataset, HqRow } from './model.js';
import { contractAmountsReadable, visibleContractFields } from './contract-visibility.js';

const day = (value: string, label: string) => { hqAssert(/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 400, 'DATE_INVALID', label); return value; };
const period = (c: HqRouteContext, d: HqDataset) => {
  const to = day(c.query.get('to') ?? d.clock.slice(0, 10), 'to');
  const from = day(c.query.get('from') ?? `${to.slice(0, 7)}-01`, 'from');
  hqAssert(from <= to, 400, 'PERIOD_INVALID'); return { from, to };
};
const inPeriod = (value: unknown, p: { from: string; to: string }) => typeof value === 'string' && value.slice(0, 10) >= p.from && value.slice(0, 10) <= p.to;
const visible = (c: HqRouteContext, row: HqRow) => hqCanRead(c.actor, row);
const commonCurrency = (rows: HqRow[]): string | null => {
  if (!rows.length) return null;
  const codes = rows.map(row => row.currency);
  return codes.every(code => typeof code === 'string' && /^[A-Z]{3}$/.test(code) && code === codes[0]) ? String(codes[0]) : null;
};
const scope = (c: HqRouteContext, d: HqDataset, accountId: string) => {
  const account = hqFind(d, c.actor, 'accounts', accountId);
  const id = c.query.get('contractPublicId');
  const contract = id ? hqFind(d, c.actor, 'contracts', id) : null;
  if (contract) hqAssert(contract.account_public_id === account.public_id, 400, 'CONTRACT_ACCOUNT_MISMATCH');
  return { account, contract, scope: contract ? { type: 'CONTRACT', publicId: contract.public_id, contractName: contract.contract_name, erpContractNo: contract.erp_contract_no, contractAmount: contractAmountsReadable(c, contract) ? contract.contract_amount : null } : { type: 'GENERAL' } };
};
const ledger = (c: HqRouteContext, d: HqDataset) => {
  const s = scope(c, d, c.params.accountId), p = period(c, d);
  const belongs = (row: HqRow) => visible(c, row) && (s.contract ? row.contract_public_id === s.contract.public_id : !row.contract_public_id);
  const sales = d.collections.sales.filter(row => row.account_public_id === s.account.public_id && belongs(row) && inPeriod(row.sales_date, p));
  const collections = s.contract ? d.collections.collections.filter(row => belongs(row) && inPeriod(row.collected_at, p)) : [];
  const returns = s.contract ? d.collections.returns.filter(row => visible(c, row) && d.collections.orders.some(o => o.public_id === row.order_public_id && o.contract_public_id === s.contract?.public_id && visible(c, o)) && inPeriod(row.processed_at, p)) : [];
  const rows = [
    ...sales.map(row => ({ public_id: row.public_id, txn_date: row.sales_date, txn_type: 'SALE', reference_no: row.erp_sales_no, item_code: row.item_code ?? '', item_name: row.item_name ?? '', quantity: Number(row.quantity ?? 0), amount: Number(row.amount), currency: row.currency ?? null, status: 'POSTED' })),
    ...collections.map(row => ({ public_id: row.public_id, txn_date: row.collected_at, txn_type: 'COLLECTION', reference_no: row.erp_collection_no, item_code: '', item_name: '', quantity: 0, amount: Number(row.amount), currency: row.currency ?? null, status: 'POSTED' })),
    ...returns.map(row => ({ public_id: row.public_id, txn_date: row.processed_at, txn_type: row.transaction_type, reference_no: row.erp_reference_no, item_code: row.item_code ?? '', item_name: '', quantity: Number(row.quantity ?? 0), amount: Number(row.amount ?? 0), status: row.status }))
  ].sort((a, b) => String(a.txn_date).localeCompare(String(b.txn_date)) || String(a.reference_no).localeCompare(String(b.reference_no)));
  return { account: { publicId: s.account.public_id, accountName: s.account.account_name, erpCustomerCode: s.account.erp_customer_code }, scope: s.scope, period: p,
    asOf: d.clock, summary: { salesAmount: !sales.length ? 0 : commonCurrency(sales) && (!s.contract || commonCurrency(sales) === s.contract.currency) ? sales.reduce((n, row) => n + Number(row.amount), 0) : null, salesCurrency: commonCurrency(sales), collectionAmount: !collections.length ? 0 : commonCurrency(collections) && commonCurrency(collections) === s.contract?.currency ? collections.reduce((n, row) => n + Number(row.amount), 0) : null, collectionCurrency: commonCurrency(collections), returnExchangeCount: returns.length, rowCount: rows.length }, rows };
};
const statement = (c: HqRouteContext, d: HqDataset) => {
  const s = scope(c, d, c.params.accountId), p = period(c, d);
  const rows = d.collections.sales.filter(row => row.account_public_id === s.account.public_id && visible(c, row)
    && (s.contract ? row.contract_public_id === s.contract.public_id : !row.contract_public_id) && inPeriod(row.sales_date, p))
    .map(row => ({ public_id: row.public_id, sales_date: row.sales_date, erp_sales_no: row.erp_sales_no, item_code: row.item_code ?? '', item_name: row.item_name ?? '', quantity: Number(row.quantity ?? 0), amount: Number(row.amount), currency: row.currency ?? null }));
  return { account: { publicId: s.account.public_id, accountName: s.account.account_name, erpCustomerCode: s.account.erp_customer_code }, scope: s.scope, period: p, asOf: d.clock,
    rows, summary: { lineCount: rows.length, totalAmount: !rows.length ? 0 : rows.every(row => row.currency && row.currency === rows[0].currency && (!s.contract || row.currency === s.contract.currency)) ? rows.reduce((n, row) => n + row.amount, 0) : null, currency: rows.length && rows.every(row => row.currency && row.currency === rows[0].currency) ? rows[0].currency : null } };
};
const file = (bytes: Uint8Array, contentType: string, filename: string): HqBinaryResult => ({ __hqBinary: true, bytes, contentType, filename });
function statementFontPath(): string {
  // Support both the source mock server and the compiled backend regardless of
  // the caller's working directory. The font is shipped with the backend.
  for (const base of [process.cwd(), path.dirname(path.resolve(process.argv[1] ?? '.'))]) {
    let directory = base;
    while (true) {
      for (const relative of ['backend/assets/fonts/NanumGothic-Regular.ttf', 'assets/fonts/NanumGothic-Regular.ttf']) {
        const candidate = path.join(directory, relative);
        if (existsSync(candidate)) return candidate;
      }
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  throw new Error('Statement PDF font is missing');
}
const filterInput = (c: HqRouteContext) => ({ accountPublicId: c.params.accountId, contractPublicId: c.query.get('contractPublicId') ?? undefined,
  from: c.query.get('from') ?? undefined, to: c.query.get('to') ?? undefined, general: !c.query.get('contractPublicId') });

export function installAnalyticsRoutes(app: HqApplication): void {
  app.route('GET', '/api/analytics/accounts/:accountId/contracts', c => {
    hqRequire(c.actor, 'CONTRACT.READ'); app.requireScreen(c.actor, 'HQ_LEDGER'); const d = c.repository.read();
    const account = hqFind(d, c.actor, 'accounts', c.params.accountId);
    return d.collections.contracts.filter(row => row.account_public_id === account.public_id && visible(c, row)).map(row => visibleContractFields(c, row));
  });
  app.route('GET', '/api/analytics/accounts/:accountId/ledger', c => {
    app.requireAction(c.actor, 'LED.search', {}, filterInput(c)); return ledger(c, c.repository.read());
  });
  app.route('GET', '/api/analytics/accounts/:accountId/ledger.xlsx', async c => {
    app.requireAction(c.actor, 'LED.export', {}, filterInput(c)); const result = ledger(c, c.repository.read());
    const book = new ExcelJS.Workbook(), sheet = book.addWorksheet('Ledger');
    sheet.addRow(['Account', result.account.accountName, 'ERP code', result.account.erpCustomerCode ?? '']);
    sheet.addRow(['Scope', result.scope.type === 'CONTRACT' ? result.scope.contractName : 'General']);
    sheet.addRow(['From', result.period.from, 'To', result.period.to, 'As of', result.asOf]);
    sheet.addRow(['Date', 'Type', 'Reference', 'Item code', 'Item', 'Quantity', 'Amount', 'Status', 'Currency']);
    for (const row of result.rows) sheet.addRow([row.txn_date, row.txn_type, row.reference_no, row.item_code, row.item_name, row.quantity, row.amount, row.status, 'currency' in row ? row.currency ?? 'Unknown' : 'Unknown']);
    sheet.addRow(['Sales total', result.summary.salesAmount ?? 'Unavailable', 'Collection total', result.summary.collectionAmount ?? 'Unavailable']);
    sheet.columns.forEach(column => { column.width = 22; });
    return file(new Uint8Array(await book.xlsx.writeBuffer()), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `ledger-${result.period.from}-${result.period.to}.xlsx`);
  });
  app.route('GET', '/api/analytics/accounts/:accountId/statements', c => {
    app.requireAction(c.actor, 'STM.search', {}, filterInput(c)); return statement(c, c.repository.read());
  });
  app.route('POST', '/api/analytics/accounts/:accountId/statements/pdf', async c => {
    app.requireAction(c.actor, 'STM.export', {}, { ...filterInput(c), selectedRows: c.body.selectedSalesPublicIds ?? [] });
    const query = new URLSearchParams(c.query);
    if (c.body.from !== undefined) query.set('from', hqText(c.body.from, 'from'));
    if (c.body.to !== undefined) query.set('to', hqText(c.body.to, 'to'));
    if (c.body.contractPublicId !== undefined) query.set('contractPublicId', hqText(c.body.contractPublicId, 'contractPublicId'));
    const result = statement({ ...c, query }, c.repository.read());
    const selected = c.body.selectedSalesPublicIds;
    hqAssert(selected === undefined || (Array.isArray(selected) && selected.every(x => typeof x === 'string')), 400, 'SELECTED_ROWS_INVALID');
    const ids = selected === undefined ? null : new Set(selected as string[]);
    const rows = ids ? result.rows.filter(row => ids.has(row.public_id)) : result.rows;
    hqAssert(!ids || rows.length === ids.size, 400, 'SELECTED_ROWS_OUT_OF_SCOPE');
    const pdf = new PDFDocument({ size: 'A4', margin: 42 }); const chunks: Uint8Array[] = [];
    pdf.font(statementFontPath());
    pdf.on('data', chunk => chunks.push(chunk));
    const done = new Promise<Uint8Array>(resolve => pdf.on('end', () => resolve(Buffer.concat(chunks))));
    pdf.fontSize(18).text('Monthly Statement').fontSize(10).moveDown();
    pdf.text(`Account: ${result.account.erpCustomerCode ?? result.account.publicId}`);
    pdf.text(`Scope: ${result.scope.type === 'CONTRACT' ? result.scope.erpContractNo ?? result.scope.publicId : 'GENERAL'}`);
    pdf.text(`Period: ${result.period.from} ~ ${result.period.to}    As of: ${result.asOf}`); pdf.moveDown();
    for (const row of rows) {
      pdf.text(`${row.sales_date}  ${row.erp_sales_no}  ${row.item_code}  ${row.quantity}  ${row.amount.toLocaleString('en-US')} ${row.currency ?? 'Unknown'}`);
      if (row.item_name) pdf.text(`품목명: ${row.item_name}`, { indent: 12 });
    }
    const validTotal = result.summary.totalAmount !== null && (!rows.length || rows.every(row => row.currency && row.currency === rows[0].currency));
    pdf.moveDown().text(`Lines: ${rows.length}    Total: ${validTotal ? rows.reduce((n, row) => n + row.amount, 0).toLocaleString('en-US') : 'Unavailable'} ${validTotal && rows.length ? rows[0].currency : ''}`);
    pdf.end(); return file(await done, 'application/pdf', `statement-${result.period.from}-${result.period.to}.pdf`);
  });
  app.route('GET', '/api/analytics/dashboard', c => {
    app.requireAction(c.actor, 'ANL.search', {}, { from: c.query.get('from') ?? undefined, to: c.query.get('to') ?? undefined }); const d = c.repository.read(), p = period(c, d);
    const accounts = d.collections.accounts.filter(row => visible(c, row)); const ids = new Set(accounts.map(row => row.public_id));
    const visibleContracts = d.collections.contracts.filter(row => visible(c, row) && ids.has(String(row.account_public_id)));
    const contracts = visibleContracts.filter(row => inPeriod(row.contract_date ?? d.clock, p));
    const orders = d.collections.orders.filter(row => visible(c, row) && ids.has(String(row.account_public_id)) && inPeriod(row.created_at ?? d.clock, p));
    const sales = d.collections.sales.filter(row => visible(c, row) && ids.has(String(row.account_public_id)) && inPeriod(row.sales_date, p));
    const collections = d.collections.collections.filter(row => visible(c, row) && visibleContracts.some(k => k.public_id === row.contract_public_id) && inPeriod(row.collected_at, p));
    const opportunities = d.collections.opportunities.filter(row => visible(c, row) && ids.has(String(row.account_public_id)) && inPeriod(row.expected_close_date ?? d.clock, p));
    const sum = (rows: HqRow[]) => rows.reduce((n, row) => n + Number(row.amount ?? 0), 0);
    return { period: p, asOf: d.clock, periodBasis: { leads: 'created_at', activities: 'start_at', pipeline: 'expected_close_date', contracts: 'contract_date', orders: 'created_at', sales: 'sales_date', collections: 'collected_at' },
      leads: { count: d.collections.leads.filter(row => visible(c, row) && inPeriod(row.created_at ?? d.clock, p)).length },
      activities: { count: d.collections.activities.filter(row => visible(c, row) && inPeriod(row.start_at, p)).length },
      pipeline: { count: opportunities.length, amount: sum(opportunities) }, contracts: { count: contracts.length, amount: contracts.every(row => contractAmountsReadable(c, row)) && (!contracts.length || commonCurrency(contracts)) ? contracts.reduce((n, row) => n + Number(row.contract_amount), 0) : null, currency: commonCurrency(contracts) },
      orders: { count: orders.length, amount: !orders.length || commonCurrency(orders) ? orders.reduce((n, row) => n + Number(row.order_amount), 0) : null, currency: commonCurrency(orders) },
      sales: { count: sales.length, amount: !sales.length || commonCurrency(sales) ? sum(sales) : null, currency: commonCurrency(sales) }, collections: { count: collections.length, amount: !collections.length ? 0 : commonCurrency(collections) && collections.every(item => visibleContracts.some(contract => contract.public_id === item.contract_public_id && contract.currency === item.currency)) ? sum(collections) : null, currency: commonCurrency(collections) },
      topAccounts: accounts.map(account => { const rows = sales.filter(row => row.account_public_id === account.public_id); return { accountPublicId: account.public_id, accountName: account.account_name, salesAmount: !rows.length || commonCurrency(rows) ? sum(rows) : null, currency: commonCurrency(rows) }; })
        .sort((a, b) => Number(b.salesAmount ?? -1) - Number(a.salesAmount ?? -1)).slice(0, 5) };
  });
}
