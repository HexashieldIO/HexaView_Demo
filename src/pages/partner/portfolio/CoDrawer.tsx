import { useNavigate } from 'react-router-dom';
import { BarChart3, CalendarCheck, Crosshair, ExternalLink } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { Drawer } from '../../../components/Overlay';
import { Chart } from '../../../components/Chart';
import { Badge, Bar, BarRow, Btn, Callout, KV, SectionLabel } from '../../../components/ui';
import { DIMENSIONS, PF_STATUS_COLOR, PF_STATUS_LABEL, type PortfolioCo } from '../../../data/modules/portfolio';
import { fmtNum, monthLabels, scoreTone } from '../../../lib/format';
import { CoAvatar, PF_TONE, heatHex, usdM, useOpenCo } from './parts';

export function CoDrawer({ co, onClose }: { co: PortfolioCo; onClose: () => void }) {
  const { toast } = useApp();
  const nav = useNavigate();
  const open = useOpenCo(() => undefined);
  return (
    <Drawer
      title={co.name}
      sub={`${co.sector} · ${co.country} · ${co.ownership} · held ${co.holdingMonths} months`}
      icon={<CoAvatar co={co} size={36} />}
      onClose={onClose}
      footer={
        <>
          {co.demoId && <Btn primary color={PF_TONE} onClick={() => open(co)}><ExternalLink /> Open Command Centre</Btn>}
          {co.status === 'integrating' && <Btn primary color={PF_TONE} onClick={() => { onClose(); nav(`/partner/portfolio?section=hundred&co=${co.id}`); }}><CalendarCheck /> 100-day plan</Btn>}
          <Btn onClick={() => { onClose(); nav(`/partner/portfolio?section=benchmark&co=${co.id}`); }}><BarChart3 /> Benchmark</Btn>
          {!co.demoId && <Btn onClick={() => toast(`HexaStrike external assessment requested for ${co.short}; scoping call within 2 business days`)}><Crosshair /> Commission assessment</Btn>}
        </>
      }
    >
      <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
        <Badge color={PF_STATUS_COLOR[co.status]} dot>{PF_STATUS_LABEL[co.status]}</Badge>
        <Badge color={co.onHexaView ? 'var(--good)' : 'var(--sev-medium)'}>{co.onHexaView ? 'Connected to HexaCore' : 'Outside-in only'}</Badge>
        {co.day !== undefined && <Badge color={PF_TONE}>Day {co.day} of 100</Badge>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: '1px solid var(--hairline)', borderRadius: 10, overflow: 'hidden', marginBottom: 14, flexShrink: 0 }}>
        {([
          ['Resilience', co.ri, scoreTone(co.ri)],
          ['Insurability', co.insurability, scoreTone(co.insurability)],
          ['Open critical', co.openCritical, co.openCritical ? 'var(--bad)' : undefined],
          ['Expected loss', usdM(co.expectedLossM), undefined],
        ] as [string, string | number, string | undefined][]).map(([k, v, col]) => (
          <div key={k} style={{ padding: '9px 12px', borderRight: '1px solid var(--hairline)' }}>
            <small style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{k}</small>
            <b style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: col }}>{v}</b>
          </div>
        ))}
      </div>
      <Callout kind="warn"><b>Top risk:</b> {co.topRisk}</Callout>
      <SectionLabel>Resilience Index, 12 months</SectionLabel>
      <Chart
        height={150}
        option={{
          grid: { left: 30, right: 8, top: 10, bottom: 20 },
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', data: monthLabels(12) },
          yAxis: { type: 'value', min: (v: { min: number }) => Math.floor(v.min - 4) },
          series: [{ type: 'line', data: co.trend, smooth: true, symbol: 'none', lineStyle: { color: '#fb923c', width: 2 }, areaStyle: { color: 'rgba(251,146,60,0.12)' } }],
        }}
      />
      <SectionLabel>Control domains</SectionLabel>
      {DIMENSIONS.map((d) => <BarRow key={d} label={d} value={co.dims[d]} color={heatHex(co.dims[d])} display={co.dims[d]} />)}
      <SectionLabel>Frameworks</SectionLabel>
      {co.frameworks.map((f) => (
        <div key={f.short} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 40px', gap: 10, alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
          <span>{f.short}</span><Bar value={f.pct} color={scoreTone(f.pct)} /><span className="num" style={{ textAlign: 'right' }}>{f.pct}%</span>
        </div>
      ))}
      <SectionLabel>Company</SectionLabel>
      <KV rows={[
        ['Revenue', usdM(co.revenueM)],
        ['Enterprise value', usdM(co.evM)],
        ['Cyber insurance limit', usdM(co.insuredLimitM)],
        ['Employees', fmtNum(co.employees)],
        ['Portfolio owner', co.owner],
        ['Data', co.onHexaView ? 'HexaCore connectors (identity, EDR, SIEM) and HexaInt outside-in' : 'HexaInt outside-in monitoring and questionnaire'],
      ]} />
    </Drawer>
  );
}
