import { useState } from 'react';
import { Rocket } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { THEMES, type Campaign, type CampaignStatus } from '../../../data/modules/human';
import { Badge, Btn, Card, KV, MiniStat, SectionLabel, Sources, StatusBadge } from '../../../components/ui';
import { Chart } from '../../../components/Chart';
import { Drawer, Modal } from '../../../components/Overlay';
import { DataTable, type Column } from '../../../components/DataTable';
import { fmtNum } from '../../../lib/format';
import { useHr, pct } from './state';
import { Funnel, Stars } from './ui';

const ST_COLOR: Record<CampaignStatus, string> = { Completed: 'var(--good)', Running: 'var(--accent)', Scheduled: 'var(--sev-medium)' };

export function Phishing() {
  const { camps, depts, deptName, platform, param, patch, ov } = useHr();
  const id = param('id');
  const sel = id ? camps.find((x) => x.id === id) : undefined;
  const launching = param('launch') === '1';
  const done = camps.filter((x) => x.status === 'Completed');
  const recent = done.slice(0, 6).reverse();
  const allSent = done.reduce((s, x) => s + x.sent, 0);

  const columns: Column<Campaign>[] = [
    { key: 'n', header: 'Campaign', sort: (x) => x.launchedDays, render: (x) => (<><div className="t-main">{x.theme}</div><div className="t-sub">{x.id} · {x.channel} · {x.launchedDays === 0 ? 'just launched' : `${x.launchedDays}d ago`}</div></>) },
    { key: 'd', header: 'Difficulty', sort: (x) => x.difficulty, render: (x) => <Stars n={x.difficulty} /> },
    { key: 's', header: 'Sent', align: 'right', sort: (x) => x.sent, render: (x) => fmtNum(x.sent) },
    { key: 'o', header: 'Opened', align: 'right', sort: (x) => pct(x.opened, x.sent), render: (x) => `${pct(x.opened, x.sent, 0)}%` },
    { key: 'c', header: 'Clicked', align: 'right', sort: (x) => pct(x.clicked, x.sent), render: (x) => <span className="hr-rate" style={{ color: pct(x.clicked, x.sent) > ov.clickRate * 1.3 ? 'var(--bad)' : undefined }}>{pct(x.clicked, x.sent)}%</span> },
    { key: 'su', header: 'Entered creds', align: 'right', sort: (x) => pct(x.submitted, x.sent), render: (x) => <span className="hr-rate" style={{ color: x.submitted ? 'var(--sev-high)' : undefined }}>{pct(x.submitted, x.sent)}%</span> },
    { key: 'r', header: 'Reported', align: 'right', sort: (x) => pct(x.reported, x.sent), render: (x) => <span className="hr-rate" style={{ color: 'var(--good)' }}>{pct(x.reported, x.sent)}%</span> },
    { key: 'st', header: 'Status', sort: (x) => x.status, render: (x) => <StatusBadge value={x.status} map={ST_COLOR} /> },
  ];

  return (
    <>
      <div className="grid g-1-2">
        <Card title="Simulation programme" sub={`Run through ${platform.name} · last 12 months`} actions={<Btn sm primary color="var(--m-comply)" onClick={() => patch({ launch: '1' })}><Rocket size={13} /> Launch campaign</Btn>}>
          <div className="row wrap" style={{ gap: 22 }}>
            <MiniStat value={camps.length} label="campaigns" />
            <MiniStat value={fmtNum(allSent)} label="simulations delivered" />
            <MiniStat value={`${pct(done.reduce((s, x) => s + x.clicked, 0), allSent)}%`} label="average click rate" color="var(--bad)" />
            <MiniStat value={`${pct(done.reduce((s, x) => s + x.reported, 0), allSent)}%`} label="average report rate" color="var(--good)" />
          </div>
          <SectionLabel>Click vs report, by campaign</SectionLabel>
          <Chart
            height={180}
            onClick={(p) => { const i = (p as { dataIndex?: number }).dataIndex; if (i !== undefined && recent[i]) patch({ id: recent[i].id }); }}
            option={{
              legend: { bottom: 0, textStyle: { fontSize: 10.5 } },
              grid: { left: 6, right: 8, top: 10, bottom: 30, containLabel: true },
              tooltip: { trigger: 'axis', valueFormatter: (v) => `${v}%` },
              xAxis: { type: 'category', data: recent.map((x) => x.id), axisLabel: { fontSize: 10.5 } },
              yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
              series: [
                { name: 'Clicked', type: 'bar', data: recent.map((x) => pct(x.clicked, x.sent)), itemStyle: { color: '#f8646f' }, barMaxWidth: 14 },
                { name: 'Reported', type: 'bar', data: recent.map((x) => pct(x.reported, x.sent)), itemStyle: { color: '#2dd4bf' }, barMaxWidth: 14 },
              ],
            }}
          />
        </Card>
        <Card title="Click rate by department" sub="Last six completed campaigns · click a cell for the campaign">
          <div className="hr-heat" style={{ gridTemplateColumns: `minmax(150px, 1.4fr) repeat(${recent.length}, minmax(52px, 1fr))` }}>
            <span />
            {recent.map((x) => <span key={x.id} className="hr-heat-h" title={x.theme}>{x.theme.split(' ').slice(0, 2).join(' ')}<br /><small style={{ fontWeight: 500 }}>{x.launchedDays}d ago</small></span>)}
            {depts.map((d) => (
              <Row key={d.id} label={d.name} cells={recent.map((x) => {
                const b = x.byDept.find((y) => y.deptId === d.id);
                return { id: x.id, v: b ? pct(b.clicked, b.sent, 0) : null };
              })} onPick={(cid) => patch({ id: cid })} />
            ))}
          </div>
          <div className="hr-note" style={{ marginTop: 8 }}>Shading scales with the click rate; empty cells were not targeted.</div>
        </Card>
      </div>

      <Card flush title="Campaigns" count={camps.length} sub="Click a campaign for the funnel and department breakdown" foot={<Sources items={[{ name: platform.name, status: platform.stale ? 'degraded' : 'healthy' }, { name: 'Report-phish button telemetry' }]} />}>
        <DataTable rows={camps} columns={columns} onRowClick={(x) => patch({ id: x.id })} search={(x) => `${x.theme} ${x.id} ${x.channel}`} searchPlaceholder="Filter campaigns…" pageSize={12} />
      </Card>

      {sel && <CampaignDrawer camp={sel} onClose={() => patch({ id: null })} deptName={deptName} />}
      {launching && <LaunchModal onClose={() => patch({ launch: null, dept: null })} preset={param('dept')} />}
    </>
  );
}

