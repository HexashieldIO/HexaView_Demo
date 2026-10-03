import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldHalf, Skull, KeyRound, Laptop, Globe2, Newspaper, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { supplierWatch, SUPPLIER_KIND_COLOR, type WatchedSupplier, type SupplierFindingKind, type SupplierFinding } from '../../data/modules/int';
import { Card, KpiStrip, Badge, SevBadge, Btn, KV, SectionLabel, Sources, Callout, Freshness } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { fmtAgo } from '../../lib/format';
import { FilterGroup, useParamFilter, WriteBack, RecordsDrawer } from './parts';
import './int.css';

const tone = MODULE_BY_ID.int.tone;
const KINDS: SupplierFindingKind[] = ['Leak-site mention', 'Leaked credentials', 'Infected machine', 'Lookalike domain', 'Vendor breach'];
const KIND_ICON: Record<SupplierFindingKind, ReactNode> = {
  'Leak-site mention': <Skull size={12} />, 'Leaked credentials': <KeyRound size={12} />, 'Infected machine': <Laptop size={12} />, 'Lookalike domain': <Globe2 size={12} />, 'Vendor breach': <Newspaper size={12} />,
};
const STATUS_COLOR: Record<WatchedSupplier['status'], string> = { Exposed: 'var(--bad)', Watch: 'var(--sev-medium)', Clear: 'var(--good)' };
const TIER_COLOR: Record<WatchedSupplier['tier'], string> = { Critical: 'var(--bad)', High: 'var(--sev-medium)', Medium: 'var(--text-muted)' };

