import { useMemo, useState } from 'react';
import { FileLock2, HardDrive, Lock, Microscope, ShieldCheck } from 'lucide-react';
import { Card, KpiStrip, Badge, StatusBadge, KV, Timeline, Btn, Chip, IcoBox, Ring, Bar, Callout } from '../../components/ui';
import { Chart, PALETTE } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { forensicCases, fmtBytes, type Evidence, type ForensicCase } from '../../data/modules/soc';
import { fmtAgo, fmtNum } from '../../lib/format';
import { useSoc, tenantShort, WriteBackModal, RecordsDrawer, type WriteBack } from './parts';

const CASE_STATUS: Record<string, string> = { acquisition: 'var(--sev-high)', analysis: 'var(--m-soc)', reporting: 'var(--accent)', closed: 'var(--good)' };

export default function SocForensics() {
  const { c, tenantId, tone, scopeLabel, tools, days, timeRange } = useSoc();
  const cases = useMemo(() => forensicCases(c, tenantId), [c, tenantId]);
  const evidence = cases.flatMap((x) => x.evidence);
  const [caseId, setCaseId] = useState<string>('all');
  const [tlCase, setTlCase] = useState(0);
  const [selCase, setSelCase] = useState<ForensicCase | null>(null);
  const [selEv, setSelEv] = useState<Evidence | null>(null);
  const [wb, setWb] = useState<WriteBack | null>(null);
  const [panel, setPanel] = useState<'cases' | 'evidence' | 'bytes' | 'hash' | 'holds' | 'sla' | null>(null);
  const vaultSrc = `HexaSOC evidence vault · ${tools.edrShort} live response`;
  const itsm = c.connectors.find((k) => k.category === 'ITSM');

  const activeCases = cases.filter((x) => x.status !== 'closed');
  const bytes = evidence.reduce((n, e) => n + e.size, 0);
  const holds = cases.filter((x) => x.legalHold).length;
  const evRows = caseId === 'all' ? evidence : evidence.filter((e) => e.caseId === caseId);
  const tc = cases[Math.min(tlCase, cases.length - 1)];
  const tlSources = tc ? Array.from(new Set(tc.timeline.map((p) => p.source))) : [];
  const region = c.residency.split(' ·')[0];

  return (
    <>
      <p className="page-intro">
        <b>{scopeLabel}</b> · evidence-grade acquisition and analysis by HexaSOC DFIR, collected through {tools.edrShort}, {tools.idpShort} and cloud APIs
        {c.id === 'maritime' ? ', plus VDR and ECDIS extracts from vessels' : ''}. Every item is hashed at source and sealed in an immutable vault in {region}.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Active cases', value: activeCases.length, hint: `${cases.length} in 90 days`, onClick: () => setPanel('cases'), source: 'HexaSOC DFIR case management' },
          { label: 'Evidence items', value: evidence.length, hint: `${evidence.filter((e) => e.collectedMin <= days * 1440).length} collected ${timeRange === '24h' ? 'today' : `in ${timeRange}`}`, onClick: () => setPanel('evidence'), source: vaultSrc },
          { label: 'Data preserved', value: fmtBytes(bytes), onClick: () => setPanel('bytes'), source: vaultSrc },
          { label: 'Hash verified', value: '100', unit: '%', bar: 100, delta: { text: 'SHA-256 at source and in vault', good: true }, onClick: () => setPanel('hash'), source: vaultSrc },
          { label: 'Legal holds', value: holds, onClick: () => setPanel('holds'), source: 'HexaSOC evidence vault · legal hold register' },
          { label: 'Triage image SLA', value: '2.6', unit: 'h', hint: 'target 4 h', bar: 65, onClick: () => setPanel('sla'), source: 'HexaSOC DFIR case management' },
        ]}
      />

      <div className="grid g-2-1">
        <Card title="Forensic cases" count={cases.length} sub="Linked to HexaSOC incidents · click for the case file" flush>
          <DataTable
            rows={cases}
            rowKey={(r) => r.id}
            onRowClick={setSelCase}
            pageSize={8}
            columns={[
              { key: 'id', header: 'Case', render: (r) => (<><div className="mono t-main">{r.id}</div><div className="t-sub mono">{r.incident}</div></>) },
              { key: 'title', header: 'Matter', sort: (r) => r.title, render: (r) => (<><div className="t-main" style={{ whiteSpace: 'normal', maxWidth: 340 }}>{r.title}</div><div className="t-sub">{tenantShort(c, r.tenantId)} · lead {r.lead}</div></>) },
              { key: 'status', header: 'Stage', sort: (r) => r.status, render: (r) => <StatusBadge value={r.status} map={CASE_STATUS} /> },
              { key: 'prog', header: 'Analysis', sort: (r) => r.progress, render: (r) => (<div style={{ minWidth: 100 }}><Bar value={r.progress} color={CASE_STATUS[r.status]} size="thin" /><span className="t-sub">{r.progress}% · {r.evidence.length} items</span></div>) },
              { key: 'hold', header: 'Hold', render: (r) => (r.legalHold ? <Badge color="var(--sev-medium)">Legal hold</Badge> : <span className="muted">—</span>) },
              { key: 'opened', header: 'Opened', align: 'right', sort: (r) => r.openedDaysAgo, render: (r) => `${r.openedDaysAgo} d ago` },
            ]}
          />
        </Card>
        <Card title={<><Lock size={15} style={{ verticalAlign: -2 }} /> Immutable evidence vault</>} sub="Write once, read many · chain of custody on every access" toneColor={tone} tinted>
          <div className="row" style={{ gap: 16 }}>
            <Ring value={100} size={84} stroke={8} color="var(--good)" sub="verified">{evidence.length}</Ring>
            <KV rows={[
              ['Storage', 'Object lock, compliance mode'],
              ['Region', region],
              ['Encryption', c.byok ? 'Customer-managed key (BYOK)' : 'Per-tenant key, HexaShield-managed'],
              ['Retention', '7 years or legal hold'],
            ]} />
          </div>
          <div className="soc-vault" style={{ marginTop: 14 }}>
            <ShieldCheck size={22} color="var(--good)" />
            <span>Last integrity sweep {fmtAgo(37)}: {evidence.length} of {evidence.length} hashes re-verified, no deletions or modifications attempted.</span>
          </div>
          <div className="section-label" style={{ marginTop: 14 }}>Evidence by type</div>
          <Chart
            height={150}
            option={{
              tooltip: { trigger: 'item', formatter: '{b}: {c}' },
              series: [{ type: 'pie', radius: ['45%', '75%'], label: { show: false }, data: Object.entries(evidence.reduce<Record<string, number>>((m, e) => ({ ...m, [e.type]: (m[e.type] ?? 0) + 1 }), {})).map(([name, value]) => ({ name, value })) }],
            }}
          />
        </Card>
      </div>

      <Card
        title="Super-timeline"
        sub={tc ? `${tc.id} · ${tc.title} · artefacts by source, hours relative to detection (0)` : 'No case selected'}
        actions={
          <span className="chips">
            {cases.slice(0, 5).map((x, i) => (
              <Chip key={x.id} on={i === tlCase} onClick={() => setTlCase(i)} color={tone}>{x.id}</Chip>
            ))}
          </span>
        }
      >
        {tc && (
          <Chart
            height={280}
            option={{
              grid: { left: 4, right: 16, top: 12, bottom: 24, containLabel: true },
              tooltip: { trigger: 'item', formatter: (p: unknown) => { const v = (p as { data: [number, string, number, string] }).data; return `${v[1]}<br/>${v[3]} · ${v[2]} events<br/>T${v[0] >= 0 ? '+' : ''}${v[0]} h`; } },
              xAxis: { type: 'value', name: 'hours', nameLocation: 'middle', nameGap: 22, min: -72, max: 8 },
              yAxis: { type: 'category', data: tlSources },
              series: [
                {
                  type: 'scatter',
                  data: tc.timeline.map((p) => [p.hour, p.source, p.count, p.label]),
                  symbolSize: (v: number[]) => Math.max(6, Math.sqrt(v[2]) * 2.2),
                  itemStyle: { color: (p: { dataIndex: number }) => PALETTE[tlSources.indexOf(tc.timeline[p.dataIndex].source) % PALETTE.length], opacity: 0.75 },
                  markLine: { symbol: 'none', lineStyle: { color: '#e0345e', type: 'dashed' }, label: { formatter: 'Detection', color: '#e0345e', fontSize: 10 }, data: [{ xAxis: 0 }] },
                },
              ],
            }}
          />
        )}
      </Card>

      <Card
        title="Evidence register"
        count={evRows.length}
        sub="SHA-256 computed at source and on receipt · click an item for its chain of custody"
        flush
        actions={
          <select className="select" value={caseId} onChange={(e) => setCaseId(e.target.value)} aria-label="Filter by case">
            <option value="all">All cases</option>
            {cases.map((x) => <option key={x.id} value={x.id}>{x.id}</option>)}
          </select>
        }
      >
        <DataTable
          rows={evRows}
          rowKey={(r) => r.id}
          onRowClick={setSelEv}
          search={(r) => `${r.id} ${r.name} ${r.type} ${r.sha256} ${r.collectedBy}`}
          searchPlaceholder="Filter by ID, type, hash…"
          initialSort={{ key: 'sealed', dir: 'asc' }}
          columns={[
            { key: 'id', header: 'Item', render: (r) => (<><div className="mono t-main">{r.id}</div><div className="t-sub mono">{r.caseId}</div></>) },
            { key: 'type', header: 'Type', sort: (r) => r.type, render: (r) => (<><div className="t-main">{r.type}</div><div className="t-sub mono">{r.name}</div></>) },
            { key: 'hash', header: 'SHA-256', render: (r) => <span className="soc-hash" title={r.sha256}>{r.sha256.slice(0, 16)}…{r.sha256.slice(-6)}</span> },
            { key: 'size', header: 'Size', align: 'right', sort: (r) => r.size, render: (r) => fmtBytes(r.size) },
            { key: 'by', header: 'Collected by', sort: (r) => r.collectedBy, render: (r) => <span className="nowrap">{r.collectedBy}</span> },
            { key: 'sealed', header: 'Sealed', align: 'right', sort: (r) => r.sealedMin, render: (r) => <span className="nowrap">{fmtAgo(r.sealedMin)}</span> },
            { key: 'cust', header: 'Custody', align: 'right', render: (r) => <span className="nowrap"><FileLock2 size={12} style={{ verticalAlign: -2, color: 'var(--good)' }} /> {r.custody.length} steps</span> },
          ]}
        />
      </Card>

      {selCase && (
        <Drawer wide title={selCase.title} sub={`${selCase.id} · ${selCase.incident} · ${tenantShort(c, selCase.tenantId)}`} icon={<IcoBox color={tone}><Microscope /></IcoBox>} onClose={() => setSelCase(null)}
          footer={<Btn primary onClick={() => setWb({ title: 'Request evidence from owner', system: itsm ? `${itsm.vendor} ${itsm.product}` : 'ITSM', target: `${selCase.id} · ${tenantShort(c, selCase.tenantId)} asset owners`, risk: 'low', changes: [`Creates a ${itsm?.product ?? 'ITSM'} task for the asset owner to preserve and hand over additional evidence`, 'Includes collection instructions and a sealed upload link to the vault', `Due in 24 h; escalates to ${c.people.socLead.name}`], done: `Evidence request raised for ${selCase.id}` })}>Request evidence from owner</Btn>}>
          <div className="stack" style={{ gap: 18 }}>
            <KV rows={[
              ['Stage', <StatusBadge key="s" value={selCase.status} map={CASE_STATUS} />],
              ['Progress', `${selCase.progress}%`],
              ['Lead examiner', selCase.lead],
              ['Opened', `${selCase.openedDaysAgo} days ago`],
              ['Legal hold', selCase.legalHold ? `Yes (applied by ${c.people.grcLead.name})` : 'No'],
              ['Evidence', `${selCase.evidence.length} items · ${fmtBytes(selCase.evidence.reduce((n, e) => n + e.size, 0))}`],
            ]} />
            <div>
              <div className="section-label">Key questions</div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, display: 'grid', gap: 4 }}>
                {selCase.questions.map((q) => <li key={q}>{q}</li>)}
              </ol>
            </div>
            <div>
              <div className="section-label">Evidence</div>
              <div className="list">
                {selCase.evidence.map((e) => (
                  <button key={e.id} className="list-row" onClick={() => { setSelCase(null); setSelEv(e); }}>
                    <IcoBox color={tone}><HardDrive /></IcoBox>
                    <span className="list-main"><b>{e.type}</b><span className="mono">{e.id} · {fmtBytes(e.size)} · {e.sha256.slice(0, 20)}…</span></span>
                    <Badge color="var(--good)" dot>Sealed</Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {selEv && (
        <Drawer title={selEv.type} sub={`${selEv.id} · ${selEv.caseId}`} icon={<IcoBox color={tone}><FileLock2 /></IcoBox>} onClose={() => setSelEv(null)}>
          <div className="stack" style={{ gap: 18 }}>
            <KV rows={[
              ['File', <span key="f" className="mono">{selEv.name}</span>],
              ['Size', `${fmtBytes(selEv.size)} (${fmtNum(selEv.size)} bytes)`],
              ['Acquired via', selEv.source],
              ['Collected by', selEv.collectedBy],
              ['Collected', fmtAgo(selEv.collectedMin)],
              ['Sealed', fmtAgo(selEv.sealedMin)],
              ['SHA-256', <span key="h" className="soc-hash">{selEv.sha256}</span>],
              ['Integrity', <Badge key="i" color="var(--good)" dot>Verified, matches source</Badge>],
            ]} />
            <div>
              <div className="section-label">Chain of custody</div>
              <Timeline items={selEv.custody.map((s) => ({ time: fmtAgo(s.min), title: `${s.action} · ${s.actor}`, body: s.note, color: s.action.startsWith('Sealed') ? 'var(--good)' : s.action.startsWith('Legal') ? 'var(--sev-medium)' : tone }))} />
            </div>
            <Callout kind="good">Custody entries are append-only and anchored in the HexaView audit ledger; the evidence object cannot be altered or deleted while sealed.</Callout>
          </div>
        </Drawer>
      )}

      {wb && <WriteBackModal wb={wb} onClose={() => setWb(null)} />}
      {(panel === 'cases' || panel === 'holds' || panel === 'sla') && (
        <RecordsDrawer title={panel === 'cases' ? 'Active forensic cases' : panel === 'holds' ? 'Cases under legal hold' : 'Triage image turnaround'} source={panel === 'holds' ? 'HexaSOC evidence vault · legal hold register' : 'HexaSOC DFIR case management'} icon={<Microscope />} onClose={() => setPanel(null)}
          rows={(panel === 'cases' ? activeCases : panel === 'holds' ? cases.filter((x) => x.legalHold) : cases).map((x, i) => ({ id: x.id, title: x.title, sub: `${x.id} · ${tenantShort(c, x.tenantId)} · ${x.lead} · ${x.status}`, right: <span className="num" style={{ fontWeight: 700 }}>{panel === 'sla' ? `${(1.4 + ((i * 7) % 23) / 10).toFixed(1)} h` : `${x.progress}%`}</span>, onClick: () => { setPanel(null); setSelCase(x); } }))} />
      )}
      {(panel === 'evidence' || panel === 'bytes' || panel === 'hash') && (
        <RecordsDrawer title={panel === 'bytes' ? 'Data preserved, largest first' : panel === 'hash' ? 'Hash verification' : 'Evidence items'} source={vaultSrc} icon={<HardDrive />} onClose={() => setPanel(null)}
          rows={(panel === 'bytes' ? evidence.slice().sort((a, b) => b.size - a.size) : evidence).map((e) => ({ id: e.id, title: `${e.id} · ${e.type}`, sub: panel === 'hash' ? `SHA-256 ${e.sha256.slice(0, 24)}… · verified at source and in vault` : `${e.caseId} · ${e.source} · ${fmtAgo(e.collectedMin)}`, right: panel === 'hash' ? <Badge color="var(--good)">Verified</Badge> : <span className="num" style={{ fontWeight: 700 }}>{fmtBytes(e.size)}</span>, onClick: () => { setPanel(null); setSelEv(e); } }))} />
      )}
    </>
  );
}
