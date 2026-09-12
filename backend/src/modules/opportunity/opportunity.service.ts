import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, DbQuery } from '../../database/database.service';
import { canTransitionOpportunity, OpportunityStage } from './opportunity.rules';

@Injectable()
export class OpportunityService {
  constructor(private readonly db: DatabaseService) {}

  async list(companyId: number, stage?: string, accountPublicId?: string, search?: string) {
    const r = await this.db.query(`SELECT TOP 500 o.opportunity_id, CONVERT(varchar(36),o.public_id) public_id,
      o.opportunity_name,o.stage,o.record_type,o.amount,o.expected_close_date,o.success_probability,o.forecast_category,
      o.owner_user_id,u.user_name owner_name,CONVERT(varchar(36),a.public_id) account_public_id,a.account_name,
      a.erp_approved_yn,o.contract_created_yn,o.updated_at
      FROM crm_opportunity o
      JOIN crm_account a ON a.account_id=o.account_id
      LEFT JOIN crm_user u ON u.user_id=o.owner_user_id
      WHERE o.company_id=@companyId AND o.deleted_yn=0
        AND (@stage IS NULL OR o.stage=@stage)
        AND (@accountPublicId IS NULL OR a.public_id=@accountPublicId)
        AND (@search IS NULL OR o.opportunity_name LIKE '%' + @search + '%' OR a.account_name LIKE '%' + @search + '%')
      ORDER BY o.opportunity_id DESC`, { companyId, stage: stage || null, accountPublicId: accountPublicId || null, search: search?.trim() || null });
    return r.recordset;
  }

  async get(companyId: number, publicId: string) {
    const r = await this.db.query<any>(`SELECT TOP 1 o.*, CONVERT(varchar(36),o.public_id) public_id_text,
      CONVERT(varchar(36),a.public_id) account_public_id,a.account_name,a.erp_approved_yn,a.integration_status,u.user_name owner_name
      FROM crm_opportunity o JOIN crm_account a ON a.account_id=o.account_id
      LEFT JOIN crm_user u ON u.user_id=o.owner_user_id
      WHERE o.company_id=@companyId AND o.public_id=@publicId AND o.deleted_yn=0`, { companyId, publicId });
    const opportunity = r.recordset[0];
    if (!opportunity) throw new NotFoundException('Opportunity not found');
    const p = await this.db.query(`SELECT CONVERT(varchar(36),op.public_id) public_id,CONVERT(varchar(36),pp.public_id) package_public_id,
      pp.item_type,pp.item_name,pp.erp_item_code,op.quantity,op.proposed_unit_price,op.quantity*op.proposed_unit_price line_amount,op.note
      FROM crm_opportunity_product op JOIN crm_product_package pp ON pp.product_package_id=op.product_package_id
      WHERE op.opportunity_id=@opportunityId ORDER BY op.opportunity_product_id`, { opportunityId: opportunity.opportunity_id });
    return { ...opportunity, products: p.recordset };
  }

  async create(companyId: number, input: { accountPublicId: string; opportunityName: string; recordType: string; ownerUserId?: number; expectedCloseDate?: string; interestProduct?: string }, userId: number) {
    const ar = await this.db.query<any>(`SELECT TOP 1 account_id,owner_user_id FROM crm_account WHERE company_id=@companyId AND public_id=@accountPublicId AND deleted_yn=0`, { companyId, accountPublicId: input.accountPublicId });
    const account = ar.recordset[0];
    if (!account) throw new NotFoundException('Account not found');
    const r = await this.db.query<{ public_id: string }>(`INSERT INTO crm_opportunity(company_id,account_id,owner_user_id,opportunity_name,stage,record_type,expected_close_date,interest_product,created_by,updated_by)
      OUTPUT CONVERT(varchar(36),inserted.public_id) public_id
      VALUES(@companyId,@accountId,@ownerUserId,@name,'NEEDS_ANALYSIS',@recordType,@expectedCloseDate,@interestProduct,@userId,@userId)`, {
      companyId, accountId: account.account_id, ownerUserId: input.ownerUserId ?? account.owner_user_id ?? userId,
      name: input.opportunityName, recordType: input.recordType, expectedCloseDate: input.expectedCloseDate ?? null,
      interestProduct: input.interestProduct ?? null, userId
    });
    return this.get(companyId, r.recordset[0].public_id);
  }

