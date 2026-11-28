const fs=require('fs');
let s=fs.readFileSync('scripts/admin-customization/logic-draft-ui-browser.mjs','utf8');
const marker="  await details.getByRole('button',{name:'같은 요청 다시 시도'}).click();";
if(!s.includes(marker))throw Error('fixture changed');
s=s.replace(marker,"  const tenant=page.getByLabel('법인',{exact:true});assert.equal(await tenant.isDisabled(),true,'uncertain request must block tenant switch');await tenant.evaluate((el,b)=>{el.value=b;el.dispatchEvent(new Event('change',{bubbles:true}));},B);assert.equal(await tenant.inputValue(),A,'programmatic change cannot discard pending retry');\n"+marker);
fs.writeFileSync('scripts/admin-customization/logic-pending-worker-b.mjs',s);
