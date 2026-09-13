import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthenticatedRequest, AuthGuard, PermissionGuard, RequirePermission } from '../../security/security';
import { MarketFeatureGuard, RequireMarketFeature } from '../../globalization/feature.guard';
import { ActivityService } from './activity.service';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const planSchema = z.object({
  relatedType: z.enum(['LEAD','ACCOUNT','OPPORTUNITY']),
  relatedPublicId: z.string().uuid(),
  plannedAt: z.string().min(16),
  visitPurpose: z.string().max(500).optional(),
  subject: z.string().max(200).optional(),
  directWorkType: z.enum(['DIRECT_WORK','DIRECT_LEAVE']).optional(),
  directWorkReason: z.string().max(500).optional()
});
const bulkPlanSchema = z.object({ plans: z.array(planSchema).min(1).max(100) });
const gpsSchema = z.object({
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  accuracyM: z.number().nonnegative().optional(), isMocked: z.boolean().optional()
});
const updateActivitySchema = z.object({ visitPurpose: z.string().max(500).optional(), consultationContent: z.string().max(10000).optional() });
const updateReportItemSchema = z.object({ visitPurpose: z.string().max(500).optional(), consultationContent: z.string().max(10000).optional() });
const approveSchema = z.object({ comment: z.string().max(1000).optional() });
const directDecisionSchema = z.object({ action: z.enum(['APPROVE','REJECT']), comment: z.string().max(1000).optional() });

@Controller('api/activities')
@UseGuards(AuthGuard, PermissionGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Post('plans')
  @RequirePermission('ACTIVITY.WRITE')
  createPlan(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.activity.createPlan(req.authUser!.companyId, req.authUser!.sub, planSchema.parse(body));
  }

  @Post('plans/bulk')
  @RequirePermission('ACTIVITY.WRITE')
  createPlans(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.activity.createPlans(req.authUser!.companyId, req.authUser!.sub, bulkPlanSchema.parse(body).plans);
  }

  @Get('calendar')
  @RequirePermission('ACTIVITY.READ')
  calendar(@Req() req: AuthenticatedRequest, @Query('from') from: string, @Query('to') to: string, @Query('ownerUserId') owner?: string) {
    return this.activity.calendar(
      req.authUser!.companyId,
      req.authUser!.sub,
      dateSchema.parse(from),
      dateSchema.parse(to),
      owner ? Number(owner) : undefined,
      req.authUser!.permissions
    );
  }

  @Get('map/today')
  @RequirePermission('ACTIVITY.READ')
  mapToday(@Req() req: AuthenticatedRequest, @Query('date') date: string, @Query('latitude') lat: string, @Query('longitude') lng: string, @Query('radiusKm') radius?: string) {
    return this.activity.mapToday(
      req.authUser!.companyId,
      req.authUser!.sub,
      dateSchema.parse(date),
      z.coerce.number().min(-90).max(90).parse(lat),
      z.coerce.number().min(-180).max(180).parse(lng),
      radius ? z.coerce.number().positive().max(50).parse(radius) : 10
    );
  }

  @Post(':publicId/check-in')
  @UseGuards(MarketFeatureGuard)
  @RequireMarketFeature('GPS_CHECKIN')
  @RequirePermission('ACTIVITY.CHECKIN')
  checkIn(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    return this.activity.checkIn(req.authUser!.companyId, publicId, req.authUser!.sub, gpsSchema.parse(body));
  }

  @Patch(':publicId')
  @RequirePermission('ACTIVITY.WRITE')
  update(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    return this.activity.updateActivity(req.authUser!.companyId, publicId, req.authUser!.sub, updateActivitySchema.parse(body));
  }

  @Post(':publicId/check-out')
  @RequirePermission('ACTIVITY.CHECKOUT')
  checkOut(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    return this.activity.checkOut(req.authUser!.companyId, publicId, req.authUser!.sub, gpsSchema.parse(body));
  }
}

@Controller('api/activity-reports')
@UseGuards(AuthGuard, PermissionGuard, MarketFeatureGuard)
@RequireMarketFeature('ACTIVITY_APPROVAL')
export class ActivityReportController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  @RequirePermission('ACTIVITY.REPORT')
  list(@Req() req: AuthenticatedRequest) {
    return this.activity.listReports(req.authUser!.companyId, req.authUser!.sub, req.authUser!.permissions);
  }

  @Post('prepare')
  @RequirePermission('ACTIVITY.REPORT')
  prepare(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const input = z.object({ reportDate: dateSchema }).parse(body);
    return this.activity.prepareReport(req.authUser!.companyId, req.authUser!.sub, input.reportDate);
  }

  @Patch(':publicId/items/:itemId')
  @RequirePermission('ACTIVITY.REPORT')
  updateItem(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Param('itemId') itemId: string, @Body() body: unknown) {
    return this.activity.updateReportItem(req.authUser!.companyId, publicId, Number(itemId), req.authUser!.sub, updateReportItemSchema.parse(body));
  }

  @Post(':publicId/request-approval')
  @RequirePermission('ACTIVITY.REPORT')
  request(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string) {
    return this.activity.requestReportApproval(req.authUser!.companyId, publicId, req.authUser!.sub);
  }

  @Post(':publicId/approve/branch')
  @RequirePermission('ACTIVITY.REPORT.APPROVE.BRANCH')
  approveBranch(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    return this.activity.approveReport(req.authUser!.companyId, publicId, req.authUser!.sub, 'BRANCH', approveSchema.parse(body).comment);
  }

  @Post(':publicId/approve/division')
  @RequirePermission('ACTIVITY.REPORT.APPROVE.DIVISION')
  approveDivision(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    return this.activity.approveReport(req.authUser!.companyId, publicId, req.authUser!.sub, 'DIVISION', approveSchema.parse(body).comment);
  }
}

@Controller('api/direct-work')
@UseGuards(AuthGuard, PermissionGuard, MarketFeatureGuard)
@RequireMarketFeature('DIRECT_WORK')
export class DirectWorkController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  @RequirePermission('DIRECT_WORK.READ')
  list(@Req() req: AuthenticatedRequest) {
    return this.activity.listDirectWorks(req.authUser!.companyId, req.authUser!.sub);
  }

  @Post(':publicId/request-approval')
  @RequirePermission('DIRECT_WORK.REQUEST')
  request(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string) {
    return this.activity.requestDirectWork(req.authUser!.companyId, publicId, req.authUser!.sub);
  }

  @Post(':publicId/decision/branch')
  @RequirePermission('DIRECT_WORK.APPROVE.BRANCH')
  branch(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    const input = directDecisionSchema.parse(body);
    return this.activity.decideDirectWork(req.authUser!.companyId, publicId, req.authUser!.sub, 'BRANCH', input.action, input.comment);
  }

  @Post(':publicId/decision/division')
  @RequirePermission('DIRECT_WORK.APPROVE.DIVISION')
  division(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    const input = directDecisionSchema.parse(body);
    return this.activity.decideDirectWork(req.authUser!.companyId, publicId, req.authUser!.sub, 'DIVISION', input.action, input.comment);
  }
}
