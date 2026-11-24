import { requireAccountRelatedAccess } from './account-related-routes.js';
import { HqApplication, hqCanRead, hqFind, hqNumber, hqOnlyKeys, hqRequire, hqText } from './app.js';
import type { HqRouteContext } from './app.js';
import { auditHq, hqAssert, newHqId } from './model.js';
import type { HqDataset, HqRow } from './model.js';
import { enqueueInterface } from './interfaces.js';
import { summarizeFulfillment } from './order-fulfillment.js';
import { visibleOrderDelivery } from './order-visibility.js';
import { contractAmountsReadable } from './contract-visibility.js';

const owner = (c: HqRouteContext, row: HqRow) => hqAssert(row.owner_user_id === c.actor.userId || ['ALL', 'SYSTEM'].includes(c.actor.scope), 403, 'OWNER_WRITE_DENIED');
const order = (c: HqRouteContext, d: HqDataset, id: string) => {
  const row = hqFind(d, c.actor, 'orders', id);
  hqFind(d, c.actor, 'contracts', String(row.contract_public_id));
  hqFind(d, c.actor, 'accounts', String(row.account_public_id));
  return row;
};
const detail = (c: HqRouteContext, d: HqDataset, row: HqRow) => {
  const contract = hqFind(d, c.actor, 'contracts', String(row.contract_public_id));
  const account = hqFind(d, c.actor, 'accounts', String(row.account_public_id));
  const visible = visibleOrderDelivery(c, row);
  return { ...visible, delivery_address_protected: visible.delivery_address !== row.delivery_address, contract_name: contract.contract_name, account_name: account.account_name,
    contract_amount: contractAmountsReadable(c, contract) ? contract.contract_amount : null, erp_contract_no: contract.erp_contract_no,
    items: (row.items as Record<string, unknown>[] ?? []).map(line => ({ ...line, public_id: line.public_id ?? line.product_public_id,
      item_name: d.collections.products.find(p => p.public_id === line.product_public_id)?.item_name ?? line.item_name,
      erp_item_code: d.collections.products.find(p => p.public_id === line.product_public_id)?.erp_item_code ?? null })) };
};
const editable = (row: HqRow) => hqAssert(['DRAFT', 'FAILED'].includes(String(row.status)), 409, 'ORDER_NOT_EDITABLE');
const recalc = (row: HqRow) => { row.order_amount = (row.items as Record<string, unknown>[]).reduce((sum, line) => sum + Number(line.amount), 0); row.version++; };

