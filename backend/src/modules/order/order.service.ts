import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, DbQuery } from '../../database/database.service';
import { InterfaceService } from '../../integration/interface.service';
import { canEditOrder, validateOrderEligibility, validateOrderItems } from './order.rules';

@Injectable()
export class OrderService {
  constructor(private readonly db: DatabaseService, private readonly interfaces: InterfaceService) {}

  async searchProducts(companyId: number, search?: string, itemType?: string) {
    const r = await this.db.query(`SELECT CONVERT(varchar(36),public_id) public_id,item_type,item_name,erp_item_code,category,
      ISNULL(current_unit_price,base_price) unit_price,stock_qty,order_available_yn,source_system,erp_synced_at
      FROM crm_product_package
      WHERE company_id=@companyId AND deleted_yn=0 AND is_active=1
        AND (@itemType IS NULL OR item_type=@itemType)
        AND (@search IS NULL OR item_name LIKE '%' + @search + '%' OR erp_item_code LIKE '%' + @search + '%')
      ORDER BY item_type,item_name`, { companyId, itemType: itemType || null, search: search?.trim() || null });
    return r.recordset;
  }

  async eligibleContracts(companyId: number) {
    const r = await this.db.query(`SELECT CONVERT(varchar(36),c.public_id) public_id,c.contract_name,c.contract_amount,c.erp_contract_no,
      CONVERT(varchar(36),a.public_id) account_public_id,a.account_name,a.address
      FROM crm_contract c JOIN crm_account a ON a.account_id=c.account_id
      WHERE c.company_id=@companyId AND c.deleted_yn=0 AND c.status='ERP_APPROVED' AND c.close_yn=0 AND a.erp_approved_yn=1
      ORDER BY c.contract_id DESC`, { companyId });
    return r.recordset;
  }

  async list(companyId: number, status?: string, accountPublicId?: string) {
    const r = await this.db.query(`SELECT TOP 500 CONVERT(varchar(36),o.public_id) public_id,o.status,o.integration_status,o.erp_order_no,
      o.delivery_address_type,o.delivery_address,o.express_yn,o.note,o.requested_at,o.updated_at,
      CONVERT(varchar(36),c.public_id) contract_public_id,c.contract_name,CONVERT(varchar(36),a.public_id) account_public_id,a.account_name,
      ISNULL(x.order_amount,0) order_amount,ISNULL(x.item_count,0) item_count
      FROM crm_order o JOIN crm_contract c ON c.contract_id=o.contract_id JOIN crm_account a ON a.account_id=o.account_id
      OUTER APPLY(SELECT SUM(oi.quantity*oi.unit_price) order_amount,COUNT(*) item_count FROM crm_order_item oi WHERE oi.order_id=o.order_id) x
      WHERE o.company_id=@companyId AND o.deleted_yn=0 AND (@status IS NULL OR o.status=@status)
        AND (@accountPublicId IS NULL OR a.public_id=@accountPublicId)
      ORDER BY o.order_id DESC`, { companyId, status: status || null, accountPublicId: accountPublicId || null });
    return r.recordset;
  }

  async get(companyId: number, publicId: string) {
    const r = await this.db.query<any>(`SELECT TOP 1 o.*,CONVERT(varchar(36),o.public_id) public_id_text,
      CONVERT(varchar(36),c.public_id) contract_public_id,c.contract_name,c.status contract_status,c.close_yn,c.erp_contract_no,
      CONVERT(varchar(36),a.public_id) account_public_id,a.account_name,a.address account_address,a.erp_approved_yn
      FROM crm_order o JOIN crm_contract c ON c.contract_id=o.contract_id JOIN crm_account a ON a.account_id=o.account_id
      WHERE o.company_id=@companyId AND o.public_id=@publicId AND o.deleted_yn=0`, { companyId, publicId });
    const order = r.recordset[0];
    if (!order) throw new NotFoundException('Order not found');
    const items = await this.db.query(`SELECT CONVERT(varchar(36),oi.public_id) public_id,CONVERT(varchar(36),p.public_id) product_public_id,
      oi.erp_item_code,oi.item_name,oi.item_type,oi.category,oi.quantity,oi.unit_price,oi.package_discount_price,
      oi.quantity*oi.unit_price line_amount,oi.order_available_yn,p.stock_qty
      FROM crm_order_item oi LEFT JOIN crm_product_package p ON p.product_package_id=oi.product_package_id
      WHERE oi.order_id=@orderId ORDER BY oi.order_item_id`, { orderId: order.order_id });
    return { ...order, items: items.recordset };
  }

