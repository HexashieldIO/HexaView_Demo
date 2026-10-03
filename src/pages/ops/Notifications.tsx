import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCheck, Search, MailOpen, Mail } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Chip, Btn, Badge, Callout } from '../../components/ui';
import { useNotifications, NotifRow } from '../../components/NotificationBell';
import { CATEGORY_META, type NotifCategory, type Notif } from '../../data/notifications';
import { isRead, markRead, markUnread } from '../../state/notificationStore';
import { MODULE_BY_ID } from '../../modules/registry';
import type { Severity } from '../../data/types';

const TONE = MODULE_BY_ID.ops.tone;
const CATS = Object.keys(CATEGORY_META) as NotifCategory[];
const CHANNELS = ['In-app', 'Email', 'Microsoft Teams', 'Slack', 'SMS', 'PagerDuty'] as const;
type Channel = (typeof CHANNELS)[number];

const DEFAULT_PREFS: Record<NotifCategory, Channel[]> = {
  approval: ['In-app', 'Email', 'Microsoft Teams'],
  incident: ['In-app', 'Microsoft Teams', 'SMS', 'PagerDuty'],
  compliance: ['In-app', 'Email'],
  intel: ['In-app', 'Email'],
  system: ['In-app', 'Slack'],
  report: ['In-app', 'Email'],
};

