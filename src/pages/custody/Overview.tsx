import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, FileLock2, Gauge, Link2, Zap, FolderLock, ArrowRightLeft, HardDrive, Cloud } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { custodyScope, custodyFlows, custodyAnomalies, custodyEvents, accelStats, CUSTODY_NOTE, type CustodyAnomaly, type CustodyFlow } from '../../data/modules/custody';
import { forCustomer } from '../../data/customerMap';
import { KpiStrip, Card, Badge, SevBadge, KV, IcoBox, Legend, MiniStat, Sources, Btn, Callout, SEV_ORDER } from '../../components/ui';
import { Chart, PALETTE } from '../../components/Chart';
import { FlowMap, type FlowColumn, type FlowLink } from '../../components/FlowMap';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { fmtAgo, fmtNum, dayLabels, hourLabels } from '../../lib/format';
import { CUSTODY_TONE, RevokeModal, type RevokeRequest } from './parts';

const BAD = '#f8646f';
const MAX_DEST = 7;

export default function CustodyOverview() {
  const { customer: c, tenantId, timeRange } = useApp();
  const nav = useNavigate();
  const days = rangeDays(timeRange);
  const sc = useMemo(() => custodyScope(c, tenantId), [c, tenantId]);
  const note = forCustomer(CUSTODY_NOTE, c);
  const flows = useMemo(() => custodyFlows(c, tenantId, days), [c, tenantId, days]);
  const anomalies = useMemo(() => custodyAnomalies(c, tenantId), [c, tenantId]);
  const events = useMemo(() => custodyEvents(c, tenantId, days), [c, tenantId, days]);
  const accel = accelStats(c, tenantId);
  const [sel, setSel] = useState<CustodyAnomaly | null>(null);
  const [revoke, setRevoke] = useState<RevokeRequest | null>(null);
  const [handled, setHandled] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState<{ label: string; rows: CustodyFlow[] } | null>(null);
  const h = sc.h;

  const total = flows.reduce((s, f) => s + f.count, 0);
  const unsCount = flows.filter((f) => !f.sanctioned).reduce((s, f) => s + f.count, 0);

  const graph = useMemo(() => {
    // Keep the map readable: top destinations by volume, the rest folded into one card.
    const destVol = new Map<string, number>();
    for (const f of flows) destVol.set(f.dest, (destVol.get(f.dest) ?? 0) + f.count);
    const badDests = new Set(flows.filter((f) => !f.sanctioned).map((f) => f.dest));
    const ranked = [...destVol.entries()].sort((a, b) => Number(badDests.has(a[0])) - Number(badDests.has(b[0])) || b[1] - a[1]).map(([d]) => d);
    const goodKeep = ranked.filter((d) => !badDests.has(d)).slice(0, Math.max(2, MAX_DEST - badDests.size));
    const keep = new Set([...goodKeep, ...badDests]);
    const OTHER = 'Other sanctioned destinations';
    const destOf = (f: CustodyFlow) => (keep.has(f.dest) ? f.dest : OTHER);
    const sum = (pred: (f: CustodyFlow) => boolean) => flows.filter(pred).reduce((s, f) => s + f.count, 0);
    const projects = [...new Set(flows.map((f) => f.project))];
    const actions = [...new Set(flows.map((f) => f.action))];
    const dests = [...new Set(flows.map(destOf))].sort((a, b) => Number(badDests.has(a)) - Number(badDests.has(b)) || sum((f) => destOf(f) === b) - sum((f) => destOf(f) === a));
    const badAction = new Set(actions.filter((a) => flows.filter((f) => f.action === a).every((f) => !f.sanctioned)));
    const open = (label: string, pred: (f: CustodyFlow) => boolean) => () => setFocus({ label, rows: flows.filter(pred) });
    const cols: FlowColumn[] = [
      { label: 'Project', nodes: projects.map((p, i) => ({ id: `p:${p}`, title: p, icon: <FolderLock size={13} />, count: fmtNum(sum((f) => f.project === p)), sub: flows.some((f) => f.project === p && !f.sanctioned) ? `${fmtNum(sum((f) => f.project === p && !f.sanctioned))} off-list` : 'all sanctioned', color: PALETTE[i % PALETTE.length], onClick: open(p, (f) => f.project === p) })) },
      { label: 'Action', nodes: actions.map((a) => ({ id: `a:${a}`, title: a, count: fmtNum(sum((f) => f.action === a)), sub: badAction.has(a) ? 'can leave' : 'stays sanctioned', state: badAction.has(a) ? 'bad' as const : undefined, onClick: open(a, (f) => f.action === a) })) },
      { label: 'Destination', nodes: dests.map((d) => ({ id: `d:${d}`, title: d, icon: badDests.has(d) ? <HardDrive size={13} /> : d === OTHER ? <ArrowRightLeft size={13} /> : <Cloud size={13} />, count: fmtNum(sum((f) => destOf(f) === d)), sub: badDests.has(d) ? 'unsanctioned' : 'sanctioned', state: badDests.has(d) ? 'bad' as const : 'good' as const, onClick: open(d, (f) => destOf(f) === d) })) },
    ];
    const agg = new Map<string, FlowLink>();
    const add = (from: string, to: string, v: number, bad: boolean) => {
      const k = `${from}>${to}`;
      const x = agg.get(k) ?? { from, to, value: 0, bad: false };
      x.value += v;
      x.bad = x.bad || bad;
      agg.set(k, x);
    };
    for (const f of flows) {
      add(`p:${f.project}`, `a:${f.action}`, f.count, !f.sanctioned);
      add(`a:${f.action}`, `d:${destOf(f)}`, f.count, !f.sanctioned);
    }
    return { cols, links: [...agg.values()], projects: projects.length, dests: dests.length };
  }, [flows]);

  const labels = events.hourly ? hourLabels(24) : dayLabels(events.buckets);
  const sorted = anomalies.slice().sort((a, b) => SEV_ORDER.indexOf(a.sev) - SEV_ORDER.indexOf(b.sev) || a.ageMin - b.ageMin);
  const custodyConn = c.connectors.find((k) => k.category === 'Custody');
  const SRC = [custodyConn ? `${custodyConn.vendor === 'HexaShield' ? '' : `${custodyConn.vendor} `}${custodyConn.product}` : 'HexaCustody agents', ...sc.sources.map((s) => s.name)].filter((v, i, a) => a.indexOf(v) === i).join(' · ');
  const toTriage = () => document.getElementById('custody-triage')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · {sc.tenantName}. Custody of {sc.label.toLowerCase()} across every organisation that touches it, tracked by {custodyConn ? `${custodyConn.product}` : 'HexaCustody agents'} with {sc.sources.filter((s) => !s.name.startsWith('HexaCustody')).map((s) => s.name).join(', ') || 'identity and DLP context'}. Tag on create · verify on open · report on egress.
      </p>

      <KpiStrip
        toneColor={CUSTODY_TONE}
        items={[
          { label: 'Assets', hint: 'under custody', value: fmtNum(h.assetsUnderCustody), to: '/custody/lineage', source: SRC },
          { label: 'Integrity', hint: 'tracked & verified', value: `${sc.integrityPct}%`, bar: sc.integrityPct, to: '/custody/lineage?status=broken', source: `${SRC} · signature checks` },
          { label: 'Anomalies', hint: 'open', value: h.anomalies, toneColor: 'var(--bad)', onClick: toTriage, source: SRC, delta: { text: `${anomalies.filter((a) => a.sev === 'critical' || a.sev === 'high').length} critical or high`, good: false } },
          { label: 'Agents', hint: 'connected', value: fmtNum(h.agents), to: '/custody/telemetry', source: SRC },
          { label: 'Transfers', hint: '7 d', value: fmtNum(h.transfers7d), onClick: () => setFocus({ label: `All custody events · ${rangeLabel(timeRange).toLowerCase()}`, rows: flows }), source: SRC, delta: { text: `${fmtNum(total)} in ${rangeLabel(timeRange).toLowerCase()}`, good: true } },
          { label: 'Off the list', hint: 'unsanctioned', value: fmtNum(unsCount), toneColor: 'var(--bad)', onClick: () => setFocus({ label: 'Unsanctioned hand-offs', rows: flows.filter((f) => !f.sanctioned) }), source: SRC },
        ]}
      />

      <Card
        title={<><Link2 size={15} /> Content in motion</>}
        sub={<><b>{fmtNum(total)}</b> custody events in {rangeLabel(timeRange).toLowerCase()} · <b style={{ color: 'var(--bad)' }}>{fmtNum(unsCount)} ({total ? ((unsCount / total) * 100).toFixed(1) : '0'}%)</b> ended somewhere off the sanctioned list · click any card for the records</>}
        toneColor={CUSTODY_TONE}
        actions={<Legend items={[{ label: 'Inside the sanctioned chain', color: '#4f8cff' }, { label: 'Leaves it unsanctioned', color: '#f0466e' }]} />}
      >
        <div className="custody-flow">
          <FlowMap columns={graph.cols} links={graph.links} footer={<span className="row wrap" style={{ gap: 10 }}>Each unsanctioned hand-off is bound to a forensic watermark and appears in triage below. <Sources items={sc.sources.map((s) => ({ name: s.name, status: s.status }))} /></span>} />
        </div>
      </Card>

      <div id="custody-triage" />
      <Card title={<><FileLock2 size={15} /> Immediate triage</>} count={anomalies.length} sub="Custody anomalies ranked by severity · click to investigate or revoke" toneColor="var(--bad)" flush
        actions={<span className="chips">{(['critical', 'high', 'medium'] as const).map((s) => <Badge key={s} color={s === 'critical' ? 'var(--sev-critical)' : s === 'high' ? 'var(--sev-high)' : 'var(--sev-medium)'}>{anomalies.filter((a) => a.sev === s).length} {s}</Badge>)}</span>}>
        <DataTable
          rows={sorted}
          rowKey={(a) => a.id}
          onRowClick={setSel}
          columns={[
            { key: 'sev', header: 'Severity', render: (a) => <SevBadge sev={a.sev} /> },
            { key: 't', header: 'Anomaly', render: (a) => (<><div className="t-main" style={{ whiteSpace: 'normal' }}>{a.title}</div><div className="t-sub">{a.asset}</div></>) },
            { key: 'who', header: 'Who · where', render: (a) => (<><div>{a.actor}</div><div className="t-sub">{a.org} · {a.machine}</div></>) },
            { key: 'dest', header: 'Action → destination', render: (a) => <span className="t-sub">{a.action} → {a.destination}</span> },
            { key: 'age', header: 'Detected', sort: (a) => -a.ageMin, render: (a) => <span className="t-sub">{fmtAgo(a.ageMin)}</span> },
            { key: 'st', header: 'Status', render: (a) => handled[a.id] ? <Badge color="var(--good)" dot>{handled[a.id]}</Badge> : <Badge color="var(--bad)" dot>Open</Badge> },
          ]}
          empty="No custody anomalies in this scope."
        />
      </Card>

      <div className="grid g-3-2">
        <Card title="Custody events over time" sub={`${rangeLabel(timeRange)} · ${events.hourly ? 'hourly' : 'daily'}`} actions={<Legend items={[{ label: 'Transfers', color: PALETTE[1] }, { label: 'Blocked by policy', color: '#f5a83d' }, { label: 'Anomalies', color: BAD }]} />}>
          <Chart
            height={250}
            onClick={() => nav('/custody/telemetry')}
            option={{
              grid: { left: 40, right: 10, top: 10, bottom: 26 },
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: labels, boundaryGap: false, axisLabel: { fontSize: 11 } },
              yAxis: [{ type: 'value', axisLabel: { fontSize: 11 } }, { type: 'value', show: false, max: 8 }],
              series: [
                { name: 'Transfers', type: 'line', data: events.transfers, symbol: 'none', lineStyle: { color: PALETTE[1] }, areaStyle: { color: 'rgba(45,212,191,.16)' } },
                { name: 'Blocked by policy', type: 'line', data: events.blocked, symbol: 'none', lineStyle: { color: '#f5a83d' } },
                { name: 'Anomalies', type: 'bar', yAxisIndex: 1, data: events.anomalies, itemStyle: { color: BAD }, barMaxWidth: 6 },
              ],
            }}
          />
        </Card>
        <Card title={<><Zap size={15} /> Transfer acceleration</>} sub={accel.note} toneColor={CUSTODY_TONE} tinted>
          <div className="mini-stats">
            <MiniStat value={`${accel.throughputGbps} Gb/s`} label="Mean throughput" color={CUSTODY_TONE} />
            <MiniStat value={`${accel.acceleratedPct}%`} label="Transfers accelerated" />
            <MiniStat value={accel.median} label="Median transfer" />
            <MiniStat value={accel.largest} label="Largest (30 d)" />
          </div>
          <div className="row" style={{ marginTop: 14, gap: 8 }}>
            <IcoBox color={CUSTODY_TONE}><Gauge /></IcoBox>
            <span className="secondary" style={{ fontSize: 12.5 }}>Saved <b>{accel.saved}</b> versus standard transfer, with custody kept end to end.</span>
          </div>
          <div className="section-label" style={{ marginTop: 14 }}>Protected content · click to open its lineage</div>
          <div className="chips">
            {sc.items.slice(0, 6).map((x, i) => <button key={x} className="chip" onClick={() => nav(`/custody/lineage?asset=${i}`)}>{x}</button>)}
          </div>
          {note && <div style={{ marginTop: 12 }}><Callout kind="info" color={CUSTODY_TONE}>{note}</Callout></div>}
        </Card>
      </div>

      {focus && (
        <Drawer title={focus.label} sub={`${fmtNum(focus.rows.reduce((s, f) => s + f.count, 0))} custody events · ${rangeLabel(timeRange).toLowerCase()} · source: ${SRC}`} icon={<IcoBox color={CUSTODY_TONE}><Link2 /></IcoBox>} onClose={() => setFocus(null)}
          footer={<Btn onClick={() => nav('/custody/lineage')}>Open lineage</Btn>}>
          <DataTable
            rows={focus.rows}
            rowKey={(f) => `${f.project}|${f.action}|${f.dest}`}
            initialSort={{ key: 'n', dir: 'desc' }}
            columns={[
              { key: 'p', header: 'Project', sort: (f) => f.project, render: (f) => f.project },
              { key: 'a', header: 'Action → destination', render: (f) => (<><div>{f.action}</div><div className="t-sub">→ {f.dest}</div></>) },
              { key: 'n', header: 'Events', align: 'right', sort: (f) => f.count, render: (f) => <b>{fmtNum(f.count)}</b> },
              { key: 's', header: 'Sanctioned', sort: (f) => Number(f.sanctioned), render: (f) => (f.sanctioned ? <Badge color="var(--good)">Yes</Badge> : <Badge color="var(--bad)" solid>No</Badge>) },
            ]}
          />
        </Drawer>
      )}

      {sel && (
        <Drawer
          wide
          title={sel.title}
          sub={`${sel.id} · ${c.tenants.find((t) => t.id === sel.tenantId)?.name ?? sel.org}`}
          icon={<IcoBox color="var(--bad)"><FileLock2 /></IcoBox>}
          onClose={() => setSel(null)}
          footer={
            <>
              <Btn onClick={() => nav(`/custody/lineage?asset=${Math.max(0, sc.items.indexOf(sel.asset))}`)}>Open lineage</Btn>
              <Btn onClick={() => nav('/custody/evidence')}>Open chain of evidence</Btn>
              <span className="spacer" />
              <Btn primary color="var(--bad)" disabled={!!handled[sel.id]} onClick={() => setRevoke({ scope: sel.machine.includes('no agent') || sel.org === c.name ? 'session' : 'user', target: sel.actor, asset: sel.asset, detail: `${sel.machine} · ${sel.org}` })}>
                <Ban /> Revoke access
              </Btn>
            </>
          }
        >
          <KV rows={[
            ['Severity', <SevBadge sev={sel.sev} />],
            ['Asset', sel.asset],
            ['Actor', sel.actor],
            ['Organisation', sel.org],
            ['Machine', <span className="mono">{sel.machine}</span>],
            ['Action', sel.action],
            ['Destination', sel.destination],
            ['Detected', fmtAgo(sel.ageMin)],
            ['What happened', sel.detail],
            ['Recommended', sel.recommended],
          ]} />
          <div className="section-label" style={{ marginTop: 16 }}>Evidence</div>
          <div className="list">
            {sel.evidence.map((e) => (
              <div key={e} className="list-row" style={{ padding: '7px 0' }}><span className="list-main"><b style={{ fontWeight: 500, whiteSpace: 'normal' }}>{e}</b></span></div>
            ))}
          </div>
          {handled[sel.id] && <Callout kind="good">{handled[sel.id]}</Callout>}
        </Drawer>
      )}
      {revoke && sel && (
        <RevokeModal req={revoke} onClose={() => setRevoke(null)} onDone={(r) => setHandled((m) => ({ ...m, [sel.id]: `Revoked (${r.id}) in ${r.propagationSec} s` }))} />
      )}
    </>
  );
}
