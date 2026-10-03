import { useMemo, useState } from 'react';
import { Crosshair, ShieldCheck, Bug } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { tenantName } from '../../data/customers';
import { TECHNIQUE_BY_ID } from '../../data/reference';
import {
  aiTargets, owaspResults, atlasResults, rtCampaigns, leakFindings, guardrails,
  type LeakFinding, type Guardrail,
} from '../../data/modules/ai';
import { Badge, Btn, Callout, Card, KpiStrip, KV, SevBadge, StatusBadge, Tabs } from '../../components/ui';
import { SEV_HEX } from '../../components/Chart';
import { ChartLegend, SvgLines } from '../reports/parts';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { dayLabels, fmtNum, fmtPct } from '../../lib/format';
import { rng } from '../../lib/rng';
import { AI_TONE, ApprovalModal } from './parts';
import './ai.css';

const STATUS_COLOR = { fixed: 'var(--good)', mitigated: 'var(--sev-low)', open: 'var(--bad)', deployed: 'var(--good)', staged: 'var(--sev-medium)', proposed: 'var(--sev-info)', completed: 'var(--good)', running: 'var(--m-ai)', scheduled: 'var(--sev-info)' };

export default function Redteam() {
  const { customer: c, timeRange, tenantId, toast } = useApp();
  const days = rangeDays(timeRange);
  const targets = aiTargets(c);
  const [tid, setTid] = useState(targets[0].id);
  const target = targets.find((t) => t.id === tid) ?? targets[0];
  const owasp = useMemo(() => owaspResults(c, target), [c, target]);
  const atlas = useMemo(() => atlasResults(c, target), [c, target]);
  const camps = rtCampaigns(c);
  const tc = camps.filter((x) => x.target === target.id);
  const base = tc.find((x) => x.phase === 'Baseline')!;
  const post = tc.find((x) => x.phase === 'Post-guardrails')!;
  const cont = tc.find((x) => x.phase === 'Continuous')!;
  const leaks = leakFindings(c);
  const tLeaks = leaks.filter((l) => l.target === target.id);
  const rails = guardrails(c);
  const [leak, setLeak] = useState<LeakFinding | null>(null);
  const [deploy, setDeploy] = useState<Guardrail | null>(null);
  const [deployed, setDeployed] = useState<Set<string>>(new Set());
  const llm = target.kind === 'LLM application';
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const owaspMax = Math.max(1, ...owasp.map((o) => o.failBefore));

  // Nightly continuous probes: success rate over the selected range (min 7 nights).
  const nights = Math.max(7, Math.min(days, 90));
  const r = rng(`ai-rt-nightly-${c.id}-${target.id}`);
  const inj = Array.from({ length: nights }, () => Math.max(0, Math.round((cont.injection + (r() - 0.5) * 1.6) * 10) / 10));
  const jb = Array.from({ length: nights }, () => Math.max(0, Math.round((cont.jailbreak + (r() - 0.5) * 1.2) * 10) / 10));
  const probesInRange = Math.round(cont.probes * Math.max(1, days)) + (days >= 30 ? post.probes : 0) + (days >= 90 ? base.probes : 0);

  const testedAtlas = atlas.length;
  const openLeaks = leaks.filter((l) => l.status === 'open').length;

  return (
    <>
      <p className="page-intro">
        HexaStrike AI red teaming against <b>{c.short}</b>'s own AI: {targets.map((t) => t.name).join(' and ')}. Campaigns are mapped to the OWASP Top 10 for LLM Applications (2025) and MITRE ATLAS,
        re-run nightly after guardrails ship · {tenantName(c, tenantId)}.
      </p>

      <div className="row wrap" style={{ gap: 10 }}>
        <Tabs color={AI_TONE} value={tid} onChange={setTid} tabs={targets.map((t) => ({ id: t.id, label: t.name }))} />
        <span className="spacer" />
        <Badge color={AI_TONE}>{target.kind}</Badge>
        <Badge>{target.exposure} exposure</Badge>
        <Badge>{c.tenants.find((t) => t.id === target.tenant)?.short}</Badge>
      </div>

      <KpiStrip
        toneColor={AI_TONE}
        items={[
          { label: 'Campaigns', value: tc.length, unit: `${camps.length} across ${targets.length} systems`, onClick: () => go('ai-camps'), source: 'HexaStrike AI red-team campaigns' },
          { label: 'Probes executed', hint: rangeLabel(timeRange), value: fmtNum(probesInRange), onClick: () => go('ai-camps'), source: 'HexaStrike probe log' },
          llm
            ? { label: 'Jailbreak success', value: `${fmtPct(post.jailbreak, 1)}`, unit: `was ${fmtPct(base.jailbreak, 1)}`, delta: { text: `↓ ${Math.round((1 - post.jailbreak / base.jailbreak) * 100)}% after guardrails`, good: true }, onClick: () => go('ai-ba'), source: 'HexaStrike re-test vs baseline' }
            : { label: 'Jailbreak success', value: 'n/a', unit: 'not an LLM', onClick: () => go('ai-owasp'), source: 'Not applicable to ML models' },
          { label: llm ? 'Prompt-injection success' : 'Adversarial input success', value: fmtPct(post.injection, 1), unit: `was ${fmtPct(base.injection, 1)}`, delta: { text: `↓ ${Math.round((1 - post.injection / base.injection) * 100)}%`, good: true }, onClick: () => go('ai-ba'), source: 'HexaStrike re-test vs baseline' },
          { label: 'Data leakage findings', value: tLeaks.length, unit: `${tLeaks.filter((l) => l.status === 'open').length} open`, toneColor: 'var(--sev-high)', onClick: () => (tLeaks[0] ? setLeak(tLeaks[0]) : go('ai-leaks')), source: 'HexaStrike findings · HexaComply AI governance' },
          { label: 'ATLAS techniques tested', value: testedAtlas, unit: `of ${8}`, onClick: () => go('ai-atlas'), source: 'MITRE ATLAS mapping' },
        ]}
      />

      <div className="grid g-3-2">
        <Card title="OWASP Top 10 for LLM Applications" sub={`${target.name} · failed tests before and after guardrails${llm ? '' : ' · LLM-specific risks are not applicable to this model'}`} actions={<ChartLegend items={[{ label: 'Failed before guardrails', color: SEV_HEX.high }, { label: 'Failed after', color: '#2dd4bf' }]} />}>
          <div id="ai-owasp">
            {owasp.map((o) => (
              <div key={o.id} className={`ai-pair ${o.applicable ? '' : 'na'}`} title={o.applicable ? `${o.tests} tests · ${o.failBefore} failed before · ${o.failAfter} after` : 'Not applicable to this system'}>
                <span><em>{o.id}</em>{o.name}</span>
                {o.applicable ? (
                  <div className="bars">
                    <i style={{ width: `${(o.failBefore / owaspMax) * 100}%`, background: SEV_HEX.high }} />
                    <i style={{ width: `${(o.failAfter / owaspMax) * 100}%`, background: '#2dd4bf' }} />
                  </div>
                ) : <div className="muted" style={{ fontSize: 11 }}>Not applicable (ML model)</div>}
                <b>{o.applicable ? `${o.failBefore} → ${o.failAfter}` : 'n/a'}</b>
              </div>
            ))}
          </div>
        </Card>
        <Card title="MITRE ATLAS techniques" actions={<span id="ai-atlas" />} sub="Success rate per technique, baseline → now" flush>
          <DataTable
            rows={atlas}
            rowKey={(a) => a.id}
            initialSort={{ key: 'before', dir: 'desc' }}
            columns={[
              { key: 'id', header: 'Technique', sort: (a) => a.id, render: (a) => (<><div className="t-main">{a.name}</div><div className="t-sub mono">{a.id} · {a.tactic}</div></>) },
              { key: 'att', header: 'Attempts', align: 'right', sort: (a) => a.attempts, render: (a) => fmtNum(a.attempts) },
              { key: 'before', header: 'Before → after', sort: (a) => a.successBefore, render: (a) => (
                <span className="ai-ba"><s>{fmtPct(a.successBefore * 100, 1)}</s><b style={{ color: a.successAfter > 0.02 ? 'var(--sev-medium)' : 'var(--good)' }}>{fmtPct(a.successAfter * 100, 1)}</b></span>
              ) },
            ]}
          />
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Before and after" sub={`Baseline (${base.startedDays} d ago) → guardrail re-test (${post.startedDays} d ago) → nightly continuous runs`}>
          <div id="ai-ba">
            <SvgLines
              labels={['Baseline', 'Re-test', ...dayLabels(nights)]}
              height={240}
              min={0}
              unit="%"
              series={[
                { name: llm ? 'Injection' : 'Adversarial', color: SEV_HEX.high, data: [base.injection, post.injection, ...inj] },
                ...(llm ? [{ name: 'Jailbreak', color: '#8f8cff', data: [base.jailbreak, post.jailbreak, ...jb] }] : []),
              ]}
            />
          </div>
        </Card>
        <Card title="Campaigns" flush actions={<span id="ai-camps" />}>
          <DataTable
            rows={camps}
            rowKey={(x) => x.id}
            onRowClick={(x) => setTid(x.target)}
            initialSort={{ key: 'start', dir: 'asc' }}
            columns={[
              { key: 'name', header: 'Campaign', sort: (x) => x.name, render: (x) => (<><div className="t-main" style={{ color: x.target === target.id ? 'var(--m-ai)' : undefined }}>{x.name}</div><div className="t-sub mono">{x.id} · {x.phase}</div></>) },
              { key: 'status', header: 'Status', render: (x) => <StatusBadge value={x.status} map={STATUS_COLOR} /> },
              { key: 'start', header: 'Started', sort: (x) => x.startedDays, render: (x) => (x.startedDays === 0 ? 'Nightly' : `${x.startedDays} d ago`) },
              { key: 'probes', header: 'Probes', align: 'right', sort: (x) => x.probes, render: (x) => fmtNum(x.probes) },
              { key: 'inj', header: 'Injection', align: 'right', sort: (x) => x.injection, render: (x) => fmtPct(x.injection, 1) },
              { key: 'leaks', header: 'Leaks', align: 'right', sort: (x) => x.leaks, render: (x) => x.leaks },
            ]}
          />
        </Card>
      </div>

      <div className="grid g2">
        <Card actions={<span id="ai-leaks" />} title="Data leakage findings" count={leaks.length} sub={`${openLeaks} open across both systems · click for the redacted sample`} flush>
          <div className="list" style={{ padding: '0 18px 8px' }}>
            {leaks.map((l) => (
              <button key={l.id} className="list-row" onClick={() => setLeak(l)} style={{ opacity: l.target === target.id ? 1 : 0.6 }}>
                <span className="ico-box" style={{ ['--tone' as string]: 'var(--sev-high)' }}><Bug /></span>
                <span className="list-main">
                  <b>{l.title}</b>
                  <span>{targets.find((t) => t.id === l.target)?.name} · {l.dataClass} · {l.technique}</span>
                </span>
                <span className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <SevBadge sev={l.sev} />
                  <StatusBadge value={l.status} map={STATUS_COLOR} />
                </span>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Guardrail recommendations" sub="Ranked by measured effect in re-tests" flush>
          <div className="list" style={{ padding: '0 18px 8px' }}>
            {rails.map((g) => {
              const st = g.status;
              const pendingApproval = deployed.has(g.title);
              return (
                <div key={g.title} className="list-row">
                  <span className="ico-box" style={{ ['--tone' as string]: STATUS_COLOR[st] }}><ShieldCheck /></span>
                  <span className="list-main">
                    <b>{g.title}</b>
                    <span>{targets.find((t) => t.id === g.target)?.name} · {g.control} · {g.effect}</span>
                  </span>
                  {pendingApproval ? <Badge color="var(--sev-medium)" dot>Approval pending</Badge> : st === 'deployed' ? <StatusBadge value="deployed" map={STATUS_COLOR} /> : <Btn sm primary={st === 'staged'} color={AI_TONE} onClick={() => setDeploy(g)}>{st === 'staged' ? 'Promote' : 'Stage'}</Btn>}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {leak && (
        <Drawer title={leak.title} sub={`${leak.id} · ${targets.find((t) => t.id === leak.target)?.name}`} icon={<span className="ico-box" style={{ ['--tone' as string]: 'var(--sev-high)' }}><Crosshair /></span>} onClose={() => setLeak(null)}>
          <KV
            rows={[
              ['Severity', <SevBadge sev={leak.sev} />],
              ['Status', <StatusBadge value={leak.status} map={STATUS_COLOR} />],
              ['Data class', leak.dataClass],
              ['MITRE ATLAS', `${leak.technique} · ${TECHNIQUE_BY_ID[leak.technique]?.name ?? ''}`],
              ['System owner', targets.find((t) => t.id === leak.target)?.owner],
              ['Stack', targets.find((t) => t.id === leak.target)?.stack],
            ]}
          />
          <div>
            <div className="section-label">Reproduction (redacted)</div>
            <div className="ai-sample">{leak.sample}</div>
          </div>
          <Callout kind={leak.status === 'open' ? 'warn' : 'good'}>
            {leak.status === 'open' ? 'Open: a guardrail is proposed and the finding is tracked in HexaComply AI governance (ISO/IEC 42001 A.6.2.4).' : 'Re-tested nightly by the continuous campaign; the finding stays closed while the success rate stays at zero.'}
          </Callout>
        </Drawer>
      )}

      {deploy && (
        <ApprovalModal
          title={`${deploy.status === 'staged' ? 'Promote' : 'Stage'}: ${deploy.title}`}
          connector={deploy.control}
          operation={deploy.status === 'staged' ? 'Promote policy to production' : 'Stage policy (shadow mode)'}
          risk="medium"
          change={`${deploy.title} on ${targets.find((t) => t.id === deploy.target)?.name}. Expected effect: ${deploy.effect}. HexaStrike re-runs the affected probes within 24 hours to confirm.`}
          approvers={[deploy.owner]}
          onClose={() => setDeploy(null)}
          onSubmit={() => {
            setDeployed((s) => new Set(s).add(deploy.title));
            toast(`Guardrail change sent to ${deploy.owner} for approval; re-test scheduled.`);
            setDeploy(null);
          }}
        />
      )}
    </>
  );
}
