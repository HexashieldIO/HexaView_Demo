import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Power, Plus } from 'lucide-react';
import { Card, KpiStrip, Chip, Btn, Badge, KV, Stacked, Legend, Timeline, Callout } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { Drawer } from '../../components/Overlay';
import { DataTable } from '../../components/DataTable';
import { dayLabels, fmtAgo, fmtCompact, fmtNum, hourLabels } from '../../lib/format';
import {
  aisecPolicies, aisecEnforcement, aisecKillLog, aisecEnforceEvents, POLICY_HEX, VERDICT_HEX, VERDICTS, STATUS_HEX, EV_LABEL,
  type AsItem, type AsPolicy, type PolicyType, type Verdict,
} from '../../data/modules/aisec';
import { AS_TONE, ActionModal, ItemDrawer, KindBadge, RecordsDrawer, SensorNote, toneStyle, useAs } from './parts';

const TYPES: PolicyType[] = ['Guardrail', 'Approval gate', 'Blocked tool', 'Data-class rule', 'Kill switch'];
const V_LABEL: Record<Verdict, string> = { allowed: 'Allowed', redacted: 'Redacted', approved: 'Approved', blocked: 'Blocked', killed: 'Killed' };

export default function AisecPolicy() {
  const { c, tenantId, days, inv, sum, scope, rl, toast } = useAs();
  const [params, setParams] = useSearchParams();
  const outcome = params.get('outcome') as Verdict | null;
  const itemParam = params.get('item');
  const [type, setType] = useState<PolicyType | null>(null);
  const [pol, setPol] = useState<AsPolicy | null>(null);
  const [polAct, setPolAct] = useState<{ p: AsPolicy; mode: 'Enforce' | 'Monitor' } | null>(null);
  const [newPol, setNewPol] = useState(false);
  const [kill, setKill] = useState<{ x: AsItem; restore: boolean } | null>(null);
  const [state, setState] = useState<Record<string, 'killed' | 'running'>>({});
  const [open, setOpen] = useState<AsItem | null>(null);
  const [listV, setListV] = useState<Verdict | null>(null);

  const policies = useMemo(() => aisecPolicies(c, tenantId, days), [c, tenantId, days]);
  const enf = aisecEnforcement(c, tenantId, days, sum);
  const kills = aisecKillLog(c, tenantId);
  const events = useMemo(() => aisecEnforceEvents(c, tenantId, inv, policies), [c, tenantId, inv, policies]);
  const labels = days === 1 ? hourLabels(24) : dayLabels(enf.n);
  const shownPol = policies.filter((p) => (!type || p.type === type) && (!outcome || p.outcome === outcome));
  const agents = inv.filter((x) => x.kind === 'Agent' || x.kind === 'MCP server' || x.kind === 'Custom GPT').sort((a, b) => b.risk - a.risk);
  const killedNames = new Set(kills.filter((k) => !k.restored).map((k) => k.item));
  const stateOf = (x: AsItem) => state[x.id] ?? (killedNames.has(x.name) ? 'killed' : 'running');
  const enforced = policies.filter((p) => p.mode === 'Enforce').length;

  return (
    <div className="stack" style={{ gap: 16, ...toneStyle }}>
      <p className="page-intro">
        <b>{c.name}</b> · {scope}. Guardrails, approval gates and a kill switch, <b>enforced where AI runs</b>: the kernel sensor holds or terminates the call on the host, HexaAI decides, a human approves anything state-changing. {rl}.
      </p>
      <KpiStrip
        toneColor={AS_TONE}
        items={[
          { label: 'Policies', value: policies.length, unit: `${enforced} enforcing`, onClick: () => { setType(null); setParams((p) => { p.delete('outcome'); return p; }); }, source: 'HexaAI policy engine' },
          ...VERDICTS.map((v) => ({
            label: V_LABEL[v], value: fmtCompact(enf.totals[v]), toneColor: VERDICT_HEX[v],
            onClick: () => setListV(v), source: v === 'killed' ? 'Nexovern sensor (process kill)' : 'Nexovern sensor via HexaAI',
          })),
        ]}
      />

      <div className="grid g-3-2">
        <Card title="Enforcement outcomes over time" sub={`${rl} · bars = interventions, line = allowed sessions`} actions={<Legend items={VERDICTS.map((v) => ({ label: V_LABEL[v], color: VERDICT_HEX[v] }))} />}>
          <Chart
            height={270}
            option={{
              tooltip: { trigger: 'axis' },
              grid: { left: 8, right: 8, top: 18, bottom: 6, containLabel: true },
              xAxis: { type: 'category', data: labels, axisLabel: { interval: Math.max(0, Math.floor(labels.length / 7) - 1) } },
              yAxis: [{ type: 'value', name: 'interventions' }, { type: 'value', name: 'allowed', splitLine: { show: false } }],
              series: [
                ...(['redacted', 'approved', 'blocked', 'killed'] as Verdict[]).map((v) => ({ name: V_LABEL[v], type: 'bar' as const, stack: 'e', data: enf.series[v], itemStyle: { color: VERDICT_HEX[v] } })),
                { name: 'Allowed', type: 'line', yAxisIndex: 1, data: enf.series.allowed, symbol: 'none', lineStyle: { color: VERDICT_HEX.allowed, width: 2 }, areaStyle: { color: 'rgba(45,212,191,.08)' } },
              ],
            }}
          />
          <div style={{ marginTop: 8 }}>
            <Stacked tall showLabels parts={VERDICTS.filter((v) => v !== 'allowed').map((v) => ({ value: enf.totals[v], color: VERDICT_HEX[v], label: V_LABEL[v] }))} />
          </div>
        </Card>

        <Card title={<><Power size={15} style={{ color: '#f0466e' }} /> Kill switch</>} sub="Per agent and MCP server · terminate the process tree on the host · high risk, two approvers" count={agents.length}>
          <div style={{ maxHeight: 330, overflowY: 'auto' }}>
            {agents.map((x) => {
              const st = stateOf(x);
              return (
                <div key={x.id} className="as-ks" style={itemParam === x.name ? { background: 'color-mix(in srgb, var(--m-aisec) 10%, transparent)' } : undefined}>
                  <button className="as-ks-name" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit', minWidth: 0 }} onClick={() => setOpen(x)}>
                    <b>{x.name}</b>
                    <span>{x.kind} · {x.hosts} host{x.hosts === 1 ? '' : 's'} · risk {x.risk}</span>
                  </button>
                  <span className="as-ks-state" style={{ color: st === 'killed' ? '#f0466e' : x.status === 'shadow' ? STATUS_HEX.shadow : '#2dd4bf' }}>
                    <i style={{ background: st === 'killed' ? '#f0466e' : '#2dd4bf' }} />
                    {st === 'killed' ? 'Killed' : x.status === 'shadow' ? 'Running (shadow)' : 'Running'}
                  </span>
                  {st === 'killed' ? (
                    <button className="as-killbtn restore" onClick={() => setKill({ x, restore: true })}>Restore</button>
                  ) : (
                    <button className="as-killbtn" onClick={() => setKill({ x, restore: false })}>KILL</button>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8 }}><SensorNote>kill is enforced in the kernel; it cannot be bypassed by the agent or a local admin</SensorNote></div>
        </Card>
      </div>

      <Card
        title="Policy catalogue"
        count={shownPol.length}
        sub="Guardrails, approval gates, blocked tools and data-class rules · click a policy for scope, hits and frameworks"
        flush
        actions={
          <div className="row wrap" style={{ gap: 6 }}>
            {TYPES.map((t) => <Chip key={t} on={type === t} color={POLICY_HEX[t]} onClick={() => setType(type === t ? null : t)}>{t}</Chip>)}
            {outcome && <Chip on color={VERDICT_HEX[outcome]} onClick={() => setParams((p) => { p.delete('outcome'); return p; })}>Outcome: {V_LABEL[outcome]} ×</Chip>}
            <Btn sm primary color={AS_TONE} onClick={() => setNewPol(true)}><Plus size={13} /> New policy</Btn>
          </div>
        }
      >
        <DataTable
          rows={shownPol}
          rowKey={(p) => p.id}
          onRowClick={setPol}
          initialSort={{ key: 'hits', dir: 'desc' }}
          search={(p) => `${p.name} ${p.scope} ${p.frameworks.join(' ')}`}
          columns={[
            { key: 'name', header: 'Policy', sort: (p) => p.name, render: (p) => (<><div className="t-main" style={{ whiteSpace: 'normal' }}>{p.name}</div><div className="t-sub">{p.id} · {p.scope}</div></>) },
            { key: 'type', header: 'Type', sort: (p) => p.type, render: (p) => <Badge color={POLICY_HEX[p.type]}>{p.type}</Badge> },
            { key: 'point', header: 'Enforced at', sort: (p) => p.point, render: (p) => <span className="t-sub">{p.point}</span> },
            { key: 'mode', header: 'Mode', sort: (p) => p.mode, render: (p) => <Badge color={p.mode === 'Enforce' ? 'var(--good)' : p.mode === 'Monitor' ? 'var(--sev-medium)' : 'var(--text-muted)'} dot>{p.mode}</Badge> },
            { key: 'out', header: 'Outcome', sort: (p) => p.outcome, render: (p) => <Badge color={VERDICT_HEX[p.outcome]}>{V_LABEL[p.outcome]}</Badge> },
            { key: 'fw', header: 'Maps to', render: (p) => <span className="t-sub">{p.frameworks.join(' · ')}</span> },
            { key: 'hits', header: 'Hits', align: 'right', sort: (p) => p.hits, render: (p) => <span className="num">{fmtNum(p.hits)}</span> },
          ]}
        />
      </Card>

      <div className="grid g-3-2">
        <Card title="Recent enforcement events" count={events.length} sub="Interventions with the policy that fired" flush>
          <div className="list" style={{ padding: '0 18px 8px' }}>
            {events.map((e) => (
              <button key={e.id} className="list-row" onClick={() => setOpen(e.item)}>
                <span className="list-main">
                  <b>{e.item.name} · <span className="mono" style={{ fontWeight: 500, fontSize: 11.5 }}>{e.detail}</span></b>
                  <span>{EV_LABEL[e.type]} · {e.host} · {e.policy.id} {e.policy.name}</span>
                </span>
                <span className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge color={e.verdict === 'pending' ? '#f0a338' : VERDICT_HEX[e.verdict as Verdict]} dot>{e.verdict === 'pending' ? 'Pending' : V_LABEL[e.verdict as Verdict]}</Badge>
                  <span className="muted" style={{ fontSize: 10.5 }}>{fmtAgo(e.secAgo / 60)}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Kill-switch log" count={kills.length} sub="Last 90 days · automatic and manual">
          <Timeline
            items={kills.slice(0, 7).map((k) => ({
              time: fmtAgo(k.minAgo),
              title: `${k.item} · ${k.mode}`,
              body: `${k.reason}. ${k.approvers.length ? `Approved by ${k.approvers.join(' and ')}.` : `By ${k.by}.`} ${k.restored ? 'Restored after review.' : 'Still contained.'}`,
              color: k.mode.startsWith('Manual') ? '#f0a338' : '#f0466e',
            }))}
          />
        </Card>
      </div>

      {pol && (
        <Drawer title={pol.name} sub={`${pol.id} · ${pol.type}`} onClose={() => setPol(null)} footer={<><Btn onClick={() => { setPolAct({ p: pol, mode: pol.mode === 'Enforce' ? 'Monitor' : 'Enforce' }); setPol(null); }}>{pol.mode === 'Enforce' ? 'Switch to monitor' : 'Switch to enforce'}</Btn></>}>
          <div className="row" style={{ gap: 6 }}><Badge color={POLICY_HEX[pol.type]}>{pol.type}</Badge><Badge color={VERDICT_HEX[pol.outcome]}>{V_LABEL[pol.outcome]}</Badge><Badge>{pol.mode}</Badge></div>
          <KV rows={[
            ['Scope', pol.scope],
            ['Enforced at', pol.point],
            ['Hits', `${fmtNum(pol.hits)} (${rl.toLowerCase()})`],
            ['Maps to', pol.frameworks.join(' · ')],
            ['Owner', pol.owner],
            ['Last changed', fmtAgo(pol.updatedDays * 1440)],
            ['Evidence', 'Policy version and enforcement counts pushed to HexaComply'],
          ]} />
          <SensorNote>enforcement point below the application layer</SensorNote>
        </Drawer>
      )}
      {polAct && (
        <ActionModal
          title={`${polAct.mode === 'Monitor' ? 'Relax' : 'Enforce'}: ${polAct.p.name}`}
          target={`${polAct.p.point} · ${polAct.p.scope}`}
          operation={`policy.mode.set(${polAct.p.id}, ${polAct.mode.toLowerCase()})`}
          risk={polAct.mode === 'Monitor' ? 'high' : 'medium'}
          approvers={polAct.mode === 'Monitor' ? [c.people.ciso.name, c.people.grcLead.name] : [c.people.grcLead.name]}
          change={polAct.mode === 'Monitor' ? <>Matching calls will be <b>logged but allowed</b>. Relaxing a control lowers AI posture and is recorded against ISO 42001 A.9.</> : <>Matching calls will be <b>{polAct.p.outcome}</b> on every covered host within 60 seconds.</>}
          onClose={() => setPolAct(null)}
          onSubmit={() => { setPolAct(null); toast(`Policy change submitted: ${polAct.p.id} → ${polAct.mode}`); }}
        />
      )}
      {newPol && (
        <ActionModal
          title="New guardrail policy"
          target="HexaAI policy engine · all covered hosts in scope"
          operation="policy.create(draft) → staged → enforce"
          risk="medium"
          approvers={[c.people.grcLead.name]}
          change={<>A new policy is created in <b>Staged</b> mode, replayed against the last 7 days of sessions to show impact, then promoted to Enforce after approval.</>}
          onClose={() => setNewPol(false)}
          submitLabel="Create draft"
          onSubmit={() => { setNewPol(false); toast('Draft policy created in Staged mode; impact replay running'); }}
        >
          <Callout>Templates: block a data class to a vendor · require approval for a tool · deny an MCP server · token ceiling per agent.</Callout>
        </ActionModal>
      )}
      {kill && (
        <ActionModal
          danger={!kill.restore}
          title={kill.restore ? `Restore ${kill.x.name}` : `Kill switch: ${kill.x.name}`}
          target={`Nexovern runtime sensor on ${kill.x.hosts} host${kill.x.hosts === 1 ? '' : 's'}`}
          operation={kill.restore ? 'sensor.release(agent) + policy.reattach' : 'sensor.process.kill(tree) + egress.deny + mcp.deny'}
          risk="high"
          approvers={[c.people.socLead.name, c.people.ciso.name]}
          change={kill.restore ? <>Allows {kill.x.name} to start again under its guardrail profile. Its owner confirms the root cause is fixed.</> : <>Terminates the process tree of <b>{kill.x.name}</b> on every host, denies its tool, MCP and model egress, and opens a HexaSOC case. In-flight actions are rolled back where the target supports it.</>}
          submitLabel={kill.restore ? 'Request restore (two approvers)' : 'Kill now (two approvers)'}
          onClose={() => setKill(null)}
          onSubmit={() => { setState((s) => ({ ...s, [kill.x.id]: kill.restore ? 'running' : 'killed' })); setKill(null); toast(kill.restore ? `Restore of ${kill.x.name} approved; agent released` : `Kill switch executed on ${kill.x.name}: process tree terminated, HexaSOC case opened`); }}
        >
          <KV rows={[['Agent', <KindBadge kind={kill.x.kind} />], ['Owner', kill.x.owner], ['Data access', kill.x.dataAccess]]} />
        </ActionModal>
      )}
      {open && <ItemDrawer item={open} onClose={() => setOpen(null)} />}
      {listV && (
        <RecordsDrawer
          title={`${V_LABEL[listV]}: ${fmtNum(enf.totals[listV])} sessions`}
          sub={rl}
          source="Nexovern sensor via HexaAI policy engine"
          onClose={() => setListV(null)}
          rows={inv.filter((x) => (listV === 'blocked' ? x.blocked : listV === 'redacted' ? x.redacted : x.sessions) > 0 && (listV !== 'killed' || killedNames.has(x.name))).sort((a, b) => b.blocked - a.blocked).map((x) => ({ key: x.id, main: x.name, sub: `${x.kind} · ${x.vendor}`, right: <span className="num" style={{ fontSize: 11.5 }}>{fmtNum(listV === 'blocked' ? x.blocked : listV === 'redacted' ? x.redacted : Math.round(x.sessions * (listV === 'approved' ? 0.012 : 1)))}</span>, onClick: () => { setListV(null); setOpen(x); } }))}
        />
      )}
    </div>
  );
}
