import { type CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import { LINK_ORDER, LOOP_STATUS_COLOR, type LinkKey, type loopSummary } from '../../data/core';
import { LINK_ICON } from './loopParts';
import { hexPath } from '../../components/ui';

/**
 * The closed loop, live: the six links run across the bottom of the Index, each
 * in the colour of the module that owns it, with a signal travelling the chain
 * and a return sweep when the loop closes. CSS-driven (no rAF) so it keeps time
 * in a background tab, and still under prefers-reduced-motion.
 */
const LINK_TONE: Record<LinkKey, string> = {
  requirement: 'var(--m-comply)',
  control: 'var(--m-trust)',
  evidence: 'var(--m-custody)',
  technique: 'var(--m-matrix)',
  detection: 'var(--m-soc)',
  validation: 'var(--m-strike)',
};

export function HeroLoop({ s, lastEvalMin, onOpen }: {
  s: ReturnType<typeof loopSummary>;
  lastEvalMin: number;
  onOpen: (q?: string) => void;
}) {
  const open = s.partial + s.broken;
  return (
    <div className="hl">
      <div className="hl-top">
        <button className="hl-score" onClick={() => onOpen()} title="Open Closed-Loop Assurance">
          <span className="hl-eyebrow">Closed-loop assurance<i className="hl-beat" /></span>
          <span className="hl-pct"><b>{s.assuredPct}</b><small>%</small><em>assured</em></span>
          <span className="hl-sub">{s.closed.toLocaleString()} of {s.applicable.toLocaleString()} loops closed · evaluated {lastEvalMin < 60 ? `${lastEvalMin} min` : `${Math.round(lastEvalMin / 60)} h`} ago</span>
        </button>
        <span className="hl-spacer" />
        <button className="hl-stat ok" onClick={() => onOpen('status=closed')} title="Loops closed end to end">
          <i style={{ background: LOOP_STATUS_COLOR.closed }} />{s.closed.toLocaleString()}<small>closed</small>
        </button>
        <button className="hl-stat warn" onClick={() => onOpen('status=partial')} title="Loops with a missing or failing link">
          <i style={{ background: open ? LOOP_STATUS_COLOR.partial : LOOP_STATUS_COLOR.closed }} />{open.toLocaleString()}<small>to fix</small>
        </button>
        <button className="hl-go" onClick={() => onOpen()}>Watch it run <ArrowRight size={13} /></button>
      </div>

      <div className="hl-flow">
        <span className="hl-rail" aria-hidden />
        <span className="hl-glow" aria-hidden />
        <span className="hl-packet" aria-hidden />
        <div className="hl-nodes">
          {LINK_ORDER.map((l, i) => {
            const Icon = LINK_ICON[l.key];
            return (
              <button
                key={l.key}
                className="hl-node"
                style={{ '--i': i, '--c': LINK_TONE[l.key] } as CSSProperties}
                onClick={() => onOpen(`missing=${l.key}`)}
                title={`${l.label} · from ${l.from} — show loops with a gap here`}
              >
                <span className="hl-hex">
                  <span className="hl-ring" aria-hidden />
                  <svg width={38} height={38} viewBox="0 0 38 38" aria-hidden>
                    <path d={hexPath(19, 19, 17)} className="hl-hex-bg" />
                  </svg>
                  <Icon size={15} />
                </span>
                <small>{l.label === 'ATT&CK technique' ? 'ATT&CK' : l.label}</small>
              </button>
            );
          })}
        </div>
        <span className="hl-return" aria-hidden><i /></span>
      </div>
    </div>
  );
}
