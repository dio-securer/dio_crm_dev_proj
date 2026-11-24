const fs=require('fs');
let s=fs.readFileSync('scripts/admin-customization/lead-exclusion-tabs-browser.mjs','utf8');
s=s.replace("['normal','known-error','hidden-tab','disabled-section','readonly-field','denied-field','excluded-required','legacy']","['known-error']");
s=s.replace("await page.goto(`http://127.0.0.1:", "await page.addInitScript(() => localStorage.setItem('dio_crm_locale','en-US'));await page.goto(`http://127.0.0.1:");
s=s.replaceAll("\\uC0C1\\uC138","Details").replaceAll("\\uC800\\uC7A5","Save").replaceAll("\\uB2E4\\uC2DC \\uC2DC\\uB3C4","Retry").replaceAll("\\uC811\\uCD09 \\uC81C\\uC678","An exclusion reason is required");
s=s.replace("lead-exclusion-tabs-results.json","lead-exclusion-en-worker-b-results.json");
fs.writeFileSync('scripts/admin-customization/lead-exclusion-en-worker-b.mjs',s);
