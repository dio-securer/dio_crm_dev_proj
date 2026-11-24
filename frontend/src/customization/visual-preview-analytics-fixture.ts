/** Synthetic read-only response for the actual HQ analytics screen. No business requests. */
export const visualPreviewAnalyticsDashboard = {
  asOf: '2026-10-28T00:00:00.000Z',
  leads: { count: 5 }, activities: { count: 8 }, pipeline: { count: 3, amount: 2400000 },
  contracts: { count: 2, amount: 1500000 }, orders: { count: 4, amount: 1200000 },
  sales: { count: 2, amount: 800000 }, collections: { count: 1, amount: 400000 },
  topAccounts: [{ accountPublicId: 'preview-account-1', accountName: '예시 거래처', salesAmount: 800000 }]
};
