import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Card, KV, Callout, Timeline, Btn, Sources } from '../../../components/ui';
import { Chart, SEV_HEX } from '../../../components/Chart';
import { fmtAgo } from '../../../lib/format';
import { vrAssets, vrTally, vrScopedVerdict, type VrPhase, type VrVerdict } from '../../../data/modules/vulnresponse';
import { FilterGroup } from '../parts';
import { useVr } from './state';
import { CvssBadge, Flags, VerdictPill, PhasePill, stamp } from './ui';

export function Advisories() {
  const { c, tenantId, advisories, adv, tally, verdict, timeline, pickAdvisory, go, version } = useVr();
  const [phase, setPhase] = useState<'All' | VrPhase>('All');

  // Per-advisory tallies for the feed (tenant-scoped, session edits applied).
  const stats = useMemo(() => new Map(advisories.map((a) => {
    const rows = vrAssets(c, tenantId, a);
    return [a.id, { t: vrTally(rows), v: vrScopedVerdict(a, rows, tenantId) }] as const;
  })), [advisories, c, tenantId, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = advisories.filter((a) => phase === 'All' || a.phase === phase);
  const counts = { 'Active response': 0, Monitoring: 0, Closed: 0 } as Record<VrPhase, number>;
  advisories.forEach((a) => counts[a.phase]++);
  const byVerdict = (v: VrVerdict) => advisories.filter((a) => stats.get(a.id)?.v === v).length;
  const intel = c.connectors.find((k) => k.category === 'Intelligence' && k.vendor === 'Generic');

  return (
    <div className="grid g-3-2" style={{ alignItems: 'start' }}>
      <Card
        title="Live advisories"
        count={advisories.length}
        sub="Critical advisories (CVSS 9.0+) from the last 45 days, matched against your estate as they land · click to select"
        flush
        actions={<Sources items={[{ name: 'HexaInt' }, { name: intel?.product ?? 'Vendor PSIRT feeds', status: intel?.status }, { name: 'NVD' }, { name: 'CISA KEV' }]} />}
      >
        <div className="vr-facets">
          <FilterGroup label="State" value={phase} options={['Active response', 'Monitoring', 'Closed']} counts={counts} onChange={(v) => setPhase(v as typeof phase)} />
        </div>
        <div className="vr-feed">
          {shown.map((a) => {
            const s = stats.get(a.id)!;
            return (
              <button key={a.id} type="button" className={`vr-adv ${a.id === adv.id ? 'on' : ''} ${a.phase === 'Closed' ? 'closed' : ''}`} onClick={() => pickAdvisory(a.id, 'advisories')}>
                <CvssBadge score={a.cvss} big />
                <span className="vr-adv-main">
                  <span className="vr-adv-top">
                    <span className="vr-cve">{a.cve}</span>
                    <span>·</span>
                    <span>{a.vendor}</span>
                    <span>·</span>
                    <span title={stamp(a.publishedMinAgo)}>published {fmtAgo(a.publishedMinAgo)}</span>
                    <PhasePill phase={a.phase} />
                  </span>
                  <h4>{a.product}: {a.weakness.toLowerCase()}</h4>
                  <p>{a.summary}</p>
                  <Flags adv={a} />
                </span>
                <span className="vr-adv-side">
                  <VerdictPill verdict={s.v} />
                  {s.t.total > 0 ? (
                    <>
                      <span><b>{s.t.Patched}</b>/{s.t.total} patched</span>
                      {s.t.Unpatched > 0 && <span style={{ color: 'var(--sev-critical)', fontWeight: 600 }}>{s.t.Unpatched} exposed</span>}
                    </>
                  ) : s.v === 'Investigating' ? <span>{a.candidates} candidates</span> : <span>0 matches</span>}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="vr-stack">
        <Card title={<>Selected · <span className="vr-cve">{adv.cve}</span></>} sub={adv.family} actions={<VerdictPill verdict={verdict} />}>
          <KV
            rows={[
              ['Vendor · product', `${adv.vendor} · ${adv.product}`],
              ['Weakness', adv.weakness],
              ['Severity', <><CvssBadge score={adv.cvss} /> <span className="vr-muted" style={{ fontSize: 11.5 }}>{adv.vector}</span></>],
              ['Exploitation', <Flags adv={adv} />],
              ['Affected versions', adv.affectedVersions],
              ['Fixed in', adv.fixedIn],
              ['Published', `${stamp(adv.publishedMinAgo)} (${fmtAgo(adv.publishedMinAgo)})`],
              ['Matched', adv.verdict === 'Investigating' ? `${adv.candidates} candidates, versions being confirmed` : `${adv.matchedAfterMin} min after disclosure across 4 sources`],
              ['Feed', adv.feed],
            ]}
          />
          <div style={{ marginTop: 12 }}>
            <Callout kind="warn" color="var(--sev-high)"><b>Interim mitigation.</b> {adv.mitigation}</Callout>
          </div>
          <div className="vr-row" style={{ marginTop: 12 }}>
            <Btn sm onClick={() => go('exposure')}>Do we use it? <ArrowRight size={13} /></Btn>
            <Btn sm onClick={() => go('patch')} disabled={!tally.total}>Is it patched? <ArrowRight size={13} /></Btn>
            <Btn sm onClick={() => go('suppliers')}>Suppliers <ArrowRight size={13} /></Btn>
          </div>
        </Card>

        <Card title="Advisories by verdict" sub="Last 45 days · click a bar to filter">
          <Chart
            height={150}
            onClick={(p) => {
              const name = (p as { name?: string }).name;
              const a = advisories.find((x) => stats.get(x.id)?.v === name);
              if (a) pickAdvisory(a.id, 'advisories');
            }}
            option={{
              grid: { left: 8, right: 30, top: 6, bottom: 4, containLabel: true },
              tooltip: { trigger: 'item' },
              xAxis: { type: 'value', minInterval: 1, splitLine: { show: false }, axisLabel: { show: false } },
              yAxis: { type: 'category', data: ['Affected', 'Investigating', 'Not affected'], inverse: true },
              series: [{ type: 'bar', barWidth: 16, itemStyle: { borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', fontSize: 11.5, fontWeight: 700 }, data: [
                { value: byVerdict('Affected'), itemStyle: { color: SEV_HEX.critical } },
                { value: byVerdict('Investigating'), itemStyle: { color: SEV_HEX.medium } },
                { value: byVerdict('Not affected'), itemStyle: { color: '#2dd4bf' } },
              ] }],
            }}
          />
        </Card>

        <Card title="Response clock" sub={`${adv.cve} · from disclosure to now`} actions={<button className="link" onClick={() => go('statement')}>Full timeline →</button>}>
          <Timeline items={timeline.slice(0, 6).map((e) => ({ time: stamp(e.minAgo), title: e.title, body: e.body, color: e.color }))} />
        </Card>
      </div>
    </div>
  );
}
