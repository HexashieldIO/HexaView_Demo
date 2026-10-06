import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Inbox, CheckCircle2, HelpCircle, GitMerge, ExternalLink, Siren, Reply } from 'lucide-react';
import { Card, KpiStrip, Btn, Callout, KV, Chip, Timeline, IcoBox, Sources } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer, Modal } from '../../components/Overlay';
import { techName } from '../../data/modules/soc';
import { IR_TYPES, IR_TYPE_IDS, SEV_LABEL, SEV_DESC, SEV_COLOR_IR, commanderOptions, type Escalation, type Sev, type IrType, type EscStatus } from '../../data/modules/incident';
import { useIr, useNow, IrPage, SevPill, TypePill, Pill, fmtSpan, fmtT, agoText, useGuideTarget, IR_TONE } from './parts';
import { RetainerCoverNote } from './RetainerIr';
import { ir } from './store';

const MIN = 60_000;
type F = 'open' | EscStatus | 'all';
const STATUS_META: Record<EscStatus, { label: string; color: string }> = {
  awaiting: { label: 'Awaiting L4', color: 'var(--sev-high)' },
  info: { label: 'More info requested', color: 'var(--sev-medium)' },
  accepted: { label: 'Accepted', color: 'var(--good)' },
  merged: { label: 'Merged', color: 'var(--m-core)' },
};

export default function Escalations() {
  return <IrPage><Inner /></IrPage>;
}

