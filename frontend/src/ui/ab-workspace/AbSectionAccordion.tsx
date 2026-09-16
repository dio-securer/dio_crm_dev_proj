import React from 'react';

type Props = {
  id: string;
  title: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  incomplete?: boolean;
};

export function AbSectionAccordion({ id, title, hint, open, onToggle, children, incomplete }: Props) {
  return (
    <section className={`ab-section${open ? ' open' : ''}${incomplete ? ' incomplete' : ''}`}>
      <button type="button" className="ab-section-head" aria-expanded={open} aria-controls={`section-${id}`} onClick={onToggle}>
        <span className="ab-section-chevron" aria-hidden="true">{open ? '▼' : '▶'}</span>
        <strong>{title}</strong>
        {hint && <em>{hint}</em>}
        {incomplete && <i className="ab-section-badge">!</i>}
      </button>
      {open && <div className="ab-section-body" id={`section-${id}`}>{children}</div>}
    </section>
  );
}