function Row({ label, cells, onPick }: { label: string; cells: { id: string; v: number | null }[]; onPick: (id: string) => void }) {
  return (
    <>
      <span className="hr-heat-l" title={label}>{label}</span>
      {cells.map((x) => (x.v === null
        ? <span key={x.id} className="hr-heat-c na">–</span>
        : <button key={x.id} type="button" className="hr-heat-c" onClick={() => onPick(x.id)} style={{ background: `color-mix(in srgb, #f8646f ${Math.round(Math.max(8, Math.min(80, (x.v - 3) * 5)))}%, transparent)` }}>{x.v}%</button>))}
    </>
  );
}

function CampaignDrawer({ camp, onClose, deptName }: { camp: Campaign; onClose: () => void; deptName: (id: string) => string }) {
  const { toast } = useApp();
  const { go } = useHr();
  const rows = camp.byDept.slice().sort((a, b) => pct(b.clicked, b.sent) - pct(a.clicked, a.sent));
  return (
    <Drawer
      wide
      title={camp.theme}
      sub={`${camp.id} · ${camp.channel} · ${camp.status}`}
      onClose={onClose}
      footer={
        <>
          <Btn ghost onClick={onClose}>Close</Btn>
          <Btn onClick={() => { onClose(); go('risky', { factor: 'repeat' }); }}>Repeat clickers</Btn>
          <Btn primary color="var(--m-comply)" disabled={!camp.clicked} onClick={() => { toast(`Four-minute micro-lesson on “${camp.cues[0]}” assigned to ${camp.clicked} people who clicked.`); onClose(); }}>Assign micro-training to clickers</Btn>
        </>
      }
    >
      <KV rows={[
        ['Status', <StatusBadge value={camp.status} map={ST_COLOR} />],
        ['Channel', camp.channel],
        ['Difficulty', <Stars n={camp.difficulty} />],
        ['Launched', camp.launchedDays === 0 ? 'Just now (this session)' : `${camp.launchedDays} days ago`],
        ['Report-to-click', (camp.reported / Math.max(1, camp.clicked)).toFixed(1)],
        ['Median time to first report', camp.status === 'Scheduled' ? '–' : `${camp.medianReportMin} min`],
      ]} />
      <SectionLabel>Funnel</SectionLabel>
      <Funnel camp={camp} />
      <SectionLabel>Cues people should have spotted</SectionLabel>
      <div className="row wrap" style={{ gap: 6 }}>{camp.cues.map((x) => <Badge key={x} color="var(--sev-medium)">{x}</Badge>)}</div>
      <SectionLabel>By department</SectionLabel>
      <div className="int-hbars">
        {rows.map((b) => (
          <div key={b.deptId} className="hr-fstep" style={{ gridTemplateColumns: '170px minmax(0,1fr) 120px', padding: '3px 0' }}>
            <span>{deptName(b.deptId)}</span>
            <span className="hr-fbar" style={{ height: 14, display: 'flex' }}>
              <i style={{ width: `${pct(b.submitted, b.sent)}%`, background: '#f8646f', borderRadius: 0 }} />
              <i style={{ width: `${pct(b.clicked - b.submitted, b.sent)}%`, background: '#f5a83d', borderRadius: 0 }} />
              <i style={{ width: `${pct(b.reported, b.sent)}%`, background: '#2dd4bf', borderRadius: 0, marginLeft: 'auto' }} />
            </span>
            <b style={{ fontSize: 12 }}>{pct(b.clicked, b.sent, 0)}% <small>click</small> {pct(b.reported, b.sent, 0)}% <small>rep.</small></b>
          </div>
        ))}
      </div>
      <div className="hr-note" style={{ marginTop: 6 }}>Red entered credentials · amber clicked only · teal reported · {fmtNum(camp.sent)} sent</div>
    </Drawer>
  );
}