function Inner() {
  const { c, tools, escalations, scopeLabel, tenantId, nav } = useIr();
  const now = useNow(1000);
  const [sp, setSp] = useSearchParams();
  const [f, setF] = useState<F>(() => (sp.get('status') as F) || 'open');
  const selId = sp.get('esc');
  const sel = escalations.find((e) => e.id === selId) ?? null;
  const setSel = (e: Escalation | null) => {
    const n = new URLSearchParams(sp);
    if (e) n.set('esc', e.id); else n.delete('esc');
    setSp(n, { replace: true });
  };
  const socParam = sp.get('soc');
  useEffect(() => {
    if (!socParam) return;
    const res = ir.escalateSoc(c, socParam);
    const n = new URLSearchParams(sp);
    n.delete('soc');
    if (res.inc) { ir.focus(c, res.inc); nav('/incident-response/warroom'); return; }
    if (res.esc) n.set('esc', res.esc);
    setSp(n, { replace: true });
  }, [socParam]); // eslint-disable-line react-hooks/exhaustive-deps
  const awaiting = escalations.filter((e) => e.status === 'awaiting');
  const breached = awaiting.filter((e) => now - e.escalatedAt > e.slaMin * MIN);
  const info = escalations.filter((e) => e.status === 'info');
  const accepted = escalations.filter((e) => e.status === 'accepted');
  const merged = escalations.filter((e) => e.status === 'merged');
  const rows = escalations.filter((e) => (f === 'all' ? true : f === 'open' ? e.status === 'awaiting' || e.status === 'info' : e.status === f));
  const src = `HexaSOC escalation queue · ${tools.siem} · ${tools.itsm}`;
  const guideRow = useGuideTarget(0);

  return (
    <>
      <p className="page-intro">
        <b>{scopeLabel}</b> · cases HexaSOC has worked through L1 triage, L2 validation and L3 investigation and escalated to L4 Incident Response. Accepting declares an incident, opens the war room on the Comms Hub bridge, starts the regulatory clocks and writes the first entries of the audited timeline. IDs match HexaSOC Incidents & Response and Tickets.
      </p>
      <KpiStrip
        toneColor={IR_TONE}
        items={[
          { label: 'Awaiting L4', value: awaiting.length, hint: 'accept, merge or ask for info', toneColor: awaiting.length ? 'var(--sev-high)' : IR_TONE, onClick: () => setF('awaiting'), source: src },
          { label: 'Acceptance SLA breached', value: breached.length, hint: 'SEV1 15 min · SEV2 30 min', toneColor: breached.length ? 'var(--bad)' : 'var(--good)', onClick: () => setF('awaiting'), source: src },
          { label: 'Waiting on L3', value: info.length, hint: 'more info requested', onClick: () => setF('info'), source: src },
          { label: 'Accepted → incident', value: accepted.length, hint: 'this session', onClick: () => setF('accepted'), source: 'HexaView IR case store' },
          { label: 'Merged', value: merged.length, hint: 'into an existing incident', onClick: () => setF('merged'), source: 'HexaView IR case store' },
        ]}
      />
      {tenantId !== 'all' && <Callout>Scoped to one tenant: escalations for other tenants are hidden (the guided scenario always shows).</Callout>}

      <Card title="L4 escalation queue" count={rows.length} sub="Click a case for the triage drawer" flush>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={setSel}
          pageSize={12}
          initialSort={{ key: 'age', dir: 'desc' }}
          search={(r) => `${r.id} ${r.socId} ${r.ticketId ?? ''} ${r.title} ${r.assets.join(' ')} ${r.escalatedBy}`}
          searchPlaceholder="Filter by ESC, HSOC or REQ id, title, asset…"
          toolbar={
            <span className="chips">
              {(['open', 'awaiting', 'info', 'accepted', 'merged', 'all'] as F[]).map((x) => (
                <Chip key={x} on={f === x} onClick={() => setF(x)} color={IR_TONE}>
                  {x === 'open' ? 'Open' : x === 'all' ? 'All' : STATUS_META[x].label} {x === 'open' ? awaiting.length + info.length : x === 'all' ? escalations.length : escalations.filter((e) => e.status === x).length}
                </Chip>
              ))}
            </span>
          }
          empty="No escalations in this view."
          columns={[
            { key: 'id', header: 'Escalation', sort: (r) => r.id, render: (r) => <div className={r.guided && r.status === 'awaiting' ? guideRow : ''}><span className="ir-mono nowrap" style={{ color: IR_TONE }}>{r.id}</span><div className="t-sub ir-mono">{r.socId}{r.ticketId ? ` · ${r.ticketId}` : ''}</div></div> },
            { key: 'title', header: 'Case', sort: (r) => r.title, render: (r) => <><div className="t-main" style={{ maxWidth: 380, whiteSpace: 'normal' }}>{r.title}</div><div className="t-sub">{r.reason}</div></> },
            { key: 'sev', header: 'Recommended', sort: (r) => r.sev, render: (r) => <span className="stack" style={{ gap: 3 }}><SevPill sev={r.sev} /><TypePill type={r.type} /></span> },
            { key: 'tenant', header: 'Tenant', sort: (r) => r.tenantId, render: (r) => c.tenants.find((t) => t.id === r.tenantId)?.short ?? r.tenantId },
            { key: 'by', header: 'Escalated by', sort: (r) => r.escalatedBy, render: (r) => <span className="nowrap">{r.escalatedBy}</span> },
            { key: 'age', header: 'SLA to accept', align: 'right', sort: (r) => now - r.escalatedAt, render: (r) => <SlaCell e={r} now={now} /> },
            { key: 'status', header: 'Status', sort: (r) => r.status, render: (r) => <Pill color={STATUS_META[r.status].color} dot>{STATUS_META[r.status].label}{r.incidentId ? ` · ${r.incidentId}` : ''}</Pill> },
          ]}
        />
      </Card>

      <div className="grid g2">
        <Card title="How cases reach L4" sub="HexaSOC tiers and their authority">
          <Timeline items={[
            { time: 'L1', title: 'HexaSOC Triage agent + on-shift analyst', body: 'Groups alerts, scores severity, matches a playbook', color: 'var(--sev-info)' },
            { time: 'L2', title: 'Validation analyst', body: 'Confirms true positive, enriches from HexaInt and the CMDB, low-risk containment', color: 'var(--sev-medium)' },
            { time: 'L3', title: 'Senior investigator', body: 'Scopes the intrusion, requests medium/high-risk write-back', color: 'var(--sev-high)' },
            { time: 'L4', title: 'Incident Response (this module)', body: 'Declares incidents, runs the war room, owns notifications and the report', color: IR_TONE },
          ]} />
        </Card>
        <Card title="Escalation criteria" sub={`Agreed with ${c.people.socLead.name}; any one triggers L4`}>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <li>Crown-jewel system affected ({c.vocab.crownJewels.slice(0, 3).join(', ')}…)</li>
            <li>Regulated data possibly in scope ({c.frameworks.filter((x) => x.kind === 'Regulation').map((x) => x.short).slice(0, 4).join(', ')})</li>
            <li>Containment needs business sign-off or exceeds SOC write-back authority</li>
            <li>Business service disruption ({c.vocab.businessServices.slice(0, 2).join(', ')})</li>
            <li>OT safety or availability in question (OT is read-only for HexaView)</li>
            <li>Extortion, fraud or media interest</li>
          </ul>
          <div style={{ marginTop: 10 }}><Sources items={[{ name: tools.siem }, { name: tools.edr }, { name: tools.idp }, { name: tools.itsm }]} /></div>
        </Card>
      </div>

      {sel && <TriageDrawer esc={sel} now={now} onClose={() => setSel(null)} />}
    </>
  );
}

