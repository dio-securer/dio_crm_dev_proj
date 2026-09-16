import React from 'react';

type Step = { id: string; label: string };

type Props = {
  steps: Step[];
  currentIndex: number;
  mobileLabel?: string;
};

export function AbStepProgress({ steps, currentIndex, mobileLabel }: Props) {
  return (
    <div className="ab-step-progress" role="list" aria-label="Progress">
      {mobileLabel && <div className="ab-step-mobile-label">{mobileLabel}</div>}
      <div className="ab-step-track">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;
          const active = done || current;
          return (
            <div key={step.id} className={`ab-step-item${active ? ' active' : ''}${current ? ' current' : ''}${done ? ' done' : ''}`} role="listitem">
              <div className="ab-step-node-wrap">
                {index > 0 && <span className="ab-step-line ab-step-line-left" aria-hidden="true" />}
                <span className="ab-step-node">{done ? '✓' : index + 1}</span>
                {index < steps.length - 1 && <span className="ab-step-line ab-step-line-right" aria-hidden="true" />}
              </div>
              <small>{step.label}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}
