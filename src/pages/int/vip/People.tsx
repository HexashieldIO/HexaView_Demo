import { useMemo, type CSSProperties } from 'react';
import { tenantName } from '../../../data/customers';
import { FINDING_KINDS, FINDING_COLOR, TIER_COLOR, VIP_TIERS, scoreBand, type ProtectedPerson } from '../../../data/modules/vip';
import { Card, Freshness, Sources } from '../../../components/ui';
import { Chart } from '../../../components/Chart';
import { FilterGroup, HBarList } from '../parts';
import { useVip } from './state';
import { Avatar, Spark, kindCount, KIND_SHORT } from './ui';

const BANDS = [
  { id: 'critical', label: 'Critical', min: 75, max: 101, color: 'var(--sev-critical)' },
  { id: 'high', label: 'High', min: 60, max: 75, color: 'var(--sev-high)' },
  { id: 'moderate', label: 'Moderate', min: 40, max: 60, color: 'var(--sev-medium)' },
  { id: 'low', label: 'Low', min: 0, max: 40, color: 'var(--good)' },
] as const;

/** `band=elevated` (from the KPI) means high or worse. */
function inBand(p: ProtectedPerson, band: string | null): boolean {
  if (!band) return true;
  if (band === 'elevated') return p.score >= 60;
  const b = BANDS.find((x) => x.id === band);
  return b ? p.score >= b.min && p.score < b.max : true;
}

