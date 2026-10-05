import { useMemo, useState, type ReactNode } from 'react';
import { UserPlus, Send, Check, ShieldCheck, FileLock2, Building2, Scale, LifeBuoy, Landmark, Siren, Search } from 'lucide-react';
import { Card, KpiStrip, Btn, Callout, Chip, KV, Tabs } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Overlay';
import { fmtMoney } from '../../lib/format';
import { stakeholderDirectory, type IrIncident, type Raci, type Stakeholder } from '../../data/modules/incident';
import { useIr, useNow, IrPage, IncidentPicker, NoIncident, Pill, Avatar, agoText, useGuideTarget, IR_TONE } from './parts';
import { ir } from './store';

const RACI_COLOR: Record<Raci, string> = { R: '#e11d48', A: '#a07cfb', C: '#4f8cff', I: '#8a9bc0' };
const RACI_NEXT: Record<Raci, Raci> = { R: 'A', A: 'C', C: 'I', I: 'R' };
const CHANNELS = ['Comms Hub · Teams + email', 'Bridge invite', 'SMS + phone call', 'Signal (privileged)', 'Regulator portal', 'Email'];
type G = 'all' | 'internal' | 'external' | 'pending';

const ACTIVITIES: { id: string; label: string; map: (s: Stakeholder) => Raci | '' }[] = [
  { id: 'contain', label: 'Containment decisions', map: (s) => (s.incidentRole.includes('commander') ? 'A' : /Security operations|IT \/ OT|OT lead|HexaShield IR/.test(s.kind) ? 'R' : /CEO|Business owner/.test(s.kind) ? 'C' : s.group === 'internal' ? 'I' : '') },
  { id: 'forensics', label: 'Forensics', map: (s) => (/Forensics|HexaShield IR/.test(s.kind) ? 'R' : /Legal|Outside counsel/.test(s.kind) ? 'A' : s.incidentRole.includes('commander') ? 'C' : '') },
  { id: 'reg', label: 'Regulator notification', map: (s) => (/Privacy|GRC/.test(s.kind) ? 'R' : s.kind === 'Legal' ? 'A' : /Regulator/.test(s.kind) ? 'I' : /Security leadership|Outside counsel/.test(s.kind) ? 'C' : '') },
  { id: 'comms', label: 'Customer & media comms', map: (s) => (/Comms|PR agency/.test(s.kind) ? 'R' : /CEO/.test(s.kind) ? 'A' : /Legal|Outside counsel/.test(s.kind) ? 'C' : /Key supplier/.test(s.kind) ? 'I' : '') },
  { id: 'insurer', label: 'Insurance claim', map: (s) => (/Finance/.test(s.kind) ? 'R' : /Insurer|Broker/.test(s.kind) ? 'I' : /Legal|Outside counsel/.test(s.kind) ? 'C' : s.incidentRole.includes('commander') ? 'A' : '') },
  { id: 'report', label: 'Report sign-off', map: (s) => (s.kind === 'Legal' || /Security leadership/.test(s.kind) ? 'A' : /HexaShield IR|GRC/.test(s.kind) ? 'R' : /CEO/.test(s.kind) ? 'I' : '') },
];

export default function Stakeholders() {
  return <IrPage><Inner /></IrPage>;
}
function Inner() {
  const { focus } = useIr();
  return <><IncidentPicker />{focus ? <Roster inc={focus} /> : <NoIncident />}</>;
}

