import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronRight, Lock, Menu, Moon, RefreshCw, Search, Sun, Building2 } from 'lucide-react';
import { MODULES, NAV_GROUPS, SERVICES, moduleForPath, type ModuleDef } from '../modules/registry';
import { CUSTOMER_LIST } from '../data/customers';
import { useApp, rangeLabel, type TimeRange } from '../state/AppContext';
import type { CustomerId } from '../data/types';
import { HexIcon } from './HexIcon';
import { Modal } from './Overlay';
import { ErrorBoundary } from './ErrorBoundary';
import { NotificationBell } from './NotificationBell';
import { RoleMenu } from './RoleMenu';
import { UserProfile } from './UserProfile';
import { DemoMenu } from '../demo/DemoMenu';
import { BrandMark } from './BrandMark';
import { TourOverlay } from '../demo/TourOverlay';
import { ROLE_BY_ID, initialsOf, canAccess } from '../modules/roles';
import { CustomerLogo } from './CustomerLogo';
import { HexOrb } from './HexIcon';
import { tour } from '../demo/tour';
import { reducedMotion } from '../lib/useIntro';
import { APP_VERSION } from '../version';
import { EngineBack } from './EngineBack';

/**
 * Module "wave" intro: switching to a different module (not between its tabs)
 * pops the module's hex logo and name over the page for ~600 ms. Click skips it.
 * Off under reduced motion and during a guided tour.
 */
function ModuleWave() {
  const { pathname } = useLocation();
  const mod = moduleForPath(pathname);
  const prev = useRef<string | null>(null);
  const [wave, setWave] = useState<{ mod: ModuleDef; out: boolean } | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = mod.id;
    if (before === null || before === mod.id) return;
    if (reducedMotion() || tour.get()) { setWave(null); return; }
    setWave({ mod, out: false });
    const t1 = window.setTimeout(() => setWave((w) => (w ? { ...w, out: true } : w)), 600);
    const t2 = window.setTimeout(() => setWave(null), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod.id]);
  if (!wave) return null;
  return (
    <div className={`mwave ${wave.out ? 'out' : ''}`} style={{ '--c': wave.mod.tone } as CSSProperties} onClick={() => setWave(null)} title="Click to skip" aria-hidden>
      <div className="mwave-logo">
        <HexOrb mod={wave.mod} size={86} />
        <b>{wave.mod.product}</b>
        {wave.mod.title !== wave.mod.product && <small>{wave.mod.title}</small>}
      </div>
    </div>
  );
}


