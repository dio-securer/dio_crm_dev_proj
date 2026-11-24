// Product labels from the S20 account ledger. Keep the existing free-text API
// compatible: only complete comma/semicolon/newline-separated labels are flags.
export const ACCOUNT_PRODUCTS = ['All In PK', 'ECO', 'FullArch', 'IMP', 'Navi', 'SOS PK', 'TRIOS', 'UF(III)', 'UV', '세멘리스', 'DDA'] as const;

export function productUsageEntries(value: string): string[] {
  return value.split(/[,;\r\n]+/).map(entry => entry.trim()).filter(Boolean);
}

export function hasProductUsage(value: string, product: string): boolean {
  return productUsageEntries(value).includes(product);
}

export function toggleProductUsage(value: string, product: string, checked: boolean): string {
  const entries = productUsageEntries(value);
  if (checked) return entries.includes(product) ? value : [value.trim(), product].filter(Boolean).join('\n');
  return entries.includes(product) ? entries.filter(entry => entry !== product).join('\n') : value;
}
