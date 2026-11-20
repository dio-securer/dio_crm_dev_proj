/** Trusted action catalog. User configuration cannot supply URLs, handlers or executable code. */
export const screenActions = [
 {screenId:'HQ_LEAD',actionId:'LEAD.assignOwner',popupId:'POP.LEAD.OWNER',variant:'owner',entryInstance:'detail.owner.open',method:'POST',path:'/api/leads/:id/assign-owner',inputIds:['lead.ownerUserId'],permission:'LEAD.MANAGE',effect:'owner-and-audit'},
 {screenId:'HQ_LEAD',actionId:'LEAD.convert',popupId:'POP.LEAD.CONVERT',variant:'convert',entryInstance:'detail.convert.open',method:'POST',path:'/api/leads/:id/convert',inputIds:['conversion.accountMode','conversion.contactMode','conversion.opportunityMode'],permission:'LEAD.CONVERT',effect:'account-contact-opportunity-and-audit'}
] as const;
