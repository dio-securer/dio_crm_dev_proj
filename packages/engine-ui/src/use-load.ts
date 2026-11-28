// A small loader hook: runs an async read when its key changes and keeps the latest answer only.
import { useEffect, useState } from 'react';
import type { Failure } from './types';
import { failureOf } from './text';

export type Loaded<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'failed'; failure: Failure };

export function useLoad<T>(key: string, load: () => Promise<T>): Loaded<T> & { reload: () => void } {
  const [turn, setTurn] = useState(0);
  const [result, setResult] = useState<{ key: string; value: Loaded<T> }>({ key: '', value: { state: 'loading' } });
  const stamp = `${key}\u0000${turn}`;
  useEffect(() => {
    let current = true;
    load().then(
      data => { if (current) setResult({ key: stamp, value: { state: 'ready', data } }); },
      error => { if (current) setResult({ key: stamp, value: { state: 'failed', failure: failureOf(error) } }); },
    );
    return () => { current = false; };
    // `load` is a new function on every render; the key says when the read must run again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);
  // An answer for an older key is never shown for the new one.
  const value: Loaded<T> = result.key === stamp ? result.value : { state: 'loading' };
  return { ...value, reload: () => setTurn(t => t + 1) };
}
