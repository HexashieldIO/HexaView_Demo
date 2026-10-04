import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, CheckCheck, Download, ArrowLeft, Check, Pencil, Flag, Send, FileSpreadsheet, FileText, Globe2, Sparkles, X } from 'lucide-react';
import { KpiStrip, Card, Btn, Callout, Ring, Badge } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Overlay';
import { HBars } from '../ops/parts';
import {
  TR_STATUSES, TR_FORMAT_BY_ID, TR_DOMAINS, TR_DOMAIN_COLOR, TR_QSTATE_COLOR, trFormatsFor, trPeople, trDomainLabel, trSme,
  trApprove, trEdit, trFlag, trAssign, trMarkSent, trDraft, trImport,
  type TrQnView, type TrQuestion, type TrFormatId, type TrQState, type TrDomain,
} from '../../data/modules/trust';
import { scopedTenants } from '../../data/customers';
import { fmtMoney, fmtNum, currencySymbol } from '../../lib/format';
import { useTrust, TRUST_TONE, StatusPill, QStatePill, Conf, EvChip, LibChip, QProgress, dueText, TrustNav } from './parts';

type TC = CSSProperties & { '--tc'?: string };

export default function Questionnaires() {
  const [sp] = useSearchParams();
  const { qns } = useTrust();
  const id = sp.get('q');
  const qn = id ? qns.find((q) => q.id === id) : undefined;
  return qn ? <Workspace key={qn.id} qn={qn} /> : <QueueList />;
}

/* =====================================================================
   Queue
   ===================================================================== */
