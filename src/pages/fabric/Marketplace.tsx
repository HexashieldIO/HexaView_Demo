import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Sparkles, X, ArrowRight, PlusCircle, Store, CheckCircle2, Clock, Send } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import type { Env } from '../../data/types';
import {
  MKT_CATEGORIES, POWERS, POWER_COLOR, frameworkHits, sectorsOf,
  type Gap, type Listing, type MktCategory, type Power,
} from '../../data/modules/marketplace';
import { ENV_LABEL } from '../../data/modules/fabric';
import { Card, KpiStrip, Badge, Btn, Chip, BarRow } from '../../components/ui';
import { scrollToId } from '../insurance/viz';
import { fmtAgo } from '../../lib/format';
import { TONE, toneStyle } from './parts';
import { ListingCard, Monogram, useMarketView, fmtSetup } from './marketplace/parts';
import { ListingDrawer, defaultPlane } from './marketplace/ListingDrawer';
import { InstallFlow, RequestModal } from './marketplace/InstallFlow';
import './fabric.css';
import './marketplace/marketplace.css';

type InstState = 'all' | 'yes' | 'no';
type Sort = 'popular' | 'rating' | 'name' | 'setup' | 'updated';
const ENVS: Env[] = ['cloud', 'saas', 'onprem', 'ot'];
const SEV_C = { high: 'var(--sev-high)', medium: 'var(--sev-medium)', low: 'var(--sev-low)' } as const;

