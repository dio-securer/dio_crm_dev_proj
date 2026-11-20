import { configAssert } from './config-store.js';
import type { SqlLeadExtensionTrust } from './sql-lead-extension-adapter.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const version = /^0x[0-9a-f]{16}$/i;

/** Local preparation only. There is no published extension snapshot contract yet.
 * Never register this as a product adapter until the publication and base-write
 * contracts are independently reviewed and implemented. */
export const incompleteSqlLeadExtensionTrust: SqlLeadExtensionTrust = {
  loadPublishedSnapshot: async () => null,
  loadLead: async (domain, recordId) => {
    configAssert(Number.isSafeInteger(domain.companyKey) && domain.companyKey > 0 && uuid.test(recordId), 400, 'INVALID_CONTEXT');
    const rows = await domain.query<{ company_public_id: string; lead_public_id: string; owner_public_id: string; version: string }>(
      `SELECT CONVERT(varchar(36),c.public_id) company_public_id,CONVERT(varchar(36),l.public_id) lead_public_id,CONVERT(varchar(36),u.public_id) owner_public_id,CONVERT(varchar(18),l.row_version,1) version
       FROM dbo.crm_lead l WITH(UPDLOCK,HOLDLOCK)
       JOIN dbo.crm_company c WITH(HOLDLOCK) ON c.company_id=l.company_id
       JOIN dbo.crm_user u WITH(HOLDLOCK) ON u.user_id=l.owner_user_id AND u.company_id=l.company_id AND u.deleted_yn=0
       WHERE l.company_id=@companyKey AND l.public_id=@recordId AND l.deleted_yn=0`,
      { companyKey: domain.companyKey, recordId: recordId.toLowerCase() }
    );
    if (rows.recordset.length !== 1) return null;
    const row = rows.recordset[0];
    if (typeof row.company_public_id !== 'string' || typeof row.lead_public_id !== 'string' || typeof row.owner_public_id !== 'string' || typeof row.version !== 'string' || !uuid.test(row.company_public_id) || !uuid.test(row.lead_public_id) || !uuid.test(row.owner_public_id) || !version.test(row.version) || row.lead_public_id.toLowerCase() !== recordId.toLowerCase()) return null;
    return { companyId: row.company_public_id.toLowerCase(), id: row.lead_public_id.toLowerCase(), ownerId: row.owner_public_id.toLowerCase(), version: row.version.toLowerCase(), deleted: false };
  },
  currentFieldGrant: async (domain, actorId, fieldId, operation) => {
    if (!Number.isSafeInteger(domain.companyKey) || domain.companyKey <= 0 || !uuid.test(actorId) || !uuid.test(fieldId) || !['read', 'write'].includes(operation)) return false;
    const permission = `fields.${fieldId.toLowerCase()}.${operation}`;
    const result = await domain.query<{ permission_code: string }>(
      `SELECT DISTINCT p.permission_code FROM dbo.crm_user u WITH(HOLDLOCK)
       JOIN dbo.crm_user_role ur WITH(HOLDLOCK) ON ur.user_id=u.user_id
       JOIN dbo.crm_role r WITH(HOLDLOCK) ON r.role_id=ur.role_id
       JOIN dbo.crm_role_permission rp WITH(HOLDLOCK) ON rp.role_id=r.role_id
       JOIN dbo.crm_permission p WITH(HOLDLOCK) ON p.permission_id=rp.permission_id
       WHERE u.company_id=@companyKey AND u.public_id=@actorId AND u.is_active=1 AND u.deleted_yn=0
         AND r.is_active=1 AND p.is_active=1 AND p.permission_code=@permission`,
      { companyKey: domain.companyKey, actorId: actorId.toLowerCase(), permission }
    );
    return result.recordset.some(row => row.permission_code === permission);
  },
  assertBaseWrite: async () => { configAssert(false, 503, 'EXTENSION_BASE_WRITE_UNAVAILABLE'); },
  writeBase: async () => { configAssert(false, 503, 'EXTENSION_BASE_WRITE_UNAVAILABLE'); }
};
