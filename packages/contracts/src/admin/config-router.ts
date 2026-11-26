import { ConfigurationEngine } from './configuration';
import { SecurityActor } from './permissions';
import { assert } from './core';
export async function configurationRequest(engine: ConfigurationEngine, actor: SecurityActor, path: string, method: string, body: any, key: string) {
    if (path === '/api/admin/config/preview' && method === 'POST') return engine.preview(actor, body.validationId);
    if (path === '/api/admin/config/validate' && method === 'POST') { const { companyId, ...b } = body; return engine.command(actor, 'COMPANY', companyId || actor.companyId, 'validate', b, key); }
    const v = path.match(/^\/api\/admin\/config\/versions\/([^/]+)$/); if (v && method === 'GET') return engine.version(actor, v[1]);
    const rb = path.match(/^\/api\/admin\/config\/rebases\/(preview|apply)$/); if (rb && method === 'POST') { if (rb[1] === 'apply') return engine.applyRebase(actor, body, key); const { scope, scopeKey, ...b } = body; return engine.command(actor, scope, scopeKey, 'rebase-' + rb[1], b, key); }
    let m = path.match(/^\/api\/admin\/config\/scopes\/([^/]+)\/([^/]+)(?:\/(versions|validate|publish|rebase-preview|rebase-apply|schedule|cancel-schedule|run-schedules))?$/);
    if (m) { const scope = decodeURIComponent(m[1]), scopeKey = decodeURIComponent(m[2]);
        if (method === 'GET') return engine.read(actor, scope, scopeKey);
        assert(method === 'POST' && !!m[3], 404, 'NOT_FOUND'); assert(!(scope === 'COMPANY' && m[3] === 'publish'), 422, 'USE_COMPANY_RELEASE_API'); return engine.command(actor, scope, scopeKey, m[3], body, key);
    }
    const cancel=path.match(/^\/api\/admin\/companies\/([^/]+)\/releases\/([^/]+)\/cancel$/);if(cancel&&method==='POST')return engine.command(actor,'COMPANY',cancel[1],'cancel-schedule',{...body,scheduleId:cancel[2]},key);
    m = path.match(/^\/api\/admin\/companies\/([^/]+)\/releases(?:\/([^/]+)\/rollback)?$/);
    if (m) { if (method === 'GET') return engine.read(actor, 'COMPANY', m[1]); assert(method === 'POST', 404, 'NOT_FOUND'); if (m[2]) assert(body.expectedReleaseId === m[2], 409, 'VERSION_CONFLICT'); return engine.command(actor, 'COMPANY', m[1], m[2] ? 'rollback' : body.publishAt?'schedule':'publish',body.publishAt?{...Object.fromEntries(Object.entries(body).filter(([k])=>k!=='publishAt')),executeAt:body.publishAt}:body, key); }
    m = path.match(/^\/api\/admin\/companies\/([^/]+)\/runtime\/configuration$/);
    if (m && method === 'GET') return engine.read(actor, 'COMPANY', m[1], true);
    return undefined;
}
