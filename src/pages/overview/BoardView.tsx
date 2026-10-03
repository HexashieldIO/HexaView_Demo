import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, Sparkles, ArrowRight, ShieldCheck, FileText } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { headlines, resilienceIndex, riTrend, riDrivers, RI_VERSION, loops, loopSummary } from '../../data/core';
import { tenantName } from '../../data/customers';
import { boardRisks, quarterCompare, boardSummary, frameworkStatus, loopTransitions, type Citation } from '../../data/modules/comply';
import { Card, HexScore, Badge, Bar, Btn, KV, Callout, SectionLabel, SevBadge, Legend } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { Drawer } from '../../components/Overlay';
import { fmtMoney, fmtNum, monthLabels, scoreTone, NOW, fmtDate } from '../../lib/format';
import './board.css';

const QOQ_PATH: Record<string, string> = {
  'Resilience Index': '/',
  'Assured coverage (loops closed)': '/loop?status=closed',
  'Controls met': '/comply/caas?view=controls&status=Compliant',
  'Median time to contain': '/soc/ir',
  'Critical and high incidents open': '/soc/ir',
  'Critical pen-test findings open': '/strike/pentest',
  'Compliance tasks overdue': '/comply/caas?view=tasks&overdue=1',
  'High-risk suppliers': '/comply/tprm?risk=high',
  'ATT&CK coverage of priority techniques': '/soc/attack',
};

const SEV_BG ={ critical: 'var(--sev-critical)', high: 'var(--sev-high)', medium: 'var(--sev-medium)', low: 'var(--sev-low)', info: 'var(--sev-info)' };

function CiteChip({ c, onOpen, n }: { c: Citation; onOpen: (c: Citation) => void; n?: number }) {
  return (
    <button type="button" className="board-cite" onClick={() => onOpen(c)} title={`${c.kind}: ${c.label} (${c.source})`}>
      {n !== undefined ? `[${n}] ` : ''}{c.label}
    </button>
  );
}

