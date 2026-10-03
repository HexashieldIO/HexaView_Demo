import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, CalendarClock, Mail, Pause, Play, Send } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { tenantName } from '../../data/customers';
import {
  reportTemplates, schedules, deliveryHistory, issuedReports, coverageRange, resolvePeriod, CADENCE_TEXT, COVERAGE_OPTIONS, PERIOD_KINDS,
  type Format, type Schedule, type PeriodKind, type Coverage,
} from '../../data/modules/reports';
import { Badge, Btn, Callout, Card, Chip, KpiStrip, KV, StatusBadge, Timeline } from '../../components/ui';
import { SEV_HEX } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer, Modal } from '../../components/Overlay';
import { daysAhead, fmtDate, fmtDateShort, fmtNum, daysAgo } from '../../lib/format';
import { ChartLegend, REP_TONE, SvgColumns } from './parts';
import './reports.css';

const STATUS = { delivered: 'var(--good)', failed: 'var(--bad)', 'awaiting approval': 'var(--sev-medium)', paused: 'var(--sev-info)' };
type Cadence = Exclude<PeriodKind, 'custom'>;
const CADENCES: Cadence[] = ['daily', 'weekly', 'monthly', 'quarterly', 'half', 'annual'];
const CADENCE_COLOR: Record<Cadence, string> = { daily: '#8593b4', weekly: '#68b1ff', monthly: '#4f8cff', quarterly: '#a07cfb', half: '#ef6aae', annual: '#f5a83d' };
type StatusFilter = 'all' | 'awaiting' | 'failed' | 'paused' | Cadence;

export default function Scheduled() {
  const { customer } = useApp();
  return <ScheduledInner key={customer.id} />;
}

