import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, Workflow } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import type { PbRun, Playbook, RunStatus } from '../../../data/modules/playbooks';
import { Card, Badge, Btn, KV, Legend, Callout } from '../../../components/ui';
import { DataTable } from '../../../components/DataTable';
import { Drawer } from '../../../components/Overlay';
import { Pills, RankList, useParamFilter, tenantShort } from '../parts';
import { fmtAgo, fmtNum } from '../../../lib/format';
import { agoOf } from './store';
import { CAT_COLOR, PB_RISK_COLOR, RUN_COLOR, RUN_LABEL } from './meta';

const STATUSES = ['all', 'success', 'failed', 'awaiting', 'denied'] as const;
type StatusF = (typeof STATUSES)[number];
const ACTION_STATE_COLOR: Record<string, string> = { Verified: 'var(--good)', Applied: 'var(--accent)', PendingApproval: 'var(--sev-medium)', Failed: 'var(--bad)', RolledBack: 'var(--sev-medium)', Rejected: 'var(--sev-info)', PolicyDenied: 'var(--bad)' };

export function Runs({ runs, pbs, share, onOpen }: { runs: PbRun[]; pbs: Playbook[]; share: number; onOpen: (id: string) => void }) {
  const { customer: c } = useApp();
  const nav = useNavigate();
  const [status, setStatus] = useParamFilter<StatusF>('status', STATUSES, 'all');
  const [sel, setSel] = useState<PbRun | null>(null);
  const shown = runs.filter((r) => status === 'all' || r.status === status);
  const awaiting = runs.filter((r) => r.status === 'awaiting');

  // Daily executions over 30 days, from the aggregate volumes (records above are the latest sample).
  const days = useMemo(() => {
    const total = pbs.reduce((s, p) => s + p.runs30, 0) * share;
    const fails = runs.filter((r) => r.status === 'failed').length / Math.max(1, runs.length);
    const denies = runs.filter((r) => r.status === 'denied').length / Math.max(1, runs.length);
    return Array.from({ length: 30 }, (_, i) => {
      const wave = 1 + 0.25 * Math.sin(i / 2.2) + (i % 7 === 5 || i % 7 === 6 ? -0.3 : 0.05);
      const n = Math.max(0, Math.round((total / 30) * wave));
      const f = Math.round(n * fails);
      const d = Math.round(n * denies);
      const a = i === 29 ? awaiting.length : 0;
      return { day: 29 - i, success: Math.max(0, n - f - d - a), failed: f, denied: d, awaiting: a };
    });
  }, [pbs, runs, share, awaiting.length]);
  const maxDay = Math.max(1, ...days.map((d) => d.success + d.failed + d.denied + d.awaiting));

  const live = pbs.filter((p) => p.runs30 > 0);
  const mttr = live.slice().sort((a, b) => b.runs30 * (b.manualMttrMin - b.autoMttrMin) - a.runs30 * (a.manualMttrMin - a.autoMttrMin)).slice(0, 7);
  const maxM = Math.max(1, ...mttr.map((p) => p.manualMttrMin));
  const saved = live.map((p) => ({ id: p.id, label: p.name, sub: p.category, value: (p.runs30 * share * p.medianSavedMin) / 60 })).sort((a, b) => b.value - a.value).slice(0, 7);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid g-3-2">
        <Card title="Executions per day" sub="Last 30 days, all playbooks in scope" actions={<Legend items={(['success', 'awaiting', 'denied', 'failed'] as RunStatus[]).map((s) => ({ label: RUN_LABEL[s], color: RUN_COLOR[s] }))} />}>
          <div className="pb-days">
            {days.map((d) => (
              <button key={d.day} type="button" className="pb-day" title={`${d.day === 0 ? 'Today' : `${d.day} d ago`}: ${d.success} success, ${d.awaiting} awaiting, ${d.denied} denied, ${d.failed} failed`} onClick={() => setStatus(d.failed ? 'failed' : 'all')}>
                {(['success', 'awaiting', 'denied', 'failed'] as const).map((k) => d[k] > 0 && <i key={k} style={{ height: `${(d[k] / maxDay) * 100}%`, background: RUN_COLOR[k] }} />)}
              </button>
            ))}
          </div>
          <div className="pb-days-axis"><span>30 d ago</span><span>15 d</span><span>Today</span></div>
        </Card>
        <Card
          title="Approvals inbox"
          count={awaiting.length}
          sub="Runs paused at a gate; approve them in the Action Centre"
          actions={<Btn sm onClick={() => nav('/ops/actions')}><Inbox /> Open Action Centre</Btn>}
        >
          <div className="list">
            {awaiting.slice(0, 5).map((r) => (
              <div key={r.id} className="list-row clickable" style={{ cursor: 'pointer' }} onClick={() => setSel(r)}>
                <span className="list-main"><b>{r.pbName}</b><span>{r.entity} · {tenantShort(c, r.tenantId)} · {fmtAgo(agoOf(r.minAgo, r.at))}</span></span>
                <Badge color={RUN_COLOR.awaiting}>{r.actions.filter((a) => a.state === 'PendingApproval').length} held</Badge>
              </div>
            ))}
            {awaiting.length === 0 && <div className="empty">Nothing waiting for approval.</div>}
          </div>
        </Card>
      </div>

      <div className="grid g2">
        <Card title="MTTR: manual vs playbook" sub="Median time to resolve, by playbook (top 7 by time removed)">
          <div className="pb-mttr">
            {mttr.map((p) => (
              <div key={p.id} style={{ display: 'contents' }}>
                <button type="button" className="nm" onClick={() => onOpen(p.id)} title={`Open ${p.name} in the builder`}>{p.name}</button>
                <div className="bars">
                  <i style={{ width: `${(p.manualMttrMin / maxM) * 100}%`, background: '#8a9bc0' }} />
                  <i style={{ width: `${Math.max(1, (p.autoMttrMin / maxM) * 100)}%`, background: 'var(--m-soc)' }} />
                </div>
                <span className="v">{fmtMin(p.manualMttrMin)} → <b style={{ color: 'var(--text-primary)' }}>{fmtMin(p.autoMttrMin)}</b></span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}><Legend items={[{ label: 'Manual (before playbook)', color: '#8a9bc0' }, { label: 'With playbook', color: 'var(--m-soc)' }]} /></div>
        </Card>
        <Card title="Analyst hours saved" sub="Runs × median time saved, last 30 days">
          <RankList tone="var(--m-soc)" rows={saved.map((s) => ({ ...s, display: `${fmtNum(s.value, 1)} h` }))} onPick={(id) => onOpen(id)} />
        </Card>
      </div>

      <Card title="Recent executions" count={shown.length} sub="Latest runs, including simulations from this session">
        <div style={{ marginBottom: 12 }}>
          <Pills label="Status" value={status} onChange={setStatus} items={STATUSES.map((s) => ({ id: s, label: s === 'all' ? 'All' : RUN_LABEL[s as RunStatus], n: s === 'all' ? runs.length : runs.filter((r) => r.status === s).length }))} />
        </div>
        <DataTable
          rows={shown}
          rowKey={(r) => r.id}
          onRowClick={setSel}
          search={(r) => `${r.id} ${r.pbName} ${r.entity} ${r.note}`}
          searchPlaceholder="Search runs…"
          pageSize={12}
          columns={[
            { key: 'id', header: 'Run', render: (r) => <span className="num" style={{ whiteSpace: 'nowrap' }}>{r.id} {r.test && <Badge color="var(--m-soc)">Sim</Badge>}</span>, sort: (r) => r.id },
            { key: 'pb', header: 'Playbook', render: (r) => <span className="row" style={{ gap: 6 }}><i style={{ width: 7, height: 7, borderRadius: '50%', background: CAT_COLOR[r.category] ?? 'var(--m-soc)', flex: 'none' }} />{r.pbName}</span>, sort: (r) => r.pbName },
            { key: 'entity', header: 'Entity', render: (r) => <span className="muted" style={{ fontSize: 11.5 }}>{r.entity}</span> },
            { key: 'tenant', header: 'Tenant', render: (r) => tenantShort(c, r.tenantId), sort: (r) => r.tenantId },
            { key: 'when', header: 'Started', render: (r) => fmtAgo(agoOf(r.minAgo, r.at)), sort: (r) => -agoOf(r.minAgo, r.at) },
            { key: 'status', header: 'Status', render: (r) => <Badge color={RUN_COLOR[r.status]} dot>{RUN_LABEL[r.status]}</Badge>, sort: (r) => r.status },
            { key: 'dur', header: 'Duration', align: 'right', render: (r) => (r.durationSec ? fmtSec(r.durationSec) : '—'), sort: (r) => r.durationSec },
            { key: 'saved', header: 'Saved', align: 'right', render: (r) => (r.savedMin ? `${r.savedMin} min` : '—'), sort: (r) => r.savedMin },
          ]}
        />
      </Card>

      {sel && (
        <Drawer title={`${sel.id} · ${sel.pbName}`} sub={`${RUN_LABEL[sel.status]} · ${fmtAgo(agoOf(sel.minAgo, sel.at))}`} onClose={() => setSel(null)} footer={<><Btn ghost onClick={() => setSel(null)}>Close</Btn><Btn onClick={() => { onOpen(sel.pbId); setSel(null); }}><Workflow /> Open playbook</Btn>{sel.status === 'awaiting' && <Btn primary color="var(--m-soc)" onClick={() => nav('/ops/actions')}><Inbox /> Approve in Action Centre</Btn>}</>}>
          <div className="stack" style={{ gap: 14 }}>
            <span className="src-chip" style={{ alignSelf: 'flex-start' }}>Source: HexaSOC playbook engine · HexaView action broker ledger</span>
            <KV rows={[
              ['Entity', sel.entity],
              ['Tenant', tenantShort(c, sel.tenantId)],
              ['Status', <Badge key="s" color={RUN_COLOR[sel.status]} dot>{RUN_LABEL[sel.status]}</Badge>],
              ['Outcome', sel.note],
              ['Duration', sel.durationSec ? fmtSec(sel.durationSec) : 'In progress'],
              ['Analyst time saved', sel.savedMin ? `${sel.savedMin} min` : '—'],
              ['Approvers', sel.approvers.length ? sel.approvers.join(', ') : sel.status === 'awaiting' ? 'Pending' : 'None needed'],
            ]} />
            <div>
              <div className="section-label">Write-backs</div>
              <div className="list">
                {sel.actions.map((a, i) => (
                  <div key={i} className="list-row">
                    <i style={{ width: 8, height: 8, borderRadius: '50%', background: PB_RISK_COLOR[a.risk], flex: 'none' }} title={`${a.risk} risk`} />
                    <span className="list-main"><b>{a.label}</b><span>{a.tool} · {a.risk} risk</span></span>
                    <Badge color={ACTION_STATE_COLOR[a.state] ?? 'var(--text-muted)'}>{a.state}</Badge>
                  </div>
                ))}
                {sel.actions.length === 0 && <div className="empty">No write-backs on this run.</div>}
              </div>
            </div>
            {sel.status === 'failed' && <Callout kind="warn">Failed write-backs are rolled back automatically where possible and re-queued for an analyst.</Callout>}
          </div>
        </Drawer>
      )}
    </div>
  );
}

function fmtMin(m: number): string {
  if (m >= 1440) return `${(m / 1440).toFixed(1)} d`;
  if (m >= 60) return `${(m / 60).toFixed(1)} h`;
  return `${m} min`;
}
function fmtSec(s: number): string {
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

