import {
  canCheckIn, canEditActivity, canResubmitDirectWork, haversineMeters,
  nextDirectWorkStatus, nextReportStatus, validatePlanInput
} from './activity.rules';

describe('activity rules', () => {
  test('haversine distance is near zero for same point', () => {
    expect(haversineMeters(37.5, 127.0, 37.5, 127.0)).toBeLessThan(0.01);
  });

  test('check-in rejects outside configured distance', () => {
    const result = canCheckIn({ status: 'PLANNED', hasOtherOpenActivity: false, distanceM: 250, allowedDistanceM: 200 });
    expect(result.allowed).toBe(false);
  });

  test('check-in rejects while another activity is open', () => {
    const result = canCheckIn({ status: 'PLANNED', hasOtherOpenActivity: true, distanceM: 10, allowedDistanceM: 200 });
    expect(result.allowed).toBe(false);
  });

  test('direct work requires reason', () => {
    expect(validatePlanInput({ directWorkType: 'DIRECT_WORK' }).allowed).toBe(false);
  });

  test('completed activity cannot be edited', () => {
    expect(canEditActivity('COMPLETED', false).allowed).toBe(false);
  });

  test('report approval follows branch then division', () => {
    expect(nextReportStatus('REQUESTED', 'BRANCH')).toBe('BRANCH_APPROVED');
    expect(nextReportStatus('BRANCH_APPROVED', 'DIVISION')).toBe('FINAL_APPROVED');
    expect(nextReportStatus('REQUESTED', 'DIVISION')).toBeNull();
  });

  test('direct work supports rejection and resubmission', () => {
    expect(nextDirectWorkStatus('REQUESTED', 'BRANCH', 'REJECT')).toBe('BRANCH_REJECTED');
    expect(canResubmitDirectWork('BRANCH_REJECTED')).toBe(true);
    expect(nextDirectWorkStatus('BRANCH_APPROVED', 'DIVISION', 'APPROVE')).toBe('DIVISION_APPROVED');
  });
});
