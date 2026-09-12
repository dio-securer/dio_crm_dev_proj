export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  requestId?: string;
};

export type AuthUser = {
  userId: number;
  publicId: string;
  loginId: string;
  name: string;
  companyId: number;
  organizationId?: number;
  roles: string[];
  permissions: string[];
  scope: 'SELF' | 'BRANCH' | 'DIVISION' | 'ALL' | 'SYSTEM';
};

export type PageQuery = { page?: number; pageSize?: number };

export type LeadStatus = 'NEW' | 'FIRST_VISIT' | 'KEYMAN_MEETING' | 'CONTACT_EXCLUDED' | 'CONVERTED';
export type LeadSummary = { public_id:string; hospital_name:string; status:LeadStatus; owner_user_id?:number|null; owner_name?:string|null; phone?:string|null; address?:string|null; sido?:string|null; sigungu?:string|null; business_no?:string|null; };
export type AccountSummary = { public_id:string; account_name:string; account_status:string; business_no?:string|null; erp_customer_code?:string|null; erp_approved_yn:boolean; integration_status:string; };

export type ActivityStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
export type ActivityRelatedType = 'LEAD' | 'ACCOUNT' | 'OPPORTUNITY';
export type DirectWorkType = 'DIRECT_WORK' | 'DIRECT_LEAVE';
export type ActivityReportStatus = 'DRAFT' | 'REQUESTED' | 'BRANCH_APPROVED' | 'FINAL_APPROVED';
export type DirectWorkStatus = 'DRAFT' | 'REQUESTED' | 'BRANCH_APPROVED' | 'DIVISION_APPROVED' | 'BRANCH_REJECTED' | 'DIVISION_REJECTED';
export type ActivityCalendarItem = { event_public_id:string; activity_public_id:string; subject:string; start_at:string; end_at:string; status:ActivityStatus; related_type:ActivityRelatedType; related_name_snapshot:string; visit_purpose?:string|null; in_at?:string|null; out_at?:string|null; direct_work_type?:DirectWorkType|null; direct_work_status?:DirectWorkStatus|null; };
export type ActivityMapHospital = { related_type:'LEAD'|'ACCOUNT'; public_id:string; name:string; latitude:number; longitude:number; address?:string|null; distance_m:number; };

export type OpportunityStage = 'NEEDS_ANALYSIS' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';
export type OpportunitySummary = { public_id:string; opportunity_name:string; account_public_id:string; account_name:string; stage:OpportunityStage; record_type:'NEW'|'EXISTING'|'RECONTRACT'; amount:number; expected_close_date?:string|null; success_probability?:number|null; forecast_category?:'PIPELINE'|'BEST_CASE'|'COMMIT'|'OMITTED'|null; erp_approved_yn:boolean; contract_created_yn:boolean; };
export type ProductPackageSummary = { public_id:string; item_type:'PACKAGE'|'PRODUCT'; item_name:string; erp_item_code?:string|null; category?:string|null; base_price:number; source_system:string; };
export type PipelineStageSummary = { stage:OpportunityStage; opportunity_count:number; amount:number; weighted_amount:number; };

export type ContractStatus = 'DRAFT' | 'ERP_REQUESTED' | 'ERP_APPROVED' | 'ERP_FAILED' | 'CLOSED';
export type ContractSummary = {
  public_id: string;
  contract_name: string;
  contract_date?: string | null;
  contract_amount: number;
  status: ContractStatus;
  integration_status: 'NOT_REQUESTED' | 'REQUESTING' | 'SUCCESS' | 'FAILED';
  erp_contract_no?: string | null;
  erp_approval_status: string;
  account_public_id: string;
  account_name: string;
  opportunity_public_id: string;
  opportunity_name: string;
};
export type CollectionPlanSummary = { public_id:string; plan_version:number; installment_no:number; collection_method:string; amount:number; planned_date:string; adjustment_type:'ORIGINAL'|'SPLIT'|'ARREARS_REALLOCATION'; is_current:boolean; erp_sync_status:string; correction_required_yn:boolean; };
export type CollectionActualSummary = { public_id:string; erp_collection_no:string; amount:number; collected_at:string; source_system:string; };
export type CollectionReconciliation = { contractPublicId:string; contractAmount:number; currentPlanTotal:number; actualTotal:number; overduePlanTotal:number; outstandingAmount:number; correctionRequired:boolean; };

