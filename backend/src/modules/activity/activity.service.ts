import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import crypto from 'node:crypto';
import { DatabaseService, DbQuery } from '../../database/database.service';
import {
  canCheckIn, canEditActivity, canResubmitDirectWork, haversineMeters,
  nextDirectWorkStatus, nextReportStatus, validatePlanInput,
  DirectWorkStatus, ReportStatus
} from './activity.rules';

export type PlanInput = {
  relatedType: 'LEAD' | 'ACCOUNT' | 'OPPORTUNITY';
  relatedPublicId: string;
  plannedAt: string;
  visitPurpose?: string;
  subject?: string;
  directWorkType?: 'DIRECT_WORK' | 'DIRECT_LEAVE';
  directWorkReason?: string;
};

export type GpsInput = { latitude: number; longitude: number; accuracyM?: number; isMocked?: boolean };

@Injectable()
export class ActivityService {
  constructor(private readonly db: DatabaseService) {}

  async createPlan(companyId: number, userId: number, input: PlanInput) {
    return this.db.transaction(query => this.createPlanTx(query, companyId, userId, input));
  }

  async createPlans(companyId: number, userId: number, inputs: PlanInput[]) {
    if (inputs.length > 100) throw new BadRequestException('다건 활동계획은 한 번에 최대 100건입니다.');
    return this.db.transaction(async query => {
      const created: unknown[] = [];
      for (const input of inputs) created.push(await this.createPlanTx(query, companyId, userId, input));
      return { createdCount: created.length, items: created };
    });
  }

  async calendar(companyId: number, requesterUserId: number, from: string, to: string, ownerUserId?: number, permissions: string[] = []) {
    const owner = ownerUserId ?? requesterUserId;
    if (owner !== requesterUserId && !permissions.includes('ACTIVITY.MANAGE')) throw new ForbiddenException('다른 사용자의 일정 조회 권한이 없습니다.');
    const r = await this.db.query(`
      SELECT e.event_id, CONVERT(varchar(36),e.public_id) event_public_id, e.subject, e.start_at, e.end_at,
             a.activity_id, CONVERT(varchar(36),a.public_id) activity_public_id, a.status, a.related_type,
             a.related_name_snapshot, a.visit_purpose, a.in_at, a.out_at, d.work_type direct_work_type, d.status direct_work_status
      FROM crm_activity_event e
      JOIN crm_activity a ON a.event_id=e.event_id
      LEFT JOIN crm_direct_work d ON d.activity_id=a.activity_id
      WHERE e.company_id=@companyId AND e.owner_user_id=@ownerUserId
        AND e.start_at >= @from AND e.start_at < DATEADD(day,1,CAST(@to AS date))
      ORDER BY e.start_at`, { companyId, ownerUserId: owner, from, to });
    return r.recordset;
  }

  async mapToday(companyId: number, userId: number, date: string, latitude: number, longitude: number, radiusKm = 10) {
    const plans = await this.db.query(`
      SELECT CONVERT(varchar(36),public_id) public_id, status, planned_at, related_type, related_name_snapshot,
             target_latitude, target_longitude, visit_purpose, in_at, out_at
      FROM crm_activity
      WHERE company_id=@companyId AND owner_user_id=@userId AND planned_date=@date
      ORDER BY planned_at`, { companyId, userId, date });

    const hospitals = await this.db.query<any>(`
      SELECT TOP 500 'LEAD' related_type, lead_id related_id, CONVERT(varchar(36),public_id) public_id,
             hospital_name name, latitude, longitude, address, status entity_status
      FROM crm_lead WHERE company_id=@companyId AND deleted_yn=0 AND latitude IS NOT NULL AND longitude IS NOT NULL
      UNION ALL
      SELECT TOP 500 'ACCOUNT', account_id, CONVERT(varchar(36),public_id), account_name, latitude, longitude, address, account_status
      FROM crm_account WHERE company_id=@companyId AND deleted_yn=0 AND latitude IS NOT NULL AND longitude IS NOT NULL`, { companyId });
    const maxM = Math.max(0.1, Math.min(radiusKm, 50)) * 1000;
    const nearbyHospitals = hospitals.recordset
      .map((h: any) => ({ ...h, distance_m: Math.round(haversineMeters(latitude, longitude, Number(h.latitude), Number(h.longitude))) }))
      .filter((h: any) => h.distance_m <= maxM)
      .sort((a: any, b: any) => a.distance_m - b.distance_m)
      .slice(0, 200);
    return { date, userLocation: { latitude, longitude }, plans: plans.recordset, nearbyHospitals };
  }

