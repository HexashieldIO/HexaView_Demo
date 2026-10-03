import { useMemo, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpenCheck, RefreshCw, Copy } from 'lucide-react';
import { KpiStrip, Card, Btn, Callout, Timeline, KV, Badge } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { TR_DOMAINS, TR_EV_COLOR, trDomainLabel, trReview, type TrDomain, type TrEvKind } from '../../data/modules/trust';
import { fmtNum, fmtDate, daysAgo } from '../../lib/format';
import { useTrust, TRUST_TONE, Pill, TrustNav } from './parts';

type TC = CSSProperties & { '--tc'?: string };

export default function Answers() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const { c, lib, ev, qns, me, toast, grc } = useTrust();
  const dom = (sp.get('domain') as TrDomain | null) ?? null;
  const fresh = sp.get('fresh');
  const source = sp.get('source') as TrEvKind | null;
  const selId = sp.get('id');
  const setParam = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (!v) n.delete(k); else n.set(k, v); setSp(n, { replace: true }); };

  const use = useMemo(() => {
    const m = new Map<string, { open: number; qns: Set<string> }>();
    qns.filter((q) => q.status !== 'Sent').forEach((q) => q.qs.forEach((x) => {
      if (!x.libId) return;
      const e = m.get(x.libId) ?? { open: 0, qns: new Set<string>() };
      e.open++;
      e.qns.add(q.id);
      m.set(x.libId, e);
    }));
    return m;
  }, [qns]);

  const rows = lib.filter((l) => (!dom || l.domain === dom) && (fresh !== 'stale' || l.staleNow) && (fresh !== 'fresh' || !l.staleNow) && (!source || l.ev.some((k) => ev[k]?.kind === source)));
  const stale = lib.filter((l) => l.staleNow);
  const reviewed90 = lib.filter((l) => l.reviewedNow <= 90).length;
  const reuse90 = lib.reduce((s, l) => s + l.usage90, 0);
  const evKeys = new Set(lib.flatMap((l) => l.ev));
  const sel = selId ? lib.find((l) => l.id === selId) : undefined;
  const filterLabel = [dom && trDomainLabel(c, dom), fresh && (fresh === 'stale' ? 'stale' : 'fresh'), source && `cites ${source}`].filter(Boolean).join(' · ');

  return (
    <>
      <div className="tr-intro-row">
        <p className="page-intro">
          <b>{lib.length}</b> approved answers that {c.short} reuses across every questionnaire. Each is owned, versioned and tied to the evidence behind it in {grc}, HexaStrike, HexaSOC and the insurance record; when that evidence changes, the answer is flagged stale before it can be reused.
        </p>
        <TrustNav here="answers" />
      </div>

      <KpiStrip
        toneColor={TRUST_TONE}
        items={[
          { label: 'Approved answers', value: lib.length, unit: `${TR_DOMAINS.length} domains`, onClick: () => setSp(new URLSearchParams(), { replace: true }), source: 'Trust Centre answer library' },
          { label: 'Stale', value: stale.length, unit: 'evidence changed', toneColor: stale.length ? 'var(--sev-medium)' : undefined, onClick: () => setParam('fresh', fresh === 'stale' ? null : 'stale'), source: 'Evidence freshness check against HexaComply, HexaStrike, insurance' },
          { label: 'Reviewed ≤ 90 d', value: `${Math.round((reviewed90 / Math.max(1, lib.length)) * 100)}%`, bar: (reviewed90 / Math.max(1, lib.length)) * 100, onClick: () => setParam('fresh', fresh === 'fresh' ? null : 'fresh'), source: 'Answer owner review dates' },
          { label: 'Reused', hint: '90 d', value: fmtNum(reuse90), unit: 'answers drafted', to: '/trust/questionnaires', source: 'Library matches in questionnaires' },
          { label: 'In open questionnaires', value: fmtNum([...use.values()].reduce((s, u) => s + u.open, 0)), unit: 'drafts', to: '/trust/questionnaires?status=open', source: 'Drafts referencing a library answer' },
          { label: 'Evidence sources', value: evKeys.size, unit: 'linked records', onClick: () => setParam('source', null), source: 'Controls, policies, pen tests, SOC metrics, insurance, certifications' },
        ]}
      />

      {stale.length > 0 && fresh !== 'stale' && (
        <Callout kind="warn">
          {stale.length} answers are stale because the evidence behind them changed ({stale.slice(0, 2).map((l) => l.id).join(', ')}{stale.length > 2 ? '…' : ''}). Drafts that reuse them get lower confidence until an owner re-approves. <a style={{ cursor: 'pointer', color: TRUST_TONE }} onClick={() => setParam('fresh', 'stale')}>Show stale answers</a>
        </Callout>
      )}

      <Card title="By domain" sub="Click a domain to filter the library">
        <div className="tr-dtiles">
          {TR_DOMAINS.map((d) => {
            const items = lib.filter((l) => l.domain === d.id);
            const st = items.filter((l) => l.staleNow).length;
            return (
              <button key={d.id} type="button" className={`tr-dtile ${dom === d.id ? 'on' : ''}`} style={{ '--tc': d.color } as TC} onClick={() => setParam('domain', dom === d.id ? null : d.id)} title="Source: answer library · click to filter">
                <span className="tr-dtile-l">{trDomainLabel(c, d.id)}</span>
                <span className="tr-dtile-v"><b>{items.length}</b><span className="muted" style={{ fontSize: 11 }}>answers · {fmtNum(items.reduce((s, l) => s + l.usage, 0))} uses</span>{st > 0 && <em>{st} stale</em>}</span>
                <span className="tr-dtile-bar" />
              </button>
            );
          })}
        </div>
      </Card>

      <Card
        title="Answer library"
        count={rows.length}
        sub={filterLabel ? <>Filtered: {filterLabel} · <a style={{ cursor: 'pointer', color: TRUST_TONE }} onClick={() => setSp(new URLSearchParams(), { replace: true })}>clear</a></> : 'Click an answer for its evidence, versions and where it is used'}
        flush
      >
        <DataTable
          rows={rows}
          rowKey={(l) => l.id}
          onRowClick={(l) => setParam('id', l.id)}
          search={(l) => `${l.id} ${l.question} ${l.variants.join(' ')} ${l.answer} ${l.owner} ${l.domain}`}
          searchPlaceholder="Search questions and answers…"
          toolbar={
            <select className="tr-sel" value={source ?? ''} onChange={(e) => setParam('source', e.target.value || null)} aria-label="Evidence source">
              <option value="">Any evidence</option>
              {(Object.keys(TR_EV_COLOR) as TrEvKind[]).map((k) => <option key={k} value={k}>Cites {k}</option>)}
            </select>
          }
          initialSort={{ key: 'use', dir: 'desc' }}
          pageSize={15}
          columns={[
            { key: 'id', header: 'ID', sort: (l) => l.id, render: (l) => <span className="mono">{l.id}</span>, width: 80 },
            { key: 'dom', header: 'Domain', sort: (l) => l.domain, render: (l) => <span style={{ color: TR_DOMAINS.find((d) => d.id === l.domain)?.color, fontSize: 11.5, fontWeight: 600 }}>{trDomainLabel(c, l.domain)}</span> },
            { key: 'q', header: 'Question', sort: (l) => l.question, render: (l) => <><div className="t-main" style={{ whiteSpace: 'normal', maxWidth: 460 }}>{l.question}</div><div className="t-sub">{l.variants.length} phrasings matched · {l.ev.length} evidence links</div></> },
            { key: 'own', header: 'Owner', sort: (l) => l.owner, render: (l) => <span className="muted">{l.owner}</span> },
            { key: 'rev', header: 'Last reviewed', sort: (l) => -l.reviewedNow, render: (l) => (l.reviewedNow < 1 ? 'Today' : `${Math.round(l.reviewedNow)} d ago`) },
            { key: 'fr', header: 'Freshness', sort: (l) => (l.staleNow ? 0 : 1), render: (l) => (l.staleNow ? <Pill color="#f0a338" title={l.staleReason}>Stale</Pill> : <Pill color="#2dd4bf">Fresh</Pill>) },
            { key: 'use', header: 'Used', align: 'right', sort: (l) => l.usage, render: (l) => <><b>{l.usage}</b><div className="t-sub">{use.get(l.id)?.open ?? 0} open</div></> },
          ]}
        />
      </Card>

      {sel && (
        <Drawer
          wide
          title={<span className="row" style={{ gap: 8 }}><span className="mono">{sel.id}</span> {trDomainLabel(c, sel.domain)}</span>}
          sub={`Owner ${sel.owner} · ${sel.versions[0].v} · reviewed ${sel.reviewedNow < 1 ? 'today' : `${Math.round(sel.reviewedNow)} days ago`}`}
          icon={<BookOpenCheck size={18} style={{ color: TRUST_TONE }} />}
          onClose={() => setParam('id', null)}
          footer={
            <>
              <Btn onClick={() => { void navigator.clipboard?.writeText(sel.answer).catch(() => undefined); toast(`${sel.id} copied with its citations`); }}><Copy size={13} /> Copy answer</Btn>
              <Btn primary={sel.staleNow} color={TRUST_TONE} onClick={() => { trReview(c, sel, me); toast(`${sel.id} re-approved by ${me} against current evidence · new version recorded`); }}><RefreshCw size={13} /> {sel.staleNow ? 'Re-approve with current evidence' : 'Mark reviewed'}</Btn>
            </>
          }
        >
          <div className="stack" style={{ gap: 14 }}>
            {sel.staleNow && <Callout kind="warn"><b>Stale.</b> {sel.staleReason} Drafts reusing this answer are held at lower confidence until it is re-approved.</Callout>}
            <div>
              <div className="section-label">Canonical question</div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{sel.question}</div>
            </div>
            <div>
              <div className="section-label">Approved answer</div>
              <div className="tr-quote">{sel.answer}</div>
            </div>
            <div>
              <div className="section-label">Evidence it cites ({sel.ev.length})</div>
              <div className="tr-evlist">
                {sel.ev.map((k) => {
                  const e = ev[k];
                  if (!e) return null;
                  return (
                    <button key={k} type="button" className="tr-evrow" onClick={() => nav(e.to)} title={`Open in ${e.source}`}>
                      <span><b><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: TR_EV_COLOR[e.kind], marginRight: 6 }} />{e.label}</b><span>{e.kind} · {e.detail} · {e.source}</span></span>
                      <em style={{ color: e.ageDays > 90 ? 'var(--sev-medium)' : 'var(--good)' }}>{e.ageDays === 0 ? 'live' : `${e.ageDays} d old`}</em>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="section-label">Phrasings it answers ({sel.variants.length})</div>
              <ol className="tr-variants">{sel.variants.map((v) => <li key={v}>{v}</li>)}</ol>
            </div>
            <KV
              rows={[
                ['Used', `${sel.usage} times · ${sel.usage90} in the last 90 days`],
                ['In open questionnaires', (() => { const u = use.get(sel.id); return u ? <span className="chips">{[...u.qns].slice(0, 6).map((id) => { const q = qns.find((x) => x.id === id); return <a key={id} style={{ cursor: 'pointer' }} onClick={() => nav(`/trust/questionnaires?q=${id}`)}><Badge color={TRUST_TONE}>{q?.requester ?? id}</Badge></a>; })}</span> : 'None right now'; })()],
                ['Reviewer', sel.reviewer],
              ]}
            />
            <div>
              <div className="section-label">Versions</div>
              <Timeline items={sel.versions.map((v, i) => ({ time: fmtDate(daysAgo(i === 0 ? sel.reviewedNow : v.daysAgo)), title: `${v.v} · ${v.by}`, body: i === 0 && sel.reviewedNow < 1 ? 'Re-approved against current evidence (this session)' : v.note, color: i === 0 ? TRUST_TONE : undefined }))} />
            </div>
          </div>
        </Drawer>
      )}
    </>
  );
}
