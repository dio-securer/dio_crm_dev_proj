// The generic detail screen (F2-5): the `detail` screen's tabs, sections and visible fields, read-only.
import { ReactNode, useState } from 'react';
import type { EngineUiModel, Navigate, RecordData } from './types';
import { detailScreen, placeScreen } from './layout';
import { DisplayOptions, TEXT, displayValue, textOf } from './text';

export interface DetailViewProps {
  model: EngineUiModel; record: RecordData; navigate: Navigate; display?: DisplayOptions;
  /** The tab shown first (default: the first tab). */
  initialTab?: string;
  /** Related lists, rendered under the fields. */
  children?: ReactNode;
}

export function DetailView({ model, record, navigate, display, initialTab, children }: DetailViewProps) {
  const screen = detailScreen(model);
  const tabs = screen ? placeScreen(model, screen) : [];
  const [chosen, setChosen] = useState(initialTab);
  const active = tabs.find(t => t.id === chosen) ?? tabs[0];
  const titleField = tabs[0]?.sections[0]?.fields[0];
  const title = (titleField && displayValue(model, titleField.field, record.values[titleField.field.key], display)) || `${model.object.label} #${record.id}`;
  return (
    <section className="engine-page" data-engine="detail" data-object={model.object.key} data-record-id={record.id}>
      <header className="engine-header">
        <div>
          <p className="engine-kicker">{model.object.label}</p>
          <h1>{title}</h1>
        </div>
        <div className="engine-actions">
          <button type="button" className="engine-button" onClick={() => navigate({ mode: 'list' })}>{textOf(model, TEXT.back)}</button>
          <button type="button" className="engine-button engine-primary" onClick={() => navigate({ mode: 'edit', id: record.id })}>{textOf(model, TEXT.edit)}</button>
        </div>
      </header>
      {tabs.length > 1 && (
        <div className="engine-tabs" role="tablist">
          {tabs.map(t => <button key={t.id} type="button" role="tab" id={`engine-tab-${t.id}`} aria-selected={t.id === active?.id} className="engine-tab" onClick={() => setChosen(t.id)}>{t.label}</button>)}
        </div>
      )}
      {active && (
        <div role="tabpanel" aria-labelledby={tabs.length > 1 ? `engine-tab-${active.id}` : undefined} data-tab={active.id}>
          {active.sections.map(section => (
            <section key={section.id} className="engine-section" data-section={section.id}>
              <h2>{section.title}</h2>
              <dl className="engine-grid" style={{ gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))` }}>
                {section.fields.map(({ screen: placed, field }) => (
                  <div key={field.key} className="engine-cell" data-field={field.key}>
                    <dt>{placed.label}</dt>
                    <dd>{displayValue(model, field, record.values[field.key], display)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}
      {children}
    </section>
  );
}