function Roster({ inc }: { inc: IrIncident }) {
  const { c, toast, actor, nav } = useIr();
  const now = useNow(5000);
  const [g, setG] = useState<G>('all');
  const [notify, setNotify] = useState<Stakeholder[] | null>(null);
  const [add, setAdd] = useState(false);
  const guide = useGuideTarget(2);
  const live = inc.status === 'active';
  const sh = inc.stakeholders;
  const internal = sh.filter((s) => s.group === 'internal');
  const external = sh.filter((s) => s.group === 'external');
  const notified = sh.filter((s) => s.notifiedAt);
  const acked = sh.filter((s) => s.ackAt);
  const pending = sh.filter((s) => s.notifiedAt && !s.ackAt);
  const notYet = sh.filter((s) => !s.notifiedAt);
  const rows = sh.filter((s) => (g === 'all' ? true : g === 'pending' ? !s.ackAt : s.group === g));
  const src = 'HexaView IR roster · Comms Hub delivery receipts';

  return (
    <>
      <p className="page-intro">
        Everyone involved in <b>{inc.id}</b>, inside {c.short} and outside: roles, RACI, how and when they were told and whether they acknowledged. Messages go out through the <button className="ir-link" onClick={() => nav('/comms/inbox')}>Comms Hub</button>; privileged parties use the legal channel so forensic findings stay under privilege.
      </p>
      <KpiStrip toneColor={IR_TONE} items={[
        { label: 'Stakeholders', value: sh.length, hint: `${internal.length} internal · ${external.length} external`, onClick: () => setG('all'), source: src },
        { label: 'Notified', value: notified.length, unit: `of ${sh.length}`, bar: (notified.length / Math.max(1, sh.length)) * 100, onClick: () => setG('all'), source: src },
        { label: 'Acknowledged / joined', value: acked.length, hint: 'on the bridge or replied', toneColor: 'var(--good)', onClick: () => setG('all'), source: src },
        { label: 'Awaiting acknowledgement', value: pending.length + notYet.length, hint: `${notYet.length} not yet notified`, toneColor: pending.length + notYet.length ? 'var(--sev-high)' : IR_TONE, onClick: () => setG('pending'), source: src },
        { label: 'Under privilege', value: sh.filter((s) => s.privileged).length, hint: `${sh.filter((s) => s.nda).length} NDA on file`, onClick: () => setG('all'), source: 'Legal privilege register' },
      ]} />

      <Card
        title="Roster"
        count={rows.length}
        sub="Click a RACI letter to change it; flags toggle privilege and NDA"
        flush
        actions={live ? (
          <>
            <span className={guide}><Btn sm primary color={IR_TONE} disabled={!notYet.length} onClick={() => setNotify(notYet)}><Send size={13} /> Notify {notYet.length} pending</Btn></span>
            <Btn sm onClick={() => setAdd(true)}><UserPlus size={13} /> Add stakeholder</Btn>
          </>
        ) : undefined}
      >
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          pageSize={14}
          search={(r) => `${r.name} ${r.title} ${r.org} ${r.kind} ${r.incidentRole}`}
          searchPlaceholder="Filter by name, organisation, role…"
          toolbar={<span className="chips">{(['all', 'internal', 'external', 'pending'] as G[]).map((x) => <Chip key={x} on={g === x} onClick={() => setG(x)} color={IR_TONE}>{x === 'pending' ? 'Not acknowledged' : x[0].toUpperCase() + x.slice(1)} {x === 'all' ? sh.length : x === 'pending' ? sh.filter((s) => !s.ackAt).length : sh.filter((s) => s.group === x).length}</Chip>)}</span>}
          columns={[
            { key: 'n', header: 'Stakeholder', sort: (r) => r.name, render: (r) => <span className="row" style={{ gap: 8 }}><Avatar name={r.name} size={26} /><span><div className="t-main">{r.name}</div><div className="t-sub">{r.title} · {r.org}</div></span></span> },
            { key: 'k', header: 'Group', sort: (r) => r.kind, render: (r) => <span className="stack" style={{ gap: 3 }}><Pill color={r.group === 'internal' ? IR_TONE : 'var(--m-core)'}>{r.group}</Pill><span className="t-sub">{r.kind}</span></span> },
            { key: 'role', header: 'Role in incident', render: (r) => <span className="t-sub" style={{ whiteSpace: 'normal', display: 'block', maxWidth: 220 }}>{r.incidentRole}</span> },
            { key: 'raci', header: 'RACI', sort: (r) => 'RACI'.indexOf(r.raci), render: (r) => <button type="button" className="ir-raci-c" disabled={!live} style={{ background: `color-mix(in srgb, ${RACI_COLOR[r.raci]} 20%, transparent)`, color: RACI_COLOR[r.raci] }} onClick={(e) => { e.stopPropagation(); ir.setFlags(c, inc.id, r.id, { raci: RACI_NEXT[r.raci] }, actor); }} title="Click to change">{r.raci}</button> },
            { key: 'ch', header: 'Channel', render: (r) => <span className="t-sub">{r.channel}</span> },
            { key: 'nt', header: 'Notified', sort: (r) => r.notifiedAt ?? 0, render: (r) => (r.notifiedAt ? <span className="t-sub">{agoText(r.notifiedAt, now)}</span> : <Pill color="var(--sev-medium)">not yet</Pill>) },
            { key: 'ack', header: 'Acknowledged', sort: (r) => r.ackAt ?? 0, render: (r) => (r.ackAt ? <Pill color="var(--good)" dot>joined {agoText(r.ackAt, now)}</Pill> : r.notifiedAt && live ? <Btn sm ghost onClick={() => { ir.ack(c, inc.id, r.id); toast(`${r.name} acknowledged`); }}><Check size={12} /> Mark</Btn> : <span className="t-sub">—</span>) },
            { key: 'fl', header: 'Flags', render: (r) => (
              <span className="row" style={{ gap: 4 }}>
                <button type="button" className={`ir-icon-btn ${r.privileged ? 'on' : ''}`} disabled={!live} onClick={() => ir.setFlags(c, inc.id, r.id, { privileged: !r.privileged }, actor)} title={r.privileged ? 'Under legal privilege' : 'Not privileged'} style={{ color: r.privileged ? 'var(--m-ai)' : undefined }}><ShieldCheck size={14} /></button>
                <button type="button" className={`ir-icon-btn ${r.nda ? 'on' : ''}`} disabled={!live} onClick={() => ir.setFlags(c, inc.id, r.id, { nda: !r.nda }, actor)} title={r.nda ? 'NDA on file' : 'No NDA'} style={{ color: r.nda ? 'var(--m-comply)' : undefined }}><FileLock2 size={14} /></button>
              </span>
            ) },
            { key: 'act', header: '', render: (r) => (live ? <Btn sm ghost onClick={() => setNotify([r])}><Send size={12} /> Notify</Btn> : null) },
          ]}
        />
      </Card>

      <div className="grid g-3-2">
        <Card title="RACI matrix" sub="Who is Responsible, Accountable, Consulted and Informed for each workstream (derived from role)">
          <div className="tbl-scroll">
            <table className="ir-raci">
              <thead><tr><th>Stakeholder</th>{ACTIVITIES.map((a) => <th key={a.id}>{a.label}</th>)}</tr></thead>
              <tbody>
                {sh.slice(0, 16).map((s) => (
                  <tr key={s.id}>
                    <td><b style={{ fontSize: 12 }}>{s.name.length > 30 ? `${s.name.slice(0, 30)}…` : s.name}</b><div className="t-sub">{s.kind}</div></td>
                    {ACTIVITIES.map((a) => { const v = a.map(s); return <td key={a.id}>{v ? <span className="ir-raci-c" style={{ background: `color-mix(in srgb, ${RACI_COLOR[v]} 18%, transparent)`, color: RACI_COLOR[v], cursor: 'default' }}>{v}</span> : <span className="muted">·</span>}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="External parties" sub="Contracts, panels and retainers that apply">
          <div className="ir-ext">
            <ExtCard icon={<Building2 size={15} />} title={c.insurance.carrier} sub={`Cyber insurer · via ${c.insurance.broker}`} rows={[['Limit', fmtMoney(c.insurance.limitM * 1e6, c.currency)], ['Retention', fmtMoney(c.insurance.retentionK * 1e3, c.currency)], ['Condition', 'Panel vendors only; notify as soon as practicable']]} onClick={() => nav('/insurance')} />
            <ExtCard icon={<Scale size={15} />} title="Panel breach coach" sub={`Outside counsel appointed via ${c.insurance.broker}`} rows={[['Purpose', 'Directs forensics under privilege'], ['Channel', 'Signal (privileged)']]} />
            <ExtCard icon={<LifeBuoy size={15} />} title="HexaShield Incident Response" sub="Retainer · Hannah Weiss (IR lead), Freya Lund (DFIR)" rows={[['Remote', '15 min from first call'], ['On site', '24 h (EU / US / SG)']]} onClick={() => nav('/soc/ir')} />
            {sh.filter((s) => s.kind === 'Regulator' || s.kind === 'Law enforcement').slice(0, 3).map((s) => (
              <ExtCard key={s.id} icon={s.kind === 'Regulator' ? <Landmark size={15} /> : <Siren size={15} />} title={s.name} sub={s.kind} rows={[['Role', s.incidentRole], ['Status', s.notifiedAt ? `notified ${agoText(s.notifiedAt, now)}` : 'not yet notified']]} onClick={() => nav('/incident-response/notifications')} />
            ))}
          </div>
        </Card>
      </div>

      {notify && <NotifyModal inc={inc} list={notify} onClose={() => setNotify(null)} />}
      {add && <AddModal inc={inc} onClose={() => setAdd(false)} />}
    </>
  );
}

function ExtCard({ icon, title, sub, rows, onClick }: { icon: ReactNode; title: string; sub: string; rows: [string, string][]; onClick?: () => void }) {
  return (
    <div className="ir-ext-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="row" style={{ gap: 8 }}><span className="ico-box" style={{ ['--tone' as string]: IR_TONE, width: 26, height: 26 }}>{icon}</span><b>{title}</b></div>
      <small>{sub}</small>
      <KV rows={rows} />
    </div>
  );
}

function NotifyModal({ inc, list, onClose }: { inc: IrIncident; list: Stakeholder[]; onClose: () => void }) {
  const { c, actor, toast } = useIr();
  const [channel, setChannel] = useState(list.length === 1 && list[0].privileged ? 'Signal (privileged)' : CHANNELS[0]);
  const [msg, setMsg] = useState(`${inc.id} (${inc.title}) has been declared. You are listed as a stakeholder. Please join the bridge: ${inc.bridge}. Treat as confidential${list.some((s) => s.privileged) ? ' and privileged' : ''}.`);
  return (
    <Modal title={`Notify ${list.length === 1 ? list[0].name : `${list.length} stakeholders`}`} sub={`${inc.id} · sent through the Comms Hub and logged`} onClose={onClose}
      footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color={IR_TONE} onClick={() => { ir.notify(c, inc.id, list.map((s) => s.id), channel, actor); toast(`Notified ${list.length} via ${channel}`); onClose(); }}><Send size={13} /> Send</Btn></>}>
      <div className="ir-form">
        <div className="chips">{list.slice(0, 12).map((s) => <span key={s.id} className="ir-pill">{s.name}</span>)}{list.length > 12 && <span className="muted">+{list.length - 12}</span>}</div>
        <label><span className="section-label" style={{ margin: 0 }}>Channel</span><select className="select" value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel">{CHANNELS.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label><span className="section-label" style={{ margin: 0 }}>Message</span><textarea className="input" rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} aria-label="Message" /></label>
        {list.some((s) => s.group === 'external' && !s.nda) && <Callout kind="warn">Some recipients have no NDA on file; keep the message to facts already public or required by law.</Callout>}
      </div>
    </Modal>
  );
}

function AddModal({ inc, onClose }: { inc: IrIncident; onClose: () => void }) {
  const { c, actor, toast } = useIr();
  const dir = useMemo(() => stakeholderDirectory(c).filter((d) => !inc.stakeholders.some((s) => s.name === d.name)), [c, inc.stakeholders]);
  const [tab, setTab] = useState<'internal' | 'external'>('internal');
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<Omit<Stakeholder, 'id'> | null>(null);
  const [raci, setRaci] = useState<Raci>('I');
  const [role, setRole] = useState('');
  const list = dir.filter((d) => d.group === tab && `${d.name} ${d.title} ${d.kind}`.toLowerCase().includes(q.toLowerCase()));
  const submit = () => {
    if (!pick) return;
    ir.addStakeholder(c, inc.id, { ...pick, raci, incidentRole: role || pick.incidentRole }, actor);
    toast(`${pick.name} added as ${raci}`);
    onClose();
  };
  return (
    <Modal title="Add stakeholder" sub={inc.id} onClose={onClose} footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color={IR_TONE} disabled={!pick} onClick={submit}><UserPlus size={13} /> Add</Btn></>}>
      <div className="ir-form">
        <Tabs tabs={[{ id: 'internal', label: `Directory (${c.short})` }, { id: 'external', label: 'External templates' }]} value={tab} onChange={(v) => { setTab(v); setPick(null); }} color={IR_TONE} />
        <div className="search" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Search size={13} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people and parties" aria-label="Search" style={{ flex: 1 }} /></div>
        <div className="list" style={{ maxHeight: 230, overflow: 'auto', border: '1px solid var(--hairline)', borderRadius: 8 }}>
          {list.map((d) => (
            <div key={d.name} className="list-row clickable" style={{ cursor: 'pointer', padding: '7px 10px', background: pick?.name === d.name ? 'color-mix(in srgb, var(--m-ir) 12%, transparent)' : undefined }} onClick={() => { setPick(d); setRole(d.incidentRole); setRaci(d.raci); }}>
              <span className="list-main"><b>{d.name}</b><span>{d.title} · {d.kind}</span></span>
              {pick?.name === d.name && <Check size={14} style={{ color: IR_TONE }} />}
            </div>
          ))}
          {!list.length && <div className="empty">No match.</div>}
        </div>
        {pick && (
          <div className="row2">
            <label><span className="section-label" style={{ margin: 0 }}>Role in incident</span><input className="input" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role in incident" /></label>
            <div><span className="section-label">RACI</span><div className="ir-seg">{(['R', 'A', 'C', 'I'] as Raci[]).map((x) => <button key={x} type="button" className={raci === x ? 'on' : ''} onClick={() => setRaci(x)}>{x}</button>)}</div></div>
          </div>
        )}
      </div>
    </Modal>
  );
}