  async update(companyId: number, publicId: string, input: Record<string, unknown>, userId: number) {
    const current = await this.get(companyId, publicId) as any;
    if (current.contract_created_yn) throw new ConflictException('Opportunity is locked after contract creation');
    const allowed: Record<string, string> = {
      opportunityName: 'opportunity_name', expectedCloseDate: 'expected_close_date', successProbability: 'success_probability',
      forecastCategory: 'forecast_category', interestProduct: 'interest_product', specialTerms: 'special_terms', paymentMethod: 'payment_method',
      paymentDate: 'payment_date', installmentMonths: 'installment_months', competitorUsage: 'competitor_usage', ownedEquipment: 'owned_equipment',
      treatmentFeeInfo: 'treatment_fee_info'
    };
    const entries = Object.entries(input).filter(([k]) => allowed[k]);
    if (!entries.length) return current;
    const sets = entries.map(([k], i) => `${allowed[k]}=@v${i}`);
    const params: Record<string, unknown> = { companyId, publicId, userId };
    entries.forEach(([, v], i) => params[`v${i}`] = v ?? null);
    await this.db.query(`UPDATE crm_opportunity SET ${sets.join(',')},updated_at=SYSUTCDATETIME(),updated_by=@userId
      WHERE company_id=@companyId AND public_id=@publicId AND deleted_yn=0`, params);
    return this.get(companyId, publicId);
  }

  async archive(companyId: number, publicId: string, userId: number) {
    return this.db.transaction(async query => {
      const opportunity = await this.lockOpportunity(query, companyId, publicId);
      if (opportunity.contract_created_yn) throw new ConflictException('Contract-created opportunity cannot be archived');
      await query(`UPDATE crm_opportunity SET deleted_yn=1,updated_at=SYSUTCDATETIME(),updated_by=@userId WHERE opportunity_id=@opportunityId`, { opportunityId: opportunity.opportunity_id, userId });
      await query(`INSERT INTO crm_opportunity_stage_history(opportunity_id,from_stage,to_stage,reason,transition_type,changed_by)
        VALUES(@opportunityId,@stage,@stage,N'Logical archive','ARCHIVE',@userId)`, { opportunityId: opportunity.opportunity_id, stage: opportunity.stage, userId });
      return { publicId, archived: true };
    });
  }

  async transition(companyId: number, publicId: string, toStage: OpportunityStage, reason: string | undefined, userId: number, permissions: string[]) {
    return this.db.transaction(async query => {
      const opportunity = await this.lockOpportunity(query, companyId, publicId);
      const decision = canTransitionOpportunity(opportunity.stage as OpportunityStage, toStage, {
        canReopen: permissions.includes('OPPORTUNITY.STAGE.REOPEN'), contractCreated: Boolean(opportunity.contract_created_yn), reason
      });
      if (!decision.allowed) throw new BadRequestException(decision.error);

      if (toStage === 'CLOSED_WON') {
        const account = await query<{ erp_approved_yn: boolean }>(`SELECT erp_approved_yn FROM crm_account WHERE account_id=@accountId`, { accountId: opportunity.account_id });
        if (!account.recordset[0]?.erp_approved_yn) throw new BadRequestException('ERP-approved Account is required before Closed Won');
      }

      await query(`UPDATE crm_opportunity SET stage=@toStage,closed_reason=CASE WHEN @toStage='CLOSED_LOST' THEN @reason ELSE NULL END,
        updated_at=SYSUTCDATETIME(),updated_by=@userId WHERE opportunity_id=@opportunityId`, {
        toStage, reason: reason ?? null, userId, opportunityId: opportunity.opportunity_id
      });
      await query(`INSERT INTO crm_opportunity_stage_history(opportunity_id,from_stage,to_stage,reason,transition_type,changed_by)
        VALUES(@opportunityId,@fromStage,@toStage,@reason,@transitionType,@userId)`, {
        opportunityId: opportunity.opportunity_id, fromStage: opportunity.stage, toStage, reason: reason ?? null,
        transitionType: decision.reverse ? 'REVERSE' : 'NORMAL', userId
      });
      return { publicId, fromStage: opportunity.stage, toStage, reverse: decision.reverse };
    });
  }

