import {platformUsersSpec,platformOrganizationsSpec,platformCodesSpec} from './platform-admin-specs';
import React from 'react';
import {ConfiguredRecords} from './ConfiguredRecords';
import {ConfiguredReport,type ReportSpec} from './ConfiguredReport';
import {productCatalogRecordSpec} from './inspection-specs';
const spec=(screen:string,path:string,prefix:string,pairs:string[][]):ReportSpec=>({screen,path,sections:[{key:'items',labelId:screen,fields:pairs.map(([id,column])=>({id:prefix+'.'+id,column}))}]});
const audit=spec('HQ_ADMIN_AUDIT','/api/audit-logs','platformAudit',[['entityType','entity_type'],['entityId','entity_id'],['action','action'],['actorUserId','actor_user_id'],['requestId','request_id'],['createdAt','created_at']]);
const interfaces=spec('HQ_ADMIN_INTERFACES','/api/interface-logs','platformInterface',[['requestId','request_id'],['code','interface_code'],['direction','direction'],['entityType','entity_type'],['entityId','entity_id'],['status','status'],['retryCount','retry_count'],['requestedAt','requested_at'],['respondedAt','responded_at'],['errorMessage','error_message']]);
const notifications=spec('HQ_NOTIFICATIONS','/api/notifications','platformNotification',[['type','notification_type'],['title','title'],['body','body'],['readAt','read_at'],['createdAt','created_at']]);
export const MANAGED_EXTRA_ROUTES=[
 {screen:'HQ_ADMIN_CODES',path:'/admin/codes',icon:'ops',element:<ConfiguredRecords spec={platformCodesSpec}/>},
 {screen:'HQ_PRODUCT_PACKAGE',path:'/product-packages',icon:'order',element:<ConfiguredRecords spec={productCatalogRecordSpec}/>},
 {screen:'HQ_ADMIN_USERS',path:'/admin/users',icon:'account',element:<><ConfiguredRecords spec={platformUsersSpec}/><ConfiguredRecords spec={platformOrganizationsSpec}/></>},
 {screen:'HQ_ADMIN_AUDIT',path:'/admin/audit',icon:'report',element:<ConfiguredReport spec={audit}/>},
 {screen:'HQ_ADMIN_INTERFACES',path:'/admin/interfaces',icon:'ops',element:<ConfiguredReport spec={interfaces}/>},
 {screen:'HQ_NOTIFICATIONS',path:'/notifications',icon:'report',element:<ConfiguredReport spec={notifications}/>}
];