function SlaCell({ e, now }: { e: Escalation; now: number }) {
  if (e.status === 'accepted' || e.status === 'merged') return <span className="t-sub">{agoText(e.escalatedAt, now)}</span>;
  const left = e.escalatedAt + e.slaMin * MIN - now;
  const color = left < 0 ? 'var(--bad)' : left < e.slaMin * MIN * 0.3 ? 'var(--sev-high)' : 'var(--good)';
  return <span className="stack" style={{ gap: 2, alignItems: 'flex-end' }}><b className="ir-mono" style={{ color }}>{left < 0 ? `-${fmtSpan(-left)}` : fmtSpan(left)}</b><span className="t-sub">escalated {agoText(e.escalatedAt, now)}</span></span>;
}

function TriageDrawer({ esc, now, onClose }: { esc: Escalation; now: number; onClose: () => void }) {
  const { c, nav, active, toast, actor, setFocus } = useIr();
  const [modal, setModal] = useState<'declare' | 'info' | 'merge' | null>(null);
  const tenant = c.tenants.find((t) => t.id === esc.tenantId);
  const open = esc.status === 'awaiting' || esc.status === 'info';
  const guide = useGuideTarget(0);
  return (
    <Drawer
      wide
      title={esc.title}
      sub={<span className="row wrap" style={{ gap: 6 }}><span className="ir-mono">{esc.id}</span><SevPill sev={esc.sev} /><TypePill type={esc.type} /><Pill color={STATUS_META[esc.status].color} dot>{STATUS_META[esc.status].label}</Pill></span>}
      icon={<IcoBox color={IR_TONE}><Inbox /></IcoBox>}
      onClose={onClose}
      footer={open ? (
        <>
          <Btn ghost onClick={() => setModal('merge')} disabled={!active.length}><GitMerge size={14} /> Merge into incident</Btn>
          {esc.status === 'info'
            ? <Btn onClick={() => { ir.reEscalate(c, esc.id); toast(`${esc.id}: L3 answered and re-escalated`); }}><Reply size={14} /> Simulate L3 reply</Btn>
            : <Btn onClick={() => setModal('info')}><HelpCircle size={14} /> Request more info (L3)</Btn>}
          <span className={guide}><Btn primary color={IR_TONE} onClick={() => setModal('declare')}><Siren size={14} /> Accept & declare incident</Btn></span>
        </>
      ) : (
        <Btn primary color={IR_TONE} onClick={() => { if (esc.incidentId) { setFocus(esc.incidentId); nav('/incident-response/warroom'); } }}><CheckCircle2 size={14} /> Open {esc.incidentId}</Btn>
      )}
    >
      <div className="stack" style={{ gap: 16 }}>
        {esc.status === 'info' && <Callout kind="warn">Waiting on L3: “{esc.infoAsk}”</Callout>}
        <Callout color={SEV_COLOR_IR[esc.sev]}><b>Recommended {SEV_LABEL[esc.sev]}</b> · {SEV_DESC[esc.sev]}. {esc.reason}</Callout>
        <KV rows={[
          ['SOC case', <button key="s" className="ir-link" onClick={() => nav(`/soc/ir?id=${esc.socId}&status=all`)}>{esc.socId} <ExternalLink size={11} /></button>],
          ...(esc.ticketId ? [['Customer ticket', <button key="t" className="ir-link" onClick={() => nav(`/soc/tickets?status=all`)}>{esc.ticketId} <ExternalLink size={11} /></button>] as [string, ReactNode]] : []),
          ['Tenant', `${tenant?.name} (${tenant?.city}) · ${tenant?.regimes.join(', ')}`],
          ['Detected', `${fmtT(esc.detectedAt)} · ${agoText(esc.detectedAt, now)}`],
          ['Escalated', `${fmtT(esc.escalatedAt)} by ${esc.escalatedBy} · SLA ${esc.slaMin} min`],
          ['Assets', esc.assets.join(', ')],
          ['Users', esc.users.join(', ') || 'none identified'],
          ['Data classes', esc.dataClasses.join(' · ')],
          ['Business services', esc.services.join(' · ')],
          ...(esc.actor ? [['Tradecraft overlap', `${esc.actor} (HexaInt)`] as [string, string]] : []),
        ]} />
        <div>
          <div className="section-label">Linked alerts & detections</div>
          <div className="list">
            {esc.alerts.map((a, i) => (
              <div key={i} className="list-row"><span className="list-main"><b>{a.title}</b><span>{a.tool} · {fmtT(a.t)}</span></span><Pill color="var(--sev-high)">{a.tool}</Pill></div>
            ))}
          </div>
        </div>
        <div>
          <div className="section-label">ATT&CK</div>
          <div className="chips">{esc.techniques.map((t) => <span key={t} className="ir-pill" title={techName(t)} style={{ ['--pc' as string]: 'var(--m-soc)' }}>{t} · {techName(t)}</span>)}</div>
        </div>
        <div>
          <div className="section-label">Escalation path</div>
          <Timeline items={[...esc.path.map((p) => ({ time: `${p.level} · ${fmtT(p.t).split(' ').pop()}`, title: p.who, body: p.note, color: p.level === 'L1' ? 'var(--sev-info)' : p.level === 'L2' ? 'var(--sev-medium)' : 'var(--sev-high)' })), { time: `L4 · ${fmtT(esc.escalatedAt).split(' ').pop()}`, title: 'Escalated to Incident Response', body: esc.reason, color: IR_TONE }]} />
        </div>
        <div>
          <div className="section-label">Analyst notes</div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0 }}>{esc.notes}</p>
        </div>
      </div>
      {modal === 'declare' && <DeclareModal esc={esc} onClose={() => setModal(null)} onDone={(id) => { setModal(null); onClose(); setFocus(id); nav('/incident-response/warroom'); }} />}
      {modal === 'info' && <InfoModal esc={esc} onClose={() => setModal(null)} />}
      {modal === 'merge' && (
        <MergeModal esc={esc} onClose={() => setModal(null)} onDone={(id) => { ir.merge(c, esc.id, id, actor); toast(`${esc.id} merged into ${id}; assets and timeline updated`); setModal(null); }} />
      )}
    </Drawer>
  );
}

