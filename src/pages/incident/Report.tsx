import { useMemo, useState } from 'react';
import { Play, Download, PenLine, Send, CheckCircle2, RotateCcw, Quote, Clock } from 'lucide-react';
import { Card, KpiStrip, Btn, Callout, KV, Badge } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { CustomerLogo } from '../../components/CustomerLogo';
import { GenerateModal, SignOffModal } from '../reports/parts';
import '../reports/reports.css';
import { fmtBytes, techName, techTactic } from '../../data/modules/soc';
import { fmtMoney, fmtNum } from '../../lib/format';
import type { CustomerProfile } from '../../data/types';
import {
  IR_AUDIENCES, IR_SECTIONS, AUDIENCE_SECTIONS, IR_TYPES, SEV_LABEL, PHASE_LABEL, STREAMS, DEST_META,
  type IrIncident, type IrAudience, type IrSectionId,
} from '../../data/modules/incident';
import { useIr, IrPage, IncidentPicker, NoIncident, Pill, fmtT, fmtSpan, useGuideTarget, IR_TONE } from './parts';
import { ir } from './store';

interface Cite { n: number; id: string; source: string; version: string }
interface Stmt { text: string; refs: number[] }
interface Sec { id: IrSectionId; title: string; lead: string; statements: Stmt[] }

