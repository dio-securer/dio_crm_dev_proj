import type { AccountSummary } from '@dio-crm/contracts';
import { STORAGE_KEY } from '../../account-model';
import { listSandboxAccounts, requestSandboxErp } from '../../account-sandbox';

const ERP_WORKFLOW_KEY = 'dio-crm:mock:account-erp-workflow:v1';

export type AccountErpMockStatus = 'NOT_REQUESTED' | 'REQUESTING' | 'REVIEWING' | 'SUCCESS' | 'FAILED';

export type AccountErpMockWorkflow = {
  accountId: string;
  status: AccountErpMockStatus;
  requestId?: string;
  requestedAt?: string;
  reviewedAt?: string;
  completedAt?: string;
  failedAt?: string;
  failureReason?: string;
};

let workflowMemory: AccountErpMockWorkflow[] = [];

function readWorkflows(): AccountErpMockWorkflow[] {
  try {
    const raw = globalThis.localStorage?.getItem(ERP_WORKFLOW_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AccountErpMockWorkflow[];
      if (Array.isArray(parsed)) {
        workflowMemory = parsed;
        return parsed;
      }
    }
  } catch {
    // memory fallback
  }
  return workflowMemory;
}

function writeWorkflows(rows: AccountErpMockWorkflow[]) {
  workflowMemory = rows;
  try {
    globalThis.localStorage?.setItem(ERP_WORKFLOW_KEY, JSON.stringify(rows));
  } catch {
    // memory fallback
  }
}

function saveWorkflow(workflow: AccountErpMockWorkflow) {
  const rows = readWorkflows();
  writeWorkflows([workflow, ...rows.filter(row => row.accountId !== workflow.accountId)]);
  return workflow;
}

function updateStoredAccount(publicId: string, updater: (row: AccountSummary) => AccountSummary): AccountSummary {
  let rows: AccountSummary[] = [];
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    rows = raw ? JSON.parse(raw) as AccountSummary[] : listSandboxAccounts('', 'all');
  } catch {
    rows = listSandboxAccounts('', 'all');
  }
  const index = rows.findIndex(row => row.public_id === publicId);
  if (index < 0) throw new Error('ACCOUNT_NOT_FOUND');
  rows[index] = updater(rows[index]);
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(rows));
  return rows[index];
}

function inferStatus(account: AccountSummary | undefined): AccountErpMockStatus {
  const status = account?.integration_status;
  if (status === 'REQUESTING' || status === 'REVIEWING' || status === 'SUCCESS' || status === 'FAILED') return status;
  return 'NOT_REQUESTED';
}

export function getAccountErpMockWorkflow(accountId: string): AccountErpMockWorkflow {
  const stored = readWorkflows().find(row => row.accountId === accountId);
  if (stored) return stored;
  const account = listSandboxAccounts('', 'all').find(row => row.public_id === accountId);
  return { accountId, status: inferStatus(account) };
}

export function requestAccountErpMock(accountId: string): AccountErpMockWorkflow {
  requestSandboxErp(accountId);
  const now = new Date().toISOString();
  const requestId = `LOCAL-ERP-${Date.now().toString(36).toUpperCase()}`;
  return saveWorkflow({ accountId, status: 'REQUESTING', requestId, requestedAt: now });
}

export function advanceAccountErpMock(accountId: string): AccountErpMockWorkflow {
  const current = getAccountErpMockWorkflow(accountId);
  const now = new Date().toISOString();
  if (current.status === 'REQUESTING') {
    updateStoredAccount(accountId, row => ({ ...row, integration_status: 'REVIEWING', updated_at: now }));
    return saveWorkflow({ ...current, status: 'REVIEWING', reviewedAt: now, failureReason: undefined, failedAt: undefined });
  }
  if (current.status === 'REVIEWING') {
    updateStoredAccount(accountId, row => ({
      ...row,
      integration_status: 'SUCCESS',
      erp_approved_yn: true,
      erp_customer_code: row.erp_customer_code || `MOCK-${row.public_id.slice(0, 8).toUpperCase()}`,
      erp_approval_code: 'CM840500',
      updated_at: now
    }));
    return saveWorkflow({ ...current, status: 'SUCCESS', completedAt: now, failureReason: undefined, failedAt: undefined });
  }
  return current;
}

export function failAccountErpMock(accountId: string, reason: string): AccountErpMockWorkflow {
  const current = getAccountErpMockWorkflow(accountId);
  const now = new Date().toISOString();
  updateStoredAccount(accountId, row => ({ ...row, integration_status: 'FAILED', erp_approved_yn: false, updated_at: now }));
  return saveWorkflow({ ...current, status: 'FAILED', failedAt: now, failureReason: reason.trim() || 'MOCK_FAILURE' });
}

export function retryAccountErpMock(accountId: string): AccountErpMockWorkflow {
  return requestAccountErpMock(accountId);
}

export function resetAccountErpMockWorkflows() {
  workflowMemory = [];
  try {
    globalThis.localStorage?.removeItem(ERP_WORKFLOW_KEY);
  } catch {
    // ignore
  }
}
