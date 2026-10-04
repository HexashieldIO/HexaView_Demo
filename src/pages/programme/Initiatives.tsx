import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Chip, Tabs, KpiStrip } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { FilterChip } from '../ops/parts';
import { WORKSTREAMS, WS_BY_ID, STATUS_HEX, PG_STATUSES, isLive, monthDate, CSF_CAT_BY_ID, totals, type Initiative, type WsId } from '../../data/modules/programme';
import { fmtDateShort } from '../../lib/format';
import { useIntro } from '../../lib/useIntro';
import { usePg, PG_TONE, InitiativeDrawer, StatusPill, WsTag, Progress, ownersOf, variance, varColor, type PC } from './parts';

export default function Initiatives() {
  const nav = useNavigate();
  const { c, tenantId, list, grc, $ } = usePg();
  const [sp, setSp] = useSearchParams();
  const [view, setView] = useState<'table' | 'cards'>('table');
  const anim = useIntro(`pg-in-${c.id}-${tenantId}`, 1400);
  const stF = sp.get('status');
  const wsF = sp.get('ws') as WsId | null;
  const ownerF = sp.get('owner');
  const fwF = sp.get('fw');
  const catF = sp.get('cat');
  const ids = sp.get('ids')?.split(',');
  const open = sp.get('id');
  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v === null ? n.delete(k) : n.set(k, v)));
    setSp(n, { replace: true });
  };

  const match = (i: Initiative) =>
    (!stF || (stF === 'live' ? isLive(i.status) : stF === 'At risk' ? i.status === 'At risk' || i.status === 'On hold' : i.status === stF)) &&
    (!wsF || i.ws === wsF) && (!ownerF || i.owner.name === ownerF) && (!fwF || i.frameworks.some((f) => f.id === fwF)) && (!catF || i.csf.includes(catF)) && (!ids || ids.includes(i.id));
  const rows = list.filter(match);
  const t = totals(rows);
  const fwName = fwF ? c.frameworks.find((f) => f.id === fwF)?.short : null;
  const filterLabel = [stF === 'live' ? 'In flight' : stF, wsF && WS_BY_ID[wsF]?.short, ownerF, fwName, catF && `${catF} ${CSF_CAT_BY_ID[catF]?.label ?? ''}`, ids && `${ids.length} selected`].filter(Boolean).join(' · ');
  const owners = ownersOf(list);

  return (
    <div className="pg-stack">
      <p className="page-intro">
        <b>{c.name}</b> initiative register: {list.length} initiatives, each with an owner, sponsor, budget, milestones, linked controls and the Resilience Index gain it is expected to deliver. Status syncs with {grc}; change it here and the roadmap, budget and maturity views follow.
      </p>

      <KpiStrip
        toneColor={PG_TONE}
        items={[
          { label: 'Initiatives', value: Math.round(anim(rows.length)), unit: filterLabel ? 'filtered' : 'in register', onClick: () => set({ status: null, ws: null, owner: null, fw: null, cat: null, ids: null }), source: `Programme register · ${grc}` },
          { label: 'Budget', value: $(anim(t.budget)), unit: `${$(t.spent)} spent`, bar: t.budget ? (t.spent / t.budget) * 100 : 0, to: '/programme/budget', source: 'Approved programme budget · finance actuals' },
          { label: 'Forecast variance', value: `${t.budget ? Math.round(((t.forecast - t.budget) / t.budget) * 100) : 0}%`, unit: $(t.forecast - t.budget), toneColor: t.forecast > t.budget * 1.03 ? 'var(--bad)' : 'var(--good)', to: '/programme/budget', source: 'Forecast at completion vs approved budget' },
          { label: 'RI gain to come', value: `+${anim(rows.filter((i) => i.status !== 'Complete').reduce((s, i) => s + i.riGain, 0)).toFixed(1)}`, toneColor: 'var(--good)', to: '/programme/overview', source: 'Resilience Index ri-v1.2 · modelled per initiative' },
          { label: 'Loss reduction', hint: '/ yr', value: $(anim(rows.reduce((s, i) => s + i.lossReduction, 0))), to: '/insurance/quantification', source: 'Expected annual loss model (HexaView risk quantification)' },
          { label: 'Open risks', value: Math.round(anim(rows.filter((i) => i.status !== 'Complete').reduce((s, i) => s + i.risks.length, 0))), to: '/comply/caas?section=risks', source: `Initiative risk logs · mirrored to ${grc}` },
        ]}
      />

      <Card
        title="Initiatives"
        count={rows.length}
        flush={view === 'table'}
        sub="Click a row for milestones, budget burn, risks, decisions and evidence"
        actions={<><FilterChip label={filterLabel || null} onClear={() => set({ status: null, ws: null, owner: null, fw: null, cat: null, ids: null })} /><Tabs color={PG_TONE} value={view} onChange={setView} tabs={[{ id: 'table', label: 'Table' }, { id: 'cards', label: 'Cards' }]} /></>}
      >
        <div className="pg-rm-tools" style={view === 'table' ? { padding: '0 18px 8px' } : undefined}>
          <Chip on={stF === 'live'} onClick={() => set({ status: stF === 'live' ? null : 'live' })}>In flight {list.filter((i) => isLive(i.status)).length}</Chip>
          {PG_STATUSES.map((s) => {
            const n = list.filter((i) => i.status === s).length;
            return n ? <Chip key={s} on={stF === s} color={STATUS_HEX[s]} onClick={() => set({ status: stF === s ? null : s })}>{s} {n}</Chip> : null;
          })}
          <span className="spacer" />
          <select className="select" value={wsF ?? ''} onChange={(e) => set({ ws: e.target.value || null })} aria-label="Workstream">
            <option value="">All workstreams</option>
            {WORKSTREAMS.filter((w) => list.some((i) => i.ws === w.id)).map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
          <select className="select" value={ownerF ?? ''} onChange={(e) => set({ owner: e.target.value || null })} aria-label="Owner">
            <option value="">All owners</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {view === 'table' ? (
          <DataTable
            rows={rows}
            rowKey={(i) => i.id}
            pageSize={30}
            onRowClick={(i) => set({ id: i.id })}
            initialSort={{ key: 'id', dir: 'asc' }}
            search={(i) => `${i.id} ${i.title} ${i.owner.name} ${i.sponsor.name} ${i.status} ${WS_BY_ID[i.ws].label} ${i.frameworks.map((f) => f.short).join(' ')}`}
            searchPlaceholder="Search initiatives, owners, frameworks…"
            columns={[
              { key: 'id', header: 'ID', sort: (i) => i.id, render: (i) => <span className="mono" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{i.id}</span> },
              { key: 'title', header: 'Initiative', sort: (i) => i.title, render: (i) => <div style={{ minWidth: 260 }}><div className="t-main">{i.title}</div><div className="t-sub"><WsTag ws={i.ws} /> · {fmtDateShort(monthDate(i.start))} → {fmtDateShort(monthDate(i.end))}</div></div> },
              { key: 'owner', header: 'Owner / sponsor', sort: (i) => i.owner.name, render: (i) => <><div>{i.owner.name}</div><div className="t-sub">{i.sponsor.name}</div></> },
              { key: 'status', header: 'Status', sort: (i) => PG_STATUSES.indexOf(i.status), render: (i) => <StatusPill s={i.status} /> },
              { key: 'pct', header: 'Progress', sort: (i) => i.pct, width: 130, render: (i) => <Progress pct={i.pct} color={STATUS_HEX[i.status]} /> },
              { key: 'budget', header: 'Budget / spent', align: 'right', sort: (i) => i.budget, render: (i) => <><div>{$(i.budget)}</div><div className="t-sub">{$(i.spent)} · <span style={{ color: varColor(variance(i)) }}>{variance(i) >= 0 ? '+' : ''}{variance(i)}%</span></div></> },
              { key: 'links', header: 'Controls & frameworks', render: (i) => <span className="pg-tags">{i.frameworks.slice(0, 2).map((f) => <button key={f.id} type="button" className="pg-tag" onClick={(e) => { e.stopPropagation(); nav(`/comply/caas?section=frameworks&framework=${f.id}`); }} title={`Open ${f.short} in HexaComply`}>{f.short}</button>)}{i.csf.slice(0, 1).map((k) => <button key={k} type="button" className="pg-tag mono" onClick={(e) => { e.stopPropagation(); nav(`/programme/maturity?cat=${k}`); }} title={CSF_CAT_BY_ID[k]?.label}>{k}</button>)}</span> },
              { key: 'risks', header: 'Risks', align: 'right', sort: (i) => i.risks.length, render: (i) => (i.risks.length ? <button type="button" className="pg-tag" onClick={(e) => { e.stopPropagation(); nav('/comply/caas?section=risks'); }} style={{ color: i.risks.some((r) => r.level === 'High') ? 'var(--bad)' : undefined }}>{i.risks.length}</button> : <span className="muted">—</span>) },
              { key: 'ri', header: 'RI gain / loss', align: 'right', sort: (i) => i.riGain, render: (i) => <><b style={{ color: 'var(--good)' }}>+{i.riGain.toFixed(1)}</b><div className="t-sub">{$(i.lossReduction)} / yr</div></> },
            ]}
          />
        ) : (
          <div className="pg-cards">
            {rows.map((i, k) => (
              <button key={i.id} type="button" className="pg-icard pg-rise" style={{ '--pc': WS_BY_ID[i.ws].hex, '--d': `${Math.min(k, 20) * 0.03}s` } as PC} onClick={() => set({ id: i.id })}>
                <span className="h"><WsTag ws={i.ws} /><StatusPill s={i.status} /></span>
                <span className="t">{i.title}</span>
                <span className="o">{i.id} · {i.owner.name} · sponsor {i.sponsor.name}</span>
                <Progress pct={i.pct} color={STATUS_HEX[i.status]} />
                <span className="nums">
                  <span><b>{$(i.budget)}</b>budget</span>
                  <span><b style={{ color: varColor(variance(i)) }}>{$(i.forecast)}</b>forecast</span>
                  <span><b style={{ color: 'var(--good)' }}>+{i.riGain.toFixed(1)}</b>RI gain</span>
                </span>
                <span className="pg-tags">
                  {i.frameworks.map((f) => <span key={f.id} className="pg-tag" onClick={(e) => { e.stopPropagation(); nav(`/comply/caas?section=frameworks&framework=${f.id}`); }}>{f.short}</span>)}
                  {i.modules.slice(0, 2).map((m) => <span key={m.path} className="pg-tag" onClick={(e) => { e.stopPropagation(); nav(m.path); }}>{m.label}</span>)}
                </span>
                <span className="o">Next: {i.milestones.find((m) => !m.done)?.title ?? 'Closed'}{i.milestones.find((m) => !m.done) ? ` · ${fmtDateShort(monthDate(i.milestones.find((m) => !m.done)!.m))}` : ''}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {open && <InitiativeDrawer id={open} onClose={() => set({ id: null })} onOpen={(x) => set({ id: x })} />}
    </div>
  );
}