  async addProduct(companyId: number, publicId: string, input: { packagePublicId: string; quantity: number; proposedUnitPrice: number; note?: string }, userId: number) {
    return this.db.transaction(async query => {
      const opportunity = await this.lockOpportunity(query, companyId, publicId);
      if (opportunity.contract_created_yn) throw new ConflictException('Opportunity products are locked after contract creation');
      const pr = await query<{ product_package_id: number }>(`SELECT product_package_id FROM crm_product_package WHERE company_id=@companyId AND public_id=@packagePublicId AND is_active=1 AND deleted_yn=0`, { companyId, packagePublicId: input.packagePublicId });
      const product = pr.recordset[0];
      if (!product) throw new NotFoundException('Product/package not found');
      await query(`IF EXISTS(SELECT 1 FROM crm_opportunity_product WHERE opportunity_id=@opportunityId AND product_package_id=@productPackageId)
        UPDATE crm_opportunity_product SET quantity=@quantity,proposed_unit_price=@price,note=@note,updated_at=SYSUTCDATETIME(),updated_by=@userId WHERE opportunity_id=@opportunityId AND product_package_id=@productPackageId
        ELSE INSERT INTO crm_opportunity_product(opportunity_id,product_package_id,quantity,proposed_unit_price,note,created_by,updated_by)
        VALUES(@opportunityId,@productPackageId,@quantity,@price,@note,@userId,@userId)`, {
        opportunityId: opportunity.opportunity_id, productPackageId: product.product_package_id, quantity: input.quantity, price: input.proposedUnitPrice, note: input.note ?? null, userId
      });
      await this.recalculateAmount(query, opportunity.opportunity_id, userId);
      return { publicId, productPackagePublicId: input.packagePublicId };
    });
  }

  async updateProduct(companyId: number, publicId: string, productPublicId: string, input: { quantity?: number; proposedUnitPrice?: number; note?: string | null }, userId: number) {
    return this.db.transaction(async query => {
      const opportunity = await this.lockOpportunity(query, companyId, publicId);
      if (opportunity.contract_created_yn) throw new ConflictException('Opportunity products are locked after contract creation');
      const existing = await query<any>(`SELECT op.opportunity_product_id,op.quantity,op.proposed_unit_price,op.note FROM crm_opportunity_product op WHERE op.opportunity_id=@opportunityId AND op.public_id=@productPublicId`, { opportunityId: opportunity.opportunity_id, productPublicId });
      const row = existing.recordset[0];
      if (!row) throw new NotFoundException('Opportunity product not found');
      await query(`UPDATE crm_opportunity_product SET quantity=@quantity,proposed_unit_price=@price,note=@note,updated_at=SYSUTCDATETIME(),updated_by=@userId WHERE opportunity_product_id=@id`, {
        quantity: input.quantity ?? row.quantity, price: input.proposedUnitPrice ?? row.proposed_unit_price, note: input.note === undefined ? row.note : input.note,
        userId, id: row.opportunity_product_id
      });
      await this.recalculateAmount(query, opportunity.opportunity_id, userId);
      return { productPublicId, updated: true };
    });
  }

  async removeProduct(companyId: number, publicId: string, productPublicId: string, userId: number) {
    return this.db.transaction(async query => {
      const opportunity = await this.lockOpportunity(query, companyId, publicId);
      if (opportunity.contract_created_yn) throw new ConflictException('Opportunity products are locked after contract creation');
      const r = await query(`DELETE FROM crm_opportunity_product WHERE opportunity_id=@opportunityId AND public_id=@productPublicId`, { opportunityId: opportunity.opportunity_id, productPublicId });
      if (!r.rowsAffected[0]) throw new NotFoundException('Opportunity product not found');
      await this.recalculateAmount(query, opportunity.opportunity_id, userId);
      return { productPublicId, removed: true };
    });
  }

