import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, DbQuery } from '../../database/database.service';
import { InterfaceService } from '../../integration/interface.service';
import { missingErpAccountFields } from '@dio-crm/contracts';
import { sameMoney, validateChangedPlan, validateContractCreation, validatePlanTotal } from './contract.rules';

export type CollectionPlanInput = {
  installmentNo: number;
  collectionMethod: string;
  amount: number;
  plannedDate: string;
};

@Injectable()
export class ContractService {
  constructor(private readonly db: DatabaseService, private readonly interfaces: InterfaceService) {}

  async requestErpAccount(companyId: number, accountPublicId: string, userId: number) {
    const r = await this.db.query<any>(`SELECT TOP 1 * FROM crm_account WHERE company_id=@companyId AND public_id=@accountPublicId AND deleted_yn=0`, { companyId, accountPublicId });
    const account = r.recordset[0];
    if (!account) throw new NotFoundException('Account not found');
    if (account.integration_status === 'REQUESTING') throw new ConflictException('ERP Account request already in progress');
    if (account.integration_status === 'SUCCESS' && account.erp_approved_yn) throw new ConflictException('Account is already ERP-approved');

    const missing = missingErpAccountFields({ ...account, company_code: 'DIO', erp_approved_yn: Boolean(account.erp_approved_yn) });
    if (missing.length) throw new BadRequestException(`Missing ERP Account fields: ${missing.join(', ')}`);

    const payload = {
      accountPublicId,
      accountName: account.account_name,
      businessName: account.business_name,
      businessNo: account.business_no,
      ceoName: account.ceo_name,
      providerNo: account.provider_no,
      taxEmail: account.tax_email,
      phone: account.phone,
      address: account.address,
      ownerUserId: account.owner_user_id
    };
    const queued = await this.interfaces.enqueuePending({ companyId, interfaceCode: 'IF-ERP-002', direction: 'OUT', entityType: 'ACCOUNT', entityId: accountPublicId, payload });
    await this.db.query(`UPDATE crm_account SET integration_status='REQUESTING',last_erp_request_id=@requestId,erp_requested_at=SYSUTCDATETIME(),updated_at=SYSUTCDATETIME(),updated_by=@userId WHERE account_id=@accountId`, {
      requestId: queued.requestId, userId, accountId: account.account_id
    });
    return queued;
  }

  async applyErpAccountResult(companyId: number, input: { accountPublicId: string; success: boolean; erpCustomerCode?: string; requestId?: string; message?: string }) {
    const r = await this.db.query<any>(`SELECT TOP 1 account_id FROM crm_account WHERE company_id=@companyId AND public_id=@accountPublicId AND deleted_yn=0`, { companyId, accountPublicId: input.accountPublicId });
    const account = r.recordset[0];
    if (!account) throw new NotFoundException('Account not found');
    if (input.success && !input.erpCustomerCode) throw new BadRequestException('erpCustomerCode is required on success');
    await this.db.query(`UPDATE crm_account SET erp_customer_code=CASE WHEN @success=1 THEN @erpCustomerCode ELSE erp_customer_code END,
      erp_approved_yn=@success,integration_status=CASE WHEN @success=1 THEN 'SUCCESS' ELSE 'FAILED' END,updated_at=SYSUTCDATETIME()
      WHERE account_id=@accountId`, { success: input.success ? 1 : 0, erpCustomerCode: input.erpCustomerCode ?? null, accountId: account.account_id });
    if (input.requestId) await this.completeInterface(input.requestId, input.success, input);
    return { accountPublicId: input.accountPublicId, integrationStatus: input.success ? 'SUCCESS' : 'FAILED', erpCustomerCode: input.erpCustomerCode ?? null };
  }

  async list(companyId: number, accountPublicId?: string, status?: string) {
    const r = await this.db.query(`SELECT TOP 500 c.contract_id,CONVERT(varchar(36),c.public_id) public_id,c.contract_name,c.contract_date,c.contract_amount,
      c.status,c.integration_status,c.erp_contract_no,c.erp_approval_status,c.close_yn,CONVERT(varchar(36),o.public_id) opportunity_public_id,
      o.opportunity_name,CONVERT(varchar(36),a.public_id) account_public_id,a.account_name,a.erp_customer_code
      FROM crm_contract c JOIN crm_opportunity o ON o.opportunity_id=c.opportunity_id JOIN crm_account a ON a.account_id=c.account_id
      WHERE c.company_id=@companyId AND c.deleted_yn=0 AND (@accountPublicId IS NULL OR a.public_id=@accountPublicId) AND (@status IS NULL OR c.status=@status)
      ORDER BY c.contract_id DESC`, { companyId, accountPublicId: accountPublicId || null, status: status || null });
    return r.recordset;
  }

