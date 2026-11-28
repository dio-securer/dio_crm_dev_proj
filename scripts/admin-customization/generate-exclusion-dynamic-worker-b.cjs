const fs=require('fs');
let s=fs.readFileSync('scripts/admin-customization/lead-exclusion-tabs-browser.mjs','utf8');
s=s.replace("['normal','known-error','hidden-tab','disabled-section','readonly-field','denied-field','excluded-required','legacy']","['dynamic']");
s=s.replace("new QueryClient({defaultOptions:{queries:{retry:false}}})","(window.__testQC=new QueryClient({defaultOptions:{queries:{retry:false}}}))");
s=s.replace("if(mode==='excluded-required'){await input.fill", "if(mode==='dynamic'){await input.fill('Unsaved reason');await page.evaluate(()=>window.__testQC.setQueriesData({queryKey:['effective-config']},old=>({...old,policy:old.policy.map(p=>p.id==='tab:HQ_LEAD.exclusions'?{...p,visible:false,enabled:false}:p)})));await dialog.getByRole('tab',{name:labels['tab:HQ_LEAD.basic']}).click();assert.equal(await dialog.getByRole('button',{name:'\\uC800\\uC7A5',exact:true}).isEnabled(),false);assert.equal(requests.length,0);}else if(mode==='excluded-required'){await input.fill");
s=s.replace("lead-exclusion-tabs-results.json","lead-exclusion-dynamic-worker-b-results.json");
fs.writeFileSync('scripts/admin-customization/lead-exclusion-dynamic-worker-b.mjs',s);
