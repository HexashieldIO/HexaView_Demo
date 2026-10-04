import { useMemo, type CSSProperties } from 'react';
import { BadgeCheck, Handshake, Users, Star, PenLine, Sparkles, Clock } from 'lucide-react';
import type { CustomerProfile } from '../../../data/types';
import {
  catalogueFor, computeGaps, POWER_COLOR, CERT_COLOR,
  type Cert, type CoverageItem, type Gap, type Listing,
} from '../../../data/modules/marketplace';
import { ENV_HEX, ENV_LABEL } from '../../../data/modules/fabric';
import { Badge } from '../../../components/ui';
import { fmtCompact } from '../../../lib/format';
import { useMarketplace, type InstallRecord, type RequestRecord } from './store';

/* ---------------- shared view model ---------------- */

export interface MarketView {
  listings: Listing[];
  byId: Map<string, Listing>;
  /** Listing ids installed: matched from c.connectors or installed this session. */
  installedIds: Set<string>;
  /** Listing id → names of the customer's connectors it matched. */
  matched: Map<string, string[]>;
  sessionIds: Set<string>;
  installs: InstallRecord[];
  requests: RequestRecord[];
  gaps: Gap[];
  /** Listing id → gaps it would close. */
  gapsFor: Map<string, Gap[]>;
}

export function useMarketView(c: CustomerProfile): MarketView {
  const { installs, requests } = useMarketplace(c);
  const cat = useMemo(() => catalogueFor(c), [c]);
  return useMemo(() => {
    const byId = new Map(cat.listings.map((l) => [l.id, l]));
    const sessionIds = new Set(installs.map((i) => i.listingId));
    const installedIds = new Set([...cat.installed.keys(), ...sessionIds]);
    const matched = new Map([...cat.installed].map(([id, ks]) => [id, ks.map((k) => k.id)]));
    const cov: CoverageItem[] = [
      ...c.connectors,
      ...installs.flatMap((i) => {
        const l = byId.get(i.listingId);
        return l ? [{ vendor: l.vendor, product: l.product, category: l.connCategory, env: l.envs[0], tenants: i.tenants }] : [];
      }),
    ];
    const gaps = computeGaps(c, cov, installedIds);
    const gapsFor = new Map<string, Gap[]>();
    for (const g of gaps) for (const id of g.candidates) gapsFor.set(id, [...(gapsFor.get(id) ?? []), g]);
    return { listings: cat.listings, byId, installedIds, matched, sessionIds, installs, requests, gaps, gapsFor };
  }, [c, cat, installs, requests]);
}

/* ---------------- monogram tile (no external logos) ---------------- */

const MONO_HEX = ['#3fd0f0', '#a07cfb', '#ef6aae', '#f8646f', '#f7a04a', '#93d65a', '#ecc873', '#68b1ff', '#8f8cff', '#2dd4bf', '#f5a83d', '#4f8cff'];
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
export function monogramText(l: Pick<Listing, 'vendor' | 'product'>): string {
  const src = l.vendor === 'Generic' || l.vendor === 'HexaShield' ? l.product : l.vendor;
  const words = src.replace(/[^A-Za-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const w = words[0];
    const caps = w.match(/[A-Z0-9]/g);
    return caps && caps.length >= 2 ? caps.slice(0, 2).join('') : w.slice(0, 2).replace(/^./, (x) => x.toUpperCase());
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}
export function Monogram({ l, size = 40 }: { l: Pick<Listing, 'vendor' | 'product'>; size?: number }) {
  const col = l.vendor === 'HexaShield' ? '#3fd0f0' : MONO_HEX[hash(l.vendor) % MONO_HEX.length];
  return (
    <span className="mkt-mono" style={{ width: size, height: size, fontSize: size * 0.36, color: col, background: `linear-gradient(140deg, ${col}2e, ${col}0d)`, borderColor: `${col}5c` } as CSSProperties}>
      {monogramText(l)}
    </span>
  );
}

/* ---------------- badges ---------------- */

const CERT_ICON: Record<Cert, typeof BadgeCheck> = { 'HexaView-certified': BadgeCheck, 'Partner-built': Handshake, Community: Users };
export function CertBadge({ cert, short }: { cert: Cert; short?: boolean }) {
  const I = CERT_ICON[cert];
  return (
    <span className="mkt-cert" style={{ '--c': CERT_COLOR[cert] } as CSSProperties} title={cert === 'HexaView-certified' ? 'Built and contract-tested by HexaShield' : cert === 'Partner-built' ? 'Built by the vendor, reviewed by HexaShield' : 'Community-maintained manifest'}>
      <I size={12} /> {short ? cert.split(/[- ]/)[0].replace('HexaView', 'Certified') : cert}
    </span>
  );
}
export function Stars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span className="mkt-stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={value >= i - 0.25 ? '#f0a338' : 'none'} stroke={value >= i - 0.75 ? '#f0a338' : 'var(--text-muted)'} />
      ))}
    </span>
  );
}
export function PowerDots({ l }: { l: Listing }) {
  return (
    <span className="mkt-powers">
      {l.powers.map((p) => <i key={p} title={`Powers ${p}`} style={{ background: POWER_COLOR[p] }} />)}
    </span>
  );
}
export function EnvTags({ l }: { l: Listing }) {
  return (
    <span className="mkt-envs">
      {l.envs.map((e) => <span key={e} style={{ color: ENV_HEX[e], borderColor: `${ENV_HEX[e]}55` }}>{ENV_LABEL[e]}</span>)}
    </span>
  );
}

/* ---------------- listing card ---------------- */

export function ListingCard({ l, installed, session, gaps, index, onOpen }: { l: Listing; installed: boolean; session: boolean; gaps?: Gap[]; index: number; onOpen: () => void }) {
  return (
    <button className={`mkt-card ${installed ? 'on' : ''} ${gaps?.length && !installed ? 'rec' : ''}`} onClick={onOpen} style={{ animationDelay: `${Math.min(index, 24) * 22}ms` }}>
      <div className="mkt-card-top">
        <Monogram l={l} />
        <div className="mkt-card-id">
          <b>{l.name}</b>
          <span>{l.vendor === 'Generic' ? 'Standards-native' : l.vendor} · {l.category}</span>
        </div>
        {installed ? (
          <Badge color="var(--good)" dot>{session ? 'Connected' : 'Installed'}</Badge>
        ) : gaps?.length ? (
          <Badge color="var(--m-core)"><Sparkles size={11} /> For you</Badge>
        ) : null}
      </div>
      <p className="mkt-card-blurb">{l.blurb}</p>
      <div className="mkt-card-tags">
        <EnvTags l={l} />
        {l.write.length ? <span className="fab-cap gated"><PenLine size={10} style={{ verticalAlign: -1 }} /> WRITE · GATED</span> : <span className="fab-cap ro">READ-ONLY</span>}
      </div>
      <div className="mkt-card-foot">
        <CertBadge cert={l.cert} short />
        {l.custom ? <span className="muted">Private</span> : <span className="mkt-rate"><Star size={11} fill="#f0a338" stroke="#f0a338" /> {l.rating.toFixed(1)} <em>· {fmtCompact(l.installs)} orgs</em></span>}
        <span className="mkt-setup"><Clock size={11} /> {l.setupMin < 60 ? `${l.setupMin} min` : `${Math.round(l.setupMin / 6) / 10} h`}</span>
        <PowerDots l={l} />
      </div>
    </button>
  );
}

export function fmtSetup(min: number): string {
  return min < 60 ? `${min} min` : `${Math.round(min / 6) / 10} h`;
}
