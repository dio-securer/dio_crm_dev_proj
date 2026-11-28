// A clean metadata bundle with three objects that uses every schema of the metamodel. Each call returns a fresh copy.
const labels = new Set();
const L = key => { labels.add(key); return key; };
const always = () => ({ op: 'all', args: [{ op: 'isEmpty', field: 'name' }, { op: 'not', arg: { op: 'eq', field: 'name', value: 'x' } }] });

function account() {
  return {
    object: { key: 'account', labelKey: L('account.label'), pluralLabelKey: L('account.plural'), fields: [
      { key: 'name', type: 'text', labelKey: L('account.name'), required: true, maxLength: 200 },
      { key: 'tier', type: 'enum', labelKey: L('account.tier'), enumCodeGroup: 'account_tier' },
      { key: 'revenue', type: 'decimal', labelKey: L('account.revenue'), precision: 18, scale: 4 },
      { key: 'employees', type: 'integer', labelKey: L('account.employees') },
      { key: 'created_at', type: 'datetime', labelKey: L('account.created_at'), system: true, required: true },
    ] },
    screens: [{
      screen: { entity: 'account', screenKey: 'detail', tabs: [{ id: 'main', labelKey: L('account.tab.main'), order: 0 }], sections: [{ id: 'basic', tabId: 'main', titleKey: L('account.section.basic'), order: 0, columns: 2 }] },
      fields: { entity: 'account', fields: [
        { key: 'name', sectionId: 'basic', visible: true, required: true, readOnly: false, labelKey: L('account.name'), maxLength: 200, order: 0 },
        { key: 'x_region', sectionId: 'basic', visible: true, required: false, readOnly: false, labelKey: L('account.x_region'), order: 1 },
      ], extensionDefinitions: [{ key: 'x_region', type: 'text', labelKey: L('account.x_region'), nullable: true, active: true, searchable: true, maxLength: 50 }] },
    }],
    listViews: { entity: 'account', views: [{ key: 'all', labelKey: L('account.view.all'), columns: ['name', 'tier', 'x_region'], filter: { op: 'gt', field: 'revenue', value: 0 }, sort: [{ field: 'name', direction: 'ASC' }], pageSize: 20, shared: true }] },
  };
}

function lead() {
  return {
    object: { key: 'lead', labelKey: L('lead.label'), pluralLabelKey: L('lead.plural'), fields: [
      { key: 'name', type: 'text', labelKey: L('lead.name'), required: true, maxLength: 100 },
      { key: 'company_name', type: 'text', labelKey: L('lead.company_name'), aliases: ['company'] },
      { key: 'account', type: 'reference', labelKey: L('lead.account'), referenceObject: 'account' },
      { key: 'status', type: 'enum', labelKey: L('lead.status'), enumCodeGroup: 'lead_status', required: true },
      { key: 'score', type: 'integer', labelKey: L('lead.score') },
      { key: 'phone', type: 'text', labelKey: L('lead.phone') },
      { key: 'old_phone', type: 'text', labelKey: L('lead.old_phone'), deprecated: { since: '2026-11', replacedBy: 'phone' } },
      { key: 'next_call', type: 'date', labelKey: L('lead.next_call') },
      { key: 'hot', type: 'boolean', labelKey: L('lead.hot') },
    ] },
    screens: [
      { screen: { entity: 'lead', screenKey: 'create', tabs: [{ id: 'main', labelKey: L('lead.tab.main'), order: 0 }], sections: [{ id: 'basic', tabId: 'main', titleKey: L('lead.section.basic'), order: 0, columns: 1 }] },
        fields: { entity: 'lead', fields: [
          { key: 'name', sectionId: 'basic', visible: true, required: true, readOnly: false, labelKey: L('lead.name'), order: 0 },
          { key: 'status', sectionId: 'basic', visible: true, required: true, readOnly: false, labelKey: L('lead.status'), order: 1 },
          { key: 'company_name', sectionId: 'basic', visible: true, required: false, readOnly: false, labelKey: L('lead.company_name'), order: 2 },
        ], extensionDefinitions: [] } },
      { screen: { entity: 'lead', screenKey: 'detail', tabs: [{ id: 'main', labelKey: L('lead.tab.main'), order: 0 }, { id: 'more', labelKey: L('lead.tab.more'), order: 1 }], sections: [{ id: 'basic', tabId: 'main', titleKey: L('lead.section.basic'), order: 0, columns: 2 }, { id: 'extra', tabId: 'more', titleKey: L('lead.section.extra'), order: 0, columns: 1 }] },
        fields: { entity: 'lead', fields: [
          { key: 'name', sectionId: 'basic', visible: true, required: true, readOnly: false, labelKey: L('lead.name'), order: 0 },
          { key: 'account', sectionId: 'basic', visible: true, required: false, readOnly: false, labelKey: L('lead.account'), order: 1 },
          { key: 'phone', sectionId: 'extra', visible: true, required: false, readOnly: false, labelKey: L('lead.phone'), order: 0 },
          { key: 'score', sectionId: 'extra', visible: true, required: false, readOnly: true, labelKey: L('lead.score'), order: 1 },
        ], extensionDefinitions: [] } },
    ],
    listViews: { entity: 'lead', views: [
      { key: 'open', labelKey: L('lead.view.open'), columns: ['name', 'status', 'score'], filter: { op: 'any', args: [{ op: 'in', field: 'status', value: ['NEW', 'WORKING'] }, { op: 'gte', field: 'score', value: 50 }] }, sort: [{ field: 'next_call', direction: 'DESC' }], pageSize: 50, shared: true },
      { key: 'hot', labelKey: L('lead.view.hot'), columns: ['name', 'hot'], filter: { op: 'eq', field: 'hot', value: true }, sort: [], pageSize: 20, shared: false },
    ] },
    actions: { entity: 'lead', actions: [
      { key: 'qualify', labelKey: L('lead.action.qualify'), featureKey: 'lead', permission: 'account.update', condition: { op: 'eq', field: 'status', value: 'WORKING' }, confirmKey: L('lead.action.qualify.confirm'), enabled: true },
      { key: 'start', labelKey: L('lead.action.start'), featureKey: 'lead', permission: 'account.update', condition: always(), confirmKey: L('lead.action.start.confirm'), enabled: true },
    ] },
    rules: { entity: 'lead', rules: [
      { id: 'need_phone', trigger: 'SAVE', condition: { op: 'eq', field: 'status', value: 'WORKING' }, effects: [{ target: 'phone', required: true }, { target: 'qualify', actionEnabled: true }], errorKey: L('lead.rule.need_phone') },
    ] },
    workflow: { enabled: true, entity: 'lead', startState: 'NEW', states: ['NEW', 'WORKING', 'QUALIFIED'], transitions: [
      { from: 'NEW', to: 'WORKING', actionKey: 'start', guard: { op: 'isEmpty', field: 'account' } },
      { from: 'WORKING', to: 'QUALIFIED', actionKey: 'qualify', guard: { op: 'all', args: [{ op: 'gt', field: 'score', value: 10 }] } },
    ] },
  };
}

