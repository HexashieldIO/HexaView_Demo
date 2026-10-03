import { useMemo, useState } from 'react';
import { GitBranch, Rocket, PowerOff, FileCode2, CheckCircle2, XCircle, Loader2, Zap } from 'lucide-react';
import { Card, KpiStrip, Badge, SevBadge, StatusBadge, KV, Btn, Chip, IcoBox, Bar, Legend, Callout, cap } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { detectionData, type Rule, type RuleHealth, type RuleStage } from '../../data/modules/soc';
import { TECHNIQUE_BY_ID } from '../../data/reference';
import { fmtAgo, fmtNum } from '../../lib/format';
import { useSoc, CodeBlock, WriteBackModal, type WriteBack, RecordsDrawer } from './parts';

const STAGE_COLOR: Record<RuleStage, string> = { draft: '#8a9bc0', tested: '#68b1ff', staged: '#f5a83d', deployed: '#8b5cf6', tuned: '#2dd4bf' };
const HEALTH_HEX: Record<RuleHealth, string> = { healthy: '#2dd4bf', noisy: '#f5a83d', silent: '#8a9bc0', broken: '#e0345e' };
const HEALTH_VAR: Record<RuleHealth, string> = { healthy: 'var(--good)', noisy: 'var(--sev-medium)', silent: 'var(--sev-info)', broken: 'var(--bad)' };

