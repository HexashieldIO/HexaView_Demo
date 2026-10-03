import { useNavigate } from 'react-router-dom';
import { ExternalLink, Settings2 } from 'lucide-react';
import { Drawer } from '../../components/Overlay';
import { Chart } from '../../components/Chart';
import { Badge, Bar, Btn, Callout, KV, SectionLabel } from '../../components/ui';
import { CAP_LIST, STATUS_COLOR, STATUS_LABEL, clientMargin, type PartnerClient } from '../../data/modules/partner';
import { fmtCompact, monthLabels, scoreTone } from '../../lib/format';
import { ClientAvatar, ModeBadge, PT_TONE, money, useOpenClient } from './parts';

export function ClientDrawer({ c, onClose }: { c: PartnerClient; onClose: () => void }) {
  const open = useOpenClient();
  const nav = useNavigate();
  const m = clientMargin(c);
  return (
    <Drawer
      title={c.name}
      sub={`${c.sector} · ${c.city}, ${c.country} · ${c.tier}`}
      icon={<ClientAvatar c={c} size={36} />}
      onClose={onClose}
      footer={
        <>
          <Btn primary color={PT_TONE} onClick={() => open(c)}>
            <ExternalLink /> Open client
          </Btn>
          <Btn onClick={() => nav(`/partner/provisioning?client=${c.id}`)}>
            <Settings2 /> Manage subscription
          </Btn>
        </>
      }
    >
      <div className="pt-stat-grid" style={{ marginBottom: 14 }}>
        <div title="Source: HexaView Resilience Index (client tenant)">
          <small>Resilience</small>
          <b style={{ color: scoreTone(c.ri) }}>{c.ri}</b>
        </div>
        <div title="Source: HexaSOC case management">
          <small>Open incidents</small>
          <b>{c.openIncidents}</b> {c.critical > 0 && <Badge color="var(--sev-critical)">{c.critical} critical</Badge>}
        </div>
        <div title="Source: HexaCore integration fabric">
          <small>Integrations</small>
          <b>{c.healthyIntegrations}/{c.integrations}</b>
          <span className="muted" style={{ fontSize: 10.5 }}> {c.integrationLimit ? `cap ${c.integrationLimit}` : 'unlimited'}</span>
        </div>
      </div>
      <SectionLabel>Resilience Index, 12 months</SectionLabel>
      <Chart
        height={90}
        option={{
          grid: { left: 28, right: 6, top: 6, bottom: 18 },
          xAxis: { type: 'category', data: monthLabels(12) },
          yAxis: { type: 'value', min: 40, max: 100, splitNumber: 3 },
          tooltip: { trigger: 'axis' },
          series: [{ type: 'line', data: c.riTrend, symbol: 'none', smooth: true, lineStyle: { color: '#fb923c', width: 2 }, areaStyle: { color: 'rgba(251,146,60,.15)' } }],
        }}
      />
      {c.healthNotes.length > 0 && (
        <div style={{ margin: '10px 0' }}>
          <Callout kind={c.status === 'at-risk' ? 'warn' : 'info'}>{c.healthNotes.join(' · ')}</Callout>
        </div>
      )}
      <SectionLabel>Top action to raise their index</SectionLabel>
      <p className="secondary" style={{ fontSize: 12.5, margin: '0 0 12px' }}>{c.topAction}</p>
      <SectionLabel>Subscription</SectionLabel>
      <div>
        {CAP_LIST.map((cap) => (
          <div key={cap.id} className="pt-sub-row">
            <span className="dot" style={{ background: cap.tone }} />
            <span className="pt-sub-main">
              <b>{cap.product}</b>
              <span>{cap.services.filter((s) => c.services.includes(s)).length} of {cap.services.length} services</span>
            </span>
            <ModeBadge mode={c.modules[cap.id]} />
          </div>
        ))}
      </div>
      <SectionLabel>Account</SectionLabel>
      <KV
        rows={[
          ['Status', <Badge color={STATUS_COLOR[c.status]} dot>{STATUS_LABEL[c.status]}</Badge>],
          ['Account health', <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><div style={{ width: 120 }}><Bar value={c.health} color={scoreTone(c.health)} /></div><b>{c.health}</b></div>],
          ['Annual run rate', `${money(c.arrUsd)} list · your margin ${money(m.margin)} (${m.marginPct.toFixed(0)}%)`],
          ['Renewal', c.status === 'trial' ? `Proof of value ends in ${c.renewalDays} days` : `in ${c.renewalDays} days`],
          ['Client since', c.sinceMonths ? `${c.sinceMonths} months` : 'New this quarter'],
          ['Deployment', c.deployment],
          ['Residency', c.residency],
          ['Tenants', c.tenants],
          ['Events / day', fmtCompact(c.eventsPerDay)],
          ['Frameworks', c.frameworks.join(' · ')],
          ['Account owner', c.owner],
          ['Customer success', c.csm],
        ]}
      />
    </Drawer>
  );
}
