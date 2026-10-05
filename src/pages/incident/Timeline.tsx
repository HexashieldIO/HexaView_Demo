import { useMemo, useState } from 'react';
import { Plus, ShieldCheck, ShieldAlert, Printer, RefreshCw, Star } from 'lucide-react';
import { Card, KpiStrip, Btn, Callout, Chip, KV } from '../../components/ui';
import { Modal } from '../../components/Overlay';
import { PHASES, PHASE_LABEL, PHASE_SHORT, PHASE_COLOR, TL_TYPE, verifyChain, type IrIncident, type Phase, type TlType } from '../../data/modules/incident';
import { useIr, useNow, IrPage, IncidentPicker, NoIncident, EntryRow, useGuideTarget, fmtT, IR_TONE, RecordsDrawer } from './parts';
import { ir } from './store';

type PF = 'all' | Phase;
const MANUAL_TYPES: TlType[] = ['note', 'decision', 'comms', 'containment', 'evidence', 'stakeholder'];

export default function Timeline() {
  return <IrPage><Inner /></IrPage>;
}
function Inner() {
  const { focus } = useIr();
  return <><IncidentPicker />{focus ? <TL inc={focus} /> : <NoIncident />}</>;
}

function TL({ inc }: { inc: IrIncident }) {
  const { c, toast, nav } = useIr();
  const now = useNow(10000);
  const [pf, setPf] = useState<PF>('all');
  const [tf, setTf] = useState<'all' | TlType>('all');
  const [src, setSrc] = useState('all');
  const [keyOnly, setKeyOnly] = useState(false);
  const [q, setQ] = useState('');
  const [add, setAdd] = useState(false);
  const [panel, setPanel] = useState<'auto' | 'manual' | null>(null);
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const [hi, setHi] = useState<string | null>(null);
  const guide = useGuideTarget(3);
  const chain = useMemo(() => verifyChain(inc.timeline), [inc.timeline]);
  const sorted = useMemo(() => inc.timeline.slice().sort((a, b) => a.t - b.t || a.seq - b.seq), [inc.timeline]);
  const sources = Array.from(new Set(sorted.map((e) => e.source))).sort();
  const rows = sorted.filter((e) => (pf === 'all' || e.phase === pf) && (tf === 'all' || e.type === tf) && (src === 'all' || e.source === src) && (!keyOnly || e.key) && (!q || `${e.text} ${e.actor} ${e.source}`.toLowerCase().includes(q.toLowerCase())));
  const auto = sorted.filter((e) => e.auto);
  const keys = sorted.filter((e) => e.key);
  const t0 = sorted[0]?.t ?? inc.declaredAt;
  const t1 = Math.max(inc.status === 'closed' ? inc.closedAt ?? now : now, sorted[sorted.length - 1]?.t ?? now);
  const pos = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * 100;
  const head = sorted.reduce((m, e) => (e.seq > m.seq ? e : m), sorted[0]);
  const print = () => window.print();

  return (
    <>
      <p className="page-intro">
        The single audited record of <b>{inc.id}</b>: alerts from {Array.from(new Set(sorted.filter((e) => e.type === 'alert').map((e) => e.source))).join(', ') || 'the SOC'}, HexaSOC automation and write-back, evidence, decisions, comms and stakeholder joins. Every entry is SHA-256 hash-chained to the one before it, like the <button className="ir-link" onClick={() => nav('/ops/audit')}>Audit Ledger</button>; nothing can be edited or removed, only appended.
      </p>
      <KpiStrip toneColor={IR_TONE} items={[
        { label: 'Entries', value: sorted.length, hint: `${fmtT(t0)} → now`, onClick: () => { setPf('all'); setTf('all'); setKeyOnly(false); }, source: 'HexaView IR audited timeline' },
        { label: 'Key events', value: keys.length, hint: 'pinned for the report', toneColor: 'var(--sev-medium)', onClick: () => setKeyOnly(true), source: 'HexaView IR audited timeline' },
        { label: 'Automated', value: auto.length, hint: 'connectors & HexaSOC', onClick: () => setPanel('auto'), source: sources.slice(0, 4).join(' · ') },
        { label: 'Manual', value: sorted.length - auto.length, hint: 'notes, decisions, comms', onClick: () => setPanel('manual'), source: 'War room participants' },
        { label: 'Hash chain', value: chain.ok ? 'Verified' : 'Broken', hint: `${chain.checked} links checked`, toneColor: chain.ok ? 'var(--good)' : 'var(--bad)', onClick: () => document.getElementById('ir-integrity')?.scrollIntoView({ behavior: 'smooth' }), source: 'SHA-256 chain · HexaView audit ledger' },
      ]} />

      <Card title="Swimlanes by phase" sub="Each mark is an entry, coloured by type; diamonds are key events · click to jump to the entry">
        <div className="ir-lanes">
          {PHASES.map((p) => (
            <div key={p} className="ir-lane">
              <span className="ir-lane-l"><i style={{ background: PHASE_COLOR[p] }} />{PHASE_SHORT[p]}</span>
              <div className="ir-lane-track">
                {inc.phaseAt[p] && <span style={{ position: 'absolute', left: `${pos(inc.phaseAt[p] as number)}%`, top: 0, bottom: 0, width: 2, background: PHASE_COLOR[p], opacity: 0.5 }} />}
                {sorted.filter((e) => e.phase === p).map((e) => (
                  <button key={e.id} type="button" className={`ir-lane-mark ${e.key ? 'key' : ''}`} style={{ left: `${Math.min(99, Math.max(1, pos(e.t)))}%`, background: TL_TYPE[e.type].color }} title={`${fmtT(e.t)} · ${TL_TYPE[e.type].label}: ${e.text}`} onClick={() => { setPf('all'); setTf('all'); setKeyOnly(false); setHi(e.id); setTimeout(() => document.getElementById(`tl-${e.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }} />
                ))}
              </div>
            </div>
          ))}
          <div className="ir-lane-axis"><span /><div><span>{fmtT(t0)}</span><span>{fmtT(t0 + (t1 - t0) / 2)}</span><span>{inc.status === 'closed' ? fmtT(t1) : 'now'}</span></div></div>
        </div>
        <div className="row wrap" style={{ gap: 10, marginTop: 10 }}>
          {Object.entries(TL_TYPE).map(([k, v]) => <span key={k} className="ir-sub" style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><i style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, display: 'inline-block' }} />{v.label}</span>)}
        </div>
      </Card>

      <div className="grid g-2-1">
        <Card
          className="ir-print"
          title="Audited timeline"
          count={rows.length}
          sub={`${c.name} · ${inc.id} · newest at the bottom`}
          actions={<>
            {inc.status === 'active' && <span className={guide}><Btn sm primary color={IR_TONE} onClick={() => setAdd(true)}><Plus size={13} /> Add entry</Btn></span>}
            <Btn sm onClick={print}><Printer size={13} /> Export (print)</Btn>
          </>}
        >
          <div className="stack" style={{ gap: 8, marginBottom: 10 }}>
            <div className="chips">
              <Chip on={pf === 'all'} onClick={() => setPf('all')} color={IR_TONE}>All phases</Chip>
              {PHASES.map((p) => <Chip key={p} on={pf === p} onClick={() => setPf(p)} color={PHASE_COLOR[p]}>{PHASE_SHORT[p]} {sorted.filter((e) => e.phase === p).length}</Chip>)}
              <Chip on={keyOnly} onClick={() => setKeyOnly(!keyOnly)} color="var(--sev-medium)"><Star size={11} /> Key only</Chip>
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              <select className="select" value={tf} onChange={(e) => setTf(e.target.value as 'all' | TlType)} aria-label="Type">
                <option value="all">All types</option>
                {(Object.keys(TL_TYPE) as TlType[]).map((t) => <option key={t} value={t}>{TL_TYPE[t].label} ({sorted.filter((e) => e.type === t).length})</option>)}
              </select>
              <select className="select" value={src} onChange={(e) => setSrc(e.target.value)} aria-label="Source">
                <option value="all">All sources</option>
                {sources.map((s) => <option key={s}>{s}</option>)}
              </select>
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entries" aria-label="Search entries" style={{ flex: 1, minWidth: 160 }} />
            </div>
          </div>
          <div className="ir-tl">
            {rows.map((e) => (
              <div key={e.id} id={`tl-${e.id}`} style={hi === e.id ? { background: 'color-mix(in srgb, var(--m-ir) 9%, transparent)', borderRadius: 8 } : undefined}>
                <EntryRow e={e} onKey={() => { ir.toggleKey(c, inc.id, e.id); toast(e.key ? 'Key event unpinned' : 'Marked as key event (feeds the report)'); }} />
              </div>
            ))}
            {!rows.length && <div className="empty">No entries match these filters.</div>}
          </div>
        </Card>

        <div className="stack" style={{ gap: 16 }}>
          <Card title="Integrity check" sub="Recomputed in the browser from every entry" toneColor={chain.ok ? 'var(--good)' : 'var(--bad)'} tinted>
            <div id="ir-integrity" className="stack" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                {chain.ok ? <ShieldCheck size={28} style={{ color: 'var(--good)' }} /> : <ShieldAlert size={28} style={{ color: 'var(--bad)' }} />}
                <div>
                  <b style={{ fontSize: 14 }}>{chain.ok ? 'Chain verified' : `Broken at #${chain.brokenAt}`}</b>
                  <div className="ir-sub">{chain.checked} entries · checked {fmtT(checkedAt)}</div>
                </div>
              </div>
              <div className="ir-chain" aria-hidden>{inc.timeline.slice().sort((a, b) => a.seq - b.seq).map((e) => <i key={e.id} className={e.key ? 'key' : ''} title={`#${e.seq} ${e.hash.slice(0, 16)}`} />)}</div>
              <KV rows={[
                ['Algorithm', 'SHA-256 over prev hash | seq | time | actor | source | type | text'],
                ['Genesis', '0000…0000'],
                ['Head', <span key="h" className="ir-mono" style={{ fontSize: 10.5, wordBreak: 'break-all' }}>{head?.hash}</span>],
                ['Anchored', 'HexaView audit ledger (hourly Merkle root)'],
              ]} />
              <Btn sm onClick={() => { setCheckedAt(Date.now()); toast(verifyChain(inc.timeline).ok ? `Re-verified ${inc.timeline.length} links: intact` : 'Chain broken'); }}><RefreshCw size={13} /> Re-verify now</Btn>
            </div>
          </Card>
          <Card title="By phase" sub="Entries and first entry time">
            <div className="stack" style={{ gap: 6 }}>
              {PHASES.map((p) => {
                const n = sorted.filter((e) => e.phase === p).length;
                return (
                  <button key={p} type="button" className="bar-row" style={{ background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }} onClick={() => setPf(p)}>
                    <div className="bar-label"><b>{PHASE_LABEL[p]}</b><span>{inc.phaseAt[p] ? fmtT(inc.phaseAt[p] as number) : 'not reached'}</span></div>
                    <div className="bar" style={{ ['--tone' as string]: PHASE_COLOR[p] }}><i style={{ width: `${(n / Math.max(1, sorted.length)) * 100}%` }} /></div>
                    <div className="bar-val">{n}</div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {add && <AddEntry inc={inc} onClose={() => setAdd(false)} />}
      {panel && (
        <RecordsDrawer title={panel === 'auto' ? 'Automated entries' : 'Manual entries'} source={panel === 'auto' ? 'Connectors and HexaSOC automation' : 'War room participants'} onClose={() => setPanel(null)}
          rows={sorted.filter((e) => (panel === 'auto' ? e.auto : !e.auto)).map((e) => ({ id: e.id, title: e.text, sub: `${fmtT(e.t)} · ${e.actor} · ${e.source}`, right: <span className="ir-mono muted">#{e.seq}</span> }))} />
      )}
    </>
  );
}

function AddEntry({ inc, onClose }: { inc: IrIncident; onClose: () => void }) {
  const { c, actor, toast } = useIr();
  const [type, setType] = useState<TlType>('note');
  const [text, setText] = useState('');
  const [key, setKey] = useState(false);
  const [ev, setEv] = useState<string[]>([]);
  return (
    <Modal title="Add timeline entry" sub={`${inc.id} · appended as #${inc.timeline.length + 1}, signed by ${actor}`} onClose={onClose}
      footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color={IR_TONE} disabled={!text.trim()} onClick={() => { ir.addEntry(c, inc.id, { type, text, key, evidence: ev.length ? ev : undefined }, actor); toast('Entry appended and hash-chained'); onClose(); }}><Plus size={13} /> Append</Btn></>}>
      <div className="ir-form">
        <div><span className="section-label">Type</span><div className="ir-seg">{MANUAL_TYPES.map((t) => <button key={t} type="button" className={type === t ? 'on' : ''} onClick={() => setType(t)}>{TL_TYPE[t].label}</button>)}</div></div>
        <label><span className="section-label" style={{ margin: 0 }}>Entry</span><textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What happened, who did it, what it means" aria-label="Entry text" /></label>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={key} onChange={(e) => setKey(e.target.checked)} /> Mark as key event (feeds the incident report)</label>
        {inc.evidence.length > 0 && (
          <div><span className="section-label">Link evidence</span><div className="chips">{inc.evidence.map((e) => <Chip key={e.id} on={ev.includes(e.id)} onClick={() => setEv(ev.includes(e.id) ? ev.filter((x) => x !== e.id) : [...ev, e.id])} color={IR_TONE}>{e.id.split('-').pop()} · {e.type}</Chip>)}</div></div>
        )}
        <Callout>Entries are append-only. To correct one, add a new entry that references it.</Callout>
      </div>
    </Modal>
  );
}
