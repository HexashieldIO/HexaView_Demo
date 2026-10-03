import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { FileWarning, Globe2, MessageSquare, Store, Skull, Send, ClipboardList } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { tenantName } from '../../data/customers';
import {
  darkwebMentions, mentionTrend, ransomGroups, lookalikes,
  DW_SOURCES, DW_SOURCE_COLOR, MENTION_SCOPES, SCOPE_COLOR, LOOK_STATUSES, LOOK_STATUS_COLOR,
  type Mention, type Lookalike, type DwSource, type RansomGroup,
} from '../../data/modules/int';
import { Card, KpiStrip, SevBadge, Badge, StatusBadge, Sources, Freshness, Btn, KV, SectionLabel, SEV_COLOR } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { FlowMap, type FlowColumn, type FlowLink } from '../../components/FlowMap';
import { Drawer } from '../../components/Overlay';
import { fmtAgo } from '../../lib/format';
import { WriteBack, FilterGroup, useParamFilter, useParamPatch, RecordsDrawer } from './parts';
import './int.css';

const tone = MODULE_BY_ID.int.tone;
const STATUS_COLOR: Record<Mention['status'], string> = { New: 'var(--sev-high)', Triaging: 'var(--sev-medium)', Actioned: 'var(--good)', Monitoring: 'var(--text-muted)' };
const SRC_ICON: Record<DwSource, ReactNode> = {
  Markets: <Store size={13} />, Forums: <MessageSquare size={13} />, 'Ransomware leak sites': <Skull size={13} />, Telegram: <Send size={13} />, 'Paste sites': <ClipboardList size={13} />,
};