function ScheduledInner() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const [params, setParams] = useSearchParams();
  const days = rangeDays(timeRange);
  const base = useMemo(() => schedules(c, tenantId), [c, tenantId]);
  const tpls = reportTemplates(c);
  const [added, setAdded] = useState<Schedule[]>([]);
  const [paused, setPaused] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Schedule | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ tpl: tpls[0].id, cadence: 'monthly' as Cadence, coverage: 'Previous full period' as Coverage, recipients: `security-leadership@${c.domain}`, format: 'PDF' as Format, approver: c.people.ciso.name });
  const sf = (params.get('status') ?? 'all') as StatusFilter;
  const setSf = (v: StatusFilter) => setParams((p) => { const n = new URLSearchParams(p); if (v === 'all') n.delete('status'); else n.set('status', v); return n; }, { replace: true });
  const all = [...added, ...base].map((s) => (paused.has(s.id) ? { ...s, paused: true } : s));
  const rows = all.filter((s) => sf === 'all' || (sf === 'awaiting' ? s.lastStatus === 'awaiting approval' : sf === 'failed' ? s.lastStatus === 'failed' : sf === 'paused' ? s.paused : s.cadence === sf));
  const hist = deliveryHistory(c, tenantId, Math.max(days, 7));
  const delivered = hist.delivered.reduce((a, b) => a + b, 0);
  const failed = hist.failed.reduce((a, b) => a + b, 0);
  const awaiting = all.filter((s) => s.lastStatus === 'awaiting approval').length;
  const issued = issuedReports(c, tenantId);
  const lists = new Set(all.map((s) => s.recipients)).size;
  const active = all.filter((s) => !s.paused);
  const next = active.slice().sort((a, b) => a.nextRunDays - b.nextRunDays)[0];
  const labels = hist.weekly ? Array.from({ length: hist.n }, (_, i) => fmtDateShort(daysAgo((hist.n - 1 - i) * 7))) : Array.from({ length: hist.n }, (_, i) => fmtDateShort(daysAgo(hist.n - 1 - i)));
  const people = [c.people.ciso.name, c.people.grcLead.name, c.people.socLead.name, c.people.admin.name];
  const byCadence = CADENCES.map((k) => ({ k, n: active.filter((s) => s.cadence === k).length }));

  // 4-week run calendar starting this Monday.
  const today = new Date();
  const dow = (today.getDay() + 6) % 7;
  const cal = Array.from({ length: 28 }, (_, i) => {
    const off = i - dow;
    const runs = active.filter((s) => s.nextRunDays === off || (s.cadence === 'daily' && off >= 1) || (s.cadence === 'weekly' && off >= 1 && (off - s.nextRunDays) % 7 === 0 && off >= s.nextRunDays));
    return { off, date: daysAhead(off), runs };
  });
  const [calSel, setCalSel] = useState<number | null>(null);

  function add() {
    const t = tpls.find((x) => x.id === form.tpl)!;
    const s: Schedule = { id: `SCH-${c.initials}-${300 + added.length}`, templateId: t.id, report: t.title, cadence: form.cadence, frequency: CADENCE_TEXT[form.cadence], coverage: form.coverage, recipients: form.recipients, recipientCount: form.recipients.split(',').length, channel: 'Email · custody-protected link', format: form.format, nextRunDays: form.cadence === 'daily' ? 1 : form.cadence === 'weekly' ? 3 : form.cadence === 'monthly' ? 24 : 40, approver: form.approver, lastStatus: 'awaiting approval' };
    setAdded((a) => [s, ...a]);
    setAdding(false);
    toast(`Schedule created: ${t.title}, ${CADENCE_TEXT[form.cadence].toLowerCase()}, covering ${form.coverage.toLowerCase()} (${coverageRange(form.cadence, form.coverage)}). Each run waits for ${form.approver}'s signature.`);
  }

  return (
    <>
      <p className="page-intro">
        Scheduled reports and distribution for <b>{c.name}</b> · {tenantName(c, tenantId)}. Each schedule has a frequency and a coverage period; every run drafts from live data for that period, waits for its named approver, then delivers signed copies.
        Board and partner copies go out as custody-protected links.
      </p>

      <KpiStrip
        toneColor={REP_TONE}
        items={[
          { label: 'Active schedules', value: active.length, unit: `${all.length - active.length} paused`, onClick: () => setSf('all'), source: 'Report scheduler' },
          { label: 'Deliveries', hint: rangeLabel(timeRange), value: fmtNum(Math.round((delivered * days) / Math.max(days, 7))), onClick: () => document.getElementById('rep-deliv')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), source: 'Mail relay & secure-share delivery log' },
          { label: 'Delivery success', value: `${((delivered / Math.max(1, delivered + failed)) * 100).toFixed(1)}%`, bar: (delivered / Math.max(1, delivered + failed)) * 100, onClick: () => setSf('failed'), source: 'Delivery log · click for failed runs' },
          { label: 'Awaiting approval', value: awaiting, toneColor: 'var(--sev-medium)', onClick: () => setSf('awaiting'), source: 'Approval gate' },
          { label: 'Distribution lists', value: lists, onClick: () => setSf('all'), source: 'Report scheduler' },
          { label: 'Next run', value: next ? `${next.nextRunDays} d` : '—', unit: next?.report.split(' · ')[0], onClick: () => next && setSel(next), source: 'Report scheduler' },
        ]}
      />

      <div className="grid g-2-1">
        <Card title="Delivery history" sub={`${hist.weekly ? 'Per week' : 'Per day'} · ${rangeLabel(Math.max(days, 7) === days ? timeRange : '7d').toLowerCase()}`}>
          <div id="rep-deliv">
            <ChartLegend items={[{ label: 'Delivered', color: '#4f8cff' }, { label: 'Awaiting approval', color: SEV_HEX.medium }, { label: 'Failed (retried)', color: SEV_HEX.critical }]} />
            <SvgColumns labels={labels} height={220} series={[{ name: 'Delivered', color: '#4f8cff', data: hist.delivered }, { name: 'Awaiting approval', color: SEV_HEX.medium, data: hist.awaiting }, { name: 'Failed (retried)', color: SEV_HEX.critical, data: hist.failed }]} />
          </div>
        </Card>
        <Card title="Schedules by frequency" sub="Click to filter the table">
          <div className="rep-aud">
            {byCadence.map(({ k, n }) => (
              <button key={k} className={sf === k ? 'on' : ''} onClick={() => setSf(sf === k ? 'all' : k)}>
                <CalendarClock style={{ color: CADENCE_COLOR[k] }} />
                <span>{PERIOD_KINDS.find((p) => p.id === k)?.label}</span>
                <div><i style={{ width: `${(n / Math.max(1, ...byCadence.map((x) => x.n))) * 100}%`, background: CADENCE_COLOR[k] }} /></div>
                <b>{n}</b>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g-2-1">
        <Card title="Run calendar" sub="Next four weeks · click a day for its runs">
          <div className="rep-cal">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="rep-cal-h">{d}</div>)}
            {cal.map((d) => (
              <button key={d.off} className={`rep-cal-d ${d.off === 0 ? 'today' : ''} ${d.runs.length ? 'has' : ''}`} disabled={!d.runs.length || d.off < 0} onClick={() => setCalSel(d.off)} title={d.runs.map((r) => r.report).join('\n')} style={d.off < 0 ? { opacity: 0.4 } : undefined}>
                <span>{d.date.getDate()} {d.date.getDate() === 1 || d.off === -dow ? d.date.toLocaleDateString('en-GB', { month: 'short' }) : ''}</span>
                {d.off >= 0 && [...new Set(d.runs.map((r) => r.cadence))].slice(0, 3).map((k) => <i key={k} style={{ background: CADENCE_COLOR[k as Cadence] ?? REP_TONE }} />)}
                {d.off >= 0 && d.runs.length > 0 && <small>{d.runs.length} run{d.runs.length > 1 ? 's' : ''}</small>}
              </button>
            ))}
          </div>
        </Card>
        <Card title="Coming up" sub="Next 5 runs and the period each covers">
          <Timeline
            items={active.slice().sort((a, b) => a.nextRunDays - b.nextRunDays).slice(0, 5).map((s) => ({
              time: fmtDateShort(daysAhead(s.nextRunDays)),
              title: s.report,
              body: `Covers ${coverageRange(s.cadence, s.coverage)} · approver ${s.approver}`,
              color: s.lastStatus === 'failed' ? 'var(--bad)' : CADENCE_COLOR[s.cadence as Cadence] ?? REP_TONE,
            }))}
          />
        </Card>
      </div>

      <Card
        title="Schedules"
        count={rows.length}
        flush
        sub="Frequency, coverage period and distribution · click a schedule for recipients and run history"
        actions={
          <>
            {sf !== 'all' && <Chip on color={REP_TONE} onClick={() => setSf('all')}>Filter: {sf} ✕</Chip>}
            <Btn sm primary color={REP_TONE} onClick={() => setAdding(true)}><Plus /> Add schedule</Btn>
          </>
        }
      >
        <DataTable
          rows={rows}
          rowKey={(s) => s.id}
          onRowClick={setSel}
          search={(s) => `${s.report} ${s.recipients} ${s.approver} ${s.frequency} ${s.coverage}`}
          searchPlaceholder="Filter reports, recipients, approvers…"
          initialSort={{ key: 'next', dir: 'asc' }}
          columns={[
            { key: 'report', header: 'Report', sort: (s) => s.report, render: (s) => (<><div className="t-main">{s.report}</div><div className="t-sub mono">{s.id}</div></>) },
            { key: 'freq', header: 'Frequency', sort: (s) => CADENCES.indexOf(s.cadence as Cadence), render: (s) => (<><Badge color={CADENCE_COLOR[s.cadence as Cadence]}>{PERIOD_KINDS.find((p) => p.id === s.cadence)?.label}</Badge><div className="t-sub">{s.frequency}</div></>) },
            { key: 'cov', header: 'Coverage period', sort: (s) => s.coverage, render: (s) => (<><div>{s.coverage}</div><div className="t-sub">next: {coverageRange(s.cadence, s.coverage)}</div></>) },
            { key: 'rcpt', header: 'Recipients / distribution', render: (s) => (<><div>{s.recipients}</div><div className="t-sub">{s.recipientCount} recipient{s.recipientCount > 1 ? 's' : ''} · {s.channel}</div></>) },
            { key: 'fmt', header: 'Format', render: (s) => <Badge>{s.format}</Badge> },
            { key: 'next', header: 'Next run', sort: (s) => (s.paused ? 9999 : s.nextRunDays), render: (s) => (s.paused ? <span className="muted">Paused</span> : <>{fmtDate(daysAhead(s.nextRunDays))}<div className="t-sub">in {s.nextRunDays} d</div></>) },
            { key: 'appr', header: 'Approver', sort: (s) => s.approver, render: (s) => s.approver },
            { key: 'last', header: 'Last run', render: (s) => <StatusBadge value={s.paused ? 'paused' : s.lastStatus} map={STATUS} /> },
          ]}
        />
      </Card>

      {calSel !== null && (
        <Drawer title={`Runs on ${fmtDate(daysAhead(calSel))}`} sub={`${cal.find((d) => d.off === calSel)?.runs.length ?? 0} scheduled runs`} icon={<span className="ico-box" style={{ ['--tone' as string]: REP_TONE }}><CalendarClock /></span>} onClose={() => setCalSel(null)}>
          <div className="list">
            {(cal.find((d) => d.off === calSel)?.runs ?? []).map((s) => (
              <button key={s.id} className="list-row" onClick={() => { setCalSel(null); setSel(s); }}>
                <i className="dot" style={{ background: CADENCE_COLOR[s.cadence as Cadence] }} />
                <span className="list-main"><b>{s.report}</b><span>{s.frequency} · covers {coverageRange(s.cadence, s.coverage)} · {s.recipients}</span></span>
              </button>
            ))}
          </div>
        </Drawer>
      )}

      {sel && (
        <Drawer
          title={sel.report}
          sub={`${sel.id} · ${sel.frequency}`}
          icon={<span className="ico-box" style={{ ['--tone' as string]: REP_TONE }}><CalendarClock /></span>}
          onClose={() => setSel(null)}
          footer={
            <>
              <Btn onClick={() => { setPaused((p) => { const n = new Set(p); if (n.has(sel.id)) n.delete(sel.id); else n.add(sel.id); return n; }); toast(`${sel.report} ${paused.has(sel.id) ? 'resumed' : 'paused'}`); setSel(null); }}>
                {paused.has(sel.id) ? <><Play /> Resume</> : <><Pause /> Pause</>}
              </Btn>
              <Btn primary color={REP_TONE} onClick={() => { toast(`${sel.report}: run started for ${coverageRange(sel.cadence, sel.coverage)}, waiting for ${sel.approver} to sign`); setSel(null); }}><Send /> Run now</Btn>
            </>
          }
        >
          <KV
            rows={[
              ['Frequency', `${PERIOD_KINDS.find((p) => p.id === sel.cadence)?.label} · ${sel.frequency}`],
              ['Coverage period', sel.coverage],
              ['Next run covers', coverageRange(sel.cadence, sel.coverage)],
              ['Compared with', sel.coverage === 'Previous full period' ? resolvePeriod(sel.cadence).prev.label : 'Same length immediately before'],
              ['Distribution', sel.recipients],
              ['Recipients', String(sel.recipientCount)],
              ['Channel', sel.channel],
              ['Format', sel.format],
              ['Approver', sel.approver],
              ['Next run', sel.paused ? 'Paused' : fmtDate(daysAhead(sel.nextRunDays))],
              ['Scope', tenantName(c, tenantId)],
            ]}
          />
          {sel.lastStatus === 'failed' && <Callout kind="warn">Last delivery bounced for 1 recipient (mailbox full); retried successfully after 30 minutes.</Callout>}
          <div>
            <div className="section-label">Recent runs</div>
            <Timeline
              items={issued.filter((x) => x.templateId === sel.templateId).slice(0, 4).map((x) => ({
                time: fmtDateShort(daysAgo(x.issuedDays)),
                title: `${x.period} · ${x.version}`,
                body: `${x.periodRange} · signed by ${x.approver} · ${x.downloads} downloads`,
                color: 'var(--good)',
              }))}
            />
            {issued.filter((x) => x.templateId === sel.templateId).length === 0 && <div className="muted" style={{ fontSize: 12 }}>No runs yet: first run will wait for approval.</div>}
          </div>
        </Drawer>
      )}

      {adding && (
        <Modal
          title="Add schedule"
          sub="Every run is drafted for its coverage period, then held for its approver's signature"
          onClose={() => setAdding(false)}
          footer={<><Btn onClick={() => setAdding(false)}>Cancel</Btn><Btn primary color={REP_TONE} onClick={add} disabled={!form.recipients.trim()}><Mail /> Create schedule</Btn></>}
        >
          <div className="stack" style={{ gap: 12 }}>
            <Field label="Report">
              <select className="select" value={form.tpl} onChange={(e) => { const t = tpls.find((x) => x.id === e.target.value); setForm({ ...form, tpl: e.target.value, cadence: t && t.period !== 'custom' ? t.period : form.cadence }); }}>
                {tpls.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </Field>
            <Field label="Frequency">
              <div className="rep-seg rep-seg-wrap">
                {CADENCES.map((k) => <button key={k} className={form.cadence === k ? 'on' : ''} onClick={() => setForm({ ...form, cadence: k })}>{PERIOD_KINDS.find((p) => p.id === k)?.label}</button>)}
              </div>
              <span className="muted" style={{ fontSize: 11.5 }}>Runs {CADENCE_TEXT[form.cadence].toLowerCase()}</span>
            </Field>
            <Field label="Coverage period">
              <select className="select" value={form.coverage} onChange={(e) => setForm({ ...form, coverage: e.target.value as Coverage })}>
                {COVERAGE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
              <span className="muted" style={{ fontSize: 11.5 }}>Next run would cover <b>{coverageRange(form.cadence, form.coverage)}</b></span>
            </Field>
            <Field label="Recipients or distribution list (comma-separated)">
              <input className="input" value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} />
            </Field>
            <div className="row wrap">
              <Field label="Format">
                <div className="rep-seg">
                  {(['PDF', 'PPTX', 'DOCX'] as Format[]).map((f) => <button key={f} className={form.format === f ? 'on' : ''} onClick={() => setForm({ ...form, format: f })}>{f}</button>)}
                </div>
              </Field>
              <Field label="Approver (signs each run)">
                <select className="select" value={form.approver} onChange={(e) => setForm({ ...form, approver: e.target.value })}>
                  {people.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
            </div>
            <Callout>External recipients receive a custody-protected link that can be revoked; internal recipients get a signed {form.format}.</Callout>
          </div>
        </Modal>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="stack" style={{ gap: 4, flex: 1 }}>
      <span className="section-label" style={{ margin: 0 }}>{label}</span>
      {children}
    </div>
  );
}
