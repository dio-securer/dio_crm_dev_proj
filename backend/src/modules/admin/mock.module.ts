import {Module,Controller,Post,Get,Patch,Body,Headers,Param,Req} from '@nestjs/common';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {assert,canonical,createDraft,updateDraft} from '@dio-crm/contracts/admin';
import {MemoryAdminRepository} from './memory.repository';
import {MockAuth} from './mock-auth';
@Controller('api')
class MockController {
 constructor(private readonly auth:MockAuth,private readonly repo:MemoryAdminRepository){}
 @Post('auth/login') login(@Body() body:unknown){const b=z.object({homeCompanyCode:z.string().optional(),loginId:z.string(),password:z.string()}).strict().parse(body);return this.auth.login(b.homeCompanyCode,b.loginId,b.password)}
 @Post('auth/refresh') refresh(@Body() body:unknown){return this.auth.refresh(z.object({refreshToken:z.string()}).strict().parse(body).refreshToken)}
 @Post('auth/logout') async logout(@Headers('authorization') header:string){const s=await this.auth.authenticate(header);this.auth.sessions.revoke(s.id);return {success:true}}
 @Get('me/context') async context(@Headers('authorization') header:string){const s=await this.auth.authenticate(header);return {executionMode:'API_MOCK',adminContext:{companyId:s.companyId,membershipId:s.membershipId,permissionVersion:s.permissionVersion}}}
 @Get('admin/companies') async companies(@Headers('authorization') header:string){const s=await this.auth.authenticate(header),snap=await this.repo.snapshot();return {items:Object.values(snap.collections.companies).filter(c=>c.id===s.companyId),page:1,pageSize:20,total:1,requestId:randomUUID()}}
 @Get('admin/config/drafts') async drafts(@Headers('authorization') header:string){const actor=await this.auth.authenticate(header);assert(actor.role==='COMPANY_ADMIN',403,'FORBIDDEN');const snap=await this.repo.snapshot();const items=Object.values(snap.collections.drafts??{}).filter(row=>row.companyId===actor.companyId);return {items,total:items.length,page:1,pageSize:20,requestId:randomUUID()}}
 @Post('admin/config/drafts') async create(@Headers('authorization') header:string,@Headers('idempotency-key') key:string,@Body() body:unknown){const s=await this.auth.authenticate(header);return createDraft(this.repo,this.actor(s),body,this.meta('POST','/api/admin/config/drafts',body,key));}
 @Patch('admin/config/drafts/:id') async update(@Headers('authorization') header:string,@Headers('if-match') match:string,@Headers('idempotency-key') key:string,@Param('id') id:string,@Body() body:unknown){const s=await this.auth.authenticate(header);return updateDraft(this.repo,this.actor(s),id,body,match,this.meta('PATCH','/api/admin/config/drafts/'+id,body,key));}
 private actor(s:any){return {userId:s.userId,companyId:s.companyId,platformAdmin:false,canConfigure:s.role==='COMPANY_ADMIN'};}
 private meta(method:string,path:string,body:unknown,key:string){return {key,hash:createHash('sha256').update(canonical({method,path,body})).digest('hex'),id:randomUUID(),requestId:randomUUID()};}
}
@Module({controllers:[MockController],providers:[MockAuth,{provide:MemoryAdminRepository,useFactory:()=>new MemoryAdminRepository()}]})
export class MockAppModule {}
