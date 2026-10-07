import { useState } from 'react';
import { FileBox, Plus, ArrowRightLeft, Gavel, ExternalLink, ShieldCheck, Copy } from 'lucide-react';
import { Card, KpiStrip, Btn, Callout, KV, Timeline, IcoBox, Chip } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer, Modal } from '../../components/Overlay';
import { fmtBytes } from '../../data/modules/soc';
import { sha256, type IrIncident, type EvidenceItem, type EvidenceType } from '../../data/modules/incident';
import { useIr, IrPage, IncidentPicker, NoIncident, Pill, fmtT, IR_TONE } from './parts';
import { ir } from './store';

const TYPES: EvidenceType[] = ['Memory image', 'Disk image', 'Logs export', 'EDR triage package', 'Email sample', 'Screenshots', 'Cloud audit logs', 'Network capture'];
const TYPE_COLOR: Record<EvidenceType, string> = { 'Memory image': '#a07cfb', 'Disk image': '#4f8cff', 'Logs export': '#2dd4bf', 'EDR triage package': '#e11d48', 'Email sample': '#f5a83d', Screenshots: '#8a9bc0', 'Cloud audit logs': '#68b1ff', 'Network capture': '#93d65a' };

export default function Evidence() {
  return <IrPage><Inner /></IrPage>;
}
function Inner() {
  const { focus } = useIr();
  return <><IncidentPicker />{focus ? <Ev inc={focus} /> : <NoIncident />}</>;
}

function Ev({ inc }: { inc: IrIncident }) {
  const { c, tools, nav } = useIr();
  const [sel, setSel] = useState<EvidenceItem | null>(null);
  const [add, setAdd] = useState(false);
  const [tf, setTf] = useState<'all' | EvidenceType | 'hold'>('all');
  const ev = inc.evidence;
  const bytes = ev.reduce((s, e) => s + e.bytes, 0);
  const hops = ev.reduce((s, e) => s + e.custody.length, 0);
  const rows = ev.filter((e) => (tf === 'all' ? true : tf === 'hold' ? e.legalHold : e.type === tf));
  const current = sel ? ev.find((e) => e.id === sel.id) ?? sel : null;
  const vault = ev[0]?.location ?? 'HexaCustody evidence vault';

  return (
    <>
      <p className="page-intro">
        Forensic evidence for <b>{inc.id}</b>, collected from {tools.edr}, {tools.siem} and {tools.idp} by HexaSOC and HexaShield DFIR, hashed at source and sealed in the {vault}. Every transfer is a custody hop on the chain of evidence, mirrored to <button className="ir-link" onClick={() => nav('/custody/evidence')}>HexaCustody › Chain of evidence</button>.
      </p>
      <KpiStrip toneColor={IR_TONE} items={[
        { label: 'Evidence items', value: ev.length, hint: `${new Set(ev.map((e) => e.type)).size} types`, onClick: () => setTf('all'), source: 'HexaCustody evidence vault' },
        { label: 'Collected', value: fmtBytes(bytes), hint: 'total size', onClick: () => setTf('all'), source: 'HexaCustody evidence vault' },
        { label: 'Legal hold', value: ev.filter((e) => e.legalHold).length, unit: `of ${ev.length}`, toneColor: 'var(--m-ai)', onClick: () => setTf('hold'), source: `Legal hold register · ${c.people.grcLead.name}` },
        { label: 'Custody hops', value: hops, hint: 'every hop re-verifies SHA-256', to: '/custody/evidence', source: 'HexaCustody chain of evidence' },
        { label: 'Hashes verified', value: `${ev.length}/${ev.length}`, hint: 'SHA-256 at source = vault', toneColor: 'var(--good)', onClick: () => setTf('all'), source: 'HexaCustody integrity service' },
      ]} />

      <Card title="Evidence register" count={rows.length} sub="Click an item for its chain of custody" flush actions={inc.status === 'active' ? <Btn sm primary color={IR_TONE} onClick={() => setAdd(true)}><Plus size={13} /> Add evidence</Btn> : undefined}>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={setSel}
          pageSize={12}
          toolbar={<span className="chips"><Chip on={tf === 'all'} onClick={() => setTf('all')} color={IR_TONE}>All {ev.length}</Chip><Chip on={tf === 'hold'} onClick={() => setTf('hold')} color="var(--m-ai)">Legal hold {ev.filter((e) => e.legalHold).length}</Chip>{TYPES.filter((t) => ev.some((e) => e.type === t)).map((t) => <Chip key={t} on={tf === t} onClick={() => setTf(t)} color={TYPE_COLOR[t]}>{t}</Chip>)}</span>}
          columns={[
            { key: 'id', header: 'ID', sort: (r) => r.id, render: (r) => <span className="ir-mono nowrap">{r.id}</span> },
            { key: 'n', header: 'Item', sort: (r) => r.name, render: (r) => <><div className="t-main">{r.name}</div><div className="t-sub"><Pill color={TYPE_COLOR[r.type]}>{r.type}</Pill></div></> },
            { key: 'tool', header: 'Collected by / tool', sort: (r) => r.tool, render: (r) => <><div>{r.collectedBy}</div><div className="t-sub">{r.tool}</div></> },
            { key: 't', header: 'Collected', sort: (r) => r.t, render: (r) => <span className="nowrap">{fmtT(r.t)}</span> },
            { key: 'h', header: 'SHA-256', render: (r) => <span className="ir-mono" title={r.sha256}>{r.sha256.slice(0, 12)}…</span> },
            { key: 'size', header: 'Size', align: 'right', sort: (r) => r.bytes, render: (r) => fmtBytes(r.bytes) },
            { key: 'hold', header: 'Hold', render: (r) => (r.legalHold ? <Pill color="var(--m-ai)" dot>Legal hold</Pill> : <span className="t-sub">—</span>) },
            { key: 'c', header: 'Hops', align: 'right', sort: (r) => r.custody.length, render: (r) => r.custody.length },
          ]}
        />
      </Card>

      <div className="grid g2">
        <Card title="By type" sub="Volume collected per evidence type">
          <div className="stack" style={{ gap: 7 }}>
            {TYPES.filter((t) => ev.some((e) => e.type === t)).map((t) => {
              const b = ev.filter((e) => e.type === t).reduce((s, e) => s + e.bytes, 0);
              return (
                <button key={t} type="button" className="bar-row" style={{ background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }} onClick={() => setTf(t)}>
                  <div className="bar-label"><b>{t}</b><span>{ev.filter((e) => e.type === t).length} items</span></div>
                  <div className="bar" style={{ ['--tone' as string]: TYPE_COLOR[t] }}><i style={{ width: `${Math.max(3, Math.sqrt(b / Math.max(1, bytes)) * 100)}%` }} /></div>
                  <div className="bar-val">{fmtBytes(b)}</div>
                </button>
              );
            })}
          </div>
        </Card>
        <Card title="Handling rules" sub="Applied to every item in this incident">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <li>Hash at source, re-verify on every custody hop; analysis only on working copies.</li>
            <li>Forensics directed by counsel under privilege (breach coach via {c.insurance.broker}).</li>
            <li>Retention: {c.id === 'defence' ? '90 days minimum for DC3 (DFARS 7012(e)), then per legal hold' : 'per legal hold, minimum 12 months'}; residency {c.residency}.</li>
            <li>Release to regulators, insurers or law enforcement only with the legal lead’s approval.</li>
          </ul>
        </Card>
      </div>

      {current && <EvDrawer inc={inc} e={current} onClose={() => setSel(null)} />}
      {add && <AddEv inc={inc} onClose={() => setAdd(false)} />}
    </>
  );
}

