import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Card, KpiStrip, Btn, BarRow, Legend, Stacked, Callout } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { fmtCompact, fmtMoney, fmtNum, monthLabels } from '../../lib/format';
import { aisecRoi, aisecQuadrant, aisecPosture, aisecIncidents, REALISATION, STATUS_HEX, type AsItem } from '../../data/modules/aisec';
import { AS_TONE, AS_HEX, BASE, Cite, ItemDrawer, RecordsDrawer, SensorNote, toneStyle, useAs } from './parts';

const SPEND_HEX = ['#4f8cff', '#a07cfb', '#68b1ff', '#2dd4bf'];

export default function AisecRoi() {
  const { c, tenantId, inv, sum, scope, nav } = useAs();
  const roi = useMemo(() => aisecRoi(c, tenantId), [c, tenantId]);
  const quad = useMemo(() => aisecQuadrant(c, inv), [c, inv]);
  const post = aisecPosture(c, tenantId);
  const incidents = aisecIncidents(c, tenantId);
  const [open, setOpen] = useState<AsItem | null>(null);
  const [drill, setDrill] = useState<'value' | 'spend' | null>(null);
  const m = (n: number) => fmtMoney(n, c.currency);
  const sym = fmtMoney(0, c.currency).replace('0', '');
  const months = monthLabels(12);
  const byDept = Object.entries(roi.byUseCase.reduce<Record<string, number>>((a, u) => ({ ...a, [u.dept]: (a[u.dept] ?? 0) + u.value }), {})).sort((a, b) => b[1] - a[1]);
  const spend = Object.entries(roi.spend);
  const maxUc = Math.max(1, ...roi.byUseCase.map((u) => u.value));
  const midValue = quad.map((q) => q.value).sort((a, b) => a - b)[Math.floor(quad.length / 2)] ?? 1;
  const topUc = roi.byUseCase.slice().sort((a, b) => b.value - a.value)[0];
  const worstItem = inv.slice().sort((a, b) => b.risk - a.risk)[0];
  const worst = worstItem ? { item: worstItem, risk: worstItem.risk } : undefined;

  return (
    <div className="stack" style={{ gap: 16, ...toneStyle }}>
      <div className="row between wrap">
        <p className="page-intro" style={{ margin: 0, flex: 1 }}>
          <b>{c.name}</b> · {scope}. AI value and AI risk on one page, for the board. Hours saved are measured from real usage; only {Math.round(REALISATION * 100)}% are counted as realised value at a loaded cost of {fmtMoney(roi.hourly, c.currency, false)}/hour. Last 12 months.
        </p>
        <Btn sm onClick={() => window.print()}><Printer size={13} /> Print board pack</Btn>
      </div>

      <KpiStrip
        toneColor={AS_TONE}
        items={[
          { label: 'Hours saved', value: fmtCompact(roi.hours), unit: '12 months', onClick: () => setDrill('value'), source: 'HexaAI usage × use-case time studies' },
          { label: 'Value delivered', value: m(roi.value), toneColor: 'var(--good)', onClick: () => setDrill('value'), source: `Hours × ${Math.round(REALISATION * 100)}% realisation × loaded cost` },
          { label: 'AI spend', value: m(roi.totalSpend), onClick: () => setDrill('spend'), source: 'Licences, token metering, infrastructure, managed service' },
          { label: 'Net ROI', value: `${roi.roiPct}%`, unit: `${m(roi.net)} net`, toneColor: roi.roiPct > 0 ? 'var(--good)' : 'var(--bad)', onClick: () => setDrill('value'), source: 'HexaView ROI model' },
          { label: 'Payback', value: roi.paybackMonths, unit: 'months', source: 'HexaView ROI model', onClick: () => setDrill('spend') },
          { label: 'Loss avoided', value: m(roi.lossAvoided), unit: 'expected', toneColor: AS_TONE, to: `${BASE}/threats`, source: 'Expected loss from AI incidents avoided (HexaAI blocks × CRQ model)' },
          { label: 'AI posture', value: post.score, unit: '/ 100', to: `${BASE}/overview`, source: 'HexaAI posture (See · Govern · Prove)' },
        ]}
      />

      <Card title="Board summary" sub="Plain English, every statement cited to its record" tinted toneColor={AS_TONE}>
        <div className="as-board">
          <p>
            Over the last 12 months AI saved <b>{fmtNum(roi.hours)} hours</b> across {roi.byUseCase.length} use cases, worth <b>{m(roi.value)}</b> after a conservative {Math.round(REALISATION * 100)}% realisation <Cite to={`${BASE}/usage`}>usage</Cite>. Total AI spend was <b>{m(roi.totalSpend)}</b>, giving a net return of <b>{roi.roiPct}%</b> and payback in <b>{roi.paybackMonths} months</b> <Cite to={`${BASE}/roi`}>roi-model</Cite>.
          </p>
          <p>
            The largest single source of value is <b>{topUc?.name}</b> in {topUc?.dept} ({m(topUc?.value ?? 0)}) <Cite to={`${BASE}/usage`}>use-case</Cite>. Governance is enforced where AI runs: <b>{fmtNum(sum.blocked)}</b> risky actions blocked and <b>{fmtNum(sum.redacted)}</b> prompts redacted in the selected range <Cite to={`${BASE}/policy`}>enforcement</Cite>, avoiding an expected <b>{m(roi.lossAvoided)}</b> of loss; risk-adjusted value is <b>{m(roi.riskAdj)}</b> <Cite to={`${BASE}/threats`}>threats</Cite>.
          </p>
          <p>
            The main exposure is <b>{worst?.item.name}</b> (risk {worst?.risk}, {worst?.item.status}) <Cite to={`${BASE}/inventory`}>inventory</Cite>. {sum.shadowApps + sum.shadowAgents} shadow AI items remain; {incidents.length} AI incident{incidents.length === 1 ? ' was' : 's were'} handled by HexaSOC <Cite to="/soc/ir">soc-ir</Cite>. AI posture is <b>{post.score}/100</b>, up {post.score - post.trend[0]} points in a year, with evidence for ISO/IEC 42001, the EU AI Act and NIST AI RMF held in HexaComply <Cite to={`${BASE}/compliance`}>evidence</Cite>.
          </p>
        </div>
      </Card>

      <div className="grid g-3-2">
        <Card title="Value vs cost, cumulative" sub="12 months · bars = monthly value, lines = cumulative value and cost" actions={<Legend items={[{ label: 'Cumulative value', color: '#2dd4bf' }, { label: 'Cumulative cost', color: '#f0466e' }, { label: 'Monthly value', color: AS_HEX }]} />}>
          <Chart
            height={280}
            option={{
              tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => m(Number(v)) },
              grid: { left: 8, right: 8, top: 14, bottom: 6, containLabel: true },
              xAxis: { type: 'category', data: months },
              yAxis: { type: 'value', axisLabel: { formatter: (v: number) => m(v) } },
              series: [
                { name: 'Monthly value', type: 'bar', data: roi.monthlyValue, itemStyle: { color: 'rgba(139,92,246,.45)' } },
                { name: 'Cumulative value', type: 'line', data: roi.cumValue, symbol: 'none', lineStyle: { color: '#2dd4bf', width: 2.4 }, areaStyle: { color: 'rgba(45,212,191,.10)' } },
                { name: 'Cumulative cost', type: 'line', data: roi.cumCost, symbol: 'none', lineStyle: { color: '#f0466e', width: 2, type: 'dashed' } },
              ],
            }}
          />
        </Card>
        <Card title="Risk-adjusted return" sub="Value + loss avoided − spend">
          <Chart
            height={280}
            option={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p: unknown) => { const a = (p as { name: string; value: number; seriesName: string }[]).filter((x) => x.seriesName !== 'base'); return a.map((x) => `${x.name}: ${m(x.value)}`).join('<br/>'); } },
              grid: { left: 8, right: 8, top: 14, bottom: 6, containLabel: true },
              xAxis: { type: 'category', data: ['Value', 'Loss avoided', 'Spend', 'Risk-adjusted'], axisLabel: { fontSize: 10.5 } },
              yAxis: { type: 'value', axisLabel: { formatter: (v: number) => m(v) } },
              series: [
                { name: 'base', type: 'bar', stack: 'w', itemStyle: { color: 'transparent' }, data: [0, roi.value, roi.value + roi.lossAvoided - roi.totalSpend, 0] },
                { name: 'amount', type: 'bar', stack: 'w', barMaxWidth: 46, data: [
                  { value: roi.value, itemStyle: { color: '#2dd4bf' } },
                  { value: roi.lossAvoided, itemStyle: { color: AS_HEX } },
                  { value: roi.totalSpend, itemStyle: { color: '#f0466e' } },
                  { value: roi.riskAdj, itemStyle: { color: '#4f8cff' } },
                ] },
              ],
            }}
          />
        </Card>
      </div>

      <div className="grid g3">
        <Card title="Value by use case" sub="12 months · realised value">
          <div className="stack" style={{ gap: 6 }}>
            {roi.byUseCase.slice().sort((a, b) => b.value - a.value).map((u) => (
              <BarRow key={u.name} label={u.name} sub={`${u.dept} · ${fmtNum(u.hours)} h`} value={u.value} max={maxUc} color={AS_HEX} display={m(u.value)} />
            ))}
          </div>
        </Card>
        <Card title="Value by department" sub="12 months">
          <div className="stack" style={{ gap: 6 }}>
            {byDept.map(([d, v]) => <BarRow key={d} label={d} value={v} max={byDept[0][1]} color="#2dd4bf" display={m(v)} />)}
          </div>
        </Card>
        <Card title="Where the money goes" sub={`${m(roi.totalSpend)} over 12 months`}>
          <Stacked tall showLabels parts={spend.map(([k, v], i) => ({ value: v, color: SPEND_HEX[i], label: k }))} />
          <div className="stack" style={{ gap: 8, marginTop: 14 }}>
            {spend.map(([k, v], i) => (
              <div key={k} className="row" style={{ fontSize: 12 }}>
                <i className="dot" style={{ background: SPEND_HEX[i] }} />
                <span style={{ flex: 1 }}>{k}</span>
                <b className="num">{m(v)}</b>
              </div>
            ))}
          </div>
          <Callout kind="good">Every {sym}1 spent on AI returned <b>{sym}{((roi.value + roi.lossAvoided) / roi.totalSpend).toFixed(2)}</b> in value and avoided loss.</Callout>
        </Card>
      </div>

      <Card title="Value vs risk, per AI system" sub="Top-left: keep and scale · top-right: govern harder · bottom-right: block or retire · click a point" actions={<Legend items={[{ label: 'Sanctioned', color: STATUS_HEX.sanctioned }, { label: 'Pilot / review', color: STATUS_HEX['in review'] }, { label: 'Shadow', color: STATUS_HEX.shadow }]} />}>
        <Chart
          height={340}
          onClick={(p) => { const id = (p as { data?: { id?: string } }).data?.id; const x = inv.find((i) => i.id === id); if (x) setOpen(x); }}
          option={{
            grid: { left: 8, right: 24, top: 24, bottom: 8, containLabel: true },
            tooltip: { trigger: 'item', formatter: (p: unknown) => { const q = p as { data: { name: string; value: number[] } }; return `<b>${q.data.name}</b><br/>Risk ${q.data.value[0]} · value ${m(q.data.value[1])}`; } },
            xAxis: { type: 'value', name: 'risk score', nameLocation: 'middle', nameGap: 24, min: 0, max: 100 },
            yAxis: { type: 'log', name: 'annual value', axisLabel: { formatter: (v: number) => m(v) } },
            series: [{
              type: 'scatter',
              symbolSize: 13,
              data: quad.map((q) => ({ id: q.item.id, name: q.item.name, value: [q.risk, Math.max(1000, q.value)], itemStyle: { color: STATUS_HEX[q.item.status], opacity: 0.88 } })),
              markLine: { silent: true, symbol: 'none', lineStyle: { color: '#8593b4', type: 'dashed' }, label: { show: false }, data: [{ xAxis: 60 }, { yAxis: midValue }] },
            }],
          }}
        />
        <div className="row between" style={{ marginTop: 6 }}>
          <SensorNote>risk from runtime behaviour, data classes and EU AI Act class; value from measured usage</SensorNote>
          <button className="link" onClick={() => nav(`${BASE}/inventory`)}>Open inventory →</button>
        </div>
      </Card>

      {open && <ItemDrawer item={open} onClose={() => setOpen(null)} />}
      {drill === 'value' && <RecordsDrawer title="Value by use case" sub="12 months · hours × realisation × loaded cost" source="HexaAI usage · HexaView ROI model" onClose={() => setDrill(null)} rows={roi.byUseCase.map((u) => ({ key: u.name, main: u.name, sub: `${u.dept} · ${u.system} · ${fmtNum(u.users)} users · ${fmtNum(u.hours)} h`, right: <b className="num">{m(u.value)}</b> }))} />}
      {drill === 'spend' && <RecordsDrawer title="AI spend" sub="12 months" source="Licence reports · token metering · HexaShield invoices" onClose={() => setDrill(null)} rows={spend.map(([k, v]) => ({ key: k, main: k, right: <b className="num">{m(v)}</b> }))} />}
    </div>
  );
}
