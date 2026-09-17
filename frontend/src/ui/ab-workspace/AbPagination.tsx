import React from 'react';

type Props = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  rowsPerPageLabel: string;
  previousLabel: string;
  nextLabel: string;
  pageStatus: string;
};

export function AbPagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  rowsPerPageLabel,
  previousLabel,
  nextLabel,
  pageStatus
}: Props) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = Math.max(1, Math.min(current - 2, Math.max(1, totalPages - 4)));
  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index);

  return (
    <div className="ab-pagination">
      <label className="ab-page-size">
        <span>{rowsPerPageLabel}</span>
        <select value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))}>
          {pageSizeOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <div className="ab-page-controls">
        <button type="button" onClick={() => onPageChange(current - 1)} disabled={current <= 1} aria-label={previousLabel}>‹</button>
        {pageNumbers.map(number => (
          <button type="button" key={number} className={number === current ? 'active' : ''} onClick={() => onPageChange(number)}>{number}</button>
        ))}
        <button type="button" onClick={() => onPageChange(current + 1)} disabled={current >= totalPages} aria-label={nextLabel}>›</button>
      </div>
      <span className="ab-page-status">{pageStatus}</span>
    </div>
  );
}
