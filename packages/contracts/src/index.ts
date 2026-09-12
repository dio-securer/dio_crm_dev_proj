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
