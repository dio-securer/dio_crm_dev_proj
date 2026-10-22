import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost } from '../api';
import { getHqScenario, getHqToken, isHqMockMode, setHqScenario, setHqToken, type HqScenario } from './mode';
import './hq-mock.css';

export interface HqMockUser {
  userId: number;
  name: string;
  loginId: string;
  companyId: number;
  permissions: string[];
  scope: string;
}
export interface HqMockDataset {
  datasetId: string;
  schemaVersion: number;
  generation: number;
  revision: number;
  storageLifetime: string;
}
export interface HqMockSession {
  accessToken?: string;
  user: HqMockUser;
  dataset: HqMockDataset;
}
export interface HqResetPreview {
  confirmationToken: string;
  datasetId: string;
  generation: number;
  revision: number;
  counts: Record<string, number>;
}

type HqMockContextValue = {
  enabled: boolean;
  session: HqMockSession | null;
  busy: boolean;
  scenario: HqScenario;
  notice: string;
  changeActor: (loginId: string) => Promise<void>;
  changeScenario: (scenario: HqScenario) => void;
  reset: (confirmationToken: string) => Promise<void>;
};
const unavailable = async () => { throw new Error('HQ_MOCK_NOT_ACTIVE'); };
const HqMockContext = createContext<HqMockContextValue>({
  enabled: false, session: null, busy: false, scenario: 'SUCCESS', notice: '',
  changeActor: unavailable, reset: unavailable, changeScenario: () => {}
});

function checkSession(value: HqMockSession): HqMockSession {
  if (!value?.dataset?.datasetId || !Number.isInteger(value.dataset.generation)
    || !value.user || !Number.isInteger(value.user.userId)
    || !Array.isArray(value.user.permissions) || !value.user.permissions.every(item => typeof item === 'string')) {
    throw new Error('HQ_MOCK_SESSION_INVALID');
  }
  return value;
}

async function confirmMockServer() {
  const result = await apiGet<{ mock: boolean }>('/api/hq/bootstrap');
  if (result.mock !== true) throw new Error('HQ_MOCK_NOT_CONFIRMED');
}

async function login(loginId: string, datasetId = 'HQ_DEMO'): Promise<HqMockSession> {
  await confirmMockServer();
  const result = checkSession(await apiPost<HqMockSession>('/api/hq/session', {
    loginId, password: 'HQ-DEMO', datasetId
  }));
  if (!result.accessToken) throw new Error('HQ_MOCK_TOKEN_MISSING');
  setHqToken(result.accessToken);
  return result;
}

let booting: Promise<HqMockSession> | undefined;
function restoreSession(): Promise<HqMockSession> {
  if (booting) return booting;
  booting = (async () => {
    await confirmMockServer();
    if (getHqToken()) {
      try { return checkSession(await apiGet<HqMockSession>('/api/hq/session')); }
      catch (error) {
        if (!(error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 401)) throw error;
        setHqToken(null);
      }
    }
    return login('hq-admin');
  })().finally(() => { booting = undefined; });
  return booting;
}

export function HqMockProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const enabled = isHqMockMode();
  const [session, setSession] = useState<HqMockSession | null>(null);
  const [busy, setBusy] = useState(enabled);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [scenario, setScenario] = useState<HqScenario>(getHqScenario);
  const [epoch, setEpoch] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    setBusy(true);
    setError('');
    void restoreSession().then(result => {
      if (!current) return;
      client.clear();
      setSession(result);
      setEpoch(value => value + 1);
    }).catch(reason => {
      if (current) { setSession(null); setError(reason instanceof Error ? reason.message : String(reason)); }
    }).finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [enabled, attempt, client]);

  const changeActor = useCallback(async (loginId: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    const datasetId = session?.dataset.datasetId ?? 'HQ_DEMO';
    setSession(null);
    await client.cancelQueries();
    client.clear();
    setHqToken(null);
    try {
      const result = await login(loginId, datasetId);
      client.clear();
      setSession(result);
      setEpoch(value => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      throw reason;
    } finally { setBusy(false); }
  }, [client, session?.dataset.datasetId]);

  const changeScenario = useCallback((value: HqScenario) => {
    setHqScenario(value);
    setScenario(value);
    setNotice('');
  }, []);

  const reset = useCallback(async (confirmationToken: string) => {
    await apiPost('/api/hq/reset', { confirmationToken });
    await client.cancelQueries();
    client.clear();
    const result = checkSession(await apiGet<HqMockSession>('/api/hq/session'));
    setSession(result);
    setEpoch(value => value + 1);
    setNotice(t('hqMock.resetDone'));
  }, [client, t]);

  const value = useMemo(() => ({
    enabled, session, busy, scenario, notice, changeActor, changeScenario, reset
  }), [enabled, session, busy, scenario, notice, changeActor, changeScenario, reset]);

  if (!enabled) return <>{children}</>;
  return <HqMockContext.Provider value={value}>
    {busy || !session ? <main className="hq-mock-session" aria-busy={busy}>
      <section className="hq-mock-session-card">
        <span className="hq-mock-badge">MOCK</span>
        <h1>{t('hqMock.title')}</h1>
        <p>{t('hqMock.sessionDescription')}</p>
        {busy && <p role="status">{t('hqMock.connecting')}</p>}
        {error && <><p className="hq-mock-error" role="alert">{error}</p>
          <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('common.retry', { defaultValue: t('hqMock.retry') })}</button></>}
      </section>
    </main> : <React.Fragment key={epoch}>{children}</React.Fragment>}
  </HqMockContext.Provider>;
}

export function useHqMock(): HqMockContextValue { return useContext(HqMockContext); }