function DeclareModal({ esc, onClose, onDone }: { esc: Escalation; onClose: () => void; onDone: (id: string) => void }) {
  const { c, actor, toast, state, ppl } = useIr();
  const [title, setTitle] = useState(esc.title);
  const [type, setType] = useState<IrType>(esc.type);
  const [sev, setSev] = useState<Sev>(esc.sev);
  const opts = commanderOptions(c);
  const [commander, setCommander] = useState(sev === 1 ? ppl.ciso.name : opts[1] ?? opts[0]);
  const [scope, setScope] = useState(`${esc.assets.join(', ')} on ${c.tenants.find((t) => t.id === esc.tenantId)?.short}`);
  useEffect(() => { if (sev === 1) setCommander(ppl.ciso.name); }, [sev, ppl.ciso.name]);
  const nextId = `IR-${new Date().getFullYear()}-${String(state.seq).padStart(4, '0')}`;
  const submit = () => {
    const id = ir.accept(c, esc.id, { title, type, sev, commander, scope }, actor);
    if (id) { toast(`${id} declared (${SEV_LABEL[sev]}) · war room open, clocks started, ${esc.alerts.length + 6} timeline entries written`); onDone(id); }
  };
  return (
    <Modal title="Accept & declare incident" sub={`${esc.id} → ${nextId}`} onClose={onClose} footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color={IR_TONE} onClick={submit} disabled={!title.trim()}><Siren size={14} /> Declare {SEV_LABEL[sev]}</Btn></>}>
      <div className="ir-form">
        <RetainerCoverNote />
        <label><span className="section-label" style={{ margin: 0 }}>Title</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Incident title" /></label>
        <div className="row2">
          <label><span className="section-label" style={{ margin: 0 }}>Type</span>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as IrType)} aria-label="Incident type">{IR_TYPE_IDS.map((t) => <option key={t} value={t}>{IR_TYPES[t].label}</option>)}</select>
          </label>
          <label><span className="section-label" style={{ margin: 0 }}>Incident commander</span>
            <select className="select" value={commander} onChange={(e) => setCommander(e.target.value)} aria-label="Incident commander">{opts.map((o) => <option key={o}>{o}</option>)}</select>
          </label>
        </div>
        <div>
          <span className="section-label">Severity</span>
          <div className="ir-seg">{([1, 2, 3, 4] as Sev[]).map((s) => <button key={s} type="button" className={sev === s ? 'on' : ''} onClick={() => setSev(s)}>{SEV_LABEL[s]}</button>)}</div>
          <div className="ir-sub" style={{ marginTop: 4 }}>{SEV_DESC[sev]}</div>
        </div>
        <label><span className="section-label" style={{ margin: 0 }}>Initial scope</span><textarea className="input" rows={2} value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Initial scope" /></label>
        <Callout>
          On declare: <b>{nextId}</b> is created; the war room opens on the Comms Hub bridge with channels and roles; {SEV_LABEL[sev]} notification clocks start from now under the tenant’s regimes ({c.tenants.find((t) => t.id === esc.tenantId)?.regimes.join(', ')}), the insurer ({c.insurance.carrier.split('/')[0].trim()}) and contracts; the escalation history is written to the hash-chained timeline.
        </Callout>
      </div>
    </Modal>
  );
}

