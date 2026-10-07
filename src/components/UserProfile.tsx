import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BookOpen, Check, ChevronDown, Keyboard, KeyRound, LifeBuoy, LogOut, MessageSquare, PhoneCall, ShieldCheck, Siren, Sparkles, Ticket, UserCog } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { ROLE_BY_ID, initialsOf } from '../modules/roles';
import { MODULES } from '../modules/registry';
import { signOut } from '../pages/auth/SignIn';
import { usePanelFit } from './usePanelFit';
import { APP_BUILT, APP_VERSION, RELEASE_NOTES } from '../version';

/** Avatar button that opens the signed-in user's role-based profile. */
export function UserProfile() {
  const { customer: c, persona, toast } = useApp();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState<'shortcuts' | 'new' | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePanelFit(panelRef, open);
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
        <div ref={panelRef} className="up-panel" role="dialog" aria-label="Your profile">
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
          <div className="up-section up-help">
            <div className="up-label"><LifeBuoy size={11} /> Help & support</div>
            <div className="up-status"><i /> All HexaView services operational · SOC on shift 24/7</div>
            <button className="up-help-row" onClick={() => go('/comms/support')}>
              <MessageSquare size={14} /><span><b>Chat with HexaShield Support</b><small>Support desk · typical reply under 15 min</small></span>
            </button>
            <button className="up-help-row" onClick={() => { go('/comms/support'); toast('New support ticket started in HexaShield Support'); }}>
              <Ticket size={14} /><span><b>Raise a support ticket</b><small>Track it in Communications Hub</small></span>
            </button>
            <button className="up-help-row" onClick={() => go('/incident-response/escalations')}>
              <Siren size={14} /><span><b>Report a security incident</b><small>Escalate to HexaShield IR (L4)</small></span>
            </button>
            <button className="up-help-row" onClick={() => { setOpen(false); toast('24/7 SOC & incident hotline: +44 20 7946 0999 · quote your tenant ID'); }}>
              <PhoneCall size={14} /><span><b>24/7 SOC & incident hotline</b><small>For P1 incidents, call before raising a ticket</small></span>
            </button>
            <button className="up-help-row" onClick={() => { setOpen(false); toast('Knowledge base: user guides, module walkthroughs and API docs'); }}>
              <BookOpen size={14} /><span><b>Knowledge base & guides</b><small>User guides, module walkthroughs, API docs</small></span>
            </button>
            <button className="up-help-row" aria-expanded={helpOpen === 'shortcuts'} onClick={() => setHelpOpen((h) => (h === 'shortcuts' ? null : 'shortcuts'))}>
              <Keyboard size={14} /><span><b>Keyboard shortcuts</b></span><ChevronDown size={13} className={`up-help-chev ${helpOpen === 'shortcuts' ? 'on' : ''}`} />
            </button>
            {helpOpen === 'shortcuts' && (
              <dl className="up-kbd">
                <dt><kbd>Ctrl</kbd> <kbd>K</kbd></dt><dd>Search and jump anywhere</dd>
                <dt><kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>R</kbd></dt><dd>Reset the demo (presenter)</dd>
                <dt><kbd>Esc</kbd></dt><dd>Close panels and dialogs</dd>
              </dl>
            )}
            <button className="up-help-row" aria-expanded={helpOpen === 'new'} onClick={() => setHelpOpen((h) => (h === 'new' ? null : 'new'))}>
              <Sparkles size={14} /><span><b>What's new in v{APP_VERSION}</b></span><ChevronDown size={13} className={`up-help-chev ${helpOpen === 'new' ? 'on' : ''}`} />
            </button>
            {helpOpen === 'new' && (
              <ul className="up-new">
                {(RELEASE_NOTES.find((r) => r.version === APP_VERSION) ?? RELEASE_NOTES[0]).items.map((i) => <li key={i}>{i}</li>)}
              </ul>
            )}
            <div className="up-ver">HexaView v{APP_VERSION} · built {APP_BUILT}</div>
          </div>
          <div className="up-actions">
            <button onClick={() => go('/ops/admin')}><UserCog size={14} /> {master ? 'Manage users & licences' : 'My access'}</button>
            <button onClick={() => go('/ops/notifications?view=preferences')}><Bell size={14} /> Notification preferences</button>
            <button onClick={() => { setOpen(false); toast('Security keys: 2 FIDO2 keys registered'); }}><KeyRound size={14} /> Security keys</button>
            <button onClick={() => { setOpen(false); signOut(); nav('/signin'); }}><LogOut size={14} /> Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}