  async checkIn(companyId: number, publicId: string, userId: number, gps: GpsInput) {
    return this.db.transaction(async query => {
      const ar = await query<any>(`SELECT TOP 1 * FROM crm_activity WITH(UPDLOCK,ROWLOCK)
        WHERE company_id=@companyId AND public_id=@publicId`, { companyId, publicId });
      const a = ar.recordset[0];
      if (!a) throw new NotFoundException('활동을 찾을 수 없습니다.');
      if (a.owner_user_id !== userId) throw new ForbiddenException('본인 활동만 IN 할 수 있습니다.');
      if (a.target_latitude == null || a.target_longitude == null) throw new BadRequestException('병원 좌표가 없어 GPS IN을 할 수 없습니다.');
      const open = await query<{ cnt: number }>(`SELECT COUNT(1) cnt FROM crm_activity
        WHERE company_id=@companyId AND owner_user_id=@userId AND status='IN_PROGRESS' AND activity_id<>@activityId`,
        { companyId, userId, activityId: a.activity_id });
      const allowedDistanceM = await this.gpsAllowedDistance(query, companyId);
      const distanceM = haversineMeters(gps.latitude, gps.longitude, Number(a.target_latitude), Number(a.target_longitude));
      const decision = canCheckIn({ status: a.status, hasOtherOpenActivity: open.recordset[0].cnt > 0, distanceM, allowedDistanceM });
      if (!decision.allowed) throw new BadRequestException(decision.error);
      await query(`UPDATE crm_activity SET status='IN_PROGRESS', in_at=SYSUTCDATETIME(), in_latitude=@latitude, in_longitude=@longitude,
        in_accuracy_m=@accuracyM, in_is_mocked=@isMocked, in_distance_m=@distanceM, updated_at=SYSUTCDATETIME(), updated_by=@userId
        WHERE activity_id=@activityId`, {
        latitude: gps.latitude, longitude: gps.longitude, accuracyM: gps.accuracyM ?? null, isMocked: gps.isMocked ?? null,
        distanceM: Math.round(distanceM * 100) / 100, userId, activityId: a.activity_id
      });
      return { publicId, status: 'IN_PROGRESS', distanceM: Math.round(distanceM), allowedDistanceM };
    });
  }

  async updateActivity(companyId: number, publicId: string, userId: number, input: { visitPurpose?: string; consultationContent?: string }) {
    return this.db.transaction(async query => {
      const ar = await query<any>(`SELECT TOP 1 * FROM crm_activity WITH(UPDLOCK,ROWLOCK) WHERE company_id=@companyId AND public_id=@publicId`, { companyId, publicId });
      const a = ar.recordset[0];
      if (!a) throw new NotFoundException('활동을 찾을 수 없습니다.');
      if (a.owner_user_id !== userId) throw new ForbiddenException('본인 활동만 수정할 수 있습니다.');
      const locked = await query<{ cnt: number }>(`SELECT COUNT(1) cnt FROM crm_activity_report_item i
        JOIN crm_activity_report r ON r.report_id=i.report_id
        WHERE i.activity_id=@activityId AND r.status='FINAL_APPROVED'`, { activityId: a.activity_id });
      const decision = canEditActivity(a.status, locked.recordset[0].cnt > 0);
      if (!decision.allowed) throw new BadRequestException(decision.error);
      await query(`UPDATE crm_activity SET visit_purpose=COALESCE(@visitPurpose,visit_purpose),
        consultation_content=COALESCE(@consultationContent,consultation_content), updated_at=SYSUTCDATETIME(), updated_by=@userId
        WHERE activity_id=@activityId`, {
        visitPurpose: input.visitPurpose ?? null, consultationContent: input.consultationContent ?? null, userId, activityId: a.activity_id
      });
      await query(`UPDATE crm_activity_event SET visit_purpose=COALESCE(@visitPurpose,visit_purpose), updated_at=SYSUTCDATETIME(), updated_by=@userId
        WHERE event_id=@eventId`, { visitPurpose: input.visitPurpose ?? null, userId, eventId: a.event_id });
      return this.activityById(query, companyId, a.activity_id);
    });
  }

