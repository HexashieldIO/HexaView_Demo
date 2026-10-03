import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Plus, Send, Search, AlertTriangle, CheckCircle2, Wrench, FileSearch, ArrowRight, Database } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { headlines } from '../../data/core';
import { scopedConnectors, tenantName } from '../../data/customers';
import {
  copilotAnswer, copilotHistory, copilotQuestions, matchQuestion,
  type CitedRecord, type CopilotAnswer,
} from '../../data/modules/ai';
import { Badge, Btn, Callout, Card, KpiStrip, KV, Sources, Tabs } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { fmtAgo, fmtNum } from '../../lib/format';
import { AI_TONE, ApprovalModal, SafetyNotes } from './parts';
import './ai.css';

interface UserMsg { role: 'user'; text: string }
interface BotMsg { role: 'assistant'; qid: string; answer: CopilotAnswer; tenant: string }
type Msg = UserMsg | BotMsg;
interface Conv { id: string; title: string; minAgo: number; by: string; messages: Msg[] }
interface Stream { convId: string; idx: number; phase: 'tools' | 'stream' | 'done'; tools: number; words: number }

const isNumeric = (s: string) => /\d/.test(s);

function countWords(a: CopilotAnswer) {
  return a.sentences.reduce((n, s) => n + s.text.split(' ').length, 0);
}

export default function Copilot() {
  const { customer } = useApp();
  return <CopilotInner key={customer.id} />;
}

