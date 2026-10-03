import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ArrowDownRight, Minus, FileCheck2, CalendarClock } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { headlines } from '../../data/core';
import { keyControls, insurability, insurabilityTrend, renewalMilestones, evidencePack, CONTROL_STATUS_COLOR, type ControlStatus, type KeyControl } from '../../data/modules/insurance';
import { Card, KpiStrip, HexScore, Btn, Badge, Callout, Tabs, Bar } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { fmtNum, fmtDateShort, daysAhead, monthLabels } from '../../lib/format';
import { ControlDrawer, ControlStatusBadge, Intro, SourceLine, TenantNote, INS_TONE, INS_HEX, money } from './parts';
import { DivergingBars, SegRows, BarList, RecordsDrawer, scrollToId } from './viz';

const RANK: Record<ControlStatus, number> = { gap: 0, partial: 1, attested: 2 };

export default function InsuranceOverview() {
  const { customer: c, tenantId } = useApp();
  const nav = useNavigate();
  const h = headlines(c, tenantId).insurance;
  const ctl = useMemo(() => keyControls(c), [c]);
  const prof = useMemo(() => insurability(c), [c]);
  const trend = useMemo(() => insurabilityTrend(c), [c]);
  const miles = renewalMilestones(c);
  const pack = useMemo(() => evidencePack(c), [c]);
  const [params] = useSearchParams();
  const [open, setOpen] = useState<KeyControl | null>(null);
  const [filter, setFilter] = useState<'all' | ControlStatus>(() => (['attested', 'partial', 'gap'].includes(params.get('status') ?? '') ? (params.get('status') as ControlStatus) : 'all'));
  const [rec, setRec] = useState<null | 'tests' | 'drivers'>(null);

  const counts = { attested: ctl.filter((k) => k.status === 'attested').length, partial: ctl.filter((k) => k.status === 'partial').length, gap: ctl.filter((k) => k.status === 'gap').length };
  const lastCounts = { attested: ctl.filter((k) => k.lastStatus === 'attested').length, partial: ctl.filter((k) => k.lastStatus === 'partial').length, gap: ctl.filter((k) => k.lastStatus === 'gap').length };
  const shown = ctl.filter((k) => filter === 'all' || k.status === filter).sort((a, b) => RANK[a.status] - RANK[b.status] || b.weight - a.weight);
  const premiumDelta = prof.modelledPremium - prof.currentPremium;
  const next = miles.find((m) => !m.done);
  const packAnswered = pack.filter((p) => p.status === 'answered').length;

  const drivers = prof.drivers.slice().sort((a, b) => a.pts - b.pts);
  const ctlSrc = [...new Set(ctl.flatMap((k) => k.sources.map((s) => s.name)))].slice(0, 5).join(' · ');
  const showControls = (s: 'all' | ControlStatus) => { setFilter(s); scrollToId('ins-controls'); };

  const improved = ctl.filter((k) => RANK[k.status] > RANK[k.lastStatus]);
  const regressed = ctl.filter((k) => RANK[k.status] < RANK[k.lastStatus]);

  return (
    <>
      <Intro ids={[c.connectors.find((k) => k.category === 'Identity')!.id, c.connectors.find((k) => k.category === 'EDR / XDR')!.id, c.connectors.find((k) => k.category === 'SIEM')!.id, 'c-hexacomply']}>
        Live posture translated into the controls {c.insurance.carrier.split(' ')[0]} and {c.insurance.broker} underwrite on, with the premium effect of each.
      </Intro>
      <TenantNote />

      <KpiStrip
        toneColor={INS_TONE}
        items={[
          { label: 'Insurability score', value: h.insurability, unit: '/ 100', bar: h.insurability, delta: { text: `${h.insurability - prof.lastScore >= 0 ? '+' : ''}${h.insurability - prof.lastScore} since last renewal`, good: h.insurability >= prof.lastScore }, onClick: () => showControls('all'), source: `HexaComply control attestation · ${ctlSrc}` },
          { label: 'Modelled premium impact', value: `${h.premiumDeltaPct > 0 ? '+' : ''}${h.premiumDeltaPct}%`, delta: { text: `${premiumDelta > 0 ? '+' : ''}${money(premiumDelta, c)} on ${money(prof.currentPremium, c)}`, good: h.premiumDeltaPct <= 0 }, onClick: () => setRec('drivers'), source: `HexaView premium model · ${c.insurance.broker} market index` },
          { label: 'Control tests attested', value: `${h.attestedControls}`, unit: `of ${h.totalControls}`, bar: (h.attestedControls / h.totalControls) * 100, delta: { text: `${h.attestedControls - prof.lastAttested >= 0 ? '+' : ''}${h.attestedControls - prof.lastAttested} vs last renewal`, good: h.attestedControls >= prof.lastAttested }, onClick: () => setRec('tests'), source: ctlSrc },
          { label: 'Expected annual loss', value: money(h.expectedLossM, c), hint: 'FAIR', to: '/insurance/quantification?view=scenarios', source: 'HexaView FAIR model · HexaInt · HexaStrike' },
          { label: '1-in-100 year loss', value: money(h.tailLossM, c), delta: { text: `${h.tailLossM > c.insurance.limitM ? 'Exceeds' : 'Within'} ${money(c.insurance.limitM, c)} limit`, good: h.tailLossM <= c.insurance.limitM }, to: '/insurance/quantification?view=tail', source: 'HexaView FAIR model (loss exceedance)' },
          { label: 'Renewal in', value: c.insurance.renewalDays, unit: 'days', delta: { text: next ? `Next: ${next.label}` : 'Bound', good: true }, to: '/insurance/policy?view=renewal', source: `${c.insurance.broker} · policy schedule` },
        ]}
      />

      <div className="grid g2">
        <Card title="Insurability" sub="How an underwriter would score you today, built only from attested evidence">
          <div className="row" style={{ gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
            <HexScore value={h.insurability} size={110} color={INS_TONE} gradient={false} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="secondary" style={{ maxWidth: 440 }}>
                {h.attestedControls} of {h.totalControls} insurer control tests are attested from live connectors across {c.connectors.length} integrations. {counts.gap + counts.partial > 0 ? `${counts.gap + counts.partial} key controls still have gaps an underwriter will ask about.` : 'No open gaps.'}
              </div>
              <div style={{ marginTop: 10 }}>
                <Chart
                  height={70}
                  option={{
                    grid: { left: 0, right: 0, top: 6, bottom: 0 },
                    xAxis: { type: 'category', data: monthLabels(12), show: false },
                    yAxis: { type: 'value', show: false, min: 50 },
                    tooltip: { trigger: 'axis' },
                    series: [{ type: 'line', data: trend, symbol: 'none', lineStyle: { color: INS_HEX, width: 2 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(46,196,168,.35)' }, { offset: 1, color: 'rgba(46,196,168,0)' }] } } }],
                  }}
                />
                <div className="muted" style={{ fontSize: 11 }}>12-month insurability trend · last renewal {prof.lastScore}</div>
              </div>
            </div>
          </div>
          <div className="section-label" style={{ marginTop: 14 }}>Underwriting dimensions · today vs last renewal</div>
          <BarList
            labelWidth={150}
            color={INS_TONE}
            max={100}
            items={prof.dimensions.map((d) => ({
              label: d.label,
              value: d.now,
              color: d.now >= 80 ? 'var(--good)' : d.now >= 65 ? INS_TONE : 'var(--sev-medium)',
              display: <>{d.now} <small className={d.now >= d.last ? 'up-good' : 'up-bad'} style={{ fontSize: 10.5 }}>{d.now >= d.last ? '+' : ''}{d.now - d.last}</small></>,
              onClick: () => showControls('all'),
            }))}
          />
        </Card>

        <Card title="Modelled premium impact" sub={`Percentage points at renewal with ${c.insurance.carrier.split(' ')[0]} · click a driver for its control`} toneColor={INS_TONE} tinted>
          <div className="ins-premium">
            <span className="from">{money(prof.currentPremium, c)}</span>
            <ArrowRight size={16} className="muted" />
            <span className="to" style={{ color: h.premiumDeltaPct <= 0 ? 'var(--good)' : 'var(--bad)' }}>{money(prof.modelledPremium, c)}</span>
            <Badge color={h.premiumDeltaPct <= 0 ? 'var(--good)' : 'var(--bad)'}>{h.premiumDeltaPct > 0 ? '+' : ''}{h.premiumDeltaPct}%</Badge>
          </div>
          <div style={{ margin: '10px 0 8px' }}>
            <DivergingBars
              negLabel="Lowers premium"
              posLabel="Raises premium"
              format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`}
              rows={drivers.map((d) => ({
                label: d.label,
                value: d.pts,
                tag: d.fixable ? <Badge color="var(--sev-medium)">Fixable</Badge> : d.kind === 'market' ? <Badge>Market</Badge> : d.kind === 'history' ? <Badge>History</Badge> : undefined,
                onClick: d.controlId ? () => { const k = ctl.find((x) => x.id === d.controlId); if (k) setOpen(k); } : undefined,
              }))}
              total={{ label: 'Modelled change at renewal', value: h.premiumDeltaPct, color: h.premiumDeltaPct <= 0 ? 'var(--good)' : 'var(--bad)' }}
            />
          </div>
          <Callout kind="good">
            Close the {prof.drivers.filter((d) => d.fixable).length} fixable gaps before submission and the model moves to <b>{prof.achievableDeltaPct > 0 ? '+' : ''}{prof.achievableDeltaPct.toFixed(1)}%</b> ({money(prof.achievablePremium, c)}), worth {money(prof.modelledPremium - prof.achievablePremium, c)} a year.
          </Callout>
          <div className="row" style={{ marginTop: 10 }}>
            <Btn sm onClick={() => nav('/insurance/quantification')}>Control investment what-if <ArrowRight size={13} /></Btn>
          </div>
        </Card>
      </div>

      <div id="ins-controls" />
      <Card
        title="Insurer key controls"
        count={ctl.length}
        sub="The controls carriers decline or load on, each auto-evidenced from your own tools. Click a control for its tests and evidence."
        flush
        actions={
          <Tabs
            color={INS_TONE}
            value={filter}
            onChange={setFilter}
            tabs={[
              { id: 'all', label: `All ${ctl.length}` },
              { id: 'attested', label: `Attested ${counts.attested}` },
              { id: 'partial', label: `Partial ${counts.partial}` },
              { id: 'gap', label: `Gap ${counts.gap}` },
            ]}
          />
        }
      >
        <div className="ins-ctl ins-ctl-head">
          <span />
          <span>Control</span>
          <span>Live metric</span>
          <span>Evidence source</span>
          <span>Tests</span>
          <span>Last renewal</span>
        </div>
        {shown.map((k) => (
          <button key={k.id} className="ins-ctl" onClick={() => setOpen(k)}>
            <span style={{ color: CONTROL_STATUS_COLOR[k.status] }}>
              <FileCheck2 size={18} />
            </span>
            <span style={{ minWidth: 0 }}>
              <div className="ins-name">{k.name}</div>
              <div className="ins-sub">
                <ControlStatusBadge status={k.status} /> <span style={{ marginLeft: 4 }}>weight {'●'.repeat(k.weight)}{'○'.repeat(3 - k.weight)}</span>
              </div>
            </span>
            <span className="ins-live">{k.metric}</span>
            <span style={{ minWidth: 0 }}>
              <SourceLine sources={k.sources} />
            </span>
            <span>
              <span className="ins-pips">
                {k.tests.map((t) => (
                  <i key={t.id} className={t.ok ? 'ok' : 'bad'} />
                ))}
              </span>
              <span className="ins-sub">{k.ok}/{k.tests.length}</span>
            </span>
            <span className="ins-sub">
              {RANK[k.status] > RANK[k.lastStatus] ? <ArrowUpRight size={13} color="var(--good)" /> : RANK[k.status] < RANK[k.lastStatus] ? <ArrowDownRight size={13} color="var(--bad)" /> : <Minus size={13} />}{' '}
              {k.lastStatus === 'attested' ? 'Attested' : k.lastStatus === 'partial' ? 'Partial' : 'Gap'}
            </span>
          </button>
        ))}
      </Card>

      <div className="grid g-3-2">
        <Card title="Since last renewal" sub={`Key controls and tests, now vs the ${new Date().getFullYear() - 1} submission`}>
          <SegRows
            legend
            labelWidth={110}
            rows={([['Today', counts], ['Last renewal', lastCounts]] as const).map(([label, cnt]) => ({
              label,
              sub: `${cnt.attested + cnt.partial + cnt.gap} key controls`,
              onClick: label === 'Today' ? () => showControls('all') : undefined,
              parts: [{ value: cnt.attested, color: CONTROL_STATUS_COLOR.attested, label: 'Attested' }, { value: cnt.partial, color: CONTROL_STATUS_COLOR.partial, label: 'Partial' }, { value: cnt.gap, color: CONTROL_STATUS_COLOR.gap, label: 'Gap' }],
            }))}
          />
          <div className="grid g2" style={{ marginTop: 14, gap: 14 }}>
            <div>
              <div className="section-label">Improved ({improved.length})</div>
              <div className="list">
                {improved.map((k) => (
                  <button key={k.id} className="list-row" onClick={() => setOpen(k)}>
                    <ArrowUpRight size={14} color="var(--good)" />
                    <span className="list-main"><b>{k.name}</b><span>{k.lastOk} → {k.ok} of {k.tests.length} tests</span></span>
                  </button>
                ))}
                {!improved.length && <div className="empty">No controls improved.</div>}
              </div>
            </div>
            <div>
              <div className="section-label">Regressed ({regressed.length})</div>
              <div className="list">
                {regressed.map((k) => (
                  <button key={k.id} className="list-row" onClick={() => setOpen(k)}>
                    <ArrowDownRight size={14} color="var(--bad)" />
                    <span className="list-main"><b>{k.name}</b><span>{k.lastOk} → {k.ok} of {k.tests.length} tests</span></span>
                  </button>
                ))}
                {!regressed.length && <div className="empty">Nothing went backwards.</div>}
              </div>
            </div>
          </div>
        </Card>

        <Card title={<><CalendarClock size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Underwriting readiness</>} sub={`Renewal with ${c.insurance.carrier} via ${c.insurance.broker} in ${c.insurance.renewalDays} days`}>
          <div className="mini-stats" style={{ marginBottom: 12 }}>
            <button className="mini-stat cc-link" onClick={() => nav('/insurance/pack')} title="Source: HexaView evidence pack · click to open"><b style={{ color: INS_TONE }}>{packAnswered}/{pack.length}</b><span>pack answers attested</span></button>
            <button className="mini-stat cc-link" onClick={() => showControls(counts.gap ? 'gap' : 'partial')} title="Source: HexaComply control attestation · click to open"><b>{counts.gap + counts.partial}</b><span>controls to close</span></button>
            <button className="mini-stat cc-link" onClick={() => nav('/insurance/policy?view=renewal')} title={`Source: ${c.insurance.broker} timeline · click to open`}><b>{fmtNum(Math.max(0, c.insurance.renewalDays - 50))} d</b><span>to submission</span></button>
          </div>
          <div className="ins-steps">
            {miles.map((m) => {
              const isNext = m === next;
              const color = m.done ? 'var(--good)' : isNext ? INS_TONE : 'var(--track)';
              return (
                <div key={m.label} className={`ins-step ${isNext ? 'active' : ''}`}>
                  <span className="t">{m.done ? 'Done' : m.inDays === 0 ? 'Today' : `in ${m.inDays} d`}</span>
                  <span className="d" style={{ background: color, ['--tone' as string]: color }} />
                  <span>
                    <b>{m.label}</b>
                    <span className="x">{m.detail}</span>
                  </span>
                  <span className="muted" style={{ fontSize: 11 }}>{fmtDateShort(daysAhead(m.inDays))}</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 10 }}>
            <Bar value={miles.filter((m) => m.done).length} max={miles.length} color={INS_TONE} />
          </div>
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <Btn sm primary color={INS_TONE} onClick={() => nav('/insurance/pack')}>Open evidence pack</Btn>
            <Btn sm onClick={() => nav('/insurance/policy')}>Policy & renewal</Btn>
          </div>
        </Card>
      </div>

      {open && <ControlDrawer control={open} onClose={() => setOpen(null)} />}
      {rec === 'tests' && (
        <RecordsDrawer
          title="Insurer control tests"
          sub={`${h.attestedControls} of ${h.totalControls} attested from live connectors`}
          sources={[...new Map(ctl.flatMap((k) => k.sources).map((s) => [s.name, { name: s.name, status: s.stale && s.status === 'healthy' ? 'degraded' as const : s.status }])).values()]}
          onClose={() => setRec(null)}
          rows={ctl.flatMap((k) => k.tests.map((t) => ({
            key: t.id,
            title: t.q,
            sub: `${t.id} · ${k.name} · ${k.sources.map((s) => s.name).join(', ') || 'manual'} · ${t.evidenceRef}`,
            badge: <Badge color={t.ok ? 'var(--good)' : 'var(--sev-medium)'} dot>{t.ok ? 'Attested' : 'Not attested'}</Badge>,
            onClick: () => { setRec(null); setOpen(k); },
          })))}
        />
      )}
      {rec === 'drivers' && (
        <RecordsDrawer
          title="Premium drivers"
          sub={`${money(prof.currentPremium, c)} → ${money(prof.modelledPremium, c)} (${h.premiumDeltaPct > 0 ? '+' : ''}${h.premiumDeltaPct}%)`}
          source={`HexaView premium model v2 · control state from HexaComply · market index from ${c.insurance.broker}`}
          onClose={() => setRec(null)}
          rows={drivers.map((d) => ({
            key: d.label,
            title: d.label,
            sub: d.kind === 'control' ? `Control: ${ctl.find((k) => k.id === d.controlId)?.name ?? ''}${d.fixable ? ' · fixable before submission' : ''}` : d.kind === 'market' ? 'Market movement' : 'Claims history',
            right: <span style={{ color: d.pts <= 0 ? 'var(--good)' : 'var(--bad)' }}>{d.pts > 0 ? '+' : ''}{d.pts.toFixed(1)} pts</span>,
            onClick: d.controlId ? () => { const k = ctl.find((x) => x.id === d.controlId); setRec(null); if (k) setOpen(k); } : undefined,
          }))}
        />
      )}
    </>
  );
}
