import {Controller,Get,Post,Req,Res,UseGuards,UseFilters} from '@nestjs/common';
import type {Response} from 'express';
import {AuthGuard,type AuthenticatedRequest} from '../security/security';
import {ConfigurationErrors,ConfigurationIdentity} from './config-http';
import {ConfiguredActivityReportGateway} from './activity-report-gateway';
/** New detail route. Existing report commands continue through the managed boundary. */
@Controller('api/activity-reports')
@UseGuards(AuthGuard)
@UseFilters(ConfigurationErrors)
export class ConfigurationActivityReportDetailController{
 constructor(private readonly gateway:ConfiguredActivityReportGateway,private readonly identity:ConfigurationIdentity){}
 @Get(':publicId')async detail(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){
  const actor=await this.identity.actor(req),result=await this.gateway.handle(req,actor,req.authUser!.sub);
  res.setHeader('X-Config-Release-Id',result.releaseId);res.setHeader('X-Config-Permission-Version',String(result.permissionVersion));return result.data;
 }
 @Post(':publicId/comment/:step')comment(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return this.detail(req,res);}
 @Post(':publicId/reject/:step')reject(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return this.detail(req,res);}
}
