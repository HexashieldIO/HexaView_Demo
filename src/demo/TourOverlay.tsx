import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Lightbulb, X } from 'lucide-react';
import { STORY_BY_ID } from './stories';
import { findTarget, tour, useTour } from './tour';
import './demo.css';

type Box = { top: number; left: number; width: number; height: number };
const PAD = 8;
const CARD_W = 380;

/** Narrator card + spotlight for the active guided story. Drives navigation between steps. */
export function TourOverlay() {
  const t = useTour();
  const nav = useNavigate();
  const loc = useLocation();
  const story = t ? STORY_BY_ID[t.storyId] : undefined;
  const step = story?.steps[t!.step];
  const [box, setBox] = useState<Box | null>(null);
  const [ready, setReady] = useState(false);
  const target = useRef<HTMLElement | null>(null);

  // Navigate to the step's page when the step changes.
  useEffect(() => {
    if (!step) return;
    if (loc.pathname + loc.search !== step.path) nav(step.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.storyId, t?.step]);

  // Find the target once the page has rendered, then keep the spotlight on it.
  useLayoutEffect(() => {
    target.current = null;
    setBox(null);
    setReady(false);
    if (!step) return;
    let tries = 0;
    let scrolls = 0;
    let lastScroll = 0;
    const id = window.setInterval(() => {
      const onPage = loc.pathname === step.path.split('?')[0];
      if (!target.current && onPage) {
        target.current = findTarget(step.target);
        tries++;
      }
      const el = target.current;
      // Centre the target; re-centre if the page's own scroll-to-top moved it away.
      if (el && scrolls < 4 && Date.now() - lastScroll > 700) {
        const r = el.getBoundingClientRect();
        const off = r.top < 70 || r.bottom > window.innerHeight - 40;
        if (scrolls === 0 || off) {
          el.scrollIntoView({ behavior: 'smooth', block: r.height > window.innerHeight - 140 ? 'start' : 'center' });
          scrolls++;
          lastScroll = Date.now();
        }
      }
      if (el && document.contains(el)) {
        const r = el.getBoundingClientRect();
        setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
        setReady(true);
      } else if (tries > 20 || (onPage && !step.target)) {
        setReady(true); // no target: centred card
      }
    }, 150);
    return () => window.clearInterval(id);
  }, [step, loc.pathname]);

  // Keyboard: → / Enter next, ← back, Esc exit.
  useEffect(() => {
    if (!t || !story) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
      if (e.key === 'Escape') tour.stop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!t || !story || !step) return null;
  const last = t.step === story.steps.length - 1;
  const next = () => (last ? tour.stop() : tour.go(t.step + 1));
  const back = () => t.step > 0 && tour.go(t.step - 1);

  // Card placement: beside the target if there is room, else below/above, else bottom-right.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cardStyle: CSSProperties = { right: 24, bottom: 24 };
  if (box) {
    const below = box.top + box.height + 14;
    const spaceRight = vw - (box.left + box.width);
    if (spaceRight > CARD_W + 40 && box.height < vh - 120) cardStyle = { left: box.left + box.width + 16, top: Math.min(Math.max(16, box.top), vh - 300) };
    else if (below + 260 < vh) cardStyle = { left: Math.min(Math.max(16, box.left), vw - CARD_W - 16), top: below };
    else if (box.top - 274 > 0) cardStyle = { left: Math.min(Math.max(16, box.left), vw - CARD_W - 16), top: box.top - 274 };
  }

  return createPortal(
    <div className="tour" style={{ '--story': story.color } as CSSProperties}>
      {box ? (
        <div className="tour-spot" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className={`tour-card ${ready ? 'in' : ''}`} style={cardStyle} key={`${t.storyId}-${t.step}`} role="dialog" aria-label={`${story.title}, step ${t.step + 1}`}>
        <div className="tour-head">
          <span className="tour-story"><i /> {story.title}</span>
          <span className="tour-count">{t.step + 1} / {story.steps.length}</span>
          <button className="tour-x" onClick={() => tour.stop()} aria-label="Exit the story" title="Exit (Esc)"><X size={15} /></button>
        </div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        {step.tip && <div className="tour-tip"><Lightbulb size={13} /> {step.tip}</div>}
        <div className="tour-pips">
          {story.steps.map((s, i) => (
            <button key={i} className={i === t.step ? 'on' : i < t.step ? 'done' : ''} onClick={() => tour.go(i)} title={s.title} aria-label={`Step ${i + 1}: ${s.title}`} />
          ))}
        </div>
        <div className="tour-actions">
          <button className="tour-btn ghost" onClick={back} disabled={t.step === 0}><ArrowLeft size={14} /> Back</button>
          <span className="tour-keys">← → to step · Esc to exit</span>
          <button className="tour-btn" onClick={next}>{last ? <><Check size={14} /> Finish</> : <>Next <ArrowRight size={14} /></>}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
