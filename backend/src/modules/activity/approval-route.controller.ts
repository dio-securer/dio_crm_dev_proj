import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthenticatedRequest, AuthGuard, PermissionGuard, RequirePermission } from '../../security/security';
import { ApprovalRouteService } from './approval-route.service';

const schema = z.object({
  organizationPublicId: z.string().uuid(),
  approvalType: z.enum(['ACTIVITY_REPORT','DIRECT_WORK']),
  branchApproverPublicId: z.string().uuid(),
  divisionApproverPublicId: z.string().uuid(),
  isActive: z.boolean().optional()
});

@Controller('api/approval-routes/activity')
@UseGuards(AuthGuard, PermissionGuard)
export class ApprovalRouteController {
  constructor(private readonly service: ApprovalRouteService) {}

  @Get()
  @RequirePermission('APPROVAL.ROUTE.MANAGE')
  list(@Req() req: AuthenticatedRequest) {
    return this.service.list(req.authUser!.companyId);
  }

  @Post()
  @RequirePermission('APPROVAL.ROUTE.MANAGE')
  save(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.upsert(req.authUser!.companyId, schema.parse(body));
  }
}