  async checkOut(companyId: number, publicId: string, userId: number, gps: GpsInput) {
    return this.db.transaction(async query => {
      const ar = await query<any>(`SELECT TOP 1 * FROM crm_activity WITH(UPDLOCK,ROWLOCK) WHERE company_id=@companyId AND public_id=@publicId`, { companyId, publicId });
      const a = ar.recordset[0];
      if (!a) throw new NotFoundException('활동을 찾을 수 없습니다.');
      if (a.owner_user_id !== userId) throw new ForbiddenException('본인 활동만 OUT 할 수 있습니다.');
      if (a.status !== 'IN_PROGRESS') throw new BadRequestException('IN 진행중인 활동만 OUT 할 수 있습니다.');
      await query(`UPDATE crm_activity SET status='COMPLETED', out_at=SYSUTCDATETIME(), out_latitude=@latitude, out_longitude=@longitude,
        out_accuracy_m=@accuracyM, out_is_mocked=@isMocked, updated_at=SYSUTCDATETIME(), updated_by=@userId WHERE activity_id=@activityId`, {
        latitude: gps.latitude, longitude: gps.longitude, accuracyM: gps.accuracyM ?? null, isMocked: gps.isMocked ?? null, userId, activityId: a.activity_id
      });
      const dw = await query<{ direct_work_id: number }>(`SELECT direct_work_id FROM crm_direct_work WHERE activity_id=@activityId`, { activityId: a.activity_id });
      if (dw.recordset[0]) await this.queueDirectWorkErpIfReady(query, companyId, dw.recordset[0].direct_work_id);
      return { publicId, status: 'COMPLETED' };
    });
  }

  async prepareReport(companyId: number, userId: number, reportDate: string) {
    return this.db.transaction(async query => {
      let rr = await query<any>(`SELECT TOP 1 * FROM crm_activity_report WITH(UPDLOCK,ROWLOCK)
        WHERE company_id=@companyId AND reporter_user_id=@userId AND report_date=@reportDate`, { companyId, userId, reportDate });
      let report = rr.recordset[0];
      if (!report) {
        rr = await query<any>(`INSERT INTO crm_activity_report(company_id,reporter_user_id,report_date,status)
          OUTPUT inserted.* VALUES(@companyId,@userId,@reportDate,'DRAFT')`, { companyId, userId, reportDate });
        report = rr.recordset[0];
      }
      if (report.status !== 'DRAFT') return this.reportById(query, companyId, report.report_id);
      await query(`DELETE FROM crm_activity_report_item WHERE report_id=@reportId`, { reportId: report.report_id });
      await query(`INSERT INTO crm_activity_report_item(report_id,item_type,activity_id,planned_at_snapshot,related_name_snapshot,visit_purpose_snapshot,consultation_snapshot,sort_order)
        SELECT @reportId,'RESULT',activity_id,planned_at,related_name_snapshot,visit_purpose,consultation_content,ROW_NUMBER() OVER(ORDER BY planned_at)
        FROM crm_activity WHERE company_id=@companyId AND owner_user_id=@userId AND planned_date=@reportDate AND status='COMPLETED'`,
        { reportId: report.report_id, companyId, userId, reportDate });
      await query(`INSERT INTO crm_activity_report_item(report_id,item_type,activity_id,planned_at_snapshot,related_name_snapshot,visit_purpose_snapshot,consultation_snapshot,sort_order)
        SELECT @reportId,'PLAN',activity_id,planned_at,related_name_snapshot,visit_purpose,consultation_content,1000+ROW_NUMBER() OVER(ORDER BY planned_at)
        FROM crm_activity WHERE company_id=@companyId AND owner_user_id=@userId
          AND planned_date > @reportDate AND planned_date <= DATEADD(day,5,CAST(@reportDate AS date))`,
        { reportId: report.report_id, companyId, userId, reportDate });
      return this.reportById(query, companyId, report.report_id);
    });
  }

