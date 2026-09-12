import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ApprovalRouteService {
  constructor(private readonly db: DatabaseService) {}

  async list(companyId: number) {
    const r = await this.db.query(`
      SELECT ar.approval_route_id, ar.approval_type,
             CONVERT(varchar(36),o.public_id) organization_public_id, o.organization_name,
             CONVERT(varchar(36),bu.public_id) branch_approver_public_id, bu.user_name branch_approver_name,
             CONVERT(varchar(36),du.public_id) division_approver_public_id, du.user_name division_approver_name,
             ar.is_active
      FROM crm_approval_route ar
      JOIN crm_organization o ON o.organization_id=ar.organization_id
      JOIN crm_user bu ON bu.user_id=ar.branch_approver_user_id
      JOIN crm_user du ON du.user_id=ar.division_approver_user_id
      WHERE ar.company_id=@companyId
      ORDER BY o.organization_name, ar.approval_type`, { companyId });
    return r.recordset;
  }

  async upsert(companyId: number, input: {
    organizationPublicId: string;
    approvalType: 'ACTIVITY_REPORT' | 'DIRECT_WORK';
    branchApproverPublicId: string;
    divisionApproverPublicId: string;
    isActive?: boolean;
  }) {
    const ids = await this.db.query<any>(`
      SELECT
        (SELECT organization_id FROM crm_organization WHERE company_id=@companyId AND public_id=@organizationPublicId AND deleted_yn=0) organization_id,
        (SELECT user_id FROM crm_user WHERE company_id=@companyId AND public_id=@branchPublicId AND deleted_yn=0) branch_user_id,
        (SELECT user_id FROM crm_user WHERE company_id=@companyId AND public_id=@divisionPublicId AND deleted_yn=0) division_user_id`, {
      companyId,
      organizationPublicId: input.organizationPublicId,
      branchPublicId: input.branchApproverPublicId,
      divisionPublicId: input.divisionApproverPublicId
    });
    const x = ids.recordset[0];
    if (!x?.organization_id || !x?.branch_user_id || !x?.division_user_id) throw new BadRequestException('조직 또는 승인자를 찾을 수 없습니다.');
    await this.db.query(`
      MERGE crm_approval_route AS t
      USING (SELECT @companyId company_id,@organizationId organization_id,@approvalType approval_type) s
      ON t.company_id=s.company_id AND t.organization_id=s.organization_id AND t.approval_type=s.approval_type
      WHEN MATCHED THEN UPDATE SET branch_approver_user_id=@branchUserId,division_approver_user_id=@divisionUserId,is_active=@isActive,updated_at=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT(company_id,organization_id,approval_type,branch_approver_user_id,division_approver_user_id,is_active)
        VALUES(@companyId,@organizationId,@approvalType,@branchUserId,@divisionUserId,@isActive);`, {
      companyId,
      organizationId: x.organization_id,
      approvalType: input.approvalType,
      branchUserId: x.branch_user_id,
      divisionUserId: x.division_user_id,
      isActive: input.isActive === false ? 0 : 1
    });
    return { saved: true };
  }
}