  async createDraft(companyId: number, contractPublicId: string, userId: number) {
    return this.db.transaction(async query => {
      const cr = await query<any>(`SELECT TOP 1 c.contract_id,c.status,c.close_yn,c.account_id,c.owner_user_id,a.erp_approved_yn,a.address
        FROM crm_contract c JOIN crm_account a ON a.account_id=c.account_id
        WHERE c.company_id=@companyId AND c.public_id=@contractPublicId AND c.deleted_yn=0`, { companyId, contractPublicId });
      const contract = cr.recordset[0];
      if (!contract) throw new NotFoundException('Contract not found');
      const decision = validateOrderEligibility({ contractStatus: contract.status, contractClosed: Boolean(contract.close_yn), accountErpApproved: Boolean(contract.erp_approved_yn) });
      if (!decision.allowed) throw new BadRequestException(decision.error);
      const created = await query<{ public_id: string }>(`INSERT INTO crm_order(company_id,contract_id,account_id,owner_user_id,status,delivery_address_type,delivery_address,created_by,updated_by)
        OUTPUT CONVERT(varchar(36),inserted.public_id) public_id
        VALUES(@companyId,@contractId,@accountId,@ownerUserId,'DRAFT','ACCOUNT',@address,@userId,@userId)`, {
        companyId, contractId: contract.contract_id, accountId: contract.account_id, ownerUserId: contract.owner_user_id ?? userId,
        address: contract.address ?? null, userId
      });
      return { publicId: created.recordset[0].public_id };
    });
  }

  async addItem(companyId: number, orderPublicId: string, input: { productPublicId: string; quantity: number; unitPrice?: number }, userId: number) {
    return this.db.transaction(async query => {
      const order = await this.lockOrder(query, companyId, orderPublicId);
      if (!canEditOrder(order.status)) throw new ConflictException('Order cannot be edited in current status');
      const pr = await query<any>(`SELECT TOP 1 * FROM crm_product_package WHERE company_id=@companyId AND public_id=@productPublicId AND deleted_yn=0 AND is_active=1`, { companyId, productPublicId: input.productPublicId });
      const product = pr.recordset[0];
      if (!product) throw new NotFoundException('Product not found');
      const price = input.unitPrice ?? Number(product.current_unit_price ?? product.base_price ?? 0);
      await query(`IF EXISTS(SELECT 1 FROM crm_order_item WHERE order_id=@orderId AND product_package_id=@productId)
        UPDATE crm_order_item SET quantity=@quantity,unit_price=@price,order_available_yn=@available,updated_at=SYSUTCDATETIME(),updated_by=@userId WHERE order_id=@orderId AND product_package_id=@productId
        ELSE INSERT INTO crm_order_item(order_id,product_package_id,erp_item_code,item_name,item_type,category,quantity,unit_price,order_available_yn,created_by,updated_by)
        VALUES(@orderId,@productId,@erpItemCode,@itemName,@itemType,@category,@quantity,@price,@available,@userId,@userId)`, {
        orderId: order.order_id, productId: product.product_package_id, erpItemCode: product.erp_item_code ?? null,
        itemName: product.item_name, itemType: product.item_type ?? null, category: product.category ?? null, quantity: input.quantity,
        price, available: product.order_available_yn ? 1 : 0, userId
      });
      return this.get(companyId, orderPublicId);
    });
  }

  async removeItem(companyId: number, orderPublicId: string, itemPublicId: string) {
    return this.db.transaction(async query => {
      const order = await this.lockOrder(query, companyId, orderPublicId);
      if (!canEditOrder(order.status)) throw new ConflictException('Order cannot be edited in current status');
      const r = await query(`DELETE FROM crm_order_item WHERE order_id=@orderId AND public_id=@itemPublicId`, { orderId: order.order_id, itemPublicId });
      if (!r.rowsAffected[0]) throw new NotFoundException('Order item not found');
      return { itemPublicId, removed: true };
    });
  }

