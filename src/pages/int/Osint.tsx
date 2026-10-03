import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Crosshair, BookOpen, AlertTriangle, Radar, Mail, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { headlines } from '../../data/core';
import { TECHNIQUE_BY_ID } from '../../data/reference';
import {
  actorProfiles, advisories, iocStats, sectorBrief, edrOf, taxiiOf, osintArticles, ARTICLE_CATS, ARTICLE_COLOR,
  type ActorProfile, type Article, type ArticleCat, type Advisory,
} from '../../data/modules/int';
import { Card, KpiStrip, Badge, Btn, KV, SevBadge, SectionLabel, Sources, Freshness, Bar, MiniStat } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { fmtNum, fmtCompact } from '../../lib/format';
import { WriteBack, FilterGroup, useParamFilter, RecordsDrawer } from './parts';
import './int.css';

const tone = MODULE_BY_ID.int.tone;
const INT_HEX = '#ef6aae'; // hex for canvas charts (CSS vars do not work in ECharts)
const ACT_COLOR = { High: 'var(--bad)', Medium: 'var(--sev-medium)', Low: 'var(--text-muted)' } as const;

/** Rough coverage % per technique for this customer (deterministic by id). */
function coverageFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return 35 + (hash % 60);
}

export default function IntOsint() {
  const { customer: c, tenantId } = useApp();
  const h = headlines(c, tenantId);
  const actors = useMemo(() => actorProfiles(c), [c]);
  const advs = useMemo(() => advisories(c), [c]);
  const iocs = useMemo(() => iocStats(c, tenantId), [c, tenantId]);
  const brief = useMemo(() => sectorBrief(c), [c]);
  const [sel, setSel] = useState<ActorProfile | null>(null);
  const [pushIocs, setPushIocs] = useState(false);
  const nav = useNavigate();
  const articles = useMemo(() => osintArticles(c), [c]);
  const [cat, setCat] = useParamFilter('cat');
  const [q, setQ] = useState('');
  const [art, setArt] = useState<Article | null>(null);
  const [list, setList] = useState<'actors' | 'campaigns' | null>(null);
  const shownArticles = articles.filter((a) => (cat === 'All' || a.cat === cat) && (!q.trim() || `${a.title} ${a.summary}`.toLowerCase().includes(q.trim().toLowerCase())));
  const campaigns = advs.filter((a) => a.affectsEstate);

  const edr = edrOf(c);
  const taxii = taxiiOf(c);
  const edrLabel = edr ? `${edr.vendor} ${edr.product}` : 'EDR';

  // Coverage of the actor's techniques for the radar/summary
  const selCoverage = sel ? Math.round(sel.techniques.reduce((s, t) => s + coverageFor(t), 0) / sel.techniques.length) : 0;

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · threat actors, campaigns and indicators relevant to {c.sectorLong}, fed from{' '}
        {taxii ? `${taxii.product}` : 'your TAXII feeds'} and vendor advisories into HexaMatrix and every module.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Updates', hint: 'published for you', value: articles.length, unit: `${articles.filter((a) => a.cat === 'Incident Report').length} incident report${articles.filter((a) => a.cat === 'Incident Report').length === 1 ? '' : 's'}`, to: '/int/osint?cat=Incident%20Report', source: 'HexaShield SOC · HexaInt analysts' },
          { label: 'Tracked actors', hint: 'sector-relevant', value: actors.length, toneColor: tone, onClick: () => setList('actors'), source: 'HexaInt actor library · MITRE ATT&CK' },
          { label: 'Active campaigns', hint: 'affecting you', value: campaigns.length, toneColor: 'var(--sev-high)', onClick: () => setList('campaigns'), source: `CISA KEV · ${taxii ? taxii.product : 'sector ISAC'} · vendor advisories` },
          { label: 'Indicators ingested', hint: 'STIX / TAXII', value: fmtCompact(iocs.total), toneColor: tone, to: '/int/ioc', source: taxii ? `${taxii.vendor === 'Generic' ? '' : taxii.vendor + ' '}${taxii.product}` : 'TAXII feeds' },
          { label: 'Sightings in estate', value: fmtNum(iocs.sightings), toneColor: 'var(--sev-medium)', to: '/int/ioc?signal=seen', source: 'SIEM and EDR sightings' },
          { label: 'Prioritised items', value: h.int.prioritisedItems, toneColor: tone, to: '/int/overview', source: 'HexaInt prioritisation across all sources' },
        ]}
      />

      <Card title="Security updates" count={`${shownArticles.length} of ${articles.length}`} sub="Advisories, incident write-ups, phishing notes and patch priorities from HexaShield · click to read">
        <div className="row wrap between" style={{ gap: 10, marginBottom: 12 }}>
          <FilterGroup label="Category" value={cat} options={ARTICLE_CATS} onChange={(v) => { setCat(v); setArt(null); }} counts={Object.fromEntries(ARTICLE_CATS.map((k) => [k, articles.filter((a) => a.cat === k).length]))} />
          <label className="search" style={{ flex: '0 1 240px' }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search updates…" aria-label="Search updates" />
          </label>
        </div>
        {art ? (
          <ArticleReader a={art} onBack={() => setArt(null)} onPick={setArt} more={articles.filter((x) => x.id !== art.id).slice(0, 3)} go={(to) => nav(to)} />
        ) : (
          <div className="int-articles">
            {shownArticles.map((a) => (
              <button key={a.id} className="int-art" style={{ '--tone': ARTICLE_COLOR[a.cat] } as CSSProperties} onClick={() => setArt(a)}>
                <div className="int-art-hero"><span><i>{CAT_ICON[a.cat]}</i>{a.cat}</span></div>
                <div className="int-art-body">
                  <div className="int-art-meta"><Badge color={ARTICLE_COLOR[a.cat]}>{a.cat}</Badge><span>{fmtDaysAgo(a.daysAgo)}</span><span>{a.readMin} min read</span></div>
                  <h4>{a.title}</h4>
                  <p>{a.summary}</p>
                  <span className="int-art-read">Read update →</span>
                </div>
              </button>
            ))}
            {shownArticles.length === 0 && <div className="empty">No updates match.</div>}
          </div>
        )}
      </Card>

      <Card title="Threat actor profiles" sub="Motivation, origin, target sectors and your coverage of their techniques · click a card">
        <div className="grid g3">
          {actors.map((a) => {
            const cov = Math.round(a.techniques.reduce((s, t) => s + coverageFor(t), 0) / a.techniques.length);
            return (
              <button key={a.name} className="int-actor" onClick={() => setSel(a)} style={{ '--tone': tone } as CSSProperties}>
                <div className="row between">
                  <div>
                    <h4>{a.name}</h4>
                    <div className="int-aka">{a.aka}</div>
                  </div>
                  <Badge color={ACT_COLOR[a.activity]} dot>{a.activity}</Badge>
                </div>
                <div className="card-sub">{a.origin} · {a.motivation}</div>
                <div className="chips">{a.sectors.map((s) => <span key={s} className="src-chip">{s}</span>)}</div>
                <div className="row between" style={{ fontSize: 11 }}>
                  <span className="muted">Coverage of their TTPs</span>
                  <b style={{ color: cov >= 70 ? 'var(--good)' : cov >= 50 ? 'var(--sev-medium)' : 'var(--bad)' }}>{cov}%</b>
                </div>
                <Bar value={cov} color={tone} size="thin" />
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid g-3-2">
        <Card title="Advisories feed" count={advs.length} sub="CISA KEV, sector ISAC (your TAXII connector) and vendor advisories" flush>
          <DataTable
            rows={advs}
            rowKey={(a) => a.id}
            initialSort={{ key: 'age', dir: 'asc' }}
            columns={[
              { key: 'sev', header: 'Severity', sort: (a) => ['critical', 'high', 'medium', 'low', 'info'].indexOf(a.sev), render: (a) => <SevBadge sev={a.sev} /> },
              { key: 'title', header: 'Advisory', render: (a) => (<><div className="t-main">{a.title}</div><div className="t-sub mono">{a.ref} · {a.note}</div></>) },
              { key: 'src', header: 'Source', sort: (a) => a.source, render: (a) => <Badge color={a.source === 'CISA KEV' ? 'var(--bad)' : a.source === 'Sector ISAC' ? tone : 'var(--text-muted)'}>{a.source}</Badge> },
              { key: 'est', header: 'Estate', render: (a) => a.affectsEstate ? <Badge color="var(--sev-high)" dot>Affects you</Badge> : <span className="muted">No match</span> },
              { key: 'age', header: 'Seen', align: 'right', sort: (a) => a.daysAgo, render: (a) => <span className="muted">{a.daysAgo}d ago</span> },
            ]}
          />
        </Card>

        <Card
          title="IOC feed & sightings"
          sub="STIX / TAXII indicators ingested, by type"
          actions={<Freshness minutes={taxii?.lastSyncMin ?? 25} label="TAXII" />}
          foot={<Btn sm primary color={tone} onClick={() => setPushIocs(true)}>Push IOCs to {edrLabel} blocklist</Btn>}
        >
          <Chart
            height={200}
            option={{
              grid: { left: 8, right: 16, top: 10, bottom: 6, containLabel: true },
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              legend: { data: ['Ingested', 'Sightings'], top: 0, right: 0 },
              xAxis: { type: 'value', name: 'count', axisLabel: { formatter: (v: number) => fmtCompact(v) } },
              yAxis: { type: 'category', data: iocs.byType.map((t) => t.type), inverse: true },
              series: [
                { name: 'Ingested', type: 'bar', data: iocs.byType.map((t) => t.ingested), itemStyle: { color: INT_HEX, borderRadius: [0, 3, 3, 0] }, barMaxWidth: 14 },
                { name: 'Sightings', type: 'bar', data: iocs.byType.map((t) => t.sightings), itemStyle: { color: '#f5a83d', borderRadius: [0, 3, 3, 0] }, barMaxWidth: 14 },
              ],
            }}
          />
          <div className="mini-stats" style={{ marginTop: 10 }}>
            <MiniStat value={fmtCompact(iocs.total)} label="Indicators ingested" color={tone} />
            <MiniStat value={fmtNum(iocs.sightings)} label="Matched in estate" color="var(--sev-medium)" />
            <MiniStat value={`${iocs.byType.length}`} label="Indicator types" />
          </div>
        </Card>
      </div>

      <Card title="Weekly sector brief" sub={brief.week} toneColor={tone} tinted>
        <div className="grid g2">
          {brief.items.map((it) => (
            <div key={it.heading} style={{ display: 'flex', gap: 10 }}>
              <span className="ico-box" style={{ '--tone': tone } as CSSProperties}><BookOpen /></span>
              <div>
                <b style={{ fontSize: 12.5 }}>{it.heading}</b>
                <div className="card-sub" style={{ marginTop: 2 }}>{it.body}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {sel && (
        <Drawer
          wide
          title={sel.name}
          sub={`${sel.aka} · ${sel.origin}`}
          icon={<span className="ico-box" style={{ '--tone': tone } as CSSProperties}><Crosshair /></span>}
          onClose={() => setSel(null)}
          footer={<><Btn ghost onClick={() => setSel(null)}>Close</Btn><Btn primary color={tone} onClick={() => { setSel(null); setPushIocs(true); }}>Push related IOCs</Btn></>}
        >
          <KV
            rows={[
              ['Motivation', sel.motivation],
              ['Origin', sel.origin],
              ['Activity', <Badge color={ACT_COLOR[sel.activity]} dot>{sel.activity}</Badge>],
              ['Target sectors', sel.sectors.join(' · ')],
              ['Last seen', `${sel.lastSeenDays} days ago`],
              ['Your coverage', <b style={{ color: selCoverage >= 60 ? 'var(--good)' : 'var(--sev-medium)' }}>{selCoverage}% of their techniques</b>],
            ]}
          />
          <p className="secondary" style={{ fontSize: 12.5, marginTop: 10 }}>{sel.summary}</p>
          <SectionLabel>ATT&CK techniques & your coverage</SectionLabel>
          <div className="stack" style={{ gap: 6 }}>
            {sel.techniques.map((t) => {
              const tech = TECHNIQUE_BY_ID[t];
              const cov = coverageFor(t);
              return (
                <div key={t} className="row" style={{ fontSize: 12, gap: 8 }}>
                  <span className="int-tq" style={{ minWidth: 72 }}>{t}</span>
                  <span style={{ flex: 1 }}>{tech?.name ?? t}{tech ? <span className="muted"> · {tech.matrix.toUpperCase()}</span> : null}</span>
                  <div style={{ width: 90 }}><Bar value={cov} color={cov >= 60 ? 'var(--good)' : 'var(--sev-medium)'} size="thin" /></div>
                  <span className="muted" style={{ width: 34, textAlign: 'right' }}>{cov}%</span>
                </div>
              );
            })}
          </div>
          <SectionLabel>Fed to</SectionLabel>
          <Sources items={[{ name: 'HexaMatrix (ATT&CK)' }, { name: 'HexaSOC detections' }, { name: 'HexaStrike validation' }]} />
        </Drawer>
      )}

      {list === 'actors' && (
        <RecordsDrawer<ActorProfile>
          title="Tracked threat actors"
          rows={actors}
          source={['HexaInt actor library', 'MITRE ATT&CK', 'Sector ISAC']}
          onClose={() => setList(null)}
          onRow={(a) => { setList(null); setSel(a); }}
          columns={[
            { key: 'n', header: 'Actor', render: (a) => (<><div className="t-main">{a.name}</div><div className="t-sub">{a.aka} · {a.origin}</div></>) },
            { key: 'm', header: 'Motivation', render: (a) => a.motivation },
            { key: 'a', header: 'Activity', sort: (a) => a.activity, render: (a) => <Badge color={ACT_COLOR[a.activity]} dot>{a.activity}</Badge> },
            { key: 'l', header: 'Last seen', align: 'right', sort: (a) => a.lastSeenDays, render: (a) => `${a.lastSeenDays}d ago` },
          ]}
        />
      )}
      {list === 'campaigns' && (
        <RecordsDrawer<Advisory>
          title="Active campaigns and advisories affecting you"
          rows={campaigns}
          source={['CISA KEV', taxii ? taxii.product : 'Sector ISAC', 'Vendor PSIRTs']}
          onClose={() => setList(null)}
          columns={[
            { key: 's', header: 'Severity', render: (a) => <SevBadge sev={a.sev} /> },
            { key: 't', header: 'Advisory', render: (a) => (<><div className="t-main">{a.title}</div><div className="t-sub mono">{a.ref} · {a.note}</div></>) },
            { key: 'd', header: 'Seen', align: 'right', sort: (a) => a.daysAgo, render: (a) => `${a.daysAgo}d ago` },
          ]}
        />
      )}

      {pushIocs && (
        <WriteBack
          title={`Push IOCs to ${edrLabel} blocklist`}
          sub="Write-back to your EDR / XDR"
          risk="medium"
          approvers={1}
          confirmLabel="Push indicators"
          onDone={`${fmtNum(Math.min(500, iocs.sightings))} indicators queued to ${edrLabel}; write verified on next sync.`}
          onClose={() => setPushIocs(false)}
          change={[
            ['Target', edrLabel],
            ['Indicators', `${fmtNum(Math.min(500, iocs.sightings || 120))} high-confidence (IP, domain, hash)`],
            ['TTL', '30 days, auto-expire'],
            ['Rollback', 'One-click remove from the Action Centre'],
            ['Audit', 'Recorded in the HexaCore audit ledger'],
          ]}
        />
      )}
    </>
  );
}

const CAT_ICON: Record<ArticleCat, ReactNode> = {
  'Incident Report': <AlertTriangle />, Advisory: <Radar />, Phishing: <Mail />, 'Patch Update': <ShieldCheck />,
};

function fmtDaysAgo(d: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ArticleReader({ a, onBack, onPick, more, go }: { a: Article; onBack: () => void; onPick: (a: Article) => void; more: Article[]; go: (to: string) => void }) {
  return (
    <div className="int-reader" style={{ maxWidth: 820, margin: '0 auto' }}>
      <button className="link" onClick={onBack}><ArrowLeft size={12} style={{ verticalAlign: -2 }} /> All updates</button>
      <div className="int-art-meta" style={{ marginTop: 10 }}><Badge color={ARTICLE_COLOR[a.cat]}>{a.cat}</Badge><span>{fmtDaysAgo(a.daysAgo)}</span><span>{a.readMin} min read</span></div>
      <h3 style={{ fontSize: 22, margin: '8px 0 6px', lineHeight: 1.25 }}>{a.title}</h3>
      <p style={{ fontSize: 13.5 }}>{a.summary}</p>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{a.author}</div>
      <div className="int-art-hero" style={{ '--tone': ARTICLE_COLOR[a.cat], height: 120, borderRadius: 12, margin: '14px 0' } as CSSProperties}><span><i>{CAT_ICON[a.cat]}</i>{a.cat}</span></div>
      {a.sections.map((sec) => (
        <div key={sec.heading}>
          <h5>{sec.heading}</h5>
          {sec.paras?.map((t, i) => <p key={i}>{t}</p>)}
          {sec.bullets && <ul>{sec.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
        </div>
      ))}
      {a.related && <div style={{ marginTop: 14 }}><Btn sm primary color="var(--m-int)" onClick={() => go(a.related!.to)}>{a.related.label} →</Btn></div>}
      <div className="muted" style={{ fontSize: 11.5, margin: '16px 0 6px' }}>Published by {a.author} · {fmtDaysAgo(a.daysAgo)}</div>
      <SectionLabel>More updates</SectionLabel>
      <div className="int-articles">
        {more.map((m) => (
          <button key={m.id} className="int-art" style={{ '--tone': ARTICLE_COLOR[m.cat] } as CSSProperties} onClick={() => onPick(m)}>
            <div className="int-art-body">
              <div className="int-art-meta"><Badge color={ARTICLE_COLOR[m.cat]}>{m.cat}</Badge><span>{fmtDaysAgo(m.daysAgo)}</span></div>
              <h4>{m.title}</h4>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
