import { useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { KpiStrip, Card, Callout, Sources } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { HBars, useRecords } from '../ops/parts';
import {
  TR_STATUSES, TR_EV_COLOR, TR_DOMAINS, TR_FORMAT_BY_ID, trBaselineDays, trTurnaroundTrend, trDomainLabel, type TrEvKind, type TrDomain,
} from '../../data/modules/trust';
import { scopedTenants } from '../../data/customers';
import { fmtMoney, fmtNum, fmtAgo } from '../../lib/format';
import { useTrust, TRUST_TONE, dueText, StatusPill, TrustNav, QProgress } from './parts';

type TC = CSSProperties & { '--tc'?: string };

export default function Overview() {
  const nav = useNavigate();
  const { c, tenantId, qns, lib, reqs, ev, activity, portal, grc } = useTrust();
  const [, setRecs, recsNode] = useRecords();
  const tenants = scopedTenants(c, tenantId);
  const baseline = trBaselineDays(c);
  const trend = useMemo(() => trTurnaroundTrend(c), [c]);

  const open = qns.filter((q) => q.status !== 'Sent');
  const sent = qns.filter((q) => q.status === 'Sent');
  const unblocked = qns.filter((q) => q.status === 'Sent' || q.status === 'Approved');
  const avgTurn = sent.length ? Math.round((sent.reduce((s, q) => s + (q.turnaroundDays ?? 0), 0) / sent.length) * 10) / 10 : 0;
  const drafted = qns.filter((q) => q.drafted0);
  const totalQ = drafted.reduce((s, q) => s + q.total, 0);
  const autoQ = drafted.reduce((s, q) => s + q.qs.filter((x) => x.libId).length, 0);
  const autoPct = totalQ ? Math.round((autoQ / totalQ) * 100) : 0;
  const awaiting = open.reduce((s, q) => s + q.drafted, 0);
  const human = open.reduce((s, q) => s + q.flagged + q.needs, 0);
  const pendingReq = reqs.filter((r) => r.status === 'Pending').length;
  const staleLib = lib.filter((l) => l.staleNow).length;
  const hoursSaved = Math.round(autoQ * 0.35);

  // Answer sources: every evidence citation behind drafted or approved answers.
  const sources = useMemo(() => {
    const m = new Map<TrEvKind, number>();
    drafted.forEach((q) => q.qs.forEach((x) => { if (x.state !== 'Needs input') x.ev.forEach((k) => { const e = ev[k]; if (e) m.set(e.kind, (m.get(e.kind) ?? 0) + 1); }); }));
    const sme = drafted.reduce((s, q) => s + q.qs.filter((x) => !x.libId && x.state !== 'Needs input').length, 0);
    return { list: (Object.keys(TR_EV_COLOR) as TrEvKind[]).map((k) => ({ k, n: m.get(k) ?? 0 })).sort((a, b) => b.n - a.n), sme };
  }, [drafted, ev]);

  const byReq = [...qns].sort((a, b) => b.dealValue - a.dealValue).slice(0, 7);
  const humanByDomain = useMemo(() => TR_DOMAINS.map((d) => ({ d: d.id, color: d.color, rows: open.flatMap((q) => q.qs.filter((x) => x.domain === d.id && (x.state === 'Flagged' || x.state === 'Needs input')).map((x) => ({ q, x }))) })).filter((g) => g.rows.length).sort((a, b) => b.rows.length - a.rows.length), [open]);

  const openStage = (s: string) => nav(`/trust/questionnaires?status=${encodeURIComponent(s)}`);

  return (
    <>
      <div className="tr-intro-row">
        <p className="page-intro">
          <b>{c.name}</b>{tenantId !== 'all' ? ` · ${tenants[0]?.name}` : ''}: security questionnaires from your own customers, answered from live evidence already in HexaView ({grc} controls and policies, HexaStrike pen tests, HexaSOC metrics, {c.insurance.carrier.split(' (')[0]} cover). Every answer is cited and approved by a person before it leaves.
        </p>
        <TrustNav here="overview" />
      </div>

      <KpiStrip
        toneColor={TRUST_TONE}
        items={[
          { label: 'Open questionnaires', value: open.length, unit: `${fmtNum(open.reduce((s, q) => s + q.total, 0))} questions`, to: '/trust/questionnaires?status=open', source: 'Trust Centre inbound queue' },
          { label: 'Avg turnaround', value: `${avgTurn.toFixed(1)} d`, unit: `was ${baseline} d`, delta: { text: `${Math.round((1 - avgTurn / baseline) * 100)}% faster`, good: true }, to: '/trust/questionnaires?status=Sent', source: 'Received → returned, questionnaires sent' },
          { label: 'Auto-answered', value: `${autoPct}%`, bar: autoPct, unit: `${fmtNum(autoQ)} drafts`, to: '/trust/answers', source: `Answer library × ${grc} evidence` },
          { label: 'Awaiting approval', value: fmtNum(awaiting), unit: 'drafts', to: '/trust/questionnaires?status=In%20review', source: 'Drafted answers not yet human-approved' },
          { label: 'Deals unblocked', value: unblocked.length, unit: fmtMoney(unblocked.reduce((s, q) => s + q.dealValue, 0), c.currency), onClick: () => setRecs({ title: 'Deals unblocked', sub: 'Questionnaires approved or returned, with the deal value they were holding up', source: 'Trust Centre × CRM opportunity values', rows: unblocked.map((q) => ({ key: q.id, main: <>{q.requester} <span className="muted">· {q.id}</span></>, meta: `${TR_FORMAT_BY_ID[q.format].short} · ${q.dealStage}${q.turnaroundDays ? ` · turnaround ${q.turnaroundDays} d` : ''}`, right: <b>{fmtMoney(q.dealValue, c.currency)}</b>, color: TRUST_TONE })) }), source: 'Opportunity value from CRM, linked per questionnaire' },
          { label: 'Portal visitors', hint: '30 d', value: fmtNum(portal.visitors30), unit: `${portal.orgs30} orgs`, to: '/trust/portal', source: 'Trust Portal analytics' },
          { label: 'Access requests', value: pendingReq, unit: 'pending', to: '/trust/requests?status=Pending', source: 'Gated documents · NDA workflow' },
        ]}
      />

      <div className="grid g-3-2">
        <Card title="Questionnaire pipeline" sub="Click a stage to open its queue" actions={<Sources items={[{ name: grc }, { name: 'HexaStrike' }, { name: 'HexaSOC' }]} />}>
          <div className="tr-pipe">
            {TR_STATUSES.map((s) => {
              const items = qns.filter((q) => q.status === s.id);
              return (
                <button key={s.id} type="button" className="tr-stage" style={{ '--tc': s.color } as TC} onClick={() => openStage(s.id)} title={`Source: Trust Centre queue · ${s.sub}`}>
                  <span className="tr-stage-h">{s.id}</span>
                  <span className="tr-stage-n">{items.length}</span>
                  <span className="tr-stage-s"><b>{fmtNum(items.reduce((n, q) => n + q.total, 0))}</b> questions<br /><b>{fmtMoney(items.reduce((n, q) => n + q.dealValue, 0), c.currency)}</b> in deals</span>
                  <span className="tr-stage-s">{s.sub}</span>
                </button>
              );
            })}
          </div>
          <div className="tr-arrowline"><span>Customer sends</span><i /><span>HexaView drafts from evidence</span><i /><span>Your team approves</span><i /><span>Returned</span></div>
          {human > 0 && <div style={{ marginTop: 12 }}><Callout kind="warn">{fmtNum(human)} questions still need a subject-matter expert across {open.filter((q) => q.flagged + q.needs > 0).length} questionnaires: no approved answer exists yet, so nothing is invented.</Callout></div>}
        </Card>

        <Card title="Turnaround" sub={`Mean days from receipt to return · HexaView live in ${trend.months[trend.liveIdx]}`}>
          <div className="tr-big2">
            <button type="button" className="tr-big" onClick={() => nav('/trust/questionnaires?status=Sent')} title="Source: questionnaires returned before HexaView (CRM history)"><b style={{ color: 'var(--text-muted)' }}>{baseline} d</b><span>Before: manual, spreadsheet and email</span></button>
            <button type="button" className="tr-big" onClick={() => nav('/trust/questionnaires?status=Sent')} title="Source: questionnaires returned through the Trust Centre"><b style={{ color: TRUST_TONE }}>{avgTurn.toFixed(1)} d</b><span>Now: drafted from evidence, approved</span></button>
          </div>
          <Chart
            height={170}
            option={{
              grid: { left: 8, right: 14, top: 22, bottom: 4, containLabel: true },
              tooltip: { trigger: 'axis', valueFormatter: (v) => `${v} days` },
              xAxis: { type: 'category', data: trend.months },
              yAxis: { type: 'value', name: 'days' },
              series: [{
                type: 'line', data: trend.days, color: '#2dd4bf', areaStyle: { opacity: 0.12 }, symbolSize: 6,
                markLine: { symbol: 'none', silent: true, lineStyle: { color: '#8593b4', type: 'dashed' }, label: { formatter: 'HexaView live', color: '#8593b4', fontSize: 10.5, position: 'insideEndTop' }, data: [{ xAxis: trend.months[trend.liveIdx] }] },
              }],
            }}
          />
        </Card>
      </div>

      <div className="grid g3">
        <Card title="Where answers come from" sub={`${fmtNum(sources.list.reduce((s, x) => s + x.n, 0))} evidence citations behind drafted answers`}>
          <HBars
            color={TRUST_TONE}
            labelWidth={110}
            items={[
              ...sources.list.map((s) => ({ key: s.k, label: s.k, value: s.n, display: fmtNum(s.n), color: TR_EV_COLOR[s.k], onClick: () => nav(`/trust/answers?source=${encodeURIComponent(s.k)}`) })),
              { key: 'sme', label: 'SME written', value: sources.sme, display: fmtNum(sources.sme), color: '#f0a338', onClick: () => nav('/trust/questionnaires?status=open') },
            ]}
          />
          <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>~{fmtNum(hoursSaved)} analyst hours saved on drafting (≈ 20 min per answer).</div>
        </Card>
        <Card title="Top requesting customers" sub="By deal value held by the questionnaire">
          <HBars
            labelWidth={150}
            items={byReq.map((q) => ({ key: q.id, label: q.requester, sub: `${TR_FORMAT_BY_ID[q.format].short} · ${q.status}`, value: q.dealValue, display: fmtMoney(q.dealValue, c.currency), color: TR_STATUSES.find((s) => s.id === q.status)?.color, onClick: () => nav(`/trust/questionnaires?q=${q.id}`) }))}
          />
        </Card>
        <Card title="Where a human is still needed" sub="Flagged or unanswered, by domain">
          {humanByDomain.length ? (
            <HBars
              labelWidth={150}
              items={humanByDomain.slice(0, 8).map((g) => ({
                key: g.d, label: trDomainLabel(c, g.d as TrDomain), value: g.rows.length, color: g.color,
                onClick: () => setRecs({ title: trDomainLabel(c, g.d as TrDomain), sub: `${g.rows.length} questions waiting on an expert`, source: 'Trust Centre questionnaires', rows: g.rows.slice(0, 60).map(({ q, x }) => ({ key: `${q.id}-${x.id}`, main: <a onClick={() => nav(`/trust/questionnaires?q=${q.id}&qid=${x.id}`)} style={{ cursor: 'pointer' }}>{x.text}</a>, meta: `${q.requester} · ${x.id} · ${x.state}${x.assignee ? ` · with ${x.assignee}` : ''}`, color: g.color })) }),
              }))}
            />
          ) : <Callout kind="good">Every open question has an approved-source draft.</Callout>}
          <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>{staleLib} library answer{staleLib === 1 ? '' : 's'} flagged stale because evidence changed · <a style={{ cursor: 'pointer', color: TRUST_TONE }} onClick={() => nav('/trust/answers?fresh=stale')}>review</a></div>
        </Card>
      </div>

      <div className="grid g-2-1">
        <Card title="Due next" count={open.length} sub="Open questionnaires by due date" flush>
          <table className="tbl">
            <thead><tr><th>Requester</th><th>Format</th><th>Progress</th><th>Due</th><th className="r">Deal</th><th>Status</th></tr></thead>
            <tbody>
              {[...open].sort((a, b) => a.dueInDays - b.dueInDays).slice(0, 8).map((q) => {
                const d = dueText(q.dueInDays);
                return (
                  <tr key={q.id} className="clickable" onClick={() => nav(`/trust/questionnaires?q=${q.id}`)}>
                    <td><div className="t-main">{q.requester}</div><div className="t-sub">{q.id} · {q.requesterKind}</div></td>
                    <td>{TR_FORMAT_BY_ID[q.format].short}<div className="t-sub">{q.total} questions</div></td>
                    <td style={{ minWidth: 140 }}><QProgress {...q} /></td>
                    <td style={{ color: d.color, whiteSpace: 'nowrap' }}>{d.text}</td>
                    <td className="r">{fmtMoney(q.dealValue, c.currency)}</td>
                    <td><StatusPill s={q.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <Card title="Recent activity" sub="Drafts, approvals, returns and access decisions">
          <div className="tr-acts">
            {activity.slice(0, 8).map((a, i) => (
              <button key={i} type="button" className="tr-act" onClick={() => nav(a.to)}>
                <i style={{ background: a.color }} />
                <span style={{ minWidth: 0 }}><b>{a.title}</b><span>{a.body}</span></span>
                <em>{fmtAgo(a.minAgo)}</em>
              </button>
            ))}
          </div>
        </Card>
      </div>
      {recsNode}
    </>
  );
}
