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

export type LeadSummary = {
  public_id: string;
  hospital_name: string;
  status: LeadStatus;
  owner_user_id?: number | null;
  owner_name?: string | null;
  phone?: string | null;
  address?: string | null;
  sido?: string | null;
  sigungu?: string | null;
  business_no?: string | null;
};

export type AccountSummary = {
  public_id: string;
  account_name: string;
  account_status: string;
  business_no?: string | null;
  erp_customer_code?: string | null;
  erp_approved_yn: boolean;
  integration_status: string;
};

export type ActivityStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
export type ActivityRelatedType = 'LEAD' | 'ACCOUNT' | 'OPPORTUNITY';
export type DirectWorkType = 'DIRECT_WORK' | 'DIRECT_LEAVE';
export type ActivityReportStatus = 'DRAFT' | 'REQUESTED' | 'BRANCH_APPROVED' | 'FINAL_APPROVED';
export type DirectWorkStatus = 'DRAFT' | 'REQUESTED' | 'BRANCH_APPROVED' | 'DIVISION_APPROVED' | 'BRANCH_REJECTED' | 'DIVISION_REJECTED';

export type ActivityCalendarItem = {
  event_public_id: string;
  activity_public_id: string;
  subject: string;
  start_at: string;
  end_at: string;
  status: ActivityStatus;
  related_type: ActivityRelatedType;
  related_name_snapshot: string;
  visit_purpose?: string | null;
  in_at?: string | null;
  out_at?: string | null;
  direct_work_type?: DirectWorkType | null;
  direct_work_status?: DirectWorkStatus | null;
};

export type ActivityMapHospital = {
  related_type: 'LEAD' | 'ACCOUNT';
  public_id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  distance_m: number;
};
