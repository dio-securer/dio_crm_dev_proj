import type {LeadColumnWidth,LeadColumnWidths} from '@dio-crm/contracts/crm-customization';
export type {LeadColumnWidth} from '@dio-crm/contracts/crm-customization';
export type EffectiveLeadColumnWidths = LeadColumnWidths;

/** A minimum, not an exact width: long content and available space may widen a column. */
export function leadColumnStyle(width:LeadColumnWidth|undefined,alignment?:'start'|'center'|'end'):React.CSSProperties|undefined{
  const minimum=width?.mode==='min'&&Number.isInteger(width.widthPx)&&width.widthPx>=80&&width.widthPx<=600?{width:width.widthPx,minWidth:width.widthPx}:{};
  const align=alignment&&['start','center','end'].includes(alignment)?{textAlign:alignment}:{};
  return Object.keys(minimum).length||Object.keys(align).length?{...minimum,...align}:undefined;
}
