import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthenticatedRequest, AuthGuard, PermissionGuard, RequirePermission } from '../../security/security';
import { MarketFeatureGuard, RequireMarketFeature } from '../../globalization/feature.guard';
import { ContractService } from './contract.service';

const collectionPlanRow = z.object({
  installmentNo: z.number().int().positive(),
  collectionMethod: z.string().min(1).max(100),
  amount: z.number().positive(),
  plannedDate: z.string().min(8).max(30)
});
const contractCreate = z.object({
  opportunityPublicId: z.string().uuid(),
  contractName: z.string().min(1).max(200).optional(),
  contractDate: z.string().optional(),
  productAmount: z.number().nonnegative().optional(),
  goodsAmount: z.number().nonnegative().optional(),
  packageClassification: z.string().max(100).optional(),
  specialTerms: z.string().max(4000).optional()
}).refine(v => v.productAmount !== undefined || v.goodsAmount !== undefined, 'productAmount or goodsAmount is required');
const planSchema = z.object({ rows: z.array(collectionPlanRow).min(1).max(60) });
const accountResultSchema = z.object({
  accountPublicId: z.string().uuid(), success: z.boolean(), erpCustomerCode: z.string().max(80).optional(), requestId: z.string().uuid().optional(), message: z.string().max(2000).optional()
});
const contractResultSchema = z.object({
  contractPublicId: z.string().uuid(), success: z.boolean(), erpContractNo: z.string().max(80).optional(), requestId: z.string().uuid().optional(), message: z.string().max(2000).optional()
});
const collectionIngestSchema = z.object({
  contractPublicId: z.string().uuid(),
  rows: z.array(z.object({ erpCollectionNo: z.string().min(1).max(100), amount: z.number().positive(), collectedAt: z.string().min(8).max(40) })).min(1).max(500)
});

@Controller('api/contracts')
@UseGuards(AuthGuard, PermissionGuard)
export class ContractController {
  constructor(private readonly service: ContractService) {}

  @Get()
  @RequirePermission('CONTRACT.READ')
  list(@Req() req: AuthenticatedRequest, @Query('accountPublicId') accountPublicId?: string, @Query('status') status?: string) {
    return this.service.list(req.authUser!.companyId, accountPublicId, status);
  }

  @Get(':publicId')
  @RequirePermission('CONTRACT.READ')
  get(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string) {
    return this.service.get(req.authUser!.companyId, publicId);
  }

  @Post()
  @RequirePermission('CONTRACT.WRITE')
  create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const input = contractCreate.parse(body);
    const { opportunityPublicId, ...contract } = input;
    return this.service.create(req.authUser!.companyId, opportunityPublicId, contract, req.authUser!.sub);
  }

  @Post(':publicId/collection-plans')
  @RequirePermission('COLLECTION.PLAN.WRITE')
  replaceInitialPlan(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    const input = planSchema.parse(body);
    return this.service.replaceInitialPlan(req.authUser!.companyId, publicId, input.rows, req.authUser!.sub);
  }

  @Post(':publicId/erp-request')
  @RequirePermission('CONTRACT.ERP_REQUEST')
  requestErp(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string) {
    return this.service.requestErpContract(req.authUser!.companyId, publicId, req.authUser!.sub);
  }

  @Get(':publicId/collections')
  @RequirePermission('COLLECTION.READ')
  collections(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string) {
    return this.service.collections(req.authUser!.companyId, publicId);
  }

  @Get(':publicId/reconciliation')
  @RequirePermission('COLLECTION.READ')
  reconciliation(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string) {
    return this.service.reconciliation(req.authUser!.companyId, publicId);
  }

  @Post(':publicId/collection-plans/change')
  @RequirePermission('COLLECTION.PLAN.WRITE')
  changePlan(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    const input = planSchema.parse(body);
    return this.service.changePlan(req.authUser!.companyId, publicId, input.rows, req.authUser!.sub);
  }
}

@Controller('api/erp-accounts')
@UseGuards(AuthGuard, PermissionGuard, MarketFeatureGuard)
@RequireMarketFeature('ERP_ACCOUNT_APPROVAL')
export class ErpAccountController {
  constructor(private readonly service: ContractService) {}

  @Post(':accountPublicId/request')
  @RequirePermission('ERP_ACCOUNT.REQUEST')
  request(@Req() req: AuthenticatedRequest, @Param('accountPublicId') accountPublicId: string) {
    return this.service.requestErpAccount(req.authUser!.companyId, accountPublicId, req.authUser!.sub);
  }
}

@Controller('api/erp-results')
@UseGuards(AuthGuard, PermissionGuard)
export class ErpResultController {
  constructor(private readonly service: ContractService) {}

  @Post('account')
  @RequirePermission('INTEGRATION.RESULT.WRITE')
  account(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.applyErpAccountResult(req.authUser!.companyId, accountResultSchema.parse(body));
  }

  @Post('contract')
  @RequirePermission('INTEGRATION.RESULT.WRITE')
  contract(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.applyErpContractResult(req.authUser!.companyId, contractResultSchema.parse(body));
  }

  @Post('collections')
  @RequirePermission('INTEGRATION.RESULT.WRITE')
  collections(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const input = collectionIngestSchema.parse(body);
    return this.service.ingestCollections(req.authUser!.companyId, input.contractPublicId, input.rows);
  }
}
