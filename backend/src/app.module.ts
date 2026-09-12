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
import { AuthGuard, PermissionGuard } from './security/security';
import { InterfaceService } from './integration/interface.service';

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
    ErpResultController
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
    AuthGuard,
    PermissionGuard,
    InterfaceService
  ]
})
export class AppModule {}
