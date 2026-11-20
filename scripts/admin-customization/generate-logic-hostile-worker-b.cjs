const fs=require('fs');
let s=fs.readFileSync('scripts/admin-customization/logic-draft-ui-browser.mjs','utf8');
const harmless='window.__LOGIC_SHOULD_NOT_EXECUTE = 1;';
const hostile='</textarea><img src=x onerror=window.__LOGIC_SHOULD_NOT_EXECUTE=1><script>window.__LOGIC_SHOULD_NOT_EXECUTE=2</script>';
if(!s.includes(harmless))throw Error('fixture changed');
s=s.replaceAll(harmless,hostile);
fs.writeFileSync('scripts/admin-customization/logic-hostile-worker-b.mjs',s);
