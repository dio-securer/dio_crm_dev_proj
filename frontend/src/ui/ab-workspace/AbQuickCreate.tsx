import React from 'react';
import '../../styles/ab-workspace-extras.css';

type Props = {
  open: boolean;
  title: React.ReactNode;
  help?: React.ReactNode;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function AbQuickCreate({ open, title, help, closeLabel, onClose, children, footer, className = '' }: Props) {
  if (!open) return null;
  return (
    <div className="ab-quick-create-backdrop" onMouseDown={onClose}>
      <aside className={`ab-quick-create${className ? ` ${className}` : ''}`} onMouseDown={event => event.stopPropagation()}>
        <header className="ab-quick-create-header">
          <div><strong>{title}</strong>{help && <p>{help}</p>}</div>
          <button type="button" onClick={onClose} aria-label={closeLabel}>×</button>
        </header>
        <div className="ab-quick-create-body">{children}</div>
        {footer && <footer className="ab-quick-create-footer">{footer}</footer>}
      </aside>
    </div>
  );
}