  async updateDelivery(companyId: number, orderPublicId: string, input: { deliveryAddressType: 'ACCOUNT'|'DIRECT'; deliveryAddress?: string | null; expressYn?: boolean; note?: string | null }, userId: number) {
    const order = await this.get(companyId, orderPublicId) as any;
    if (!canEditOrder(order.status)) throw new ConflictException('Order cannot be edited in current status');
    const address = input.deliveryAddressType === 'ACCOUNT' ? order.account_address : input.deliveryAddress;
    if (!address?.trim()) throw new BadRequestException('Delivery address is required');
    await this.db.query(`UPDATE crm_order SET delivery_address_type=@type,delivery_address=@address,express_yn=@expressYn,note=@note,updated_at=SYSUTCDATETIME(),updated_by=@userId
      WHERE order_id=@orderId`, { type: input.deliveryAddressType, address, expressYn: input.expressYn ? 1 : 0, note: input.note ?? null, userId, orderId: order.order_id });
    return this.get(companyId, orderPublicId);
  }

  async submit(companyId: number, orderPublicId: string, userId: number) {
    const order = await this.get(companyId, orderPublicId) as any;
    if (!canEditOrder(order.status)) throw new ConflictException('Order already submitted or locked');
    const eligibility = validateOrderEligibility({ contractStatus: order.contract_status, contractClosed: Boolean(order.close_yn), accountErpApproved: Boolean(order.erp_approved_yn) });
    if (!eligibility.allowed) throw new BadRequestException(eligibility.error);
    const itemDecision = validateOrderItems((order.items as any[]).map(x => ({ quantity: Number(x.quantity), orderAvailable: Boolean(x.order_available_yn) })));
    if (!itemDecision.allowed) throw new BadRequestException(itemDecision.error);
    if (!order.delivery_address_type || !String(order.delivery_address ?? '').trim()) throw new BadRequestException('Delivery information is required');

    const payload = {
      orderPublicId,
      contract: { publicId: order.contract_public_id, erpContractNo: order.erp_contract_no },
      account: { publicId: order.account_public_id, accountName: order.account_name },
      items: order.items,
      delivery: { addressType: order.delivery_address_type, address: order.delivery_address, expressYn: Boolean(order.express_yn), note: order.note }
    };
    const queued = await this.interfaces.enqueuePending({ companyId, interfaceCode:'IF-ERP-007', direction:'OUT', entityType:'ORDER', entityId:orderPublicId, payload });
    await this.db.query(`UPDATE crm_order SET status='REQUESTING',integration_status='REQUESTING',last_erp_request_id=@requestId,requested_at=SYSUTCDATETIME(),updated_at=SYSUTCDATETIME(),updated_by=@userId WHERE order_id=@orderId`, {
      requestId: queued.requestId, userId, orderId: order.order_id
    });
    return queued;
  }

  async applyOrderResult(companyId: number, input: { orderPublicId: string; success: boolean; erpOrderNo?: string; status?: string; requestId?: string; message?: string }) {
    const order = await this.get(companyId, input.orderPublicId) as any;
    if (input.success && !input.erpOrderNo) throw new BadRequestException('erpOrderNo is required on success');
    const status = input.success ? (input.status || 'ACCEPTED') : 'FAILED';
    await this.db.query(`UPDATE crm_order SET status=@status,integration_status=CASE WHEN @success=1 THEN 'SUCCESS' ELSE 'FAILED' END,
      erp_order_no=CASE WHEN @success=1 THEN @erpOrderNo ELSE erp_order_no END,erp_updated_at=SYSUTCDATETIME(),updated_at=SYSUTCDATETIME()
      WHERE order_id=@orderId`, { status, success: input.success ? 1 : 0, erpOrderNo: input.erpOrderNo ?? null, orderId: order.order_id });
    if (input.requestId) await this.completeInterface(input.requestId, input.success, input);
    return { orderPublicId: input.orderPublicId, status, erpOrderNo: input.erpOrderNo ?? null };
  }

  async ingestDeliveries(companyId: number, rows: Array<{ orderPublicId: string; erpDeliveryNo: string; deliveryStatus: string; shippedAt?: string; deliveredAt?: string; payload?: unknown }>) {
    for (const row of rows) {
      const order = await this.get(companyId, row.orderPublicId) as any;
      await this.db.query(`MERGE crm_delivery AS t USING(SELECT @companyId company_id,@erpDeliveryNo erp_delivery_no) s
        ON t.company_id=s.company_id AND t.erp_delivery_no=s.erp_delivery_no
        WHEN MATCHED THEN UPDATE SET delivery_status=@status,shipped_at=@shippedAt,delivered_at=@deliveredAt,payload_json=@payload,updated_at=SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT(company_id,order_id,erp_delivery_no,delivery_status,shipped_at,delivered_at,payload_json)
        VALUES(@companyId,@orderId,@erpDeliveryNo,@status,@shippedAt,@deliveredAt,@payload);`, {
        companyId, orderId: order.order_id, erpDeliveryNo: row.erpDeliveryNo, status: row.deliveryStatus,
        shippedAt: row.shippedAt ?? null, deliveredAt: row.deliveredAt ?? null, payload: row.payload == null ? null : JSON.stringify(row.payload)
      });
      await this.db.query(`UPDATE crm_order SET status=CASE WHEN @status IN('DELIVERED','COMPLETED') THEN 'COMPLETED' ELSE status END,erp_updated_at=SYSUTCDATETIME() WHERE order_id=@orderId`, {
        status: row.deliveryStatus, orderId: order.order_id
      });
    }
    return { processed: rows.length };
  }

