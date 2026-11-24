import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from '../../frontend/node_modules/typescript/lib/typescript.js';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const baseline=JSON.parse(fs.readFileSync(path.join(root,'docs/admin-platform/customization/evidence/baseline.json'),'utf8'));
const rows=[];
const phase=file=>/HqH06|order-routes|analytics-routes/.test(file)?'I07':/HqSales|sales-routes/.test(file)?'I06':/HqActivity|activity-routes/.test(file)?'I05':/HqH07|hq-mock\/app/.test(file)?'I08':/HqLead|HqAccount|customer-|AccountsPage/.test(file)?'I04':'I03';
for(const {file} of baseline.baseline.sourceHashes.filter(x=>/\.(tsx?|mjs)$/.test(x.file))){
 const text=fs.readFileSync(path.join(root,file),'utf8');const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const visit=node=>{
  if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isJsxText(node)||ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node))&&/[가-힣]/.test(node.text)){
   const original=node.text.trim();if(original){const line=source.getLineAndCharacterOfPosition(node.getStart(source)).line+1;const template=ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node);
    const sample=/\/seed\.|\.test\.|\.spec\.|account-sandbox/.test(file);const metadata=/hq-standard-registry|hq-runtime-standard|screen-profile|account-interface|^scripts\//.test(file);
    const kind=sample?'SAMPLE_DATA':metadata?'REGISTRY_LABEL_OR_NOTE':template?'TEMPLATE_FRAGMENT':'TEXT_LITERAL';
    const digest=crypto.createHash('sha256').update(original).digest('hex').slice(0,16);
    rows.push({sourceId:`${file}:${node.getStart(source)}`,file,line,original,translationKey:`customization.source.${digest}`,kind,followup:phase(file),handling:sample?'Preserve synthetic business data; not translate stored user values':metadata?'Resolve catalog labels via stable IDs; notes remain developer evidence':template?'Replace complete template with locale formatting/interpolated key; do not translate fragment alone':'Replace display literal with translation key; persisted codes retain original code and get translated label',status:sample||metadata?'CLASSIFIED_SOURCE':'RUNTIME_REPLACEMENT_REQUIRED'});
   }
  }
  ts.forEachChild(node,visit);
 };visit(source);
}
const hardcoded=baseline.hardcodedKorean.map(row=>({file:row.file,line:row.line,source:row.excerpt,literals:rows.filter(x=>x.file===row.file&&x.line===row.line).map(x=>x.sourceId),handling:rows.some(x=>x.file===row.file&&x.line===row.line)?'LITERAL_KEYS_ASSIGNED':'FORMAT_OR_CODE_LINE_REVIEW_REQUIRED',followup:phase(row.file)}));
const out={stage:'I01-C',scope:'Source-to-key inventory; not runtime translation acceptance',rows,hardcodedLines:hardcoded,untranslatedUnique:[...new Set(rows.filter(x=>x.status==='RUNTIME_REPLACEMENT_REQUIRED').map(x=>x.original))]};
fs.writeFileSync(path.join(root,'docs/admin-platform/customization/implementation/evidence/I01/translation-inventory.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({occurrences:rows.length,hardcodedLines:hardcoded.length,runtimeStrings:out.untranslatedUnique.length}));
