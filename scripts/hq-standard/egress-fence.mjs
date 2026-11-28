import {createRequire,syncBuiltinESMExports} from 'node:module';
/** Install only in the dedicated HQ server process, never in the legacy CRM host. */
export function installHqEgressFence() {
  let attempts = 0;
  const deny = () => {attempts++;throw new Error('HQ_MOCK_EXTERNAL_EGRESS_BLOCKED');};
  const require = createRequire(import.meta.url);
  for(const name of ['node:http','node:https']) {const module=require(name);module.request=deny;module.get=deny;}
  const net=require('node:net');net.connect=deny;net.createConnection=deny;net.Socket.prototype.connect=deny;
  const tls=require('node:tls');tls.connect=deny;
  globalThis.fetch = async()=>deny();
  syncBuiltinESMExports();
  return {attemptCount:()=>attempts};
}