function buildDoc(c: CustomerProfile, inc: IrIncident, audience: IrAudience, sections: IrSectionId[]) {
  const cites: Cite[] = [];
  const cite = (id: string, source: string, version: string) => {
    const hit = cites.find((x) => x.id === id);
    if (hit) return hit.n;
    cites.push({ n: cites.length + 1, id, source, version });
    return cites.length;
  };
  const tl = inc.timeline.slice().sort((a, b) => a.t - b.t);
  const ref = (pred: (text: string) => boolean) => { const e = tl.find((x) => pred(x.text)); return e ? [cite(e.id, e.source, `#${e.seq} · ${e.hash.slice(0, 8)}`)] : []; };
  const declared = tl.find((e) => e.type === 'phase');
  const tenant = c.tenants.find((t) => t.id === inc.tenantIds[0]);
  const plain = audience === 'Customers';
  const out: Sec[] = [];
  const sent = inc.notices.filter((n) => n.status === 'sent');
  for (const id of IR_SECTIONS.map((s) => s.id).filter((x) => sections.includes(x))) {
    const title = IR_SECTIONS.find((s) => s.id === id)?.label ?? id;
    if (id === 'summary') out.push({ id, title, lead: plain ? `What happened and what ${c.short} has done about it.` : `${SEV_LABEL[inc.sev]} · ${IR_TYPES[inc.type].label} at ${tenant?.name}.`, statements: [
      { text: plain ? inc.summary.split('.').slice(0, 2).join('.') + '.' : inc.summary, refs: declared ? [cite(declared.id, declared.source, `#${declared.seq}`)] : [] },
      { text: `Detected ${fmtT(inc.detectedAt)}, escalated by HexaSOC to L4 after ${fmtSpan(inc.escalatedAt - inc.detectedAt)} and declared ${fmtSpan(inc.declaredAt - inc.escalatedAt)} later under commander ${inc.commander}.`, refs: ref((t) => t.startsWith('Escalated to L4')) },
      { text: inc.status === 'closed' ? `Closed ${fmtT(inc.closedAt ?? inc.declaredAt)} after ${fmtSpan((inc.closedAt ?? inc.declaredAt) - inc.declaredAt)}.` : `Currently in ${PHASE_LABEL[inc.phase].toLowerCase()}, T+${fmtSpan(Date.now() - inc.declaredAt)}.`, refs: ref((t) => t.startsWith('Phase advanced')) },
      ...(audience !== 'Customers' ? [{ text: `Estimated financial impact ${fmtMoney(inc.stats.impact, c.currency)}; ${sent.length} of ${inc.notices.length} notifications sent.`, refs: [] }] : []),
    ] });
    if (id === 'timeline') out.push({ id, title, lead: 'Key events pinned on the audited timeline, in order.', statements: tl.filter((e) => e.key).slice(0, 14).map((e) => ({ text: `${fmtT(e.t)} · ${e.text}`, refs: [cite(e.id, e.source, `#${e.seq} · ${e.hash.slice(0, 8)}`)] })) });
    if (id === 'scope') out.push({ id, title, lead: 'Tenants, systems and business services in scope.', statements: [
      { text: `Tenants: ${inc.sites.join('; ')}.`, refs: [] },
      { text: `Systems: ${inc.assets.join(', ')}${inc.users.length ? `; accounts: ${inc.users.join(', ')}` : ''}.`, refs: ref((t) => t.includes('declared')) },
      { text: `Business services affected: ${inc.services.join('; ')}.`, refs: [] },
      { text: `Containment: ${inc.stats.hostsIsolated} hosts isolated and ${inc.stats.accountsDisabled} accounts disabled.`, refs: ref((t) => t.includes('isolated') || t.includes('disabled')) },
    ] });
    if (id === 'root') out.push({ id, title, lead: 'Initial access to impact, mapped to MITRE ATT&CK.', statements: [
      { text: `Root cause: ${inc.rootCause}.`, refs: ref((t) => t.startsWith('Root cause')) },
      ...inc.techniques.map((t) => ({ text: `${t} ${techName(t)} (${techTactic(t)})`, refs: [] })),
      ...(inc.actor ? [{ text: `Tradecraft overlaps with ${inc.actor} (HexaInt, medium confidence); attribution is not asserted.`, refs: [] }] : []),
    ] });
    if (id === 'actions') out.push({ id, title, lead: 'What was done, by workstream.', statements: STREAMS.map((s): Stmt | null => {
      const ts = inc.tasks.filter((t) => t.stream === s);
      return ts.length ? { text: `${s}: ${ts.filter((t) => t.status === 'done').length}/${ts.length} complete · ${ts.map((t) => t.title).join('; ')}.`, refs: [] } : null;
    }).filter((x): x is Stmt => !!x).concat(inc.decisions.slice(0, 4).map((d) => ({ text: `Decision: ${d.decision} (${d.by}).`, refs: ref((t) => t.startsWith(d.decision.slice(0, 30))) }))) });
    if (id === 'notices') out.push({ id, title, lead: 'Statutory, contractual and voluntary notifications.', statements: inc.notices.map((n) => ({ text: `${n.name} → ${n.recipient}: ${n.status === 'sent' ? `sent ${fmtT(n.sentAt ?? 0)}${n.dueAt ? ((n.sentAt ?? 0) <= n.dueAt ? ' (on time)' : ' (late)') : ''}` : n.status === 'na' ? 'not required' : `${n.status}${n.dueAt ? `, due ${fmtT(n.dueAt)}` : ''}`}.`, refs: n.status === 'sent' ? ref((t) => t.includes(n.name)) : [] })) });
    if (id === 'data') out.push({ id, title, lead: plain ? 'The information involved.' : 'Data classes, records and individuals.', statements: [
      { text: `Data classes: ${inc.dataClasses.join('; ')}.`, refs: [] },
      { text: inc.stats.records ? `Approximately ${fmtNum(inc.stats.records)} records are in scope; the notification population is ${inc.personal ? 'being confirmed by the DPO' : 'not applicable (no personal data)'}.` : 'No records confirmed as accessed or exfiltrated.', refs: [] },
    ] });
    if (id === 'lessons') out.push({ id, title, lead: 'From the blameless post-incident review.', statements: [
      ...inc.review.wentWell.map((x) => ({ text: `Went well: ${x}.`, refs: [] })),
      ...inc.review.didnt.map((x) => ({ text: `To improve: ${x}.`, refs: [] })),
      ...inc.review.actions.map((a) => ({ text: `Action: ${a.title} · ${a.owner}${a.ref ? ` · ${DEST_META[a.dest].label} ${a.ref}` : ''}.`, refs: [] })),
    ].concat(inc.review.status === 'not_started' ? [{ text: 'Review not yet held.', refs: [] }] : []) });
    if (id === 'appendix') out.push({ id, title, lead: 'Evidence items, hashed at source and held in HexaCustody.', statements: inc.evidence.map((e) => ({ text: `${e.id} · ${e.type} · ${e.name} · ${fmtBytes(e.bytes)} · SHA-256 ${e.sha256.slice(0, 16)}…${e.legalHold ? ' · legal hold' : ''}`, refs: [cite(e.id, 'HexaCustody evidence vault', `${e.custody.length} hops`)] })) });
  }
  return { sections: out, cites };
}

