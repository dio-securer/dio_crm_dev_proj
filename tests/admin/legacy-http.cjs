const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const backendRequire=createRequire(require('node:path').resolve(__dirname,'../../backend/package.json'));
backendRequire('reflect-metadata');
process.env.NODE_ENV='test';
process.env.JWT_ACCESS_SECRET='legacy-test-access-key-not-production';
process.env.JWT_REFRESH_SECRET='legacy-test-refresh-key-not-production';
const {NestFactory}=backendRequire('@nestjs/core');
const {Module}=backendRequire('@nestjs/common');
const {JwtService}=backendRequire('@nestjs/jwt');
const bcrypt=backendRequire('bcryptjs');
const {AuthService}=require('../../backend/dist/src/modules/auth/auth.service');
const {AuthController}=require('../../backend/dist/src/modules/auth/auth.controller');
const {DatabaseService}=require('../../backend/dist/src/database/database.service');
test('T60 LEGACY HTTP login/refresh/logout preserves numeric claims with SQL stub',async()=>{
 const row={user_id:41,public_id:'20000000-0000-4000-8000-000000000041',login_id:'legacy-demo',user_name:'Legacy Demo',company_id:7,organization_id:8,password_hash:bcrypt.hashSync('fixture-password',4)};
 const tokens=[];
 const db={async query(sql,p){
  if(sql.includes('FROM crm_user\n'))return {recordset:[row]};
  if(sql.includes('SELECT r.role_code'))return {recordset:[{role_code:'SALES',data_scope:'SELF'}]};
  if(sql.includes('SELECT DISTINCT p.permission_code'))return {recordset:[{permission_code:'account.read'}]};
  if(sql.includes('INSERT INTO crm_refresh_token')){tokens.push({refresh_token_id:tokens.length+1,hash:p.hash,revoked:false});return {recordset:[]};}
  if(sql.includes('SELECT TOP 1 refresh_token_id'))return {recordset:tokens.filter(t=>!t.revoked&&t.hash===p.hash).slice(0,1)};
  if(sql.includes('UPDATE crm_refresh_token')){tokens.filter(t=>p.id?t.refresh_token_id===p.id:t.hash===p.hash).forEach(t=>t.revoked=true);return {recordset:[]};}
  throw new Error('Unexpected SQL in authentication contract');
 }};
 class LegacyTestModule{}
 Module({controllers:[AuthController],providers:[AuthService,JwtService,{provide:DatabaseService,useValue:db}]})(LegacyTestModule);
 const app=await NestFactory.create(LegacyTestModule,{logger:false});
 try {await app.listen(0,'127.0.0.1');const url=await app.getUrl();
  async function post(path,body){const r=await fetch(url+'/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
  const login=await post('login',{loginId:'legacy-demo',password:'fixture-password'});
  assert.equal(login.status,201);assert.equal(login.body.user.companyId,7);assert.equal(login.body.user.sub,41);
  const claims=await new JwtService().verifyAsync(login.body.accessToken,{secret:process.env.JWT_ACCESS_SECRET});
  assert.equal(claims.companyId,7);assert.equal(claims.sessionId,undefined);assert.equal(claims.tokenUse,undefined);
  const refreshed=await post('refresh',{refreshToken:login.body.refreshToken});assert.equal(refreshed.status,201);assert.equal(refreshed.body.user.companyId,7);
  assert.deepEqual((await post('logout',{refreshToken:refreshed.body.refreshToken})).body,{success:true});
  assert.equal((await post('refresh',{refreshToken:refreshed.body.refreshToken})).status,401);
 }finally{await app.close();}
});
