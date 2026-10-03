import { useMemo, useState, type CSSProperties } from 'react';
import { useApp } from '../../../state/AppContext';
import { Card, Chip, Legend, Bar, Badge } from '../../../components/ui';
import { JURISDICTIONS, JUR_HEX, STAGE_HEX, type Reg, type RegStage } from '../../../data/modules/horizon';
import { fmtMoney, scoreTone } from '../../../lib/format';
import { useHorizon, useHzNav, whenLabel, FwLinks, HZ_TONE } from './state';
import { RegDrawer } from './RegDrawer';

const FROM = -6;
const TO = 24;
const pos = (m: number) => ((Math.max(FROM, Math.min(TO, m)) - FROM) / (TO - FROM)) * 100;

export default function Timeline() {
  const { customer: c } = useApp();
  const { regs } = useHorizon();
  const { sp, set } = useHzNav();
  const [sel, setSel] = useState<Reg | null>(() => regs.find((r) => r.id === sp.get('id')) ?? null);
  const jur = sp.get('jur') ?? 'all';
  const win = sp.get('window');
  const cert = sp.get('certainty') ?? 'all';
  const shown = regs.filter((r) => (jur === 'all' || r.jur === jur) && (cert === 'all' || r.certainty === cert) && (!win || (r.months >= 0 && r.months <= Number(win)) || (win === 'applying' && r.months < 0)));

  const lanes = useMemo(() => {
    return JURISDICTIONS.map((j) => {
      const items = shown.filter((r) => r.jur === j).sort((a, b) => a.months - b.months);
      const rowEnds: number[] = [];
      const placed = items.map((r) => {
        const p = Math.min(pos(r.months), 84);
        let row = rowEnds.findIndex((e) => p - e >= 17);
        if (row === -1) { row = rowEnds.length; rowEnds.push(p); } else rowEnds[row] = p;
        return { r, p, row };
      });
      return { j, placed, rows: Math.max(1, rowEnds.length) };
    }).filter((l) => l.placed.length);
  }, [shown]);

  const now = new Date();
  const ticks: { m: number; label: string }[] = [];
  for (let m = FROM; m <= TO; m += 3) {
    const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
    ticks.push({ m, label: m === 0 ? '' : d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) });
  }

  const buckets: { label: string; sub: string; items: Reg[] }[] = [
    { label: 'Applying now', sub: 'Obligations already in effect: close the remaining gaps', items: shown.filter((r) => r.months < 0) },
    { label: 'Next 6 months', sub: 'Plan and fund now', items: shown.filter((r) => r.months >= 0 && r.months <= 6) },
    { label: '6 to 12 months', sub: 'Scope and assign owners', items: shown.filter((r) => r.months > 6 && r.months <= 12) },
    { label: '12 months +', sub: 'Watch and respond to consultations', items: shown.filter((r) => r.months > 12) },
  ];
  const stages = Array.from(new Set(regs.map((r) => r.stage))) as RegStage[];

  return (
    <>
      <Card
        title="Regulatory horizon"
        count={shown.length}
        sub={`Regulation relevant to ${c.name} (${c.sector}, ${c.hq}) by jurisdiction, ${Math.abs(FROM)} months back to ${TO} months ahead · click a marker for impact`}
        actions={
          <span className="chips">
            <Chip on={jur === 'all'} onClick={() => set('jur', null)}>All</Chip>
            {JURISDICTIONS.filter((j) => regs.some((r) => r.jur === j)).map((j) => (
              <Chip key={j} on={jur === j} color={JUR_HEX[j]} onClick={() => set('jur', jur === j ? null : j)}>{j}</Chip>
            ))}
          </span>
        }
      >
        <div className="row wrap" style={{ gap: 8, marginBottom: 10 }}>
          <span className="chips">
            <Chip on={!win} onClick={() => set('window', null)}>Whole horizon</Chip>
            <Chip on={win === 'applying'} onClick={() => set('window', 'applying')}>Applying now</Chip>
            <Chip on={win === '12'} onClick={() => set('window', '12')}>Next 12 months</Chip>
          </span>
          <span className="chips">
            <Chip on={cert === 'all'} onClick={() => set('certainty', null)}>Any date</Chip>
            <Chip on={cert === 'confirmed'} onClick={() => set('certainty', 'confirmed')}>Confirmed dates</Chip>
            <Chip on={cert === 'expected'} onClick={() => set('certainty', 'expected')}>Expected dates</Chip>
          </span>
          <span className="spacer" />
          <Legend items={[...stages.map((s) => ({ label: s, color: STAGE_HEX[s] })), { label: 'Dashed = date expected', color: 'transparent' }]} />
        </div>
        <div className="hz-tl">
          <div className="hz-tl-axis">
            {ticks.map((t) => <span key={t.m} style={{ left: `${pos(t.m)}%` }}>{t.label}</span>)}
          </div>
          {lanes.map((l) => (
            <div key={l.j} className="hz-tl-lane">
              <div className="hz-tl-name"><i style={{ background: JUR_HEX[l.j] }} />{l.j}</div>
              <div className="hz-tl-track" style={{ height: l.rows * 28 + 10 }}>
                <div className="hz-tl-past" style={{ width: `${pos(0)}%` }} />
                {ticks.map((t) => <div key={t.m} className="hz-tl-grid" style={{ left: `${pos(t.m)}%` }} />)}
                {l.placed.map(({ r, p, row }) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`hz-mk ${r.certainty === 'expected' ? 'expected' : ''}`}
                    style={{ left: `calc(${p}% - 8px)`, top: 6 + row * 28, '--tone': STAGE_HEX[r.stage] } as CSSProperties}
                    onClick={() => setSel(r)}
                    title={`${r.name} · ${r.dateLabel} · readiness ${r.readiness}%`}
                  >
                    <i />
                    <span>{r.short}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {lanes.length > 0 && (
            <div className="hz-tl-today" style={{ left: `calc(132px + (100% - 132px) * ${pos(0) / 100})` }}><b>Today</b></div>
          )}
        </div>
        {!lanes.length && <div className="empty">No regulations match these filters.</div>}
      </Card>

      <div className="grid g2">
        {buckets.map((b) => (
          <Card key={b.label} title={b.label} count={b.items.length} sub={b.sub} toneColor={HZ_TONE}>
            <div className="hz-bucket">
              {b.items.map((r) => (
                <button key={r.id} type="button" className="hz-row" onClick={() => setSel(r)} title="Source: HexaShield regulatory intelligence · HexaComply mapping">
                  <span className="hz-when" style={{ color: r.months < 0 ? 'var(--good)' : r.months <= 6 ? 'var(--sev-high)' : undefined }}>
                    {whenLabel(r.months)}
                    <small className="muted" style={{ display: 'block' }}>{r.certainty}</small>
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <b>{r.short} <Badge color={JUR_HEX[r.jur]}>{r.jur}</Badge></b>
                    <small>{r.dateLabel} · {r.owner.name}</small>
                    <span style={{ display: 'block', marginTop: 3 }}><FwLinks reg={r} /></span>
                  </span>
                  <span>
                    <Bar value={r.readiness} color={scoreTone(r.readiness)} size="thin" />
                    <small className="muted" style={{ fontSize: 10.5 }}>{r.readiness}% ready · {r.gaps} gaps</small>
                  </span>
                  <span className="num" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(r.cost, c.currency)}</span>
                </button>
              ))}
              {!b.items.length && <div className="empty">Nothing in this window.</div>}
            </div>
          </Card>
        ))}
      </div>
      {sel && <RegDrawer reg={regs.find((r) => r.id === sel.id) ?? sel} onClose={() => setSel(null)} />}
    </>
  );
}
