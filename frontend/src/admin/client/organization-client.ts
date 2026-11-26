import { OrganizationCommands, OrganizationActor, canonical } from '@dio-crm/contracts/admin';
import { BrowserAdminRepository } from './browser-repository';
import { HttpAdminClient } from './admin-client';
export type OrgResource = 'companies' | 'organizations' | 'users' | 'memberships' | 'transfers';
export class OrganizationClient {
    private commands = new OrganizationCommands(new BrowserAdminRepository(), () => crypto.randomUUID());
    constructor(readonly actor: OrganizationActor, private http?: HttpAdminClient) { }
    async list(resource: OrgResource) { if (this.http)
        return (await this.http.request(resource === 'companies' ? '/api/admin/companies' : `/api/admin/companies/${this.actor.companyId}/${resource}`)).items; return this.commands.list(this.actor, this.actor.companyId, resource); }
    async command(operation: string, body: any, id?: string) {
        const key = crypto.randomUUID();
        if (this.http) {
            const base = '/api/admin/companies', company = base + '/' + this.actor.companyId;
            const routes: Record<string, [
                string,
                string
            ]> = {
                'company.deactivate': ['POST', base + '/' + id + '/deactivate'], 'company.reactivate': ['POST', base + '/' + id + '/reactivate'], 'template.preview': ['POST', base + '/' + id + '/template-change/preview'], 'template.apply': ['POST', base + '/' + id + '/template-change/apply'], 'company.create': ['POST', base], 'company.update': ['PATCH', base + '/' + (id || this.actor.companyId)],
                'organization.create': ['POST', company + '/organizations'], 'organization.update': ['PATCH', company + '/organizations/' + id],
                'user.create': ['POST', company + '/users'], 'user.update': ['PATCH', company + '/users/' + id],
                'membership.create': ['POST', company + '/memberships'], 'membership.update': ['PATCH', company + '/memberships/' + id],
                'transfer.preview': ['POST', company + '/ownership-transfers/preview'], 'transfer.execute': ['POST', company + '/ownership-transfers']
            };
            const [method, path] = routes[operation];
            return this.http.request(path, method, body, key, body.revision);
        }
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical({ operation, id, body })));
        return this.commands.command(this.actor, operation.startsWith('company.') || operation.startsWith('template.') ? (id || this.actor.companyId) : this.actor.companyId, operation, id, body, body.revision ? `"${body.revision}"` : undefined, { key, id: crypto.randomUUID(), requestId: crypto.randomUUID(), hash: Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('') });
    }
}
