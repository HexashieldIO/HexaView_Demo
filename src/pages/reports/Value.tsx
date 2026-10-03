import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, RotateCcw, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Btn, Badge, Callout, Sources, Freshness } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { fmtMoney, fmtNum, fmtCompact } from '../../lib/format';
import { tenantName } from '../../data/customers';
import {
  valueModel, defaultAssumptions, VCAP_BY_ID, ASSUMPTION_META,
  type ValueAssumptions, type CapKey, type ValueLine,
} from '../../data/modules/value';
import { useRecords, scrollToId } from '../ops/parts';
import { REP_TONE, GenerateModal } from './parts';
import { ValueVsCost, ValueLegend, ValuePaper } from './value/parts';

/** Edited assumptions survive navigation within the session, per customer. */
const ASSUMPTIONS = new Map<string, ValueAssumptions>();
const SECTION_IDS: Record<string, string> = { quarters: 'vx-quarters', capability: 'vx-capability', 'before-after': 'vx-ba', stories: 'vx-stories', assumptions: 'vx-assumptions', lines: 'vx-lines' };

export default function Value() {
  const { customer } = useApp();
  return <ValueInner key={customer.id} />;
}

function ValueInner() {
  const { customer: c, tenantId, toast } = useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const defaults = useMemo(() => defaultAssumptions(c), [c]);
  const [a, setA] = useState<ValueAssumptions>(() => ASSUMPTIONS.get(c.id) ?? defaults);
  useEffect(() => { ASSUMPTIONS.set(c.id, a); }, [c.id, a]);
  const m = useMemo(() => valueModel(c, tenantId, a), [c, tenantId, a]);
  const [gen, setGen] = useState(false);
  const [paper, setPaper] = useState(false);
  const [, openRecords, recordsNode] = useRecords();
  const $ = (n: number) => fmtMoney(n, c.currency);
  const sym = fmtMoney(0, c.currency).replace('0', '');

  const section = sp.get('section');
  useEffect(() => {
    if (section && SECTION_IDS[section]) scrollToId(SECTION_IDS[section]);
  }, [section]);

  const siem = c.connectors.find((k) => k.category === 'SIEM')?.product ?? 'SIEM';
  const itsm = c.connectors.find((k) => k.category === 'ITSM')?.product ?? 'ITSM';
  const grc = c.connectors.find((k) => k.category === 'GRC')?.product ?? 'HexaComply';
  const edited = (Object.keys(a) as (keyof ValueAssumptions)[]).filter((k) => a[k] !== defaults[k]);
  const mttrPct = Math.round((1 - m.mttr / Math.max(1, m.mttrBefore)) * 100);
  const maxCap = Math.max(...m.byCap.map((b) => Math.max(b.value, b.cost)), 1);

  const capDrawer = (cap: CapKey) => {
    const b = m.byCap.find((x) => x.cap === cap);
    if (!b) return;
    openRecords({
      title: `${VCAP_BY_ID[cap].label} · ${$(b.value)} value`,
      sub: `${$(b.cost)} cost · ${b.cost ? `${(b.value / b.cost).toFixed(1)}× return` : 'no direct cost'} · click a line to open its source`,
      source: b.lines.map((l) => l.source).filter((s, i, arr) => arr.indexOf(s) === i).join(' · '),
      rows: b.lines.map((l) => ({
        key: l.key,
        main: <button type="button" className="cc-link" onClick={() => nav(l.to)}>{l.label} <ArrowUpRight size={11} /></button>,
        meta: `${l.formula} · ${l.source}`,
        right: <b className="num">{$(l.value)}</b>,
        color: VCAP_BY_ID[cap].color,
      })),
    });
  };
  const hoursDrawer = () =>
    openRecords({
      title: `${fmtNum(Math.round(m.hoursSaved))} analyst hours saved`,
      sub: `12 months · counted at ${a.realisation}% realisation and ${fmtMoney(a.hourly, c.currency, false)} an hour`,
      source: 'HexaSOC auto-triage · HexaAI agent ledger · HexaComply evidence · Trust Centre · Reporting Centre',
      rows: m.hoursBreakdown.map((h) => ({ key: h.label, main: <button type="button" className="cc-link" onClick={() => nav(h.to)}>{h.label} <ArrowUpRight size={11} /></button>, meta: h.source, right: <b className="num">{fmtNum(Math.round(h.hours))} h</b>, color: REP_TONE })),
    });
  const mttrDrawer = () =>
    openRecords({
      title: 'Response times: before and after',
      sub: `Baseline from the first 90 days after onboarding vs the last 30 days`,
      source: `HexaSOC case timestamps · ${siem}`,
      rows: m.beforeAfter.filter((b) => b.unit === 'min').map((b) => ({ key: b.key, main: b.label, meta: `${b.before} → ${b.after} ${b.unit}`, right: <Badge color="var(--good)">↓ {Math.round((1 - b.after / Math.max(1, b.before)) * 100)}%</Badge>, color: 'var(--good)' })),
    });
  const costDrawer = () =>
    openRecords({
      title: `Annual cost · ${$(m.cost)}`,
      sub: 'HexaView licence and HexaShield managed services, from the order form',
      source: 'HexaShield order form · partner billing',
      rows: m.costLines.map((x) => ({ key: x.label, main: x.label, meta: x.trial ? 'Trial: value counted at a reduced rate' : VCAP_BY_ID[x.cap].label, right: <b className="num">{$(x.value)}</b>, color: VCAP_BY_ID[x.cap].color })),
    });

  if (paper) return <ValuePaper c={c} tenantId={tenantId} m={m} a={a} onBack={() => setPaper(false)} />;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <p className="page-intro" style={{ margin: 0 }}>
        <b>{c.name}</b> · {tenantName(c, tenantId)}: what HexaView and HexaShield services delivered against what they cost over the last 12 months, in {c.currency}. Every value line shows its formula and source ({siem}, {itsm}, {grc}, HexaSOC, HexaInt, risk quantification) and recomputes when you change the assumptions.
      </p>

      <div className="vx-kpi8">
        <KpiStrip
          toneColor={REP_TONE}
          items={[
            { label: 'Incidents contained', value: fmtNum(m.incidentsContained), unit: `${m.openIncidents} open now`, to: '/soc/ir', source: `HexaSOC cases (12 months) · ${siem}` },
            { label: 'Time to contain', value: `${m.mttr} min`, unit: `was ${m.mttrBefore}`, delta: { text: `↓ ${mttrPct}% since onboarding`, good: true }, onClick: mttrDrawer, source: `HexaSOC case timestamps · ${siem}` },
            { label: 'Analyst hours saved', value: fmtCompact(m.hoursSaved), unit: 'a year', onClick: hoursDrawer, source: 'Auto-triage, agentic SOC, evidence, questionnaires and reports' },
            { label: 'Loss avoided', value: $(m.lossAvoided), unit: 'expected / yr', toneColor: 'var(--good)', to: '/insurance/quantification', source: `FAIR risk quantification · expected loss ${$(m.elBefore)} → ${$(m.elNow)}` },
            { label: 'Premium savings', value: $(m.premiumSaving), unit: `vs ${a.marketPremiumPct > 0 ? '+' : ''}${a.marketPremiumPct}% market`, to: '/insurance/policy?view=renewal', source: `Policy & renewal · ${c.insurance.broker}` },
            { label: 'Tool spend rationalised', value: $(m.toolSaving), unit: `${m.toolCount} tools`, to: '/ops/scorecard?reco=Consolidate,Replace', source: 'Tool scorecard recommendations · contract register' },
            { label: 'Questionnaires & audits', value: `${m.questionnaires} + ${m.audits}`, unit: 'accelerated', to: '/trust/questionnaires', source: `Trust Centre answer library · ${grc} audit packs` },
            { label: 'ROI multiple', value: `${m.roi.toFixed(1)}×`, unit: `${$(m.total)} vs ${$(m.cost)}`, toneColor: m.roi >= 1 ? 'var(--good)' : 'var(--bad)', onClick: () => scrollToId('vx-quarters'), source: 'HexaView value model · order form' },
          ]}
        />
      </div>

      <Card tinted toneColor={REP_TONE}>
        <div className="vx-hero">
          <div className="vx-hero-big">
            <small>Return on HexaView and services</small>
            <b style={{ color: 'var(--good)' }}>{sym}{m.roi.toFixed(2)} for every {sym}1</b>
            <span>{$(m.net)} net value · payback in {m.paybackMonths} months{edited.length ? ` · ${edited.length} assumption${edited.length === 1 ? '' : 's'} edited` : ''}</span>
          </div>
          <div className="vx-vc">
            <div className="vx-vc-row">
              <span>Value</span>
              <span className="trk" title="Value by capability">
                {m.byCap.map((b) => <i key={b.cap} style={{ width: `${(b.value / Math.max(m.total, m.cost)) * 100}%`, background: VCAP_BY_ID[b.cap].hex }} title={`${VCAP_BY_ID[b.cap].label}: ${$(b.value)}`} />)}
              </span>
              <b style={{ color: 'var(--good)' }}>{$(m.total)}</b>
            </div>
            <button type="button" className="vx-vc-row" style={{ border: 0, background: 'transparent', color: 'inherit', font: 'inherit', padding: 0, cursor: 'pointer', textAlign: 'left' }} onClick={costDrawer}>
              <span>Cost</span>
              <span className="trk"><i style={{ width: `${(m.cost / Math.max(m.total, m.cost)) * 100}%`, background: '#f8646f' }} /></span>
              <b>{$(m.cost)}</b>
            </button>
            <ValueLegend />
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <div className="vx-hero-side">
              <button type="button" className="vx-mini" onClick={() => scrollToId('vx-stories')}><b>{m.stories.length}</b><span>outcome stories</span></button>
              <button type="button" className="vx-mini" onClick={() => scrollToId('vx-ba')}><b>{m.beforeAfter.length}</b><span>before / after measures</span></button>
            </div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <Btn sm primary color={REP_TONE} onClick={() => setGen(true)}><FileText size={13} /> Generate value summary</Btn>
              <Btn sm onClick={() => scrollToId('vx-assumptions')}><SlidersHorizontal size={13} /> Assumptions</Btn>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid g-3-2">
        <div id="vx-quarters" style={{ minWidth: 0, scrollMarginTop: 80 }}>
          <Card title="Value delivered vs cost by quarter" sub="Columns: value by capability · dashed: cost (first quarter includes onboarding) · last four quarters = the 12-month value">
            <ValueVsCost m={m} currency={c.currency} onPick={(i) => toast(`${m.quarters[i].label}: ${$(m.quarters[i].value)} value for ${$(m.quarters[i].cost)} cost (${(m.quarters[i].value / Math.max(1, m.quarters[i].cost)).toFixed(1)}×)`)} />
            <div className="card-foot"><Sources items={c.connectors.filter((k) => ['SIEM', 'ITSM', 'GRC'].includes(k.category)).slice(0, 4).map((k) => ({ name: k.product, status: k.status }))} /><Freshness minutes={6} label="Value model" /></div>
          </Card>
        </div>
        <div id="vx-capability" style={{ minWidth: 0, scrollMarginTop: 80 }}>
          <Card title="Value by capability" sub="Bar = value · red tick = cost · click for the lines behind it">
            {m.byCap.slice().sort((x, y) => y.value - x.value).map((b) => {
              const v = VCAP_BY_ID[b.cap];
              const trial = v.service ? c.services[v.service] === 'trial' : false;
              return (
                <button key={b.cap} type="button" className="vx-cap" onClick={() => capDrawer(b.cap)} title={`${v.label}: ${$(b.value)} value, ${$(b.cost)} cost`}>
                  <span className="nm"><b style={{ color: v.color }}>{v.label}</b><span>{b.lines.length} value lines{trial ? ' · trial' : ''}</span></span>
                  <span className="trk"><i style={{ width: `${(b.value / maxCap) * 100}%`, background: v.hex }} /><u style={{ left: `${(b.cost / maxCap) * 100}%` }} /></span>
                  <span className="v">{$(b.value)}</span>
                  <span className="x" style={{ color: b.cost && b.value / b.cost >= 1 ? 'var(--good)' : 'var(--sev-medium)' }}>{b.cost ? `${(b.value / b.cost).toFixed(1)}×` : '—'}</span>
                </button>
              );
            })}
          </Card>
        </div>
      </div>

      <div className="grid g2">
        <div id="vx-ba" style={{ minWidth: 0, scrollMarginTop: 80 }}>
          <Card title="Before and after HexaView" sub="Onboarding baseline (grey) → now (green) · click to open the source">
            {m.beforeAfter.map((b) => {
              const hi = Math.max(b.before, b.after) * 1.08 || 1;
              const lo = Math.min(b.before, b.after);
              const imp = b.better === 'lower' ? Math.round((1 - b.after / Math.max(1, b.before)) * 100) : b.after - b.before;
              return (
                <button key={b.key} type="button" className="vx-ba" onClick={() => nav(b.to)} title={`Source: ${b.source}`}>
                  <span className="nm"><b>{b.label}</b><span>{b.before} → {b.after} {b.unit}</span></span>
                  <span className="db">
                    <span className="seg" style={{ left: `${(lo / hi) * 100}%`, width: `${((Math.max(b.before, b.after) - lo) / hi) * 100}%` }} />
                    <span className="dot b" style={{ left: `${(b.before / hi) * 100}%` }} />
                    <span className="dot a" style={{ left: `${(b.after / hi) * 100}%` }} />
                  </span>
                  <span className="imp">{b.better === 'lower' ? `↓ ${imp}%` : `+${imp} pts`}</span>
                </button>
              );
            })}
          </Card>
        </div>
        <div id="vx-stories" style={{ minWidth: 0, scrollMarginTop: 80 }}>
          <Card title="Top outcome stories" count={m.stories.length} sub="Each opens the record it came from">
            <div className="stack" style={{ gap: 8 }}>
              {m.stories.slice().sort((x, y) => y.value - x.value).map((s) => (
                <button key={s.id} type="button" className="vx-story" style={{ '--sc': VCAP_BY_ID[s.cap].color } as CSSProperties} onClick={() => nav(s.to)} title={`Source: ${s.source}`}>
                  <i />
                  <span className="bd">
                    <b>{s.title}</b>
                    <span>{s.body}</span>
                    <em>{VCAP_BY_ID[s.cap].label} · {s.daysAgo} d ago · {s.source}</em>
                  </span>
                  <span className="rt"><b>{$(s.value)}</b><span>{s.metric}</span></span>
                </button>
              ))}
              {!m.stories.length && <span className="muted">No outcome stories for this tenant yet.</span>}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid g-2-1">
        <div id="vx-lines" style={{ minWidth: 0, scrollMarginTop: 80 }}>
          <Card title="How the value is calculated" count={m.lines.length} flush sub="Every line: formula, inputs and source · click to open the source page">
            <DataTable<ValueLine>
              rows={m.lines}
              rowKey={(l) => l.key}
              initialSort={{ key: 'value', dir: 'desc' }}
              onRowClick={(l) => nav(l.to)}
              search={(l) => `${l.label} ${l.formula} ${l.source} ${VCAP_BY_ID[l.cap].label}`}
              searchPlaceholder="Search value lines…"
              pageSize={10}
              columns={[
                { key: 'cap', header: 'Capability', sort: (l) => l.cap, render: (l) => <Badge color={VCAP_BY_ID[l.cap].color}>{VCAP_BY_ID[l.cap].label}</Badge> },
                { key: 'label', header: 'Value line', render: (l) => <><div className="t-main">{l.label}</div><div className="t-sub">{l.formula}</div></> },
                { key: 'source', header: 'Source', render: (l) => <span style={{ fontSize: 11.5 }}>{l.source}</span> },
                { key: 'value', header: 'Value', align: 'right', sort: (l) => l.value, render: (l) => <b className="num">{$(l.value)}</b> },
              ]}
            />
          </Card>
        </div>
        <div id="vx-assumptions" style={{ minWidth: 0, scrollMarginTop: 80 }}>
          <Card
            title="Assumptions"
            sub="Edit any input; every number on the page recomputes"
            actions={edited.length ? <Btn sm ghost onClick={() => { setA(defaults); toast('Assumptions reset to HexaShield defaults'); }}><RotateCcw size={12} /> Reset</Btn> : undefined}
          >
            <div className="vx-asm">
              {ASSUMPTION_META.map((d) => (
                <div key={d.key} className={`vx-asm-row ${a[d.key] !== defaults[d.key] ? 'changed' : ''}`} title={d.hint}>
                  <span><b>{d.label}</b><span>{d.hint}</span></span>
                  <label>
                    {d.money && <em>{sym}</em>}
                    <input
                      className="input"
                      type="number"
                      step={d.step}
                      min={d.min}
                      max={d.max}
                      value={a[d.key]}
                      aria-label={d.label}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        setA((x) => ({ ...x, [d.key]: Math.max(d.min, Math.min(d.max, v)) }));
                      }}
                    />
                    <em>{d.unit}</em>
                  </label>
                </div>
              ))}
            </div>
            <Callout kind={m.roi >= 1 ? 'good' : 'warn'}>
              With these inputs: <b>{$(m.total)}</b> value, <b>{m.roi.toFixed(1)}×</b> return. Halving the realisation rate still gives <b>{halfRealisationRoi(m).toFixed(1)}×</b>.
            </Callout>
          </Card>
        </div>
      </div>

      {gen && (
        <GenerateModal
          title="Value & outcomes summary"
          steps={['Collecting 12 months of HexaSOC, HexaInt and HexaStrike outcomes', 'Re-running the risk quantification baseline', 'Applying your assumptions and the order form', 'Selecting outcome stories with sources', 'Laying out the board and renewal summary']}
          onClose={() => setGen(false)}
          onDone={() => { setGen(false); setPaper(true); }}
        />
      )}
      {recordsNode}
    </div>
  );
}

/** ROI if the hours-based lines were counted at half the realisation rate (sensitivity hint). */
function halfRealisationRoi(m: ReturnType<typeof valueModel>): number {
  const hoursValue = m.lines.filter((l) => l.hours !== undefined).reduce((s, l) => s + l.value, 0);
  return (m.total - hoursValue / 2) / Math.max(1, m.cost);
}
