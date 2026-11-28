import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const directory=fileURLToPath(new URL('.',import.meta.url));
const scripts=readdirSync(directory).filter(p=>/^h0[2-7]-browser\.mjs$/.test(p)).sort();
if(!scripts.length)throw new Error('No HQ browser acceptance scripts registered');
for(const script of scripts){
  const result=spawnSync(process.execPath,['--experimental-strip-types',directory+script],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
}