function SideItem({ mod, onNavigate }: { mod: ModuleDef; onNavigate: () => void }) {
  const loc = useLocation();
  const { customer, persona, account, toast } = useApp();
  const active = moduleForPath(loc.pathname).id === mod.id;
  const role = ROLE_BY_ID[persona] ?? ROLE_BY_ID.ciso;
  const locked = account === 'customer' && mod.group !== 'partner' && !canAccess(role, mod.id);
  const [open, setOpen] = useState(active && !locked);
  useEffect(() => {
    if (active && !locked) setOpen(true);
  }, [active, locked]);
  const style = { '--tone': mod.tone } as CSSProperties;
  const hasSub = mod.tabs.length > 0 && mod.group !== 'overview';
  const to = mod.tabs.length ? `${mod.basePath}/${mod.tabs[0].id}` : mod.basePath;
  const simple = mod.group === 'overview';
  return (
    <div style={style}>
      <NavLink
        to={to}
        end={mod.basePath === '/'}
        onClick={(e) => {
          if (locked) {
            e.preventDefault();
            toast(`${mod.product} is not included in the ${role.label} role`);
            return;
          }
          if (active && hasSub) {
            e.preventDefault();
            setOpen((o) => !o);
          } else onNavigate();
        }}
        className={`nav-item ${active ? 'active' : ''} ${simple ? 'simple' : ''} ${locked ? 'locked' : ''}`}
        title={locked ? `Locked: outside the ${role.label} role. Switch to Master user (Admin) for full access.` : undefined}
        aria-disabled={locked || undefined}
      >
        <span className="nav-ico">
          <HexIcon mod={mod} size={22} />
        </span>
        <span className="nav-text">
          <b>{simple ? mod.product : mod.product}</b>
          {!simple && <span>{mod.title}</span>}
        </span>
        {locked ? <Lock size={13} className="nav-lock" aria-label="Locked" /> : hasSub && <ChevronRight size={14} className={`nav-caret ${open ? 'open' : ''}`} />}
      </NavLink>
      {hasSub && open && !locked && (
        <div className="nav-sub">
          {mod.tabs.map((t) => {
            const st = t.service ? customer.services[t.service] : undefined;
            return (
              <NavLink key={t.id} to={`${mod.basePath}/${t.id}`} onClick={onNavigate} className={({ isActive }) => (isActive ? 'active' : '')}>
                <i className="dot" />
                {t.label}
                {st && st !== 'active' && <span className={`svc-state ${st}`}>{st === 'trial' ? 'Trial' : 'Add'}</span>}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Workspace({ onNavigate }: { onNavigate: () => void }) {
  const { customer, persona, account } = useApp();
  // Starts collapsed: a fresh sign-in lands on a tidy menu with nothing expanded.
  const [open, setOpen] = useState(false);
  if (account === 'partner') return null;
  const role = ROLE_BY_ID[persona] ?? ROLE_BY_ID.ciso;
  const p = role.person(customer);
  return (
    <div className="nav-group ws-group">
      <div className="nav-group-label">My workspace</div>
      <button className="ws-who" onClick={() => setOpen((o) => !o)} aria-expanded={open} title={open ? 'Collapse workspace' : 'Expand workspace'}>
        <span className="ws-av">{initialsOf(p.name)}</span>
        <span className="ws-meta">
          <b>{role.label}</b>
          <span>{p.name}</span>
        </span>
        <ChevronRight size={14} className={`nav-caret ${open ? 'open' : ''}`} />
      </button>
      {open && (
      <div className="nav-sub ws-links">
        {role.workspace.map(([label, to]) => (
          <NavLink key={to} to={to} end onClick={onNavigate} className={({ isActive }) => (isActive ? 'active' : '')}>
            <i className="dot" />
            {label}
          </NavLink>
        ))}
      </div>
      )}
    </div>
  );
}

function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { customer, setCustomerId, theme, setTheme, account, setAccount } = useApp();
  const [orgOpen, setOrgOpen] = useState(false);
  // Bumped by the logo: remounts the menu so every submenu collapses, as on a fresh load.
  const [resetKey, setResetKey] = useState(0);
  const [pendingReset, setPendingReset] = useState(false);
  const { pathname } = useLocation();
  const navTo = useNavigate();
  useEffect(() => {
    if (pendingReset && pathname === '/') {
      setResetKey((k) => k + 1);
      setPendingReset(false);
    }
  }, [pendingReset, pathname]);
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
      <NavLink
        to="/"
        className="brand"
        aria-label="HexaView home"
        onClick={(e) => {
          setOrgOpen(false);
          setPendingReset(true);
          (e.currentTarget.closest('.sidebar') as HTMLElement | null)?.scrollTo({ top: 0 });
          window.scrollTo({ top: 0 });
          onNavigate();
        }}
      >
        <BrandMark />
      </NavLink>

      <button className="org-switch" onClick={() => setOrgOpen((o) => !o)} aria-expanded={orgOpen}>
        <CustomerLogo c={customer} size={34} className="org-avatar" />
        <span className="org-meta">
          <b>{customer.name}</b>
          <span>
            {customer.sector} · {customer.tier}
          </span>
        </span>
        <ChevronDown size={14} />
      </button>
      {orgOpen && (
        <div style={{ display: 'grid', gap: 4, marginTop: -6, marginBottom: 12 }}>
          <div className="side-label" style={{ padding: '4px 8px' }}>{account === 'partner' ? 'YOUR CLIENTS' : 'DEMO CUSTOMERS'}</div>
          {CUSTOMER_LIST.map((c) => (
            <button
              key={c.id}
              className="org-switch"
              style={{ marginBottom: 0, background: c.id === customer.id ? 'rgba(255,255,255,.08)' : undefined }}
              onClick={() => {
                setCustomerId(c.id as CustomerId);
                setOrgOpen(false);
              }}
            >
              <CustomerLogo c={c} size={34} className="org-avatar" />
              <span className="org-meta">
                <b>{c.name}</b>
                <span>{c.sector}</span>
              </span>
              {c.id === customer.id && <CheckCircle2 size={14} color="#5fd6bb" />}
            </button>
          ))}
        </div>
      )}

      <Workspace key={`ws-${resetKey}`} onNavigate={onNavigate} />

      {NAV_GROUPS.filter((g) => g.id !== 'partner' || account === 'partner').map((g) => (
        <div className="nav-group" key={`${g.id}-${resetKey}`}>
          <div className="nav-group-label">{g.label}</div>
          {MODULES.filter((m) => m.group === g.id).map((m) => (
            <SideItem key={m.id} mod={m} onNavigate={onNavigate} />
          ))}
        </div>
      ))}

      <div className="sidebar-foot">
        <button className="side-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <div className="side-label">ACCOUNT TYPE</div>
        <div className="seg">
          <button className={account === 'customer' ? 'on' : ''} onClick={() => { setAccount('customer'); navTo('/'); }}>Customer</button>
          <button className={account === 'partner' ? 'on' : ''} onClick={() => { setAccount('partner'); navTo('/partner/overview'); }}>Partner / MSSP</button>
        </div>
        <div className="side-note">Demo build · illustrative data</div>
      </div>
    </aside>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const items = useMemo(() => {
    const out: { label: string; sub: string; to: string }[] = [];
    for (const m of MODULES) {
      if (!m.tabs.length) out.push({ label: m.title, sub: m.product, to: m.basePath });
      for (const t of m.tabs) out.push({ label: t.label, sub: `${m.product} · ${m.title}`, to: `${m.basePath}/${t.id}` });
    }
    for (const s of SERVICES) out.push({ label: s.name, sub: 'Managed service', to: s.path });
    const n = q.trim().toLowerCase();
    return n ? out.filter((i) => `${i.label} ${i.sub}`.toLowerCase().includes(n)) : out.slice(0, 14);
  }, [q]);
  return (
    <Modal title="Go to" sub="Modules, services and views" onClose={onClose}>
      <label className="search">
        <Search size={14} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search HexaView…" />
      </label>
      <div className="list" style={{ maxHeight: 380, overflowY: 'auto' }}>
        {items.slice(0, 40).map((i) => (
          <button
            key={i.to + i.label}
            className="list-row"
            style={{ padding: '8px 6px' }}
            onClick={() => {
              nav(i.to);
              onClose();
            }}
          >
            <span className="list-main">
              <b>{i.label}</b>
              <span>{i.sub}</span>
            </span>
            <ChevronRight size={14} className="muted" />
          </button>
        ))}
      </div>
    </Modal>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const loc = useLocation();
  const mod = moduleForPath(loc.pathname);
  const { customer, tenantId, setTenantId, timeRange, setTimeRange, refresh, toast } = useApp();
  const [palette, setPalette] = useState(false);
  const [spin, setSpin] = useState(false);
  const tabLabel = mod.tabs.find((t) => loc.pathname.endsWith(`/${t.id}`))?.label;
  const title = mod.id === 'command' ? 'Cyber Resilience Overview' : `${tabLabel ?? mod.title}${mod.product !== mod.title ? ` — ${mod.product}` : ''}`;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);


  return (
    <header className="topbar">
      <button className="menu-btn" onClick={onMenu} aria-label="Open menu">
        <Menu size={20} />
      </button>
      <h1>{title}</h1>
      <span className="ver-pill" title={`HexaView version ${APP_VERSION}`}>v{APP_VERSION}</span>
      <span className="tb-sp" />
      <EngineBack compact />
      <label className="tb-ctl" title="Tenant scope">
        <Building2 size={14} className="muted" />
        <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} aria-label="Tenant">
          <option value="all">All tenants · group roll-up</option>
          {customer.tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.short}
            </option>
          ))}
        </select>
        <ChevronDown size={13} className="chev" />
      </label>
      <label className="tb-ctl">
        <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)} aria-label="Time range">
          {(['24h', '7d', '30d', '90d'] as TimeRange[]).map((t) => (
            <option key={t} value={t}>
              {rangeLabel(t)}
            </option>
          ))}
        </select>
        <ChevronDown size={13} className="chev" />
      </label>
      <DemoMenu />
      <RoleMenu />
      <button
        className="tb-ctl icon"
        onClick={() => {
          setSpin(true);
          refresh();
          toast('Refreshed from 20+ connected sources');
          setTimeout(() => setSpin(false), 700);
        }}
        aria-label="Refresh"
      >
        <RefreshCw size={15} style={{ transition: 'transform .7s', transform: spin ? 'rotate(360deg)' : 'none' }} />
      </button>
      <button className="tb-ctl icon" onClick={() => setPalette(true)} aria-label="Search (Ctrl+K)" title="Search (Ctrl+K)">
        <Search size={15} />
      </button>
      <NotificationBell />
      <UserProfile />
      {palette && <Palette onClose={() => setPalette(false)} />}
    </header>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { toasts } = useApp();
  const loc = useLocation();
  const contentRef = useRef<HTMLElement>(null);
  const firstRoute = useRef(true);
  useEffect(() => {
    document.querySelector('.main')?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
    // Short crossfade into the new page body (the module header stays put between tabs).
    if (firstRoute.current) { firstRoute.current = false; return; }
    if (reducedMotion()) return;
    contentRef.current?.querySelectorAll<HTMLElement>(':scope > :not(.mod-head)').forEach((el) => {
      el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
    });
  }, [loc.pathname]);

  // Cursor-follow glow on hoverable cards: one delegated listener sets --mx/--my.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('.card-click, button.soc-stat, .rs-tile, .glow-card') as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`);
      el.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => document.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <div className="app">
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      <div className={`sidebar-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <div className="main">
        <Topbar onMenu={() => setOpen(true)} />
        <TourOverlay />
        <ModuleWave />
        <main className="content" ref={contentRef}>
          <ErrorBoundary resetKey={loc.pathname}>{children}</ErrorBoundary>
        </main>
      </div>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <CheckCircle2 size={16} />
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
