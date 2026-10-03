import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../../../components/ui';
import { ratingsSource } from '../../../data/modules/comply';
import { TP_CHECKS, TP_DOMAINS, TP_DOMAIN_META, TP_LEVEL_COLOR, tpExposure, tpLevelOf, type TpDomain } from '../../../data/modules/tprm';
import { fmtNum } from '../../../lib/format';
import { useTprm } from './state';
import { Facet, FacetSelect, GapCard, Mono, Pill, ScoreRing, scoreColor } from './ui';

const PAGE = 25;

export function Exposure() {
  const { c, sup, tasks, go, openSupplier, grc } = useTprm();
  const [sp, setSp] = useSearchParams();
  const [limit, setLimit] = useState(PAGE);
  const ex = useMemo(() => tpExposure(sup), [sup]);
  const dom = (sp.get('domain') as TpDomain | null) ?? 'all';
  const supF = sp.get('supplier') ?? 'all';
  const setParam = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v === null || v === 'all') n.delete(k); else n.set(k, v); setSp(n, { replace: true }); setLimit(PAGE); };
  const openTasks = tasks.filter((t) => !t.done);
  const allGaps = useMemo(() => ex.live.flatMap((s) => s.gaps).sort((a, b) => b.score - a.score || a.supplierName.localeCompare(b.supplierName)), [ex.live]);
  const recs = allGaps.filter((g) => (dom === 'all' || g.domain === dom) && (supF === 'all' || g.supplierId === supF));
  const level = tpLevelOf(ex.portfolio);
  const src = ratingsSource(c);
  const checkFails = TP_CHECKS.map((k) => {
    const app = ex.live.filter((s) => s.results[k.id] !== undefined);
    const fail = app.filter((s) => s.results[k.id] === false).length;
    return { k, fail, app: app.length, pct: app.length ? Math.round((fail / app.length) * 100) : 0 };
  }).sort((a, b) => b.pct - a.pct);
  const focusRecs = (d: TpDomain | 'all') => { setParam('domain', d); document.getElementById('tp-recs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <div className="tp-stack">
      <p className="tp-intro">Where the risk in {c.short}'s supply base actually sits. Each domain is the mean of every live supplier's score in it — higher is worse.</p>

      <Card flush>
        <div className="tp-port">
          <ScoreRing score={ex.portfolio} size={104} stroke={10} sub="portfolio" />
          <div>
            <h3>Portfolio risk</h3>
            <p>Across {fmtNum(ex.live.length)} live suppliers, each assessed against whichever of 12 checks its record could answer. <b style={{ color: TP_LEVEL_COLOR[level] }}>{level} overall.</b></p>
            <small>{fmtNum(allGaps.length)} gaps recorded · {openTasks.length} open tasks · 12-month review cycle · scored in {grc}{src.connector ? `, rated by ${src.name}` : ''}</small>
          </div>
          <div className="tp-port-stats">
            <button type="button" className="tp-port-stat" onClick={() => focusRecs('all')} title={`Source: ${grc} register checks`}><span>Gaps</span><b>{fmtNum(allGaps.length)}</b></button>
            <button type="button" className="tp-port-stat" onClick={() => go('suppliers', { risk: 'high' })} title={`Source: ${grc} supplier scores`}><span>High risk</span><b style={{ color: 'var(--sev-critical)' }}>{sup.filter((s) => s.level === 'High').length}</b></button>
            <button type="button" className="tp-port-stat" onClick={() => go('tasks')} title={`Source: ${grc} TPRM tasks`}><span>Open tasks</span><b>{openTasks.length}</b></button>
          </div>
        </div>
      </Card>

      <div className="tp-doms">
        {ex.domains.map((d) => {
          const meta = TP_DOMAIN_META[d.d];
          const col = scoreColor(d.score);
          const dTasks = openTasks.filter((t) => t.domain === d.d).length;
          return (
            <section key={d.d} className={`tp-dom ${dom === d.d ? 'on' : ''}`}>
              <div className="tp-dom-head">
                <h4>{d.d}</h4>
                <Pill color={TP_LEVEL_COLOR[d.level]}>{d.level}</Pill>
                <span className="tp-dom-val" style={{ color: col }}>{d.score}<small>/100</small></span>
              </div>
              <div className="tp-dom-bar"><i style={{ width: `${Math.max(2, d.score)}%`, background: col }} /></div>
              <p>{meta.blurb}</p>
              <div className="tp-dom-stats">
                <button type="button" className="tp-dom-stat" onClick={() => focusRecs(d.d)} title={`Source: ${grc} · opens the recommendations for this domain`}>Gaps found<b>{fmtNum(d.gaps)}</b></button>
                <button type="button" className="tp-dom-stat" onClick={() => focusRecs(d.d)} title="Suppliers scoring 67 or more in this domain">High-risk suppliers<b>{d.highRisk}</b></button>
                <button type="button" className="tp-dom-stat" onClick={() => go('tasks', { domain: d.d })} title={`Source: ${grc} TPRM tasks`}>Open tasks<b>{dTasks}</b></button>
              </div>
              <div>
                <div className="tp-label" style={{ marginBottom: 4 }}>Reads</div>
                <div className="tp-dom-reads">{meta.reads.join(' · ')}</div>
              </div>
              <div>
                <div className="tp-label" style={{ marginBottom: 4 }}>Worst in this domain{d.worst.length > 4 ? ` · 4 of ${d.worst.length}` : ''}</div>
                <div className="tp-worst">
                  {d.worst.slice(0, 4).map((s) => (
                    <button key={s.id} type="button" onClick={() => openSupplier(s.id)}>
                      <Mono s={s} size="sm" /><span>{s.name}</span><b style={{ color: scoreColor(s.domains[d.d] ?? 0) }}>{s.domains[d.d]}</b>
                    </button>
                  ))}
                  {d.worst.length === 0 && <span className="tp-empty">No failing checks in this domain.</span>}
                </div>
              </div>
            </section>
          );
        })}
        <section className="tp-dom">
          <div className="tp-dom-head"><h4>Checks that fail most</h4></div>
          <p>Share of live suppliers failing each of the twelve checks, where the check applies.</p>
          <div style={{ display: 'grid', gap: 6 }}>
            {checkFails.map(({ k, fail, app, pct }) => (
              <button key={k.id} type="button" className="tp-mini" style={{ border: 0, background: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left', padding: '2px 0', gridTemplateColumns: 'minmax(0, 1.9fr) minmax(0, .9fr) 36px' }} onClick={() => focusRecs(k.domain)} title={`${fail} of ${app} applicable suppliers fail · ${k.domain}`}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.label}</span>
                <span className="tp-score-bar" style={{ width: '100%' }}><i style={{ width: `${Math.max(2, pct)}%`, background: TP_DOMAIN_META[k.domain].hex }} /></span>
                <b>{pct}%</b>
              </button>
            ))}
          </div>
        </section>
      </div>

      <Card title="Recommendations" count={fmtNum(recs.length)} flush>
        <div id="tp-recs" className="tp-count" style={{ borderTop: '1px solid var(--hairline)' }}>
          <span><b>{fmtNum(recs.length)}</b> of {fmtNum(allGaps.length)} — every gap the assessment found, worst first. Raising one puts it on the Tasks tab with its supplier attached.</span>
        </div>
        <div className="tp-facets">
          <Facet<TpDomain> label="Domain" value={dom} options={TP_DOMAINS.map((d) => ({ id: d, label: d, n: allGaps.filter((g) => g.domain === d).length }))} onChange={(v) => setParam('domain', v)} all="All domains" />
          <FacetSelect label="Supplier" value={supF} all="All suppliers" options={ex.live.filter((s) => s.gaps.length).sort((a, b) => b.score - a.score).map((s) => ({ id: s.id, label: `${s.name} (${s.score})` }))} onChange={(v) => setParam('supplier', v)} />
        </div>
        <div style={{ padding: 14 }} className="tp-gaps">
          {recs.slice(0, limit).map((g) => <GapCard key={g.key} gap={g} showSupplier mono={ex.live.find((s) => s.id === g.supplierId)?.mono} />)}
          {recs.length === 0 && <div className="tp-empty">No gaps match these filters.</div>}
          {recs.length > limit && <button type="button" className="tp-more" onClick={() => setLimit((l) => l + PAGE * 2)}>Show more ({fmtNum(recs.length - limit)} remaining)</button>}
        </div>
      </Card>
    </div>
  );
}
