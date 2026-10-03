import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ArrowRight, Settings2 } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { notifications, CATEGORY_META, type NotifCategory, type Notif } from '../data/notifications';
import { isRead, markRead, useNotifRead } from '../state/notificationStore';
import { SEV_COLOR } from './ui';
import { fmtAgo } from '../lib/format';

/** Shared hook: the feed for the current customer, tenant and persona, plus unread count. */
export function useNotifications() {
  const { customer, tenantId, persona } = useApp();
  const v = useNotifRead();
  const all = useMemo(() => notifications(customer, tenantId, persona), [customer, tenantId, persona]);
  const unread = useMemo(() => all.filter((n) => !isRead(n.id)).length, [all, v]); // eslint-disable-line react-hooks/exhaustive-deps
  return { all, unread, v };
}

export function NotifRow({ n, onOpen }: { n: Notif; onOpen: (n: Notif) => void }) {
  const unread = !isRead(n.id);
  const meta = CATEGORY_META[n.cat];
  return (
    <button className={`nt-row ${unread ? 'unread' : ''}`} onClick={() => onOpen(n)}>
      <span className="nt-sev" style={{ background: SEV_COLOR[n.sev] }} />
      <span className="nt-main">
        <span className="nt-cat" style={{ color: meta.color }}>{meta.label}</span>
        <b>{n.title}</b>
        <span className="nt-body">{n.body}</span>
        <span className="nt-foot">
          {fmtAgo(n.minAgo)}
          <span className="nt-action">{n.action} <ArrowRight size={11} /></span>
        </span>
      </span>
      {unread && <i className="nt-dot" aria-label="Unread" />}
    </button>
  );
}

const TABS: ('all' | NotifCategory)[] = ['all', 'approval', 'incident', 'compliance', 'system'];

/** Top-bar bell with an unread badge and a dropdown panel. */
export function NotificationBell() {
  const nav = useNavigate();
  const { all, unread } = useNotifications();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'all' | NotifCategory>('all');
  const ref = useRef<HTMLDivElement>(null);

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

  const list = all.filter((n) => tab === 'all' || n.cat === tab);
  const approvals = all.filter((n) => n.cat === 'approval' && !isRead(n.id)).length;
  const go = (n: Notif) => {
    markRead(n.id);
    setOpen(false);
    nav(n.path);
  };

  return (
    <div className="nt-wrap" ref={ref}>
      <button className="tb-ctl icon" aria-label={`Notifications, ${unread} unread`} aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ position: 'relative' }}>
        <Bell size={15} />
        {unread > 0 && <span className="nt-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="nt-panel" role="dialog" aria-label="Notifications">
          <div className="nt-head">
            <div>
              <b>Notifications</b>
              <span>{unread} unread{approvals ? ` · ${approvals} awaiting your approval` : ''}</span>
            </div>
            <button className="nt-link" onClick={() => markRead(all.map((n) => n.id))} disabled={!unread}>
              <CheckCheck size={13} /> Mark all read
            </button>
          </div>
          {approvals > 0 && (
            <button className="nt-cta" onClick={() => { setOpen(false); nav('/ops/actions'); }}>
              <span><b>{approvals} write-back {approvals === 1 ? 'action needs' : 'actions need'} a decision</b><span>Open the Action Centre to approve or reject</span></span>
              <ArrowRight size={15} />
            </button>
          )}
          <div className="nt-tabs">
            {TABS.map((t) => {
              const n = t === 'all' ? all.filter((x) => !isRead(x.id)).length : all.filter((x) => x.cat === t && !isRead(x.id)).length;
              return (
                <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
                  {t === 'all' ? 'All' : CATEGORY_META[t].label.split(' ')[0]}
                  {n > 0 && <em>{n}</em>}
                </button>
              );
            })}
          </div>
          <div className="nt-list">
            {list.slice(0, 12).map((n) => <NotifRow key={n.id} n={n} onOpen={go} />)}
            {list.length === 0 && <div className="empty">Nothing here.</div>}
          </div>
          <div className="nt-footer">
            <button className="nt-link" onClick={() => { setOpen(false); nav('/ops/notifications'); }}>
              Open Notification Centre <ArrowRight size={12} />
            </button>
            <button className="nt-link" onClick={() => { setOpen(false); nav('/ops/notifications?view=preferences'); }}>
              <Settings2 size={12} /> Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
