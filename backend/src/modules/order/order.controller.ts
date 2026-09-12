import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthenticatedRequest, AuthGuard, PermissionGuard, RequirePermission } from '../../security/security';
import { OrderService } from './order.service';

const createDraftSchema = z.object({ contractPublicId: z.string().uuid() });
const addItemSchema = z.object({ productPublicId: z.string().uuid(), quantity: z.number().int().positive().max(9999), unitPrice: z.number().nonnegative().optional() });
const deliverySchema = z.object({
  deliveryAddressType: z.enum(['ACCOUNT','DIRECT']),
  deliveryAddress: z.string().max(500).nullable().optional(),
  expressYn: z.boolean().optional(),
  note: z.string().max(2000).nullable().optional()
});
const orderResultSchema = z.object({
  orderPublicId: z.string().uuid(), success: z.boolean(), erpOrderNo: z.string().max(100).optional(), status: z.string().max(50).optional(),
  requestId: z.string().uuid().optional(), message: z.string().max(2000).optional()
});
const deliveriesSchema = z.object({ rows: z.array(z.object({
  orderPublicId: z.string().uuid(), erpDeliveryNo: z.string().min(1).max(100), deliveryStatus: z.string().min(1).max(50),
  shippedAt: z.string().optional(), deliveredAt: z.string().optional(), payload: z.unknown().optional()
})).min(1).max(500) });
const salesSchema = z.object({ rows: z.array(z.object({
  accountPublicId: z.string().uuid(), erpSalesNo: z.string().min(1).max(100), salesDate: z.string().min(8).max(30), amount: z.number(),
  contractPublicId: z.string().uuid().optional(), orderPublicId: z.string().uuid().optional(), itemCode: z.string().max(80).optional(),
  itemName: z.string().max(200).optional(), quantity: z.number().optional(), payload: z.unknown().optional()
})).min(1).max(1000) });
const returnExchangeSchema = z.object({ rows: z.array(z.object({
  erpReferenceNo: z.string().min(1).max(100), transactionType: z.enum(['RETURN','EXCHANGE']), status: z.string().min(1).max(50),
  orderPublicId: z.string().uuid().optional(), erpSalesNo: z.string().max(100).optional(), itemCode: z.string().max(80).optional(),
  quantity: z.number().optional(), processedAt: z.string().optional(), payload: z.unknown().optional()
})).min(1).max(1000) });

@Controller('api/order-products')
@UseGuards(AuthGuard, PermissionGuard)
export class OrderProductController {
  constructor(private readonly service: OrderService) {}

  @Get()
  @RequirePermission('PRODUCT_ORDER.READ')
  search(@Req() req: AuthenticatedRequest, @Query('search') search?: string, @Query('itemType') itemType?: string) {
    return this.service.searchProducts(req.authUser!.companyId, search, itemType);
  }
}

@Controller('api/orders')
@UseGuards(AuthGuard, PermissionGuard)
export class OrderController {
  constructor(private readonly service: OrderService) {}

  @Get('eligible-contracts')
  @RequirePermission('ORDER.READ')
  eligibleContracts(@Req() req: AuthenticatedRequest) {
    return this.service.eligibleContracts(req.authUser!.companyId);
  }

  @Get()
  @RequirePermission('ORDER.READ')
  list(@Req() req: AuthenticatedRequest, @Query('status') status?: string, @Query('accountPublicId') accountPublicId?: string) {
    return this.service.list(req.authUser!.companyId, status, accountPublicId);
  }

  @Post()
  @RequirePermission('ORDER.WRITE')
  create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const input = createDraftSchema.parse(body);
    return this.service.createDraft(req.authUser!.companyId, input.contractPublicId, req.authUser!.sub);
  }

  @Get(':publicId')
  @RequirePermission('ORDER.READ')
  get(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string) {
    return this.service.get(req.authUser!.companyId, publicId);
  }

  @Post(':publicId/items')
  @RequirePermission('ORDER.WRITE')
  addItem(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    return this.service.addItem(req.authUser!.companyId, publicId, addItemSchema.parse(body), req.authUser!.sub);
  }

  @Delete(':publicId/items/:itemPublicId')
  @RequirePermission('ORDER.WRITE')
  removeItem(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Param('itemPublicId') itemPublicId: string) {
    return this.service.removeItem(req.authUser!.companyId, publicId, itemPublicId);
  }

  @Patch(':publicId/delivery')
  @RequirePermission('ORDER.WRITE')
  delivery(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string, @Body() body: unknown) {
    return this.service.updateDelivery(req.authUser!.companyId, publicId, deliverySchema.parse(body), req.authUser!.sub);
  }

  @Post(':publicId/submit')
  @RequirePermission('ORDER.SUBMIT')
  submit(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string) {
    return this.service.submit(req.authUser!.companyId, publicId, req.authUser!.sub);
  }

  @Get(':publicId/fulfillment')
  @RequirePermission('ORDER.READ')
  fulfillment(@Req() req: AuthenticatedRequest, @Param('publicId') publicId: string) {
    return this.service.fulfillment(req.authUser!.companyId, publicId);
  }
}

@Controller('api/sales')
@UseGuards(AuthGuard, PermissionGuard)
export class SalesController {
  constructor(private readonly service: OrderService) {}

  @Get()
  @RequirePermission('SALES.READ')
  list(@Req() req: AuthenticatedRequest, @Query('accountPublicId') accountPublicId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.sales(req.authUser!.companyId, accountPublicId, from, to);
  }
}

@Controller('api/erp-fulfillment')
@UseGuards(AuthGuard, PermissionGuard)
export class ErpFulfillmentController {
  constructor(private readonly service: OrderService) {}

  @Post('order-result')
  @RequirePermission('INTEGRATION.RESULT.WRITE')
  orderResult(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.applyOrderResult(req.authUser!.companyId, orderResultSchema.parse(body));
  }

  @Post('deliveries')
  @RequirePermission('INTEGRATION.RESULT.WRITE')
  deliveries(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.ingestDeliveries(req.authUser!.companyId, deliveriesSchema.parse(body).rows);
  }

  @Post('sales')
  @RequirePermission('INTEGRATION.RESULT.WRITE')
  sales(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.ingestSales(req.authUser!.companyId, salesSchema.parse(body).rows);
  }

  @Post('return-exchanges')
  @RequirePermission('INTEGRATION.RESULT.WRITE')
  returns(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.ingestReturnExchange(req.authUser!.companyId, returnExchangeSchema.parse(body).rows);
  }
}
