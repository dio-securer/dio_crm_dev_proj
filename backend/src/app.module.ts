import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseService } from './database/database.service';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { CommonCodeController, PlatformController } from './modules/platform/platform.controller';
import { PlatformService } from './modules/platform/platform.service';
import { AccountController, HiraController, LeadController } from './modules/customer/customer.controller';
import { CustomerService } from './modules/customer/customer.service';
import { ActivityController, ActivityReportController, DirectWorkController } from './modules/activity/activity.controller';
import { ActivityService } from './modules/activity/activity.service';
import { ApprovalRouteController } from './modules/activity/approval-route.controller';
import { ApprovalRouteService } from './modules/activity/approval-route.service';
import { OpportunityController, ProductPackageController } from './modules/opportunity/opportunity.controller';
import { OpportunityService } from './modules/opportunity/opportunity.service';
import { ContractController, ErpAccountController, ErpResultController } from './modules/contract/contract.controller';
import { ContractService } from './modules/contract/contract.service';
import { ErpFulfillmentController, OrderController, OrderProductController, SalesController } from './modules/order/order.controller';
import { OrderService } from './modules/order/order.service';
import { AnalyticsController } from './modules/analytics/analytics.controller';
import { AnalyticsService } from './modules/analytics/analytics.service';
import { HealthController, OpsController } from './modules/ops/ops.controller';
import { OpsService } from './modules/ops/ops.service';
import { AuthGuard, PermissionGuard } from './security/security';
import { InterfaceService } from './integration/interface.service';
import { GlobalizationController } from './globalization/globalization.controller';
import { GlobalizationService } from './globalization/globalization.service';
import { MarketFeatureGuard } from './globalization/feature.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [
    AuthController,
    PlatformController,
    CommonCodeController,
    LeadController,
    AccountController,
    HiraController,
    ActivityController,
    ActivityReportController,
    DirectWorkController,
    ApprovalRouteController,
    OpportunityController,
    ProductPackageController,
    ContractController,
    ErpAccountController,
    ErpResultController,
    OrderProductController,
    OrderController,
    SalesController,
    ErpFulfillmentController,
    AnalyticsController,
    HealthController,
    OpsController,
    GlobalizationController
  ],
  providers: [
    DatabaseService,
    AuthService,
    PlatformService,
    CustomerService,
    ActivityService,
    ApprovalRouteService,
    OpportunityService,
    ContractService,
    OrderService,
    AnalyticsService,
    OpsService,
    AuthGuard,
    PermissionGuard,
    InterfaceService,
    GlobalizationService,
    MarketFeatureGuard
  ]
})
export class AppModule {}