  async ingestSales(companyId: number, rows: Array<{ accountPublicId: string; erpSalesNo: string; salesDate: string; amount: number; contractPublicId?: string; orderPublicId?: string; itemCode?: string; itemName?: string; quantity?: number; payload?: unknown }>) {
    for (const row of rows) {
      const ids = await this.resolveSalesIds(companyId, row.accountPublicId, row.contractPublicId, row.orderPublicId);
      await this.db.query(`MERGE crm_sales AS t USING(SELECT @companyId company_id,@erpSalesNo erp_sales_no) s
        ON t.company_id=s.company_id AND t.erp_sales_no=s.erp_sales_no
        WHEN MATCHED THEN UPDATE SET sales_date=@salesDate,amount=@amount,item_code=@itemCode,item_name=@itemName,quantity=@quantity,payload_json=@payload,updated_at=SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT(company_id,account_id,contract_id,order_id,erp_sales_no,sales_date,amount,item_code,item_name,quantity,payload_json)
        VALUES(@companyId,@accountId,@contractId,@orderId,@erpSalesNo,@salesDate,@amount,@itemCode,@itemName,@quantity,@payload);`, {
        companyId, accountId: ids.accountId, contractId: ids.contractId, orderId: ids.orderId, erpSalesNo: row.erpSalesNo,
        salesDate: row.salesDate, amount: row.amount, itemCode: row.itemCode ?? null, itemName: row.itemName ?? null, quantity: row.quantity ?? null,
        payload: row.payload == null ? null : JSON.stringify(row.payload)
      });
    }
    return { processed: rows.length };
  }

  async ingestReturnExchange(companyId: number, rows: Array<{ erpReferenceNo: string; transactionType: 'RETURN'|'EXCHANGE'; status: string; orderPublicId?: string; erpSalesNo?: string; itemCode?: string; quantity?: number; processedAt?: string; payload?: unknown }>) {
    for (const row of rows) {
      let orderId: number | null = null;
      let salesId: number | null = null;
      if (row.orderPublicId) {
        const o = await this.get(companyId, row.orderPublicId) as any;
        orderId = o.order_id;
      }
      if (row.erpSalesNo) {
        const s = await this.db.query<{ sales_id:number }>(`SELECT TOP 1 sales_id FROM crm_sales WHERE company_id=@companyId AND erp_sales_no=@erpSalesNo`, { companyId, erpSalesNo: row.erpSalesNo });
        salesId = s.recordset[0]?.sales_id ?? null;
      }
      await this.db.query(`MERGE crm_return_exchange AS t USING(SELECT @companyId company_id,@erpReferenceNo erp_reference_no) s
        ON t.company_id=s.company_id AND t.erp_reference_no=s.erp_reference_no
        WHEN MATCHED THEN UPDATE SET transaction_type=@type,status=@status,order_id=@orderId,sales_id=@salesId,item_code=@itemCode,quantity=@quantity,processed_at=@processedAt,payload_json=@payload,updated_at=SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT(company_id,order_id,sales_id,erp_reference_no,transaction_type,status,item_code,quantity,processed_at,payload_json)
        VALUES(@companyId,@orderId,@salesId,@erpReferenceNo,@type,@status,@itemCode,@quantity,@processedAt,@payload);`, {
        companyId, orderId, salesId, erpReferenceNo: row.erpReferenceNo, type: row.transactionType, status: row.status,
        itemCode: row.itemCode ?? null, quantity: row.quantity ?? null, processedAt: row.processedAt ?? null,
        payload: row.payload == null ? null : JSON.stringify(row.payload)
      });
    }
    return { processed: rows.length };
  }

