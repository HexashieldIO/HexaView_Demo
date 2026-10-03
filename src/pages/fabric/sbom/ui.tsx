import type { CSSProperties, ReactNode } from 'react';
import type { CustomerProfile, Severity } from '../../../data/types';
import type { SbData, SbAdvExposure, SbProduct, SbVex, SbLicRisk, SbRequest } from '../../../data/modules/sbom';
import { SB_VEX, SB_VEX_COLOR, SB_VEX_HEX, SB_LIC_COLOR, SB_REQ_COLOR } from '../../../data/modules/sbom';
import { SEV_VAR } from '../parts';

type TC = CSSProperties & { '--tc'?: string };

export type SbSection = 'overview' | 'products' | 'components' | 'graph' | 'hidden';
export const SB_SECTIONS: { id: SbSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'products', label: 'Products & SBOMs' },
  { id: 'components', label: 'Components' },
  { id: 'graph', label: 'Dependency graph' },
  { id: 'hidden', label: 'Hidden exposure' },
];

/** Everything a section needs, passed down from the page. */
export interface SbCtx {
  c: CustomerProfile;
  tenantId: string;
  d: SbData;
  exp: SbAdvExposure | null;
  sp: URLSearchParams;
  go: (section: SbSection, params?: Record<string, string>) => void;
  setParams: (patch: Record<string, string | null>) => void;
  openComp: (id: string) => void;
  openProduct: (id: string) => void;
  requestSbom: (p: SbProduct) => void;
  tenantShort: (id: string) => string;
}

export function Pill({ color, children, title, solid }: { color: string; children: ReactNode; title?: string; solid?: boolean }) {
  return <span className={`sb-pill ${solid ? 'solid' : ''}`} style={{ '--tc': color } as TC} title={title}>{children}</span>;
}
export const VexPill = ({ s }: { s: SbVex }) => <Pill color={SB_VEX_COLOR[s]} title="VEX status from the product's supplier or your own triage">{s}</Pill>;
export const LicPill = ({ r, licence }: { r: SbLicRisk; licence?: string }) => <Pill color={SB_LIC_COLOR[r]} title={licence}>{licence ?? r}</Pill>;
export const ReqPill = ({ r, days }: { r: SbRequest; days: number | null }) => (
  <Pill color={SB_REQ_COLOR[r]}>{r}{days !== null && r !== 'Not requested' ? ` · ${days ? `${days} d ago` : 'today'}` : ''}</Pill>
);
export const SevPill = ({ sev }: { sev: Severity }) => <Pill color={SEV_VAR[sev]}>{sev[0].toUpperCase() + sev.slice(1)}</Pill>;

export function VexBar({ vex }: { vex: Record<SbVex, number> }) {
  const tot = SB_VEX.reduce((s, k) => s + vex[k], 0);
  if (!tot) return <span className="sb-muted" style={{ fontSize: 11 }}>No known vulns</span>;
  return (
    <span className="sb-row" style={{ gap: 6, flexWrap: 'nowrap' }} title={SB_VEX.filter((k) => vex[k]).map((k) => `${k}: ${vex[k]}`).join(' · ')}>
      <span className="sb-vexbar">{SB_VEX.filter((k) => vex[k]).map((k) => <i key={k} style={{ flexGrow: vex[k], background: SB_VEX_HEX[k] }} />)}</span>
      <span style={{ fontSize: 11, color: vex.Affected ? 'var(--sev-critical)' : 'var(--text-muted)', fontWeight: 600 }}>{vex.Affected ? `${vex.Affected} affected` : vex['Under investigation'] ? `${vex['Under investigation']} checking` : 'suppressed'}</span>
    </span>
  );
}

export function FChips<T extends string>({ label, value, options, onChange, counts }: { label: string; value: T | 'all'; options: { id: T; label: string }[]; onChange: (v: T | 'all') => void; counts?: Partial<Record<T, number>> }) {
  return (
    <div className="sb-fgroup">
      <span className="sb-flabel">{label}</span>
      <button type="button" className={`sb-fchip ${value === 'all' ? 'on' : ''}`} onClick={() => onChange('all')}>All</button>
      {options.map((o) => (
        <button key={o.id} type="button" className={`sb-fchip ${value === o.id ? 'on' : ''}`} onClick={() => onChange(value === o.id ? 'all' : o.id)}>
          {o.label}{counts?.[o.id] !== undefined && <em>{counts[o.id]}</em>}
        </button>
      ))}
    </div>
  );
}

export function scrollTo(id: string) {
  setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
}

export function ageColor(days: number): string {
  return days > 180 ? 'var(--sev-critical)' : days > 90 ? 'var(--sev-medium)' : 'var(--text-secondary)';
}
