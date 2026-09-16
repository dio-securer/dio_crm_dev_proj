import React, { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { changeLocale } from '../i18n';
import { SUPPORTED_LOCALES, type SupportedLocale } from '../i18n/locale-resolver';
import { useGlobalization } from '../market/globalization-context';
import { InstallPrompt } from './InstallPrompt';

export type ShellNavItem = {
  to: string;
  labelKey: string;
  icon: string;
  end?: boolean;
  mobilePrimary?: boolean;
};

type Props = { links: ShellNavItem[]; children: React.ReactNode };

const iconPaths: Record<string, React.ReactNode> = {
  home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6"/></>,
  lead: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  account: <><circle cx="12" cy="8" r="3"/><path d="M5 20c.5-4 3-6 7-6s6.5 2 7 6"/></>,
  activity: <><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11z"/><circle cx="12" cy="10" r="2"/></>,
  report: <><path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6M9 7h3"/></>,
  direct: <><path d="M4 12h12"/><path d="m12 8 4 4-4 4"/><path d="M20 5v14"/></>,
  opportunity: <><path d="M8 12a4 4 0 1 1 8 0c0 2-1.1 3-2 4H10c-.9-1-2-2-2-4z"/><path d="M10 19h4"/></>,
  pipeline: <><path d="M4 5h16l-5 6v5l-6 3v-8z"/></>,
  contract: <><path d="M7 3h10v18H7z"/><path d="M10 8h4M10 12h4M10 16h2"/></>,
  order: <><path d="M5 7h14l-1 12H6z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></>,
  fulfillment: <><path d="M3 7h12v10H3zM15 10h4l2 3v4h-6z"/><circle cx="7" cy="19" r="1.5"/><circle cx="18" cy="19" r="1.5"/></>,
  ledger: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h8"/></>,
  account360: <><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></>,
  analytics: <><path d="M4 20V10h4v10M10 20V5h4v15M16 20v-7h4v7"/></>,
  ops: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/></>
};

function NavIcon({ name }: { name: string }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name] ?? iconPaths.lead}</svg>;
}

function LocaleSelect({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  return (
    <label className={compact ? 'locale-select compact' : 'locale-select'}>
      {!compact && <span>{t('app.language')}</span>}
      <select aria-label={t('app.language')} value={i18n.language} onChange={e => void changeLocale(e.target.value as SupportedLocale)}>
        {SUPPORTED_LOCALES.map(locale => <option key={locale} value={locale}>{t(`locale.${locale}`)}</option>)}
      </select>
    </label>
  );
}

function OnlineState() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  React.useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return <span className={`connectivity ${online ? 'online' : 'offline'}`}><i />{online ? t('app.online') : t('app.offline')}</span>;
}

export function AppShell({ links, children }: Props) {
  const { t } = useTranslation();
  const { globalization } = useGlobalization();
  const location = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);

  const current = useMemo(() => {
    const exact = links.find(x => x.to === location.pathname);
    if (exact) return exact;
    return links.filter(x => x.to !== '/' && location.pathname.startsWith(x.to)).sort((a,b) => b.to.length - a.to.length)[0] ?? links[0];
  }, [links, location.pathname]);

  const configuredMobilePrimary = links.filter(x => x.mobilePrimary).slice(0, 5);
  const mobilePrimary = useMemo(() => {
    const dashboard = links.find(x => x.icon === 'analytics');
    const ordered: Array<ShellNavItem | null> = [
      dashboard ? { ...dashboard, labelKey: 'shellV2.home', icon: 'home' } : null,
      links.find(x => x.icon === 'lead') ?? null,
      links.find(x => x.icon === 'account') ?? null,
      links.find(x => x.icon === 'activity') ?? null
    ];
    const resolved = ordered.filter((item): item is ShellNavItem => item !== null);
    const unique = resolved.filter((item, index) => resolved.findIndex(candidate => candidate.to === item.to) === index);
    return unique.length ? unique : configuredMobilePrimary;
  }, [links]);
  const mobileMore = links.filter(x => !mobilePrimary.some(p => p.to === x.to));
  const accountRoute = location.pathname.startsWith('/accounts');

  const navList = (items: ShellNavItem[], mobile = false) => items.map(item => (
    <NavLink key={`${mobile ? 'm-' : ''}${item.to}`} to={item.to} end={item.end} className={({isActive}) => `shell-nav-link${isActive ? ' active' : ''}${mobile ? ' mobile' : ''}`} onClick={() => setMobileMenu(false)}>
      <NavIcon name={item.icon} />
      <span>{t(item.labelKey)}</span>
    </NavLink>
  ));

  return (
    <div className={`app-shell${accountRoute ? ' account-route' : ''}`}>
      <aside className="sidebar" aria-label={t('app.primaryNavigation')}>
        <div className="brand-block">
          <div className="brand-mark">D</div>
          <div><strong>{t('app.name')}</strong><small>{t('app.workspace')}</small></div>
        </div>
        <div className="sidebar-section-label">{t('app.salesWorkspace')}</div>
        <nav className="sidebar-nav">{navList(links)}</nav>
        <div className="sidebar-footer">
          <div className="market-card">
            <span>{t('app.market')}</span>
            <strong>{globalization.countryCode} · {globalization.currencyCode}</strong>
            <small>{globalization.timezone}</small>
          </div>
          <LocaleSelect />
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-title">
            <span className="eyebrow">{t('app.workspace')}</span>
            <h1>{current ? t(current.labelKey) : t('app.name')}</h1>
          </div>
          <div className="topbar-actions">
            <OnlineState />
            <InstallPrompt />
            <LocaleSelect compact />
            <div className="profile-chip" aria-label={t('app.profile')}><span>SR</span><div><strong>{t('app.salesRep')}</strong><small>{globalization.countryCode}</small></div></div>
          </div>
        </header>

        <main className="route-surface">{children}</main>
        <footer className="app-footer">{t('footer.globalization')}</footer>
      </div>

      <nav className="mobile-bottom-nav" aria-label={t('app.mobileNavigation')}>
        {navList(mobilePrimary, true)}
        <button type="button" className={`mobile-more-button${mobileMenu ? ' active' : ''}`} onClick={() => setMobileMenu(v => !v)} aria-expanded={mobileMenu}>
          <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
          <span>{t('nav.more')}</span>
        </button>
      </nav>

      {mobileMenu && <div className="mobile-drawer-backdrop" onClick={() => setMobileMenu(false)}>
        <section className="mobile-drawer" onClick={e => e.stopPropagation()} aria-label={t('nav.more')}>
          <div className="mobile-drawer-header"><div><strong>{t('app.name')}</strong><small>{globalization.countryCode} · {globalization.currencyCode}</small></div><button type="button" className="icon-button" onClick={() => setMobileMenu(false)} aria-label={t('app.close')}>×</button></div>
          <nav className="mobile-drawer-nav">{navList(mobileMore)}</nav>
          <div className="mobile-drawer-footer"><LocaleSelect /><InstallPrompt /></div>
        </section>
      </div>}
    </div>
  );
}
