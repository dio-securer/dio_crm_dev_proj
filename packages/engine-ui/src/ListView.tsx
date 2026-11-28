// The generic list (F2-5): one list view of the object as a table. Columns, labels and code labels come from the model.
import type { EngineUiModel, ListPage, Navigate, RecordData, UiField } from './types';
import { columnsOf, viewOf } from './layout';
import { DisplayOptions, TEXT, displayValue, textOf } from './text';

export interface RecordTableProps {
  model: EngineUiModel; columns: UiField[]; rows: RecordData[]; onOpen: (id: string) => void; emptyText: string; caption: string; display?: DisplayOptions;
}
/** Rows as a table. The first column opens the record; an empty first cell still shows the id so the row can be opened. */
export function RecordTable({ model, columns, rows, onOpen, emptyText, caption, display }: RecordTableProps) {
  if (rows.length === 0) return <p className="engine-empty">{emptyText}</p>;
  return (
    <div className="engine-table-wrap">
      <table className="engine-table">
        <caption className="engine-sr">{caption}</caption>
        <thead><tr>{columns.map(c => <th key={c.key} scope="col" data-field={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} data-record-id={row.id}>
              {columns.map((c, i) => {
                const text = displayValue(model, c, row.values[c.key], display);
                return <td key={c.key} data-field={c.key}>{i === 0 ? <button type="button" className="engine-link" onClick={() => onOpen(row.id)}>{text || `#${row.id}`}</button> : text}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface ListViewProps { model: EngineUiModel; viewKey?: string; page: ListPage; navigate: Navigate; display?: DisplayOptions }
export function ListView({ model, viewKey, page, navigate, display }: ListViewProps) {
  const view = viewOf(model, viewKey);
  const columns = columnsOf(model, view);
  const pageNumber = Math.floor(page.offset / Math.max(1, page.limit)) + 1;
  const go = (offset: number) => navigate({ mode: 'list', view: view?.key, offset });
  return (
    <section className="engine-page" data-engine="list" data-object={model.object.key}>
      <header className="engine-header">
        <h1>{model.object.pluralLabel}</h1>
        <div className="engine-actions">
          {model.listViews.length > 1 && (
            <label className="engine-inline">
              <span>{textOf(model, TEXT.view)}</span>
              <select value={view?.key ?? ''} onChange={e => navigate({ mode: 'list', view: e.target.value })}>
                {model.listViews.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
              </select>
            </label>
          )}
          {model.access.create && <button type="button" className="engine-button engine-primary" onClick={() => navigate({ mode: 'create' })}>{textOf(model, TEXT.create)}</button>}
        </div>
      </header>
      <RecordTable model={model} columns={columns} rows={page.items} onOpen={id => navigate({ mode: 'detail', id })}
        emptyText={textOf(model, TEXT.empty)} caption={view?.label ?? model.object.pluralLabel} display={display} />
      <footer className="engine-pager">
        <button type="button" className="engine-button" disabled={page.offset <= 0} onClick={() => go(Math.max(0, page.offset - page.limit))}>{textOf(model, TEXT.prev)}</button>
        <span>{textOf(model, TEXT.page)} {pageNumber}</span>
        <button type="button" className="engine-button" disabled={page.items.length < page.limit} onClick={() => go(page.offset + page.limit)}>{textOf(model, TEXT.next)}</button>
      </footer>
    </section>
  );
}
