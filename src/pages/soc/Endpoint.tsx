import { useMemo, useState, type CSSProperties } from 'react';
import { Bug, Laptop, ShieldAlert, Flame, Clock, Search, Wrench, ArrowRight } from 'lucide-react';
import { Card, Badge, SevBadge, KV, Btn, IcoBox, Callout, Sources, SEV_COLOR, cap } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { endpointCves, endpointDevices, techName, type EndpointCve } from '../../data/modules/soc';
import { SEV_HEX } from '../../components/Chart';
import type { Severity } from '../../data/types';
import { useSoc, StatTile, Pills, SegBar, RankList, RecordsDrawer, WriteBackModal, useParamFilter, type WriteBack } from './parts';

type SevF = 'all' | Severity;
type ScoreF = 'all' | '9' | '7' | '4';

export default function SocEndpoint() {
  const { c, tenantId, tools, tone, scopeLabel, nav } = useSoc();
  const cves = useMemo(() => endpointCves(c, tenantId), [c, tenantId]);
  const devices = useMemo(() => endpointDevices(c, tenantId), [c, tenantId]);
  const [sev, setSev] = useParamFilter<SevF>('severity', ['all', 'critical', 'high', 'medium', 'low'] as const, 'all');
  const [score, setScore] = useState<ScoreF>('all');
  const [kevOnly, setKevOnly] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [sel, setSel] = useState<EndpointCve | null>(null);
  const [panel, setPanel] = useState<'devices' | 'kev' | 'age' | null>(null);
  const [wb, setWb] = useState<WriteBack | null>(null);
  const vm = c.connectors.find((k) => k.category === 'Vulnerability');
  const src = `${tools.edrShort}${vm ? ` · ${vm.vendor} ${vm.product}` : ''}`;

  const devCount = (x: EndpointCve) => x.devices.reduce((n, d) => n + (d.startsWith('+') ? parseInt(d.slice(1), 10) : 1), 0);
  const affected = new Set(cves.flatMap((x) => x.devices.filter((d) => !d.startsWith('+'))));
  const totalAffected = cves.reduce((n, x) => n + devCount(x), 0);
  const bySev = (s: Severity) => cves.filter((x) => x.sev === s).length;
  const kev = cves.filter((x) => x.kev);
  const rows = cves.filter((x) => (sev === 'all' || x.sev === sev) && (score === 'all' || x.cvss >= Number(score)) && (!kevOnly || x.kev) && (cat === 'all' || x.category === cat) && (!q.trim() || `${x.id} ${x.product} ${x.title}`.toLowerCase().includes(q.toLowerCase())));
  const cats = Array.from(new Set(cves.map((x) => x.category)));
  const oldest = cves.filter((x) => x.sev === 'critical' || x.sev === 'high').sort((a, b) => b.publishedDays - a.publishedDays);

  return (
    <>
      <p className="page-intro">
        <b>{scopeLabel}</b> · software vulnerabilities on onboarded endpoints and servers, read from {tools.edrShort}{vm ? ` and ${vm.vendor} ${vm.product}` : ''}, ranked by CVSS, CISA KEV and exploit availability. Patching is pushed through your own tooling with approvals.
      </p>

      <div className="soc-stats">
        <StatTile icon={<Bug />} value={cves.length} label="Total CVEs" tone={tone} onClick={() => { setSev('all'); setKevOnly(false); }} source={src} />
        <StatTile icon={<Laptop />} value={totalAffected.toLocaleString('en-GB')} label="Affected devices" tone="#4f8cff" onClick={() => setPanel('devices')} source={src} />
        <StatTile icon={<ShieldAlert />} value={bySev('critical')} label="Critical" tone={SEV_HEX.critical} onClick={() => setSev('critical')} source={src} />
        <StatTile icon={<Flame />} value={kev.length} label="On CISA KEV (exploited)" tone={SEV_HEX.high} onClick={() => setPanel('kev')} source="CISA KEV catalogue · HexaInt" />
        <StatTile icon={<Clock />} value={`${oldest[0]?.publishedDays ?? 0} d`} label="Oldest open critical/high" tone="#f5a83d" onClick={() => setPanel('age')} source={src} />
      </div>

      <Card title="By severity" sub="Click a segment to filter">
        <SegBar parts={(['critical', 'high', 'medium', 'low'] as Severity[]).map((s) => ({ id: s, label: cap(s), value: bySev(s), color: SEV_HEX[s as keyof typeof SEV_HEX] }))} onPick={(id) => setSev(id as Severity)} />
      </Card>

      <div className="grid g-2-1">
        <Card title="Vulnerabilities" count={`${rows.length} of ${cves.length}`} sub="Click a CVE for affected devices and remediation">
          <div className="row wrap" style={{ gap: 10, marginBottom: 12 }}>
            <Pills label="Severity" value={sev} onChange={setSev} tone={tone} items={[{ id: 'all', label: 'All' }, ...(['critical', 'high', 'medium', 'low'] as Severity[]).map((s) => ({ id: s, label: cap(s), n: bySev(s) }))]} />
            <Pills label="Score" value={score} onChange={setScore} tone={tone} items={[{ id: 'all', label: 'All' }, { id: '9', label: '9.0+' }, { id: '7', label: '7.0+' }, { id: '4', label: '4.0+' }]} />
            <button type="button" className={`soc-pill ${kevOnly ? 'on' : ''}`} onClick={() => setKevOnly(!kevOnly)} style={{ '--tone': SEV_HEX.high } as CSSProperties}><Flame size={12} /> KEV only</button>
            <label className="search" style={{ flex: '0 1 220px' }}>
              <Search size={14} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search CVE or product…" aria-label="Search CVE" />
            </label>
          </div>
          <div className="soc-cards">
            {rows.map((x) => (
              <button key={x.id} type="button" className="soc-card" style={{ '--tone': SEV_COLOR[x.sev] } as CSSProperties} onClick={() => setSel(x)}>
                <span className="soc-card-head">
                  <span className="mono">{x.id}</span>
                  <span className="t" style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text-secondary)' }}>{x.product}</span>
                  <span className="spacer" />
                  {x.kev && <Badge color="var(--sev-high)" solid>KEV</Badge>}
                  <SevBadge sev={x.sev} />
                  <Badge color="#8b5cf6">CVSS {x.cvss.toFixed(1)}</Badge>
                </span>
                <p>{x.desc} Remediation: {x.remediation}</p>
                <span className="soc-card-foot">
                  <span>Published {x.publishedDays} d ago</span>·<span><b>{devCount(x)}</b> device{devCount(x) === 1 ? '' : 's'}</span>·<span>{x.category}</span>·<span>EPSS {(x.epss * 100).toFixed(0)}%</span>
                  {x.exploit && !x.kev && <><span>·</span><span style={{ color: 'var(--sev-high)' }}>Public exploit</span></>}
                </span>
              </button>
            ))}
            {rows.length === 0 && <div className="empty">No CVEs match these filters.</div>}
          </div>
        </Card>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="By software category" sub="Affected devices · click to filter">
            <RankList tone={tone} onPick={(id) => setCat(cat === id ? 'all' : id)} rows={cats.map((k) => ({ id: k, label: k, value: cves.filter((x) => x.category === k).reduce((n, x) => n + devCount(x), 0), sub: `${cves.filter((x) => x.category === k).length} CVEs` })).sort((a, b) => b.value - a.value)} />
          </Card>
          <Card title="Most exposed devices" sub={`From ${tools.edrShort} · click for detail`}>
            <RankList tone="#f5a83d" onPick={() => nav('/soc/entities?exposure=High')} rows={devices.slice().sort((a, b) => b.vulns - a.vulns).slice(0, 8).map((d) => ({ id: d.host, label: <span className="mono">{d.host}</span>, sub: d.kind, value: d.vulns }))} />
          </Card>
          <Card title="Sources">
            <Sources items={[...(tools.edr ? [{ name: tools.edrShort, status: tools.edr.status }] : []), ...(vm ? [{ name: `${vm.vendor} ${vm.product}`, status: vm.status }] : []), { name: 'CISA KEV' }, { name: 'FIRST EPSS' }]} />
            <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{affected.size} distinct devices named in this view; counts include the full estate.</div>
          </Card>
        </div>
      </div>

      {sel && (
        <Drawer
          title={`${sel.id} · ${sel.title}`}
          sub={<span className="row wrap" style={{ gap: 6 }}>{sel.product}<SevBadge sev={sel.sev} /><Badge color="#8b5cf6">CVSS {sel.cvss.toFixed(1)}</Badge>{sel.kev && <Badge color="var(--sev-high)" solid>CISA KEV</Badge>}</span>}
          icon={<IcoBox color={SEV_COLOR[sel.sev]}><Bug /></IcoBox>}
          onClose={() => setSel(null)}
          footer={
            <>
              <Btn onClick={() => nav('/soc/recommendations')}>Related recommendations <ArrowRight size={14} /></Btn>
              <Btn primary onClick={() => setWb({ title: `Remediate ${sel.id}`, system: c.connectors.find((k) => k.category === 'ITSM')?.product ?? 'ITSM', target: `${devCount(sel)} devices running ${sel.product}`, changes: [`Create a change in ${c.connectors.find((k) => k.category === 'ITSM')?.product ?? 'ITSM'} with the affected devices and fix: ${sel.remediation}`, `Deploy via ${tools.edrShort} / Intune to a pilot ring first, then all devices`, c.id === 'healthcare' ? 'Clinical workstations follow the Epic validation calendar' : c.id === 'automotive' ? 'Plant hosts follow the plant change calendar; HMIs are excluded' : 'Servers patched in the next maintenance window'], risk: sel.category === 'Server' || sel.category === 'Remote access' ? 'medium' : 'low', done: `Remediation change for ${sel.id} raised` })}><Wrench size={14} /> Raise remediation</Btn>
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <div className="soc-prose"><p>{sel.desc}</p><p><b>Remediation.</b> {sel.remediation}</p></div>
            <KV rows={[
              ['Published', `${sel.publishedDays} days ago`],
              ['Exploited in the wild', sel.kev ? 'Yes (CISA KEV)' : sel.exploit ? 'Public exploit available' : 'No known exploitation'],
              ['EPSS', `${(sel.epss * 100).toFixed(0)}% probability of exploitation in 30 days`],
              ['Software', sel.software.join(', ')],
              ['ATT&CK', sel.category === 'Remote access' || sel.category === 'Server' ? `T1190 ${techName('T1190')}` : sel.category === 'OS' ? `T1068 ${techName('T1068')}` : `T1203 ${techName('T1203')}`],
              ['Source', src],
            ]} />
            <div>
              <div className="section-label">Affected devices · {devCount(sel)}</div>
              <div className="chips">{sel.devices.map((d) => <span key={d} className="src-chip" style={{ cursor: d.startsWith('+') ? 'default' : 'pointer' }} onClick={() => !d.startsWith('+') && nav(`/soc/entities?q=${encodeURIComponent(d)}`)}>{d}</span>)}</div>
            </div>
            {sel.kev && <Callout kind="warn">On the CISA KEV catalogue: {c.id === 'healthcare' ? 'HPH CPG 1.1 expects known exploited vulnerabilities fixed within 14 days.' : c.id === 'automotive' ? 'NIS2 and TISAX expect exploited flaws to be prioritised; the HexaSOC target is 14 days.' : 'the HexaSOC target is remediation within 14 days.'}</Callout>}
          </div>
        </Drawer>
      )}

      {panel && (
        <RecordsDrawer
          title={panel === 'devices' ? 'Affected devices' : panel === 'kev' ? 'Exploited vulnerabilities (CISA KEV)' : 'Oldest open vulnerabilities'}
          source={panel === 'kev' ? 'CISA KEV catalogue · HexaInt' : src}
          icon={panel === 'devices' ? <Laptop /> : <Flame />}
          onClose={() => setPanel(null)}
          rows={panel === 'devices'
            ? devices.filter((d) => affected.has(d.host)).map((d) => ({ id: d.host, title: d.host, sub: `${d.kind} · ${d.os} · ${cves.filter((x) => x.devices.includes(d.host)).map((x) => x.id).join(', ')}`, right: <Badge color={d.exposure === 'High' ? 'var(--sev-high)' : d.exposure === 'Medium' ? 'var(--sev-medium)' : 'var(--good)'}>{d.exposure}</Badge>, onClick: () => nav(`/soc/entities?q=${encodeURIComponent(d.host)}`) }))
            : (panel === 'kev' ? kev : oldest).map((x) => ({ id: x.id, title: `${x.id} · ${x.product}`, sub: `${x.title} · ${devCount(x)} devices · ${x.publishedDays} d old`, right: <SevBadge sev={x.sev} />, onClick: () => { setPanel(null); setSel(x); } }))}
        />
      )}
      {wb && <WriteBackModal wb={wb} onClose={() => setWb(null)} />}
    </>
  );
}
