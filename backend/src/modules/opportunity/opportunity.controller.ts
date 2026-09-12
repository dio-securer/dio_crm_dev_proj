import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthenticatedRequest, AuthGuard, PermissionGuard, RequirePermission } from '../../security/security';
import { OpportunityService } from './opportunity.service';
import type { OpportunityStage } from './opportunity.rules';

const stageEnum = z.enum(['NEEDS_ANALYSIS','PROPOSAL','NEGOTIATION','CLOSED_WON','CLOSED_LOST']);
const createOpportunitySchema = z.object({
  accountPublicId: z.string().uuid(),
  opportunityName: z.string().min(1).max(200),
  recordType: z.enum(['NEW','EXISTING','RECONTRACT']).default('EXISTING'),
  ownerUserId: z.number().int().positive().optional(),
  expectedCloseDate: z.string().optional(),
  interestProduct: z.string().max(500).optional()
});
const updateOpportunitySchema = z.object({
  opportunityName: z.string().min(1).max(200).optional(),
  expectedCloseDate: z.string().nullable().optional(),
  successProbability: z.number().min(0).max(100).nullable().optional(),
  forecastCategory: z.enum(['PIPELINE','BEST_CASE','COMMIT','OMITTED']).nullable().optional(),
  interestProduct: z.string().max(500).nullable().optional(),
  specialTerms: z.string().max(4000).nullable().optional(),
  paymentMethod: z.string().max(100).nullable().optional(),
  paymentDate: z.string().nullable().optional(),
  installmentMonths: z.number().int().min(0).max(120).nullable().optional(),
  competitorUsage: z.string().max(2000).nullable().optional(),
  ownedEquipment: z.string().max(2000).nullable().optional(),
  treatmentFeeInfo: z.string().max(2000).nullable().optional()
});
const transitionSchema = z.object({ toStage: stageEnum, reason: z.string().max(1000).optional() });
const addProductSchema = z.object({
  packagePublicId: z.string().uuid(),
  quantity: z.number().int().positive().max(9999).default(1),
  proposedUnitPrice: z.number().nonnegative(),
  note: z.string().max(1000).optional()
});
const updateProductSchema = z.object({
  quantity: z.number().int().positive().max(9999).optional(),
  proposedUnitPrice: z.number().nonnegative().optional(),
  note: z.string().max(1000).nullable().optional()
});
const createCatalogSchema = z.object({
  itemType: z.enum(['PACKAGE','PRODUCT']),
  itemName: z.string().min(1).max(200),
  erpItemCode: z.string().max(80).optional(),
  category: z.string().max(100).optional(),
  basePrice: z.number().nonnegative().optional()
});

@Controller('api/opportunities')
@UseGuards(AuthGuard, PermissionGuard)
export class OpportunityController {
  constructor(private readonly service: OpportunityService) {}

  @Get('pipeline/funnel')
  @RequirePermission('PIPELINE.READ')
  funnel(@Req() req: AuthenticatedRequest, @Query('ownerUserId') ownerUserId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.pipeline(req.authUser!.companyId, ownerUserId ? Number(ownerUserId) : undefined, from, to);
  }

  @Get()
  @RequirePermission('OPPORTUNITY.READ')
  list(@Req() req: AuthenticatedRequest, @Query('stage') stage?: string, @Query('accountPublicId') accountPublicId?: string, @Query('search') search?: string) {
    return this.service.list(req.authUser!.companyId, stage, accountPublicId, search);
  }

  @Get(':publicId')
  @RequirePermission('OPPORTUNITY.READ')
  get(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string) {
    return this.service.get(req.authUser!.companyId, publicId);
  }

  @Post()
  @RequirePermission('OPPORTUNITY.WRITE')
  create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.create(req.authUser!.companyId, createOpportunitySchema.parse(body), req.authUser!.sub);
  }

  @Patch(':publicId')
  @RequirePermission('OPPORTUNITY.WRITE')
  update(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    return this.service.update(req.authUser!.companyId, publicId, updateOpportunitySchema.parse(body), req.authUser!.sub);
  }

  @Delete(':publicId')
  @RequirePermission('OPPORTUNITY.WRITE')
  archive(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string) {
    return this.service.archive(req.authUser!.companyId, publicId, req.authUser!.sub);
  }

  @Post(':publicId/stage')
  @RequirePermission('OPPORTUNITY.STAGE')
  transition(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    const input = transitionSchema.parse(body);
    return this.service.transition(req.authUser!.companyId, publicId, input.toStage as OpportunityStage, input.reason, req.authUser!.sub, req.authUser!.permissions);
  }

  @Post(':publicId/products')
  @RequirePermission('OPPORTUNITY.PRODUCT.WRITE')
  addProduct(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    return this.service.addProduct(req.authUser!.companyId, publicId, addProductSchema.parse(body), req.authUser!.sub);
  }

  @Patch(':publicId/products/:productPublicId')
  @RequirePermission('OPPORTUNITY.PRODUCT.WRITE')
  updateProduct(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Param('productPublicId') productPublicId: string, @Body() body: unknown) {
    return this.service.updateProduct(req.authUser!.companyId, publicId, productPublicId, updateProductSchema.parse(body), req.authUser!.sub);
  }

  @Delete(':publicId/products/:productPublicId')
  @RequirePermission('OPPORTUNITY.PRODUCT.WRITE')
  removeProduct(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Param('productPublicId') productPublicId: string) {
    return this.service.removeProduct(req.authUser!.companyId, publicId, productPublicId, req.authUser!.sub);
  }
}

@Controller('api/product-packages')
@UseGuards(AuthGuard, PermissionGuard)
export class ProductPackageController {
  constructor(private readonly service: OpportunityService) {}

  @Get()
  @RequirePermission('PRODUCT_PACKAGE.READ')
  list(@Req() req: AuthenticatedRequest, @Query('search') search?: string, @Query('itemType') itemType?: string) {
    return this.service.listCatalog(req.authUser!.companyId, search, itemType);
  }

  @Post()
  @RequirePermission('PRODUCT_PACKAGE.MANAGE')
  create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.createCatalog(req.authUser!.companyId, createCatalogSchema.parse(body), req.authUser!.sub);
  }
}
