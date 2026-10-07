import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RotateCcw, Download, FileText, Quote, Play, CalendarClock, PenLine, BookmarkPlus, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { tenantName } from '../../../data/customers';
import {
  periodFromState, initialPeriodState, PERIOD_KINDS, CADENCE_TEXT,
  type Format, type PeriodKind, type PeriodState,
} from '../../../data/modules/reports';
import {
  SOC_SECTIONS, SOC_AUDIENCES, SOC_PRESETS, DEFAULT_SOC_SECTIONS, SOC_SECTION_ORDER, socReportData, buildSocDoc,
  type SocAudience, type SocSectionId,
} from '../../../data/modules/socReport';
import { Badge, Btn, Callout, Card, KpiStrip, KV } from '../../../components/ui';
import { Drawer, Modal } from '../../../components/Overlay';
import { fmtNum, fmtTime } from '../../../lib/format';
import { GenerateModal, PeriodPicker, SignOffModal } from '../../reports/parts';
import { useSoc } from '../parts';
import { SocReportPaper } from './Paper';
import { useSocReportStore } from './store';
import './socreport.css';

const KINDS = PERIOD_KINDS.map((k) => k.id);

export default function SocReportBuilder() {
  const { customer } = useApp();
  const [sp] = useSearchParams();
  // Re-initialise when the customer or the deep-link changes.
  const k = `${customer.id}|${sp.get('preset') ?? ''}|${sp.get('tpl') ?? ''}|${sp.get('kind') ?? ''}|${sp.get('from') ?? ''}|${sp.get('to') ?? ''}`;
  return <Inner key={k} />;
}

