import {Injectable} from '@nestjs/common';import {CompanyConfigurationService,type ConfigActor} from './config-service';import type {AuthenticatedRequest} from '../security/security';
import {requestConfiguredErpAccount} from './erp-account-command';import {requestConfiguredErpContract} from './erp-contract-command';
@Injectable()
export class ConfiguredErpRequestGateway{
 constructor(private readonly service:CompanyConfigurationService){}
 handle(req:AuthenticatedRequest,actor:ConfigActor,userKey:number){return req.path.startsWith('/api/erp-accounts/')?requestConfiguredErpAccount(this.service,req,actor,userKey):requestConfiguredErpContract(this.service,req,actor,userKey);}
}
