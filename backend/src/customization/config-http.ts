import {Body,Controller,Get,Post,Patch,Param,Query,Headers,Req,UseGuards,UseFilters,Catch,ArgumentsHost,ExceptionFilter,Injectable,UnauthorizedException} from '@nestjs/common';
import {z,ZodError} from 'zod';
import {AuthGuard,type AuthenticatedRequest} from '../security/security';
import {DatabaseService} from '../database/database.service';
import {CompanyConfigurationService,type ConfigActor} from './config-service';
import {ConfigError,configAssert} from './config-store';
import {StandardPublicationService} from './standard-service';
const uuid=z.string().uuid().transform(s=>s.toLowerCase()),text=z.string().trim().min(1).max(2000),nullableId=uuid.nullable();
const revision=(value:unknown)=>{configAssert(typeof value==='string'&&/^"[1-9]\d*"$/.test(value),428,'IF_MATCH_REQUIRED');return z.number().int().positive().safe().parse(Number(value.slice(1,-1)));};
const context=z.object({companyId:uuid});
/** JWT identifies the user. Company membership/permissions are read again inside the configuration fence. */
@Injectable()
export class ConfigurationIdentity {
 constructor(private readonly db:DatabaseService){}
 async companies(req:AuthenticatedRequest,after:string|undefined,limit:number){
  const actor=await this.actor(req);const rows=await this.db.query<{public_id:string;company_name:string;payload_json:string}>(`SELECT TOP (@limit) CONVERT(varchar(36),c.public_id) public_id,c.company_name,m.payload_json FROM crm_config_membership m JOIN crm_user u ON u.user_id=m.user_id JOIN crm_company c ON c.company_id=m.company_id WHERE u.public_id=@userId AND u.is_active=1 AND u.deleted_yn=0 AND c.is_active=1 AND JSON_VALUE(m.payload_json,'$.active')='true' AND EXISTS(SELECT 1 FROM OPENJSON(m.payload_json,'$.permissions') WHERE value='config.read') AND NOT EXISTS(SELECT 1 FROM OPENJSON(m.payload_json,'$.denied') WHERE value='config.read') AND (@after IS NULL OR CONVERT(varchar(36),c.public_id)>@after) ORDER BY CONVERT(varchar(36),c.public_id)`,{userId:actor.id,after:after??null,limit});
  const candidates=rows.recordset.flatMap(row=>{const member=z.object({active:z.boolean(),permissions:z.array(z.string()),denied:z.array(z.string())}).safeParse(JSON.parse(row.payload_json));return member.success&&member.data.active&&member.data.permissions.includes('config.read')&&!member.data.denied.includes('config.read')?[{id:uuid.parse(row.public_id),name:row.company_name}]:[];});
  return {actorId:actor.id,candidates,nextCursor:rows.recordset.length===limit?rows.recordset.at(-1)!.public_id:null};
 }
 async actor(req:AuthenticatedRequest,companyId?:string):Promise<ConfigActor>{
  const auth=req.authUser;if(!auth||!Number.isSafeInteger(auth.sub)||typeof auth.publicId!=='string')throw new UnauthorizedException();
  const result=await this.db.query<{public_id:string;company_public_id:string}>(`SELECT CONVERT(varchar(36),u.public_id) public_id, CONVERT(varchar(36),c.public_id) company_public_id FROM crm_user u JOIN crm_company c ON c.company_id=u.company_id WHERE u.user_id=@userId AND u.public_id=@publicId AND u.is_active=1 AND u.deleted_yn=0 AND c.is_active=1`,{userId:auth.sub,publicId:uuid.parse(auth.publicId)});
  configAssert(result.recordset.length===1,401,'IDENTITY_DISABLED');const row=result.recordset[0];
  // Explicit cross-company administration still requires current target membership in the service.
  return {id:uuid.parse(row.public_id),companyId:companyId?uuid.parse(companyId):uuid.parse(row.company_public_id)};
 }
}
@Catch(ConfigError,ZodError)
export class ConfigurationErrors implements ExceptionFilter {
 catch(error:ConfigError|ZodError,host:ArgumentsHost){const status=error instanceof ConfigError?error.status:422;const code=error instanceof ConfigError?error.code:'INVALID_REQUEST';host.switchToHttp().getResponse().status(status).json({statusCode:status,code,messageKey:`customization.errors.${code}`,details:error instanceof ConfigError?error.details:null});}
}
@Controller('api/admin')
@UseGuards(AuthGuard)
@UseFilters(ConfigurationErrors)
export class ConfigurationController {
 constructor(private readonly service:CompanyConfigurationService,private readonly identity:ConfigurationIdentity){}
 @Get('companies') async companies(@Req() req:AuthenticatedRequest,@Query() query:unknown){const q=z.object({after:uuid.optional(),limit:z.coerce.number().int().min(1).max(100).default(50)}).strict().parse(query);const found=await this.identity.companies(req,q.after,q.limit),items=[];for(const candidate of found.candidates){try{await this.service.read({id:found.actorId,companyId:candidate.id});items.push(candidate);}catch(error){if(!(error instanceof ConfigError)||![401,403,404].includes(error.status))throw error;}}return {items,nextCursor:found.nextCursor&&items.length?items.at(-1)!.id:null};}
 @Get('config/drafts') async drafts(@Req() req:AuthenticatedRequest,@Query() query:unknown){const q=z.object({scope:z.literal('COMPANY'),scopeKey:uuid}).strict().parse(query);return this.service.read(await this.identity.actor(req,q.scopeKey));}
 @Get('catalogs') async catalog(@Req() req:AuthenticatedRequest,@Query() query:unknown){const q=context.extend({standardReleaseId:text}).strict().parse(query);return this.service.catalog(await this.identity.actor(req,q.companyId),q.standardReleaseId);}
 @Get('companies/:company/extension-fields') async extensionFields(@Req() req:AuthenticatedRequest,@Param('company') company:string){return this.service.leadExtensionCatalog(await this.identity.actor(req,company));}
 @Post('config/drafts') async create(@Req() req:AuthenticatedRequest,@Body() body:unknown,@Headers('idempotency-key') key:string){const b=context.extend({baseStandardReleaseId:text,expectedActiveReleaseId:nullableId}).strict().parse(body);return this.service.createDraft(await this.identity.actor(req,b.companyId),b.baseStandardReleaseId,b.expectedActiveReleaseId,key);}
 @Patch('config/drafts/:id') async save(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() body:unknown,@Headers('if-match') match:string,@Headers('idempotency-key') key:string){
  const patch=z.object({targetId:text,property:z.enum(['enabled','visible','readOnly','required','order','default','masking']),operation:z.enum(['set','reset']),value:z.union([z.string(),z.number().finite(),z.boolean(),z.null()]).optional()}).strict();
  const presentation=z.object({schemaVersion:z.literal(1),values:z.record(z.record(z.object({label:z.string().min(1).max(200).optional(),helpText:z.string().min(1).max(1000).optional()}).strict()))}).strict();
  const extensionPlacement=z.object({fieldId:uuid,definitionVersion:z.number().int().positive().safe(),createRegion:z.enum(['basic','keyman','hospital','exclusions']).optional(),detailRegion:z.enum(['basic','keyman','hospital','exclusions']).optional(),createOrder:z.number().int().min(0).max(100).optional(),detailOrder:z.number().int().min(0).max(100).optional(),visible:z.boolean(),readOnly:z.boolean(),required:z.boolean()}).strict();
  const extensionLayout=z.object({schemaVersion:z.literal(1),placements:z.array(extensionPlacement).max(100),listColumns:z.array(uuid).max(100)}).strict();
  const b=context.extend({patches:z.array(patch).max(5000),activeLocales:z.array(text).min(1).max(20),defaultLocale:text,translations:z.record(z.record(z.string().max(20000))),leadGridColumns:z.array(text).max(11).optional(),leadListOrder:z.array(text).max(19).optional(),leadExtensionLayout:extensionLayout.optional(),placementOrders:z.record(z.array(text).max(32)).optional(),placementPresentation:presentation.optional(),buttonPresentation:z.object({schemaVersion:z.literal(1),values:z.record(z.enum(['primary','secondary']).nullable())}).strict().nullable().optional(),popupPresentation:z.object({schemaVersion:z.literal(1),values:z.record(z.object({titles:z.record(z.string().min(1).max(200).nullable()).optional(),size:z.enum(['small','medium','large','full']).nullable().optional()}).strict().nullable())}).strict().nullable().optional(),leadColumnAlignments:z.object({schemaVersion:z.literal(1),values:z.record(z.enum(['start','center','end']).nullable())}).strict().nullable().optional(),leadColumnWidths:z.object({schemaVersion:z.literal(1),values:z.record(z.union([z.object({mode:z.literal('auto')}).strict(),z.object({mode:z.literal('min'),widthPx:z.number().int().min(80).max(600)}).strict(),z.null()]))}).strict().nullable().optional(),leadGrid:z.object({schemaVersion:z.literal(1),pageSize:z.union([z.literal(25),z.literal(50),z.literal(100)]).nullable().optional(),density:z.enum(['compact','default','comfortable']).nullable().optional(),defaultSort:z.object({fieldId:z.literal('lead.updatedAt'),direction:z.enum(['asc','desc'])}).strict().nullable().optional()}).strict().nullable().optional()}).strict().parse(body);
  return this.service.saveDraft(await this.identity.actor(req,b.companyId),uuid.parse(id),revision(match),b,key);
 }
 @Post('config/validate') async validate(@Req() req:AuthenticatedRequest,@Body() body:unknown){const b=context.extend({draftIds:z.tuple([uuid]),revisions:z.tuple([z.number().int().positive().safe()])}).strict().parse(body);return this.service.validate(await this.identity.actor(req,b.companyId),b.draftIds[0],b.revisions[0]);}
 @Post('config/preview') async preview(@Req() req:AuthenticatedRequest,@Body() body:unknown){const b=context.extend({validationId:uuid}).strict().parse(body);return this.service.preview(await this.identity.actor(req,b.companyId),b.validationId);}
 @Post('config/drafts/:id/abandon') async abandon(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() body:unknown,@Headers('if-match') match:string,@Headers('idempotency-key') key:string){const b=context.extend({reason:text}).strict().parse(body);return this.service.abandon(await this.identity.actor(req,b.companyId),uuid.parse(id),revision(match),b.reason,key);}
 @Post('config/drafts/:id/rebase') async rebase(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() body:unknown,@Headers('if-match') match:string,@Headers('idempotency-key') key:string){const b=context.extend({targetStandardReleaseId:text,resolutions:z.record(z.enum(['keep','drop'])).default({})}).strict().parse(body);return this.service.rebase(await this.identity.actor(req,b.companyId),uuid.parse(id),revision(match),b.targetStandardReleaseId,b.resolutions,key);}
 @Post('companies/:company/releases') async publish(@Req() req:AuthenticatedRequest,@Param('company') company:string,@Body() body:unknown,@Headers('idempotency-key') key:string){const b=z.object({validationId:uuid,expectedReleaseId:nullableId,reason:text}).strict().parse(body);return this.service.publish(await this.identity.actor(req,company),b.validationId,b.expectedReleaseId,b.reason,key);}
 /** Only an installed HQ authority can enable this route. The client cannot name fields,
  * definition versions, a HQ release or grant itself HQ publisher status. */
 @Post('companies/:company/releases/hq-extensions') async publishHqExtensions(@Req() req:AuthenticatedRequest,@Param('company') company:string,@Body() body:unknown,@Headers('idempotency-key') key:string){const b=z.object({validationId:uuid,expectedReleaseId:nullableId,reason:text}).strict().parse(body);return this.service.publishWithHqExtensions(await this.identity.actor(req,company),b.validationId,b.expectedReleaseId,b.reason,key);}
 @Get('companies/:company/releases') async releases(@Req() req:AuthenticatedRequest,@Param('company') company:string){const result=await this.service.read(await this.identity.actor(req,company));return {activeReleaseId:result.activeReleaseId,releases:result.releases};}
 @Get('companies/:company/releases/:id') async release(@Req() req:AuthenticatedRequest,@Param('company') company:string,@Param('id') id:string){return this.service.release(await this.identity.actor(req,company),uuid.parse(id));}
 @Post('companies/:company/members/:id/config-permissions') async permissions(@Req() req:AuthenticatedRequest,@Param('company') company:string,@Param('id') id:string,@Body() body:unknown,@Headers('idempotency-key') key:string){const member=z.object({active:z.boolean(),permissions:z.array(text).max(500),denied:z.array(text).max(500)}).strict().parse(body);return this.service.changeMember(await this.identity.actor(req,company),uuid.parse(id),member,key);}
 @Post('companies/:company/releases/:id/rollback') async rollback(@Req() req:AuthenticatedRequest,@Param('company') company:string,@Param('id') id:string,@Body() body:unknown,@Headers('idempotency-key') key:string){const b=z.object({targetReleaseId:uuid,expectedReleaseId:uuid,reason:text}).strict().parse(body);configAssert(uuid.parse(id)===b.expectedReleaseId,409,'RELEASE_CONFLICT');return this.service.restoreDraft(await this.identity.actor(req,company),b.targetReleaseId,b.expectedReleaseId,key,b.reason);}
}
@Controller('api/runtime')
@UseGuards(AuthGuard)
@UseFilters(ConfigurationErrors)
export class ConfigurationRuntimeController {
 constructor(private readonly service:CompanyConfigurationService,private readonly identity:ConfigurationIdentity){}
 @Get('effective-config') async effective(@Req() req:AuthenticatedRequest,@Query() query:unknown){const q=z.object({locale:text.optional()}).strict().parse(query);return this.service.effective(await this.identity.actor(req),q.locale);}
}
@Controller('api/admin/standards')
@UseGuards(AuthGuard)
@UseFilters(ConfigurationErrors)
export class StandardPublicationController {
 constructor(private readonly standards:StandardPublicationService,private readonly identity:ConfigurationIdentity){}
 @Get('releases') async history(@Req() req:AuthenticatedRequest){return this.standards.history((await this.identity.actor(req)).id);}
 @Post('releases') async publish(@Req() req:AuthenticatedRequest,@Body() body:unknown,@Headers('idempotency-key') key:string){const input=z.object({artifactId:text,expectedCatalogHead:text.nullable(),reason:text}).strict().parse(body);return this.standards.publish((await this.identity.actor(req)).id,input,key);}
}
