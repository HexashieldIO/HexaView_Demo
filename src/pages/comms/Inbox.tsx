import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, Video, Pin, Search, Lock, ShieldCheck, Globe2, Hexagon, UserPlus, Archive, Scale, FileText } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { KpiStrip, Chip, Btn } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { tenantName } from '../../data/customers';
import { conversations, localTime, firstName, PARTY_LABEL, RECORD_META, type Conversation, type Party, type CommsPerson, type RecordRef } from '../../data/modules/comms';
import { useComms, useLocalChat, Avatar, PresenceDot, LicenceBadge, PartyTag, MessageList, Composer, SecureNote, RecordCard, FileChip, SectionHead, stamp, COMMS_TONE } from './parts';

type Filter = 'all' | 'unread' | Party;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'hexashield', label: 'HexaShield' },
  { id: 'colleague', label: 'Colleagues' },
  { id: 'external', label: 'External' },
];

const NEW_REPLIES: Record<Party, string[]> = {
  hexashield: ['Thanks {me}, picking this up now.', 'Logged against your account; expect an update within the hour.', 'I have looped in the right engineer. Nothing will change in your tenant without your approval.'],
  external: ['Thanks, received. I will come back to you shortly.', 'Understood. I will check with my team and reply today.', 'Noted, thank you.'],
  colleague: ['Thanks, looking now.', 'On it; give me 10 minutes.', 'Good shout. I will update the record in HexaView.'],
};

export default function Inbox() {
  const { customer, tenantId, persona } = useApp();
  return <InboxInner key={`${customer.id}-${tenantId}-${persona}`} />;
}