  async get(companyId: number, publicId: string) {
    const r = await this.db.query<any>(`SELECT TOP 1 c.*,CONVERT(varchar(36),c.public_id) public_id_text,CONVERT(varchar(36),o.public_id) opportunity_public_id,
      o.opportunity_name,CONVERT(varchar(36),a.public_id) account_public_id,a.account_name,a.erp_customer_code,a.erp_approved_yn
      FROM crm_contract c JOIN crm_opportunity o ON o.opportunity_id=c.opportunity_id JOIN crm_account a ON a.account_id=c.account_id
      WHERE c.company_id=@companyId AND c.public_id=@publicId AND c.deleted_yn=0`, { companyId, publicId });
    const contract = r.recordset[0];
    if (!contract) throw new NotFoundException('Contract not found');
    const plans = await this.db.query(`SELECT CONVERT(varchar(36),public_id) public_id,plan_version,installment_no,collection_method,amount,planned_date,adjustment_type,is_current,erp_sync_status,correction_required_yn
      FROM crm_collection_plan WHERE contract_id=@contractId ORDER BY plan_version,installment_no`, { contractId: contract.contract_id });
    const products = await this.db.query(`SELECT CONVERT(varchar(36),public_id) public_id,item_type,item_name,erp_item_code,quantity,unit_price,line_amount
      FROM crm_contract_product WHERE contract_id=@contractId ORDER BY contract_product_id`, { contractId: contract.contract_id });
    return { ...contract, plans: plans.recordset, products: products.recordset };
  }

  async create(companyId: number, opportunityPublicId: string, input: { contractName?: string; contractDate?: string; productAmount?: number; goodsAmount?: number; packageClassification?: string; specialTerms?: string }, userId: number) {
    return this.db.transaction(async query => {
      const rr = await query<any>(`SELECT TOP 1 o.*,a.account_name,a.erp_approved_yn,a.account_id account_id2
        FROM crm_opportunity o WITH(UPDLOCK,ROWLOCK) JOIN crm_account a ON a.account_id=o.account_id
        WHERE o.company_id=@companyId AND o.public_id=@opportunityPublicId AND o.deleted_yn=0`, { companyId, opportunityPublicId });
      const opp = rr.recordset[0];
      if (!opp) throw new NotFoundException('Opportunity not found');
      const pc = await query<{ cnt: number }>(`SELECT COUNT(*) cnt FROM crm_opportunity_product WHERE opportunity_id=@opportunityId`, { opportunityId: opp.opportunity_id });
      const decision = validateContractCreation({ opportunityStage: opp.stage, accountErpApproved: Boolean(opp.erp_approved_yn), contractCreated: Boolean(opp.contract_created_yn), productCount: Number(pc.recordset[0]?.cnt ?? 0) });
      if (!decision.allowed) throw new BadRequestException(decision.error);

      const total = Number(opp.amount ?? 0);
      let productAmount = input.productAmount;
      let goodsAmount = input.goodsAmount;
      if (productAmount == null && goodsAmount == null) throw new BadRequestException('productAmount or goodsAmount is required');
      if (productAmount == null) productAmount = Math.max(0, total - Number(goodsAmount));
      if (goodsAmount == null) goodsAmount = Math.max(0, total - Number(productAmount));
      if (!sameMoney(Number(productAmount) + Number(goodsAmount), total)) throw new BadRequestException('Product amount + goods amount must equal Opportunity amount');

      const created = await query<{ public_id: string; contract_id: number }>(`INSERT INTO crm_contract(company_id,account_id,opportunity_id,owner_user_id,contract_name,contract_date,contract_amount,product_amount,goods_amount,package_classification,special_terms,created_by,updated_by)
        OUTPUT CONVERT(varchar(36),inserted.public_id) public_id,inserted.contract_id
        VALUES(@companyId,@accountId,@opportunityId,@ownerUserId,@contractName,@contractDate,@contractAmount,@productAmount,@goodsAmount,@packageClassification,@specialTerms,@userId,@userId)`, {
        companyId, accountId: opp.account_id, opportunityId: opp.opportunity_id, ownerUserId: opp.owner_user_id,
        contractName: input.contractName?.trim() || `${opp.opportunity_name} 계약`, contractDate: input.contractDate ?? null, contractAmount: total,
        productAmount, goodsAmount, packageClassification: input.packageClassification ?? null, specialTerms: input.specialTerms ?? opp.special_terms ?? null, userId
      });
      const contractId = created.recordset[0].contract_id;
      await query(`INSERT INTO crm_contract_product(contract_id,item_type,item_name,erp_item_code,quantity,unit_price,line_amount,source_opportunity_product_id)
        SELECT @contractId,p.item_type,p.item_name,p.erp_item_code,op.quantity,op.proposed_unit_price,op.quantity*op.proposed_unit_price,op.opportunity_product_id
        FROM crm_opportunity_product op JOIN crm_product_package p ON p.product_package_id=op.product_package_id WHERE op.opportunity_id=@opportunityId`, { contractId, opportunityId: opp.opportunity_id });
      await query(`UPDATE crm_opportunity SET contract_created_yn=1,updated_at=SYSUTCDATETIME(),updated_by=@userId WHERE opportunity_id=@opportunityId`, { userId, opportunityId: opp.opportunity_id });
      return { publicId: created.recordset[0].public_id };
    });
  }