function EvDrawer({ inc, e, onClose }: { inc: IrIncident; e: EvidenceItem; onClose: () => void }) {
  const { c, actor, toast, nav, ppl } = useIr();
  const [xfer, setXfer] = useState(false);
  const live = inc.status === 'active';
  return (
    <Drawer wide title={e.name} sub={<span className="row" style={{ gap: 6 }}><span className="ir-mono">{e.id}</span><Pill color={TYPE_COLOR[e.type]}>{e.type}</Pill>{e.legalHold && <Pill color="var(--m-ai)" dot>Legal hold</Pill>}</span>} icon={<IcoBox color={IR_TONE}><FileBox /></IcoBox>} onClose={onClose}
      footer={<>
        <Btn ghost onClick={() => nav('/custody/evidence')}><ExternalLink size={13} /> Open in HexaCustody</Btn>
        {live && <Btn onClick={() => { ir.legalHold(c, inc.id, e.id, !e.legalHold, ppl.legal.name); toast(e.legalHold ? 'Legal hold released' : 'Legal hold placed'); }}><Gavel size={13} /> {e.legalHold ? 'Release hold' : 'Place legal hold'}</Btn>}
        {live && <Btn primary color={IR_TONE} onClick={() => setXfer(true)}><ArrowRightLeft size={13} /> Transfer custody</Btn>}
      </>}>
      <div className="stack" style={{ gap: 16 }}>
        <KV rows={[
          ['SHA-256', <span key="h" className="ir-mono" style={{ wordBreak: 'break-all' }}>{e.sha256} <button className="ir-icon-btn" style={{ display: 'inline-grid' }} onClick={() => { try { void navigator.clipboard?.writeText(e.sha256); } catch { /* clipboard unavailable */ } toast('Hash copied'); }} aria-label="Copy hash"><Copy size={12} /></button></span>],
          ['Size', fmtBytes(e.bytes)],
          ['Collected', `${fmtT(e.t)} by ${e.collectedBy}`],
          ['Source tool', e.tool],
          ['Location', e.location],
          ['Integrity', <span key="i" style={{ color: 'var(--good)' }}><ShieldCheck size={12} style={{ verticalAlign: -2 }} /> Verified at every hop</span>],
        ]} />
        <div>
          <div className="section-label">Chain of custody</div>
          <Timeline items={e.custody.map((h, i) => ({ time: fmtT(h.t), title: `${h.from} → ${h.to}`, body: h.action, color: i === 0 ? IR_TONE : 'var(--good)' }))} />
        </div>
        <Btn sm onClick={() => toast(`Re-hashed ${e.id}: ${sha256(e.sha256).slice(0, 8)}… matches the vault record`)}><ShieldCheck size={13} /> Verify hash now</Btn>
        <Callout>Referenced by {inc.timeline.filter((t) => t.evidence?.includes(e.id)).length} timeline entries and the incident report appendix.</Callout>
      </div>
      {xfer && <XferModal inc={inc} e={e} onClose={() => setXfer(false)} actor={actor} />}
    </Drawer>
  );
}

