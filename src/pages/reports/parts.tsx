import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Presentation, Briefcase, Landmark, ClipboardCheck, ShieldCheck, Users, Check, Loader2, PenLine, CalendarRange, ArrowLeftRight, Play } from 'lucide-react';
import type { CustomerProfile } from '../../data/types';
import { headlines, loops, loopSummary, LOOP_STATUS_COLOR, resilienceIndex } from '../../data/core';
import {
  buildDoc, periodReport, delta, periodFromState, PERIOD_KINDS,
  type Audience, type Format, type SectionId, type ReportPeriod, type PeriodState, type PeriodKind,
} from '../../data/modules/reports';
import { MODULE_BY_ID, CAPABILITIES } from '../../modules/registry';
import { Bar, Btn, Callout, HexScore, KV, Ring, Stacked } from '../../components/ui';
import { SEV_HEX } from '../../components/Chart';
import { Modal } from '../../components/Overlay';
import { fmtDate, fmtNum, NOW } from '../../lib/format';
import { tenantName } from '../../data/customers';
import { attention } from '../../data/overview';
import './reports.css';
import { CustomerLogo } from '../../components/CustomerLogo';

export const REP_TONE = MODULE_BY_ID.reports.tone;

export const AUDIENCE_META: Record<Audience, { icon: typeof Presentation; color: string }> = {
  Board: { icon: Presentation, color: 'var(--m-view)' },
  Executive: { icon: Briefcase, color: 'var(--m-reports)' },
  Regulator: { icon: Landmark, color: 'var(--m-strike)' },
  Auditor: { icon: ClipboardCheck, color: 'var(--m-comply)' },
  Insurer: { icon: ShieldCheck, color: 'var(--m-insurance)' },
  Customer: { icon: Users, color: 'var(--m-custody)' },
};

/* =====================================================================
   Crisp hand-built SVG charts (no canvas, labels never sit on marks)
   ===================================================================== */
