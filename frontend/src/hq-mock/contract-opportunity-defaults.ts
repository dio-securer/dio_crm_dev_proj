type Opportunity = { amount?: number; special_terms?: unknown; products?: Array<{ amount?: unknown; product_amount?: unknown; goods_amount?: unknown }> };
export function contractOpportunityDefaults(row?: Opportunity) {
  const amount = Number(row?.amount ?? 0);
  const lines = row?.products ?? [];
  const valid = lines.length > 0 && lines.every(line => {
    if (line.product_amount == null || line.goods_amount == null) return false;
    const product = Number(line.product_amount), goods = Number(line.goods_amount), total = Number(line.amount);
    return [product, goods, total].every(Number.isFinite) && product >= 0 && goods >= 0 && Math.abs(product + goods - total) < 0.005;
  });
  const productAmount = valid ? lines.reduce((sum, line) => sum + Number(line.product_amount), 0) : amount;
  const goodsAmount = valid ? lines.reduce((sum, line) => sum + Number(line.goods_amount), 0) : 0;
  const matches = Math.abs(productAmount + goodsAmount - amount) < 0.005;
  return { productAmount: matches ? productAmount : amount, goodsAmount: matches ? goodsAmount : 0, specialTerms: typeof row?.special_terms === 'string' ? row.special_terms : '' };
}
