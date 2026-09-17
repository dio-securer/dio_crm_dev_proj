import React from 'react';
import { UiIcon } from '../UiIcon';

export function AbMobileFab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="ab-mobile-fab" onClick={onClick} aria-label={label}>
      <span aria-hidden="true"><UiIcon name="plus" size="var(--icon-lg)" strokeWidth={2.2} /></span>
    </button>
  );
}