function QueueList() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const { c, tenantId, qns, grc } = useTrust();
  const [importing, setImporting] = useState(false);
  const status = sp.get('status') ?? 'all';
  const fmt = sp.get('format') ?? 'all';
  const setParam = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (!v || v === 'all') n.delete(k); else n.set(k, v); setSp(n, { replace: true }); };
  const rows = qns.filter((q) => (status === 'all' || (status === 'open' ? q.status !== 'Sent' : q.status === status)) && (fmt === 'all' || q.format === fmt));
  const tenants = scopedTenants(c, tenantId);
  const tenantShort = (id: string) => c.tenants.find((t) => t.id === id)?.short ?? id;
  const formats = useMemo(() => {
    const m = new Map<TrFormatId, number>();
    qns.forEach((q) => m.set(q.format, (m.get(q.format) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [qns]);
  const thisWeek = qns.filter((q) => q.status !== 'Sent' && q.dueInDays <= 7).sort((a, b) => a.dueInDays - b.dueInDays);

  return (
    <>
      <div className="tr-intro-row">
        <p className="page-intro">
          <b>{qns.length}</b> questionnaires from {c.short}'s customers{tenantId !== 'all' ? ` for ${tenants[0]?.short}` : ''}. Each is parsed, mapped to the answer library and drafted from live {grc} evidence; nothing is returned until every answer has been approved by a person.
        </p>
        <TrustNav here="questionnaires" />
      </div>

      <KpiStrip
        toneColor={TRUST_TONE}
        items={[
          { label: 'Open', value: qns.filter((q) => q.status !== 'Sent').length, onClick: () => setParam('status', status === 'open' ? null : 'open'), source: 'Trust Centre queue · everything not yet returned' },
          ...TR_STATUSES.map((s) => ({
            label: s.id, value: qns.filter((q) => q.status === s.id).length, unit: s.id === 'In review' ? `${fmtNum(qns.filter((q) => q.status === 'In review').reduce((n, q) => n + q.drafted, 0))} drafts` : undefined,
            toneColor: s.color, onClick: () => setParam('status', status === s.id ? null : s.id), source: `Trust Centre queue · ${s.sub}`,
          })),
        ]}
      />

      <Card
        title="Inbound questionnaires"
        count={rows.length}
        sub={status !== 'all' || fmt !== 'all' ? <>Filtered: {[status !== 'all' && (status === 'open' ? 'open' : status), fmt !== 'all' && TR_FORMAT_BY_ID[fmt as TrFormatId]?.short].filter(Boolean).join(' · ')} · <a style={{ cursor: 'pointer', color: TRUST_TONE }} onClick={() => setSp(new URLSearchParams(), { replace: true })}>clear</a></> : 'Click a row to open the question-by-question workspace'}
        flush
        actions={<Btn sm primary color={TRUST_TONE} onClick={() => setImporting(true)}><Upload size={13} /> Import questionnaire</Btn>}
      >
        <DataTable
          rows={rows}
          rowKey={(q) => q.id}
          onRowClick={(q) => nav(`/trust/questionnaires?q=${q.id}`)}
          search={(q) => `${q.requester} ${q.requesterKind} ${q.id} ${TR_FORMAT_BY_ID[q.format].name} ${q.owner}`}
          searchPlaceholder="Search requester, format, owner…"
          toolbar={
            <select className="tr-sel" value={fmt} onChange={(e) => setParam('format', e.target.value)} aria-label="Format">
              <option value="all">All formats</option>
              {trFormatsFor(c).map((f) => <option key={f.id} value={f.id}>{f.short}</option>)}
            </select>
          }
          initialSort={{ key: 'due', dir: 'asc' }}
          pageSize={14}
          columns={[
            { key: 'req', header: 'Requester', sort: (q) => q.requester, render: (q) => <span className="tr-req"><b>{q.requester}</b><span>{q.id} · {q.requesterKind} · {tenantShort(q.tenantId)} · {q.owner}</span></span> },
            { key: 'fmt', header: 'Format', sort: (q) => q.format, render: (q) => <span className="tr-fmt">{TR_FORMAT_BY_ID[q.format].short}<em>{TR_FORMAT_BY_ID[q.format].file}</em></span> },
            { key: 'n', header: 'Questions', align: 'right', sort: (q) => q.total, render: (q) => fmtNum(q.total) },
            { key: 'auto', header: 'Auto-drafted', align: 'right', sort: (q) => q.autoPct, render: (q) => (q.drafted0 ? `${q.autoPct}%` : <span className="muted">not yet</span>) },
            { key: 'prog', header: 'Approved', width: 170, sort: (q) => q.approved / Math.max(1, q.total), render: (q) => <QProgress {...q} /> },
            { key: 'due', header: 'Due', sort: (q) => (q.status === 'Sent' ? 999 : q.dueInDays), render: (q) => { const d = dueText(q.dueInDays, q.status === 'Sent'); return <span style={{ color: d.color, whiteSpace: 'nowrap' }}>{q.status === 'Sent' ? `Returned in ${q.turnaroundDays} d` : d.text}</span>; } },
            { key: 'deal', header: 'Deal', align: 'right', sort: (q) => q.dealValue, render: (q) => fmtMoney(q.dealValue, c.currency) },
            { key: 'st', header: 'Status', sort: (q) => TR_STATUSES.findIndex((s) => s.id === q.status), render: (q) => <StatusPill s={q.status} /> },
          ]}
        />
      </Card>

      <div className="grid g2">
        <Card title="Formats received" sub="Click to filter the queue">
          <HBars
            color={TRUST_TONE}
            labelWidth={140}
            items={formats.map(([f, n]) => ({ key: f, label: TR_FORMAT_BY_ID[f].short, sub: TR_FORMAT_BY_ID[f].blurb, value: n, active: fmt === f, onClick: () => setParam('format', fmt === f ? null : f) }))}
          />
        </Card>
        <Card title="Due in the next 7 days" count={thisWeek.length}>
          {thisWeek.length ? (
            <div className="tr-acts">
              {thisWeek.map((q) => {
                const d = dueText(q.dueInDays);
                return (
                  <button key={q.id} type="button" className="tr-act" onClick={() => nav(`/trust/questionnaires?q=${q.id}`)}>
                    <i style={{ background: d.color }} />
                    <span style={{ minWidth: 0 }}><b>{q.requester}</b><span>{TR_FORMAT_BY_ID[q.format].short} · {q.approved}/{q.total} approved · {q.flagged + q.needs} with SMEs</span></span>
                    <em style={{ color: d.color }}>{d.text}</em>
                  </button>
                );
              })}
            </div>
          ) : <Callout kind="good">Nothing due this week.</Callout>}
        </Card>
      </div>

      {importing && <ImportModal onClose={() => setImporting(false)} />}
    </>
  );
}

/* ---------------- Progress runner (import and auto-draft) ---------------- */
function useRunner(steps: string[], onDone: () => void) {
  const [step, setStep] = useState(-1);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (step < 0) return;
    if (step >= steps.length) { done.current(); return; }
    const t = window.setTimeout(() => setStep((s) => s + 1), 650);
    return () => window.clearTimeout(t);
  }, [step, steps.length]);
  return { step, running: step >= 0 && step < steps.length, start: () => setStep(0), pct: step < 0 ? 0 : Math.min(100, Math.round((step / steps.length) * 100)) };
}

function Steps({ steps, step, pct }: { steps: string[]; step: number; pct: number }) {
  return (
    <div className="tr-steps">
      <div className="tr-pbar"><i style={{ width: `${pct}%` }} /></div>
      {steps.map((s, i) => (
        <div key={s} className={`tr-step ${i < step ? 'done' : i === step ? 'on' : ''}`}>
          <i>{i < step && <Check size={11} />}</i>{s}
        </div>
      ))}
    </div>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const { c, tenantId, lib, me, toast, grc } = useTrust();
  const formats = trFormatsFor(c);
  const tenants = scopedTenants(c, tenantId);
  const [form, setForm] = useState<{ requester: string; format: TrFormatId; tenant: string; due: number; deal: number }>({ requester: '', format: formats.find((f) => f.sector)?.id ?? 'sig-lite', tenant: tenants[0].id, due: 10, deal: 1.5 });
  const f = TR_FORMAT_BY_ID[form.format];
  const n = Math.round((f.range[0] + f.range[1]) / 2);
  const steps = [
    `Uploading ${f.file === 'Portal' ? 'portal export' : `${f.file} file`} and detecting question / answer columns`,
    `Parsing ${n} questions into ${TR_DOMAINS.length} domains`,
    `Matching against ${lib.length} approved library answers`,
    `Drafting answers from live evidence (${grc}, HexaStrike, HexaSOC, insurance)`,
    'Scoring confidence and citing evidence on every answer',
  ];
  const run = useRunner(steps, () => {
    const q = trImport(c, { requester: form.requester.trim(), format: form.format, questions: n, tenantId: form.tenant, dueInDays: form.due, dealValue: Math.round(form.deal * 1e6), owner: me });
    toast(`${q.id} · ${form.requester.trim()}: ${n} questions parsed and drafted. Nothing is sent until each answer is approved.`);
    onClose();
    nav(`/trust/questionnaires?q=${q.id}`);
  });
  const sym = currencySymbol(c.currency);
  return (
    <Modal
      title="Import a questionnaire"
      sub="Upload the customer's file; HexaView parses it and drafts every answer it can from approved sources"
      onClose={run.running ? () => {} : onClose}
      footer={!run.running ? (
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn primary color={TRUST_TONE} disabled={!form.requester.trim()} onClick={run.start}><Sparkles size={14} /> Import & auto-draft</Btn>
        </>
      ) : undefined}
    >
      {run.step < 0 ? (
        <div className="tr-form">
          <label>Requesting customer<input className="input" value={form.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })} placeholder="e.g. the customer whose procurement sent it" autoFocus /></label>
          <label>Format
            <select className="select" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value as TrFormatId })}>
              {formats.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.file}</option>)}
            </select>
          </label>
          <div className="row2">
            <label>Business unit
              <select className="select" value={form.tenant} onChange={(e) => setForm({ ...form, tenant: e.target.value })}>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.short}</option>)}
              </select>
            </label>
            <label>Due in
              <select className="select" value={form.due} onChange={(e) => setForm({ ...form, due: Number(e.target.value) })}>
                {[5, 10, 14, 21, 30].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
            </label>
          </div>
          <label>Deal value held by this questionnaire ({sym}M)<input className="input" type="number" min={0} step={0.1} value={form.deal} onChange={(e) => setForm({ ...form, deal: Number(e.target.value) || 0 })} /></label>
          <div className="row" style={{ gap: 10, padding: '12px 14px', border: '1px dashed var(--card-border)', borderRadius: 10, fontSize: 12 }}>
            <FileSpreadsheet size={18} style={{ color: TRUST_TONE }} />
            <span style={{ flex: 1 }}><b>{form.requester.trim() ? `${form.requester.trim().replace(/\s+/g, '_')}_${f.short.replace(/\W+/g, '')}` : 'questionnaire'}.{f.file === 'Portal' ? 'csv' : f.file.toLowerCase()}</b><div className="muted">{f.blurb} · about {n} questions</div></span>
          </div>
          <Callout kind="info">Answers are drafted only from approved library answers and live evidence. Anything without a source is left for a subject-matter expert, never guessed.</Callout>
        </div>
      ) : (
        <Steps steps={steps} step={run.step} pct={run.pct} />
      )}
    </Modal>
  );
}

