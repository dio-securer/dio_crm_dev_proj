export type ApprovalWorkflowStep = {
  step: number;
  actor: 'BRANCH_MANAGER' | 'DIVISION_MANAGER';
};

export type WorkflowProfileStatus = 'ACTIVE' | 'BASELINE_ONLY';

export type WorkflowProfileDefinition = {
  code: string;
  status: WorkflowProfileStatus;
  activityReport: ApprovalWorkflowStep[];
  directWork: ApprovalWorkflowStep[];
  activityReportApprovalRequired?: boolean;
  directWorkEnabled?: boolean;
  gaps?: string[];
};

export const KR_SALES_APPROVAL: WorkflowProfileDefinition = {
  code: 'KR_SALES_APPROVAL',
  status: 'ACTIVE',
  activityReportApprovalRequired: true,
  directWorkEnabled: true,
  activityReport: [
    { step: 1, actor: 'BRANCH_MANAGER' },
    { step: 2, actor: 'DIVISION_MANAGER' }
  ],
  directWork: [
    { step: 1, actor: 'BRANCH_MANAGER' },
    { step: 2, actor: 'DIVISION_MANAGER' }
  ]
};

/**
 * Overseas training material confirms Activity Report approval exists and
 * Direct Work is not used. Approver organization/role is not confirmed, so no
 * actor is invented here. Country onboarding must resolve the GAP before use.
 */
export const GLOBAL_SALES_APPROVAL_BASELINE: WorkflowProfileDefinition = {
  code: 'GLOBAL_SALES_APPROVAL_BASELINE',
  status: 'BASELINE_ONLY',
  activityReportApprovalRequired: true,
  directWorkEnabled: false,
  activityReport: [],
  directWork: [],
  gaps: ['ACTIVITY_REPORT_APPROVER_ORG_UNCONFIRMED']
};

const workflows = new Map<string, WorkflowProfileDefinition>([
  [KR_SALES_APPROVAL.code, KR_SALES_APPROVAL],
  [GLOBAL_SALES_APPROVAL_BASELINE.code, GLOBAL_SALES_APPROVAL_BASELINE]
]);

export function getWorkflowProfile(code: string) {
  return workflows.get(code);
}