function CopilotInner() {
  const { customer: c, tenantId, persona, timeRange, toast } = useApp();
  const nav = useNavigate();
  const h = headlines(c, tenantId);
  const days = rangeDays(timeRange);
  const questions = useMemo(() => {
    const qs = copilotQuestions(c);
    return [...qs.filter((q) => q.personas.includes(persona)), ...qs.filter((q) => !q.personas.includes(persona))];
  }, [c, persona]);

  const [convs, setConvs] = useState<Conv[]>(() => [
    { id: 'new', title: 'New conversation', minAgo: 0, by: 'You', messages: [] },
    ...copilotHistory(c).map((x) => ({
      id: x.id, title: x.title, minAgo: x.minAgo, by: x.by,
      messages: [{ role: 'user', text: x.title } as Msg, { role: 'assistant', qid: x.qid, answer: copilotAnswer(c, 'all', x.qid), tenant: 'all' } as Msg],
    })),
  ]);
  const [active, setActive] = useState('new');
  const [stream, setStream] = useState<Stream | null>(null);
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState('');
  const [cite, setCite] = useState<{ rec: CitedRecord; n: number } | null>(null);
  const [draft, setDraft] = useState<{ key: string; answer: CopilotAnswer } | null>(null);
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [panel, setPanel] = useState<'how' | 'safety'>('how');
  const scrollRef = useRef<HTMLDivElement>(null);

  const conv = convs.find((x) => x.id === active) ?? convs[0];
  const lastBotIdx = conv.messages.map((m, i) => (m.role === 'assistant' ? i : -1)).filter((i) => i >= 0).pop();
  const shownIdx = focusIdx ?? lastBotIdx;
  const shownMsg = shownIdx !== undefined ? (conv.messages[shownIdx] as BotMsg | undefined) : undefined;

  // Drive the tool-call reveal and token streaming.
  useEffect(() => {
    if (!stream || stream.phase === 'done') return;
    const msg = convs.find((x) => x.id === stream.convId)?.messages[stream.idx] as BotMsg | undefined;
    if (!msg) return;
    const total = countWords(msg.answer);
    const t = setTimeout(
      () => {
        setStream((s) => {
          if (!s) return s;
          if (s.phase === 'tools') return s.tools + 1 >= msg.answer.tools.length ? { ...s, tools: msg.answer.tools.length, phase: 'stream' } : { ...s, tools: s.tools + 1 };
          const w = s.words + 2;
          return w >= total ? { ...s, words: total, phase: 'done' } : { ...s, words: w };
        });
      },
      stream.phase === 'tools' ? 420 : 45,
    );
    return () => clearTimeout(t);
  }, [stream, convs]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [stream?.words, stream?.tools, active, conv.messages.length]);

  function ask(text: string, qidIn?: string) {
    if (!text.trim() || (stream && stream.phase !== 'done')) return;
    const qid = qidIn ?? matchQuestion(c, text) ?? 'free';
    const answer = copilotAnswer(c, tenantId, qid, text.trim());
    const target = conv;
    const idx = target.messages.length + 1;
    setConvs((cs) => {
      const next = cs.map((x) =>
        x.id === target.id
          ? { ...x, title: x.messages.length === 0 ? text.trim() : x.title, minAgo: 0, by: 'You', messages: [...x.messages, { role: 'user', text: text.trim() } as Msg, { role: 'assistant', qid, answer, tenant: tenantId } as Msg] }
          : x,
      );
      return next;
    });
    if (target.id === 'new') {
      // Keep a fresh "new" slot at the top; the asked conversation gets its own id.
      const id = `c${Date.now()}`;
      setConvs((cs) => [{ id: 'new', title: 'New conversation', minAgo: 0, by: 'You', messages: [] }, ...cs.map((x) => (x.id === 'new' ? { ...x, id } : x))]);
      setActive(id);
      setStream({ convId: id, idx, phase: 'tools', tools: 0, words: 0 });
    } else {
      setStream({ convId: target.id, idx, phase: 'tools', tools: 0, words: 0 });
    }
    setFocusIdx(null);
    setInput('');
    setPanel('how');
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  const streamingThis = (i: number) => stream && stream.convId === conv.id && stream.idx === i && stream.phase !== 'done' ? stream : null;
  const busy = !!stream && stream.phase !== 'done';

  // KPIs
  const queriesInRange = Math.round((h.ai.copilotQueries30d / 30) * days);
  const allAnswers = convs.flatMap((x) => x.messages.filter((m): m is BotMsg => m.role === 'assistant'));
  const factual = allAnswers.flatMap((m) => m.answer.sentences.filter((s) => !s.meta && isNumeric(s.text)));
  const citedPct = factual.length ? Math.round((factual.filter((s) => s.cites.length).length / factual.length) * 100) : 100;
  const conns = scopedConnectors(c, tenantId);

  const filteredConvs = convs.filter((x) => x.id === 'new' || x.title.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <p className="page-intro">
        <b>HexaAI Copilot</b> for {c.name} · {tenantName(c, tenantId)}. Answers are grounded in HexaCore records from {conns.length} integrations
        (e.g. {conns.slice(0, 4).map((k) => k.product).join(', ')}), every factual sentence is cited, and the copilot can draft, but never take, an action.
      </p>

      <KpiStrip
        toneColor={AI_TONE}
        items={[
          { label: 'Copilot queries', hint: rangeLabel(timeRange), value: fmtNum(queriesInRange), unit: `${fmtNum(h.ai.copilotQueries30d)} in 30 d`, onClick: () => { setActive(convs[1]?.id ?? 'new'); setFocusIdx(null); }, source: 'HexaAI copilot conversation log (90-day retention)' },
          { label: 'Numeric sentences cited', hint: 'this session', value: `${citedPct}%`, bar: citedPct, delta: { text: `${factual.length - factual.filter((s) => s.cites.length).length} flagged unverified`, good: true }, onClick: () => setPanel('how'), source: 'Citation binder · groundedness check' },
          { label: 'Avg tool calls / answer', value: allAnswers.length ? (allAnswers.reduce((s, m) => s + m.answer.tools.length, 0) / allAnswers.length).toFixed(1) : '—', onClick: () => setPanel('how'), source: 'hexaview-tools v2.3 call log' },
          { label: 'Action drafts submitted', hint: '30 d', value: fmtNum(Math.round(h.ai.copilotQueries30d * 0.012) + submitted.size), unit: 'via approval gate', to: '/ops/actions', source: 'HexaView approval gate' },
          { label: 'Autonomous actions', value: '0', unit: 'by design', toneColor: 'var(--good)', onClick: () => setPanel('safety'), source: 'Copilot tool contract: read-only tools only' },
        ]}
      />

      <div className="ai-cp">
        {/* Conversations */}
        <Card>
          <div className="ai-cp-head">
            <h3>Conversations</h3>
            <span className="spacer" />
            <Btn sm onClick={() => { setActive('new'); setFocusIdx(null); }} title="New conversation">
              <Plus /> New
            </Btn>
          </div>
          <div style={{ padding: '10px 14px 0' }}>
            <label className="search">
              <Search size={14} />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search history" aria-label="Search conversations" />
            </label>
          </div>
          <div className="ai-cp-scroll">
            {filteredConvs.map((x) => (
              <button key={x.id} className={`ai-conv ${x.id === active ? 'on' : ''}`} onClick={() => { setActive(x.id); setFocusIdx(null); }}>
                <b>{x.id === 'new' ? '+ New conversation' : x.title}</b>
                <span>{x.id === 'new' ? 'Ask anything about your estate' : `${x.by} · ${x.minAgo ? fmtAgo(x.minAgo) : 'just now'}`}</span>
              </button>
            ))}
          </div>
          <div className="ai-cp-foot">
            <div className="muted" style={{ fontSize: 11 }}>
              Retention: 90 days, tenant-scoped. Conversations are visible to you and Tenant Admins.
            </div>
          </div>
        </Card>

        {/* Chat */}
        <Card>
          <div className="ai-cp-head">
            <span className="ai-avatar"><Sparkles /></span>
            <div>
              <h3>{conv.id === 'new' ? 'New conversation' : conv.title}</h3>
              <div className="card-sub">Scope: {tenantName(c, tenantId)} · persona: {persona}</div>
            </div>
            <span className="spacer" />
            <Badge color={AI_TONE} dot>Read-only</Badge>
          </div>
          <div className="ai-cp-scroll" ref={scrollRef}>
            {conv.messages.length === 0 && (
              <div className="stack" style={{ gap: 14 }}>
                <div>
                  <h3 style={{ fontSize: 17 }}>What do you want to know about {c.short}?</h3>
                  <p className="secondary" style={{ marginTop: 4 }}>
                    Suggested for the <b>{persona}</b> persona. Each answer shows the tool calls behind it and cites the records it used.
                  </p>
                </div>
                <div className="ai-suggest">
                  {questions.map((q, i) => (
                    <button key={q.id} onClick={() => ask(q.text, q.id)}>
                      {i < questions.filter((x) => x.personas.includes(persona)).length && <em>For you</em>}
                      {q.text}
                    </button>
                  ))}
                </div>
                <Callout>
                  Try free text too, for example “what changed overnight?”. If the copilot cannot match a validated analysis it says so and only returns what the records show.
                </Callout>
              </div>
            )}
            {conv.messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="ai-msg ai-msg-user">
                  <div>{m.text}</div>
                </div>
              ) : (
                <AnswerView
                  key={i}
                  msg={m}
                  stream={streamingThis(i)}
                  focused={shownIdx === i}
                  onFocus={() => setFocusIdx(i)}
                  onCite={(rec, n) => setCite({ rec, n })}
                  submitted={submitted.has(`${conv.id}-${i}`)}
                  onDraft={() => setDraft({ key: `${conv.id}-${i}`, answer: m.answer })}
                  onLink={(p) => nav(p)}
                />
              ),
            )}
          </div>
          <div className="ai-cp-foot">
            {conv.messages.length > 0 && (
              <div className="chips" style={{ marginBottom: 8 }}>
                {questions.filter((q) => !conv.messages.some((m) => m.role === 'assistant' && m.qid === q.id)).slice(0, 3).map((q) => (
                  <button key={q.id} className="chip" disabled={busy} onClick={() => ask(q.text, q.id)}>
                    {q.text}
                  </button>
                ))}
              </div>
            )}
            <form className="ai-input" onSubmit={onSubmit}>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask about ${c.short}: loops, incidents, vendors, frameworks…`} aria-label="Ask the copilot" disabled={busy} />
              <Btn primary color={AI_TONE} type="submit" disabled={busy || !input.trim()}>
                <Send /> Ask
              </Btn>
            </form>
          </div>
        </Card>

        {/* How this answer was made */}
        <Card>
          <div className="ai-cp-head">
            <Tabs color={AI_TONE} value={panel} onChange={setPanel} tabs={[{ id: 'how', label: 'How this answer was made' }, { id: 'safety', label: 'Safety' }]} />
          </div>
          <div className="ai-cp-scroll">
            {panel === 'safety' ? (
              <div className="stack">
                <SafetyNotes />
                <KV
                  rows={[
                    ['Model', 'GPT-4o (Azure OpenAI, in-region)'],
                    ['Data residency', c.residency],
                    ['Content filter', 'Prompt Shields + groundedness detection'],
                    ['Tool contract', 'hexaview-tools v2.3 (7 read-only tools)'],
                  ]}
                />
              </div>
            ) : !shownMsg ? (
              <div className="empty">
                <Wrench size={16} />
                <div style={{ marginTop: 6 }}>Ask a question to see the tool calls, arguments and row counts behind the answer.</div>
              </div>
            ) : (
              <HowPanel msg={shownMsg} stream={shownIdx !== undefined ? streamingThis(shownIdx) : null} onCite={(rec, n) => setCite({ rec, n })} />
            )}
          </div>
          <div className="ai-cp-foot">
            <Sources items={[{ name: 'HexaCore' }, ...conns.filter((k) => k.status !== 'healthy').slice(0, 2).map((k) => ({ name: k.product, status: k.status }))]} />
          </div>
        </Card>
      </div>

      {cite && (
        <Drawer
          title={cite.rec.title}
          sub={<span className="mono">{cite.rec.id}</span>}
          icon={<span className="ai-avatar"><FileSearch /></span>}
          onClose={() => setCite(null)}
          footer={<Btn onClick={() => setCite(null)}>Close</Btn>}
        >
          <Callout>
            Cited as <b>[{cite.n}]</b> in this answer. The record is versioned, so the answer stays reproducible after the underlying data changes.
          </Callout>
          <KV rows={[['Record type', <Badge color={AI_TONE}>{cite.rec.kind}</Badge>], ['Source', cite.rec.source], ...cite.rec.fields]} />
          <div>
            <div className="section-label">Provenance</div>
            <p className="secondary" style={{ fontSize: 12 }}>
              Retrieved through a read-only tool call scoped to {tenantName(c, tenantId)}. The model saw the fields above and nothing else from this record.
            </p>
          </div>
        </Drawer>
      )}

      {draft?.answer.action && (
        <ApprovalModal
          title={draft.answer.action.label}
          connector={draft.answer.action.connector}
          operation={draft.answer.action.operation}
          risk={draft.answer.action.risk}
          change={draft.answer.action.change}
          approvers={draft.answer.action.approvers}
          onClose={() => setDraft(null)}
          onSubmit={() => {
            setSubmitted((s) => new Set(s).add(draft.key));
            toast(`Action request submitted: ${draft.answer.action!.label}. Awaiting ${draft.answer.action!.approvers.join(' + ')}.`);
            setDraft(null);
          }}
        />
      )}
    </>
  );
}

function AnswerView({
  msg, stream, focused, onFocus, onCite, submitted, onDraft, onLink,
}: {
  msg: BotMsg; stream: Stream | null; focused: boolean; onFocus: () => void; onCite: (r: CitedRecord, n: number) => void;
  submitted: boolean; onDraft: () => void; onLink: (p: string) => void;
}) {
  const a = msg.answer;
  const order = useMemo(() => {
    const ids: string[] = [];
    for (const s of a.sentences) for (const id of s.cites) if (!ids.includes(id)) ids.push(id);
    return ids;
  }, [a]);
  if (stream?.phase === 'tools') {
    return (
      <div className="ai-msg ai-msg-bot">
        <span className="ai-avatar"><Sparkles /></span>
        <div className="ai-answer">
          <span className="ai-thinking">
            <span className="ai-dots"><i /><i /><i /></span> Querying HexaCore · {stream.tools} of {a.tools.length} tool calls
          </span>
        </div>
      </div>
    );
  }
  const limit = stream ? stream.words : Infinity;
  let used = 0;
  const done = !stream;
  const numeric = a.sentences.filter((s) => !s.meta && isNumeric(s.text));
  const unverified = numeric.filter((s) => s.cites.length === 0).length;
  return (
    <div className="ai-msg ai-msg-bot" onClick={onFocus} style={{ cursor: 'default' }}>
      <span className="ai-avatar" style={focused ? { boxShadow: '0 0 0 2px var(--m-ai)' } : undefined}><Sparkles /></span>
      <div className="ai-answer">
        <p>
          {a.sentences.map((s, i) => {
            const words = s.text.split(' ');
            const avail = Math.max(0, limit - used);
            used += words.length;
            if (avail <= 0) return null;
            const full = avail >= words.length;
            const text = full ? s.text : words.slice(0, avail).join(' ');
            const unv = full && !s.meta && s.cites.length === 0 && isNumeric(s.text);
            return (
              <span key={i}>
                <span className={`ai-sent ${unv ? 'unverified' : ''}`}>{text}</span>
                {full && s.cites.map((id) => (
                  <button key={id} className="ai-cite" title={a.records[id]?.title} onClick={(e) => { e.stopPropagation(); if (a.records[id]) onCite(a.records[id], order.indexOf(id) + 1); }}>
                    [{order.indexOf(id) + 1}] {id}
                  </button>
                ))}
                {unv && (
                  <span className="ai-unv" title="Numeric statement with no cited record">
                    <AlertTriangle size={10} /> unverified
                  </span>
                )}{' '}
              </span>
            );
          })}
          {!done && <span className="ai-caret" />}
        </p>
        {done && (
          <>
            {a.note && <Callout kind="info">{a.note}</Callout>}
            <div className="ai-answer-foot">
              <span>
                <CheckCircle2 size={11} style={{ color: 'var(--good)', verticalAlign: -1 }} /> {numeric.length - unverified} of {numeric.length} numeric sentences cited · {order.length} records · {a.tools.length} tool calls
              </span>
              {unverified > 0 && <Badge color="var(--warn)">{unverified} unverified</Badge>}
              <span className="spacer" />
              {a.link && (
                <Btn sm ghost onClick={() => onLink(a.link!.path)}>
                  {a.link.label} <ArrowRight />
                </Btn>
              )}
              {a.action && (
                submitted ? (
                  <Badge color="var(--good)" dot>Submitted for approval</Badge>
                ) : (
                  <Btn sm primary color={AI_TONE} onClick={onDraft}>
                    <Wrench /> Draft action request
                  </Btn>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HowPanel({ msg, stream, onCite }: { msg: BotMsg; stream: Stream | null; onCite: (r: CitedRecord, n: number) => void }) {
  const a = msg.answer;
  const shown = stream?.phase === 'tools' ? stream.tools : a.tools.length;
  const ids: string[] = [];
  for (const s of a.sentences) for (const id of s.cites) if (!ids.includes(id)) ids.push(id);
  const rows = a.tools.reduce((s, t) => s + t.rows, 0);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="mini-stats">
        <div className="mini-stat"><b>{a.tools.length}</b><span>tool calls</span></div>
        <div className="mini-stat"><b>{fmtNum(rows)}</b><span>rows read</span></div>
        <div className="mini-stat"><b>{ids.length}</b><span>records cited</span></div>
      </div>
      <div>
        <div className="section-label">Tool calls (in order)</div>
        {a.tools.slice(0, Math.max(shown + (stream?.phase === 'tools' ? 1 : 0), 0)).map((t, i) => {
          const running = stream?.phase === 'tools' && i === shown;
          return (
            <div className="ai-tool" key={i}>
              <div className="ai-tool-head">
                {running ? <span className="ai-spin" /> : <Database size={12} style={{ color: 'var(--m-ai)' }} />}
                <b>{t.tool}</b>
                <span className="spacer" />
                <span className="muted">{running ? 'running…' : `${fmtNum(t.rows)} rows · ${t.ms} ms`}</span>
              </div>
              <pre>{JSON.stringify(t.args, null, 1).replace(/\n\s*/g, ' ')}</pre>
            </div>
          );
        })}
      </div>
      {!stream && (
        <div>
          <div className="section-label">Citations</div>
          <div className="list">
            {ids.map((id, i) => (
              <button key={id} className="list-row" onClick={() => a.records[id] && onCite(a.records[id], i + 1)} style={{ padding: '7px 0' }}>
                <span className="ai-cite" style={{ margin: 0 }}>[{i + 1}]</span>
                <span className="list-main">
                  <b>{a.records[id]?.title}</b>
                  <span className="mono">{id}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="section-label">Pipeline</div>
        <div className="secondary" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
          Prompt Shields screen → plan → {a.tools.length} read-only tool calls (tenant {msg.tenant}) → compose → groundedness check → citation binder → uncited numbers flagged.
        </div>
      </div>
    </div>
  );
}