function LaunchModal({ onClose, preset }: { onClose: () => void; preset: string | null }) {
  const { c, depts, launch, platform, go } = useHr();
  const { toast } = useApp();
  const themes = THEMES[c.id];
  const [ti, setTi] = useState(0);
  const [sel, setSel] = useState<string[]>(preset ? [preset] : depts.map((d) => d.id));
  const [when, setWhen] = useState<'now' | 'week'>('now');
  const th = themes[ti];
  const targets = depts.filter((d) => sel.includes(d.id));
  const sent = targets.reduce((s, d) => s + Math.round(d.headcount * 0.6), 0);
  const toggle = (id: string) => setSel((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const submit = () => {
    const id = `SIM-${String(300 + Math.floor(Math.random() * 600)).padStart(4, '0')}`;
    launch({
      id, name: `Oct · ${th.theme.split(' (')[0]}`, theme: th.theme, channel: th.channel, difficulty: th.d, launchedDays: 0,
      status: when === 'now' ? 'Running' : 'Scheduled', sent: when === 'now' ? sent : 0, opened: 0, clicked: 0, submitted: 0, reported: 0, medianReportMin: 0,
      byDept: targets.map((d) => ({ deptId: d.id, sent: when === 'now' ? Math.round(d.headcount * 0.6) : 0, clicked: 0, submitted: 0, reported: 0 })), cues: th.cues, local: true,
    });
    toast(`${when === 'now' ? 'Launched' : 'Scheduled'} “${th.theme}” to ${fmtNum(sent)} people in ${targets.length} department${targets.length === 1 ? '' : 's'} via ${platform.name}. Delivery is staggered over 3 days.`);
    onClose();
    go('phishing', { id });
  };
  return (
    <Modal
      title="Launch a phishing simulation"
      sub={`Delivered by ${platform.name}; results flow back into HexaComply`}
      onClose={onClose}
      footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color="var(--m-comply)" disabled={!targets.length} onClick={submit}>{when === 'now' ? 'Launch now' : 'Schedule'}</Btn></>}
    >
      <div className="hr-form">
        <div>
          <label>Template</label>
          <select value={ti} onChange={(e) => setTi(Number(e.target.value))}>
            {themes.map((t, i) => <option key={t.theme} value={i}>{t.theme} · {t.channel}</option>)}
          </select>
          <div className="row wrap" style={{ gap: 6, marginTop: 6, alignItems: 'center' }}><Stars n={th.d} />{th.cues.map((x) => <Badge key={x}>{x}</Badge>)}</div>
        </div>
        <div>
          <label>Departments ({targets.length})</label>
          <div className="hr-pick">
            {depts.map((d) => <button key={d.id} type="button" className={sel.includes(d.id) ? 'on' : ''} onClick={() => toggle(d.id)}>{d.name}</button>)}
          </div>
        </div>
        <div>
          <label>When</label>
          <div className="hr-pick">
            <button type="button" className={when === 'now' ? 'on' : ''} onClick={() => setWhen('now')}>Now, staggered over 3 days</button>
            <button type="button" className={when === 'week' ? 'on' : ''} onClick={() => setWhen('week')}>Next Monday</button>
          </div>
        </div>
        <KV rows={[
          ['Recipients', `${fmtNum(sent)} (random 60% sample per department)`],
          ['Excluded', 'Executives on the protection roster, staff on leave, the SOC'],
          ['Landing page', 'Teachable moment + 4-minute micro-lesson'],
          ['Allow-listed', `Simulation domains allow-listed in ${c.connectors.find((k) => k.category === 'Email' && k.vendor !== 'KnowBe4')?.product ?? 'the email gateway'}`],
        ]} />
      </div>
    </Modal>
  );
}
