/** Explicit HQ-only HTTP host. No SQL, ERP, HIRA, mail or map network adapter is loaded. */
import {createServer} from 'node:http';
import {existsSync,readFileSync,writeFileSync,renameSync,mkdirSync,unlinkSync,statSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {createHqApplication,HqRepository} from './runtime.mjs';
import {installHqEgressFence} from './egress-fence.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
export async function startHqServer(options = {}) {
  const host = options.host ?? '127.0.0.1';
  if(!['127.0.0.1','localhost','::1'].includes(host)) throw new Error('HQ mock host must be loopback; this service is a local mock, not production authentication');
  const storageDir = options.storageDir === false ? undefined : path.resolve(options.storageDir ?? path.join(repoRoot,'backend/.hq-mock'));
  const dist = path.resolve(options.dist ?? path.join(repoRoot,'frontend/dist'));
  const repositoryFactory = datasetId => {
    if(!storageDir) return new HqRepository({datasetId});
    mkdirSync(storageDir,{recursive:true});
    const file = path.join(storageDir,`${datasetId}.json`);
    return new HqRepository({datasetId,load:()=>existsSync(file) ? JSON.parse(readFileSync(file,'utf8')) : undefined,save:dataset=>{
      const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`;
      try {writeFileSync(temporary,JSON.stringify(dataset),{encoding:'utf8',mode:0o600});renameSync(temporary,file);}
      finally {if(existsSync(temporary))unlinkSync(temporary);}
    }});
  };
  const app = createHqApplication({repositoryFactory,storageLifetime:storageDir ? 'FILE':'PROCESS',...options.application});
  const errors = [];
  const server = createServer(async(req,res)=>{
    res.setHeader('X-HQ-Mock','true');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    try {
      const authority = req.headers.host ?? '';
      if(!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(authority)) {res.writeHead(403);res.end('HQ_HOST_NOT_ALLOWED');return;}
      if(req.headers.origin && req.headers.origin !== `http://${authority}`) {res.writeHead(403);res.end('HQ_ORIGIN_NOT_ALLOWED');return;}
      const url = new URL(req.url ?? '/','http://hq.invalid');
      if(url.pathname.startsWith('/api/')) {
        let bytes = 0;const chunks=[];
        for await(const chunk of req) {bytes += chunk.length;if(bytes>1024*1024)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{statusCode:413});chunks.push(chunk);}
        const raw = Buffer.concat(chunks).toString('utf8');let body;
        if(raw){if(!String(req.headers['content-type'] ?? '').startsWith('application/json'))throw Object.assign(new Error('JSON_REQUIRED'),{statusCode:415});try{body=JSON.parse(raw);}catch{throw Object.assign(new Error('INVALID_JSON'),{statusCode:400});}}
        const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
        const headers = Object.fromEntries(Object.entries(req.headers).map(([key,value])=>[key,Array.isArray(value) ? value[0]:value]));
        const result = await app.handle({method:req.method ?? 'GET',path:req.url,token,headers,body});
        for(const [key,value] of Object.entries(result.headers ?? {})) res.setHeader(key,value);
        res.statusCode=result.status;
        if(result.body instanceof Uint8Array){res.end(result.body);}else {res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(result.body));}
        if(options.autoAdvance !== false && result.status < 400) setImmediate(()=>{
          for(const id of options.application?.datasetIds ?? ['HQ_DEMO','HQ_OTHER']) {
            try {app.flushReady(id);}catch(error){errors.push(error.message);console.error('[HQ mock adapter]',error.message);}
          }
        });
        return;
      }
      if(req.method !== 'GET' && req.method !== 'HEAD'){res.writeHead(405);res.end();return;}
      const requested = decodeURIComponent(url.pathname);
      const asset = path.resolve(dist,`.${requested}`);
      if(asset !== dist && !asset.startsWith(`${dist}${path.sep}`)){res.writeHead(403);res.end();return;}
      let file = existsSync(asset) && statSync(asset).isFile() ? asset : path.join(dist,'index.html');
      if(!existsSync(file)){res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});res.end('HQ API is ready. Run pnpm build before opening the HQ interface.');return;}
      const ext = path.extname(file);res.setHeader('Content-Type',types[ext] ?? 'application/octet-stream');
      let content = readFileSync(file);
      if(ext === '.html')content=Buffer.from(content.toString('utf8').replace('</head>','<script>window.__DIO_CRM_HQ_MOCK__=true;</script></head>'));
      res.end(req.method === 'HEAD' ? undefined:content);
    }catch(error){res.statusCode=error.statusCode ?? 500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({statusCode:res.statusCode,error:'HQ_HTTP_ERROR',message:error.message,mode:'MOCK'}));}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(options.port ?? 3210,host,resolve);});
  const address = server.address();
  return {app,server,errors,url:`http://${host === '::1' ? '[::1]':host}:${address.port}`,close:()=>new Promise((resolve,reject)=>server.close(error=>error ? reject(error):resolve()))};
}
if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const fence=installHqEgressFence();
  const runtime = await startHqServer({port:Number(process.env.HQ_MOCK_PORT ?? 3210),storageDir:process.env.HQ_MOCK_STORAGE_DIR,application:{outboundAttemptCount:fence.attemptCount}});
  console.log(`HQ MOCK: ${runtime.url}/?hq=1 — persisted isolated dataset; real ERP/SQL/HIRA/mail/map disconnected`);
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{runtime.server.close();});
}