export default function IntDarkweb() {
  const { customer: c, tenantId, timeRange } = useApp();
  const mentions = useMemo(() => darkwebMentions(c, tenantId), [c, tenantId]);
  const trend = useMemo(() => mentionTrend(c, tenantId, timeRange), [c, tenantId, timeRange]);
  const groups = useMemo(() => ransomGroups(c), [c]);
  const domains = useMemo(() => lookalikes(c, tenantId), [c, tenantId]);

  const [scope, setScope] = useParamFilter('scope');
  const [src, setSrc] = useParamFilter('src');
  const [st] = useParamFilter('st');
  const [sev] = useParamFilter('sev');
  const [lstatus, setLstatus] = useParamFilter('status');
  const [view] = useParamFilter('view', 'feed');
  const patch = useParamPatch();

  const [sel, setSel] = useState<Mention | null>(null);
  const [dom, setDom] = useState<Lookalike | null>(null);
  const [takedown, setTakedown] = useState<Lookalike | null>(null);
  const [groupsOpen, setGroupsOpen] = useState(false);

  const intel = c.connectors.find((k) => k.product === 'HexaInt');
  const direct = mentions.filter((m) => m.scope === 'Direct mention').length;
  const critical = mentions.filter((m) => m.sev === 'critical').length;
  const untriaged = mentions.filter((m) => m.status === 'New').length;
  const loginClones = domains.filter((d) => d.status === 'Live — login page').length;

  const feed = mentions
    .filter((m) => scope === 'All' || m.scope === scope)
    .filter((m) => src === 'All' || m.source === src)
    .filter((m) => st === 'All' || m.status === st)
    .filter((m) => sev === 'All' || m.sev === sev)
    .sort((a, b) => a.minutesAgo - b.minutesAgo);
  const doms = domains.filter((d) => lstatus === 'All' || d.status === lstatus).sort((a, b) => a.foundDays - b.foundDays);

  // Flow: source -> scope -> status
  const flow = useMemo(() => {
    const cnt = (f: (m: Mention) => boolean) => mentions.filter(f).length;
    const columns: FlowColumn[] = [
      { label: 'Where it was posted', nodes: DW_SOURCES.filter((s) => cnt((m) => m.source === s)).map((s) => ({ id: `s:${s}`, title: s, icon: SRC_ICON[s], count: cnt((m) => m.source === s), sub: 'posts', color: DW_SOURCE_COLOR[s], onClick: () => patch({ src: s, scope: null, st: null, view: null }) })) },
      { label: 'What it is about', nodes: MENTION_SCOPES.filter((s) => cnt((m) => m.scope === s)).map((s) => ({ id: `p:${s}`, title: s, count: cnt((m) => m.scope === s), sub: s === 'Direct mention' ? 'names you' : s === 'Supply chain' ? 'a supplier' : 'your sector', color: SCOPE_COLOR[s], state: s === 'Direct mention' ? 'bad' as const : undefined, onClick: () => patch({ scope: s, src: null, st: null, view: null }) })) },
      { label: 'Where it stands', nodes: (['New', 'Triaging', 'Actioned', 'Monitoring'] as Mention['status'][]).filter((s) => cnt((m) => m.status === s)).map((s) => ({ id: `t:${s}`, title: s, count: cnt((m) => m.status === s), sub: s === 'New' ? 'untriaged' : 'items', color: STATUS_COLOR[s], onClick: () => patch({ st: s, src: null, scope: null, view: null }) })) },
    ];
    const links: FlowLink[] = [];
    for (const s of DW_SOURCES) for (const p of MENTION_SCOPES) {
      const v = cnt((m) => m.source === s && m.scope === p);
      if (v) links.push({ from: `s:${s}`, to: `p:${p}`, value: v, bad: p === 'Direct mention' });
    }
    for (const p of MENTION_SCOPES) for (const t of ['New', 'Triaging', 'Actioned', 'Monitoring'] as const) {
      const v = cnt((m) => m.scope === p && m.status === t);
      if (v) links.push({ from: `p:${p}`, to: `t:${t}`, value: v, bad: t === 'New' && p === 'Direct mention' });
    }
    return { columns, links };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentions]);

  const domainsCard = (
    <Card
      title="Lookalike domains"
      count={doms.length}
      sub={`Impersonating ${c.domain} · click a domain for detail and takedown`}
      actions={<Freshness minutes={intel?.lastSyncMin ?? 4} label="last sweep" />}
    >
      <div style={{ marginBottom: 8 }}>
        <FilterGroup label="Status" value={lstatus} options={LOOK_STATUSES} onChange={setLstatus} counts={Object.fromEntries(LOOK_STATUSES.map((s) => [s, domains.filter((d) => d.status === s).length]))} />
      </div>
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {doms.map((d) => (
          <button key={d.domain} className="int-dom list-row" style={{ cursor: 'pointer', width: '100%' }} onClick={() => setDom(d)}>
            <span className="int-ico"><Globe2 /></span>
            <span className="list-main">
              <b className="mono" style={{ color: d.status === 'Live — login page' ? 'var(--bad)' : undefined }}>{d.domain}</b>
              <span>impersonates {d.impersonates} · {d.kind} · registered {d.registered}d ago · {d.registrar}</span>
            </span>
            <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>found {d.foundDays}d ago</span>
            <Badge color={LOOK_STATUS_COLOR[d.status]}>{d.status}</Badge>
          </button>
        ))}
        {doms.length === 0 && <div className="empty">No domains in this status.</div>}
      </div>
    </Card>
  );

  return (
    <>
      <p className="page-intro">
        Impersonating domains and dark-web chatter for <b>{c.name}</b> · {tenantName(c, tenantId)}, watched across criminal markets, forums, ransomware leak sites, Telegram and paste sites through {intel ? `${intel.vendor} ${intel.product}` : 'HexaInt'} collection. Posts are shown as redacted analyst summaries.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Mentions', hint: 'matched to you', value: mentions.length, unit: 'posts', to: '/int/darkweb', source: 'HexaInt dark-web collection' },
          { label: 'Naming you', hint: 'direct', value: direct, unit: 'posts', toneColor: 'var(--bad)', to: '/int/darkweb?scope=Direct%20mention', source: 'HexaInt analyst triage' },
          { label: 'Critical', value: critical, unit: 'posts', toneColor: 'var(--sev-critical)', to: '/int/darkweb?sev=critical', source: 'HexaInt analyst triage' },
          { label: 'Untriaged', hint: 'new', value: untriaged, unit: 'posts', toneColor: 'var(--sev-high)', to: '/int/darkweb?st=New', source: 'HexaInt triage queue' },
          { label: 'Lookalikes', hint: 'registered', value: domains.length, unit: `domains · ${loginClones} login clones`, to: '/int/darkweb?view=domains', source: 'HexaInt domain monitoring (CT logs, zone files)' },
          { label: 'Ransomware groups', hint: 'active in sector', value: groups.filter((g) => g.active).length, unit: 'groups', toneColor: 'var(--bad)', onClick: () => setGroupsOpen(true), source: 'HexaInt leak-site monitoring' },
        ]}
      />

      {view === 'domains' && domainsCard}

      <Card title="Where the chatter comes from, and where it stands" sub="Posts by venue → what they are about → triage status · click a card to filter the feed">
        <FlowMap columns={flow.columns} links={flow.links} height={250} />
      </Card>

      <div className="grid g-3-2">
        <Card
          title="Dark web & open source"
          count={`${feed.length} of ${mentions.length}`}
          sub="Newest first · click an item for the redacted summary and action"
        >
          <div className="row wrap" style={{ gap: 10, marginBottom: 8 }}>
            <FilterGroup label="About" value={scope} options={MENTION_SCOPES} onChange={setScope} />
            {(src !== 'All' || st !== 'All' || sev !== 'All') && (
              <button type="button" className="int-fchip on" onClick={() => patch({ src: null, st: null, sev: null })}>
                {[src !== 'All' && src, st !== 'All' && st, sev !== 'All' && sev].filter(Boolean).join(' · ')} ×
              </button>
            )}
          </div>
          <div className="int-feed" style={{ maxHeight: 560, overflowY: 'auto' }}>
            {feed.map((m) => (
              <button key={m.id} className="int-feed-item" onClick={() => setSel(m)}>
                <span className="int-feed-dot" style={{ background: m.scope === 'Direct mention' ? 'var(--bad)' : 'var(--text-muted)', boxShadow: m.scope === 'Direct mention' ? '0 0 0 3px color-mix(in srgb, var(--bad) 25%, transparent)' : undefined }} />
                <span>
                  <span className="row between" style={{ gap: 8 }}>
                    <span className="chips">
                      <Badge color={SCOPE_COLOR[m.scope]}>{m.scope}</Badge>
                      <Badge color="#68b1ff">{m.category}</Badge>
                      <SevBadge sev={m.sev} />
                    </span>
                    <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtAgo(m.minutesAgo)} · {m.source}</span>
                  </span>
                  <h4>{m.title}</h4>
                  <p>{m.snippet}</p>
                  <span className="int-feed-meta">
                    <span>Actor <b>{m.actor}</b></span>
                    <span>Asset <b>{m.asset}</b></span>
                    <span>Status <b style={{ color: STATUS_COLOR[m.status] }}>{m.status}</b></span>
                  </span>
                </span>
              </button>
            ))}
            {feed.length === 0 && <div className="empty">Nothing matches these filters.</div>}
          </div>
        </Card>

        <div className="stack" style={{ gap: 16 }}>
          <Card title="Mentions over time" sub="By venue · follows the selected time range" actions={<Freshness minutes={intel?.lastSyncMin ?? 2} label="HexaInt" />}>
            <Chart
              height={200}
              onClick={(p) => { const n = (p as { seriesName?: string }).seriesName; if (n) setSrc(n); }}
              option={{
                legend: { data: [...DW_SOURCES], bottom: 0, itemGap: 10, textStyle: { fontSize: 10.5 } },
                grid: { left: 8, right: 8, top: 10, bottom: 46, containLabel: true },
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                xAxis: { type: 'category', data: trend.labels, axisLabel: { interval: timeRange === '24h' ? 5 : 'auto' } },
                yAxis: { type: 'value', minInterval: 1 },
                series: DW_SOURCES.map((s) => ({ name: s, type: 'bar', stack: 'm', data: trend.series[s], itemStyle: { color: DW_SOURCE_COLOR[s] }, barMaxWidth: 16 })),
              }}
            />
          </Card>
          <Card title="Ransomware groups active against the sector" sub={c.sectorLong}>
            <div className="list">
              {groups.map((g) => (
                <div key={g.name} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <span className="int-ico" style={{ background: g.active ? 'color-mix(in srgb, var(--bad) 14%, transparent)' : undefined, color: g.active ? 'var(--bad)' : 'var(--text-muted)' }}><Skull /></span>
                  <span className="list-main">
                    <b>{g.name}</b>
                    <span style={{ whiteSpace: 'normal' }}>{g.note}</span>
                    <span>{g.sectorVictims90d} sector victims in 90 days · last seen {g.lastSeenDays}d ago</span>
                  </span>
                  <Badge color={g.active ? 'var(--bad)' : 'var(--text-muted)'} dot>{g.active ? 'Active' : 'Quiet'}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {view !== 'domains' && domainsCard}

      {sel && (
        <Drawer
          wide
          title={sel.title}
          sub={`${sel.source} · ${sel.venue}`}
          icon={<span className="ico-box" style={{ '--tone': SEV_COLOR[sel.sev] } as CSSProperties}><FileWarning /></span>}
          onClose={() => setSel(null)}
          footer={<><Btn ghost onClick={() => setSel(null)}>Close</Btn><Btn primary color={tone} onClick={() => setSel(null)}>Open hunt in HexaSOC</Btn></>}
        >
          <SectionLabel>Analyst summary (redacted)</SectionLabel>
          <div className="int-snippet">{sel.snippet}</div>
          <div style={{ marginTop: 14 }}>
            <KV
              rows={[
                ['Severity', <SevBadge sev={sel.sev} />],
                ['About', <Badge color={SCOPE_COLOR[sel.scope]}>{sel.scope}</Badge>],
                ['Category', sel.category],
                ['Venue', <><span className="src-chip"><i style={{ background: DW_SOURCE_COLOR[sel.source] }} />{sel.source}</span> {sel.venue}</>],
                ['Actor', sel.actor],
                ['Matched asset', <span className="mono">{sel.asset}</span>],
                ['Tenant', tenantName(c, sel.tenantId)],
                ['Confidence', `${sel.confidence}%`],
                ['Status', <StatusBadge value={sel.status} map={STATUS_COLOR} />],
                ['First seen', fmtAgo(sel.minutesAgo)],
              ]}
            />
          </div>
          <SectionLabel>Recommended action</SectionLabel>
          <p className="secondary" style={{ fontSize: 12.5 }}>{sel.action}</p>
          <SectionLabel>Sources</SectionLabel>
          <Sources items={[{ name: 'HexaInt collection' }, { name: 'HexaSOC hunt' }, { name: 'HexaComply evidence' }]} />
        </Drawer>
      )}

      {dom && (
        <Drawer
          title={dom.domain}
          sub={`impersonates ${dom.impersonates}`}
          icon={<span className="int-ico"><Globe2 /></span>}
          onClose={() => setDom(null)}
          footer={<><Btn ghost onClick={() => setDom(null)}>Close</Btn><Btn primary color={tone} disabled={dom.status === 'Taken down'} onClick={() => { setTakedown(dom); setDom(null); }}>Request takedown</Btn></>}
        >
          <KV
            rows={[
              ['Status', <Badge color={LOOK_STATUS_COLOR[dom.status]}>{dom.status}</Badge>],
              ['Risk', <SevBadge sev={dom.risk} />],
              ['Technique', dom.kind],
              ['Registered', `${dom.registered} days ago`],
              ['Found', `${dom.foundDays} days ago`],
              ['Registrar', dom.registrar],
              ['Mail (MX) records', dom.mx ? <Badge color="var(--sev-medium)">Yes: can send lures</Badge> : 'No'],
              ['Takedown', dom.takedown],
            ]}
          />
          <SectionLabel>Sources</SectionLabel>
          <Sources items={[{ name: 'Certificate transparency logs' }, { name: 'Zone-file monitoring' }, { name: 'HexaInt page capture' }]} />
        </Drawer>
      )}

      {groupsOpen && (
        <RecordsDrawer<RansomGroup>
          title="Ransomware groups active against the sector"
          rows={groups}
          source={['HexaInt leak-site monitoring', 'Sector ISAC reporting']}
          onClose={() => setGroupsOpen(false)}
          columns={[
            { key: 'n', header: 'Group', render: (g) => (<><div className="t-main">{g.name}</div><div className="t-sub">{g.note}</div></>) },
            { key: 'v', header: 'Victims 90d', align: 'right', sort: (g) => g.sectorVictims90d, render: (g) => <b>{g.sectorVictims90d}</b> },
            { key: 'l', header: 'Last seen', align: 'right', sort: (g) => g.lastSeenDays, render: (g) => `${g.lastSeenDays}d ago` },
            { key: 'a', header: 'State', render: (g) => <Badge color={g.active ? 'var(--bad)' : 'var(--text-muted)'} dot>{g.active ? 'Active' : 'Quiet'}</Badge> },
          ]}
        />
      )}

      {takedown && (
        <WriteBack
          title="Request domain takedown"
          sub={takedown.domain}
          risk="low"
          approvers={1}
          confirmLabel="Submit takedown request"
          onDone={`Takedown requested for ${takedown.domain}; registrar and hosting abuse teams notified.`}
          onClose={() => setTakedown(null)}
          change={[
            ['Domain', <span className="mono">{takedown.domain}</span>],
            ['Registrar', takedown.registrar],
            ['Status', takedown.status],
            ['Action', 'File abuse report + evidence package with registrar, host and CERT'],
            ['Tracked in', 'HexaInt takedown queue + HexaCore audit ledger'],
          ]}
        />
      )}
    </>
  );
}
