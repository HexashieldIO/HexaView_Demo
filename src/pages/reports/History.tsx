import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileCheck2, Download, ShieldCheck, Check, Loader2 } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { tenantName } from '../../data/customers';
import { issuedReports, reportTemplates, buildDoc, resolvePeriod, PERIOD_KINDS, type IssuedReport, type Audience, type PeriodKind } from '../../data/modules/reports';
import { Badge, Btn, Callout, Card, Chip, KpiStrip, KV } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { daysAgo, fmtDate, fmtDateTime, fmtNum, monthLabels } from '../../lib/format';
import { AUDIENCE_META, ChartLegend, REP_TONE, SvgColumns } from './parts';
import './reports.css';

const AUD_HEX: Record<Audience, string> = { Board: '#3ad0ae', Executive: '#79a5f5', Regulator: '#f8646f', Auditor: '#93d65a', Insurer: '#2ec4a8', Customer: '#ecc873' };
const AUDS: Audience[] = ['Board', 'Executive', 'Regulator', 'Auditor', 'Insurer', 'Customer'];

const VERIFY_STEPS = ['Re-computing SHA-256 of the stored artefact', 'Comparing with the signature record', 'Checking signer certificate and approval', 'Confirming the audit-ledger anchor'];

function Verify({ rep, onDone }: { rep: IssuedReport; onDone: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i > VERIFY_STEPS.length) return;
    const t = setTimeout(() => {
      setI((x) => x + 1);
      if (i === VERIFY_STEPS.length) onDone();
    }, 520);
    return () => clearTimeout(t);
  }, [i, onDone]);
  const ok = i > VERIFY_STEPS.length;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="rep-steps">
        {VERIFY_STEPS.map((s, k) => (
          <div key={s} className={`rep-step ${k < i ? 'done' : k === i ? 'run' : ''}`}>
            <span className="rep-step-ico">{k < i ? <Check size={13} /> : k === i ? <Loader2 size={13} className="rep-spin" /> : k + 1}</span>
            <span>{s}</span>
          </div>
        ))}
      </div>
      {ok && (
        <div className="rep-verify">
          <svg className="rep-check" viewBox="0 0 80 80" aria-hidden>
            <circle cx="40" cy="40" r="36" />
            <path d="M24 41 l11 11 l22 -24" />
          </svg>
          <b style={{ color: 'var(--good)', fontSize: 15 }}>Signature valid</b>
          <span className="muted" style={{ fontSize: 12, textAlign: 'center' }}>
            Hash matches, signed by {rep.approver}, anchored in ledger block {fmtNum(rep.anchorBlock)}. The document has not changed since release.
          </span>
        </div>
      )}
    </div>
  );
}