  async replaceInitialPlan(companyId: number, contractPublicId: string, rows: CollectionPlanInput[], userId: number) {
    return this.db.transaction(async query => {
      const contract = await this.lockContract(query, companyId, contractPublicId);
      if (['ERP_REQUESTED','ERP_APPROVED','CLOSED'].includes(contract.status)) throw new ConflictException('Initial collection plan is locked after ERP request');
      const decision = validatePlanTotal(Number(contract.contract_amount), rows);
      if (!decision.allowed) throw new BadRequestException(decision.error);
      await query(`DELETE FROM crm_collection_plan WHERE contract_id=@contractId AND plan_version=1`, { contractId: contract.contract_id });
      for (const row of rows) {
        await query(`INSERT INTO crm_collection_plan(contract_id,plan_version,installment_no,collection_method,amount,planned_date,adjustment_type,is_current,erp_sync_status,created_by)
          VALUES(@contractId,1,@installmentNo,@method,@amount,@plannedDate,'ORIGINAL',1,'NOT_REQUESTED',@userId)`, {
          contractId: contract.contract_id, installmentNo: row.installmentNo, method: row.collectionMethod, amount: row.amount, plannedDate: row.plannedDate, userId
        });
      }
      return { contractPublicId, planVersion: 1, rowCount: rows.length, total: decision.total };
    });
  }

  async requestErpContract(companyId: number, contractPublicId: string, userId: number) {
    const contract = await this.get(companyId, contractPublicId) as any;
    if (!contract.erp_approved_yn) throw new BadRequestException('ERP-approved Account is required');
    if (!['DRAFT','ERP_FAILED'].includes(contract.status)) throw new ConflictException('Contract cannot be requested in current status');
    const currentPlans = (contract.plans as any[]).filter(p => p.is_current);
    const decision = validatePlanTotal(Number(contract.contract_amount), currentPlans.map(p => ({ amount: Number(p.amount) })));
    if (!decision.allowed) throw new BadRequestException(decision.error);
    const payload = {
      contractPublicId,
      account: { publicId: contract.account_public_id, erpCustomerCode: contract.erp_customer_code },
      contract: { name: contract.contract_name, date: contract.contract_date, amount: contract.contract_amount, productAmount: contract.product_amount, goodsAmount: contract.goods_amount, specialTerms: contract.special_terms },
      products: contract.products,
      collectionPlan: currentPlans
    };
    const queued = await this.interfaces.enqueuePending({ companyId, interfaceCode: 'IF-ERP-004', direction: 'OUT', entityType: 'CONTRACT', entityId: contractPublicId, payload });
    await this.db.query(`UPDATE crm_contract SET status='ERP_REQUESTED',integration_status='REQUESTING',last_erp_request_id=@requestId,erp_requested_at=SYSUTCDATETIME(),updated_at=SYSUTCDATETIME(),updated_by=@userId WHERE contract_id=@contractId`, {
      requestId: queued.requestId, userId, contractId: contract.contract_id
    });
    return queued;
  }

