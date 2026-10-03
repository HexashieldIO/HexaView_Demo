import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Radar, Activity, UserX } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { custodyScope, egressVectors, custodyAgents, topOffenders, custodyAnomalies, AGENT_CURRENT, type AgentState, type Offender, type EgressVector } from '../../data/modules/custody';
import { KpiStrip, Card, Badge, StatusBadge, Chip, Legend, KV, IcoBox, SevBadge, Btn } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { fmtAgo, fmtNum } from '../../lib/format';
import { CUSTODY_TONE } from './parts';

const DETECTED = '#f2643f';
const BLOCKED = '#4f8cff';
const AGENT_COLOR: Record<AgentState, string> = { Healthy: 'var(--good)', Degraded: 'var(--sev-medium)', Stale: 'var(--sev-high)', Offline: 'var(--bad)' };

export default function CustodyTelemetry() {
  const { customer: c, tenantId, timeRange } = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const days = rangeDays(timeRange);
  const sc = useMemo(() => custodyScope(c, tenantId), [c, tenantId]);
  const vectors = useMemo(() => egressVectors(c, tenantId, days), [c, tenantId, days]);
  const agents = useMemo(() => custodyAgents(c, tenantId), [c, tenantId]);
  const offenders = useMemo(() => topOffenders(c, tenantId, days), [c, tenantId, days]);
  const anomalies = useMemo(() => custodyAnomalies(c, tenantId), [c, tenantId]);
  const agentState = params.get('agents') as AgentState | null;
  const [vec, setVec] = useState<EgressVector | null>(null);
  const [off, setOff] = useState<Offender | null>(null);

  const attempts = vectors.reduce((s, v) => s + v.attempts, 0);
  const blocked = vectors.reduce((s, v) => s + v.blocked, 0);
  const through = attempts - blocked;
  const ranked = vectors.slice().sort((a, b) => b.attempts - b.blocked - (a.attempts - a.blocked));
  const worst = vectors.slice().sort((a, b) => a.blocked / a.attempts - b.blocked / b.attempts)[0];
  const maxA = Math.max(1, ...vectors.map((v) => v.attempts));
  const reporting = agents.counts.Healthy + agents.counts.Degraded;
  const blind = agents.counts.Stale + agents.counts.Offline;
  const custodyConn = c.connectors.find((k) => k.category === 'Custody');
  const SRC = custodyConn ? `${custodyConn.vendor === 'HexaShield' ? '' : `${custodyConn.vendor} `}${custodyConn.product}` : 'HexaCustody agents';
  const agentRows = agents.list.filter((a) => !agentState || a.state === agentState);
  const setAgents = (s: AgentState | null) => {
    const p = new URLSearchParams(params);
    if (!s || agentState === s) p.delete('agents');
    else p.set('agents', s);
    setParams(p, { replace: true });
    window.setTimeout(() => document.getElementById('custody-agents')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · {sc.tenantName}. How {sc.label.toLowerCase()} tried to leave, what policy stopped, and whether every custody agent is still reporting — a silent agent is a blind spot, never a clean bill of health. Source: {SRC}{sc.sources.length ? ` with ${sc.sources.map((s) => s.name).filter((n) => n !== SRC).join(', ')}` : ''}.
      </p>

      <KpiStrip
        toneColor={CUSTODY_TONE}
        items={[
          { label: 'Egress attempts', hint: rangeLabel(timeRange).toLowerCase(), value: fmtNum(attempts), onClick: () => setVec(null), source: SRC },
          { label: 'Stopped', hint: 'by policy', value: `${attempts ? Math.round((blocked / attempts) * 100) : 0}%`, bar: attempts ? (blocked / attempts) * 100 : 0, onClick: () => setVec(ranked[ranked.length - 1]), source: SRC },
          { label: 'Got through', hint: 'watermarked', value: fmtNum(through), toneColor: 'var(--bad)', onClick: () => setVec(ranked[0]), source: SRC },
          { label: 'Agents', hint: 'reporting', value: `${fmtNum(reporting)}/${fmtNum(agents.total)}`, onClick: () => setAgents(null), source: SRC },
          { label: 'Blind', hint: 'stale or offline', value: blind, toneColor: 'var(--sev-high)', onClick: () => setAgents('Stale'), source: SRC },
          { label: 'Anomalies', hint: 'top offenders', value: fmtNum(offenders.reduce((s, o) => s + o.anomalies, 0)), onClick: () => document.getElementById('custody-offenders')?.scrollIntoView({ behavior: 'smooth' }), source: SRC },
        ]}
      />

      <div className="grid g2">
        <Card title={<><Radar size={15} /> Egress vectors</>} sub={`${fmtNum(attempts)} attempts seen · ${fmtNum(blocked)} stopped (${attempts ? Math.round((blocked / attempts) * 100) : 0}%) · ${fmtNum(through)} went through`} actions={<Legend items={[{ label: 'Detected', color: DETECTED }, { label: 'Blocked', color: BLOCKED }]} />}>
          <Chart
            height={300}
            onClick={(p) => {
              const name = (p as { name?: string }).name;
              const v = vectors.find((x) => x.name === name);
              if (v) setVec(v);
            }}
            option={{
              tooltip: { trigger: 'item' },
              radar: {
                radius: '66%', center: ['50%', '54%'], splitNumber: 4,
                indicator: vectors.map((v) => ({ name: v.name, max: Math.ceil(maxA * 1.1) })),
                axisName: { fontSize: 11, color: '#9aa6c4' },
                splitArea: { show: false },
              },
              series: [{
                type: 'radar', symbolSize: 4,
                data: [
                  { name: 'Detected', value: vectors.map((v) => v.attempts), lineStyle: { color: DETECTED, type: 'dashed', width: 1.6 }, itemStyle: { color: DETECTED }, areaStyle: { color: 'rgba(242,100,63,0.06)' } },
                  { name: 'Blocked', value: vectors.map((v) => v.blocked), lineStyle: { color: BLOCKED, width: 1.6 }, itemStyle: { color: BLOCKED }, areaStyle: { color: 'rgba(79,140,255,0.28)' } },
                ],
              }],
            }}
          />
        </Card>
        <Card title="What got through" sub={<>Ranked by attempts policy did not stop — the weakest is <b>{worst?.name.toLowerCase()}</b>, stopping {worst ? Math.round((worst.blocked / worst.attempts) * 100) : 0}% of what it saw. Click a vector for detail.</>}
          foot={<Legend items={[{ label: 'Blocked', color: BLOCKED }, { label: 'Got through', color: DETECTED }]} />}>
          {ranked.map((v) => (
            <button key={v.name} className="custody-vec" onClick={() => setVec(v)}>
              <b>{v.name}</b>
              <span className="stacked" style={{ width: `${(v.attempts / maxA) * 100}%`, minWidth: 30 }}>
                <i style={{ width: `${(v.blocked / v.attempts) * 100}%`, background: BLOCKED }} />
                <i style={{ width: `${(1 - v.blocked / v.attempts) * 100}%`, background: DETECTED }} />
              </span>
              <span className="n">{v.attempts - v.blocked}<small>of {v.attempts}</small></span>
            </button>
          ))}
        </Card>
      </div>

      <div id="custody-agents" />
      <Card title={<><Activity size={15} /> Custody agent health</>} count={fmtNum(agents.total)}
        sub={<><b>{fmtNum(reporting)}</b> of {fmtNum(agents.total)} agents reporting · <b style={{ color: 'var(--sev-high)' }}>{blind}</b> stale or offline, and blind while they are · agent {AGENT_CURRENT} is current · showing the {agents.list.length} busiest</>}
        flush
        actions={<span className="chips">
          {(['Healthy', 'Degraded', 'Stale', 'Offline'] as AgentState[]).map((s) => (
            <Chip key={s} on={agentState === s} onClick={() => setAgents(s)} color={AGENT_COLOR[s]}>{s} {fmtNum(agents.counts[s])}</Chip>
          ))}
        </span>}>
        <DataTable
          rows={agentRows}
          rowKey={(a) => a.host}
          search={(a) => `${a.host} ${a.group} ${a.org} ${a.platform}`}
          searchPlaceholder="Filter hosts…"
          initialSort={{ key: 'state', dir: 'desc' }}
          pageSize={10}
          columns={[
            { key: 'host', header: 'Host', sort: (a) => a.host, render: (a) => (<><div className="t-main mono">{a.host}</div><div className="t-sub">{a.org}</div></>) },
            { key: 'group', header: 'Group', sort: (a) => a.group, render: (a) => a.group },
            { key: 'state', header: 'State', sort: (a) => ['Healthy', 'Degraded', 'Stale', 'Offline'].indexOf(a.state), render: (a) => <StatusBadge value={a.state} map={AGENT_COLOR} /> },
            { key: 'plat', header: 'Platform', render: (a) => <span className="t-sub">{a.platform}</span> },
            { key: 'ver', header: 'Agent', sort: (a) => a.version, render: (a) => <span className="mono" style={{ color: a.version === AGENT_CURRENT ? undefined : 'var(--bad)' }}>{a.version}</span> },
            { key: 'ev', header: 'Events', align: 'right', sort: (a) => a.events, render: (a) => fmtNum(a.events) },
            { key: 'q', header: 'Queued', align: 'right', sort: (a) => a.queued, render: (a) => <span style={{ color: a.queued ? 'var(--bad)' : undefined }}>{fmtNum(a.queued)}</span> },
            { key: 'seen', header: 'Last seen', sort: (a) => -a.lastSeenMin, render: (a) => <span className="t-sub">{fmtAgo(a.lastSeenMin)}</span> },
          ]}
        />
      </Card>

      <div id="custody-offenders" />
      <Card title={<><UserX size={15} /> Top offenders</>} count={offenders.length} sub={`${fmtNum(offenders.reduce((s, o) => s + o.anomalies, 0))} anomalies in ${rangeLabel(timeRange).toLowerCase()} · click for the records`} flush>
        <DataTable
          rows={offenders}
          rowKey={(o) => o.who}
          onRowClick={setOff}
          initialSort={{ key: 'n', dir: 'desc' }}
          columns={[
            { key: 'who', header: 'Who or what', sort: (o) => o.who, render: (o) => (<><div className="t-main">{o.who}</div><Badge color="var(--text-muted)">{o.type}</Badge></>) },
            { key: 'org', header: 'Organisation · group', render: (o) => (<><div>{o.org}</div><div className="t-sub">{o.group}</div></>) },
            { key: 'n', header: 'Anomalies', align: 'right', sort: (o) => o.anomalies, render: (o) => <b>{o.anomalies}</b> },
            { key: 'v', header: 'Most common vector', sort: (o) => o.vector, render: (o) => o.vector },
            { key: 'seen', header: 'Last seen', sort: (o) => -o.lastSeenMin, render: (o) => <span className="t-sub">{fmtAgo(o.lastSeenMin)}</span> },
          ]}
        />
      </Card>

      {vec && (
        <Drawer title={vec.name} sub={`${rangeLabel(timeRange)} · source: ${SRC}`} icon={<IcoBox color={CUSTODY_TONE}><Radar /></IcoBox>} onClose={() => setVec(null)}>
          <KV rows={[
            ['Attempts seen', fmtNum(vec.attempts)],
            ['Stopped by policy', `${fmtNum(vec.blocked)} (${Math.round((vec.blocked / vec.attempts) * 100)}%)`],
            ['Went through', <b style={{ color: 'var(--bad)' }}>{fmtNum(vec.attempts - vec.blocked)} — each still bound to a forensic watermark</b>],
          ]} />
          <div className="section-label" style={{ marginTop: 14 }}>Related anomalies</div>
          <div className="list">
            {anomalies.filter((a) => offenders.some((o) => o.who === a.actor && o.vector === vec.name)).map((a) => (
              <div key={a.id} className="list-row"><SevBadge sev={a.sev} /><span className="list-main"><b style={{ whiteSpace: 'normal' }}>{a.title}</b><span>{a.actor} · {fmtAgo(a.ageMin)}</span></span></div>
            ))}
            {!anomalies.some((a) => offenders.some((o) => o.who === a.actor && o.vector === vec.name)) && <div className="t-sub">No open anomalies on this vector; attempts were stopped or are low-risk.</div>}
          </div>
        </Drawer>
      )}
      {off && (
        <Drawer title={off.who} sub={`${off.type === 'USER' ? 'User' : 'Device'} · ${off.org} · ${off.group}`} icon={<IcoBox color="var(--bad)"><UserX /></IcoBox>} onClose={() => setOff(null)}
          footer={<Btn onClick={() => nav('/custody/revocation')}>Review grants and revoke</Btn>}>
          <KV rows={[['Anomalies', off.anomalies], ['Most common vector', off.vector], ['Last seen', fmtAgo(off.lastSeenMin)], ['Source', SRC]]} />
          <div className="section-label" style={{ marginTop: 14 }}>Open anomalies</div>
          <div className="list">
            {anomalies.filter((a) => a.actor === off.who || a.machine === off.who).map((a) => (
              <div key={a.id} className="list-row"><SevBadge sev={a.sev} /><span className="list-main"><b style={{ whiteSpace: 'normal' }}>{a.title}</b><span>{a.asset} · {fmtAgo(a.ageMin)}</span></span></div>
            ))}
            {!anomalies.some((a) => a.actor === off.who || a.machine === off.who) && <div className="t-sub">No open anomalies; this actor's events were all stopped by policy.</div>}
          </div>
        </Drawer>
      )}
    </>
  );
}