export default function IntSupply() {
  const { customer: c } = useApp();
  const nav = useNavigate();
  const sups = useMemo(() => supplierWatch(c), [c]);
  const [status, setStatus] = useParamFilter('status');
  const [tier, setTier] = useParamFilter('tier');
  const [kind, setKind] = useParamFilter('kind');
  const [sel, setSel] = useState<WatchedSupplier | null>(null);
  const [ask, setAsk] = useState<WatchedSupplier | null>(null);
  const [recent, setRecent] = useState(false);

  const grc = c.connectors.find((k) => k.category === 'GRC');
  const ratings = c.connectors.find((k) => k.category === 'Ratings');
  const withF = sups.filter((s) => s.findings.length > 0);
  const creds = sups.reduce((n, s) => n + s.creds, 0);
  const allF = sups.flatMap((s) => s.findings.map((f) => ({ ...f, supplier: s })));
  const new30 = allF.filter((f) => f.daysAgo <= 30);
  const mentions = sups.reduce((n, s) => n + s.mentions, 0);
  const machines = sups.reduce((n, s) => n + s.machines, 0);

  const rows = sups
    .filter((s) => status === 'All' || s.status === status)
    .filter((s) => tier === 'All' || s.tier === tier)
    .filter((s) => kind === 'All' || s.findings.some((f) => f.kind === kind));

  const countOf = (s: WatchedSupplier, k: SupplierFindingKind) => s.findings.filter((f) => f.kind === k).reduce((n, f) => n + (k === 'Leaked credentials' ? f.count : 1), 0);

  return (
    <>
      <p className="page-intro">
        <b>{c.short}</b>&rsquo;s suppliers, watched from the outside by HexaInt. We flag when a supplier&rsquo;s credentials leak, a supplier machine is infected, they appear in a breach or ransomware post, or a lookalike of their domain shows up: signals you cannot get by scanning your own estate. Contracts and assessments live in the {grc ? `${grc.product}` : 'GRC'} vendor register.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Suppliers', hint: 'monitored', value: sups.length, unit: `watched · ${withF.length} with findings · ${sups.length - withF.length} clear`, to: '/int/supply', source: 'HexaInt supplier exposure monitoring' },
          { label: 'Credentials', hint: 'leaked', value: creds, unit: 'exposed', toneColor: 'var(--bad)', to: `/int/supply?kind=${encodeURIComponent('Leaked credentials')}`, source: 'HexaInt stealer-log + combolist collection' },
          { label: 'Findings', hint: 'new', value: new30.length, unit: 'in 30 days', toneColor: 'var(--sev-medium)', onClick: () => setRecent(true), source: 'HexaInt supplier monitoring' },
          { label: 'Mentions', hint: 'breach · ransomware', value: mentions, unit: 'posts', toneColor: 'var(--sev-high)', to: `/int/supply?kind=${encodeURIComponent('Leak-site mention')}`, source: 'HexaInt leak-site monitoring · public disclosures' },
          { label: 'Infections', hint: 'supplier machines', value: machines, unit: 'seen', toneColor: 'var(--sev-high)', to: `/int/supply?kind=${encodeURIComponent('Infected machine')}`, source: 'HexaInt infostealer logs' },
          { label: 'Critical tier', hint: 'exposed', value: sups.filter((s) => s.tier === 'Critical' && s.status === 'Exposed').length, unit: 'suppliers', toneColor: 'var(--bad)', to: '/int/supply?status=Exposed&tier=Critical', source: grc ? `${grc.product} tiering` : 'Vendor tiering' },
        ]}
      />

      <div className="grid g-3-2">
        <Card title="Exposure matrix" sub="Supplier × signal · click a supplier to open its findings" actions={<Freshness minutes={sups[0]?.lastCheckedMin ?? 30} label="last check" />}>
          <div className="heat" style={{ gridTemplateColumns: `minmax(150px, 1.4fr) repeat(${KINDS.length}, minmax(0, 1fr))` }}>
            <div />
            {KINDS.map((k) => (
              <button key={k} type="button" className="heat-axis" style={{ justifyItems: 'center', textAlign: 'center', background: 'none', border: 0, cursor: 'pointer', fontSize: 10.5, color: kind === k ? 'var(--m-int)' : undefined }} onClick={() => setKind(kind === k ? 'All' : k)} title={`Filter suppliers with: ${k}`}>
                <span style={{ color: SUPPLIER_KIND_COLOR[k] }}>{KIND_ICON[k]}</span>
                {k}
              </button>
            ))}
            {sups.map((s) => (
              <div key={s.id} style={{ display: 'contents' }}>
                <button type="button" className="heat-axis" style={{ background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', padding: '0 4px' }} onClick={() => setSel(s)}>
                  <b style={{ color: 'var(--text-primary)', fontSize: 12 }}>{s.name}</b>
                  <span style={{ fontSize: 10 }}>{s.tier} tier · {s.status}</span>
                </button>
                {KINDS.map((k) => {
                  const n = countOf(s, k);
                  return (
                    <button
                      key={k}
                      type="button"
                      className="heat-cell"
                      onClick={() => setSel(s)}
                      style={{ background: n ? `color-mix(in srgb, ${SUPPLIER_KIND_COLOR[k]} ${Math.min(70, 22 + n * 6)}%, transparent)` : 'var(--track)', cursor: 'pointer', color: n ? 'var(--text-primary)' : 'var(--text-muted)' }}
                      title={`${s.name}: ${n} × ${k}`}
                    >
                      {n || '·'}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Latest supplier signals" count={new30.length} sub="Last 30 days · newest first">
          <div className="list" style={{ maxHeight: 420, overflowY: 'auto' }}>
            {[...allF].sort((a, b) => a.daysAgo - b.daysAgo).slice(0, 9).map((f, i) => (
              <button key={i} className="list-row" style={{ cursor: 'pointer', alignItems: 'flex-start' }} onClick={() => setSel(f.supplier)}>
                <span className="int-ico" style={{ '--m-int': SUPPLIER_KIND_COLOR[f.kind], color: SUPPLIER_KIND_COLOR[f.kind], background: `color-mix(in srgb, ${SUPPLIER_KIND_COLOR[f.kind]} 14%, transparent)` } as CSSProperties}>{KIND_ICON[f.kind]}</span>
                <span className="list-main">
                  <b style={{ whiteSpace: 'normal' }}>{f.supplier.name}: {f.title}</b>
                  <span>{f.kind} · {f.source} · {f.daysAgo}d ago</span>
                </span>
                <SevBadge sev={f.sev} />
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="int-filters">
        <FilterGroup label="Status" value={status} options={['Exposed', 'Watch', 'Clear']} onChange={setStatus} />
        <FilterGroup label="Tier" value={tier} options={['Critical', 'High', 'Medium']} onChange={setTier} />
        {kind !== 'All' && <button type="button" className="int-fchip on" onClick={() => setKind('All')}>Signal: {kind} ×</button>}
      </div>

      <Card title="Suppliers on the watchlist" count={`${rows.length} of ${sups.length}`} sub="Click a supplier for its exposure findings" flush>
        <DataTable
          rows={rows}
          rowKey={(s) => s.id}
          onRowClick={setSel}
          search={(s) => `${s.name} ${s.domain} ${s.service}`}
          searchPlaceholder="Search supplier or domain…"
          columns={[
            { key: 'name', header: 'Supplier', sort: (s) => s.name, render: (s) => (<div className="int-cell"><span className="int-ico"><ShieldHalf /></span><span><div className="t-main">{s.name}</div><div className="t-sub mono">{s.domain}</div></span></div>) },
            { key: 'svc', header: 'Service', sort: (s) => s.service, render: (s) => (<><div>{s.service}</div><div className="t-sub">{s.access}</div></>) },
            { key: 'tier', header: 'Tier', sort: (s) => ['Critical', 'High', 'Medium'].indexOf(s.tier), render: (s) => <Badge color={TIER_COLOR[s.tier]}>{s.tier}</Badge> },
            {
              key: 'f', header: 'Findings', sort: (s) => s.findings.length, render: (s) => s.findings.length ? (
                <span className="row wrap" style={{ gap: 4 }}>
                  {KINDS.filter((k) => countOf(s, k)).map((k) => (
                    <span key={k} className="int-fcount" title={k} style={{ color: SUPPLIER_KIND_COLOR[k], background: `color-mix(in srgb, ${SUPPLIER_KIND_COLOR[k]} 14%, transparent)` }}>{KIND_ICON[k]} {countOf(s, k)}</span>
                  ))}
                </span>
              ) : <span style={{ color: 'var(--good)', fontSize: 12 }}><CheckCircle2 size={12} style={{ verticalAlign: -2 }} /> No findings</span>,
            },
            { key: 'st', header: 'Status', sort: (s) => s.status, render: (s) => <Badge color={STATUS_COLOR[s.status]}>{s.status}</Badge> },
            { key: 'chk', header: 'Last checked', align: 'right', sort: (s) => s.lastCheckedMin, render: (s) => <span className="muted">{fmtAgo(s.lastCheckedMin)}</span> },
          ]}
        />
      </Card>

      {sel && (
        <Drawer
          wide
          title={sel.name}
          sub={`${sel.id} · ${sel.domain}`}
          icon={<span className="int-ico"><ShieldHalf /></span>}
          onClose={() => setSel(null)}
          footer={<>
            <span className="muted" style={{ fontSize: 11, marginRight: 'auto' }}>Sourced from supplier exposure monitoring · read-only view</span>
            <Btn ghost onClick={() => setSel(null)}>Close</Btn>
            {sel.findings.length > 0 && <Btn primary color={tone} onClick={() => { setAsk(sel); setSel(null); }}>Ask supplier to confirm scope</Btn>}
          </>}
        >
          <div className="chips" style={{ marginBottom: 10 }}>
            <Badge color={STATUS_COLOR[sel.status]}>{sel.status}</Badge>
            <Badge color={TIER_COLOR[sel.tier]}>{sel.tier} tier</Badge>
          </div>
          <SectionLabel>Supplier</SectionLabel>
          <KV
            rows={[
              ['Domain', <span className="mono">{sel.domain}</span>],
              ['Service', sel.service],
              ['What they hold or reach', sel.access],
              ['Criticality tier', sel.tier],
              ['Monitored since', `${sel.monitoredSinceDays} days`],
              ['Last checked', fmtAgo(sel.lastCheckedMin)],
            ]}
          />
          <SectionLabel>Exposure findings ({sel.findings.length})</SectionLabel>
          {sel.findings.length === 0 && <Callout kind="good">Nothing found on this supplier at the last check. Still monitored.</Callout>}
          <div className="list">
            {sel.findings.map((f: SupplierFinding, i) => (
              <div key={i} className="list-row" style={{ alignItems: 'flex-start' }}>
                <span className="int-ico" style={{ color: SUPPLIER_KIND_COLOR[f.kind], background: `color-mix(in srgb, ${SUPPLIER_KIND_COLOR[f.kind]} 14%, transparent)` }}>{KIND_ICON[f.kind]}</span>
                <span className="list-main">
                  <b style={{ whiteSpace: 'normal' }}>{f.title}</b>
                  <span style={{ whiteSpace: 'normal', fontSize: 12, color: 'var(--text-secondary)' }}>{f.body}</span>
                  <span>{f.kind} · {f.source} · {f.daysAgo} days ago</span>
                </span>
                <SevBadge sev={f.sev} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Callout color={tone}>
              <b>Governance for this supplier.</b> This is the external intelligence view. Contracts, assessments and controls for {sel.name} live in the vendor register.{' '}
              <button className="link" onClick={() => nav('/comply/tprm')}>Open Third-Party Risk →</button>
            </Callout>
          </div>
          <SectionLabel>Sources</SectionLabel>
          <Sources items={[{ name: 'HexaInt supplier monitoring' }, ...(ratings ? [{ name: `${ratings.vendor} ratings`, status: ratings.status }] : []), ...(grc ? [{ name: grc.product }] : [])]} />
        </Drawer>
      )}

      {recent && (
        <RecordsDrawer
          title="New supplier findings (30 days)"
          rows={new30}
          source={['HexaInt supplier exposure monitoring']}
          onClose={() => setRecent(false)}
          onRow={(f) => { setRecent(false); setSel(f.supplier); }}
          columns={[
            { key: 's', header: 'Supplier', sort: (f) => f.supplier.name, render: (f) => <b>{f.supplier.name}</b> },
            { key: 't', header: 'Finding', render: (f) => (<><div className="t-main">{f.title}</div><div className="t-sub">{f.kind}</div></>) },
            { key: 'v', header: 'Severity', render: (f) => <SevBadge sev={f.sev} /> },
            { key: 'd', header: 'Found', align: 'right', sort: (f) => f.daysAgo, render: (f) => `${f.daysAgo}d ago` },
          ]}
        />
      )}

      {ask && (
        <WriteBack
          title="Ask supplier to confirm scope"
          sub={ask.name}
          risk="low"
          approvers={1}
          confirmLabel="Send request"
          onDone={`Scope-confirmation request sent to ${ask.name} via ${grc ? grc.product : 'the vendor register'}; due in 5 working days.`}
          onClose={() => setAsk(null)}
          change={[
            ['Supplier', `${ask.name} (${ask.domain})`],
            ['Findings shared', ask.findings.map((f) => f.kind).join(', ')],
            ['Request', 'Confirm affected systems, reset leaked accounts, reimage infected machines'],
            ['Channel', grc ? `${grc.product} vendor questionnaire` : 'Vendor questionnaire'],
            ['Due', '5 working days; overdue escalates to the contract owner'],
          ]}
        />
      )}
    </>
  );
}
