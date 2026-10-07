import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Clapperboard, Clock, Play, RotateCcw, Square, Users } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { CUSTOMER_LIST } from '../data/customers';
import { Modal } from '../components/Overlay';
import { STORIES, STORY_BY_ID, type Story } from './stories';
import { resetDemo, tour, useTour } from './tour';
import { usePanelFit } from '../components/usePanelFit';

/** Topbar "Demo" button: guided stories for presenters, and a full reset. */
export function DemoMenu() {
  const { setCustomerId, setPersona, setAccount, setTenantId } = useApp();
  const active = useTour();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  usePanelFit(panelRef, open);
  const [confirm, setConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // Presenter shortcut: Ctrl+Shift+R resets the demo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'r') { e.preventDefault(); setConfirm(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const play = (s: Story) => {
    setOpen(false);
    setAccount('customer');
    setCustomerId(s.customer);
    setTenantId('all');
    setPersona(s.persona);
    tour.start(s.id);
  };
  const playing = active ? STORY_BY_ID[active.storyId] : undefined;
  const customerName = (id: string) => CUSTOMER_LIST.find((c) => c.id === id)?.short ?? id;

  return (
    <div className="dm-wrap" ref={ref}>
      <button className={`tb-ctl dm-btn ${playing ? 'live' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Guided demo stories">
        <Clapperboard size={15} />
        <span>{playing ? `${playing.title} · ${active!.step + 1}/${playing.steps.length}` : 'Demo'}</span>
      </button>
      {open && (
        <div ref={panelRef} className="dm-panel" role="dialog" aria-label="Guided demo stories">
          <div className="dm-head">
            <b>Guided demo stories</b>
            <span>Each story sets the customer and role, then walks you page to page with a narrator card.</span>
          </div>
          <div className="dm-list">
            {STORIES.map((s) => (
              <div key={s.id} className={`dm-story ${playing?.id === s.id ? 'on' : ''}`} style={{ '--story': s.color } as CSSProperties}>
                <div className="dm-story-main">
                  <b>{s.title}</b>
                  <p>{s.blurb}</p>
                  <span className="dm-meta">
                    <span><Users size={11} /> {s.audience}</span>
                    <span><Clock size={11} /> {s.minutes} min · {s.steps.length} steps · {customerName(s.customer)}</span>
                  </span>
                </div>
                <button className="dm-play" onClick={() => play(s)} aria-label={`Play ${s.title}`}><Play size={14} /></button>
              </div>
            ))}
          </div>
          <div className="dm-foot">
            {playing && <button className="dm-act" onClick={() => { tour.stop(); setOpen(false); }}><Square size={13} /> Stop story</button>}
            <button className="dm-act danger" onClick={() => { setOpen(false); setConfirm(true); }}><RotateCcw size={13} /> Reset demo</button>
            <span className="dm-kbd">Ctrl+Shift+R</span>
          </div>
        </div>
      )}
      {confirm && (
        <Modal
          title="Reset the demo?"
          sub="Puts everything back to its starting state for the next pitch"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
              <button className="btn primary" onClick={() => resetDemo('/')}><RotateCcw size={13} /> Reset demo</button>
            </>
          }
        >
          <ul className="dm-reset-list">
            <li>Customer back to Halcyon Ports &amp; Shipping, role back to Master user (Admin)</li>
            <li>Every in-demo change cleared: approvals, patched assets, takedowns, uploads, answers and notifications read</li>
            <li>Any running story stopped</li>
            <li>You stay signed in, and your light or dark theme is kept</li>
          </ul>
        </Modal>
      )}
    </div>
  );
}
