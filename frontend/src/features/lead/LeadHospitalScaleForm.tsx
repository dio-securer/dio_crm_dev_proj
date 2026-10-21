import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LeadHospitalScale } from './lead-model';
import '../../styles/lead-detail-enhancements.css';

type Props = {
  value: LeadHospitalScale;
  onSave: (value: LeadHospitalScale) => void;
};

const HOSPITAL_TYPES = ['CLINIC', 'DENTAL_HOSPITAL', 'GENERAL_HOSPITAL', 'OTHER'] as const;

export function LeadHospitalScaleForm({ value, onSave }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<LeadHospitalScale>(value);

  useEffect(() => setDraft(value), [value]);

  const numeric = (field: 'doctorCount' | 'chairCount' | 'staffCount', raw: string) => {
    const parsed = raw === '' ? undefined : Math.max(0, Number(raw));
    setDraft(prev => ({ ...prev, [field]: Number.isFinite(parsed) ? parsed : undefined }));
  };

  return (
    <div className="lead-enhance-form">
      <div className="lead-enhance-grid">
        <label>
          <span>{t('lead.fields.hospitalType')}</span>
          <select value={draft.hospitalType} onChange={event => setDraft(prev => ({ ...prev, hospitalType: event.target.value }))}>
            {HOSPITAL_TYPES.map(type => <option value={type} key={type}>{t(`lead.hospitalType.${type}`)}</option>)}
          </select>
        </label>
        <label>
          <span>{t('lead.fields.mainSpecialty')}</span>
          <input value={draft.mainSpecialty} onChange={event => setDraft(prev => ({ ...prev, mainSpecialty: event.target.value }))} placeholder={t('lead.fields.mainSpecialty')} />
        </label>
        <label>
          <span>{t('lead.fields.doctorCount')}</span>
          <input type="number" min="0" inputMode="numeric" value={draft.doctorCount ?? ''} onChange={event => numeric('doctorCount', event.target.value)} />
        </label>
        <label>
          <span>{t('lead.fields.chairCount')}</span>
          <input type="number" min="0" inputMode="numeric" value={draft.chairCount ?? ''} onChange={event => numeric('chairCount', event.target.value)} />
        </label>
        <label>
          <span>{t('lead.fields.staffCount')}</span>
          <input type="number" min="0" inputMode="numeric" value={draft.staffCount ?? ''} onChange={event => numeric('staffCount', event.target.value)} />
        </label>
      </div>
      <div className="lead-enhance-actions">
        <button type="button" className="lead-v2-button primary" onClick={() => onSave(draft)}>{t('lead.actions.saveHospitalScale')}</button>
      </div>
    </div>
  );
}