/* =====================================================================
   Question-by-question workspace
   ===================================================================== */
const PAGE = 25;
const STATES: TrQState[] = ['Drafted', 'Flagged', 'Needs input', 'Approved'];

function Workspace({ qn }: { qn: TrQnView }) {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { c, me, toast, lib, ev, grc } = useTrust();
  const people = trPeople(c);
  const libById = useMemo(() => new Map(lib.map((l) => [l.id, l])), [lib]);
  const [stF, setStF] = useState<TrQState | 'all'>('all');
  const [domF, setDomF] = useState<TrDomain | 'all'>('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [bulk, setBulk] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const hl = sp.get('qid');
  const f = TR_FORMAT_BY_ID[qn.format];
  const tenant = c.tenants.find((t) => t.id === qn.tenantId);
  const due = dueText(qn.dueInDays, qn.status === 'Sent');
  const locked = qn.status === 'Sent';

  const steps = [`Parsing ${qn.total} questions`, `Matching against ${lib.length} approved library answers`, `Drafting from live evidence (${grc}, HexaStrike, HexaSOC)`, 'Scoring confidence and citing evidence'];
  const run = useRunner(steps, () => { trDraft(c, qn); toast(`${qn.requester}: answers drafted. Review and approve before anything is returned.`); });

  useEffect(() => {
    if (!hl) return;
    const i = qn.qs.findIndex((x) => x.id === hl);
    if (i >= limit) setLimit(i + 5);
    window.setTimeout(() => document.getElementById(`trq-${hl}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hl]);

  const rows = qn.qs.filter((x) => (stF === 'all' || x.state === stF) && (domF === 'all' || x.domain === domF) && (!q.trim() || `${x.id} ${x.text} ${x.answer}`.toLowerCase().includes(q.trim().toLowerCase())));
  const highIds = qn.qs.filter((x) => x.state === 'Drafted' && x.confidence >= 85).map((x) => x.id);
  const domains = TR_DOMAINS.filter((d) => qn.qs.some((x) => x.domain === d.id));
  const pct = Math.round((qn.approved / Math.max(1, qn.total)) * 100);

  const approve = (x: TrQuestion) => { trApprove(c, qn, [x.id], me); toast(`${x.id} approved by ${me}`); };
  const flag = (x: TrQuestion, who: string) => { trFlag(c, qn, x.id, who, me); toast(`${x.id} sent to ${who} for subject-matter input`); };

  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <Btn sm ghost onClick={() => nav('/trust/questionnaires')}><ArrowLeft size={13} /> All questionnaires</Btn>
        <span className="spacer" />
        <TrustNav here="questionnaires" />
      </div>

      <Card toneColor={TRUST_TONE}>
        <div className="tr-ws-head">
          <div style={{ minWidth: 0 }}>
            <div className="tr-ws-title">
              <span className="tr-mono">{qn.requester.split(/\s+/).slice(0, 2).map((w) => w[0]).join('')}</span>
              <div style={{ minWidth: 0 }}>
                <h3>{qn.requester} <span className="muted" style={{ fontWeight: 500, fontSize: 13 }}>· {f.name}</span></h3>
                <div className="tr-ws-meta">
                  <span><b>{qn.id}</b></span>
                  <span>{qn.requesterKind}</span>
                  <span>Business unit <b>{tenant?.short ?? qn.tenantId}</b></span>
                  <span>Contact <b>{qn.contact.split(' · ')[0]}</b></span>
                  <span>Deal <b>{fmtMoney(qn.dealValue, c.currency)}</b> · {qn.dealStage}</span>
                  <span>Owner <b>{qn.owner}</b></span>
                  <span style={{ color: due.color }}>{qn.status === 'Sent' ? `Returned in ${qn.turnaroundDays} days` : due.text}</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}><QProgress {...qn} wide /></div>
            <div className="tr-legend">
              <button type="button" className={`tr-lchip ${stF === 'all' ? 'on' : ''}`} onClick={() => setStF('all')}>All <b>{qn.total}</b></button>
              {STATES.map((s) => {
                const n = qn.qs.filter((x) => x.state === s).length;
                return <button key={s} type="button" className={`tr-lchip ${stF === s ? 'on' : ''}`} onClick={() => { setStF(stF === s ? 'all' : s); setLimit(PAGE); }}><i style={{ background: TR_QSTATE_COLOR[s] }} />{s} <b>{n}</b></button>;
              })}
            </div>
          </div>
          <div className="tr-ws-stats">
            <Ring value={pct} size={86} stroke={9} color={TRUST_TONE} sub="approved">{pct}%</Ring>
            <div className="stack" style={{ gap: 6 }}>
              <StatusPill s={qn.status} />
              {qn.drafted0 && <span className="muted" style={{ fontSize: 11.5 }}>{qn.autoPct}% auto-drafted</span>}
              <span className="muted" style={{ fontSize: 11.5 }}>{qn.highConf} high-confidence drafts</span>
            </div>
          </div>
        </div>
        <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
          {!qn.drafted0 && !run.running && <Btn primary color={TRUST_TONE} onClick={run.start}><Sparkles size={14} /> Auto-draft {qn.total} answers</Btn>}
          {qn.drafted0 && !locked && <Btn primary color={TRUST_TONE} disabled={!highIds.length} onClick={() => setBulk(true)}><CheckCheck size={14} /> Bulk approve high-confidence ({highIds.length})</Btn>}
          <Btn onClick={() => setExporting(true)} disabled={!qn.drafted0}><Download size={14} /> Export{qn.status === 'Approved' ? ' & return' : ''}</Btn>
          <span className="spacer" />
          <span className="muted" style={{ fontSize: 11.5 }}>Every answer cites its evidence · approvals are logged to the audit ledger</span>
        </div>
        {run.step >= 0 && run.running && <div style={{ marginTop: 14 }}><Steps steps={steps} step={run.step} pct={run.pct} /></div>}
      </Card>

      {qn.drafted0 ? (
        <Card flush title="Questions" count={rows.length} sub={`${f.short} · ${domains.length} domains`}>
          <div className="tr-tools">
            <select className="tr-sel" value={domF} onChange={(e) => { setDomF(e.target.value as TrDomain | 'all'); setLimit(PAGE); }} aria-label="Domain">
              <option value="all">All domains</option>
              {domains.map((d) => <option key={d.id} value={d.id}>{trDomainLabel(c, d.id)} ({qn.qs.filter((x) => x.domain === d.id).length})</option>)}
            </select>
            <input className="tr-search" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Search questions and answers…" aria-label="Search questions" />
            <span className="spacer" />
            <span className="muted" style={{ fontSize: 11.5 }}>Showing {Math.min(limit, rows.length)} of {rows.length}</span>
          </div>
          <div className="tr-qs">
            {rows.slice(0, limit).map((x) => {
              const l = x.libId ? libById.get(x.libId) : undefined;
              const isEd = editing?.id === x.id;
              return (
                <div key={x.id} id={`trq-${x.id}`} className={`tr-q ${hl === x.id ? 'hl' : ''}`} style={{ scrollMarginTop: 90 }}>
                  <div className="tr-q-id"><b>{x.id}</b><span>Q{x.n} of {qn.total}</span></div>
                  <div className="tr-q-body">
                    <div className="tr-q-top">
                      <span className="dom" style={{ color: TR_DOMAIN_COLOR[x.domain] }}>{trDomainLabel(c, x.domain)}</span>
                      <QStatePill s={x.state} />
                      {x.state !== 'Needs input' && <Conf n={x.confidence} />}
                      {x.edited && <Badge color="var(--m-trust)">Edited</Badge>}
                    </div>
                    <div className="tr-q-text">{x.text}</div>
                    {isEd ? (
                      <div className="tr-q-ans"><textarea value={editing.text} onChange={(e) => setEditing({ id: x.id, text: e.target.value })} autoFocus aria-label="Answer" /></div>
                    ) : x.answer ? (
                      <div className="tr-q-ans">{x.answer}</div>
                    ) : (
                      <div className="tr-q-ans empty">No approved source covers this question, so HexaView has not drafted an answer. Suggested expert: {trSme(c, x.domain)}.</div>
                    )}
                    {(x.ev.length > 0 || l) && (
                      <div className="tr-q-ev">
                        {x.ev.map((k) => ev[k] && <EvChip key={k} e={ev[k]} />)}
                        {l && <LibChip id={l.id} stale={l.staleNow} />}
                      </div>
                    )}
                    {l?.staleNow && x.state !== 'Approved' && <Callout kind="warn">Library answer {l.id} is stale: {l.staleReason}</Callout>}
                    <div className="tr-q-acts">
                      {locked ? (
                        <span className="tr-q-who">Returned to {qn.requester}{x.approvedBy ? ` · approved by ${x.approvedBy}` : ''}</span>
                      ) : isEd ? (
                        <>
                          <Btn sm primary color={TRUST_TONE} disabled={!editing.text.trim()} onClick={() => { trEdit(c, qn, x.id, editing.text.trim(), me); setEditing(null); toast(`${x.id} edited and approved · edit kept with this questionnaire`); }}><Check size={13} /> Save & approve</Btn>
                          <Btn sm ghost onClick={() => setEditing(null)}><X size={13} /> Cancel</Btn>
                        </>
                      ) : (
                        <>
                          {x.state !== 'Approved' && x.answer && <Btn sm primary color={TRUST_TONE} onClick={() => approve(x)}><Check size={13} /> Approve</Btn>}
                          <Btn sm onClick={() => setEditing({ id: x.id, text: x.answer })}><Pencil size={13} /> {x.answer ? 'Edit' : 'Write answer'}</Btn>
                          {x.state !== 'Flagged' && x.state !== 'Approved' && <Btn sm onClick={() => flag(x, x.assignee ?? trSme(c, x.domain))}><Flag size={13} /> Flag for SME</Btn>}
                          <span className="spacer" />
                          <label className="tr-q-who" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            Assignee
                            <select className="tr-sel" value={x.assignee ?? ''} onChange={(e) => { trAssign(c, qn, x.id, e.target.value); toast(`${x.id} assigned to ${e.target.value}`); }}>
                              <option value="" disabled>Unassigned</option>
                              {people.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </label>
                          {x.approvedBy && x.state === 'Approved' && <span className="tr-q-who">Approved by {x.approvedBy}</span>}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {!rows.length && <div className="empty">No questions match.</div>}
          </div>
          {rows.length > limit && <div className="tr-more"><Btn sm onClick={() => setLimit((n) => n + PAGE * 2)}>Show {Math.min(PAGE * 2, rows.length - limit)} more ({rows.length - limit} remaining)</Btn></div>}
        </Card>
      ) : (
        !run.running && <Callout kind="info">This questionnaire has been parsed ({qn.total} questions) but not drafted yet. Auto-draft maps each question to the answer library and the live evidence behind it; questions without a source are left for an expert.</Callout>
      )}

      {bulk && (
        <Modal
          title={`Bulk approve ${highIds.length} high-confidence answers`}
          sub={`${qn.requester} · ${f.short}`}
          onClose={() => setBulk(false)}
          footer={<><Btn onClick={() => setBulk(false)}>Cancel</Btn><Btn primary color={TRUST_TONE} onClick={() => { trApprove(c, qn, highIds, me); setBulk(false); toast(`${highIds.length} answers approved by ${me} · ${qn.total - qn.approved - highIds.length} still need review`); }}><CheckCheck size={14} /> Approve {highIds.length}</Btn></>}
        >
          <div className="stack" style={{ gap: 12 }}>
            <p style={{ fontSize: 12.5 }}>Approves every drafted answer with confidence of 85% or more. Each one reuses an approved library answer whose evidence is fresh, and keeps its citations.</p>
            <div className="grid g3" style={{ gap: 8 }}>
              <div className="tr-big"><b style={{ color: TRUST_TONE }}>{highIds.length}</b><span>to approve now</span></div>
              <div className="tr-big"><b>{qn.drafted - highIds.length}</b><span>lower-confidence drafts left for review</span></div>
              <div className="tr-big"><b style={{ color: 'var(--sev-medium)' }}>{qn.flagged + qn.needs}</b><span>with experts</span></div>
            </div>
            <Callout kind="info">Risk class: low. Nothing is sent to {qn.requester} until you export and return it. Approvals are recorded in the audit ledger under your name ({me}).</Callout>
          </div>
        </Modal>
      )}

      {exporting && <ExportModal qn={qn} onClose={() => setExporting(false)} />}
    </>
  );
}

function ExportModal({ qn, onClose }: { qn: TrQnView; onClose: () => void }) {
  const { c, me, toast } = useTrust();
  const f = TR_FORMAT_BY_ID[qn.format];
  const [kind, setKind] = useState<'original' | 'pdf' | 'portal'>(f.file === 'Portal' ? 'portal' : 'original');
  const complete = qn.approved === qn.total;
  const file = kind === 'original' ? `${qn.requester.replace(/\W+/g, '_')}_${f.short.replace(/\W+/g, '')}_completed.${f.file === 'DOCX' ? 'docx' : 'xlsx'}` : kind === 'pdf' ? `${qn.requester.replace(/\W+/g, '_')}_security_responses.pdf` : `${f.short} portal submission`;
  const opts: { id: typeof kind; icon: typeof FileText; label: string; sub: string }[] = [
    { id: 'original', icon: FileSpreadsheet, label: `Filled original (${f.file === 'DOCX' ? 'DOCX' : 'XLSX'})`, sub: 'Answers written back into the customer\'s own columns, citations in a comment per cell' },
    { id: 'pdf', icon: FileText, label: 'PDF response pack', sub: 'Answers plus an evidence appendix and the approval trail, watermarked' },
    { id: 'portal', icon: Globe2, label: 'Portal submission', sub: 'Uploaded to the requester\'s supplier portal via a share link' },
  ];
  const sent = qn.status === 'Sent';
  return (
    <Modal
      title="Export responses"
      sub={`${qn.requester} · ${qn.approved} of ${qn.total} approved`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Close</Btn>
          <Btn onClick={() => { toast(`${complete ? '' : 'DRAFT · '}${file} exported${complete ? '' : ' for internal review (not for release)'}`); onClose(); }}><Download size={14} /> {complete ? 'Export' : 'Export draft'}</Btn>
          {!sent && <Btn primary color={TRUST_TONE} disabled={!complete} onClick={() => { trMarkSent(c, qn, me, file); toast(`${qn.requester}: ${file} returned. Deal of ${fmtMoney(qn.dealValue, c.currency)} unblocked.`); onClose(); }}><Send size={14} /> Export & return to customer</Btn>}
        </>
      }
    >
      <div className="stack" style={{ gap: 10 }}>
        {opts.map((o) => (
          <button key={o.id} type="button" className="tr-evrow" style={{ '--tc': TRUST_TONE, borderColor: kind === o.id ? TRUST_TONE : undefined } as TC} onClick={() => setKind(o.id)}>
            <span className="row" style={{ gap: 10 }}><o.icon size={18} style={{ color: kind === o.id ? TRUST_TONE : 'var(--text-muted)' }} /><span><b>{o.label}</b><span>{o.sub}</span></span></span>
            <em>{kind === o.id ? <Check size={14} style={{ color: TRUST_TONE }} /> : null}</em>
          </button>
        ))}
        {complete ? (
          sent ? <Callout kind="good">Already returned to {qn.requester}. Exports are re-generated from the approved answers.</Callout> : <Callout kind="good">All {qn.total} answers are approved. Returning it marks the questionnaire as sent and records the turnaround.</Callout>
        ) : (
          <Callout kind="warn">{qn.total - qn.approved} answers are not approved yet ({qn.drafted} drafted, {qn.flagged} with experts, {qn.needs} unanswered). You can export a draft for internal review; returning to the customer unlocks when every answer is approved.</Callout>
        )}
      </div>
    </Modal>
  );
}
