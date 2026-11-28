// An in-memory VersionStore for tests and local runs. A transaction works on a copy and keeps it only on success.
import { VersionEvent, VersionRecord, VersionStore, VersionTx } from './types';

interface State { versions: Map<number, VersionRecord>; pointer?: number; events: VersionEvent[]; nextId: number }
const copy = (s: State): State => ({ versions: new Map([...s.versions].map(([k, v]) => [k, structuredClone(v)])), pointer: s.pointer, events: [...s.events], nextId: s.nextId });

export interface MemoryVersionStore extends VersionStore { snapshot(): { versions: VersionRecord[]; pointer?: number; events: VersionEvent[] } }

export function memoryVersionStore(): MemoryVersionStore {
  let state: State = { versions: new Map(), events: [], nextId: 1 };
  let queue: Promise<unknown> = Promise.resolve();
  const run = async <T>(work: (tx: VersionTx) => Promise<T>): Promise<T> => {
    const draft = copy(state);
    const tx: VersionTx = {
      lockPointer: async () => draft.pointer,
      setPointer: async id => { draft.pointer = id; },
      get: async id => { const v = draft.versions.get(id); return v && structuredClone(v); },
      insert: async v => { const id = draft.nextId++; draft.versions.set(id, { ...structuredClone(v), id }); return id; },
      update: async (id, change) => {
        const v = draft.versions.get(id);
        if (!v) return;
        const next: VersionRecord = { ...v, ...change };
        for (const k of Object.keys(change) as (keyof typeof change)[]) if (change[k] === undefined) delete next[k];
        draft.versions.set(id, next);
      },
      addEvent: async e => { draft.events.push({ ...e }); },
    };
    const result = await work(tx);
    state = draft;
    return result;
  };
  return {
    // Transactions run one at a time, like the pointer lock of a database.
    transaction: work => { const p = queue.then(() => run(work)); queue = p.catch(() => undefined); return p; },
    snapshot: () => ({ versions: [...copy(state).versions.values()], pointer: state.pointer, events: [...state.events] }),
  };
}
