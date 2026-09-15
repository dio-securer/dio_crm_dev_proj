import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthenticatedRequest, AuthGuard, PermissionGuard, RequirePermission } from '../../security/security';
import { MarketFeatureGuard, RequireMarketFeature } from '../../globalization/feature.guard';
import { CustomerService } from './customer.service';
import type { LeadStatus } from './customer.rules';

const updateLeadSchema = z.object({
  hospitalName: z.string().min(1).optional(), phone: z.string().nullable().optional(), address: z.string().nullable().optional(),
  businessNo: z.string().nullable().optional(), keymanName: z.string().nullable().optional(), keymanType: z.string().nullable().optional(),
  keymanMobile: z.string().nullable().optional(), keymanEmail: z.string().nullable().optional(), school: z.string().nullable().optional(),
  cohort: z.string().nullable().optional(), major: z.string().nullable().optional(), mainSystem: z.string().nullable().optional(),
  subSystem: z.string().nullable().optional(), contactExcludeReason: z.string().nullable().optional()
});
const transitionSchema = z.object({
  toStatus: z.enum(['NEW','FIRST_VISIT','KEYMAN_MEETING','CONTACT_EXCLUDED','CONVERTED']), reason: z.string().optional()
});
const assignSchema = z.object({ ownerUserId: z.number().int().positive() });
const mergeSchema = z.object({ primaryPublicId: z.string().uuid(), duplicatePublicIds: z.array(z.string().uuid()).min(1).max(2) });
const accountWriteSchema = z.object({
  accountName: z.string().trim().min(1).max(300),
  businessNo: z.string().trim().max(20).nullable().optional(),
  businessName: z.string().trim().max(300).nullable().optional(),
  ceoName: z.string().trim().max(50).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  fax: z.string().trim().max(50).nullable().optional(),
  homepage: z.string().trim().max(100).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  addressLine1: z.string().trim().max(400).nullable().optional(),
  addressLine2: z.string().trim().max(400).nullable().optional(),
  hospitalAddress: z.string().trim().max(400).nullable().optional(),
  zipCode: z.string().trim().max(20).nullable().optional(),
  taxEmail: z.string().trim().max(100).nullable().optional(),
  providerNo: z.string().trim().max(50).nullable().optional(),
  encryptedProviderNo: z.string().trim().max(100).nullable().optional(),
  openDate: z.string().trim().max(10).nullable().optional(),
  doctorLicenseNo: z.string().trim().max(500).nullable().optional(),
  accountType: z.string().trim().max(20).nullable().optional(),
  accountStatus: z.enum(['ACTIVE', 'NEW', 'NON_TRADING', 'NON_TRADING_OPP', 'CHURN_RISK', 'CHURNED', 'CLOSED']).optional(),
  accountGrade: z.string().trim().max(30).nullable().optional(),
  erpTradeCode: z.string().trim().max(10).nullable().optional(),
  erpApprovalCode: z.string().trim().max(10).nullable().optional(),
  useYn: z.enum(['0', '1']).nullable().optional(),
  churnRiskYn: z.boolean().optional(),
  accountStatCode: z.enum(['0', '1', '2', '3']).nullable().optional()
});
const convertSchema = z.object({
  accountMode: z.enum(['NEW','EXISTING']), existingAccountPublicId: z.string().uuid().optional(), opportunityName: z.string().max(200).optional()
});
const hiraHospitalSchema = z.object({
  encryptedProviderNo: z.string().min(1), hospitalName: z.string().min(1), phone: z.string().optional(), address: z.string().optional(),
  sido: z.string().optional(), sigungu: z.string().optional(), eupmyeondong: z.string().optional(), latitude: z.number().optional(),
  longitude: z.number().optional(), providerNo: z.string().optional(), openDate: z.string().optional()
});
const hiraBatchSchema = z.object({ hospitals: z.array(hiraHospitalSchema).min(1).max(500) });

