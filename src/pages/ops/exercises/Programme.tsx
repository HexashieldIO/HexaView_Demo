import { useMemo, useState } from 'react';
import { Card, Badge, Callout, Chip, StatusBadge } from '../../../components/ui';
import { DataTable } from '../../../components/DataTable';
import { fmtDateShort, NOW } from '../../../lib/format';
import { EX_KINDS, KIND_BY_ID, CAPS, STATUS_COLOR, driverProgress, type Exercise, type ExStatus } from '../../../data/modules/exercises';
import { SegBreakdown, HBars, FilterChip } from '../parts';
import { useEx } from './state';
import { ExerciseDrawer, KindBadge, css, whenText, scoreColor } from './parts';

const STATUSES: ExStatus[] = ['completed', 'overdue', 'scheduled', 'planned'];

export function Programme() {
  const { c, exs, ds, param, setParams, go, actions } = useEx();
  const [open, setOpen] = useState<Exercise | null>(null);
  const kindF = param('kind');
  const statusF = param('status');
  const driverF = param('driver');
  const year = NOW.getFullYear();
  const curQ = Math.floor(NOW.getMonth() / 3) + 1;
  const match = (e: Exercise) => (!kindF || e.kind === kindF) && (!statusF || e.status === statusF) && (!driverF || e.drivers.includes(driverF));
  const filtered = exs.filter(match);
  const prog = useMemo(() => driverProgress(ds, exs), [ds, exs]);
  const atRisk = prog.filter((p) => p.done + p.planned < p.d.perYear);
  const completed = exs.filter((e) => e.status === 'completed');
  const byQ = [1, 2, 3, 4].map((q) => {
    const list = completed.filter((e) => e.quarter === q);
    const avg = list.length ? Math.round(list.reduce((s, e) => s + (e.overall ?? 0), 0) / list.length) : 0;
    const part = list.length ? Math.round((list.reduce((s, e) => s + e.attended, 0) / Math.max(1, list.reduce((s, e) => s + e.invited, 0))) * 100) : 0;
    return { q, n: list.length, avg, part };
  });
  const openActs = actions.filter((a) => a.status !== 'done');
  const filterLabel = [kindF && KIND_BY_ID[kindF as keyof typeof KIND_BY_ID]?.short, statusF, driverF && ds.find((d) => d.id === driverF)?.name].filter(Boolean).join(' · ');

  return (
    <div className="ex-stack">
      <div className="grid g-2-1">
        <Card
          title={`Exercise calendar ${year}`}
          sub="Quarterly programme · click an exercise for detail, scheduling or the after-action"
          actions={<FilterChip label={filterLabel || null} onClear={() => setParams({ kind: null, status: null, driver: null })} />}
        >
          <div className="ex-row" style={{ marginBottom: 10 }}>
            {STATUSES.map((s) => (
              <Chip key={s} on={statusF === s} color={STATUS_COLOR[s]} onClick={() => setParams({ status: statusF === s ? null : s })}>
                {s[0].toUpperCase() + s.slice(1)} {exs.filter((e) => e.status === s).length}
              </Chip>
            ))}
          </div>
          <div className="ex-cal">
            {[1, 2, 3, 4].map((q) => {
              const list = exs.filter((e) => e.quarter === q);
              return (
                <div key={q} className={`ex-q ${q === curQ ? 'now' : ''}`}>
                  <div className="ex-q-head">
                    <b>Q{q}</b>
                    <span>{list.length} exercise{list.length === 1 ? '' : 's'}</span>
                    {q === curQ && <em>Now</em>}
                  </div>
                  {list.map((e) => (
                    <button key={e.id} type="button" className={`ex-card ${match(e) ? '' : 'dim'}`} style={css({ '--kc': KIND_BY_ID[e.kind].color })} onClick={() => setOpen(e)}>
                      <span className="m">{fmtDateShort(e.date)} · {KIND_BY_ID[e.kind].short}{e.tenantId !== 'all' ? ` · ${c.tenants.find((t) => t.id === e.tenantId)?.short ?? e.tenantId}` : ''}</span>
                      <span className="t">{e.title}</span>
                      <span className="s">
                        <StatusBadge value={e.status} map={STATUS_COLOR} />
                        {e.overall !== undefined ? <b style={{ color: scoreColor(e.overall) }}>{e.overall}</b> : <b className="muted" style={{ fontWeight: 500 }}>{whenText(e)}</b>}
                      </span>
                    </button>
                  ))}
                  {!list.length && <span className="ex-muted">Nothing planned</span>}
                </div>
              );
            })}
          </div>
        </Card>

        <div id="ex-drivers" style={{ minWidth: 0, scrollMarginTop: 80 }}>
          <Card title="Regulatory drivers" sub="Required this year vs done · click to filter the calendar" count={ds.length}>
            <div className="stack" style={{ gap: 2 }}>
              {prog.map(({ d, done, planned }) => {
                const pips = Math.max(d.perYear, done + planned);
                const met = done >= d.perYear;
                return (
                  <button key={d.id} type="button" className={`ex-drv ${driverF === d.id ? 'on' : ''}`} onClick={() => setParams({ driver: driverF === d.id ? null : d.id })} title={d.note}>
                    <span className="ex-drv-top">
                      <b>{d.name}</b>
                      <em style={{ color: met ? 'var(--good)' : done + planned >= d.perYear ? 'var(--sev-medium)' : 'var(--bad)' }}>{done}/{d.perYear}</em>
                    </span>
                    <span className="ex-drv-req">{d.requirement}</span>
                    <span className="ex-pips">
                      {Array.from({ length: pips }, (_, i) => <i key={i} className={i < done ? (i >= d.perYear ? 'extra' : 'done') : i < done + planned ? 'plan' : ''} />)}
                    </span>
                  </button>
                );
              })}
            </div>
            {atRisk.length > 0 ? (
              <Callout kind="warn">{atRisk.map((p) => p.d.name).join(', ')}: not enough exercises completed or planned this year. Schedule from the scenario library.</Callout>
            ) : (
              <Callout kind="good">Every driver is met or covered by a scheduled exercise.</Callout>
            )}
          </Card>
        </div>
      </div>

      <div className="grid g3">
        <Card title="Mix by exercise type" sub="This year · click to filter">
          <SegBreakdown
            totalLabel="exercises in the programme"
            parts={EX_KINDS.map((k) => ({ key: k.id, label: k.label, value: exs.filter((e) => e.kind === k.id).length, color: k.color }))}
            active={kindF}
            onPick={(k) => setParams({ kind: kindF === k ? null : k })}
          />
        </Card>
        <Card title="Average score by quarter" sub="Completed exercises · participation underneath">
          <div className="ex-cols">
            {byQ.map((q) => (
              <button key={q.q} type="button" className="ex-col" onClick={() => go('after-action', { q: String(q.q) })} title={`Q${q.q}: ${q.n} completed`}>
                {q.n ? <b style={{ color: scoreColor(q.avg) }}>{q.avg}</b> : <b className="muted">—</b>}
                <i className={`bar ${q.n ? '' : 'empty'}`} style={{ height: `${q.n ? Math.max(6, q.avg) : 4}%`, background: q.n ? scoreColor(q.avg) : undefined }} />
                <span>Q{q.q}{q.n ? ` · ${q.part}%` : ''}</span>
              </button>
            ))}
          </div>
          <div className="ex-muted" style={{ marginTop: 6 }}>Bars: mean capability score (target 75). Percent: attendance of invited participants.</div>
        </Card>
        <Card title="Open actions by capability" sub={`${openActs.length} open from exercises · click to review`}>
          <HBars
            color="var(--m-ops)"
            labelWidth={110}
            items={CAPS.map((k) => {
              const list = openActs.filter((a) => a.cap === k.id);
              const overdue = list.filter((a) => a.dueDays < 0).length;
              return { key: k.id, label: k.label, sub: overdue ? `${overdue} overdue` : undefined, value: list.length, color: k.color, onClick: () => go('after-action', { cap: k.id }) };
            })}
          />
        </Card>
      </div>

      <Card title="All exercises" count={filtered.length} flush sub={`${c.short} exercise register · synced to ${c.connectors.find((k) => k.category === 'GRC')?.product ?? 'HexaComply'}`}>
        <DataTable
          rows={filtered}
          rowKey={(e) => e.id}
          initialSort={{ key: 'date', dir: 'asc' }}
          onRowClick={(e) => setOpen(e)}
          search={(e) => `${e.id} ${e.title} ${e.kind} ${e.status} ${e.participants.join(' ')}`}
          searchPlaceholder="Search exercises, people…"
          columns={[
            { key: 'id', header: 'ID', sort: (e) => e.id, render: (e) => <span className="mono" style={{ fontSize: 11.5 }}>{e.id}</span> },
            { key: 'date', header: 'Date', sort: (e) => e.date.getTime(), render: (e) => <>{fmtDateShort(e.date)}<div className="t-sub">Q{e.quarter}</div></> },
            { key: 'title', header: 'Exercise', render: (e) => <><div className="t-main">{e.title}</div><div className="t-sub">{e.tenantId === 'all' ? 'Group-wide' : c.tenants.find((t) => t.id === e.tenantId)?.name}</div></> },
            { key: 'kind', header: 'Type', sort: (e) => e.kind, render: (e) => <KindBadge kind={e.kind} /> },
            { key: 'drivers', header: 'Drivers', render: (e) => <span style={{ fontSize: 11.5 }}>{e.drivers.map((d) => ds.find((x) => x.id === d)?.name ?? d).join(', ')}</span> },
            { key: 'status', header: 'Status', sort: (e) => e.status, render: (e) => <StatusBadge value={e.status} map={STATUS_COLOR} /> },
            { key: 'part', header: 'Attendance', align: 'right', sort: (e) => (e.invited ? e.attended / e.invited : 0), render: (e) => (e.status === 'completed' ? `${e.attended}/${e.invited}` : <span className="muted">{e.invited} invited</span>) },
            { key: 'score', header: 'Score', align: 'right', sort: (e) => e.overall ?? -1, render: (e) => (e.overall !== undefined ? <b style={{ color: scoreColor(e.overall) }}>{e.overall}</b> : <span className="muted">—</span>) },
            { key: 'acts', header: 'Actions', align: 'right', sort: (e) => e.actions.length, render: (e) => (e.actions.length ? <Badge color="var(--m-ops)">{actions.filter((a) => a.exerciseId === e.id && a.status !== 'done').length} open / {e.actions.length}</Badge> : <span className="muted">—</span>) },
          ]}
        />
      </Card>
      {open && <ExerciseDrawer ex={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
