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
export type ActivitySummary = { public_id:string; subject:string; planned_at:string; status:ActivityStatus; related_type:ActivityRelatedType; related_id:number; visit_purpose:string; in_at?:string|null; out_at?:string|null; };
export type ActivityReportStatus = 'DRAFT' | 'REQUESTED' | 'BRANCH_APPROVED' | 'FINAL_APPROVED';
export type DirectWorkStatus = 'DRAFT' | 'REQUESTED' | 'BRANCH_APPROVED' | 'FINAL_APPROVED' | 'REJECTED_BRANCH' | 'REJECTED_DIVISION';
export type DirectWorkType = 'DIRECT_WORK' | 'DIRECT_LEAVE';

export type OpportunityStage = 'NEEDS_ANALYSIS' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';
export type OpportunitySummary = {
  public_id:string;
  opportunity_name:string;
  account_public_id:string;
  account_name:string;
  stage:OpportunityStage;
  record_type:'NEW'|'EXISTING'|'RECONTRACT';
  amount:number;
  expected_close_date?:string|null;
  success_probability?:number|null;
  forecast_category?:'PIPELINE'|'BEST_CASE'|'COMMIT'|'OMITTED'|null;
  erp_approved_yn:boolean;
  contract_created_yn:boolean;
};
export type ProductPackageSummary = { public_id:string; item_type:'PACKAGE'|'PRODUCT'; item_name:string; erp_item_code?:string|null; category?:string|null; base_price:number; source_system:string; };
export type PipelineStageSummary = { stage:OpportunityStage; opportunity_count:number; amount:number; weighted_amount:number; };