  async updateReportItem(companyId: number, reportPublicId: string, itemId: number, userId: number, input: { visitPurpose?: string; consultationContent?: string }) {
    const r = await this.db.query<any>(`SELECT r.report_id,r.reporter_user_id,r.status FROM crm_activity_report r
      WHERE r.company_id=@companyId AND r.public_id=@reportPublicId`, { companyId, reportPublicId });
    const report = r.recordset[0];
    if (!report) throw new NotFoundException('활동보고를 찾을 수 없습니다.');
    if (report.reporter_user_id !== userId) throw new ForbiddenException('본인 활동보고만 수정할 수 있습니다.');
    if (!['DRAFT','REQUESTED'].includes(report.status)) throw new BadRequestException('지점장 승인 이후에는 보고내용을 수정할 수 없습니다.');
    const u = await this.db.query(`UPDATE crm_activity_report_item SET visit_purpose_snapshot=COALESCE(@visitPurpose,visit_purpose_snapshot),
      consultation_snapshot=COALESCE(@consultationContent,consultation_snapshot)
      WHERE report_id=@reportId AND report_item_id=@itemId`, {
      visitPurpose: input.visitPurpose ?? null, consultationContent: input.consultationContent ?? null, reportId: report.report_id, itemId
    });
    if (!u.rowsAffected[0]) throw new NotFoundException('보고 항목을 찾을 수 없습니다.');
    return { reportPublicId, itemId, updated: true };
  }

  async requestReportApproval(companyId: number, reportPublicId: string, userId: number) {
    return this.db.transaction(async query => {
      const rr = await query<any>(`SELECT TOP 1 * FROM crm_activity_report WITH(UPDLOCK,ROWLOCK)
        WHERE company_id=@companyId AND public_id=@reportPublicId`, { companyId, reportPublicId });
      const report = rr.recordset[0];
      if (!report) throw new NotFoundException('활동보고를 찾을 수 없습니다.');
      if (report.reporter_user_id !== userId) throw new ForbiddenException('본인 활동보고만 승인요청할 수 있습니다.');
      if (report.status !== 'DRAFT') throw new ConflictException('이미 승인요청된 활동보고입니다.');
      const open = await query<{ cnt: number }>(`SELECT COUNT(1) cnt FROM crm_activity
        WHERE company_id=@companyId AND owner_user_id=@userId AND planned_date=@reportDate AND status='IN_PROGRESS'`,
        { companyId, userId, reportDate: report.report_date });
      if (open.recordset[0].cnt > 0) throw new BadRequestException('OUT하지 않은 활동이 있어 승인요청할 수 없습니다.');
      const route = await this.approvalRoute(query, companyId, userId, 'ACTIVITY_REPORT');
      await query(`UPDATE crm_activity_report SET status='REQUESTED', branch_approver_user_id=@branchId,
        division_approver_user_id=@divisionId, requested_at=SYSUTCDATETIME(), updated_at=SYSUTCDATETIME()
        WHERE report_id=@reportId`, { branchId: route.branch_approver_user_id, divisionId: route.division_approver_user_id, reportId: report.report_id });
      await this.notify(query, route.branch_approver_user_id, 'ACTIVITY_REPORT_APPROVAL', '활동보고 승인요청', `${report.report_date} 활동보고 승인요청이 도착했습니다.`);
      return { reportPublicId, status: 'REQUESTED' };
    });
  }