  async applyErpContractResult(companyId: number, input: { contractPublicId: string; success: boolean; erpContractNo?: string; requestId?: string; message?: string }) {
    const contract = await this.get(companyId, input.contractPublicId) as any;
    if (input.success && !input.erpContractNo) throw new BadRequestException('erpContractNo is required on success');
    await this.db.transaction(async query => {
      await query(`UPDATE crm_contract SET status=CASE WHEN @success=1 THEN 'ERP_APPROVED' ELSE 'ERP_FAILED' END,
        integration_status=CASE WHEN @success=1 THEN 'SUCCESS' ELSE 'FAILED' END,erp_approval_status=CASE WHEN @success=1 THEN 'APPROVED' ELSE 'FAILED' END,
        erp_contract_no=CASE WHEN @success=1 THEN @erpContractNo ELSE erp_contract_no END,erp_approved_at=CASE WHEN @success=1 THEN SYSUTCDATETIME() ELSE erp_approved_at END,updated_at=SYSUTCDATETIME()
        WHERE contract_id=@contractId`, { success: input.success ? 1 : 0, erpContractNo: input.erpContractNo ?? null, contractId: contract.contract_id });
      if (input.success) await query(`UPDATE crm_collection_plan SET locked_yn=1 WHERE contract_id=@contractId AND plan_version=1`, { contractId: contract.contract_id });
    });
    if (input.requestId) await this.completeInterface(input.requestId, input.success, input);
    return { contractPublicId: input.contractPublicId, status: input.success ? 'ERP_APPROVED' : 'ERP_FAILED', erpContractNo: input.erpContractNo ?? null };
  }

  async ingestCollections(companyId: number, contractPublicId: string, rows: Array<{ erpCollectionNo: string; amount: number; collectedAt: string }>) {
    const contract = await this.get(companyId, contractPublicId) as any;
    await this.db.transaction(async query => {
      for (const row of rows) {
        await query(`MERGE crm_collection_actual AS t USING(SELECT @contractId contract_id,@erpCollectionNo erp_collection_no) s
          ON t.contract_id=s.contract_id AND t.erp_collection_no=s.erp_collection_no
          WHEN MATCHED THEN UPDATE SET amount=@amount,collected_at=@collectedAt,updated_at=SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT(company_id,contract_id,erp_collection_no,amount,collected_at,source_system) VALUES(@companyId,@contractId,@erpCollectionNo,@amount,@collectedAt,'ERP');`, {
          companyId, contractId: contract.contract_id, erpCollectionNo: row.erpCollectionNo, amount: row.amount, collectedAt: row.collectedAt
        });
      }
    });
    const reconciliation = await this.reconciliation(companyId, contractPublicId);
    await this.db.query(`UPDATE crm_collection_plan SET correction_required_yn=@required WHERE contract_id=@contractId AND is_current=1`, {
      required: reconciliation.correctionRequired ? 1 : 0, contractId: contract.contract_id
    });
    return reconciliation;
  }

  async collections(companyId: number, contractPublicId: string) {
    const contract = await this.get(companyId, contractPublicId) as any;
    const r = await this.db.query(`SELECT CONVERT(varchar(36),public_id) public_id,erp_collection_no,amount,collected_at,source_system
      FROM crm_collection_actual WHERE company_id=@companyId AND contract_id=@contractId ORDER BY collected_at,collection_actual_id`, { companyId, contractId: contract.contract_id });
    return r.recordset;
  }