export type OrderStatus = 'DRAFT' | 'REQUESTING' | 'ACCEPTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type OrderSummary = {
  public_id:string;
  status:OrderStatus;
  integration_status:string;
  erp_order_no?:string|null;
  delivery_address_type?:'ACCOUNT'|'DIRECT'|null;
  delivery_address?:string|null;
  express_yn:boolean;
  note?:string|null;
  contract_public_id:string;
  contract_name:string;
  account_public_id:string;
  account_name:string;
  order_amount:number;
  item_count:number;
};
export type OrderProductSummary = {
  public_id:string;
  item_type:'PACKAGE'|'PRODUCT';
  item_name:string;
  erp_item_code?:string|null;
  category?:string|null;
  unit_price:number;
  stock_qty?:number|null;
  order_available_yn:boolean;
  source_system:string;
  erp_synced_at?:string|null;
};
export type DeliverySummary = { public_id:string; erp_delivery_no:string; delivery_status:string; shipped_at?:string|null; delivered_at?:string|null; };
export type SalesSummary = { public_id:string; erp_sales_no:string; sales_date:string; amount:number; item_code?:string|null; item_name?:string|null; quantity?:number|null; account_public_id:string; account_name:string; contract_public_id?:string|null; order_public_id?:string|null; };
export type ReturnExchangeSummary = { public_id:string; erp_reference_no:string; transaction_type:'RETURN'|'EXCHANGE'; status:string; item_code?:string|null; quantity?:number|null; processed_at?:string|null; };

export type LedgerTransactionType = 'SALE' | 'COLLECTION' | 'RETURN' | 'EXCHANGE';
export type LedgerRow = { public_id:string; txn_date?:string|null; txn_type:LedgerTransactionType; reference_no?:string|null; item_code?:string|null; item_name?:string|null; quantity?:number|null; amount?:number|null; status?:string|null; };
export type PackageLedger = {
  account:{ publicId:string; accountName:string; erpCustomerCode?:string|null };
  scope:{ type:'GENERAL'|'CONTRACT'; publicId?:string; contractName?:string; erpContractNo?:string|null; contractAmount?:number };
  period:{ from?:string|null; to?:string|null };
  summary:{ salesAmount:number; collectionAmount:number; returnExchangeCount:number; rowCount:number };
  rows:LedgerRow[];
};
export type MonthlyStatement = {
  account:{ publicId:string; accountName:string; businessNo?:string|null; address?:string|null; erpCustomerCode?:string|null };
  scope:{ type:'GENERAL'|'CONTRACT'; publicId?:string; contractName?:string; erpContractNo?:string|null };
  period:{ from:string; to:string };
  rows:Array<{ public_id:string; erp_sales_no:string; sales_date:string; item_code?:string|null; item_name?:string|null; quantity?:number|null; amount:number; order_public_id?:string|null; erp_order_no?:string|null }>;
  summary:{ lineCount:number; totalAmount:number };
};
export type Account360 = {
  account:Record<string,unknown>;
  contacts:Record<string,unknown>[];
  sales:{ opportunities:Record<string,unknown>[]; contracts:Record<string,unknown>[]; sales:Record<string,unknown>[]; collections:Record<string,unknown>[] };
  order:{ orders:Record<string,unknown>[]; deliveries:Record<string,unknown>[]; returns:Record<string,unknown>[] };
  activity:Record<string,unknown>[];
  service:{ available:boolean; reason:string };
  analysis:{ opportunityCount:number; contractCount:number; orderCount:number; salesTotal:number; collectionTotal:number; outstandingObserved:number; activityCount:number };
};
export type AnalyticsDashboard = {
  period:{ from?:string|null; to?:string|null };
  leads:Array<{status:string;count:number}>;
  activities:Array<{status:string;count:number}>;
  pipeline:Array<{stage:string;opportunity_count:number;amount:number;weighted_amount:number}>;
  contracts:Array<{status:string;count:number;amount:number}>;
  orders:Array<{status:string;count:number}>;
  sales:{count:number;amount:number};
  collections:{count:number;amount:number};
  topAccounts:Array<{account_public_id:string;account_name:string;sales_amount:number}>;
};
