import { useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Hash, Lock, Globe2, Search, X, Bell, BellOff, Bot, Check, Minus, Users, Hexagon } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { KpiStrip, Btn, Badge } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { channels, LICENCES, LICENCE_META, type Channel, type ChannelGroup, type CommsPerson, type Message, type RecordRef } from '../../data/modules/comms';
import { useComms, useLocalChat, Avatar, LicenceBadge, MessageList, Composer, SecureNote, RecordCard, SectionHead, COMMS_TONE } from './parts';

const GROUPS: ChannelGroup[] = ['Functions', 'Incident & crisis', 'Executive', 'Shared with external'];

export default function Channels() {
  const { customer, tenantId, persona } = useApp();
  return <ChannelsInner key={`${customer.id}-${tenantId}-${persona}`} />;
}

function ChannelsInner() {
  const { toast } = useApp();
  const { c, me, people, byId, mid, recList, anchorMin } = useComms();
  const [sp] = useSearchParams();
  const all = useMemo(() => channels(c, me, people), [c, me, people]);
  const myLicence = byId.get(mid)?.licence ?? 'Full';
  const [joined, setJoined] = useState<Set<string>>(() => new Set(all.filter((ch) => ch.members.includes(mid)).map((ch) => ch.id)));
  const [selId, setSelId] = useState(() => all.find((ch) => ch.id === sp.get('channel'))?.id ?? all[0]?.id);
  const [read, setRead] = useState<Set<string>>(new Set([all[0]?.id]));
  const [muted, setMuted] = useState<Set<string>>(new Set());
  const [thread, setThread] = useState<Message | null>(null);
  const [q, setQ] = useState('');
  const [drawer, setDrawer] = useState<'members' | 'gating' | 'bots' | null>(null);
  const chat = useLocalChat(mid);

  const sel = all.find((ch) => ch.id === selId) ?? all[0];
  const isMember = (ch: Channel) => joined.has(ch.id);
  const canJoin = (ch: Channel) => ch.gate.includes(myLicence) && !ch.private;
  const msgsOf = (ch: Channel) => [...ch.messages, ...(chat.added[ch.id] ?? [])];
  const unreadOf = (ch: Channel) => (read.has(ch.id) || ch.id === sel?.id ? 0 : ch.unread);
  const select = (id: string) => {
    setSelId(id);
    setThread(null);
    setRead((r) => new Set(r).add(id));
  };

  const members = (ch: Channel) => [...new Set([...ch.members, ...(joined.has(ch.id) ? [mid] : [])])].map((id) => byId.get(id)).filter((p): p is CommsPerson => !!p && !p.bot);
  const selMembers = sel ? members(sel) : [];
  const selMsgs = sel ? msgsOf(sel) : [];
  const bots = [...new Set(selMsgs.map((m) => m.from).filter((f) => f.startsWith('bot-')))].map((id) => byId.get(id)).filter((p): p is CommsPerson => !!p);
  const pinnedRecs = selMsgs.filter((m) => m.card).map((m) => m.card as RecordRef);
  const guestsIn = selMembers.filter((p) => p.party === 'external');

  const threadMsgs = thread ? [...(thread.thread ?? []), ...(chat.added[`t:${thread.id}`] ?? [])] : [];
  const threadPeople = thread ? [...new Set([thread.from, ...(thread.thread ?? []).map((t) => t.from)])].filter((id) => id !== mid && !id.startsWith('bot-')) : [];
  const sendCount = sel ? (chat.added[sel.id] ?? []).length : 0;

  const totalUnread = all.reduce((s, ch) => s + unreadOf(ch), 0);
  const shared = all.filter((ch) => ch.sharedWith);
  const botPosts = all.reduce((s, ch) => s + ch.messages.filter((m) => m.from.startsWith('bot-')).length, 0);
  const allGuests = new Set(all.flatMap((ch) => ch.members.filter((m) => byId.get(m)?.party === 'external')));
  const totalMembers = new Set(all.flatMap((ch) => ch.members)).size + Math.max(...all.map((ch) => ch.extraMembers));

  const shownGroups = GROUPS.map((g) => ({ g, chs: all.filter((ch) => ch.group === g && (!q || ch.name.includes(q.toLowerCase()) || ch.purpose.toLowerCase().includes(q.toLowerCase()))) })).filter((x) => x.chs.length);

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · team channels by function. HexaView bots post incidents, OT alerts (read-only), loop breaks and evidence-pack changes with live record cards; shared channels bring in {c.insurance.broker} and key vendors as guests without exposing anything else. Who can join is set by licence.
      </p>

      <KpiStrip toneColor={COMMS_TONE} items={[
        { label: 'Channels', value: all.length, unit: `${joined.size} joined`, onClick: () => setDrawer('gating'), source: 'Communications Hub · channel directory' },
        { label: 'Unread', value: totalUnread, unit: 'messages', onClick: () => { const ch = all.find((x) => unreadOf(x) > 0); if (ch) select(ch.id); }, source: 'Communications Hub message store', toneColor: totalUnread ? COMMS_TONE : undefined },
        { label: 'Shared with external', value: shared.length, unit: 'channels', onClick: () => shared[0] && select(shared[0].id), source: 'Guest licences · HexaView Administration' },
        { label: 'Guests in channels', value: allGuests.size, unit: 'external people', to: '/comms/directory?party=external', source: 'Guest licences · HexaView Administration' },
        { label: 'Bot alerts posted', value: botPosts, unit: 'with record cards', onClick: () => setDrawer('bots'), source: 'HexaSOC · HexaOT · HexaComply · Insurance bots' },
        { label: 'People in channels', value: totalMembers, unit: 'named + synced', onClick: () => setDrawer('members'), source: 'Entra ID / Okta SCIM sync · Communications Hub' },
      ]} />

      <div className="cm-shell">
        {/* ---------- channel list ---------- */}
        <div className="cm-pane cm-side">
          <label className="search">
            <Search size={14} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a channel" />
          </label>
          <div className="cm-scroll" style={{ paddingBottom: 8 }}>
            {shownGroups.map(({ g, chs }) => (
              <div key={g}>
                <div className="cm-list-label">{g === 'Shared with external' ? <Globe2 size={11} /> : null}{g}</div>
                {chs.map((ch) => {
                  const un = unreadOf(ch);
                  const locked = !isMember(ch) && !canJoin(ch);
                  return (
                    <button key={ch.id} className={`cm-ch ${sel?.id === ch.id ? 'on' : ''} ${un ? 'unread' : ''} ${locked ? 'locked' : ''}`} onClick={() => select(ch.id)} title={ch.gateNote}>
                      <span className="hash">{ch.private ? <Lock size={12} /> : ch.sharedWith ? <Globe2 size={12} /> : <Hash size={13} />}</span>
                      <span className="nm">{ch.name}</span>
                      {muted.has(ch.id) && <BellOff size={11} className="muted" />}
                      {!isMember(ch) && <span className="cm-tag appt">{canJoin(ch) ? 'join' : 'gated'}</span>}
                      {un > 0 && <span className="cm-unread">{un}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ padding: 10, borderTop: '1px solid var(--hairline)' }}>
            <Btn sm onClick={() => toast('New channel requests go to your Tenant Admin; licence gating and guest rules apply')}><Hash /> Create channel</Btn>
          </div>
        </div>

        {/* ---------- channel ---------- */}
        {sel && (
          <div className="cm-pane cm-main">
            <div className="cm-pane-head">
              <span className="ico-box" style={{ '--tone': COMMS_TONE } as CSSProperties}>{sel.private ? <Lock /> : sel.sharedWith ? <Globe2 /> : <Hash />}</span>
              <div className="cm-head-title">
                <h3>{sel.name} {sel.private && <span className="cm-tag priv">Private · legal hold</span>} {sel.sharedWith && <span className={`cm-tag ${sel.sharedWith === 'HexaShield' ? 'hx' : 'ext'}`}>{sel.sharedWith === 'HexaShield' ? <Hexagon size={10} /> : <Globe2 size={10} />} Shared with {sel.sharedWith}</span>}</h3>
                <div className="sub">{sel.purpose}</div>
              </div>
              <div className="cm-head-actions">
                <button className="cm-icon-btn" title="Members" onClick={() => setDrawer('members')} style={{ width: 'auto', padding: '0 8px', gap: 4, display: 'inline-flex', alignItems: 'center', fontSize: 11.5, fontWeight: 700 }}><Users /> {selMembers.length + sel.extraMembers}</button>
                <button className="cm-icon-btn" title={muted.has(sel.id) ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => { const n = new Set(m); if (n.has(sel.id)) n.delete(sel.id); else n.add(sel.id); return n; })}>{muted.has(sel.id) ? <BellOff /> : <Bell />}</button>
              </div>
            </div>
            {guestsIn.length > 0 && <div className="cm-banner"><Globe2 /> {guestsIn.length} external guest{guestsIn.length > 1 ? 's' : ''} from {[...new Set(guestsIn.map((p) => p.org))].join(', ')} can read this channel. Only records posted here are visible to them.</div>}
            <MessageList messages={selMsgs} byId={byId} people={people} mid={mid} typing={chat.typing[sel.id]} onThread={(m) => setThread(m)} activeThread={thread?.id} />
            {isMember(sel) ? (
              <Composer
                placeholder={`Message #${sel.name}`}
                members={selMembers.filter((p) => p.id !== mid)}
                records={recList}
                external={guestsIn.length > 0}
                onSend={(o) => {
                  const rs = selMembers.filter((p) => p.id !== mid);
                  chat.send(sel.id, o, rs.length ? rs[sendCount % rs.length].id : undefined, sel.replies);
                }}
              />
            ) : (
              <div className="cm-composer">
                <div className="cm-banner" style={{ margin: 0, justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Lock /> {canJoin(sel) ? `You are not a member of #${sel.name}. Your ${LICENCE_META[myLicence].label} licence allows you to join.` : sel.private ? 'Invite only. Ask a channel owner to add you; the request is logged.' : `Your ${LICENCE_META[myLicence].label} licence cannot join this channel.`}</span>
                  {canJoin(sel)
                    ? <Btn sm primary color={COMMS_TONE} onClick={() => { setJoined((j) => new Set(j).add(sel.id)); toast(`Joined #${sel.name}; membership written to the audit ledger`); }}>Join channel</Btn>
                    : <Btn sm onClick={() => toast(`Request to join #${sel.name} sent to the channel owners`)}>Request access</Btn>}
                </div>
              </div>
            )}
            <SecureNote anchorMin={anchorMin} retention={sel.sharedWith && sel.sharedWith !== 'HexaShield' ? '1 year after guest expiry' : '7 years'} hold={sel.private} />
          </div>
        )}

        {/* ---------- thread or details ---------- */}
        {sel && (
          <div className="cm-pane cm-ctx">
            {thread ? (
              <>
                <div className="cm-pane-head">
                  <div className="cm-head-title"><h3>Thread</h3><div className="sub">#{sel.name} · {threadMsgs.length} replies</div></div>
                  <button className="cm-x" onClick={() => setThread(null)} aria-label="Close thread"><X size={14} /></button>
                </div>
                <MessageList messages={[{ ...thread, thread: undefined, minAgo: thread.minAgo }, ...threadMsgs]} byId={byId} people={people} mid={mid} typing={chat.typing[`t:${thread.id}`]} />
                <Composer
                  placeholder="Reply in thread…"
                  members={threadPeople.map((id) => byId.get(id)).filter((p): p is CommsPerson => !!p)}
                  records={recList}
                  onSend={(o) => chat.send(`t:${thread.id}`, o, threadPeople[0], sel.replies)}
                  disabled={!isMember(sel)}
                  disabledNote="Join the channel to reply."
                />
              </>
            ) : (
              <div className="cm-scroll">
                <SectionHead>About</SectionHead>
                <div style={{ margin: '0 14px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{sel.purpose}</div>
                <SectionHead right={<button className="link" style={{ fontSize: 11 }} onClick={() => setDrawer('gating')}>All channels</button>}>Who can join</SectionHead>
                <div style={{ margin: '0 14px' }}>
                  <div className="cm-gate">{sel.gate.map((l) => <LicenceBadge key={l} l={l} />)}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>{sel.gateNote}</div>
                </div>
                <SectionHead right={<span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>{selMembers.length + sel.extraMembers}</span>}>Members</SectionHead>
                {selMembers.slice(0, 8).map((p) => (
                  <div key={p.id} className="cm-person">
                    <Avatar p={p} size={28} />
                    <div className="cm-person-main"><b>{p.name}{p.id === mid ? ' (you)' : ''}</b><span>{p.role}{p.org !== c.name ? ` · ${p.org}` : ''}</span></div>
                    <LicenceBadge l={p.licence} />
                  </div>
                ))}
                {sel.extraMembers > 0 && <button className="link" style={{ margin: '2px 14px', fontSize: 11.5 }} onClick={() => setDrawer('members')}>+ {sel.extraMembers} more synced from your IdP</button>}
                {bots.length > 0 && <SectionHead>Apps in this channel</SectionHead>}
                {bots.map((b) => (
                  <div key={b.id} className="cm-person"><Avatar p={b} size={26} presence={false} /><div className="cm-person-main"><b>{b.name}</b><span>{b.role}</span></div></div>
                ))}
                <SectionHead>Pinned records</SectionHead>
                {pinnedRecs.length ? pinnedRecs.map((r, i) => <RecordCard key={i} r={r} compact />) : <div className="muted" style={{ fontSize: 11.5, margin: '0 14px' }}>No records posted yet.</div>}
                <div style={{ height: 12 }} />
              </div>
            )}
          </div>
        )}
      </div>

      {drawer === 'members' && sel && (
        <Drawer title={`#${sel.name} members`} sub={`${selMembers.length} named · ${sel.extraMembers} synced from ${c.connectors.find((k) => k.category === 'Identity')?.product ?? 'your IdP'}`} onClose={() => setDrawer(null)}>
          <div className="list">
            {selMembers.map((p) => (
              <div key={p.id} className="list-row">
                <Avatar p={p} size={30} />
                <span className="list-main"><b>{p.name}</b><span>{p.role} · {p.org}</span></span>
                <LicenceBadge l={p.licence} />
              </div>
            ))}
          </div>
        </Drawer>
      )}
      {drawer === 'gating' && (
        <Drawer wide title="Channel licence gating" sub="Which licence types may join each channel. Guests never see channels they are not invited to." onClose={() => setDrawer(null)}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Channel</th>{LICENCES.map((l) => <th key={l} style={{ textAlign: 'center' }}>{LICENCE_META[l].label}</th>)}<th>Members</th></tr></thead>
              <tbody>
                {all.map((ch) => (
                  <tr key={ch.id} style={{ cursor: 'pointer' }} onClick={() => { select(ch.id); setDrawer(null); }}>
                    <td><div className="t-main">#{ch.name}</div><div className="t-sub">{ch.gateNote}</div></td>
                    {LICENCES.map((l) => <td key={l} style={{ textAlign: 'center' }}>{ch.gate.includes(l) ? <Check size={14} style={{ color: 'var(--good)' }} /> : <Minus size={14} className="muted" />}</td>)}
                    <td className="num">{members(ch).length + ch.extraMembers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Drawer>
      )}
      {drawer === 'bots' && (
        <Drawer title="Bot alerts in channels" sub="Each alert is a live HexaView record; click to open it" onClose={() => setDrawer(null)}>
          <div className="stack" style={{ gap: 12 }}>
            {all.flatMap((ch) => ch.messages.filter((m) => m.from.startsWith('bot-')).map((m) => ({ ch, m }))).sort((a, b) => a.m.minAgo - b.m.minAgo).map(({ ch, m }) => (
              <div key={m.id}>
                <div className="row" style={{ gap: 6, fontSize: 11.5 }}><Bot size={13} className="muted" /><b>{byId.get(m.from)?.name}</b><Badge color={COMMS_TONE}>#{ch.name}</Badge></div>
                <div style={{ fontSize: 12.5, margin: '4px 0' }}>{m.text}</div>
                {m.card && <RecordCard r={m.card} />}
              </div>
            ))}
          </div>
        </Drawer>
      )}
    </>
  );
}