export default function Report() {
  return <IrPage><Inner /></IrPage>;
}
function Inner() {
  const { focus } = useIr();
  return <><IncidentPicker />{focus ? <Builder inc={focus} /> : <NoIncident />}</>;
}

function Builder({ inc }: { inc: IrIncident }) {
  const { c, actor, toast, ppl, incidents, nav, setFocus } = useIr();
  const [modal, setModal] = useState<'generate' | 'signoff' | 'cites' | null>(null);
  const guide = useGuideTarget(5);
  const rep = inc.report;
  const doc = useMemo(() => buildDoc(c, inc, rep.audience, rep.sections), [c, inc, rep.audience, rep.sections]);
  const title = `${inc.id} incident report · ${IR_TYPES[inc.type].label}`;
  const statements = doc.sections.reduce((s, x) => s + x.statements.length, 0);
  const signed = rep.status === 'signed' || rep.status === 'issued';
  const awaiting = incidents.filter((i) => i.report.status === 'generated' || i.report.status === 'requested');
  const setAudience = (a: IrAudience) => ir.setReport(c, inc.id, { audience: a, sections: AUDIENCE_SECTIONS[a] });
  const toggle = (id: IrSectionId) => ir.setReport(c, inc.id, { sections: rep.sections.includes(id) ? rep.sections.filter((x) => x !== id) : [...rep.sections, id] });
  const steps = ['Freezing the audited timeline (hash head)', 'Pulling key events and decisions', 'Scoping assets, data and services', 'Mapping ATT&CK techniques', 'Collating notifications and evidence', 'Drafting cited statements'];

  return (
    <>
      <p className="page-intro">
        Incident report builder for <b>{inc.id}</b>. Every statement is cited to an audited timeline entry or evidence item; the paper keeps a DRAFT watermark until both legal ({ppl.legal.name}) and the CISO ({ppl.ciso.name}) sign. Issuing anchors the SHA-256 of the signed version to the audit ledger.
      </p>
      <KpiStrip toneColor={IR_TONE} items={[
        { label: 'Report status', value: rep.status === 'none' ? 'Not started' : rep.status[0].toUpperCase() + rep.status.slice(1), hint: rep.version ? `v${rep.version}` : 'generate to start', toneColor: signed ? 'var(--good)' : IR_TONE, onClick: () => document.getElementById('ir-rep-actions')?.scrollIntoView({ behavior: 'smooth' }), source: 'HexaView Reporting' },
        { label: 'Sections', value: rep.sections.length, unit: `of ${IR_SECTIONS.length}`, hint: rep.audience, onClick: () => document.getElementById('ir-rep-sections')?.scrollIntoView({ behavior: 'smooth' }), source: 'Report configuration' },
        { label: 'Citations', value: doc.cites.length, unit: `${statements} statements`, onClick: () => setModal('cites'), source: 'HexaView IR audited timeline · HexaCustody' },
        { label: 'Sign-offs', value: `${(rep.legal ? 1 : 0) + (rep.ciso ? 1 : 0)}/2`, hint: 'legal + CISO', toneColor: signed ? 'var(--good)' : 'var(--sev-medium)', onClick: () => document.getElementById('ir-rep-actions')?.scrollIntoView({ behavior: 'smooth' }), source: 'Sign-off ledger' },
        { label: 'Awaiting sign-off (all)', value: awaiting.length, hint: awaiting.map((i) => i.id).join(', ') || 'none', onClick: () => awaiting[0] && setFocus(awaiting[0].id), source: 'Sign-off ledger' },
      ]} />

      <div className="grid g-1-2">
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Report" sub="Audience sets the default sections and tone">
            <div className="ir-form">
              <label><span className="section-label" style={{ margin: 0 }}>Audience</span>
                <select className="select" value={rep.audience} onChange={(e) => setAudience(e.target.value as IrAudience)} aria-label="Audience">{IR_AUDIENCES.map((a) => <option key={a}>{a}</option>)}</select>
              </label>
              <KV rows={[['Title', title], ['Incident', `${SEV_LABEL[inc.sev]} · ${PHASE_LABEL[inc.phase]}${inc.status === 'closed' ? ' · closed' : ''}`], ['Version', rep.version ? `v${rep.version}${rep.generatedAt ? ` · generated ${fmtT(rep.generatedAt)}` : ''}` : 'not generated']]} />
            </div>
          </Card>
          <Card title="Sections" sub="Tick to add; the preview updates live" actions={<Btn sm ghost onClick={() => ir.setReport(c, inc.id, { sections: AUDIENCE_SECTIONS[rep.audience] })}><RotateCcw size={13} /> Reset</Btn>}>
            <div className="rep-pal" id="ir-rep-sections">
              {IR_SECTIONS.map((s) => (
                <label key={s.id} className={rep.sections.includes(s.id) ? 'on' : ''}>
                  <input type="checkbox" checked={rep.sections.includes(s.id)} onChange={() => toggle(s.id)} />
                  <div><b>{s.label}</b><span>{s.hint}</span></div>
                </label>
              ))}
            </div>
          </Card>
          <Card tinted toneColor={IR_TONE}>
            <div id="ir-rep-actions" className={`stack ${guide}`} style={{ gap: 10 }}>
              {rep.status === 'issued' ? <Callout kind="good">Issued {fmtT(rep.issuedAt ?? 0)} to {rep.audience}. SHA-256 {rep.hash ? `${rep.hash.slice(0, 16)}…` : 'anchored'}.</Callout>
                : signed ? <Callout kind="good">Signed by legal and the CISO. DRAFT watermark removed; ready to issue.</Callout>
                : rep.status === 'requested' ? <Callout>Sign-off requested {fmtT(rep.requestedAt ?? 0)}. Approvers can reject single statements.</Callout>
                : rep.status === 'generated' ? <Callout>Generated {fmtT(rep.generatedAt ?? 0)} from the audited timeline. Request sign-off to release it.</Callout>
                : <Callout>Nothing is released until legal and the CISO sign.</Callout>}
              <div className="row wrap" style={{ gap: 8 }}>
                <Btn primary color={IR_TONE} disabled={!rep.sections.length} onClick={() => setModal('generate')}><Play size={13} /> {rep.version ? 'Regenerate' : 'Generate'}</Btn>
                <Btn onClick={() => window.print()}><Download size={13} /> Download PDF</Btn>
                <Btn disabled={rep.status !== 'generated'} onClick={() => setModal('signoff')}><PenLine size={13} /> Request sign-off</Btn>
                <Btn primary={signed && rep.status !== 'issued'} color={IR_TONE} disabled={rep.status !== 'signed'} onClick={() => { ir.issue(c, inc.id, actor); toast(`Report v${rep.version} issued to ${rep.audience}`); }}><Send size={13} /> Issue</Btn>
              </div>
              {(rep.status === 'requested' || rep.status === 'signed' || rep.status === 'issued') && (
                <div className="stack" style={{ gap: 6 }}>
                  <SignRow label={`Legal · ${ppl.legal.name}`} sig={rep.legal} onSign={rep.status === 'requested' ? () => { ir.sign(c, inc.id, 'legal', ppl.legal.name); toast(`${ppl.legal.name} signed (legal)`); } : undefined} />
                  <SignRow label={`CISO · ${ppl.ciso.name}`} sig={rep.ciso} onSign={rep.status === 'requested' ? () => { ir.sign(c, inc.id, 'ciso', ppl.ciso.name); toast(`${ppl.ciso.name} signed (CISO)`); } : undefined} />
                </div>
              )}
            </div>
          </Card>
          <Callout>Other formats: the Reporting Centre can schedule this report or include it in a board pack. <button className="ir-link" onClick={() => nav('/reports/builder')}>Open Reporting</button></Callout>
        </div>

        <Card title="Live preview" sub={`${rep.audience} · ${doc.sections.length} sections · ${doc.cites.length} citations`} actions={<><Badge color={signed ? 'var(--good)' : IR_TONE}>{signed ? 'Signed' : 'Draft'}</Badge><Btn sm ghost onClick={() => setModal('cites')}><Quote size={13} /> Citations</Btn></>}>
          <div className="rep-paper-wrap ir-print">
            <Paper c={c} inc={inc} title={title} doc={doc} signed={signed} />
          </div>
        </Card>
      </div>

      {modal === 'generate' && (
        <GenerateModal title={title} steps={steps} tone={IR_TONE} onClose={() => setModal(null)} onDone={() => { setModal(null); ir.generate(c, inc.id, actor); toast(`Report generated · ${doc.cites.length} citations (DRAFT until signed)`); }} />
      )}
      {modal === 'signoff' && (
        <SignOffModal title={`${title} · v${rep.version}`} heading="Request sign-off" cta="Request from" tone={IR_TONE} approvers={[`${ppl.legal.name} (legal) + ${ppl.ciso.name} (CISO)`]} format="PDF"
          extra={<Callout>Both signatures are required. {doc.cites.length} citations across {doc.sections.length} sections.</Callout>}
          onClose={() => setModal(null)} onSubmit={(_, note) => { ir.requestSignoff(c, inc.id, actor, note); toast('Sign-off requested from legal and the CISO'); setModal(null); }} />
      )}
      {modal === 'cites' && (
        <Drawer wide title="Statements and citations" sub={`${statements} statements · ${doc.cites.length} records`} onClose={() => setModal(null)}>
          <div className="tbl-wrap" style={{ margin: 0 }}>
            <table className="tbl">
              <thead><tr><th>#</th><th>Record</th><th>Source</th><th>Version</th></tr></thead>
              <tbody>{doc.cites.map((x) => <tr key={x.n}><td>[{x.n}]</td><td className="mono" style={{ fontSize: 11 }}>{x.id}</td><td>{x.source}</td><td className="mono" style={{ fontSize: 11 }}>{x.version}</td></tr>)}</tbody>
            </table>
          </div>
        </Drawer>
      )}
    </>
  );
}

