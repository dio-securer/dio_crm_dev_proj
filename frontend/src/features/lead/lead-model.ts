export type LeadStage =
  | 'NEW'
  | 'CONTACTED'
  | 'CONSULTING'
  | 'PROPOSAL'
  | 'REVIEW'
  | 'NEGOTIATION'
  | 'ON_HOLD'
  | 'CONVERTED'
  | 'DISQUALIFIED';

export type LeadInterest = 'HIGH' | 'MEDIUM' | 'LOW';
export type LeadSource = 'WEB' | 'EXHIBITION' | 'REFERRAL' | 'PHONE' | 'OTHER';
export type LeadActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'VISIT' | 'NOTE';

export type LeadActivity = {
  id: string;
  type: LeadActivityType;
  occurredAt: string;
  title: string;
  summary: string;
  ownerName: string;
};

export type LeadActivityInput = {
  type: LeadActivityType;
  occurredAt: string;
  title: string;
  summary: string;
};

export type LeadHospitalScale = {
  hospitalType: string;
  doctorCount?: number;
  chairCount?: number;
  staffCount?: number;
  mainSpecialty: string;
};

export type LeadConversionResult = {
  accountId: string;
  accountName: string;
  contactId?: string;
  opportunityId?: string;
  convertedAt: string;
};

export type LeadContact = {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  primary?: boolean;
};

export type LeadRecord = {
  leadId: string;
  leadNo: string;
  leadName: string;
  organizationName: string;
  organizationType: string;
  jobTitle?: string;
  phone?: string;
  email?: string;
  country: string;
  region: string;
  address?: string;
  stage: LeadStage;
  interestLevel: LeadInterest;
  source: LeadSource;
  ownerUserId: string;
  ownerName: string;
  expectedAmount?: number;
  expectedDate?: string;
  lastActivityAt?: string;
  nextAction?: string;
  nextActionAt?: string;
  hospitalScale?: LeadHospitalScale;
  convertedAccountId?: string;
  convertedContactId?: string;
  convertedOpportunityId?: string;
  convertedAt?: string;
  tags: string[];
  noteSummary?: string;
  opportunityCount: number;
  contacts: LeadContact[];
  activities: LeadActivity[];
  createdAt: string;
  updatedAt: string;
};

export type LeadQuickCreateInput = {
  leadName: string;
  organizationName: string;
  phone?: string;
  country?: string;
  address?: string;
  source: LeadSource;
  ownerUserId: string;
};

export const API_LEAD_STEPS = ['NEW', 'FIRST_VISIT', 'KEYMAN_MEETING', 'CONVERTED'] as const;
export type ApiLeadStep = (typeof API_LEAD_STEPS)[number];

export const LEAD_STAGES: LeadStage[] = [
  'NEW',
  'CONTACTED',
  'CONSULTING',
  'PROPOSAL',
  'REVIEW',
  'NEGOTIATION',
  'ON_HOLD',
  'CONVERTED',
  'DISQUALIFIED'
];

export const LEAD_INTERESTS: LeadInterest[] = ['HIGH', 'MEDIUM', 'LOW'];
export const LEAD_SOURCES: LeadSource[] = ['WEB', 'EXHIBITION', 'REFERRAL', 'PHONE', 'OTHER'];

export const MOCK_LEAD_OWNERS = [
  { id: 'USER001', name: '김지훈' },
  { id: 'USER002', name: '이서연' },
  { id: 'USER003', name: '박준호' }
] as const;
