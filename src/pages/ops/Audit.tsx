import { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldCheck, Download, Link2, Anchor as AnchorIcon, CheckCircle2, Loader2, UserCog } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { headlines } from '../../data/core';
import { scopedTenants } from '../../data/customers';
import { auditEvents, auditTotals, anchors, supportSessions, ACTOR_COLOR, type ActorType, type AuditEvent } from '../../data/modules/ops';
import { Card, KpiStrip, Badge, StatusBadge, Btn, Callout, KV, Legend, Chip, Freshness } from '../../components/ui';
import { PALETTE } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer, Modal } from '../../components/Overlay';
import { fmtAgo, fmtNum, fmtCompact, ago, fmtDateTime } from '../../lib/format';
import { OPS_TONE, shortHash, useParamFilter, FilterChip, HBars, SegBreakdown, useRecords, scrollToId } from './parts';

const ACTOR_HEX: Record<ActorType, string> = { user: PALETTE[0], service: PALETTE[9], agent: PALETTE[2], hexashield_support: PALETTE[3] };
const ACTOR_LABEL: Record<ActorType, string> = { user: 'User', service: 'Service', agent: 'Agent', hexashield_support: 'HexaShield support' };

export default function Audit() {
  const { customer, tenantId, timeRange } = useApp();
  return <AuditInner key={`${customer.id}-${tenantId}-${timeRange}`} />;
}

