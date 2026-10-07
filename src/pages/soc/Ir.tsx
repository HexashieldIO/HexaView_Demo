import { useMemo, useState } from 'react';
import { Siren, Laptop, KeyRound, Ban, Globe, Clock, BookOpen, LifeBuoy } from 'lucide-react';
import { Card, KpiStrip, Badge, SevBadge, StatusBadge, KV, Timeline, Btn, Chip, IcoBox, Ring, Callout, Sources, Bar, cap } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { incidents, incidentTimeline, regClocks, irRetainer, playbooks, mttrTrend, socTools, toolShort, techName, type Incident } from '../../data/modules/soc';
import { fmtAgo, fmtDur, fmtNum } from '../../lib/format';
import { useSoc, tenantShort, TechChips, ClockBar, WriteBackModal, OtReadOnly, INC_STATUS_COLOR, RISK_COLOR, RecordsDrawer, useParamFilter, type WriteBack } from './parts';
import { useSearchParams } from 'react-router-dom';
import type { Severity } from '../../data/types';

type View = 'open' | 'closed' | 'all';
type SevF = 'all' | Severity;
const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;

export default function SocIr() {
  const { c, tenantId, days, h, tools, tone, scopeLabel, rangeText } = useSoc();
  const s = h.soc;
  const incs = useMemo(() => incidents(c, tenantId, days), [c, tenantId, days]);
  const open = incs.filter((i) => i.status !== 'closed');
  const closed = incs.filter((i) => i.status === 'closed');
  const [view, setView] = useParamFilter<View>('status', ['open', 'closed', 'all'] as const, 'open');
  const [sevF, setSevF] = useParamFilter<SevF>('severity', ['all', 'critical', 'high', 'medium', 'low'] as const, 'all');
  const [sp] = useSearchParams();
  const [sel, setSel] = useState<Incident | null>(() => incidents(c, tenantId, days).find((i) => i.id === sp.get('id')) ?? null);
  const [panel, setPanel] = useState<'clocks' | 'retainer' | 'tta' | null>(null);
  const [wb, setWb] = useState<WriteBack | null>(null);
  const ret = irRetainer(c, tenantId);
  const pbs = playbooks(c, incs);
  const trend = mttrTrend(c, tenantId);

  const clocksNow = open.flatMap((i) => regClocks(c, i).filter((k) => !k.filed).map((k) => ({ ...k, inc: i })));
  clocksNow.sort((a, b) => a.deadlineMin - a.elapsedMin - (b.deadlineMin - b.elapsedMin));
  const rows = (view === 'open' ? open : view === 'closed' ? closed : incs).filter((i) => sevF === 'all' || i.sev === sevF);
  const src = `${tools.siemShort}${tools.edr ? ` · ${tools.edrShort}` : ''} · ${c.connectors.find((k) => k.category === 'ITSM')?.product ?? 'ITSM'}`;
  const meanTta = Math.round(open.reduce((n, i) => n + i.ttaMin, 0) / Math.max(1, open.length));

  return (
    <>
      <p className="page-intro">
        <b>{scopeLabel}</b> · retained incident response from first call to lessons learned. Cases are worked in HexaView and mirrored to {c.connectors.find((k) => k.category === 'ITSM')?.product ?? 'ITSM'}; containment is written back to {tools.edrShort} and {tools.idpShort} with approvals. Regulatory clocks follow each tenant's regimes.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Open incidents', value: s.openIncidents, hint: `${s.critical} critical · ${s.high} high`, toneColor: s.critical ? 'var(--sev-critical)' : tone, onClick: () => { setView('open'); setSevF('all'); }, source: src },
          { label: 'Critical + high', value: s.critical + s.high, hint: 'open', toneColor: 'var(--sev-high)', onClick: () => { setView('open'); setSevF(s.critical ? 'critical' : 'high'); }, source: src },
          { label: 'Mean time to acknowledge', value: meanTta, unit: 'min', hint: 'open cases', onClick: () => setPanel('tta'), source: `HexaSOC case timeline · ${tools.siemShort}` },
          { label: 'MTTR (contain)', value: s.mttrMin, unit: 'min', bar: (s.mttrMin / 60) * 100, delta: { text: 'SLA 60 min', good: true }, onClick: () => { setView('closed'); setSevF('all'); }, source: 'HexaSOC case timeline' },
          { label: 'Closed', value: closed.length, hint: rangeText.toLowerCase(), onClick: () => { setView('closed'); setSevF('all'); }, source: src },
          { label: 'Regulatory clocks running', value: clocksNow.length, hint: clocksNow[0] ? `next: ${fmtDur(clocksNow[0].deadlineMin - clocksNow[0].elapsedMin)}` : 'none', toneColor: clocksNow.length ? 'var(--sev-high)' : tone, onClick: () => setPanel('clocks'), source: 'HexaSOC regulatory clock engine · tenant regimes' },
          { label: 'Retainer hours left', value: ret.hours - ret.used, unit: `of ${ret.hours}`, bar: ((ret.hours - ret.used) / ret.hours) * 100, onClick: () => setPanel('retainer'), source: 'HexaSOC IR retainer ledger' },
        ]}
      />

      <Card
        title="Incident queue"
        count={rows.length}
        sub={`${open.length} open (matches the Command Centre) · ${closed.length} closed in ${rangeText.toLowerCase()} · click a row for the case file`}
        flush
      >
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={setSel}
          pageSize={14}
          search={(r) => `${r.id} ${r.title} ${r.assignee} ${r.techniques.join(' ')} ${r.sources.join(' ')} ${tenantShort(c, r.tenantId)}`}
          searchPlaceholder="Filter by ID, title, technique, tool…"
          initialSort={{ key: 'sev', dir: 'asc' }}
          toolbar={
            <span className="row wrap" style={{ gap: 10 }}>
              <span className="chips">
                {(['open', 'closed', 'all'] as View[]).map((v) => (
                  <Chip key={v} on={view === v} onClick={() => setView(v)} color={tone}>
                    {cap(v)} {v === 'open' ? open.length : v === 'closed' ? closed.length : incs.length}
                  </Chip>
                ))}
              </span>
              <span className="chips">
                {(['all', 'critical', 'high', 'medium', 'low'] as SevF[]).map((v) => (
                  <Chip key={v} on={sevF === v} onClick={() => setSevF(v)} color={v === 'all' ? tone : `var(--sev-${v})`}>
                    {v === 'all' ? 'Any severity' : cap(v)}
                  </Chip>
                ))}
              </span>
            </span>
          }
          columns={[
            { key: 'id', header: 'ID', sort: (r) => r.id, render: (r) => <span className="mono nowrap">{r.id}</span> },
            { key: 'title', header: 'Incident', sort: (r) => r.title, render: (r) => (<><div className="t-main" style={{ maxWidth: 380, whiteSpace: 'normal' }}>{r.title}</div><div className="t-sub">{r.playbook}{r.ot ? ' · OT' : ''}{r.actor ? ` · ${r.actor}` : ''}</div></>) },
            { key: 'sev', header: 'Severity', sort: (r) => SEV_RANK[r.sev] * 100000 + r.openedMin / 100, render: (r) => <SevBadge sev={r.sev} /> },
            { key: 'status', header: 'Status', sort: (r) => r.status, render: (r) => (r.status === 'closed' ? <span><StatusBadge value="closed" map={INC_STATUS_COLOR} /><div className="t-sub">{r.disposition}</div></span> : <StatusBadge value={r.status} map={INC_STATUS_COLOR} />) },
            { key: 'tenant', header: 'Tenant', sort: (r) => tenantShort(c, r.tenantId), render: (r) => tenantShort(c, r.tenantId) },
            { key: 'assignee', header: 'Assignee', sort: (r) => r.assignee, render: (r) => <span className="nowrap">{r.assignee}</span> },
            { key: 'tech', header: 'ATT&CK', render: (r) => <TechChips ids={r.techniques} max={2} /> },
            { key: 'src', header: 'Source tools', render: (r) => <span className="t-sub">{r.sources.join(' · ')}</span> },
            { key: 'age', header: 'Age', align: 'right', sort: (r) => (r.status === 'closed' ? r.closedMin ?? 0 : r.openedMin), render: (r) => (r.status === 'closed' ? <span className="t-sub">closed {fmtAgo(r.closedMin ?? 0)}<br />took {fmtDur(r.durationMin)}</span> : <span className="nowrap">{fmtDur(r.openedMin)}</span>) },
          ]}
        />
      </Card>

      <div className="grid g-3-2">
        <Card title="Regulatory clocks running" count={clocksNow.length} sub="Every open high and critical incident, against the regimes that apply to its tenant">
          {clocksNow.length ? (
            <div>
              {clocksNow.slice(0, 7).map((k, i) => (
                <div key={i} style={{ cursor: 'pointer' }} onClick={() => setSel(k.inc)}>
                  <ClockBar {...k} name={`${k.name} · ${k.inc.id} (${tenantShort(c, k.inc.tenantId)})`} />
                </div>
              ))}
            </div>
          ) : (
            <Callout kind="good">No notification clocks are running for this scope. Clocks start automatically when a high or critical incident touches a regulated tenant.</Callout>
          )}
        </Card>
        <Card title="Time to contain" sub="Monthly median, all severities · target 60 min">
          <Chart
            height={240}
            option={{
              grid: { left: 4, right: 10, top: 16, bottom: 4, containLabel: true },
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: trend.labels },
              yAxis: { type: 'value', name: 'min' },
              series: [
                { type: 'bar', name: 'MTTR', data: trend.mttr, barMaxWidth: 20, itemStyle: { color: '#8b5cf6' }, markLine: { symbol: 'none', lineStyle: { color: '#f8646f', type: 'dashed' }, label: { formatter: 'SLA 60 min', color: '#f8646f', fontSize: 10 }, data: [{ yAxis: trend.target }] } },
              ],
            }}
          />
        </Card>
      </div>

      <div className="grid g2">
        <Card title={<><LifeBuoy size={15} style={{ verticalAlign: -2 }} /> IR retainer</>} sub={`HexaSOC Incident Response · renews in ${ret.renewsDays} days`} toneColor={tone} tinted>
          <div className="row" style={{ gap: 20, alignItems: 'center' }}>
            <Ring value={ret.used} max={ret.hours} size={96} stroke={9} color={tone} sub="h used">{ret.used}</Ring>
            <div style={{ flex: 1 }}>
              <KV rows={[
                ['Hours', `${ret.used} used · ${ret.hours - ret.used} remaining of ${ret.hours}`],
                ['This scope', tenantId === 'all' ? 'Group retainer' : `${ret.usedScoped} h attributed to ${tenantShort(c, tenantId)}`],
                ['Remote response', `${ret.remoteSla} from first call`],
                ['On-site response', ret.onsiteSla],
                ['Tabletops this year', `${ret.tabletops} · last ${ret.lastTabletopDays} days ago`],
              ]} />
            </div>
          </div>
        </Card>
        <Card title={<><BookOpen size={15} style={{ verticalAlign: -2 }} /> Playbooks in use</>} sub={`${c.sector} playbooks, agreed with ${c.people.socLead.name}`} flush>
          <DataTable
            rows={pbs}
            rowKey={(r) => r.name}
            pageSize={8}
            columns={[
              { key: 'n', header: 'Playbook', sort: (r) => r.name, render: (r) => <span className="t-main">{r.name}</span> },
              { key: 'runs', header: 'Runs', align: 'right', sort: (r) => r.runs, render: (r) => r.runs },
              { key: 'auto', header: 'Automated steps', sort: (r) => r.automated, render: (r) => (<div style={{ minWidth: 110 }}><Bar value={r.automated} color={tone} size="thin" /><span className="t-sub">{r.automated}% of {r.steps} steps</span></div>) },
              { key: 'tested', header: 'Last tested', align: 'right', sort: (r) => r.lastTested, render: (r) => <span style={{ color: r.lastTested > 90 ? 'var(--warn)' : undefined }}>{r.lastTested} d ago</span> },
            ]}
          />
        </Card>
      </div>

      {sel && <IncidentDrawer inc={sel} onClose={() => setSel(null)} onAction={setWb} />}
      {panel === 'clocks' && (
        <RecordsDrawer title="Regulatory clocks running" sub={`${clocksNow.length} notification deadlines across open incidents`} source="HexaSOC regulatory clock engine · tenant regimes" icon={<Clock />} onClose={() => setPanel(null)}
          rows={clocksNow.map((k, i) => ({ id: `${k.inc.id}-${i}`, title: k.name, sub: `${k.inc.id} · ${tenantShort(c, k.inc.tenantId)} · ${k.regulator}`, right: <span className="num" style={{ fontWeight: 700, color: k.deadlineMin - k.elapsedMin < 0 ? 'var(--bad)' : 'var(--sev-high)' }}>{k.deadlineMin - k.elapsedMin < 0 ? 'Overdue' : fmtDur(k.deadlineMin - k.elapsedMin)}</span>, onClick: () => { setPanel(null); setSel(k.inc); } }))} />
      )}
      {panel === 'tta' && (
        <RecordsDrawer title="Time to acknowledge" sub="Open incidents, slowest first" source={`HexaSOC case timeline · ${tools.siemShort}`} icon={<Clock />} onClose={() => setPanel(null)}
          rows={open.slice().sort((a, b) => b.ttaMin - a.ttaMin).map((i) => ({ id: i.id, title: i.title, sub: `${i.id} · ${i.sev} · ${i.assignee}`, right: <span className="num" style={{ fontWeight: 700 }}>{i.ttaMin} min</span>, onClick: () => { setPanel(null); setSel(i); } }))} />
      )}
      {panel === 'retainer' && (
        <RecordsDrawer title="IR retainer hours" sub={`${ret.used} of ${ret.hours} hours used · renews in ${ret.renewsDays} days`} source="HexaSOC IR retainer ledger" icon={<LifeBuoy />} onClose={() => setPanel(null)}
          rows={incs.filter((i) => i.sev === 'critical' || i.sev === 'high').slice(0, 12).map((i, n) => ({ id: i.id, title: i.title, sub: `${i.id} · ${tenantShort(c, i.tenantId)} · ${i.status}`, right: <span className="num" style={{ fontWeight: 700 }}>{Math.max(2, Math.round((ret.used / 12) * (1.6 - n * 0.09)))} h</span>, onClick: () => { setPanel(null); setSel(i); } }))} />
      )}
      {wb && <WriteBackModal wb={wb} onClose={() => setWb(null)} />}
    </>
  );
}

