import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RingLegend, SegRows, RecordsDrawer, scrollToId } from './viz';
import { FileSignature, Share2, Link2, ShieldCheck } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { evidencePack, keyControls, packDigest, type PackItem, type AnswerStatus, type Confidence, type KeyControl } from '../../data/modules/insurance';
import { Card, KpiStrip, Badge, Btn, Callout, KV, Chip, SectionLabel, Timeline } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer, Modal } from '../../components/Overlay';
import { fmtAgo, fmtDate, fmtDateTime, daysAgo, daysAhead, ago } from '../../lib/format';
import { rng } from '../../lib/rng';
import { ControlDrawer, Intro, SourceLine, TenantNote, INS_TONE } from './parts';

const STATUS_COLOR: Record<AnswerStatus, string> = { answered: 'var(--good)', partial: 'var(--sev-medium)', gap: 'var(--bad)' };
const STATUS_LABEL: Record<AnswerStatus, string> = { answered: 'Attested', partial: 'Partial', gap: 'Gap' };
const CONF_COLOR: Record<Confidence, string> = { high: 'var(--good)', medium: 'var(--sev-medium)', low: 'var(--bad)' };
type Filter = 'all' | 'gaps' | 'low';

export default function InsurancePack() {
  const { customer: c, toast } = useApp();
  const pack = useMemo(() => evidencePack(c), [c]);
  const ctl = useMemo(() => keyControls(c), [c]);
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<Filter>(() => (params.get('filter') === 'gaps' ? 'gaps' : params.get('filter') === 'low' ? 'low' : 'all'));
  const [srcOpen, setSrcOpen] = useState(false);
  const pick = (f: Filter, s = 'all') => { setFilter(f); setSection(s); scrollToId('ins-questionnaire'); };
  const [section, setSection] = useState<string>('all');
  const [open, setOpen] = useState<PackItem | null>(null);
  const [ctlOpen, setCtlOpen] = useState<KeyControl | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [expiry, setExpiry] = useState(14);
  const [watermark, setWatermark] = useState(true);
  const [includeGaps, setIncludeGaps] = useState(true);
  const [version, setVersion] = useState(7);

  const sections = Array.from(new Set(pack.map((p) => p.section)));
  const rows = pack.filter((p) => (filter === 'all' || (filter === 'gaps' ? p.status !== 'answered' : p.confidence === 'low')) && (section === 'all' || p.section === section));
  const answered = pack.filter((p) => p.status === 'answered').length;
  const partial = pack.filter((p) => p.status === 'partial').length;
  const gaps = pack.filter((p) => p.status === 'gap').length;
  const high = pack.filter((p) => p.confidence === 'high').length;
  const oldest = pack.reduce((m, p) => Math.max(m, p.refreshedMin), 0);
  const digest = packDigest(c, version);
  const contact = ({ maritime: 'Account executive, Marsh Marine & Energy', finserv: 'Client director, Aon Financial Services', media: 'Account executive, WTW Media & Entertainment', healthcare: 'Client executive, Gallagher Healthcare', automotive: 'Client director, Aon Automotive' } as Record<string, string>)[c.id];
  const allSources = [...new Map(pack.flatMap((p) => p.sources).map((s) => [s.name, s])).values()];
  const srcNames = allSources.map((s) => s.name).slice(0, 5).join(' · ');
  const token = rng(`ins-share-${c.id}-${version}-${expiry}`).hex(22);
  const link = `https://view.hexashield.io/share/${token}`;

  const versions = [
    { v: version, when: ago(14), by: 'HexaView (scheduled)', note: `${answered} attested, ${partial + gaps} open` },
    { v: version - 1, when: daysAgo(30), by: c.people.grcLead.name, note: 'Monthly refresh shared with broker' },
    { v: version - 2, when: daysAgo(61), by: c.people.grcLead.name, note: 'Mid-term review' },
    { v: version - 3, when: daysAgo(365 - c.insurance.renewalDays + 20), by: c.people.ciso.name, note: 'Last renewal submission' },
  ];

  return (
    <>
      <Intro ids={c.connectors.filter((k) => ['Identity', 'EDR / XDR', 'Backup', 'Vulnerability', 'Email'].includes(k.category)).slice(0, 5).map((k) => k.id)}>
        The standard underwriting questionnaire, answered from live data with the evidence, source and freshness behind every answer, ready to sign and share with {c.insurance.broker}.
      </Intro>
      <TenantNote />

      <KpiStrip
        toneColor={INS_TONE}
        items={[
          { label: 'Underwriting questions', value: pack.length, delta: { text: '100% auto-answered', good: true }, onClick: () => pick('all'), source: srcNames },
          { label: 'Attested answers', value: answered, unit: `of ${pack.length}`, bar: (answered / pack.length) * 100, onClick: () => pick('all'), source: srcNames },
          { label: 'Partial', value: partial, delta: { text: 'Answered with caveats', good: partial === 0 }, onClick: () => pick('gaps'), source: srcNames },
          { label: 'Gaps', value: gaps, delta: { text: gaps ? 'Will be asked about' : 'None', good: gaps === 0 }, onClick: () => pick('gaps'), source: srcNames },
          { label: 'High confidence', value: `${Math.round((high / pack.length) * 100)}%`, onClick: () => pick('low'), delta: { text: `${pack.length - high} medium or low`, good: high / pack.length > 0.8 }, source: 'Connector health × control test results' },
          { label: 'Oldest evidence', value: fmtAgo(oldest).replace(' ago', ''), delta: { text: oldest > 1440 * 7 ? 'Refresh before submission' : 'Fresh', good: oldest <= 1440 * 7 }, onClick: () => setSrcOpen(true), source: 'Connector last-sync times' },
        ]}
      />

      <div className="grid g-2-1">
        <Card
          title={<span id="ins-questionnaire">Questionnaire</span>}
          count={rows.length}
          sub="Click an answer for its evidence, sources and the control behind it"
          flush
          actions={
            <div className="chips">
              <Chip on={filter === 'all'} onClick={() => setFilter('all')} color={INS_TONE}>All</Chip>
              <Chip on={filter === 'gaps'} onClick={() => setFilter('gaps')} color={INS_TONE}>Gaps and partial ({partial + gaps})</Chip>
              <Chip on={filter === 'low'} onClick={() => setFilter('low')} color={INS_TONE}>Low confidence</Chip>
            </div>
          }
        >
          <div className="chips" style={{ padding: '0 18px 10px' }}>
            <Chip on={section === 'all'} onClick={() => setSection('all')}>All sections</Chip>
            {sections.map((s) => (
              <Chip key={s} on={section === s} onClick={() => setSection(s)}>{s}</Chip>
            ))}
          </div>
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={setOpen}
            pageSize={14}
            search={(r) => `${r.q} ${r.a} ${r.section}`}
            searchPlaceholder="Search questions and answers…"
            columns={[
              { key: 'q', header: 'Question', sort: (r) => r.id, render: (r) => (<><div className="t-main" style={{ whiteSpace: 'normal' }}>{r.q}</div><div className="t-sub">{r.id} · {r.section}</div></>) },
              { key: 'a', header: 'Answer (live)', render: (r) => <div style={{ fontSize: 12, maxWidth: 380, whiteSpace: 'normal' }}>{r.a}</div> },
              { key: 'status', header: 'Status', sort: (r) => r.status, render: (r) => <Badge color={STATUS_COLOR[r.status]} dot>{STATUS_LABEL[r.status]}</Badge> },
              { key: 'conf', header: 'Confidence', sort: (r) => ['low', 'medium', 'high'].indexOf(r.confidence), render: (r) => <Badge color={CONF_COLOR[r.confidence]}>{r.confidence}</Badge> },
              { key: 'src', header: 'Evidence', render: (r) => <SourceLine sources={r.sources} compact /> },
              { key: 'fresh', header: 'Refreshed', align: 'right', sort: (r) => r.refreshedMin, render: (r) => <span className="t-sub" style={{ color: r.sources.some((s) => s.stale) ? 'var(--warn)' : undefined }}>{fmtAgo(r.refreshedMin)}</span> },
            ]}
          />
        </Card>

        <div className="stack" style={{ gap: 16 }}>
          <Card title={<><FileSignature size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Signed pack</>} sub={`Version ${version} · generated ${fmtAgo(14)}`} toneColor={INS_TONE} tinted>
            <RingLegend
              value={answered}
              max={pack.length}
              color={INS_TONE}
              center={`${Math.round((answered / pack.length) * 100)}%`}
              centerSub={`${answered}/${pack.length}`}
              size={112}
              rows={[
                { label: 'Attested', value: answered, color: STATUS_COLOR.answered, onClick: () => pick('all') },
                { label: 'Partial', value: partial, color: STATUS_COLOR.partial, onClick: () => pick('gaps') },
                { label: 'Gap', value: gaps, color: STATUS_COLOR.gap, onClick: () => pick('gaps') },
                { label: 'Low confidence', value: pack.filter((p) => p.confidence === 'low').length, color: 'var(--text-muted)', onClick: () => pick('low') },
              ]}
            />
            <div className="stack" style={{ marginTop: 12, gap: 8 }}>
              <Btn primary color={INS_TONE} onClick={() => setExportOpen(true)}><FileSignature size={14} /> Export signed pack</Btn>
              <Btn onClick={() => setShareOpen(true)}><Share2 size={14} /> Share with broker</Btn>
            </div>
          </Card>

          <Card title="By section" sub="Attested answers per questionnaire section">
            <SegRows
              legend
              labelWidth={130}
              rows={sections.map((sec) => ({
                label: sec,
                onClick: () => pick('all', sec),
                parts: (['answered', 'partial', 'gap'] as AnswerStatus[]).map((s) => ({ label: STATUS_LABEL[s], value: pack.filter((p) => p.section === sec && p.status === s).length, color: s === 'answered' ? '#2ec4a8' : s === 'partial' ? '#f0a338' : '#e0345e' })),
              }))}
            />
          </Card>

          <Card title="Pack history" sub="Every version is signed and kept in the audit ledger">
            <Timeline items={versions.map((v, i) => ({ time: fmtDate(v.when), title: `v${v.v}${i === 0 ? ' (current)' : ''}`, body: `${v.by} · ${v.note}`, color: i === 0 ? INS_TONE : 'var(--text-muted)' }))} />
          </Card>
        </div>
      </div>

      {open && (
        <Drawer
          title={open.q}
          sub={`${open.id} · ${open.section}`}
          onClose={() => setOpen(null)}
          footer={
            <>
              {open.controlId && <Btn onClick={() => { const k = ctl.find((x) => x.id === open.controlId); setOpen(null); if (k) setCtlOpen(k); }}>Open control</Btn>}
              {open.status !== 'answered' && <Btn primary color={INS_TONE} onClick={() => { toast(`Evidence request sent to ${c.people.grcLead.name} for ${open.id}`); setOpen(null); }}>Request evidence from owner</Btn>}
            </>
          }
        >
          <div className="row" style={{ marginBottom: 12, gap: 8 }}>
            <Badge color={STATUS_COLOR[open.status]} dot>{STATUS_LABEL[open.status]}</Badge>
            <Badge color={CONF_COLOR[open.confidence]}>{open.confidence} confidence</Badge>
          </div>
          <SectionLabel>Answer sent to the insurer</SectionLabel>
          <div className="ins-metric" style={{ fontSize: 13.5, fontWeight: 500 }}>{open.a}</div>
          <SectionLabel><span style={{ display: 'block', marginTop: 14 }}>Evidence</span></SectionLabel>
          <KV
            rows={[
              ['Evidence reference', <span className="mono">{open.evidenceRef}</span>],
              ['Captured', fmtDateTime(ago(open.refreshedMin))],
              ['Method', open.sources.length ? 'Connector snapshot, normalised in HexaCore and hashed into the ledger' : 'Manual upload'],
              ['Confidence basis', open.confidence === 'high' ? 'All sources healthy and fresh; control test passed' : open.confidence === 'medium' ? 'Source degraded or control only partly met' : 'Source stale, paused or manual; insurer will likely ask for more'],
            ]}
          />
          <SectionLabel><span style={{ display: 'block', marginTop: 14 }}>Sources</span></SectionLabel>
          <SourceLine sources={open.sources} />
          {open.status !== 'answered' && <div style={{ marginTop: 12 }}><Callout kind="warn">This answer will be read as a gap. Fix it before submission, or attach a compensating-control statement.</Callout></div>}
        </Drawer>
      )}

      {ctlOpen && <ControlDrawer control={ctlOpen} onClose={() => setCtlOpen(null)} />}
      {srcOpen && (
        <RecordsDrawer title="Evidence freshness by source" sub="Every connector behind the pack, oldest first" sources={allSources.map((s) => ({ name: s.name, status: s.stale && s.status === 'healthy' ? 'degraded' : s.status }))} onClose={() => setSrcOpen(false)}
          rows={allSources.slice().sort((a, b) => b.lastSyncMin - a.lastSyncMin).map((s) => ({ key: s.id, title: s.name, sub: `${pack.filter((p) => p.sources.some((x) => x.id === s.id)).length} answers depend on it · ${s.status}${s.stale ? ' · stale' : ''}`, right: fmtAgo(s.lastSyncMin) }))} />
      )}

      {exportOpen && (
        <Modal
          title="Export signed evidence pack"
          sub={`Version ${version + 1} will be generated from live data now`}
          onClose={() => setExportOpen(false)}
          footer={
            <>
              <Btn ghost onClick={() => setExportOpen(false)}>Cancel</Btn>
              <Btn primary color={INS_TONE} onClick={() => { setExportOpen(false); setVersion((v) => v + 1); toast(`Signed pack v${version + 1} exported (PDF + JSON). SHA-256 ${packDigest(c, version + 1).slice(0, 12)}…`); }}>
                <ShieldCheck size={14} /> Sign and export
              </Btn>
            </>
          }
        >
          <KV
            rows={[
              ['Contents', `${pack.length} answers, ${pack.filter((p) => p.sources.length).length} with connector evidence, control attestation, loss quantification summary`],
              ['Formats', 'PDF (insurer layout) + JSON (machine-readable, schema v2)'],
              ['Signed by', `HexaView signing key (Ed25519) for ${c.name}; countersigned by ${c.people.ciso.name}`],
              ['Ledger anchor', 'Hash anchored to the audit ledger on export'],
              ['Open items', includeGaps ? `${partial + gaps} partial or gap answers disclosed with remediation dates` : 'Gaps omitted (not recommended: misrepresentation risk)'],
            ]}
          />
          <label className="ins-check" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={includeGaps} onChange={() => setIncludeGaps(!includeGaps)} />
            <span>Disclose gaps with remediation plans (recommended, avoids non-disclosure disputes at claim time)</span>
          </label>
          <SectionLabel><span style={{ display: 'block', marginTop: 12 }}>Current pack SHA-256</span></SectionLabel>
          <div className="ins-hash">{digest}</div>
        </Modal>
      )}

      {shareOpen && (
        <Modal
          title="Share with broker"
          sub={`${c.insurance.broker} · ${contact}`}
          onClose={() => setShareOpen(false)}
          footer={
            <>
              <Btn ghost onClick={() => setShareOpen(false)}>Cancel</Btn>
              <Btn primary color={INS_TONE} onClick={() => { setShareOpen(false); toast(`Secure link shared with ${c.insurance.broker}; expires ${fmtDate(daysAhead(expiry))}`); }}>
                <Link2 size={14} /> Create link
              </Btn>
            </>
          }
        >
          <KV
            rows={[
              ['Recipient', `${contact} (verified domain)`],
              ['Pack', `v${version} · SHA-256 ${digest.slice(0, 16)}…`],
              ['Access', 'View and download; every view logged to the audit ledger'],
              ['Risk class', <Badge color="var(--sev-medium)">Medium (LLD 8.2): external sharing</Badge>],
              ['Approval', `${c.people.ciso.name} (auto-approved for the named broker)`],
            ]}
          />
          <div className="row wrap" style={{ marginTop: 12, gap: 8 }}>
            <span className="muted" style={{ fontSize: 12 }}>Link expires in</span>
            {[7, 14, 30].map((d) => (
              <Chip key={d} on={expiry === d} onClick={() => setExpiry(d)} color={INS_TONE}>{d} days</Chip>
            ))}
          </div>
          <label className="ins-check" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={watermark} onChange={() => setWatermark(!watermark)} />
            <span>Watermark downloads with recipient and timestamp</span>
          </label>
          <div className="ins-hash" style={{ marginTop: 8 }}>{link}</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>Expires {fmtDate(daysAhead(expiry))}{watermark ? ' · watermarked' : ''}</div>
        </Modal>
      )}
    </>
  );
}
