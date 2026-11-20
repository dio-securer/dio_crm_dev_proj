/** Server-owned deployment capability. Enable only after verifying the SQL schema.
 * Supply the same instance to the ordinary gateway and extension product factory. */
export const LEAD_READ_CAPABILITIES=Symbol('LEAD_READ_CAPABILITIES');
export type LeadReadCapabilities=Readonly<{hiraExclusion:boolean}>;
export const hiraExclusionBinding={input:'hiraExcluded',column:'hira_sync_exclude_yn',output:'hira_sync_exclude_yn',fieldId:'lead.hiraExcluded'};
