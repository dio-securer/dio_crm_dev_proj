import {Body,Controller,Get,Headers,Inject,Module,Put,Query,Req,UseFilters,UseGuards} from '@nestjs/common';
import {JwtModule} from '@nestjs/jwt';
import {AuthGuard,type AuthenticatedRequest} from '../security/security';
import {DatabaseService} from '../database/database.service';
import {ConfigurationErrors,ConfigurationIdentity} from './config-http';
import {configAssert} from './config-store';
import {LogicDraftService} from './logic-draft';

/** No production storage or authority is installed until explicitly configured. */
export const LOGIC_DRAFT_PROVIDER=Symbol('LOGIC_DRAFT_PROVIDER');
@Controller('api/admin/logic-drafts')
@UseGuards(AuthGuard)
@UseFilters(ConfigurationErrors)
export class ConfigurationLogicDraftController {
 constructor(@Inject(LOGIC_DRAFT_PROVIDER) private readonly provider:LogicDraftService|null,private readonly identity:ConfigurationIdentity){}
 @Get() async read(@Req() req:AuthenticatedRequest,@Query() query:unknown){configAssert(this.provider,503,'LOGIC_DRAFT_UNAVAILABLE');const actor=await this.identity.actor(req);return this.provider.read(actor.id,query);}
 @Put() async save(@Req() req:AuthenticatedRequest,@Body() body:unknown,@Headers('idempotency-key') key:string){configAssert(this.provider,503,'LOGIC_DRAFT_UNAVAILABLE');const actor=await this.identity.actor(req);return this.provider.save(actor.id,body,key);}
}
@Module({imports:[JwtModule.register({})],controllers:[ConfigurationLogicDraftController],providers:[AuthGuard,DatabaseService,ConfigurationIdentity,{provide:LOGIC_DRAFT_PROVIDER,useValue:null}]})
export class LogicDraftModule {}
