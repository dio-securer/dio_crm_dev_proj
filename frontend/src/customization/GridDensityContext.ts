import {createContext} from 'react';
import type {LeadColumnWidth} from './lead-column-width';

/** Synthetic preview only; managed user screens consume the effective release separately. */
export const GridDensityContext=createContext<'compact'|'default'|'comfortable'>('default');
export const GridSortContext=createContext<'asc'|'desc'|null>(null);
export const GridColumnWidthContext=createContext<Record<string,LeadColumnWidth>>({});
export const GridColumnAlignmentContext=createContext<Record<string,'start'|'center'|'end'>>({});
