import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronRight, Menu, Moon, RefreshCw, Search, Sun, Building2 } from 'lucide-react';
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
import { ROLE_BY_ID, initialsOf, canAccess } from '../modules/roles';


function SideItem({ mod, onNavigate }: { mod: ModuleDef; onNavigate: () => void }) {
  const loc = useLocation();
  const { customer, persona, account } = useApp();
  const active = moduleForPath(loc.pathname).id === mod.id;
  const role = ROLE_BY_ID[persona] ?? ROLE_BY_ID.ciso;
  const locked = account === 'customer' && mod.group !== 'partner' && !canAccess(role, mod.id);
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
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
          if (active && hasSub) {
            e.preventDefault();
            setOpen((o) => !o);
          } else onNavigate();
        }}
        className={`nav-item ${active ? 'active' : ''} ${simple ? 'simple' : ''} ${locked ? 'locked' : ''}`}
        title={locked ? `Outside the ${role.label} role. Switch to Master user (Admin) for full access.` : undefined}
      >
        <span className="nav-ico">
          <HexIcon mod={mod} size={22} />
        </span>
        <span className="nav-text">
          <b>{simple ? mod.product : mod.product}</b>
          {!simple && <span>{mod.title}</span>}
        </span>
        {hasSub && <ChevronRight size={14} className={`nav-caret ${open ? 'open' : ''}`} />}
      </NavLink>
      {hasSub && open && (
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
  if (account === 'partner') return null;
  const role = ROLE_BY_ID[persona] ?? ROLE_BY_ID.ciso;
  const p = role.person(customer);
  return (
    <div className="nav-group ws-group">
      <div className="nav-group-label">My workspace</div>
      <div className="ws-who">
        <span className="ws-av">{initialsOf(p.name)}</span>
        <span className="ws-meta">
          <b>{role.label}</b>
          <span>{p.name}</span>
        </span>
      </div>
      <div className="nav-sub ws-links">
        {role.workspace.map(([label, to]) => (
          <NavLink key={to} to={to} end onClick={onNavigate} className={({ isActive }) => (isActive ? 'active' : '')}>
            <i className="dot" />
            {label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { customer, setCustomerId, theme, setTheme, account, setAccount } = useApp();
  const [orgOpen, setOrgOpen] = useState(false);
  const navTo = useNavigate();
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
      <NavLink to="/" className="brand" aria-label="HexaView home" onClick={onNavigate}>
        <img src="/brand/HexaView_logo_reverse.png" alt="HexaView" className="brand-logo" />
      </NavLink>

      <button className="org-switch" onClick={() => setOrgOpen((o) => !o)} aria-expanded={orgOpen}>
        <span className="org-avatar" style={{ background: customer.colour }}>{customer.initials}</span>
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
              <span className="org-avatar" style={{ background: c.colour }}>{c.initials}</span>
              <span className="org-meta">
                <b>{c.name}</b>
                <span>{c.sector}</span>
              </span>
              {c.id === customer.id && <CheckCircle2 size={14} color="#5fd6bb" />}
            </button>
          ))}
        </div>
      )}

      <Workspace onNavigate={onNavigate} />

      {NAV_GROUPS.filter((g) => g.id !== 'partner' || account === 'partner').map((g) => (
        <div className="nav-group" key={g.id}>
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
  useEffect(() => {
    document.querySelector('.main')?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <div className="app">
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      <div className={`sidebar-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <div className="main">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="content">
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