function SignRow({ label, sig, onSign }: { label: string; sig?: { name: string; t: number }; onSign?: () => void }) {
  return (
    <div className="row between" style={{ gap: 8, fontSize: 12.5 }}>
      <span>{sig ? <CheckCircle2 size={14} style={{ color: 'var(--good)', verticalAlign: -2 }} /> : <Clock size={14} style={{ color: 'var(--sev-medium)', verticalAlign: -2 }} />} {label}</span>
      {sig ? <span className="ir-sub">signed {fmtT(sig.t)}</span> : onSign ? <Btn sm onClick={onSign}><PenLine size={12} /> Sign</Btn> : <span className="ir-sub">pending</span>}
    </div>
  );
}

function Paper({ c, inc, title, doc, signed }: { c: CustomerProfile; inc: IrIncident; title: string; doc: ReturnType<typeof buildDoc>; signed: boolean }) {
  const rep = inc.report;
  const keyEvents = inc.timeline.filter((e) => e.key).sort((a, b) => a.t - b.t).slice(0, 10);
  return (
    <div className="rep-paper ir-paper">
      {!signed && <div className="rep-watermark">DRAFT</div>}
      <div className="rep-cover">
        <div className="rep-cover-top">
          <CustomerLogo c={c} size={40} className="rep-logo" />
          <div><small>HexaView · Incident Response (L4) · incident report</small><b>{c.name}</b></div>
          <span className="rep-class">{rep.audience === 'Customers' ? 'For release' : 'Confidential · privileged'} · {rep.audience}</span>
        </div>
        <h2>{title}</h2>
        <div className="rep-cover-meta">
          <span className="rep-period-chip">{SEV_LABEL[inc.sev]}</span>
          <span>{inc.title}</span>
          <span>Declared {fmtT(inc.declaredAt)}</span>
          <span>{rep.version ? `Version ${rep.version}` : 'Not yet generated'}</span>
        </div>
      </div>
      {doc.sections.map((s, i) => (
        <section key={s.id} className="rep-sec">
          <h4><em>{String(i + 1).padStart(2, '0')}</em>{s.title}</h4>
          <p className="rep-lead">{s.lead}</p>
          {s.id === 'scope' && (
            <div className="rep-tiles" style={{ marginBottom: 10 }}>
              <div className="rep-tile" style={{ ['--tile' as string]: IR_TONE }}><b>{inc.assets.length}</b><span>systems in scope</span></div>
              <div className="rep-tile" style={{ ['--tile' as string]: IR_TONE }}><b>{inc.services.length}</b><span>business services</span></div>
              <div className="rep-tile" style={{ ['--tile' as string]: IR_TONE }}><b>{inc.stats.records ? fmtNum(inc.stats.records) : '0'}</b><span>records at risk</span></div>
              <div className="rep-tile" style={{ ['--tile' as string]: IR_TONE }}><b>{fmtMoney(inc.stats.impact, c.currency)}</b><span>estimated impact</span></div>
            </div>
          )}
          {s.id === 'timeline' && keyEvents.length > 0 && (
            <table className="rep-table" style={{ marginBottom: 6 }}>
              <thead><tr><th>Time</th><th>Event</th><th>Source</th></tr></thead>
              <tbody>{keyEvents.map((e) => <tr key={e.id}><td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtT(e.t)}</td><td>{e.text}</td><td>{e.source}</td></tr>)}</tbody>
            </table>
          )}
          {s.id === 'root' && (
            <div className="row wrap" style={{ gap: 4, marginBottom: 8 }}>
              {inc.techniques.map((t, k) => <span key={t} className="row" style={{ gap: 4 }}><Pill color="var(--m-soc)">{t}</Pill>{k < inc.techniques.length - 1 && <span className="muted">→</span>}</span>)}
            </div>
          )}
          {s.id === 'timeline' ? null : (
            <ul>
              {s.statements.map((st, j) => <li key={j}>{st.text}{st.refs.map((n) => <sup key={n}>[{n}]</sup>)}</li>)}
            </ul>
          )}
          {s.id === 'timeline' && <p className="rep-p" style={{ fontSize: 11.5 }}>{s.statements.map((st) => st.refs.map((n) => `[${n}]`).join('')).join(' ')}</p>}
        </section>
      ))}
      {doc.sections.length === 0 && <p className="rep-empty">Choose sections to start the report.</p>}
      {doc.cites.length > 0 && (
        <section className="rep-sec rep-appendix">
          <h4><em>A</em>Citation appendix</h4>
          <table className="rep-table">
            <thead><tr><th>#</th><th>Record</th><th>Source</th><th>Version</th></tr></thead>
            <tbody>{doc.cites.map((x) => <tr key={x.n}><td>[{x.n}]</td><td className="mono">{x.id}</td><td>{x.source}</td><td className="mono">{x.version}</td></tr>)}</tbody>
          </table>
        </section>
      )}
      <div className="rep-foot">
        <span>{c.short} · {inc.id} · {rep.audience}</span>
        <span>{signed ? `Signed by ${rep.legal?.name} (legal) and ${rep.ciso?.name} (CISO) · SHA-256 ${rep.hash?.slice(0, 12) ?? ''}…` : 'Unsigned draft · nothing is released until legal and the CISO sign'}</span>
      </div>
    </div>
  );
}
