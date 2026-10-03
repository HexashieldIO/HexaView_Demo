import { useMemo, useState, type MouseEvent } from 'react';
import { Copy, Globe2, Hash, Link2, Server } from 'lucide-react';
import { useApp, rangeLabel } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { tenantName } from '../../data/customers';
import { iocFeed, tally, siemOf, IOC_TYPES, IOC_THREATS, type Ioc } from '../../data/modules/int';
import { Card, KpiStrip, Badge, Btn, KV, SectionLabel, Sources } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { FlowMap, type FlowColumn, type FlowLink } from '../../components/FlowMap';
import { fmtAgo } from '../../lib/format';
import { FilterGroup, useParamFilter, useParamPatch, WriteBack, RecordsDrawer, HBarList } from './parts';
import './int.css';

const tone = MODULE_BY_ID.int.tone;
const TLP_COLOR: Record<Ioc['tlp'], string> = { 'TLP:CLEAR': '#8a9bc0', 'TLP:GREEN': '#2dd4bf', 'TLP:AMBER': '#f5a83d', 'TLP:AMBER+STRICT': '#f2643f' };
const THREAT_COLOR: Record<string, string> = { 'Command and control': '#f8646f', Phishing: '#f5a83d', 'Malware delivery': '#a07cfb', 'Credential theft': '#ef6aae', Anonymiser: '#8a9bc0', Reconnaissance: '#4f8cff' };
const SIGNALS = ['Seen here', 'Blocked', 'Took our credentials'] as const;
const SIGNAL_PARAM: Record<string, string> = { seen: 'Seen here', blocked: 'Blocked', creds: 'Took our credentials' };

function typeIcon(t: Ioc['type']) {
  return t === 'IP' ? <Server /> : t === 'Domain' ? <Globe2 /> : t === 'URL' ? <Link2 /> : <Hash />;
}
function shortVal(v: string): string {
  return v.length > 30 && /^[0-9a-f]+$/.test(v) ? `${v.slice(0, 14)}…${v.slice(-8)}` : v;
}

