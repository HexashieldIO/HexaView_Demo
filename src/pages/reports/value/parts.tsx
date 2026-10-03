import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Printer } from 'lucide-react';
import type { CustomerProfile } from '../../../data/types';
import { Btn } from '../../../components/ui';
import { fmtDate, fmtMoney, fmtNum, fmtCompact, NOW } from '../../../lib/format';
import { tenantName } from '../../../data/customers';
import { VALUE_CAPS, VCAP_BY_ID, ASSUMPTION_META, type ValueModel, type ValueAssumptions } from '../../../data/modules/value';
import './value.css';

function useWidth(fallback = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
const niceStep = (v: number) => {
  const p = 10 ** Math.floor(Math.log10(Math.max(1, v)));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
};

/** Quarterly value (stacked by capability) against cost (dashed line). Crisp SVG text, labels never sit on marks. */
export function ValueVsCost({ m, currency, onPick, height = 250 }: { m: ValueModel; currency: string; onPick?: (q: number) => void; height?: number }) {
  const [ref, W] = useWidth();
  const pad = { l: 52, r: 12, t: 12, b: 40 };
  const raw = Math.max(...m.quarters.map((q) => Math.max(q.value, q.cost)), 1);
  const step = niceStep(raw / 4);
  const max = step * Math.ceil(raw / step);
  const iw = W - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const bw = iw / m.quarters.length;
  const colW = Math.min(54, bw * 0.56);
  const Y = (v: number) => pad.t + ih * (1 - v / max);
  const X = (i: number) => pad.l + i * bw + bw / 2;
  const shares = m.byCap.map((b) => ({ cap: b.cap, share: m.total ? b.value / m.total : 0 }));
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const costPath = m.quarters.map((q, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(q.cost).toFixed(1)}`).join(' ');
  return (
    <div ref={ref} className="vx-svg-wrap">
      <svg className="vx-svg" width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Value delivered versus cost by quarter">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(t)} y2={Y(t)} className="gl" />
            <text x={pad.l - 8} y={Y(t) + 3.5} textAnchor="end" className="ax">{fmtMoney(t, currency)}</text>
          </g>
        ))}
        {m.quarters.map((q, i) => {
          let acc = 0;
          return (
            <g key={q.label} className="col" onClick={onPick ? () => onPick(i) : undefined}>
              <title>{`${q.label}\nValue ${fmtMoney(q.value, currency)}\nCost ${fmtMoney(q.cost, currency)}\n${(q.value / Math.max(1, q.cost)).toFixed(1)}× return`}</title>
              <rect x={X(i) - bw / 2} y={pad.t} width={bw} height={ih} fill="transparent" />
              {shares.map((s, si) => {
                const v = q.value * s.share;
                const h = (v / max) * ih;
                const y = pad.t + ih - acc - h;
                acc += h;
                return v > 0 ? <rect key={s.cap} x={X(i) - colW / 2} y={y} width={colW} height={Math.max(0.5, h)} fill={VCAP_BY_ID[s.cap].hex} rx={si === shares.length - 1 ? 3 : 0} /> : null;
              })}
              <text x={X(i)} y={height - 22} textAnchor="middle" className="ax">{q.label}</text>
              <text x={X(i)} y={height - 7} textAnchor="middle" className="lbl">{fmtMoney(q.value, currency)}</text>
            </g>
          );
        })}
        <path d={costPath} fill="none" stroke="#f8646f" strokeWidth={2} strokeDasharray="5 4" />
        {m.quarters.map((q, i) => <circle key={q.label} cx={X(i)} cy={Y(q.cost)} r={3.2} fill="#f8646f" stroke="var(--card-bg)" strokeWidth={1.5} />)}
      </svg>
    </div>
  );
}

export function ValueLegend() {
  return (
    <div className="vx-legend">
      {VALUE_CAPS.map((v) => <span key={v.id}><i style={{ background: v.hex }} />{v.label}</span>)}
      <span style={{ color: '#f8646f' }}><i className="line" />Cost</span>
    </div>
  );
}

/** Printable board / renewal summary. */
export function ValuePaper({ c, tenantId, m, a, onBack }: { c: CustomerProfile; tenantId: string; m: ValueModel; a: ValueAssumptions; onBack: () => void }) {
  const nav = useNavigate();
  const $ = (n: number) => fmtMoney(n, c.currency);
  const def = ASSUMPTION_META;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row vx-noprint" style={{ gap: 8 }}>
        <Btn onClick={onBack}><ArrowLeft size={14} /> Back to Value & Outcomes</Btn>
        <span className="spacer" />
        <Btn onClick={() => nav('/reports/builder?template=value')}><ExternalLink size={14} /> Open in Report Builder</Btn>
        <Btn primary color="var(--m-reports)" onClick={() => window.print()}><Printer size={14} /> Print / save PDF</Btn>
      </div>
      <article className="vx-paper">
        <div className="kick">{c.name} · Value & outcomes summary · for the board and renewal</div>
        <h1>What HexaView and HexaShield delivered</h1>
        <div className="meta">
          <span>Last 12 months to {fmtDate(NOW)}</span>
          <span>{tenantName(c, tenantId)}</span>
          <span>Currency {c.currency}</span>
          <span>Prepared for {c.people.board.name} and the board</span>
        </div>
        <div className="tiles">
          <div><b>{m.roi.toFixed(1)}×</b><span>return on spend</span></div>
          <div><b>{$(m.total)}</b><span>value delivered</span></div>
          <div><b>{$(m.cost)}</b><span>HexaView and services cost</span></div>
          <div><b>{m.paybackMonths} mo</b><span>payback</span></div>
          <div><b>{fmtNum(m.incidentsContained)}</b><span>incidents contained</span></div>
          <div><b>{m.mttr} min</b><span>mean time to contain (was {m.mttrBefore})</span></div>
          <div><b>{fmtCompact(m.hoursSaved)}</b><span>analyst hours saved</span></div>
          <div><b>{$(m.lossAvoided)}</b><span>expected loss avoided</span></div>
        </div>

        <h2>1 · Summary</h2>
        <p>
          Over the last twelve months {c.short} received <b>{$(m.total)}</b> of quantified value for <b>{$(m.cost)}</b> of HexaView licence and HexaShield services: <b>{m.roi.toFixed(1)}× return</b> and <b>{$(m.net)}</b> net. HexaSOC contained {fmtNum(m.incidentsContained)} incidents with mean time to contain down from {m.mttrBefore} to {m.mttr} minutes, automation released {fmtNum(Math.round(m.hoursSaved))} analyst hours, and modelled annual expected loss fell from {$(m.elBefore)} to {$(m.elNow)}.
          The insurance premium moved {m.premiumDeltaPct > 0 ? '+' : ''}{m.premiumDeltaPct}% against a market of {a.marketPremiumPct > 0 ? '+' : ''}{a.marketPremiumPct}% ({$(m.premiumSaving)} below market), and the tool scorecard identified {$(m.toolSaving)} a year of overlapping tool spend.
        </p>

        <h2>2 · Value and cost by capability</h2>
        <table>
          <thead><tr><th>Capability</th><th className="r">Value</th><th className="r">Cost</th><th className="r">Return</th><th>Largest driver</th></tr></thead>
          <tbody>
            {m.byCap.map((b) => {
              const top = [...b.lines].sort((x, y) => y.value - x.value)[0];
              return <tr key={b.cap}><td>{VCAP_BY_ID[b.cap].label}</td><td className="r">{$(b.value)}</td><td className="r">{$(b.cost)}</td><td className="r">{b.cost ? `${(b.value / b.cost).toFixed(1)}×` : '—'}</td><td>{top?.label}</td></tr>;
            })}
            <tr><td><b>Total</b></td><td className="r"><b>{$(m.total)}</b></td><td className="r"><b>{$(m.cost)}</b></td><td className="r"><b>{m.roi.toFixed(1)}×</b></td><td /></tr>
          </tbody>
        </table>

        <h2>3 · Before and after</h2>
        <table>
          <thead><tr><th>Measure</th><th className="r">Before HexaView</th><th className="r">Now</th><th>Source</th></tr></thead>
          <tbody>
            {m.beforeAfter.map((b) => <tr key={b.key}><td>{b.label}</td><td className="r">{b.before} {b.unit}</td><td className="r"><b>{b.after} {b.unit}</b></td><td>{b.source}</td></tr>)}
          </tbody>
        </table>

        <h2>4 · Outcome stories</h2>
        <table>
          <thead><tr><th>Outcome</th><th>Result</th><th className="r">Value</th></tr></thead>
          <tbody>
            {m.stories.map((s) => <tr key={s.id}><td><b>{s.title}</b><br />{s.body}</td><td>{s.metric}</td><td className="r">{$(s.value)}</td></tr>)}
          </tbody>
        </table>

        <h2>5 · Assumptions</h2>
        <table>
          <tbody>
            {def.map((d) => <tr key={d.key}><td>{d.label}</td><td className="r">{d.money ? fmtMoney(a[d.key], c.currency, false) : a[d.key]} {d.unit}</td><td>{d.hint}</td></tr>)}
          </tbody>
        </table>

        <div className="sig">
          <div>Prepared by<br />{c.people.ciso.name}</div>
          <div>Finance review<br />{c.people.staff.find((s) => /CFO|Financial/i.test(s.role))?.name ?? 'CFO'}</div>
          <div>HexaShield account lead<br />Callum Reid</div>
        </div>
        <div className="foot">
          <span>{c.short} · value summary · generated {fmtDate(NOW)} by HexaView Reporting</span>
          <span>Every figure cites its formula and source in HexaView · Value & Outcomes</span>
        </div>
      </article>
    </div>
  );
}
