import {z} from 'zod';
/** Paging controls do not grant access to any field, filter or company. */
export const listPaging={offset:z.coerce.number().int().min(0).max(1000000).optional(),limit:z.coerce.number().int().min(1).max(500).optional()};
export const pageParameters=(query:{offset?:number;limit?:number})=>({offset:query.offset??0,limit:query.limit??500});
export const businessQueryKeys=(query:Record<string,unknown>)=>Object.keys(query).filter(key=>key!=='offset'&&key!=='limit');
