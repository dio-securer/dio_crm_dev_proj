import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiPost } from '../api';
import { HQ_SCENARIOS, type HqScenario } from './mode';
import { useHqMock, type HqResetPreview } from './HqMockProvider';

const PERSONAS = ['hq-admin', 'hq-sales', 'hq-branch', 'hq-division', 'hq-viewer'] as const;

function ResetDialog({ preview, onClose }: { preview: HqResetPreview; onClose: () => void }) {
  const { t } = useTranslation();
  const { reset } = useHqMock();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const current = dialog.current;
    if (current && !current.open) current.showModal();
    return () => { current?.close(); };
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try { await reset(preview.confirmationToken); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="hq-mock-reset-dialog" aria-labelledby="hq-reset-title" aria-describedby="hq-reset-description"
    onCancel={event => { if (busy) event.preventDefault(); else onClose(); }}>
    <form onSubmit={event => void submit(event)} aria-busy={busy}>
      <span className="hq-mock-badge">MOCK</span>
      <h2 id="hq-reset-title">{t('hqMock.resetTitle')}</h2>
      <p id="hq-reset-description">{t('hqMock.resetDescription', { dataset: preview.datasetId })}</p>
      <div className="hq-reset-counts">
        <table><thead><tr><th scope="col">{t('hqMock.dataType')}</th><th scope="col">{t('hqMock.records')}</th></tr></thead>
          <tbody>{Object.entries(preview.counts).map(([name, count]) => <tr key={name}>
            <th scope="row">{t(`hqMock.collections.${name}`, { defaultValue: name })}</th><td>{count}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="hq-mock-muted">{t('hqMock.resetIsolation')}</p>
      {error && <p className="hq-mock-error" role="alert">{error}</p>}
      <div className="hq-mock-dialog-actions">
        <button type="button" onClick={onClose} disabled={busy}>{t('hqMock.cancel')}</button>
        <button type="submit" className="hq-mock-danger" disabled={busy}>{busy ? t('hqMock.resetting') : t('hqMock.confirmReset')}</button>
      </div>
    </form>
  </dialog>;
}

export function HqMockControls() {
  const { t } = useTranslation();
  const { enabled, session, busy, scenario, notice, changeActor, changeScenario } = useHqMock();
  const [preview, setPreview] = useState<HqResetPreview | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  if (!enabled || !session) return null;
  const canReset = session.user.permissions.includes('HQ.RESET');
  const previewReset = async () => {
    setPreparing(true);
    setError('');
    try {
      const result = await apiPost<HqResetPreview>('/api/hq/reset/preview', {});
      if (!result.confirmationToken || result.datasetId !== session.dataset.datasetId || !result.counts) throw new Error('HQ_RESET_PREVIEW_INVALID');
      setPreview(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setPreparing(false); }
  };
  return <section className="hq-mock-controls" aria-label={t('hqMock.title')}>
    <div className="hq-mock-heading">
      <span className="hq-mock-badge">MOCK</span>
      <div><strong>{t('hqMock.title')}</strong><small>{session.dataset.datasetId} · {t(session.dataset.storageLifetime === 'FILE' ? 'hqMock.persisted' : 'hqMock.sessionStorage')}</small></div>
    </div>
    <div className="hq-mock-inputs">
      <label>{t('hqMock.actor')}<select value={session.user.loginId} disabled={busy || preparing}
        onChange={event => void changeActor(event.target.value).catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))}>
        {PERSONAS.map(persona => <option key={persona} value={persona}>{t(`hqMock.personas.${persona}`)}</option>)}
      </select></label>
      <label>{t('hqMock.scenario')}<select value={scenario} onChange={event => changeScenario(event.target.value as HqScenario)} disabled={busy || preparing}>
        {HQ_SCENARIOS.map(value => <option key={value} value={value}>{t(`hqMock.scenarios.${value}`)}</option>)}
      </select></label>
      <button type="button" disabled={!canReset || busy || preparing} onClick={() => void previewReset()} title={!canReset ? t('hqMock.resetPermission') : undefined}>
        {preparing ? t('hqMock.checkingImpact') : t('hqMock.reset')}
      </button>
    </div>
    <small className="hq-mock-footnote">{t('hqMock.demoPassword')} · {t('hqMock.scenarioDescription')}</small>
    {notice && <p className="hq-mock-notice" role="status">{notice}</p>}
    {error && <p className="hq-mock-error" role="alert">{error}</p>}
    {preview && <ResetDialog preview={preview} onClose={() => setPreview(null)} />}
  </section>;
}