function XferModal({ inc, e, onClose, actor }: { inc: IrIncident; e: EvidenceItem; onClose: () => void; actor: string }) {
  const { c, toast, ppl } = useIr();
  const targets = ['Freya Lund (HexaShield DFIR)', `${ppl.legal.name} (legal)`, 'Panel breach coach (privileged)', `${c.insurance.carrier.split('/')[0].trim()} (insurer, redacted copy)`, 'Law enforcement (on warrant / request)', e.location];
  const [to, setTo] = useState(targets[0]);
  const [why, setWhy] = useState('Analysis copy for root-cause investigation');
  return (
    <Modal title="Transfer custody" sub={`${e.id} · from ${e.custody[e.custody.length - 1]?.to}`} onClose={onClose} footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color={IR_TONE} onClick={() => { ir.transfer(c, inc.id, e.id, to, why, actor); toast(`Custody → ${to}; hash re-verified`); onClose(); }}><ArrowRightLeft size={13} /> Transfer</Btn></>}>
      <div className="ir-form">
        <label><span className="section-label" style={{ margin: 0 }}>To</span><select className="select" value={to} onChange={(ev) => setTo(ev.target.value)} aria-label="Recipient">{targets.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label><span className="section-label" style={{ margin: 0 }}>Purpose</span><input className="input" value={why} onChange={(ev) => setWhy(ev.target.value)} aria-label="Purpose" /></label>
        {/insurer|Law/.test(to) && <Callout kind="warn">External release requires the legal lead’s approval and is logged to the audit ledger.</Callout>}
      </div>
    </Modal>
  );
}

function AddEv({ inc, onClose }: { inc: IrIncident; onClose: () => void }) {
  const { c, actor, toast, tools } = useIr();
  const [type, setType] = useState<EvidenceType>('Logs export');
  const [name, setName] = useState('');
  const toolOpts = Array.from(new Set([tools.edr, tools.siem, tools.idp, tools.email, tools.net, tools.ot, 'HexaShield DFIR imager']));
  const [tool, setTool] = useState(toolOpts[0]);
  const vault = inc.evidence[0]?.location ?? 'HexaCustody evidence vault';
  return (
    <Modal title="Add evidence" sub={inc.id} onClose={onClose} footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color={IR_TONE} disabled={!name.trim()} onClick={() => { ir.addEvidence(c, inc.id, { type, name, tool, collectedBy: actor, bytes: 50e6 + name.length * 1e6, location: vault, legalHold: true }, actor); toast('Evidence collected, hashed and sealed'); onClose(); }}><Plus size={13} /> Collect</Btn></>}>
      <div className="ir-form">
        <div className="row2">
          <label><span className="section-label" style={{ margin: 0 }}>Type</span><select className="select" value={type} onChange={(e) => setType(e.target.value as EvidenceType)} aria-label="Type">{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label><span className="section-label" style={{ margin: 0 }}>Source tool</span><select className="select" value={tool} onChange={(e) => setTool(e.target.value)} aria-label="Source tool">{toolOpts.map((t) => <option key={t}>{t}</option>)}</select></label>
        </div>
        <label><span className="section-label" style={{ margin: 0 }}>Description</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${inc.assets[0]} prefetch and amcache`} aria-label="Description" /></label>
        <Callout>SHA-256 is computed on collection; the item is sealed into {vault} under legal hold and logged to the timeline.</Callout>
      </div>
    </Modal>
  );
}
