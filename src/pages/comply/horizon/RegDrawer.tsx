import { useNavigate } from 'react-router-dom';
import { ListPlus, Scale } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { Drawer } from '../../../components/Overlay';
import { Badge, Bar, Btn, IcoBox, KV, SectionLabel, StatusBadge } from '../../../components/ui';
import { JUR_HEX, STAGE_HEX, FEED_COLOR, type Reg } from '../../../data/modules/horizon';
import { fmtMoney, fmtNum, scoreTone } from '../../../lib/format';
import { rng } from '../../../lib/rng';
import { FwLinks, HZ_TONE, useHorizon, whenLabel } from './state';

export function RegDrawer({ reg, onClose }: { reg: Reg; onClose: () => void }) {
  const { customer: c } = useApp();
  const { openRaise } = useHorizon();
  const nav = useNavigate();
  const r = rng(`hz-themes-${c.id}-${reg.id}`);
  // Split controls and gaps across the affected control areas.
  let left = reg.gaps;
  const themes = reg.themes.map((t, i) => {
    const ctl = Math.max(2, Math.round(reg.controls / reg.themes.length) + r.int(-2, 2));
    const gap = i === reg.themes.length - 1 ? Math.max(0, left) : Math.min(left, Math.max(0, Math.round(reg.gaps / reg.themes.length) + r.int(-1, 1)));
    left -= gap;
    return { t, ctl, gap: Math.min(gap, ctl) };
  });
  return (
    <Drawer
      title={reg.name}
      sub={`${reg.jur} · ${reg.stage} · ${reg.dateLabel}`}
      icon={<IcoBox color={JUR_HEX[reg.jur]}><Scale /></IcoBox>}
      onClose={onClose}
      wide
      footer={
        <>
          <Btn primary color={HZ_TONE} onClick={() => openRaise(reg)}><ListPlus /> Raise tasks</Btn>
          <Btn onClick={() => nav(`/comply/caas?section=frameworks${reg.fwShorts[0] ? `&framework=${reg.fwShorts[0].id}` : ''}`)}>Open frameworks</Btn>
          <Btn onClick={() => nav('/comply/caas?section=tasks')}>Open tasks</Btn>
        </>
      }
    >
      <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
        <Badge color={STAGE_HEX[reg.stage]} dot>{reg.stage}</Badge>
        <Badge color={reg.certainty === 'confirmed' ? 'var(--good)' : 'var(--sev-medium)'}>{reg.certainty === 'confirmed' ? 'Date confirmed' : 'Date expected'}</Badge>
        {reg.update && <StatusBadge value={reg.feedStatus} map={FEED_COLOR} />}
        {reg.raised > 0 && <Badge color={HZ_TONE}>{reg.raised} tasks raised</Badge>}
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{reg.what}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: '1px solid var(--hairline)', borderRadius: 10, overflow: 'hidden', marginBottom: 14, flexShrink: 0 }}>
        {[
          ['Applies', whenLabel(reg.months), undefined],
          ['Readiness', `${reg.readiness}%`, scoreTone(reg.readiness)],
          ['Open gaps', fmtNum(reg.gaps), reg.gaps > 8 ? 'var(--bad)' : undefined],
          ['Est. cost', fmtMoney(reg.cost, c.currency), undefined],
        ].map(([k, v, col]) => (
          <div key={k} style={{ padding: '9px 12px', borderRight: '1px solid var(--hairline)' }}>
            <small style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{k}</small>
            <b style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: col }}>{v}</b>
          </div>
        ))}
      </div>
      <KV rows={[
        ['Jurisdiction', reg.jur],
        ['Next obligation', reg.dateLabel],
        ['Owner', `${reg.owner.name}, ${reg.owner.role}`],
        ['Entities in scope', reg.tenantNames.join(', ')],
        ['Frameworks affected', reg.fwShorts.length ? <FwLinks reg={reg} /> : 'Group control set'],
        ['Effort estimate', `${fmtNum(reg.effortDays)} person-days`],
        ['Controls affected', fmtNum(reg.controls)],
      ]} />
      <SectionLabel>Affected control areas</SectionLabel>
      <div className="hz-themes">
        {themes.map((t) => (
          <div key={t.t} className="hz-theme">
            <span>{t.t}</span>
            <Bar value={t.ctl - t.gap} max={t.ctl} color={t.gap ? scoreTone(((t.ctl - t.gap) / t.ctl) * 100) : 'var(--good)'} />
            <span className="muted" style={{ textAlign: 'right' }}>{t.gap ? `${t.gap} gap${t.gap > 1 ? 's' : ''}` : 'Met'}</span>
          </div>
        ))}
      </div>
      {reg.update && (
        <>
          <SectionLabel>Latest change · {reg.update.source}</SectionLabel>
          <div className="hz-item" style={{ padding: 10 }}>
            <b style={{ fontSize: 12.5 }}>{reg.update.title}</b>
            <div className="hz-two">
              <div><h5>What changed</h5><p>{reg.update.changed}</p></div>
              <div><h5>What you need to do</h5><p>{reg.update.todo}</p></div>
            </div>
          </div>
        </>
      )}
      <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>Source: HexaShield regulatory intelligence, mapped to {c.name} frameworks in HexaComply. Dates are indicative and hedged where not fixed in law; confirm with counsel.</p>
    </Drawer>
  );
}
