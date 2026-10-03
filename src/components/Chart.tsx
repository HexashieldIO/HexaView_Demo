import { memo, useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import {
  LineChart, BarChart, PieChart, RadarChart, HeatmapChart, ScatterChart, GraphChart, SankeyChart,
  GaugeChart, TreemapChart, SunburstChart, FunnelChart, BoxplotChart, CustomChart, EffectScatterChart, LinesChart,
} from 'echarts/charts';
import {
  GridComponent, TooltipComponent, LegendComponent, RadarComponent, VisualMapComponent, DataZoomComponent,
  MarkLineComponent, MarkAreaComponent, MarkPointComponent, TitleComponent, PolarComponent, SingleAxisComponent, GraphicComponent, CalendarComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import { useApp } from '../state/AppContext';

echarts.use([
  LineChart, BarChart, PieChart, RadarChart, HeatmapChart, ScatterChart, GraphChart, SankeyChart, GaugeChart,
  TreemapChart, SunburstChart, FunnelChart, BoxplotChart, CustomChart, EffectScatterChart, LinesChart,
  GridComponent, TooltipComponent, LegendComponent, RadarComponent, VisualMapComponent, DataZoomComponent,
  MarkLineComponent, MarkAreaComponent, MarkPointComponent, TitleComponent, PolarComponent, SingleAxisComponent, GraphicComponent, CalendarComponent,
  CanvasRenderer,
]);

/** Categorical palette shared by every chart (order matters: first series first). */
export const PALETTE = ['#4f8cff', '#2dd4bf', '#a07cfb', '#f5a83d', '#ef6aae', '#93d65a', '#f8646f', '#68b1ff', '#ecc873', '#8a9bc0'];

/** Severity palette for stacked severity charts. */
export const SEV_HEX = { critical: '#e0345e', high: '#f2643f', medium: '#f0a338', low: '#e2c73f', info: '#8593b4' } as const;

function makeTheme(dark: boolean) {
  const text = dark ? '#b7c2db' : '#5a6478';
  const muted = dark ? '#6c7a9c' : '#8b94a8';
  const line = dark ? '#1b2440' : '#e8ecf3';
  const axis = {
    axisLine: { show: true, lineStyle: { color: line } },
    axisTick: { show: false },
    axisLabel: { color: muted, fontSize: 10.5 },
    splitLine: { show: true, lineStyle: { color: line, type: 'dashed' as const } },
    nameTextStyle: { color: muted, fontSize: 10.5 },
  };
  return {
    color: PALETTE,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'Inter Variable, Segoe UI, sans-serif', color: text },
    title: { textStyle: { color: dark ? '#eaf0fb' : '#17203a' } },
    legend: { textStyle: { color: text, fontSize: 11 }, icon: 'roundRect', itemWidth: 10, itemHeight: 10, itemGap: 14 },
    tooltip: {
      backgroundColor: dark ? '#111a2e' : '#ffffff',
      borderColor: dark ? '#2a3450' : '#e5e9f1',
      borderWidth: 1,
      textStyle: { color: dark ? '#eaf0fb' : '#17203a', fontSize: 12 },
      extraCssText: 'border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);',
    },
    categoryAxis: { ...axis, splitLine: { show: false } },
    valueAxis: { ...axis, axisLine: { show: false } },
    timeAxis: axis,
    logAxis: axis,
    radar: {
      axisName: { color: text, fontSize: 11 },
      splitLine: { lineStyle: { color: line } },
      splitArea: { areaStyle: { color: ['transparent'] } },
      axisLine: { lineStyle: { color: line } },
    },
    line: { symbol: 'circle', symbolSize: 5, smooth: true, lineStyle: { width: 2 } },
    bar: { barMaxWidth: 26, itemStyle: { borderRadius: [3, 3, 0, 0] } },
    pie: { itemStyle: { borderColor: dark ? '#0b1122' : '#ffffff', borderWidth: 2 } },
    graph: { lineStyle: { color: line }, label: { color: text } },
    sankey: { label: { color: text } },
  };
}
echarts.registerTheme('hv-dark', makeTheme(true));
echarts.registerTheme('hv-light', makeTheme(false));

/** Default grid so axes line up across cards; pass `grid` in the option to override. */
const DEFAULT_GRID = { left: 8, right: 12, top: 28, bottom: 6, containLabel: true };

function ChartImpl({ option, height = 240, onClick, className }: { option: EChartsOption; height?: number | string; onClick?: (p: unknown) => void; className?: string }) {
  const { theme } = useApp();
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!el.current) return;
    const chart = echarts.init(el.current, theme === 'dark' ? 'hv-dark' : 'hv-light', { renderer: 'canvas' });
    inst.current = chart;
    chart.on('click', (p) => clickRef.current?.(p));
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      chart.dispose();
      inst.current = null;
    };
  }, [theme]);

  // Re-apply only when the option content changes, so parent re-renders do not replay animations.
  const optKey = JSON.stringify(option);
  useEffect(() => {
    inst.current?.setOption({ grid: DEFAULT_GRID, tooltip: { confine: true }, ...option } as EChartsOption, { notMerge: true, lazyUpdate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optKey, theme]);

  return <div ref={el} className={`chart ${className ?? ''}`} style={{ height, width: '100%' }} />;
}

/**
 * ECharts wrapper (the LLD's chart choice). Themed for light/dark automatically;
 * the theme key forces a re-init when the user flips theme.
 */
export const Chart = memo(function Chart(props: { option: EChartsOption; height?: number | string; onClick?: (p: unknown) => void; className?: string }) {
  const { theme } = useApp();
  return <ChartImpl key={theme} {...props} />;
});

export { echarts };