function InboxInner() {
  const { tenantId, toast } = useApp();
  const nav = useNavigate();
  const { c, me, people, byId, mid, recList, anchorMin } = useComms();
  const [sp, setSp] = useSearchParams();
  const base = useMemo(() => conversations(c, tenantId, me, people), [c, tenantId, me, people]);
  const [created, setCreated] = useState<Conversation[]>([]);
  const all = useMemo(() => [...created, ...base], [created, base]);
  const pf = sp.get('filter');
  const [filter, setFilter] = useState<Filter>(FILTERS.some((x) => x.id === pf) ? (pf as Filter) : 'all');
  const [q, setQ] = useState('');
  const [read, setRead] = useState<Set<string>>(new Set());
  const [pinned, setPinned] = useState<Record<string, boolean>>({});
  const [selId, setSelId] = useState<string>(() => sp.get('c') && base.some((x) => x.id === sp.get('c')) ? (sp.get('c') as string) : base[0]?.id ?? '');
  const [recDrawer, setRecDrawer] = useState(false);
  const chat = useLocalChat(mid);

  // Deep link: /comms/inbox?with=<personId> opens (or starts) a DM with that person.
  const withId = sp.get('with');
  useEffect(() => {
    if (!withId) return;
    const p = byId.get(withId);
    if (!p || p.id === mid) return;
    const existing = all.find((x) => x.kind !== 'group' && x.members.length === 2 && x.members.includes(withId));
    if (existing) {
      setSelId(existing.id);
    } else {
      const conv: Conversation = {
        id: `new-${withId}`, kind: 'dm', title: p.name, members: [mid, withId], category: p.party, unread: 0, topic: 'New conversation', messages: [],
        replies: NEW_REPLIES[p.party].map((t) => t.replace('{me}', firstName(me.name))),
      };
      setCreated((cs) => (cs.some((x) => x.id === conv.id) ? cs : [conv, ...cs]));
      setSelId(conv.id);
    }
    setFilter('all');
    const n = new URLSearchParams(sp);
    n.delete('with');
    setSp(n, { replace: true });
  }, [withId]); // eslint-disable-line react-hooks/exhaustive-deps

  const msgsOf = (cv: Conversation) => [...cv.messages, ...(chat.added[cv.id] ?? [])];
  const unreadOf = (cv: Conversation) => (read.has(cv.id) || cv.id === selId ? 0 : cv.unread);
  const isPinned = (cv: Conversation) => pinned[cv.id] ?? !!cv.pinned;
  const lastOf = (cv: Conversation) => {
    const ms = msgsOf(cv);
    return ms.reduce((a, b) => (b.minAgo <= a.minAgo ? b : a), ms[0] ?? { minAgo: cv.id.startsWith('new-') ? -1 : 99999, text: cv.topic, from: '', id: '' });
  };

  const counts: Record<Filter, number> = {
    all: all.length,
    unread: all.filter((x) => unreadOf(x) > 0).length,
    hexashield: all.filter((x) => x.category === 'hexashield').length,
    colleague: all.filter((x) => x.category === 'colleague').length,
    external: all.filter((x) => x.category === 'external').length,
  };
  const shown = all
    .filter((x) => filter === 'all' || (filter === 'unread' ? unreadOf(x) > 0 : x.category === filter))
    .filter((x) => !q || `${x.title} ${x.topic} ${x.members.map((m) => byId.get(m)?.name).join(' ')} ${msgsOf(x).map((m) => m.text).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(isPinned(b)) - Number(isPinned(a)) || lastOf(a).minAgo - lastOf(b).minAgo);

  const sel = all.find((x) => x.id === selId) ?? shown[0];
  const select = (id: string) => {
    setSelId(id);
    setRead((r) => new Set(r).add(id));
  };

  const others = sel ? sel.members.filter((m) => m !== mid).map((m) => byId.get(m)).filter((p): p is CommsPerson => !!p) : [];
  const ext = others.filter((p) => p.party === 'external');
  const hx = others.filter((p) => p.party === 'hexashield');
  const selMsgs = sel ? msgsOf(sel) : [];
  const sharedRecs = selMsgs.filter((m) => m.card).map((m) => m.card as RecordRef);
  const files = selMsgs.filter((m) => m.file).map((m) => m.file!);
  const responders = others.filter((p) => !p.bot);
  const sendCount = sel ? (chat.added[sel.id] ?? []).filter((m) => m.from === mid).length : 0;

  const totalUnread = all.reduce((s, x) => s + unreadOf(x), 0);
  const allShared = all.flatMap((cv) => msgsOf(cv).filter((m) => m.card).map((m) => ({ cv, r: m.card as RecordRef })));
  const approvals = allShared.filter((x) => x.r.kind === 'approval');
  const guests = people.filter((p) => p.party === 'external');
  const scope = tenantId === 'all' ? `${c.short} group` : tenantName(c, tenantId);

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · secure messaging for {scope}: direct lines to HexaShield (support desk, your CSM and HexaSOC), licensed colleagues and invited external guests such as {c.insurance.broker}. Signed in as <b>{me.name}</b> ({me.role}). HexaView records shared here open in place.
      </p>

      <KpiStrip toneColor={COMMS_TONE} items={[
        { label: 'Unread', value: totalUnread, unit: `in ${counts.unread} threads`, onClick: () => setFilter('unread'), source: 'Communications Hub message store', toneColor: totalUnread ? COMMS_TONE : undefined },
        { label: 'Conversations', value: all.length, unit: 'DMs & groups', onClick: () => setFilter('all'), source: 'Communications Hub message store' },
        { label: 'With HexaShield', value: counts.hexashield, unit: 'threads', onClick: () => setFilter('hexashield'), source: 'HexaShield Support Desk · HexaSOC · Customer Success' },
        { label: 'External guests', value: guests.length, unit: `${guests.filter((p) => p.presence !== 'offline').length} active`, to: '/comms/directory?party=external', source: 'Guest licences · HexaView Administration' },
        { label: 'Records shared', value: allShared.length, unit: 'in threads', onClick: () => setRecDrawer(true), source: 'HexaCore canonical records (incidents, approvals, loops, reports)' },
        { label: 'Approvals in chat', value: approvals.length, unit: 'awaiting', to: approvals[0]?.r.path ?? '/ops/actions', source: 'Action Centre · gated write-back' },
      ]} />

      <div className="cm-shell">
        {/* ---------- conversation list ---------- */}
        <div className="cm-pane cm-side">
          <label className="search">
            <Search size={14} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people, threads, messages" />
          </label>
          <div className="cm-filters">
            {FILTERS.map((x) => (
              <Chip key={x.id} on={filter === x.id} onClick={() => setFilter(x.id)} color={COMMS_TONE}>
                {x.label} <span className="muted">{counts[x.id]}</span>
              </Chip>
            ))}
          </div>
          <div className="cm-scroll">
            {shown.map((cv) => {
              const os = cv.members.filter((m) => m !== mid).map((m) => byId.get(m)).filter((p): p is CommsPerson => !!p);
              const last = lastOf(cv);
              const un = unreadOf(cv);
              const lp = byId.get(last.from);
              return (
                <button key={cv.id} className={`cm-conv ${sel?.id === cv.id ? 'on' : ''} ${un ? 'unread' : ''}`} onClick={() => select(cv.id)}>
                  {os.length > 1 ? (
                    <span className="cm-group-av"><Avatar p={os[0]} size={24} presence={false} /><Avatar p={os[1]} size={24} presence={false} /></span>
                  ) : (
                    <Avatar p={os[0]} size={34} />
                  )}
                  <span className="cm-conv-main">
                    <span className="cm-conv-top">
                      {isPinned(cv) && <Pin size={11} className="muted" />}
                      <b>{cv.title}</b>
                      <span className="cm-conv-time">{last.id ? stamp(last.minAgo) : ''}</span>
                    </span>
                    <span className="cm-conv-prev" style={{ display: 'block' }}>
                      {last.id ? `${last.from === mid ? 'You' : lp ? firstName(lp.name) : ''}: ${last.text}` : cv.topic}
                    </span>
                    <span className="cm-conv-meta">
                      {cv.category === 'hexashield' && <span className="cm-tag hx"><Hexagon size={10} /> HexaShield</span>}
                      {cv.category === 'external' && <span className="cm-tag ext"><Globe2 size={10} /> {os.find((p) => p.party === 'external')?.org ?? 'External'}</span>}
                      {cv.kind === 'group' && <span className="cm-tag appt">{cv.members.length} people</span>}
                      {cv.tenantId && <span className="cm-tag appt">{c.tenants.find((t) => t.id === cv.tenantId)?.short}</span>}
                      <span className="spacer" />
                      {un > 0 && <span className="cm-unread">{un}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
            {shown.length === 0 && <div className="empty">No conversations match.</div>}
          </div>
          <div style={{ padding: 10, borderTop: '1px solid var(--hairline)' }}>
            <Btn sm onClick={() => nav('/comms/directory')}><UserPlus /> New message</Btn>
          </div>
        </div>

        {/* ---------- open conversation ---------- */}
        <div className="cm-pane cm-main">
          {sel ? (
            <>
              <div className="cm-pane-head">
                {others.length > 1 ? <span className="cm-group-av"><Avatar p={others[0]} size={24} presence={false} /><Avatar p={others[1]} size={24} presence={false} /></span> : <Avatar p={others[0]} size={36} />}
                <div className="cm-head-title">
                  <h3>{sel.title} {others.length === 1 && <PartyTag p={others[0]} />}</h3>
                  <div className="sub">
                    {others.length === 1
                      ? <>{others[0].role} · {others[0].org} · <PresenceDot p={others[0].presence} /> {others[0].presence} · {localTime(others[0].tzOffset)} {others[0].tz}</>
                      : <>{sel.members.length} people · {others.map((p) => firstName(p.name)).join(', ')} · {sel.topic}</>}
                  </div>
                </div>
                <div className="cm-head-actions">
                  <span className="cm-e2e"><Lock size={11} /> E2EE</span>
                  <button className="cm-icon-btn" title={isPinned(sel) ? 'Unpin' : 'Pin'} onClick={() => setPinned((p) => ({ ...p, [sel.id]: !isPinned(sel) }))}><Pin style={{ color: isPinned(sel) ? COMMS_TONE : undefined }} /></button>
                  <button className="cm-icon-btn" title="Start an encrypted voice call" onClick={() => toast(`Calling ${sel.title} · end-to-end encrypted · call metadata written to the audit ledger`)}><Phone /></button>
                  <button className="cm-icon-btn" title="Start an encrypted video call" onClick={() => toast(`Video call started with ${sel.title} · recording off · AI summary on request`)}><Video /></button>
                </div>
              </div>
              {ext.length > 0 && (
                <div className="cm-banner"><Globe2 /> Includes external guests from {[...new Set(ext.map((p) => p.org))].join(', ')}. They see only this conversation and records shared in it; guest access expires in {Math.min(...ext.map((p) => p.guestExpiryDays ?? 30))} days.</div>
              )}
              {hx.length > 0 && (
                <div className="cm-banner hx"><ShieldCheck /> HexaShield staff have no standing access to your data. Any support session needs Tenant Admin approval in <button className="link" onClick={() => nav('/ops/admin')}>Administration</button>.</div>
              )}
              <MessageList messages={selMsgs} byId={byId} people={people} mid={mid} typing={chat.typing[sel.id]} />
              <Composer
                placeholder={`Message ${sel.kind === 'group' ? sel.title : firstName(sel.title)}…  (@ to mention, share a record)`}
                members={others}
                records={recList}
                external={ext.length > 0}
                onSend={(o) => chat.send(sel.id, o, responders.length ? responders[sendCount % responders.length].id : undefined, sel.replies)}
              />
              <SecureNote anchorMin={anchorMin} retention={sel.category === 'external' ? '1 year after guest expiry' : '7 years'} hold={sel.title.toLowerCase().includes('leak') || sel.title.toLowerCase().includes('major')} />
            </>
          ) : (
            <div className="empty">Select a conversation.</div>
          )}
        </div>

        {/* ---------- context panel ---------- */}
        {sel && (
          <div className="cm-pane cm-ctx">
            <div className="cm-scroll">
              <SectionHead right={<span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>{sel.members.length}</span>}>Participants</SectionHead>
              {sel.members.map((id) => byId.get(id)).filter((p): p is CommsPerson => !!p).map((p) => (
                <div key={p.id} className="cm-person">
                  <Avatar p={p} size={30} />
                  <div className="cm-person-main">
                    <b>{p.name}{p.id === mid ? ' (you)' : ''}</b>
                    <span>{p.role} · {p.org === c.name ? `${localTime(p.tzOffset)} ${p.tz}` : p.org}</span>
                  </div>
                  <LicenceBadge l={p.licence} />
                </div>
              ))}
              <SectionHead>Shared HexaView records</SectionHead>
              {sharedRecs.length ? sharedRecs.map((r, i) => <RecordCard key={i} r={r} compact />) : <div className="muted" style={{ fontSize: 11.5, margin: '0 14px' }}>None yet. Use “Share record” in the composer.</div>}
              <SectionHead>Files</SectionHead>
              {files.length ? files.map((f, i) => <FileChip key={i} f={f} />) : <div className="muted" style={{ fontSize: 11.5, margin: '0 14px' }}>No files shared.</div>}
              <SectionHead>Security & retention</SectionHead>
              <div className="cm-sec-list">
                <div><Lock /> <span>End-to-end encrypted with per-tenant keys{c.byok ? ' (customer-managed, BYOK)' : ''}; HexaShield cannot read message content.</span></div>
                <div><Archive /> <span>Retention: {sel.category === 'external' ? '1 year after guest access expires' : '7 years'}; deletion only via policy.</span></div>
                <div><ShieldCheck /> <span>Every message, share and call is written to the hash-chained audit ledger (last anchor {anchorMin} min ago).</span></div>
                <div><Scale /> <span>{sel.title.toLowerCase().includes('leak') || sel.title.toLowerCase().includes('major') ? 'Legal hold active: messages cannot be edited or deleted.' : 'eDiscovery export and legal hold available to Tenant Admins.'}</span></div>
              </div>
              <div style={{ padding: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn sm onClick={() => nav('/ops/audit')}><FileText /> View in audit ledger</Btn>
                <Btn sm onClick={() => toast(`Invitation sent; new participants see history from now on only (${PARTY_LABEL[sel.category]})`)}><UserPlus /> Add people</Btn>
              </div>
            </div>
          </div>
        )}
      </div>

      {recDrawer && (
        <Drawer title="Records shared in conversations" sub={`${allShared.length} HexaView records · click to open in their module`} onClose={() => setRecDrawer(false)}>
          <div className="stack" style={{ gap: 10 }}>
            {allShared.map(({ cv, r }, i) => (
              <div key={i}>
                <div className="muted" style={{ fontSize: 11, marginBottom: 2 }}>{RECORD_META[r.kind].label} · in “{cv.title}”</div>
                <RecordCard r={r} />
              </div>
            ))}
          </div>
        </Drawer>
      )}
    </>
  );
}
