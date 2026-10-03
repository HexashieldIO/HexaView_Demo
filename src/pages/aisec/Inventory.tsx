import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid, Table2 } from 'lucide-react';
import { Card, KpiStrip, Chip, Btn, SevBadge, Badge } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { fmtCompact, fmtNum } from '../../lib/format';
import { aiControlPlane } from '../../data/modules/ai';
import {
  AS_KINDS, KIND_HEX, STATUS_HEX, VENDOR_HEX, MODEL_VENDORS, aisecSensors,
  type AsItem, type AsKind, type AsStatus, type ModelVendor,
} from '../../data/modules/aisec';
import { EstateTiles, StatusSplit, DiscoveryTimeline } from './InventoryVisuals';
import { AS_TONE, BASE, CoverageDot, ItemDrawer, KIND_ICON, KindBadge, RecordsDrawer, SensorNote, StatusPill, VendorDot, itemRows, toneStyle, useAs } from './parts';

const STATUSES: AsStatus[] = ['sanctioned', 'pilot', 'in review', 'shadow'];

export default function AisecInventory() {
  const { c, tenantId, inv, sum, scope, nav } = useAs();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as AsStatus | null) ?? null;
  const kind = (params.get('kind') as AsKind | null) ?? null;
  const vendor = (params.get('vendor') as ModelVendor | null) ?? null;
  const setParam = (k: string, v: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [groupBy, setGroupBy] = useState<'vendor' | 'kind'>('vendor');
  const [open, setOpen] = useState<AsItem | null>(null);
  const [list, setList] = useState<{ title: string; items: AsItem[] } | null>(null);
  const cp = aiControlPlane(c);
  const sens = aisecSensors(c, tenantId);

  // "Agent" filter from the Overview also shows custom GPTs.
  const kindMatch = (x: AsItem) => !kind || x.kind === kind || (kind === 'Agent' && x.kind === 'Custom GPT') || (kind === 'Copilot' && x.kind === 'Code assistant') || (kind === 'LLM app' && x.kind === 'ML model');
  const shown = inv.filter((x) => (!status || x.status === status) && kindMatch(x) && (!vendor || x.modelVendor === vendor));
  const unowned = inv.filter((x) => x.owner === 'Unassigned' || x.owner.startsWith('Unknown'));
  const high = inv.filter((x) => x.euClass === 'High');
  const covered = inv.filter((x) => x.sensor === 'covered');

  const groups = useMemo(() => {
    const keys = groupBy === 'vendor' ? MODEL_VENDORS : AS_KINDS;
    return keys
      .map((k) => {
        const items = shown.filter((x) => (groupBy === 'vendor' ? x.modelVendor : x.kind) === k);
        return { key: k as string, items, sessions: items.reduce((s, x) => s + x.sessions, 0), color: groupBy === 'vendor' ? VENDOR_HEX[k as ModelVendor] : KIND_HEX[k as AsKind] };
      })
      .filter((g) => g.items.length)
      .sort((a, b) => b.items.length - a.items.length);
  }, [shown, groupBy]);



  return (
    <div className="stack" style={{ gap: 16, ...toneStyle }}>
      <p className="page-intro">
        <b>{c.name}</b> · {scope}. Every AI tool, model, copilot, agent and MCP server in use, sanctioned or not. Discovered on the execution path by the runtime sensor, reconciled with the AI register in HexaComply and {cp.label}.
      </p>
      <KpiStrip
        toneColor={AS_TONE}
        items={[
          { label: 'In inventory', value: inv.length, unit: `${sum.systems} systems · ${sum.agents + sum.mcpServers} agents/MCP`, onClick: () => { setParam('status', null); setParam('kind', null); }, source: 'HexaAI register · Nexovern sensor' },
          { label: 'Sanctioned', value: inv.filter((x) => x.status === 'sanctioned').length, toneColor: 'var(--good)', onClick: () => setParam('status', 'sanctioned'), source: 'HexaComply AI register' },
          { label: 'Pilot / in review', value: inv.filter((x) => x.status === 'pilot' || x.status === 'in review').length, toneColor: 'var(--sev-medium)', onClick: () => setParam('status', 'in review'), source: 'HexaComply AI register' },
          { label: 'Shadow', value: inv.filter((x) => x.status === 'shadow').length, unit: `${sum.shadowApps} tools · ${sum.shadowAgents} agents`, toneColor: 'var(--bad)', onClick: () => setParam('status', 'shadow'), source: 'Nexovern sensor · egress fingerprint' },
          { label: 'No owner', value: unowned.length, toneColor: 'var(--sev-high)', onClick: () => setList({ title: 'Items without an accountable owner', items: unowned }), source: 'HexaComply AI register' },
          { label: 'EU AI Act high-risk', value: high.length, onClick: () => setList({ title: 'High-risk systems (EU AI Act)', items: high }), source: 'HexaComply AI register (classification)' },
          { label: 'On runtime sensor', value: `${Math.round((covered.length / Math.max(1, inv.length)) * 100)}%`, unit: `${covered.length} items`, to: `${BASE}/sensors`, source: 'Nexovern sensor fleet' },
        ]}
      />

      <div className="grid g2">
        <Card
          title={groupBy === 'vendor' ? 'Estate by model vendor' : 'Estate by type'}
          sub="Block size = items · click to filter"
          actions={<div className="row" style={{ gap: 6 }}><Chip on={groupBy === 'vendor'} onClick={() => setGroupBy('vendor')} color={AS_TONE}>Vendor</Chip><Chip on={groupBy === 'kind'} onClick={() => setGroupBy('kind')} color={AS_TONE}>Type</Chip></div>}
        >
          <EstateTiles
            groups={groups}
            active={groupBy === 'vendor' ? vendor : kind}
            onPick={(k) => (groupBy === 'vendor' ? setParam('vendor', vendor === k ? null : k) : setParam('kind', kind === k ? null : k))}
          />
          <StatusSplit items={shown} active={status} onPick={(st) => setParam('status', status === st ? null : st)} />
        </Card>
        <Card title="Discovery timeline" sub="When each item was first seen, by type · bubble size = users · hover or click a bubble">
          <DiscoveryTimeline items={shown} activeStatus={status} onPickStatus={(st) => setParam('status', status === st ? null : st)} onOpen={setOpen} />
        </Card>
      </div>

      <Card
        title="AI inventory"
        count={shown.length}
        sub={<>Click any item for owner, vendor, model, data classes, EU AI Act class and sensor coverage, then sanction, block or assign an owner</>}
        flush={view === 'table'}
        actions={
          <div className="row wrap" style={{ gap: 6 }}>
            {STATUSES.map((st) => <Chip key={st} on={status === st} color={STATUS_HEX[st]} onClick={() => setParam('status', status === st ? null : st)}>{st}</Chip>)}
            <span style={{ width: 8 }} />
            {(['LLM app', 'Copilot', 'Agent', 'MCP server'] as AsKind[]).map((k) => <Chip key={k} on={kind === k} color={KIND_HEX[k]} onClick={() => setParam('kind', kind === k ? null : k)}>{k}</Chip>)}
            {vendor && <Chip on color={VENDOR_HEX[vendor]} onClick={() => setParam('vendor', null)}>{vendor} ×</Chip>}
            <Btn sm onClick={() => setView(view === 'cards' ? 'table' : 'cards')}>{view === 'cards' ? <Table2 size={13} /> : <LayoutGrid size={13} />}{view === 'cards' ? 'Table' : 'Cards'}</Btn>
          </div>
        }
      >
        {view === 'cards' ? (
          <div className="as-matrix">
            {shown.slice().sort((a, b) => b.risk - a.risk).map((x) => {
              const Icon = KIND_ICON[x.kind];
              return (
                <button key={x.id} className={`as-tile ${x.status === 'shadow' ? 'shadow' : ''}`} style={{ ['--kc' as string]: KIND_HEX[x.kind] }} onClick={() => setOpen(x)}>
                  <div className="as-tile-head">
                    <Icon size={15} style={{ color: KIND_HEX[x.kind], flexShrink: 0 }} />
                    <b title={x.name}>{x.name}</b>
                    <StatusPill status={x.status} />
                  </div>
                  <div className="as-tile-meta">{x.kind} · {x.vendor}</div>
                  <div className="as-tile-meta">Owner: <span style={{ color: x.owner === 'Unassigned' || x.owner.startsWith('Unknown') ? 'var(--bad)' : 'var(--text-secondary)' }}>{x.owner}</span></div>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <VendorDot v={x.modelVendor} />
                    {x.sensitive.slice(0, 1).map((d) => <Badge key={d} color="var(--sev-high)">{d}</Badge>)}
                  </div>
                  <div className="as-riskbar"><i style={{ width: `${x.risk}%`, background: x.risk >= 85 ? '#e0345e' : x.risk >= 65 ? '#f2643f' : x.risk >= 40 ? '#f0a338' : '#2dd4bf' }} /></div>
                  <div className="as-tile-foot">
                    <span>Risk {x.risk} · EU {x.euClass}</span>
                    <CoverageDot cov={x.sensor} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <DataTable
            rows={shown}
            rowKey={(x) => x.id}
            onRowClick={setOpen}
            search={(x) => `${x.name} ${x.vendor} ${x.owner} ${x.department} ${x.modelVendor} ${x.dataClasses.join(' ')}`}
            searchPlaceholder="Filter by name, vendor, owner, data class…"
            initialSort={{ key: 'risk', dir: 'desc' }}
            pageSize={20}
            columns={[
              { key: 'name', header: 'AI system / agent', sort: (x) => x.name, render: (x) => (<><div className="t-main">{x.name}</div><div className="t-sub">{x.vendor} · {x.department}</div></>) },
              { key: 'kind', header: 'Type', sort: (x) => x.kind, render: (x) => <KindBadge kind={x.kind} /> },
              { key: 'status', header: 'Status', sort: (x) => x.status, render: (x) => <StatusPill status={x.status} /> },
              { key: 'owner', header: 'Owner', sort: (x) => x.owner, render: (x) => <span style={{ color: x.owner === 'Unassigned' || x.owner.startsWith('Unknown') ? 'var(--bad)' : undefined }}>{x.owner}</span> },
              { key: 'model', header: 'Model', sort: (x) => x.modelVendor, render: (x) => (<><VendorDot v={x.modelVendor} /><div className="t-sub">{x.model}</div></>) },
              { key: 'data', header: 'Data classes', render: (x) => <span className="t-sub">{x.dataClasses.join(', ')}</span> },
              { key: 'eu', header: 'EU AI Act', sort: (x) => ['Prohibited', 'High', 'Limited', 'Minimal'].indexOf(x.euClass), render: (x) => <Badge color={x.euClass === 'High' ? 'var(--sev-high)' : x.euClass === 'Limited' ? 'var(--sev-medium)' : 'var(--good)'}>{x.euClass}</Badge> },
              { key: 'sensor', header: 'Sensor', sort: (x) => x.sensor, render: (x) => <CoverageDot cov={x.sensor} /> },
              { key: 'sessions', header: 'Sessions', align: 'right', sort: (x) => x.sessions, render: (x) => <span className="num">{fmtCompact(x.sessions)}</span> },
              { key: 'risk', header: 'Risk', align: 'right', sort: (x) => x.risk, render: (x) => <SevBadge sev={x.sev} /> },
            ]}
          />
        )}
        <div className="row between" style={{ padding: view === 'table' ? '10px 18px 14px' : '12px 0 0' }}>
          <SensorNote>{fmtNum(sens.covered)} of {fmtNum(sens.hosts)} AI-estate hosts covered</SensorNote>
          <button className="link" onClick={() => nav(`${BASE}/dataflows`)}>Where does this data go? →</button>
        </div>
      </Card>

      {open && <ItemDrawer item={open} onClose={() => setOpen(null)} />}
      {list && <RecordsDrawer title={list.title} source="HexaComply AI register · Nexovern sensor" onClose={() => setList(null)} rows={itemRows(list.items, (x) => { setList(null); setOpen(x); })} />}
    </div>
  );
}