export default function History() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const days = rangeDays(timeRange);
  const all = useMemo(() => issuedReports(c, tenantId), [c, tenantId]);
  const tpls = reportTemplates(c);
  const [onlyRange, setOnlyRange] = useState(false);
  const [params, setParams] = useSearchParams();
  const audF = AUDS.find((a) => a === params.get('audience')) ?? null;
  const kindF = (PERIOD_KINDS.find((k) => k.id === params.get('kind'))?.id ?? null) as PeriodKind | null;
  const setQ = (k: string, v: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });
  const [sel, setSel] = useState<IssuedReport | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const rows = all.filter((x) => (!onlyRange || x.issuedDays <= days) && (!audF || x.audience === audF) && (!kindF || x.periodKind === kindF));
  const inRange = all.filter((x) => x.issuedDays <= days);
  const audiences = [...new Set(all.map((x) => x.audience))];
  // Issued per month by audience (12 months, oldest first).
  const months = monthLabels(12);
  const byMonth = audiences.map((a) => ({
    a,
    data: months.map((_, i) => all.filter((x) => x.audience === a && Math.floor(x.issuedDays / 30.4) === 11 - i).length),
  }));
  const tpl = sel ? tpls.find((t) => t.id === sel.templateId) : undefined;
  const doc = sel && tpl ? buildDoc(c, sel.tenant === 'all' ? 'all' : sel.tenant, tpl.sections, resolvePeriod(sel.periodKind, 0)) : null;

  return (
    <>
      <p className="page-intro">
        Every report issued for <b>{c.name}</b> · {tenantName(c, tenantId)}, with version, approver, SHA-256 signature and citation count. Anyone with the file can verify it
        against the audit ledger.
      </p>

      <KpiStrip
        toneColor={REP_TONE}
        items={[
          { label: 'Reports issued', hint: rangeLabel(timeRange), value: inRange.length, unit: `${all.length} in 12 months`, onClick: () => { setOnlyRange(true); setQ('audience', null); setQ('kind', null); }, source: 'HexaView issued-report ledger' },
          { label: 'Signed & anchored', value: '100%', bar: 100, toneColor: 'var(--good)', onClick: () => { setSel(rows[0] ?? all[0]); setVerifying(true); }, source: 'Audit ledger anchors · click to verify the latest' },
          { label: 'Citations', hint: rangeLabel(timeRange), value: fmtNum(inRange.reduce((s, x) => s + x.citations, 0)), onClick: () => setSel(inRange[0] ?? all[0]), source: 'HexaCore citation binder' },
          { label: 'Downloads', hint: '12 months', value: fmtNum(all.reduce((s, x) => s + x.downloads, 0)), onClick: () => { setOnlyRange(false); setQ('audience', null); }, source: 'Download log (ledger)' },
          { label: 'Regulator submissions', hint: '12 months', value: all.filter((x) => x.audience === 'Regulator').length, onClick: () => setQ('audience', 'Regulator'), source: 'HexaView issued-report ledger' },
          { label: 'Verified this session', value: verified.size, onClick: () => setSel(all.find((x) => verified.has(x.id)) ?? all[0]), source: 'Signature verifier' },
        ]}
      />

      <Card title="Issued per month" sub="By audience · last 12 months · hover a column for the split" actions={<ChartLegend items={byMonth.map((x) => ({ label: x.a, color: AUD_HEX[x.a] }))} />}>
        <SvgColumns labels={months} height={200} series={byMonth.map((x) => ({ name: x.a, color: AUD_HEX[x.a], data: x.data }))} />
      </Card>

      <Card
        title="Issued reports"
        count={rows.length}
        flush
        sub="Click a report to verify its signature and read the citation appendix"
        actions={
          <div className="chips">
            <Chip on={onlyRange} color={REP_TONE} onClick={() => setOnlyRange((v) => !v)}>Only {rangeLabel(timeRange).toLowerCase()}</Chip>
            <select className="select" value={audF ?? ''} onChange={(e) => setQ('audience', e.target.value || null)} aria-label="Audience">
              <option value="">All audiences</option>
              {audiences.map((a) => <option key={a}>{a}</option>)}
            </select>
            <select className="select" value={kindF ?? ''} onChange={(e) => setQ('kind', e.target.value || null)} aria-label="Period type">
              <option value="">All periods</option>
              {PERIOD_KINDS.filter((k) => all.some((x) => x.periodKind === k.id)).map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </div>
        }
      >
        <DataTable
          rows={rows}
          rowKey={(x) => x.id}
          onRowClick={(x) => { setSel(x); setVerifying(false); }}
          search={(x) => `${x.id} ${x.title} ${x.period} ${x.approver} ${x.audience} ${x.sha256}`}
          searchPlaceholder="Filter by report, period, approver or hash…"
          initialSort={{ key: 'issued', dir: 'asc' }}
          empty={`No reports issued in the ${rangeLabel(timeRange).toLowerCase()}.`}
          columns={[
            { key: 'title', header: 'Report', sort: (x) => x.title, render: (x) => (<><div className="t-main">{x.title}</div><div className="t-sub mono">{x.id}</div></>) },
            { key: 'period', header: 'Period', sort: (x) => x.issuedDays, render: (x) => (<><div>{x.period}</div><div className="t-sub">{PERIOD_KINDS.find((k) => k.id === x.periodKind)?.label} · {x.periodRange}</div></>) },
            { key: 'aud', header: 'Audience', sort: (x) => x.audience, render: (x) => <Badge color={AUDIENCE_META[x.audience].color}>{x.audience}</Badge> },
            { key: 'ver', header: 'Version', render: (x) => <span className="mono">{x.version}</span> },
            { key: 'issued', header: 'Issued', sort: (x) => x.issuedDays, render: (x) => fmtDate(daysAgo(x.issuedDays)) },
            { key: 'appr', header: 'Approver', sort: (x) => x.approver, render: (x) => x.approver },
            { key: 'sha', header: 'SHA-256', render: (x) => (<span className="mono" title={x.sha256}>{x.sha256.slice(0, 10)}…{x.sha256.slice(-6)}{verified.has(x.id) && <ShieldCheck size={12} style={{ color: 'var(--good)', marginLeft: 4, verticalAlign: -2 }} />}</span>) },
            { key: 'cit', header: 'Citations', align: 'right', sort: (x) => x.citations, render: (x) => fmtNum(x.citations) },
            { key: 'dl', header: 'Downloads', align: 'right', sort: (x) => x.downloads, render: (x) => fmtNum(x.downloads) },
            { key: 'fmt', header: 'Format', render: (x) => <span className="t-sub">{x.format} · {x.sizeMb} MB</span> },
          ]}
        />
      </Card>

      {sel && (
        <Drawer
          wide
          title={`${sel.title} · ${sel.period}`}
          sub={<><span className="mono">{sel.id}</span> · {sel.version} · issued {fmtDateTime(daysAgo(sel.issuedDays))}</>}
          icon={<span className="ico-box" style={{ ['--tone' as string]: REP_TONE }}><FileCheck2 /></span>}
          onClose={() => setSel(null)}
          footer={
            <>
              <Btn onClick={() => toast(`${sel.id} downloaded (${sel.format}, ${sel.sizeMb} MB); download logged to the ledger`)}><Download /> Download</Btn>
              <Btn primary color={REP_TONE} onClick={() => setVerifying(true)} disabled={verifying}><ShieldCheck /> Verify signature</Btn>
            </>
          }
        >
          <KV
            rows={[
              ['Audience', <Badge color={AUDIENCE_META[sel.audience].color}>{sel.audience}</Badge>],
              ['Period', `${sel.period} · ${sel.periodRange}`],
              ['Author', sel.author],
              ['Approver (signer)', sel.approver],
              ['Scope', sel.tenant === 'all' ? `${c.short} group` : c.tenants.find((t) => t.id === sel.tenant)?.name],
              ['Recipients', `${sel.recipients}`],
              ['Downloads', `${sel.downloads}`],
              ['Citations', `${fmtNum(sel.citations)} (100% of statements)`],
              ['Ledger anchor', `Block ${fmtNum(sel.anchorBlock)}`],
            ]}
          />
          <div>
            <div className="section-label">SHA-256</div>
            <div className="rep-hash">{sel.sha256}</div>
          </div>
          {verifying ? (
            <Verify rep={sel} onDone={() => setVerified((s) => new Set(s).add(sel.id))} />
          ) : (
            <Callout>Verification recomputes the hash of the stored artefact and checks it against the signature and the audit-ledger anchor.</Callout>
          )}
          {doc && (
            <div>
              <div className="section-label">Citation appendix (excerpt · {doc.citations.length} of {fmtNum(sel.citations)})</div>
              <div className="tbl-wrap" style={{ margin: 0 }}>
                <table className="tbl">
                  <thead><tr><th>#</th><th>Statement</th><th>Record</th><th>Version</th></tr></thead>
                  <tbody>
                    {doc.sections.flatMap((s) => s.statements).map((st, i) => (
                      <tr key={i}>
                        <td>{st.refs.map((n) => `[${n}]`).join(' ')}</td>
                        <td style={{ fontSize: 11.5 }}>{st.text}</td>
                        <td className="mono" style={{ fontSize: 10.5 }}>{st.refs.map((n) => doc.citations[n - 1]?.id).join(', ')}</td>
                        <td className="mono" style={{ fontSize: 10.5 }}>{st.refs.map((n) => doc.citations[n - 1]?.version).join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Drawer>
      )}
    </>
  );
}
