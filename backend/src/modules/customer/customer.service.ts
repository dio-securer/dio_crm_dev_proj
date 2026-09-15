import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import crypto from 'node:crypto';
import type { AccountWriteInput } from '@dio-crm/contracts';
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

const ACCOUNT_SELECT = `a.account_id, CONVERT(varchar(36),a.public_id) public_id, a.account_name, a.account_status, a.account_grade,
  a.business_no, a.business_name, a.ceo_name, a.phone, a.fax, a.homepage, a.address, a.address_line1, a.address_line2,
  a.hospital_address, a.zip_code, a.tax_email, a.provider_no, a.encrypted_provider_no, CONVERT(varchar(10),a.open_date,23) open_date,
  a.doctor_license_no, a.account_type, a.erp_customer_code, a.erp_approved_yn, a.integration_status, a.erp_trade_code,
  a.erp_approval_code, a.use_yn, a.churn_risk_yn, a.account_stat_code, a.owner_user_id, u.user_name owner_name, a.updated_at`;

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

  async listAccounts(companyId: number, search?: string, scope = 'managed', ownerUserId?: number) {
    const r = await this.db.query(`SELECT TOP 500 ${ACCOUNT_SELECT}
      FROM crm_account a LEFT JOIN crm_user u ON u.user_id=a.owner_user_id
      WHERE a.company_id=@companyId AND a.deleted_yn=0
      AND (@scope <> 'mine' OR a.owner_user_id=@ownerUserId)
      AND (@scope <> 'managed' OR (ISNULL(a.use_yn,'1') <> '0' AND a.account_status <> 'MERGED'))
      AND (@search IS NULL OR a.account_name LIKE '%' + @search + '%' OR a.business_no LIKE '%' + @search + '%'
        OR a.phone LIKE '%' + @search + '%' OR a.hospital_address LIKE '%' + @search + '%' OR a.provider_no LIKE '%' + @search + '%')
      ORDER BY a.account_id DESC`, {
      companyId,
      search: search?.trim() || null,
      scope: scope || 'managed',
      ownerUserId: ownerUserId ?? null
    });
    return r.recordset.map(row => this.mapAccount(row));
  }

  async getAccount(companyId: number, publicId: string) {
    const r = await this.db.query(`SELECT TOP 1 ${ACCOUNT_SELECT}
      FROM crm_account a LEFT JOIN crm_user u ON u.user_id=a.owner_user_id
      WHERE a.company_id=@companyId AND a.public_id=@publicId AND a.deleted_yn=0`, { companyId, publicId });
    if (!r.recordset[0]) throw new NotFoundException('Account not found');
    return this.mapAccount(r.recordset[0]);
  }

  async createAccount(companyId: number, input: AccountWriteInput, userId: number) {
    const values = this.accountWriteValues(input);
    if (values.businessNo) {
      const dup = await this.duplicateAccounts(companyId, values.businessNo);
      if (dup.length) throw new ConflictException('Duplicate account exists for business number');
    }
    const r = await this.db.query<{ public_id: string }>(`INSERT INTO crm_account(
        company_id,owner_user_id,account_name,account_status,account_grade,business_name,business_no,ceo_name,phone,fax,homepage,
        address,address_line1,address_line2,hospital_address,zip_code,tax_email,provider_no,encrypted_provider_no,open_date,
        doctor_license_no,account_type,use_yn,churn_risk_yn,account_stat_code,created_by,updated_by)
      OUTPUT CONVERT(varchar(36),inserted.public_id) public_id
      VALUES(@companyId,@userId,@accountName,@accountStatus,@accountGrade,@businessName,@businessNo,@ceoName,@phone,@fax,@homepage,
        @address,@addressLine1,@addressLine2,@hospitalAddress,@zipCode,@taxEmail,@providerNo,@encryptedProviderNo,@openDate,
        @doctorLicenseNo,@accountType,@useYn,@churnRiskYn,@accountStatCode,@userId,@userId)`, {
      companyId, userId, ...values
    });
    return this.getAccount(companyId, r.recordset[0].public_id);
  }

  async updateAccount(companyId: number, publicId: string, input: Partial<AccountWriteInput>, userId: number, permissions: string[]) {
    const current = await this.getAccount(companyId, publicId);
    if (current.account_status === 'MERGED') throw new ConflictException('Merged account cannot be modified');
    if (current.owner_user_id !== userId && !permissions.includes('ACCOUNT.MERGE')) {
      throw new ForbiddenException('Only owner or manager can modify account');
    }
    const values = this.accountWriteValues(input, current);
    if (values.businessNo && values.businessNo !== current.business_no) {
      const dup = await this.duplicateAccounts(companyId, values.businessNo);
      if (dup.some(x => x.public_id !== publicId)) throw new ConflictException('Duplicate account exists for business number');
    }
    await this.db.query(`UPDATE crm_account SET
        account_name=@accountName, account_status=@accountStatus, account_grade=@accountGrade, business_name=@businessName,
        business_no=@businessNo, ceo_name=@ceoName, phone=@phone, fax=@fax, homepage=@homepage, address=@address,
        address_line1=@addressLine1, address_line2=@addressLine2, hospital_address=@hospitalAddress, zip_code=@zipCode,
        tax_email=@taxEmail, provider_no=@providerNo, encrypted_provider_no=@encryptedProviderNo, open_date=@openDate,
        doctor_license_no=@doctorLicenseNo, account_type=@accountType, use_yn=@useYn, churn_risk_yn=@churnRiskYn,
        account_stat_code=@accountStatCode, updated_at=SYSUTCDATETIME(), updated_by=@userId
      WHERE company_id=@companyId AND public_id=@publicId AND deleted_yn=0`, { companyId, publicId, userId, ...values });
    return this.getAccount(companyId, publicId);
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

  private mapAccount(row: Record<string, any>) {
    return {
      public_id: row.public_id,
      account_name: row.account_name,
      account_status: row.account_status,
      account_grade: row.account_grade ?? null,
      business_no: row.business_no ?? null,
      business_name: row.business_name ?? null,
      ceo_name: row.ceo_name ?? null,
      phone: row.phone ?? null,
      fax: row.fax ?? null,
      homepage: row.homepage ?? null,
      address: row.address ?? row.hospital_address ?? row.address_line1 ?? null,
      address_line1: row.address_line1 ?? null,
      address_line2: row.address_line2 ?? null,
      hospital_address: row.hospital_address ?? row.address ?? null,
      zip_code: row.zip_code ?? null,
      tax_email: row.tax_email ?? null,
      provider_no: row.provider_no ?? null,
      encrypted_provider_no: row.encrypted_provider_no ?? null,
      open_date: row.open_date ?? null,
      doctor_license_no: row.doctor_license_no ?? null,
      account_type: row.account_type ?? null,
      erp_customer_code: row.erp_customer_code ?? null,
      erp_approved_yn: Boolean(row.erp_approved_yn),
      integration_status: row.integration_status,
      erp_trade_code: row.erp_trade_code ?? null,
      erp_approval_code: row.erp_approval_code ?? null,
      use_yn: row.use_yn ?? '1',
      churn_risk_yn: Boolean(row.churn_risk_yn),
      account_stat_code: row.account_stat_code ?? null,
      owner_user_id: row.owner_user_id ?? null,
      owner_name: row.owner_name ?? null,
      updated_at: row.updated_at ?? null
    };
  }

  private accountWriteValues(input: Partial<AccountWriteInput>, current?: {
    account_name: string; account_status: string; account_grade?: string | null; business_name?: string | null; business_no?: string | null;
    ceo_name?: string | null; phone?: string | null; fax?: string | null; homepage?: string | null; address?: string | null;
    address_line1?: string | null; address_line2?: string | null; hospital_address?: string | null; zip_code?: string | null;
    tax_email?: string | null; provider_no?: string | null; encrypted_provider_no?: string | null; open_date?: string | null;
    doctor_license_no?: string | null; account_type?: string | null; use_yn?: string | null; churn_risk_yn?: boolean | null;
    account_stat_code?: string | null;
  }) {
    const hospitalAddress = this.nullableText(input.hospitalAddress) ?? this.nullableText(input.address) ?? current?.hospital_address ?? current?.address ?? null;
    return {
      accountName: input.accountName?.trim() || current?.account_name || '',
      accountStatus: input.accountStatus ?? current?.account_status ?? 'ACTIVE',
      accountGrade: this.nullableText(input.accountGrade) ?? current?.account_grade ?? 'GENERAL',
      businessName: this.nullableText(input.businessName) ?? current?.business_name ?? null,
      businessNo: input.businessNo === undefined ? current?.business_no ?? null : this.nullableText(input.businessNo),
      ceoName: this.nullableText(input.ceoName) ?? current?.ceo_name ?? null,
      phone: this.nullableText(input.phone) ?? current?.phone ?? null,
      fax: this.nullableText(input.fax) ?? current?.fax ?? null,
      homepage: this.nullableText(input.homepage) ?? current?.homepage ?? null,
      address: hospitalAddress,
      addressLine1: this.nullableText(input.addressLine1) ?? current?.address_line1 ?? null,
      addressLine2: this.nullableText(input.addressLine2) ?? current?.address_line2 ?? null,
      hospitalAddress,
      zipCode: this.nullableText(input.zipCode) ?? current?.zip_code ?? null,
      taxEmail: this.nullableText(input.taxEmail) ?? current?.tax_email ?? null,
      providerNo: this.nullableText(input.providerNo) ?? current?.provider_no ?? null,
      encryptedProviderNo: this.nullableText(input.encryptedProviderNo) ?? current?.encrypted_provider_no ?? null,
      openDate: this.nullableText(input.openDate) ?? current?.open_date ?? null,
      doctorLicenseNo: this.nullableText(input.doctorLicenseNo) ?? current?.doctor_license_no ?? null,
      accountType: this.nullableText(input.accountType) ?? current?.account_type ?? 'BC505600',
      useYn: this.nullableText(input.useYn) ?? current?.use_yn ?? '1',
      churnRiskYn: input.churnRiskYn ?? current?.churn_risk_yn ?? false,
      accountStatCode: this.nullableText(input.accountStatCode) ?? current?.account_stat_code ?? '0'
    };
  }

  private nullableText(value?: string | null) {
    const text = value?.trim();
    return text ? text : null;
  }
}
