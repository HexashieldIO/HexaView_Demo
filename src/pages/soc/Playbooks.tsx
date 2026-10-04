import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid, Workflow, Activity, Clock, Timer, Gauge, Bot, Inbox } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { tenantShare } from '../../data/customers';
import { signedIn } from '../../data/modules/ops';
import { playbookLibrary, playbookRuns, paramDefaults, toolsFor, OP, type Playbook } from '../../data/modules/playbooks';
import { KpiStrip, Badge } from '../../components/ui';
import { useSoc, Pills, RecordsDrawer, type RecordRow } from './parts';
import { fmtNum, fmtAgo } from '../../lib/format';
import { usePlaybookStore, agoOf } from './playbooks/store';
import { Library } from './playbooks/Library';
import { Editor } from './playbooks/Editor';
import { Runs } from './playbooks/Runs';
import { RUN_COLOR, RUN_LABEL } from './playbooks/meta';
import './playbooks/playbooks.css';

const VIEWS = ['library', 'editor', 'runs'] as const;
type View = (typeof VIEWS)[number];

export default function Playbooks() {
  const { customer } = useApp();
  return <Inner key={String(customer.id)} />;
}

function Inner() {
  const { c, tenantId, tone, scopeLabel, persona, toast } = useSoc();
  const { state, update } = usePlaybookStore(c);
  const [sp, setSp] = useSearchParams();
  const rawView = sp.get('view') as View | null;
  const view: View = rawView && VIEWS.includes(rawView) ? rawView : 'library';
  const pbParam = sp.get('pb');
  const [drawer, setDrawer] = useState<'saved' | 'mttr' | 'auto' | null>(null);
  const share = tenantShare(c, tenantId);

  const go = (v: View, extra: Record<string, string> = {}) => {
    const next = new URLSearchParams();
    if (v !== 'library') next.set('view', v);
    Object.entries(extra).forEach(([k, val]) => next.set(k, val));
    setSp(next);
  };
  const open = (id: string) => go('editor', { pb: id });

  const pbs = useMemo(() => state.playbooks.filter((p) => tenantId === 'all' || p.tenants === 'all' || p.tenants.includes(tenantId)), [state.playbooks, tenantId]);
  const baseRuns = useMemo(() => playbookRuns(c, playbookLibrary(c)), [c]);
  const runs = useMemo(() => {
    const names = new Map(state.playbooks.map((p) => [p.id, p.name]));
    return [...state.sessionRuns, ...baseRuns]
      .filter((r) => tenantId === 'all' || r.tenantId === tenantId)
      .map((r) => ({ ...r, pbName: names.get(r.pbId) ?? r.pbName }));
  }, [state.sessionRuns, state.playbooks, baseRuns, tenantId]);

  const live = pbs.filter((p) => p.runs30 > 0);
  const runs30 = Math.round(live.reduce((s, p) => s + p.runs30, 0) * share);
  const autoPct = Math.round(live.reduce((s, p) => s + p.runs30 * p.autoClosedPct, 0) / Math.max(1, live.reduce((s, p) => s + p.runs30, 0)));
  const hours = live.reduce((s, p) => s + p.runs30 * share * p.medianSavedMin, 0) / 60;
  const manual = live.reduce((s, p) => s + p.runs30 * p.manualMttrMin, 0);
  const auto = live.reduce((s, p) => s + p.runs30 * p.autoMttrMin, 0);
  const mttrGain = manual ? Math.round((1 - auto / manual) * 100) : 0;
  const active = pbs.filter((p) => p.status === 'active').length;
  const awaiting = runs.filter((r) => r.status === 'awaiting').length;

  const siem = toolsFor(c, ['siem'])[0];
  const itsm = toolsFor(c, ['itsm'])[0];
  const source = `HexaSOC playbook engine${siem ? ` · ${siem.product}` : ''}${itsm ? ` · ${itsm.product}` : ''}`;
  const triggerTools = [...new Set(['siem', 'edr', 'identity'].map((k) => toolsFor(c, [k as 'siem'])[0]?.product).filter(Boolean))];
  const writeTools = [...new Set(c.connectors.filter((k) => k.write.length > 0 && k.env !== 'ot' && k.category !== 'OT' && k.vendor !== 'HexaShield').map((k) => k.product))];

  const newPlaybook = () => {
    const me = signedIn(c, persona);
    const n = state.playbooks.length;
    const id = `PB-${101 + n + Math.floor(Math.random() * 50) + 50}`;
    const tool = toolsFor(c, ['siem'])[0]?.id;
    const pb: Playbook = {
      id, name: `New playbook ${n + 1}`, category: 'Endpoint', summary: 'Draft created in the builder.', status: 'draft', tenants: 'all', runs30: 0, autoClosedPct: 0, medianSavedMin: 0,
      manualMttrMin: 60, autoMttrMin: 10, editedBy: me.name, editedMinAgo: 0, editedAt: Date.now(), version: 1, versions: [{ v: 1, by: me.name, minAgo: 0, at: Date.now(), note: 'Created' }], dirty: true,
      nodes: [{ id: 'n1', kind: 'trigger', op: 'trg.siem', label: OP['trg.siem'].label, x: 60, y: 160, tool, params: paramDefaults(c, 'trg.siem') }],
      edges: [],
    };
    update((s) => ({ ...s, playbooks: [...s.playbooks, pb] }));
    toast(`Created ${id} as a draft; drag steps from the palette to build it`);
    open(id);
  };

  const editing = view === 'editor' ? state.playbooks.find((p) => p.id === pbParam) ?? pbs[0] : undefined;

  const savedRows: RecordRow[] = live
    .map((p) => ({ p, h: (p.runs30 * share * p.medianSavedMin) / 60 }))
    .sort((a, b) => b.h - a.h)
    .map(({ p, h }) => ({ id: p.id, title: p.name, sub: `${fmtNum(Math.round(p.runs30 * share))} runs × ${p.medianSavedMin} min median saved`, right: <b className="num">{fmtNum(h, 1)} h</b>, onClick: () => { setDrawer(null); open(p.id); } }));
  const mttrRows: RecordRow[] = live
    .slice()
    .sort((a, b) => b.manualMttrMin - b.autoMttrMin - (a.manualMttrMin - a.autoMttrMin))
    .map((p) => ({ id: p.id, title: p.name, sub: `Manual ${fmtNum(p.manualMttrMin)} min → playbook ${fmtNum(p.autoMttrMin)} min`, right: <Badge color="var(--good)">−{Math.round((1 - p.autoMttrMin / p.manualMttrMin) * 100)}%</Badge>, onClick: () => { setDrawer(null); open(p.id); } }));
  const autoRows: RecordRow[] = live
    .slice()
    .sort((a, b) => b.autoClosedPct - a.autoClosedPct)
    .map((p) => ({ id: p.id, title: p.name, sub: `${fmtNum(Math.round(p.runs30 * share))} runs · ${p.category}`, right: <b className="num">{p.autoClosedPct}%</b>, onClick: () => { setDrawer(null); open(p.id); } }));

  return (
    <div className="stack" style={{ gap: 16 }}>
      <p className="page-intro">
        Response playbooks for <b>{scopeLabel}</b>: triggered from {triggerTools.join(', ') || 'the SIEM'}, writing back to {writeTools.slice(0, 5).join(', ')}{writeTools.length > 5 ? ` and ${writeTools.length - 5} more` : ''} through HexaView's approval gates. OT is read-only: playbooks notify and open tickets, never send commands.
      </p>
      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Active playbooks', value: active, unit: `of ${pbs.length}`, bar: (active / Math.max(1, pbs.length)) * 100, to: '/soc/playbooks?status=active', source },
          { label: 'Runs', hint: '30 d', value: fmtNum(runs30), to: '/soc/playbooks?view=runs', source },
          { label: 'Auto-closed', value: autoPct, unit: '%', bar: autoPct, onClick: () => setDrawer('auto'), source },
          { label: 'Analyst hours saved', hint: '30 d', value: fmtNum(hours, 0), unit: 'h', onClick: () => setDrawer('saved'), source, delta: { text: `≈ ${fmtNum(hours / 140, 1)} FTE`, good: true } },
          { label: 'MTTR improvement', value: mttrGain, unit: '%', bar: mttrGain, onClick: () => setDrawer('mttr'), source: `${source} · ServiceNow / ITSM case timestamps`, delta: { text: 'vs manual baseline', good: true } },
          { label: 'Awaiting approval', value: awaiting, to: '/soc/playbooks?view=runs&status=awaiting', source: 'HexaView Action Centre', toneColor: awaiting ? 'var(--sev-medium)' : undefined },
        ]}
      />
      <div className="pb-views">
        <Pills
          tone={tone}
          value={view}
          onChange={(v) => go(v, v === 'editor' && editing ? { pb: editing.id } : {})}
          items={[
            { id: 'library', label: <><LayoutGrid size={13} /> Library</>, n: pbs.length },
            { id: 'editor', label: <><Workflow size={13} /> Canvas editor</> },
            { id: 'runs', label: <><Activity size={13} /> Runs and metrics</>, n: runs.length },
          ]}
        />
        <span className="row" style={{ gap: 12, fontSize: 11.5, color: 'var(--text-muted)' }}>
          <span className="row" style={{ gap: 4 }}><Bot size={13} /> {pbs.filter((p) => p.status === 'review').length} in review</span>
          <span className="row" style={{ gap: 4 }}><Clock size={13} /> {pbs.filter((p) => p.dirty).length} with draft changes</span>
          <button className="link row" style={{ gap: 4 }} onClick={() => go('runs', { status: 'awaiting' })}><Inbox size={13} /> Approvals inbox</button>
        </span>
      </div>

      {view === 'library' && <Library pbs={pbs} onOpen={open} onNew={newPlaybook} />}
      {view === 'editor' && editing && <Editor key={editing.id} pb={editing} all={pbs.some((p) => p.id === editing.id) ? pbs : [editing, ...pbs]} onBack={() => go('library')} onPick={open} />}
      {view === 'editor' && !editing && <div className="empty">No playbook selected.</div>}
      {view === 'runs' && <Runs runs={runs} pbs={pbs} share={share} onOpen={open} />}

      {drawer === 'saved' && <RecordsDrawer title="Analyst hours saved" sub={`${fmtNum(hours, 0)} h across ${live.length} playbooks, last 30 days`} source={source} rows={savedRows} icon={<Timer size={16} />} onClose={() => setDrawer(null)} />}
      {drawer === 'mttr' && <RecordsDrawer title="MTTR improvement" sub={`${mttrGain}% faster than the manual baseline (run-weighted)`} source={`${source} · case open/close timestamps`} rows={mttrRows} icon={<Gauge size={16} />} onClose={() => setDrawer(null)} />}
      {drawer === 'auto' && (
        <RecordsDrawer title="Auto-closed runs" sub={`${autoPct}% of runs closed by the playbook without an analyst`} source={source} rows={autoRows} icon={<Bot size={16} />} onClose={() => setDrawer(null)}>
          <div className="list">
            {runs.filter((r) => r.autoClosed).slice(0, 6).map((r) => (
              <div key={r.id} className="list-row">
                <span className="list-main"><b>{r.id} · {r.pbName}</b><span>{r.entity} · {fmtAgo(agoOf(r.minAgo, r.at))}</span></span>
                <Badge color={RUN_COLOR[r.status]}>{RUN_LABEL[r.status]}</Badge>
              </div>
            ))}
          </div>
        </RecordsDrawer>
      )}
    </div>
  );
}
