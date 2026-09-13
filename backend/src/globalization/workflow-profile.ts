export type ApprovalWorkflowStep = {
  step: number;
  actor: 'BRANCH_MANAGER' | 'DIVISION_MANAGER';
};

export type WorkflowProfileDefinition = {
  code: string;
  activityReport: ApprovalWorkflowStep[];
  directWork: ApprovalWorkflowStep[];
};

export const KR_SALES_APPROVAL: WorkflowProfileDefinition = {
  code: 'KR_SALES_APPROVAL',
  activityReport: [
    { step: 1, actor: 'BRANCH_MANAGER' },
    { step: 2, actor: 'DIVISION_MANAGER' }
  ],
  directWork: [
    { step: 1, actor: 'BRANCH_MANAGER' },
    { step: 2, actor: 'DIVISION_MANAGER' }
  ]
};

const workflows = new Map([[KR_SALES_APPROVAL.code, KR_SALES_APPROVAL]]);
export function getWorkflowProfile(code: string) { return workflows.get(code); }
