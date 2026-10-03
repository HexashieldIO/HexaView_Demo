import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../../state/AppContext';
import type { CustomerProfile } from '../../../data/types';
import { signedIn } from '../../../data/modules/ops';
import {
  vrAdvisories, vrAdvisory, vrAssets, vrTally, vrSuppliers, vrDetections, vrChecks, vrBurndown, vrTimeline, vrCoverage, vrScopedVerdict,
  vrSubscribe, vrVersion,
  type VrAdvisory, type VrAsset, type VrTally, type VrSupplier, type VrDetection, type VrCheck, type VrEvent, type VrVerdict, type VrSource,
} from '../../../data/modules/vulnresponse';

export type VrSection = 'advisories' | 'exposure' | 'patch' | 'suppliers' | 'statement';
export const VR_SECTIONS: { id: VrSection; label: string }[] = [
  { id: 'advisories', label: 'Live advisories' },
  { id: 'exposure', label: 'Exposure match' },
  { id: 'patch', label: 'Patch tracker' },
  { id: 'suppliers', label: 'Supplier outreach' },
  { id: 'statement', label: 'Exposure statement' },
];

interface VrState {
  c: CustomerProfile;
  tenantId: string;
  me: string;
  version: number;
  advisories: VrAdvisory[];
  adv: VrAdvisory;
  rows: VrAsset[];
  tally: VrTally;
  verdict: VrVerdict;
  sups: VrSupplier[];
  detections: VrDetection[];
  checks: VrCheck[];
  timeline: VrEvent[];
  coverage: { source: VrSource; checked: number; unit: string; tools: string[] }[];
  burn: ReturnType<typeof vrBurndown>;
  section: VrSection;
  go: (section: VrSection, params?: Record<string, string>) => void;
  setParams: (patch: Record<string, string | null>) => void;
  pickAdvisory: (id: string, section?: VrSection) => void;
}

const Ctx = createContext<VrState | null>(null);

export function useVr(): VrState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useVr outside VrProvider');
  return v;
}

export function VrProvider({ children }: { children: ReactNode }) {
  const { customer: c, tenantId, persona } = useApp();
  const [sp, setSp] = useSearchParams();
  const version = useSyncExternalStore(vrSubscribe, vrVersion);
  const advisories = vrAdvisories(c);
  const adv = vrAdvisory(c, sp.get('adv'));
  const me = signedIn(c, persona).name;

  const data = useMemo(() => {
    const rows = vrAssets(c, tenantId, adv);
    const sups = vrSuppliers(c, tenantId, adv);
    return {
      rows,
      tally: vrTally(rows),
      verdict: vrScopedVerdict(adv, rows, tenantId),
      sups,
      detections: vrDetections(c, adv, rows),
      checks: vrChecks(adv, rows),
      timeline: vrTimeline(c, adv, rows, sups),
      coverage: vrCoverage(c, tenantId),
      burn: vrBurndown(adv, rows),
    };
    // version: re-derive when the in-session store changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, tenantId, adv, version]);

  const raw = sp.get('section') as VrSection | null;
  const section: VrSection = raw && VR_SECTIONS.some((s) => s.id === raw) ? raw : 'advisories';
  const keepAdv = (next: URLSearchParams) => { const a = sp.get('adv'); if (a) next.set('adv', a); };
  const go = (sec: VrSection, params?: Record<string, string>) => {
    const next = new URLSearchParams();
    if (sec !== 'advisories') next.set('section', sec);
    keepAdv(next);
    Object.entries(params ?? {}).forEach(([k, v]) => next.set(k, v));
    setSp(next, { replace: false });
  };
  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === 'all' ? next.delete(k) : next.set(k, v)));
    setSp(next, { replace: true });
  };
  const pickAdvisory = (id: string, sec?: VrSection) => {
    const next = new URLSearchParams();
    const s = sec ?? section;
    if (s !== 'advisories') next.set('section', s);
    if (id !== advisories[0].id) next.set('adv', id);
    setSp(next, { replace: false });
  };

  const value: VrState = { c, tenantId, me, version, advisories, adv, ...data, section, go, setParams, pickAdvisory };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
