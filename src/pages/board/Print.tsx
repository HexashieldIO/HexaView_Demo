import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Btn, HexScore } from '../../components/ui';
import { headlines, resilienceIndex, riTrend, riDrivers } from '../../data/core';
import { boardDuties, mainFramework, moneyRisks, isOverdue, RAG_COLOR, RAG_LABEL } from '../../data/modules/boardMeeting';
import { tenantName } from '../../data/customers';
import { NOW, fmtDate, fmtMoney, fmtNum } from '../../lib/format';
import { useBm, BM_TONE } from './state';
import { useMinutes } from './Minutes';

function Toolbar({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="row between wrap no-print bm-print-bar" style={{ gap: 10 }}>
      <Btn onClick={onClose}><ArrowLeft /> Back to the workspace</Btn>
      <span className="muted" style={{ fontSize: 12 }}>{title} · print or save as PDF</span>
      <Btn primary color={BM_TONE} onClick={() => window.print()}><Printer /> Print</Btn>
    </div>
  );
}

export function BoardPack({ onClose }: { onClose: () => void }) {
  const { customer: c } = useApp();
  const nav = useNavigate();
  const { m, papers, requests, recorded, questions, actions } = useBm();
  const h = headlines(c);
  const ri = resilienceIndex(c);
  const trend = riTrend(c);
  const drivers = riDrivers(c).slice(0, 3);
  const risks = moneyRisks(c);
  const duties = boardDuties(c);
  const main = mainFramework(c);
  const money = (n: number) => fmtMoney(n, c.currency);
  const qDelta = trend[11] - trend[8];
  const yDelta = trend[11] - trend[0];
  const maxTail = Math.max(...risks.map((r) => r.tail), 1);
  const audits = c.frameworks.filter((f) => f.nextAudit).slice(0, 5);
  const go = (p: string) => { onClose(); nav(p); };

  return (
    <div className="bm-print">
      <Toolbar title="Board pack" onClose={onClose} />
      <div className="bm-doc">
        <header className="bm-doc-head">
          <div>
            <small>{m.committee} · {fmtDate(m.date)} · {m.time}</small>
            <h2>{c.name} · Cyber resilience board pack</h2>
            <span className="muted">{tenantName(c, 'all')} · prepared {fmtDate(NOW)} by {c.people.ciso.name} ({c.people.ciso.role}) for {m.chair.name} · {papers.filter((p) => p.circulated).length}/{papers.length} papers circulated</span>
          </div>
          <span className="bm-doc-mark">Confidential · board only</span>
        </header>

        <section className="bm-doc-sec">
          <h3>1. Resilience Index</h3>
          <div className="bm-doc-ri">
            <HexScore value={ri.value} size={110} />
            <div>
              <p><b>{ri.value} out of 100</b>, {qDelta >= 0 ? 'up' : 'down'} {Math.abs(qDelta)} this quarter and {yDelta >= 0 ? 'up' : 'down'} {Math.abs(yDelta)} over 12 months. Calculated from {c.connectors.length} connected tools; it rises only when controls are proven to work.</p>
              <table className="bm-tbl compact">
                <tbody>{ri.components.map((x) => <tr key={x.key}><td>{x.label}</td><td className="r num">{Math.round(x.weight * 100)}%</td><td className="r num"><b>{x.score}</b></td></tr>)}</tbody>
              </table>
            </div>
            <svg viewBox="0 0 220 70" width={220} height={70} aria-label="Twelve-month trend">
              {(() => {
                const lo = Math.min(...trend) - 3; const hi = Math.max(...trend) + 3;
                const pts = trend.map((v, i) => `${(i / 11) * 210 + 5},${65 - ((v - lo) / (hi - lo)) * 58}`).join(' ');
                return <><polyline points={pts} fill="none" stroke="#20b292" strokeWidth={2.5} strokeLinejoin="round" /><circle cx={215} cy={65 - ((trend[11] - lo) / (hi - lo)) * 58} r={4} fill="#20b292" /></>;
              })()}
            </svg>
          </div>
        </section>

        <section className="bm-doc-sec">
          <h3>2. Top risks with money exposure</h3>
          <table className="bm-tbl">
            <thead><tr><th>Scenario</th><th className="r">Expected annual loss</th><th>Severe case</th><th className="r">Insured share</th></tr></thead>
            <tbody>
              {risks.map((r) => (
                <tr key={r.name} onClick={() => go(r.path)} className="bm-click">
                  <td>{r.name}</td>
                  <td className="r num">{money(r.ale)}</td>
                  <td style={{ minWidth: 180 }}><div className="bm-doc-bar"><i style={{ width: `${(r.tail / maxTail) * 100}%` }} /><span className="num">{money(r.tail)}</span></div></td>
                  <td className="r num">{Math.round(r.covered * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="bm-doc-note">Total expected annual loss {money(h.insurance.expectedLossM * 1e6)}; 1-in-100-year loss {money(h.insurance.tailLossM * 1e6)} against a {money(c.insurance.limitM * 1e6)} limit ({c.insurance.carrier}, renews in {c.insurance.renewalDays} days).</p>
        </section>

        <div className="bm-doc-cols">
          <section className="bm-doc-sec">
            <h3>3. Incidents since the last meeting</h3>
            <div className="bm-doc-stats">
              <div><b className="num">{fmtNum(m.incidentsSince.handled)}</b><span>incidents handled in {m.incidentsSince.days} days</span></div>
              <div><b className="num" style={{ color: m.incidentsSince.major ? 'var(--bad)' : undefined }}>{m.incidentsSince.major}</b><span>major</span></div>
              <div><b className="num">{m.incidentsSince.notifiable}</b><span>notified to a regulator</span></div>
              <div><b className="num">{h.soc.mttrMin} min</b><span>median time to contain</span></div>
            </div>
            <p className="bm-doc-note">{questions.find((q) => q.id === 'news')?.answer}</p>
          </section>
          <section className="bm-doc-sec">
            <h3>4. Regulatory horizon</h3>
            <ul className="bm-doc-list">
              {duties.slice(0, 4).map((d) => <li key={d.reg}><b>{d.reg}</b> · {d.personal ? 'personal duty on directors' : 'corporate duty'}</li>)}
              {main && <li><b>{main.short}</b> · {main.documented}% documented, {main.assured}% assured</li>}
              {audits.map((f) => <li key={f.id}><b>{f.short}</b> · {f.nextAudit}</li>)}
            </ul>
          </section>
        </div>

        <section className="bm-doc-sec">
          <h3>5. Programme status</h3>
          <table className="bm-tbl compact">
            <tbody>
              {drivers.map((d) => <tr key={d.text} className="bm-click" onClick={() => go(d.path)}><td className="num" style={{ color: 'var(--good)', fontWeight: 700, width: 56 }}>+{d.gain.toFixed(1)}</td><td>{d.text}</td><td className="muted" style={{ width: 120 }}>{d.module}</td></tr>)}
            </tbody>
          </table>
          <p className="bm-doc-note">{actions.filter((a) => a.status === 'Complete').length} of {actions.length} board actions complete; {actions.filter(isOverdue).length} overdue. {h.comply.overdueTasks} compliance tasks overdue; {h.comply.controlsMetPct}% of controls met.</p>
        </section>

        <section className="bm-doc-sec">
          <h3>6. Decisions requested</h3>
          <ol className="bm-doc-list num">
            {requests.map((q) => {
              const rc = recorded[q.id];
              const rec = q.options.find((o) => o.id === q.recommended);
              return <li key={q.id}><b>{q.title}.</b> Recommendation: {rec?.label} ({rec?.cost}). {rc && <span style={{ color: rc.outcome === 'Approved' ? 'var(--good)' : 'var(--sev-medium)', fontWeight: 700 }}>[{rc.outcome} in session]</span>}</li>;
            })}
          </ol>
        </section>

        <section className="bm-doc-sec">
          <h3>Questions for directors</h3>
          <div className="bm-doc-qs">
            {questions.map((q) => <span key={q.id}><i style={{ background: RAG_COLOR[q.rag] }} title={RAG_LABEL[q.rag]} />{q.q}</span>)}
          </div>
        </section>
        <p className="bm-doc-foot">Generated by HexaView from live data. Figures are as of {fmtDate(NOW)} and each links to its source record in HexaView. The Resilience Index is a HexaShield measure of observed posture, not a certification or audit opinion.</p>
      </div>
    </div>
  );
}

export function MinuteExtract({ onClose }: { onClose: () => void }) {
  const { customer: c } = useApp();
  const { m } = useBm();
  const paras = useMinutes();
  return (
    <div className="bm-print">
      <Toolbar title="Minute extract" onClose={onClose} />
      <div className="bm-doc">
        <header className="bm-doc-head">
          <div>
            <small>Extract from the minutes</small>
            <h2>{c.name} · {m.committee}</h2>
            <span className="muted">Meeting held on {fmtDate(m.date)} at {m.time}, {m.location} · Item 2 to 6: cyber resilience</span>
          </div>
          <span className="bm-doc-mark">Draft · subject to approval</span>
        </header>
        {paras.map((p) => (
          <section key={p.n} className="bm-doc-sec">
            <h3>{p.n}. {p.heading}</h3>
            <p className="bm-doc-p">{p.text}</p>
          </section>
        ))}
        <div className="bm-sign">
          <div><span /> {m.chair.name}, Chair<small>Date</small></div>
          <div><span /> {m.secretary.name}, Company Secretary<small>Certified a true extract</small></div>
        </div>
      </div>
    </div>
  );
}
