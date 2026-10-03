import { useMemo, useState } from 'react';
import { Crosshair, Plus, Target } from 'lucide-react';
import { Card, KpiStrip, Badge, StatusBadge, KV, Btn, IcoBox, Bar, Sources, Callout, Legend } from '../../components/ui';
import { Chart, PALETTE } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { hunts, actorTechniques, techName, techTactic, type Hunt, type HuntOutcome } from '../../data/modules/soc';
import { TACTICS, TECHNIQUES } from '../../data/reference';
import { fmtCompact, fmtNum } from '../../lib/format';
import { useSoc, tenantShort, TechChips, CodeBlock, RecordsDrawer } from './parts';

const OUTCOME_COLOR: Record<HuntOutcome, string> = {
  'Detection created': '#8b5cf6',
  'No evidence found': '#8a9bc0',
  'Hygiene issue raised': '#f5a83d',
  'Findings → incident': '#e0345e',
};
const VERDICT_COLOR: Record<string, string> = { Malicious: 'var(--sev-critical)', Suspicious: 'var(--sev-high)', 'Needs owner': 'var(--sev-medium)', Benign: 'var(--good)' };

export default function SocHunting() {
  const { c, tenantId, days, h, tools, tone, scopeLabel, rangeText, nav, toast } = useSoc();
  const hs = useMemo(() => hunts(c, tenantId, days), [c, tenantId, days]);
  const active = hs.filter((x) => x.status === 'active');
  const done = hs.filter((x) => x.status === 'concluded');
  const [sel, setSel] = useState<Hunt | null>(null);
  const [panel, setPanel] = useState<'active' | 'done' | 'findings' | 'scanned' | null>(null);
  const huntSrc = `${tools.siemShort}${tools.edr ? ` · ${tools.edrShort}` : ''} · HexaInt`;

  const findings = hs.reduce((n, x) => n + x.findings, 0);
  const dets = hs.reduce((n, x) => n + x.detections, 0);
  const scanned = hs.reduce((n, x) => n + x.eventsScanned, 0);
  const outcomes = (Object.keys(OUTCOME_COLOR) as HuntOutcome[]).map((o) => ({ name: o, value: done.filter((x) => x.outcome === o).length }));

  // Hunt coverage by tactic: distinct techniques hunted vs techniques in the tactic.
  const hunted = new Set(hs.flatMap((x) => x.techniques));
  const actorTech = new Set(c.vocab.threatActors.flatMap(actorTechniques));
  const byTactic = TACTICS.map((t) => {
    const ts = TECHNIQUES.filter((x) => x.tactic === t.name);
    return { name: t.short, hunted: ts.filter((x) => hunted.has(x.id)).length, priority: ts.filter((x) => actorTech.has(x.id) && !hunted.has(x.id)).length, rest: ts.filter((x) => !hunted.has(x.id) && !actorTech.has(x.id)).length };
  });
  const actors = c.vocab.threatActors.map((a) => ({ a, n: hs.filter((x) => x.actor === a).length })).sort((x, y) => y.n - x.n);

  return (
    <>
      <p className="page-intro">
        <b>{scopeLabel}</b> · hypothesis-led hunts driven by HexaInt intelligence and HexaMatrix gaps, run against {tools.siemShort} in {tools.ql}
        {tools.edr ? ` and ${tools.edrShort} telemetry` : ''}. Priority actors for {c.sector.toLowerCase()}: {c.vocab.threatActors.slice(0, 3).join(', ')}.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Active hunts', value: h.soc.huntsActive, hint: 'now', onClick: () => setPanel('active'), source: huntSrc },
          { label: 'Concluded', value: done.length, hint: rangeText.toLowerCase(), onClick: () => setPanel('done'), source: huntSrc },
          { label: 'Findings', value: findings, hint: 'confirmed + suspicious', onClick: () => setPanel('findings'), source: huntSrc },
          { label: 'Detections created', value: dets, hint: 'from hunts', delta: { text: `${Math.round((done.filter((x) => x.detections > 0).length / Math.max(1, done.length)) * 100)}% of hunts → rule`, good: true }, to: '/soc/detection', source: 'HexaSOC detection CI' },
          { label: 'Events scanned', value: fmtCompact(scanned), onClick: () => setPanel('scanned'), source: `${tools.siemShort} search jobs` },
          { label: 'Techniques hunted', value: hunted.size, unit: `of ${TECHNIQUES.length}`, to: '/soc/attack', source: 'HexaMatrix' },
        ]}
      />

      <div className="grid g-2-1">
        <Card title="Active hunts" count={active.length} sub="Click for hypothesis, queries and results" actions={<Btn sm onClick={() => toast(`Hunt request logged with HexaSOC for ${c.short}; an analyst will propose a hypothesis within 1 business day`)}><Plus size={13} /> Request a hunt</Btn>}>
          <div className="stack" style={{ gap: 10 }}>
            {active.map((x) => (
              <button key={x.id} className="list-row" style={{ alignItems: 'flex-start' }} onClick={() => setSel(x)}>
                <IcoBox color={tone}><Crosshair /></IcoBox>
                <span className="list-main" style={{ display: 'grid', gap: 5 }}>
                  <b style={{ whiteSpace: 'normal' }}>{x.name}</b>
                  <span style={{ whiteSpace: 'normal' }}>{x.hypothesis}</span>
                  <span className="row wrap" style={{ gap: 6 }}>
                    <Badge color="var(--m-int)">{x.actor}</Badge>
                    <TechChips ids={x.techniques} max={4} />
                    <span className="muted" style={{ fontSize: 11 }}>{x.analyst} · {tenantShort(c, x.tenantId)} · day {x.startedDaysAgo}</span>
                  </span>
                  <span className="row" style={{ gap: 8 }}>
                    <span style={{ flex: 1 }}><Bar value={x.progress} color={tone} size="thin" /></span>
                    <span className="muted" style={{ fontSize: 11 }}>{x.progress}% · {x.findings} findings so far</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Hunt outcomes" sub={`${done.length} concluded hunts · ${rangeText.toLowerCase()}`}>
          <Chart
            height={200}
            option={{
              tooltip: { trigger: 'item' },
              series: [{ type: 'pie', radius: ['52%', '78%'], label: { show: false }, data: outcomes.map((o) => ({ name: o.name, value: o.value, itemStyle: { color: OUTCOME_COLOR[o.name] } })) }],
              graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text: `${done.length}\nhunts`, align: 'center', fill: '#8b5cf6', fontSize: 16, fontWeight: 700 } }],
            }}
          />
          <Legend items={outcomes.map((o) => ({ label: `${o.name} ${o.value}`, color: OUTCOME_COLOR[o.name] }))} />
          <div className="section-label" style={{ marginTop: 14 }}>Actors hunted</div>
          <div className="stack" style={{ gap: 4 }}>
            {actors.map((a) => (
              <div key={a.a} className="row" style={{ fontSize: 12 }}>
                <span style={{ flex: 1 }}>{a.a}</span>
                <span className="num muted">{a.n}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Hunt coverage by tactic" sub="Techniques hunted in this period vs priority techniques for your threat actors that have not been hunted" actions={<button className="link" onClick={() => nav('/soc/attack')}>Open HexaMatrix →</button>}>
        <Chart
          height={250}
          option={{
            grid: { left: 4, right: 10, top: 30, bottom: 4, containLabel: true },
            legend: { top: 0 },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            xAxis: { type: 'category', data: byTactic.map((t) => t.name), axisLabel: { interval: 0, rotate: 30, fontSize: 10 } },
            yAxis: { type: 'value', minInterval: 1 },
            series: [
              { name: 'Hunted', type: 'bar', stack: 't', itemStyle: { color: '#8b5cf6', borderRadius: 0 }, data: byTactic.map((t) => t.hunted) },
              { name: 'Actor technique, not hunted', type: 'bar', stack: 't', itemStyle: { color: '#f5a83d', borderRadius: 0 }, data: byTactic.map((t) => t.priority) },
              { name: 'Other techniques', type: 'bar', stack: 't', itemStyle: { color: 'rgba(138,155,192,.35)', borderRadius: [3, 3, 0, 0] }, data: byTactic.map((t) => t.rest) },
            ],
          }}
        />
      </Card>

      <Card title="Hunt history" count={hs.length} sub="Every hunt, its hypothesis, outcome and the detections it produced" flush>
        <DataTable
          rows={hs}
          rowKey={(r, i) => `${r.id}-${i}`}
          onRowClick={setSel}
          search={(r) => `${r.id} ${r.name} ${r.actor} ${r.techniques.join(' ')} ${r.analyst}`}
          searchPlaceholder="Filter hunts…"
          initialSort={{ key: 'started', dir: 'asc' }}
          columns={[
            { key: 'id', header: 'ID', render: (r) => <span className="mono">{r.id}</span> },
            { key: 'name', header: 'Hunt', sort: (r) => r.name, render: (r) => (<><div className="t-main">{r.name}</div><div className="t-sub">Trigger: {r.trigger}</div></>) },
            { key: 'actor', header: 'Actor', sort: (r) => r.actor, render: (r) => <span className="nowrap">{r.actor}</span> },
            { key: 'tech', header: 'Techniques', render: (r) => <TechChips ids={r.techniques} max={3} /> },
            { key: 'status', header: 'Status', sort: (r) => r.status, render: (r) => (r.status === 'active' ? <StatusBadge value="active" map={{ active: tone }} /> : <Badge color={OUTCOME_COLOR[r.outcome as HuntOutcome]} dot>{r.outcome}</Badge>) },
            { key: 'tenant', header: 'Tenant', render: (r) => tenantShort(c, r.tenantId) },
            { key: 'find', header: 'Findings', align: 'right', sort: (r) => r.findings, render: (r) => r.findings },
            { key: 'det', header: 'Detections', align: 'right', sort: (r) => r.detections, render: (r) => (r.detections ? <b style={{ color: tone }}>{r.detections}</b> : '—') },
            { key: 'started', header: 'Started', align: 'right', sort: (r) => r.startedDaysAgo, render: (r) => `${r.startedDaysAgo} d ago` },
          ]}
        />
      </Card>

      {panel && (() => {
        const list = panel === 'active' ? active : panel === 'done' ? done : panel === 'findings' ? hs.filter((x) => x.findings > 0) : hs.slice().sort((a, b) => b.eventsScanned - a.eventsScanned);
        const title = panel === 'active' ? 'Active hunts' : panel === 'done' ? 'Concluded hunts' : panel === 'findings' ? 'Hunts with findings' : 'Events scanned per hunt';
        return (
          <RecordsDrawer title={title} source={huntSrc} icon={<Crosshair />} onClose={() => setPanel(null)}
            rows={list.map((x) => ({ id: x.id, title: x.name, sub: `${x.id} · ${x.actor} · ${tenantShort(c, x.tenantId)} · ${x.analyst}`, right: <span className="num" style={{ fontWeight: 700 }}>{panel === 'scanned' ? fmtCompact(x.eventsScanned) : panel === 'findings' ? `${x.findings} findings` : x.status === 'active' ? `${x.progress}%` : x.outcome}</span>, onClick: () => { setPanel(null); setSel(x); } }))} />
        );
      })()}
      {sel && (
        <Drawer wide title={sel.name} sub={`${sel.id} · ${sel.status === 'active' ? `active, ${sel.progress}%` : sel.outcome} · ${tenantShort(c, sel.tenantId)}`} icon={<IcoBox color={tone}><Target /></IcoBox>} onClose={() => setSel(null)}>
          <div className="stack" style={{ gap: 18 }}>
            <Callout>
              <b>Hypothesis.</b> {sel.hypothesis}
            </Callout>
            <KV rows={[
              ['Threat actor', sel.actor],
              ['ATT&CK', <span key="t" className="stack" style={{ gap: 3 }}>{sel.techniques.map((x) => <span key={x}><span className="soc-tech">{x}</span> {techName(x)}</span>)}</span>],
              ['Trigger', sel.trigger],
              ['Hunter', sel.analyst],
              ['Data sources', <Sources key="s" items={sel.sources.map((n) => ({ name: n, status: c.connectors.find((k) => n.includes(k.product) || k.product.includes(n))?.status ?? 'healthy' }))} />],
              ['Window', `${sel.startedDaysAgo} days ago · ${sel.durationDays} days of telemetry`],
              ['Events scanned', fmtNum(sel.eventsScanned)],
              ['Hits reviewed', `${sel.hits} → ${sel.findings} findings`],
            ]} />
            <div>
              <div className="section-label">Hunt query · {tools.qlLong}</div>
              <CodeBlock code={sel.query} lang={tools.ql} />
            </div>
            <div>
              <div className="section-label">Results</div>
              <table className="tbl">
                <thead><tr><th>Entity</th><th>Observation</th><th>Verdict</th></tr></thead>
                <tbody>
                  {sel.results.map((r, i) => (
                    <tr key={i}>
                      <td className="mono" style={{ fontSize: 12 }}>{r.entity}</td>
                      <td>{r.detail}</td>
                      <td><Badge color={VERDICT_COLOR[r.verdict]} dot>{r.verdict}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div className="section-label">Outcome</div>
              {sel.status === 'active' ? (
                <div className="muted" style={{ fontSize: 12.5 }}>In progress. Interim findings are shared with {c.people.socLead.name} at the weekly hunt review.</div>
              ) : (
                <div className="stack" style={{ gap: 8, fontSize: 12.5 }}>
                  <span><Badge color={OUTCOME_COLOR[sel.outcome as HuntOutcome]} solid>{sel.outcome}</Badge></span>
                  {sel.detections > 0 && (
                    <span>
                      {sel.detections} detection{sel.detections > 1 ? 's' : ''} written as code and deployed to {tools.siemShort}.{' '}
                      <button className="link" onClick={() => nav('/soc/detection')}>View in Detection Engineering →</button>
                    </span>
                  )}
                  {sel.outcome === 'Findings → incident' && <span>Escalated to Incident Response; see the incident queue.</span>}
                  {sel.outcome === 'Hygiene issue raised' && <span>Hygiene issue raised with the asset owner via {c.connectors.find((k) => k.category === 'ITSM')?.product}.</span>}
                </div>
              )}
            </div>
            <div className="chips">
              {sel.techniques.map((t, i) => <span key={t} className="src-chip"><i style={{ background: PALETTE[i % PALETTE.length] }} />{techTactic(t)}</span>)}
            </div>
          </div>
        </Drawer>
      )}
    </>
  );
}
