import { useMemo, useState } from 'react';
import { Siren, Phone, Gavel, Users, Mic, MicOff, Plus, Radio } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { warroom, type TaskStatus, type WarClock } from '../../data/modules/ops';
import { Card, KpiStrip, Badge, StatusBadge, Btn, Callout, Bar, Timeline, Tabs, Sources, SevBadge } from '../../components/ui';
import { Chart, SEV_HEX, PALETTE } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Overlay';
import { fmtDur, fmtNum } from '../../lib/format';
import { rng } from '../../lib/rng';
import { OPS_TONE, useSeconds, fmtCountdown, useRecords, scrollToId, StatLink } from './parts';

const TASK_COLS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Done' },
];
const NEXT: Record<TaskStatus, TaskStatus> = { todo: 'in_progress', in_progress: 'done', blocked: 'in_progress', done: 'done' };
const SVC_COLOR = { down: 'var(--bad)', degraded: 'var(--sev-medium)', recovering: 'var(--m-core)', operational: 'var(--good)' };
const KIND_COLOR = { detect: 'var(--sev-high)', decide: 'var(--m-ops)', contain: 'var(--m-soc)', comms: 'var(--m-ai)', recover: 'var(--good)' };
const CH_COLOR: Record<string, string> = { internal: 'var(--sev-info)', regulator: 'var(--sev-high)', customers: 'var(--m-core)', press: 'var(--m-ai)', partners: 'var(--m-comply)', 'law enforcement': 'var(--bad)' };

export default function Warroom() {
  const { customer, tenantId } = useApp();
  return <WarroomInner key={`${customer.id}-${tenantId}`} />;
}

