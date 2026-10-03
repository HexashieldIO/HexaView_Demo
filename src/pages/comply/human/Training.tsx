import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, GraduationCap } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { tenantName } from '../../../data/customers';
import type { Course, Learner } from '../../../data/modules/human';
import { Badge, Btn, Card, KV, MiniStat, SectionLabel, Sources } from '../../../components/ui';
import { Drawer } from '../../../components/Overlay';
import { DataTable, type Column } from '../../../components/DataTable';
import { fmtNum } from '../../../lib/format';
import { Facet } from '../parts';
import { useHr, pct } from './state';

const KIND_COLOR: Record<Course['kind'], string> = { Core: '#4f8cff', Sector: '#a07cfb', 'Role-based': '#2dd4bf', Micro: '#f5a83d' };

export function Training() {
  const { c, courses, learners, depts, deptName, platform, param, patch, nudged, nudge } = useHr();
  const { toast } = useApp();
  const nav = useNavigate();
  const view = param('view');
  const kind = (param('kind') as Course['kind'] | null) ?? 'all';
  const dept = param('dept');
  const [sel, setSel] = useState<Course | null>(null);

  const assigned = courses.reduce((s, k) => s + k.assigned, 0);
  const completed = courses.reduce((s, k) => s + k.completed, 0);
  const shownCourses = courses.filter((k) => kind === 'all' || k.kind === kind);
  const overdue = learners.filter((l) => !dept || l.deptId === dept);
  const notNudged = overdue.filter((l) => !nudged[l.id]);
  const courseName = (id: string) => courses.find((k) => k.id === id)?.title ?? id;

  const cols: Column<Course>[] = [
    { key: 't', header: 'Course', sort: (k) => k.title, render: (k) => (<><div className="t-main">{k.title}</div><div className="t-sub">{k.audience} · {k.minutes} min · {k.refs.join(' · ')}</div></>) },
    { key: 'k', header: 'Type', sort: (k) => k.kind, render: (k) => <Badge color={KIND_COLOR[k.kind]}>{k.kind}</Badge> },
    { key: 'm', header: 'Mandatory', render: (k) => (k.mandatory ? <Badge color="var(--m-comply)" dot>Yes</Badge> : <span className="muted">No</span>) },
    { key: 'a', header: 'Assigned', align: 'right', sort: (k) => k.assigned, render: (k) => fmtNum(k.assigned) },
    { key: 'c', header: 'Completion', sort: (k) => pct(k.completed, k.assigned), render: (k) => { const p = pct(k.completed, k.assigned, 0); return <span className="hr-cellbar" style={{ minWidth: 110 }}><em style={{ color: p < 80 ? 'var(--sev-medium)' : undefined }}>{p}%</em><span className="hr-track"><i style={{ width: `${p}%`, background: p < 80 ? '#f5a83d' : '#2dd4bf' }} /></span></span>; } },
    { key: 'o', header: 'Overdue', align: 'right', sort: (k) => k.overdue, render: (k) => <b style={{ color: k.overdue ? 'var(--sev-high)' : undefined }}>{fmtNum(k.overdue)}</b> },
    { key: 's', header: 'Avg score', align: 'right', sort: (k) => k.avgScore, render: (k) => `${k.avgScore}%` },
  ];
  const lcols: Column<Learner>[] = [
    { key: 'n', header: 'Learner', sort: (l) => l.name, render: (l) => (<><div className="t-main">{l.name}</div><div className="t-sub">{l.role} · {deptName(l.deptId)} · {tenantName(c, l.tenantId)}</div></>) },
    { key: 'c', header: 'Course', render: (l) => <span style={{ fontSize: 12 }}>{courseName(l.courseId)}</span> },
    { key: 'd', header: 'Overdue', align: 'right', sort: (l) => l.daysOverdue, render: (l) => <b style={{ color: l.daysOverdue > 30 ? 'var(--bad)' : 'var(--sev-medium)' }}>{l.daysOverdue} d</b> },
    { key: 'r', header: 'Reminders', align: 'right', sort: (l) => l.reminders + (nudged[l.id] ?? 0), render: (l) => <span>{l.reminders + (nudged[l.id] ?? 0)}{nudged[l.id] ? <Badge color="var(--good)">nudged</Badge> : null}</span> },
    { key: 'm', header: 'Manager', render: (l) => <span className="muted">{l.manager}</span> },
    { key: 'a', header: '', render: (l) => <Btn sm disabled={!!nudged[l.id]} onClick={() => { nudge([l.id]); toast(`Reminder sent to ${l.name}; ${l.daysOverdue > 30 ? `${l.manager} (manager) copied.` : 'manager copied after 30 days.'}`); }}>Nudge</Btn> },
  ];

  return (
    <>
      <Card title="Training programme" sub={`Assigned through ${platform.name} · completion feeds ISO 27001 A.6.3 and sector requirements as evidence`} actions={<Btn sm onClick={() => nav('/comply/caas?section=stream&mode=training')}><GraduationCap size={13} /> My training in Stream</Btn>}>
        <div className="row wrap" style={{ gap: 26 }}>
          <MiniStat value={courses.length} label="courses in the catalogue" />
          <MiniStat value={`${pct(completed, assigned, 0)}%`} label="overall completion" color="var(--good)" />
          <MiniStat value={fmtNum(courses.reduce((s, k) => s + k.overdue, 0))} label="overdue assignments" color="var(--sev-high)" />
          <MiniStat value={`${Math.round(courses.reduce((s, k) => s + k.avgScore, 0) / courses.length)}%`} label="average quiz score" />
          <MiniStat value={courses.filter((k) => k.kind === 'Sector').length} label={`${c.sector.toLowerCase()} courses`} color="#a07cfb" />
        </div>
      </Card>

      <div className="grid g-3-2">
        <Card flush title="Courses" count={shownCourses.length} sub="Click a course for completion by department" actions={<Facet label="Type" value={kind} options={(['Core', 'Sector', 'Role-based', 'Micro'] as const).map((k) => ({ id: k, label: k, n: courses.filter((x) => x.kind === k).length }))} onChange={(v) => patch({ kind: v })} />}>
          <DataTable rows={shownCourses} columns={cols} onRowClick={setSel} pageSize={12} />
        </Card>
        <Card title="Completion heat map" sub="Mandatory courses × department · click a department to see its overdue learners">
          <div className="hr-heat" style={{ gridTemplateColumns: `minmax(130px, 1.3fr) repeat(${courses.filter((k) => k.mandatory).length}, minmax(34px, 1fr))` }}>
            <span />
            {courses.filter((k) => k.mandatory).map((k) => <span key={k.id} className="hr-heat-h" title={k.title}>{k.id.replace('CRS-', 'C')}</span>)}
            {depts.map((d) => (
              <HeatRow key={d.id} label={d.name} on={dept === d.id} onLabel={() => patch({ view: 'overdue', dept: dept === d.id ? null : d.id })}
                cells={courses.filter((k) => k.mandatory).map((k) => ({ id: k.id, v: k.byDept[d.id] ?? null, title: k.title }))} onCell={(id) => setSel(courses.find((k) => k.id === id) ?? null)} />
            ))}
          </div>
          <div className="hr-note" style={{ marginTop: 8 }}>
            {courses.filter((k) => k.mandatory).map((k) => `${k.id.replace('CRS-', 'C')} ${k.title}`).join(' · ')}
          </div>
        </Card>
      </div>

      <Card
        flush
        title="Overdue learners"
        count={`${overdue.length}${dept ? ` in ${deptName(dept)}` : ''}`}
        sub="Mandatory training past its due date, longest first"
        actions={
          <span className="row" style={{ gap: 8 }}>
            {dept && <button type="button" className="int-fchip on" onClick={() => patch({ dept: null })}>{deptName(dept)} ×</button>}
            <Btn sm primary color="var(--m-comply)" disabled={!notNudged.length} onClick={() => { nudge(notNudged.map((l) => l.id)); toast(`${notNudged.length} reminders sent through ${platform.name}; managers copied for anyone over 30 days.`); }}><BellRing size={13} /> Nudge all ({notNudged.length})</Btn>
          </span>
        }
        foot={<Sources items={[{ name: platform.name, status: platform.stale ? 'degraded' : 'healthy' }, { name: 'HR feed (managers, leavers)' }]} />}
        style={view === 'overdue' ? { boxShadow: '0 0 0 2px color-mix(in srgb, var(--m-comply) 55%, transparent)' } : undefined}
      >
        <DataTable rows={overdue} columns={lcols} search={(l) => `${l.name} ${l.role} ${deptName(l.deptId)}`} searchPlaceholder="Filter learners…" pageSize={10} />
      </Card>

      {sel && (
        <Drawer wide title={sel.title} sub={`${sel.kind} · ${sel.audience} · ${sel.minutes} min`} onClose={() => setSel(null)}
          footer={<><Btn ghost onClick={() => setSel(null)}>Close</Btn><Btn primary color="var(--m-comply)" disabled={!sel.overdue} onClick={() => { toast(`Reminders sent to ${sel.overdue} people overdue on “${sel.title}”.`); setSel(null); }}>Nudge {sel.overdue} overdue</Btn></>}>
          <KV rows={[
            ['Mandatory', sel.mandatory ? 'Yes' : 'No'],
            ['Maps to', sel.refs.join(' · ')],
            ['Assigned', fmtNum(sel.assigned)],
            ['Completed', `${fmtNum(sel.completed)} (${pct(sel.completed, sel.assigned, 0)}%)`],
            ['Overdue', fmtNum(sel.overdue)],
            ['Average quiz score', `${sel.avgScore}%`],
          ]} />
          <SectionLabel>Completion by department</SectionLabel>
          <div className="int-hbars">
            {Object.entries(sel.byDept).sort((a, b) => a[1] - b[1]).map(([d, v]) => (
              <div key={d} className="int-hbar">
                <span className="int-hbar-l"><b>{deptName(d)}</b></span>
                <span className="int-hbar-t"><i style={{ width: `${v}%`, background: v < 80 ? '#f5a83d' : '#2dd4bf' }} /></span>
                <span className="int-hbar-n">{v}%</span>
              </div>
            ))}
          </div>
          <SectionLabel>Evidence</SectionLabel>
          <p className="hr-note">The completion report is attached to the mapped controls in HexaComply automatically each month.</p>
        </Drawer>
      )}
    </>
  );
}

function HeatRow({ label, cells, on, onLabel, onCell }: { label: string; cells: { id: string; v: number | null; title: string }[]; on: boolean; onLabel: () => void; onCell: (id: string) => void }) {
  return (
    <>
      <button type="button" className="hr-heat-l" onClick={onLabel} style={on ? { color: 'var(--m-comply)' } : undefined} title={label}>{label}</button>
      {cells.map((x) => (x.v === null
        ? <span key={x.id} className="hr-heat-c na" title={`${x.title}: not assigned`}>–</span>
        : <button key={x.id} type="button" className="hr-heat-c" onClick={() => onCell(x.id)} title={`${x.title}: ${x.v}%`}
            style={{ background: x.v >= 90 ? 'color-mix(in srgb, #2dd4bf 45%, transparent)' : x.v >= 80 ? 'color-mix(in srgb, #2dd4bf 22%, transparent)' : x.v >= 65 ? 'color-mix(in srgb, #f5a83d 35%, transparent)' : 'color-mix(in srgb, #f8646f 40%, transparent)' }}>{x.v}</button>))}
    </>
  );
}
