import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Globe2, KeyRound, ShieldAlert, Truck, Fingerprint, Radio, Siren } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { headlines } from '../../data/core';
import { tenantName } from '../../data/customers';
import {
  credExposure, credsPerMonth, surfaceHosts, lookalikes, darkwebMentions, supplierWatch, sourceHoldings, tally, geoOf, idpOf, taxiiOf,
  type ExposedCred,
} from '../../data/modules/int';
import { Card, KpiStrip, Freshness, SevBadge } from '../../components/ui';
import { Chart, PALETTE } from '../../components/Chart';
import { WorldMap } from '../../components/WorldMap';
import { fmtNum } from '../../lib/format';
import { vrHeadline } from '../../data/modules/vulnresponse';
import { HBarList, RingTile, RecordsDrawer, CRED_COLUMNS } from './parts';
import './int.css';

const tone = MODULE_BY_ID.int.tone;
const INT_HEX = '#e0559b';


interface DrawerState { title: string; rows: ExposedCred[]; source: string[]; openTo: string }

export default function IntOverview() {
  const { customer: c, tenantId } = useApp();
  const nav = useNavigate();
  const h = headlines(c, tenantId);
  const { machines, creds } = useMemo(() => credExposure(c, tenantId), [c, tenantId]);
  const monthly = useMemo(() => credsPerMonth(c, tenantId), [c, tenantId]);
  const hosts = useMemo(() => surfaceHosts(c, tenantId), [c, tenantId]);
  const looks = useMemo(() => lookalikes(c, tenantId), [c, tenantId]);
  const mentions = useMemo(() => darkwebMentions(c, tenantId), [c, tenantId]);
  const sups = useMemo(() => supplierWatch(c), [c]);
  const holdings = useMemo(() => sourceHoldings(c, tenantId), [c, tenantId]);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  const intel = c.connectors.find((k) => k.product === 'HexaInt');
  const taxii = taxiiOf(c);
  const idp = idpOf(c);
  const idpLabel = idp ? (idp.vendor === 'Microsoft' ? 'Entra ID' : `${idp.vendor} ${idp.product}`) : 'your identity provider';
  const crit = hosts.reduce((n, x) => n + x.cves.filter((v) => v.sev === 'critical').length, 0);
  const byCountry = tally(creds, (k) => k.country);
  const machinesByCountry = tally(machines, (m) => m.country);
  const geolocated = creds.filter((k) => k.country).length;
  const STEALER_SRC = ['HexaInt infostealer collection', `Matched to ${idpLabel}`];

  const openCountry = (country: string) =>
    setDrawer({ title: `Credentials captured in ${country}`, rows: creds.filter((k) => k.country === country), source: STEALER_SRC, openTo: `/int/exposure?country=${encodeURIComponent(country)}` });

  // Prioritised actions pulled from every tab, each pivoting to its records.
  const kevHosts = hosts.filter((x) => x.kev);
  const liveLogin = looks.filter((l) => l.status === 'Live — login page');
  const investigating = creds.filter((k) => k.response === 'Investigating');
  const exposedSup = sups.filter((s) => s.status === 'Exposed');
  const direct = mentions.filter((m) => m.scope === 'Direct mention' && (m.sev === 'critical' || m.sev === 'high'));
  const vr = vrHeadline(c, tenantId);
  const actions = [
    { icon: <Siren />, n: vr.open, text: `asset${vr.open === 1 ? '' : 's'} still exposed to ${vr.adv.cve} (CVSS ${vr.adv.cvss.toFixed(1)}, ${vr.patched} of ${vr.affected} patched)`, sev: 'critical' as const, to: '/int/vulnresponse?section=patch&status=Unpatched' },
    { icon: <Globe2 />, n: kevHosts.length, text: `internet-facing host${kevHosts.length === 1 ? '' : 's'} with a KEV-listed vulnerability`, sev: 'critical' as const, to: '/int/surface?kev=1' },
    { icon: <Fingerprint />, n: liveLogin.length, text: `lookalike domain${liveLogin.length === 1 ? '' : 's'} serving a cloned login page`, sev: 'critical' as const, to: '/int/darkweb?view=domains&status=Live%20%E2%80%94%20login%20page' },
    { icon: <KeyRound />, n: investigating.length, text: 'fresh credential exposures still being investigated', sev: 'high' as const, to: '/int/exposure?response=Investigating' },
    { icon: <Radio />, n: direct.length, text: 'high-severity dark-web posts naming you directly', sev: 'high' as const, to: '/int/darkweb?scope=Direct%20mention' },
    { icon: <Truck />, n: exposedSup.length, text: `supplier${exposedSup.length === 1 ? '' : 's'} with active exposure`, sev: 'medium' as const, to: '/int/supply?status=Exposed' },
    { icon: <ShieldAlert />, n: machines.filter((m) => m.ssoCookies).length, text: 'infected machines holding SSO session cookies', sev: 'high' as const, to: '/int/exposure?view=machines&cookies=1' },
  ].filter((a) => a.n > 0);

  return (
    <>
      <p className="page-intro">
        What the outside world can see, take and imitate about <b>{c.name}</b> · {tenantName(c, tenantId)}: the internet-facing estate from HexaInt&rsquo;s own scanning, and exposure across leak markets and the dark web, fused with {taxii ? taxii.product : 'your sector feeds'} and matched to {idpLabel}.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Hosts', hint: 'internet-facing', value: hosts.length, unit: 'hosts', to: '/int/surface', source: 'HexaInt external scanner' },
          { label: 'Exposures', hint: 'critical', value: crit, unit: 'to fix', toneColor: 'var(--sev-critical)', to: '/int/surface?sev=Critical', source: 'HexaInt scanner · NVD · FIRST EPSS' },
          { label: 'Credentials', hint: 'corporate', value: fmtNum(h.int.exposedCredentials), unit: 'exposed', to: '/int/exposure', source: 'HexaInt stealer-log + combolist collection' },
          { label: 'Machines', hint: 'infected', value: h.int.stealerMachines, unit: 'seen', toneColor: 'var(--sev-high)', to: '/int/exposure?view=machines', source: 'HexaInt infostealer logs' },
          { label: 'Lookalikes', hint: 'registered', value: looks.length, unit: 'domains', to: '/int/darkweb?view=domains', source: 'HexaInt domain monitoring' },
          { label: 'Dark web', hint: 'mentions', value: mentions.length, unit: 'posts', to: '/int/darkweb', source: intel ? `${intel.vendor} ${intel.product} collection` : 'HexaInt collection' },
        ]}
      />

      <Card
        title="Where credentials were captured"
        sub="Infected machines by country · click a country for its records"
        actions={<span>{fmtNum(geolocated)} geolocated · {machines.length} machines in total</span>}
      >
        <div className="grid g-3-2" style={{ alignItems: 'center' }}>
          <WorldMap
            height={300}
            onPoint={(id) => openCountry(id)}
            points={byCountry.map((r, i) => {
              const g = geoOf(r.key);
              return { id: r.key, lat: g.lat, lon: g.lon, label: r.key, sub: `${r.n} credentials · ${machinesByCountry.find((m) => m.key === r.key)?.n ?? 0} machines`, color: INT_HEX, size: Math.min(1, 0.25 + r.n / Math.max(1, byCountry[0].n) * 0.75), pulse: i === 0 };
            })}
          />
          <HBarList
            onPick={openCountry}
            rows={byCountry.slice(0, 7).map((r) => {
              const m = machinesByCountry.find((x) => x.key === r.key)?.n ?? 0;
              return { key: r.key, label: r.key, sub: `${m} machine${m === 1 ? '' : 's'} logged`, n: r.n };
            })}
          />
        </div>
      </Card>

      <Card title="What each source is holding" sub="Click a tile to open that view" actions={<Freshness minutes={intel?.lastSyncMin ?? 3} label="last scan" />}>
        <div className="int-rings">
          {holdings.map(({ key, ...x }) => <RingTile key={key} {...x} />)}
        </div>
      </Card>

      <div className="grid g-3-2">
        <Card title="Corporate credentials exposed per month" sub="By source · last 12 months · click a month for its records">
          <Chart
            height={250}
            onClick={(p) => {
              const idx = (p as { dataIndex?: number }).dataIndex;
              if (idx === undefined) return;
              const lo = (11 - idx) * 30.4;
              const rows = creds.filter((k) => k.foundDays >= lo && k.foundDays < lo + 30.4);
              setDrawer({ title: `Credentials found in ${monthly.labels[idx]}`, rows, source: STEALER_SRC, openTo: '/int/exposure' });
            }}
            option={{
              legend: { data: ['Infostealer', 'Combolist'], top: 0, right: 0 },
              grid: { left: 8, right: 14, top: 30, bottom: 6, containLabel: true },
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: monthly.labels, boundaryGap: false },
              yAxis: { type: 'value', minInterval: 1 },
              series: [
                { name: 'Infostealer', type: 'line', smooth: 0.25, data: monthly.stealer, symbol: 'circle', symbolSize: 6, lineStyle: { color: PALETTE[0], width: 2 }, itemStyle: { color: PALETTE[0] }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(79,140,255,0.28)' }, { offset: 1, color: 'rgba(79,140,255,0)' }] } } },
                { name: 'Combolist', type: 'line', smooth: 0.25, data: monthly.combo, symbol: 'circle', symbolSize: 6, lineStyle: { color: PALETTE[3], width: 2 }, itemStyle: { color: PALETTE[3] }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(245,168,61,0.22)' }, { offset: 1, color: 'rgba(245,168,61,0)' }] } } },
              ],
            }}
          />
        </Card>

        <Card title="Prioritised for action" count={actions.reduce((n, a) => n + a.n, 0)} sub="Across every HexaInt source · click to pivot" toneColor={tone} tinted>
          <div className="list">
            {actions.map((a) => (
              <button key={a.to} className="list-row" onClick={() => nav(a.to)} style={{ cursor: 'pointer' }}>
                <span className="int-ico">{a.icon}</span>
                <span className="list-main">
                  <b style={{ whiteSpace: 'normal' }}><em className="int-num">{a.n}</em>{a.text}</b>
                </span>
                <SevBadge sev={a.sev} />
                <ArrowRight size={14} className="muted" />
              </button>
            ))}
          </div>
        </Card>
      </div>

      {drawer && (
        <RecordsDrawer
          title={drawer.title}
          rows={drawer.rows}
          columns={CRED_COLUMNS}
          source={drawer.source}
          openTo={drawer.openTo}
          openLabel="Open in Credential Exposure"
          onClose={() => setDrawer(null)}
        />
      )}
    </>
  );
}
