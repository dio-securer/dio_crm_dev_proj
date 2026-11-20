import {configAssert,type ConfigTransaction} from './config-store';
type Domain=NonNullable<ConfigTransaction['domain']>;
export async function approvalRoute(domain:Domain,userKey:number,type:'ACTIVITY_REPORT'|'DIRECT_WORK'){
 const r=await domain.query<{branch_approver_user_id:number;division_approver_user_id:number}>("SELECT ar.branch_approver_user_id,ar.division_approver_user_id FROM crm_user u WITH(HOLDLOCK) JOIN crm_approval_route ar WITH(HOLDLOCK) ON ar.company_id=u.company_id AND ar.organization_id=u.organization_id JOIN crm_user b WITH(HOLDLOCK) ON b.user_id=ar.branch_approver_user_id AND b.company_id=u.company_id AND b.is_active=1 AND b.deleted_yn=0 JOIN crm_user d WITH(HOLDLOCK) ON d.user_id=ar.division_approver_user_id AND d.company_id=u.company_id AND d.is_active=1 AND d.deleted_yn=0 WHERE u.company_id=@companyKey AND u.user_id=@userKey AND u.is_active=1 AND u.deleted_yn=0 AND ar.approval_type=@type AND ar.is_active=1",{companyKey:domain.companyKey,userKey,type});
 configAssert(r.recordset.length===1,409,'APPROVAL_ROUTE_REQUIRED');return r.recordset[0];
}
const messages={
 REPORT_REJECTED:{ko:['활동보고 반려','반려 의견을 확인한 뒤 다시 요청할 수 있습니다.'],en:['Activity report rejected','Review the feedback before submitting your report again.']},
 REPORT_REQUEST:{ko:['활동보고 승인요청','검토할 활동보고가 있습니다.'],en:['Activity report approval','An activity report is ready for your review.']},
 REPORT_APPROVED:{ko:['활동보고 최종 승인','활동보고가 최종 승인되었습니다.'],en:['Activity report approved','Your activity report has received final approval.']},
 DIRECT_REQUEST:{ko:['직출·직퇴 승인요청','검토할 직출·직퇴 요청이 있습니다.'],en:['Direct work approval','A direct work request is ready for your review.']},
 DIRECT_APPROVED:{ko:['직출·직퇴 승인완료','직출·직퇴 요청이 승인되었습니다.'],en:['Direct work approved','Your direct work request has been approved.']},
 DIRECT_REJECTED:{ko:['직출·직퇴 반려','사유를 확인한 뒤 다시 요청할 수 있습니다.'],en:['Direct work rejected','Review the reason before submitting your request again.']}
};
/** Transactional in-app notification only; no email/network dispatch. */
export async function notifyApproval(domain:Domain,userKey:number,type:keyof typeof messages){
 const r=await domain.query<{locale:string}>('SELECT COALESCE(u.preferred_locale,c.default_locale) locale FROM crm_user u WITH(HOLDLOCK) JOIN crm_company c WITH(HOLDLOCK) ON c.company_id=u.company_id WHERE u.company_id=@companyKey AND u.user_id=@userKey AND u.is_active=1 AND u.deleted_yn=0',{companyKey:domain.companyKey,userKey});configAssert(r.recordset.length===1,409,'APPROVAL_ASSIGNEE_REQUIRED');
 const [title,body]=messages[type][r.recordset[0].locale?.startsWith('ko')?'ko':'en'];
 await domain.query('INSERT INTO crm_notification(user_id,notification_type,title,body) VALUES(@userKey,@type,@title,@body)',{userKey,type,title,body});
}