export default function FabricMarketplace() {
  const { customer: c, tenantId } = useApp();
  const nav = useNavigate();
  const v = useMarketView(c);
  const [params, setParams] = useSearchParams();

  const [q, setQ] = useState('');
  const [cat, setCat] = useState<MktCategory | 'all'>('all');
  const [env, setEnv] = useState<Env | 'all'>('all');
  const [inst, setInst] = useState<InstState>('all');
  const [writeOnly, setWriteOnly] = useState(false);
  const [certOnly, setCertOnly] = useState(false);
  const [recOnly, setRecOnly] = useState(false);
  const [power, setPower] = useState<Power | 'all'>('all');
  const [sort, setSort] = useState<Sort>('popular');
  const [openId, setOpenId] = useState<string | null>(null);
  const [install, setInstall] = useState<{ l: Listing; plane: string } | null>(null);
  const [request, setRequest] = useState<string | null>(null);

  // Pivots: /fabric/marketplace?q=…&cat=…&installed=yes&filter=writeback|certified|recommended&listing=id
  useEffect(() => {
    const pq = params.get('q');
    const pc = params.get('cat');
    const pi = params.get('installed');
    const pf = params.get('filter');
    const pl = params.get('listing');
    if (pq) setQ(pq);
    if (pc && (MKT_CATEGORIES as string[]).includes(pc)) setCat(pc as MktCategory);
    if (pi === 'yes' || pi === 'no') setInst(pi);
    if (pf === 'writeback') setWriteOnly(true);
    if (pf === 'certified') setCertOnly(true);
    if (pf === 'recommended') setRecOnly(true);
    if (pl) setOpenId(pl);
    if (pq || pc || pi || pf) scrollToId('mkt-browse');
  }, [params]);

  // Close overlays when the customer changes (not on first mount, so ?listing= deep links open).
  const prevC = useRef(c);
  useEffect(() => { if (prevC.current !== c) { prevC.current = c; setOpenId(null); setInstall(null); } }, [c]);

  const reset = () => {
    setQ(''); setCat('all'); setEnv('all'); setInst('all'); setWriteOnly(false); setCertOnly(false); setRecOnly(false); setPower('all');
    if ([...params.keys()].length) setParams({}, { replace: true });
  };
  const pivot = (fn: () => void) => { reset(); fn(); scrollToId('mkt-browse'); };

  const recIds = useMemo(() => new Set(v.gaps.flatMap((g) => g.candidates)), [v.gaps]);
  const sectors = useMemo(() => sectorsOf(c), [c]);

  const textMatch = (l: Listing, s: string) =>
    `${l.name} ${l.vendor} ${l.category} ${l.read.join(' ')} ${l.frameworks.join(' ')} ${l.powers.join(' ')} ${l.envs.map((e) => ENV_LABEL[e]).join(' ')}`.toLowerCase().includes(s);

  // Every filter except category (so the rail shows counts for the current slice).
  const sliced = useMemo(() => {
    const s = q.trim().toLowerCase();
    return v.listings.filter((l) => {
      if (s && !s.split(/\s+/).every((t) => textMatch(l, t))) return false;
      if (env !== 'all' && !l.envs.includes(env)) return false;
      if (writeOnly && !l.write.length) return false;
      if (certOnly && l.cert !== 'HexaView-certified') return false;
      if (recOnly && !recIds.has(l.id)) return false;
      if (power !== 'all' && !l.powers.includes(power)) return false;
      const on = v.installedIds.has(l.id);
      if (inst === 'yes' && !on) return false;
      if (inst === 'no' && on) return false;
      return true;
    });
  }, [v, q, env, writeOnly, certOnly, recOnly, power, inst, recIds]);

  const shown = useMemo(() => {
    const out = sliced.filter((l) => cat === 'all' || l.category === cat);
    const rel = (l: Listing) => (l.sectors.some((x) => sectors.includes(x)) ? 30 : 0) + (recIds.has(l.id) ? 40 : 0);
    const by: Record<Sort, (a: Listing, b: Listing) => number> = {
      popular: (a, b) => (b.popularity + rel(b)) - (a.popularity + rel(a)),
      rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
      name: (a, b) => a.name.localeCompare(b.name),
      setup: (a, b) => a.setupMin - b.setupMin,
      updated: (a, b) => a.updatedDays - b.updatedDays,
    };
    return out.sort(by[sort]);
  }, [sliced, cat, sort, sectors, recIds]);

  const catCounts = useMemo(() => {
    const m = new Map<MktCategory, number>();
    for (const l of sliced) m.set(l.category, (m.get(l.category) ?? 0) + 1);
    return m;
  }, [sliced]);

  const total = v.listings.length;
  const installedN = v.listings.filter((l) => v.installedIds.has(l.id)).length;
  const writeN = v.listings.filter((l) => l.write.length).length;
  const certN = v.listings.filter((l) => l.cert === 'HexaView-certified').length;
  const vendors = new Set(v.listings.filter((l) => l.vendor !== 'Generic').map((l) => l.vendor)).size;
  const loopsOpen = v.gaps.reduce((s, g) => s + g.loops, 0);
  const open = openId ? v.byId.get(openId) ?? null : null;
  const filterSig = `${q}|${cat}|${env}|${inst}|${writeOnly}|${certOnly}|${recOnly}|${power}|${sort}|${c.id}`;
  const anyFilter = q || cat !== 'all' || env !== 'all' || inst !== 'all' || writeOnly || certOnly || recOnly || power !== 'all';

  const suggestions = useMemo(() => {
    const base = ['CrowdStrike', 'OT sensor', 'DORA', 'Backup', 'Write-back'];
    if (sectors.includes('health')) return ['Medical devices', 'Epic', 'HIPAA', ...base.slice(0, 3)];
    if (sectors.includes('media')) return ['Aspera', 'Watermark', 'TPN', ...base.slice(0, 3)];
    if (sectors.includes('auto')) return ['Vehicle SOC', 'TISAX', 'Siemens', ...base.slice(0, 3)];
    if (sectors.includes('maritime')) return ['Vessel', 'IEC 62443', 'BAS', ...base.slice(0, 3)];
    if (sectors.includes('defence')) return ['CMMC', 'GCC High', 'Air-gapped', ...base.slice(0, 3)];
    if (sectors.includes('pharma')) return ['GxP', 'Veeva', 'LIMS', ...base.slice(0, 3)];
    if (sectors.includes('finance') || sectors.includes('insurance')) return ['SWIFT', 'DORA', 'Pentera', ...base.slice(0, 3)];
    return base;
  }, [sectors]);

  const powerCov = POWERS.map((p) => {
    const all = v.listings.filter((l) => l.powers.includes(p));
    return { p, total: all.length, on: all.filter((l) => v.installedIds.has(l.id)).length };
  });

  const startInstall = (l: Listing, plane?: string) => { setOpenId(null); setInstall({ l, plane: plane ?? defaultPlane(c.dataPlanes, l)?.id ?? '' }); };

  return (
    <div style={toneStyle()} className="mkt">
      <p className="page-intro">
        <b>{c.name}</b> · {tenantId === 'all' ? 'group' : c.tenants.find((t) => t.id === tenantId)?.short} view. Browse {total} integrations from {vendors} vendors, evaluate exactly what each reads and writes, and install onto your own data planes. {installedN} already feed HexaCore for {c.short}; gap analysis against your {Object.values(c.services).filter((s) => s !== 'available').length} active services and {c.frameworks.length} frameworks recommends {v.gaps.length} more.
      </p>

      <KpiStrip
        toneColor={TONE}
        items={[
          { label: 'Catalogue', value: total, hint: `${vendors} vendors`, bar: 100, onClick: () => pivot(() => undefined), source: 'HexaCore Marketplace catalogue · public and private listings' },
          { label: `Installed for ${c.short}`, value: installedN, unit: `/ ${total}`, bar: (installedN / Math.max(1, total)) * 100, toneColor: 'var(--good)', delta: v.installs.length ? { text: `+${v.installs.length} this session`, good: true } : undefined, onClick: () => pivot(() => setInst('yes')), source: `Matched against ${c.connectors.length} connectors in the HexaCore connector registry` },
          { label: 'Write-back capable', value: writeN, hint: 'gated', toneColor: 'var(--sev-medium)', onClick: () => pivot(() => setWriteOnly(true)), source: 'Connector manifests · Action Centre policy (LLD 8.2)' },
          { label: 'Recommended gaps', value: v.gaps.length, delta: v.gaps.length ? { text: `≈ ${loopsOpen} loops blocked`, good: false } : { text: 'no gaps', good: true }, toneColor: v.gaps.length ? 'var(--sev-high)' : 'var(--good)', onClick: () => scrollToId('mkt-rec'), source: 'Gap analysis: active services × frameworks × installed connectors' },
          { label: 'HexaView-certified', value: certN, unit: `/ ${total}`, onClick: () => pivot(() => setCertOnly(true)), source: 'HexaShield certification programme · nightly contract tests' },
        ]}
      />

      {/* Hero search */}
      <section className="mkt-hero">
        <div className="mkt-hero-text">
          <h2><Store size={20} /> Integrations Marketplace</h2>
          <p>Every connector runs on your data plane, maps to OCSF and is least-privilege by default. Write-back is always gated.</p>
        </div>
        <label className="mkt-hero-search">
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${total} integrations, data types or frameworks…`} aria-label="Search the Marketplace" />
          {q && <button onClick={() => setQ('')} aria-label="Clear search"><X size={15} /></button>}
        </label>
        <div className="mkt-hero-sugg">
          <span>Try</span>
          {[...new Set(suggestions)].map((s) => <button key={s} onClick={() => { setQ(s); scrollToId('mkt-browse'); }}>{s}</button>)}
        </div>
      </section>

      {/* Recommended for you */}
      <Card
        title={<span id="mkt-rec"><Sparkles size={15} style={{ verticalAlign: -2, color: 'var(--m-core)' }} /> Recommended for {c.short}</span>}
        sub="Gaps between your connectors and what your active services and frameworks need · impact is loops that can close and data completeness gained"
        count={v.gaps.length}
        actions={v.gaps.length ? <Btn sm onClick={() => pivot(() => setRecOnly(true))}>Show all recommended <ArrowRight size={13} /></Btn> : undefined}
      >
        {v.gaps.length === 0 ? (
          <div className="empty"><CheckCircle2 size={16} /> No coverage gaps: every active service and framework has the data it needs.</div>
        ) : (
          <div className="mkt-gaps">
            {v.gaps.slice(0, 8).map((g, i) => <GapCard key={g.id} g={g} i={i} v={v} onOpen={setOpenId} onInstall={(l) => startInstall(l)} />)}
          </div>
        )}
        {v.gaps.length > 8 && <div className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>+{v.gaps.length - 8} more gaps · use “Show all recommended”.</div>}
      </Card>

      {/* Browse */}
      <div className="mkt-browse" id="mkt-browse">
        <nav className="mkt-rail" aria-label="Categories">
          <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}><span>All categories</span><em>{sliced.length}</em></button>
          {MKT_CATEGORIES.filter((k) => (catCounts.get(k) ?? 0) > 0 || k === cat).map((k) => (
            <button key={k} className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>
              <span>{k}</span><em>{catCounts.get(k) ?? 0}</em>
            </button>
          ))}
        </nav>

        <div className="mkt-main">
          <div className="mkt-filters">
            <div className="chips">
              <Chip on={env === 'all'} onClick={() => setEnv('all')} color={TONE}>All envs</Chip>
              {ENVS.map((e) => <Chip key={e} on={env === e} onClick={() => setEnv(e)} color={TONE}>{ENV_LABEL[e]}</Chip>)}
            </div>
            <span className="mkt-sep" />
            <div className="chips">
              <Chip on={writeOnly} onClick={() => setWriteOnly((x) => !x)} color={TONE}>Write-back</Chip>
              <Chip on={certOnly} onClick={() => setCertOnly((x) => !x)} color={TONE}>Certified</Chip>
              <Chip on={recOnly} onClick={() => setRecOnly((x) => !x)} color={TONE}><Sparkles size={11} style={{ verticalAlign: -1 }} /> Recommended</Chip>
            </div>
            <span className="mkt-sep" />
            <div className="mkt-seg" role="group" aria-label="Install state">
              {(['all', 'yes', 'no'] as InstState[]).map((s) => (
                <button key={s} className={inst === s ? 'on' : ''} onClick={() => setInst(s)}>{s === 'all' ? 'All' : s === 'yes' ? 'Installed' : 'Not installed'}</button>
              ))}
            </div>
            <label className="mkt-sort">
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="popular">Most relevant</option>
                <option value="rating">Top rated</option>
                <option value="name">Name A–Z</option>
                <option value="setup">Fastest setup</option>
                <option value="updated">Recently updated</option>
              </select>
            </label>
          </div>

          <div className="mkt-results-head">
            <span><b>{shown.length}</b> {shown.length === 1 ? 'integration' : 'integrations'}{cat !== 'all' ? ` in ${cat}` : ''}{power !== 'all' ? ` powering ${power}` : ''}</span>
            {anyFilter && <button className="mkt-clear" onClick={reset}><X size={12} /> Clear filters</button>}
          </div>

          {shown.length === 0 ? (
            <div className="mkt-none">
              <p>No integration matches{q ? <> “<b>{q}</b>”</> : ' these filters'}.</p>
              <Btn primary color={TONE} onClick={() => setRequest(q || '')}><PlusCircle size={14} /> Request {q ? `“${q}”` : 'an integration'}</Btn>
            </div>
          ) : (
            <div className="mkt-grid" key={filterSig}>
              {shown.map((l, i) => (
                <ListingCard key={l.id} l={l} index={i} installed={v.installedIds.has(l.id)} session={v.sessionIds.has(l.id)} gaps={v.gapsFor.get(l.id)} onOpen={() => setOpenId(l.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid g-3-2" style={{ marginTop: 16 }}>
        <Card title="What your integrations power" sub="Installed vs available connectors per HexaShield capability · click to browse">
          {powerCov.map(({ p, total: t, on }) => (
            <button key={p} className="mkt-barbtn" onClick={() => pivot(() => setPower(p))} title={`Source: HexaCore connector registry × catalogue · click to filter ${p}`}>
              <BarRow label={p} sub={`${on} installed of ${t} available`} value={on} max={Math.max(1, Math.min(t, 24))} color={POWER_COLOR[p]} display={on} />
            </button>
          ))}
        </Card>

        <div className="stack">
          <Card title="Can't find a tool?" sub="Request a certified connector, or connect it today through a standards connector">
            <div className="row wrap" style={{ gap: 8 }}>
              <Btn primary color={TONE} onClick={() => setRequest('')}><Send size={13} /> Request integration</Btn>
              <Btn onClick={() => pivot(() => setCat('Standards'))}>Browse standards connectors</Btn>
            </div>
            {v.requests.length > 0 && (
              <div className="list" style={{ marginTop: 10 }}>
                {v.requests.map((r) => (
                  <div key={r.at} className="list-row">
                    <Clock size={14} style={{ color: 'var(--sev-medium)' }} />
                    <span className="list-main"><b>{r.vendor}{r.name !== r.vendor ? ` ${r.name}` : ''}</b><span>{r.useCase || 'No use case given'} · requested {fmtAgo(Math.max(0, Math.round((Date.now() - r.at) / 60000)))}</span></span>
                    <Badge color="var(--sev-medium)">In review</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="Installed this session" sub="Demo installs; they also appear as installed across the catalogue">
            {v.installs.length === 0 ? <div className="empty" style={{ padding: 14 }}>Nothing installed yet. Pick a recommendation above to try the install flow.</div> : (
              <div className="list">
                {v.installs.map((i) => {
                  const l = v.byId.get(i.listingId);
                  return (
                    <button key={i.listingId} className="list-row" onClick={() => setOpenId(i.listingId)}>
                      {l && <Monogram l={l} size={26} />}
                      <span className="list-main"><b>{i.name}</b><span>{i.tenants === 'all' ? 'All tenants' : `${i.tenants.length} tenant${i.tenants.length > 1 ? 's' : ''}`} · {c.dataPlanes.find((d) => d.id === i.dataPlaneId)?.name ?? i.dataPlaneId}{i.writeBack ? ' · write-back on' : ''}</span></span>
                      <Badge color="var(--good)" dot>Connected</Badge>
                    </button>
                  );
                })}
                <Btn sm onClick={() => nav('/fabric/integrations')}>Open Integrations <ArrowRight size={13} /></Btn>
              </div>
            )}
          </Card>
        </div>
      </div>

      {open && (
        <ListingDrawer
          key={open.id}
          l={open}
          installed={v.installedIds.has(open.id)}
          session={v.sessionIds.has(open.id)}
          matchedIds={v.matched.get(open.id) ?? []}
          gaps={v.gapsFor.get(open.id) ?? []}
          onClose={() => { setOpenId(null); if (params.get('listing')) { params.delete('listing'); setParams(params, { replace: true }); } }}
          onInstall={(plane) => startInstall(open, plane)}
        />
      )}
      {install && <InstallFlow l={install.l} planeId={install.plane} onClose={() => setInstall(null)} />}
      {request !== null && <RequestModal initial={request} onClose={() => setRequest(null)} />}
    </div>
  );
}

function GapCard({ g, i, v, onOpen, onInstall }: { g: Gap; i: number; v: ReturnType<typeof useMarketView>; onOpen: (id: string) => void; onInstall: (l: Listing) => void }) {
  const { customer: c } = useApp();
  const cands = g.candidates.map((id) => v.byId.get(id)).filter((x): x is Listing => !!x);
  const top = cands[0];
  return (
    <div className="mkt-gap" style={{ '--sev': SEV_C[g.severity], animationDelay: `${i * 50}ms` } as CSSProperties}>
      <div className="mkt-gap-head">
        <Badge color={SEV_C[g.severity]}>{g.severity}</Badge>
        <b>{g.title}</b>
      </div>
      <p>{g.why}</p>
      <div className="mkt-gap-cons">{g.consequence}</div>
      <div className="mkt-gap-impact">
        <span><b>{g.loops}</b> loops can close</span>
        <span><b>+{g.completeness}</b> pts data completeness</span>
      </div>
      {g.drivers.length > 0 && <div className="mkt-gap-drv">{[...new Set(g.drivers)].slice(0, 3).map((d) => <span key={d}>{d}</span>)}</div>}
      <div className="mkt-gap-cands">
        {cands.map((l) => (
          <button key={l.id} onClick={() => onOpen(l.id)} title={`${l.name} · ${l.cert} · setup ${fmtSetup(l.setupMin)}${frameworkHits(c, l).length ? ` · evidences ${frameworkHits(c, l).join(', ')}` : ''}`}>
            <Monogram l={l} size={24} /> <span>{l.name}</span>
          </button>
        ))}
      </div>
      {top && <Btn sm primary color={TONE} onClick={() => onInstall(top)}>Install {top.name.length > 22 ? top.vendor : top.name}</Btn>}
    </div>
  );
}
