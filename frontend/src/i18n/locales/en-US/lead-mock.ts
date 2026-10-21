export const leadMockEn = {
  shellV2: { home: 'Home' },
  leadV2: {
    title: 'Lead',
    subtitle: 'Manage prospects, next actions, and conversion readiness in one workspace.',
    mockMode: 'Mock Mode',
    searchPlaceholder: 'Search name, organization, or phone',
    newLead: '+ New Lead',
    resetMock: 'Reset Mock',
    listTitle: 'Lead list',
    count: '{{count}}',
    filters: { allStage: 'All stages', allInterest: 'All interest', allOwner: 'All owners' },
    columns: { lead: 'Lead / Organization', interest: 'Interest', stage: 'Stage', owner: 'Owner', recent: 'Recent activity' },
    actions: { call: 'Call', email: 'Email', meeting: 'Meeting', convert: 'Convert', back: 'Back to list' },
    tabs: { overview: 'Overview', activity: 'Activity', contacts: 'Contacts', opportunities: 'Opportunities', notes: 'Notes', attachments: 'Attachments' },
    sections: {
      basic: 'Basic information', recentActivity: 'Recent activity timeline', nextAction: 'Next action', contacts: 'Related contacts', tags: 'Tags', note: 'Note summary',
      opportunities: 'Related opportunities', attachments: 'Attachments'
    },
    fields: {
      organization: 'Organization', organizationType: 'Organization type', phone: 'Phone', email: 'Email', region: 'Region', address: 'Address',
      interest: 'Interest', stage: 'Lead stage', owner: 'Owner', source: 'Source', expectedAmount: 'Expected amount', lastActivity: 'Last activity', nextAction: 'Next action'
    },
    quick: {
      title: 'Create Lead', help: 'Capture the minimum information now and enrich the record later.', name: 'Name', organization: 'Organization', phone: 'Phone',
      source: 'Source', owner: 'Owner', create: 'Quick create', createDetail: 'Save and open detail', cancel: 'Cancel', required: 'Enter a name and organization.'
    },
    interest: { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' },
    stage: { NEW: 'New', CONTACTED: 'Contacted', CONSULTING: 'Consulting', PROPOSAL: 'Proposal', REVIEW: 'Review', NEGOTIATION: 'Negotiation', ON_HOLD: 'On hold', CONVERTED: 'Converted', DISQUALIFIED: 'Disqualified' },
    source: { WEB: 'Website', EXHIBITION: 'Exhibition', REFERRAL: 'Referral', PHONE: 'Phone', OTHER: 'Other' },
    activityType: { CALL: 'Call', EMAIL: 'Email', MEETING: 'Meeting', NOTE: 'Note' },
    empty: { selection: 'Select a lead from the list.', activity: 'No activity recorded.', contacts: 'No related contacts.', opportunities: 'No related opportunities.', attachments: 'No attachments.' },
    toast: { created: 'Lead created.', stageUpdated: 'Lead stage updated.', conversionPlanned: 'Lead conversion will be connected in M7.', meetingPlanned: 'Meeting creation will be connected in the Activity phase.', reset: 'Mock data reset.' },
    opportunityCount: '{{count}} opportunities',
    lastUpdated: 'Updated {{date}}'
  }
} as const;
