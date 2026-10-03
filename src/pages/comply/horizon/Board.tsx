import { useMemo, useState } from 'react';
import { Printer, Copy } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { Card, Badge, Bar, Btn, Legend } from '../../../components/ui';
import { costByQuarter, horizonTotals, JUR_HEX, JURISDICTIONS, type Reg } from '../../../data/modules/horizon';
import { tenantName } from '../../../data/customers';
import { NOW, fmtDate, fmtMoney, fmtNum, scoreTone } from '../../../lib/format';
import { useHorizon, useHzNav, whenLabel, HZ_TONE } from './state';
import { RegDrawer } from './RegDrawer';

export default function Board() {
  const { customer: c, tenantId, toast } = useApp();
  const { regs } = useHorizon();
  const { go } = useHzNav();
  const [sel, setSel] = useState<Reg | null>(null);
  const t = horizonTotals(regs);
  const in12 = regs.filter((r) => r.months <= 12);
  const top = in12.slice().sort((a, b) => b.cost - a.cost).slice(0, 5);
  const qs = useMemo(() => costByQuarter(regs), [regs]);
  const qTot = qs.map((q) => Object.values(q.byJur).reduce((s, v) => s + v, 0));
  const qMax = Math.max(1, ...qTot);
  const effort12 = in12.reduce((s, r) => s + r.effortDays, 0);
  const gaps12 = in12.reduce((s, r) => s + r.gaps, 0);
  const behind = in12.filter((r) => r.readiness < 60);
  const usedJur = JURISDICTIONS.filter((j) => in12.some((r) => r.jur === j));
  const cost = (n: number) => fmtMoney(n, c.currency);

  const summary = `In the next 12 months ${in12.length} regulatory obligations apply to or change for ${c.name}. Closing the ${gaps12} open gaps is estimated at ${cost(t.cost12)} and ${fmtNum(effort12)} person-days. Weighted readiness is ${t.readiness}%. ${behind.length ? `${behind.length} are below 60% readiness: ${behind.map((r) => r.short).join(', ')}.` : 'All are at least 60% ready.'}`;

  return (
    <>
      <div className="hz-print-head">
        <h2 style={{ margin: 0 }}>{c.name} · Regulatory horizon board briefing</h2>
        <div className="muted">{tenantName(c, tenantId)} · {fmtDate(NOW)} · prepared by {c.people.grcLead.name} for {c.people.board.name}</div>
      </div>

      <div className="row between wrap no-print" style={{ gap: 10 }}>
        <p className="page-intro" style={{ flex: 1, minWidth: 260, margin: 0 }}>
          One page for {c.people.board.name} ({c.people.board.role}): what is coming in the next 12 months, what it will cost and what we need the board to decide.
        </p>
        <Btn onClick={() => { navigator.clipboard?.writeText(summary).catch(() => undefined); toast('Board summary copied to the clipboard'); }}><Copy /> Copy summary</Btn>
        <Btn primary color={HZ_TONE} onClick={() => window.print()}><Printer /> Print briefing</Btn>
      </div>

      <Card title="What's coming in the next 12 months, and what it will cost" sub={`Prepared ${fmtDate(NOW)} · costs in ${c.currency} at blended internal and partner rates`} toneColor={HZ_TONE}>
        <div className="hz-brief">
          <div className="hz-brief-hero">
            <div><small>Summary</small><p>{summary}</p></div>
            <button type="button" onClick={() => go('timeline', { window: '12' })} title="Source: HexaShield regulatory intelligence · click for the timeline"><small>Obligations · 12 months</small><b>{in12.length}</b><span className="muted" style={{ display: 'block', fontSize: 11.5 }}>{t.applying} already applying</span></button>
            <button type="button" onClick={() => go('impact', { sort: 'gaps' })} title="Source: HexaComply control mapping · click for impact"><small>Estimated cost</small><b>{cost(t.cost12)}</b><span className="muted" style={{ display: 'block', fontSize: 11.5 }}>{fmtNum(effort12)} person-days · {gaps12} gaps</span></button>
            <button type="button" onClick={() => go('impact', { sort: 'readiness' })} title="Source: HexaComply control status · click for impact"><small>Readiness</small><b style={{ color: scoreTone(t.readiness) }}>{t.readiness}%</b><Bar value={t.readiness} color={scoreTone(t.readiness)} size="thin" /></button>
          </div>

          <div className="grid g-3-2" style={{ gap: 14 }}>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>The five biggest items</h4>
              <div className="hz-bucket">
                {top.map((r) => (
                  <button key={r.id} type="button" className="hz-row" onClick={() => setSel(r)} style={{ gridTemplateColumns: '70px minmax(0,1fr) 110px 80px' }}>
                    <span className="hz-when">{whenLabel(r.months)}<small className="muted" style={{ display: 'block' }}>{r.certainty}</small></span>
                    <span style={{ minWidth: 0 }}><b>{r.short}</b><small>{r.owner.name} · {r.themes.slice(0, 2).join(', ')}</small></span>
                    <span><Bar value={r.readiness} color={scoreTone(r.readiness)} size="thin" /><small className="muted" style={{ fontSize: 10.5 }}>{r.readiness}% ready</small></span>
                    <b className="num" style={{ textAlign: 'right' }}>{cost(r.cost)}</b>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Spend profile by quarter</h4>
              <div className="hz-qbars">
                {qs.map((q, i) => (
                  <div key={q.label} className="hz-qbar" title={usedJur.map((j) => `${j}: ${cost(q.byJur[j])}`).join('\n')}>
                    <b>{cost(qTot[i])}</b>
                    <div className="stk" style={{ height: `${(qTot[i] / qMax) * 100}px` }}>
                      {usedJur.map((j) => <i key={j} style={{ height: `${qTot[i] ? (q.byJur[j] / qTot[i]) * 100 : 0}%`, background: JUR_HEX[j] }} />)}
                    </div>
                    <span>{q.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8 }}><Legend items={usedJur.map((j) => ({ label: j, color: JUR_HEX[j] }))} /></div>
            </div>
          </div>

          <div className="grid g2" style={{ gap: 14 }}>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Decisions requested</h4>
              <ol>
                <li><b>Approve {cost(t.cost12)}</b> for regulatory readiness over the next four quarters, phased as shown.</li>
                {top[0] && <li><b>Confirm {top[0].owner.name}</b> as accountable owner for {top[0].short}, the largest single item.</li>}
                {behind[0] && <li><b>Prioritise {behind.slice(0, 2).map((r) => r.short).join(' and ')}</b>, which are below 60% readiness.</li>}
                <li><b>Note</b> that dates marked expected may move; HexaComply re-plans automatically when they do.</li>
              </ol>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>If we do nothing</h4>
              <ol>
                {in12.filter((r) => r.months < 0).slice(0, 2).map((r) => <li key={r.id}><b>{r.short}</b> already applies; {r.gaps} open gaps are findings in waiting for supervisors and auditors.</li>)}
                <li><b>Management accountability:</b> several regimes now place personal duties on directors to approve and oversee cyber risk measures.</li>
                <li><b>Customers and insurers</b> increasingly ask for the same evidence; gaps feed directly into questionnaires and premium.</li>
              </ol>
            </div>
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            {in12.map((r) => <Badge key={r.id} color={JUR_HEX[r.jur]}>{r.short} · {r.dateLabel}</Badge>)}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 11 }}>Dates are indicative and hedged as expected where not fixed in law. Source: HexaShield regulatory intelligence mapped to {c.name} controls in HexaComply; cost model {c.currency}, blended rates.</p>
        </div>
      </Card>
      {sel && <RegDrawer reg={regs.find((r) => r.id === sel.id) ?? sel} onClose={() => setSel(null)} />}
    </>
  );
}