export function People() {
  const { c, tenantId, people, param, patch, openPerson } = useVip();
  const band = param('band');
  const tier = param('tier') ?? 'All';
  const kind = param('kind');
  const intel = c.connectors.find((k) => k.product === 'HexaInt');

  const shown = people
    .filter((p) => inBand(p, band))
    .filter((p) => tier === 'All' || p.tier === tier)
    .filter((p) => !kind || kindCount(p, kind as (typeof FINDING_KINDS)[number]) > 0);

  const kindTotals = FINDING_KINDS.map((k) => ({ key: k, label: k, sub: `${people.filter((p) => kindCount(p, k) > 0).length} of ${people.length} people`, n: people.reduce((s, p) => s + kindCount(p, k), 0) }));
  const avgTrend = useMemo(() => people[0]?.trend.map((_, i) => Math.round(people.reduce((s, p) => s + p.trend[i], 0) / people.length)) ?? [], [people]);
  const maxCell = Math.max(1, ...people.flatMap((p) => FINDING_KINDS.map((k) => kindCount(p, k))));

  return (
    <>
      <div className="vip-bands">
        {BANDS.map((b) => {
          const n = people.filter((p) => inBand(p, b.id)).length;
          return (
            <button key={b.id} type="button" className={`vip-band ${band === b.id ? 'on' : ''}`} style={{ '--tone': b.color } as CSSProperties} onClick={() => patch({ band: band === b.id ? null : b.id })} title="Source: HexaInt exposure scoring · click to filter">
              <b>{n}</b>
              <span>{b.label} exposure · score {b.min}{b.max > 100 ? '+' : `–${b.max - 1}`}</span>
            </button>
          );
        })}
      </div>

      <div className="grid g-3-2">
        <Card title="Exposure matrix" sub="Findings per person and type · click a name or cell for the detail" actions={<Freshness minutes={intel?.lastSyncMin ?? 3} label="HexaInt" />}>
          <div className="vip-matrix" style={{ gridTemplateColumns: `minmax(170px, 1.6fr) repeat(${FINDING_KINDS.length}, minmax(44px, 1fr)) 42px` }}>
            <span />
            {FINDING_KINDS.map((k) => (
              <button key={k} type="button" className="vip-mx-h" style={{ background: 'none', border: 0, cursor: 'pointer', color: kind === k ? FINDING_COLOR[k] : undefined }} onClick={() => patch({ kind: kind === k ? null : k })} title={`Show people with ${k.toLowerCase()} findings`}>{KIND_SHORT[k]}</button>
            ))}
            <span className="vip-mx-h">Score</span>
            {shown.slice(0, 14).map((p) => (
              <Row key={p.id} p={p} max={maxCell} onOpen={() => openPerson(p.id)} />
            ))}
          </div>
          {shown.length > 14 && <div className="vip-note" style={{ marginTop: 8 }}>Showing the 14 most exposed of {shown.length}; all are listed below.</div>}
          {!shown.length && <div className="empty">Nobody matches these filters.</div>}
        </Card>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Where exposure comes from" sub="Total findings by type · click to filter">
            <HBarList rows={kindTotals} onPick={(k) => patch({ kind: kind === k ? null : k })} />
          </Card>
          <Card title="Average exposure score" sub="All protected people · 12 weeks">
            <Chart
              height={150}
              option={{
                grid: { left: 4, right: 8, top: 10, bottom: 4, containLabel: true },
                tooltip: { trigger: 'axis' },
                xAxis: { type: 'category', data: avgTrend.map((_, i) => (i === avgTrend.length - 1 ? 'Now' : `W-${avgTrend.length - 1 - i}`)), axisLabel: { fontSize: 10.5, interval: 2 } },
                yAxis: { type: 'value', min: 0, max: 100, splitNumber: 2 },
                series: [{ type: 'line', data: avgTrend, smooth: true, symbol: 'circle', symbolSize: 5, lineStyle: { width: 2, color: '#a07cfb' }, itemStyle: { color: '#a07cfb' }, areaStyle: { color: 'rgba(160,124,251,0.12)' } }],
              }}
            />
          </Card>
        </div>
      </div>

      <Card
        title="Protected people"
        count={`${shown.length} of ${people.length}`}
        sub={`${c.short} · ${tenantName(c, tenantId)} · executives, board and key people enrolled in executive protection`}
        actions={<FilterGroup label="Tier" value={tier} options={VIP_TIERS} onChange={(v) => patch({ tier: v })} counts={Object.fromEntries(VIP_TIERS.map((t) => [t, people.filter((p) => p.tier === t).length]))} />}
        foot={<Sources items={[{ name: 'HexaInt collection' }, { name: 'Board & HR register' }, { name: 'Data-broker sweep' }]} />}
      >
        {(band || kind) && (
          <div style={{ marginBottom: 10 }}>
            <button type="button" className="int-fchip on" onClick={() => patch({ band: null, kind: null })}>{[band && `${band === "elevated" ? "high or critical" : band} exposure`, kind].filter(Boolean).join(' · ')} ×</button>
          </div>
        )}
        <div className="vip-cards">
          {shown.map((p) => {
            const b = scoreBand(p.score);
            return (
              <button key={p.id} type="button" className="vip-card" style={{ '--band': b.color } as CSSProperties} onClick={() => openPerson(p.id)}>
                <span className="vip-card-top">
                  <Avatar name={p.name} color={TIER_COLOR[p.tier]} />
                  <span className="vip-card-who"><b>{p.name}</b><span>{p.role}</span></span>
                  <span className="vip-score"><b style={{ color: b.color }}>{p.score}</b><small style={{ color: b.color }}>{b.label}</small></span>
                </span>
                <span className="vip-chips">
                  {FINDING_KINDS.map((k) => {
                    const n = kindCount(p, k);
                    return n ? <span key={k} className="vip-chip" style={{ '--tone': FINDING_COLOR[k] } as CSSProperties}><b>{n}</b>{KIND_SHORT[k]}</span> : null;
                  })}
                </span>
                <span className="vip-card-foot">
                  <span>{p.tier} · {tenantName(c, p.tenantId)}</span>
                  <span className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <Spark data={p.trend} color={p.delta > 0 ? '#f8646f' : '#2dd4bf'} w={70} h={20} />
                    <span style={{ color: p.delta > 0 ? 'var(--bad)' : p.delta < 0 ? 'var(--good)' : undefined, fontWeight: 700 }}>{p.delta > 0 ? `+${p.delta}` : p.delta}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>
    </>
  );
}

function Row({ p, max, onOpen }: { p: ProtectedPerson; max: number; onOpen: () => void }) {
  const b = scoreBand(p.score);
  return (
    <>
      <button type="button" className="vip-mx-name" onClick={onOpen}>
        <Avatar name={p.name} color={TIER_COLOR[p.tier]} size="sm" />
        <span style={{ minWidth: 0 }}><b>{p.name}</b><small>{p.role}</small></span>
      </button>
      {FINDING_KINDS.map((k) => {
        const n = kindCount(p, k);
        const a = n ? 0.16 + 0.6 * (n / max) : 0;
        return (
          <button key={k} type="button" className={`vip-mx-cell ${n ? '' : 'zero'}`} disabled={!n} onClick={onOpen} title={`${p.name} · ${k}: ${n}`}
            style={n ? { background: `color-mix(in srgb, ${FINDING_COLOR[k]} ${Math.round(a * 100)}%, transparent)` } : undefined}>
            {n || '·'}
          </button>
        );
      })}
      <span className="vip-mx-score" style={{ color: b.color }}>{p.score}</span>
    </>
  );
}
