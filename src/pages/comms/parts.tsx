import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Paperclip, AtSign, Send, Link2, X, Lock, ShieldCheck, FileText, Search, ArrowUpRight, Hexagon, Globe2, MessageSquareReply,
} from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { useMe } from '../ops/parts';
import { headlines } from '../../data/core';
import {
  commsPeople, commsRecords, meId, personInitials, LICENCE_META, PRESENCE_COLOR, RECORD_META,
  type CommsPerson, type RecordRef, type Message, type FileRef, type Licence, type Presence,
} from '../../data/modules/comms';
import { SEV_COLOR, cap } from '../../components/ui';
import './comms.css';

export const COMMS_TONE = MODULE_BY_ID.comms?.tone ?? 'var(--m-comms)';
export const toneStyle = { '--tone': COMMS_TONE } as CSSProperties;

/** Everything a Comms page needs about people and records, memoised. */
export function useComms() {
  const { customer: c, tenantId } = useApp();
  const me = useMe();
  const people = useMemo(() => commsPeople(c), [c]);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const mid = meId(people, me);
  const recs = useMemo(() => commsRecords(c, tenantId, me), [c, tenantId, me]);
  const recList = useMemo(() => Object.values(recs).filter((r, i, a) => a.findIndex((x) => x.path === r.path && x.title === r.title) === i), [recs]);
  const anchorMin = headlines(c, tenantId).ops.lastAnchorMin;
  return { c, me, people, byId, mid, recs, recList, anchorMin };
}

/* ---------------- Avatars and badges ---------------- */
const COLLEAGUE_HEX = ['#4f8cff', '#a07cfb', '#2ec4a8', '#38bdf8', '#f97316', '#6d6af5', '#20b292', '#ef6aae'];
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
export function avatarColor(p: CommsPerson): string {
  if (p.bot) return '#64748b';
  if (p.party === 'hexashield') return '#c026d3';
  if (p.party === 'external') return '#d97706';
  return COLLEAGUE_HEX[hash(p.id + p.name) % COLLEAGUE_HEX.length];
}

