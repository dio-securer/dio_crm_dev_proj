/**
 * Trusted, versioned design metadata for future administrator-authored logic.
 * This registry is not an executor, a binding, a grant or a policy decision.
 * No event becomes available for execution merely because it is listed here.
 */
export const LOGIC_EVENT_REGISTRY_VERSION = 1 as const;

export type LogicEventDescriptor = {
  registryVersion: typeof LOGIC_EVENT_REGISTRY_VERSION;
  eventId: string;
  screenId: string;
  variant: 'create' | 'detail' | 'convert';
  executionContext: 'screen' | 'server';
  phase: 'field-change' | 'before-command';
  target: { kind: 'field-scope' | 'action'; id: string };
  /** Describes proposed input categories, never unrestricted access to values. */
  proposedInputs: ReadonlyArray<'authorized-form-values' | 'changed-field-id' | 'authorized-record-values' | 'authorized-command-input' | 'release-context'>;
  /** A future runtime must separately validate and authorize every result. */
  proposedResults: ReadonlyArray<'display-proposal' | 'calculation-proposal' | 'validation-errors' | 'command-proposal'>;
  runtimeStatus: 'not-implemented';
};

const leadEvents: ReadonlyArray<LogicEventDescriptor> = [
  {registryVersion:1,eventId:'lead.create.field-change.v1',screenId:'HQ_LEAD',variant:'create',executionContext:'screen',phase:'field-change',target:{kind:'field-scope',id:'lead.create'},proposedInputs:['authorized-form-values','changed-field-id','release-context'],proposedResults:['display-proposal','calculation-proposal','validation-errors'],runtimeStatus:'not-implemented'},
  {registryVersion:1,eventId:'lead.detail.field-change.v1',screenId:'HQ_LEAD',variant:'detail',executionContext:'screen',phase:'field-change',target:{kind:'field-scope',id:'lead.detail'},proposedInputs:['authorized-form-values','changed-field-id','release-context'],proposedResults:['display-proposal','calculation-proposal','validation-errors'],runtimeStatus:'not-implemented'},
  {registryVersion:1,eventId:'lead.create.before-save.v1',screenId:'HQ_LEAD',variant:'create',executionContext:'server',phase:'before-command',target:{kind:'action',id:'LEAD.create'},proposedInputs:['authorized-form-values','authorized-command-input','release-context'],proposedResults:['calculation-proposal','validation-errors','command-proposal'],runtimeStatus:'not-implemented'},
  {registryVersion:1,eventId:'lead.detail.before-save.v1',screenId:'HQ_LEAD',variant:'detail',executionContext:'server',phase:'before-command',target:{kind:'action',id:'LEAD.save'},proposedInputs:['authorized-form-values','authorized-record-values','authorized-command-input','release-context'],proposedResults:['calculation-proposal','validation-errors','command-proposal'],runtimeStatus:'not-implemented'},
  {registryVersion:1,eventId:'lead.convert.before-command.v1',screenId:'HQ_LEAD',variant:'convert',executionContext:'server',phase:'before-command',target:{kind:'action',id:'LEAD.convert'},proposedInputs:['authorized-record-values','authorized-command-input','release-context'],proposedResults:['validation-errors','command-proposal'],runtimeStatus:'not-implemented'},
];

/** Returned copies prevent callers from changing the trusted registry in memory. */
function copyEvent(event: LogicEventDescriptor): LogicEventDescriptor {
  return {...event, target:{...event.target}, proposedInputs:[...event.proposedInputs], proposedResults:[...event.proposedResults]};
}

/** Unknown screen, version or identifier returns no descriptor; input cannot add events. */
export function findLogicEvent(screenId: unknown, eventId: unknown, version: unknown): LogicEventDescriptor | null {
  if (typeof screenId !== 'string' || typeof eventId !== 'string' || version !== LOGIC_EVENT_REGISTRY_VERSION) return null;
  const event = leadEvents.find(item => item.screenId === screenId && item.eventId === eventId);
  return event ? copyEvent(event) : null;
}

/** Only explicitly registered screens and versions can be enumerated. */
export function listLogicEvents(screenId: unknown, version: unknown): LogicEventDescriptor[] {
  if (typeof screenId !== 'string' || version !== LOGIC_EVENT_REGISTRY_VERSION) return [];
  return leadEvents.filter(item => item.screenId === screenId).map(copyEvent);
}
