import React from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../UiIcon';

type Props = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filters?: React.ReactNode;
  onReset?: () => void;
  resetLabel?: string;
  resultSummary?: React.ReactNode;
};

type SelectProps = {
  value?: string | number;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  children?: React.ReactNode;
};

type FilterChip = {
  key: string;
  label: React.ReactNode;
  onRemove?: () => void;
};

function flattenControls(node: React.ReactNode): React.ReactElement[] {
  const result: React.ReactElement[] = [];
  React.Children.forEach(node, child => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      flattenControls((child.props as { children?: React.ReactNode }).children).forEach(item => result.push(item));
      return;
    }
    result.push(child);
  });
  return result;
}

function optionValue(option: React.ReactElement) {
  return String((option.props as { value?: string | number }).value ?? '');
}

function extractActiveChips(controls: React.ReactElement[]): FilterChip[] {
  return controls.flatMap((control, index) => {
    if (control.type !== 'select') return [];
    const props = control.props as SelectProps;
    const options = React.Children.toArray(props.children).filter(React.isValidElement) as React.ReactElement[];
    if (!options.length) return [];
    const value = String(props.value ?? '');
    const defaultValue = optionValue(options[0]);
    if (!value || value === defaultValue) return [];
    const selected = options.find(option => optionValue(option) === value);
    const label = selected ? (selected.props as { children?: React.ReactNode }).children : value;
    return [{
      key: `${index}-${value}`,
      label,
      onRemove: props.onChange ? () => props.onChange?.({
        target: { value: defaultValue },
        currentTarget: { value: defaultValue }
      } as unknown as React.ChangeEvent<HTMLSelectElement>) : undefined
    }];
  });
}

export function AbListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  onReset,
  resetLabel,
  resultSummary
}: Props) {
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const controls = React.useMemo(() => flattenControls(filters), [filters]);
  const activeChips = React.useMemo(() => extractActiveChips(controls), [controls]);
  const primaryControls = controls.slice(0, 3);
  const hasMoreFilters = controls.length > 3;
  const filterLabel = t('designSystem.filters');
  const applyLabel = t('designSystem.apply');

  React.useEffect(() => {
    if (!filtersOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFiltersOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [filtersOpen]);

  return (
    <div className={`ab-list-toolbar ds-v2-toolbar${filtersOpen ? ' filters-open' : ''}`}>
      <div className="ab-list-toolbar-main">
        <label className="ab-list-search">
          <span aria-hidden="true"><UiIcon name="search" size="var(--icon-md)" /></span>
          <input value={searchValue} onChange={event => onSearchChange(event.target.value)} placeholder={searchPlaceholder} />
        </label>

        {filters && primaryControls.length > 0 && <div className="ab-list-filters ab-list-filters-primary">{primaryControls}</div>}

        {filters && <button
          type="button"
          className="ab-toolbar-filter-button"
          onClick={() => setFiltersOpen(open => !open)}
          aria-expanded={filtersOpen}
        >
          <UiIcon name="filter" size="var(--icon-md)" />
          <span>{filterLabel}</span>
          {activeChips.length > 0 && <em>{activeChips.length}</em>}
        </button>}

        {onReset && resetLabel && <button type="button" className="ab-toolbar-reset" onClick={onReset}>{resetLabel}</button>}
        {resultSummary && <div className="ab-toolbar-summary">{resultSummary}</div>}
      </div>

      {activeChips.length > 0 && <div className="ab-active-filter-row" aria-label={t('designSystem.activeFilters')}>
        {activeChips.map(chip => <button key={chip.key} type="button" className="ab-active-filter-chip" onClick={chip.onRemove} disabled={!chip.onRemove}>
          <span>{chip.label}</span><b aria-hidden="true">×</b>
        </button>)}
      </div>}

      {filtersOpen && filters && <>
        <button type="button" className="ab-filter-backdrop" aria-label={t('app.close')} onClick={() => setFiltersOpen(false)} />
        <section className={`ab-filter-surface${hasMoreFilters ? ' has-more' : ''}`} aria-label={filterLabel}>
          <header className="ab-filter-surface-head">
            <div><UiIcon name="filter" size="20" /><strong>{filterLabel}</strong>{activeChips.length > 0 && <span>{activeChips.length}</span>}</div>
            <button type="button" className="ab-filter-close" onClick={() => setFiltersOpen(false)} aria-label={t('app.close')}>×</button>
          </header>
          <div className="ab-filter-surface-controls">{controls}</div>
          <footer className="ab-filter-surface-footer">
            {onReset && resetLabel && <button type="button" className="ab-filter-reset" onClick={onReset}>{resetLabel}</button>}
            <button type="button" className="ab-filter-apply" onClick={() => setFiltersOpen(false)}>{applyLabel}</button>
          </footer>
        </section>
      </>}
    </div>
  );
}
