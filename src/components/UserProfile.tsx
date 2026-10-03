import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, KeyRound, LogOut, ShieldCheck, UserCog } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { ROLE_BY_ID, initialsOf } from '../modules/roles';
import { MODULES } from '../modules/registry';

/** Avatar button that opens the signed-in user's role-based profile. */
export function UserProfile() {
  const { customer: c, persona, toast } = useApp();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const role = ROLE_BY_ID[persona] ?? ROLE_BY_ID.ciso;
  const p = role.person(c);
  const master = role.id === 'master';

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const modules = MODULES.filter((m) => m.group !== 'partner' && (role.access === 'all' || role.access.includes(m.id)));
  const go = (to: string) => {
    setOpen(false);
    nav(to);
  };

  return (
    <div className="up-wrap" ref={ref}>
      <button className={`avatar ${master ? 'master' : ''}`} title={`${p.name} · ${role.label}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {initialsOf(p.name)}
      </button>
      {open && (
        <div className="up-panel" role="dialog" aria-label="Your profile">
          <div className={`up-head ${master ? 'master' : ''}`}>
            <span className={`up-av ${master ? 'master' : ''}`}>{initialsOf(p.name)}</span>
            <div style={{ minWidth: 0 }}>
              <b>{p.name}</b>
              <span>{role.title ?? p.role}</span>
              <span className="up-email">{p.email}</span>
            </div>
          </div>
          <div className="up-badges">
            <span className={`up-badge ${master ? 'gold' : ''}`}>{role.label}</span>
            <span className="up-badge">{role.licence} licence</span>
            <span className="up-badge">{c.short} · {role.access === 'all' ? 'all tenants' : 'assigned tenants'}</span>
          </div>
          <dl className="up-kv">
            <dt>Sign-in</dt>
            <dd><ShieldCheck size={12} /> {c.byok ? 'SSO (customer IdP) · FIDO2 MFA' : 'HexaView account · MFA enforced'}</dd>
            <dt>Last sign-in</dt>
            <dd>Today, from {c.hq.split(',')[0]}</dd>
            <dt>Session</dt>
            <dd>30 min idle · 12 h absolute</dd>
          </dl>
          <div className="up-section">
            <div className="up-label">What this role can do</div>
            <ul className="up-rights">
              {role.rights.map((r) => (
                <li key={r}><Check size={12} /> {r}</li>
              ))}
            </ul>
          </div>
          <div className="up-section">
            <div className="up-label">Module access {role.access === 'all' ? '· unrestricted' : `· ${modules.length} modules`}</div>
            <div className="up-mods">
              {modules.map((m) => (
                <button key={m.id} className="up-mod" style={{ borderColor: m.tone, color: m.tone }} onClick={() => go(m.tabs.length ? `${m.basePath}/${m.tabs[0].id}` : m.basePath)}>
                  {m.product}
                </button>
              ))}
            </div>
          </div>
          <div className="up-actions">
            <button onClick={() => go('/ops/admin')}><UserCog size={14} /> {master ? 'Manage users & licences' : 'My access'}</button>
            <button onClick={() => go('/ops/notifications?view=preferences')}><Bell size={14} /> Notification preferences</button>
            <button onClick={() => { setOpen(false); toast('Security keys: 2 FIDO2 keys registered'); }}><KeyRound size={14} /> Security keys</button>
            <button onClick={() => { setOpen(false); toast('Signed out (demo): you are still viewing as ' + p.name); }}><LogOut size={14} /> Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}
