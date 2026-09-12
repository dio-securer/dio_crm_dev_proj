import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { DatabaseService } from '../../database/database.service';
import { ledgerFilename, previousMonthRange, statementFilename, validateStatementRange } from './analytics.rules';

export type LedgerQuery = {
  contractPublicId?: string;
  general?: boolean;
  from?: string;
  to?: string;
};

export type StatementQuery = {
  contractPublicId?: string;
  general?: boolean;
  from?: string;
  to?: string;
  salesPublicIds?: string[];
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly db: DatabaseService) {}

  private async account(companyId: number, accountPublicId: string) {
    const r = await this.db.query<any>(`SELECT TOP 1 a.*,CONVERT(varchar(36),a.public_id) public_id_text,u.user_name owner_name,o.organization_name
      FROM crm_account a
      LEFT JOIN crm_user u ON u.user_id=a.owner_user_id
      LEFT JOIN crm_organization o ON o.organization_id=u.organization_id
      WHERE a.company_id=@companyId AND a.public_id=@accountPublicId AND a.deleted_yn=0`, { companyId, accountPublicId });
    const account = r.recordset[0];
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  private async resolveContract(companyId: number, accountId: number, contractPublicId?: string) {
    if (!contractPublicId) return null;
    const r = await this.db.query<any>(`SELECT TOP 1 c.*,CONVERT(varchar(36),c.public_id) public_id_text
      FROM crm_contract c WHERE c.company_id=@companyId AND c.account_id=@accountId AND c.public_id=@contractPublicId AND c.deleted_yn=0`, { companyId, accountId, contractPublicId });
    const contract = r.recordset[0];
    if (!contract) throw new NotFoundException('Contract not found for Account');
    return contract;
  }

  async accountContracts(companyId: number, accountPublicId: string) {
    const account = await this.account(companyId, accountPublicId);
    const r = await this.db.query(`SELECT CONVERT(varchar(36),public_id) public_id,contract_name,erp_contract_no,contract_date,contract_amount,status,close_yn
      FROM crm_contract WHERE company_id=@companyId AND account_id=@accountId AND deleted_yn=0 ORDER BY contract_date DESC,contract_id DESC`, { companyId, accountId: account.account_id });
    return r.recordset;
  }

  async packageLedger(companyId: number, accountPublicId: string, query: LedgerQuery) {
    const account = await this.account(companyId, accountPublicId);
    const general = Boolean(query.general);
    if (!general && !query.contractPublicId) throw new BadRequestException('contractPublicId or general=true is required');
    const contract = await this.resolveContract(companyId, account.account_id, query.contractPublicId);
    const from = query.from || null;
    const to = query.to || null;

    const sales = await this.db.query<any>(`SELECT CONVERT(varchar(36),s.public_id) public_id,CONVERT(varchar(10),s.sales_date,23) txn_date,'SALE' txn_type,
      s.erp_sales_no reference_no,s.item_code,s.item_name,s.quantity,s.amount,CAST(NULL AS varchar(50)) status
      FROM crm_sales s
      WHERE s.company_id=@companyId AND s.account_id=@accountId
        AND ((@general=1 AND s.contract_id IS NULL) OR (@general=0 AND s.contract_id=@contractId))
        AND (@from IS NULL OR s.sales_date>=@from) AND (@to IS NULL OR s.sales_date<=@to)
      ORDER BY s.sales_date,s.sales_id`, { companyId, accountId: account.account_id, general: general ? 1 : 0, contractId: contract?.contract_id ?? null, from, to });

    let collections: any[] = [];
    let returns: any[] = [];
    if (contract) {
      const cr = await this.db.query<any>(`SELECT CONVERT(varchar(36),ca.public_id) public_id,CONVERT(varchar(10),CAST(ca.collected_at AS date),23) txn_date,'COLLECTION' txn_type,
        ca.erp_collection_no reference_no,CAST(NULL AS varchar(80)) item_code,CAST(NULL AS nvarchar(200)) item_name,CAST(NULL AS decimal(18,3)) quantity,ca.amount,CAST(NULL AS varchar(50)) status
        FROM crm_collection_actual ca WHERE ca.company_id=@companyId AND ca.contract_id=@contractId
          AND (@from IS NULL OR CAST(ca.collected_at AS date)>=@from) AND (@to IS NULL OR CAST(ca.collected_at AS date)<=@to)
        ORDER BY ca.collected_at,ca.collection_actual_id`, { companyId, contractId: contract.contract_id, from, to });
      collections = cr.recordset;
      const rr = await this.db.query<any>(`SELECT CONVERT(varchar(36),r.public_id) public_id,CONVERT(varchar(10),CAST(r.processed_at AS date),23) txn_date,r.transaction_type txn_type,
        r.erp_reference_no reference_no,r.item_code,CAST(NULL AS nvarchar(200)) item_name,r.quantity,CAST(NULL AS decimal(18,2)) amount,r.status
        FROM crm_return_exchange r JOIN crm_order o ON o.order_id=r.order_id
        WHERE r.company_id=@companyId AND o.contract_id=@contractId
          AND (@from IS NULL OR CAST(r.processed_at AS date)>=@from) AND (@to IS NULL OR CAST(r.processed_at AS date)<=@to)
        ORDER BY r.processed_at,r.return_exchange_id`, { companyId, contractId: contract.contract_id, from, to });
      returns = rr.recordset;
    }

    const rows = [...sales.recordset, ...collections, ...returns].sort((a,b) => String(a.txn_date ?? '').localeCompare(String(b.txn_date ?? '')));
    return {
      account: { publicId: account.public_id_text, accountName: account.account_name, erpCustomerCode: account.erp_customer_code },
      scope: general ? { type: 'GENERAL' } : { type: 'CONTRACT', publicId: contract.public_id_text, contractName: contract.contract_name, erpContractNo: contract.erp_contract_no, contractAmount: Number(contract.contract_amount) },
      period: { from, to },
      summary: {
        salesAmount: rows.filter(x => x.txn_type === 'SALE').reduce((s,x) => s + Number(x.amount ?? 0), 0),
        collectionAmount: rows.filter(x => x.txn_type === 'COLLECTION').reduce((s,x) => s + Number(x.amount ?? 0), 0),
        returnExchangeCount: rows.filter(x => x.txn_type === 'RETURN' || x.txn_type === 'EXCHANGE').length,
        rowCount: rows.length
      },
      rows
    };
  }

  async packageLedgerExcel(companyId: number, accountPublicId: string, query: LedgerQuery) {
    const ledger = await this.packageLedger(companyId, accountPublicId, query) as any;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Package Ledger');
    sheet.addRow(['Account', ledger.account.accountName]);
    sheet.addRow(['Scope', ledger.scope.type === 'GENERAL' ? 'GENERAL' : `${ledger.scope.contractName} / ${ledger.scope.erpContractNo ?? ''}`]);
    sheet.addRow(['Period', `${ledger.period.from ?? ''} ~ ${ledger.period.to ?? ''}`]);
    sheet.addRow([]);
    sheet.addRow(['Date','Type','Reference','Item Code','Item Name','Quantity','Amount','Status']);
    for (const row of ledger.rows) sheet.addRow([row.txn_date,row.txn_type,row.reference_no,row.item_code,row.item_name,row.quantity,row.amount,row.status]);
    sheet.columns.forEach(c => { c.width = 18; });
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      filename: ledgerFilename(ledger.account.accountName, ledger.scope.erpContractNo, ledger.scope.type === 'GENERAL'),
      buffer
    };
  }

  async statement(companyId: number, accountPublicId: string, query: StatementQuery) {
    const account = await this.account(companyId, accountPublicId);
    const general = Boolean(query.general);
    if (!general && !query.contractPublicId) throw new BadRequestException('contractPublicId or general=true is required');
    const contract = await this.resolveContract(companyId, account.account_id, query.contractPublicId);
    const defaults = previousMonthRange();
    const from = query.from || defaults.from;
    const to = query.to || defaults.to;
    const range = validateStatementRange(from, to);
    if (!range.allowed) throw new BadRequestException(range.error);

    const selected = query.salesPublicIds?.length ? query.salesPublicIds : null;
    const r = await this.db.query<any>(`SELECT CONVERT(varchar(36),s.public_id) public_id,s.erp_sales_no,CONVERT(varchar(10),s.sales_date,23) sales_date,
      s.item_code,s.item_name,s.quantity,s.amount,CONVERT(varchar(36),o.public_id) order_public_id,o.erp_order_no
      FROM crm_sales s LEFT JOIN crm_order o ON o.order_id=s.order_id
      WHERE s.company_id=@companyId AND s.account_id=@accountId
        AND ((@general=1 AND s.contract_id IS NULL) OR (@general=0 AND s.contract_id=@contractId))
        AND s.sales_date>=@from AND s.sales_date<=@to
      ORDER BY s.sales_date,s.sales_id`, { companyId, accountId: account.account_id, general: general ? 1 : 0, contractId: contract?.contract_id ?? null, from, to });
    const rows = selected ? r.recordset.filter((x:any) => selected.includes(String(x.public_id))) : r.recordset;
    return {
      account: { publicId: account.public_id_text, accountName: account.account_name, businessNo: account.business_no, address: account.address, erpCustomerCode: account.erp_customer_code },
      scope: general ? { type: 'GENERAL' } : { type: 'CONTRACT', publicId: contract.public_id_text, contractName: contract.contract_name, erpContractNo: contract.erp_contract_no },
      period: { from, to },
      rows,
      summary: { lineCount: rows.length, totalAmount: rows.reduce((s:any,x:any) => s + Number(x.amount ?? 0), 0) }
    };
  }

  async statementPdf(companyId: number, accountPublicId: string, query: StatementQuery, userId: number) {
    const data = await this.statement(companyId, accountPublicId, query) as any;
    const filename = statementFilename(data.period.to, data.scope.erpContractNo, data.scope.type === 'GENERAL');
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
    const fontPath = process.env.DIO_CRM_PDF_FONT;
    if (fontPath && existsSync(fontPath)) doc.font(fontPath);
    const safe = (value: unknown) => {
      const text = String(value ?? '');
      if (fontPath && existsSync(fontPath)) return text;
      return text.replace(/[^\x20-\x7E]/g, '?');
    };
    doc.fontSize(16).text('DIO CRM Monthly Statement', { align: 'center' });
    doc.moveDown().fontSize(10);
    doc.text(`Account: ${safe(data.account.accountName)}`);
    doc.text(`ERP Customer: ${safe(data.account.erpCustomerCode)}`);
    doc.text(`Period: ${data.period.from} ~ ${data.period.to}`);
    doc.text(`Scope: ${data.scope.type === 'GENERAL' ? 'GENERAL' : safe(data.scope.erpContractNo || data.scope.contractName)}`);
    doc.moveDown();
    doc.text('Date | ERP Sales No | Item | Qty | Amount');
    doc.moveDown(0.3);
    for (const row of data.rows) {
      const line = `${row.sales_date} | ${safe(row.erp_sales_no)} | ${safe(row.item_name || row.item_code)} | ${row.quantity ?? ''} | ${Number(row.amount ?? 0).toLocaleString('en-US')}`;
      doc.text(line, { width: 520 });
    }
    doc.moveDown();
    doc.text(`Total: ${Number(data.summary.totalAmount).toLocaleString('en-US')}`, { align: 'right' });
    doc.end();
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const account = await this.account(companyId, accountPublicId);
    const contract = data.scope.type === 'CONTRACT' ? await this.resolveContract(companyId, account.account_id, data.scope.publicId) : null;
    await this.db.query(`INSERT INTO crm_statement_generation(company_id,account_id,contract_id,period_from,period_to,general_trade_yn,selected_sales_ids_json,file_name,line_count,total_amount,storage_status,generated_by)
      VALUES(@companyId,@accountId,@contractId,@from,@to,@general,@selected,@fileName,@lineCount,@totalAmount,'NOT_STORED',@userId)`, {
      companyId, accountId: account.account_id, contractId: contract?.contract_id ?? null, from: data.period.from, to: data.period.to,
      general: data.scope.type === 'GENERAL' ? 1 : 0, selected: query.salesPublicIds?.length ? JSON.stringify(query.salesPublicIds) : null,
      fileName: filename, lineCount: data.summary.lineCount, totalAmount: data.summary.totalAmount, userId
    });
    return { filename, buffer };
  }

  async account360(companyId: number, accountPublicId: string) {
    const account = await this.account(companyId, accountPublicId);
    const p = { companyId, accountId: account.account_id };
    const [contacts, opportunities, contracts, orders, deliveries, sales, collections, returns, activities] = await Promise.all([
      this.db.query(`SELECT TOP 100 CONVERT(varchar(36),public_id) public_id,contact_type,contact_name,mobile,email,school,cohort,major,note FROM crm_contact WHERE account_id=@accountId AND deleted_yn=0 ORDER BY contact_id`, p),
      this.db.query(`SELECT TOP 100 CONVERT(varchar(36),public_id) public_id,opportunity_name,stage,amount,expected_close_date,success_probability,forecast_category,contract_created_yn FROM crm_opportunity WHERE company_id=@companyId AND account_id=@accountId AND deleted_yn=0 ORDER BY opportunity_id DESC`, p),
      this.db.query(`SELECT TOP 100 CONVERT(varchar(36),public_id) public_id,contract_name,contract_date,contract_amount,status,erp_contract_no,close_yn FROM crm_contract WHERE company_id=@companyId AND account_id=@accountId AND deleted_yn=0 ORDER BY contract_id DESC`, p),
      this.db.query(`SELECT TOP 100 CONVERT(varchar(36),public_id) public_id,status,erp_order_no,delivery_address,express_yn,requested_at FROM crm_order WHERE company_id=@companyId AND account_id=@accountId AND deleted_yn=0 ORDER BY order_id DESC`, p),
      this.db.query(`SELECT TOP 100 CONVERT(varchar(36),d.public_id) public_id,d.erp_delivery_no,d.delivery_status,d.shipped_at,d.delivered_at,CONVERT(varchar(36),o.public_id) order_public_id FROM crm_delivery d JOIN crm_order o ON o.order_id=d.order_id WHERE d.company_id=@companyId AND o.account_id=@accountId ORDER BY d.delivery_id DESC`, p),
      this.db.query(`SELECT TOP 200 CONVERT(varchar(36),public_id) public_id,erp_sales_no,sales_date,amount,item_code,item_name,quantity FROM crm_sales WHERE company_id=@companyId AND account_id=@accountId ORDER BY sales_date DESC,sales_id DESC`, p),
      this.db.query(`SELECT TOP 200 CONVERT(varchar(36),ca.public_id) public_id,ca.erp_collection_no,ca.amount,ca.collected_at,CONVERT(varchar(36),c.public_id) contract_public_id FROM crm_collection_actual ca JOIN crm_contract c ON c.contract_id=ca.contract_id WHERE ca.company_id=@companyId AND c.account_id=@accountId ORDER BY ca.collected_at DESC`, p),
      this.db.query(`SELECT TOP 100 CONVERT(varchar(36),r.public_id) public_id,r.erp_reference_no,r.transaction_type,r.status,r.item_code,r.quantity,r.processed_at FROM crm_return_exchange r LEFT JOIN crm_order o ON o.order_id=r.order_id WHERE r.company_id=@companyId AND o.account_id=@accountId ORDER BY r.return_exchange_id DESC`, p),
      this.db.query(`SELECT TOP 100 CONVERT(varchar(36),public_id) public_id,planned_at,visit_purpose,consultation_content,status,in_at,out_at FROM crm_activity WHERE company_id=@companyId AND related_type='ACCOUNT' AND related_id=@accountId ORDER BY planned_at DESC`, p)
    ]);
    const salesTotal = sales.recordset.reduce((s:any,x:any) => s + Number(x.amount ?? 0), 0);
    const collectionTotal = collections.recordset.reduce((s:any,x:any) => s + Number(x.amount ?? 0), 0);
    return {
      account,
      contacts: contacts.recordset,
      sales: { opportunities: opportunities.recordset, contracts: contracts.recordset, sales: sales.recordset, collections: collections.recordset },
      order: { orders: orders.recordset, deliveries: deliveries.recordset, returns: returns.recordset },
      activity: activities.recordset,
      service: { available: false, reason: 'Customer Center / Service domain is not part of the current implementation baseline.' },
      analysis: {
        opportunityCount: opportunities.recordset.length,
        contractCount: contracts.recordset.length,
        orderCount: orders.recordset.length,
        salesTotal,
        collectionTotal,
        outstandingObserved: Math.max(0, salesTotal - collectionTotal),
        activityCount: activities.recordset.length
      }
    };
  }

  async dashboard(companyId: number, from?: string, to?: string) {
    const p = { companyId, from: from || null, to: to || null };
    const [lead, activity, pipeline, contract, order, sales, collections, topAccounts] = await Promise.all([
      this.db.query(`SELECT status,COUNT(*) count FROM crm_lead WHERE company_id=@companyId AND deleted_yn=0 GROUP BY status`, p),
      this.db.query(`SELECT status,COUNT(*) count FROM crm_activity WHERE company_id=@companyId AND (@from IS NULL OR planned_date>=@from) AND (@to IS NULL OR planned_date<=@to) GROUP BY status`, p),
      this.db.query(`SELECT stage,COUNT(*) opportunity_count,SUM(amount) amount,SUM(amount*ISNULL(success_probability,0)/100.0) weighted_amount FROM crm_opportunity WHERE company_id=@companyId AND deleted_yn=0 GROUP BY stage`, p),
      this.db.query(`SELECT status,COUNT(*) count,SUM(contract_amount) amount FROM crm_contract WHERE company_id=@companyId AND deleted_yn=0 GROUP BY status`, p),
      this.db.query(`SELECT status,COUNT(*) count FROM crm_order WHERE company_id=@companyId AND deleted_yn=0 AND (@from IS NULL OR CAST(created_at AS date)>=@from) AND (@to IS NULL OR CAST(created_at AS date)<=@to) GROUP BY status`, p),
      this.db.query(`SELECT COUNT(*) count,SUM(amount) amount FROM crm_sales WHERE company_id=@companyId AND (@from IS NULL OR sales_date>=@from) AND (@to IS NULL OR sales_date<=@to)`, p),
      this.db.query(`SELECT COUNT(*) count,SUM(amount) amount FROM crm_collection_actual WHERE company_id=@companyId AND (@from IS NULL OR CAST(collected_at AS date)>=@from) AND (@to IS NULL OR CAST(collected_at AS date)<=@to)`, p),
      this.db.query(`SELECT TOP 10 CONVERT(varchar(36),a.public_id) account_public_id,a.account_name,SUM(s.amount) sales_amount FROM crm_sales s JOIN crm_account a ON a.account_id=s.account_id WHERE s.company_id=@companyId AND (@from IS NULL OR s.sales_date>=@from) AND (@to IS NULL OR s.sales_date<=@to) GROUP BY a.public_id,a.account_name ORDER BY SUM(s.amount) DESC`, p)
    ]);
    return {
      period: { from: from || null, to: to || null },
      leads: lead.recordset,
      activities: activity.recordset,
      pipeline: pipeline.recordset,
      contracts: contract.recordset,
      orders: order.recordset,
      sales: sales.recordset[0] ?? { count: 0, amount: 0 },
      collections: collections.recordset[0] ?? { count: 0, amount: 0 },
      topAccounts: topAccounts.recordset
    };
  }
}
