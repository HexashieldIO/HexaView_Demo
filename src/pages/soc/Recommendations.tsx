import { useMemo, useState, type CSSProperties } from 'react';
import { Lightbulb, Laptop, ShieldCheck, TrendingUp, Wrench, ArrowRight } from 'lucide-react';
import { Card, Badge, KV, Btn, IcoBox, Callout, Ring } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { recommendations, endpointDevices, techName, type Recommendation } from '../../data/modules/soc';
import { useSoc, StatTile, Pills, RankList, RecordsDrawer, WriteBackModal, OtReadOnly, TechChips, type WriteBack } from './parts';

const CAT_COLOR: Record<Recommendation['category'], string> = { Accounts: '#a78bfa', Application: '#4f8cff', Network: '#2dd4bf', OS: '#f5a83d', 'Security controls': '#ef6aae', Clinical: '#0d9488', Plant: '#ea580c' };
const STATUS_LABEL: Record<Recommendation['status'], string> = { open: 'Open', in_progress: 'In progress', risk_accepted: 'Risk accepted' };

export default function SocRecommendations() {
  const { c, tenantId, tools, tone, scopeLabel, nav } = useSoc();
  const data = useMemo(() => recommendations(c, tenantId), [c, tenantId]);
  const devices = useMemo(() => endpointDevices(c, tenantId), [c, tenantId]);
  const [cat, setCat] = useState<string>('all');
  const [sel, setSel] = useState<Recommendation | null>(null);
  const [panel, setPanel] = useState<'devices' | 'score' | 'gain' | null>(null);
  const [wb, setWb] = useState<WriteBack | null>(null);
  const src = `${tools.edrShort} · Microsoft Secure Score · Intune`;
  const recs = data.recs;
  const open = recs.filter((r) => r.status !== 'risk_accepted');
  const rows = recs.filter((r) => cat === 'all' || r.category === cat);
  const cats = Array.from(new Set(recs.map((r) => r.category)));
  const gain = open.reduce((s, r) => s + r.points, 0);
  const sample = (r: Recommendation) => devices.filter((d) => (r.category === 'Plant' ? /HMI|Engineering/.test(d.kind) : r.category === 'Clinical' ? /wheels|Nursing|kiosk|Radiology/.test(d.kind) : r.category === 'Network' ? d.kind === 'Server' || /Server|VDA/.test(d.kind) : true)).slice(0, Math.min(10, r.devices));

  return (
    <>
      <p className="page-intro">
        <b>{scopeLabel}</b> · configuration gaps ranked by Secure Score impact from {tools.edrShort} and Intune, plus HexaSOC recommendations for {c.sector.toLowerCase()}: remediating from the top raises the score fastest.
      </p>

      <div className="soc-stats">
        <StatTile icon={<Lightbulb />} value={open.length} label="Open recommendations" tone={tone} onClick={() => setCat('all')} source={src} />
        <StatTile icon={<Laptop />} value={data.affected.toLocaleString('en-GB')} label="Unique affected devices" tone="#4f8cff" onClick={() => setPanel('devices')} source={src} />
        <StatTile icon={<ShieldCheck />} value={data.secureScore.toFixed(1)} label="Secure Score" bar={data.secureScore} tone="#2dd4bf" onClick={() => setPanel('score')} source="Microsoft Secure Score (device)" />
        <StatTile icon={<TrendingUp />} value={`+${gain}`} unit="pts" label="Available if all are fixed" tone="#a78bfa" onClick={() => setPanel('gain')} source="HexaSOC impact model" />
      </div>

      <div className="grid g-2-1">
        <Card title="Recommendations" count={`${rows.length} of ${recs.length}`} sub="Sorted by score impact · click for affected devices and the fix">
          <div style={{ marginBottom: 12 }}>
            <Pills label="Category" value={cat} onChange={setCat} tone={tone} items={[{ id: 'all', label: 'All', n: recs.length }, ...cats.map((x) => ({ id: x, label: x, n: recs.filter((r) => r.category === x).length }))]} />
          </div>
          <div className="soc-cards">
            {rows.map((r) => (
              <button key={r.title} type="button" className="soc-card" style={{ '--tone': CAT_COLOR[r.category] } as CSSProperties} onClick={() => setSel(r)}>
                <span className="soc-card-head">
                  <span className="t">{r.title}</span>
                  <span className="spacer" />
                  <span className="soc-score">+{r.points} pts</span>
                  <span className="muted" style={{ fontSize: 11 }}>{((r.points / 100) * 6.3).toFixed(2)}%</span>
                </span>
                <p>{r.desc}</p>
                <span className="soc-card-foot">
                  <span className="mono">{r.id}</span>·<span>{r.category} / {r.sub}</span>·<span><b>{r.devices.toLocaleString('en-GB')}</b> devices affected</span>·<span>Effort {r.effort.toLowerCase()}</span>
                  {r.status !== 'open' && <><span>·</span><Badge color={r.status === 'in_progress' ? 'var(--m-soc)' : 'var(--sev-info)'}>{STATUS_LABEL[r.status]}</Badge></>}
                </span>
              </button>
            ))}
          </div>
        </Card>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Secure Score" sub="Device posture">
            <div className="row" style={{ gap: 18 }}>
              <Ring value={data.secureScore} size={110} stroke={10} color="#2dd4bf" label={data.secureScore.toFixed(1)} sub="of 100" />
              <div className="stack" style={{ gap: 6, fontSize: 12.5 }}>
                <span>Top 3 fixes add <b>+{open.slice(0, 3).reduce((s, r) => s + r.points, 0)} pts</b></span>
                <span className="muted">{open.filter((r) => r.effort === 'Low').length} quick wins (low effort)</span>
                <button className="link" style={{ textAlign: 'left' }} onClick={() => setPanel('score')}>How the score is made →</button>
              </div>
            </div>
          </Card>
          <Card title="Impact by category" sub="Points available · click to filter">
            <RankList tone={tone} onPick={(id) => setCat(cat === id ? 'all' : id)} rows={cats.map((x) => ({ id: x, label: x, value: open.filter((r) => r.category === x).reduce((s, r) => s + r.points, 0), display: `+${open.filter((r) => r.category === x).reduce((s, r) => s + r.points, 0)} pts` })).sort((a, b) => b.value - a.value)} />
          </Card>
          <Card title="Effort vs impact" sub="Quick wins first">
            <div className="stack" style={{ gap: 8 }}>
              {(['Low', 'Medium', 'High'] as const).map((e) => {
                const rs = open.filter((r) => r.effort === e);
                return (
                  <div key={e} className="row between" style={{ fontSize: 12.5 }}>
                    <span><b>{e} effort</b> <span className="muted">· {rs.length} items</span></span>
                    <span className="soc-score">+{rs.reduce((s, r) => s + r.points, 0)} pts</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {sel && (
        <Drawer
          title={sel.title}
          sub={<span className="row wrap" style={{ gap: 6 }}><span className="mono">{sel.id}</span><Badge color={CAT_COLOR[sel.category]}>{sel.category}</Badge><span className="soc-score">+{sel.points} pts</span></span>}
          icon={<IcoBox color={CAT_COLOR[sel.category]}><Lightbulb /></IcoBox>}
          onClose={() => setSel(null)}
          footer={
            sel.category === 'Plant' || sel.category === 'Clinical' ? (
              <Btn onClick={() => nav(c.tenants.some((t) => t.env.includes('ot')) ? '/ot/visibility' : '/soc/entities')}>Open in {sel.category === 'Plant' || sel.category === 'Clinical' ? 'HexaOT' : 'Entities'} <ArrowRight size={14} /></Btn>
            ) : (
              <Btn primary onClick={() => setWb({ title: `Apply: ${sel.title}`, system: sel.via, target: `${sel.devices.toLocaleString('en-GB')} devices`, changes: [`Push the policy through ${sel.via} to a 5% pilot ring`, 'Expand to all affected devices after 72 h without help-desk regressions', `Secure Score expected to rise by ${sel.points} points`], risk: sel.userImpact === 'High' ? 'high' : sel.userImpact === 'Medium' ? 'medium' : 'low', done: `Policy "${sel.title}" queued for pilot` })}><Wrench size={14} /> Apply via {sel.via.split(' ')[0]}</Btn>
            )
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <div className="soc-prose"><p>{sel.desc}</p></div>
            <KV rows={[
              ['Score impact', `+${sel.points} points`],
              ['Devices affected', sel.devices.toLocaleString('en-GB')],
              ['Effort / user impact', `${sel.effort} / ${sel.userImpact}`],
              ['Applied through', sel.via],
              ['Status', STATUS_LABEL[sel.status]],
              ['Mitigates', <TechChips key="t" ids={sel.techniques} max={4} />],
            ]} />
            <div className="muted" style={{ fontSize: 12 }}>{sel.techniques.map((t) => `${t} ${techName(t)}`).join(' · ')}</div>
            {(sel.category === 'Plant' || sel.category === 'Clinical') && <OtReadOnly>{sel.category === 'Clinical' ? 'Clinical devices are changed by Clinical Engineering under biomed change control; HexaView recommends and tracks.' : 'Plant systems are changed by site OT engineers under the plant change calendar; HexaView recommends and tracks.'}</OtReadOnly>}
            <div>
              <div className="section-label">Sample of affected devices</div>
              <div className="list">
                {sample(sel).map((d) => (
                  <div key={d.host} className="list-row" style={{ cursor: 'pointer' }} onClick={() => nav(`/soc/entities?q=${encodeURIComponent(d.host)}`)}>
                    <span className="list-main"><b className="mono">{d.host}</b><span>{d.kind} · {d.os}</span></span>
                    <Badge color={d.exposure === 'High' ? 'var(--sev-high)' : d.exposure === 'Medium' ? 'var(--sev-medium)' : 'var(--good)'}>{d.exposure}</Badge>
                  </div>
                ))}
              </div>
            </div>
            {sel.status === 'risk_accepted' && <Callout>Risk accepted by {c.people.ciso.name} until the next review; excluded from the score target.</Callout>}
          </div>
        </Drawer>
      )}

      {panel && (
        <RecordsDrawer
          title={panel === 'devices' ? 'Affected devices' : panel === 'score' ? 'How the Secure Score is made' : 'Points available'}
          sub={panel === 'score' ? `Score ${data.secureScore.toFixed(1)} of 100 · open items subtract their weighted points` : undefined}
          source={panel === 'score' ? 'Microsoft Secure Score (device)' : src}
          icon={<ShieldCheck />}
          onClose={() => setPanel(null)}
          rows={panel === 'devices'
            ? devices.filter((d) => d.exposure !== 'None').slice(0, 40).map((d) => ({ id: d.host, title: d.host, sub: `${d.kind} · ${d.os} · ${d.vulns} findings`, right: <Badge color={d.exposure === 'High' ? 'var(--sev-high)' : 'var(--sev-medium)'}>{d.exposure}</Badge>, onClick: () => nav(`/soc/entities?q=${encodeURIComponent(d.host)}`) }))
            : recs.map((r) => ({ id: r.title, title: r.title, sub: `${r.category} · ${STATUS_LABEL[r.status]} · ${r.devices} devices`, right: <span className="soc-score">{panel === 'score' ? `−${(r.points * 0.28).toFixed(1)}` : `+${r.points}`}</span>, onClick: () => { setPanel(null); setSel(r); } }))}
        />
      )}
      {wb && <WriteBackModal wb={wb} onClose={() => setWb(null)} />}
    </>
  );
}