  async reconciliation(companyId: number, contractPublicId: string) {
    const contract = await this.get(companyId, contractPublicId) as any;
    const actual = await this.db.query<{ actual_total: number }>(`SELECT ISNULL(SUM(amount),0) actual_total FROM crm_collection_actual WHERE company_id=@companyId AND contract_id=@contractId`, { companyId, contractId: contract.contract_id });
    const plan = await this.db.query<{ plan_total: number; overdue_total: number }>(`SELECT ISNULL(SUM(amount),0) plan_total,ISNULL(SUM(CASE WHEN planned_date<CAST(SYSUTCDATETIME() AS date) THEN amount ELSE 0 END),0) overdue_total
      FROM crm_collection_plan WHERE contract_id=@contractId AND is_current=1`, { contractId: contract.contract_id });
    const actualTotal = Number(actual.recordset[0]?.actual_total ?? 0);
    const planTotal = Number(plan.recordset[0]?.plan_total ?? 0);
    const overdueTotal = Number(plan.recordset[0]?.overdue_total ?? 0);
    const outstandingAmount = Math.max(0, Number(contract.contract_amount) - actualTotal);
    return {
      contractPublicId,
      contractAmount: Number(contract.contract_amount),
      currentPlanTotal: planTotal,
      actualTotal,
      overduePlanTotal: overdueTotal,
      outstandingAmount,
      correctionRequired: outstandingAmount > 0 && actualTotal + 0.005 < overdueTotal
    };
  }

  async changePlan(companyId: number, contractPublicId: string, rows: CollectionPlanInput[], userId: number) {
    const reconciliation = await this.reconciliation(companyId, contractPublicId);
    const decision = validateChangedPlan(reconciliation.outstandingAmount, rows);
    if (!decision.allowed) throw new BadRequestException(decision.error);
    const result = await this.db.transaction(async query => {
      const contract = await this.lockContract(query, companyId, contractPublicId);
      if (contract.status !== 'ERP_APPROVED') throw new ConflictException('Changed plan requires ERP-approved Contract');
      const vr = await query<{ max_version: number }>(`SELECT ISNULL(MAX(plan_version),0) max_version FROM crm_collection_plan WHERE contract_id=@contractId`, { contractId: contract.contract_id });
      const version = Number(vr.recordset[0]?.max_version ?? 0) + 1;
      await query(`UPDATE crm_collection_plan SET is_current=0 WHERE contract_id=@contractId AND is_current=1`, { contractId: contract.contract_id });
      for (const row of rows) {
        await query(`INSERT INTO crm_collection_plan(contract_id,plan_version,installment_no,collection_method,amount,planned_date,adjustment_type,is_current,erp_sync_status,created_by)
          VALUES(@contractId,@version,@installmentNo,@method,@amount,@plannedDate,'ARREARS_REALLOCATION',1,'NOT_REQUESTED',@userId)`, {
          contractId: contract.contract_id, version, installmentNo: row.installmentNo, method: row.collectionMethod, amount: row.amount, plannedDate: row.plannedDate, userId
        });
      }
      return { contractId: contract.contract_id, version };
    });
    const queued = await this.interfaces.enqueuePending({ companyId, interfaceCode: 'IF-ERP-011', direction: 'OUT', entityType: 'CONTRACT', entityId: contractPublicId, payload: { contractPublicId, planVersion: result.version, outstandingAmount: reconciliation.outstandingAmount, rows } });
    await this.db.query(`UPDATE crm_collection_plan SET erp_sync_status='REQUESTING',last_erp_request_id=@requestId WHERE contract_id=@contractId AND plan_version=@version`, { requestId: queued.requestId, contractId: result.contractId, version: result.version });
    return { contractPublicId, planVersion: result.version, requestId: queued.requestId, status: queued.status };
  }

  private async lockContract(query: DbQuery, companyId: number, publicId: string): Promise<any> {
    const r = await query<any>(`SELECT TOP 1 c.*,a.erp_approved_yn,a.erp_customer_code FROM crm_contract c WITH(UPDLOCK,ROWLOCK) JOIN crm_account a ON a.account_id=c.account_id
      WHERE c.company_id=@companyId AND c.public_id=@publicId AND c.deleted_yn=0`, { companyId, publicId });
    if (!r.recordset[0]) throw new NotFoundException('Contract not found');
    return r.recordset[0];
  }

  private async completeInterface(requestId: string, success: boolean, response: unknown) {
    await this.db.query(`UPDATE crm_interface_log SET status=@status,response_json=@response,responded_at=SYSUTCDATETIME(),error_message=CASE WHEN @success=1 THEN NULL ELSE @message END WHERE request_id=@requestId`, {
      requestId, status: success ? 'SUCCESS' : 'FAILED', response: JSON.stringify(response), success: success ? 1 : 0,
      message: typeof response === 'object' && response && 'message' in response ? String((response as any).message ?? '') : null
    });
  }
}
