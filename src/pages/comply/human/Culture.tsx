import { useState } from 'react';
import { useApp } from '../../../state/AppContext';
import { tenantName } from '../../../data/customers';
import type { Policy, Champion } from '../../../data/modules/human';
import { Badge, Btn, Card, KV, MiniStat, SectionLabel, Sources } from '../../../components/ui';
import { Drawer } from '../../../components/Overlay';
import { DataTable, type Column } from '../../../components/DataTable';
import { RecordsDrawer } from '../../int/parts';
import { fmtNum } from '../../../lib/format';
import { ShiftRow } from '../parts';
import { useHr, pct } from './state';

const MEDAL: Record<Champion['tier'], string> = { Gold: '#ecc873', Silver: '#a9b4c8', Bronze: '#c98a55' };

export function Culture() {
  const { c, pols, champs, culture, depts, deptName, platform, reminded, remind } = useHr();
  const { toast } = useApp();
  const [sel, setSel] = useState<Policy | null>(null);
  const [champOpen, setChampOpen] = useState(false);
  const required = pols.reduce((s, p) => s + p.required, 0);
  const acked = pols.reduce((s, p) => s + p.acknowledged, 0);
  const covered = depts.filter((d) => champs.some((x) => x.deptId === d.id)).length;
  const champReports = champs.reduce((s, x) => s + x.reports90d, 0);

  const cols: Column<Policy>[] = [
    { key: 'n', header: 'Policy', sort: (p) => p.name, render: (p) => (<><div className="t-main">{p.name}</div><div className="t-sub">{p.version} · {p.audience} · {p.refs.join(' · ')}</div></>) },
    { key: 'pub', header: 'Published', align: 'right', sort: (p) => -p.publishedDays, render: (p) => <span className="muted">{p.publishedDays}d ago</span> },
    { key: 'a', header: 'Acknowledged', sort: (p) => pct(p.acknowledged, p.required), render: (p) => { const v = pct(p.acknowledged, p.required, 0); return <span className="hr-cellbar" style={{ minWidth: 120 }}><em style={{ color: v < 85 ? 'var(--sev-medium)' : undefined }}>{v}%</em><span className="hr-track"><i style={{ width: `${v}%`, background: v < 85 ? '#f5a83d' : '#2dd4bf' }} /></span></span>; } },
    { key: 'o', header: 'Outstanding', align: 'right', sort: (p) => p.required - p.acknowledged, render: (p) => <b>{fmtNum(p.required - p.acknowledged)}</b> },
    { key: 'r', header: '', render: (p) => <Btn sm disabled={reminded[p.id] || p.required === p.acknowledged} onClick={() => { remind(p.id); toast(`Acknowledgement reminder for “${p.name}” sent to ${fmtNum(p.required - p.acknowledged)} people.`); }}>{reminded[p.id] ? 'Reminded' : 'Remind'}</Btn> },
  ];

  return (
    <>
      <div className="grid g4">
        <Card><MiniStat value={`${pct(acked, required, 0)}%`} label="policy acknowledgements" color="var(--good)" /></Card>
        <Card onClick={() => setChampOpen(true)}><MiniStat value={champs.length} label={`security champions · ${covered}/${depts.length} departments`} color="var(--m-comply)" /></Card>
        <Card onClick={() => setChampOpen(true)}><MiniStat value={champReports} label="reports raised by champions (90 days)" /></Card>
        <Card><MiniStat value={`${culture.rate}%`} label={`culture survey response · ${fmtNum(culture.responses)} people`} /></Card>
      </div>

      <div className="grid g-3-2">
        <Card flush title="Policy acknowledgements" count={pols.length} sub="Click a policy for detail · reminders go through the awareness platform" foot={<Sources items={[{ name: c.connectors.find((k) => k.category === 'GRC')?.product ?? 'HexaComply' }, { name: platform.name, status: platform.stale ? 'degraded' : 'healthy' }]} />}>
          <DataTable rows={pols} columns={cols} onRowClick={setSel} pageSize={10} />
        </Card>
        <Card title="Security culture survey" sub="Agreement %, last survey → this survey">
          {culture.dims.map((d) => <ShiftRow key={d.key} name={d.label} from={d.prev} to={d.score} max={100} colors={['#8a9bc0', '#2dd4bf']} />)}
          <p className="hr-note" style={{ marginTop: 8 }}>Anonymous; reported only for groups of ten or more.</p>
        </Card>
      </div>

      <div className="grid g-1-2">
        <Card title="Champions leaderboard" sub="Points for reports, sessions run and coaching" onClick={() => setChampOpen(true)}>
          {champs.slice(0, 8).map((x, i) => (
            <div key={x.id} className="hr-champ">
              <em>{i + 1}</em>
              <span><b><i className="hr-medal" style={{ background: MEDAL[x.tier] }} />{x.name}</b><small>{x.role} · {deptName(x.deptId)}</small></span>
              <b style={{ fontFamily: 'var(--font-display)' }}>{x.points}</b>
            </div>
          ))}
        </Card>
        <Card title="Champion coverage by department" sub="Champions per 1,000 people · click to see them">
          <div className="int-hbars">
            {depts.map((d) => {
              const n = champs.filter((x) => x.deptId === d.id).length;
              const per = +(n / Math.max(1, d.headcount / 1000)).toFixed(1);
              return (
                <button key={d.id} type="button" className="int-hbar click" onClick={() => setChampOpen(true)}>
                  <span className="int-hbar-l"><b>{d.name}</b><small>{n} champion{n === 1 ? '' : 's'} · {fmtNum(d.headcount)} people</small></span>
                  <span className="int-hbar-t"><i style={{ width: `${Math.min(100, per * 20)}%`, background: per < 1 ? '#f5a83d' : '#2dd4bf' }} /></span>
                  <span className="int-hbar-n">{per}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {sel && (
        <Drawer title={sel.name} sub={`${sel.version} · ${sel.audience}`} onClose={() => setSel(null)}
          footer={<><Btn ghost onClick={() => setSel(null)}>Close</Btn><Btn primary color="var(--m-comply)" disabled={reminded[sel.id] || sel.required === sel.acknowledged} onClick={() => { remind(sel.id); toast(`Reminder sent to ${fmtNum(sel.required - sel.acknowledged)} people.`); }}>{reminded[sel.id] ? 'Reminded' : 'Send reminder'}</Btn></>}>
          <KV rows={[
            ['Version', sel.version],
            ['Published', `${sel.publishedDays} days ago`],
            ['Audience', sel.audience],
            ['Acknowledged', `${fmtNum(sel.acknowledged)} of ${fmtNum(sel.required)} (${pct(sel.acknowledged, sel.required, 0)}%)`],
            ['Maps to', sel.refs.join(' · ')],
          ]} />
          <SectionLabel>Evidence</SectionLabel>
          <p className="hr-note">The acknowledgement log is attached to the mapped controls in HexaComply as evidence.</p>
        </Drawer>
      )}
      {champOpen && (
        <RecordsDrawer<Champion>
          title="Security champions"
          sub={`${champs.length} champions across ${covered} departments`}
          rows={champs}
          source={['HexaComply champions register', platform.name]}
          onClose={() => setChampOpen(false)}
          columns={[
            { key: 'n', header: 'Champion', sort: (x) => x.name, render: (x) => (<><div className="t-main">{x.name}</div><div className="t-sub">{x.role} · {deptName(x.deptId)} · {tenantName(c, x.tenantId)}</div></>) },
            { key: 't', header: 'Tier', render: (x) => <Badge color={MEDAL[x.tier]}>{x.tier}</Badge> },
            { key: 'r', header: 'Reports 90d', align: 'right', sort: (x) => x.reports90d, render: (x) => x.reports90d },
            { key: 's', header: 'Sessions', align: 'right', sort: (x) => x.sessions, render: (x) => x.sessions },
            { key: 'p', header: 'Points', align: 'right', sort: (x) => x.points, render: (x) => <b>{x.points}</b> },
            { key: 'm', header: 'Since', align: 'right', sort: (x) => x.sinceMonths, render: (x) => `${x.sinceMonths} mo` },
          ]}
        />
      )}
    </>
  );
}
