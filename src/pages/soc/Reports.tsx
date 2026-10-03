import { useMemo, useState } from 'react';
import { FileText, Download, CalendarClock, ArrowRight, Printer } from 'lucide-react';
import { Card, Badge, Btn, IcoBox, KV, Callout, Ring } from '../../components/ui';
import { Drawer, Modal } from '../../components/Overlay';
import { socReports, type SocReport } from '../../data/modules/soc';
import { TACTIC_COLOR } from '../../data/attackFull';
import { daysAgo, fmtDate, fmtNum } from '../../lib/format';
import { useSoc, StatTile, Pills } from './parts';

type F = 'all' | 'Monthly' | 'Quarterly';

export default function SocReports() {
  const { c, tenantId, tone, scopeLabel, nav, toast } = useSoc();
  const reps = useMemo(() => socReports(c, tenantId), [c, tenantId]);
  const [f, setF] = useState<F>('all');
  const [sel, setSel] = useState<SocReport | null>(null);
  const [sched, setSched] = useState(false);
  const latest = reps[0];
  const rows = reps.filter((r) => f === 'all' || r.kind === f).sort((a, b) => a.generatedDaysAgo - b.generatedDaysAgo);
  const src = 'HexaSOC reporting · case and alert ledger';

  return (
    <>
      <p className="page-intro">
        <b>{scopeLabel}</b> · periodic reports from HexaSOC: each one a self-contained summary you can read, print or share with {c.people.ciso.name} and the board.
      </p>

      {latest && (
        <Card toneColor={tone} tinted>
          <div className="soc-report-hero">
            <div className="stack" style={{ gap: 8 }}>
              <span className="section-label" style={{ margin: 0, color: tone }}>Latest · monthly</span>
              <h3 style={{ fontSize: 19 }}>{latest.title}</h3>
              <p className="soc-prose">{latest.summary}</p>
              <span className="row wrap" style={{ gap: 8 }}>
                <Btn primary sm onClick={() => setSel(latest)}>Open report <ArrowRight size={13} /></Btn>
                <Btn sm onClick={() => toast(`${latest.title} exported as PDF`)}><Download size={13} /> PDF</Btn>
                <Btn sm onClick={() => setSched(true)}><CalendarClock size={13} /> Schedule</Btn>
              </span>
            </div>
            <div className="soc-report-kpis">
              <button type="button" className="soc-report-kpi" onClick={() => nav('/soc/mdr')} title={`Source: ${src}`}><b>{fmtNum(latest.alerts)}</b><span>Alerts triaged</span></button>
              <button type="button" className="soc-report-kpi" onClick={() => nav('/soc/ir?status=all')} title={`Source: ${src}`}><b>{fmtNum(latest.incidents)}</b><span>Incidents raised</span></button>
              <button type="button" className="soc-report-kpi" onClick={() => nav('/soc/ir?status=closed')} title={`Source: ${src}`}><b style={{ color: 'var(--sev-high)' }}>{fmtNum(latest.truePositives)}</b><span>True positives</span></button>
              <button type="button" className="soc-report-kpi" onClick={() => nav('/soc/mdr')} title={`Source: ${src}`}><b style={{ color: 'var(--good)' }}>{fmtNum(latest.benign)}</b><span>Benign / expected</span></button>
            </div>
          </div>
        </Card>
      )}

      <div className="soc-stats">
        <StatTile icon={<FileText />} value={reps.filter((r) => r.kind === 'Monthly').length} label="Monthly reports (6 months)" tone={tone} onClick={() => setF('Monthly')} source={src} />
        <StatTile icon={<FileText />} value={reps.filter((r) => r.kind === 'Quarterly').length} label="Quarterly board reports" tone="#a78bfa" onClick={() => setF('Quarterly')} source={src} />
        <StatTile icon={<CalendarClock />} value="1st" label="Next monthly: first working day" tone="#2dd4bf" onClick={() => setSched(true)} source="HexaSOC report schedule" />
      </div>

      <Card title="Previous reports" count={rows.length} actions={<Pills value={f} onChange={setF} tone={tone} items={[{ id: 'all', label: 'All' }, { id: 'Monthly', label: 'Monthly' }, { id: 'Quarterly', label: 'Quarterly' }]} />} flush>
        <div>
          {rows.map((r) => (
            <button key={r.id} type="button" className="soc-ticket" onClick={() => setSel(r)}>
              <span style={{ minWidth: 0 }}>
                <span className="t">{r.title}</span>
                <span className="m"><span>Generated {fmtDate(daysAgo(r.generatedDaysAgo))}</span>·<span>{fmtNum(r.alerts)} alerts</span>·<span>{r.incidents} incidents</span>·<span>{r.truePositives} true positives</span></span>
              </span>
              <span className="r">
                <Badge color={r.kind === 'Quarterly' ? '#a78bfa' : tone}>{r.kind}</Badge>
                <span style={{ color: r.alertDeltaPct < 0 ? 'var(--good)' : 'var(--sev-medium)' }}>{r.alertDeltaPct > 0 ? '+' : ''}{r.alertDeltaPct}% alerts</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      {sel && (
        <Drawer
          wide
          title={sel.title}
          sub={`${c.name} · ${tenantId === 'all' ? 'all tenants' : scopeLabel} · generated ${fmtDate(daysAgo(sel.generatedDaysAgo))}`}
          icon={<IcoBox color={tone}><FileText /></IcoBox>}
          onClose={() => setSel(null)}
          footer={
            <>
              <Btn onClick={() => toast(`${sel.title} sent to the printer queue`)}><Printer size={14} /> Print</Btn>
              <Btn onClick={() => toast(`${sel.title} shared with ${c.people.ciso.name}`)}>Share</Btn>
              <Btn primary onClick={() => toast(`${sel.title} exported as PDF`)}><Download size={14} /> Download PDF</Btn>
            </>
          }
        >
          <div className="stack" style={{ gap: 18 }}>
            <div className="soc-prose"><p>{sel.summary}</p></div>
            <div className="soc-report-kpis" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
              <button type="button" className="soc-report-kpi" onClick={() => nav('/soc/mdr')}><b>{fmtNum(sel.alerts)}</b><span>Alerts triaged</span></button>
              <button type="button" className="soc-report-kpi" onClick={() => nav('/soc/ir?status=all')}><b>{fmtNum(sel.incidents)}</b><span>Incidents</span></button>
              <button type="button" className="soc-report-kpi" onClick={() => nav('/soc/ir?status=closed')}><b>{fmtNum(sel.truePositives)}</b><span>True positives</span></button>
              <button type="button" className="soc-report-kpi" onClick={() => nav('/soc/attack')}><b>{sel.coveragePct}%</b><span>ATT&CK coverage</span></button>
            </div>
            <div className="row wrap" style={{ gap: 20 }}>
              <Ring value={sel.slaPct} size={92} stroke={8} color="var(--good)" label={`${sel.slaPct.toFixed(1)}%`} sub="SLA" />
              <KV rows={[
                ['Mean time to detect', `${sel.mttd} min (SLA 15)`],
                ['Mean time to contain', `${sel.mttr} min (SLA 60)`],
                ['Alert trend', `${sel.alertDeltaPct > 0 ? '+' : ''}${sel.alertDeltaPct}% on previous period`],
                ['Period', sel.period],
              ]} />
            </div>
            <div>
              <div className="section-label">Highlights</div>
              <ul className="soc-changes">{sel.highlights.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div>
              <div className="section-label">Incidents by ATT&CK tactic</div>
              {sel.tactics.map((t) => {
                const max = Math.max(...sel.tactics.map((x) => x.count));
                return (
                  <div key={t.tactic} className="soc-tactic-row">
                    <span style={{ fontWeight: 600 }}>{t.tactic}</span>
                    <span className="soc-stat-bar" style={{ height: 8, marginTop: 0 }}><i style={{ width: `${(t.count / max) * 100}%`, background: TACTIC_COLOR[t.tactic] ?? tone }} /></span>
                    <span className="num" style={{ textAlign: 'right', fontWeight: 700 }}>{t.count}</span>
                  </div>
                );
              })}
            </div>
            <div>
              <div className="section-label">Focus for next period</div>
              <ul className="soc-changes">{sel.focus.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <Callout>Figures are drawn from the same case and alert ledger as the live dashboards, so this report reconciles with the Command Centre for the period.</Callout>
          </div>
        </Drawer>
      )}

      {sched && (
        <Modal title="Report schedule" sub="Who gets which report, and when" onClose={() => setSched(false)}
          footer={<><Btn ghost onClick={() => setSched(false)}>Close</Btn><Btn primary onClick={() => { toast('Report schedule saved'); setSched(false); }}>Save schedule</Btn></>}>
          <KV rows={[
            ['Monthly SOC report', `First working day · ${c.people.ciso.name}, ${c.people.socLead.name}`],
            ['Quarterly board report', `5 working days after quarter end · ${c.people.board.name}`],
            ['Weekly shift digest', `Mondays 08:00 · ${c.people.socLead.name}`],
            ['Format', 'PDF + link to the live HexaView report'],
          ]} />
        </Modal>
      )}
    </>
  );
}
