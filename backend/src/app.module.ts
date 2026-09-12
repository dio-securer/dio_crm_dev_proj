import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseService } from './database/database.service';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { CommonCodeController, PlatformController } from './modules/platform/platform.controller';
import { PlatformService } from './modules/platform/platform.service';
import { AccountController, HiraController, LeadController } from './modules/customer/customer.controller';
import { CustomerService } from './modules/customer/customer.service';
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
    HiraController
  ],
  providers: [
    DatabaseService,
    AuthService,
    PlatformService,
    CustomerService,
    AuthGuard,
    PermissionGuard,
    InterfaceService
  ]
})
export class AppModule {}
