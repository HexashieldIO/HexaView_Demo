import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../../state/AppContext';
import { CUSTOMERS } from '../../../data/customers';
import type { PortfolioCo } from '../../../data/modules/portfolio';
import { fmtMoney } from '../../../lib/format';
import './portfolio.css';

export const PF_TONE = 'var(--m-partner)';
export const usd = (n: number) => fmtMoney(n, 'USD');
/** Values held in US$ millions. */
export const usdM = (m: number) => fmtMoney(m * 1e6, 'USD');
export const usdK = (k: number) => fmtMoney(k * 1e3, 'USD');

export type PfSection = 'risk' | 'diligence' | 'hundred' | 'benchmark';
export const PF_SECTIONS: { id: PfSection; label: string }[] = [
  { id: 'risk', label: 'Portfolio risk' },
  { id: 'diligence', label: 'Due diligence' },
  { id: 'hundred', label: 'First 100 days' },
  { id: 'benchmark', label: 'Benchmark' },
];

export function usePfNav() {
  const [sp, setSp] = useSearchParams();
  const go = useCallback((section: PfSection, params: Record<string, string> = {}) => setSp(new URLSearchParams({ section, ...params })), [setSp]);
  const patch = useCallback((p: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    Object.entries(p).forEach(([k, v]) => (v === null ? next.delete(k) : next.set(k, v)));
    setSp(next, { replace: true });
  }, [sp, setSp]);
  const set = useCallback((k: string, v: string | null) => patch({ [k]: v }), [patch]);
  return { sp, go, set, patch };
}

/** Demo companies open their full HexaView tenant; the rest call `fallback` (usually a drawer). */
export function useOpenCo(fallback: (co: PortfolioCo) => void) {
  const { setCustomerId, toast } = useApp();
  const nav = useNavigate();
  return (co: PortfolioCo) => {
    if (co.demoId) {
      setCustomerId(co.demoId);
      nav('/');
      toast(`Opened ${CUSTOMERS[co.demoId].name}'s Command Centre (delegated portfolio access, audited)`);
    } else fallback(co);
  };
}

export function CoAvatar({ co, size = 28 }: { co: Pick<PortfolioCo, 'initials' | 'colour'>; size?: number }) {
  return <span className="pf-avatar" style={{ width: size, height: size, background: co.colour, fontSize: Math.round(size * 0.38) }}>{co.initials}</span>;
}

export function CoName({ co }: { co: PortfolioCo }) {
  return (
    <span className="pf-name">
      <CoAvatar co={co} />
      <span style={{ minWidth: 0 }}>
        <b>{co.short}{co.demoId && <span className="pf-live" title="Full HexaView tenant: click to open its Command Centre">LIVE</span>}</b>
        <span>{co.sector} · {co.country}</span>
      </span>
    </span>
  );
}

export function Spark({ data, color, w = 72, h = 22 }: { data: number[]; color: string; w?: number; h?: number }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - min) / Math.max(1, max - min)) * (h - 6)).toFixed(1)}`).join(' ');
  const last = pts.split(' ').slice(-1)[0].split(',');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.4} fill={color} />
    </svg>
  );
}

/** Score to a solid heat colour (hex, crisp on both themes). */
export function heatHex(v: number): string {
  if (v >= 85) return '#15803d';
  if (v >= 77) return '#4d9a2a';
  if (v >= 70) return '#b7911c';
  if (v >= 62) return '#d0702a';
  if (v >= 54) return '#d24a3a';
  return '#b5223f';
}