export default function IntIoc() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const iocs = useMemo(() => iocFeed(c, tenantId, timeRange), [c, tenantId, timeRange]);
  const [type, setType] = useParamFilter('type');
  const [threat, setThreat] = useParamFilter('threat');
  const [signalRaw, setSignalRaw] = useParamFilter('signal');
  const patch = useParamPatch();
  const signal = SIGNAL_PARAM[signalRaw] ?? signalRaw;
  const setSignal = (v: string) => setSignalRaw(Object.entries(SIGNAL_PARAM).find(([, l]) => l === v)?.[0] ?? v);
  const [sel, setSel] = useState<Ioc | null>(null);
  const [hunt, setHunt] = useState<Ioc | null>(null);
  const [incOpen, setIncOpen] = useState(false);

  const siem = siemOf(c);
  const seen = iocs.filter((i) => i.hits > 0);
  const blocked = iocs.filter((i) => i.blocked);
  const incidents = iocs.reduce((n, i) => n + i.incidents, 0);
  const credsTaken = iocs.reduce((n, i) => n + i.credsTaken, 0);
  const range = rangeLabel(timeRange).toLowerCase();

  const rows = iocs
    .filter((i) => type === 'All' || i.type === type)
    .filter((i) => threat === 'All' || i.threat === threat)
    .filter((i) => signal === 'All' || (signal === 'Seen here' ? i.hits > 0 : signal === 'Blocked' ? i.blocked : i.credsTaken > 0));

  const copy = (e: MouseEvent, v: string) => {
    e.stopPropagation();
    void navigator.clipboard?.writeText(v).catch(() => undefined);
    toast('Indicator copied (defanged)');
  };

  const flow = useMemo(() => {
    const feeds = tally(iocs, (i) => i.feed);
    const threats = tally(iocs, (i) => i.threat);
    const targets = tally(iocs.flatMap((i) => i.pushedTo.map((p) => ({ p }))), (x) => x.p);
    const columns: FlowColumn[] = [
      { label: 'Where it came from', nodes: feeds.map((f) => ({ id: `f:${f.key}`, title: f.key, count: f.n, sub: 'indicators' })) },
      { label: 'What it is', nodes: threats.map((t) => ({ id: `t:${t.key}`, title: t.key, count: t.n, sub: `${iocs.filter((i) => i.threat === t.key && i.hits > 0).length} seen here`, color: THREAT_COLOR[t.key], onClick: () => patch({ threat: t.key }) })) },
      { label: 'Where it was pushed', nodes: targets.map((t) => ({ id: `p:${t.key}`, title: t.key, count: t.n, sub: 'deployed', state: 'good' as const })) },
    ];
    const links: FlowLink[] = [];
    for (const f of feeds) for (const t of threats) {
      const v = iocs.filter((i) => i.feed === f.key && i.threat === t.key).length;
      if (v) links.push({ from: `f:${f.key}`, to: `t:${t.key}`, value: v });
    }
    for (const t of threats) for (const p of targets) {
      const v = iocs.filter((i) => i.threat === t.key && i.pushedTo.includes(p.key)).length;
      if (v) links.push({ from: `t:${t.key}`, to: `p:${p.key}`, value: v, bad: t.key === 'Credential theft' || t.key === 'Command and control' });
    }
    return { columns, links };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iocs]);

  const attributions = tally(iocs, (i) => i.attributedTo);

  return (
    <>
      <p className="page-intro">
        Indicators pushed to <b>{c.name}</b> · {tenantName(c, tenantId)} in the {range}. Each row says whether it was seen here, whether it was stopped, and what it belongs to. Values are shown defanged.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Indicators', hint: 'pushed', value: iocs.length, unit: range, to: '/int/ioc', source: 'HexaInt research · ISAC TAXII feeds' },
          { label: 'Seen', hint: 'in your environment', value: seen.length, unit: 'indicators', toneColor: 'var(--sev-high)', to: '/int/ioc?signal=seen', source: siem ? `${siem.vendor} ${siem.product} sightings` : 'SIEM sightings' },
          { label: 'Blocked', hint: 'automatically', value: blocked.length, unit: 'indicators', toneColor: 'var(--good)', to: '/int/ioc?signal=blocked', source: 'EDR, email and web controls' },
          { label: 'Incidents', hint: 'raised', value: incidents, unit: 'cases', toneColor: 'var(--bad)', onClick: () => setIncOpen(true), source: 'HexaSOC case management' },
          { label: 'Credentials', hint: 'of yours taken', value: credsTaken, unit: 'accounts', toneColor: 'var(--bad)', to: '/int/ioc?signal=creds', source: 'HexaInt stealer-log correlation' },
        ]}
      />

      <Card title="From feed to control" sub="Where indicators came from, what they are, and which of your tools enforce them · click a threat to filter">
          <FlowMap columns={flow.columns} links={flow.links} height={240} />
      </Card>

      <div className="grid g2">
        <Card title="Attributed to" sub="Intrusion sets, malware and infrastructure behind the indicators · click to search">
          <HBarList rows={attributions.slice(0, 8).map((a) => ({ key: a.key, label: a.key, sub: iocs.find((i) => i.attributedTo === a.key)?.attrKind, n: a.n }))} onPick={(k) => setSel(iocs.find((i) => i.attributedTo === k) ?? null)} />
        </Card>
        <Card title="Indicators by type" sub="Click a type to filter the list">
          <HBarList rows={tally(iocs, (i) => i.type).map((t) => ({ key: t.key, label: t.key, sub: `${iocs.filter((i) => i.type === t.key && i.hits > 0).length} seen here · ${iocs.filter((i) => i.type === t.key && i.blocked).length} blocked`, n: t.n }))} onPick={(k) => setType(type === k ? 'All' : k)} />
        </Card>
      </div>

      <div className="int-filters">
        <FilterGroup label="IOC type" value={type} options={IOC_TYPES} onChange={setType} />
        <FilterGroup label="Threat" value={threat} options={IOC_THREATS} onChange={setThreat} />
        <FilterGroup label="Signal" value={signal} options={SIGNALS} onChange={setSignal} />
      </div>

      <Card title="Indicators" count={`${rows.length} of ${iocs.length}`} sub="Most hits first · click for detail" flush>
        <DataTable
          rows={rows}
          rowKey={(i) => i.id}
          onRowClick={setSel}
          search={(i) => `${i.value} ${i.desc} ${i.attributedTo}`}
          searchPlaceholder="Search indicator or title…"
          pageSize={12}
          columns={[
            {
              key: 'v', header: 'Indicator', render: (i) => (
                <div className="int-cell" style={{ alignItems: 'flex-start' }}>
                  <span className="int-ico">{typeIcon(i.type)}</span>
                  <span style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="t-main mono">{shortVal(i.value)}</span>
                      <button className="btn sm ghost" style={{ height: 20, padding: '0 6px' }} onClick={(e) => copy(e, i.value)} title="Copy defanged value"><Copy size={11} /> Copy</button>
                    </div>
                    <div className="row" style={{ gap: 6, marginTop: 2 }}>
                      <Badge>{i.type}</Badge>
                      <span className="t-sub" style={{ margin: 0 }}>{i.threat} · {i.desc}</span>
                    </div>
                  </span>
                </div>
              ),
            },
            { key: 'tlp', header: 'Handling', sort: (i) => i.tlp, render: (i) => <span className="int-tlp" style={{ color: TLP_COLOR[i.tlp], background: `color-mix(in srgb, ${TLP_COLOR[i.tlp]} 14%, transparent)` }}>{i.tlp}</span> },
            { key: 'seen', header: 'Seen here', sort: (i) => i.hits, render: (i) => i.hits ? (<><div className="t-main">{i.hits} hits</div><div className="t-sub">{i.signals} signal{i.signals === 1 ? '' : 's'}{i.incidents ? ` · ${i.incidents} incident${i.incidents === 1 ? '' : 's'}` : ''}</div></>) : (<><div className="t-main muted">Not seen</div><div className="t-sub">{i.blocked ? 'Blocked in advance' : 'Watching'}</div></>) },
            { key: 'attr', header: 'Attributed to', sort: (i) => i.attributedTo, render: (i) => (<><div className="t-main">{i.attributedTo}</div><div className="t-sub">{i.attrKind}</div></>) },
            { key: 'cr', header: 'Credentials taken', sort: (i) => i.credsTaken, render: (i) => i.credsTaken ? (<><div className="t-main" style={{ color: 'var(--bad)' }}>{i.credsTaken} of yours</div><div className="t-sub">{i.stealerLogs} stealer logs</div></>) : (<><div className="muted">—</div><div className="t-sub">Not applicable</div></>) },
            { key: 'last', header: 'Last seen', align: 'right', sort: (i) => -i.lastSeenMin, render: (i) => <span className="muted">{fmtAgo(i.lastSeenMin)}</span> },
          ]}
        />
      </Card>

      {sel && (
        <Drawer
          wide
          title={shortVal(sel.value)}
          sub={`${sel.type} · ${sel.threat}`}
          icon={<span className="int-ico">{typeIcon(sel.type)}</span>}
          onClose={() => setSel(null)}
          footer={<><Btn ghost onClick={() => setSel(null)}>Close</Btn><Btn primary color={tone} onClick={() => { setHunt(sel); setSel(null); }}>Hunt back 90 days</Btn></>}
        >
          <div className="int-snippet" style={{ marginBottom: 12 }}>{sel.value}</div>
          <KV
            rows={[
              ['What it is', `${sel.threat}: ${sel.desc}`],
              ['Handling', <span className="int-tlp" style={{ color: TLP_COLOR[sel.tlp], background: `color-mix(in srgb, ${TLP_COLOR[sel.tlp]} 14%, transparent)` }}>{sel.tlp}</span>],
              ['Attributed to', `${sel.attributedTo} (${sel.attrKind})`],
              ['Seen here', sel.hits ? `${sel.hits} hits · ${sel.signals} signals · ${sel.incidents} incidents` : 'Not seen'],
              ['Blocked', sel.blocked ? <Badge color="var(--good)" dot>Blocked automatically</Badge> : <Badge color="var(--sev-medium)" dot>Alert only</Badge>],
              ['Credentials taken', sel.credsTaken ? `${sel.credsTaken} of yours (${sel.stealerLogs} stealer logs)` : 'Not applicable'],
              ['Feed', sel.feed],
              ['Last seen', fmtAgo(sel.lastSeenMin)],
            ]}
          />
          <SectionLabel>Pushed to</SectionLabel>
          <Sources items={sel.pushedTo.map((name) => ({ name }))} />
        </Drawer>
      )}

      {incOpen && (
        <RecordsDrawer
          title="Incidents raised from indicators"
          sub={`${incidents} incidents across ${iocs.filter((i) => i.incidents).length} indicators`}
          rows={iocs.filter((i) => i.incidents > 0)}
          source={['HexaSOC case management', siem ? `${siem.vendor} ${siem.product}` : 'SIEM']}
          onClose={() => setIncOpen(false)}
          onRow={(i) => { setIncOpen(false); setSel(i); }}
          openTo="/soc/ir"
          openLabel="Open in Incident Response"
          columns={[
            { key: 'v', header: 'Indicator', render: (i) => (<><div className="t-main mono">{shortVal(i.value)}</div><div className="t-sub">{i.threat}</div></>) },
            { key: 'a', header: 'Attributed to', render: (i) => i.attributedTo },
            { key: 'n', header: 'Incidents', align: 'right', sort: (i) => i.incidents, render: (i) => <b>{i.incidents}</b> },
          ]}
        />
      )}

      {hunt && (
        <WriteBack
          title="Retro-hunt this indicator"
          sub={shortVal(hunt.value)}
          risk="low"
          approvers={1}
          confirmLabel="Run hunt"
          onDone={`Retro-hunt queued in ${siem ? siem.product : 'the SIEM'} for ${shortVal(hunt.value)} over 90 days.`}
          onClose={() => setHunt(null)}
          change={[
            ['Indicator', <span className="mono">{hunt.value}</span>],
            ['Search', `${siem ? `${siem.vendor} ${siem.product}` : 'SIEM'} · last 90 days · all tenants in scope`],
            ['Output', 'HexaSOC hunt record with any hits linked to cases'],
          ]}
        />
      )}
    </>
  );
}
