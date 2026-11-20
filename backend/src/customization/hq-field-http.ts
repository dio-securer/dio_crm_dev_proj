import {Body,Controller,Get,Headers,Inject,Module,Post,Query,Req,UseFilters,UseGuards} from '@nestjs/common';
import {z} from 'zod';
import {JwtModule} from '@nestjs/jwt';
import {AuthGuard,type AuthenticatedRequest} from '../security/security';
import {DatabaseService} from '../database/database.service';
import {ConfigurationErrors,ConfigurationIdentity} from './config-http';
import {configAssert} from './config-store';
import {hqDefineInput,hqDistributeInput,type HqFieldWriter} from './hq-field-write';
export const HQ_FIELD_WRITER=Symbol('HQ_FIELD_WRITER');
@Controller('api/admin/hq/fields')
@UseGuards(AuthGuard)
@UseFilters(ConfigurationErrors)
export class HqFieldController {
 constructor(@Inject(HQ_FIELD_WRITER) private readonly writer:HqFieldWriter|null,private readonly identity:ConfigurationIdentity){}
 @Get() async read(@Req() req:AuthenticatedRequest,@Query() query:unknown){configAssert(this.writer,503,'HQ_FIELD_WRITER_UNAVAILABLE');const input=z.object({companyId:z.string().uuid().transform(v=>v.toLowerCase()).optional()}).strict().parse(query),actor=await this.identity.actor(req);return this.writer.read(actor.id,input.companyId);}
 @Post() async define(@Req() req:AuthenticatedRequest,@Body() body:unknown,@Headers('idempotency-key') key:string){configAssert(this.writer,503,'HQ_FIELD_WRITER_UNAVAILABLE');const input=hqDefineInput.parse(body),actor=await this.identity.actor(req);return this.writer.define(actor.id,input,key);}
 @Post('distributions') async distribute(@Req() req:AuthenticatedRequest,@Body() body:unknown,@Headers('idempotency-key') key:string){configAssert(this.writer,503,'HQ_FIELD_WRITER_UNAVAILABLE');const input=hqDistributeInput.parse(body),actor=await this.identity.actor(req);return this.writer.distribute(actor.id,input,key);}
}
/** Deployment must explicitly override the writer after reviewed schema installation. */
@Module({imports:[JwtModule.register({})],controllers:[HqFieldController],providers:[AuthGuard,DatabaseService,ConfigurationIdentity,{provide:HQ_FIELD_WRITER,useValue:null}]})
export class HqFieldWriteModule {}
