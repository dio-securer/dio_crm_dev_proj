import React, { useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { changeLocale } from '../i18n';
import { GlobalizationProvider } from '../market/globalization-context';
import { HqMockProvider } from '../hq-mock/HqMockProvider';
import { HqLeadsPage } from '../hq-mock/HqLeadsPage';
import { HqDirectWorkPage } from '../hq-mock/HqActivityPages';
import { HqAnalyticsView } from '../hq-mock/HqH06Pages';
import { HqOpportunitiesPage } from '../hq-mock/HqSalesPages';
import { AccountsPage } from '../AccountsPage';
import fixtures from './visual-preview-fixtures.json';
import { createVisualPreviewApplier } from './visual-preview-apply';
import { leadGridCandidates, validLeadColumnOrder } from '@dio-crm/contracts/lead-grid-columns';
import { placementRegions, type PlacementOrders } from '@dio-crm/contracts/crm-customization';
import { PlacementContext } from './PlacementContext';
import { ButtonPresentationContext } from './ButtonPresentationContext';
import { GridDensityContext,GridSortContext,GridColumnWidthContext,GridColumnAlignmentContext } from './GridDensityContext';
import type {LeadColumnWidth} from './lead-column-width';
import {PopupPresentationContext,type PopupSize} from './PopupPresentationContext';

export type PreviewScreen = 'HQ_LEAD' | 'HQ_ACCOUNT' | 'HQ_DIRECT_WORK' | 'HQ_ANALYTICS' | 'HQ_OPPORTUNITY';
export type PreviewVariant = 'list' | 'detail' | 'create' | 'owner' | 'convert' | 'contact' | 'bulk' | 'merge';
export type PreviewFixtureState = 'normal' | 'empty' | 'error' | 'erp-requesting' | 'approval-requested' | 'approval-branch-approved';
export type PreviewBoot = { screen: PreviewScreen; variant: PreviewVariant; locale: string; nonce: string; fixtureState?: PreviewFixtureState; tab?:string };

declare global {
  interface Window {
    __DIO_VISUAL_PREVIEW__?: boolean;
    __DIO_VISUAL_PREVIEW_BOOT__?: PreviewBoot;
    __DIO_VISUAL_PREVIEW_SETUP__?: boolean;
  }
}

const leadId = fixtures.leads[0].public_id;
const accountId = fixtures.accounts[0].public_id;
const pendingAccountId = fixtures.accounts.find(account => account.integration_status === 'REQUESTING')!.public_id;

function PreviewFence() {
  useEffect(() => {
    const nonce = window.__DIO_VISUAL_PREVIEW_BOOT__?.nonce;
    const preview = createVisualPreviewApplier();
    let selected: Element | null = null;
    const focus = (element: Element | null) => {
      selected?.classList.remove('visual-preview-selected');
      selected = element;
      selected?.classList.add('visual-preview-selected');
      selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    const select = (target: EventTarget | null) => {
      const anchor = target instanceof Element ? target.closest('[data-config-id]') : null;
      if (!anchor) return;
      focus(anchor);
      window.parent.postMessage({ type: 'DIO_VISUAL_PREVIEW_SELECT', nonce, id: anchor.getAttribute('data-config-id'), instance: anchor.getAttribute('data-config-instance'), support: anchor.getAttribute('data-config-support') }, '*');
    };
    const stop = (event: Event) => {
      if (window.__DIO_VISUAL_PREVIEW_SETUP__) return;
      if (event.type === 'click') select(event.target);
      if (!(event.target instanceof Element) || !event.target.closest('a,button,input,select,textarea,form,[data-config-id]')) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    };
    const stopKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      select(event.target);
      stop(event);
      if (event.target instanceof Element && event.target.closest('[data-config-id]')) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      }
    };
    const markAnchors = () => document.querySelectorAll<HTMLElement>('[data-config-id]').forEach(element => {
      if (!element.matches('a,button,input,select,textarea,[tabindex]')) element.tabIndex = 0;
    });
    const observer = new MutationObserver(() => { markAnchors(); preview.apply(); });
    observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
    markAnchors();
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || event.data?.nonce !== nonce) return;
      if (event.data.type === 'DIO_VISUAL_PREVIEW_APPLY') preview.update(event.data.entries);
      if (event.data.type === 'DIO_VISUAL_PREVIEW_PRESENTATION') preview.updatePresentation(event.data.values);
      if (event.data.type === 'DIO_VISUAL_PREVIEW_FOCUS' && typeof event.data.id === 'string') {
        const matches = Array.from(document.querySelectorAll('[data-config-id]')).filter(element => element.getAttribute('data-config-id') === event.data.id);
        focus(matches.find(element => event.data.instance && element.getAttribute('data-config-instance') === event.data.instance) ?? matches[0] ?? null);
      }
      if (event.data.type === 'DIO_VISUAL_PREVIEW_RETURN_FOCUS' && typeof event.data.id === 'string') {
        const matches = Array.from(document.querySelectorAll<HTMLElement>('[data-config-id]')).filter(element => element.getAttribute('data-config-id') === event.data.id);
        const target = matches.find(element => event.data.instance && element.getAttribute('data-config-instance') === event.data.instance) ?? matches[0];
        if (target) { focus(target); target.focus({preventScroll:true}); }
      }
    };
    window.addEventListener('message', receive);
    document.addEventListener('click', stop, true);
    document.addEventListener('submit', stop, true);
    document.addEventListener('change', stop, true);
    document.addEventListener('beforeinput', stop, true);
    document.addEventListener('input', stop, true);
    document.addEventListener('keydown', stopKey, true);
    return () => { observer.disconnect(); window.removeEventListener('message', receive); document.removeEventListener('click', stop, true); document.removeEventListener('submit', stop, true); document.removeEventListener('change', stop, true); document.removeEventListener('beforeinput', stop, true); document.removeEventListener('input', stop, true); document.removeEventListener('keydown', stopKey, true); };
  }, []);
  return null;
}

