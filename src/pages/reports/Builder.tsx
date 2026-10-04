import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Send, RotateCcw, Download, FileText, Quote } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { scopedTenants, tenantName } from '../../data/customers';
import { headlines } from '../../data/core';
import {
  SECTIONS, buildDoc, defaultSections, periodFromState, initialPeriodState, reportTemplates, PERIOD_KINDS,
  type Audience, type Format, type SectionId, type PeriodState, type PeriodKind,
} from '../../data/modules/reports';
import { Badge, Btn, Callout, Card, KpiStrip, KV } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { fmtNum } from '../../lib/format';
import { PeriodPicker, ReportPaper, REP_TONE, SignOffModal } from './parts';
import './reports.css';

const PRESETS: { id: string; label: string; audience: Audience; sections: SectionId[]; period: PeriodKind }[] = [
  { id: 'board', label: 'Board (quarterly)', audience: 'Board', sections: ['ri', 'capability', 'incidents', 'insurance', 'risks'], period: 'quarterly' },
  { id: 'exec', label: 'Exec (monthly)', audience: 'Executive', sections: ['ri', 'incidents', 'loops', 'exposure'], period: 'monthly' },
  { id: 'soc', label: 'SOC (weekly)', audience: 'Executive', sections: ['incidents', 'exposure', 'ai', 'risks'], period: 'weekly' },
  { id: 'audit', label: 'Auditor (annual)', audience: 'Auditor', sections: ['frameworks', 'loops', 'exposure'], period: 'annual' },
  { id: 'insurer', label: 'Insurer (annual)', audience: 'Insurer', sections: ['insurance', 'capability', 'loops'], period: 'annual' },
];

export default function Builder() {
  const { customer } = useApp();
  return <BuilderInner key={customer.id} />;
}

