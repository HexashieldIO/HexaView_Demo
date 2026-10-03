import { useMemo, useState } from 'react';
import { Server, User, Bot, Radar, ArrowRight, Crown, Bell, Gauge } from 'lucide-react';
import { Card, KpiStrip, Badge, SevBadge, HealthBadge, Freshness, Sources, Legend, Ring, KV, Btn, Callout, IcoBox, BarRow, cap } from '../../components/ui';
import { FlowMap } from '../../components/FlowMap';
import { Chart, PALETTE, SEV_HEX } from '../../components/Chart';
import { Drawer } from '../../components/Overlay';
import { isStale } from '../../data/customers';
import { incidents, mdrData, type Incident } from '../../data/modules/soc';
import { fmtAgo, fmtCompact, fmtNum, fmtPct } from '../../lib/format';
import type { Severity } from '../../data/types';
import { SlaMotion } from './SlaMotion';
import { useSoc, tenantShort, TechChips, INC_STATUS_COLOR, RecordsDrawer, SegBar, RankList } from './parts';

const SLA = { mttd: 15, mtta: 15, mttr: 60 };

type Sel =
  | { kind: 'asset'; name: string; alerts: number; crown: boolean; sev: Severity }
  | { kind: 'user'; name: string; role: string; alerts: number; vip: boolean }
  | { kind: 'system'; idx: number };