export default function OpsNotifications() {
  const { customer: c, toast } = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { all, unread } = useNotifications();
  const view = params.get('view') === 'preferences' ? 'preferences' : 'inbox';
  const cat = (params.get('cat') as NotifCategory | null) ?? null;
  const sev = (params.get('sev') as Severity | null) ?? null;
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [q, setQ] = useState('');
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [digest, setDigest] = useState('Daily at 08:00');
  const [quiet, setQuiet] = useState(true);

  const set = (k: string, v: string | null) => {
    if (v) params.set(k, v);
    else params.delete(k);
    setParams(params, { replace: true });
  };

  const list = all.filter(
    (n) =>
      (!cat || n.cat === cat) &&
      (!sev || n.sev === sev || (sev === 'high' && n.sev === 'critical')) &&
      (!onlyUnread || !isRead(n.id)) &&
      (!q || `${n.title} ${n.body}`.toLowerCase().includes(q.toLowerCase())),
  );
  const today = list.filter((n) => n.minAgo < 1440);
  const earlier = list.filter((n) => n.minAgo >= 1440);
  const approvals = all.filter((n) => n.cat === 'approval');
  const urgent = all.filter((n) => n.sev === 'critical' || n.sev === 'high');
  const open = (n: Notif) => {
    markRead(n.id);
    nav(n.path);
  };
  const byCat = useMemo(() => CATS.map((k) => ({ k, total: all.filter((n) => n.cat === k).length, unread: all.filter((n) => n.cat === k && !isRead(n.id)).length })), [all, unread]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="stack" style={{ gap: 16 }}>
      <p className="page-intro">
        <b>{c.name}</b> · everything that needs you, in one place: write-back approvals from the Action Centre, incidents and alerts, compliance deadlines, intelligence, integration health, reports and renewals. Each notification opens the record behind it.
      </p>

      <KpiStrip
        toneColor={TONE}
        items={[
          { label: 'Unread', value: unread, onClick: () => { setOnlyUnread(true); set('cat', null); set('sev', null); set('view', null); }, source: 'Notification Centre' },
          { label: 'Awaiting approval', value: approvals.length, toneColor: '#f97316', to: '/ops/actions', source: 'Action Centre (gated write-back)' },
          { label: 'Critical & high', value: urgent.length, toneColor: 'var(--sev-high)', onClick: () => { set('sev', 'high'); set('view', null); }, source: 'Attention queue · connector health' },
          { label: 'Integration health', value: all.filter((n) => n.cat === 'system').length, onClick: () => { set('cat', 'system'); set('view', null); }, source: 'Connector & data-plane health' },
          { label: 'Delivery channels', value: new Set(Object.values(prefs).flat()).size, onClick: () => set('view', 'preferences'), source: 'Notification preferences' },
        ]}
      />

      <div className="row wrap" style={{ gap: 6 }}>
        <Chip on={view === 'inbox'} onClick={() => set('view', null)} color={TONE}>Inbox</Chip>
        <Chip on={view === 'preferences'} onClick={() => set('view', 'preferences')} color={TONE}>Delivery preferences</Chip>
      </div>

      {view === 'inbox' ? (
        <div className="grid g-1-2" style={{ gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)' }}>
          <Card title="Categories">
            <div className="list">
              <button className="list-row" onClick={() => set('cat', null)} style={{ fontWeight: !cat ? 700 : 400 }}>
                <span className="list-main"><b>All notifications</b></span>
                <Badge color={TONE}>{all.length}</Badge>
              </button>
              {byCat.filter((x) => x.total).map((x) => (
                <button key={x.k} className="list-row" onClick={() => set('cat', cat === x.k ? null : x.k)}>
                  <span className="dot" style={{ background: CATEGORY_META[x.k].color }} />
                  <span className="list-main"><b style={{ color: cat === x.k ? CATEGORY_META[x.k].color : undefined }}>{CATEGORY_META[x.k].label}</b><span>{x.unread} unread</span></span>
                  <Badge color={CATEGORY_META[x.k].color}>{x.total}</Badge>
                </button>
              ))}
            </div>
          </Card>

          <Card
            title={cat ? CATEGORY_META[cat].label : 'All notifications'}
            count={list.length}
            sub={sev ? 'Critical and high only' : 'Newest and most urgent first'}
            actions={
              <div className="row wrap" style={{ gap: 6 }}>
                <label className="search" style={{ width: 200 }}>
                  <Search size={13} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notifications…" aria-label="Search notifications" />
                </label>
                <Chip on={onlyUnread} onClick={() => setOnlyUnread((v) => !v)} color={TONE}>Unread only</Chip>
                {sev && <Chip on onClick={() => set('sev', null)} color="var(--sev-high)">Critical & high ×</Chip>}
                <Btn sm onClick={() => { markRead(list.map((n) => n.id)); toast(`Marked ${list.length} as read`); }}>
                  <CheckCheck size={13} /> Mark shown as read
                </Btn>
              </div>
            }
            flush
          >
            {[['Today', today], ['Earlier', earlier]].map(([label, items]) =>
              (items as Notif[]).length ? (
                <div key={label as string}>
                  <div className="section-label" style={{ padding: '10px 16px 4px' }}>{label as string}</div>
                  {(items as Notif[]).map((n) => (
                    <div key={n.id} className="row" style={{ alignItems: 'stretch', gap: 0 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <NotifRow n={n} onOpen={open} />
                      </div>
                      <button
                        className="btn ghost sm"
                        title={isRead(n.id) ? 'Mark as unread' : 'Mark as read'}
                        onClick={() => (isRead(n.id) ? markUnread(n.id) : markRead(n.id))}
                        style={{ height: 'auto', borderRadius: 0, borderBottom: '1px solid var(--hairline-soft)' }}
                      >
                        {isRead(n.id) ? <Mail size={14} /> : <MailOpen size={14} />}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null,
            )}
            {list.length === 0 && <div className="empty">No notifications match these filters.</div>}
          </Card>
        </div>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Where each kind of notification goes" sub="Per category and channel · changes apply to you only; Tenant Admins set org-wide minimums">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Category</th>
                    {CHANNELS.map((ch) => <th key={ch} className="r" style={{ textAlign: 'center' }}>{ch}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {CATS.map((k) => (
                    <tr key={k}>
                      <td><span className="row" style={{ gap: 8 }}><span className="dot" style={{ background: CATEGORY_META[k].color }} /><b style={{ fontWeight: 600 }}>{CATEGORY_META[k].label}</b></span></td>
                      {CHANNELS.map((ch) => {
                        const on = prefs[k].includes(ch);
                        const locked = ch === 'In-app' || (k === 'approval' && ch === 'Email');
                        return (
                          <td key={ch} style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={locked}
                              title={locked ? 'Required by your organisation' : undefined}
                              onChange={() => setPrefs((p) => ({ ...p, [k]: on ? p[k].filter((x) => x !== ch) : [...p[k], ch] }))}
                              aria-label={`${CATEGORY_META[k].label} via ${ch}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid g3">
            <Card title="Escalation">
              <div className="stack" style={{ gap: 8, fontSize: 12.5 }}>
                <span>Critical incidents not acknowledged in <b>15 min</b> page the on-call lead ({c.people.socLead.name}) via PagerDuty.</span>
                <span>High-risk approvals expiring within <b>1 h</b> notify every Tenant Admin.</span>
                <span>OT alerts always go to {c.people.otLead?.name ?? c.people.admin.name}; OT is never actioned automatically.</span>
              </div>
            </Card>
            <Card title="Digest">
              <div className="stack" style={{ gap: 8 }}>
                <select className="select" value={digest} onChange={(e) => setDigest(e.target.value)} aria-label="Digest frequency">
                  {['Off', 'Daily at 08:00', 'Twice daily', 'Weekly on Monday'].map((x) => <option key={x}>{x}</option>)}
                </select>
                <span className="muted" style={{ fontSize: 12 }}>Low and informational items are bundled into the digest instead of arriving one by one.</span>
              </div>
            </Card>
            <Card title="Quiet hours">
              <label className="row" style={{ gap: 8, fontSize: 12.5 }}>
                <input type="checkbox" checked={quiet} onChange={() => setQuiet((v) => !v)} />
                22:00–07:00 in your time zone
              </label>
              <span className="muted" style={{ fontSize: 12, marginTop: 8 }}>Critical incidents and expiring high-risk approvals still break through.</span>
            </Card>
          </div>
          <Callout kind="info" color={TONE}>
            Every notification and every delivery is written to the audit ledger, so you can show a regulator who was told what, and when.
          </Callout>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Btn primary color={TONE} onClick={() => toast('Notification preferences saved')}>Save preferences</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