  async approveReport(companyId: number, reportPublicId: string, userId: number, step: 'BRANCH' | 'DIVISION', comment?: string) {
    return this.db.transaction(async query => {
      const rr = await query<any>(`SELECT TOP 1 * FROM crm_activity_report WITH(UPDLOCK,ROWLOCK)
        WHERE company_id=@companyId AND public_id=@reportPublicId`, { companyId, reportPublicId });
      const report = rr.recordset[0];
      if (!report) throw new NotFoundException('활동보고를 찾을 수 없습니다.');
      const expected = step === 'BRANCH' ? report.branch_approver_user_id : report.division_approver_user_id;
      if (expected !== userId) throw new ForbiddenException('현재 승인자로 지정되지 않았습니다.');
      const next = nextReportStatus(report.status as ReportStatus, step);
      if (!next) throw new BadRequestException('현재 상태에서 해당 승인을 처리할 수 없습니다.');
      await query(`INSERT INTO crm_approval_action(company_id,target_type,target_id,approval_round,step_code,approver_user_id,action,comment)
        VALUES(@companyId,'ACTIVITY_REPORT',@targetId,1,@step,@userId,'APPROVED',@comment)`, {
        companyId, targetId: report.report_id, step, userId, comment: comment ?? null
      });
      if (step === 'BRANCH') {
        await query(`UPDATE crm_activity_report SET status='BRANCH_APPROVED', branch_approved_at=SYSUTCDATETIME(), updated_at=SYSUTCDATETIME() WHERE report_id=@reportId`, { reportId: report.report_id });
        await this.notify(query, report.division_approver_user_id, 'ACTIVITY_REPORT_APPROVAL', '활동보고 본부장 승인대기', `${report.report_date} 활동보고가 지점장 승인되었습니다.`);
      } else {
        await query(`UPDATE crm_activity_report SET status='FINAL_APPROVED', division_approved_at=SYSUTCDATETIME(), final_approved_at=SYSUTCDATETIME(), updated_at=SYSUTCDATETIME() WHERE report_id=@reportId`, { reportId: report.report_id });
        await this.notify(query, report.reporter_user_id, 'ACTIVITY_REPORT_APPROVED', '활동보고 최종 승인', `${report.report_date} 활동보고가 최종 승인되었습니다.`);
      }
      return { reportPublicId, status: next };
    });
  }

  async listReports(companyId: number, userId: number, permissions: string[]) {
    const manager = permissions.includes('ACTIVITY.REPORT.APPROVE.BRANCH') || permissions.includes('ACTIVITY.REPORT.APPROVE.DIVISION');
    const r = await this.db.query(`SELECT TOP 200 CONVERT(varchar(36),public_id) public_id, reporter_user_id, report_date, status,
      branch_approver_user_id,division_approver_user_id,requested_at,final_approved_at
      FROM crm_activity_report WHERE company_id=@companyId AND
      (@manager=1 OR reporter_user_id=@userId OR branch_approver_user_id=@userId OR division_approver_user_id=@userId)
      ORDER BY report_date DESC,report_id DESC`, { companyId, manager: manager ? 1 : 0, userId });
    return r.recordset;
  }

  async listDirectWorks(companyId: number, userId: number) {
    const r = await this.db.query(`SELECT TOP 200 CONVERT(varchar(36),d.public_id) public_id,d.work_type,d.reason,d.status,d.approval_round,
      d.owner_user_id,d.branch_approver_user_id,d.division_approver_user_id,d.erp_sync_status,
      CONVERT(varchar(36),a.public_id) activity_public_id,a.related_name_snapshot,a.planned_at,a.status activity_status
      FROM crm_direct_work d JOIN crm_activity a ON a.activity_id=d.activity_id
      WHERE d.company_id=@companyId AND (d.owner_user_id=@userId OR d.branch_approver_user_id=@userId OR d.division_approver_user_id=@userId)
      ORDER BY d.direct_work_id DESC`, { companyId, userId });
    return r.recordset;
  }

  async requestDirectWork(companyId: number, publicId: string, userId: number) {
    return this.db.transaction(async query => {
      const dr = await query<any>(`SELECT TOP 1 * FROM crm_direct_work WITH(UPDLOCK,ROWLOCK) WHERE company_id=@companyId AND public_id=@publicId`, { companyId, publicId });
      const dw = dr.recordset[0];
      if (!dw) throw new NotFoundException('직출/직퇴 건을 찾을 수 없습니다.');
      if (dw.owner_user_id !== userId) throw new ForbiddenException('본인 직출/직퇴 건만 요청할 수 있습니다.');
      const resubmit = canResubmitDirectWork(dw.status as DirectWorkStatus);
      if (dw.status !== 'DRAFT' && !resubmit) throw new BadRequestException('현재 상태에서는 승인요청할 수 없습니다.');
      const route = await this.approvalRoute(query, companyId, userId, 'DIRECT_WORK');
      const round = resubmit ? Number(dw.approval_round) + 1 : Number(dw.approval_round);
      await query(`UPDATE crm_direct_work SET status='REQUESTED',approval_round=@round,branch_approver_user_id=@branchId,
        division_approver_user_id=@divisionId,requested_at=SYSUTCDATETIME(),branch_approved_at=NULL,division_approved_at=NULL,rejected_at=NULL,
        updated_at=SYSUTCDATETIME(),updated_by=@userId WHERE direct_work_id=@directWorkId`, {
        round, branchId: route.branch_approver_user_id, divisionId: route.division_approver_user_id, userId, directWorkId: dw.direct_work_id
      });
      await this.notify(query, route.branch_approver_user_id, 'DIRECT_WORK_APPROVAL', '직출/직퇴 승인요청', '직출/직퇴 승인요청이 도착했습니다.');
      return { publicId, status: 'REQUESTED', approvalRound: round };
    });
  }

