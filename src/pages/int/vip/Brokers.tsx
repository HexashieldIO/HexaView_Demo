import { useMemo, useState, type CSSProperties } from 'react';
import { BROKER_CATS, BROKER_COLOR, REMOVAL_STATES, REMOVAL_COLOR, removalTrend, type BrokerRecord, type RemovalState } from '../../../data/modules/vip';
import { Badge, Btn, Callout, Card, KV, MiniStat, SectionLabel, Sources, Stacked, StatusBadge } from '../../../components/ui';
import { Chart } from '../../../components/Chart';
import { Drawer } from '../../../components/Overlay';
import { DataTable, type Column } from '../../../components/DataTable';
import { useVip } from './state';
import { ActionModal, Avatar } from './ui';

const STATE_SUB: Record<RemovalState, string> = { Found: 'not yet requested', Requested: 'awaiting the broker', Removed: 'confirmed gone', 'Re-listed': 'came back after removal' };
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export function Brokers() {
  const { c, tenantId, brokers, people, param, patch, setRemoval, openPerson } = useVip();
  const state = param('state');
  const cat = param('cat');
  const who = param('who');
  const [sel, setSel] = useState<BrokerRecord | null>(null);
  const [bulk, setBulk] = useState(false);
  const trend = useMemo(() => removalTrend(c, tenantId, brokers), [c, tenantId, brokers]);

  const rows = brokers
    .filter((b) => !state || b.state === state)
    .filter((b) => !cat || b.cat === cat)
    .filter((b) => !who || b.personId === who);
  const pending = rows.filter((b) => b.state === 'Found' || b.state === 'Re-listed');
  const removed = brokers.filter((b) => b.daysToRemove !== undefined);
  const live = sel ? brokers.find((b) => b.id === sel.id) ?? sel : null;
  const legal = brokers[0]?.legal ?? 'Privacy-law deletion request';

  const perPerson = people
    .map((p) => ({ p, recs: brokers.filter((b) => b.personId === p.id) }))
    .filter((x) => x.recs.length)
    .sort((a, b) => b.recs.length - a.recs.length);

  const columns: Column<BrokerRecord>[] = [
    { key: 'who', header: 'Person', sort: (b) => b.personName, render: (b) => <span className="row" style={{ gap: 8 }}><Avatar name={b.personName} size="sm" /><span className="t-main">{b.personName}</span></span> },
    { key: 'broker', header: 'Broker', sort: (b) => b.broker, render: (b) => (<><div className="t-main">{b.broker}</div><div className="t-sub">{b.cat}</div></>) },
    { key: 'exp', header: 'Exposes', render: (b) => <span className="muted" style={{ fontSize: 11.5 }}>{b.exposes.join(', ')}</span> },
    { key: 'state', header: 'State', sort: (b) => REMOVAL_STATES.indexOf(b.state), render: (b) => <StatusBadge value={b.state} map={REMOVAL_COLOR} /> },
    { key: 'found', header: 'Found', align: 'right', sort: (b) => -b.foundDays, render: (b) => <span className="muted">{b.foundDays}d ago</span> },
    { key: 'ttr', header: 'Time to removal', align: 'right', sort: (b) => b.daysToRemove ?? 999, render: (b) => (b.daysToRemove !== undefined ? <b>{b.daysToRemove} d</b> : b.requestedDays !== undefined ? <span className="muted">requested {b.requestedDays}d ago</span> : <span className="muted">–</span>) },
  ];

  return (
    <>
      <Callout>
        Data brokers republish executives’ home addresses, personal phones and relatives. HexaInt finds the listings and files removal requests ({legal}); HexaView shows only that a listing exists, never its contents.
      </Callout>

      <div className="vip-pipe">
        {REMOVAL_STATES.map((s) => (
          <button key={s} type="button" className={state === s ? 'on' : ''} style={{ '--tone': REMOVAL_COLOR[s] } as CSSProperties} onClick={() => patch({ state: state === s ? null : s })} title="Source: HexaInt data-broker sweep · click to filter">
            <b>{brokers.filter((b) => b.state === s).length}</b>
            <span>{s}</span>
            <small>{STATE_SUB[s]}</small>
          </button>
        ))}
      </div>

      <div className="grid g3">
        <Card title="Removal performance" sub="Requests filed and confirmed">
          <div className="row" style={{ gap: 22, flexWrap: 'wrap', marginBottom: 10 }}>
            <MiniStat value={`${median(removed.map((b) => b.daysToRemove ?? 0))} d`} label="median time to removal" color="var(--m-int)" />
            <MiniStat value={`${Math.round((brokers.filter((b) => b.state === 'Removed').length / Math.max(1, brokers.length)) * 100)}%`} label="of listings removed" color="var(--good)" />
            <MiniStat value={brokers.filter((b) => b.state === 'Re-listed').length} label="re-listed after removal" color="var(--bad)" />
          </div>
          <Chart
            height={170}
            option={{
              legend: { bottom: 0, textStyle: { fontSize: 10.5 } },
              grid: { left: 6, right: 8, top: 10, bottom: 30, containLabel: true },
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: trend.labels },
              yAxis: { type: 'value', minInterval: 1 },
              series: [
                { name: 'New listings found', type: 'bar', data: trend.found, itemStyle: { color: '#f5a83d' }, barMaxWidth: 14 },
                { name: 'Removals confirmed', type: 'bar', data: trend.removed, itemStyle: { color: '#2dd4bf' }, barMaxWidth: 14 },
              ],
            }}
          />
        </Card>
        <Card title="By broker category" sub="Listings, and median days to removal · click to filter">
          <div className="int-hbars">
            {BROKER_CATS.map((k) => {
              const recs = brokers.filter((b) => b.cat === k);
              const max = Math.max(1, ...BROKER_CATS.map((x) => brokers.filter((b) => b.cat === x).length));
              const ttr = median(recs.filter((b) => b.daysToRemove !== undefined).map((b) => b.daysToRemove ?? 0));
              return (
                <button key={k} type="button" className="int-hbar click" onClick={() => patch({ cat: cat === k ? null : k })} style={cat === k ? { background: 'var(--surface-hover)' } : undefined}>
                  <span className="int-hbar-l"><b>{k}</b><small>{ttr ? `median ${ttr} d to removal` : 'no removals yet'}</small></span>
                  <span className="int-hbar-t"><i style={{ width: `${Math.max(3, (recs.length / max) * 100)}%`, background: BROKER_COLOR[k] }} /></span>
                  <span className="int-hbar-n">{recs.length}</span>
                </button>
              );
            })}
          </div>
        </Card>
        <Card title="Per person" sub="Listings by removal state · click to filter">
          <div className="stack" style={{ gap: 8, maxHeight: 290, overflowY: 'auto' }}>
            {perPerson.map(({ p, recs }) => (
              <button key={p.id} type="button" className="row" style={{ gap: 10, background: who === p.id ? 'var(--surface-hover)' : 'none', border: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer', padding: '3px 4px', borderRadius: 8 }} onClick={() => patch({ who: who === p.id ? null : p.id })}>
                <span style={{ width: 130, minWidth: 130, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                <span style={{ flex: 1 }}><Stacked parts={REMOVAL_STATES.map((s) => ({ value: recs.filter((b) => b.state === s).length, color: REMOVAL_COLOR[s], label: s }))} /></span>
                <b style={{ fontFamily: 'var(--font-display)', minWidth: 22, textAlign: 'right' }}>{recs.length}</b>
              </button>
            ))}
            {!perPerson.length && <div className="empty">No data-broker listings found.</div>}
          </div>
        </Card>
      </div>

      <Card
        flush
        title="Listings"
        count={`${rows.length} of ${brokers.length}`}
        sub="Click a row for the record"
        actions={
          <span className="row" style={{ gap: 8 }}>
            {(state || cat || who) && <button type="button" className="int-fchip on" onClick={() => patch({ state: null, cat: null, who: null })}>{[state, cat, who && people.find((p) => p.id === who)?.name].filter(Boolean).join(' · ')} ×</button>}
            <Btn sm primary color="var(--m-int)" disabled={!pending.length} onClick={() => setBulk(true)}>Request removal ({pending.length})</Btn>
          </span>
        }
        foot={<Sources items={[{ name: 'HexaInt data-broker sweep' }, { name: 'Removal request tracker' }]} />}
      >
        <DataTable rows={rows} columns={columns} onRowClick={setSel} search={(b) => `${b.personName} ${b.broker} ${b.cat}`} searchPlaceholder="Filter by person or broker…" pageSize={12} />
      </Card>

      {live && (
        <Drawer
          title={live.broker}
          sub={`${live.cat} · ${live.personName}`}
          onClose={() => setSel(null)}
          footer={
            <>
              <Btn ghost onClick={() => { setSel(null); openPerson(live.personId); }}>Open {live.personName}</Btn>
              <Btn primary color="var(--m-int)" disabled={live.state === 'Requested' || live.state === 'Removed'} onClick={() => { setRemoval([live.id], 'Requested'); setSel(null); }}>Request removal</Btn>
            </>
          }
        >
          <KV rows={[
            ['State', <StatusBadge value={live.state} map={REMOVAL_COLOR} />],
            ['Category', <Badge color={BROKER_COLOR[live.cat]}>{live.cat}</Badge>],
            ['Exposes', live.exposes.join(', ')],
            ['Found', `${live.foundDays} days ago`],
            ['Requested', live.requestedDays !== undefined ? `${live.requestedDays} days ago` : 'Not yet'],
            ['Time to removal', live.daysToRemove !== undefined ? `${live.daysToRemove} days` : '–'],
            ['Legal basis', live.legal],
          ]} />
          <SectionLabel>Note</SectionLabel>
          <p className="vip-note">Listing contents are not copied into HexaView. Re-checked weekly; a re-listing reopens the request automatically.</p>
        </Drawer>
      )}

      {bulk && (
        <ActionModal
          title="Request data-broker removals"
          sub={`${pending.length} listing${pending.length === 1 ? '' : 's'}`}
          risk="low"
          approvers={1}
          confirmLabel={`Request ${pending.length} removal${pending.length === 1 ? '' : 's'}`}
          onDone={`${pending.length} removal requests filed; each broker is re-checked weekly.`}
          onClose={() => setBulk(false)}
          onConfirm={() => setRemoval(pending.map((b) => b.id), 'Requested')}
          change={[
            ['Listings', `${pending.length} found or re-listed`],
            ['People', `${new Set(pending.map((b) => b.personId)).size}`],
            ['Legal basis', legal],
            ['Tracked in', 'HexaInt removal queue + HexaCore audit ledger'],
          ]}
        />
      )}
    </>
  );
}