function PreviewState({ boot }: { boot: PreviewBoot }) {
  const [placements, setPlacements] = useState<PlacementOrders>({});
  const [gridDensity,setGridDensity]=useState<'compact'|'default'|'comfortable'>('default');
  const [gridSort,setGridSort]=useState<'asc'|'desc'|null>(null);
  const [gridWidths,setGridWidths]=useState<Record<string,LeadColumnWidth>>({});
  const [gridAlignments,setGridAlignments]=useState<Record<string,'start'|'center'|'end'>>({});
  const [buttonEmphasis,setButtonEmphasis]=useState<'primary'|'secondary'|undefined>();
  const [popupPresentation,setPopupPresentation]=useState<{title?:string;size?:PopupSize}>({});
  const [gridColumns, setGridColumns] = useState<string[]>([]);
  const [columnOrder,setColumnOrder] = useState<string[]|undefined>();
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || event.data?.nonce !== boot.nonce) return;
      if(event.data.type === 'DIO_VISUAL_PREVIEW_GRID_DENSITY') {if(['compact','default','comfortable'].includes(event.data.density))setGridDensity(event.data.density);return;}
      if(event.data.type === 'DIO_VISUAL_PREVIEW_GRID_SORT') {if(event.data.direction===null||event.data.direction==='asc'||event.data.direction==='desc')setGridSort(event.data.direction);return;}
      if(event.data.type === 'DIO_VISUAL_PREVIEW_GRID_WIDTHS') {const raw=event.data.values;if(!raw||typeof raw!=='object'||Array.isArray(raw))return;const next:Record<string,LeadColumnWidth>={};for(const [id,value] of Object.entries(raw)){if(!/^lead\.[A-Za-z][A-Za-z0-9]*$/.test(id)||!value||typeof value!=='object'||Array.isArray(value))return;const width=value as Record<string,unknown>;if(width.mode==='auto')next[id]={mode:'auto'};else if(width.mode==='min'&&typeof width.widthPx==='number'&&Number.isInteger(width.widthPx)&&width.widthPx>=80&&width.widthPx<=600)next[id]={mode:'min',widthPx:width.widthPx};else return;}setGridWidths(next);return;}
      if(event.data.type === 'DIO_VISUAL_PREVIEW_GRID_ALIGNMENTS') {const raw=event.data.values;if(!raw||typeof raw!=='object'||Array.isArray(raw))return;const next:Record<string,'start'|'center'|'end'>={};for(const [id,value] of Object.entries(raw)){if(!/^lead\.[A-Za-z][A-Za-z0-9]*$/.test(id)||!(value==='start'||value==='center'||value==='end'))return;next[id]=value;}setGridAlignments(next);return;}
      if(event.data.type === 'DIO_VISUAL_PREVIEW_BUTTON_PRESENTATION') {const value=event.data.value;if(value===null||value==='primary'||value==='secondary')setButtonEmphasis(value??undefined);return;}
      if(event.data.type === 'DIO_VISUAL_PREVIEW_POPUP_PRESENTATION') {const raw=event.data.value;if(!raw||typeof raw!=='object'||Array.isArray(raw))return;const title=typeof raw.title==='string'&&raw.title.length<=200?raw.title:undefined,size=['small','medium','large','full'].includes(raw.size)?raw.size as PopupSize:undefined;setPopupPresentation({title,size});return;}
      if(event.data.type === 'DIO_VISUAL_PREVIEW_PLACEMENTS') {
        const raw=event.data.orders;
        if(!raw||typeof raw!=='object'||Array.isArray(raw))return;
        const valid:PlacementOrders={};
        for(const region of placementRegions){const order=raw[region.id];if(Array.isArray(order)&&order.length===region.fieldIds.length&&new Set(order).size===order.length&&order.every(id=>region.fieldIds.includes(id)))valid[region.id]=order;}
        setPlacements(valid);return;
      }
      if(event.data.type !== 'DIO_VISUAL_PREVIEW_GRID_COLUMNS') return;
      const incoming = event.data.columns;
      const allowed = new Set<string>(leadGridCandidates.map(item => item.fieldId));
      if (Array.isArray(incoming) && incoming.length <= allowed.size && incoming.every(id => typeof id === 'string' && allowed.has(id)) && new Set(incoming).size === incoming.length) {setGridColumns(incoming);setColumnOrder(validLeadColumnOrder(event.data.order,incoming)?event.data.order:undefined);}
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [boot.nonce]);
  useEffect(() => {
    void changeLocale(boot.locale === 'en-US' ? 'en-US' : 'ko-KR');
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts++;
      const click = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return false;
        window.__DIO_VISUAL_PREVIEW_SETUP__ = true;
        try { element.click(); } finally { window.__DIO_VISUAL_PREVIEW_SETUP__ = false; }
        return true;
      };
      const has = (selector: string) => Boolean(document.querySelector(selector));
      let ready = false;
      if (boot.screen === 'HQ_LEAD') {
        if (boot.variant === 'list') ready = has('.hq-lead-list [data-config-id]');
        else if (boot.variant === 'detail') {
          const tab=boot.tab??'basic';
          ready=has(`.hq-lead-detail [data-tab-key="${tab}"][aria-selected="true"]`);
          if(!ready)click(`.hq-lead-detail [data-tab-key="${tab}"]`);
        }
        else if (boot.variant === 'create') ready = has('dialog[data-config-id="POP.LEAD.CREATE"]') || click('.hq-lead-list [data-config-id="LEAD.create"]') && false;
        else if (boot.variant === 'owner') ready = has('dialog[data-config-id="POP.LEAD.OWNER"]') || click('[data-config-instance="detail.owner.open"]') && false;
        else if (boot.variant === 'convert') ready = has('dialog[data-config-id="POP.LEAD.CONVERT"]') || click('[data-config-instance="detail.convert.open"]') && false;
      } else if (boot.screen === 'HQ_DIRECT_WORK') {
        ready = has('[data-config-instance="detail.status"]');
        if (!ready) click('[data-testid="direct-work-open"]');
      } else if (boot.screen === 'HQ_ANALYTICS') {
        ready = has('[data-config-instance="analytics.filters.from"]') && has('[data-config-instance="analytics.filters.to"]') && has('.h06-columns .h06-card');
      } else if (boot.screen === 'HQ_OPPORTUNITY') {
        ready = has('[data-config-instance="detail.name"]') && has('[data-config-instance="detail.save"]');
      } else {
        if (boot.variant === 'list') ready = boot.fixtureState === 'error'
          ? has('[role="alert"]')
          : has('.account-desktop [data-config-id],.account-mobile [data-config-id]');
        else if (boot.variant === 'detail') ready = boot.fixtureState === 'erp-requesting'
          ? has('[data-config-instance="detail.erp.integration"]')
          : has('.hq-account-workspace [data-config-id]');
        else if (boot.variant === 'create') ready = has('[data-config-instance="create.crmName"]') || click('[data-config-id="ACC.create"][data-config-instance="pc.create"],[data-config-id="ACC.create"][data-config-instance="mobile.create"]') && false;
        else if (boot.variant === 'bulk') ready = has('dialog[data-config-id="POP.ACC.BULK"]') || click('[data-testid="open-account-ledger"]') && false;
        else if (boot.variant === 'merge') ready = has('dialog[data-config-id="POP.ACC.MERGE"]') || click('[data-testid="open-account-merge"]') && false;
        else if (boot.variant === 'contact') {
          ready = has('dialog[data-config-id="POP.ACC.CONTACT"]');
          if (!ready && has('.hq-account-workspace [data-tab-key="contacts"]')) {
            if (!has('[data-testid="new-contact"]')) click('[data-tab-key="contacts"]');
            else click('[data-testid="new-contact"]');
          }
        }
      }
      if (ready) {
        window.clearInterval(timer);
        window.parent.postMessage({ type: 'DIO_VISUAL_PREVIEW_READY', nonce: boot.nonce, screen: boot.screen, variant: boot.variant, fixtureState: boot.fixtureState ?? 'normal', anchorCount: document.querySelectorAll('[data-config-id]').length }, '*');
      } else if (attempts > 100) {
        window.clearInterval(timer);
        window.parent.postMessage({ type: 'DIO_VISUAL_PREVIEW_ERROR', nonce: boot.nonce, message: 'FIXTURE_STATE_NOT_RENDERED' }, '*');
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [boot]);
  return <PlacementContext.Provider value={placements}><GridDensityContext.Provider value={gridDensity}><GridSortContext.Provider value={gridSort}><GridColumnWidthContext.Provider value={gridWidths}><GridColumnAlignmentContext.Provider value={gridAlignments}><PopupPresentationContext.Provider value={popupPresentation}><ButtonPresentationContext.Provider value={buttonEmphasis}>
    <PreviewFence />
    <HqMockProvider><GlobalizationProvider><MemoryRouter initialEntries={[boot.screen === 'HQ_LEAD'
      ? ['detail', 'owner', 'convert'].includes(boot.variant) ? `/leads?lead=${leadId}` : '/leads'
      : boot.screen === 'HQ_DIRECT_WORK' ? '/direct-work' : boot.screen === 'HQ_ANALYTICS' ? '/analytics' : boot.screen === 'HQ_OPPORTUNITY' ? '/opportunities' : ['detail', 'contact'].includes(boot.variant) ? `/accounts?record=${boot.fixtureState === 'erp-requesting' ? pendingAccountId : accountId}${boot.fixtureState === 'erp-requesting' ? '&tab=erp' : ''}` : '/accounts']}>
      {boot.screen === 'HQ_LEAD' ? <HqLeadsPage previewGridColumns={gridColumns} previewColumnOrder={columnOrder} /> : boot.screen === 'HQ_DIRECT_WORK' ? <HqDirectWorkPage /> : boot.screen === 'HQ_ANALYTICS' ? <HqAnalyticsView /> : boot.screen === 'HQ_OPPORTUNITY' ? <HqOpportunitiesPage /> : <AccountsPage />}
    </MemoryRouter></GlobalizationProvider></HqMockProvider>
  </ButtonPresentationContext.Provider></PopupPresentationContext.Provider></GridColumnAlignmentContext.Provider></GridColumnWidthContext.Provider></GridSortContext.Provider></GridDensityContext.Provider></PlacementContext.Provider>;
}

export function VisualPreviewRuntime() {
  const boot = window.__DIO_VISUAL_PREVIEW_BOOT__;
  if (!window.__DIO_VISUAL_PREVIEW__ || !boot || !['HQ_LEAD', 'HQ_ACCOUNT', 'HQ_DIRECT_WORK', 'HQ_ANALYTICS', 'HQ_OPPORTUNITY'].includes(boot.screen)) return <main role="alert">VISUAL_PREVIEW_BOOT_INVALID</main>;
  return <PreviewState boot={boot} />;
}