export default function BoardView() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const nav = useNavigate();
  const days = rangeDays(timeRange);
  const h = headlines(c, tenantId);
  const ri = resilienceIndex(c, tenantId);
  const trend = riTrend(c, tenantId);
  const drivers = riDrivers(c);
  const risks = useMemo(() => boardRisks(c, tenantId), [c, tenantId]);
  const qoq = useMemo(() => quarterCompare(c, tenantId), [c, tenantId]);
  const summary = useMemo(() => boardSummary(c, tenantId), [c, tenantId]);
  const fws = useMemo(() => frameworkStatus(c, tenantId), [c, tenantId]);
  const lsum = loopSummary(loops(c, tenantId));
  const transitions = useMemo(() => loopTransitions(c, tenantId, days), [c, tenantId, days]);
  const [cite, setCite] = useState<Citation | null>(null);
  const [draft, setDraft] = useState<'hidden' | 'drafting' | 'ready'>('hidden');
  const scope = tenantName(c, tenantId);
  const qDelta = trend[11] - trend[8];
  const yDelta = trend[11] - trend[0];
  const closedInPeriod = transitions.filter((t) => t.to === 'closed').length;
  const tailPct = Math.round((h.insurance.tailLossM / c.insurance.limitM) * 100);

  const runDraft = () => {
    setDraft('drafting');
    setTimeout(() => setDraft('ready'), 1100);
  };

  return (
    <>
      <div className="board-print-head">
        <h2>{c.name} · Board cyber resilience report</h2>
        <div className="muted">{scope} · {fmtDate(NOW)} · Resilience Index {RI_VERSION}</div>
      </div>

      <div className="row between wrap board-toolbar" style={{ gap: 10 }}>
        <p className="page-intro" style={{ flex: 1, minWidth: 260 }}>
          <b>{c.name}</b> · {scope}. A one-page view for {c.people.board.name} ({c.people.board.role}) and the board: where we stand, why, and what would improve it most.
        </p>
        <Btn onClick={runDraft} color="var(--m-view)" primary><Sparkles /> Draft board summary</Btn>
        <Btn onClick={() => window.print()}><Printer /> Print</Btn>
      </div>

      <Card>
        <div className="board-hero">
          <HexScore value={ri.value} size={170} />
          <div>
            <h2>Resilience Index {ri.value}</h2>
            <div className="board-delta"><b>{qDelta >= 0 ? '+' : ''}{qDelta}</b> this quarter · <b>{yDelta >= 0 ? '+' : ''}{yDelta}</b> over 12 months</div>
            <p>
              One number for {tenantId === 'all' ? `${c.tenants.length} business units, weighted by how critical each is` : scope}. It rises when controls are proven to work against real attacks and falls when evidence ages, detections break or exposure grows.
            </p>
            <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
              <button type="button" className="board-pill" style={{ '--tone': 'var(--m-view)' } as CSSProperties} onClick={() => nav('/loop?status=closed')} title="Source: HexaView closed-loop engine · open the closed loops">{lsum.assuredPct}% assured</button>
              <button type="button" className="board-pill" style={{ '--tone': 'var(--m-comply)' } as CSSProperties} onClick={() => nav('/comply/overview')} title="Source: HexaComply · open the compliance overview">{h.comply.controlsMetPct}% controls met</button>
              <button type="button" className="board-pill" onClick={() => nav('/loop')} title="Source: HexaView loop transitions (audited)">{closedInPeriod} loops closed · {rangeLabel(timeRange).toLowerCase()}</button>
            </div>
          </div>
          <div>
            <Chart
              height={170}
              option={{
                grid: { left: 4, right: 12, top: 14, bottom: 4, containLabel: true },
                tooltip: { trigger: 'axis' },
                xAxis: { type: 'category', data: monthLabels(12) },
                yAxis: { type: 'value', min: Math.max(0, Math.min(...trend) - 6), max: 100 },
                series: [{
                  type: 'line', data: trend, symbolSize: 6, lineStyle: { color: '#20b292', width: 3 }, itemStyle: { color: '#20b292' },
                  areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(32,178,146,.3)' }, { offset: 1, color: 'rgba(32,178,146,0)' }] } },
                  markPoint: { symbol: 'circle', symbolSize: 12, label: { show: false }, data: [{ name: 'Now', coord: [11, trend[11]], value: trend[11] }], itemStyle: { color: '#20b292', borderColor: '#fff', borderWidth: 2 } },
                }],
              }}
            />
            <div className="muted" style={{ fontSize: 11, textAlign: 'right' }}>Monthly, last 12 months</div>
          </div>
        </div>
      </Card>

      <div className="grid g-3-2">
        <Card title="How it is made" sub={`Weighted components · version ${RI_VERSION} · weights are published and change only with a new version`}>
          <table className="board-tbl">
            <thead>
              <tr><th>Component</th><th>What it measures</th><th className="r">Weight</th><th className="r">Score</th><th className="r">Contribution</th></tr>
            </thead>
            <tbody>
              {ri.components.map((x) => (
                <tr key={x.key}>
                  <td><b>{x.label}</b></td>
                  <td className="muted" style={{ fontSize: 11.5 }}>{x.measure}</td>
                  <td className="r num">{Math.round(x.weight * 100)}%</td>
                  <td className="r num" style={{ color: scoreTone(x.score), fontWeight: 700 }}>{x.score}</td>
                  <td className="r" style={{ minWidth: 110 }}>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <div style={{ width: 54 }}><Bar value={x.contribution} max={30} color="var(--m-view)" size="thin" /></div>
                      <b className="num">{x.contribution.toFixed(1)}</b>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={2}>Resilience Index (rounded sum)</td><td className="r">100%</td><td /><td className="r num">{ri.value}</td></tr>
            </tfoot>
          </table>
        </Card>

        <Card title="What would raise it most" sub="Ranked by modelled gain to the Index">
          {drivers.map((d, i) => (
            <button key={i} className="board-driver" onClick={() => nav(d.path)}>
              <span className="board-gain">+{d.gain.toFixed(1)}</span>
              <span>{d.text}<small>{d.module}</small></span>
              <ArrowRight size={14} className="muted" />
            </button>
          ))}
          <div className="card-foot">Doing the top three adds about +{(drivers[0].gain + drivers[1].gain + drivers[2].gain).toFixed(1)} points.</div>
        </Card>
      </div>

      <div className="grid g-1-2">
        <Card title="Documented vs assured coverage" sub="Per framework">
          <p className="secondary" style={{ fontSize: 12, marginBottom: 6 }}>
            <b>Documented</b> means a control exists with up-to-date evidence; <b>assured</b> means we have also proven, by simulated attack, that it detects what it should.
          </p>
          <div className="board-cov">
            {fws.map((f) => (
              <div key={f.fw.id} className="board-cov-row">
                <button type="button" className="board-cov-name" onClick={() => nav(`/comply/caas?framework=${f.fw.id}`)} title={`${f.fw.name} · open its controls in HexaComply`}>{f.fw.short}</button>
                <div className="board-cov-bars">
                  <button type="button" onClick={() => nav(`/comply/caas?framework=${f.fw.id}&view=controls&status=Compliant`)} title={`Documented ${f.documented}% · source HexaComply`}><i style={{ width: `${f.documented}%`, background: '#6db33f' }} /></button>
                  <button type="button" onClick={() => nav(`/loop?framework=${f.fw.id}`)} title={`Assured ${f.assured}% · source HexaView closed loops`}><i style={{ width: `${f.assured}%`, background: '#20b292' }} /></button>
                </div>
                <span className="board-cov-val"><b>{f.documented}%</b><span>{f.assured}%</span></span>
              </div>
            ))}
          </div>
          <Legend items={[{ label: 'Documented (HexaComply)', color: '#6db33f' }, { label: 'Assured (closed loops)', color: '#20b292' }]} />
        </Card>

        <Card title="Top five risks" sub="In plain English · every statement cites the record behind it" actions={<span className="board-cite-hint muted">Click a citation to see the record</span>}>
          {risks.map((r, i) => (
            <div key={i} className="board-risk">
              <span className="board-risk-n" style={{ background: SEV_BG[r.sev] }}>{i + 1}</span>
              <div>
                <p>
                  {r.text}{' '}
                  {r.cites.map((ct) => <CiteChip key={ct.id} c={ct} onOpen={setCite} />)}
                </p>
                <div style={{ marginTop: 4 }}><SevBadge sev={r.sev} /></div>
              </div>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid g-3-2">
        <Card title="Quarter on quarter" sub="This quarter compared with the previous one">
          <table className="board-tbl">
            <thead><tr><th>Measure</th><th className="r">Last quarter</th><th className="r">This quarter</th><th className="r">Change</th></tr></thead>
            <tbody>
              {qoq.map((q) => {
                const d = q.now - q.prev;
                const good = d === 0 ? null : (d > 0) === q.higherIsBetter;
                return (
                  <tr key={q.label} className="board-tr-link" onClick={() => nav(QOQ_PATH[q.label] ?? '/')} title={`Open the records behind "${q.label}"`}>
                    <td>{q.label}</td>
                    <td className="r num muted">{fmtNum(q.prev)}{q.unit}</td>
                    <td className="r num"><b>{fmtNum(q.now)}{q.unit}</b></td>
                    <td className="r num" style={{ color: good === null ? 'var(--text-muted)' : good ? 'var(--good)' : 'var(--bad)', fontWeight: 700 }}>
                      {d === 0 ? 'no change' : `${d > 0 ? '▲' : '▼'} ${Math.abs(d)}${q.unit.trim() === '%' ? ' pts' : q.unit}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title="Financial exposure" sub={`Modelled cyber loss vs insurance · ${c.insurance.carrier}`} actions={<button className="link" onClick={() => nav('/insurance/quantification')}>Model →</button>}>
          <div className="board-money" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', rowGap: 14 }}>
            <button type="button" className="board-money-btn" onClick={() => nav('/insurance/quantification')} title="Source: HexaView loss model · open the scenarios"><b>{fmtMoney(h.insurance.expectedLossM * 1e6, c.currency)}</b><span>Expected annual loss</span></button>
            <button type="button" className="board-money-btn" onClick={() => nav('/insurance/quantification')} title="Source: HexaView loss model · open the loss curve"><b style={{ color: tailPct > 100 ? 'var(--bad)' : undefined }}>{fmtMoney(h.insurance.tailLossM * 1e6, c.currency)}</b><span>1-in-100-year loss</span></button>
            <button type="button" className="board-money-btn" onClick={() => nav('/insurance/policy')} title={`Source: ${c.insurance.carrier} policy schedule`}><b>{fmtMoney(c.insurance.limitM * 1e6, c.currency)}</b><span>Policy limit</span></button>
            <button type="button" className="board-money-btn" onClick={() => nav('/insurance/policy')} title={`Source: ${c.insurance.broker}`}><b>{fmtMoney(c.insurance.retentionK * 1e3, c.currency)}</b><span>Retention · renews in {c.insurance.renewalDays} d</span></button>
          </div>
          <div style={{ marginTop: 16 }}>
            <SectionLabel>1-in-100 loss against limit</SectionLabel>
            <Bar value={Math.min(100, (c.insurance.limitM / Math.max(h.insurance.tailLossM, c.insurance.limitM)) * 100)} color="var(--m-insurance)" size="thick" />
            <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
              {tailPct > 100
                ? `A severe year would exceed cover by ${fmtMoney((h.insurance.tailLossM - c.insurance.limitM) * 1e6, c.currency)} (${tailPct}% of the limit); the excess sits on the balance sheet.`
                : `A severe year is within cover (${tailPct}% of the limit).`}{' '}
              Modelled premium impact {h.insurance.premiumDeltaPct > 0 ? '+' : ''}{h.insurance.premiumDeltaPct}% at renewal.
            </div>
          </div>
        </Card>
      </div>

      {draft !== 'hidden' && (
        <Card title={<><Sparkles size={15} /> Draft board summary</>} sub={draft === 'drafting' ? 'HexaView copilot is drafting from cited records…' : `Draft for ${summary.preparedFor.name} · requires approval before it leaves HexaView`} toneColor="var(--m-view)" tinted
          actions={draft === 'ready' && <Badge color="var(--sev-medium)" dot>Awaiting approval: {summary.approver.name}</Badge>}>
          {draft === 'drafting' ? (
            <div className="muted" style={{ fontSize: 12.5 }}><span className="live-dot" /> Reading Resilience Index, risks, loops and loss model…</div>
          ) : (
            <div className="board-draft">
              {summary.paragraphs.map((p, i) => (
                <p key={i}>
                  {p.text}{' '}
                  {p.cites.map((ct, j) => <CiteChip key={`${ct.id}-${j}`} c={ct} onOpen={setCite} />)}
                </p>
              ))}
              <KV rows={[
                ['Prepared by', 'HexaView copilot (grounded, cited; no uncited claims)'],
                ['Reviewer', `${summary.reviewer.name} · ${summary.reviewer.role}`],
                ['Approver', `${summary.approver.name} · ${summary.approver.role}`],
                ['Distribution', `${summary.preparedFor.name} and board members, via HexaCustody (view-only, watermarked)`],
              ]} />
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <Btn sm onClick={() => setDraft('hidden')}>Discard</Btn>
                <Btn sm onClick={() => nav('/reports/library')}><FileText /> Open in board pack</Btn>
                <Btn sm primary color="var(--m-view)" onClick={() => { setDraft('hidden'); toast(`Board summary sent to ${summary.approver.name} for approval · audited`); }}><ShieldCheck /> Send to {summary.approver.name.split(' ')[0]} for approval</Btn>
              </div>
            </div>
          )}
        </Card>
      )}

      <Legend items={[{ label: `Index version ${RI_VERSION}`, color: 'var(--m-view)' }, { label: `Generated ${fmtDate(NOW)}`, color: 'var(--text-muted)' }]} />
      <p className="board-disclaimer">
        The Resilience Index is a HexaShield measure of observed security posture, calculated from the customer's own connected tools. It is not a certification, an audit opinion or a regulatory rating, and should be read alongside the
        assurance reports named in each citation.
      </p>

      {cite && (
        <Drawer title={cite.label} sub={`${cite.kind} · source: ${cite.source}`} onClose={() => setCite(null)} footer={cite.path ? <Btn primary color="var(--m-view)" onClick={() => { const p = cite.path!; setCite(null); nav(p); }}>Open record <ArrowRight /></Btn> : undefined}>
          <KV rows={[['Record ID', <span key="id" className="mono">{cite.id}</span>], ...cite.rows]} />
          <Callout>Citations point at records in the canonical model; the board sees the same record the analyst sees, with its source tool and freshness.</Callout>
        </Drawer>
      )}
    </>
  );
}
