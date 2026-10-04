import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Target, TrendingDown } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { headlines } from '../../data/core';
import { tenantName } from '../../data/customers';
import { scenarios, currentLec, lecFor, investments, applyInvestments, keyControls, type Scenario } from '../../data/modules/insurance';
import { Card, KpiStrip, Badge, Btn, Callout, KV, SectionLabel, Chip, MiniStat, Legend } from '../../components/ui';
import { Chart, PALETTE } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer, Modal } from '../../components/Overlay';
import { fmtNum } from '../../lib/format';
import { ControlStatusBadge, Intro, TenantNote, INS_TONE, INS_HEX, money } from './parts';
import { MarkerScale, SegRows, RecordsDrawer, scrollToId } from './viz';
import { forCustomer, type CustomerMap } from '../../data/customerMap';

const TOWER_ADVICE: CustomerMap<string> = {
  finserv: 'Options: a 4th excess layer, or a higher dependent BI sublimit for critical ICT providers.',
  maritime: 'Options: a $15M excess layer, or reducing the OT and wiper tail with segmentation.',
  media: 'Options: a $10M excess layer, or the leak buy-back extension.',
  healthcare: 'Options: a $20M excess layer, or cutting the ransomware-with-diversion tail with segmentation and faster Epic recovery.',
  automotive: 'Options: a 4th excess layer of €100M, or a captive for plant BI above €120M.',
  insurance: 'Options: a $25M excess layer above the Travelers layer, or cutting the catastrophe-week ransomware tail with tested ClaimCenter recovery.',
  defence: 'Options: a $5M excess layer, or a CUI incident response endorsement to cover DIBNet forensics and image preservation.',
  pharma: 'Options: a CHF 50M excess layer, or reducing the batch-release BI tail with plant segmentation and paper-batch drills.',
  sghospital: 'Options: a S$10M excess layer, or cutting the ransomware-with-diversion tail with TrakCare recovery under 4 h.',
  studio: 'Options: a $100M excess layer, or the leak buy-back extension for tentpole titles.',
};

const MIX_LABEL = { bi: 'Business interruption', response: 'Response & forensics', extortion: 'Extortion', liability: 'Liability & regulatory', fraud: 'Fraud loss' } as const;
const MIX_COLOR = { bi: PALETTE[0], response: PALETTE[2], extortion: PALETTE[4], liability: PALETTE[3], fraud: PALETTE[6] } as const;
type MixKey = keyof typeof MIX_LABEL;

