import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KpiStrip, Card, Callout, Legend, Btn, Sources } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { useIntro } from '../../lib/useIntro';
import { FilterChip } from '../ops/parts';
import { CSF_FUNCTIONS, CSF_CAT_BY_ID, STATUS_HEX, maturity, frameworkMaturity, type CsfFn } from '../../data/modules/programme';
import { usePg, PG_TONE, PG_HEX, InitiativeDrawer, StatusPill, type PC } from './parts';

const FN_HEX = Object.fromEntries(CSF_FUNCTIONS.map((f) => [f.id, f.hex])) as Record<CsfFn, string>;

export default function Maturity() {
  const nav = useNavigate();
  const { c, tenantId, list, grc } = usePg();
  const [sp, setSp] = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);
  const anim = useIntro(`pg-ma-${c.id}-${tenantId}`, 1600);
  const fnF = sp.get('fn') as CsfFn | null;
  const catF = sp.get('cat');
  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v === null ? n.delete(k) : n.set(k, v)));
    setSp(n, { replace: true });
  };
  const m = useMemo(() => maturity(c, list), [c, list]);
  const fwm = useMemo(() => frameworkMaturity(c, list), [c, list]);
  const byId = new Map(list.map((i) => [i.id, i]));
  const avg = (k: 'current' | 'target' | 'projected') => m.fns.reduce((s, f) => s + f[k], 0) / m.fns.length;
  const gaps = m.cats.filter((x) => x.target - x.current >= 0.3).sort((a, b) => (b.target - b.current) - (a.target - a.current));
  const uncovered = gaps.filter((x) => !x.initiatives.length);
  const belowFn = m.fns.filter((f) => f.target - f.current >= 0.3);
  const cats = m.cats.filter((x) => !fnF || x.fn === fnF);
  const selCat = catF ? m.cats.find((x) => x.id === catF) : null;
  const gapList = selCat ? [selCat] : gaps.filter((x) => !fnF || x.fn === fnF);
  const filterLabel = [fnF && CSF_FUNCTIONS.find((f) => f.id === fnF)?.label, selCat && `${selCat.id} ${selCat.label}`].filter(Boolean).join(' · ');

  return (
    <div className="pg-stack">
      <p className="page-intro">
        <b>{c.name}</b> maturity against NIST CSF 2.0 (tiers 1 Partial to 4 Adaptive): today, the target agreed with {c.people.board.name}, and where the programme lands if it delivers. Scores are evidence-weighted from {grc} controls and HexaView telemetry; every gap links to the initiatives that close it.
      </p>

      <KpiStrip
        toneColor={PG_TONE}
        items={[
          { label: 'Overall tier', value: <>{anim(avg('current')).toFixed(1)}<small style={{ fontSize: 14, color: 'var(--text-muted)' }}> → {avg('target').toFixed(1)}</small></>, unit: 'current → target', bar: (avg('current') / 4) * 100, onClick: () => set({ fn: null, cat: null }), source: `NIST CSF 2.0 self-assessment · evidence from ${grc}` },
          { label: 'Projected at end', value: anim(avg('projected')).toFixed(1), unit: `${Math.round(((avg('projected') - avg('current')) / Math.max(0.1, avg('target') - avg('current'))) * 100)}% of gap closed`, toneColor: 'var(--good)', to: '/programme/roadmap', source: 'Maturity uplift modelled from initiative scope and progress' },
          { label: 'Functions below target', value: Math.round(anim(belowFn.length)), unit: `of ${m.fns.length}`, onClick: () => set({ fn: belowFn[0]?.id ?? null, cat: null }), source: 'Function mean vs target tier' },
          { label: 'Category gaps', value: Math.round(anim(gaps.length)), unit: `of ${m.cats.length} categories`, onClick: () => document.getElementById('pg-gaps')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), source: 'Categories 0.3 or more tiers below target' },
          { label: 'Gaps without an initiative', value: Math.round(anim(uncovered.length)), toneColor: uncovered.length ? 'var(--sev-medium)' : 'var(--good)', onClick: () => set({ cat: uncovered[0]?.id ?? null, fn: null }), source: 'Gaps with no initiative mapped to the category' },
          ...(fwm ? [{ label: `${fwm.fw.short} readiness`, value: `${Math.round(anim(fwm.domains.reduce((s, d) => s + d.current, 0) / fwm.domains.length))}%`, unit: `→ ${Math.round(fwm.domains.reduce((s, d) => s + d.projected, 0) / fwm.domains.length)}% projected`, to: `/comply/caas?section=frameworks&framework=${fwm.fw.id}`, source: `${grc} · ${fwm.fw.name}` }] : []),
        ]}
      />

      <div className="pg-tiers">
        {m.fns.map((f, k) => (
          <button key={f.id} type="button" className={`pg-tier pg-rise ${fnF === f.id ? 'on' : ''}`} style={{ '--pc': f.hex, '--d': `${k * 0.05}s` } as PC} onClick={() => set({ fn: fnF === f.id ? null : f.id, cat: null })} title="Filter categories by this function">
            <span className="n">{f.label}</span>
            <span className="v" style={{ color: f.hex }}>{anim(f.current, k * 60).toFixed(1)}<small>→ {f.target.toFixed(1)}</small></span>
            <span className="s">Projected {f.projected.toFixed(1)} · {m.cats.filter((x) => x.fn === f.id && x.target - x.current >= 0.3).length} gaps</span>
          </button>
        ))}
      </div>

      <div className="grid g-1-2">
        <Card title="Current vs target by function" sub="Tier 1 Partial · 2 Risk informed · 3 Repeatable · 4 Adaptive" actions={<Sources items={[{ name: grc }, { name: 'HexaView telemetry' }]} />}>
          <Chart
            height={330}
            option={{
              tooltip: { trigger: 'item' },
              radar: {
                indicator: m.fns.map((f) => ({ name: f.label, max: 4, min: 0 })),
                radius: '66%',
                splitNumber: 4,
                axisName: { color: '#9aa6c2', fontSize: 11.5 },
              },
              series: [{
                type: 'radar',
                symbolSize: 5,
                data: [
                  { name: 'Target', value: m.fns.map((f) => f.target), lineStyle: { color: '#e8ecf6', type: 'dashed', width: 1.6 }, itemStyle: { color: '#e8ecf6' }, areaStyle: { opacity: 0 } },
                  { name: 'Projected at programme end', value: m.fns.map((f) => f.projected), lineStyle: { color: '#2dd4bf', width: 1.8 }, itemStyle: { color: '#2dd4bf' }, areaStyle: { color: '#2dd4bf', opacity: 0.1 } },
                  { name: 'Current', value: m.fns.map((f) => f.current), lineStyle: { color: PG_HEX, width: 2.4 }, itemStyle: { color: PG_HEX }, areaStyle: { color: PG_HEX, opacity: 0.28 } },
                ],
              }],
            }}
          />
          <Legend items={[{ label: 'Current', color: PG_HEX }, { label: 'Projected at programme end', color: '#2dd4bf' }, { label: 'Target', color: '#e8ecf6' }]} />
        </Card>

        <Card title="By category" sub="Solid = today · light = projected · white tick = target · click a category for the initiatives that close it" actions={<FilterChip label={filterLabel || null} onClear={() => set({ fn: null, cat: null })} />}>
          <div className="pg-anim" key={`${c.id}-${tenantId}-${fnF}`}>
            {CSF_FUNCTIONS.filter((f) => !fnF || f.id === fnF).map((f) => (
              <div key={f.id}>
                <div className="pg-fnhead" style={{ color: f.hex }}><i style={{ background: f.hex }} />{f.label}<span>{m.fns.find((x) => x.id === f.id)?.current.toFixed(1)} now</span></div>
                {cats.filter((x) => x.fn === f.id).map((x, k) => {
                  const gap = x.target - x.current >= 0.3;
                  return (
                    <button key={x.id} type="button" className={`pg-catrow ${catF === x.id ? 'on' : ''} ${gap ? '' : 'nogap'}`} style={{ '--pc': FN_HEX[x.fn], '--d': `${k * 0.05}s` } as PC} onClick={() => set({ cat: catF === x.id ? null : x.id })} title={`${x.id} ${x.label}: ${x.current} now, ${x.projected} projected, target ${x.target}\n${x.initiatives.length} initiatives`}>
                      <span className="id">{x.id}</span>
                      <span className="nm">{x.label}</span>
                      <span className="trk">
                        <i className="pj" style={{ width: `${(x.projected / 4) * 100}%` }} />
                        <i className="cu" style={{ width: `${(x.current / 4) * 100}%` }} />
                        {[1, 2, 3].map((t) => <i key={t} className="tk" style={{ left: `${(t / 4) * 100}%` }} />)}
                        <i className="tg" style={{ left: `calc(${(x.target / 4) * 100}% - 1px)` }} />
                      </span>
                      <span className="v"><b>{x.current.toFixed(1)}</b> → {x.target.toFixed(1)}{x.initiatives.length ? '' : gap ? ' ·  none' : ''}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g-3-2">
        <div id="pg-gaps" style={{ scrollMarginTop: 80, minWidth: 0 }}>
          <Card title={selCat ? `${selCat.id} ${selCat.label}` : 'Gaps and the initiatives that close them'} sub={selCat ? `${selCat.current.toFixed(1)} now · ${selCat.projected.toFixed(1)} projected · target ${selCat.target.toFixed(1)}` : 'Largest gap first'} count={gapList.length}>
            <div className="pg-rows">
              {gapList.slice(0, selCat ? 1 : 10).map((x) => (
                <div key={x.id} className="pg-li" style={{ '--pc': FN_HEX[x.fn], gridTemplateColumns: '64px minmax(0, 1fr) auto' } as PC}>
                  <b className="mono" style={{ color: FN_HEX[x.fn], fontSize: 12 }}>{x.id}</b>
                  <div>
                    <b>{CSF_CAT_BY_ID[x.id]?.label} · gap {(x.target - x.current).toFixed(1)} tiers</b>
                    {x.initiatives.length ? (
                      <div className="pg-links" style={{ marginTop: 5 }}>
                        {x.initiatives.map((id) => {
                          const i = byId.get(id);
                          return i ? <button key={id} type="button" onClick={() => setOpen(id)} title={`${i.status} · ${i.pct}%`}><i style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_HEX[i.status], display: 'inline-block' }} /> {id} {i.title}</button> : null;
                        })}
                      </div>
                    ) : <span style={{ color: 'var(--sev-medium)' }}>No initiative closes this gap yet; propose one at the next steering committee.</span>}
                  </div>
                  <span className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>→ {x.projected.toFixed(1)}</span>
                </div>
              ))}
              {!gapList.length && <Callout kind="good">No gaps of 0.3 tiers or more in this selection.</Callout>}
            </div>
            {selCat && <div className="row" style={{ marginTop: 10, gap: 8 }}><Btn onClick={() => nav(`/programme/initiatives?cat=${selCat.id}`)}>Open in initiative register</Btn><Btn ghost onClick={() => set({ cat: null })}>All gaps</Btn></div>}
          </Card>
        </div>

        {fwm && (
          <Card title={`${fwm.fw.short} maturity`} sub={fwm.scheme} actions={<Btn sm onClick={() => nav(`/comply/caas?section=frameworks&framework=${fwm.fw.id}`)}>Open in HexaComply</Btn>}>
            {(fwm.levelNow || fwm.levelTarget) && (
              <div className="row" style={{ gap: 18, marginBottom: 10 }}>
                {fwm.levelNow && <div className="pg-stat"><b>{fwm.levelNow}</b><span>Today</span></div>}
                {fwm.levelTarget && <div className="pg-stat"><b style={{ color: 'var(--good)' }}>{fwm.levelTarget}</b><span>Target</span></div>}
              </div>
            )}
            <div className="pg-anim" key={`fw-${c.id}`}>
              {fwm.domains.map((d, k) => (
                <button key={d.id} type="button" className="pg-catrow" style={{ '--pc': PG_HEX, '--d': `${k * 0.04}s`, gridTemplateColumns: 'minmax(120px, 190px) minmax(0, 1fr) 80px' } as PC} onClick={() => nav(`/comply/caas?section=frameworks&framework=${fwm.fw.id}`)} title={`${d.label}: ${d.current}% now, ${d.projected}% projected`}>
                  <span className="nm">{d.label}</span>
                  <span className="trk">
                    <i className="pj" style={{ width: `${d.projected}%` }} />
                    <i className="cu" style={{ width: `${d.current}%` }} />
                    <i className="tg" style={{ left: 'calc(100% - 2px)' }} />
                  </span>
                  <span className="v"><b>{d.current}%</b> → {d.projected}%</span>
                </button>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 11.5, margin: '10px 0 6px' }}>Initiatives that move {fwm.fw.short}:</div>
            <div className="pg-links">
              {fwm.initiatives.map((id) => { const i = byId.get(id); return i ? <button key={id} type="button" onClick={() => setOpen(id)}>{id} · {i.title} <StatusPill s={i.status} /></button> : null; })}
              {!fwm.initiatives.length && <span className="muted">None mapped yet.</span>}
            </div>
          </Card>
        )}
      </div>

      <Card title="Framework readiness across the estate" sub="Documented and assured today, projected once linked initiatives land · click to open the framework" flush>
        <table className="tbl">
          <thead><tr><th>Framework</th><th>Kind</th><th className="r">Documented</th><th className="r">Assured</th><th className="r">Projected</th><th className="r">Initiatives</th><th>Next audit</th></tr></thead>
          <tbody>
            {c.frameworks.map((f) => {
              const linked = list.filter((i) => i.frameworks.some((x) => x.id === f.id));
              const lift = Math.min(100 - f.documented, linked.reduce((s, i) => s + (i.status === 'Complete' ? 0 : i.riGain * 2.2), 0));
              return (
                <tr key={f.id} className="clickable" onClick={() => nav(`/comply/caas?section=frameworks&framework=${f.id}`)}>
                  <td><div className="t-main">{f.short}</div><div className="t-sub">{f.name}</div></td>
                  <td>{f.kind}</td>
                  <td className="r">{f.documented}%</td>
                  <td className="r">{f.assured}%</td>
                  <td className="r"><b style={{ color: 'var(--good)' }}>{Math.round(f.documented + lift)}%</b></td>
                  <td className="r"><a style={{ cursor: 'pointer', color: PG_TONE }} onClick={(e) => { e.stopPropagation(); nav(`/programme/initiatives?fw=${f.id}`); }}>{linked.length}</a></td>
                  <td>{f.nextAudit ?? <span className="muted">Continuous</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {open && <InitiativeDrawer id={open} onClose={() => setOpen(null)} onOpen={setOpen} />}
    </div>
  );
}
