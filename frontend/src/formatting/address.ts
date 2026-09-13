export type PostalAddress = {
  countryCode?: string;
  postalCode?: string;
  region?: string;
  city?: string;
  district?: string;
  addressLine1?: string;
  addressLine2?: string;
};

export function formatAddress(address: PostalAddress, locale: string) {
  const parts = locale.startsWith('ko')
    ? [address.region, address.city, address.district, address.addressLine1, address.addressLine2]
    : [address.addressLine1, address.addressLine2, address.city, address.district, address.region, address.postalCode, address.countryCode];
  return parts.filter(Boolean).join(locale.startsWith('ko') ? ' ' : ', ');
}
