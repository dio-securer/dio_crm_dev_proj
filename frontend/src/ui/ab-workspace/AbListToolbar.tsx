import React from 'react';

type Props = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filters?: React.ReactNode;
  onReset?: () => void;
  resetLabel?: string;
  resultSummary?: React.ReactNode;
};

export function AbListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  onReset,
  resetLabel,
  resultSummary
}: Props) {
  return (
    <div className="ab-list-toolbar">
      <label className="ab-list-search">
        <span aria-hidden="true">⌕</span>
        <input value={searchValue} onChange={event => onSearchChange(event.target.value)} placeholder={searchPlaceholder} />
      </label>
      {filters && <div className="ab-list-filters">{filters}</div>}
      {onReset && resetLabel && <button type="button" className="ab-toolbar-reset" onClick={onReset}>{resetLabel}</button>}
      {resultSummary && <div className="ab-toolbar-summary">{resultSummary}</div>}
    </div>
  );
}
