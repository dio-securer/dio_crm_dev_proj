import { listSandboxAccounts } from '../../account-sandbox';
import { addAccountActivity, listAccountActivities, type AccountActivityType } from '../account/account-relations-mock';
import { addMockLeadActivity, loadMockLeads, saveMockLeads } from '../lead/lead-mock-service';
import type { LeadActivityType } from '../lead/lead-model';

export type UnifiedActivitySource = 'LEAD' | 'ACCOUNT';
export type UnifiedActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'VISIT' | 'NOTE';

export type UnifiedActivity = {
  id: string;
  source: UnifiedActivitySource;
  targetId: string;
  targetName: string;
  type: UnifiedActivityType;
  subject: string;
  note?: string | null;
  ownerName: string;
  occurredAt: string;
};

export type UnifiedActivityTarget = {
  source: UnifiedActivitySource;
  id: string;
  name: string;
  ownerName: string;
};

function normalizeLeadType(type: LeadActivityType): UnifiedActivityType {
  if (type === 'CALL' || type === 'EMAIL' || type === 'MEETING' || type === 'VISIT' || type === 'NOTE') return type;
  return 'NOTE';
}

export function listUnifiedActivityTargets(): UnifiedActivityTarget[] {
  const leads = loadMockLeads().map(row => ({
    source: 'LEAD' as const,
    id: row.leadId,
    name: row.organizationName || row.leadName,
    ownerName: row.ownerName
  }));
  const accounts = listSandboxAccounts('', 'all').map(row => ({
    source: 'ACCOUNT' as const,
    id: row.public_id,
    name: row.account_name,
    ownerName: row.owner_name || '-'
  }));
  return [...leads, ...accounts];
}

export function listUnifiedActivities(): UnifiedActivity[] {
  const leads = loadMockLeads().flatMap(row => (row.activities || []).map(activity => ({
    id: activity.id,
    source: 'LEAD' as const,
    targetId: row.leadId,
    targetName: row.organizationName || row.leadName,
    type: normalizeLeadType(activity.type),
    subject: activity.title,
    note: activity.summary || null,
    ownerName: activity.ownerName || row.ownerName,
    occurredAt: activity.occurredAt
  })));
  const accounts = listSandboxAccounts('', 'all').flatMap(account => listAccountActivities(account.public_id).map(activity => ({
    id: activity.id,
    source: 'ACCOUNT' as const,
    targetId: account.public_id,
    targetName: account.account_name,
    type: activity.type,
    subject: activity.subject,
    note: activity.note,
    ownerName: activity.ownerName,
    occurredAt: activity.occurredAt
  })));
  return [...leads, ...accounts].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function addUnifiedActivity(input: {
  source: UnifiedActivitySource;
  targetId: string;
  type: UnifiedActivityType;
  subject: string;
  note?: string;
  occurredAt: string;
}): UnifiedActivity {
  const target = listUnifiedActivityTargets().find(row => row.source === input.source && row.id === input.targetId);
  if (!target) throw new Error('ACTIVITY_TARGET_NOT_FOUND');
  if (!input.subject.trim()) throw new Error('ACTIVITY_SUBJECT_REQUIRED');

  if (input.source === 'ACCOUNT') {
    const row = addAccountActivity(target.id, target.ownerName, {
      type: input.type as AccountActivityType,
      subject: input.subject,
      note: input.note,
      occurredAt: input.occurredAt
    });
    return {
      id: row.id,
      source: 'ACCOUNT',
      targetId: target.id,
      targetName: target.name,
      type: row.type,
      subject: row.subject,
      note: row.note,
      ownerName: row.ownerName,
      occurredAt: row.occurredAt
    };
  }

  const current = loadMockLeads();
  const next = addMockLeadActivity(current, target.id, {
    type: input.type as LeadActivityType,
    occurredAt: input.occurredAt,
    title: input.subject.trim(),
    summary: input.note?.trim() || ''
  });
  saveMockLeads(next);
  const row = next.find(item => item.leadId === target.id)?.activities.find(item => item.title === input.subject.trim() && item.occurredAt === input.occurredAt);
  if (!row) throw new Error('ACTIVITY_SAVE_FAILED');
  return {
    id: row.id,
    source: 'LEAD',
    targetId: target.id,
    targetName: target.name,
    type: normalizeLeadType(row.type),
    subject: row.title,
    note: row.summary || null,
    ownerName: row.ownerName,
    occurredAt: row.occurredAt
  };
}