  async fulfillment(companyId: number, orderPublicId: string) {
    const order = await this.get(companyId, orderPublicId) as any;
    const deliveries = await this.db.query(`SELECT CONVERT(varchar(36),public_id) public_id,erp_delivery_no,delivery_status,shipped_at,delivered_at FROM crm_delivery WHERE company_id=@companyId AND order_id=@orderId ORDER BY delivery_id`, { companyId, orderId: order.order_id });
    const sales = await this.db.query(`SELECT CONVERT(varchar(36),public_id) public_id,erp_sales_no,sales_date,amount,item_code,item_name,quantity FROM crm_sales WHERE company_id=@companyId AND order_id=@orderId ORDER BY sales_date,sales_id`, { companyId, orderId: order.order_id });
    const returns = await this.db.query(`SELECT CONVERT(varchar(36),public_id) public_id,erp_reference_no,transaction_type,status,item_code,quantity,processed_at FROM crm_return_exchange WHERE company_id=@companyId AND order_id=@orderId ORDER BY return_exchange_id`, { companyId, orderId: order.order_id });
    return { order, deliveries: deliveries.recordset, sales: sales.recordset, returnExchanges: returns.recordset };
  }

  async sales(companyId: number, accountPublicId?: string, from?: string, to?: string) {
    const r = await this.db.query(`SELECT TOP 1000 CONVERT(varchar(36),s.public_id) public_id,s.erp_sales_no,s.sales_date,s.amount,s.item_code,s.item_name,s.quantity,
      CONVERT(varchar(36),a.public_id) account_public_id,a.account_name,CONVERT(varchar(36),c.public_id) contract_public_id,CONVERT(varchar(36),o.public_id) order_public_id
      FROM crm_sales s JOIN crm_account a ON a.account_id=s.account_id LEFT JOIN crm_contract c ON c.contract_id=s.contract_id LEFT JOIN crm_order o ON o.order_id=s.order_id
      WHERE s.company_id=@companyId AND (@accountPublicId IS NULL OR a.public_id=@accountPublicId)
        AND (@from IS NULL OR s.sales_date>=@from) AND (@to IS NULL OR s.sales_date<=@to)
      ORDER BY s.sales_date DESC,s.sales_id DESC`, { companyId, accountPublicId: accountPublicId || null, from: from || null, to: to || null });
    return r.recordset;
  }

  private async lockOrder(query: DbQuery, companyId: number, publicId: string): Promise<any> {
    const r = await query<any>(`SELECT TOP 1 * FROM crm_order WITH(UPDLOCK,ROWLOCK) WHERE company_id=@companyId AND public_id=@publicId AND deleted_yn=0`, { companyId, publicId });
    if (!r.recordset[0]) throw new NotFoundException('Order not found');
    return r.recordset[0];
  }

  private async resolveSalesIds(companyId: number, accountPublicId: string, contractPublicId?: string, orderPublicId?: string) {
    const a = await this.db.query<{ account_id:number }>(`SELECT TOP 1 account_id FROM crm_account WHERE company_id=@companyId AND public_id=@accountPublicId AND deleted_yn=0`, { companyId, accountPublicId });
    if (!a.recordset[0]) throw new NotFoundException('Account not found for sales');
    let contractId: number | null = null;
    let orderId: number | null = null;
    if (contractPublicId) {
      const c = await this.db.query<{ contract_id:number }>(`SELECT TOP 1 contract_id FROM crm_contract WHERE company_id=@companyId AND public_id=@contractPublicId AND deleted_yn=0`, { companyId, contractPublicId });
      if (!c.recordset[0]) throw new NotFoundException('Contract not found for sales');
      contractId = c.recordset[0].contract_id;
    }
    if (orderPublicId) {
      const o = await this.db.query<{ order_id:number }>(`SELECT TOP 1 order_id FROM crm_order WHERE company_id=@companyId AND public_id=@orderPublicId AND deleted_yn=0`, { companyId, orderPublicId });
      if (!o.recordset[0]) throw new NotFoundException('Order not found for sales');
      orderId = o.recordset[0].order_id;
    }
    return { accountId:a.recordset[0].account_id, contractId, orderId };
  }

  private async completeInterface(requestId: string, success: boolean, response: unknown) {
    await this.db.query(`UPDATE crm_interface_log SET status=@status,response_json=@response,responded_at=SYSUTCDATETIME(),error_message=CASE WHEN @success=1 THEN NULL ELSE error_message END WHERE request_id=@requestId`, {
      status: success ? 'SUCCESS' : 'FAILED', response: JSON.stringify(response), success: success ? 1 : 0, requestId
    });
  }
}
