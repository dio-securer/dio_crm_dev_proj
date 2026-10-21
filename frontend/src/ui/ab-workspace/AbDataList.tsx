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

const AUTO_MOBILE_SECONDARY_KEYS = new Set([
  'account', 'target', 'owner', 'role', 'activity', 'lastActivity', 'type', 'phone',
  'country', 'amount', 'status', 'close', 'date', 'nextAction'
]);

function mobileRoleFor(column: AbDataColumn): NonNullable<AbDataColumn['mobileRole']> {
  if (column.mobileRole) return column.mobileRole;
  return AUTO_MOBILE_SECONDARY_KEYS.has(column.key) ? 'secondary' : 'hide';
}

function mobileLabel(column: AbDataColumn) {
  return typeof column.label === 'string' ? column.label : column.key;
}

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
          const mobileSecondary = columns
            .map((column, index) => ({ column, index, role: mobileRoleFor(column) }))
            .filter(item => item.role === 'secondary');

          return (
            <button
              type="button"
              key={key}
              role="row"
              className={`ab-data-row${key === selectedKey ? ' selected' : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column, index) => {
                const role = mobileRoleFor(column);
                return (
                  <span
                    key={column.key}
                    role="cell"
                    data-column-key={column.key}
                    data-mobile-role={role}
                    className={`ab-data-cell${column.className ? ` ${column.className}` : ''}`}
                  >
                    {cells[index] ?? null}
                  </span>
                );
              })}
              {mobileSecondary.length > 0 && (
                <span className="ab-data-mobile-meta" aria-hidden="true">
                  {mobileSecondary.map(({ column, index }) => (
                    <span className="ab-data-mobile-meta-item" data-column-key={column.key} key={`mobile-${column.key}`}>
                      <span className="ab-data-mobile-meta-label">{mobileLabel(column)}</span>
                      <span className="ab-data-mobile-meta-value">{cells[index] ?? null}</span>
                    </span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
        {!rows.length && empty}
      </div>
    </div>
  );
}