function BuilderInner() {
  const { customer: c, tenantId, toast } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const tplParam = params.get('template');
  const tpl = tplParam ? reportTemplates(c).find((t) => t.id === tplParam) : undefined;
  const h = headlines(c, tenantId);
  const ts = scopedTenants(c, tenantId);
  const hasOt = ts.some((t) => t.env.includes('ot'));
  const defaults: SectionId[] = defaultSections(c, hasOt);
  const [sel, setSel] = useState<SectionId[]>(tpl?.sections ?? defaults);
  const [title, setTitle] = useState(tpl?.title ?? `${c.short} cyber resilience report`);
  const [audience, setAudience] = useState<Audience>(tpl?.audience ?? 'Board');
  const [format, setFormat] = useState<Format>(tpl?.format ?? 'PDF');
  const [ps, setPs] = useState<PeriodState>(() => initialPeriodState(tpl?.period === 'custom' ? 'weekly' : tpl?.period ?? 'monthly'));
  const [ask, setAsk] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [cites, setCites] = useState(false);

  const period = useMemo(() => periodFromState(ps), [ps]);
  const ordered = useMemo(() => SECTIONS.map((s) => s.id).filter((id) => sel.includes(id)), [sel]);
  const doc = useMemo(() => buildDoc(c, tenantId, ordered, period, ps.compare), [c, tenantId, ordered, period, ps.compare]);
  const approvers = [c.people.ciso.name, c.people.grcLead.name, c.people.socLead.name, c.people.board.name];
  const pages = Math.max(1, Math.ceil(1.5 + ordered.length * 0.9));
  const statements = doc.sections.reduce((s, x) => s + x.statements.length, 0);
  const kindLabel = PERIOD_KINDS.find((k) => k.id === ps.kind)?.label ?? '';

  const toggle = (id: SectionId) => {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    setSent(null);
  };

  return (
    <>
      <p className="page-intro">
        Build a report for <b>{c.name}</b> · {tenantName(c, tenantId)} from live sections. Pick the reporting period and every number, chart and delta in the preview is recomputed for it;
        every statement is cited, and a named approver signs before anything is released.
      </p>

      <KpiStrip
        toneColor={REP_TONE}
        items={[
          { label: 'Reporting period', value: kindLabel, unit: period.label, bar: Math.min(100, (period.days / 365) * 100), onClick: () => document.getElementById('rep-period')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), source: 'Report Builder period control' },
          { label: 'Compare', value: ps.compare ? 'On' : 'Off', unit: ps.compare ? `vs ${period.prev.label}` : 'no deltas', onClick: () => setPs((p) => ({ ...p, compare: !p.compare })), source: 'Toggle period-over-period comparison' },
          { label: 'Sections', value: ordered.length, unit: `of ${SECTIONS.length}`, onClick: () => document.getElementById('rep-sections')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), source: 'Report Builder' },
          { label: 'Statements cited', value: statements, unit: '100% cited', onClick: () => setCites(true), source: 'HexaCore citation binder' },
          { label: 'Citations', value: doc.citations.length, onClick: () => setCites(true), source: 'HexaCore versioned records' },
          { label: 'Data freshness', value: `${h.ops.lastAnchorMin} min`, unit: 'since last ledger anchor', to: '/ops/audit', source: 'HexaView audit ledger' },
        ]}
      />

      <div className="grid g-1-2">
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Reporting period" sub="Daily to annual, or a custom date range" toneColor={REP_TONE}>
            <div id="rep-period">
              <PeriodPicker value={ps} onChange={(v) => { setPs(v); setSent(null); }} />
            </div>
          </Card>

          <Card title="Report" sub="Title, audience and output">
            <div className="stack" style={{ gap: 10 }}>
              <label className="stack" style={{ gap: 4 }}>
                <span className="section-label" style={{ margin: 0 }}>Title</span>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Report title" />
              </label>
              <div className="row wrap">
                <label className="stack" style={{ gap: 4, flex: 1 }}>
                  <span className="section-label" style={{ margin: 0 }}>Audience</span>
                  <select className="select" value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
                    {(['Board', 'Executive', 'Regulator', 'Auditor', 'Insurer', 'Customer'] as Audience[]).map((a) => <option key={a}>{a}</option>)}
                  </select>
                </label>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="section-label" style={{ margin: 0 }}>Format</span>
                  <div className="rep-seg">
                    {(['PDF', 'PPTX', 'DOCX'] as Format[]).map((f) => (
                      <button key={f} className={format === f ? 'on' : ''} onClick={() => setFormat(f)}>{f}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <span className="section-label">Presets</span>
                <div className="chips">
                  {PRESETS.map((p) => (
                    <button key={p.id} className="chip" onClick={() => { setSel(p.sections); setAudience(p.audience); setPs((s) => ({ ...s, kind: p.period })); setSent(null); }}>{p.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Sections" sub="Tick to add; the preview updates live" actions={<Btn sm ghost onClick={() => setSel(defaults)}><RotateCcw /> Reset</Btn>}>
            <div className="rep-pal" id="rep-sections">
              {SECTIONS.map((s) => {
                const disabled = s.id === 'ot' && !hasOt;
                return (
                  <label key={s.id} className={sel.includes(s.id) ? 'on' : ''} style={disabled ? { opacity: 0.55 } : undefined}>
                    <input type="checkbox" checked={sel.includes(s.id)} onChange={() => toggle(s.id)} />
                    <div>
                      <b>{s.id === 'custody' ? c.vocab.custodyLabel : s.label}</b>
                      <span>{disabled ? 'No OT in this tenant: section will say so' : s.hint}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </Card>

          <Card tinted toneColor={REP_TONE}>
            <div className="stack" style={{ gap: 10 }}>
              {sent ? (
                <Callout kind="good">Sent to <b>{sent}</b> for signature. It will be signed (SHA-256), anchored to the ledger and released to recipients when approved.</Callout>
              ) : (
                <Callout>Nothing is released until a named approver signs. The approver can reject individual statements.</Callout>
              )}
              <div className="row">
                <Btn onClick={() => toast(`Unsigned ${format} preview for ${period.label} downloaded (watermarked DRAFT)`)}><Download /> Draft preview</Btn>
                <span className="spacer" />
                <Btn primary color={REP_TONE} disabled={!ordered.length} onClick={() => setAsk(true)}><Send /> Send for approval</Btn>
              </div>
            </div>
          </Card>
        </div>

        <Card
          title="Live preview"
          sub={`${format} · ≈ ${format === 'PPTX' ? pages + 2 : pages} ${format === 'PPTX' ? 'slides' : 'pages'} · ${audience} · ${period.label}${period.label !== period.range ? ` (${period.range})` : ''} · ${tenantName(c, tenantId)}`}
          actions={<><Badge color={REP_TONE}>{kindLabel}</Badge><Btn sm ghost onClick={() => setCites(true)}><Quote /> {fmtNum(doc.citations.length)} citations</Btn></>}
        >
          <div className="rep-paper-wrap" id="rep-preview">
            <ReportPaper c={c} tenantId={tenantId} title={title || 'Untitled report'} audience={audience} sections={ordered} format={format} approver={sent ?? undefined} period={period} compare={ps.compare} />
          </div>
        </Card>
      </div>

      {cites && (
        <Drawer wide title="Statements and citations" sub={`${statements} statements · ${doc.citations.length} versioned records · ${period.label}`} icon={<span className="ico-box" style={{ ['--tone' as string]: REP_TONE }}><FileText /></span>} onClose={() => setCites(false)}>
          <KV rows={[['Period', `${period.label} · ${period.range}`], ['Compared with', ps.compare ? `${period.prev.label} · ${period.prev.range}` : 'Off'], ['Scope', tenantName(c, tenantId)]]} />
          <div className="tbl-wrap" style={{ margin: 0 }}>
            <table className="tbl">
              <thead><tr><th>Section</th><th>Statement</th><th>Record</th><th>Source</th></tr></thead>
              <tbody>
                {doc.sections.flatMap((s) => s.statements.map((st, i) => (
                  <tr key={`${s.id}-${i}`}>
                    <td style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{s.title}</td>
                    <td style={{ fontSize: 12 }}>{st.text}</td>
                    <td className="mono" style={{ fontSize: 10.5 }}>{st.refs.map((n) => doc.citations[n - 1]?.id).join(', ')}</td>
                    <td style={{ fontSize: 11.5 }}>{st.refs.map((n) => doc.citations[n - 1]?.source).join(', ')}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
          <Btn onClick={() => { setCites(false); nav('/reports/history'); }}>Open issued reports</Btn>
        </Drawer>
      )}

      {ask && (
        <SignOffModal
          title={`${title} · ${period.label} · ${format}`}
          approvers={approvers}
          defaultApprover={audience === 'Board' || audience === 'Insurer' ? c.people.ciso.name : c.people.grcLead.name}
          format={format}
          extra={<Callout>Covers <b>{period.range}</b>{ps.compare ? <> with deltas against {period.prev.range}</> : null}.</Callout>}
          onClose={() => setAsk(false)}
          onSubmit={(who) => {
            setSent(who);
            setAsk(false);
            toast(`“${title}” (${period.label}) sent to ${who} for approval · ${doc.citations.length} citations, ${format}`);
          }}
        />
      )}
    </>
  );
}
