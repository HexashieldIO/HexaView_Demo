import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SegRows, RecordsDrawer } from '../insurance/viz';
import { SEV_HEX } from '../../components/Chart';
import { Cloud, ShieldAlert, Database, Globe } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import type { Severity } from '../../data/types';
import { cloudAccounts, cisBenchmark, connShort, type CloudAccount } from '../../data/modules/fabric';
import { Card, KpiStrip, Badge, Callout, KV, Ring, SevBadge, Bar, Sources } from '../../components/ui';
import { Chart, PALETTE } from '../../components/Chart';
import { Drawer } from '../../components/Overlay';
import { fmtNum, scoreTone } from '../../lib/format';
import { TONE, toneStyle } from './parts';
import './fabric.css';

const PROVIDER_COLOR: Record<'Azure' | 'AWS' | 'GCP', string> = { Azure: '#4f8cff', AWS: '#f5a83d', GCP: '#2dd4bf' };

export default function FabricCloud() {
  const { customer: c, tenantId } = useApp();
  const accounts = useMemo(() => cloudAccounts(c, tenantId), [c, tenantId]);
  const [params] = useSearchParams();
  const [sel, setSel] = useState<CloudAccount | null>(() => accounts.find((a) => a.name === params.get('account')) ?? null);
  const [rec, setRec] = useState<null | 'accounts' | 'critical' | 'toxic' | 'public' | 'sensitive'>(null);

  const covered = accounts.filter((a) => a.score !== null);
  const avgScore = covered.length ? Math.round(covered.reduce((s, a) => s + (a.score ?? 0), 0) / covered.length) : 0;
  const totalFindings = (sev: Severity) => accounts.reduce((s, a) => s + a.findings[sev], 0);
  const toxicCount = accounts.reduce((s, a) => s + a.toxic.length, 0);
  const publicCount = accounts.reduce((s, a) => s + a.publicExposed, 0);
  const sensitivePublic = accounts.reduce((s, a) => s + a.dataStores.filter((d) => d.publicAccess).length, 0);

  const byProvider = (['Azure', 'AWS', 'GCP'] as const).map((p) => {
    const accs = accounts.filter((a) => a.provider === p);
    return { p, n: accs.length, sev: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<Severity, number>, accs };
  }).filter((x) => x.n);
  for (const b of byProvider) for (const a of b.accs) for (const s of ['critical', 'high', 'medium', 'low'] as Severity[]) b.sev[s] += a.findings[s];

  const postureSrcs = [...new Set(accounts.flatMap((a) => a.sources.map(connShort)))];

  if (accounts.length === 0) return <div style={toneStyle()}><p className="page-intro">No cloud accounts in scope for this tenant.</p></div>;

  return (
    <div style={toneStyle()}>
      <p className="page-intro">
        <b>{c.name}</b> · cloud posture unified from {postureSrcs.join(', ') || 'your CSPM tools'} across {accounts.length} accounts (Azure, AWS, GCP). Secure score, CIS benchmarks, public exposure and toxic combinations, all in one canonical view.
      </p>

      <KpiStrip
        toneColor={TONE}
        items={[
          { label: 'Cloud accounts', value: accounts.length, hint: `${covered.length} covered`, toneColor: TONE, onClick: () => setRec('accounts'), source: postureSrcs.join(' · ') },
          { label: 'Mean secure score', value: avgScore, unit: '/100', bar: avgScore, toneColor: scoreTone(avgScore), onClick: () => setRec('accounts'), source: postureSrcs.join(' · ') },
          { label: 'Critical findings', value: totalFindings('critical'), toneColor: 'var(--sev-critical)', delta: { text: `${totalFindings('high')} high`, good: false }, onClick: () => setRec('critical'), source: postureSrcs.join(' · ') },
          { label: 'Toxic combinations', value: toxicCount, hint: 'chained risk', toneColor: 'var(--sev-high)', onClick: () => setRec('toxic'), source: `${postureSrcs.join(' · ')} · HexaCore graph` },
          { label: 'Public exposure', value: publicCount, hint: 'resources', toneColor: 'var(--sev-medium)', onClick: () => setRec('public'), source: `${postureSrcs.join(' · ')} · HexaStrike ASM` },
          { label: 'Sensitive & public', value: sensitivePublic, hint: 'data stores', toneColor: sensitivePublic ? 'var(--bad)' : 'var(--good)', onClick: () => setRec('sensitive'), source: `${postureSrcs.join(' · ')} · data classification` },
        ]}
      />

      <div className="grid g-3-2">
        <Card title="Findings by provider" sub="Severity split across Azure, AWS and GCP">
          <SegRows
            legend
            labelWidth={110}
            rows={byProvider.map((b) => ({ label: b.p, sub: `${b.n} account${b.n === 1 ? '' : 's'}`, onClick: () => setRec('accounts'), parts: (['critical', 'high', 'medium', 'low'] as Severity[]).map((s) => ({ label: s[0].toUpperCase() + s.slice(1), value: b.sev[s], color: SEV_HEX[s] })) }))}
          />
          <div className="section-label" style={{ marginTop: 14 }}>Accounts by provider</div>
          <SegRows
            labelWidth={110}
            rows={accounts.map((a) => ({ label: a.name, sub: `${a.provider} · ${a.tenantShort}`, onClick: () => setSel(a), total: a.score === null ? 'no CSPM' : undefined, parts: (['critical', 'high', 'medium', 'low'] as Severity[]).map((s) => ({ label: s, value: a.findings[s], color: SEV_HEX[s] })) }))}
          />
        </Card>
        <Card title="Secure score by account" sub="Higher is better · click an account for detail">
          <div className="list">
            {[...accounts].sort((a, b) => (a.score ?? 101) - (b.score ?? 101)).map((a) => (
              <button key={a.name} className="list-row" onClick={() => setSel(a)}>
                <span className="dot" style={{ background: PROVIDER_COLOR[a.provider] }} />
                <span className="list-main"><b>{a.name}</b><span>{a.provider} · {a.tenantShort} · {fmtNum(a.resources)} resources</span></span>
                {a.score === null ? <Badge color="var(--sev-medium)">No CSPM</Badge> : (
                  <span style={{ width: 120 }}><Bar value={a.score} color={scoreTone(a.score)} /><span className="t-sub" style={{ textAlign: 'right', display: 'block' }}>{a.score}/100 · CIS {a.cis}%</span></span>
                )}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g3">
        {accounts.map((a) => (
          <Card key={a.name} title={<span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: PROVIDER_COLOR[a.provider] }} />{a.name}</span>} sub={`${a.provider} · ${a.tenantShort}`} toneColor={PROVIDER_COLOR[a.provider]}
            actions={a.score !== null && <Ring value={a.score} size={46} stroke={6} color={scoreTone(a.score)} />}>
            {a.score === null ? (
              <Callout kind="warn"><b>Not covered by a CSPM.</b> Connect Defender for Cloud, Wiz or Security Hub to score this account — shown here honestly, not as zero risk.</Callout>
            ) : (
              <>
                <div className="row" style={{ gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                  {a.findings.critical > 0 && <Badge color="var(--sev-critical)" solid>{a.findings.critical} crit</Badge>}
                  <Badge color="var(--sev-high)">{a.findings.high} high</Badge>
                  <Badge color="var(--sev-medium)">{a.findings.medium} med</Badge>
                  {a.publicExposed > 0 && <Badge color="var(--m-core)">{a.publicExposed} public</Badge>}
                </div>
                <KV rows={[
                  ['CIS benchmark', `${a.cis}%`],
                  ['Toxic combos', a.toxic.length ? <span style={{ color: 'var(--sev-high)', fontWeight: 700 }}>{a.toxic.length}</span> : '0'],
                  ['Sources', <Sources items={a.sources.map((s) => ({ name: connShort(s) }))} />],
                ]} />
                <button className="link" style={{ marginTop: 8 }} onClick={() => setSel(a)}>Open account →</button>
              </>
            )}
          </Card>
        ))}
      </div>

      {rec && (
        <RecordsDrawer
          title={rec === 'accounts' ? 'Cloud accounts' : rec === 'critical' ? 'Critical cloud findings by account' : rec === 'toxic' ? 'Toxic combinations' : rec === 'public' ? 'Publicly exposed resources' : 'Sensitive data stores with public access'}
          sources={[...new Map(accounts.flatMap((a) => a.sources).map((k) => [k.id, { name: connShort(k) }])).values()]}
          onClose={() => setRec(null)}
          rows={
            rec === 'toxic' ? accounts.flatMap((a) => a.toxic.map((t, i) => ({ key: `${a.name}-${i}`, title: t.title, sub: `${a.name} · ${t.resource} · ${t.factors.join(', ')}`, badge: <SevBadge sev={t.sev} />, onClick: () => { setRec(null); setSel(a); } })))
            : rec === 'sensitive' ? accounts.flatMap((a) => a.dataStores.filter((d) => d.publicAccess).map((d) => ({ key: `${a.name}-${d.name}`, title: d.name, sub: `${a.name} · ${d.classification} · ${d.records}`, badge: <Badge color="var(--bad)" dot>Public</Badge>, onClick: () => { setRec(null); setSel(a); } })))
            : accounts.map((a) => ({ key: a.name, title: a.name, sub: `${a.provider} · ${a.tenantShort} · ${fmtNum(a.resources)} resources · ${a.sources.map(connShort).join(', ') || 'no CSPM connected'}`, right: rec === 'critical' ? `${a.findings.critical} critical` : rec === 'public' ? `${a.publicExposed} public` : a.score === null ? 'not scored' : `${a.score}/100`, onClick: () => { setRec(null); setSel(a); } })).sort((x, y) => String(y.right).localeCompare(String(x.right), undefined, { numeric: true }))
          }
        />
      )}
      {sel && (
        <Drawer wide onClose={() => setSel(null)} title={sel.name} sub={`${sel.provider} · ${sel.tenantShort} · ${fmtNum(sel.resources)} resources`}
          icon={<span className="ico-box" style={{ '--tone': PROVIDER_COLOR[sel.provider] } as React.CSSProperties}><Cloud /></span>}>
          {sel.score === null ? (
            <Callout kind="warn"><b>No cloud posture source connected for this account.</b> Findings cannot be shown; this is a coverage gap, not a clean bill of health.</Callout>
          ) : (
            <>
              <div className="fab-kvgrid">
                <div><b style={{ color: scoreTone(sel.score) }}>{sel.score}</b><span>Secure score</span></div>
                <div><b>{sel.cis}%</b><span>CIS benchmark</span></div>
                <div><b style={{ color: sel.toxic.length ? 'var(--sev-high)' : undefined }}>{sel.toxic.length}</b><span>Toxic combos</span></div>
                <div><b style={{ color: sel.publicExposed ? 'var(--sev-medium)' : undefined }}>{sel.publicExposed}</b><span>Public resources</span></div>
              </div>

              <div>
                <div className="section-label">Secure score trend (12 months)</div>
                <Chart height={90} option={{
                  grid: { left: 6, right: 8, top: 8, bottom: 16, containLabel: true },
                  tooltip: { trigger: 'axis' },
                  xAxis: { type: 'category', data: sel.trend.map((_, i) => `m${i + 1}`), show: false },
                  yAxis: { type: 'value', min: 40, max: 100 },
                  series: [{ type: 'line', data: sel.trend, smooth: true, symbol: 'none', lineStyle: { color: PALETTE[0], width: 2 }, areaStyle: { color: 'rgba(79,140,255,.18)' } }],
                }} />
              </div>

              <KV rows={[
                ['Benchmark', cisBenchmark(sel.provider)],
                ['Regions', sel.regions.join(', ')],
                ['Sources', <Sources items={sel.sources.map((s) => ({ name: connShort(s) }))} />],
              ]} />

              {sel.toxic.length > 0 && (
                <div>
                  <div className="section-label"><ShieldAlert size={12} style={{ verticalAlign: -2 }} /> Toxic combinations</div>
                  <div className="stack">
                    {sel.toxic.map((t, i) => (
                      <div key={i} className="fab-path" style={{ cursor: 'default' }}>
                        <div className="row between"><b style={{ fontSize: 12.5 }}>{t.title}</b><SevBadge sev={t.sev} /></div>
                        <div className="chips" style={{ marginTop: 6 }}>{t.factors.map((f) => <Badge key={f} color="var(--sev-medium)">{f}</Badge>)}</div>
                        <div className="muted mono" style={{ fontSize: 10.5, marginTop: 4 }}>{t.resource}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="section-label">Failing CIS controls</div>
                <div className="list">
                  {sel.failing.map((f) => (
                    <div key={f.id} className="list-row">
                      <Badge color="var(--sev-high)">{f.id}</Badge>
                      <span className="list-main"><b style={{ fontWeight: 500 }}>{f.title}</b></span>
                      <span className="muted">{f.failed} resources</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="section-label"><Database size={12} style={{ verticalAlign: -2 }} /> Sensitive data stores</div>
                <div className="list">
                  {sel.dataStores.map((d) => (
                    <div key={d.name} className="list-row">
                      <Database size={14} style={{ color: d.publicAccess ? 'var(--bad)' : 'var(--m-core)' }} />
                      <span className="list-main"><b>{d.name}</b><span>{d.classification} · {d.records} · {d.encrypted}</span></span>
                      {d.publicAccess ? <Badge color="var(--bad)" dot><Globe size={10} /> Public</Badge> : <Badge color="var(--good)" dot>Private</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </Drawer>
      )}
    </div>
  );
}
