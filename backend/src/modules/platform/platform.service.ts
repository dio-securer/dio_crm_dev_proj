import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class PlatformService {
  constructor(private readonly db: DatabaseService) {}

  async health() {
    const db = await this.db.ping();
    return { status: db ? 'ok' : 'degraded', database: db ? 'up' : 'down', at: new Date().toISOString() };
  }

  users(companyId: number) {
    return this.db.query(`
      SELECT user_id, public_id, login_id, user_name, email, organization_id, erp_user_code, is_active
      FROM crm_user WHERE company_id=@companyId AND deleted_yn=0 ORDER BY user_name
    `, { companyId }).then(r => r.recordset);
  }

  organizations(companyId: number) {
    return this.db.query(`
      SELECT organization_id, public_id, organization_code, organization_name, organization_type,
             parent_organization_id, erp_org_code, is_active
      FROM crm_organization WHERE company_id=@companyId AND deleted_yn=0 ORDER BY organization_name
    `, { companyId }).then(r => r.recordset);
  }

  commonCodes(groupCode: string) {
    return this.db.query(`
      SELECT code, code_name, sort_order, is_active
      FROM crm_common_code WHERE group_code=@groupCode AND deleted_yn=0 ORDER BY sort_order, code
    `, { groupCode }).then(r => r.recordset);
  }

  notifications(userId: number) {
    return this.db.query(`
      SELECT TOP 100 notification_id, notification_type, title, body, read_at, created_at
      FROM crm_notification WHERE user_id=@userId ORDER BY notification_id DESC
    `, { userId }).then(r => r.recordset);
  }

  async registerFile(input: { entityType: string; entityPublicId: string; originalName: string; contentType?: string; sizeBytes: number; storageKey: string }, userId: number) {
    const publicId = crypto.randomUUID();
    await this.db.query(`
      INSERT INTO crm_file_metadata(public_id, entity_type, entity_public_id, original_name, content_type, size_bytes, storage_key, created_by)
      VALUES(@publicId,@entityType,@entityPublicId,@originalName,@contentType,@sizeBytes,@storageKey,@userId)
    `, { publicId, ...input, userId });
    return { publicId };
  }

  auditLogs(companyId: number) {
    return this.db.query(`
      SELECT TOP 200 audit_log_id, entity_type, entity_id, action, actor_user_id, request_id, created_at
      FROM crm_audit_log WHERE company_id=@companyId ORDER BY audit_log_id DESC
    `, { companyId }).then(r => r.recordset);
  }

  interfaceLogs(companyId: number) {
    return this.db.query(`
      SELECT TOP 200 interface_log_id, request_id, interface_code, direction, entity_type, entity_id,
             status, retry_count, requested_at, responded_at, error_message
      FROM crm_interface_log WHERE company_id=@companyId ORDER BY interface_log_id DESC
    `, { companyId }).then(r => r.recordset);
  }
}
