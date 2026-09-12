import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import crypto from 'node:crypto';
import { DatabaseService, DbQuery } from '../../database/database.service';
import { canTransitionLead, LeadStatus } from './customer.rules';

export type HiraHospitalInput = {
  encryptedProviderNo: string;
  hospitalName: string;
  phone?: string;
  address?: string;
  sido?: string;
  sigungu?: string;
  eupmyeondong?: string;
  latitude?: number;
  longitude?: number;
  providerNo?: string;
  openDate?: string;
};

@Injectable()
export class CustomerService {
  constructor(private readonly db: DatabaseService) {}

  async importHira(companyId: number, hospitals: HiraHospitalInput[]) {
    const batchId = crypto.randomUUID();
    let created = 0;
    let updated = 0;
    for (const h of hospitals) {
      await this.db.transaction(async query => {
        await query(`INSERT INTO crm_hira_hospital_inbox(company_id,batch_id,encrypted_provider_no,hospital_name,payload_json)
          VALUES(@companyId,@batchId,@encryptedProviderNo,@hospitalName,@payloadJson)`, {
          companyId, batchId, encryptedProviderNo: h.encryptedProviderNo, hospitalName: h.hospitalName, payloadJson: JSON.stringify(h)
        });
        const found = await query<{ lead_id: number }>(`SELECT lead_id FROM crm_lead WHERE company_id=@companyId AND encrypted_provider_no=@encryptedProviderNo`, {
          companyId, encryptedProviderNo: h.encryptedProviderNo
        });
        if (found.recordset[0]) {
          await query(`UPDATE crm_lead SET hospital_name=@hospitalName, phone=@phone, address=@address, sido=@sido, sigungu=@sigungu,
            eupmyeondong=@eupmyeondong, latitude=@latitude, longitude=@longitude, provider_no=@providerNo,
            open_date=@openDate, updated_at=SYSUTCDATETIME()
            WHERE lead_id=@leadId AND hira_sync_exclude_yn=0`, { ...this.hiraParams(h), leadId: found.recordset[0].lead_id });
          updated += 1;
        } else {
          const owner = await this.findAreaOwner(query, companyId, h.sido, h.sigungu);
          await query(`INSERT INTO crm_lead(company_id,owner_user_id,status,lead_source,hospital_name,phone,address,sido,sigungu,eupmyeondong,
            latitude,longitude,encrypted_provider_no,provider_no,open_date)
            VALUES(@companyId,@ownerUserId,'NEW','HIRA',@hospitalName,@phone,@address,@sido,@sigungu,@eupmyeondong,
            @latitude,@longitude,@encryptedProviderNo,@providerNo,@openDate)`, { companyId, ownerUserId: owner, ...this.hiraParams(h) });
          created += 1;
        }
        await query(`UPDATE crm_hira_hospital_inbox SET process_status='SUCCESS', processed_at=SYSUTCDATETIME()
          WHERE company_id=@companyId AND batch_id=@batchId AND encrypted_provider_no=@encryptedProviderNo`, {
          companyId, batchId, encryptedProviderNo: h.encryptedProviderNo
        });
      });
    }
    return { batchId, received: hospitals.length, created, updated };
  }

  async listLeads(companyId: number, ownerUserId?: number, status?: string, search?: string) {
    const r = await this.db.query(`SELECT TOP 500 l.lead_id, CONVERT(varchar(36),l.public_id) public_id, l.hospital_name, l.status, l.owner_user_id,
      u.user_name owner_name, l.phone, l.address, l.sido, l.sigungu, l.business_no, l.updated_at
      FROM crm_lead l LEFT JOIN crm_user u ON u.user_id=l.owner_user_id
      WHERE l.company_id=@companyId AND l.deleted_yn=0
        AND (@ownerUserId IS NULL OR l.owner_user_id=@ownerUserId)
        AND (@status IS NULL OR l.status=@status)
        AND (@search IS NULL OR l.hospital_name LIKE '%' + @search + '%' OR l.business_no LIKE '%' + @search + '%')
      ORDER BY l.lead_id DESC`, { companyId, ownerUserId: ownerUserId ?? null, status: status ?? null, search: search?.trim() || null });
    return r.recordset;
  }

  async getLead(companyId: number, publicId: string) {
    const r = await this.db.query(`SELECT TOP 1 *, CONVERT(varchar(36),public_id) public_id_text FROM crm_lead
      WHERE company_id=@companyId AND public_id=@publicId AND deleted_yn=0`, { companyId, publicId });
    if (!r.recordset[0]) throw new NotFoundException('Lead not found');
    return r.recordset[0];
  }

