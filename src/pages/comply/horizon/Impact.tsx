import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../state/AppContext';
import { Card, Badge, Bar, BarRow, Chip, Btn } from '../../../components/ui';
import { Chart } from '../../../components/Chart';
import { DataTable, type Column } from '../../../components/DataTable';
import { JUR_HEX, STAGE_HEX, type Reg } from '../../../data/modules/horizon';
import { fmtMoney, fmtNum, scoreTone } from '../../../lib/format';
import { useHorizon, useHzNav, whenLabel, FwLinks, HZ_TONE } from './state';
import { RegDrawer } from './RegDrawer';

export default function Impact() {
  const { customer: c } = useApp();
  const { regs, openRaise } = useHorizon();
  const { sp, set } = useHzNav();
  const nav = useNavigate();
  const [sel, setSel] = useState<Reg | null>(() => regs.find((r) => r.id === sp.get('id')) ?? null);
  const fw = sp.get('framework') ?? 'all';
  const sort = sp.get('sort');
  const rows = regs.filter((r) => fw === 'all' || r.fwShorts.some((f) => f.id === fw));

  const byFw = useMemo(() => {
    const m = new Map<string, { id: string; short: string; gaps: number; cost: number; regs: number }>();
    for (const r of regs) for (const f of r.fwShorts) {
      const x = m.get(f.id) ?? { id: f.id, short: f.short, gaps: 0, cost: 0, regs: 0 };
      x.gaps += Math.round(r.gaps / r.fwShorts.length);
      x.cost += r.cost / r.fwShorts.length;
      x.regs++;
      m.set(f.id, x);
    }
    return [...m.values()].sort((a, b) => b.gaps - a.gaps);
  }, [regs]);
  const maxGaps = Math.max(1, ...byFw.map((f) => f.gaps));

  const cols: Column<Reg>[] = [
    { key: 'reg', header: 'Regulation', sort: (r) => r.short, render: (r) => <span><b>{r.short}</b><span className="muted" style={{ display: 'block', fontSize: 11 }}>{r.stage} · {r.dateLabel}</span></span> },
    { key: 'jur', header: 'Jurisdiction', sort: (r) => r.jur, render: (r) => <Badge color={JUR_HEX[r.jur]}>{r.jur}</Badge> },
    { key: 'when', header: 'Applies', sort: (r) => r.months, render: (r) => <span style={{ color: r.months < 0 ? 'var(--good)' : r.months <= 6 ? 'var(--sev-high)' : undefined, fontWeight: 600 }}>{whenLabel(r.months)}</span> },
    { key: 'fw', header: 'Frameworks / controls', render: (r) => <span><FwLinks reg={r} /><span className="muted" style={{ display: 'block', fontSize: 11 }}>{r.controls} controls</span></span> },
    { key: 'gaps', header: 'Gaps', align: 'right', sort: (r) => r.gaps, render: (r) => <b style={{ color: r.gaps > 10 ? 'var(--bad)' : undefined }}>{r.gaps}</b> },
    { key: 'effort', header: 'Effort', align: 'right', sort: (r) => r.effortDays, render: (r) => `${fmtNum(r.effortDays)} d` },
    { key: 'cost', header: `Cost (${c.currency})`, align: 'right', sort: (r) => r.cost, render: (r) => <b>{fmtMoney(r.cost, c.currency)}</b> },
    { key: 'owner', header: 'Owner', sort: (r) => r.owner.name, render: (r) => <span><span style={{ display: 'block' }}>{r.owner.name}</span><span className="muted" style={{ fontSize: 11 }}>{r.owner.role}</span></span> },
    { key: 'ready', header: 'Readiness', width: 130, sort: (r) => r.readiness, render: (r) => <span style={{ display: 'grid', gridTemplateColumns: '1fr 34px', gap: 6, alignItems: 'center' }}><Bar value={r.readiness} color={scoreTone(r.readiness)} /><span className="num">{r.readiness}%</span></span> },
    { key: 'act', header: '', render: (r) => <Btn sm onClick={() => openRaise(r)}>{r.raised ? `${r.raised} raised` : 'Raise tasks'}</Btn> },
  ];

  const danger = regs.filter((r) => r.months >= 0 && r.months <= 6 && r.readiness < 60);

  return (
    <>
      <div className="grid g-3-2">
        <Card title="Readiness against time left" sub="Each regulation by months until it applies and readiness today; bubble size is cost to close · click a bubble" toneColor={HZ_TONE}>
          <Chart
            height={300}
            onClick={(p) => {
              const id = (p as { data?: { id?: string } }).data?.id;
              const r = regs.find((x) => x.id === id);
              if (r) setSel(r);
            }}
            option={{
              grid: { left: 46, right: 18, top: 18, bottom: 40 },
              tooltip: { trigger: 'item', formatter: (p: unknown) => { const d = (p as { data: { name: string; value: number[] } }).data; return `<b>${d.name}</b><br/>${d.value[0] < 0 ? 'Applying now' : `${d.value[0]} months`} · ${d.value[1]}% ready<br/>${fmtMoney(d.value[2], c.currency)}`; } },
              xAxis: { type: 'value', name: 'Months until it applies', nameLocation: 'middle', nameGap: 26, min: -8, max: 24, splitLine: { show: false } },
              yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
              series: [{
                type: 'scatter',
                data: regs.map((r) => ({ id: r.id, name: r.short, value: [Math.max(-6, r.months), r.readiness, r.cost], itemStyle: { color: STAGE_HEX[r.stage], opacity: 0.85 }, symbolSize: Math.max(12, Math.min(46, Math.sqrt(r.cost / 1000) * 2.6)) })),
                markArea: { silent: true, itemStyle: { color: 'rgba(240,70,110,0.08)' }, label: { show: true, position: 'insideTopLeft', color: '#f0466e', fontSize: 11, formatter: 'Act now' }, data: [[{ coord: [-8, 0] }, { coord: [6, 60] }]] },
                markLine: { silent: true, symbol: 'none', lineStyle: { color: '#8593b4', type: 'dashed' }, label: { formatter: 'Today', color: '#8593b4', fontSize: 10.5 }, data: [{ xAxis: 0 }] },
              }],
            }}
          />
          <div className="muted" style={{ fontSize: 11.5 }}>
            {danger.length ? <><b style={{ color: 'var(--bad)' }}>{danger.length} in the act-now zone:</b> {danger.map((r) => r.short).join(', ')}.</> : 'Nothing in the act-now zone: every regulation applying within 6 months is at least 60% ready.'}
          </div>
        </Card>
        <Card title="Gaps by framework" sub="Where new obligations land in your control set · click to open the framework" toneColor={HZ_TONE}>
          {byFw.map((f) => (
            <button key={f.id} type="button" className="link" style={{ display: 'block', width: '100%', background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit' }} onClick={() => nav(`/comply/caas?section=frameworks&framework=${f.id}`)} title={`Source: HexaComply · open ${f.short}`}>
              <BarRow label={f.short} sub={`${f.regs} regulation${f.regs > 1 ? 's' : ''} · ${fmtMoney(f.cost, c.currency)}`} value={f.gaps} max={maxGaps} color={HZ_TONE} display={`${f.gaps} gaps`} />
            </button>
          ))}
          <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
            <span className="muted" style={{ fontSize: 11.5 }}>Filter table:</span>
            <Chip on={fw === 'all'} onClick={() => set('framework', null)}>All</Chip>
            {byFw.map((f) => <Chip key={f.id} on={fw === f.id} onClick={() => set('framework', fw === f.id ? null : f.id)}>{f.short}</Chip>)}
          </div>
        </Card>
      </div>

      <Card title="Impact by regulation" count={rows.length} sub={`Affected frameworks and controls, gaps, effort and cost in ${c.currency} · effort at a blended internal and partner rate · click a row for the control areas`} flush>
        <DataTable
          key={sort ?? "default"}
          columns={cols}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={setSel}
          search={(r) => `${r.short} ${r.name} ${r.jur} ${r.owner.name} ${r.fwShorts.map((f) => f.short).join(' ')}`}
          searchPlaceholder="Filter regulations…"
          initialSort={sort === 'readiness' ? { key: 'ready', dir: 'asc' } : sort === 'gaps' ? { key: 'gaps', dir: 'desc' } : { key: 'when', dir: 'asc' }}
          pageSize={20}
        />
      </Card>
      {sel && <RegDrawer reg={regs.find((r) => r.id === sel.id) ?? sel} onClose={() => setSel(null)} />}
    </>
  );
}
