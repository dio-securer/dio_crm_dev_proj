import React from 'react';

export function AbMobileFab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="ab-mobile-fab" onClick={onClick} aria-label={label}>
      <span aria-hidden="true">+</span>
    </button>
  );
}
