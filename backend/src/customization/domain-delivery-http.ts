import {Controller,Post,Param,Req,UseGuards,UseFilters} from '@nestjs/common';import {z} from 'zod';
import {AuthGuard,type AuthenticatedRequest} from '../security/security';import {ConfigurationErrors,ConfigurationIdentity} from './config-http';import {DomainDeliveryWorker} from './domain-delivery-worker';import {configAssert} from './config-store';
@Controller('api/config/runtime/deliveries')
@UseGuards(AuthGuard)
@UseFilters(ConfigurationErrors)
export class ConfigurationDeliveryController{
 constructor(private readonly worker:DomainDeliveryWorker,private readonly identity:ConfigurationIdentity){}
 @Post(':id/retry')async retry(@Req()req:AuthenticatedRequest,@Param('id')id:string){
  configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');z.object({}).strict().parse(req.body??{});
  return this.worker.retry(await this.identity.actor(req),z.string().uuid().parse(id).toLowerCase());
 }
}
