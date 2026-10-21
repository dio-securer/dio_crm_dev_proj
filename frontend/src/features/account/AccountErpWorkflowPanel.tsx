import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AccountSummary } from '@dio-crm/contracts';
import { AbSectionAccordion, AbStepProgress } from '../../ui/ab-workspace';
import {
  advanceAccountErpMock,
  failAccountErpMock,
  getAccountErpMockWorkflow,
  requestAccountErpMock,
  retryAccountErpMock,
  type AccountErpMockStatus
} from './account-erp-mock';

function currentIndex(status: AccountErpMockStatus) {
  if (status === 'REQUESTING') return 1;
  if (status === 'REVIEWING') return 2;
  if (status === 'SUCCESS') return 3;
  if (status === 'FAILED') return 1;
  return 0;
}

type Props = {
  account: AccountSummary;
  tick?: number;
  onChanged: (messageKey: string, options?: Record<string, unknown>) => void;
};

export function AccountErpWorkflowPanel({ account, tick = 0, onChanged }: Props) {
  const { t, i18n } = useTranslation();
  const workflow = React.useMemo(() => getAccountErpMockWorkflow(account.public_id), [account.public_id, account.integration_status, tick]);
  const [failureReason, setFailureReason] = React.useState('');
  const steps = ['NOT_REQUESTED', 'REQUESTING', 'REVIEWING', 'SUCCESS'].map(status => ({ id: status, label: t(`account.integrationStatus.${status}`) }));

  const run = (action: () => void, messageKey: string, options?: Record<string, unknown>) => {
    try {
      action();
      onChanged(messageKey, options);
    } catch (error) {
      onChanged('account.erpWorkflow.actionFailed', { message: error instanceof Error ? error.message : String(error) });
    }
  };

  const format = (value?: string) => value
    ? new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
    : '-';

  return (
    <AbSectionAccordion id="erp-workflow" title={t('account.erpWorkflow.title')} hint={t(`account.integrationStatus.${workflow.status}`)} open onToggle={() => undefined}>
      <div className="account-erp-workflow">
        <AbStepProgress steps={steps} currentIndex={currentIndex(workflow.status)} mobileLabel={t('account.erpWorkflow.progress')} />
        <dl className="account-erp-meta">
          <div><dt>{t('account.erpWorkflow.requestId')}</dt><dd>{workflow.requestId || '-'}</dd></div>
          <div><dt>{t('account.erpWorkflow.requestedAt')}</dt><dd>{format(workflow.requestedAt)}</dd></div>
          <div><dt>{t('account.erpWorkflow.reviewedAt')}</dt><dd>{format(workflow.reviewedAt)}</dd></div>
          <div><dt>{t('account.erpWorkflow.completedAt')}</dt><dd>{format(workflow.completedAt)}</dd></div>
        </dl>
        {workflow.status === 'FAILED' && <div className="account-erp-failure"><strong>{t('account.erpWorkflow.failed')}</strong><span>{workflow.failureReason || '-'}</span></div>}
        <div className="account-erp-actions">
          {workflow.status === 'NOT_REQUESTED' && <button type="button" className="lead-v2-button primary" onClick={() => run(() => { requestAccountErpMock(account.public_id); }, 'account.erpWorkflow.requested')}>{t('account.actions.erpRequest')}</button>}
          {workflow.status === 'REQUESTING' && <button type="button" className="lead-v2-button primary" onClick={() => run(() => { advanceAccountErpMock(account.public_id); }, 'account.erpWorkflow.reviewing')}>{t('account.erpWorkflow.moveReview')}</button>}
          {workflow.status === 'REVIEWING' && <button type="button" className="lead-v2-button primary" onClick={() => run(() => { advanceAccountErpMock(account.public_id); }, 'account.erpWorkflow.completed')}>{t('account.erpWorkflow.complete')}</button>}
          {workflow.status === 'FAILED' && <button type="button" className="lead-v2-button primary" onClick={() => run(() => { retryAccountErpMock(account.public_id); }, 'account.erpWorkflow.retried')}>{t('account.erpWorkflow.retry')}</button>}
          {(workflow.status === 'REQUESTING' || workflow.status === 'REVIEWING') && <>
            <input value={failureReason} onChange={event => setFailureReason(event.target.value)} placeholder={t('account.erpWorkflow.failureReason')} />
            <button type="button" className="lead-v2-button ghost" onClick={() => run(() => { failAccountErpMock(account.public_id, failureReason); setFailureReason(''); }, 'account.erpWorkflow.failedDone')}>{t('account.erpWorkflow.fail')}</button>
          </>}
        </div>
      </div>
    </AbSectionAccordion>
  );
}