  async decideDirectWork(companyId: number, publicId: string, userId: number, step: 'BRANCH' | 'DIVISION', action: 'APPROVE' | 'REJECT', comment?: string) {
    return this.db.transaction(async query => {
      const dr = await query<any>(`SELECT TOP 1 * FROM crm_direct_work WITH(UPDLOCK,ROWLOCK) WHERE company_id=@companyId AND public_id=@publicId`, { companyId, publicId });
      const dw = dr.recordset[0];
      if (!dw) throw new NotFoundException('직출/직퇴 건을 찾을 수 없습니다.');
      const expected = step === 'BRANCH' ? dw.branch_approver_user_id : dw.division_approver_user_id;
      if (expected !== userId) throw new ForbiddenException('현재 승인자로 지정되지 않았습니다.');
      const next = nextDirectWorkStatus(dw.status as DirectWorkStatus, step, action);
      if (!next) throw new BadRequestException('현재 상태에서 해당 승인/반려를 처리할 수 없습니다.');
      await query(`INSERT INTO crm_approval_action(company_id,target_type,target_id,approval_round,step_code,approver_user_id,action,comment)
        VALUES(@companyId,'DIRECT_WORK',@targetId,@round,@step,@userId,@action,@comment)`, {
        companyId, targetId: dw.direct_work_id, round: dw.approval_round, step, userId, action: action === 'APPROVE' ? 'APPROVED' : 'REJECTED', comment: comment ?? null
      });
      if (next === 'BRANCH_APPROVED') {
        await query(`UPDATE crm_direct_work SET status=@status,branch_approved_at=SYSUTCDATETIME(),updated_at=SYSUTCDATETIME() WHERE direct_work_id=@id`, { status: next, id: dw.direct_work_id });
        await this.notify(query, dw.division_approver_user_id, 'DIRECT_WORK_APPROVAL', '직출/직퇴 본부장 승인대기', '지점장 승인된 직출/직퇴 건이 있습니다.');
      } else if (next === 'DIVISION_APPROVED') {
        await query(`UPDATE crm_direct_work SET status=@status,division_approved_at=SYSUTCDATETIME(),updated_at=SYSUTCDATETIME() WHERE direct_work_id=@id`, { status: next, id: dw.direct_work_id });
        await this.queueDirectWorkErpIfReady(query, companyId, dw.direct_work_id);
        await this.notify(query, dw.owner_user_id, 'DIRECT_WORK_APPROVED', '직출/직퇴 승인완료', '직출/직퇴가 본부장 승인되었습니다.');
      } else {
        await query(`UPDATE crm_direct_work SET status=@status,rejected_at=SYSUTCDATETIME(),updated_at=SYSUTCDATETIME() WHERE direct_work_id=@id`, { status: next, id: dw.direct_work_id });
        await this.notify(query, dw.owner_user_id, 'DIRECT_WORK_REJECTED', '직출/직퇴 반려', '직출/직퇴가 반려되었습니다. 사유를 확인 후 재요청할 수 있습니다.');
      }
      return { publicId, status: next, approvalRound: dw.approval_round };
    });
  }