  async updateLead(companyId: number, publicId: string, input: Record<string, unknown>, userId: number, permissions: string[]) {
    const lead = await this.getLead(companyId, publicId) as any;
    if (lead.status === 'CONVERTED') throw new ConflictException('Converted lead cannot be modified');
    if (lead.owner_user_id !== userId && !permissions.includes('LEAD.MANAGE')) throw new ForbiddenException('Only owner or manager can modify lead');
    const allowed: Record<string, string> = {
      hospitalName: 'hospital_name', phone: 'phone', address: 'address', businessNo: 'business_no', keymanName: 'keyman_name',
      keymanType: 'keyman_type', keymanMobile: 'keyman_mobile', keymanEmail: 'keyman_email', school: 'school', cohort: 'cohort',
      major: 'major', mainSystem: 'main_system', subSystem: 'sub_system', contactExcludeReason: 'contact_exclude_reason'
    };
    const entries = Object.entries(input).filter(([k]) => allowed[k]);
    if (!entries.length) return lead;
    const sets = entries.map(([k], i) => `${allowed[k]}=@v${i}`);
    const params: Record<string, unknown> = { companyId, publicId, userId };
    entries.forEach(([, v], i) => params[`v${i}`] = v ?? null);
    await this.db.query(`UPDATE crm_lead SET ${sets.join(',')}, updated_at=SYSUTCDATETIME(), updated_by=@userId
      WHERE company_id=@companyId AND public_id=@publicId`, params);
    return this.getLead(companyId, publicId);
  }

  async assignOwner(companyId: number, publicId: string, ownerUserId: number, actorUserId: number) {
    const r = await this.db.query(`UPDATE crm_lead SET owner_user_id=@ownerUserId, updated_at=SYSUTCDATETIME(), updated_by=@actorUserId
      OUTPUT CONVERT(varchar(36),inserted.public_id) public_id, inserted.owner_user_id
      WHERE company_id=@companyId AND public_id=@publicId AND deleted_yn=0 AND status<>'CONVERTED'`,
      { companyId, publicId, ownerUserId, actorUserId });
    if (!r.recordset[0]) throw new NotFoundException('Editable lead not found');
    return r.recordset[0];
  }

  async transitionLead(companyId: number, publicId: string, toStatus: LeadStatus, reason: string | undefined, userId: number, permissions: string[]) {
    return this.db.transaction(async query => {
      const r = await query<{ lead_id: number; status: LeadStatus; owner_user_id: number | null }>(`SELECT lead_id,status,owner_user_id FROM crm_lead WITH(UPDLOCK,ROWLOCK)
        WHERE company_id=@companyId AND public_id=@publicId AND deleted_yn=0`, { companyId, publicId });
      const lead = r.recordset[0];
      if (!lead) throw new NotFoundException('Lead not found');
      if (lead.owner_user_id !== userId && !permissions.includes('LEAD.MANAGE')) throw new ForbiddenException('Only owner or manager can change lead status');
      const decision = canTransitionLead(lead.status, toStatus, permissions, reason);
      if (!decision.allowed) throw new BadRequestException(decision.error);
      await query(`UPDATE crm_lead SET status=@toStatus, contact_exclude_reason=CASE WHEN @toStatus='CONTACT_EXCLUDED' THEN @reason ELSE contact_exclude_reason END,
        updated_at=SYSUTCDATETIME(), updated_by=@userId WHERE lead_id=@leadId`, { toStatus, reason: reason ?? null, userId, leadId: lead.lead_id });
      await query(`INSERT INTO crm_lead_status_history(lead_id,from_status,to_status,reason,changed_by)
        VALUES(@leadId,@fromStatus,@toStatus,@reason,@userId)`, { leadId: lead.lead_id, fromStatus: lead.status, toStatus, reason: reason ?? null, userId });
      return { publicId, fromStatus: lead.status, toStatus, reverse: decision.reverse };
    });
  }

  async listAccounts(companyId: number, search?: string) {
    const r = await this.db.query(`SELECT TOP 500 account_id, CONVERT(varchar(36),public_id) public_id, account_name, account_status, business_no,
      erp_customer_code, erp_approved_yn, integration_status, owner_user_id, updated_at
      FROM crm_account WHERE company_id=@companyId AND deleted_yn=0
      AND (@search IS NULL OR account_name LIKE '%' + @search + '%' OR business_no LIKE '%' + @search + '%')
      ORDER BY account_id DESC`, { companyId, search: search?.trim() || null });
    return r.recordset;
  }

