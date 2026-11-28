import {createContext} from 'react';

export type PopupSize='small'|'medium'|'large'|'full';
/** Used only by the isolated preview; managed screens consume effective configuration. */
export const PopupPresentationContext=createContext<{title?:string;size?:PopupSize}>({});