  private async createPlanTx(query: DbQuery, companyId: number, userId: number, input: PlanInput) {
    const valid = validatePlanInput(input);
    if (!valid.allowed) throw new BadRequestException(valid.error);
    const target = await this.relatedTarget(query, companyId, input.relatedType, input.relatedPublicId);
    const plannedDate = input.plannedAt.slice(0, 10);
    const dup = await query<{ cnt: number }>(`SELECT COUNT(1) cnt FROM crm_activity WHERE company_id=@companyId AND owner_user_id=@userId
      AND related_type=@relatedType AND related_id=@relatedId AND planned_date=@plannedDate`, {
      companyId, userId, relatedType: input.relatedType, relatedId: target.id, plannedDate
    });
    if (dup.recordset[0].cnt > 0) throw new ConflictException('동일 Lead/Account/Opportunity의 같은 날짜 활동계획이 이미 있습니다.');
    const subject = input.subject?.trim() || `${target.name} 방문`;
    const er = await query<{ event_id: number; public_id: string }>(`INSERT INTO crm_activity_event(company_id,owner_user_id,subject,start_at,end_at,related_type,related_id,is_activity_plan,visit_purpose,direct_work_type,direct_work_reason,created_by)
      OUTPUT inserted.event_id,CONVERT(varchar(36),inserted.public_id) public_id
      VALUES(@companyId,@userId,@subject,@plannedAt,DATEADD(hour,1,@plannedAt),@relatedType,@relatedId,1,@visitPurpose,@directWorkType,@directWorkReason,@userId)`, {
      companyId, userId, subject, plannedAt: input.plannedAt, relatedType: input.relatedType, relatedId: target.id,
      visitPurpose: input.visitPurpose ?? null, directWorkType: input.directWorkType ?? null, directWorkReason: input.directWorkReason ?? null
    });
    const event = er.recordset[0];
    const ar = await query<{ activity_id: number; public_id: string }>(`INSERT INTO crm_activity(company_id,event_id,owner_user_id,related_type,related_id,related_name_snapshot,target_latitude,target_longitude,
      planned_date,planned_at,visit_purpose,status,created_by)
      OUTPUT inserted.activity_id,CONVERT(varchar(36),inserted.public_id) public_id
      VALUES(@companyId,@eventId,@userId,@relatedType,@relatedId,@relatedName,@latitude,@longitude,@plannedDate,@plannedAt,@visitPurpose,'PLANNED',@userId)`, {
      companyId, eventId: event.event_id, userId, relatedType: input.relatedType, relatedId: target.id, relatedName: target.name,
      latitude: target.latitude, longitude: target.longitude, plannedDate, plannedAt: input.plannedAt, visitPurpose: input.visitPurpose ?? null
    });
    const activity = ar.recordset[0];
    let directWorkPublicId: string | null = null;
    if (input.directWorkType) {
      const dr = await query<{ public_id: string }>(`INSERT INTO crm_direct_work(company_id,activity_id,owner_user_id,work_type,reason,status,created_by)
        OUTPUT CONVERT(varchar(36),inserted.public_id) public_id VALUES(@companyId,@activityId,@userId,@workType,@reason,'DRAFT',@userId)`, {
        companyId, activityId: activity.activity_id, userId, workType: input.directWorkType, reason: input.directWorkReason
      });
      directWorkPublicId = dr.recordset[0].public_id;
    }
    return { eventPublicId: event.public_id, activityPublicId: activity.public_id, directWorkPublicId, status: 'PLANNED' };
  }

  private async relatedTarget(query: DbQuery, companyId: number, type: PlanInput['relatedType'], publicId: string) {
    let sql: string;
    if (type === 'LEAD') sql = `SELECT TOP 1 lead_id id,hospital_name name,latitude,longitude FROM crm_lead WHERE company_id=@companyId AND public_id=@publicId AND deleted_yn=0`;
    else if (type === 'ACCOUNT') sql = `SELECT TOP 1 account_id id,account_name name,latitude,longitude FROM crm_account WHERE company_id=@companyId AND public_id=@publicId AND deleted_yn=0`;
    else sql = `SELECT TOP 1 o.opportunity_id id,o.opportunity_name name,a.latitude,a.longitude FROM crm_opportunity o JOIN crm_account a ON a.account_id=o.account_id WHERE o.company_id=@companyId AND o.public_id=@publicId`;
    const r = await query<any>(sql, { companyId, publicId });
    if (!r.recordset[0]) throw new NotFoundException('연결할 Lead/Account/Opportunity를 찾을 수 없습니다.');
    return r.recordset[0] as { id: number; name: string; latitude: number | null; longitude: number | null };
  }