function AuditInner() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const days = rangeDays(timeRange);
  const h = headlines(c, tenantId);
  const tenants = scopedTenants(c, tenantId);
  const events = useMemo(() => auditEvents(c, tenantId, days), [c, tenantId, days]);
  const totals = useMemo(() => auditTotals(c, tenantId, days), [c, tenantId, days]);
  const totals30 = useMemo(() => auditTotals(c, tenantId, 30), [c, tenantId]);
  const anc = useMemo(() => anchors(c, tenantId, events[0]?.seq ?? 0), [c, tenantId, events]);
  const sessions = useMemo(() => supportSessions(c), [c]);
  const [actorP, setActorP] = useParamFilter('actor');
  const [typeF, setTypeF] = useParamFilter('type');
  const actor = (actorP ?? 'all') as 'all' | ActorType;
  const setActor = (a: 'all' | ActorType) => setActorP(a === 'all' ? null : a);
  const [, openRecords, recordsNode] = useRecords();
  const [sel, setSel] = useState<AuditEvent | null>(null);
  const [exporting, setExporting] = useState(false);
  const [verify, setVerify] = useState<{ step: number; done: boolean } | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const total = totals.reduce((s, t) => s + t.count, 0);
  const total30 = totals30.reduce((s, t) => s + t.count, 0);
  const ancOrder = [...anc].reverse(); // oldest first for verification
  const support = events.filter((e) => e.actorType === 'hexashield_support').length;
  const storage = anc[0]?.storage ?? '';

  const runVerify = () => {
    timers.current.forEach((t) => clearTimeout(t));
    setVerify({ step: 0, done: false });
    ancOrder.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setVerify({ step: i + 1, done: false }), 520 * (i + 1)));
    });
    timers.current.push(
      window.setTimeout(() => {
        setVerify({ step: ancOrder.length, done: true });
        toast(`Chain intact: ${fmtNum(ancOrder.reduce((s, a) => s + a.entries, 0))} entries across ${ancOrder.length} anchors re-hashed; Merkle roots match the signed anchors`);
      }, 520 * (ancOrder.length + 1)),
    );
  };

  const actorMix = (['user', 'service', 'agent', 'hexashield_support'] as ActorType[]).map((a) => ({ a, n: totals.filter((t) => t.actor === a).reduce((s, t) => s + t.count, 0) }));
  const sortedTypes = [...totals].sort((a, b) => b.count - a.count);
  const rows = events.filter((e) => (actor === 'all' || e.actorType === actor) && (!typeF || e.type === typeF));
  const pivot = (a: 'all' | ActorType, t: string | null = null) => {
    setActor(a);
    setTypeF(t);
    scrollToId('ops-ledger');
  };
  const ledgerSrc = `HexaView audit ledger (per-tenant hash chains) · anchors in ${storage}`;
  const anchorRecords = () =>
    openRecords({
      title: 'Signed anchors (most recent)',
      sub: `One Merkle root every 5 minutes · ${fmtNum(days * 288)} in range`,
      source: `ES256-signed anchors · ${storage}`,
      rows: anc.map((a) => ({ key: a.id, main: <span className="mono">{a.id}</span>, meta: `seq ${fmtNum(a.firstSeq)}–${fmtNum(a.lastSeq)} · ${a.entries} entries · root ${shortHash(a.merkleRoot, 10)}`, right: `${a.minAgo} min ago`, color: 'var(--good)' })),
    });
  const sessionRecords = () =>
    openRecords({
      title: 'HexaShield support sessions',
      source: 'HexaView support-access broker · approvals in the audit ledger',
      rows: sessions.map((x) => ({ key: x.id, main: x.reason, meta: `${x.engineer} · ${x.ticket} · ${x.scope}${x.approvedBy ? ` · approved by ${x.approvedBy}` : ''}`, right: <StatusBadge value={x.status} map={{ pending: 'var(--sev-medium)', active: 'var(--m-core)', closed: 'var(--good)', denied: 'var(--bad)' }} />, color: x.status === 'active' ? 'var(--m-core)' : x.status === 'denied' ? 'var(--bad)' : undefined })),
    });

  // Daily (or hourly for 24 h) volume, adding up to the range total.
  const buckets = days === 1 ? 24 : days;
  const vol = useMemo(() => {
    const raw = Array.from({ length: buckets }, (_, i) => 0.7 + 0.6 * Math.abs(Math.sin(i * 1.7 + c.id.length)) + (days === 1 ? (i > 7 && i < 19 ? 0.6 : 0) : i % 7 > 4 ? -0.3 : 0));
    const s = raw.reduce((a, b) => a + b, 0);
    return raw.map((v) => Math.round((v / s) * total));
  }, [buckets, total, c.id, days]);
  const volLabels = Array.from({ length: buckets }, (_, i) => (days === 1 ? `${String(ago((buckets - 1 - i) * 60).getHours()).padStart(2, '0')}:00` : `-${buckets - 1 - i}d`));

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b>{tenantId !== 'all' ? ` · ${tenants[0]?.name}` : ''}: every action, approval, evidence pull, copilot conversation and support session is written to a per-tenant ledger, chained as <span className="mono">SHA-256(prev_hash ‖ JCS(entry))</span> and anchored every 5 minutes as a signed Merkle root in {storage}.
      </p>

      <KpiStrip
        toneColor={OPS_TONE}
        items={[
          { label: 'Ledger events', hint: '30 d', value: fmtCompact(h.ops.auditEvents30d), onClick: () => pivot('all'), source: ledgerSrc },
          { label: 'In range', hint: rangeLabel(timeRange).replace('Last ', ''), value: fmtCompact(total), onClick: () => pivot('all'), source: ledgerSrc },
          { label: 'Last anchor', value: `${h.ops.lastAnchorMin} min`, unit: 'ago', bar: 100 - h.ops.lastAnchorMin * 15, onClick: anchorRecords, source: `Anchor store · ${storage}` },
          { label: 'Anchors in range', value: fmtNum(days * 288), unit: 'Merkle roots', onClick: anchorRecords, source: `Anchor store · ${storage}` },
          { label: 'Chain status', value: verify?.done ? 'Intact' : verify ? 'Verifying' : 'Intact', unit: verify?.done ? 'verified now' : 'last check 5 min ago', toneColor: 'var(--good)', onClick: () => { scrollToId('ops-verify'); runVerify(); }, source: 'hv-ledger verify against signed anchors' },
          { label: 'Support sessions', value: sessions.filter((s) => s.status === 'active').length, unit: `active · ${support} events`, onClick: sessionRecords, source: 'HexaView support-access broker' },
        ]}
      />

      <div className="grid g-2-1">
        <div id="ops-verify" style={{ minWidth: 0, scrollMarginTop: 80 }}>
        <Card
          title="Chain verification"
          sub={`Recompute every hash since the previous anchor and compare with the signed Merkle roots · key hv-ledger-es256-${c.id}`}
          actions={
            <Btn primary sm color={OPS_TONE} onClick={runVerify} disabled={!!verify && !verify.done}>
              {verify && !verify.done ? <Loader2 size={13} className="ops-spin" /> : <ShieldCheck size={13} />} Verify chain
            </Btn>
          }
        >
          <div className="ops-verify">
            {ancOrder.map((a, i) => {
              const st = !verify ? 'idle' : verify.step > i ? 'ok' : verify.step === i ? 'run' : 'idle';
              return (
                <div key={a.id} className={`ops-verify-row ${st}`}>
                  {st === 'ok' ? <CheckCircle2 size={15} style={{ color: 'var(--good)' }} /> : st === 'run' ? <Loader2 size={15} className="ops-spin" style={{ color: OPS_TONE }} /> : <AnchorIcon size={15} className="muted" />}
                  <span className="mono" style={{ fontSize: 11 }}>{a.id}</span>
                  <span className="muted" style={{ fontSize: 11 }}>seq {fmtNum(a.firstSeq)}–{fmtNum(a.lastSeq)} · {a.entries} entries</span>
                  <span className="spacer" />
                  <span className="ops-hash">root <b>{shortHash(a.merkleRoot, 10)}</b></span>
                  <span className="muted nowrap" style={{ fontSize: 11, width: 76, textAlign: 'right' }}>{a.minAgo} min ago</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12 }}>
            {verify?.done ? (
              <Callout kind="good">
                <b>Chain intact.</b> {fmtNum(ancOrder.reduce((s, a) => s + a.entries, 0))} entries re-hashed, no gaps in sequence, {ancOrder.length} Merkle roots match the ES256-signed anchors in {storage}. Latest anchor {h.ops.lastAnchorMin} min ago.
              </Callout>
            ) : (
              <Callout kind="info">
                Anyone with the Auditor role can verify independently: export the range as signed JSON Lines and run the open-source <span className="mono">hv-ledger verify</span> tool against the anchor store.
              </Callout>
            )}
          </div>
        </Card>
        </div>
        <Card title="Who is writing" sub={`Actor types · ${rangeLabel(timeRange)} · click to filter the ledger`}>
          <SegBreakdown
            totalLabel="events in range"
            parts={actorMix.map((x) => ({ key: x.a, label: ACTOR_LABEL[x.a], value: x.n, color: ACTOR_HEX[x.a] }))}
            active={actor === 'all' ? null : actor}
            onPick={(k) => pivot(actor === k ? 'all' : (k as ActorType), typeF)}
          />
          <div style={{ marginTop: 14 }}>
            <div className="ops-cols" style={{ height: 70 }}>
              {vol.map((v, i) => (
                <div key={i} title={`${volLabels[i]}: ${fmtNum(v)} events`} style={{ cursor: 'default' }}>
                  <i style={{ height: `${(v / Math.max(1, ...vol)) * 100}%`, background: PALETTE[9] }} />
                </div>
              ))}
            </div>
            <div className="ops-cols-axis">
              <span>{volLabels[0]}</span>
              <span>Events per {days === 1 ? 'hour' : 'day'}</span>
              <span>{days === 1 ? 'now' : 'today'}</span>
            </div>
          </div>
        </Card>
      </div>

      <div id="ops-ledger" style={{ scrollMarginTop: 80 }}>
      <Card
        title="Ledger"
        count={typeF || actor !== 'all' ? fmtNum(rows.length) : fmtCompact(total)}
        sub={`Most recent ${events.length} entries shown · ${rangeLabel(timeRange)} · per-tenant chains`}
        flush
        actions={
          <>
            <FilterChip label={typeF} onClear={() => setTypeF(null)} />
            <Btn sm onClick={() => setExporting(true)}>
              <Download size={13} /> Export signed JSONL
            </Btn>
          </>
        }
      >
        <DataTable
          rows={rows}
          rowKey={(e) => String(e.seq)}
          onRowClick={setSel}
          search={(e) => `${e.seq} ${e.type} ${e.actor} ${e.target} ${e.hash}`}
          searchPlaceholder="Filter by type, actor, target or hash…"
          initialSort={{ key: 'seq', dir: 'desc' }}
          pageSize={14}
          toolbar={
            <span className="chips">
              {(['all', 'user', 'service', 'agent', 'hexashield_support'] as const).map((a) => (
                <Chip key={a} on={actor === a} onClick={() => setActor(a)} color={OPS_TONE}>
                  {a === 'all' ? 'All actors' : ACTOR_LABEL[a]}
                </Chip>
              ))}
            </span>
          }
          columns={[
            { key: 'seq', header: 'Seq', sort: (e) => e.seq, render: (e) => <span className="mono">{fmtNum(e.seq)}</span> },
            { key: 'time', header: 'Time', sort: (e) => -e.minAgo, render: (e) => (<><div className="nowrap" style={{ fontSize: 12 }}>{fmtDateTime(ago(e.minAgo))}</div><div className="t-sub">{fmtAgo(e.minAgo)}</div></>) },
            { key: 'actor', header: 'Actor', sort: (e) => e.actorType, render: (e) => (<><Badge color={ACTOR_COLOR[e.actorType]}>{e.actorType}</Badge><div className="t-sub" style={{ marginTop: 3 }}>{e.actor}</div></>) },
            { key: 'type', header: 'Event', sort: (e) => e.type, render: (e) => <span className="mono" style={{ fontWeight: 600 }}>{e.type}</span> },
            { key: 'target', header: 'Target', render: (e) => (<><div style={{ fontSize: 12 }}>{e.target}</div><div className="t-sub">{c.tenants.find((t) => t.id === e.tenantId)?.short}</div></>) },
            { key: 'prev', header: 'prev_hash', render: (e) => <span className="ops-hash">{shortHash(e.prevHash)}</span> },
            { key: 'hash', header: 'hash', render: (e) => <span className="ops-hash"><b>{shortHash(e.hash)}</b></span> },
          ]}
        />
      </Card>
      </div>

      <div className="grid g-2-1">
        <Card title="Event types" sub={`${rangeLabel(timeRange)} · ${fmtNum(total)} events (30-day total ${fmtNum(total30)})`}>
          <HBars
            labelWidth={190}
            items={sortedTypes.map((t) => ({
              key: t.type,
              label: <span className="mono" style={{ fontSize: 11.5 }}>{t.type}</span>,
              value: Math.log10(t.count + 1),
              display: fmtNum(t.count),
              color: ACTOR_HEX[t.actor],
              active: typeF === t.type,
              onClick: () => pivot('all', typeF === t.type ? null : t.type),
            }))}
          />
          <div className="muted" style={{ fontSize: 11, margin: '6px 0 8px' }}>Bar length on a log scale; click a type to filter the ledger.</div>
          <Legend items={(Object.keys(ACTOR_HEX) as ActorType[]).map((a) => ({ label: ACTOR_LABEL[a], color: ACTOR_HEX[a] }))} />
        </Card>
        <Card title="HexaShield support access" sub="No standing access · requested, approved by a Tenant Admin, time-boxed (max 8 h), read-only by default, audited" actions={<UserCog size={16} style={{ color: OPS_TONE }} />}>
          <div className="list">
            {sessions.map((s) => (
              <div key={s.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                <span className="list-main">
                  <b style={{ whiteSpace: 'normal' }}>{s.reason}</b>
                  <span>{s.engineer} · {s.ticket} · {s.scope}</span>
                  <span>
                    {s.durationH} h window · requested {fmtAgo(s.requestedMinAgo)}
                    {s.approvedBy ? ` · approved by ${s.approvedBy}` : ''}
                  </span>
                </span>
                <StatusBadge value={s.status} map={{ pending: 'var(--sev-medium)', active: 'var(--m-core)', closed: 'var(--good)', denied: 'var(--bad)' }} />
              </div>
            ))}
          </div>
          <div className="card-foot">
            <Freshness minutes={h.ops.lastAnchorMin} label="Ledger anchor" />
            <span className="muted">Approve or deny requests in Administration</span>
          </div>
        </Card>
      </div>

      {recordsNode}
      {sel && (
        <Drawer title={sel.type} sub={`seq ${fmtNum(sel.seq)} · ${fmtDateTime(ago(sel.minAgo))}`} onClose={() => setSel(null)} wide icon={<Link2 size={18} style={{ color: OPS_TONE }} />}>
          <div className="stack" style={{ gap: 14 }}>
            <KV
              rows={[
                ['Actor', <><Badge color={ACTOR_COLOR[sel.actorType]}>{sel.actorType}</Badge> {sel.actor}</>],
                ['Target', sel.target],
                ['Tenant', c.tenants.find((t) => t.id === sel.tenantId)?.name],
                ['prev_hash', <span className="mono" style={{ fontSize: 11 }}>{sel.prevHash}</span>],
                ['hash', <span className="mono" style={{ fontSize: 11 }}>{sel.hash}</span>],
                ['Anchor', `${sel.anchor} · Merkle root signed ES256 · ${storage}`],
              ]}
            />
            <div className="section-label">Canonical entry (RFC 8785 JCS)</div>
            <pre className="ops-code">{JSON.stringify({ actor: { id: sel.actor, type: sel.actorType }, seq: sel.seq, target: sel.target, tenant: sel.tenantId, ts: ago(sel.minAgo).toISOString(), type: sel.type }, null, 2)}</pre>
            <Callout kind="good">
              hash = SHA-256(prev_hash ‖ JCS(entry)). Recomputed locally: <b>match</b>.
            </Callout>
          </div>
        </Drawer>
      )}

      {exporting && (
        <Modal
          title="Export signed ledger"
          sub={`${rangeLabel(timeRange)} · ${fmtNum(total)} entries · JSON Lines`}
          onClose={() => setExporting(false)}
          footer={
            <>
              <Btn onClick={() => setExporting(false)}>Cancel</Btn>
              <Btn primary color={OPS_TONE} onClick={() => { setExporting(false); toast(`Export queued: ledger-${c.id}-${tenantId}-${timeRange}.jsonl (${fmtNum(total)} entries) with detached ES256 signature and anchor proofs; the export is itself logged`); }}>
                <Download size={14} /> Export
              </Btn>
            </>
          }
        >
          <KV
            rows={[
              ['Scope', tenantId === 'all' ? `${c.tenants.length} tenant chains` : tenants[0]?.name],
              ['Range', rangeLabel(timeRange)],
              ['Format', 'JSON Lines, one canonical entry per line'],
              ['Includes', 'Entries, prev_hash/hash, Merkle inclusion proofs, signed anchors'],
              ['Signature', `ES256 detached (.sig), key hv-ledger-es256-${c.id}`],
              ['Verification', 'hv-ledger verify --anchors <store> export.jsonl'],
            ]}
          />
        </Modal>
      )}
    </>
  );
}
