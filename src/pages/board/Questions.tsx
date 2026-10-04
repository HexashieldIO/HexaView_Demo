import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageSquarePlus, HelpCircle } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, Badge, Btn, Chip } from '../../components/ui';
import { useIntro } from '../../lib/useIntro';
import { RAG_COLOR, RAG_HEX, RAG_LABEL, type Rag } from '../../data/modules/boardMeeting';
import { useBm, useBmNav, BM_TONE } from './state';

const RAGS: Rag[] = ['red', 'amber', 'green'];

export default function Questions() {
  const { customer: c, toast } = useApp();
  const nav = useNavigate();
  const { questions, m } = useBm();
  const { sp, set } = useBmNav();
  const anim = useIntro(`bm-q-${c.id}`, 1500);
  const rag = (sp.get('rag') as Rag | null) ?? null;
  const theme = sp.get('theme');
  const themes = Array.from(new Set(questions.map((q) => q.theme)));
  const shown = questions.filter((q) => (!rag || q.rag === rag) && (!theme || q.theme === theme));
  const counts = RAGS.map((r) => questions.filter((q) => q.rag === r).length);

  // Donut
  const R = 46;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const grow = Math.min(1, anim(1, 0, 1200));

  return (
    <>
      <Card title="Questions directors should ask" sub={`Each answer is assembled from live HexaView data for ${c.name}, rated red, amber or green, and links to the evidence`} toneColor={BM_TONE}>
        <div className="bm-qhead">
          <div className="bm-donut">
            <svg viewBox="0 0 120 120" width={120} height={120} aria-hidden>
              <circle cx={60} cy={60} r={R} fill="none" stroke="var(--track)" strokeWidth={14} />
              {RAGS.map((r, i) => {
                const frac = counts[i] / Math.max(1, questions.length);
                const seg = <circle key={r} cx={60} cy={60} r={R} fill="none" stroke={RAG_HEX[r]} strokeWidth={14} strokeDasharray={`${Math.max(0, frac * C * grow - 2)} ${C}`} strokeDashoffset={-acc * C * grow} transform="rotate(-90 60 60)" />;
                acc += frac;
                return seg;
              })}
            </svg>
            <span><b className="num">{questions.length}</b><small>questions</small></span>
          </div>
          <div className="bm-qstats">
            {RAGS.map((r, i) => (
              <button key={r} type="button" className={`bm-qstat ${rag === r ? 'on' : ''}`} style={{ '--tone': RAG_COLOR[r] } as CSSProperties} onClick={() => set('rag', rag === r ? null : r)} title={`Source: HexaView answer engine · filter to ${RAG_LABEL[r].toLowerCase()} answers`}>
                <b className="num">{Math.round(anim(counts[i]))}</b>
                <span>{RAG_LABEL[r]}</span>
              </button>
            ))}
          </div>
          <div className="bm-qintro">
            <p>These are the questions regulators, insurers and governance codes expect directors to ask about cyber risk. Bring the red and amber ones to the {m.committee.toLowerCase()} on {m.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.</p>
            <div className="chips" style={{ marginTop: 8 }}>
              <Chip on={!theme} onClick={() => set('theme', null)}>All themes</Chip>
              {themes.map((t) => <Chip key={t} on={theme === t} onClick={() => set('theme', theme === t ? null : t)}>{t}</Chip>)}
            </div>
          </div>
        </div>
      </Card>

      <div className="bm-qgrid">
        {shown.map((q, i) => (
          <article key={q.id} className="bm-q" style={{ '--tone': RAG_COLOR[q.rag], animationDelay: `${i * 50}ms` } as CSSProperties}>
            <header>
              <HelpCircle size={16} className="bm-q-ico" />
              <h4>{q.q}</h4>
              <Badge color={RAG_COLOR[q.rag]} solid={q.rag === 'red'}>{RAG_LABEL[q.rag]}</Badge>
            </header>
            <p>{q.answer}</p>
            <div className="bm-facts">
              {q.facts.map((f) => (
                f.path
                  ? <button key={f.label} type="button" onClick={() => nav(f.path!)} title={`Source: ${q.evidence.source} · open the records`}><b>{f.value}</b><span>{f.label}</span></button>
                  : <div key={f.label}><b>{f.value}</b><span>{f.label}</span></div>
              ))}
            </div>
            <div className="bm-q-follow"><span>Follow-up</span> {q.followUp}</div>
            <footer>
              <span className="muted" style={{ fontSize: 11 }}>{q.theme} · {q.evidence.source}</span>
              <span className="row" style={{ gap: 6 }}>
                <Btn sm ghost onClick={() => toast(`Question added to the ${m.committee} agenda under item 2 · ${m.secretary.name} notified`)}><MessageSquarePlus /> Add to agenda</Btn>
                <Btn sm color={BM_TONE} onClick={() => nav(q.evidence.path)}>Show the evidence <ArrowRight /></Btn>
              </span>
            </footer>
          </article>
        ))}
        {!shown.length && <div className="empty">No questions match this filter.</div>}
      </div>
    </>
  );
}
