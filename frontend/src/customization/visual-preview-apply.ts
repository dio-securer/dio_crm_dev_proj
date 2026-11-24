import type { PreviewSetting } from './visual-preview-projection';
import { presentationPlacements, type EffectivePlacementPresentation } from '@dio-crm/contracts/crm-customization';
import {placementIdForInstance} from './placement-instance';

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type Original = {
  display: string; order: string; text: Text | null; label: string;
  input: Control | null;
  describedBy: string | null;
  value: string; required: boolean; readOnly: boolean; disabled: boolean;
};

export function createVisualPreviewApplier() {
  const originals = new WeakMap<HTMLElement, Original>();
  let entries = new Map<string, PreviewSetting>();
  let presentations: EffectivePlacementPresentation = {};

  const apply = () => document.querySelectorAll<HTMLElement>('[data-config-id]').forEach(element => {
    let original = originals.get(element);
    if (!original) {
      const input: Control | null = element.matches('input,textarea,select') ? element as Control : element.querySelector<Control>('input,textarea,select');
      const labelElement = element.matches('label,button,[role="tab"],summary,th') ? element.querySelector(':scope > span') ?? element
        : element.matches('dl > div') ? element.querySelector(':scope > dt') : null;
      const text = labelElement
        ? Array.from(labelElement.childNodes).find((node): node is Text => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())) ?? null
        : null;
      const captured: Original = { display: element.style.display, order: element.style.order, text, label: text?.textContent ?? '', input, describedBy:input?.getAttribute('aria-describedby')??null, value: input?.value ?? '', required: input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement ? input.required : false, readOnly: input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement ? input.readOnly : false, disabled: input?.disabled ?? false };
      originals.set(element, captured);
      original = captured;
    }
    const item = entries.get(element.getAttribute('data-config-id') ?? '');
    const instance=element.getAttribute('data-config-instance');
    const placement=presentationPlacements.find(p=>p.fieldId===element.getAttribute('data-config-id')&&p.id===placementIdForInstance(p.screenId,instance));
    const presentation=placement?presentations[placement.id]:undefined;
    const values = item?.values ?? {};
    element.style.display = values.visible === false || values.enabled === false ? 'none' : original.display;
    element.style.order = typeof values.order === 'number' && Number.isSafeInteger(values.order) ? String(values.order) : original.order;
    element.classList.toggle('visual-preview-readonly', values.readOnly === true);
    element.classList.toggle('visual-preview-redacted', values.masking === 'redact');
    element.classList.toggle('visual-preview-required', values.required === true);
    if (original.text) {
      const text=presentation?.label ?? item?.label ?? original.label;
      const required=values.required===true || values.required!==false && original.required;
      original.text.textContent = text.replace(/\s+$/, '') + (required && !/\*$/.test(text.trim()) ? ' *' : '');
    }
    if (placement && element.matches('label')) {
      const helpId=`preview-help-${placement.id.replace(/[^A-Za-z0-9_-]/g,'-')}`;
      let help=element.querySelector<HTMLElement>(':scope > [data-preview-placement-help]');
      if(presentation?.helpText){
        if(!help){help=document.createElement('small');help.dataset.previewPlacementHelp='true';help.id=helpId;element.append(help);}
        if(help.textContent!==presentation.helpText)help.textContent=presentation.helpText;
        const described=[original.describedBy,helpId].filter(Boolean).join(' ');
        if(original.input&&original.input.getAttribute('aria-describedby')!==described)original.input.setAttribute('aria-describedby',described);
      }else{
        help?.remove();
        if(original.input&&original.input.getAttribute('aria-describedby')!==original.describedBy){if(original.describedBy)original.input.setAttribute('aria-describedby',original.describedBy);else original.input.removeAttribute('aria-describedby');}
      }
    }
    if (original.input) {
      if (values.default !== undefined) original.input.value = values.default === null ? '' : String(values.default);
      else original.input.value = original.value;
      if (original.input instanceof HTMLInputElement || original.input instanceof HTMLTextAreaElement) {
        original.input.required = typeof values.required === 'boolean' ? values.required : original.required;
        original.input.readOnly = typeof values.readOnly === 'boolean' ? values.readOnly : original.readOnly;
      } else original.input.disabled = values.readOnly === true ? true : original.disabled;
    }
  });

  const update = (value: unknown) => {
    if (!Array.isArray(value) || value.length > 1000) return;
    const next = new Map<string, PreviewSetting>();
    for (const raw of value) {
      if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,239}$/.test(raw.id) || !raw.values || typeof raw.values !== 'object') return;
      if (raw.label !== undefined && (typeof raw.label !== 'string' || raw.label.length > 20000)) return;
      next.set(raw.id, raw as PreviewSetting);
    }
    entries = next;
    apply();
  };
  const updatePresentation=(value:unknown)=>{
    if(!value||typeof value!=='object'||Array.isArray(value))return;
    const next:EffectivePlacementPresentation={};
    for(const placement of presentationPlacements){const raw=(value as Record<string,unknown>)[placement.id];if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;const record=raw as Record<string,unknown>;next[placement.id]={...(typeof record.label==='string'&&record.label.length<=200?{label:record.label}:{}),...(typeof record.helpText==='string'&&record.helpText.length<=1000?{helpText:record.helpText}:{})};}
    presentations=next;apply();
  };
  return { apply, update, updatePresentation };
}
