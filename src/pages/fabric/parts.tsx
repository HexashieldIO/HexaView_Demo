import type { CSSProperties, ReactNode } from 'react';
import { Cloud, Server, Factory, Globe2 } from 'lucide-react';
import type { EChartsOption } from 'echarts';
import type { Env, Severity } from '../../data/types';
import { Badge } from '../../components/ui';
import { SEV_HEX } from '../../components/Chart';
import { ENV_HEX, ENV_LABEL } from '../../data/modules/fabric';

export const TONE = 'var(--m-core)';

export const ENV_ICON: Record<Env, typeof Cloud> = { cloud: Cloud, onprem: Server, ot: Factory, saas: Globe2 };

export function EnvBadge({ env }: { env: Env }) {
  return <Badge color={ENV_HEX[env]}>{ENV_LABEL[env]}</Badge>;
}

export function EnvDot({ env }: { env: Env }) {
  return <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: ENV_HEX[env], marginRight: 5 }} />;
}

/** A compact stat block for KPI-like figures inside a card. */
export function Figure({ value, label, color, sub }: { value: ReactNode; label: ReactNode; color?: string; sub?: ReactNode }) {
  return (
    <div>
      <div className="stat-big" style={color ? { color } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/** YAML-style code block for connector manifests and snippets. */
export function CodeBlock({ text, label }: { text: string; label?: string }) {
  return (
    <div className="fab-code">
      {label && <div className="fab-code-label">{label}</div>}
      <pre>{text}</pre>
    </div>
  );
}

export function sparkline(data: number[], color: string): EChartsOption {
  return {
    grid: { left: 0, right: 0, top: 3, bottom: 0 },
    xAxis: { type: 'category', show: false, data: data.map((_, i) => i) },
    yAxis: { type: 'value', show: false, min: 0 },
    tooltip: { show: false },
    series: [{ type: 'line', data, symbol: 'none', smooth: true, lineStyle: { color, width: 1.6 }, areaStyle: { color, opacity: 0.2 } }],
  };
}

/** Stacked severity bar chart option (horizontal categories). */
export function sevStackOption(categories: string[], series: Record<Severity, number[]>, opts?: { horizontal?: boolean }): EChartsOption {
  const sevs: Severity[] = ['critical', 'high', 'medium', 'low'];
  const cat = { type: 'category' as const, data: categories };
  const val = { type: 'value' as const };
  return {
    grid: { left: 8, right: 14, top: 30, bottom: 6, containLabel: true },
    legend: { top: 0, data: sevs.map((s) => s[0].toUpperCase() + s.slice(1)) },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: opts?.horizontal ? val : cat,
    yAxis: opts?.horizontal ? { ...cat, inverse: true } : val,
    series: sevs.map((s) => ({ name: s[0].toUpperCase() + s.slice(1), type: 'bar', stack: 'sev', data: series[s], itemStyle: { color: SEV_HEX[s] }, barMaxWidth: 34 })),
  };
}

export const SEV_VAR: Record<Severity, string> = {
  critical: 'var(--sev-critical)', high: 'var(--sev-high)', medium: 'var(--sev-medium)', low: 'var(--sev-low)', info: 'var(--sev-info)',
};

/** Donut (pie) chart option for a name/value/colour set. */
export function donutOption(data: { name: string; value: number; color: string }[], centerLabel?: string): EChartsOption {
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, left: 'center', itemGap: 12 },
    series: [{
      type: 'pie', radius: ['56%', '78%'], center: ['50%', '44%'], avoidLabelOverlap: true,
      label: centerLabel ? { show: true, position: 'center', formatter: centerLabel, color: 'inherit', fontSize: 12 } : { show: false },
      data: data.filter((d) => d.value > 0).map((d) => ({ name: d.name, value: d.value, itemStyle: { color: d.color } })),
    }],
  };
}

export function toneStyle(tone = TONE): CSSProperties {
  return { '--tone': tone } as CSSProperties;
}