const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
};
const shortNum = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${Math.round(n * 10) / 10}`);

/** Measured width so SVG text renders at true pixel size (never stretched). */
function useWidth(fallback = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export interface SeriesDef {
  name: string;
  color: string;
  data: number[];
}

function thin(labels: string[], max = 12): (string | null)[] {
  const step = Math.ceil(labels.length / max);
  return labels.map((l, i) => (i % step === 0 ? l : null));
}

/** Stacked column chart. Width is responsive via viewBox; text is real SVG text at fixed size. */
export function SvgColumns({ labels, series, height = 170, unit = '' }: { labels: string[]; series: SeriesDef[]; height?: number; unit?: string }) {
  const [ref, W] = useWidth();
  const pad = { l: 40, r: 8, t: 10, b: 24 };
  const totals = labels.map((_, i) => series.reduce((s, x) => s + (x.data[i] ?? 0), 0));
  const ints = series.every((x) => x.data.every((v) => Number.isInteger(v)));
  const raw = Math.max(...totals, 1);
  let step = niceMax(raw / 4);
  if (ints) step = Math.max(1, Math.ceil(step));
  const max = step * Math.max(1, Math.ceil(raw / step));
  const iw = W - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const bw = iw / labels.length;
  const gap = Math.min(10, bw * 0.28);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => (i * step) / max);
  const xl = thin(labels);
  return (
    <div ref={ref} className="rep-svg-wrap"><svg className="rep-svg" viewBox={`0 0 ${W} ${height}`} width={W} height={height} role="img">
      {ticks.map((t) => {
        const y = pad.t + ih * (1 - t);
        return (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} className="rep-grid" />
            <text x={pad.l - 6} y={y + 3.5} textAnchor="end" className="rep-axis">{shortNum(max * t)}</text>
          </g>
        );
      })}
      {labels.map((l, i) => {
        let acc = 0;
        const x = pad.l + i * bw + gap / 2;
        return (
          <g key={i}>
            <title>{`${l}\n${series.map((s) => `${s.name}: ${fmtNum(s.data[i] ?? 0)}${unit}`).join('\n')}`}</title>
            {series.map((s, si) => {
              const v = s.data[i] ?? 0;
              const hgt = (v / max) * ih;
              const y = pad.t + ih - acc - hgt;
              acc += hgt;
              const topMost = series.slice(si + 1).every((x2) => !(x2.data[i] > 0));
              return v > 0 ? <rect key={s.name} x={x} y={y} width={Math.max(1, bw - gap)} height={Math.max(0.5, hgt)} fill={s.color} rx={topMost ? Math.min(3, (bw - gap) / 3) : 0} /> : null;
            })}
            {xl[i] && <text x={x + (bw - gap) / 2} y={height - 7} textAnchor="middle" className="rep-axis">{xl[i]}</text>}
          </g>
        );
      })}
    </svg></div>
  );
}

/** Line chart with end labels in a reserved right margin (no labels over lines). */
export function SvgLines({ labels, series, height = 160, unit = '', min }: { labels: string[]; series: SeriesDef[]; height?: number; unit?: string; min?: number }) {
  const [ref, W] = useWidth();
  const pad = { l: 40, r: 118, t: 12, b: 24 };
  const all = series.flatMap((s) => s.data);
  const dmin = Math.min(...all);
  const dmax = Math.max(...all);
  const span = Math.max(1, dmax - dmin);
  const lo = min ?? Math.max(0, Math.floor(dmin - span * 0.3));
  const hi = min !== undefined ? niceMax(dmax * 1.05) : Math.ceil(dmax + span * 0.3);
  const iw = W - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const X = (i: number) => pad.l + (labels.length <= 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const Y = (v: number) => pad.t + ih * (1 - (v - lo) / Math.max(1e-6, hi - lo));
  const ticks = [0, 0.5, 1];
  const xl = thin(labels, 10);
  // End labels: nudge apart if they collide.
  const ends = series.map((s) => ({ s, y: Y(s.data[s.data.length - 1] ?? 0) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
  return (
    <div ref={ref} className="rep-svg-wrap"><svg className="rep-svg" viewBox={`0 0 ${W} ${height}`} width={W} height={height} role="img">
      {ticks.map((t) => {
        const v = lo + (hi - lo) * t;
        const y = Y(v);
        return (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} className="rep-grid" />
            <text x={pad.l - 6} y={y + 3.5} textAnchor="end" className="rep-axis">{shortNum(v)}</text>
          </g>
        );
      })}
      {labels.map((l, i) => (xl[i] ? <text key={i} x={X(i)} y={height - 7} textAnchor="middle" className="rep-axis">{l}</text> : null))}
      {series.map((s) => {
        const d = s.data.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
        const area = `${d} L${X(s.data.length - 1).toFixed(1)},${pad.t + ih} L${X(0).toFixed(1)},${pad.t + ih} Z`;
        return (
          <g key={s.name}>
            {series.length === 1 && <path d={area} fill={s.color} opacity={0.1} />}
            <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {s.data.length <= 31 && s.data.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r={2.4} fill={s.color}><title>{`${labels[i]} · ${s.name}: ${v}${unit}`}</title></circle>)}
          </g>
        );
      })}
      {ends.map(({ s, y }) => (
        <text key={s.name} x={W - pad.r + 8} y={y + 3.5} className="rep-endlabel" fill={s.color}>{`${s.name} ${s.data[s.data.length - 1]}${unit}`}</text>
      ))}
    </svg></div>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="rep-legend">
      {items.map((i) => (
        <span key={i.label}><i style={{ background: i.color }} />{i.label}</span>
      ))}
    </div>
  );
}

/* =====================================================================
   Metric tile (v2 report style): big number, label, period-over-period delta
   ===================================================================== */
export function RTile({ value, label, d, color, to, onClick, source }: { value: ReactNode; label: string; d?: { text: string; good: boolean; flat?: boolean }; color?: string; to?: string; onClick?: () => void; source?: string }) {
  const nav = useNavigate();
  const click = onClick ?? (to ? () => nav(to) : undefined);
  const Tag = click ? 'button' : 'div';
  return (
    <Tag className={`rep-tile ${click ? 'link' : ''}`} style={color ? { ['--tile' as string]: color } : undefined} onClick={click} title={source ? `Source: ${source}${click ? ' · click to open the records' : ''}` : undefined}>
      <b>{value}</b>
      <span>{label}</span>
      {d && <em className={d.flat ? 'flat' : d.good ? 'good' : 'bad'}>{d.text} <small>vs previous</small></em>}
    </Tag>
  );
}

export function HBar({ label, value, max, color, display }: { label: string; value: number; max: number; color: string; display: ReactNode }) {
  return (
    <div className="rep-hbar">
      <span>{label}</span>
      <div><i style={{ width: `${Math.max(1, (value / Math.max(1, max)) * 100)}%`, background: color }} /></div>
      <b>{display}</b>
    </div>
  );
}

/* =====================================================================
   Period picker
   ===================================================================== */
export function PeriodPicker({ value, onChange, compact }: { value: PeriodState; onChange: (v: PeriodState) => void; compact?: boolean }) {
  const p = useMemo(() => periodFromState(value), [value]);
  return (
    <div className={`rep-period ${compact ? 'compact' : ''}`}>
      <div className="rep-seg rep-seg-wrap" role="tablist" aria-label="Reporting period">
        {PERIOD_KINDS.map((k) => (
          <button key={k.id} role="tab" aria-selected={value.kind === k.id} className={value.kind === k.id ? 'on' : ''} onClick={() => onChange({ ...value, kind: k.id as PeriodKind })}>
            {k.label}
          </button>
        ))}
      </div>
      {value.kind === 'custom' && (
        <div className="rep-dates">
          <label>
            <span>From</span>
            <input type="date" className="input" value={value.from} max={value.to} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} />
          </label>
          <label>
            <span>To</span>
            <input type="date" className="input" value={value.to} min={value.from} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} />
          </label>
        </div>
      )}
      <div className="rep-period-foot">
        <span className="rep-period-range"><CalendarRange size={13} /> <b>{p.label}</b>{p.label !== p.range && <> · {p.range}</>} · {p.days} {p.days === 1 ? 'day' : 'days'}</span>
        <label className="rep-switch">
          <input type="checkbox" checked={value.compare} onChange={(e) => onChange({ ...value, compare: e.target.checked })} />
          <i />
          <span><ArrowLeftRight size={12} /> Compare with {p.prev.label === p.prev.range ? 'previous period' : p.prev.label}</span>
        </label>
      </div>
    </div>
  );
}

/* =====================================================================
   Section visuals
   ===================================================================== */
function SectionVisual({ id, c, tenantId, period, compare }: { id: SectionId; c: CustomerProfile; tenantId: string; period: ReportPeriod; compare: boolean }) {
  const h = headlines(c, tenantId);
  const { cur, prev } = useMemo(() => periodReport(c, tenantId, period), [c, tenantId, period]);
  const dd = (a: number, b: number, hib: boolean, mode: 'pct' | 'pts' = 'pct') => (compare ? delta(a, b, hib, mode) : undefined);
  const labels = period.buckets.map((b) => b.label);
  const per = period.bucketUnit === 'hour' ? 'hour' : period.bucketUnit;
  if (id === 'ri') {
    const ri = resilienceIndex(c, tenantId);
    return (
      <div className="rep-vis">
        <div className="rep-ri">
          <HexScore value={cur.ri} size={92} />
          <div className="rep-tiles c2">
            <RTile value={cur.ri} label="Index at period end" d={dd(cur.ri, prev.ri, true, 'pts')} to="/board" source={`HexaView RI engine · ${ri.components.length} components`} />
            <RTile value={ri.value} label="Index today" to="/board" source="HexaView RI engine" />
          </div>
        </div>
        <div className="rep-chart">
          <div className="rep-chart-title">Resilience Index by {per}</div>
          <SvgLines labels={labels} series={[{ name: 'RI', color: '#4f8cff', data: cur.s.ri }]} height={140} />
        </div>
      </div>
    );
  }
  if (id === 'capability') {
    return (
      <div className="rep-hbars">
        {CAPABILITIES.map((cap) => {
          const m = MODULE_BY_ID[cap.moduleId];
          return <HBar key={cap.id} label={m.product} value={c.scores[cap.id]} max={100} color={m.tone} display={c.scores[cap.id]} />;
        })}
      </div>
    );
  }
  if (id === 'incidents') {
    return (
      <div className="rep-vis">
        <div className="rep-tiles">
          <RTile value={fmtNum(cur.alerts)} label="Alerts triaged" d={dd(cur.alerts, prev.alerts, false)} to="/soc/mdr" source="HexaSOC alert store" />
          <RTile value={fmtNum(cur.incidents)} label="Incidents raised" d={dd(cur.incidents, prev.incidents, false)} to="/soc/ir" source="HexaSOC case store" />
          <RTile value={fmtNum(cur.truePositives)} label="True positives" d={dd(cur.truePositives, prev.truePositives, false)} to="/soc/ir?status=open" source="HexaSOC case store" />
          <RTile value={`${Math.round((cur.autoTriaged / Math.max(1, cur.alerts)) * 100)}%`} label="Closed by agents" d={dd(cur.autoTriaged / Math.max(1, cur.alerts), prev.autoTriaged / Math.max(1, prev.alerts), true)} to="/ai/agents" source="HexaSOC agent log" />
        </div>
        <div className="rep-chart">
          <div className="rep-chart-title">Alerts by severity, per {per}</div>
          <ChartLegend items={[{ label: 'Critical', color: SEV_HEX.critical }, { label: 'High', color: SEV_HEX.high }, { label: 'Medium', color: SEV_HEX.medium }, { label: 'Low', color: '#8593b4' }]} />
          <SvgColumns labels={labels} series={[{ name: 'Critical', color: SEV_HEX.critical, data: cur.s.critical }, { name: 'High', color: SEV_HEX.high, data: cur.s.high }, { name: 'Medium', color: SEV_HEX.medium, data: cur.s.medium }, { name: 'Low', color: '#8593b4', data: cur.s.low }]} />
        </div>
        <div className="rep-sublabel">Incidents by severity</div>
        <div className="rep-tiles">
          <RTile value={cur.critical} label="Critical" color={SEV_HEX.critical} d={dd(cur.critical, prev.critical, false)} to="/soc/ir?sev=critical" source="HexaSOC case store" />
          <RTile value={cur.high} label="High" color={SEV_HEX.high} d={dd(cur.high, prev.high, false)} to="/soc/ir?sev=high" source="HexaSOC case store" />
          <RTile value={cur.medium} label="Medium" color={SEV_HEX.medium} d={dd(cur.medium, prev.medium, false)} to="/soc/ir?sev=medium" source="HexaSOC case store" />
          <RTile value={`${cur.slaPct}%`} label="SLA met" color="#2dd4bf" d={dd(cur.slaPct, prev.slaPct, true, 'pts')} to="/soc/mdr" source="HexaSOC SLA ledger" />
        </div>
        <div className="rep-chart">
          <div className="rep-chart-title">Response times (minutes), per {per}</div>
          <SvgLines labels={labels} series={[{ name: 'Resolve', color: '#f2643f', data: cur.s.mttr }, { name: 'Acknowledge', color: '#a07cfb', data: cur.s.mtta }]} height={150} min={0} unit=" min" />
        </div>
      </div>
    );
  }
  if (id === 'loops') {
    const s = loopSummary(loops(c, tenantId));
    return (
      <div className="rep-vis">
        <div className="rep-tiles">
          <RTile value={`${cur.loopsAssuredPct}%`} label="Loops assured" d={dd(cur.loopsAssuredPct, prev.loopsAssuredPct, true, 'pts')} to="/loop" source="HexaView closed-loop engine" color="#2dd4bf" />
          <RTile value={s.closed} label="Closed" to="/loop?status=closed" color="#2dd4bf" source="HexaView closed-loop engine" />
          <RTile value={s.partial} label="Partial" to="/loop?status=partial" color={SEV_HEX.medium} source="HexaView closed-loop engine" />
          <RTile value={s.broken + s.stale} label="Broken or stale" to="/loop?status=broken" color={SEV_HEX.critical} source="HexaView closed-loop engine" />
        </div>
        <Stacked tall parts={[
          { value: s.closed, color: LOOP_STATUS_COLOR.closed, label: 'Closed' },
          { value: s.stale, color: LOOP_STATUS_COLOR.stale, label: 'Stale' },
          { value: s.partial, color: LOOP_STATUS_COLOR.partial, label: 'Partial' },
          { value: s.broken, color: LOOP_STATUS_COLOR.broken, label: 'Broken' },
        ]} />
      </div>
    );
  }
  if (id === 'frameworks') {
    return (
      <div className="rep-vis">
        <ChartLegend items={[{ label: 'Documented', color: '#68b1ff' }, { label: 'Assured (loop-proven)', color: '#2dd4bf' }]} />
        <div className="rep-fw">
          {c.frameworks.map((f) => (
            <div key={f.id} className="rep-fw-row">
              <span>{f.short}</span>
              <div>
                <i style={{ width: `${f.documented}%`, background: '#68b1ff' }} />
                <i style={{ width: `${f.assured}%`, background: '#2dd4bf' }} />
              </div>
              <b>{f.documented}% · {f.assured}%</b>
            </div>
          ))}
        </div>
        <div className="rep-tiles">
          <RTile value={fmtNum(cur.evidenceCollected)} label="Evidence collected" d={dd(cur.evidenceCollected, prev.evidenceCollected, true)} to="/comply/caas" source="HexaComply evidence ledger" />
          <RTile value={h.comply.overdueTasks} label="Tasks overdue (today)" to="/comply/caas?status=overdue" color={SEV_HEX.medium} source="HexaComply task ledger" />
          <RTile value={`${h.comply.controlsMetPct}%`} label="Controls met" to="/comply/caas" color="#2dd4bf" source="HexaComply" />
        </div>
      </div>
    );
  }
  if (id === 'exposure') {
    return (
      <div className="rep-vis">
        <div className="rep-tiles">
          <RTile value={cur.findingsOpened} label="Findings opened" d={dd(cur.findingsOpened, prev.findingsOpened, false)} to="/strike/pentest" source="HexaStrike" />
          <RTile value={cur.findingsClosed} label="Findings closed" d={dd(cur.findingsClosed, prev.findingsClosed, true)} to="/strike/pentest?status=closed" source="HexaStrike" color="#2dd4bf" />
          <RTile value={cur.credsExposed} label="Credentials exposed" d={dd(cur.credsExposed, prev.credsExposed, false)} to="/int/exposure" source="HexaInt stealer & breach monitoring" color={SEV_HEX.high} />
          <RTile value={cur.lookalikes} label="Lookalike domains" d={dd(cur.lookalikes, prev.lookalikes, false)} to="/int/osint" source="HexaInt" />
        </div>
        <div className="rep-chart">
          <div className="rep-chart-title">Findings opened and closed, per {per}</div>
          <ChartLegend items={[{ label: 'Opened', color: SEV_HEX.high }, { label: 'Closed', color: '#2dd4bf' }]} />
          <SvgColumns labels={labels} series={[{ name: 'Opened', color: SEV_HEX.high, data: cur.s.opened }, { name: 'Closed', color: '#2dd4bf', data: cur.s.closed }]} height={140} />
        </div>
      </div>
    );
  }
  if (id === 'ot') {
    if (h.ot.otAssets === 0) return null;
    return (
      <div className="rep-vis">
        <div className="rep-tiles">
          <RTile value={fmtNum(h.ot.otAssets)} label="OT assets" to="/ot/visibility" source="HexaOT · OT sensors" />
          <RTile value={h.ot.sites} label="Sites" to="/ot/visibility" source="HexaOT" />
          <RTile value={fmtNum(cur.otAlerts)} label="OT alerts" d={dd(cur.otAlerts, prev.otAlerts, false)} to="/ot/visibility?tab=alerts" source="HexaOT" color={SEV_HEX.medium} />
          <RTile value={`${h.ot.purdueCoveragePct}%`} label="Purdue coverage" to="/ot/visibility" source="HexaOT" color="#2dd4bf" />
        </div>
        <div className="rep-chart">
          <div className="rep-chart-title">OT alerts per {per}</div>
          <SvgColumns labels={labels} series={[{ name: 'OT alerts', color: '#f5a83d', data: cur.s.otAlerts }]} height={120} />
        </div>
      </div>
    );
  }
  if (id === 'custody') {
    return (
      <div className="rep-vis">
        <div className="rep-tiles">
          <RTile value={fmtNum(cur.transfers)} label="Custody transfers" d={dd(cur.transfers, prev.transfers, true)} to="/custody/overview" source="HexaCustody ledger" />
          <RTile value={h.custody.vendorsInChain} label="Vendors in chain" to="/custody/vendors" source="HexaCustody" />
          <RTile value={cur.revocations} label="Revocations" d={dd(cur.revocations, prev.revocations, false)} to="/custody/revocation" source="HexaCustody ledger" color={SEV_HEX.medium} />
          <RTile value={cur.custodyAnomalies} label="Anomalies" d={dd(cur.custodyAnomalies, prev.custodyAnomalies, false)} to="/custody/overview" source="HexaCustody" color={SEV_HEX.critical} />
        </div>
        <div className="rep-chart">
          <div className="rep-chart-title">Transfers per {per}</div>
          <SvgColumns labels={labels} series={[{ name: 'Transfers', color: '#4f8cff', data: cur.s.transfers }]} height={120} />
        </div>
      </div>
    );
  }
  if (id === 'ai') {
    return (
      <div className="rep-vis">
        <div className="rep-tiles">
          <RTile value={h.ai.aiSystems} label="Governed AI systems" to="/ai/discovery" source="HexaAI discovery · AI register" />
          <RTile value={cur.shadowAiNew} label="New shadow AI apps" to="/ai/discovery?status=shadow" color={SEV_HEX.critical} source="HexaAI discovery" />
          <RTile value={fmtNum(cur.promptDlp)} label="Prompts blocked / coached" d={dd(cur.promptDlp, prev.promptDlp, false)} to="/ai/discovery" color={SEV_HEX.medium} source="Inline DLP on AI prompts" />
          <RTile value={fmtNum(cur.agentActions)} label="Agent actions" d={dd(cur.agentActions, prev.agentActions, true)} to="/ai/agents" source="HexaSOC agent log" />
        </div>
        <div className="rep-chart">
          <div className="rep-chart-title">Agent actions per {per}</div>
          <SvgColumns labels={labels} series={[{ name: 'Agent actions', color: '#a07cfb', data: cur.s.agentActions }]} height={120} />
        </div>
      </div>
    );
  }
  if (id === 'insurance') {
    return (
      <div className="rep-ri">
        <Ring value={h.insurance.insurability} size={80} stroke={8} color="#2dd4bf" />
        <div className="rep-tiles" style={{ flex: 1 }}>
          <RTile value={`${h.insurance.premiumDeltaPct > 0 ? '+' : ''}${h.insurance.premiumDeltaPct}%`} label="Premium impact" to="/insurance" source="Cyber Insurance module" />
          <RTile value={`${h.insurance.attestedControls}/${h.insurance.totalControls}`} label="Controls attested" to="/insurance" source="Cyber Insurance module" />
          <RTile value={`${h.insurance.tailLossM}M`} label={`1-in-100 loss (${c.currency})`} to="/insurance" source="Risk quantification model" />
        </div>
      </div>
    );
  }
  if (id === 'risks') {
    const top = attention(c, tenantId).slice(0, 5);
    return (
      <table className="rep-table">
        <thead><tr><th>Risk</th><th>Module</th><th>Severity</th></tr></thead>
        <tbody>
          {top.map((a, i) => (
            <tr key={i}><td>{a.title}</td><td>{a.module.toUpperCase()}</td><td style={{ color: SEV_HEX[a.sev as keyof typeof SEV_HEX] ?? undefined, fontWeight: 700, textTransform: 'capitalize' }}>{a.sev}</td></tr>
          ))}
        </tbody>
      </table>
    );
  }
  return null;
}

/** Rendered report: cover, executive summary, numbered sections with visuals and cited statements, citation appendix. */
export function ReportPaper({
  c, tenantId, title, subtitle, audience, sections, format = 'PDF', appendix = true, draft = true, approver, period, compare = true,
}: {
  c: CustomerProfile; tenantId: string; title: string; subtitle?: string; audience: Audience; sections: SectionId[];
  format?: Format; appendix?: boolean; draft?: boolean; approver?: string; period: ReportPeriod; compare?: boolean;
}) {
  const doc = useMemo(() => buildDoc(c, tenantId, sections, period, compare), [c, tenantId, sections, period, compare]);
  return (
    <div className={`rep-paper ${format === 'PPTX' ? 'rep-slides' : ''}`}>
      {draft && <div className="rep-watermark">DRAFT</div>}
      <div className="rep-cover">
        <div className="rep-cover-top">
          <CustomerLogo c={c} size={40} className="rep-logo" />
          <div>
            <small>HexaView Reporting · {PERIOD_KINDS.find((k) => k.id === period.kind)?.adj} report</small>
            <b>{c.name}</b>
          </div>
          <span className="rep-class">Confidential · {audience}</span>
        </div>
        <h2>{title}</h2>
        <div className="rep-cover-meta">
          <span className="rep-period-chip">{period.label}</span>
          {period.label !== period.range && period.kind !== 'daily' && <span>{period.range}</span>}
          <span>Generated {fmtDate(NOW)}</span>
          <span>Prepared for the {audience.toLowerCase()} · {tenantName(c, tenantId)}</span>
          {compare && <span>Compared with {period.prev.label}</span>}
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {doc.sections.length > 0 && (
        <section className="rep-sec">
          <h4><em>00</em>Executive summary</h4>
          {doc.summary.map((s, i) => <p key={i} className="rep-p">{s}</p>)}
        </section>
      )}
      {doc.sections.map((s, i) => (
        <section key={s.id} className="rep-sec">
          <h4><em>{String(i + 1).padStart(2, '0')}</em>{s.title}</h4>
          <p className="rep-lead">{s.lead}</p>
          <SectionVisual id={s.id} c={c} tenantId={tenantId} period={period} compare={compare} />
          <ul>
            {s.statements.map((st, j) => (
              <li key={j}>
                {st.text}
                {st.refs.map((n) => <sup key={n}>[{n}]</sup>)}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {doc.sections.length === 0 && <p className="rep-empty">Choose sections to start the report.</p>}
      {appendix && doc.citations.length > 0 && (
        <section className="rep-sec rep-appendix">
          <h4><em>A</em>Citation appendix</h4>
          <table className="rep-table">
            <thead>
              <tr><th>#</th><th>Record</th><th>Source</th><th>Version</th><th>Retrieved</th></tr>
            </thead>
            <tbody>
              {doc.citations.map((x) => (
                <tr key={x.n}>
                  <td>[{x.n}]</td>
                  <td className="mono">{x.id}</td>
                  <td>{x.source}</td>
                  <td>{x.version}</td>
                  <td>{x.retrievedMin} min before generation</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <div className="rep-foot">
        <span>{c.short} · {title} · {period.label}</span>
        <span>{approver ? `Approver: ${approver}` : 'Unsigned draft'} · every statement cited to a versioned HexaCore record · signed SHA-256 on release</span>
      </div>
    </div>
  );
}

/** Progress-stepped generation modal. Optionally asks for the reporting period first. Calls onDone when finished. */
export function GenerateModal({ title, steps, onClose, onDone, period, onPeriod, tone = REP_TONE }: { title: string; steps: string[]; onClose: () => void; onDone: () => void; period?: PeriodState; onPeriod?: (p: PeriodState) => void; tone?: string }) {
  const [started, setStarted] = useState(!period);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!started) return;
    if (i >= steps.length) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((x) => x + 1), 650);
    return () => clearTimeout(t);
  }, [i, steps.length, onDone, started]);
  if (!started && period && onPeriod) {
    const p = periodFromState(period);
    return (
      <Modal
        title={`Generate · ${title}`}
        sub="Choose the period this run covers; numbers, charts and deltas are recomputed for it"
        onClose={onClose}
        footer={<><Btn onClick={onClose}>Cancel</Btn><Btn primary color={tone} onClick={() => setStarted(true)}><Play /> Generate for {p.label}</Btn></>}
      >
        <div style={{ ['--m-reports' as string]: tone }}><PeriodPicker value={period} onChange={onPeriod} /></div>
        <Callout>The draft covers <b>{p.range}</b>{period.compare ? <> and compares every number with <b>{p.prev.range}</b></> : null}. Nothing is released until a named approver signs.</Callout>
      </Modal>
    );
  }
  return (
    <Modal title={`Generating · ${title}`} sub="Drafted from live data; nothing is released until a named approver signs" onClose={onClose} footer={<Btn onClick={onClose}>Run in background</Btn>}>
      <div className="rep-steps" style={{ ['--m-reports' as string]: tone }}>
        {steps.map((s, k) => (
          <div key={s} className={`rep-step ${k < i ? 'done' : k === i ? 'run' : ''}`}>
            <span className="rep-step-ico">{k < i ? <Check size={13} /> : k === i ? <Loader2 size={13} className="rep-spin" /> : k + 1}</span>
            <span>{s}</span>
          </div>
        ))}
      </div>
      <Bar value={Math.min(i, steps.length)} max={steps.length} color={tone} />
    </Modal>
  );
}

/** Named-approver sign-off before release. */
export function SignOffModal({
  title, approvers, defaultApprover, format, onClose, onSubmit, extra, tone = REP_TONE, heading = 'Send for approval', cta = 'Send to',
}: {
  title: string; approvers: string[]; defaultApprover?: string; format: Format; onClose: () => void; onSubmit: (approver: string, note: string) => void; extra?: ReactNode;
  /** Accent colour (defaults to the Reporting tone). */
  tone?: string;
  /** Modal heading and button verb, e.g. "Request sign-off" / "Request from". */
  heading?: string;
  cta?: string;
}) {
  const [who, setWho] = useState(defaultApprover ?? approvers[0]);
  const [note, setNote] = useState('');
  return (
    <Modal
      title={heading}
      sub={title}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn primary color={tone} onClick={() => onSubmit(who, note)}><PenLine /> {cta} {who.split(' ').filter((x) => !x.endsWith('.'))[0]}</Btn>
        </>
      }
    >
      <KV
        rows={[
          ['Approver', (
            <select className="select" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Approver">
              {approvers.map((a) => <option key={a}>{a}</option>)}
            </select>
          )],
          ['Format', format],
          ['On approval', 'Rendered, signed (SHA-256, anchored to the audit ledger) and released to recipients'],
        ]}
      />
      {extra}
      <label className="stack" style={{ gap: 4 }}>
        <span className="section-label" style={{ margin: 0 }}>Note to approver</span>
        <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional context for the approver" />
      </label>
      <Callout>The approver sees every statement with its citation and can reject single statements. No report leaves HexaView unsigned.</Callout>
    </Modal>
  );
}