  async duplicateAccounts(companyId: number, businessNo: string) {
    const r = await this.db.query(`SELECT account_id, CONVERT(varchar(36),public_id) public_id, account_name, business_no, erp_customer_code, account_status
      FROM crm_account WHERE company_id=@companyId AND business_no=@businessNo AND deleted_yn=0 ORDER BY account_id`, { companyId, businessNo });
    return r.recordset;
  }

  async mergeAccounts(companyId: number, primaryPublicId: string, duplicatePublicIds: string[], userId: number) {
    const ids = [...new Set(duplicatePublicIds)].filter(x => x !== primaryPublicId);
    if (!ids.length || ids.length > 2) throw new BadRequestException('Merge supports 1 primary + up to 2 duplicates');
    return this.db.transaction(async query => {
      const primary = await this.accountByPublicId(query, companyId, primaryPublicId);
      for (const dupPublicId of ids) {
        const dup = await this.accountByPublicId(query, companyId, dupPublicId);
        if (dup.erp_customer_code && primary.erp_customer_code && dup.erp_customer_code !== primary.erp_customer_code) {
          throw new ConflictException('Different ERP customer codes require manual review');
        }
        await query(`UPDATE crm_contact SET account_id=@primaryId, updated_at=SYSUTCDATETIME(), updated_by=@userId WHERE account_id=@duplicateId AND deleted_yn=0`,
          { primaryId: primary.account_id, duplicateId: dup.account_id, userId });
        await query(`UPDATE crm_opportunity SET account_id=@primaryId, updated_at=SYSUTCDATETIME(), updated_by=@userId WHERE account_id=@duplicateId`,
          { primaryId: primary.account_id, duplicateId: dup.account_id, userId });
        await query(`INSERT INTO crm_account_merge_history(primary_account_id,merged_account_id,merge_snapshot_json,merged_by)
          VALUES(@primaryId,@duplicateId,@snapshot,@userId)`, { primaryId: primary.account_id, duplicateId: dup.account_id, snapshot: JSON.stringify(dup), userId });
        await query(`UPDATE crm_account SET account_status='MERGED', merged_into_account_id=@primaryId, deleted_yn=1,
          updated_at=SYSUTCDATETIME(), updated_by=@userId WHERE account_id=@duplicateId`, { primaryId: primary.account_id, duplicateId: dup.account_id, userId });
      }
      return { primaryPublicId, mergedPublicIds: ids };
    });
  }