function InfoModal({ esc, onClose }: { esc: Escalation; onClose: () => void }) {
  const { c, toast } = useIr();
  const [ask, setAsk] = useState('Confirm whether any data left the network and list every account used.');
  return (
    <Modal title="Request more info from L3" sub={`${esc.id} returns to ${esc.escalatedBy}`} onClose={onClose} footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color={IR_TONE} disabled={!ask.trim()} onClick={() => { ir.requestInfo(c, esc.id, ask); toast(`${esc.id} returned to L3 with your question`); onClose(); }}><HelpCircle size={14} /> Send to L3</Btn></>}>
      <div className="ir-form">
        <label><span className="section-label" style={{ margin: 0 }}>Question</span><textarea className="input" rows={3} value={ask} onChange={(e) => setAsk(e.target.value)} aria-label="Question for L3" /></label>
        <Callout kind="warn">The acceptance SLA pauses while L3 answers; the case stays visible in the queue.</Callout>
      </div>
    </Modal>
  );
}

function MergeModal({ esc, onClose, onDone }: { esc: Escalation; onClose: () => void; onDone: (incId: string) => void }) {
  const { active } = useIr();
  const [id, setId] = useState(active[0]?.id ?? '');
  return (
    <Modal title="Merge into an existing incident" sub={esc.id} onClose={onClose} footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color={IR_TONE} disabled={!id} onClick={() => onDone(id)}><GitMerge size={14} /> Merge</Btn></>}>
      <div className="ir-form">
        <label><span className="section-label" style={{ margin: 0 }}>Incident</span>
          <select className="select" value={id} onChange={(e) => setId(e.target.value)} aria-label="Incident">{active.map((i) => <option key={i.id} value={i.id}>{i.id} · {SEV_LABEL[i.sev]} · {i.title.slice(0, 60)}</option>)}</select>
        </label>
        <Callout>Assets ({esc.assets.join(', ')}) and the tenant join the incident scope; the escalation and its alerts are written to the incident timeline.</Callout>
      </div>
    </Modal>
  );
}
