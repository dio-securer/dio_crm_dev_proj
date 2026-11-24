import fs from 'node:fs';import '../hq-standard/register.mjs';
const {makeStandardArtifact}=await import('../../backend/src/customization/config-service.ts');
const base=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-file-review.json','utf8'));
const messages=JSON.parse(fs.readFileSync('scripts/admin-customization/runtime-error-translations.json','utf8'));
for(const [code,values] of Object.entries(messages))for(const [index,locale] of ['ko-KR','en-US'].entries())base.translations[locale]['customization.errors.'+code]=values[index];
base.catalog.standardReleaseId='HQ.I02.LOCALIZED.1';
fs.writeFileSync('packages/contracts/catalogs/hq-localized-review.json',JSON.stringify(makeStandardArtifact('hq.i02.localized.1',base.catalog,base.translations,false),null,2)+'\n');
