import { useMemo, useState } from 'react';
import { Wand2, ChevronRight, Radio, FileSignature, Users, Inbox } from 'lucide-react';
import { Card, KpiStrip, Btn, Callout, Sources } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { useIntro } from '../../lib/useIntro';
import { fmtMoney } from '../../lib/format';
import { IR_TYPES, IR_TYPE_IDS, PHASE_LABEL, PHASE_COLOR, SEV_COLOR_IR, SEV_LABEL, timings, playbookProgress, guidedSpec, type IrIncident, type Sev } from '../../data/modules/incident';
import { useIr, useNow, IrPage, SevPill, TypePill, StatusPill, PhaseBar, RecordsDrawer, fmtSpan, fmtT, agoText, noticeClock, IR_TONE, Pill } from './parts';
import { ir } from './store';

const MIN = 60_000;
type Panel = 'active' | 'declare' | 'contain' | 'due' | 'room' | null;

export default function Overview() {
  return <IrPage><OverviewInner /></IrPage>;
}

function OverviewInner() {
  const { c, tools, active, closed, escalations, incidents, nav, scopeLabel, tenantId, setFocus } = useIr();
  const now = useNow(1000);
  const anim = useIntro(`ir-ov-${c.id}-${tenantId}`, 1400);
  const [panel, setPanel] = useState<Panel>(null);
  const awaiting = escalations.filter((e) => e.status === 'awaiting' || e.status === 'info');
  const bySev = ([1, 2, 3, 4] as Sev[]).map((s) => active.filter((i) => i.sev === s).length);
  const onBridge = active.reduce((n, i) => n + i.stakeholders.filter((s) => s.ackAt).length, 0);
  const due = active.flatMap((i) => i.notices.filter((n) => n.status !== 'sent' && n.status !== 'na' && n.dueAt && n.dueAt - now < 1440 * MIN).map((n) => ({ n, i })));
  due.sort((a, b) => (a.n.dueAt ?? 0) - (b.n.dueAt ?? 0));
  const declTimes = incidents.map((i) => (i.declaredAt - i.escalatedAt) / MIN);
  const meanDeclare = Math.round(declTimes.reduce((s, x) => s + x, 0) / Math.max(1, declTimes.length));
  const containTimes = closed.map((i) => timings(i).find((t) => t.id === 'contain')?.min ?? 0).filter((x) => x > 0);
  const meanContain = Math.round(containTimes.reduce((s, x) => s + x, 0) / Math.max(1, containTimes.length));
  const awaitingSign = incidents.filter((i) => i.report.status === 'generated' || i.report.status === 'requested');
  const g = guidedSpec(c);
  const siemSrc = `${tools.siem} · ${tools.edr} · HexaSOC escalations`;

  const stages = useMemo(() => [
    { id: 'esc', label: 'Escalation', n: awaiting.length, sub: 'awaiting L4', color: '#f0a338', to: '/incident-response/escalations' },
    { id: 'declare', label: 'Declare', n: active.filter((i) => i.phase === 'detect').length, sub: 'analysing', color: PHASE_COLOR.detect, to: '/incident-response/warroom' },
    { id: 'room', label: 'War room', n: active.length, sub: 'rooms open', color: IR_TONE, to: '/incident-response/warroom' },
    { id: 'contain', label: 'Contain', n: active.filter((i) => i.phase === 'contain').length, sub: 'containing', color: PHASE_COLOR.contain, to: '/incident-response/warroom' },
    { id: 'erad', label: 'Eradicate', n: active.filter((i) => i.phase === 'eradicate').length, sub: 'eradicating', color: PHASE_COLOR.eradicate, to: '/incident-response/playbooks' },
    { id: 'recover', label: 'Recover', n: active.filter((i) => i.phase === 'recover').length, sub: 'recovering', color: PHASE_COLOR.recover, to: '/incident-response/playbooks' },
    { id: 'report', label: 'Report', n: incidents.filter((i) => i.report.status !== 'none' && i.report.status !== 'issued').length, sub: 'in drafting', color: '#93d65a', to: '/incident-response/report' },
    { id: 'review', label: 'Review', n: incidents.filter((i) => i.review.status === 'scheduled' || i.review.status === 'in_progress' || i.phase === 'post').length, sub: 'reviews open', color: PHASE_COLOR.post, to: '/incident-response/review' },
  ], [awaiting.length, active, incidents]);

  const open = (i: IrIncident, to = '/incident-response/warroom') => { setFocus(i.id); nav(to); };
  const startGuided = () => {
    const escId = ir.startGuided(c);
    nav(`/incident-response/escalations?esc=${escId}`);
  };

  return (
    <>
      <p className="page-intro">
        <b>{scopeLabel}</b> · L4 incident response from SOC escalation to closed incident in one audited place. Escalations arrive from HexaSOC ({tools.siem}, {tools.edr}, {tools.idp}); war rooms run on the Comms Hub bridge; evidence is sealed in HexaCustody and reports are signed before they leave.
      </p>

      <Card tinted toneColor={IR_TONE}>
        <div className="row wrap" style={{ gap: 16, alignItems: 'center' }}>
          <span className="ico-box" style={{ ['--tone' as string]: IR_TONE, width: 44, height: 44 }}><Wand2 /></span>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="section-label" style={{ margin: 0 }}>Guided scenario · {c.sector}</div>
            <b style={{ fontSize: 14 }}>{g.title}</b>
            <div className="ir-sub" style={{ marginTop: 3 }}>Walks the full lifecycle for {c.short}: escalate → accept → war room → stakeholders → timeline → notifications → report, highlighting each page.</div>
          </div>
          <Btn primary color={IR_TONE} onClick={startGuided}><Wand2 size={14} /> Run a guided IR scenario</Btn>
        </div>
      </Card>

      <KpiStrip
        toneColor={IR_TONE}
        items={[
          { label: 'Escalations awaiting L4', value: Math.round(anim(awaiting.length)), hint: awaiting[0] ? `oldest ${agoText(Math.min(...awaiting.map((e) => e.escalatedAt)), now)}` : 'queue clear', toneColor: awaiting.length ? 'var(--sev-high)' : IR_TONE, to: '/incident-response/escalations', source: siemSrc },
          { label: 'Active incidents', value: Math.round(anim(active.length)), hint: bySev.map((n, i) => (n ? `${n} SEV${i + 1}` : '')).filter(Boolean).join(' · ') || 'none', toneColor: bySev[0] ? 'var(--sev-critical)' : IR_TONE, onClick: () => setPanel('active'), source: 'HexaView IR case store' },
          { label: 'In war rooms now', value: Math.round(anim(onBridge)), unit: 'people', hint: `${active.length} bridges open`, onClick: () => setPanel('room'), source: 'Comms Hub bridges · HexaView IR roster' },
          { label: 'Notifications due < 24 h', value: Math.round(anim(due.length)), hint: due[0] ? `next ${noticeClock(due[0].n, now).label}` : 'none due', toneColor: due.length ? 'var(--sev-critical)' : IR_TONE, onClick: () => setPanel('due'), source: 'HexaSOC regulatory clock engine · tenant regimes' },
          { label: 'Mean time to declare', value: Math.round(anim(meanDeclare)), unit: 'min', hint: 'escalation → declared', onClick: () => setPanel('declare'), source: 'HexaView IR audited timeline' },
          { label: 'Mean time to contain', value: fmtSpan(meanContain * MIN * Math.min(1, anim(1))), hint: `${closed.length} closed incidents`, onClick: () => setPanel('contain'), source: 'HexaView IR audited timeline' },
          { label: 'Reports awaiting sign-off', value: Math.round(anim(awaitingSign.length)), hint: 'legal + CISO', to: '/incident-response/report', source: 'HexaView Reporting · sign-off ledger' },
        ]}
      />

      <Card title="Incident lifecycle" sub="Escalation to review: where every case is now · click a stage to work it">
        <div className="ir-life">
          {stages.map((s, i) => (
            <button key={s.id} type="button" className="ir-life-step" onClick={() => nav(s.to)} title={`Open ${s.label}`}>
              <svg className="ir-life-hex" width="58" height="58" viewBox="0 0 58 58" aria-hidden>
                <path d="M29 3 L51.5 16 L51.5 42 L29 55 L6.5 42 L6.5 16 Z" fill={`color-mix(in srgb, ${s.color} ${s.n ? 18 : 6}%, transparent)`} stroke={s.color} strokeWidth={s.n ? 2.2 : 1.2} strokeOpacity={s.n ? 1 : 0.45} strokeLinejoin="round" />
              </svg>
              <b style={{ position: 'absolute', top: 23, color: s.n ? s.color : 'var(--text-muted)' }}>{Math.round(anim(s.n, i * 80))}</b>
              <span>{s.label}</span>
              <small>{s.sub}</small>
              {i < stages.length - 1 && <ChevronRight size={14} className="ir-life-arrow" />}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Active incidents" count={active.length} sub="Phase progress, commander, playbook completion and the next notification clock" actions={<Btn sm ghost onClick={() => nav('/incident-response/warroom')}><Radio size={13} /> War room</Btn>}>
        {active.length ? (
          <div className="ir-cards">
            {active.map((i) => {
              const next = i.notices.filter((n) => n.dueAt && n.status !== 'sent' && n.status !== 'na').sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))[0];
              const k = next ? noticeClock(next, now) : null;
              const pb = playbookProgress(i, tools);
              const tenant = c.tenants.find((t) => t.id === i.tenantIds[0]);
              return (
                <button key={i.id} type="button" className="ir-card" style={{ ['--pc' as string]: SEV_COLOR_IR[i.sev] }} onClick={() => open(i)}>
                  <div className="ir-card-row"><SevPill sev={i.sev} /><StatusPill inc={i} /><TypePill type={i.type} /><span className="ir-mono">{i.id}</span></div>
                  <b>{i.title}</b>
                  <PhaseBar inc={i} />
                  <div className="ir-card-row"><span>Commander <b style={{ color: 'var(--text-primary)' }}>{i.commander}</b></span><span>· {tenant?.short}</span><span>· T+{fmtSpan(now - i.declaredAt)}</span></div>
                  <div className="ir-card-clock"><span className="muted">Playbook</span><b>{pb.done}/{pb.total} steps</b></div>
                  {k && next && <div className="ir-card-clock"><span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{next.name}</span><b style={{ color: k.color }}>{k.label}</b></div>}
                  <div className="ir-card-row"><Users size={12} /> {i.stakeholders.filter((s) => s.ackAt).length}/{i.stakeholders.length} stakeholders engaged · {i.evidence.length} evidence items</div>
                </button>
              );
            })}
          </div>
        ) : <Callout kind="good">No active incidents in this scope.</Callout>}
      </Card>

      <div className="grid g-3-2">
        <Card title="Escalation queue" count={awaiting.length} sub="HexaSOC L3 → L4, oldest first, with the acceptance SLA" flush actions={<Btn sm ghost onClick={() => nav('/incident-response/escalations')}><Inbox size={13} /> Open queue</Btn>}>
          <div className="list">
            {awaiting.slice().sort((a, b) => a.escalatedAt - b.escalatedAt).slice(0, 6).map((e) => {
              const left = e.escalatedAt + e.slaMin * MIN - now;
              return (
                <div key={e.id} className="list-row clickable" style={{ cursor: 'pointer', padding: '10px 16px' }} onClick={() => nav(`/incident-response/escalations?esc=${e.id}`)}>
                  <span className="list-main">
                    <b><span className="ir-mono" style={{ color: IR_TONE }}>{e.id}</span> {e.title}</b>
                    <span>{e.socId} · {c.tenants.find((t) => t.id === e.tenantId)?.short} · by {e.escalatedBy}{e.status === 'info' ? ' · waiting on L3' : ''}</span>
                  </span>
                  <span className="row" style={{ gap: 6 }}><SevPill sev={e.sev} /><Pill color={left < 0 ? 'var(--bad)' : left < 10 * MIN ? 'var(--sev-high)' : 'var(--good)'}>{left < 0 ? `SLA -${fmtSpan(-left)}` : `${fmtSpan(left)} to accept`}</Pill></span>
                </div>
              );
            })}
            {!awaiting.length && <div className="empty">Queue clear.</div>}
          </div>
        </Card>
        <Card title="Incident mix" sub="Active and closed incidents by type · click to filter the timeline">
          <div className="stack" style={{ gap: 8 }}>
            {IR_TYPE_IDS.map((t) => ({ t, n: incidents.filter((i) => i.type === t).length, a: active.filter((i) => i.type === t).length })).filter((x) => x.n).sort((a, b) => b.n - a.n).map((x) => (
              <button key={x.t} type="button" className="bar-row" style={{ background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }} onClick={() => { const f = incidents.find((i) => i.type === x.t); if (f) { setFocus(f.id); nav('/incident-response/timeline'); } }}>
                <div className="bar-label"><b>{IR_TYPES[x.t].label}</b><span>{x.a} active · {x.n - x.a} closed</span></div>
                <div className="bar" style={{ ['--tone' as string]: IR_TYPES[x.t].color }}><i style={{ width: `${(x.n / Math.max(1, incidents.length)) * 100}%` }} /></div>
                <div className="bar-val">{x.n}</div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}><Sources items={[{ name: tools.siem }, { name: tools.edr }, { name: 'HexaView IR' }]} /></div>
        </Card>
      </div>

      <Card title="Recently closed" count={closed.length} sub="Every closed incident has an issued, signed report and a completed review" flush>
        <DataTable
          rows={closed}
          rowKey={(r) => r.id}
          onRowClick={(r) => open(r, '/incident-response/report')}
          pageSize={8}
          initialSort={{ key: 'closed', dir: 'desc' }}
          columns={[
            { key: 'id', header: 'ID', sort: (r) => r.id, render: (r) => <span className="ir-mono nowrap">{r.id}</span> },
            { key: 'title', header: 'Incident', sort: (r) => r.title, render: (r) => <><div className="t-main" style={{ maxWidth: 380, whiteSpace: 'normal' }}>{r.title}</div><div className="t-sub">{r.socId} · {c.tenants.find((t) => t.id === r.tenantIds[0])?.short}</div></> },
            { key: 'sev', header: 'SEV', sort: (r) => r.sev, render: (r) => <SevPill sev={r.sev} /> },
            { key: 'type', header: 'Type', sort: (r) => r.type, render: (r) => <TypePill type={r.type} /> },
            { key: 'dur', header: 'Duration', align: 'right', sort: (r) => (r.closedAt ?? 0) - r.declaredAt, render: (r) => fmtSpan((r.closedAt ?? now) - r.declaredAt) },
            { key: 'impact', header: 'Impact', align: 'right', sort: (r) => r.stats.impact, render: (r) => fmtMoney(r.stats.impact, c.currency) },
            { key: 'report', header: 'Report', render: (r) => <span className="nowrap"><FileSignature size={12} style={{ verticalAlign: -2, color: 'var(--good)' }} /> v{r.report.version} issued {r.report.issuedAt ? fmtT(r.report.issuedAt).split(' ').slice(0, 2).join(' ') : ''}</span> },
            { key: 'closed', header: 'Closed', align: 'right', sort: (r) => r.closedAt ?? 0, render: (r) => <span className="t-sub">{agoText(r.closedAt ?? now, now)}</span> },
          ]}
        />
      </Card>

      {panel === 'active' && (
        <RecordsDrawer title="Active incidents" source="HexaView IR case store" onClose={() => setPanel(null)}
          rows={active.map((i) => ({ id: i.id, title: i.title, sub: `${i.id} · ${PHASE_LABEL[i.phase]} · ${i.commander}`, right: <SevPill sev={i.sev} />, onClick: () => { setPanel(null); open(i); } }))} />
      )}
      {panel === 'room' && (
        <RecordsDrawer title="People in war rooms now" source="Comms Hub bridges · HexaView IR roster" onClose={() => setPanel(null)}
          rows={active.flatMap((i) => i.stakeholders.filter((s) => s.ackAt).map((s) => ({ id: `${i.id}-${s.id}`, title: s.name, sub: `${i.id} · ${s.incidentRole} · ${s.org}`, right: <Pill color={s.group === 'internal' ? IR_TONE : 'var(--m-core)'}>{s.group}</Pill>, onClick: () => { setPanel(null); open(i, '/incident-response/stakeholders'); } })))} />
      )}
      {panel === 'due' && (
        <RecordsDrawer title="Notifications due in the next 24 hours" source="HexaSOC regulatory clock engine · tenant regimes" onClose={() => setPanel(null)}
          rows={due.map(({ n, i }) => ({ id: n.id, title: n.name, sub: `${i.id} · ${n.recipient} · ${n.status}`, right: <b style={{ color: noticeClock(n, now).color, fontSize: 12 }}>{noticeClock(n, now).label}</b>, onClick: () => { setPanel(null); open(i, '/incident-response/notifications'); } }))} />
      )}
      {panel === 'declare' && (
        <RecordsDrawer title="Time from escalation to declaration" source="HexaView IR audited timeline" onClose={() => setPanel(null)}
          rows={incidents.slice().sort((a, b) => (b.declaredAt - b.escalatedAt) - (a.declaredAt - a.escalatedAt)).map((i) => ({ id: i.id, title: i.title, sub: `${i.id} · ${SEV_LABEL[i.sev]} · escalated ${fmtT(i.escalatedAt)}`, right: <b style={{ fontSize: 12 }}>{fmtSpan(i.declaredAt - i.escalatedAt)}</b>, onClick: () => { setPanel(null); open(i, '/incident-response/timeline'); } }))} />
      )}
      {panel === 'contain' && (
        <RecordsDrawer title="Time to contain (closed incidents)" source="HexaView IR audited timeline" onClose={() => setPanel(null)}
          rows={closed.map((i) => ({ id: i.id, title: i.title, sub: `${i.id} · ${SEV_LABEL[i.sev]}`, right: <b style={{ fontSize: 12 }}>{fmtSpan((timings(i).find((t) => t.id === 'contain')?.min ?? 0) * MIN)}</b>, onClick: () => { setPanel(null); open(i, '/incident-response/review'); } }))} />
      )}
    </>
  );
}