export function Avatar({ p, size = 32, presence = true }: { p?: CommsPerson; size?: number; presence?: boolean }) {
  if (!p) return <span className="cm-av" style={{ width: size, height: size }} />;
  const col = avatarColor(p);
  const cls = p.bot ? 'bot' : p.party === 'hexashield' ? 'hx' : p.party === 'external' ? 'ext' : '';
  return (
    <span className={`cm-av ${cls}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.36), '--av': col } as CSSProperties} title={`${p.name} · ${p.role}`}>
      {p.bot ? <Bot size={size * 0.5} /> : personInitials(p.name)}
      {presence && !p.bot && <i className="cm-pres" style={{ background: PRESENCE_COLOR[p.presence] }} />}
    </span>
  );
}

export function PresenceDot({ p }: { p: Presence }) {
  return <i className="cm-pdot" style={{ background: PRESENCE_COLOR[p] }} title={cap(p)} />;
}

export function LicenceBadge({ l }: { l: Licence }) {
  const m = LICENCE_META[l];
  return (
    <span className="cm-lic" style={{ '--lc': m.color } as CSSProperties} title={m.can}>
      {m.label}
    </span>
  );
}

export function PartyTag({ p }: { p: CommsPerson }) {
  if (p.bot) return <span className="cm-tag appt">App</span>;
  if (p.party === 'hexashield') return <span className="cm-tag hx"><Hexagon size={10} /> HexaShield</span>;
  if (p.party === 'external') return <span className="cm-tag ext"><Globe2 size={10} /> External · {p.org}</span>;
  return null;
}

/* ---------------- Record cards ---------------- */
export function RecordCard({ r, compact, onRemove }: { r: RecordRef; compact?: boolean; onRemove?: () => void }) {
  const nav = useNavigate();
  const m = RECORD_META[r.kind];
  return (
    <div className={`cm-rec ${compact ? 'compact' : ''}`} style={{ '--rc': m.color } as CSSProperties} role="link" tabIndex={0}
      onClick={() => !onRemove && nav(r.path)} onKeyDown={(e) => e.key === 'Enter' && !onRemove && nav(r.path)} title={onRemove ? undefined : `Open in ${m.module}`}>
      <div className="cm-rec-top">
        <span className="cm-rec-kind">{m.label}</span>
        <span className="cm-rec-mod">{m.module}</span>
        {r.sev && r.sev !== 'info' && <span className="cm-rec-sev" style={{ color: SEV_COLOR[r.sev] }}>● {cap(r.sev)}</span>}
        <span className="spacer" />
        {onRemove ? (
          <button className="cm-x" onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label="Remove record"><X size={12} /></button>
        ) : (
          <ArrowUpRight size={13} className="cm-rec-go" />
        )}
      </div>
      <b className="cm-rec-title">{r.title}</b>
      {!compact && (
        <div className="cm-rec-sub">
          <span className="mono">{r.id}</span> · {r.sub}
        </div>
      )}
    </div>
  );
}

export function FileChip({ f, onRemove }: { f: FileRef; onRemove?: () => void }) {
  return (
    <span className="cm-file">
      <FileText size={14} />
      <span>
        <b>{f.name}</b>
        <small>{f.size} · scanned · watermarked</small>
      </span>
      {onRemove && (
        <button className="cm-x" onClick={onRemove} aria-label="Remove attachment"><X size={12} /></button>
      )}
    </span>
  );
}

/* ---------------- Message list ---------------- */
function clock(minAgo: number): string {
  const d = new Date(Date.now() - minAgo * 60000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function dayLabel(minAgo: number): string {
  const d = new Date(Date.now() - minAgo * 60000);
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}
export function stamp(minAgo: number): string {
  if (minAgo < 1) return 'now';
  const dl = dayLabel(minAgo);
  return dl === 'Today' ? clock(minAgo) : dl === 'Yesterday' ? 'Yesterday' : new Date(Date.now() - minAgo * 60000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function RichText({ text, people }: { text: string; people: CommsPerson[] }) {
  const names = people.filter((p) => !p.bot).map((p) => p.name).sort((a, b) => b.length - a.length);
  const parts: ReactNode[] = [];
  let rest = text;
  let k = 0;
  while (rest.length) {
    const i = rest.indexOf('@');
    if (i < 0) { parts.push(rest); break; }
    parts.push(rest.slice(0, i));
    const after = rest.slice(i + 1);
    const hit = names.find((n) => after.startsWith(n)) ?? after.match(/^[A-Z][\w'-]+/)?.[0];
    if (hit) {
      parts.push(<span key={k++} className="cm-mention">@{hit}</span>);
      rest = after.slice(hit.length);
    } else {
      parts.push('@');
      rest = after;
    }
  }
  return <>{parts}</>;
}

export function MessageList({ messages, byId, people, mid, typing, onThread, activeThread, empty }: {
  messages: Message[]; byId: Map<string, CommsPerson>; people: CommsPerson[]; mid: string; typing?: string | null;
  onThread?: (m: Message) => void; activeThread?: string | null; empty?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const sorted = useMemo(() => [...messages].sort((a, b) => b.minAgo - a.minAgo), [messages]);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sorted.length, typing]);
  let lastDay = '';
  let lastFrom = '';
  let lastMin = Infinity;
  return (
    <div className="cm-msgs" ref={box}>
      {sorted.length === 0 && (empty ?? <div className="empty">No messages yet. Say hello.</div>)}
      {sorted.map((m) => {
        const p = byId.get(m.from);
        const day = dayLabel(m.minAgo);
        const showDay = day !== lastDay;
        const cont = !showDay && lastFrom === m.from && lastMin - m.minAgo < 15 && !m.card;
        lastDay = day;
        lastFrom = m.from;
        lastMin = m.minAgo;
        const cls = p?.bot ? 'bot' : p?.party === 'hexashield' ? 'hx' : p?.party === 'external' ? 'ext' : m.from === mid ? 'mine' : '';
        return (
          <Fragment key={m.id}>
            {showDay && <div className="cm-day"><span>{day}</span></div>}
            <div className={`cm-msg ${cls} ${cont ? 'cont' : ''} ${activeThread === m.id ? 'active' : ''}`}>
              <div className="cm-msg-av">{!cont && <Avatar p={p} size={34} presence={false} />}{cont && <span className="cm-msg-t2">{clock(m.minAgo)}</span>}</div>
              <div className="cm-msg-body">
                {!cont && (
                  <div className="cm-msg-head">
                    <b>{p?.name ?? 'Unknown'}{m.from === mid ? ' (you)' : ''}</b>
                    {p && <PartyTag p={p} />}
                    <span className="cm-msg-role">{p?.bot ? '' : p?.role}</span>
                    <span className="cm-msg-time">{m.minAgo < 1 ? 'just now' : clock(m.minAgo)}</span>
                  </div>
                )}
                <div className="cm-msg-text"><RichText text={m.text} people={people} /></div>
                {m.card && <RecordCard r={m.card} />}
                {m.file && <FileChip f={m.file} />}
                {m.thread && m.thread.length > 0 && onThread && (
                  <button className="cm-thread-link" onClick={() => onThread(m)}>
                    <span className="cm-thread-avs">{[...new Set(m.thread.map((t) => t.from))].slice(0, 3).map((id) => <Avatar key={id} p={byId.get(id)} size={18} presence={false} />)}</span>
                    <MessageSquareReply size={13} /> {m.thread.length} {m.thread.length === 1 ? 'reply' : 'replies'}
                    <span className="muted">· last {stamp(Math.min(...m.thread.map((t) => t.minAgo)))}</span>
                  </button>
                )}
              </div>
            </div>
          </Fragment>
        );
      })}
      {typing && (
        <div className="cm-typing">
          <Avatar p={byId.get(typing)} size={22} presence={false} />
          <span>{byId.get(typing)?.name ?? 'Someone'} is typing</span>
          <i /><i /><i />
        </div>
      )}

    </div>
  );
}

/* ---------------- Composer ---------------- */
const ATTACH_POOL: FileRef[] = [
  { name: 'Screenshot 2026-10-03 at 09.41.png', size: '248 KB' },
  { name: 'Timeline_notes.docx', size: '64 KB' },
  { name: 'Evidence_export.csv', size: '1.1 MB' },
  { name: 'Shift_handover.pdf', size: '312 KB' },
];

export interface Outgoing { text: string; card?: RecordRef; file?: FileRef }

export function Composer({ placeholder, members, records, onSend, disabled, disabledNote, external }: {
  placeholder: string; members: CommsPerson[]; records: RecordRef[]; onSend: (o: Outgoing) => void; disabled?: boolean; disabledNote?: ReactNode; external?: boolean;
}) {
  const [text, setText] = useState('');
  const [card, setCard] = useState<RecordRef | null>(null);
  const [file, setFile] = useState<FileRef | null>(null);
  const [pop, setPop] = useState<'record' | 'mention' | null>(null);
  const [q, setQ] = useState('');
  const [fileIdx, setFileIdx] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    if (disabled) return;
    const t = text.trim();
    if (!t && !card && !file) return;
    onSend({ text: t || (card ? 'Sharing this record.' : 'Attachment'), card: card ?? undefined, file: file ?? undefined });
    setText('');
    setCard(null);
    setFile(null);
    setPop(null);
  };
  const mention = (p: CommsPerson) => {
    setText((t) => `${t.replace(/@$/, '')}${t && !t.endsWith(' ') && !t.endsWith('@') ? ' ' : ''}@${p.name} `);
    setPop(null);
    ta.current?.focus();
  };
  const recs = records.filter((r) => !q || `${r.title} ${r.id} ${r.sub}`.toLowerCase().includes(q.toLowerCase()));
  const ms = members.filter((p) => !p.bot && (!q || p.name.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className={`cm-composer ${disabled ? 'disabled' : ''}`}>
      {(card || file) && (
        <div className="cm-pending">
          {card && <RecordCard r={card} compact onRemove={() => setCard(null)} />}
          {file && <FileChip f={file} onRemove={() => setFile(null)} />}
        </div>
      )}
      {pop && (
        <div className="cm-pop">
          <div className="cm-pop-head">
            <b>{pop === 'record' ? 'Share a HexaView record' : 'Mention someone'}</b>
            <button className="cm-x" onClick={() => setPop(null)} aria-label="Close"><X size={12} /></button>
          </div>
          <label className="search" style={{ margin: '0 10px 6px' }}>
            <Search size={13} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={pop === 'record' ? 'Search incidents, approvals, loops…' : 'Search people'} />
          </label>
          <div className="cm-pop-list">
            {pop === 'record' && recs.map((r) => (
              <button key={`${r.kind}-${r.id}-${r.title}`} className="cm-pop-row" onClick={() => { setCard(r); setPop(null); setQ(''); }}>
                <i className="dot" style={{ background: RECORD_META[r.kind].color }} />
                <span><b>{r.title}</b><small>{RECORD_META[r.kind].label} · {r.id}</small></span>
              </button>
            ))}
            {pop === 'mention' && ms.map((p) => (
              <button key={p.id} className="cm-pop-row" onClick={() => { mention(p); setQ(''); }}>
                <Avatar p={p} size={22} />
                <span><b>{p.name}</b><small>{p.role} · {p.org}</small></span>
              </button>
            ))}
            {((pop === 'record' && !recs.length) || (pop === 'mention' && !ms.length)) && <div className="empty">No matches</div>}
          </div>
          {pop === 'record' && external && <div className="cm-pop-note"><Lock size={11} /> Guests in this conversation will see only this record, read-only.</div>}
        </div>
      )}
      <div className="cm-input">
        <textarea
          ref={ta}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={disabled ? 'You cannot post here' : placeholder}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.endsWith('@')) { setPop('mention'); setQ(''); }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="cm-tools">
          <button title="Attach a file (scanned and watermarked)" disabled={disabled} onClick={() => { setFile(ATTACH_POOL[fileIdx % ATTACH_POOL.length]); setFileIdx((i) => i + 1); }}><Paperclip size={15} /></button>
          <button title="Mention someone" disabled={disabled} className={pop === 'mention' ? 'on' : ''} onClick={() => { setPop(pop === 'mention' ? null : 'mention'); setQ(''); }}><AtSign size={15} /></button>
          <button title="Share a HexaView record" disabled={disabled} className={pop === 'record' ? 'on' : ''} onClick={() => { setPop(pop === 'record' ? null : 'record'); setQ(''); }}><Link2 size={15} /> <span>Share record</span></button>
          <span className="spacer" />
          <span className="cm-hint">Enter to send · Shift+Enter for a new line</span>
          <button className="cm-send" disabled={disabled || (!text.trim() && !card && !file)} onClick={send} title="Send"><Send size={14} /></button>
        </div>
      </div>
      {disabled && disabledNote && <div className="cm-disabled-note">{disabledNote}</div>}
    </div>
  );
}

/* ---------------- Local chat state with typing + auto-reply ---------------- */
export function useLocalChat(mid: string) {
  const [added, setAdded] = useState<Record<string, Message[]>>({});
  const [typing, setTyping] = useState<Record<string, string | null>>({});
  const counters = useRef<Record<string, number>>({});
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const send = useCallback((convId: string, o: Outgoing, responder: string | undefined, replies: string[]) => {
    const id = `${convId}-l${Date.now()}`;
    setAdded((a) => ({ ...a, [convId]: [...(a[convId] ?? []), { id, from: mid, text: o.text, minAgo: 0, card: o.card, file: o.file }] }));
    if (!responder || !replies.length) return;
    timers.current.push(window.setTimeout(() => setTyping((t) => ({ ...t, [convId]: responder })), 700));
    timers.current.push(window.setTimeout(() => {
      const n = counters.current[convId] ?? 0;
      counters.current[convId] = n + 1;
      setTyping((t) => ({ ...t, [convId]: null }));
      setAdded((a) => ({ ...a, [convId]: [...(a[convId] ?? []), { id: `${id}-r`, from: responder, text: replies[n % replies.length], minAgo: 0 }] }));
    }, 2600));
  }, [mid]);

  return { added, typing, send };
}

/* ---------------- Security footer ---------------- */
export function SecureNote({ retention = '7 years', anchorMin, hold }: { retention?: string; anchorMin: number; hold?: boolean }) {
  return (
    <div className="cm-secure">
      <span><Lock size={11} /> End-to-end encrypted (MLS, per-tenant keys)</span>
      <span>Retention {retention}{hold ? ' · legal hold' : ''}</span>
      <span><ShieldCheck size={11} /> All messages written to the audit ledger · anchored {anchorMin} min ago</span>
    </div>
  );
}

export function SectionHead({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="cm-sh">
      <span>{children}</span>
      {right}
    </div>
  );
}