  private async gpsAllowedDistance(query: DbQuery, companyId: number) {
    const r = await query<{ setting_value: string }>(`SELECT TOP 1 setting_value FROM crm_system_setting
      WHERE setting_key='ACTIVITY_GPS_IN_DISTANCE_M' AND (company_id=@companyId OR company_id IS NULL)
      ORDER BY CASE WHEN company_id=@companyId THEN 0 ELSE 1 END`, { companyId });
    const value = Number(r.recordset[0]?.setting_value ?? '200');
    return Number.isFinite(value) && value > 0 ? value : 200;
  }

  private async approvalRoute(query: DbQuery, companyId: number, userId: number, approvalType: 'ACTIVITY_REPORT' | 'DIRECT_WORK') {
    const r = await query<any>(`SELECT TOP 1 ar.branch_approver_user_id,ar.division_approver_user_id
      FROM crm_user u JOIN crm_approval_route ar ON ar.company_id=u.company_id AND ar.organization_id=u.organization_id
      WHERE u.company_id=@companyId AND u.user_id=@userId AND ar.approval_type=@approvalType AND ar.is_active=1`,
      { companyId, userId, approvalType });
    if (!r.recordset[0]) throw new BadRequestException(`${approvalType} 승인경로가 설정되지 않았습니다.`);
    return r.recordset[0];
  }

  private async activityById(query: DbQuery, companyId: number, activityId: number) {
    const r = await query(`SELECT TOP 1 CONVERT(varchar(36),public_id) public_id,status,visit_purpose,consultation_content,in_at,out_at
      FROM crm_activity WHERE company_id=@companyId AND activity_id=@activityId`, { companyId, activityId });
    return r.recordset[0];
  }

  private async reportById(query: DbQuery, companyId: number, reportId: number) {
    const rr = await query<any>(`SELECT TOP 1 CONVERT(varchar(36),public_id) public_id,report_date,status,requested_at,final_approved_at
      FROM crm_activity_report WHERE company_id=@companyId AND report_id=@reportId`, { companyId, reportId });
    const items = await query(`SELECT report_item_id,item_type,activity_id,planned_at_snapshot,related_name_snapshot,visit_purpose_snapshot,consultation_snapshot
      FROM crm_activity_report_item WHERE report_id=@reportId ORDER BY sort_order,report_item_id`, { reportId });
    return { ...rr.recordset[0], items: items.recordset };
  }

  private async notify(query: DbQuery, userId: number, type: string, title: string, body: string) {
    await query(`INSERT INTO crm_notification(user_id,notification_type,title,body) VALUES(@userId,@type,@title,@body)`, { userId, type, title, body });
  }

  private async queueDirectWorkErpIfReady(query: DbQuery, companyId: number, directWorkId: number) {
    const r = await query<any>(`SELECT d.*,a.status activity_status,CONVERT(varchar(36),a.public_id) activity_public_id
      FROM crm_direct_work d JOIN crm_activity a ON a.activity_id=d.activity_id WHERE d.direct_work_id=@directWorkId`, { directWorkId });
    const dw = r.recordset[0];
    if (!dw || dw.status !== 'DIVISION_APPROVED' || dw.activity_status !== 'COMPLETED' || dw.erp_sync_status !== 'NOT_REQUESTED') return;
    const requestId = crypto.randomUUID();
    const payload = { directWorkPublicId: String(dw.public_id), activityPublicId: dw.activity_public_id, workType: dw.work_type, reason: dw.reason };
    await query(`UPDATE crm_direct_work SET erp_sync_status='REQUESTING',erp_request_id=@requestId,updated_at=SYSUTCDATETIME() WHERE direct_work_id=@directWorkId`,
      { requestId, directWorkId });
    await query(`INSERT INTO crm_interface_log(company_id,request_id,interface_code,direction,entity_type,entity_id,request_json,status,retry_count,requested_at)
      VALUES(@companyId,@requestId,'IF-ERP-012','OUT','DIRECT_WORK',CONVERT(varchar(100),@directWorkId),@payload,'REQUESTING',0,SYSUTCDATETIME())`,
      { companyId, requestId, directWorkId, payload: JSON.stringify(payload) });
  }
}