function IncidentDrawer({ inc, onClose, onAction }: { inc: Incident; onClose: () => void; onAction: (w: WriteBack) => void }) {
  const { c, tone, nav } = useSoc();
  const t = socTools(c, inc.tenantId);
  const tl = incidentTimeline(c, inc);
  const clocks = regClocks(c, inc);
  const tenant = c.tenants.find((x) => x.id === inc.tenantId);
  const host = inc.hosts[0];
  const user = inc.users[0];
  const ioc = inc.iocs[0];
  const closed = inc.status === 'closed';
  const idpWrite = t.idps.find((k) => k.write.length);
  const netWrite = t.net.find((k) => k.write.length);

  const actions: { label: string; icon: typeof Laptop; wb?: WriteBack; disabled?: string }[] = [
    {
      label: `Isolate ${host}`,
      icon: Laptop,
      disabled: !t.edr ? `No EDR on ${tenant?.short}` : undefined,
      wb: t.edr ? { title: `Isolate host ${host}`, system: toolShort(t.edr), target: host, risk: 'high', changes: [`${toolShort(t.edr)} network-contains ${host}; only the EDR channel stays open`, 'Users on the host are disconnected; business owner notified', `Linked to ${inc.id}; release requires the same approvals`], done: `Isolation of ${host} requested`, rollback: 'Release containment from HexaView or the EDR console' } : undefined,
    },
    {
      label: user ? `Revoke sessions for ${user}` : 'Revoke sessions',
      icon: KeyRound,
      disabled: !user ? 'No user entity' : !idpWrite ? 'No identity write-back' : undefined,
      wb: user && idpWrite ? { title: `Revoke sessions for ${user}`, system: toolShort(idpWrite), target: user, risk: 'high', changes: [`${toolShort(idpWrite)}: ${idpWrite.write[0]} for ${user} (all devices)`, 'Refresh tokens invalidated; user must re-authenticate with MFA', 'VIP watch notified; service desk briefed to expect a call'], done: `Session revocation for ${user} requested` } : undefined,
    },
    {
      label: 'Add IOC to block list',
      icon: Ban,
      disabled: !t.edr ? 'No EDR write-back' : undefined,
      wb: t.edr ? { title: 'Add indicator of compromise', system: toolShort(t.edr), target: inc.iocs.join(', '), risk: 'medium', changes: [`${toolShort(t.edr)}: ${t.edr.write[0] ?? 'Add custom indicator'} (${inc.iocs.length} indicators, action: block and alert)`, 'Scope: all devices in the tenant', 'Expires in 90 days unless renewed'], done: `IOC block for ${ioc} requested` } : undefined,
    },
    ...(netWrite
      ? [{
          label: `Block at ${toolShort(netWrite)}`,
          icon: Globe,
          wb: { title: `Block ${ioc} at ${toolShort(netWrite)}`, system: toolShort(netWrite), target: ioc, risk: 'medium' as const, changes: [`${toolShort(netWrite)}: ${netWrite.write[0]} → ${ioc}`, 'Applies to all egress for the tenant', 'Logged with incident reference'], done: `Network block for ${ioc} requested` },
        }]
      : []),
  ];

  return (
    <Drawer
      wide
      title={inc.title}
      sub={<span className="row wrap" style={{ gap: 6 }}><span className="mono">{inc.id}</span><SevBadge sev={inc.sev} /><StatusBadge value={inc.status} map={INC_STATUS_COLOR} />{inc.disposition && <Badge>{inc.disposition}</Badge>}</span>}
      icon={<IcoBox color={tone}><Siren /></IcoBox>}
      onClose={onClose}
    >
      <div className="stack" style={{ gap: 18 }}>
        <KV rows={[
          ['Tenant', `${tenant?.name} (${tenant?.city})`],
          ['Assignee', inc.assignee],
          ['Playbook', inc.playbook],
          ['Opened', `${fmtAgo(inc.openedMin)} · acknowledged in ${inc.ttaMin} min`],
          [closed ? 'Duration' : 'Open for', fmtDur(inc.durationMin)],
          ['Source tools', <Sources key="s" items={inc.sources.map((n) => ({ name: n, status: c.connectors.find((k) => toolShort(k) === n)?.status ?? 'healthy' }))} />],
          ['ATT&CK', <span key="a" className="stack" style={{ gap: 3 }}>{inc.techniques.map((x) => <span key={x}><span className="soc-tech">{x}</span> {techName(x)}</span>)}</span>],
          ...(inc.actor ? [['Tradecraft overlap', `${inc.actor} (HexaInt, medium confidence)`] as [string, string]] : []),
          ['Correlated alerts', fmtNum(inc.alerts)],
        ]} />

        {inc.sev !== 'low' && (
          <div className="row wrap" style={{ gap: 8 }}>
            <Btn sm color="var(--m-ir)" onClick={() => nav(`/incident-response/escalations?soc=${inc.id}`)} title="Escalate to L4 Incident Response, or open the incident if one is already declared">
              <Siren size={14} /> {inc.status === 'closed' ? 'Open in Incident Response' : 'Escalate to IR (L4) / open in Incident Response'}
            </Btn>
          </div>
        )}

        <div>
          <div className="section-label">Containment (write-back)</div>
          {inc.ot ? (
            <OtReadOnly>Affected systems are OT. HexaSOC recommends actions to the site OT lead ({c.people.otLead?.name ?? 'OT lead'}); nothing is sent to controllers.</OtReadOnly>
          ) : closed ? (
            <div className="muted" style={{ fontSize: 12 }}>Incident closed; containment actions are no longer offered.</div>
          ) : (
            <div className="row wrap" style={{ gap: 8 }}>
              {actions.map((a) => (
                <Btn key={a.label} sm disabled={!!a.disabled} title={a.disabled} onClick={() => a.wb && onAction(a.wb)} color={a.wb ? RISK_COLOR[a.wb.risk] : undefined}>
                  <a.icon size={14} /> {a.label} {a.wb && <Badge color={RISK_COLOR[a.wb.risk]}>{a.wb.risk}</Badge>}
                </Btn>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="section-label"><Clock size={11} style={{ verticalAlign: -1 }} /> Regulatory clocks · {tenant?.regimes.join(', ')}</div>
          {clocks.length ? clocks.map((k) => <ClockBar key={k.name} {...k} />) : <div className="muted" style={{ fontSize: 12 }}>No notification obligations triggered ({inc.sev} severity{inc.personal ? '' : ', no personal data'}). Re-evaluated if severity changes.</div>}
        </div>

        <div className="grid g2" style={{ gap: 14 }}>
          <div>
            <div className="section-label">Affected entities</div>
            <div className="stack" style={{ gap: 6, fontSize: 12.5 }}>
              {inc.hosts.map((x) => <span key={x}><Badge color={tone}>{inc.ot ? 'OT asset' : 'Host'}</Badge> <span className="mono">{x}</span></span>)}
              {inc.users.map((x) => <span key={x}><Badge color="var(--m-int)">User</Badge> {x}</span>)}
              {inc.personal && <span><Badge color="var(--sev-medium)">Data</Badge> Personal data potentially in scope</span>}
              {inc.card && <span><Badge color="var(--sev-high)">Data</Badge> Cardholder data environment</span>}
              {inc.leak && <span><Badge color="var(--m-custody)">Content</Badge> Pre-release content (HexaCustody lineage attached)</span>}
            </div>
          </div>
          <div>
            <div className="section-label">Indicators</div>
            <div className="stack" style={{ gap: 4 }}>
              {inc.iocs.map((x) => <span key={x} className="mono" style={{ fontSize: 11.5 }}>{x}</span>)}
            </div>
          </div>
        </div>

        <div>
          <div className="section-label">Timeline</div>
          <Timeline items={tl.map((e) => ({ time: fmtAgo(e.min), title: e.title, body: e.body, color: e.kind === 'detect' ? 'var(--sev-high)' : e.kind === 'agent' ? tone : e.kind === 'action' ? 'var(--sev-medium)' : e.kind === 'close' ? 'var(--good)' : 'var(--accent)' }))} />
        </div>
      </div>
    </Drawer>
  );
}