  async listCatalog(companyId: number, search?: string, itemType?: string) {
    const r = await this.db.query(`SELECT CONVERT(varchar(36),public_id) public_id,item_type,item_name,erp_item_code,category,base_price,source_system
      FROM crm_product_package WHERE company_id=@companyId AND is_active=1 AND deleted_yn=0
      AND (@itemType IS NULL OR item_type=@itemType) AND (@search IS NULL OR item_name LIKE '%' + @search + '%' OR erp_item_code LIKE '%' + @search + '%')
      ORDER BY item_type,item_name`, { companyId, itemType: itemType || null, search: search?.trim() || null });
    return r.recordset;
  }

  async createCatalog(companyId: number, input: { itemType: string; itemName: string; erpItemCode?: string; category?: string; basePrice?: number }, userId: number) {
    const r = await this.db.query<{ public_id: string }>(`INSERT INTO crm_product_package(company_id,item_type,item_name,erp_item_code,category,base_price,source_system,created_by,updated_by)
      OUTPUT CONVERT(varchar(36),inserted.public_id) public_id VALUES(@companyId,@itemType,@itemName,@erpItemCode,@category,@basePrice,'CRM',@userId,@userId)`, {
      companyId, itemType: input.itemType, itemName: input.itemName, erpItemCode: input.erpItemCode ?? null, category: input.category ?? null, basePrice: input.basePrice ?? 0, userId
    });
    return { publicId: r.recordset[0].public_id };
  }

  async pipeline(companyId: number, ownerUserId?: number, from?: string, to?: string) {
    const byStage = await this.db.query(`SELECT stage,COUNT_BIG(*) opportunity_count,SUM(ISNULL(amount,0)) amount,
      SUM(ISNULL(amount,0)*ISNULL(success_probability,0)/100.0) weighted_amount
      FROM crm_opportunity WHERE company_id=@companyId AND deleted_yn=0
      AND (@ownerUserId IS NULL OR owner_user_id=@ownerUserId)
      AND (@from IS NULL OR expected_close_date>=@from) AND (@to IS NULL OR expected_close_date<=@to)
      GROUP BY stage`, { companyId, ownerUserId: ownerUserId ?? null, from: from || null, to: to || null });
    const forecast = await this.db.query(`SELECT ISNULL(forecast_category,'PIPELINE') forecast_category,COUNT_BIG(*) opportunity_count,SUM(ISNULL(amount,0)) amount
      FROM crm_opportunity WHERE company_id=@companyId AND deleted_yn=0 AND stage NOT IN('CLOSED_LOST')
      AND (@ownerUserId IS NULL OR owner_user_id=@ownerUserId)
      AND (@from IS NULL OR expected_close_date>=@from) AND (@to IS NULL OR expected_close_date<=@to)
      GROUP BY ISNULL(forecast_category,'PIPELINE')`, { companyId, ownerUserId: ownerUserId ?? null, from: from || null, to: to || null });
    return { byStage: byStage.recordset, forecast: forecast.recordset };
  }

  private async lockOpportunity(query: DbQuery, companyId: number, publicId: string): Promise<any> {
    const r = await query<any>(`SELECT TOP 1 * FROM crm_opportunity WITH(UPDLOCK,ROWLOCK) WHERE company_id=@companyId AND public_id=@publicId AND deleted_yn=0`, { companyId, publicId });
    if (!r.recordset[0]) throw new NotFoundException('Opportunity not found');
    return r.recordset[0];
  }

  private async recalculateAmount(query: DbQuery, opportunityId: number, userId: number) {
    await query(`UPDATE o SET amount=ISNULL(x.amount,0),updated_at=SYSUTCDATETIME(),updated_by=@userId
      FROM crm_opportunity o OUTER APPLY(SELECT SUM(quantity*proposed_unit_price) amount FROM crm_opportunity_product WHERE opportunity_id=o.opportunity_id) x
      WHERE o.opportunity_id=@opportunityId`, { opportunityId, userId });
  }
}
