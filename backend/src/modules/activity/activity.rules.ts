export type ActivityStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
export type ReportStatus = 'DRAFT' | 'REQUESTED' | 'BRANCH_APPROVED' | 'FINAL_APPROVED';
export type DirectWorkStatus = 'DRAFT' | 'REQUESTED' | 'BRANCH_APPROVED' | 'DIVISION_APPROVED' | 'BRANCH_REJECTED' | 'DIVISION_REJECTED';

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number) => v * Math.PI / 180;
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export function validatePlanInput(input: { directWorkType?: string | null; directWorkReason?: string | null }) {
  if (input.directWorkType && !input.directWorkReason?.trim()) {
    return { allowed: false, error: '직출/직퇴 선택 시 사유는 필수입니다.' } as const;
  }
  return { allowed: true } as const;
}

export function canCheckIn(input: {
  status: ActivityStatus;
  hasOtherOpenActivity: boolean;
  distanceM: number;
  allowedDistanceM: number;
}) {
  if (input.status !== 'PLANNED') return { allowed: false, error: '예정 상태의 활동만 IN 할 수 있습니다.' } as const;
  if (input.hasOtherOpenActivity) return { allowed: false, error: 'OUT하지 않은 다른 활동이 있어 IN 할 수 없습니다.' } as const;
  if (input.distanceM > input.allowedDistanceM) {
    return { allowed: false, error: `병원 허용거리 ${input.allowedDistanceM}m 밖에서는 IN 할 수 없습니다.` } as const;
  }
  return { allowed: true } as const;
}

export function canEditActivity(status: ActivityStatus, reportLocked: boolean) {
  if (reportLocked) return { allowed: false, error: '최종 승인된 활동보고에 포함된 활동은 수정할 수 없습니다.' } as const;
  if (status === 'COMPLETED') return { allowed: false, error: 'OUT 완료된 활동은 수정할 수 없습니다.' } as const;
  if (status !== 'IN_PROGRESS') return { allowed: false, error: '활동정보는 IN 이후 OUT 전까지만 수정할 수 있습니다.' } as const;
  return { allowed: true } as const;
}

export function nextReportStatus(current: ReportStatus, step: 'BRANCH' | 'DIVISION'): ReportStatus | null {
  if (step === 'BRANCH' && current === 'REQUESTED') return 'BRANCH_APPROVED';
  if (step === 'DIVISION' && current === 'BRANCH_APPROVED') return 'FINAL_APPROVED';
  return null;
}

export function nextDirectWorkStatus(
  current: DirectWorkStatus,
  step: 'BRANCH' | 'DIVISION',
  action: 'APPROVE' | 'REJECT'
): DirectWorkStatus | null {
  if (step === 'BRANCH' && current === 'REQUESTED') return action === 'APPROVE' ? 'BRANCH_APPROVED' : 'BRANCH_REJECTED';
  if (step === 'DIVISION' && current === 'BRANCH_APPROVED') return action === 'APPROVE' ? 'DIVISION_APPROVED' : 'DIVISION_REJECTED';
  return null;
}

export function canResubmitDirectWork(status: DirectWorkStatus) {
  return status === 'BRANCH_REJECTED' || status === 'DIVISION_REJECTED';
}