  async convertLead(companyId: number, publicId: string, input: { accountMode: 'NEW' | 'EXISTING'; existingAccountPublicId?: string; opportunityName?: string }, userId: number) {
    return this.db.transaction(async query => {
      const lr = await query<any>(`SELECT TOP 1 * FROM crm_lead WITH(UPDLOCK,ROWLOCK) WHERE company_id=@companyId AND public_id=@publicId AND deleted_yn=0`, { companyId, publicId });
      const lead = lr.recordset[0];
      if (!lead) throw new NotFoundException('Lead not found');
      if (lead.status === 'CONVERTED') throw new ConflictException('Lead already converted');
      if (lead.status !== 'KEYMAN_MEETING') throw new BadRequestException('Lead must be in KEYMAN_MEETING before conversion');
      if (!lead.owner_user_id) throw new BadRequestException('Lead owner is required before conversion');

      let account: { account_id: number; public_id: string };
      if (input.accountMode === 'EXISTING') {
        if (!input.existingAccountPublicId) throw new BadRequestException('existingAccountPublicId is required');
        account = await this.accountByPublicId(query, companyId, input.existingAccountPublicId);
      } else {
        if (lead.business_no) {
          const dup = await query<{ account_id: number }>(`SELECT TOP 1 account_id FROM crm_account WHERE company_id=@companyId AND business_no=@businessNo AND deleted_yn=0`, { companyId, businessNo: lead.business_no });
          if (dup.recordset[0]) throw new ConflictException('Duplicate account exists for business number; choose EXISTING account');
        }
        const ar = await query<{ account_id: number; public_id: string }>(`INSERT INTO crm_account(company_id,owner_user_id,account_name,business_no,provider_no,phone,address,latitude,longitude,created_by)
          OUTPUT inserted.account_id, CONVERT(varchar(36),inserted.public_id) public_id
          VALUES(@companyId,@ownerUserId,@accountName,@businessNo,@providerNo,@phone,@address,@latitude,@longitude,@userId)`, {
          companyId, ownerUserId: lead.owner_user_id, accountName: lead.hospital_name, businessNo: lead.business_no, providerNo: lead.provider_no,
          phone: lead.phone, address: lead.address, latitude: lead.latitude, longitude: lead.longitude, userId
        });
        account = ar.recordset[0];
      }

      let contactId: number | null = null;
      if (lead.keyman_name) {
        const cr = await query<{ contact_id: number }>(`INSERT INTO crm_contact(company_id,account_id,contact_type,contact_name,mobile,email,school,cohort,major,created_by)
          OUTPUT inserted.contact_id VALUES(@companyId,@accountId,@type,@name,@mobile,@email,@school,@cohort,@major,@userId)`, {
          companyId, accountId: account.account_id, type: lead.keyman_type, name: lead.keyman_name, mobile: lead.keyman_mobile, email: lead.keyman_email,
          school: lead.school, cohort: lead.cohort, major: lead.major, userId
        });
        contactId = cr.recordset[0].contact_id;
      }

      const or = await query<{ opportunity_id: number; public_id: string }>(`INSERT INTO crm_opportunity(company_id,account_id,owner_user_id,opportunity_name,stage,record_type,converted_from_lead_id,created_by)
        OUTPUT inserted.opportunity_id, CONVERT(varchar(36),inserted.public_id) public_id
        VALUES(@companyId,@accountId,@ownerUserId,@opportunityName,'NEEDS_ANALYSIS','NEW',@leadId,@userId)`, {
        companyId, accountId: account.account_id, ownerUserId: lead.owner_user_id,
        opportunityName: input.opportunityName?.trim() || `${lead.hospital_name} 신규 영업기회`, leadId: lead.lead_id, userId
      });
      const opportunity = or.recordset[0];

      await query(`INSERT INTO crm_lead_conversion_history(lead_id,account_id,contact_id,opportunity_id,converted_by)
        VALUES(@leadId,@accountId,@contactId,@opportunityId,@userId)`, { leadId: lead.lead_id, accountId: account.account_id, contactId, opportunityId: opportunity.opportunity_id, userId });
      await query(`INSERT INTO crm_lead_status_history(lead_id,from_status,to_status,reason,changed_by)
        VALUES(@leadId,@fromStatus,'CONVERTED',N'Lead Convert',@userId)`, { leadId: lead.lead_id, fromStatus: lead.status, userId });
      await query(`UPDATE crm_lead SET status='CONVERTED', converted_at=SYSUTCDATETIME(), converted_by=@userId, updated_at=SYSUTCDATETIME(), updated_by=@userId WHERE lead_id=@leadId`, { leadId: lead.lead_id, userId });

      return { leadPublicId: publicId, accountPublicId: account.public_id, contactId, opportunityPublicId: opportunity.public_id };
    });
  }

  private hiraParams(h: HiraHospitalInput) {
    return { encryptedProviderNo: h.encryptedProviderNo, hospitalName: h.hospitalName, phone: h.phone ?? null, address: h.address ?? null,
      sido: h.sido ?? null, sigungu: h.sigungu ?? null, eupmyeondong: h.eupmyeondong ?? null, latitude: h.latitude ?? null,
      longitude: h.longitude ?? null, providerNo: h.providerNo ?? null, openDate: h.openDate ?? null };
  }

  private async findAreaOwner(query: DbQuery, companyId: number, sido?: string, sigungu?: string) {
    if (!sido || !sigungu) return null;
    const r = await query<{ owner_user_id: number }>(`SELECT TOP 1 owner_user_id FROM crm_sales_area_owner
      WHERE company_id=@companyId AND sido=@sido AND sigungu=@sigungu AND is_active=1 ORDER BY priority, sales_area_owner_id`, { companyId, sido, sigungu });
    return r.recordset[0]?.owner_user_id ?? null;
  }

  private async accountByPublicId(query: DbQuery, companyId: number, publicId: string) {
    const r = await query<any>(`SELECT TOP 1 account_id, CONVERT(varchar(36),public_id) public_id, account_name, business_no, erp_customer_code
      FROM crm_account WHERE company_id=@companyId AND public_id=@publicId AND deleted_yn=0`, { companyId, publicId });
    if (!r.recordset[0]) throw new NotFoundException('Account not found');
    return r.recordset[0] as { account_id: number; public_id: string; account_name: string; business_no?: string; erp_customer_code?: string };
  }
}
