import React from 'react';

type Props = {
  draftLabel: string;
  saveLabel: string;
  onDraft?: () => void;
  onSave?: () => void;
  saving?: boolean;
};

export function AbDetailFooter({ draftLabel, saveLabel, onDraft, onSave, saving }: Props) {
  return (
    <footer className="ab-detail-footer">
      {onDraft && <button type="button" className="ab-btn ab-btn-ghost" onClick={onDraft}>{draftLabel}</button>}
      {onSave && <button type="button" className="ab-btn ab-btn-primary" onClick={onSave} disabled={saving}>{saveLabel}</button>}
    </footer>
  );
}