export default function SocMdr() {
  const { c, tenantId, days, h, tools, tone, tenants, scopeLabel, nav, rangeText, timeRange } = useSoc();
  const s = h.soc;
  const d = useMemo(() => mdrData(c, tenantId, days), [c, tenantId, days]);
  const incs = useMemo(() => incidents(c, tenantId, days), [c, tenantId, days]);
  const open = incs.filter((i) => i.status !== 'closed');
  const [sel, setSel] = useState<Sel | null>(null);
  const [panel, setPanel] = useState<'alerts' | 'sla' | null>(null);
  const src = `${tools.siemShort}${tools.edr ? ` · ${tools.edrShort}` : ''} · ${tools.idpShort}`;
  const incUrl = (i: Incident) => `/soc/ir?status=${i.status === 'closed' ? 'closed' : 'open'}&id=${i.id}`;

  const staleSources = c.connectors.filter((k) => ['SIEM', 'EDR / XDR', 'Identity', 'OT', 'Email', 'Network'].includes(k.category) && (k.status !== 'healthy' || isStale(k)));
  const srcChips = d.bySource.map((x) => ({ name: x.name, status: x.status }));

  // Open incidents stacked by tenant and severity: sums to the headline exactly.
  const tenantIds = Array.from(new Set(open.map((i) => i.tenantId)));
  const sevs: Severity[] = ['critical', 'high', 'medium', 'low'];

  const relatedTo = (pred: (i: Incident) => boolean) => incs.filter(pred).slice(0, 5);

  const handoverLead = c.people.socLead;
  const critical = open.find((i) => i.sev === 'critical');
  const nextHigh = open.filter((i) => i.sev === 'high').slice(0, 2);
  const degraded = d.watched.filter((w) => w.status !== 'healthy');

  return (
    <>
      <p className="page-intro">
        <b>{scopeLabel}</b> · 24/7 detection and response by HexaSOC agents and analysts, watched through {tools.siemShort}
        {tools.edr ? `, ${tools.edrShort}` : ''} and {tools.idpShort}
        {tools.ot.length ? `, with ${tools.ot.map((k) => k.product).join(' and ')} for OT` : ''}. {rangeText}.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Open incidents', hint: `${s.critical} critical · ${s.high} high`, value: s.openIncidents, to: '/soc/ir?status=open', toneColor: s.critical ? 'var(--sev-critical)' : tone, source: src },
          { label: 'MTTD', hint: `SLA ${SLA.mttd} min`, value: s.mttdMin, unit: 'min', bar: (s.mttdMin / SLA.mttd) * 100, delta: { text: `${SLA.mttd - s.mttdMin} min inside SLA`, good: true }, onClick: () => setPanel('sla'), source: 'HexaSOC case timeline' },
          { label: 'MTTA', hint: `SLA ${SLA.mtta} min`, value: s.mttaMin, unit: 'min', bar: (s.mttaMin / SLA.mtta) * 100, delta: { text: `${SLA.mtta - s.mttaMin} min inside SLA`, good: true }, onClick: () => setPanel('sla'), source: 'HexaSOC case timeline' },
          { label: 'MTTR (contain)', hint: `SLA ${SLA.mttr} min`, value: s.mttrMin, unit: 'min', bar: (s.mttrMin / SLA.mttr) * 100, delta: { text: `${SLA.mttr - s.mttrMin} min inside SLA`, good: true }, to: '/soc/ir?status=closed', source: 'HexaSOC case timeline' },
          { label: 'SLA met', hint: '30 d', value: s.slaPct.toFixed(2), unit: '%', bar: s.slaPct, onClick: () => setPanel('sla'), source: 'HexaSOC service ledger' },
          { label: 'Alerts', hint: timeRange, value: fmtCompact(d.alerts), delta: { text: `${s.autoTriagedPct}% auto-triaged`, good: true }, onClick: () => setPanel('alerts'), source: src },
        ]}
      />

      <div className="grid g-2-1">
        <Card title="Speed against SLA" sub="Median per incident, critical and high · 30-day trend" actions={<Sources items={srcChips.slice(0, 4)} />}>
          <SlaMotion
            introKey={`${c.id}-${tenantId}-${days}`}
            metrics={[
              { key: 'mttd', label: 'Mean time to detect', value: s.mttdMin, sla: SLA.mttd, series: d.mttTrend.mttd, color: PALETTE[0] },
              { key: 'mtta', label: 'Mean time to acknowledge', value: s.mttaMin, sla: SLA.mtta, series: d.mttTrend.mtta, color: PALETTE[1] },
              { key: 'mttr', label: 'Mean time to contain', value: s.mttrMin, sla: SLA.mttr, series: d.mttTrend.mttr, color: PALETTE[2] },
            ]}
            onOpen={() => setPanel('sla')}
          />
        </Card>

        <Card title="Open incidents" count={open.length} sub="By tenant and severity" actions={<button className="link" onClick={() => nav('/soc/ir')}>Incident queue →</button>}>
          <Chart
            height={150}
            onClick={() => nav('/soc/ir?status=open')}
            option={{
              grid: { left: 4, right: 8, top: 24, bottom: 4, containLabel: true },
              legend: { top: 0, data: sevs.map(cap) },
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              xAxis: { type: 'value', minInterval: 1 },
              yAxis: { type: 'category', data: tenantIds.map((t) => tenantShort(c, t)) },
              series: sevs.map((sv) => ({ name: cap(sv), type: 'bar', stack: 'sev', barMaxWidth: 16, itemStyle: { color: SEV_HEX[sv], borderRadius: 0 }, data: tenantIds.map((t) => open.filter((i) => i.tenantId === t && i.sev === sv).length) })),
            }}
          />
          {critical && (
            <button className="list-row" onClick={() => nav(incUrl(critical))} style={{ marginTop: 6 }}>
              <SevBadge sev="critical" />
              <span className="list-main">
                <b>{critical.title}</b>
                <span>{critical.id} · {tenantShort(c, critical.tenantId)} · {critical.status} · {fmtAgo(critical.openedMin)}</span>
              </span>
              <ArrowRight size={14} className="muted" />
            </button>
          )}
        </Card>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <Card title="Alert funnel" sub={`${fmtNum(d.alerts)} alerts → ${fmtNum(d.incidents)} incidents · HexaSOC agents close ${s.autoTriagedPct}% with an explained verdict`}>
          <FlowMap
            height={300}
            columns={[
              { label: 'Sources', nodes: d.bySource.map((x, i) => ({ id: `src-${i}`, title: x.name, count: fmtCompact(x.value), sub: x.status === 'healthy' ? 'alerts' : x.status, state: x.status === 'healthy' ? undefined : ('warn' as const), color: PALETTE[i % PALETTE.length], onClick: () => setPanel('alerts') })) },
              { label: 'Ingested', nodes: [{ id: 'in', title: 'Alerts ingested', count: fmtCompact(d.alerts), sub: rangeText.toLowerCase(), color: '#8b5cf6', onClick: () => setPanel('alerts') }] },
              { label: 'HexaSOC agents', nodes: [
                { id: 'benign', title: 'Auto-closed: benign / duplicate', count: fmtCompact(d.autoClosed - d.autoFp), sub: 'explained verdict', state: 'good' as const },
                { id: 'fp', title: 'Auto-closed: false positive', count: fmtCompact(d.autoFp), sub: 'tuning ticket raised', color: '#93d65a', onClick: () => nav('/soc/detection') },
                { id: 'esc', title: 'Escalated to analysts', count: fmtNum(d.escalated), sub: `${100 - s.autoTriagedPct}%`, state: 'warn' as const },
              ] },
              { label: 'Outcome', nodes: [
                { id: 'aclosed', title: 'Closed by analysts', count: fmtNum(d.analystClosed), sub: 'no incident', color: '#8a9bc0', onClick: () => nav('/soc/ir?status=closed') },
                { id: 'inc', title: 'Incidents', count: fmtNum(d.incidents), sub: `${open.length} open`, state: 'bad' as const, onClick: () => nav('/soc/ir?status=open') },
              ] },
            ]}
            links={[
              ...d.bySource.map((x, i) => ({ from: `src-${i}`, to: 'in', value: x.value, color: PALETTE[i % PALETTE.length] })),
              { from: 'in', to: 'benign', value: d.autoClosed - d.autoFp, color: '#2dd4bf' },
              { from: 'in', to: 'fp', value: d.autoFp, color: '#93d65a' },
              { from: 'in', to: 'esc', value: d.escalated, color: '#f5a83d' },
              { from: 'esc', to: 'aclosed', value: d.analystClosed, color: '#8a9bc0' },
              { from: 'esc', to: 'inc', value: d.incidents, bad: true },
            ]}
          />
        </Card>
        <Card title="Investigation outcomes" sub={`${fmtNum(d.escalated)} escalated alerts · ${rangeText.toLowerCase()}`}>
          <SegBar parts={d.disposition.map((x, i) => ({ id: x.name, label: x.name, value: x.value, color: ['#e0345e', '#2dd4bf', '#8a9bc0', '#f5a83d'][i] }))} onPick={() => nav('/soc/ir?status=closed')} />
          <div style={{ marginTop: 14 }}>
            <RankList tone={tone} onPick={() => nav('/soc/ir?status=closed')} rows={d.disposition.map((x) => ({ id: x.name, label: x.name, value: x.value, display: `${fmtNum(x.value)} · ${fmtPct((x.value / Math.max(1, d.escalated)) * 100)}` }))} />
          </div>
          <div className="mini-stats" style={{ marginTop: 10 }}>
            <div className="mini-stat"><b style={{ color: 'var(--m-soc)' }}>{fmtPct((d.disposition[0].value / Math.max(1, d.escalated)) * 100)}</b><span>Escalation precision</span></div>
            <div className="mini-stat"><b>{fmtCompact(d.autoClosed)}</b><span>Closed by agents</span></div>
            <div className="mini-stat"><b>2.1%</b><span>Agent verdicts overturned</span></div>
          </div>
        </Card>
      </div>

      <div className="grid g-2-1">
        <Card title="Alert volume by source" sub={`Stacked by ${c.short}'s own connectors · ${rangeText.toLowerCase()}`} actions={<Legend items={d.series.map((x, i) => ({ label: x.name, color: PALETTE[i % PALETTE.length] }))} />}>
          <Chart
            height={260}
            option={{
              grid: { left: 4, right: 10, top: 10, bottom: 4, containLabel: true },
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: d.buckets, axisLabel: { interval: days <= 1 ? 3 : 'auto' } },
              yAxis: { type: 'value' },
              series: d.series.map((x, i) => ({ name: x.name, type: 'bar', stack: 'v', barMaxWidth: 22, itemStyle: { color: PALETTE[i % PALETTE.length], borderRadius: 0 }, data: x.data })),
            }}
          />
          {staleSources.length > 0 && (
            <div style={{ marginTop: 8 }} className="chips">
              {staleSources.map((k) => (
                <Freshness key={k.id} minutes={k.lastSyncMin} stale label={`${k.product}${k.note ? ` (${k.note})` : ''}`} />
              ))}
            </div>
          )}
        </Card>
        <Card title="Threats by ATT&CK tactic" sub="Escalated alerts mapped by HexaMatrix" actions={<button className="link" onClick={() => nav('/soc/attack')}>Coverage →</button>}>
          <RankList tone="#8b5cf6" onPick={() => nav('/soc/attack')} rows={d.tactics.slice().sort((a, b) => b.value - a.value).slice(0, 9).map((t) => ({ id: t.name, label: t.name, value: t.value, display: fmtNum(t.value) }))} />
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Most targeted assets" sub={`From ${tools.siemShort}${tools.edr ? ` and ${tools.edrShort}` : ''} · click for detail`}>
          <div className="stack" style={{ gap: 2 }}>
            {d.assets.map((a) => (
              <button key={a.name} className="list-row" onClick={() => setSel({ kind: 'asset', ...a })}>
                <IcoBox color={a.crown ? 'var(--sev-high)' : tone}>{a.crown ? <Crown /> : <Server />}</IcoBox>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <BarRow label={<span className="mono">{a.name}</span>} sub={a.crown ? 'Crown jewel' : undefined} value={a.alerts} max={d.assets[0].alerts} color={tone} display={fmtNum(a.alerts)} />
                </div>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Most targeted people" sub={`${tools.idpShort} identity risk + ${tools.email ? tools.email.product : 'email'} · VIPs on the watch list`}>
          <div className="stack" style={{ gap: 2 }}>
            {d.users.map((u) => (
              <button key={u.name} className="list-row" onClick={() => setSel({ kind: 'user', ...u })}>
                <IcoBox color={u.vip ? 'var(--m-int)' : tone}><User /></IcoBox>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <BarRow label={u.name} sub={`${u.role}${u.vip ? ' · VIP' : ''}`} value={u.alerts} max={d.users[0].alerts} color={u.vip ? 'var(--m-int)' : tone} display={fmtNum(u.alerts)} />
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g-3-2">
        <Card title="Systems we're watching" count={d.watched.length} sub="Telemetry HexaSOC depends on · honest health, never shown as zero" flush>
          <div className="list" style={{ padding: '0 18px 8px' }}>
            {d.watched.map((w, i) => (
              <button key={w.name} className="list-row" onClick={() => setSel({ kind: 'system', idx: i })}>
                <Ring value={w.coverage} size={38} stroke={4} color={w.status === 'healthy' ? 'var(--good)' : 'var(--sev-medium)'} />
                <span className="list-main">
                  <b>{w.name}</b>
                  <span>{w.category} · {fmtNum(w.eps)} events/min · coverage {w.coverage}%</span>
                </span>
                <span className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <HealthBadge status={w.status} />
                  <Freshness minutes={w.lastSyncMin} stale={w.status !== 'healthy' || w.lastSyncMin > w.intervalMin * 2} label={w.status !== 'healthy' ? w.name.split(' ').slice(-2).join(' ') : undefined} />
                </span>
              </button>
            ))}
          </div>
        </Card>
        <Card title={<><Bot size={16} style={{ verticalAlign: -3 }} /> HexaSOC agents</>} sub="Agents triage and enrich; humans approve every response" toneColor={tone} tinted>
          <div className="grid g2" style={{ gap: 8 }}>
            {d.agents.map((a) => (
              <div key={a.name} className="soc-agent" title={a.detail}>
                <b>{a.name}</b>
                <div className="num">{fmtCompact(a.count)}</div>
                <span>{a.unit}</span>
              </div>
            ))}
          </div>
          <div className="section-label" style={{ marginTop: 14 }}>Live agent activity</div>
          <div className="list">
            {d.agentFeed.slice(0, 5).map((f, i) => (
              <div key={i} className="list-row" style={{ padding: '7px 0' }}>
                <span className="list-main">
                  <b style={{ whiteSpace: 'normal', fontWeight: 500 }}>{f.text}</b>
                  <span>{f.agent} · {fmtAgo(f.min)}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Shift handover" sub={`HexaSOC ${new Date().getHours() < 14 ? 'night → day' : 'day → night'} shift · ${tenantId === 'all' ? c.short : tenants[0]?.short} · shared with ${handoverLead.name}`} actions={<Btn sm onClick={() => nav('/soc/ir')}>Open queue</Btn>}>
        <div className="soc-note">
          <p>
            <b>Summary.</b> {fmtNum(d.alerts)} alerts in {rangeText.toLowerCase()}, {s.autoTriagedPct}% closed by agents. {open.length} incidents open ({s.critical} critical, {s.high} high). All SLAs met; MTTR {s.mttrMin} min against a {SLA.mttr} min target.
          </p>
          <ul>
            {critical && <li><b>{critical.id}</b> (critical, {critical.status}): {critical.title}. {critical.ot ? 'OT read-only; site OT lead engaged.' : 'Containment approval in progress.'}</li>}
            {nextHigh.map((i) => (
              <li key={i.id}><b>{i.id}</b> (high, {i.status}): {i.title} · {tenantShort(c, i.tenantId)} · {i.assignee}</li>
            ))}
            <li>Active hunts: {s.huntsActive}. Watch item: {c.vocab.threatActors[0]} activity reported by HexaInt this week; detections reviewed.</li>
            {degraded.length > 0 && <li>Telemetry gaps: {degraded.map((w) => `${w.name} (${w.status}${w.note ? `: ${w.note}` : ''})`).join('; ')}. Analysts compensating with manual checks.</li>}
          </ul>
        </div>
      </Card>

      {sel && renderDrawer(sel, () => setSel(null))}
      {panel === 'alerts' && (
        <RecordsDrawer title="Alerts by source" sub={`${fmtNum(d.alerts)} alerts · ${rangeText.toLowerCase()} · ${s.autoTriagedPct}% closed by HexaSOC agents`} source={src} icon={<Bell />} onClose={() => setPanel(null)}
          rows={d.bySource.slice().sort((a, b) => b.value - a.value).map((x) => ({ id: x.name, title: x.name, sub: `${fmtPct((x.value / Math.max(1, d.alerts)) * 100)} of volume · ${x.status}`, right: <span className="num" style={{ fontWeight: 700 }}>{fmtNum(x.value)}</span> }))}>
          <Callout>Escalated: {fmtNum(d.escalated)} · became incidents: {fmtNum(d.incidents)}. <button className="link" onClick={() => nav('/soc/ir?status=all')}>Open incident queue →</button></Callout>
        </RecordsDrawer>
      )}
      {panel === 'sla' && (
        <RecordsDrawer title="Response times per incident" sub="Critical and high incidents in range · detect / acknowledge / contain" source="HexaSOC case timeline · service ledger" icon={<Gauge />} onClose={() => setPanel(null)}
          rows={incs.filter((i) => i.sev === 'critical' || i.sev === 'high').slice(0, 30).map((i) => ({ id: i.id, title: i.title, sub: `${i.id} · ${tenantShort(c, i.tenantId)} · ack ${i.ttaMin} min · ${i.status === 'closed' ? `contained in ${Math.round(i.durationMin)} min` : 'open'}`, right: <Badge color={i.ttaMin <= SLA.mtta ? 'var(--good)' : 'var(--bad)'}>{i.ttaMin <= SLA.mtta ? 'In SLA' : 'Breach'}</Badge>, onClick: () => nav(incUrl(i)) }))} />
      )}
    </>
  );

  function renderDrawer(sel: Sel, onClose: () => void) {
    if (sel.kind === 'system') {
      const w = d.watched[sel.idx];
      return (
        <Drawer title={w.name} sub={`${w.category} · feeds HexaSOC detection`} icon={<IcoBox color={tone}><Radar /></IcoBox>} onClose={onClose}>
          <div className="stack" style={{ gap: 16 }}>
            <KV rows={[
              ['Health', <HealthBadge key="h" status={w.status} />],
              ['Last sync', `${fmtAgo(w.lastSyncMin)} (interval ${w.intervalMin} min)`],
              ['Throughput', `${fmtNum(w.eps)} events/min`],
              ['Coverage of expected sources', `${w.coverage}%`],
              ['Note', w.note ?? 'No issues'],
            ]} />
            {w.status !== 'healthy' ? (
              <Callout kind="warn">
                <b>Degraded:</b> {w.note ?? 'feed delayed'}. Detections that depend on this source are flagged as partial in HexaMatrix until the feed recovers; no data is shown as zero.
              </Callout>
            ) : (
              <Callout kind="good">Feed healthy. Detections relying on this source are counted as live.</Callout>
            )}
          </div>
        </Drawer>
      );
    }
    const isAsset = sel.kind === 'asset';
    const rel = isAsset ? relatedTo((i) => i.hosts.includes(sel.name)) : relatedTo((i) => i.users.includes(sel.name));
    return (
      <Drawer title={sel.name} sub={isAsset ? (sel.crown ? 'Crown-jewel asset' : 'Server') : `${sel.role}${sel.vip ? ' · VIP watch list' : ''}`} icon={<IcoBox color={tone}>{isAsset ? <Server /> : <User />}</IcoBox>} onClose={onClose}>
        <div className="stack" style={{ gap: 16 }}>
          <KV rows={isAsset ? [
            ['Escalated alerts', fmtNum(sel.alerts)],
            ['Highest severity', <SevBadge key="s" sev={sel.sev} />],
            ['Crown jewel', sel.crown ? 'Yes (criticality 5)' : 'No'],
            ['Telemetry', `${tools.edr ? tools.edrShort : 'No EDR'} · ${tools.siemShort}`],
          ] : [
            ['Escalated alerts', fmtNum(sel.alerts)],
            ['Identity provider', tools.idpShort],
            ['VIP watch', sel.vip ? 'Yes: new device and location changes verified by phone' : 'No'],
            ['MFA', sel.vip ? 'Phishing-resistant (FIDO2)' : 'Push with number matching'],
          ]} />
          <div>
            <div className="section-label">Related incidents</div>
            {rel.length ? (
              <div className="list">
                {rel.map((i) => (
                  <button key={i.id} className="list-row" onClick={() => nav(incUrl(i))}>
                    <SevBadge sev={i.sev} />
                    <span className="list-main">
                      <b>{i.title}</b>
                      <span>{i.id} · <Badge color={INC_STATUS_COLOR[i.status]}>{i.status}</Badge> · {fmtAgo(i.openedMin)}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 12 }}>No incidents in {rangeText.toLowerCase()}; alerts were closed at triage.</div>
            )}
          </div>
          {rel[0] && (
            <div>
              <div className="section-label">Techniques seen</div>
              <TechChips ids={Array.from(new Set(rel.flatMap((i) => i.techniques)))} max={8} />
            </div>
          )}
        </div>
      </Drawer>
    );
  }
}

