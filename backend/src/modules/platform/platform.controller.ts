import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, AuthenticatedRequest, PermissionGuard, RequirePermission } from '../../security/security';
import { PlatformService } from './platform.service';

const fileSchema = z.object({
  entityType: z.string().min(1),
  entityPublicId: z.string().min(1),
  originalName: z.string().min(1),
  contentType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative(),
  storageKey: z.string().min(1)
});

@Controller('api')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('health')
  health() { return this.platform.health(); }

  @Get('users')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission('USER.READ')
  users(@Req() req: AuthenticatedRequest) { return this.platform.users(req.authUser!.companyId); }

  @Get('organizations')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission('ORG.READ')
  organizations(@Req() req: AuthenticatedRequest) { return this.platform.organizations(req.authUser!.companyId); }

  @Get('notifications')
  @UseGuards(AuthGuard)
  notifications(@Req() req: AuthenticatedRequest) { return this.platform.notifications(req.authUser!.sub); }

  @Get('audit-logs')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission('AUDIT.READ')
  audit(@Req() req: AuthenticatedRequest) { return this.platform.auditLogs(req.authUser!.companyId); }

  @Get('interface-logs')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission('INTERFACE.READ')
  interfaces(@Req() req: AuthenticatedRequest) { return this.platform.interfaceLogs(req.authUser!.companyId); }

  @Post('files/metadata')
  @UseGuards(AuthGuard)
  registerFile(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    return this.platform.registerFile(fileSchema.parse(body), req.authUser!.sub);
  }
}

@Controller('api/common-codes')
export class CommonCodeController {
  constructor(private readonly platform: PlatformService) {}

  @Get(':groupCode')
  @UseGuards(AuthGuard)
  list(@Param('groupCode') groupCode: string) {
    return this.platform.commonCodes(groupCode);
  }
}
