import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, X, ShieldCheck, Lock, FileSignature, Bot, Clock } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { headlines } from '../../data/core';
import { scopedTenants } from '../../data/customers';
import {
  pendingActions, actionHistory, actionTypes, regoPolicy, policyBundle, RISK_COLOR, RISK_RULES, OUTCOME_COLOR, HAPPY_PATH,
  type PendingAction, type HistoryAction, type LifecycleState, type Outcome, type Approval, type ActionType, type Risk,
} from '../../data/modules/ops';
import { Card, KpiStrip, Badge, StatusBadge, Btn, Callout, KV, Sources, Tabs, cap } from '../../components/ui';
import { SEV_HEX } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer, Modal } from '../../components/Overlay';
import { fmtAgo, fmtNum, fmtDur } from '../../lib/format';
import { OPS_TONE, useMe, useSeconds, Switch, CodeBlock, LifecycleDiagram, fmtCountdown, useParamFilter, FilterChip, HBars, SegBreakdown, useRecords, scrollToId } from './parts';

const OUTCOME_HEX: Record<Outcome, string> = {
  Verified: '#2dd4bf', RolledBack: SEV_HEX.medium, PolicyDenied: '#8a9bc0', Rejected: SEV_HEX.low, Expired: '#68b1ff', AgentRefused: SEV_HEX.high, DispatchExpired: '#a07cfb', Failed: SEV_HEX.critical,
};

function pathFor(o: Outcome): LifecycleState[] {
  const pre: LifecycleState[] = ['Requested', 'PendingApproval', 'Approved', 'Dispatched'];
  switch (o) {
    case 'Verified': return HAPPY_PATH;
    case 'RolledBack': return [...pre, 'Executing', 'Applied', 'VerifyFailed', 'RollingBack', 'RolledBack'];
    case 'PolicyDenied': return ['Requested', 'PolicyDenied'];
    case 'Rejected': return ['Requested', 'PendingApproval', 'Rejected'];
    case 'Expired': return ['Requested', 'PendingApproval', 'Expired'];
    case 'AgentRefused': return [...pre, 'AgentRefused'];
    case 'DispatchExpired': return [...pre, 'DispatchExpired'];
    case 'Failed': return [...pre, 'Executing', 'Failed'];
  }
}

export default function Actions() {
  const { customer, tenantId, persona } = useApp();
  return <ActionsInner key={`${customer.id}-${tenantId}-${persona}`} />;
}

interface LocalState {
  approvals: Approval[];
  state: LifecycleState;
  done?: 'Verified' | 'Rejected';
}

