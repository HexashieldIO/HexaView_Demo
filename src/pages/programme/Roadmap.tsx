import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Chip, Callout, Tabs } from '../../components/ui';
import { FilterChip } from '../ops/parts';
import {
  WORKSTREAMS, WS_BY_ID, STATUS_HEX, PG_STATUSES, PG_MONTHS, TODAY_M, QUARTERS, CUR_Q, quarterLabel, monthLabel, monthDate,
  type Initiative, type PgStatus, type WsId,
} from '../../data/modules/programme';
import { fmtDateShort } from '../../lib/format';
import { usePg, PG_TONE, InitiativeDrawer, ownersOf, useWidth, StatusPill, type PC } from './parts';

type Zoom = 'quarter' | 'month';
const LABEL_W = 270;
const HEAD_H = 46;
const GROUP_H = 26;
const ROW_H = 30;

export default function Roadmap() {
  const { c, tenantId, list } = usePg();
  const [sp, setSp] = useSearchParams();
  const [zoom, setZoom] = useState<Zoom>('quarter');
  const [open, setOpen] = useState<string | null>(null);
  const [ref, W] = useWidth(1100);
  const wrapRef = useRef<HTMLDivElement>(null);
  const wsF = sp.get('ws') as WsId | null;
  const stF = sp.get('status') as PgStatus | null;
  const ownerF = sp.get('owner');
  const focus = sp.get('focus');
  const set = (k: string, v: string | null) => {
    const n = new URLSearchParams(sp);
    if (v === null) n.delete(k);
    else n.set(k, v);
    setSp(n, { replace: true });
  };

  const owners = ownersOf(list);
  const shown = list.filter((i) => (!wsF || i.ws === wsF) && (!stF || i.status === stF) && (!ownerF || i.owner.name === ownerF));
  const ppm = zoom === 'month' ? 72 : Math.max(26, (W - LABEL_W - 18) / PG_MONTHS);
  const svgW = LABEL_W + ppm * PG_MONTHS + 16;
  const X = (m: number) => LABEL_W + m * ppm;

  // Layout: workstream group headers then one row per initiative.
  const layout = useMemo(() => {
    const rows: { kind: 'group'; ws: WsId; y: number; n: number }[] = [];
    const bars: { i: Initiative; y: number; idx: number }[] = [];
    let y = HEAD_H;
    let idx = 0;
    WORKSTREAMS.forEach((w) => {
      const xs = shown.filter((i) => i.ws === w.id).sort((a, b) => a.start - b.start);
      if (!xs.length) return;
      rows.push({ kind: 'group', ws: w.id, y, n: xs.length });
      y += GROUP_H;
      xs.forEach((i) => { bars.push({ i, y: y + ROW_H / 2, idx: idx++ }); y += ROW_H; });
    });
    return { rows, bars, h: y + 8 };
  }, [shown]);
  const yOf = new Map(layout.bars.map((b) => [b.i.id, b.y]));

  // Month zoom: open scrolled so today sits in view.
  useEffect(() => {
    const el = wrapRef.current;
    if (el) el.scrollLeft = zoom === 'month' ? Math.max(0, LABEL_W + TODAY_M * 72 - el.clientWidth / 2) : 0;
  }, [zoom]);

  useEffect(() => {
    if (!focus) return;
    const t = window.setTimeout(() => document.getElementById(`pg-row-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    return () => window.clearTimeout(t);
  }, [focus]);

  const deps = layout.bars.flatMap((b) => b.i.deps.map((d) => ({ from: list.find((x) => x.id === d), to: b.i })).filter((x): x is { from: Initiative; to: Initiative } => !!x.from && yOf.has(x.from.id)));
  const hotDeps = list.flatMap((i) => i.deps.map((d) => ({ from: list.find((x) => x.id === d), to: i }))).filter((x): x is { from: Initiative; to: Initiative } => !!x.from && (x.from.status === 'Late' || x.from.status === 'At risk' || x.from.status === 'On hold') && x.to.status !== 'Complete');
  const animKey = `${c.id}-${tenantId}-${zoom}-${wsF}-${stF}-${ownerF}`;
  const filterLabel = [wsF && WS_BY_ID[wsF]?.short, stF, ownerF].filter(Boolean).join(' · ');

  return (
    <div className="pg-stack">
      <p className="page-intro">
        <b>{c.name}</b> roadmap: {list.length} initiatives over {PG_MONTHS} months ({quarterLabel(0)} to {quarterLabel(QUARTERS.length - 1)}). Bars show plan and progress, diamonds are milestones, arrows are dependencies. Click any initiative for milestones, budget burn and actions.
      </p>

      <Card
        title="Programme roadmap"
        sub={`${shown.length} of ${list.length} initiatives · today is ${fmtDateShort(monthDate(TODAY_M))}`}
        actions={<><FilterChip label={filterLabel || null} onClear={() => setSp(new URLSearchParams(), { replace: true })} /><Tabs color={PG_TONE} value={zoom} onChange={setZoom} tabs={[{ id: 'quarter', label: 'Quarters' }, { id: 'month', label: 'Months' }]} /></>}
      >
        <div className="pg-rm-tools">
          {WORKSTREAMS.map((w) => {
            const n = list.filter((i) => i.ws === w.id).length;
            return n ? <Chip key={w.id} on={wsF === w.id} color={w.hex} onClick={() => set('ws', wsF === w.id ? null : w.id)}>{w.short} {n}</Chip> : null;
          })}
        </div>
        <div className="pg-rm-tools">
          {PG_STATUSES.map((s) => {
            const n = list.filter((i) => i.status === s).length;
            return n ? <Chip key={s} on={stF === s} color={STATUS_HEX[s]} onClick={() => set('status', stF === s ? null : s)}>{s} {n}</Chip> : null;
          })}
          <span className="spacer" />
          <select className="select" value={ownerF ?? ''} onChange={(e) => set('owner', e.target.value || null)} aria-label="Filter by owner">
            <option value="">All owners</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div ref={ref}>
          <div className="pg-rm-wrap pg-anim" key={animKey} ref={wrapRef}>
            <svg className="pg-gantt" width={svgW} height={layout.h} role="img" aria-label="Programme roadmap Gantt chart">
              <defs>
                <marker id="pg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="#8593b4" /></marker>
                <marker id="pg-arrow-hot" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="#f8646f" /></marker>
              </defs>

              {/* Quarter bands and headers */}
              {QUARTERS.map((q) => (
                <g key={q}>
                  {q % 2 === 1 && <rect className="band" x={X(q * 3)} y={0} width={ppm * 3} height={layout.h} />}
                  <line className="qline" x1={X(q * 3)} x2={X(q * 3)} y1={0} y2={layout.h} />
                  <text className="qhead" x={X(q * 3) + 6} y={16} fill={q === CUR_Q ? '#ef6aae' : undefined}>{quarterLabel(q)}{q === CUR_Q ? ' · now' : ''}</text>
                </g>
              ))}
              {Array.from({ length: PG_MONTHS }, (_, m) => (
                <g key={m}>
                  {zoom === 'month' && m % 3 !== 0 && <line className="mline" x1={X(m)} x2={X(m)} y1={HEAD_H - 14} y2={layout.h} />}
                  {(zoom === 'month' || ppm >= 34) && <text className="mhead" x={X(m) + ppm / 2} y={36} textAnchor="middle">{monthLabel(m)}</text>}
                </g>
              ))}
              <line x1={0} x2={svgW} y1={HEAD_H - 4} y2={HEAD_H - 4} className="qline" />

              {/* Workstream group headers */}
              {layout.rows.map((g) => (
                <g key={g.ws}>
                  <rect x={0} y={g.y} width={svgW} height={GROUP_H} fill={WS_BY_ID[g.ws].hex} opacity={0.08} />
                  <rect x={0} y={g.y} width={3} height={GROUP_H} fill={WS_BY_ID[g.ws].hex} />
                  <text className="wslbl" x={12} y={g.y + 17} fill={WS_BY_ID[g.ws].hex}>{WS_BY_ID[g.ws].label} · {g.n}</text>
                </g>
              ))}

              {/* Dependencies */}
              {deps.map(({ from, to }, k) => {
                const x1 = X(from.end);
                const y1 = yOf.get(from.id)!;
                const x2 = X(to.start) - 2;
                const y2 = yOf.get(to.id)!;
                const hot = (from.status === 'Late' || from.status === 'At risk' || from.status === 'On hold') && to.status !== 'Complete';
                const bend = Math.max(18, Math.abs(x2 - x1) * 0.4);
                const d = x2 > x1 + 10
                  ? `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`
                  : `M${x1},${y1} C${x1 + 26},${y1} ${x1 + 26},${(y1 + y2) / 2} ${(x1 + x2) / 2},${(y1 + y2) / 2} S${x2 - 26},${y2} ${x2},${y2}`;
                return <path key={k} d={d} className={`dep ${hot ? 'hot' : ''}`} markerEnd={`url(#${hot ? 'pg-arrow-hot' : 'pg-arrow'})`} style={{ '--d': `${0.9 + k * 0.05}s` } as PC}><title>{`${from.id} → ${to.id}${hot ? ` · upstream ${from.status.toLowerCase()}` : ''}`}</title></path>;
              })}

              {/* Initiative rows */}
              {layout.bars.map(({ i, y, idx }) => {
                const col = STATUS_HEX[i.status];
                const x1 = X(i.start);
                const w = Math.max(6, X(i.end) - x1);
                const late = i.status === 'Late' && i.end <= TODAY_M;
                const d = `${0.15 + idx * 0.035}s`;
                return (
                  <g key={i.id} id={`pg-row-${i.id}`} className={`row ${focus === i.id ? 'focus' : ''}`} onClick={() => setOpen(i.id)}>
                    <title>{`${i.id} · ${i.title}\n${i.status} · ${i.pct}% · ${i.owner.name}\n${fmtDateShort(monthDate(i.start))} → ${fmtDateShort(monthDate(i.end))}`}</title>
                    <rect className="rowhit" x={0} y={y - ROW_H / 2} width={svgW} height={ROW_H} />
                    <text className="rowlbl" x={12} y={y - 1}>{trunc(i.title, 44)}</text>
                    <text className="rowsub" x={12} y={y + 11}>{i.id} · {i.owner.name}</text>
                    <g className="bar" style={{ '--d': d } as PC}>
                      <rect className="bar-bg" x={x1} y={y - 7} width={w} height={14} rx={4} fill={col} fillOpacity={0.22} stroke={col} strokeOpacity={0.55} />
                      <rect x={x1} y={y - 7} width={(w * i.pct) / 100} height={14} rx={4} fill={col} />
                      {late && <rect x={X(i.end)} y={y - 3} width={Math.max(0, X(TODAY_M) - X(i.end))} height={6} rx={2} fill="#f8646f" fillOpacity={0.45} />}
                    </g>
                    {i.milestones.map((m) => {
                      const mx = X(m.m);
                      const overdue = !m.done && m.m < TODAY_M;
                      const s = m.gate ? 6 : 5;
                      return (
                        <path key={m.id} className="ms" style={{ '--d': `${0.6 + idx * 0.035}s` } as PC} d={`M${mx},${y - s - 4} L${mx + s},${y - 4} L${mx},${y + s - 4} L${mx - s},${y - 4} Z`} transform={`translate(0, ${-6})`} fill={m.done ? '#e8ecf6' : overdue ? '#f8646f' : 'var(--card-bg)'} stroke={overdue ? '#f8646f' : m.done ? '#e8ecf6' : '#8593b4'} strokeWidth={1.3}>
                          <title>{`${m.title} · ${fmtDateShort(monthDate(m.m))}${m.done ? ' · done' : overdue ? ' · overdue' : ''}`}</title>
                        </path>
                      );
                    })}
                    {X(i.end) + 44 < svgW && <text className="pctlbl" x={X(late ? Math.max(i.end, TODAY_M) : i.end) + 6} y={y + 4} style={{ '--d': `${0.7 + idx * 0.035}s` } as PC}>{i.pct}%</text>}
                  </g>
                );
              })}

              {/* Today */}
              <line className="today" x1={X(TODAY_M)} x2={X(TODAY_M)} y1={HEAD_H - 4} y2={layout.h} />
              <text className="todaylbl" x={X(TODAY_M) + 4} y={HEAD_H + 8}>Today</text>
            </svg>
          </div>
        </div>
        <div className="pg-legend" style={{ marginTop: 10 }}>
          {PG_STATUSES.map((s) => <span key={s}><i style={{ background: STATUS_HEX[s] }} />{s}</span>)}
          <span><i className="dia" style={{ background: '#e8ecf6' }} />Milestone done</span>
          <span><i className="dia" style={{ background: 'transparent', border: '1.3px solid #8593b4' }} />Milestone due</span>
          <span><i className="dia" style={{ background: '#f8646f' }} />Overdue</span>
          <span><i className="dash" style={{ borderColor: '#f8646f' }} />Dependency on a slipping initiative</span>
        </div>
        {!shown.length && <Callout>No initiatives match the filters.</Callout>}
      </Card>

      <div className="grid g2">
        <Card title="Dependency watch" sub="Upstream initiatives slipping with work still waiting on them" count={hotDeps.length}>
          <div className="pg-rows">
            {hotDeps.map(({ from, to }) => (
              <button key={`${from.id}-${to.id}`} type="button" className="pg-row" style={{ '--pc': STATUS_HEX[from.status] } as PC} onClick={() => setOpen(to.id)}>
                <i />
                <span className="m"><b>{to.id} {to.title}</b><span>waits on {from.id} {from.title} ({from.status.toLowerCase()}, {from.pct}%)</span></span>
                <span className="r">+{to.riGain.toFixed(1)} RI exposed</span>
              </button>
            ))}
            {!hotDeps.length && <Callout kind="good">No dependency is waiting on a slipping initiative.</Callout>}
          </div>
        </Card>
        <Card title="Quarter by quarter" sub="Starts, finishes and milestones per quarter">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Quarter</th><th className="r">Starting</th><th className="r">Finishing</th><th className="r">Milestones</th><th>Status</th></tr></thead>
              <tbody>
                {QUARTERS.map((q) => {
                  const m0 = q * 3;
                  const m1 = m0 + 3;
                  const ms = list.flatMap((i) => i.milestones.filter((m) => m.m > m0 && m.m <= m1));
                  const done = ms.filter((m) => m.done).length;
                  const ending = list.filter((i) => i.end > m0 && i.end <= m1);
                  return (
                    <tr key={q} className="clickable" onClick={() => set('focus', ending[0]?.id ?? null)} style={q === CUR_Q ? { background: 'color-mix(in srgb, var(--m-programme) 8%, transparent)' } : undefined}>
                      <td><b>{quarterLabel(q)}</b>{q === CUR_Q && <span className="muted"> · now</span>}</td>
                      <td className="r">{list.filter((i) => i.start >= m0 && i.start < m1).length}</td>
                      <td className="r">{ending.length}</td>
                      <td className="r">{done}/{ms.length}</td>
                      <td>{q < CUR_Q ? (done < ms.length ? <span style={{ color: 'var(--bad)' }}>{ms.length - done} missed</span> : <span style={{ color: 'var(--good)' }}>All met</span>) : q === CUR_Q ? <span className="muted">{ms.length - done} still to land</span> : <span className="muted">Planned</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {list.filter((i) => i.status === 'Late').length > 0 && <div style={{ marginTop: 10 }}><Callout kind="warn">Late: {list.filter((i) => i.status === 'Late').map((i) => <span key={i.id} style={{ marginRight: 8 }}><StatusPill s={i.status} /> <a style={{ cursor: 'pointer' }} onClick={() => setOpen(i.id)}>{i.id}</a></span>)}</Callout></div>}
        </Card>
      </div>

      {open && <InitiativeDrawer id={open} onClose={() => setOpen(null)} onOpen={setOpen} />}
    </div>
  );
}

function trunc(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
