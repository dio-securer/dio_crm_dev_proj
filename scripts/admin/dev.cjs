const {spawn}=require('node:child_process');const crypto=require('node:crypto');
const mode=process.argv[2];if(!['api','web','browser'].includes(mode))throw Error('Expected api, web or browser');
const env={...process.env};let args,cwd=process.cwd();if(mode==='api'){env.CRM_EXECUTION_MODE='API_MOCK';env.CRM_MOCK_JWT_SECRET ||= crypto.randomBytes(32).toString('hex');args=['backend/dist/src/mock-main.js'];}else{env.VITE_CRM_EXECUTION_MODE=mode==='web'?'API_MOCK':'BROWSER_MOCK';cwd+='/frontend';args=['node_modules/vite/bin/vite.js','--host','127.0.0.1'];}
const child=spawn(process.execPath,args,{cwd,env,stdio:'inherit'});child.on('exit',code=>process.exitCode=code??1);process.on('SIGTERM',()=>child.kill());process.on('SIGINT',()=>child.kill());
