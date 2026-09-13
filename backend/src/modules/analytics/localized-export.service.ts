import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { AnalyticsService, type LedgerQuery, type StatementQuery } from './analytics.service';
import { ledgerFilename, statementFilename } from './analytics.rules';
import { DatabaseService } from '../../database/database.service';
import { GlobalizationService } from '../../globalization/globalization.service';
import { exportLabels, formatExportAmount, formatExportDate } from '../../globalization/export-localization';

@Injectable()
export class LocalizedExportService {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly globalization: GlobalizationService,
    private readonly db: DatabaseService
  ) {}

  async packageLedgerExcel(companyId:number, userId:number, accountPublicId:string, query:LedgerQuery) {
    const [ledger, context] = await Promise.all([
      this.analytics.packageLedger(companyId, accountPublicId, query) as Promise<any>,
      this.globalization.resolveCompany(companyId, userId)
    ]);
    const l = exportLabels(context.locale);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DIO CRM';
    const sheet = workbook.addWorksheet(context.locale.startsWith('ko') ? '패키지원장' : 'Package Ledger');
    sheet.addRow([l.account, ledger.account.accountName]);
    sheet.addRow([l.scope, ledger.scope.type === 'GENERAL' ? 'GENERAL' : `${ledger.scope.contractName} / ${ledger.scope.erpContractNo ?? ''}`]);
    sheet.addRow([l.period, `${ledger.period.from ?? ''} ~ ${ledger.period.to ?? ''}`]);
    sheet.addRow([]);
    sheet.addRow([l.date,l.type,l.reference,l.itemCode,l.itemName,l.quantity,l.amount,l.status]);
    for (const row of ledger.rows) {
      const date = row.txn_date ? formatExportDate(`${row.txn_date}T00:00:00Z`, context) : '';
      sheet.addRow([date,row.txn_type,row.reference_no,row.item_code,row.item_name,row.quantity,row.amount,row.status]);
    }
    sheet.columns.forEach(c => { c.width = 18; });
    const amountColumn = sheet.getColumn(7);
    amountColumn.numFmt = context.currencyCode === 'KRW' || context.currencyCode === 'JPY' ? '#,##0' : '#,##0.00';
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      filename: ledgerFilename(ledger.account.accountName, ledger.scope.erpContractNo, ledger.scope.type === 'GENERAL', context.locale),
      buffer
    };
  }

  async statementPdf(companyId:number, userId:number, accountPublicId:string, query:StatementQuery) {
    const [data, context] = await Promise.all([
      this.analytics.statement(companyId, accountPublicId, query) as Promise<any>,
      this.globalization.resolveCompany(companyId, userId)
    ]);
    const fontPath = process.env.DIO_CRM_PDF_FONT;
    const hasCustomFont = Boolean(fontPath && existsSync(fontPath));
    const pdfLocale = context.locale.toLowerCase().startsWith('ko') && !hasCustomFont ? 'en-US' : context.locale;
    const pdfContext = { ...context, locale: pdfLocale };
    const l = exportLabels(pdfLocale);
    const filename = statementFilename(data.period.to, data.scope.erpContractNo, data.scope.type === 'GENERAL', context.locale);
    const doc = new PDFDocument({ margin:36, size:'A4' });
    const chunks:Buffer[] = [];
    doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
    if (hasCustomFont && fontPath) doc.font(fontPath);
    const safe = (value:unknown) => {
      const text = String(value ?? '');
      return hasCustomFont ? text : text.replace(/[^\x20-\x7E]/g, '?');
    };
    doc.fontSize(16).text(l.statementTitle, { align:'center' });
    doc.moveDown().fontSize(10);
    doc.text(`${l.account}: ${safe(data.account.accountName)}`);
    doc.text(`${l.erpCustomer}: ${safe(data.account.erpCustomerCode)}`);
    doc.text(`${l.period}: ${formatExportDate(`${data.period.from}T00:00:00Z`, pdfContext)} ~ ${formatExportDate(`${data.period.to}T00:00:00Z`, pdfContext)}`);
    doc.text(`${l.scope}: ${data.scope.type === 'GENERAL' ? 'GENERAL' : safe(data.scope.erpContractNo || data.scope.contractName)}`);
    doc.moveDown();
    doc.text(`${l.date} | ${l.erpSalesNo} | ${l.itemName} | ${l.quantity} | ${l.amount}`);
    doc.moveDown(0.3);
    for (const row of data.rows) {
      const date = formatExportDate(`${row.sales_date}T00:00:00Z`, pdfContext);
      doc.text(`${date} | ${safe(row.erp_sales_no)} | ${safe(row.item_name || row.item_code)} | ${row.quantity ?? ''} | ${safe(formatExportAmount(Number(row.amount ?? 0), pdfContext))}`, { width:520 });
    }
    doc.moveDown();
    doc.text(`${l.total}: ${safe(formatExportAmount(Number(data.summary.totalAmount), pdfContext))}`, { align:'right' });
    doc.end();
    const buffer = await new Promise<Buffer>((resolve,reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const account = await this.db.query<{account_id:number}>(`SELECT TOP 1 account_id FROM crm_account WHERE company_id=@companyId AND public_id=@accountPublicId AND deleted_yn=0`, { companyId, accountPublicId });
    const accountId = account.recordset[0]?.account_id;
    let contractId:number|null = null;
    if (data.scope.type === 'CONTRACT' && data.scope.publicId) {
      const contract = await this.db.query<{contract_id:number}>(`SELECT TOP 1 contract_id FROM crm_contract WHERE company_id=@companyId AND account_id=@accountId AND public_id=@contractPublicId AND deleted_yn=0`, { companyId, accountId, contractPublicId:data.scope.publicId });
      contractId = contract.recordset[0]?.contract_id ?? null;
    }
    if (accountId) {
      await this.db.query(`INSERT INTO crm_statement_generation(company_id,account_id,contract_id,period_from,period_to,general_trade_yn,selected_sales_ids_json,file_name,line_count,total_amount,storage_status,generated_by)
        VALUES(@companyId,@accountId,@contractId,@from,@to,@general,@selected,@fileName,@lineCount,@totalAmount,'NOT_STORED',@userId)`, {
        companyId, accountId, contractId, from:data.period.from, to:data.period.to,
        general:data.scope.type === 'GENERAL' ? 1 : 0,
        selected:query.salesPublicIds?.length ? JSON.stringify(query.salesPublicIds) : null,
        fileName:filename, lineCount:data.summary.lineCount, totalAmount:data.summary.totalAmount, userId
      });
    }
    return { filename, buffer, locale:context.locale, pdfLocale };
  }
}
