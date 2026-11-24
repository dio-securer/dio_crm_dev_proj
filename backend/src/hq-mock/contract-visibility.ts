import type { HqRouteContext } from './app.js';
import type { HqRow } from './model.js';
const amountFields = ['contract_amount', 'product_amount', 'goods_amount'];
function projectField(c: HqRouteContext, row: HqRow, db: string): unknown {
 const f=c.app.standardFor(c.actor).fields.find(field=>field.entity==='contract' && field.current.dbField===db);
 return f ? c.app.policyFor(c.actor).readField(f.fieldKey,c.app.context(c.actor,{...c.app.values(row),[f.fieldKey]:row[db]})) : undefined;
}
export function contractAmountsReadable(c: HqRouteContext,row:HqRow):boolean {
 return amountFields.every(db=>!Object.hasOwn(row,db) || projectField(c,row,db)===row[db]);
}
export function visibleContractFields(c:HqRouteContext,row:HqRow):HqRow {
 const result={...row};
 delete result.mock_files;
 for(const f of c.app.standardFor(c.actor).fields.filter(field=>field.entity==='contract' && field.current.dbField)) {
  const db=f.current.dbField!; if(!Object.hasOwn(row,db)) continue; const v=projectField(c,row,db); if(v===undefined) delete result[db]; else result[db]=v;
 }
 if(!contractAmountsReadable(c,row)) { for(const db of amountFields) delete result[db]; delete result.products; }
 return result;
}
