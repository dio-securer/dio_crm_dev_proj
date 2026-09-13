import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'frontend', 'src');
const findings = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.tsx$/.test(entry.name)) {
      const lines = fs.readFileSync(full,'utf8').split(/\r?\n/);
      lines.forEach((line,index) => {
        if (/[가-힣]/.test(line)) findings.push(`${path.relative(process.cwd(),full)}:${index+1}: ${line.trim().slice(0,180)}`);
      });
    }
  }
}
walk(root);
if (findings.length) {
  console.error('[i18n] hard-coded Korean UI text found outside locale resources:');
  findings.forEach(x => console.error(` - ${x}`));
  process.exit(1);
}
console.log('[i18n] hard-coded Korean TSX text check PASS');
