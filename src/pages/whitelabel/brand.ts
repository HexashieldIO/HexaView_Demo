import { useSyncExternalStore } from 'react';

// Partner brand settings shared by the three White Label tabs for the session
// (live preview only; nothing is saved).

export interface Brand {
  productName: string;
  logoText: string;
  logoShape: 'square' | 'wide';
  logoImage: string | null;
  primary: string;
  sidebar: string;
  accent: string;
  mode: 'dark' | 'light';
  serviceNames: boolean;
  poweredBy: boolean;
  font: 'Inter' | 'Space Grotesk' | 'System';
  domain: string;
  supportEmail: string;
  loginHeadline: string;
  loginSub: string;
  loginArt: 'gradient' | 'solid' | 'grid';
  /** Identity providers offered as buttons on the client sign-in page. */
  loginSso: string[];
}

export const DEFAULT_BRAND: Brand = {
  productName: 'Northwind Shield',
  logoText: 'NW',
  logoShape: 'square',
  logoImage: null,
  primary: '#0369a1',
  sidebar: '#0b1324',
  accent: '#f59e0b',
  mode: 'dark',
  serviceNames: true,
  poweredBy: true,
  font: 'Inter',
  domain: 'portal.northwindcyber.com',
  supportEmail: 'soc@northwindcyber.com',
  loginHeadline: 'Your security, one view.',
  loginSub: 'Managed detection, compliance and OT security from Northwind Cyber Partners.',
  loginArt: 'gradient',
  loginSso: ['Microsoft Entra ID', 'Okta'],
};

export const PRESETS: { name: string; primary: string; sidebar: string; accent: string }[] = [
  { name: 'Northwind', primary: '#0369a1', sidebar: '#0b1324', accent: '#f59e0b' },
  { name: 'HexaShield', primary: '#2563eb', sidebar: '#050a18', accent: '#22d3ee' },
  { name: 'Forest', primary: '#16a34a', sidebar: '#0c1a12', accent: '#facc15' },
  { name: 'Crimson', primary: '#dc2626', sidebar: '#160b0d', accent: '#fb923c' },
  { name: 'Violet', primary: '#7c3aed', sidebar: '#120d24', accent: '#2dd4bf' },
  { name: 'Graphite', primary: '#475569', sidebar: '#0f1115', accent: '#38bdf8' },
];

// The draft starts from the published brand when there is one.
let state: Brand = (() => {
  try { return { ...DEFAULT_BRAND, ...(JSON.parse(localStorage.getItem('hv.brand.published') ?? 'null') ?? {}) } as Brand; } catch { return { ...DEFAULT_BRAND }; }
})();
const subs = new Set<() => void>();
export function setBrand(patch: Partial<Brand>) {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
}
export function resetBrand() {
  setBrand({ ...DEFAULT_BRAND });
}
export function useBrand(): Brand {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
}

/** WCAG contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    const rgb = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Partner service names used when "use your own service names" is on. */
export function serviceName(product: string, brand: Brand): string {
  if (!brand.serviceNames) return product;
  const short = brand.productName.split(' ')[0];
  const map: Record<string, string> = {
    HexaSOC: `${short} MDR`,
    HexaInt: `${short} Threat Intel`,
    HexaStrike: `${short} Offensive`,
    HexaOT: `${short} OT Watch`,
    HexaComply: `${short} Compliance`,
    HexaCustody: `${short} Custody`,
  };
  return map[product] ?? product;
}

// Published theme: what the console itself shows (logo top-left, sign-in). Editing
// the draft above does not change the console until it is published again.
const PUB_KEY = 'hv.brand.published';
let published: Brand | null = (() => {
  try { return JSON.parse(localStorage.getItem(PUB_KEY) ?? 'null') as Brand | null; } catch { return null; }
})();
const pubSubs = new Set<() => void>();
function emitPublished(next: Brand | null) {
  published = next;
  try {
    if (next) localStorage.setItem(PUB_KEY, JSON.stringify(next));
    else localStorage.removeItem(PUB_KEY);
  } catch { /* storage full or unavailable: keep it for this session only */ }
  pubSubs.forEach((f) => f());
}
const VER_KEY = 'hv.brand.version';
let version = (() => { try { return Number(localStorage.getItem(VER_KEY)) || 7; } catch { return 7; } })();
let publishedAt: number | null = null;
/** Published theme version (v7 was live before this session). */
export function brandVersion() { return version; }
export function brandPublishedAt() { return publishedAt; }
/** Publish the current draft: the console now shows this brand instead of HexaView. Returns the new version. */
export function publishBrand() {
  version += 1;
  publishedAt = Date.now();
  try { localStorage.setItem(VER_KEY, String(version)); } catch { /* session only */ }
  emitPublished({ ...state });
  return version;
}
/** What the draft is compared against: the last published brand, else the v7 defaults. */
export function brandBaseline(): Brand { return { ...DEFAULT_BRAND, ...(published ?? {}) }; }
const FIELD_LABEL: Partial<Record<keyof Brand, string>> = {
  productName: 'Software name', logoText: 'Monogram', logoShape: 'Logo shape', logoImage: 'Logo', primary: 'Primary colour', sidebar: 'Side menu colour', accent: 'Accent colour',
  mode: 'Default theme', serviceNames: 'Service names', poweredBy: 'Powered by HexaShield', font: 'Typeface', domain: 'Portal domain', supportEmail: 'Support address',
  loginHeadline: 'Sign-in headline', loginSub: 'Sign-in sub-heading', loginArt: 'Sign-in background', loginSso: 'Sign-in buttons',
};
/** Draft fields that differ from what is published. */
export function brandChanges(draft: Brand): { key: keyof Brand; label: string }[] {
  const base = brandBaseline();
  return (Object.keys(DEFAULT_BRAND) as (keyof Brand)[])
    .filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(base[k]))
    .map((k) => ({ key: k, label: FIELD_LABEL[k] ?? k }));
}
/** Throw away unpublished edits. */
export function discardDraft() { setBrand(brandBaseline()); }
/** Go back to the HexaView brand in the console. */
export function revertToHexaView() { emitPublished(null); }
export function usePublishedBrand(): Brand | null {
  return useSyncExternalStore(
    (f) => { pubSubs.add(f); return () => pubSubs.delete(f); },
    () => published,
  );
}
