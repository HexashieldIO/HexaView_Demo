import { Fragment, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory, HardDrive, ShieldOff } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import {
  otScope, otAssets, otAlertLog, alertBands, otWatching, otProtocols, otCrossings, otSensors, bundleAgeMin, airGappedSite,
  PURDUE, LEVEL_HEX, LEVEL_NUM, SECTOR, BAND_HEX, type RiskBand, type PurdueLevel,
} from '../../data/modules/ot';
import { KpiStrip, Card, Badge, StatusBadge, IcoBox, Legend, Callout } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { dayLabels, fmtAgo, fmtDur, fmtNum } from '../../lib/format';
import { OT_TONE, OtIntro, NoOtState, OtSources, RiskChip, PeakBadge, srcNames } from './parts';
import { forCustomer } from '../../data/customerMap';

const BANDS: RiskBand[] = ['Very high', 'High', 'Medium', 'Low'];
const STATUS_COLOR: Record<string, string> = { Open: 'var(--accent)', Acknowledged: 'var(--text-muted)', Closed: 'var(--good)' };

export default function OtOverview() {
  const { customer: c, tenantId } = useApp();
  const nav = useNavigate();
  const sc = useMemo(() => otScope(c, tenantId), [c, tenantId]);
  const assets = useMemo(() => otAssets(c, tenantId), [c, tenantId]);
  const log = useMemo(() => otAlertLog(c, tenantId), [c, tenantId]);
  const bands = useMemo(() => alertBands(c, tenantId), [c, tenantId]);
  const watch = useMemo(() => otWatching(c, tenantId), [c, tenantId]);
  const protocols = useMemo(() => otProtocols(c, tenantId), [c, tenantId]);
  const crossings = useMemo(() => otCrossings(c, tenantId), [c, tenantId]);
  const sensors = useMemo(() => otSensors(c, tenantId), [c, tenantId]);

  const byLevel = useMemo(() => {
    const m = new Map<PurdueLevel, Map<string, number>>();
    for (const a of assets) {
      const x = m.get(a.level) ?? new Map<string, number>();
      x.set(a.type, (x.get(a.type) ?? 0) + 1);
      m.set(a.level, x);
    }
    return m;
  }, [assets]);

  if (!sc.hasOt) return <NoOtState what="The HexaOT overview covers sites that run operational technology." />;
  const h = sc.h;
  const w = forCustomer(SECTOR, c);
  const src = srcNames(sc);
  const gap = sc.sites.find((s) => s.airGapped) ? airGappedSite(c) : undefined;
  const gapAge = bundleAgeMin(c);
  const unexpected = crossings.filter((x) => !x.expected).length;
  const peakSites = sc.sites.filter((s) => (bands.sitePeak[s.id] ?? 0) >= 7).length;
  const peak = Math.max(0, ...Object.values(bands.sitePeak));
  const sensorsGood = sensors.filter((s) => s.health === 'Good').length;
  const nodes = Math.round(assets.length * 1.85);
  const sessions = Math.round(assets.length * 4.8);
  const total = assets.length || 1;
  const sitesSorted = sc.sites.slice().sort((a, b) => (bands.siteTotals[b.id] ?? 0) - (bands.siteTotals[a.id] ?? 0));
  const latest = log.slice(0, 6);

  return (
    <>
      <OtIntro>
        <b>{c.name}</b> · {fmtNum(h.sites)} operational sites watched by {fmtNum(h.sensors)} passive sensors through {src}. Passive only — SPAN and TAP mirrors, plus authenticated read-only polling in agreed windows. This view is read-only; nothing in HexaView can reach the {w.net}.
      </OtIntro>

      {gap && (
        <Callout kind="warn" color={OT_TONE}>
          <b>{gap.name} is air-gapped.</b> It has no live link to HexaView: its sensors write a signed bundle every {gap.bundleHours ?? 6} h, which is verified on import. The last bundle arrived {fmtAgo(gapAge)}, so everything shown for this plant is up to {fmtDur(gapAge)} old — treat it as a delayed picture, not a live one.{' '}
          <button className="link" onClick={() => nav(`/ot/sites?site=${gap.id}`)}>See bundle history</button>
        </Callout>
      )}

      <KpiStrip
        toneColor={OT_TONE}
        items={[
          { label: 'Sites', hint: w.sitesHint, value: fmtNum(h.sites), to: '/ot/sites', source: src },
          { label: 'Assets', hint: 'discovered', value: fmtNum(h.otAssets), to: '/ot/assets?view=all', source: src },
          { label: 'Sensors', hint: `${sensorsGood} of ${sensors.length} healthy`, value: fmtNum(h.sensors), bar: h.purdueCoveragePct, to: '/ot/sites?show=sensors', source: src },
          { label: 'Protocols', hint: 'in use', value: protocols.length, to: '/ot/network?show=protocols', source: `${src} · passive DPI` },
          { label: 'Vulnerabilities', hint: 'open', value: fmtNum(h.otVulns), to: '/ot/vulns', source: `${src} · vendor advisories, NVD` },
          { label: 'Alerts', hint: 'last 14 days', value: fmtNum(bands.total), to: '/ot/alerts', source: src },
        ]}
      />

      <Card>
        <div className="ot-band">
          <div className="ot-band-head">
            <b>{fmtNum(bands.total)} alerts · last 14 days</b>
            <div className="ot-band-legend">
              {BANDS.map((b) => (
                <button key={b} onClick={() => nav(`/ot/alerts?band=${encodeURIComponent(b)}`)} title={`Open ${b.toLowerCase()} alerts`}>
                  <i style={{ background: BAND_HEX[b] }} /> {b} <b>{fmtNum(bands.bands[b])}</b>
                </button>
              ))}
            </div>
          </div>
          <div className="ot-band-bar">
            {BANDS.map((b) => (
              <button key={b} style={{ flex: Math.max(bands.bands[b], bands.total * 0.006), background: BAND_HEX[b] }} title={`${b}: ${fmtNum(bands.bands[b])}`} onClick={() => nav(`/ot/alerts?band=${encodeURIComponent(b)}`)} />
            ))}
          </div>
          <div className="ot-band-facts">
            <button onClick={() => nav('/ot/alerts?band=Very%20high')}><b>{peak}</b>highest risk score seen</button>
            <button onClick={() => nav('/ot/sites')}><b style={{ color: 'var(--sev-high)' }}>{peakSites}</b>of {sc.sites.length} sites peaked at high or above</button>
            <button onClick={() => nav('/ot/network?expected=no')}><b style={{ color: 'var(--bad)' }}>{unexpected}</b>unexpected boundary crossings</button>
          </div>
        </div>
      </Card>

      <Card title={`The estate, by Purdue level`} sub={`${fmtNum(nodes)} nodes · ${fmtNum(sessions)} sessions · click a level or a type to open the inventory`} toneColor={OT_TONE} actions={<OtSources sc={sc} />}>
        <div className="ot-estate-bar">
          {PURDUE.map((p) => {
            const n = sumMap(byLevel.get(p.id));
            return n ? <i key={p.id} style={{ flex: n, background: LEVEL_HEX[p.id] }} title={`${w.levels[p.id].name}: ${fmtNum(n)}`} /> : null;
          })}
        </div>
        {PURDUE.map((p) => {
          const types = [...(byLevel.get(p.id) ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
          const n = types.reduce((s, [, v]) => s + v, 0);
          return (
            <Fragment key={p.id}>
              {p.id === 'L3' && <div className="ot-line">{w.belowLine}</div>}
              <button className="ot-lv" style={{ '--lvl': LEVEL_HEX[p.id] } as CSSProperties} onClick={() => nav(`/ot/assets?view=all&level=${encodeURIComponent(p.id)}`)}>
                <span className="ot-lv-n">{LEVEL_NUM[p.id]}</span>
                <span className="ot-lv-name">
                  <b>{w.levels[p.id].name}</b>
                  <span>{w.levels[p.id].desc}</span>
                </span>
                <span className="ot-lv-count">
                  <b>{fmtNum(n)}</b>
                  <span>{Math.round((n / total) * 100)}%</span>
                </span>
                <span className="ot-lv-types">
                  {types.slice(0, 5).map(([t, v]) => (
                    <span key={t} role="link" tabIndex={0} title={`Open ${t} in the inventory`} onClick={(e) => { e.stopPropagation(); nav(`/ot/assets?view=all&type=${encodeURIComponent(t)}`); }}>
                      <b>{fmtNum(v)}</b>{t}
                    </span>
                  ))}
                  {types.length > 5 && <span>+{types.length - 5} more</span>}
                  {types.length === 0 && <span>None observed at this level</span>}
                </span>
              </button>
            </Fragment>
          );
        })}
      </Card>

      <div className="grid g-3-2">
        <Card title="Alerts at medium risk and above" sub={`per day · ${fmtNum(bands.bands.Low)} low-risk alerts not shown`} actions={<Legend items={[{ label: 'Medium', color: BAND_HEX.Medium }, { label: 'High', color: BAND_HEX.High }, { label: 'Very high', color: BAND_HEX['Very high'] }]} />}>
          <Chart
            height={260}
            onClick={() => nav('/ot/alerts')}
            option={{
              grid: { left: 36, right: 10, top: 10, bottom: 26 },
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              xAxis: { type: 'category', data: dayLabels(14), axisLabel: { fontSize: 11 } },
              yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
              series: [
                { name: 'Medium', type: 'bar', stack: 'a', data: bands.daily.Medium, itemStyle: { color: BAND_HEX.Medium }, barMaxWidth: 26 },
                { name: 'High', type: 'bar', stack: 'a', data: bands.daily.High, itemStyle: { color: BAND_HEX.High } },
                { name: 'Very high', type: 'bar', stack: 'a', data: bands.daily['Very high'], itemStyle: { color: BAND_HEX['Very high'], borderRadius: [3, 3, 0, 0] } },
              ],
            }}
          />
        </Card>
        <Card title="Where the alerts landed" sub="last 14 days · click a site" foot={<span>Peak is the highest risk score any single alert reached at that site. Sensors per site are on the Sites tab.</span>}>
          <div className="ot-sitelist">
            {sitesSorted.map((s) => (
              <button key={s.id} className="ot-site" onClick={() => nav(`/ot/alerts?site=${s.id}`)}>
                <IcoBox color={OT_TONE}>{s.airGapped ? <ShieldOff /> : <Factory />}</IcoBox>
                <span className="ot-site-main">
                  <b>{s.name}</b>
                  <span>{s.city}, {s.country} · {fmtNum(sc.siteAssets[s.id] ?? 0)} assets{s.airGapped ? ` · as of bundle ${fmtAgo(gapAge)}` : ''}</span>
                </span>
                <span className="ot-site-n"><b>{fmtNum(bands.siteTotals[s.id] ?? 0)}</b>alerts</span>
                <PeakBadge n={bands.sitePeak[s.id] ?? 0} />
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g2">
        <Card title="What we're watching between alerts" sub="as of last sync · click to open the records">
          <div className="ot-watch">
            {watch.map((x) => (
              <button key={x.id} onClick={() => nav(x.to)}>
                <span>
                  <b>{x.title}</b>
                  <span className="d">{x.desc}</span>
                </span>
                <span className="n">{fmtNum(x.n)}</span>
                <span style={{ textAlign: 'right' }}><Badge color={x.level === 'Attention' ? 'var(--sev-medium)' : 'var(--text-muted)'} dot>{x.level}</Badge></span>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Latest alerts" sub={`${latest.length} most recent of ${fmtNum(bands.total)} · full list on the Alerts tab`}>
          <div className="list">
            {latest.map((a) => (
              <button key={a.id} className="list-row" onClick={() => nav(`/ot/alerts?id=${a.id}`)} style={{ alignItems: 'center' }}>
                <RiskChip n={a.risk} />
                <span className="list-main">
                  <b style={{ whiteSpace: 'normal' }}>{a.title}</b>
                  <span>{fmtAgo(a.ageMin)} · {a.siteName} · {a.zone} · {a.protocol}</span>
                </span>
                <StatusBadge value={a.status} map={STATUS_COLOR} />
              </button>
            ))}
          </div>
          <div className="card-foot">
            <span><HardDrive size={12} style={{ verticalAlign: -2 }} /> Detected passively by {src}. Acknowledging and closing happens in HexaSOC, not here.</span>
          </div>
        </Card>
      </div>
    </>
  );
}

function sumMap(m?: Map<string, number>): number {
  if (!m) return 0;
  let s = 0;
  for (const v of m.values()) s += v;
  return s;
}
