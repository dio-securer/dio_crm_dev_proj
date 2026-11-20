import {createHash} from 'node:crypto';
import {findLogicEvent} from '@dio-crm/contracts/logic-events';

/** Immutable release input prepared by a trusted publisher after configuration and
 * logic validation. It is deliberately separate from runtime registration. */
export type LogicReleaseManifest = {
  schemaVersion: 1;
  companyId: string;
  configReleaseId: string;
  configRevision: number;
  logicRevision: number;
  engineVersion: string;
  entries: Array<{
    screenId: string;
    eventId: string;
    registryVersion: 1;
    source: string;
    sourceHash: string;
  }>;
  contentHash: string;
};

type LogicSource = Omit<LogicReleaseManifest['entries'][number], 'sourceHash'>;
type ManifestInput = Omit<LogicReleaseManifest, 'schemaVersion'|'entries'|'contentHash'> & {entries: LogicSource[]};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha = (value:string) => createHash('sha256').update(value,'utf8').digest('hex');
function canonical(input:Omit<LogicReleaseManifest,'contentHash'>):string {
  return JSON.stringify(input);
}
/** The caller must hold the config and logic draft locks, check HQ authoring rights,
 * and commit this snapshot together with the configuration release. */
export function prepareLogicReleaseManifest(input:ManifestInput):LogicReleaseManifest {
  if (!uuid.test(input.companyId) || !uuid.test(input.configReleaseId) ||
      !Number.isSafeInteger(input.configRevision) || input.configRevision < 1 ||
      !Number.isSafeInteger(input.logicRevision) || input.logicRevision < 0 ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(input.engineVersion) ||
      input.entries.length > 5) throw Error('LOGIC_MANIFEST_INVALID');
  const seen=new Set<string>();
  const entries=input.entries.map(entry=>{
    if (!findLogicEvent(entry.screenId,entry.eventId,entry.registryVersion) ||
        typeof entry.source !== 'string' || Buffer.byteLength(entry.source,'utf8') > 32768 ||
        Buffer.from(entry.source,'utf8').toString('utf8') !== entry.source ||
        seen.has(entry.eventId)) throw Error('LOGIC_MANIFEST_INVALID');
    seen.add(entry.eventId);
    return {screenId:entry.screenId,eventId:entry.eventId,registryVersion:entry.registryVersion,
      source:entry.source,sourceHash:sha(entry.source)};
  }).sort((a,b)=>a.eventId.localeCompare(b.eventId));
  const body={schemaVersion:1 as const,companyId:input.companyId.toLowerCase(),
    configReleaseId:input.configReleaseId.toLowerCase(),configRevision:input.configRevision,
    logicRevision:input.logicRevision,engineVersion:input.engineVersion,entries};
  return {...body,contentHash:sha(canonical(body))};
}

/** Recompute from stored content. A hash is an integrity check, not a signature or
 * authorization grant; active-release and actor checks remain the host's duty. */
export function verifyLogicReleaseManifest(raw:LogicReleaseManifest):boolean {
  try {
    const {contentHash,entries,...body}=raw;
    if (body.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(contentHash)) return false;
    const exactKeys=(value:object,expected:string[])=>
      Object.keys(value).sort().join('\u0000')===expected.sort().join('\u0000');
    if (!exactKeys(raw,['schemaVersion','companyId','configReleaseId','configRevision','logicRevision','engineVersion','entries','contentHash']) ||
        !Array.isArray(entries) || entries.some(entry=>!exactKeys(entry,['screenId','eventId','registryVersion','source','sourceHash']))) return false;
    const clean=prepareLogicReleaseManifest({...body,entries:entries.map(({sourceHash,...entry})=>entry)});
    return clean.contentHash===contentHash && entries.length===clean.entries.length &&
      entries.every(entry=>{
        const expected=clean.entries.find(item=>item.eventId===entry.eventId);
        return expected?.screenId===entry.screenId && expected.registryVersion===entry.registryVersion &&
          expected.source===entry.source && expected.sourceHash===entry.sourceHash;
      });
  } catch { return false; }
}
