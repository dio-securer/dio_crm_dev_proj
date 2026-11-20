import { hqFind, hqRequire, hqText } from './app.js';
import type { HqRouteContext } from './app.js';
import { auditHq, canonicalHq, cloneHq, hqAssert } from './model.js';
import type { HqDataset, HqRow } from './model.js';

/** Legacy HQ rows are KRW; this is a compatibility default, never an exchange rate. */
export function opportunityCurrency(row: Record<string, unknown>): string {
  return String(row.currency ?? row.currency_code ?? 'KRW');
}
export function validateOpportunityCurrency(value: unknown): string {
  hqAssert(typeof value === 'string' && /^[A-Z]{3}$/.test(value), 400, 'CURRENCY_INVALID');
  return value;
}

/** Optional metadata preserves existing clients; the opportunity UI always supplies both. */
export function opportunityMutation<T>(request: HqRouteContext, permission: string, action: string,
  work: (context: HqRouteContext, dataset: HqDataset) => T): T {
  hqRequire(request.actor, permission);
  request.app.requireScreen(request.actor, 'HQ_OPPORTUNITY');
  const actionKeys: Record<string, string> = { CREATE: 'OPP.create', UPDATE: 'OPP.saveNegotiation', STAGE: 'OPP.stage', PRODUCT_ADD: 'OPP.product.add', PRODUCT_BATCH: 'OPP.product.add', PRODUCT_UPDATE: 'OPP.product.edit', PRODUCT_DELETE: 'OPP.product.remove', PRODUCT_REORDER: 'OPP.product.edit' };
  request.app.requireActionAccess(request.actor, actionKeys[action]);
  const { expectedVersion, idempotencyKey, ...body } = request.body;
  const key = idempotencyKey === undefined ? undefined : hqText(idempotencyKey, 'idempotencyKey', 200);
  const target = request.params.publicId ?? 'NEW';
  const fingerprint = canonicalHq({ action, target, params: request.params, body, expectedVersion: expectedVersion ?? null });
  return request.repository.transact(d => {
    let row: HqRow | undefined;
    if (target !== 'NEW') {
      row = hqFind(d, request.actor, 'opportunities', target);
      hqFind(d, request.actor, 'accounts', String(row.account_public_id));
      hqAssert(row.owner_user_id === request.actor.userId || ['SYSTEM','ALL'].includes(request.actor.scope), 403, 'OWNER_WRITE_DENIED');
    } else {
      hqFind(d, request.actor, 'accounts', hqText(body.accountPublicId, 'accountPublicId'));
    }
    // Authorize the caller before returning even a previously committed response.
    if (key) {
      const receipt = d.collections.auditLogs.find(entry => entry.action === 'OPPORTUNITY_MUTATION_RECEIPT'
        && entry.company_id === request.actor.companyId && entry.owner_user_id === request.actor.userId
        && (entry.detail as Record<string, unknown>)?.key === key);
      if (receipt) {
        const detail = receipt.detail as Record<string, unknown>;
        hqAssert(detail.fingerprint === fingerprint, 409, 'IDEMPOTENCY_CONFLICT');
        return cloneHq(detail.response) as T;
      }
    }
    if (expectedVersion !== undefined) {
      hqAssert(row && Number.isSafeInteger(expectedVersion) && Number(expectedVersion) > 0, 400, 'EXPECTED_VERSION_INVALID');
      hqAssert(row.version === expectedVersion, 409, 'VERSION_CONFLICT', '다른 작업에서 수정되었습니다. 입력을 보존한 채 최신 내용을 확인해 주세요.');
    }
    const response = work({ ...request, body }, d);
    if (key) auditHq(d, request.actor, 'OPPORTUNITY_MUTATION_RECEIPT', target, { key, fingerprint, response: cloneHq(response) });
    return response;
  }, true);
}
