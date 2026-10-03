import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, Play, FileText, Clock, Wand2 } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { tenantName, scopedConnectors } from '../../data/customers';
import {
  reportTemplates, issuedReports, schedules, periodFromState, initialPeriodState, PERIOD_KINDS,
  type Audience, type ReportTemplate, type PeriodState,
} from '../../data/modules/reports';
import { Badge, Btn, Callout, Card, KpiStrip, KV, Sources, StatusBadge, Tabs } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { fmtAgo, fmtNum } from '../../lib/format';
import { AUDIENCE_META, GenerateModal, PeriodPicker, ReportPaper, REP_TONE } from './parts';
import './reports.css';

type Filter = 'All' | Audience | 'Due';
const STATUS_MAP = { ready: 'var(--good)', draft: 'var(--sev-medium)', due: 'var(--bad)' };
const AUDIENCES: Audience[] = ['Board', 'Executive', 'Regulator', 'Auditor', 'Insurer', 'Customer'];

const periodFor = (t: ReportTemplate): PeriodState => initialPeriodState(t.period === 'custom' ? 'weekly' : t.period, true);

export default function Library() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const days = rangeDays(timeRange);
  const tpls = useMemo(() => reportTemplates(c), [c]);
  const issued = useMemo(() => issuedReports(c, tenantId), [c, tenantId]);
  const sch = useMemo(() => schedules(c, tenantId), [c, tenantId]);
  const pa = params.get('audience');
  const filter: Filter = pa === 'Due' || (pa && AUDIENCES.includes(pa as Audience)) ? (pa as Filter) : 'All';
  const setFilter = (f: Filter) => setParams((p) => { const n = new URLSearchParams(p); if (f === 'All') n.delete('audience'); else n.set('audience', f); return n; }, { replace: true });
  const [preview, setPreview] = useState<ReportTemplate | null>(null);
  const [previewPs, setPreviewPs] = useState<PeriodState>(initialPeriodState());
  const [gen, setGen] = useState<ReportTemplate | null>(null);
  const [genPs, setGenPs] = useState<PeriodState>(initialPeriodState());
  const [generated, setGenerated] = useState<Record<string, string>>({});

  const audiences = AUDIENCES.filter((a) => tpls.some((t) => t.audience === a));
  const shown = tpls.filter((t) => filter === 'All' || (filter === 'Due' ? t.status === 'due' || t.status === 'draft' : t.audience === filter));
  const inRange = issued.filter((x) => x.issuedDays <= days).length;
  const awaiting = tpls.filter((t) => t.status === 'draft').length + sch.filter((s) => s.lastStatus === 'awaiting approval').length;
  const regs = tpls.filter((t) => t.audience === 'Regulator');
  const avgCites = Math.round(issued.reduce((s, x) => s + x.citations, 0) / Math.max(1, issued.length));
  const conns = scopedConnectors(c, tenantId);
  const genPeriod = periodFromState(genPs);
  const previewPeriod = useMemo(() => periodFromState(previewPs), [previewPs]);

  const steps = (t: ReportTemplate) => [
    `Resolving scope: ${tenantName(c, tenantId)} · ${genPeriod.label} (${genPeriod.range})`,
    `Querying HexaCore across ${conns.length} integrations for ${genPeriod.days} days${genPs.compare ? ` + ${genPeriod.prev.label} for comparison` : ''}`,
    `Drafting ${t.sections.length} sections (${t.pages} pages)`,
    `Binding ${t.citations} citations to versioned records`,
    'Rendering charts and applying redaction policy',
    `Routing to ${t.owner} for sign-off`,
  ];
  const done = useCallback(() => {
    if (!gen) return;
    setGenerated((g) => ({ ...g, [gen.id]: genPeriod.label }));
    toast(`${gen.title} for ${genPeriod.label} drafted with ${gen.citations} citations; sent to ${gen.owner} for sign-off.`);
    setGen(null);
  }, [gen, toast, genPeriod.label]);

  const startGen = (t: ReportTemplate) => { setGenPs(periodFor(t)); setGen(t); };
  const openPreview = (t: ReportTemplate) => { setPreviewPs(periodFor(t)); setPreview(t); };

  const win = Math.max(days, 30);
  const byAud = audiences.map((a) => ({ a, n: issued.filter((x) => x.audience === a && x.issuedDays <= win).length }));
  const maxAud = Math.max(1, ...byAud.map((x) => x.n));
  const nextDeadline = regs.find((t) => t.deadline)?.deadline ?? '';

  return (
    <>
      <p className="page-intro">
        Report templates for <b>{c.name}</b> · {tenantName(c, tenantId)}, drafted from live HexaCore data for the period you choose (daily to annual, or a custom range), with every statement cited and signed on release.
        Regulator packs for {[...new Set(regs.map((t) => t.framework).filter(Boolean))].join(', ')}.
      </p>

      <KpiStrip
        toneColor={REP_TONE}
        items={[
          { label: 'Templates', value: tpls.length, unit: `${audiences.length} audiences`, onClick: () => setFilter('All'), source: 'HexaView report template library' },
          { label: 'Reports issued', hint: rangeLabel(timeRange), value: inRange, unit: `${issued.length} in 12 months`, to: '/reports/history', source: 'HexaView issued-report ledger' },
          { label: 'Awaiting sign-off', value: awaiting, toneColor: 'var(--sev-medium)', to: '/reports/scheduled?status=awaiting', source: 'Approval gate' },
          { label: 'Scheduled', value: sch.length, to: '/reports/scheduled', source: 'Report scheduler' },
          { label: 'Citations / report', value: fmtNum(avgCites), unit: 'avg · 100% cited', to: '/reports/history', source: 'HexaCore citation binder' },
          { label: 'Regulator templates', value: regs.length, unit: nextDeadline, onClick: () => setFilter('Regulator'), source: regs.map((t) => t.regulator).filter(Boolean).join(' · ') },
          { label: 'Due or in draft', value: tpls.filter((t) => t.status !== 'ready').length, toneColor: 'var(--bad)', onClick: () => setFilter('Due'), source: 'Template status' },
        ]}
      />

      <div className="grid g-3-2">
        <Card title="Issued by audience" sub={`Last ${win} days · click to filter the library`} actions={<Btn sm ghost onClick={() => nav('/reports/history')}>All issued</Btn>}>
          <div className="rep-aud">
            {byAud.map(({ a, n }) => {
              const meta = AUDIENCE_META[a];
              const Icon = meta.icon;
              return (
                <button key={a} className={filter === a ? 'on' : ''} onClick={() => setFilter(filter === a ? 'All' : a)} title={`${n} ${a.toLowerCase()} reports issued · click to filter`}>
                  <Icon style={{ color: meta.color }} />
                  <span>{a}</span>
                  <div><i style={{ width: `${(n / maxAud) * 100}%`, background: meta.color }} /></div>
                  <b>{n}</b>
                </button>
              );
            })}
          </div>
        </Card>
        <Card title="Next deadlines" sub="Regulator, auditor and insurer dates">
          <div className="list">
            {tpls.filter((t) => t.deadline).slice(0, 5).map((t) => (
              <button key={t.id} className="list-row" onClick={() => openPreview(t)}>
                <Clock size={14} className="muted" />
                <span className="list-main"><b>{t.title}</b><span>{t.deadline}{t.regulator ? ` · ${t.regulator}` : ''}</span></span>
                <StatusBadge value={t.status} map={STATUS_MAP} />
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card
        title="Report library"
        count={shown.length}
        sub="Preview with live data for any period, or generate now"
        actions={<Tabs color={REP_TONE} value={filter} onChange={setFilter} tabs={[{ id: 'All' as Filter, label: 'All' }, ...audiences.map((a) => ({ id: a as Filter, label: a })), { id: 'Due' as Filter, label: 'Due / draft' }]} />}
      >
        <div className="grid g3">
          {shown.map((t) => {
            const meta = AUDIENCE_META[t.audience];
            const Icon = meta.icon;
            const lastLabel = generated[t.id];
            return (
              <div key={t.id} className="card rep-card" style={{ boxShadow: 'none' }}>
                <div className="row">
                  <span className="ico-box" style={{ ['--tone' as string]: meta.color }}><Icon /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4>{t.title}</h4>
                    <div className="chips" style={{ marginTop: 4 }}>
                      <Badge color={meta.color}>{t.audience}</Badge>
                      {t.framework && <Badge>{t.framework}</Badge>}
                      <StatusBadge value={lastLabel ? 'draft' : t.status} map={STATUS_MAP} />
                    </div>
                  </div>
                </div>
                <p>{t.description}</p>
                <KV
                  rows={[
                    ['Last generated', lastLabel ? `Today · ${lastLabel}` : t.lastGeneratedDays === null ? 'Never' : t.lastGeneratedDays === 0 ? 'Today' : fmtAgo(t.lastGeneratedDays * 1440)],
                    ['Owner', t.owner],
                    ['Frequency', `${t.frequency} · covers ${PERIOD_KINDS.find((k) => k.id === t.period)?.label.toLowerCase() ?? 'custom'} period`],
                    ...(t.regulator ? [['Recipient', t.regulator] as [string, string]] : []),
                    ...(t.deadline ? [['Deadline', <span style={{ color: 'var(--sev-medium)', fontWeight: 600 }}>{t.deadline}</span>] as [string, ReactNode]] : []),
                  ]}
                />
                <div className="row">
                  <span className="muted" style={{ fontSize: 11 }}>{t.pages} pp · {t.citations} citations · {t.format}</span>
                  <span className="spacer" />
                  <Btn sm onClick={() => openPreview(t)}><Eye /> Preview</Btn>
                  <Btn sm primary color={REP_TONE} onClick={() => startGen(t)}><Play /> Generate</Btn>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {preview && (
        <Drawer
          wide
          title={preview.title}
          sub={`${preview.audience} · ${preview.frequency} · owner ${preview.owner}`}
          icon={<span className="ico-box" style={{ ['--tone' as string]: REP_TONE }}><FileText /></span>}
          onClose={() => setPreview(null)}
          footer={
            <>
              <Btn onClick={() => nav(`/reports/builder?template=${preview.id}`)}><Wand2 /> Customise in Builder</Btn>
              <Btn primary color={REP_TONE} onClick={() => { setGenPs(previewPs); setGen(preview); setPreview(null); }}><Play /> Generate for {previewPeriod.label}</Btn>
            </>
          }
        >
          <PeriodPicker value={previewPs} onChange={setPreviewPs} />
          <Callout>Rendered from live data for {tenantName(c, tenantId)} covering <b>{previewPeriod.range}</b>. Superscript numbers link to the citation appendix; the final document is signed on release.</Callout>
          <Sources items={[{ name: 'HexaCore' }, { name: 'HexaComply' }, ...conns.filter((k) => k.status !== 'healthy').slice(0, 2).map((k) => ({ name: `${k.product} (${k.status})`, status: k.status }))]} />
          <div className="rep-paper-wrap">
            <ReportPaper
              c={c}
              tenantId={tenantId}
              title={preview.title}
              subtitle={preview.regulator ? `For ${preview.regulator}` : undefined}
              audience={preview.audience}
              sections={preview.sections.includes('ri') ? preview.sections : (['ri', ...preview.sections] as typeof preview.sections)}
              format={preview.format}
              period={previewPeriod}
              compare={previewPs.compare}
            />
          </div>
        </Drawer>
      )}

      {gen && <GenerateModal key={gen.id} title={gen.title} steps={steps(gen)} onClose={() => setGen(null)} onDone={done} period={genPs} onPeriod={setGenPs} />}
    </>
  );
}
