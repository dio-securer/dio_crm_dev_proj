import { Controller, Get, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthenticatedRequest, PermissionGuard, RequirePermission } from '../../security/security';
import { OpsService } from './ops.service';

@Controller('api/health')
export class HealthController {
  constructor(private readonly ops: OpsService) {}

  @Get('live')
  live() { return this.ops.live(); }

  @Get('ready')
  async ready() {
    const result = await this.ops.ready();
    if (result.status !== 'ready') throw new ServiceUnavailableException(result);
    return result;
  }
}

@Controller('api/ops')
@UseGuards(AuthGuard, PermissionGuard)
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get('status')
  @RequirePermission('OPS.READ')
  status(@Req() req: AuthenticatedRequest) {
    return this.ops.status(req.authUser!.companyId);
  }
}
