import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldAlert, Landmark, CalendarClock } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { headlines } from '../../data/core';
import { scenarios, sublimits, tower, exclusions, policyHistory, marketIndex, renewalMilestones, PEERS, type Exclusion, type Sublimit } from '../../data/modules/insurance';
import { Card, KpiStrip, Badge, Btn, Callout, KV, Timeline, SectionLabel, Bar } from '../../components/ui';
import { Chart, PALETTE } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer, Modal } from '../../components/Overlay';
import { fmtDate, daysAhead, daysAgo } from '../../lib/format';
import { Intro, TenantNote, INS_TONE, INS_HEX, money } from './parts';
import { RecordsDrawer, scrollToId } from './viz';
import type { CustomerProfile } from '../../data/types';
import type { TowerLayer } from '../../data/modules/insurance';

const LAYER_COLORS = [INS_HEX, '#4f8cff', '#a07cfb', '#f5a83d'];

/** Crisp HTML tower: layers on a money scale, with marker tags laid out so they never overlap. */
function Tower({ c, layers, expected, tail, onLayer, onMarker }: { c: CustomerProfile; layers: TowerLayer[]; expected: number; tail: number; onLayer: (l: TowerLayer) => void; onMarker: (m: 'tail' | 'expected' | 'limit') => void }) {
  const H = 300;
  const limit = layers.reduce((m, l) => Math.max(m, l.attachM + l.limitM), 0);
  const top = Math.max(tail, limit) * 1.12;
  const y = (v: number) => (v / top) * H;
  const step = top > 300 ? 100 : top > 120 ? 50 : top > 50 ? 20 : 10;
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  const marks = [
    { id: 'tail' as const, v: tail, label: '1-in-100 loss', detail: money(tail, c), color: '#e0345e' },
    { id: 'limit' as const, v: limit, label: 'Programme limit', detail: money(limit, c), color: INS_HEX },
    { id: 'expected' as const, v: expected, label: 'Expected annual loss', detail: money(expected, c), color: '#f5a83d' },
  ].sort((a, b) => b.v - a.v);
  // Lay tags out top-down with at least 38px between centres.
  let prev = -Infinity;
  const placed = marks.map((m) => {
    let t = H - y(m.v);
    if (t < prev + 38) t = prev + 38;
    prev = t;
    return { ...m, t: Math.min(t, H + 10) };
  });
  return (
    <div className="ins-tower" style={{ height: H + 18 }}>
      <div className="ins-tower-axis" style={{ height: H }}>
        {ticks.map((t) => <span key={t} style={{ bottom: y(t) }}>{money(t, c)}</span>)}
      </div>
      <div className="ins-tower-body" style={{ height: H }}>
        {tail > limit && (
          <div className="ins-tower-gap" style={{ bottom: y(limit), height: y(tail) - y(limit) }}>Uninsured {money(tail - limit, c)}</div>
        )}
        {layers.map((l, i) => (
          <button key={l.role} className="ins-tower-layer" style={{ bottom: y(l.attachM) + 1, height: Math.max(22, y(l.limitM) - 2), background: LAYER_COLORS[i % LAYER_COLORS.length] }} onClick={() => onLayer(l)} title={`${l.carrier} · ${money(l.limitM, c)} xs ${money(l.attachM, c)}`}>
            <b>{l.carrier.split(' (')[0]}</b>
            {y(l.limitM) > 34 && <span>{l.role} · {money(l.limitM, c)} xs {money(l.attachM, c)}</span>}
          </button>
        ))}
        {marks.map((m) => <span key={m.id} className="ins-tower-line" style={{ bottom: y(m.v), borderColor: m.color, borderTopStyle: m.id === 'limit' ? 'solid' : 'dashed' }} />)}
      </div>
      <div className="ins-tower-gutter" style={{ height: H }}>
        {placed.map((m) => (
          <button key={m.id} className="ins-tower-tag" style={{ top: m.t, ['--mk' as string]: m.color }} onClick={() => onMarker(m.id)}>
            <b>{m.label}</b>
            <span>{m.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const RISK_COLOR = { high: 'var(--bad)', medium: 'var(--sev-medium)', low: 'var(--good)' } as const;
const KIND_COLOR: Record<Sublimit['kind'], string> = { full: 'var(--good)', sublimit: 'var(--accent)', endorsement: 'var(--m-insurance)', excluded: 'var(--bad)' };

export default function InsurancePolicy() {
  const { customer: c, tenantId, toast } = useApp();
  const h = headlines(c, tenantId).insurance;
  const ins = c.insurance;
  const sc = useMemo(() => scenarios(c), [c]);
  const subs = sublimits(c);
  const layers = tower(c);
  const excl = exclusions(c);
  const hist = policyHistory(c);
  const mkt = marketIndex();
  const miles = renewalMilestones(c);
  const peers = PEERS[c.id];
  const [ex, setEx] = useState<Exclusion | null>(null);
  const [sub, setSub] = useState<Sublimit | null>(null);
  const [brief, setBrief] = useState(false);
  const [rec, setRec] = useState<null | 'layers' | 'premium' | 'shortfalls' | 'peers' | 'tail'>(null);
  const [params] = useSearchParams();
  useEffect(() => {
    if (params.get('view') === 'renewal') scrollToId('ins-renewal');
    if (params.get('view') === 'sublimits') scrollToId('ins-sublimits');
  }, [params]);

  const rol = (ins.premiumK / 1000 / ins.limitM) * 100;
  const inception = daysAhead(ins.renewalDays);
  const policyStart = daysAgo(365 - ins.renewalDays);
  const policyNo = `${c.initials}-CY-${new Date().getFullYear() - 1}-${({ finserv: '00418', maritime: '07731', media: '02296', healthcare: '05182', automotive: '11407' } as Record<string, string>)[c.id]}`;

  const worstFor = (s: Sublimit) => {
    const rel = sc.filter((x) => s.scenarios.includes(x.id));
    return rel.length ? Math.max(...rel.map((x) => x.max)) : 0;
  };
  const shortfalls = subs.filter((s) => s.limitM !== null && worstFor(s) > s.limitM);

  return (
    <>
      <Intro ids={['c-hexacomply', c.connectors.find((k) => k.category === 'ITSM')!.id]}>
        The {ins.carrier} programme placed by {ins.broker}, its sublimits and exclusions read against your own loss scenarios, and the road to renewal.
      </Intro>
      <TenantNote />

      <KpiStrip
        toneColor={INS_TONE}
        items={[
          { label: 'Aggregate limit', value: money(ins.limitM, c), delta: { text: `${layers.length} layer${layers.length > 1 ? 's' : ''} · ${(ins.limitM / c.revenueM * 100).toFixed(1)}% of revenue`, good: true }, onClick: () => setRec('layers'), source: `${ins.carrier} · policy schedule via ${ins.broker}` },
          { label: 'Retention', value: money(ins.retentionK / 1000, c), delta: { text: 'Each and every claim', good: true }, onClick: () => scrollToId('ins-sublimits'), source: 'Policy schedule · section retentions' },
          { label: 'Annual premium', value: money(ins.premiumK / 1000, c), delta: { text: `Modelled ${h.premiumDeltaPct > 0 ? '+' : ''}${h.premiumDeltaPct}% at renewal`, good: h.premiumDeltaPct <= 0 }, onClick: () => setRec('premium'), source: `${ins.broker} · premium history` },
          { label: 'Rate on line', value: `${rol.toFixed(1)}%`, delta: { text: `Peer median ${peers[1].rol}%`, good: rol <= peers[1].rol }, onClick: () => setRec('peers'), source: `${ins.broker} benchmarking` },
          { label: 'Sublimit shortfalls', value: shortfalls.length, delta: { text: 'vs scenario max loss', good: shortfalls.length === 0 }, onClick: () => setRec('shortfalls'), source: 'Policy wording × HexaView FAIR scenarios' },
          { label: 'Renewal in', value: ins.renewalDays, unit: 'days', bar: 100 - (ins.renewalDays / 120) * 100, delta: { text: fmtDate(inception), good: true }, onClick: () => scrollToId('ins-renewal'), source: `${ins.broker} renewal timeline` },
        ]}
      />

      <div className="grid g-2-1">
        <Card title={<><Landmark size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Programme and tower</>} sub={`Layers against the modelled 1-in-100 loss of ${money(h.tailLossM, c)}`}>
          <Tower c={c} layers={layers} expected={h.expectedLossM} tail={h.tailLossM} onLayer={() => setRec('layers')} onMarker={(m) => (m === 'limit' ? setRec('layers') : setRec('tail'))} />
          {h.tailLossM > ins.limitM && (
            <Callout kind="warn">
              The tower stops at {money(ins.limitM, c)}; the modelled 1-in-100 loss is {money(h.tailLossM, c)}. Discuss a {money(Math.ceil((h.tailLossM - ins.limitM) / 5) * 5, c)} excess layer with {ins.broker} before quotes.
            </Callout>
          )}
        </Card>

        <Card title="Policy details" sub={`Policy ${policyNo}`} toneColor={INS_TONE} tinted>
          <KV
            rows={[
              ['Carrier(s)', ins.carrier],
              ['Broker', ins.broker],
              ['Named insured', `${c.name} and subsidiaries (${c.tenants.length} entities)`],
              ['Period', `${fmtDate(policyStart)} to ${fmtDate(inception)}`],
              ['Aggregate limit', money(ins.limitM, c)],
              ['Retention', `${money(ins.retentionK / 1000, c)} each claim`],
              ['Premium', `${money(ins.premiumK / 1000, c)} (rate on line ${rol.toFixed(1)}%)`],
              ['Territory', 'Worldwide, excluding sanctioned territories'],
              ['Trigger', 'Claims made and discovered; BI on occurrence'],
              ['Notice', 'As soon as practicable, within 72 h of discovery'],
              ['Panel', 'HexaShield DFIR pre-approved; nil retention for first 48 h'],
            ]}
          />
          <div className="row" style={{ marginTop: 12 }}>
            <Btn sm primary color={INS_TONE} onClick={() => setBrief(true)}>Prepare broker briefing</Btn>
          </div>
        </Card>
      </div>

      <div id="ins-sublimits" />
      <Card title="Coverage sections and sublimits" count={subs.length} sub="Each section read against the worst case of the scenarios it responds to. Click for detail." flush>
        <DataTable
          rows={subs}
          rowKey={(r) => r.name}
          onRowClick={setSub}
          columns={[
            { key: 'name', header: 'Section', sort: (r) => r.name, render: (r) => (<><div className="t-main">{r.name}</div><div className="t-sub">{r.note}</div></>) },
            { key: 'kind', header: 'Type', sort: (r) => r.kind, render: (r) => <Badge color={KIND_COLOR[r.kind]}>{r.kind === 'full' ? 'Full limit' : r.kind === 'sublimit' ? 'Sublimit' : r.kind === 'endorsement' ? 'Endorsement' : 'Excluded'}</Badge> },
            { key: 'limit', header: 'Limit', align: 'right', sort: (r) => r.limitM ?? 0, render: (r) => <b className="num">{r.limitM === null ? '—' : money(r.limitM, c)}</b> },
            { key: 'wait', header: 'Waiting / retention', render: (r) => <span className="t-sub">{[r.waiting, r.retention].filter(Boolean).join(' · ') || 'Standard retention'}</span> },
            { key: 'worst', header: 'Scenario max loss', align: 'right', sort: (r) => worstFor(r), render: (r) => <span className="num">{money(worstFor(r), c)}</span> },
            { key: 'adequacy', header: 'Adequacy', sort: (r) => (r.limitM ?? 0) / Math.max(0.01, worstFor(r)), render: (r) => {
              const w = worstFor(r);
              const pct = r.limitM ? Math.min(100, (r.limitM / Math.max(0.01, w)) * 100) : 0;
              return (<div style={{ minWidth: 110 }}><Bar value={pct} color={pct >= 100 ? 'var(--good)' : pct >= 50 ? 'var(--sev-medium)' : 'var(--bad)'} size="thin" /><span className="t-sub">{pct >= 100 ? 'Covers worst case' : `Covers ${Math.round(pct)}% of worst case`}</span></div>);
            } },
          ]}
        />
      </Card>

      <div className="grid g-3-2">
        <Card title={<><ShieldAlert size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Key exclusions</>} count={excl.length} sub="Wording that decides whether a loss pays, and the evidence HexaView keeps to argue it" flush>
          <div className="list" style={{ padding: '0 18px 8px' }}>
            {excl.map((e) => (
              <button key={e.name} className="list-row" onClick={() => setEx(e)}>
                <span className="list-main">
                  <b>{e.name}</b>
                  <span>{e.wording}</span>
                </span>
                <Badge color={RISK_COLOR[e.risk]}>{e.risk === 'high' ? 'High impact' : e.risk === 'medium' ? 'Medium' : 'Low'}</Badge>
              </button>
            ))}
          </div>
        </Card>

        <Card title={<><CalendarClock size={15} style={{ verticalAlign: -2, marginRight: 6 }} /><span id="ins-renewal">Renewal timeline</span></>} sub={`${ins.renewalDays} days to inception on ${fmtDate(inception)}`}>
          <Timeline
            items={miles.map((m) => ({
              time: m.done ? 'Done' : m.inDays === 0 ? 'Today' : fmtDate(daysAhead(m.inDays)),
              title: <>{m.label} {!m.done && <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>· in {m.inDays} d</span>}</>,
              body: m.detail,
              color: m.done ? 'var(--good)' : m === miles.find((x) => !x.done) ? INS_TONE : 'var(--text-muted)',
            }))}
          />
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Premium, limit and retention over 5 years" sub="Policy years, plus the modelled renewal">
          <Chart
            height={260}
            option={{
              tooltip: { trigger: 'axis' },
              legend: { top: 0, data: ['Premium', 'Limit', 'Retention'] },
              grid: { left: 8, right: 8, top: 34, bottom: 6, containLabel: true },
              xAxis: { type: 'category', data: hist.map((y) => y.year) },
              yAxis: [
                { type: 'value', name: 'Premium', axisLabel: { formatter: (v: number) => money(v / 1000, c) } },
                { type: 'value', name: 'Limit', axisLabel: { formatter: (v: number) => money(v, c) }, splitLine: { show: false } },
              ],
              series: [
                { name: 'Premium', type: 'bar', data: hist.map((y) => ({ value: y.premiumK, itemStyle: { color: y.modelled ? 'rgba(46,196,168,.45)' : INS_HEX, borderType: y.modelled ? 'dashed' : 'solid', borderColor: INS_HEX, borderWidth: y.modelled ? 1 : 0 } })), tooltip: { valueFormatter: (v) => money(Number(v) / 1000, c) } },
                { name: 'Limit', type: 'line', yAxisIndex: 1, data: hist.map((y) => y.limitM), itemStyle: { color: PALETTE[0] }, tooltip: { valueFormatter: (v) => money(Number(v), c) } },
                { name: 'Retention', type: 'line', yAxisIndex: 1, data: hist.map((y) => y.retentionK / 1000), itemStyle: { color: PALETTE[3] }, lineStyle: { type: 'dashed' }, tooltip: { valueFormatter: (v) => money(Number(v), c) } },
              ],
            }}
          />
        </Card>

        <Card title="Market context" sub="Cyber rate change year on year (broker market index, illustrative) and your position against peers">
          <Chart
            height={150}
            option={{
              tooltip: { trigger: 'axis', valueFormatter: (v) => `${v}%` },
              grid: { left: 8, right: 8, top: 10, bottom: 6, containLabel: true },
              xAxis: { type: 'category', data: mkt.map((m) => m.q), axisLabel: { fontSize: 9.5 } },
              yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
              series: [{ type: 'bar', data: mkt.map((m) => ({ value: m.pct, itemStyle: { color: m.pct > 0 ? '#f8646f' : '#93d65a' } })) }],
            }}
          />
          <table className="tbl" style={{ marginTop: 8 }}>
            <thead>
              <tr><th></th><th className="r">Rate on line</th><th className="r">Limit / revenue</th><th className="r">Retention / limit</th></tr>
            </thead>
            <tbody>
              {peers.map((p, i) => (
                <tr key={p.label} className={i === 0 ? 'ins-hl' : ''}>
                  <td className="t-main">{p.label}</td>
                  <td className="r num">{p.rol}%</td>
                  <td className="r num">{p.limitToRevenue}%</td>
                  <td className="r num">{p.retentionPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {ex && (
        <Drawer title={ex.name} sub={<Badge color={RISK_COLOR[ex.risk]}>{ex.risk} impact</Badge>} onClose={() => setEx(null)}>
          <SectionLabel>Wording</SectionLabel>
          <p className="secondary" style={{ marginTop: 0 }}>{ex.wording}</p>
          <SectionLabel>What it means for {c.short}</SectionLabel>
          <p style={{ marginTop: 0 }}>{ex.impact}</p>
          <SectionLabel>Evidence HexaView keeps</SectionLabel>
          <Callout kind="good">{ex.evidence}</Callout>
          <KV rows={[['Scenarios affected', sc.filter((s) => (ex.name.includes('War') && s.category === 'State-backed') || (ex.name.includes('patched') && s.controls.includes('patch')) || (ex.name.includes('CL380') && s.category === 'OT disruption') || (ex.name.includes('future revenue') && s.category === 'Content leak') || (ex.name.includes('Funds transfer') && s.category === 'BEC / payment fraud') || (ex.name.includes('Bodily injury') && s.category === 'OT disruption') || (ex.name.includes('recall') && s.category === 'Vehicle fleet') || (ex.name.includes('intellectual property value') && s.category === 'IP theft') || (ex.name.includes('Regulatory fines') && s.category === 'Regulatory')).map((s) => s.name).join('; ') || 'Indirect'], ['Raise at renewal', ex.risk === 'high' ? 'Yes: negotiate wording or buy-back' : 'Confirm wording unchanged']]} />
        </Drawer>
      )}

      {sub && (
        <Drawer title={sub.name} sub={sub.note} onClose={() => setSub(null)}>
          <KV
            rows={[
              ['Limit', sub.limitM === null ? '—' : money(sub.limitM, c)],
              ['Waiting period', sub.waiting ?? '—'],
              ['Retention', sub.retention ?? `${money(ins.retentionK / 1000, c)} standard`],
              ['Worst modelled loss', money(worstFor(sub), c)],
            ]}
          />
          <SectionLabel><span style={{ display: 'block', marginTop: 14 }}>Scenarios this section responds to</span></SectionLabel>
          <div className="list">
            {sc.filter((s) => sub.scenarios.includes(s.id)).map((s) => (
              <div key={s.id} className="list-row">
                <span className="list-main"><b>{s.name}</b><span>ALE {money(s.ale, c)} · max {money(s.max, c)}</span></span>
                <Badge color={sub.limitM !== null && s.max > sub.limitM ? 'var(--bad)' : 'var(--good)'}>{sub.limitM !== null && s.max > sub.limitM ? 'Exceeds' : 'Within'}</Badge>
              </div>
            ))}
          </div>
        </Drawer>
      )}

      {rec === 'layers' && (
        <RecordsDrawer title="Programme layers" sub={`${money(ins.limitM, c)} aggregate · policy ${policyNo}`} source={`${ins.carrier} · placed by ${ins.broker}`} onClose={() => setRec(null)}
          rows={layers.map((l) => ({ key: l.role, title: `${l.carrier} · ${l.role}`, sub: `${money(l.limitM, c)} xs ${money(l.attachM, c)} · rate on line ${((l.premiumK / 1000 / l.limitM) * 100).toFixed(1)}%`, right: money(l.premiumK / 1000, c) }))} />
      )}
      {rec === 'premium' && (
        <RecordsDrawer title="Premium history" sub="Policy years plus the modelled renewal" source={`${ins.broker} · policy schedules`} onClose={() => setRec(null)}
          rows={hist.slice().reverse().map((y) => ({ key: y.year, title: y.year, sub: `Limit ${money(y.limitM, c)} · retention ${money(y.retentionK / 1000, c)}`, right: money(y.premiumK / 1000, c), badge: y.modelled ? <Badge color={INS_TONE}>Modelled</Badge> : undefined }))} />
      )}
      {rec === 'peers' && (
        <RecordsDrawer title="Rate on line vs peers" sub="Premium as a share of limit" source={`${ins.broker} benchmarking (illustrative)`} onClose={() => setRec(null)}
          rows={peers.map((p) => ({ key: p.label, title: p.label, sub: `Limit / revenue ${p.limitToRevenue}% · retention / limit ${p.retentionPct}%`, right: `${p.rol}%` }))} />
      )}
      {rec === 'shortfalls' && (
        <RecordsDrawer title="Sublimit shortfalls" sub="Sections whose limit is below the worst modelled loss of the scenarios they respond to" source="Policy wording × HexaView FAIR scenarios" onClose={() => setRec(null)}
          rows={subs.filter((s) => s.limitM !== null).map((s) => ({ key: s.name, title: s.name, sub: `Limit ${money(s.limitM ?? 0, c)} · worst case ${money(worstFor(s), c)}`, right: money(worstFor(s), c), badge: s.limitM !== null && worstFor(s) > s.limitM ? <Badge color="var(--bad)">Shortfall</Badge> : <Badge color="var(--good)">Adequate</Badge>, onClick: () => { setRec(null); setSub(s); } }))} />
      )}
      {rec === 'tail' && (
        <RecordsDrawer title="Loss markers on the tower" sub={`Expected ${money(h.expectedLossM, c)} · 1-in-100 ${money(h.tailLossM, c)}`} source="HexaView FAIR model" onClose={() => setRec(null)}
          rows={sc.slice().sort((a, b) => b.max - a.max).map((s) => ({ key: s.id, title: s.name, sub: `ALE ${money(s.ale, c)} · worst case ${money(s.max, c)}`, right: money(s.max, c), badge: s.max > ins.limitM ? <Badge color="var(--bad)">Above limit</Badge> : undefined }))} />
      )}

      {brief && (
        <Modal
          title="Prepare broker briefing"
          sub={`Draft for ${ins.broker}`}
          onClose={() => setBrief(false)}
          footer={
            <>
              <Btn ghost onClick={() => setBrief(false)}>Cancel</Btn>
              <Btn primary color={INS_TONE} onClick={() => { setBrief(false); toast(`Broker briefing drafted for ${ins.broker}; review in Reporting before sending`); }}>Create draft</Btn>
            </>
          }
        >
          <KV
            rows={[
              ['Includes', 'Posture summary, control attestation, loss quantification, tower adequacy, asks for renewal'],
              ['Asks', [shortfalls.length ? `Raise ${shortfalls.length} sublimits` : '', h.tailLossM > ins.limitM ? `Excess layer of ${money(Math.ceil((h.tailLossM - ins.limitM) / 5) * 5, c)}` : '', `Premium target ${h.premiumDeltaPct > 0 ? '+' : ''}${h.premiumDeltaPct}%`].filter(Boolean).join('; ')],
              ['Risk class', <Badge color="var(--good)">Low: draft document, nothing sent</Badge>],
              ['Approvals', `${c.people.ciso.name} before release to the broker`],
            ]}
          />
        </Modal>
      )}
    </>
  );
}