function ActionsInner() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const me = useMe();
  const sec = useSeconds();
  const days = rangeDays(timeRange);
  const h = headlines(c, tenantId);
  const tenants = scopedTenants(c, tenantId);
  const pending = useMemo(() => pendingActions(c, tenantId, me), [c, tenantId, me]);
  const history = useMemo(() => actionHistory(c, tenantId), [c, tenantId]);
  const [local, setLocal] = useState<Record<string, LocalState>>(() => Object.fromEntries(pending.map((p) => [p.id, { approvals: p.approvals, state: 'PendingApproval' as LifecycleState }])));
  const [searchParams] = useSearchParams();
  const deepId = searchParams.get('id');
  const [selId, setSelId] = useState(pending.find((p) => p.id === deepId)?.id ?? pending[0]?.id);
  useEffect(() => {
    if (deepId && pending.some((p) => p.id === deepId)) {
      setSelId(deepId);
      setTimeout(() => document.querySelector('.ops-req.sel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    }
  }, [deepId, pending]);
  const [confirm, setConfirm] = useState<{ p: PendingAction; mode: 'approve' | 'reject' } | null>(null);
  const [hist, setHist] = useState<HistoryAction | null>(null);
  const [types, setTypes] = useState<ActionType[]>(() => actionTypes(c, tenantId));
  const [typeFilter, setTypeFilter] = useState<'all' | Risk>('all');
  const [extraHistory, setExtraHistory] = useState<HistoryAction[]>([]);
  const timers = useRef<number[]>([]);
  const [outcomeF, setOutcomeF] = useParamFilter('outcome');
  const [connF, setConnF] = useParamFilter('conn');
  const [, openRecords, recordsNode] = useRecords();
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const inRange = useMemo(() => [...extraHistory, ...history.filter((a) => a.minAgo <= days * 1440)], [history, extraHistory, days]);
  const last30 = history.filter((a) => a.minAgo <= 30 * 1440);
  const verifiedPct = Math.round((last30.filter((a) => a.outcome === 'Verified').length / Math.max(1, last30.length)) * 100);
  const rolledBack = last30.filter((a) => a.outcome === 'RolledBack').length;
  const denied = last30.filter((a) => a.outcome === 'PolicyDenied' || a.outcome === 'AgentRefused').length;
  const durs = last30.filter((a) => a.durationSec).map((a) => a.durationSec).sort((a, b) => a - b);
  const medDur = durs[Math.floor(durs.length / 2)] ?? 0;
  const openCount = pending.filter((p) => !local[p.id]?.done).length;
  const writeConns = [...new Set(types.filter((t) => !t.ot).map((t) => t.connector))];
  const enabledCount = types.filter((t) => t.enabled).length;
  const sel = pending.find((p) => p.id === selId);
  const selLocal = sel ? local[sel.id] : undefined;
  const visited = selLocal ? HAPPY_PATH.slice(0, Math.max(1, HAPPY_PATH.indexOf(selLocal.state))) : [];

  const canApprove = (p: PendingAction): { ok: boolean; why?: string } => {
    const st = local[p.id];
    if (st?.done) return { ok: false, why: st.done };
    if (p.requestedBy === me.name) return { ok: false, why: 'You requested this action; a requester cannot approve their own request' };
    if (st?.approvals.some((a) => a.name === me.name)) return { ok: false, why: 'You have already approved' };
    if (p.risk === 'low' && !['Approver', 'Tenant Admin', 'GRC'].includes(me.role)) return { ok: false, why: `${me.role} cannot approve actions` };
    if (p.risk !== 'low' && !['Approver', 'Tenant Admin'].includes(me.role)) return { ok: false, why: `Needs the Approver role; you are ${me.role}` };
    return { ok: true };
  };

  const runToVerified = (p: PendingAction, approvals: Approval[]) => {
    const steps: LifecycleState[] = ['Approved', 'Dispatched', 'Executing', 'Applied', 'Verified'];
    steps.forEach((s, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setLocal((L) => ({ ...L, [p.id]: { ...L[p.id], state: s, done: s === 'Verified' ? 'Verified' : undefined } }));
          if (s === 'Verified') {
            toast(`Verified: ${p.writeType} on ${p.connector.product} (${p.id}); post-condition matched, ledger entry written`);
            setExtraHistory((xs) => [{ id: p.id, minAgo: 0, title: `${p.writeType} · ${p.openc2.args}`, writeType: p.writeType, connector: p.connector, tenantId: p.tenantId, risk: p.risk, outcome: 'Verified', requestedBy: p.requestedBy, approvers: approvals.map((a) => a.name), durationSec: 4, note: 'Approved just now in this session' }, ...xs]);
          }
        }, 750 * (i + 1)),
      );
    });
  };

  const doApprove = (p: PendingAction) => {
    const st = local[p.id];
    const approvals = [...st.approvals, { name: me.name, role: me.role, minAgo: 0 }];
    const enough = approvals.length >= p.approvalsNeeded;
    const adminOk = p.risk !== 'high' || approvals.some((a) => a.role === 'Tenant Admin');
    setLocal((L) => ({ ...L, [p.id]: { ...L[p.id], approvals } }));
    setSelId(p.id);
    if (enough && adminOk) {
      toast(`Approved and signed (ES256). Dispatching ${p.id} to ${c.dataPlanes.find((d) => d.id === p.connector.dataPlaneId)?.name ?? 'data plane'}`);
      runToVerified(p, approvals);
    } else if (!adminOk && enough) {
      toast(`Approval recorded for ${p.id}; a Tenant Admin must still approve (high risk)`);
    } else {
      toast(`Approval ${approvals.length} of ${p.approvalsNeeded} recorded for ${p.id}`);
    }
  };
  const doReject = (p: PendingAction) => {
    setLocal((L) => ({ ...L, [p.id]: { ...L[p.id], state: 'Rejected', done: 'Rejected' } }));
    setSelId(p.id);
    toast(`Rejected ${p.id}; requester notified and ledger entry written`);
  };

  const outcomeCounts = (Object.keys(OUTCOME_COLOR) as Outcome[]).map((o) => ({ o, n: inRange.filter((a) => a.outcome === o).length })).filter((x) => x.n > 0);
  const perConnector = writeConns.map((k) => ({ k, n: inRange.filter((a) => a.connector.id === k.id).length })).sort((a, b) => b.n - a.n).slice(0, 8);
  const matchOutcome = (a: HistoryAction) => !outcomeF || (outcomeF === 'denied' ? a.outcome === 'PolicyDenied' || a.outcome === 'AgentRefused' : a.outcome === outcomeF);
  const histRows = inRange.filter((a) => matchOutcome(a) && (!connF || a.connector.id === connF));
  const histSrc = `HexaView Action Centre ledger · ${writeConns.slice(0, 4).map((k) => k.product).join(', ')}`;
  const pivot = (o: string | null, k: string | null = null) => {
    setOutcomeF(o);
    setConnF(k);
    scrollToId('ops-history');
  };
  const filterLabel = [outcomeF === 'denied' ? 'Denied or vetoed' : outcomeF, connF ? c.connectors.find((k) => k.id === connF)?.product : null].filter(Boolean).join(' · ');
  const pendingRecords = () =>
    openRecords({
      title: 'Awaiting approval',
      source: `HexaView Action Centre · policy bundle ${policyBundle(c)}`,
      rows: pending.filter((p) => !local[p.id]?.done).map((p) => ({
        key: p.id, color: RISK_COLOR[p.risk], main: p.title,
        meta: `${p.id} · ${p.connector.vendor} ${p.connector.product} · requested by ${p.requestedBy} · ${local[p.id].approvals.length} of ${p.approvalsNeeded} approvals`,
        right: <span className="mono">{fmtCountdown(p.expiresInMin * 60 - sec)}</span>,
      })),
    });

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b>{tenantId !== 'all' ? ` · ${tenants[0]?.name}` : ''}: write-back to {writeConns.slice(0, 5).map((k) => k.product).join(', ')}
        {writeConns.length > 5 ? ` and ${writeConns.length - 5} more` : ''} is gated here. Off by default, staged by risk, a human approves every action, envelopes are ES256-signed with an HSM key and the data plane keeps a local veto. Nothing is ever written to OT.
      </p>

      <KpiStrip
        toneColor={OPS_TONE}
        items={[
          { label: 'Awaiting approval', value: openCount, unit: `of ${h.ops.pendingApprovals}`, hint: 'inbox', onClick: pendingRecords, source: 'HexaView Action Centre (signed envelopes)' },
          { label: 'Actions', hint: '30 d', value: fmtNum(h.ops.actions30d), unit: `${inRange.length} in range`, onClick: () => pivot(null), source: histSrc },
          { label: 'Verified', hint: '30 d', value: `${verifiedPct}%`, bar: verifiedPct, delta: { text: `${rolledBack} rolled back automatically`, good: true }, onClick: () => pivot('Verified'), source: 'Post-condition read-back from each tool API' },
          { label: 'Denied or vetoed', hint: '30 d', value: denied, unit: 'policy + agent', onClick: () => pivot('denied'), source: 'OPA policy decisions · data-plane agent veto log' },
          {
            label: 'Dispatch to verified', hint: 'median', value: `${medDur}s`, source: 'Data-plane agent timings',
            onClick: () => openRecords({
              title: 'Dispatch to verified, slowest first', source: 'Data-plane agent timings · HexaView Action Centre',
              rows: [...last30].filter((a) => a.durationSec).sort((a, b) => b.durationSec - a.durationSec).slice(0, 40).map((a) => ({ key: a.id + a.minAgo, main: a.title, meta: `${a.id} · ${a.connector.product} · ${fmtAgo(a.minAgo)}`, right: <b>{a.durationSec}s</b>, color: OUTCOME_COLOR[a.outcome] })),
            }),
          },
          { label: 'Action types on', value: `${enabledCount}/${types.filter((t) => !t.ot).length}`, bar: (enabledCount / Math.max(1, types.length)) * 100, onClick: () => scrollToId('ops-types'), source: 'Tenant policy bundle (enabled_actions)' },
        ]}
      />

      <div className="grid g-3-2">
        <Card title="Approvals inbox" count={openCount} sub={`Signed in as ${me.name} · ${me.role} · you cannot approve your own requests`} actions={<Badge color={OPS_TONE}>Bundle {policyBundle(c)}</Badge>}>
          <div className="stack" style={{ gap: 10 }}>
            {pending.map((p) => {
              const st = local[p.id];
              const ca = canApprove(p);
              const remaining = p.expiresInMin * 60 - sec;
              const own = p.requestedBy === me.name;
              return (
                <div key={p.id} className={`ops-req ${selId === p.id ? 'sel' : ''}`} onClick={() => setSelId(p.id)} style={{ cursor: 'pointer', opacity: st.done ? 0.62 : 1 }}>
                  <div className="ops-req-head">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row wrap" style={{ gap: 6 }}>
                        <Badge color={RISK_COLOR[p.risk]} solid={p.risk === 'high'}>{cap(p.risk)} risk</Badge>
                        <span className="mono muted" style={{ fontSize: 11 }}>{p.id}</span>
                        {own && <Badge color="var(--sev-medium)">Your request</Badge>}
                        {p.viaAgent && <Badge color="var(--m-ai)"><Bot size={11} /> Agent-proposed</Badge>}
                        {st.done && <StatusBadge value={st.done} map={{ Verified: 'var(--good)', Rejected: 'var(--bad)' }} />}
                      </div>
                      <b style={{ display: 'block', marginTop: 6 }}>{p.title}</b>
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{p.reason} · linked {p.linked}</div>
                    </div>
                    <div className="stack" style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: remaining < 3600 ? 'var(--sev-high)' : 'var(--text-primary)' }}>
                        <Clock size={12} style={{ verticalAlign: -1 }} /> {st.done ? '—' : fmtCountdown(remaining)}
                      </span>
                      <span className="muted" style={{ fontSize: 10.5 }}>expires · requested {fmtAgo(p.createdMinAgo)}</span>
                    </div>
                  </div>
                  <dl className="ops-env">
                    <div><dt>Connector</dt><dd>{p.connector.vendor} {p.connector.product}</dd></div>
                    <div><dt>OpenC2</dt><dd className="mono" style={{ fontSize: 11 }}>{p.openc2.action} · {p.openc2.target}</dd></div>
                    <div><dt>Target</dt><dd className="mono" style={{ fontSize: 11 }}>{p.openc2.args}</dd></div>
                    <div><dt>Tenant</dt><dd>{c.tenants.find((t) => t.id === p.tenantId)?.short}</dd></div>
                    <div><dt>Requested by</dt><dd>{p.requestedBy} <span className="muted">({p.requestedByRole})</span></dd></div>
                    <div><dt>Approvals</dt><dd style={{ color: st.approvals.length >= p.approvalsNeeded ? 'var(--good)' : undefined }}>{st.approvals.length} of {p.approvalsNeeded} · {RISK_RULES[p.risk].who}</dd></div>
                  </dl>
                  <table className="ops-diff">
                    <tbody>
                      {p.diff.map(([f, b, a]) => (
                        <tr key={f}>
                          <td>{f}</td>
                          <td>{b === '—' || b === a || a === 'unchanged' ? <span className="muted">{b}</span> : <span className="before">{b}</span>}</td>
                          <td>{a === 'unchanged' ? <span className="muted">unchanged</span> : <span className="after">{a}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <span className="muted" style={{ fontSize: 11 }}>
                      <FileSignature size={12} style={{ verticalAlign: -2 }} /> {p.envelopeId} · ES256 · {p.keyId}
                    </span>
                    <span className="spacer" />
                    {st.approvals.map((a) => (
                      <Badge key={a.name} color="var(--good)"><Check size={11} /> {a.name}</Badge>
                    ))}
                    <Btn sm danger disabled={!!st.done || own} title={own ? 'Withdraw instead: requesters cannot act on their own request' : undefined} onClick={() => setConfirm({ p, mode: 'reject' })}>
                      <X size={13} /> Reject
                    </Btn>
                    <Btn sm primary color={OPS_TONE} disabled={!ca.ok} title={ca.why} onClick={() => setConfirm({ p, mode: 'approve' })}>
                      <Check size={13} /> Approve
                    </Btn>
                  </div>
                  {!ca.ok && !st.done && <div className="muted" style={{ fontSize: 11, marginTop: -4 }}><Lock size={11} style={{ verticalAlign: -1 }} /> {ca.why}</div>}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="stack">
          <Card title="Action lifecycle" sub={sel ? `${sel.id} · ${selLocal?.state}` : 'Select a request'} actions={selLocal?.done === 'Verified' ? <Badge color="var(--good)" dot>Verified</Badge> : <Badge color={OPS_TONE} dot>{selLocal?.state ?? '—'}</Badge>}>
            <LifecycleDiagram current={selLocal?.state} visited={selLocal?.state === 'Rejected' ? ['Requested', 'PendingApproval'] : visited} />
            <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
              Requested → PolicyDenied | PendingApproval → Approved | Rejected | Expired → Dispatched → AgentRefused | DispatchExpired | Executing → Failed | Applied → Verified | VerifyFailed → RollingBack → RolledBack | RollbackFailed.
            </div>
          </Card>
          <Card title="Risk classes" sub="LLD 8.2 · enforced in the control plane and again by the data-plane agent">
            <div className="stack" style={{ gap: 8 }}>
              {(['low', 'medium', 'high', 'critical'] as Risk[]).map((r) => (
                <div key={r} className="row" style={{ gap: 10, fontSize: 12, alignItems: 'flex-start' }}>
                  <span style={{ width: 70 }}><Badge color={RISK_COLOR[r]} solid={r === 'critical'}>{cap(r)}</Badge></span>
                  <span style={{ flex: 1 }}>
                    <b>{RISK_RULES[r].who}</b>
                    {RISK_RULES[r].expiryH ? <span className="muted"> · expires {RISK_RULES[r].expiryH} h</span> : null}
                    <div className="muted" style={{ fontSize: 11 }}>{RISK_RULES[r].examples}</div>
                  </span>
                </div>
              ))}
              <Callout kind="info">
                <b>Requester cannot approve their own action.</b> Approvals and the signed envelope are written to the audit ledger; the agent re-checks signature, nonce, expiry and its local deny list before it executes.
              </Callout>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid g-2-1">
        <div id="ops-history" style={{ minWidth: 0, scrollMarginTop: 80 }}>
        <Card title="Action history" count={histRows.length} sub={`${rangeLabel(timeRange)} · ${fmtNum(h.ops.actions30d)} in the last 30 days`} flush actions={<FilterChip label={filterLabel} onClear={() => pivot(null)} />}>
          <DataTable
            rows={histRows}
            rowKey={(r, i) => `${r.id}-${i}`}
            onRowClick={setHist}
            search={(r) => `${r.id} ${r.title} ${r.connector.product} ${r.outcome} ${r.requestedBy}`}
            searchPlaceholder="Filter actions…"
            initialSort={{ key: 'when', dir: 'asc' }}
            pageSize={10}
            columns={[
              { key: 'when', header: 'When', sort: (r) => r.minAgo, render: (r) => <span className="nowrap">{r.minAgo === 0 ? 'just now' : fmtAgo(r.minAgo)}</span> },
              { key: 'act', header: 'Action', sort: (r) => r.title, render: (r) => (<><div className="t-main">{r.title}</div><div className="t-sub">{r.id} · {r.connector.vendor} {r.connector.product}</div></>) },
              { key: 'tenant', header: 'Tenant', sort: (r) => r.tenantId, render: (r) => c.tenants.find((t) => t.id === r.tenantId)?.short },
              { key: 'risk', header: 'Risk', sort: (r) => ['low', 'medium', 'high'].indexOf(r.risk), render: (r) => <Badge color={RISK_COLOR[r.risk]}>{cap(r.risk)}</Badge> },
              { key: 'out', header: 'Outcome', sort: (r) => r.outcome, render: (r) => <StatusBadge value={r.outcome} map={OUTCOME_COLOR} /> },
              { key: 'by', header: 'Requested · approved', render: (r) => (<><div style={{ fontSize: 12 }}>{r.requestedBy}</div><div className="t-sub">{r.approvers.join(', ') || '—'}</div></>) },
              { key: 'dur', header: 'Duration', align: 'right', sort: (r) => r.durationSec, render: (r) => (r.durationSec ? `${r.durationSec}s` : '—') },
            ]}
          />
        </Card>
        </div>
        <div className="stack">
          <Card title="Outcomes" sub={`${rangeLabel(timeRange)} · click a row to filter the history`}>
            <SegBreakdown
              totalLabel="actions in range"
              parts={outcomeCounts.map((x) => ({ key: x.o, label: x.o.replace(/([a-z])([A-Z])/g, '$1 $2'), value: x.n, color: OUTCOME_HEX[x.o] }))}
              active={outcomeF}
              onPick={(k) => pivot(outcomeF === k ? null : k, connF)}
            />
          </Card>
          <Card title="By connector" sub="Actions dispatched in range · click to filter">
            <HBars
              labelWidth={130}
              color="#a07cfb"
              items={perConnector.map((x) => ({ key: x.k.id, label: x.k.product, sub: x.k.vendor, value: x.n, active: connF === x.k.id, onClick: () => pivot(outcomeF, connF === x.k.id ? null : x.k.id) }))}
            />
          </Card>
        </div>
      </div>

      <div className="grid g-3-2">
        <div id="ops-types" style={{ minWidth: 0, scrollMarginTop: 80 }}>
        <Card
          title="Action types by tenant"
          sub={`Write-back is off by default; ${enabledCount} enabled for ${tenantId === 'all' ? 'the group' : tenants[0]?.short}. Changes are themselves an audited Tenant Admin action.`}
          flush
          actions={<Tabs value={typeFilter} onChange={setTypeFilter} color={OPS_TONE} tabs={[{ id: 'all', label: 'All' }, { id: 'low', label: 'Low' }, { id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' }]} />}
        >
          <DataTable
            rows={types.filter((t) => typeFilter === 'all' || t.risk === typeFilter || t.ot)}
            rowKey={(t) => t.key}
            pageSize={30}
            maxHeight={420}
            columns={[
              { key: 'type', header: 'Action type', sort: (t) => t.write, render: (t) => (<><div className="t-main">{t.ot ? 'OT actions: not available by policy' : t.write}</div><div className="t-sub mono">{t.openc2.action} · {t.openc2.target}</div></>) },
              { key: 'conn', header: 'Connector', sort: (t) => t.connector.product, render: (t) => (<><div style={{ fontSize: 12 }}>{t.connector.vendor} {t.connector.product}</div><Sources items={[{ name: t.connector.env.toUpperCase(), status: t.connector.status }]} /></>) },
              { key: 'risk', header: 'Risk', sort: (t) => ['low', 'medium', 'high', 'critical'].indexOf(t.risk), render: (t) => (t.ot ? <Badge color="var(--sev-info)"><Lock size={10} /> Read-only</Badge> : <Badge color={RISK_COLOR[t.risk]}>{cap(t.risk)} · {RISK_RULES[t.risk].approvers}×</Badge>) },
              { key: 'used', header: 'Used 30 d', align: 'right', sort: (t) => t.used30d, render: (t) => (t.ot ? '—' : t.used30d) },
              {
                key: 'on', header: 'Enabled', align: 'right', sort: (t) => (t.enabled ? 1 : 0),
                render: (t) => (
                  <Switch
                    on={t.enabled}
                    disabled={t.ot || me.role !== 'Tenant Admin'}
                    title={t.ot ? 'OT is read-only by policy; no write actions exist' : me.role !== 'Tenant Admin' ? 'Only a Tenant Admin can change action enablement' : undefined}
                    onChange={(v) => {
                      setTypes((ts) => ts.map((x) => (x.key === t.key ? { ...x, enabled: v } : x)));
                      toast(`${v ? 'Enabled' : 'Disabled'} "${t.write}" on ${t.connector.product}; new policy bundle staged and ledger entry written`);
                    }}
                  />
                ),
              },
            ]}
          />
        </Card>
        </div>
        <Card title="Policy as code" sub={`Rego · ${policyBundle(c)} · signed bundle, evaluated twice (control plane and agent)`} actions={<ShieldCheck size={16} style={{ color: OPS_TONE }} />}>
          <CodeBlock code={regoPolicy(c)} />
        </Card>
      </div>

      {confirm && (
        <Modal
          title={confirm.mode === 'approve' ? `Approve ${confirm.p.id}?` : `Reject ${confirm.p.id}?`}
          sub={`${confirm.p.writeType} · ${confirm.p.connector.vendor} ${confirm.p.connector.product}`}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <Btn onClick={() => setConfirm(null)}>Cancel</Btn>
              {confirm.mode === 'approve' ? (
                <Btn primary color={OPS_TONE} onClick={() => { doApprove(confirm.p); setConfirm(null); }}>
                  <FileSignature size={14} /> Approve & sign
                </Btn>
              ) : (
                <Btn danger onClick={() => { doReject(confirm.p); setConfirm(null); }}>
                  <X size={14} /> Reject
                </Btn>
              )}
            </>
          }
        >
          <div className="stack" style={{ gap: 12 }}>
            <KV
              rows={[
                ['Risk class', <Badge color={RISK_COLOR[confirm.p.risk]}>{cap(confirm.p.risk)} · {RISK_RULES[confirm.p.risk].who}</Badge>],
                ['OpenC2', <span className="mono">{`{"action":"${confirm.p.openc2.action}","target":{"${confirm.p.openc2.target}":"${confirm.p.openc2.args}"}}`}</span>],
                ['Approvals so far', `${local[confirm.p.id].approvals.length} of ${confirm.p.approvalsNeeded}`],
                ['You', `${me.name} · ${me.role}`],
                ['Signing key', confirm.p.keyId],
                ['Policy bundle', confirm.p.policyBundle],
              ]}
            />
            <table className="ops-diff">
              <tbody>
                {confirm.p.diff.map(([f, b, a]) => (
                  <tr key={f}><td>{f}</td><td><span className="before">{b}</span></td><td><span className="after">{a}</span></td></tr>
                ))}
              </tbody>
            </table>
            <Callout kind={confirm.mode === 'approve' ? 'info' : 'warn'}>
              {confirm.mode === 'approve'
                ? 'Your approval is signed with your SSO identity and recorded in the hash-chained ledger. The data-plane agent verifies the ES256 signature and can still refuse.'
                : 'The requester is notified and the request closes as Rejected. This is recorded in the audit ledger.'}
            </Callout>
          </div>
        </Modal>
      )}

      {recordsNode}
      {hist && (
        <Drawer title={hist.title} sub={`${hist.id} · ${hist.connector.vendor} ${hist.connector.product}`} onClose={() => setHist(null)} wide>
          <div className="stack" style={{ gap: 16 }}>
            <LifecycleDiagram current={hist.outcome} visited={pathFor(hist.outcome).slice(0, -1)} />
            <KV
              rows={[
                ['Outcome', <StatusBadge value={hist.outcome} map={OUTCOME_COLOR} />],
                ['Detail', hist.note],
                ['When', hist.minAgo === 0 ? 'just now' : `${fmtAgo(hist.minAgo)} (${fmtDur(hist.minAgo)})`],
                ['Tenant', c.tenants.find((t) => t.id === hist.tenantId)?.name],
                ['Risk', <Badge color={RISK_COLOR[hist.risk]}>{cap(hist.risk)}</Badge>],
                ['Requested by', hist.requestedBy],
                ['Approved by', hist.approvers.join(', ') || '—'],
                ['Dispatch → verified', hist.durationSec ? `${hist.durationSec}s` : '—'],
                ['Policy bundle', policyBundle(c)],
                ['Data plane', c.dataPlanes.find((d) => d.id === hist.connector.dataPlaneId)?.name],
              ]}
            />
          </div>
        </Drawer>
      )}
    </>
  );
}