export function installOrderRoutes(app: HqApplication): void {
  app.replaceRoute('GET', '/api/order-products', c => {
    app.requireAction(c.actor, 'ORD.catalog');
    const type = c.query.get('itemType');
    hqAssert(type === 'PRODUCT' || type === 'PACKAGE', 400, 'ITEM_TYPE_REQUIRED');
    const search = (c.query.get('search') ?? '').trim();
    hqAssert(!search || search.length >= 3, 400, 'SEARCH_TERM_TOO_SHORT');
    const category = c.query.get('category') ?? '';
    return c.repository.read().collections.products.filter(p => hqCanRead(c.actor, p) && p.item_type === type && (!category || p.category === category)
      && (!search || `${p.item_name} ${p.erp_item_code}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  });
  app.route('GET', '/api/orders/eligible-contracts', c => {
    hqRequire(c.actor, 'CONTRACT.READ'); app.requireScreen(c.actor, 'HQ_ORDER');
    const d = c.repository.read();
    return d.collections.contracts.filter(row => hqCanRead(c.actor, row) && row.status === 'ERP_APPROVED' && row.close_yn !== true
      && d.collections.accounts.some(a => a.public_id === row.account_public_id && hqCanRead(c.actor, a) && a.erp_approved_yn === true))
      .map(row => { const {mock_files: _files, ...visible} = row; return { ...visible, account_name: d.collections.accounts.find(a => a.public_id === row.account_public_id)?.account_name }; });
  });
  app.replaceRoute('GET', '/api/orders', c => {
    hqRequire(c.actor, 'ORDER.READ'); app.requireScreen(c.actor, 'HQ_ORDER'); const d = c.repository.read();
    return d.collections.orders.filter(row => hqCanRead(c.actor, row) && d.collections.contracts.some(k => k.public_id === row.contract_public_id && hqCanRead(c.actor, k)))
      .map(row => detail(c, d, row));
  });
  app.replaceRoute('GET', '/api/orders/:publicId', c => {
    hqRequire(c.actor, 'ORDER.READ'); app.requireScreen(c.actor, 'HQ_ORDER'); const d = c.repository.read(); return detail(c, d, order(c, d, c.params.publicId));
  });
  app.route('DELETE', '/api/orders/:publicId', c => c.repository.transact(d => {
    hqOnlyKeys(c.body, ['expectedVersion']);
    hqRequire(c.actor, 'ORDER.WRITE'); app.requireScreen(c.actor, 'HQ_ORDER');
    const row = order(c, d, c.params.publicId); owner(c, row);
    hqAssert(Number.isSafeInteger(c.body.expectedVersion) && Number(c.body.expectedVersion) > 0, 400, 'VERSION_INVALID');
    hqAssert(c.body.expectedVersion === row.version, 409, 'VERSION_CONFLICT');
    hqAssert(row.status === 'DRAFT' && row.integration_status === 'NOT_REQUESTED', 409, 'ORDER_NOT_DELETABLE');
    hqAssert(!d.collections.interfaceLogs.some(log => log.entityPublicId === row.public_id) && !['deliveries','sales','returns'].some(key => d.collections[key as 'deliveries'|'sales'|'returns'].some(item => item.order_public_id === row.public_id)), 409, 'ORDER_HAS_RELATED_DATA');
    const index = d.collections.orders.findIndex(item => item.public_id === row.public_id);
    d.collections.orders.splice(index, 1);
    auditHq(d, c.actor, 'ORD.draft.delete', row.public_id, { itemCount: Array.isArray(row.items) ? row.items.length : 0 });
    return { success: true };
  }));
  app.route('POST', '/api/orders', c => c.repository.transact(d => {
    hqOnlyKeys(c.body, ['contractPublicId']);
    const contract = hqFind(d, c.actor, 'contracts', hqText(c.body.contractPublicId, 'contractPublicId')); owner(c, contract);
    const account = hqFind(d, c.actor, 'accounts', String(contract.account_public_id));
    app.requireAction(c.actor, 'ORD.draft', { 'contract.status': contract.status, 'account.erpApprovedYn': account.erp_approved_yn }, c.body);
    hqAssert(contract.status === 'ERP_APPROVED' && contract.close_yn !== true && account.erp_approved_yn === true, 409, 'ORDER_CONTRACT_INELIGIBLE');
    const row: HqRow = { public_id: newHqId(d), company_id: c.actor.companyId, owner_user_id: contract.owner_user_id,
      organization_id: contract.organization_id, version: 1, contract_public_id: contract.public_id, account_public_id: account.public_id,
      status: 'DRAFT', integration_status: 'NOT_REQUESTED', order_amount: 0, items: [], delivery_address_type: 'ACCOUNT',
      delivery_address: account.address ?? '', express_yn: false, note: '', erp_order_no: null, created_at: d.clock };
    d.collections.orders.push(row); auditHq(d, c.actor, 'ORD.draft', row.public_id, { contractPublicId: contract.public_id }); return detail(c, d, row);
  }));
  app.route('POST', '/api/orders/:publicId/items', c => c.repository.transact(d => {
    hqOnlyKeys(c.body, ['productPublicId', 'quantity']); const row = order(c, d, c.params.publicId); owner(c, row); editable(row);
    const product = hqFind(d, c.actor, 'products', hqText(c.body.productPublicId, 'productPublicId'));
    const quantity = hqNumber(c.body.quantity, 'quantity', 1);
    app.requireAction(c.actor, 'ORD.items.add', { ...row, 'order.status': row.status }, { productPublicId: product.public_id, quantity, unitPrice: product.unit_price });
    hqAssert(Number.isInteger(quantity) && quantity <= 9999, 400, 'QUANTITY_INVALID');
    hqAssert(product.order_available_yn === true && Number(product.stock_qty) > 0 && Number(product.stock_qty) >= quantity, 409, 'ORDER_PRODUCT_UNAVAILABLE');
    const lines = row.items as Record<string, unknown>[];
    hqAssert(!lines.some(line => line.product_public_id === product.public_id), 409, 'ORDER_ITEM_DUPLICATE');
    const line = { public_id: newHqId(d), product_public_id: product.public_id, item_name: product.item_name, erp_item_code: product.erp_item_code,
      quantity, unit_price: Number(product.unit_price), amount: quantity * Number(product.unit_price), ...(typeof product.unit === 'string' && product.unit ? { unit: product.unit } : {}) };
    lines.push(line); recalc(row); auditHq(d, c.actor, 'ORD.items.add', row.public_id, { productPublicId: product.public_id }); return detail(c, d, row);
  }));
  app.route('PATCH', '/api/orders/:publicId/items/:itemId', c => c.repository.transact(d => {
    hqOnlyKeys(c.body, ['quantity']);
    const row = order(c, d, c.params.publicId); owner(c, row); editable(row);
    const quantity = hqNumber(c.body.quantity, 'quantity', 1);
    hqAssert(Number.isInteger(quantity) && quantity <= 9999, 400, 'QUANTITY_INVALID');
    app.requireAction(c.actor, 'ORD.items.update', { ...row, 'order.status': row.status }, { quantity });
    const line = (row.items as Record<string, unknown>[]).find(item => (item.public_id ?? item.product_public_id) === c.params.itemId);
    hqAssert(line, 404, 'ORDER_ITEM_NOT_FOUND');
    const product = hqFind(d, c.actor, 'products', String(line.product_public_id));
    hqAssert(product.order_available_yn === true && Number(product.stock_qty) >= quantity, 409, 'ORDER_PRODUCT_UNAVAILABLE');
    const previousQuantity = line.quantity;
    line.quantity = quantity; line.amount = quantity * Number(line.unit_price); recalc(row);
    auditHq(d, c.actor, 'ORD.items.update', row.public_id, { itemId: c.params.itemId, previousQuantity, quantity });
    return detail(c, d, row);
  }));
  app.route('DELETE', '/api/orders/:publicId/items/:itemId', c => c.repository.transact(d => {
    hqOnlyKeys(c.body, []); const row = order(c, d, c.params.publicId); owner(c, row); editable(row);
    app.requireAction(c.actor, 'ORD.items.remove', { ...row, 'order.status': row.status });
    const lines = row.items as Record<string, unknown>[]; const index = lines.findIndex(line => (line.public_id ?? line.product_public_id) === c.params.itemId);
    hqAssert(index >= 0, 404, 'ORDER_ITEM_NOT_FOUND'); lines.splice(index, 1); recalc(row);
    auditHq(d, c.actor, 'ORD.items.remove', row.public_id, { itemId: c.params.itemId }); return detail(c, d, row);
  }));
  app.route('GET', '/api/orders/labs', c => {
    hqRequire(c.actor, 'ORDER.READ'); app.requireScreen(c.actor, 'HQ_ORDER');
    const account = hqFind(c.repository.read(), c.actor, 'accounts', hqText(c.query.get('accountPublicId'), 'accountPublicId'));
    return [{ public_id: `${account.public_id}:LAB`, lab_name: `${account.account_name} 지정 기공소` }];
  });
  app.route('PATCH', '/api/orders/:publicId/delivery', c => c.repository.transact(d => {
    hqOnlyKeys(c.body, ['deliveryAddressType', 'deliveryAddress', 'labPublicId', 'expressYn', 'note', 'destinationPublicId', 'destinationVersion', 'expectedVersion', 'recipientName', 'recipientPhone', 'postalCode']);
    const row = order(c, d, c.params.publicId); owner(c, row); editable(row);
    const account = hqFind(d, c.actor, 'accounts', String(row.account_public_id));
    app.requireActionAccess(c.actor, 'ORD.delivery');
    if(c.body.expectedVersion!==undefined){hqAssert(Number.isSafeInteger(c.body.expectedVersion)&&Number(c.body.expectedVersion)>0,400,'VERSION_INVALID');hqAssert(c.body.expectedVersion===row.version,409,'VERSION_CONFLICT');}
    const type = String(c.body.deliveryAddressType);
    hqAssert(['ACCOUNT', 'DIRECT', 'LAB'].includes(type), 400, 'DELIVERY_TYPE_INVALID');
    hqAssert(!c.body.destinationPublicId || type==='DIRECT',400,'DESTINATION_TYPE_INVALID');
    let address = '';
    if (type === 'ACCOUNT') address = hqText(account.address, 'account.address', 500);
    if (type === 'DIRECT' && c.body.destinationPublicId) {
      requireAccountRelatedAccess({...c,params:{...c.params,publicId:account.public_id}},d);
      const destination=(Array.isArray(account.mock_destinations)?account.mock_destinations as Record<string,unknown>[]:[]).find(item=>item.public_id===c.body.destinationPublicId && item.deleted!==true && item.active!==false);
      hqAssert(destination,404,'DESTINATION_NOT_FOUND');
      hqAssert(c.body.destinationVersion===destination.version,409,'DESTINATION_VERSION_CONFLICT');
      address=hqText([destination.address,destination.detailAddress].filter(Boolean).join(' '),'deliveryAddress',500);
    } else if (type === 'DIRECT') {
      const projected = visibleOrderDelivery(c, row).delivery_address;
      hqAssert(!(row.delivery_address !== projected && c.body.deliveryAddress === projected), 400, 'DELIVERY_ADDRESS_REENTRY_REQUIRED');
      address = hqText(c.body.deliveryAddress, 'deliveryAddress', 500);
    }
    if (type === 'LAB') { hqAssert(c.body.labPublicId === `${account.public_id}:LAB`, 400, 'LAB_SELECTION_INVALID'); address = hqText(account.address, 'lab.address', 500); }
    const note = c.body.note === undefined ? '' : String(c.body.note);
    hqAssert(note.length <= 1000 && (c.body.expressYn === undefined || typeof c.body.expressYn === 'boolean'), 400, 'DELIVERY_INPUT_INVALID');
    const recipientFields = [['recipientName','recipient_name',100],['recipientPhone','recipient_phone',40],['postalCode','postal_code',20]] as const;
    const supplied = recipientFields.filter(([key]) => Object.hasOwn(c.body,key));
    if (supplied.length) {
      hqAssert(type === 'DIRECT', 400, 'RECIPIENT_TYPE_INVALID');
      const visible = visibleOrderDelivery(c, row);
      hqAssert(Object.hasOwn(visible,'delivery_address') && visible.delivery_address === row.delivery_address, 403, 'DELIVERY_ADDRESS_RESTRICTED');
      for (const [key,,max] of supplied) hqAssert(typeof c.body[key] === 'string' && String(c.body[key]).length <= max, 400, 'DELIVERY_INPUT_INVALID');
    }
    app.requireAction(c.actor, 'ORD.delivery', { ...row, 'order.status': row.status }, { deliveryAddressType: type, deliveryAddress: address, expressYn: c.body.expressYn ?? false, note });
    Object.assign(row, { delivery_address_type: type, delivery_address: address, lab_public_id: type === 'LAB' ? c.body.labPublicId : null,
      destination_public_id: type === 'DIRECT' ? c.body.destinationPublicId ?? null : null, express_yn: c.body.expressYn ?? false, note, version: row.version + 1 });
    for (const [key,db] of supplied) row[db] = String(c.body[key]).trim();
    auditHq(d, c.actor, 'ORD.delivery', row.public_id, { type }); return detail(c, d, row);
  }));
  app.route('POST', '/api/orders/:publicId/submit', c => c.repository.transact(d => {
    hqOnlyKeys(c.body, ['idempotencyKey', 'expectedVersion']); const row = order(c, d, c.params.publicId); owner(c, row);
    hqRequire(c.actor, 'ORDER.SUBMIT'); app.requireActionAccess(c.actor, 'ORD.submit');
    const requestKey = String(c.body.idempotencyKey ?? `order:${row.public_id}:${row.version}`);
    const prior = d.collections.interfaceLogs.find(log => log.company_id === c.actor.companyId && log.interfaceCode === 'IF-ERP-007' && log.idempotencyKey === requestKey);
    if (prior) {
      if (Object.hasOwn(prior, 'request_expected_version')) hqAssert(prior.request_expected_version === (c.body.expectedVersion ?? null), 409, 'INTERFACE_IDEMPOTENCY_CONFLICT');
      else if (c.body.expectedVersion !== undefined) hqAssert(prior.request_order_version === c.body.expectedVersion, 409, 'INTERFACE_IDEMPOTENCY_CONFLICT');
      const replay = enqueueInterface(d, c.actor, { interfaceCode: 'IF-ERP-007', entityType: 'ORDER', entityPublicId: row.public_id, idempotencyKey: requestKey, payload: {}, scenario: c.scenario });
      return { requestId: replay.requestId, status: replay.status, orderStatus: row.status, mode: 'MOCK' };
    }
    if (c.body.expectedVersion !== undefined) {
      hqAssert(Number.isSafeInteger(c.body.expectedVersion) && Number(c.body.expectedVersion) > 0, 400, 'VERSION_INVALID');
      hqAssert(c.body.expectedVersion === row.version, 409, 'VERSION_CONFLICT');
    }
    const contract = hqFind(d, c.actor, 'contracts', String(row.contract_public_id));
    const account = hqFind(d, c.actor, 'accounts', String(row.account_public_id));
    app.requireAction(c.actor, 'ORD.submit', { ...row, 'order.status': row.status, 'contract.status': contract.status, 'account.erpApprovedYn': account.erp_approved_yn });
    const requestOrderVersion = row.version;
    const log = enqueueInterface(d, c.actor, { interfaceCode: 'IF-ERP-007', entityType: 'ORDER', entityPublicId: row.public_id,
      idempotencyKey: requestKey, payload: {}, scenario: c.scenario });
    log.request_order_version = requestOrderVersion;
    log.request_expected_version = c.body.expectedVersion ?? null;
    auditHq(d, c.actor, 'ORD.submit', row.public_id, { requestId: log.requestId });
    return { requestId: log.requestId, status: log.status, orderStatus: row.status, mode: 'MOCK' };
  }, true));
  app.route('GET', '/api/orders/:publicId/fulfillment', c => {
    app.requireAction(c.actor, 'FUL.open'); const d = c.repository.read(), row = order(c, d, c.params.publicId);
    const allDeliveries = d.collections.deliveries.filter(x => x.order_public_id === row.public_id && x.company_id === row.company_id);
    const deliveries = allDeliveries.filter(x => hqCanRead(c.actor, x));
    return { order: detail(c, d, row), deliveries, lineSummary: summarizeFulfillment((row.items as Record<string, unknown>[] ?? []), deliveries, deliveries.length === allDeliveries.length), mode: 'MOCK', asOf: d.clock,
      sales: d.collections.sales.filter(x => x.order_public_id === row.public_id && hqCanRead(c.actor, x)),
      returns: d.collections.returns.filter(x => x.order_public_id === row.public_id && hqCanRead(c.actor, x)),
      collections: d.collections.collections.filter(x => x.contract_public_id === row.contract_public_id && hqCanRead(c.actor, x)) };
  });
}
