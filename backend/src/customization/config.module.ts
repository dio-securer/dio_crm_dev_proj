import {ConfigurationAccountBulkController} from './account-bulk-http';
import {HqFieldWriteModule} from './hq-field-http';
import {LogicDraftModule} from './logic-draft-http';
import {ConfigurationAccountHospitalController} from './account-hospital-http';
import {ConfigurationCommonCodeAdminController} from './common-code-admin-http';
import {ConfigurationPlatformAdminController} from './platform-admin-http';
import {ConfigurationLeadLifecycleController} from './lead-lifecycle-http';
import {ConfiguredFileMetadataGateway,CONFIGURATION_UPLOAD_VERIFIER} from './file-metadata-gateway';
import {ConfiguredHiraIngestGateway} from './hira-ingest-gateway';
import {ConfiguredLedgerExportGateway} from './ledger-export-gateway';
import {ConfiguredLedgerReadGateway} from './ledger-read-gateway';
import {ConfiguredAccount360Gateway} from './account360-gateway';
import {ConfiguredAnalyticsDashboardGateway} from './analytics-dashboard-gateway';
import {ConfiguredFulfillmentIngestGateway} from './fulfillment-ingest-gateway';
import {ConfiguredOrderSubmitGateway} from './order-submit-gateway';
import {ConfiguredOrderCommandGateway} from './order-command-gateway';
import {ConfiguredOrderReadGateway} from './order-read-gateway';
import {ConfiguredPlatformReadGateway} from './platform-read-gateway';
import {DomainDeliveryWorker} from './domain-delivery-worker';
import {ConfigurationDeliveryController} from './domain-delivery-http';
import type {IdempotentDomainTransport} from './domain-delivery-adapters';
import {ConfigurationSupplementalResultController} from './supplemental-result-http';
import {ConfiguredErpRequestGateway} from './erp-request-gateway';
import {ConfiguredErpResultGateway} from './erp-result-gateway';
import {ConfiguredRuntimeContextGateway} from './runtime-context-gateway';
import {ConfiguredApprovalRouteGateway} from './approval-route-gateway';
import {ConfiguredDirectWorkGateway} from './direct-work-gateway';
import {ConfiguredActivityReportGateway} from './activity-report-gateway';
import {ConfigurationActivityReportDetailController} from './activity-report-http';
import {ConfigurationContactsController} from './contact-http';
import {Module} from '@nestjs/common';
import {JwtModule} from '@nestjs/jwt';
import {DatabaseService} from '../database/database.service';
import {AuthGuard} from '../security/security';
import {CompanyConfigurationService,type HqExtensionDeploymentAuthority} from './config-service';
import {SqlAdminConfigRepository} from './sql-config-store';
import {ConfigurationController,ConfigurationRuntimeController,ConfigurationIdentity,StandardPublicationController} from './config-http';
import {StandardPublicationService} from './standard-service';
import {SqlStandardRepository} from './sql-standard-store';
import {APP_INTERCEPTOR} from '@nestjs/core';
import {LegacyConfigurationBoundary} from './legacy-boundary';
import {ConfiguredLeadGateway} from './lead-gateway';
import {ConfigurationLeadHistoryController} from './lead-history';
import {ConfigurationLeadActivitiesController} from './lead-activities';
import {ConfiguredCustomerGateway} from './customer-gateway';
import {ConfiguredOpportunityGateway} from './opportunity-gateway';
import {ConfiguredContractGateway} from './contract-gateway';
import {ConfiguredSalesReportGateway} from './sales-report-gateway';
import {ConfiguredActivityGateway} from './activity-gateway';
/** Reviewed immutable standard artifacts must be added by the deployment bundle.
 * Empty allowlist fails closed; an unfinished baseline must never become publishable by bootstrap.
 */
export const CONFIGURATION_TRANSPORT=Symbol('CONFIGURATION_TRANSPORT');
export const CONFIGURATION_ARTIFACTS=Symbol('CONFIGURATION_ARTIFACTS');
export const CONFIGURATION_HQ_EXTENSION_AUTHORITY=Symbol('CONFIGURATION_HQ_EXTENSION_AUTHORITY');
@Module({imports:[HqFieldWriteModule,LogicDraftModule,JwtModule.register({})],controllers:[ConfigurationLeadActivitiesController,ConfigurationLeadHistoryController,ConfigurationAccountBulkController,ConfigurationAccountHospitalController,ConfigurationCommonCodeAdminController,ConfigurationPlatformAdminController,ConfigurationLeadLifecycleController,ConfigurationDeliveryController,ConfigurationSupplementalResultController,ConfigurationActivityReportDetailController,ConfigurationContactsController,ConfigurationController,ConfigurationRuntimeController,StandardPublicationController],providers:[ConfiguredFileMetadataGateway,{provide:CONFIGURATION_UPLOAD_VERIFIER,useValue:null},DatabaseService,AuthGuard,{provide:CONFIGURATION_TRANSPORT,useValue:null},{provide:CONFIGURATION_HQ_EXTENSION_AUTHORITY,useValue:null},{provide:DomainDeliveryWorker,inject:[DatabaseService,CONFIGURATION_TRANSPORT],useFactory:(db:DatabaseService,transport:IdempotentDomainTransport|null)=>new DomainDeliveryWorker(new SqlAdminConfigRepository(db),transport)},ConfigurationIdentity,ConfiguredHiraIngestGateway,ConfiguredLedgerExportGateway,ConfiguredLedgerReadGateway,ConfiguredAccount360Gateway,ConfiguredAnalyticsDashboardGateway,ConfiguredFulfillmentIngestGateway,ConfiguredOrderSubmitGateway,ConfiguredOrderCommandGateway,ConfiguredOrderReadGateway,ConfiguredPlatformReadGateway,ConfiguredErpRequestGateway,ConfiguredErpResultGateway,ConfiguredRuntimeContextGateway,ConfiguredApprovalRouteGateway,ConfiguredDirectWorkGateway,ConfiguredActivityReportGateway,ConfiguredLeadGateway,ConfiguredCustomerGateway,ConfiguredOpportunityGateway,ConfiguredContractGateway,ConfiguredSalesReportGateway,ConfiguredActivityGateway,{provide:APP_INTERCEPTOR,useClass:LegacyConfigurationBoundary},{provide:StandardPublicationService,inject:[DatabaseService,CONFIGURATION_ARTIFACTS],useFactory:(db:DatabaseService,artifacts:ConstructorParameters<typeof StandardPublicationService>[1])=>new StandardPublicationService(new SqlStandardRepository(db),artifacts)},{provide:CONFIGURATION_ARTIFACTS,useValue:[]},{provide:CompanyConfigurationService,inject:[DatabaseService,CONFIGURATION_ARTIFACTS,CONFIGURATION_HQ_EXTENSION_AUTHORITY],useFactory:(db:DatabaseService,artifacts:ConstructorParameters<typeof CompanyConfigurationService>[1],authority:HqExtensionDeploymentAuthority|null)=>new CompanyConfigurationService(new SqlAdminConfigRepository(db),artifacts,undefined,authority??undefined)}],exports:[CompanyConfigurationService,DomainDeliveryWorker]})
export class ConfigurationModule {}