export default function SocDetection() {
  const { c, tenantId, days, tools, tone, scopeLabel, nav, rangeText } = useSoc();
  const d = useMemo(() => detectionData(c, tenantId, days), [c, tenantId, days]);
  const [stage, setStage] = useState<RuleStage | 'all'>('all');
  const [health, setHealth] = useState<RuleHealth | 'all'>('all');
  const [sel, setSel] = useState<Rule | null>(null);
  const [wb, setWb] = useState<WriteBack | null>(null);
  const [intelOpen, setIntelOpen] = useState(false);
  const ruleSrc = `${tools.siemShort} analytic rules${tools.edr ? ` · ${tools.edrShort} custom detections` : ''}`;

  const inPipe = d.pipeline.filter((p) => p.stage === 'draft' || p.stage === 'tested' || p.stage === 'staged').reduce((n, p) => n + p.count, 0);
  const hcount = (k: RuleHealth) => d.health.find((x) => x.health === k)?.count ?? 0;
  const intelDone = d.intel.filter((x) => x.deployedH !== undefined);
  const intelMedian = intelDone.length ? intelDone.map((x) => x.deployedH as number).sort((a, b) => a - b)[Math.floor(intelDone.length / 2)] : 0;
  const rows = d.rules.filter((r) => (stage === 'all' || r.stage === stage) && (health === 'all' || r.health === health));
  const siemWrite = tools.siem.write[0] ?? 'Deploy rule';
  const pipeMax = Math.max(...d.pipeline.map((p) => p.count));

  return (
    <>
      <p className="page-intro">
        <b>{scopeLabel}</b> · detections as code, tested against your own telemetry and written back to {tools.siemShort}
        {tools.edr ? ` and ${tools.edrShort}` : ''} in {tools.ql}. {fmtNum(d.live)} rules live; every change goes through CI before it reaches production.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Live detections', value: fmtNum(d.live), hint: `${tools.siemShort}${tools.edr ? ` + ${tools.edrShort}` : ''}`, onClick: () => { setStage('deployed'); setHealth('all'); }, source: ruleSrc },
          { label: 'In pipeline', value: inPipe, hint: 'draft → staged', onClick: () => { setStage('staged'); setHealth('all'); }, source: 'HexaSOC detection CI (Git)' },
          { label: 'Healthy', value: Math.round((hcount('healthy') / d.live) * 100), unit: '%', bar: (hcount('healthy') / d.live) * 100, onClick: () => { setStage('all'); setHealth('healthy'); }, source: ruleSrc },
          { label: 'Noisy', value: hcount('noisy'), hint: 'FP > 35%', toneColor: 'var(--sev-medium)', onClick: () => { setStage('all'); setHealth('noisy'); }, source: ruleSrc },
          { label: 'Silent', value: hcount('silent'), hint: 'no fire 90 d', onClick: () => { setStage('all'); setHealth('silent'); }, source: ruleSrc },
          { label: 'Broken', value: hcount('broken'), hint: 'schema / source', toneColor: 'var(--bad)', onClick: () => { setStage('all'); setHealth('broken'); }, source: ruleSrc },
          { label: 'Intel → rule', value: intelMedian, unit: 'h', hint: 'median · SLA 72 h', bar: (intelMedian / 72) * 100, onClick: () => setIntelOpen(true), source: 'HexaInt advisories · detection CI' },
        ]}
      />

      <Card title="Detection lifecycle" sub="Draft → tested (replay against attack samples) → staged (shadow mode) → deployed → tuned" actions={<Legend items={(Object.keys(STAGE_COLOR) as RuleStage[]).map((s) => ({ label: cap(s), color: STAGE_COLOR[s] }))} />}>
        <div className="soc-pipe">
          {d.pipeline.map((p) => (
            <button key={p.stage} className="soc-pipe-step" style={{ textAlign: 'left', cursor: 'pointer', outline: stage === p.stage ? `2px solid ${STAGE_COLOR[p.stage]}` : undefined }} onClick={() => setStage(stage === p.stage ? 'all' : p.stage)}>
              <i style={{ background: STAGE_COLOR[p.stage] }} />
              <b>{fmtNum(p.count)}</b>
              <span>{p.stage}</span>
              <div style={{ marginTop: 8 }}><Bar value={p.count} max={pipeMax} color={STAGE_COLOR[p.stage]} size="thin" /></div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid g-2-1">
        <Card title="False-positive rate and tuning" sub="Share of escalated alerts closed as false positive · rules tuned per week">
          <Chart
            height={240}
            option={{
              grid: { left: 4, right: 4, top: 30, bottom: 4, containLabel: true },
              legend: { top: 0 },
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: d.fpTrend.labels },
              yAxis: [{ type: 'value', name: 'FP %', min: 0 }, { type: 'value', name: 'tuned', splitLine: { show: false } }],
              series: [
                { name: 'Rules tuned', type: 'bar', yAxisIndex: 1, data: d.fpTrend.tuned, barMaxWidth: 14, itemStyle: { color: 'rgba(45,212,191,.55)' } },
                { name: 'False-positive rate', type: 'line', data: d.fpTrend.fp, lineStyle: { color: '#8b5cf6', width: 2.5 }, itemStyle: { color: '#8b5cf6' }, areaStyle: { color: 'rgba(139,92,246,.12)' } },
              ],
            }}
          />
        </Card>
        <Card title="Rule health" sub={`${fmtNum(d.live)} live rules · click a slice to filter`}>
          <Chart
            height={200}
            onClick={(p) => { const n = (p as { name?: string }).name?.toLowerCase() as RuleHealth | undefined; if (n) setHealth(n); }}
            option={{
              tooltip: { trigger: 'item' },
              series: [{ type: 'pie', radius: ['50%', '78%'], label: { show: false }, data: d.health.map((x) => ({ name: cap(x.health), value: x.count, itemStyle: { color: HEALTH_HEX[x.health] } })) }],
              graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text: `${Math.round((hcount('healthy') / d.live) * 100)}%\nhealthy`, align: 'center', fill: '#2dd4bf', fontSize: 15, fontWeight: 700 } }],
            }}
          />
          <Legend items={d.health.map((x) => ({ label: `${cap(x.health)} ${fmtNum(x.count)}`, color: HEALTH_HEX[x.health] }))} />
        </Card>
      </div>

      <div className="grid g-3-2">
        <Card title="Coverage by tactic" sub="ATT&CK Enterprise techniques with a live detection, and rules per tactic" actions={<button className="link" onClick={() => nav('/soc/attack')}>HexaMatrix →</button>}>
          <Chart
            height={260}
            option={{
              grid: { left: 4, right: 4, top: 30, bottom: 4, containLabel: true },
              legend: { top: 0 },
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              xAxis: { type: 'category', data: d.byTactic.map((t) => t.tactic), axisLabel: { interval: 0, rotate: 30, fontSize: 10 } },
              yAxis: [{ type: 'value', name: '% covered', max: 100 }, { type: 'value', name: 'rules', splitLine: { show: false } }],
              series: [
                { name: '% techniques covered', type: 'bar', barMaxWidth: 18, data: d.byTactic.map((t) => Math.round((t.covered / Math.max(1, t.total)) * 100)), itemStyle: { color: '#8b5cf6' } },
                { name: 'Live rules', type: 'line', yAxisIndex: 1, data: d.byTactic.map((t) => t.rules), itemStyle: { color: '#f5a83d' }, lineStyle: { color: '#f5a83d' } },
              ],
            }}
          />
        </Card>
        <Card title={<><Zap size={15} style={{ verticalAlign: -2 }} /> From intel to rule</>} sub="New rule from intelligence within 72 h (service SLA)">
          <div className="stack" style={{ gap: 10 }}>
            {d.intel.map((x, i) => {
              const elapsed = x.deployedH ?? Math.min(x.receivedH, 71);
              const col = x.status === 'deployed' ? (elapsed <= 72 ? 'var(--good)' : 'var(--bad)') : 'var(--sev-medium)';
              return (
                <div key={i} style={{ fontSize: 12 }}>
                  <div className="row between" style={{ gap: 8 }}>
                    <b style={{ fontWeight: 600 }}>{x.advisory}</b>
                    <Badge color={col}>{x.status === 'deployed' ? `${x.deployedH} h` : x.status}</Badge>
                  </div>
                  <div style={{ margin: '5px 0 3px' }}><Bar value={elapsed} max={72} color={col} size="thin" /></div>
                  <span className="muted" style={{ fontSize: 11 }}>{x.ruleId ? <span className="mono">{x.ruleId}</span> : 'Rule in draft'} · received {x.receivedH} h ago</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title={<><GitBranch size={15} style={{ verticalAlign: -2 }} /> Detections-as-code CI</>} sub={`hexasoc-detections/${c.id} · main · lint, schema, replay and performance gates before ${tools.siemShort}`} flush>
        <div className="list" style={{ padding: '0 18px 8px' }}>
          {d.ci.map((r) => (
            <div key={r.id} className="list-row">
              {r.status === 'passed' ? <CheckCircle2 size={16} color="var(--good)" /> : r.status === 'failed' ? <XCircle size={16} color="var(--bad)" /> : <Loader2 size={16} color={tone} />}
              <span className="list-main">
                <b className="mono" style={{ fontWeight: 500 }}>{r.title}</b>
                <span>{r.id} · {r.author} · {r.checks}</span>
              </span>
              <span className="muted nowrap" style={{ fontSize: 11 }}>{fmtAgo(r.min)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Detection library"
        count={rows.length}
        sub={`Most recently changed rules of ${fmtNum(d.live)} live · ${rangeText.toLowerCase()} hit counts · click for the rule body`}
        flush
      >
        <DataTable
          rows={rows}
          rowKey={(r, i) => `${r.id}-${i}`}
          onRowClick={setSel}
          search={(r) => `${r.id} ${r.name} ${r.tech} ${r.platform} ${r.origin} ${r.author}`}
          searchPlaceholder="Filter by rule, technique, platform…"
          toolbar={
            <span className="chips">
              {(['all', 'healthy', 'noisy', 'silent', 'broken'] as const).map((k) => (
                <Chip key={k} on={health === k} onClick={() => setHealth(k)} color={k === 'all' ? tone : HEALTH_VAR[k]}>{cap(k)}</Chip>
              ))}
              {stage !== 'all' && <Chip on onClick={() => setStage('all')} color={STAGE_COLOR[stage]}>Stage: {stage} ✕</Chip>}
            </span>
          }
          columns={[
            { key: 'id', header: 'Rule', sort: (r) => r.id, render: (r) => (<><div className="t-main" style={{ whiteSpace: 'normal', maxWidth: 320 }}>{r.name}</div><div className="t-sub mono">{r.id} · v{r.version}</div></>) },
            { key: 'tech', header: 'ATT&CK', sort: (r) => r.tech, render: (r) => (<><span className="soc-tech">{r.tech}</span><div className="t-sub">{r.tactic}</div></>) },
            { key: 'plat', header: 'Platform', sort: (r) => r.platform, render: (r) => r.platform },
            { key: 'stage', header: 'Stage', sort: (r) => r.stage, render: (r) => <Badge color={STAGE_COLOR[r.stage]} dot>{cap(r.stage)}</Badge> },
            { key: 'health', header: 'Health', sort: (r) => r.health, render: (r) => <StatusBadge value={r.health} map={HEALTH_VAR} /> },
            { key: 'sev', header: 'Severity', render: (r) => <SevBadge sev={r.sev} /> },
            { key: 'hits', header: 'Hits 7 d', align: 'right', sort: (r) => r.hits7d, render: (r) => (<>{fmtNum(r.hits7d)}{r.fpPct > 0 && <div className="t-sub">{r.fpPct}% FP</div>}</>) },
            { key: 'origin', header: 'Origin', sort: (r) => r.origin, render: (r) => <span className="t-sub">{r.origin}</span> },
            { key: 'chg', header: 'Changed', align: 'right', sort: (r) => -r.changedDaysAgo, render: (r) => `${r.changedDaysAgo} d ago` },
          ]}
        />
      </Card>

      {sel && (
        <RuleDrawer
          rule={sel}
          onClose={() => setSel(null)}
          onDeploy={() => setWb({ title: `Deploy ${sel.id} to ${tools.siemShort}`, system: `${tools.siem.vendor} ${tools.siem.product}`, target: `${sel.name} (${sel.tenants})`, risk: 'medium', changes: [`${tools.siemShort}: ${siemWrite} · ${sel.id} v${sel.version}`, `Severity ${sel.sev}; incidents route to HexaSOC MDR`, `Stage moves ${sel.stage} → deployed; previous version kept for rollback`], done: `Deployment of ${sel.id} to ${tools.siemShort} requested` })}
          onDisable={() => setWb({ title: `Disable ${sel.id}`, system: sel.platform, target: sel.name, risk: 'low', changes: [`${sel.platform}: rule disabled (not deleted)`, `HexaMatrix coverage for ${sel.tech} recalculated; affected closed loops flagged`, 'Re-enable at any time from this drawer'], done: `${sel.id} disabled in ${sel.platform}` })}
        />
      )}
      {wb && <WriteBackModal wb={wb} onClose={() => setWb(null)} />}
      {intelOpen && (
        <RecordsDrawer title="Intel to rule" sub="Advisories received and the detections built from them" source="HexaInt advisories · detection CI" onClose={() => setIntelOpen(false)}
          rows={d.intel.map((x) => ({ id: x.advisory, title: x.advisory, sub: `received ${x.receivedH} h ago${x.ruleId ? ` · ${x.ruleId}` : ''}${x.deployedH !== undefined ? ` · deployed in ${x.deployedH} h` : ''}`, right: <Badge color={x.status === 'deployed' ? 'var(--good)' : x.status === 'in test' ? 'var(--sev-medium)' : 'var(--sev-info)'}>{x.status}</Badge> }))} />
      )}
    </>
  );
}

function RuleDrawer({ rule, onClose, onDeploy, onDisable }: { rule: Rule; onClose: () => void; onDeploy: () => void; onDisable: () => void }) {
  const { c, tools, tone } = useSoc();
  const t = TECHNIQUE_BY_ID[rule.tech];
  const isOt = c.connectors.some((k) => k.category === 'OT' && rule.platform.includes(k.product.split(' ')[0]));
  const live = rule.stage === 'deployed' || rule.stage === 'tuned';
  return (
    <Drawer
      wide
      title={rule.name}
      sub={<span className="mono">{rule.id} · v{rule.version}</span>}
      icon={<IcoBox color={tone}><FileCode2 /></IcoBox>}
      onClose={onClose}
      footer={
        isOt ? undefined : (
          <>
            {live && <Btn onClick={onDisable}><PowerOff size={14} /> Disable rule <Badge color="var(--good)">low</Badge></Btn>}
            <Btn primary onClick={onDeploy}><Rocket size={14} /> {live ? 'Redeploy' : 'Deploy'} to {tools.siemShort} <Badge color="var(--sev-medium)">medium</Badge></Btn>
          </>
        )
      }
    >
      <div className="stack" style={{ gap: 18 }}>
        <KV rows={[
          ['ATT&CK', <span key="t"><span className="soc-tech">{rule.tech}</span> {t?.name} · {rule.tactic}</span>],
          ['Platform', rule.platform],
          ['Stage', <Badge key="s" color={STAGE_COLOR[rule.stage]} dot>{cap(rule.stage)}</Badge>],
          ['Health', <StatusBadge key="h" value={rule.health} map={HEALTH_VAR} />],
          ['Severity', <SevBadge key="v" sev={rule.sev} />],
          ['Hits (7 d)', `${fmtNum(rule.hits7d)}${rule.fpPct ? ` · ${rule.fpPct}% false positive` : ''}`],
          ['Last fired', rule.lastFiredMin === null ? 'Never in 90 days' : fmtAgo(rule.lastFiredMin)],
          ['Origin', rule.origin],
          ['Author', rule.author],
          ['CI', <Badge key="c" color={rule.ci === 'passed' ? 'var(--good)' : rule.ci === 'failed' ? 'var(--bad)' : tone} dot>{cap(rule.ci)}</Badge>],
          ['Scope', rule.tenants],
        ]} />
        {rule.health === 'broken' && <Callout kind="warn"><b>Broken:</b> the last replay returned no events because a source field was renamed upstream. HexaSOC has a fix in review; the technique shows as partially covered in HexaMatrix.</Callout>}
        {rule.health === 'noisy' && <Callout kind="warn"><b>Noisy:</b> {rule.fpPct}% false positives. Tuning suggestion: exclude approved admin tooling and scope to crown-jewel assets.</Callout>}
        {rule.health === 'silent' && <Callout>Silent for 90 days. Scheduled for a HexaStrike validation run to prove it still fires.</Callout>}
        <div>
          <div className="section-label">Rule body · {tools.qlLong}</div>
          <CodeBlock code={rule.body} lang={tools.ql} />
        </div>
        <div>
          <div className="section-label">Tags</div>
          <span className="chips">
            <span className="soc-tech">attack.{rule.tech.toLowerCase()}</span>
            <span className="soc-tech">tactic.{rule.tactic.toLowerCase().replace(/ /g, '_')}</span>
            <span className="soc-tech">sector.{c.id}</span>
            <span className="soc-tech">origin.{rule.origin.split(' ')[0].toLowerCase()}</span>
          </span>
        </div>
        {isOt && <Callout kind="warn"><b>OT detection.</b> Runs on passive OT telemetry and is managed with the OT team; no write-back is offered for OT systems.</Callout>}
      </div>
    </Drawer>
  );
}
