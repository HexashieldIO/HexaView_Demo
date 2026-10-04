import { useMemo, useState } from 'react';
import { Plus, Zap, Lock, ShieldCheck } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { tenantShare } from '../../../data/customers';
import { approvalsRequired, triggerLabel, capOf, toolName, validate, CAP_LABEL, type Playbook, type PbStatus } from '../../../data/modules/playbooks';
import { RISK_RULES } from '../../../data/modules/ops';
import { Card, Badge, Btn, Sources } from '../../../components/ui';
import { Pills, useParamFilter } from '../parts';
import { fmtAgo, fmtNum } from '../../../lib/format';
import { agoOf } from './store';
import { CAT_COLOR, MiniGraph, PB_RISK_COLOR, STATUS_COLOR, STATUS_LABEL, type CVars } from './meta';

const STATUSES = ['all', 'active', 'draft', 'review', 'paused'] as const;
type StatusF = (typeof STATUSES)[number];

export function Library({ pbs, onOpen, onNew }: { pbs: Playbook[]; onOpen: (id: string) => void; onNew: () => void }) {
  const { customer: c, tenantId } = useApp();
  const [status, setStatus] = useParamFilter<StatusF>('status', STATUSES, 'all');
  const [q, setQ] = useState('');
  const share = tenantShare(c, tenantId);
  const shown = pbs.filter((p) => (status === 'all' || p.status === status) && (!q || `${p.name} ${p.category} ${p.summary}`.toLowerCase().includes(q.toLowerCase())));
  const writeTools = useMemo(() => c.connectors.filter((k) => k.write.length > 0 && capOf(k) !== null && capOf(k) !== 'ot'), [c]);
  const otTools = useMemo(() => c.connectors.filter((k) => capOf(k) === 'ot'), [c]);
  const issuesBy = useMemo(() => new Map(pbs.map((p) => [p.id, validate(c, p.nodes, p.edges)])), [c, pbs]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card
        title="Playbook library"
        count={shown.length}
        sub="Trigger → enrich → decide → act, with HexaView's approval gates built in. Open one to edit it on the canvas."
        actions={
          <>
            <input className="input" style={{ width: 200 }} placeholder="Search playbooks…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Btn sm primary color="var(--m-soc)" onClick={onNew}><Plus /> New playbook</Btn>
          </>
        }
      >
        <div style={{ marginBottom: 14 }}>
          <Pills
            label="Status"
            value={status}
            onChange={setStatus}
            items={STATUSES.map((s) => ({ id: s, label: s === 'all' ? 'All' : STATUS_LABEL[s as PbStatus], n: s === 'all' ? pbs.length : pbs.filter((p) => p.status === s).length, dot: s !== 'all' ? <i style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[s as PbStatus], display: 'inline-block' }} /> : undefined }))}
          />
        </div>
        <div className="pb-lib">
          {shown.map((p) => {
            const iss = issuesBy.get(p.id) ?? [];
            const errs = iss.filter((i) => i.level === 'error').length;
            const appr = approvalsRequired(p);
            return (
              <button key={p.id} type="button" className="pb-card" style={{ '--pb-c': CAT_COLOR[p.category] ?? 'var(--m-soc)' } as CVars} onClick={() => onOpen(p.id)}>
                <div className="row between" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <h4>{p.name}</h4>
                  <Badge color={STATUS_COLOR[p.status]} dot>{STATUS_LABEL[p.status]}</Badge>
                </div>
                <div className="pb-card-trig"><Zap size={12} style={{ flex: 'none', color: 'var(--m-soc)' }} /><span>{triggerLabel(c, p)}</span></div>
                <p>{p.summary}</p>
                <MiniGraph c={c} nodes={p.nodes} edges={p.edges} />
                <div className="pb-card-stats">
                  <div><b>{fmtNum(Math.round(p.runs30 * share))}</b><span>Runs (30 d)</span></div>
                  <div><b>{p.runs30 ? `${p.autoClosedPct}%` : '—'}</b><span>Auto-closed</span></div>
                  <div><b>{p.medianSavedMin}m</b><span>Median saved</span></div>
                  <div><b style={{ color: appr === 2 ? 'var(--sev-high)' : undefined }}>{appr || 'Auto'}</b><span>Approvals</span></div>
                </div>
                <div className="pb-card-foot">
                  <span>{p.category} · v{p.version}{p.dirty ? ' (draft changes)' : ''} · {p.editedBy}, {fmtAgo(agoOf(p.editedMinAgo, p.editedAt))}</span>
                  {errs > 0 ? <span style={{ color: 'var(--bad)', fontWeight: 700 }}>{errs} error{errs === 1 ? '' : 's'}</span> : p.category === 'OT' ? <span style={{ color: 'var(--m-ot)', fontWeight: 700 }}>No OT writes</span> : null}
                </div>
              </button>
            );
          })}
          {shown.length === 0 && <div className="empty">No playbooks match this filter.</div>}
        </div>
      </Card>

      <div className="grid g-3-2">
        <Card title="Two-way control: write-back gates" sub="Every playbook action is an OpenC2 request through the HexaView action broker, signed, approved by risk class and verified after it lands">
          <div className="pb-gates">
            {(['low', 'medium', 'high'] as const).map((r) => (
              <div key={r} className="pb-gate">
                <b><i style={{ background: PB_RISK_COLOR[r] }} />{r.charAt(0).toUpperCase() + r.slice(1)} risk</b>
                <span>{RISK_RULES[r].who}{RISK_RULES[r].expiryH ? ` · ${RISK_RULES[r].expiryH} h expiry` : ''}</span>
                <span className="muted">{RISK_RULES[r].examples}</span>
              </div>
            ))}
            <div className="pb-gate" style={{ borderColor: 'color-mix(in srgb, var(--bad) 45%, var(--card-border))' }}>
              <b><Lock size={12} style={{ color: 'var(--bad)' }} />OT</b>
              <span>Never. Read-only by policy; playbooks notify and open tickets for site engineers.</span>
              <span className="muted">{otTools.length ? `${otTools.length} OT feed${otTools.length === 1 ? '' : 's'} read-only` : 'No OT feeds'}</span>
            </div>
          </div>
        </Card>
        <Card title="Write-back targets" count={writeTools.length} sub={`${c.short}'s connected tools that accept playbook actions`}>
          <div className="list">
            {writeTools.slice(0, 7).map((k) => (
              <div key={k.id} className="list-row">
                <ShieldCheck size={14} style={{ color: 'var(--m-soc)', flex: 'none' }} />
                <span className="list-main"><b>{toolName(k)}</b><span>{CAP_LABEL[capOf(k)!]} · {k.write.join(', ')}</span></span>
                <Sources items={[{ name: k.status === 'healthy' ? 'Healthy' : k.status, status: k.status }]} />
              </div>
            ))}
            {otTools.slice(0, 2).map((k) => (
              <div key={k.id} className="list-row">
                <Lock size={14} style={{ color: 'var(--bad)', flex: 'none' }} />
                <span className="list-main"><b>{toolName(k)}</b><span>OT · read-only by policy, never a write-back target</span></span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