function Inner() {
  const { c, tenantId, tone, toast, nav } = useSoc();
  const [sp] = useSearchParams();
  const store = useSocReportStore(c);
  const preset = SOC_PRESETS.find((p) => p.id === sp.get('preset'));
  const tpl = store.state.templates.find((t) => t.id === sp.get('tpl'));
  const kindParam = sp.get('kind') as PeriodKind | null;
  const initKind: PeriodKind = kindParam && KINDS.includes(kindParam) ? kindParam : tpl?.period ?? preset?.period ?? 'monthly';

  const [sel, setSel] = useState<SocSectionId[]>(tpl?.sections ?? preset?.sections ?? DEFAULT_SOC_SECTIONS);
  const [title, setTitle] = useState(tpl?.title ?? preset?.title(c.short) ?? `${c.short} SOC / MDR report`);
  const [audience, setAudience] = useState<SocAudience>(tpl?.audience ?? preset?.audience ?? 'CISO');
  const [format, setFormat] = useState<Format>(tpl?.format ?? preset?.format ?? 'PDF');
  const [presetId, setPresetId] = useState<string | null>(preset?.id ?? null);
  const [ps, setPs] = useState<PeriodState>(() => {
    const base = initialPeriodState(initKind);
    const from = sp.get('from');
    const to = sp.get('to');
    return initKind === 'custom' && from && to ? { ...base, from, to } : base;
  });
  const [signed, setSigned] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [modal, setModal] = useState<'generate' | 'signoff' | 'schedule' | 'cites' | null>(null);

  const period = useMemo(() => periodFromState(ps), [ps]);
  const data = useMemo(() => socReportData(c, tenantId, period), [c, tenantId, period]);
  const ordered = useMemo(() => SOC_SECTION_ORDER.filter((id) => id === 'summary' || sel.includes(id)), [sel]);
  const doc = useMemo(() => buildSocDoc(c, tenantId, ordered, data, ps.compare, audience), [c, tenantId, ordered, data, ps.compare, audience]);
  const pages = Math.max(1, Math.ceil(1.5 + ordered.length * 0.9));
  const statements = doc.sections.reduce((s, x) => s + x.statements.length, 0);
  const kindLabel = PERIOD_KINDS.find((x) => x.id === ps.kind)?.label ?? '';
  const scope = tenantName(c, tenantId);
  const approvers = [c.people.socLead.name, c.people.ciso.name, c.people.grcLead.name, c.people.admin.name, c.people.board.name];
  const defaultApprover = audience === 'SOC manager' || audience === 'Customer IT' ? c.people.socLead.name : audience === 'Auditor' ? c.people.grcLead.name : c.people.ciso.name;
  const { tools } = data;

  const dirty = () => { setSigned(null); setGeneratedAt(null); };
  const toggle = (id: SocSectionId) => {
    if (id === 'summary') return;
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    setPresetId(null);
    dirty();
  };
  const applyPreset = (id: string) => {
    const p = SOC_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setSel(p.sections);
    setAudience(p.audience);
    setFormat(p.format);
    setTitle(p.title(c.short));
    setPs((s) => ({ ...s, kind: p.period }));
    setPresetId(p.id);
    dirty();
  };
  const print = () => {
    toast(`${format === 'PDF' ? 'Print view opened' : `Exported as PDF (print view) rather than ${format}`} · ${signed ? 'signed' : 'watermarked DRAFT'}`);
    setTimeout(() => window.print(), 60);
  };
  const saveTemplate = () => {
    const id = `SOCT-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    store.addTemplate({ id, title, audience, format, period: ps.kind, sections: ordered, by: c.people.socLead.name, at: Date.now() });
    toast(`Saved “${title}” as a template · listed under Reports`);
  };

  const steps = [
    `Pull ${kindLabel.toLowerCase()} alert and case records from ${tools.siemShort}`,
    ...(tools.edr ? [`Pull detections, isolations and vulnerabilities from ${tools.edrShort}`] : []),
    `Pull sign-in and MFA telemetry from ${tools.idpShort}`,
    'Reconcile with the HexaSOC case store and SLA ledger',
    'Map incidents to ATT&CK and recompute HexaMatrix coverage',
    `Draft ${ordered.length} sections and cite ${statements} statements`,
    `Render ${format}${ps.compare ? ` with deltas against ${period.prev.label}` : ''}`,
  ];

  return (
    <div className="socr-scope">
      <p className="page-intro">
        Build a SOC / MDR report for <b>{c.name}</b> · {scope}. Every number, chart and delta is recomputed for the chosen period from {tools.siemShort}
        {tools.edr ? `, ${tools.edrShort}` : ''} and {tools.idpShort} via the HexaSOC case store; every statement is cited, and a named approver signs before it is released.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Reporting period', value: kindLabel, unit: period.label, bar: Math.min(100, (period.days / 365) * 100), onClick: () => document.getElementById('socr-period')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), source: 'SOC report builder period control' },
          { label: 'Compare', value: ps.compare ? 'On' : 'Off', unit: ps.compare ? `vs ${period.prev.label}` : 'no deltas', onClick: () => { setPs((p) => ({ ...p, compare: !p.compare })); dirty(); }, source: 'Toggle period-over-period comparison' },
          { label: 'Sections', value: ordered.length, unit: `of ${SOC_SECTIONS.length}`, onClick: () => document.getElementById('socr-sections')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), source: 'SOC report builder' },
          { label: 'Incidents in period', value: fmtNum(data.cur.incidents), unit: `${data.cur.sev.critical} critical`, to: '/soc/ir?status=all', source: 'HexaSOC case store' },
          { label: 'SLA met', value: `${data.cur.slaPct}%`, unit: `MTTR ${data.cur.mttr} min`, to: '/soc/mdr', source: 'HexaSOC SLA ledger' },
          { label: 'Citations', value: doc.citations.length, unit: `${statements} statements`, onClick: () => setModal('cites'), source: 'HexaCore versioned records' },
        ]}
      />

      <div className="grid g-1-2">
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Reporting period" sub="Daily to annual, or a custom date range" toneColor={tone}>
            <div id="socr-period">
              <PeriodPicker value={ps} onChange={(v) => { setPs(v); dirty(); }} />
            </div>
          </Card>

          <Card title="Report" sub="Title, audience and output">
            <div className="stack" style={{ gap: 10 }}>
              <label className="stack" style={{ gap: 4 }}>
                <span className="section-label" style={{ margin: 0 }}>Title</span>
                <input className="input" value={title} onChange={(e) => { setTitle(e.target.value); dirty(); }} aria-label="Report title" />
              </label>
              <div className="row wrap">
                <label className="stack" style={{ gap: 4, flex: 1 }}>
                  <span className="section-label" style={{ margin: 0 }}>Audience</span>
                  <select className="select" value={audience} onChange={(e) => { setAudience(e.target.value as SocAudience); dirty(); }} aria-label="Audience">
                    {SOC_AUDIENCES.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </label>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="section-label" style={{ margin: 0 }}>Format</span>
                  <div className="rep-seg">
                    {(['PDF', 'PPTX', 'DOCX'] as Format[]).map((f) => (
                      <button key={f} className={format === f ? 'on' : ''} onClick={() => { setFormat(f); dirty(); }}>{f}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <span className="section-label">Presets</span>
                <div className="chips">
                  {SOC_PRESETS.map((p) => (
                    <button key={p.id} className={`chip ${presetId === p.id ? 'on' : ''}`} onClick={() => applyPreset(p.id)} title={`${p.audience} · ${PERIOD_KINDS.find((x) => x.id === p.period)?.label} · ${p.format}`}>{p.label}</button>
                  ))}
                  {store.state.templates.map((t) => (
                    <button key={t.id} className="chip socr-chip-saved" onClick={() => nav(`/soc/reports?view=builder&tpl=${t.id}`)} title={`Saved template · ${t.audience} · ${t.format}`}><BookmarkPlus size={11} /> {t.title}</button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Sections" sub="Tick to add; the preview updates live" actions={<Btn sm ghost onClick={() => { setSel(DEFAULT_SOC_SECTIONS); setPresetId(null); dirty(); }}><RotateCcw /> Reset</Btn>}>
            <div className="rep-pal" id="socr-sections">
              {SOC_SECTIONS.map((s) => (
                <label key={s.id} className={ordered.includes(s.id) ? 'on' : ''} style={s.locked ? { cursor: 'default' } : undefined}>
                  <input type="checkbox" checked={ordered.includes(s.id)} disabled={s.locked} onChange={() => toggle(s.id)} />
                  <div>
                    <b>{s.label}{s.locked && <span className="socr-tag">Always first</span>}{s.optional && <span className="socr-tag">Optional</span>}</b>
                    <span>{s.hint}</span>
                  </div>
                </label>
              ))}
            </div>
          </Card>

          <Card tinted toneColor={tone}>
            <div className="stack" style={{ gap: 10 }}>
              {signed ? (
                <Callout kind="good">Signed off by <b>{signed}</b>. The DRAFT watermark is removed; the {format} is signed (SHA-256), anchored to the audit ledger and ready to release.</Callout>
              ) : generatedAt ? (
                <Callout>Generated at {fmtTime(generatedAt)} from live data. Request sign-off to release it.</Callout>
              ) : (
                <Callout>Nothing is released until a named approver signs. The approver can reject individual statements.</Callout>
              )}
              <div className="row wrap" style={{ gap: 8 }}>
                <Btn primary color={tone} disabled={!ordered.length} onClick={() => setModal('generate')}><Play /> Generate</Btn>
                <Btn onClick={print}><Download /> Download PDF</Btn>
                <Btn onClick={() => setModal('schedule')}><CalendarClock /> Schedule</Btn>
                <Btn onClick={() => setModal('signoff')} disabled={!!signed}>{signed ? <><CheckCircle2 /> Signed off</> : <><PenLine /> Request sign-off</>}</Btn>
                <Btn ghost onClick={saveTemplate}><BookmarkPlus /> Save as template</Btn>
              </div>
            </div>
          </Card>
        </div>

        <Card
          title="Live preview"
          sub={`${format} · ≈ ${format === 'PPTX' ? pages + 2 : pages} ${format === 'PPTX' ? 'slides' : 'pages'} · ${audience} · ${period.label}${period.label !== period.range ? ` (${period.range})` : ''} · ${scope}`}
          actions={<><Badge color={tone}>{kindLabel}</Badge><Btn sm ghost onClick={() => setModal('cites')}><Quote /> {fmtNum(doc.citations.length)} citations</Btn></>}
        >
          <div className="rep-paper-wrap socr-print" id="socr-preview">
            <SocReportPaper c={c} tenantId={tenantId} title={title || 'Untitled SOC report'} audience={audience} format={format} doc={doc} data={data} compare={ps.compare} signedBy={signed ?? undefined} generatedAt={generatedAt ?? undefined} />
          </div>
        </Card>
      </div>

      {modal === 'cites' && (
        <Drawer wide title="Statements and citations" sub={`${statements} statements · ${doc.citations.length} versioned records · ${period.label}`} icon={<span className="ico-box" style={{ ['--tone' as string]: tone }}><FileText /></span>} onClose={() => setModal(null)}>
          <KV rows={[['Period', `${period.label} · ${period.range}`], ['Compared with', ps.compare ? `${period.prev.label} · ${period.prev.range}` : 'Off'], ['Scope', scope], ['Sources', [tools.siemShort, tools.edr ? tools.edrShort : null, tools.idpShort, 'HexaSOC case store', 'HexaMatrix'].filter(Boolean).join(' · ')]]} />
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
        </Drawer>
      )}

      {modal === 'generate' && (
        <GenerateModal
          title={title}
          steps={steps}
          tone={tone}
          period={ps}
          onPeriod={(v) => { setPs(v); dirty(); }}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            setGeneratedAt(new Date());
            setSigned(null);
            toast(`“${title}” generated for ${period.label} · ${doc.citations.length} citations, ${format} (DRAFT until signed)`);
          }}
        />
      )}

      {modal === 'signoff' && (
        <SignOffModal
          title={`${title} · ${period.label} · ${format}`}
          heading="Request sign-off"
          cta="Request from"
          tone={tone}
          approvers={approvers}
          defaultApprover={defaultApprover}
          format={format}
          extra={<Callout>Covers <b>{period.range}</b> for {scope}{ps.compare ? <> with deltas against {period.prev.range}</> : null}. {doc.citations.length} citations across {ordered.length} sections.</Callout>}
          onClose={() => setModal(null)}
          onSubmit={(who) => {
            setSigned(who);
            setModal(null);
            toast(`${who} signed off “${title}” (${period.label}) · DRAFT watermark removed`);
          }}
        />
      )}

      {modal === 'schedule' && <ScheduleModal title={title} audience={audience} format={format} kind={ps.kind} sections={ordered} onClose={() => setModal(null)} />}
    </div>
  );
}

function ScheduleModal({ title, audience, format, kind, sections, onClose }: { title: string; audience: SocAudience; format: Format; kind: PeriodKind; sections: SocSectionId[]; onClose: () => void }) {
  const { c, toast } = useSoc();
  const store = useSocReportStore(c);
  const [cadence, setCadence] = useState<Exclude<PeriodKind, 'custom'>>(kind === 'custom' ? 'monthly' : kind);
  const [recipients, setRecipients] = useState(audience === 'Executive / Board' ? `${c.people.board.name}, ${c.people.ciso.name}` : audience === 'SOC manager' ? `${c.people.socLead.name}, ${c.people.admin.name}` : `${c.people.ciso.name}, ${c.people.socLead.name}`);
  const save = () => {
    store.addSchedule({ id: `SOCS-${Date.now().toString(36).slice(-5).toUpperCase()}`, title, cadence, recipients, format, audience, sections, at: Date.now() });
    toast(`Scheduled “${title}” · ${CADENCE_TEXT[cadence]} · ${recipients}`);
    onClose();
  };
  return (
    <Modal
      title="Schedule this report"
      sub={title}
      onClose={onClose}
      footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color="var(--m-soc)" onClick={save} disabled={!recipients.trim()}><CalendarClock /> Add schedule</Btn></>}
    >
      <div className="stack" style={{ gap: 12 }}>
        <label className="stack" style={{ gap: 4 }}>
          <span className="section-label" style={{ margin: 0 }}>Cadence</span>
          <select className="select" value={cadence} onChange={(e) => setCadence(e.target.value as Exclude<PeriodKind, 'custom'>)} aria-label="Cadence">
            {(Object.keys(CADENCE_TEXT) as Exclude<PeriodKind, 'custom'>[]).map((k) => <option key={k} value={k}>{CADENCE_TEXT[k]}</option>)}
          </select>
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="section-label" style={{ margin: 0 }}>Recipients</span>
          <input className="input" value={recipients} onChange={(e) => setRecipients(e.target.value)} aria-label="Recipients" />
        </label>
        <KV rows={[['Covers', 'The previous full period at each run'], ['Format', `${format} + link to the live HexaView report`], ['Sections', `${sections.length}`], ['Release', 'Each run is drafted, then signed by a named approver before delivery']]} />
      </div>
    </Modal>
  );
}