@Controller('api/leads')
@UseGuards(AuthGuard, PermissionGuard)
export class LeadController {
  constructor(private readonly customer: CustomerService) {}

  @Get()
  @RequirePermission('LEAD.READ')
  list(@Req() req: AuthenticatedRequest, @Query('ownerUserId') owner?: string, @Query('status') status?: string, @Query('search') search?: string) {
    return this.customer.listLeads(req.authUser!.companyId, owner ? Number(owner) : undefined, status, search);
  }

  @Get(':publicId')
  @RequirePermission('LEAD.READ')
  get(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string) {
    return this.customer.getLead(req.authUser!.companyId, publicId);
  }

  @Patch(':publicId')
  @RequirePermission('LEAD.WRITE')
  update(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    return this.customer.updateLead(req.authUser!.companyId, publicId, updateLeadSchema.parse(body), req.authUser!.sub, req.authUser!.permissions);
  }

  @Post(':publicId/status')
  @RequirePermission('LEAD.WRITE')
  status(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    const input = transitionSchema.parse(body);
    return this.customer.transitionLead(req.authUser!.companyId, publicId, input.toStatus as LeadStatus, input.reason, req.authUser!.sub, req.authUser!.permissions);
  }

  @Post(':publicId/assign-owner')
  @RequirePermission('LEAD.MANAGE')
  assign(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    const input = assignSchema.parse(body);
    return this.customer.assignOwner(req.authUser!.companyId, publicId, input.ownerUserId, req.authUser!.sub);
  }

  @Post(':publicId/convert')
  @RequirePermission('LEAD.CONVERT')
  convert(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    return this.customer.convertLead(req.authUser!.companyId, publicId, convertSchema.parse(body), req.authUser!.sub);
  }
}

@Controller('api/accounts')
@UseGuards(AuthGuard, PermissionGuard)
export class AccountController {
  constructor(private readonly customer: CustomerService) {}

  @Get()
  @RequirePermission('ACCOUNT.READ')
  list(@Req() req: AuthenticatedRequest, @Query('search') search?: string, @Query('scope') scope?: string) {
    return this.customer.listAccounts(req.authUser!.companyId, search, scope || 'managed', req.authUser!.sub);
  }

  @Get('duplicates/:businessNo')
  @RequirePermission('ACCOUNT.READ')
  duplicates(@Req() req: AuthenticatedRequest, @Param('businessNo') businessNo: string) {
    return this.customer.duplicateAccounts(req.authUser!.companyId, businessNo);
  }

  @Post('merge')
  @RequirePermission('ACCOUNT.MERGE')
  merge(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const input = mergeSchema.parse(body);
    return this.customer.mergeAccounts(req.authUser!.companyId, input.primaryPublicId, input.duplicatePublicIds, req.authUser!.sub);
  }

  @Post()
  @RequirePermission('ACCOUNT.WRITE')
  create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.customer.createAccount(req.authUser!.companyId, accountWriteSchema.parse(body), req.authUser!.sub);
  }

  @Get(':publicId')
  @RequirePermission('ACCOUNT.READ')
  get(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string) {
    return this.customer.getAccount(req.authUser!.companyId, publicId);
  }

  @Patch(':publicId')
  @RequirePermission('ACCOUNT.WRITE')
  update(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    return this.customer.updateAccount(
      req.authUser!.companyId,
      publicId,
      accountWriteSchema.partial().parse(body),
      req.authUser!.sub,
      req.authUser!.permissions
    );
  }
}

@Controller('api/integrations/hira')
@UseGuards(AuthGuard, PermissionGuard, MarketFeatureGuard)
@RequireMarketFeature('HIRA_IMPORT')
export class HiraController {
  constructor(private readonly customer: CustomerService) {}

  @Post('hospitals/import')
  @RequirePermission('HIRA.IMPORT')
  import(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.customer.importHira(req.authUser!.companyId, hiraBatchSchema.parse(body).hospitals);
  }
}
