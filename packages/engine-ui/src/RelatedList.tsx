// The generic related list (F2-5): records of another object whose reference field points at the record on screen.
// The relation is read from the model (`related`, derived from reference fields); the child object's own model gives the columns.
import type { UiRelated } from '@dio-crm/engine';
import type { EngineUiModel, Navigate, RecordData } from './types';
import { RecordTable } from './ListView';
import { columnsOf, viewOf } from './layout';
import { DisplayOptions, TEXT, textOf } from './text';

export interface RelatedListProps {
  /** The relation, from the parent's model. */
  related: UiRelated;
  /** The model of the related (child) object. */
  model: EngineUiModel;
  rows: RecordData[];
  navigate: Navigate;
  display?: DisplayOptions;
}

export function RelatedList({ related, model, rows, navigate, display }: RelatedListProps) {
  // The reference column would repeat the parent on every row, so it is left out.
  const columns = columnsOf(model, viewOf(model, undefined), related.field);
  return (
    <section className="engine-section engine-related" data-engine="related" data-object={related.object} data-field={related.field}>
      <h2>{related.label} <span className="engine-count">{rows.length}</span></h2>
      <RecordTable model={model} columns={columns} rows={rows} onOpen={id => navigate({ mode: 'detail', id }, related.object)}
        emptyText={textOf(model, TEXT.relatedEmpty)} caption={`${related.label} (${related.fieldLabel})`} display={display} />
    </section>
  );
}
