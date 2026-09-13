import type { GlobalizationContext } from '@dio-crm/contracts';

export type ExportLabels = {
  account:string; scope:string; period:string; date:string; type:string; reference:string;
  itemCode:string; itemName:string; quantity:string; amount:string; status:string; total:string;
  erpCustomer:string; erpSalesNo:string; statementTitle:string;
};

const ko: ExportLabels = {
  account:'거래처', scope:'범위', period:'기간', date:'일자', type:'구분', reference:'참조번호',
  itemCode:'품목코드', itemName:'품목명', quantity:'수량', amount:'금액', status:'상태', total:'합계',
  erpCustomer:'ERP 거래처', erpSalesNo:'ERP 매출번호', statementTitle:'DIO CRM 월합 거래명세서'
};
const en: ExportLabels = {
  account:'Account', scope:'Scope', period:'Period', date:'Date', type:'Type', reference:'Reference',
  itemCode:'Item Code', itemName:'Item Name', quantity:'Quantity', amount:'Amount', status:'Status', total:'Total',
  erpCustomer:'ERP Customer', erpSalesNo:'ERP Sales No', statementTitle:'DIO CRM Monthly Statement'
};

export function exportLabels(locale: string): ExportLabels {
  return locale.toLowerCase().startsWith('ko') ? ko : en;
}

export function formatExportAmount(amount: number, context: Pick<GlobalizationContext,'locale'|'currencyCode'>) {
  return new Intl.NumberFormat(context.locale, { style:'currency', currency:context.currencyCode }).format(amount);
}

export function formatExportDate(value: string | Date, context: Pick<GlobalizationContext,'locale'|'timezone'>) {
  return new Intl.DateTimeFormat(context.locale, { year:'numeric', month:'2-digit', day:'2-digit', timeZone:context.timezone }).format(new Date(value));
}
