import React from 'react';
import { UiIcon } from '../UiIcon';
import '../../styles/ab-workspace-extras.css';

type Props = {
  label: React.ReactNode;
  title: React.ReactNode;
  due?: React.ReactNode;
  action?: React.ReactNode;
};

export function AbNextAction({ label, title, due, action }: Props) {
  return (
    <section className="ab-next-action">
      <span className="ab-next-action-icon" aria-hidden="true"><UiIcon name="target" size="var(--icon-md)" /></span>
      <div className="ab-next-action-main"><small>{label}</small><strong>{title}</strong>{due && <em>{due}</em>}</div>
      {action && <div className="ab-next-action-command">{action}</div>}
    </section>
  );
}
