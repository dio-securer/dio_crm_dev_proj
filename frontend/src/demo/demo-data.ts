export type DemoAccount = {
  publicId: string;
  accountCode: string;
  accountName: string;
  country: string;
  customerType: string;
  phone: string;
  email: string;
  address: string;
  status: 'ACTIVE' | 'PROSPECT' | 'INACTIVE';
  owner: string;
};

export type DemoAccountDraft = Omit<DemoAccount, 'publicId' | 'accountCode'>;

export const DEMO_ACCOUNT_SEED: DemoAccount[] = [
  {
    publicId: 'acc-demo-us-001',
    accountCode: 'US-CUST-0001',
    accountName: 'Bright Smile Dental Group',
    country: 'United States',
    customerType: 'Dental Clinic',
    phone: '+1 213 555 0188',
    email: 'office@brightsmile.demo',
    address: 'Los Angeles, CA',
    status: 'ACTIVE',
    owner: 'Emily Carter'
  },
  {
    publicId: 'acc-demo-mx-001',
    accountCode: 'MX-CUST-0001',
    accountName: 'Clinica Dental Nova',
    country: 'Mexico',
    customerType: 'Dental Clinic',
    phone: '+52 55 5555 0188',
    email: 'contact@dentalnova.demo',
    address: 'Mexico City',
    status: 'ACTIVE',
    owner: 'Daniel Ruiz'
  },
  {
    publicId: 'acc-demo-in-001',
    accountCode: 'IN-CUST-0001',
    accountName: 'India Dental Demo',
    country: 'India',
    customerType: 'Dental Clinic',
    phone: '+91 80 5555 0188',
    email: 'demo@indiadental.demo',
    address: 'Bengaluru, Karnataka',
    status: 'PROSPECT',
    owner: 'Global Sales Demo'
  }
];

export const DEMO_LEADS = [
  { code: 'LD-US-0042', name: 'West Coast Dental Studio', country: 'United States', status: 'FIRST_VISIT', owner: 'Emily Carter' },
  { code: 'LD-MX-0018', name: 'Sonrisa Medical Center', country: 'Mexico', status: 'KEYMAN_MEETING', owner: 'Daniel Ruiz' },
  { code: 'LD-IN-0001', name: 'India Expansion Sample', country: 'India', status: 'NEW', owner: 'Global Sales Demo' }
] as const;

export const DEMO_OPPORTUNITIES = [
  { no: 'OPP-US-0021', accountCode: 'US-CUST-0001', name: '2026 Implant Package Expansion', stage: 'NEGOTIATION', amount: '$125,000', owner: 'Emily Carter' },
  { no: 'OPP-MX-0012', accountCode: 'MX-CUST-0001', name: 'Clinic Starter Package', stage: 'PROPOSAL', amount: '$68,000', owner: 'Daniel Ruiz' }
] as const;

export const DEMO_CONTRACTS = [
  { no: 'CONT-US-2026-001', accountCode: 'US-CUST-0001', opportunityNo: 'OPP-US-0021', packageName: 'Implant Starter Package', amount: '$125,000', status: 'ERP READY', payment: '30 / 40 / 30' },
  { no: 'CONT-MX-2026-004', accountCode: 'MX-CUST-0001', opportunityNo: 'OPP-MX-0012', packageName: 'Clinic Starter Package', amount: '$68,000', status: 'DRAFT', payment: '50 / 50' }
] as const;

export const DEMO_PRODUCTS = [
  { code: 'UFII-4010', name: 'Implant Fixture 4.0 x 10', category: 'Implant', unitPrice: '$240' },
  { code: 'ABUT-001', name: 'Standard Abutment', category: 'Prosthetic', unitPrice: '$95' }
] as const;

export const DEMO_ORDERS = [
  { no: 'ORD-US-2026-015', accountCode: 'US-CUST-0001', contractNo: 'CONT-US-2026-001', productCode: 'UFII-4010', qty: 20, amount: '$4,800', status: 'DRAFT' },
  { no: 'ORD-MX-2026-009', accountCode: 'MX-CUST-0001', contractNo: 'CONT-MX-2026-004', productCode: 'ABUT-001', qty: 12, amount: '$1,140', status: 'READY' }
] as const;

export const DEMO_ACTIVITIES = [
  { time: '09:30', account: 'Bright Smile Dental Group', type: 'Planned visit', state: 'PLANNED' },
  { time: '11:00', account: 'Clinica Dental Nova', type: 'Keyman meeting', state: 'IN_PROGRESS' },
  { time: '14:30', account: 'India Dental Demo', type: 'Reference review', state: 'PLANNED' }
] as const;

export const DEMO_REPORTS = [
  { date: '2026-09-15', completed: 4, nextPlans: 7, status: 'APPROVAL REQUESTED' },
  { date: '2026-09-14', completed: 5, nextPlans: 6, status: 'APPROVED' }
] as const;
