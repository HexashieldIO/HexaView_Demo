import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, UserRound } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { usePanelFit } from './usePanelFit';
import { ROLES, ROLE_BY_ID, ROLE_GROUPS, initialsOf, type RoleDef } from '../modules/roles';

/**
 * Role-based view switcher. Picking a role signs in as that customer's person
 * in that role and takes you to the role's home page.
 */
export function RoleMenu() {
  const { customer, persona, setPersona, toast } = useApp();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  // Open towards whichever side has room, so the panel never slides under the sidebar.
  const [alignLeft, setAlignLeft] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePanelFit(panelRef, open);
  const current = ROLE_BY_ID[persona] ?? ROLE_BY_ID.ciso;

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

  const choose = (r: RoleDef) => {
    setPersona(r.id);
    setOpen(false);
    nav(r.landing);
    toast(`Viewing as ${r.person(customer).name} · ${r.label}`);
  };

  return (
    <div className="rm-wrap" ref={ref}>
      <button
        className="tb-ctl"
        onClick={() => {
          const r = ref.current?.getBoundingClientRect();
          const side = document.querySelector('.sidebar')?.getBoundingClientRect();
          const width = Math.min(560, window.innerWidth - 24);
          setAlignLeft(!!r && r.right - width < (side && side.width < window.innerWidth / 2 && getComputedStyle(document.querySelector('.sidebar')!).position !== 'fixed' ? side.right : 0) + 8);
          setOpen((o) => !o);
        }} aria-expanded={open} aria-haspopup="menu" title="Role-based view">
        <UserRound size={14} className="muted" />
        View: {current.label}
        <ChevronDown size={13} style={{ opacity: 0.6, marginLeft: 2 }} />
      </button>
      {open && (
        <div ref={panelRef} className={`rm-panel ${alignLeft ? 'align-left' : ''}`} role="menu">
          <div className="rm-head">
            <b>Role-based view</b>
            <span>Each role opens its own home page and workspace for {customer.short}</span>
          </div>
          <div className="rm-groups">
            {ROLE_GROUPS.map((g) => (
              <div key={g} className={`rm-group ${g === 'Master' ? 'rm-master' : ''}`}>
                <div className="rm-group-label">{g}</div>
                {ROLES.filter((r) => r.group === g).map((r) => {
                  const p = r.person(customer);
                  const on = r.id === current.id;
                  return (
                    <button key={r.id} className={`rm-item ${on ? 'on' : ''}`} onClick={() => choose(r)} role="menuitemradio" aria-checked={on}>
                      <span className="rm-av">{initialsOf(p.name)}</span>
                      <span className="rm-main">
                        <b>{r.label}</b>
                        <span>{r.description}</span>
                        <em>{p.name} · {r.title ?? p.role} · {r.licence} licence</em>
                      </span>
                      {on && <Check size={15} className="rm-check" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