export default function InsuranceQuantification() {
  const { customer: c, tenantId, toast } = useApp();
  const h = headlines(c, tenantId).insurance;
  const sc = useMemo(() => scenarios(c), [c]);
  const inv = investments(c);
  const ctl = useMemo(() => keyControls(c), [c]);
  const [sel, setSel] = useState<string[]>(() => inv.filter((i) => i.recommended).map((i) => i.id));
  const [selFor, setSelFor] = useState(c.id);
  if (selFor !== c.id) {
    setSelFor(c.id);
    setSel(inv.filter((i) => i.recommended).map((i) => i.id));
  }
  const [params] = useSearchParams();
  const [open, setOpen] = useState<Scenario | null>(null);
  const [rec, setRec] = useState<null | 'ale' | 'tail' | 'gap' | 'whatif'>(null);
  useEffect(() => {
    const v = params.get('view');
    if (v === 'scenarios') scrollToId('ins-scenarios');
    if (v === 'tail') scrollToId('ins-lec');
  }, [params]);
  const [onlyTenant, setOnlyTenant] = useState(true);
  const [plan, setPlan] = useState(false);

  const chosen = inv.filter((i) => sel.includes(i.id));
  const after = applyInvestments(sc, chosen);
  const newAle = Object.values(after).reduce((s, v) => s + v, 0);
  const cur = currentLec(c);
  const tgt = lecFor(c, newAle);
  const cost = chosen.reduce((s, i) => s + i.costM, 0);
  const reduction = h.expectedLossM - newAle;
  const roi = cost ? (reduction - cost) / cost : 0;
  const premiumPts = chosen.reduce((s, i) => s + i.premiumPts, 0);
  const premiumSave = (c.insurance.premiumK / 1000) * (premiumPts / 100);

  const limit = c.insurance.limitM;
  const retention = c.insurance.retentionK / 1000;
  const gap = h.tailLossM - limit;
  const limitRp = 1 / cur.exceed(limit);
  const tgtTail = tgt.quantile(0.01);

  // Loss exceedance curve on a log loss axis.
  const xs: number[] = [];
  for (let x = 0.1;x <= h.tailLossM * 2.6; x *= 1.12) xs.push(x);
  const curve = (f: (x: number) => number) => xs.map((x) => [Number(x.toFixed(3)), Number((f(x) * 100).toFixed(3))]);

  const scoped = tenantId !== 'all';
  const rows = scoped && onlyTenant ? sc.filter((s) => s.tenants.includes(tenantId)) : sc;
  const rps = [10, 20, 50, 100, 200];

  const byAle = sc.slice().sort((a, b) => b.ale - a.ale);
  const insured = sc.reduce((s, x) => s + x.ale * x.coveredPct, 0);

  return (
    <>
      <Intro ids={['c-hexacomply', 'c-hexaint', 'c-hexastrike', c.connectors.find((k) => k.category === 'SIEM')!.id]}>
        FAIR-style cyber risk quantification in {c.currency}: how often each loss scenario happens, how big it gets, and whether the {money(limit, c)} programme pays for it. Frequencies are calibrated with sector loss data and adjusted by live control state.
      </Intro>
      <TenantNote />

      <KpiStrip
        toneColor={INS_TONE}
        items={[
          { label: 'Expected annual loss', hint: 'ALE', value: money(h.expectedLossM, c), delta: { text: `${((h.expectedLossM / c.revenueM) * 100).toFixed(2)}% of revenue`, good: true }, onClick: () => setRec('ale'), source: `HexaView FAIR model · ${sc.length} scenarios · HexaInt, HexaStrike, HexaComply` },
          { label: '1-in-100 year loss', value: money(h.tailLossM, c), delta: { text: `99th percentile annual loss`, good: true }, onClick: () => setRec('tail'), source: 'HexaView FAIR model (loss exceedance curve)' },
          { label: 'Policy limit', value: money(limit, c), unit: `xs ${money(retention, c)}`, to: '/insurance/policy', source: `${c.insurance.carrier} · policy schedule` },
          { label: gap > 0 ? 'Coverage gap at 1-in-100' : 'Headroom at 1-in-100', value: money(Math.abs(gap), c), delta: { text: gap > 0 ? 'Retained by the business' : 'Limit exceeds tail loss', good: gap <= 0 }, onClick: () => setRec('gap'), source: 'HexaView FAIR model vs policy tower' },
          { label: 'Limit exhausted', value: `1-in-${fmtNum(limitRp)}`, unit: 'years', delta: { text: limitRp >= 100 ? 'Meets 1-in-100 appetite' : 'Below 1-in-100 appetite', good: limitRp >= 100 }, onClick: () => scrollToId('ins-lec'), source: 'HexaView FAIR model (loss exceedance curve)' },
          { label: 'What-if ALE', value: money(newAle, c), delta: { text: `-${money(reduction, c)} with ${chosen.length} investments`, good: true }, onClick: () => setRec('whatif'), source: 'HexaView what-if model · HexaComply roadmap' },
        ]}
      />

      <div id="ins-lec" />
      <div className="grid g-3-2">
        <Card title="Loss exceedance curve" sub="Probability that total cyber loss in a year exceeds a given amount: current posture vs the selected investments">
          <Chart
            height={320}
            option={{
              grid: { left: 8, right: 18, top: 34, bottom: 8, containLabel: true },
              legend: { top: 0, data: ['Current posture', 'With selected investments'] },
              tooltip: { trigger: 'axis', formatter: (ps: unknown) => {
                const arr = ps as { seriesName: string; value: [number, number] }[];
                if (!arr.length) return '';
                return `Loss > <b>${money(arr[0].value[0], c)}</b><br/>${arr.map((p) => `${p.seriesName}: ${p.value[1].toFixed(2)}%`).join('<br/>')}`;
              } },
              xAxis: { type: 'log', name: `Annual loss (${c.currency} M)`, nameLocation: 'middle', nameGap: 24, min: Number(xs[0].toFixed(2)), max: Math.ceil(h.tailLossM * 2.6), axisLabel: { formatter: (v: number) => money(v, c) } },
              yAxis: { type: 'value', name: 'P(exceed) %', max: Math.ceil(cur.p0 * 10) * 10, axisLabel: { formatter: '{value}%' } },
              series: [
                {
                  name: 'Current posture', type: 'line', smooth: true, symbol: 'none', data: curve(cur.exceed), lineStyle: { color: '#f5a83d', width: 2.5 }, itemStyle: { color: '#f5a83d' },
                  areaStyle: { color: 'rgba(245,168,61,.08)' },
                  markLine: {
                    symbol: 'none', silent: true, label: { show: false },
                    data: [
                      { name: 'Retention', xAxis: retention, lineStyle: { color: '#8593b4', type: 'dotted' } },
                      { name: 'Expected', xAxis: h.expectedLossM, lineStyle: { color: '#f5a83d', type: 'dotted' } },
                      { name: 'Limit', xAxis: limit, lineStyle: { color: INS_HEX, type: 'solid', width: 2 } },
                      { name: '1-in-100', yAxis: 1, lineStyle: { color: '#e0345e', type: 'dashed' } },
                    ],
                  },
                  markPoint: { symbol: 'circle', symbolSize: 9, silent: true, itemStyle: { color: '#e0345e' }, label: { show: false }, data: [{ name: '1-in-100', coord: [h.tailLossM, 1] }] },
                },
                { name: 'With selected investments', type: 'line', smooth: true, symbol: 'none', data: curve(tgt.exceed), lineStyle: { color: INS_HEX, width: 2.5, type: 'dashed' }, itemStyle: { color: INS_HEX } },
              ],
            }}
          />
          <div className="section-label" style={{ marginTop: 6 }}>Where the programme sits on the loss scale</div>
          <MarkerScale
            min={Math.max(0.05, retention / 4)}
            max={Math.max(h.tailLossM, limit) * 1.6}
            format={(v) => money(v, c)}
            band={{ from: retention, to: limit + retention, color: INS_HEX, label: 'Insured layer' }}
            markers={[
              { value: retention, label: 'Retention', detail: money(retention, c), color: '#8593b4', dash: true },
              { value: h.expectedLossM, label: 'Expected annual loss', detail: money(h.expectedLossM, c), color: '#f5a83d', dash: true, onClick: () => setRec('ale') },
              { value: limit, label: 'Policy limit', detail: money(limit, c), color: INS_HEX },
              { value: tgtTail, label: '1-in-100 with investments', detail: money(tgtTail, c), color: '#93d65a', dash: true, onClick: () => setRec('whatif') },
              { value: h.tailLossM, label: '1-in-100 today', detail: money(h.tailLossM, c), color: '#e0345e', onClick: () => setRec('tail') },
            ]}
          />
          <div className="card-foot">
            <span>Annual chance of any material loss {Math.round(cur.p0 * 100)}%</span>
            <span>With investments the 1-in-100 falls to {money(tgtTail, c)}</span>
          </div>
        </Card>

        <Card title="Tail loss vs the programme" sub={`Return-period losses against the ${money(limit, c)} limit and ${money(retention, c)} retention`}>
          <SegRows
            legend
            labelWidth={92}
            format={(v) => money(v, c)}
            rows={rps.map((r) => {
              const q = cur.quantile(1 / r);
              return {
                label: `1-in-${r}`,
                sub: `${(100 / r).toFixed(r >= 100 ? 1 : 0)}% a year`,
                onClick: () => setRec('tail'),
                parts: [
                  { label: 'Retained', value: Math.min(q, retention), color: '#8a9bc0' },
                  { label: 'Insured', value: Math.max(0, Math.min(q, limit + retention) - retention), color: INS_HEX },
                  { label: 'Above limit', value: Math.max(0, q - limit - retention), color: '#f8646f' },
                ],
              };
            })}
          />
          {gap > 0 ? (
            <Callout kind="warn">
              A 1-in-100 year loss of <b>{money(h.tailLossM, c)}</b> exceeds the limit by <b>{money(gap, c)}</b>. The limit is exhausted roughly once every {fmtNum(limitRp)} years. {forCustomer(TOWER_ADVICE, c)}
            </Callout>
          ) : (
            <Callout kind="good">The limit covers a 1-in-100 year loss with {money(-gap, c)} headroom.</Callout>
          )}
          <div className="mini-stats" style={{ marginTop: 10 }}>
            <button className="mini-stat cc-link" onClick={() => setRec('ale')} title="Source: HexaView FAIR model × sublimits · click to open"><b style={{ color: INS_TONE }}>{money(insured, c)}</b><span>ALE insured (after sublimits)</span></button>
            <button className="mini-stat cc-link" onClick={() => setRec('ale')} title="Source: HexaView FAIR model × sublimits · click to open"><b>{money(h.expectedLossM - insured, c)}</b><span>ALE retained</span></button>
            <button className="mini-stat cc-link" onClick={() => setRec('ale')} title="Source: HexaView FAIR model × sublimits · click to open"><b>{Math.round((insured / h.expectedLossM) * 100)}%</b><span>Expected loss insured</span></button>
          </div>
        </Card>
      </div>

      <div id="ins-scenarios" />
      <Card
        title="Loss scenarios"
        count={rows.length}
        sub="Annual frequency × magnitude (min / most likely / max, PERT) = annualised loss expectancy. Sums to the expected annual loss. Click a scenario for detail."
        flush
        actions={scoped ? <Chip on={onlyTenant} onClick={() => setOnlyTenant(!onlyTenant)} color={INS_TONE}>Only scenarios touching {tenantName(c, tenantId)}</Chip> : undefined}
      >
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={setOpen}
          initialSort={{ key: 'ale', dir: 'desc' }}
          search={(r) => `${r.name} ${r.category} ${r.actors.join(' ')}`}
          searchPlaceholder="Filter scenarios…"
          columns={[
            { key: 'name', header: 'Scenario', sort: (r) => r.name, render: (r) => (<><div className="t-main">{r.name}</div><div className="t-sub">{r.category} · {r.actors.slice(0, 2).join(', ')}</div></>) },
            { key: 'freq', header: 'Frequency / yr', align: 'right', sort: (r) => r.freq, render: (r) => (<><div className="num">{r.freq.toFixed(3)}</div><div className="t-sub">1 in {fmtNum(1 / r.freq)} yrs</div></>) },
            { key: 'mag', header: 'Magnitude (min / ML / max)', render: (r) => <span className="num">{money(r.min, c)} / <b>{money(r.ml, c)}</b> / {money(r.max, c)}</span> },
            { key: 'ale', header: 'ALE', align: 'right', sort: (r) => r.ale, render: (r) => <b className="num">{money(r.ale, c)}</b> },
            { key: 'share', header: 'Share', sort: (r) => r.ale, render: (r) => (<div style={{ minWidth: 90 }}><div className="bar thin" style={{ ['--tone' as string]: INS_TONE }}><i style={{ width: `${(r.ale / byAle[0].ale) * 100}%` }} /></div><span className="t-sub">{Math.round((r.ale / h.expectedLossM) * 100)}%</span></div>) },
            { key: 'cov', header: 'Insured', align: 'right', sort: (r) => r.coveredPct, render: (r) => <Badge color={r.coveredPct >= 0.6 ? 'var(--good)' : r.coveredPct >= 0.4 ? 'var(--sev-medium)' : 'var(--bad)'}>{Math.round(r.coveredPct * 100)}%</Badge> },
            { key: 'after', header: 'ALE after what-if', align: 'right', sort: (r) => after[r.id], render: (r) => <span className="num" style={{ color: after[r.id] < r.ale - 0.001 ? 'var(--good)' : undefined }}>{money(after[r.id], c)}</span> },
          ]}
        />
      </Card>

      <div className="grid g-2-1">
        <Card title="Where the expected loss comes from" sub="ALE by scenario, split by loss component · click a scenario for detail">
          <SegRows
            legend
            labelWidth={230}
            format={(v) => money(v, c)}
            rows={byAle.map((s) => ({
              label: s.name,
              sub: `${s.category} · 1 in ${fmtNum(1 / s.freq)} yrs`,
              onClick: () => setOpen(s),
              parts: (Object.keys(MIX_LABEL) as MixKey[]).map((k) => ({ label: MIX_LABEL[k], value: s.ale * s.mix[k], color: MIX_COLOR[k] })),
            }))}
          />
        </Card>

        <Card title={<><Target size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Control investment what-if</>} sub="Choose improvements; ALE, tail and premium recalculate" toneColor={INS_TONE} tinted>
          <div>
            {inv.map((i) => {
              const solo = applyInvestments(sc, [i]);
              const red = h.expectedLossM - Object.values(solo).reduce((s, v) => s + v, 0);
              const k = ctl.find((x) => x.id === i.controlId);
              return (
                <label key={i.id} className="ins-check">
                  <input type="checkbox" checked={sel.includes(i.id)} onChange={() => setSel((s) => (s.includes(i.id) ? s.filter((x) => x !== i.id) : [...s, i.id]))} />
                  <span>
                    <b style={{ fontWeight: 600 }}>{i.name}</b>
                    <span className="muted" style={{ display: 'block', fontSize: 11 }}>
                      {money(i.costM, c)} / yr · {k && <ControlStatusBadge status={k.status} />} {i.recommended && <Badge color={INS_TONE}>Recommended</Badge>}
                    </span>
                  </span>
                  <span className="ins-roi">
                    <b style={{ color: 'var(--good)' }}>-{money(red, c)}</b>
                    <span className="muted" style={{ display: 'block' }}>ROI {(((red - i.costM) / i.costM) * 100).toFixed(0)}%</span>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="mini-stats" style={{ marginTop: 12 }}>
            <MiniStat value={money(newAle, c)} label={`ALE (from ${money(h.expectedLossM, c)})`} color={INS_TONE} />
            <MiniStat value={money(cost, c)} label="Annual cost" />
            <MiniStat value={`${(roi * 100).toFixed(0)}%`} label="Return on investment" color={roi > 0 ? 'var(--good)' : 'var(--bad)'} />
            <MiniStat value={`-${premiumPts.toFixed(1)} pts`} label={`Premium (≈ ${money(premiumSave, c)})`} />
          </div>
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <Btn sm primary color={INS_TONE} disabled={!chosen.length} onClick={() => setPlan(true)}>
              <TrendingDown size={13} /> Add to risk-reduction plan
            </Btn>
            <Btn sm ghost onClick={() => setSel([])}>Clear</Btn>
          </div>
        </Card>
      </div>

      {open && (
        <Drawer title={open.name} sub={`${open.category} · ${open.tenants.map((t) => tenantName(c, t)).join(', ')}`} onClose={() => setOpen(null)} wide>
          <p className="secondary" style={{ marginTop: 0 }}>{open.narrative}</p>
          <div className="grid g2" style={{ gap: 14 }}>
            <KV
              rows={[
                ['Annual frequency', `${open.freq.toFixed(3)} (1 in ${fmtNum(1 / open.freq)} years)`],
                ['Magnitude', `${money(open.min, c)} min · ${money(open.ml, c)} most likely · ${money(open.max, c)} max`],
                ['Mean loss (PERT)', money(open.mean, c)],
                ['Annualised loss', <b>{money(open.ale, c)}</b>],
                ['After what-if', money(after[open.id], c)],
                ['Policy response', open.cover],
                ['Expected insured share', `${Math.round(open.coveredPct * 100)}%`],
              ]}
            />
            <div>
              <div className="section-label">Loss components (FAIR forms)</div>
              <div className="stacked tall" style={{ height: 22, marginBottom: 10 }}>
                {(Object.keys(MIX_LABEL) as MixKey[]).filter((k) => open.mix[k] > 0).map((k) => <i key={k} style={{ width: `${open.mix[k] * 100}%`, background: MIX_COLOR[k] }} title={MIX_LABEL[k]} />)}
              </div>
              <div className="list">
                {(Object.keys(MIX_LABEL) as MixKey[]).filter((k) => open.mix[k] > 0).map((k) => (
                  <div key={k} className="list-row" style={{ padding: '6px 0' }}>
                    <span className="dot" style={{ background: MIX_COLOR[k] }} />
                    <span className="list-main"><b style={{ fontWeight: 500 }}>{MIX_LABEL[k]}</b></span>
                    <span className="num" style={{ fontWeight: 700 }}>{Math.round(open.mix[k] * 100)}% · {money(open.ale * open.mix[k], c)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <SectionLabel><span style={{ display: 'block', marginTop: 14 }}>Threat actors and techniques</span></SectionLabel>
          <div className="chips">
            {open.actors.map((a) => <Badge key={a} color="var(--sev-high)">{a}</Badge>)}
            {open.techniques.map((t) => <Badge key={t} color="var(--m-matrix)">{t}</Badge>)}
          </div>
          <SectionLabel><span style={{ display: 'block', marginTop: 14 }}>Controls that move this scenario</span></SectionLabel>
          <div className="list">
            {ctl.filter((k) => open.controls.includes(k.id)).map((k) => (
              <div key={k.id} className="list-row">
                <span className="list-main"><b>{k.name}</b><span>{k.metric}</span></span>
                <ControlStatusBadge status={k.status} />
              </div>
            ))}
          </div>
          {open.category === 'State-backed' && <Callout kind="warn">Losses attributed to a state-backed cyber operation may fall under the war exclusion. HexaInt preserves attribution evidence for the claim discussion.</Callout>}
          {open.category === 'Vehicle fleet' && <Callout kind="warn">Product recall costs are excluded; only response, OTA remediation (vehicle endorsement) and liability are recoverable.</Callout>}
          {open.category === 'IP theft' && <Callout kind="warn">Loss of IP value is excluded; only investigation and response costs are covered.</Callout>}
          {open.category === 'Content leak' && <Callout kind="warn">Lost box office and licensing income from leaked content are excluded; only response and re-marketing costs are recoverable under the buy-back.</Callout>}
          <Legend items={[{ label: 'Loss components follow FAIR primary and secondary loss forms', color: INS_HEX }]} />
        </Drawer>
      )}

      {rec === 'ale' && (
        <RecordsDrawer
          title="Expected annual loss by scenario"
          sub={`${sc.length} scenarios sum to ${money(h.expectedLossM, c)} · ${money(insured, c)} expected to be insured`}
          source="HexaView FAIR model · frequencies from HexaInt and sector loss data, adjusted by live control state from HexaComply"
          onClose={() => setRec(null)}
          rows={byAle.map((s) => ({ key: s.id, title: s.name, sub: `${s.category} · ${s.freq.toFixed(3)} / yr × ${money(s.mean, c)} mean · insured ${Math.round(s.coveredPct * 100)}%`, right: money(s.ale, c), onClick: () => { setRec(null); setOpen(s); } }))}
        />
      )}
      {rec === 'tail' && (
        <RecordsDrawer
          title="Return-period losses"
          sub={`Against the ${money(limit, c)} limit and ${money(retention, c)} retention`}
          source="HexaView FAIR model (Weibull-tail loss exceedance curve fitted to the scenario set)"
          onClose={() => setRec(null)}
          rows={[2, 5, 10, 20, 50, 100, 200, 500].map((r) => {
            const q = cur.quantile(1 / r);
            return { key: String(r), title: `1-in-${r} year loss`, sub: `${(100 / r).toFixed(1)}% annual probability · ${q > limit + retention ? `${money(q - limit - retention, c)} above the limit` : 'within the programme'} · with investments ${money(tgt.quantile(1 / r), c)}`, right: money(q, c), badge: q > limit + retention ? <Badge color="var(--bad)">Above limit</Badge> : undefined };
          })}
        />
      )}
      {rec === 'gap' && (
        <RecordsDrawer
          title={gap > 0 ? 'Coverage gap at 1-in-100' : 'Headroom at 1-in-100'}
          sub={`${money(h.tailLossM, c)} modelled tail vs ${money(limit, c)} limit`}
          source={`HexaView FAIR model · ${c.insurance.carrier} tower`}
          onClose={() => setRec(null)}
          rows={sc.slice().sort((a, b) => b.max - a.max).map((s) => ({ key: s.id, title: s.name, sub: `Worst case ${money(s.max, c)} · ${s.cover}`, right: money(s.max, c), badge: s.max > limit ? <Badge color="var(--bad)">Exceeds limit</Badge> : <Badge color="var(--good)">Within limit</Badge>, onClick: () => { setRec(null); setOpen(s); } }))}
        >
          <Callout kind={gap > 0 ? 'warn' : 'good'}>{gap > 0 ? forCustomer(TOWER_ADVICE, c) : 'The programme covers a 1-in-100 year loss.'}</Callout>
        </RecordsDrawer>
      )}
      {rec === 'whatif' && (
        <RecordsDrawer
          title="What-if investments"
          sub={`${chosen.length} selected · ALE ${money(h.expectedLossM, c)} → ${money(newAle, c)}`}
          source="HexaView what-if model · control mapping from HexaComply"
          onClose={() => setRec(null)}
          rows={inv.map((i) => {
            const red = h.expectedLossM - Object.values(applyInvestments(sc, [i])).reduce((s, v) => s + v, 0);
            return { key: i.id, title: i.name, sub: `${money(i.costM, c)} / yr · premium −${i.premiumPts} pts`, right: <span style={{ color: 'var(--good)' }}>−{money(red, c)}</span>, badge: sel.includes(i.id) ? <Badge color={INS_TONE}>Selected</Badge> : undefined, onClick: () => setSel((s) => (s.includes(i.id) ? s.filter((x) => x !== i.id) : [...s, i.id])) };
          })}
        />
      )}

      {plan && (
        <Modal
          title="Add to risk-reduction plan"
          sub="Write-back to HexaComply roadmap and the board report"
          onClose={() => setPlan(false)}
          footer={
            <>
              <Btn ghost onClick={() => setPlan(false)}>Cancel</Btn>
              <Btn primary color={INS_TONE} onClick={() => { setPlan(false); toast(`${chosen.length} investments added to the risk-reduction plan; ${c.people.ciso.name} notified for approval`); }}>Submit for approval</Btn>
            </>
          }
        >
          <KV
            rows={[
              ['Investments', chosen.map((i) => i.name).join('; ')],
              ['Annual cost', money(cost, c)],
              ['ALE reduction', `${money(reduction, c)} (${Math.round((reduction / h.expectedLossM) * 100)}%)`],
              ['1-in-100 loss', `${money(h.tailLossM, c)} → ${money(tgtTail, c)}`],
              ['Risk class', <Badge color="var(--good)">Low (LLD 8.2): plan entry only</Badge>],
              ['Approvals', `${c.people.ciso.name} (budget owner), then CFO for spend above ${money(0.25, c)}`],
            ]}
          />
        </Modal>
      )}
    </>
  );
}