function opportunity() {
  return {
    object: { key: 'opportunity', labelKey: L('opportunity.label'), pluralLabelKey: L('opportunity.plural'), fields: [
      { key: 'title', type: 'text', labelKey: L('opportunity.title'), required: true, maxLength: 120 },
      { key: 'amount', type: 'decimal', labelKey: L('opportunity.amount'), precision: 18, scale: 2 },
      { key: 'close_date', type: 'date', labelKey: L('opportunity.close_date') },
      { key: 'account', type: 'reference', labelKey: L('opportunity.account'), referenceObject: 'account', required: true },
    ] },
    screens: [{
      screen: { entity: 'opportunity', screenKey: 'create', tabs: [{ id: 'main', labelKey: L('opportunity.tab.main'), order: 0 }], sections: [{ id: 'basic', tabId: 'main', titleKey: L('opportunity.section.basic'), order: 0, columns: 2 }] },
      fields: { entity: 'opportunity', fields: [
        { key: 'title', sectionId: 'basic', visible: true, required: true, readOnly: false, labelKey: L('opportunity.title'), order: 0 },
        { key: 'account', sectionId: 'basic', visible: true, required: true, readOnly: false, labelKey: L('opportunity.account'), order: 1 },
      ], extensionDefinitions: [] },
    }],
    actions: { entity: 'opportunity', actions: [{ key: 'close', labelKey: L('opportunity.action.close'), featureKey: 'opportunity', permission: 'account.update', condition: { op: 'lte', field: 'close_date', value: '2026-12-31' }, confirmKey: L('opportunity.action.close.confirm'), enabled: true }] },
  };
}

function bundle() {
  labels.clear();
  const objects = [account(), lead(), opportunity()];
  const menu = { nodes: [
    { id: 'sales', parentId: null, routeKey: 'sales', labelKey: L('menu.sales'), order: 0, featureKey: 'lead', permission: 'account.read' },
    { id: 'leads', parentId: 'sales', routeKey: 'leads', labelKey: L('menu.leads'), order: 1, featureKey: 'lead', permission: 'account.read' },
    { id: 'opps', parentId: 'sales', routeKey: 'opportunities', labelKey: L('menu.opps'), order: 2, featureKey: 'opportunity', permission: 'account.read' },
  ] };
  const codes = { groups: [
    { key: 'account_tier', values: [{ code: 'A', labelKey: L('code.tier.a'), active: true, order: 0 }, { code: 'B', labelKey: L('code.tier.b'), active: true, order: 1 }] },
    { key: 'lead_status', values: ['NEW', 'WORKING', 'QUALIFIED'].map((code, order) => ({ code, labelKey: L(`code.lead_status.${code.toLowerCase()}`), active: true, order })) },
  ] };
  const features = { items: [{ key: 'lead', enabled: true }, { key: 'opportunity', enabled: true }] };
  const keys = [...labels].sort();
  const semantic = [{ semanticKey: 'label.lead', termKey: 'lead.label' }];
  const translations = ['ko-KR', 'en-US'].flatMap(locale => keys.map(termKey => ({ termKey, locale, text: `${termKey} ${locale}` })));
  return {
    schemaVersion: 1, objects, menu, codes, features, terms: { terms: semantic, translations },
    deprecations: [{ kind: 'MENU', key: 'opps', since: '2026-11', replacedBy: 'leads' }],
    overlays: [
      { scope: 'COMPANY', scopeKey: '10000000-0000-4000-8000-000000000002', domain: 'MENU', overrides: [{ op: 'REMOVE_ITEM', path: [{ property: 'nodes' }, { itemKey: 'opps' }] }] },
      { scope: 'TEMPLATE', scopeKey: 'HQ', domain: 'FIELD', entity: 'lead', screenKey: 'detail', overrides: [{ op: 'SET', path: [{ property: 'fields' }, { itemKey: 'score' }, { property: 'visible' }], value: false }] },
      { scope: 'COUNTRY', scopeKey: 'HQ:KR', domain: 'LIST_VIEW', entity: 'lead', overrides: [{ op: 'REMOVE_ITEM', path: [{ property: 'views' }, { itemKey: 'hot' }] }] },
    ],
  };
}

module.exports = { bundle };
