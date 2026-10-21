import {HttpAdminClient} from './admin-client';
export interface AccountRuntimePort { context():Promise<any>; list(view?:string):Promise<any>; get(id:string):Promise<any>; create(values:Record<string,unknown>,releaseId:string,fieldReplacements?:{field:string;value:unknown}[]):Promise<any>; update(id:string,revision:number,values:Record<string,unknown>,releaseId:string,fieldReplacements?:{field:string;value:unknown}[]):Promise<any>; requestErp(id:string,revision:number,releaseId:string):Promise<any>; }
export class MockAccountRuntimePort implements AccountRuntimePort {
 constructor(private client:HttpAdminClient,private company:string){}
 private get base(){return `/api/admin/companies/${this.company}/runtime/accounts`;}
 context(){return this.client.request(`/api/admin/companies/${this.company}/runtime/account-context`);}
 list(view='default'){return this.client.request(this.base+'?view='+encodeURIComponent(view));}
 get(id:string){return this.client.request(this.base+'/'+id);}
 create(values:Record<string,unknown>,releaseId:string,fieldReplacements:{field:string;value:unknown}[]=[]){return this.client.request(this.base,'POST',{values,releaseId,fieldReplacements},crypto.randomUUID());}
 update(id:string,revision:number,values:Record<string,unknown>,releaseId:string,fieldReplacements:{field:string;value:unknown}[]=[]){return this.client.request(this.base+'/'+id,'PATCH',{revision,values,releaseId,fieldReplacements},crypto.randomUUID(),revision);}
 requestErp(id:string,revision:number,releaseId:string){return this.client.request(this.base+'/'+id+'/erp-requests','POST',{revision,releaseId},crypto.randomUUID(),revision);}
}
