import React from 'react';

export type AbDataColumn = {
  key: string;
  label: React.ReactNode;
  width?: string;
  mobileRole?: 'primary' | 'badge' | 'secondary' | 'hide';
  className?: string;
};

type Props<T> = {
  columns: AbDataColumn[];
  rows: T[];
  rowKey: (row: T) => string;
  selectedKey?: string;
  onRowClick?: (row: T) => void;
  renderCells: (row: T) => React.ReactNode[];
  empty?: React.ReactNode;
  ariaLabel?: string;
  bodyRef?: React.Ref<HTMLDivElement>;
  onBodyScroll?: React.UIEventHandler<HTMLDivElement>;
};

export function AbDataList<T>({
  columns,
  rows,
  rowKey,
  selectedKey,
  onRowClick,
  renderCells,
  empty,
  ariaLabel,
  bodyRef,
  onBodyScroll
}: Props<T>) {
  const template = columns.map(column => column.width ?? 'minmax(0,1fr)').join(' ');
  const style = { '--ab-data-columns': template } as React.CSSProperties;

  return (
    <div className="ab-data-list" role="table" aria-label={ariaLabel} style={style}>
      <div className="ab-data-header" role="row">
        {columns.map(column => (
          <span key={column.key} role="columnheader" className={column.className}>{column.label}</span>
        ))}
      </div>
      <div className="ab-data-body" role="rowgroup" ref={bodyRef} onScroll={onBodyScroll}>
        {rows.map(row => {
          const key = rowKey(row);
          const cells = renderCells(row);
          return (
            <button
              type="button"
              key={key}
              role="row"
              className={`ab-data-row${key === selectedKey ? ' selected' : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column, index) => (
                <span
                  key={column.key}
                  role="cell"
                  data-mobile-role={column.mobileRole ?? 'hide'}
                  className={`ab-data-cell${column.className ? ` ${column.className}` : ''}`}
                >
                  {cells[index] ?? null}
                </span>
              ))}
            </button>
          );
        })}
        {!rows.length && empty}
      </div>
    </div>
  );
}