function WarroomInner() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const sec = useSeconds();
  const days = rangeDays(timeRange);
  const w = useMemo(() => warroom(c), [c]);
  const [tasks, setTasks] = useState(w.tasks);
  const [decisions, setDecisions] = useState(w.decisions);
  const [comms, setComms] = useState(w.comms);
  const [chan, setChan] = useState<'all' | string>('all');
  const [logOpen, setLogOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [onBridge, setOnBridge] = useState(false);
  const [clocks, setClocks] = useState<WarClock[]>(w.clocks);
  const [, openRecords, recordsNode] = useRecords();

  const elapsedMin = w.declaredMinAgo + sec / 60;
  const tenant = c.tenants.find((t) => t.id === w.tenantId);
  const scopedAway = tenantId !== 'all' && tenantId !== w.tenantId;
  const done = tasks.filter((t) => t.status === 'done').length;
  const running = clocks.filter((k) => k.status === 'running' && k.dueMin !== null);
  const nextClock = [...running].sort((a, b) => (a.dueMin ?? 0) - (b.dueMin ?? 0))[0];
  const impacted = w.services.filter((s) => s.status !== 'operational');
  const recovery = Math.round(w.services.reduce((s, x) => s + x.recovery, 0) / w.services.length);
  const connectorsUsed = c.connectors.filter((k) => ['SIEM', 'EDR / XDR', 'Identity', 'ITSM'].includes(k.category)).slice(0, 4);

  // Recovery curve: from declaration to now, then projection.
  const steps = 12;
  const start = Math.max(5, recovery - 60);
  const curve = Array.from({ length: steps + 1 }, (_, i) => Math.round(start + (recovery - start) * Math.pow(i / steps, 0.8)));
  const proj = Array.from({ length: 7 }, (_, i) => Math.min(100, Math.round(recovery + ((100 - recovery) * (i + 1)) / 7)));
  const curveLabels = [...Array.from({ length: steps + 1 }, (_, i) => `T+${fmtDur((w.declaredMinAgo * i) / steps)}`), ...proj.map((_, i) => `+${(i + 1) * 2}h`)];

  // Incident-related alerts over the selected range (spike in the last hours).
  const buckets = days === 1 ? 24 : days;
  const r = rng(`ops-war-alerts-${c.id}-${days}`);
  const base = Array.from({ length: buckets }, () => r.int(4, 18));
  const spikeFrom = days === 1 ? buckets - Math.ceil(w.declaredMinAgo / 60) - 1 : buckets - 1;
  const alerts = base.map((v, i) => (i >= spikeFrom ? v + r.int(60, 160) : v));

  const advanceTask = (id: string) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status: NEXT[t.status] } : t)));
    const t = tasks.find((x) => x.id === id);
    if (t && t.status !== 'done') toast(`Task "${t.title}" → ${NEXT[t.status].replace('_', ' ')}; logged to the incident record`);
  };

  const clockRemaining = (k: WarClock) => (k.dueMin === null ? null : (k.dueMin - elapsedMin) * 60);
  const srcLine = `${connectorsUsed.map((k) => k.product).join(' · ')} · HexaSOC case ${w.id}`;
  const serviceRecords = () =>
    openRecords({
      title: `Business services · ${w.id}`,
      sub: `${impacted.length} of ${w.services.length} impacted`,
      source: `HexaView service map · ${c.connectors.find((k) => k.category === 'ITSM')?.product ?? 'ITSM'} CMDB`,
      rows: w.services.map((x) => ({ key: x.name, main: x.name, meta: `${x.note} · RTO ${x.rto}`, right: <><StatusBadge value={x.status} map={SVC_COLOR} /> <b style={{ marginLeft: 6 }}>{x.recovery}%</b></>, color: SVC_COLOR[x.status] })),
    });
  const alertRecords = () =>
    openRecords({
      title: `Detections correlated to ${w.id}`,
      source: srcLine,
      rows: [
        ...w.timeline.filter((e) => e.kind === 'detect').map((e) => ({ key: e.title, main: e.title, meta: `T+${fmtDur(e.t)} · ${e.body}`, color: 'var(--sev-high)' })),
        ...w.ioc.map((i) => ({ key: i, main: <span className="mono">{i}</span>, meta: 'Indicator of compromise · pushed to HexaInt and the SIEM watchlist', color: 'var(--m-ai)' })),
      ],
    });

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> crisis war room for <b>{w.id}</b> at {tenant?.name}: one shared picture for the bridge, fed live by {connectorsUsed.map((k) => k.product).join(', ')} and HexaSOC, with regulatory clocks, comms and decisions recorded to the audit ledger.
      </p>
      {scopedAway && (
        <Callout kind="info">
          You are scoped to <b>{c.tenants.find((t) => t.id === tenantId)?.name}</b>, which is not directly impacted. The group-level major incident at {tenant?.short} is shown; this tenant's shared services are listed below.
        </Callout>
      )}

      <div className="ops-banner">
        <span className="ops-blink" />
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <SevBadge sev={w.severity} solid />
            <Badge color="var(--sev-high)">{w.phase}</Badge>
            <span className="mono muted" style={{ fontSize: 11.5 }}>{w.id} · {tenant?.short}</span>
          </div>
          <h3 style={{ marginTop: 6 }}>{w.title}</h3>
          <div className="secondary" style={{ fontSize: 12.5, marginTop: 4, maxWidth: 900 }}>{w.summary}</div>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end', gap: 6 }}>
          <span className="mono" style={{ fontSize: 22, fontWeight: 700 }}>T+{fmtCountdown(elapsedMin * 60)}</span>
          <span className="muted" style={{ fontSize: 11 }}>Commander {w.commander}</span>
          <div className="row" style={{ gap: 6 }}>
            <Btn sm onClick={() => { setOnBridge(!onBridge); toast(onBridge ? 'Left the bridge' : `Joined ${w.bridge}; your attendance is logged`); }}>
              {onBridge ? <MicOff size={13} /> : <Phone size={13} />} {onBridge ? 'Leave bridge' : 'Join bridge'}
            </Btn>
            <Btn sm primary color={OPS_TONE} onClick={() => setLogOpen(true)}>
              <Gavel size={13} /> Log decision
            </Btn>
          </div>
        </div>
      </div>

      <KpiStrip
        toneColor={OPS_TONE}
        items={[
          { label: 'Elapsed', value: fmtDur(elapsedMin), unit: 'since declared', onClick: () => scrollToId('ops-wr-timeline'), source: `Incident record ${w.id} · ${srcLine}` },
          { label: 'Tasks done', value: `${done}/${tasks.length}`, bar: (done / tasks.length) * 100, onClick: () => scrollToId('ops-wr-tasks'), source: `War-room task board · ${c.connectors.find((k) => k.category === 'ITSM')?.product ?? 'ITSM'}` },
          { label: 'Clocks running', value: running.length, unit: `of ${clocks.length}`, onClick: () => scrollToId('ops-wr-clocks'), source: 'Regulatory obligations register (HexaComply)' },
          { label: 'Next deadline', value: nextClock ? fmtCountdown(clockRemaining(nextClock) ?? 0) : '—', unit: nextClock?.name.split('(')[0], toneColor: 'var(--sev-high)', onClick: () => scrollToId('ops-wr-clocks'), source: 'Regulatory obligations register (HexaComply)' },
          { label: 'Services impacted', value: impacted.length, unit: `of ${w.services.length}`, onClick: serviceRecords, source: 'HexaView service map · CMDB' },
          { label: 'Recovery', value: `${recovery}%`, bar: recovery, toneColor: 'var(--good)', onClick: () => scrollToId('ops-wr-services'), source: 'Service recovery status from the bridge' },
        ]}
      />

      <div className="grid g-2-1">
        <div id="ops-wr-timeline" style={{ minWidth: 0, scrollMarginTop: 80 }}>
        <Card title={<><span className="live-dot" /> Live timeline</>} sub={`From detection to now · ${w.timeline.length} entries`}>
          <Timeline
            items={[...w.timeline].reverse().map((e) => ({
              time: `T+${fmtDur(e.t)}`,
              title: e.title,
              body: e.body,
              color: KIND_COLOR[e.kind],
            }))}
          />
          <div className="card-foot">
            <Sources items={connectorsUsed.map((k) => ({ name: k.product, status: k.status }))} />
          </div>
        </Card>
        </div>
        <div id="ops-wr-clocks" style={{ minWidth: 0, scrollMarginTop: 80 }}>
        <Card title="Regulatory & contractual clocks" sub="Counting down live from declaration">
          <div className="stack" style={{ gap: 8 }}>
            {clocks.map((k) => {
              const rem = clockRemaining(k);
              const urgent = k.status === 'running' && rem !== null && rem < 3 * 3600;
              return (
                <div key={k.name} className={`ops-clock ${urgent ? 'urgent' : ''} ${k.status === 'submitted' ? 'done' : ''}`}>
                  <div className="row" style={{ gap: 8 }}>
                    <b style={{ fontSize: 12, flex: 1 }}>{k.name}</b>
                    <StatusBadge value={k.status} map={{ submitted: 'var(--good)', running: 'var(--sev-high)', not_applicable: 'var(--sev-info)', conditional: 'var(--sev-medium)' }} />
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>{k.body}</div>
                  {k.status === 'running' && rem !== null && (
                    <div className="row" style={{ gap: 8 }}>
                      <span className="t" style={{ color: urgent ? 'var(--sev-high)' : undefined }}>{fmtCountdown(rem)}</span>
                      <span className="spacer" />
                      <Btn sm onClick={() => { setClocks((cs) => cs.map((x) => (x.name === k.name ? { ...x, status: 'submitted', submittedMin: elapsedMin } : x))); toast(`Marked submitted: ${k.name}; evidence of submission attached to ${w.id}`); }}>Mark submitted</Btn>
                    </div>
                  )}
                  {k.status === 'running' && k.dueMin !== null && <Bar value={elapsedMin - k.startMin} max={k.dueMin - k.startMin} color={urgent ? 'var(--sev-high)' : OPS_TONE} size="thin" />}
                  {k.status === 'submitted' && <span className="muted" style={{ fontSize: 11 }}>Submitted at T+{fmtDur(k.submittedMin ?? 0)}</span>}
                </div>
              );
            })}
          </div>
        </Card>
        </div>
      </div>

      <div id="ops-wr-tasks" style={{ scrollMarginTop: 80 }}>
      <Card title="Task board" count={tasks.length} sub="Click a card to advance its status · owners and due times relative to declaration">
        <div className="ops-board">
          {TASK_COLS.map((col) => {
            const ts = tasks.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className="ops-col">
                <h4>
                  {col.label} <span>{ts.length}</span>
                </h4>
                {ts.map((t) => {
                  const dueIn = (t.dueMin - elapsedMin) * 60;
                  return (
                    <button key={t.id} className="ops-task" onClick={() => advanceTask(t.id)}>
                      <b>{t.title}</b>
                      <span>{t.owner}</span>
                      <div className="row" style={{ gap: 6 }}>
                        <Badge color={OPS_TONE}>{t.stream}</Badge>
                        <span className="spacer" />
                        <span style={{ color: t.status !== 'done' && dueIn < 0 ? 'var(--bad)' : undefined }}>{t.status === 'done' ? 'done' : dueIn < 0 ? `overdue ${fmtDur(-dueIn / 60)}` : `due in ${fmtDur(dueIn / 60)}`}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Card>
      </div>

      <div className="grid g-2-1">
        <Card
          title="Comms log"
          count={comms.length}
          sub="Internal, regulator, customers, partners and press"
          flush
          actions={<Tabs value={chan} onChange={setChan} color={OPS_TONE} tabs={[{ id: 'all', label: 'All' }, ...[...new Set(w.comms.map((m) => m.channel))].map((x) => ({ id: x, label: x[0].toUpperCase() + x.slice(1) }))]} />}
        >
          <DataTable
            rows={comms.filter((m) => chan === 'all' || m.channel === chan)}
            rowKey={(m, i) => `${m.t}-${i}`}
            initialSort={{ key: 't', dir: 'desc' }}
            onRowClick={(m) => {
              if (m.status !== 'sent') {
                setComms((cs) => cs.map((x) => (x === m ? { ...x, status: 'sent' } : x)));
                toast(`Sent: "${m.subject}" to ${m.to}; copy filed to the incident record`);
              }
            }}
            columns={[
              { key: 't', header: 'When', sort: (m) => m.t, render: (m) => `T+${fmtDur(m.t)}` },
              { key: 'ch', header: 'Channel', sort: (m) => m.channel, render: (m) => <Badge color={CH_COLOR[m.channel]}>{m.channel}</Badge> },
              { key: 'to', header: 'To · subject', render: (m) => (<><div className="t-main">{m.to}</div><div className="t-sub">{m.subject}</div></>) },
              { key: 'by', header: 'By', render: (m) => <span style={{ fontSize: 12 }}>{m.by}</span> },
              { key: 'st', header: 'Status', sort: (m) => m.status, render: (m) => <StatusBadge value={m.status} map={{ sent: 'var(--good)', approved: 'var(--m-core)', draft: 'var(--sev-medium)' }} /> },
            ]}
          />
          <div className="muted" style={{ fontSize: 11, padding: '8px 18px' }}>Click a draft or approved message to send it.</div>
        </Card>
        <Card title="Bridge" count={w.participants.length + (onBridge ? 1 : 0)} sub={w.bridge} actions={<Users size={16} style={{ color: OPS_TONE }} />}>
          <div className="list">
            {onBridge && (
              <div className="list-row">
                <Mic size={14} style={{ color: 'var(--good)' }} />
                <span className="list-main"><b>You</b><span>Joined just now</span></span>
                <Badge color="var(--good)" dot>On</Badge>
              </div>
            )}
            {w.participants.map((p) => (
              <div key={p.name} className="list-row">
                {p.on ? <Mic size={14} style={{ color: 'var(--good)' }} /> : <MicOff size={14} className="muted" />}
                <span className="list-main">
                  <b>{p.name}</b>
                  <span>{p.role} · {p.org} · joined T+{fmtDur(p.joinedMin)}</span>
                </span>
                <Badge color={p.on ? 'var(--good)' : 'var(--sev-info)'} dot>{p.on ? 'On' : 'Away'}</Badge>
              </div>
            ))}
          </div>
          <div className="card-foot">
            <span>Indicators: {w.ioc.join(' · ')}</span>
          </div>
        </Card>
      </div>

      <div className="grid g-2-1">
        <div id="ops-wr-services" style={{ minWidth: 0, scrollMarginTop: 80 }}>
        <Card title="Impacted business services" sub={`${c.short}'s business services · recovery against RTO`}>
          <div className="stack" style={{ gap: 10 }}>
            {w.services.map((s) => (
              <div key={s.name} className="row" style={{ gap: 12, fontSize: 12 }}>
                <span style={{ width: 210 }}>
                  <b>{s.name}</b>
                  <div className="muted" style={{ fontSize: 11 }}>{s.note}</div>
                </span>
                <span style={{ width: 98 }}><StatusBadge value={s.status} map={SVC_COLOR} /></span>
                <div style={{ flex: 1 }}><Bar value={s.recovery} color={SVC_COLOR[s.status]} /></div>
                <span className="num" style={{ width: 40, textAlign: 'right', fontWeight: 700 }}>{s.recovery}%</span>
                <span className="muted" style={{ width: 92, textAlign: 'right', fontSize: 11 }}>RTO {s.rto}</span>
              </div>
            ))}
          </div>
          <div className="grid g2" style={{ marginTop: 14 }}>
            <div>
              <div className="section-label">Recovery progress and projection</div>
              <Chart
                height={170}
                option={{
                  tooltip: { trigger: 'axis' },
                  xAxis: { type: 'category', data: curveLabels, axisLabel: { interval: 3 } },
                  yAxis: { type: 'value', max: 100 },
                  series: [
                    { name: 'Recovered', type: 'line', data: [...curve, ...proj.map(() => null)], areaStyle: { opacity: 0.18 }, lineStyle: { color: PALETTE[1] }, itemStyle: { color: PALETTE[1] }, symbol: 'none' },
                    { name: 'Projection', type: 'line', data: [...curve.map((v, i) => (i === steps ? v : null)), ...proj], lineStyle: { type: 'dashed', color: PALETTE[1] }, itemStyle: { color: PALETTE[1] }, symbol: 'none' },
                  ],
                }}
              />
            </div>
            <div>
              <div className="section-label">Incident-related alerts · {rangeLabel(timeRange)}</div>
              <Chart
                height={170}
                option={{
                  tooltip: { trigger: 'axis' },
                  xAxis: { type: 'category', data: alerts.map((_, i) => (days === 1 ? `-${buckets - 1 - i}h` : `-${buckets - 1 - i}d`)), axisLabel: { interval: Math.ceil(buckets / 6) } },
                  yAxis: { type: 'value' },
                  series: [{ type: 'bar', data: alerts.map((v, i) => ({ value: v, itemStyle: { color: i >= spikeFrom ? SEV_HEX.high : '#8a9bc0' } })) }],
                }}
              />
              <StatLink value={fmtNum(alerts.reduce((s, v) => s + v, 0))} label={`alerts correlated to ${w.id}`} onClick={alertRecords} source={srcLine} />
            </div>
          </div>
        </Card>
        </div>
        <Card title="Decision log" count={decisions.length} sub="Who decided what, and why" actions={<Btn sm onClick={() => setLogOpen(true)}><Plus size={13} /> Log</Btn>}>
          <Timeline items={[...decisions].reverse().map((d) => ({ time: `T+${fmtDur(d.t)}`, title: d.decision, body: `${d.by} · ${d.rationale}`, color: OPS_TONE }))} />
        </Card>
      </div>

      {recordsNode}
      {logOpen && (
        <Modal
          title="Log a decision"
          sub={`${w.id} · recorded to the audit ledger with your identity`}
          onClose={() => setLogOpen(false)}
          footer={
            <>
              <Btn onClick={() => setLogOpen(false)}>Cancel</Btn>
              <Btn
                primary
                color={OPS_TONE}
                disabled={!draft.trim()}
                onClick={() => {
                  setDecisions((ds) => [...ds, { t: Math.round(elapsedMin), decision: draft.trim(), by: w.commander, rationale: 'Logged from the war room' }]);
                  setDraft('');
                  setLogOpen(false);
                  toast('Decision logged and timestamped in the ledger');
                }}
              >
                <Radio size={14} /> Log decision
              </Btn>
            </>
          }
        >
          <textarea className="input" rows={4} style={{ width: '100%' }} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. Hold the next customer update until the restore completes" />
          <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
            <Siren size={12} style={{ verticalAlign: -2 }} /> Decisions feed the post-incident report and the regulator intermediate/final reports.
          </div>
        </Modal>
      )}
    </>
  );
}
