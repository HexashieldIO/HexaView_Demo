import { useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Check, Ban, FileSignature, Send, Lock, Unlock, FileText, Clock } from 'lucide-react';
import { KpiStrip, Card, Btn, Callout, KV, Timeline } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import {
  TR_GATE_COLOR, TR_NDA_COLOR, TR_REQ_COLOR, trDecide, trSendNda, trMarkNdaSigned, type TrGate, type TrRequest,
} from '../../data/modules/trust';
import { fmtAgo, fmtDate, daysAhead } from '../../lib/format';
import { useTrust, TRUST_TONE, Pill, TrustNav } from './parts';

type TC = CSSProperties & { '--tc'?: string };
const GATES: TrGate[] = ['Public', 'Click-through NDA', 'Signed NDA', 'Approval required'];

export default function Requests() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const { c, reqs, docs, acl, me, toast } = useTrust();
  const status = sp.get('status');
  const docF = sp.get('doc');
  const selId = sp.get('id');
  const setParam = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (!v) n.delete(k); else n.set(k, v); setSp(n, { replace: true }); };
  const docById = new Map(docs.map((d) => [d.id, d]));
  const [expiry, setExpiry] = useState(30);

  const rows = reqs.filter((r) => (!status || r.status === status) && (!docF || r.docs.includes(docF)));
  const pending = reqs.filter((r) => r.status === 'Pending');
  const ndaPending = reqs.filter((r) => r.nda === 'Pending signature');
  const live = reqs.filter((r) => r.status === 'Approved' && (r.accessDays ?? 0) > 0);
  const closed = reqs.filter((r) => r.status === 'Denied' || r.status === 'Expired');
  const views = acl.filter((a) => a.minAgo <= 30 * 1440 && a.action !== 'Access denied');
  const gated = docs.filter((d) => d.gate !== 'Public');
  const sel = selId ? reqs.find((r) => r.id === selId) : undefined;
  const logRows = docF ? acl.filter((a) => a.docId === docF) : acl;

  const needsSigned = (r: TrRequest) => r.docs.some((d) => { const g = docById.get(d)?.gate; return g === 'Signed NDA' || g === 'Approval required'; });
  const blocked = (r: TrRequest) => needsSigned(r) && r.nda !== 'Signed';

  return (
    <>
      <div className="tr-intro-row">
        <p className="page-intro">
          External parties asking to see {c.short}'s gated assurance documents (audit reports, pen test summary, certificates, insurance certificate). Each request is tied to an NDA, approved by a person, time-limited and watermarked; every view is logged to the audit ledger.
        </p>
        <TrustNav here="requests" />
      </div>

      <KpiStrip
        toneColor={TRUST_TONE}
        items={[
          { label: 'Pending requests', value: pending.length, onClick: () => setParam('status', status === 'Pending' ? null : 'Pending'), source: 'Trust Portal access requests' },
          { label: 'NDAs awaiting signature', value: ndaPending.length, toneColor: ndaPending.length ? 'var(--sev-medium)' : undefined, onClick: () => { setParam('status', 'Pending'); }, source: 'E-signature workflow' },
          { label: 'Live access grants', value: live.length, unit: `of ${reqs.filter((r) => r.status === 'Approved').length} approved`, onClick: () => setParam('status', status === 'Approved' ? null : 'Approved'), source: 'Approved, unexpired access windows' },
          { label: 'Denied / expired', value: closed.length, onClick: () => setParam('status', status === 'Expired' ? null : 'Expired'), source: 'Closed access requests' },
          { label: 'Document views', hint: '30 d', value: views.length, unit: `${new Set(views.map((v) => v.org)).size} orgs`, onClick: () => document.getElementById('tr-acl')?.scrollIntoView({ behavior: 'smooth' }), source: 'Audit ledger (trust_doc.viewed / downloaded)' },
          { label: 'Gated documents', value: gated.length, unit: `of ${docs.length}`, to: '/trust/portal', source: 'Trust Portal document gating' },
        ]}
      />

      <div className="grid g-2-1">
        <div style={{ minWidth: 0 }}>
          <Card
            title="Access requests"
            count={rows.length}
            sub={status || docF ? <>Filtered: {[status, docF && docById.get(docF)?.name].filter(Boolean).join(' · ')} · <a style={{ cursor: 'pointer', color: TRUST_TONE }} onClick={() => setSp(new URLSearchParams(), { replace: true })}>clear</a></> : 'Click a request to decide, send an NDA or revoke'}
            flush
          >
            <DataTable
              rows={rows}
              rowKey={(r) => r.id}
              onRowClick={(r) => setParam('id', r.id)}
              search={(r) => `${r.org} ${r.contact} ${r.email} ${r.reason} ${r.id}`}
              searchPlaceholder="Search organisation or contact…"
              initialSort={{ key: 'st', dir: 'asc' }}
              columns={[
                { key: 'org', header: 'Requester', sort: (r) => r.org, render: (r) => <span className="tr-req"><b>{r.org}</b><span>{r.contact} · {r.orgKind} · {fmtAgo(r.requestedMinAgo)}</span></span> },
                { key: 'docs', header: 'Documents', render: (r) => <span className="muted" style={{ fontSize: 11.5 }}>{r.docs.map((d) => docById.get(d)?.name.replace(/ \(.*\)$/, '') ?? d).join(', ')}</span> },
                { key: 'nda', header: 'NDA', sort: (r) => r.nda, render: (r) => <Pill color={TR_NDA_COLOR[r.nda]}>{r.nda}</Pill> },
                { key: 'exp', header: 'Access', sort: (r) => r.accessDays ?? -1, render: (r) => (r.status === 'Approved' && r.accessDays ? <span style={{ color: r.accessDays < 7 ? 'var(--sev-medium)' : undefined }}>expires in {r.accessDays} d</span> : <span className="muted">—</span>) },
                { key: 'st', header: 'Status', sort: (r) => ['Pending', 'Approved', 'Denied', 'Expired'].indexOf(r.status), render: (r) => <Pill color={TR_REQ_COLOR[r.status]}>{r.status}</Pill> },
              ]}
            />
          </Card>
        </div>

        <Card title="Documents & gating" sub="What a request unlocks · click to filter">
          <div className="tr-gates">
            {GATES.map((g) => (
              <div key={g} className="tr-gate" style={{ '--tc': TR_GATE_COLOR[g] } as TC}><b>{docs.filter((d) => d.gate === g).length}</b><span>{g}</span></div>
            ))}
          </div>
          <div className="tr-docs">
            {docs.map((d) => {
              const n = reqs.filter((r) => r.docs.includes(d.id)).length;
              return (
                <button key={d.id} type="button" className={`tr-doc ${docF === d.id ? 'on' : ''}`} onClick={() => setParam('doc', docF === d.id ? null : d.id)} title={`Source: ${d.source}`}>
                  {d.gate === 'Public' ? <Unlock size={15} /> : <Lock size={15} style={{ color: TR_GATE_COLOR[d.gate] }} />}
                  <span style={{ minWidth: 0 }}><b>{d.name}</b><span>{d.gate} · {d.source} · updated {d.updatedDays} d ago{d.validUntil ? ` · ${d.validUntil}` : ''}</span></span>
                  <span className="muted" style={{ fontSize: 11, textAlign: 'right' }}>{n} req · {d.views30} views</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <div id="tr-acl" style={{ scrollMarginTop: 80 }}>
        <Card title="Access log" count={logRows.length} sub={docF ? `${docById.get(docF)?.name} · every view, download and NDA acceptance` : 'Every view, download and NDA acceptance, recorded in the audit ledger'} flush>
          <DataTable
            rows={logRows}
            rowKey={(a) => a.id}
            search={(a) => `${a.who} ${a.org} ${docById.get(a.docId)?.name ?? ''} ${a.action} ${a.from}`}
            searchPlaceholder="Search who, organisation, document…"
            initialSort={{ key: 'when', dir: 'asc' }}
            pageSize={10}
            columns={[
              { key: 'when', header: 'When', sort: (a) => a.minAgo, render: (a) => <span className="nowrap">{fmtAgo(a.minAgo)}</span> },
              { key: 'who', header: 'Who', sort: (a) => a.who, render: (a) => <span className="tr-req"><b>{a.who}</b><span>{a.org}</span></span> },
              { key: 'doc', header: 'Document', sort: (a) => docById.get(a.docId)?.name ?? '', render: (a) => docById.get(a.docId)?.name ?? a.docId },
              { key: 'act', header: 'Action', sort: (a) => a.action, render: (a) => <span style={{ color: a.action === 'Access denied' ? 'var(--bad)' : a.action === 'NDA accepted' ? TR_NDA_COLOR.Signed : undefined }}>{a.action}</span> },
              { key: 'from', header: 'From', sort: (a) => a.from, render: (a) => <span className="muted">{a.from}</span> },
              { key: 'wm', header: 'Watermark', render: (a) => <span className="mono muted">{a.watermark}</span> },
            ]}
          />
        </Card>
      </div>

      {sel && (
        <Drawer
          title={sel.org}
          sub={`${sel.id} · ${sel.orgKind}`}
          icon={<KeyRound size={18} style={{ color: TRUST_TONE }} />}
          onClose={() => setParam('id', null)}
          footer={
            sel.status === 'Pending' ? (
              <>
                <Btn danger onClick={() => { trDecide(c, sel, 'Denied', me, null); toast(`Access denied for ${sel.org}; requester notified`); }}><Ban size={13} /> Deny</Btn>
                <Btn primary color={TRUST_TONE} disabled={blocked(sel)} title={blocked(sel) ? 'A signed NDA is required for these documents' : undefined} onClick={() => { trDecide(c, sel, 'Approved', me, expiry); toast(`Access approved for ${sel.org} · ${sel.docs.length} document(s) · expires in ${expiry} days · watermarked`); }}><Check size={13} /> Approve for {expiry} days</Btn>
              </>
            ) : sel.status === 'Approved' && (sel.accessDays ?? 0) > 0 ? (
              <Btn danger onClick={() => { trDecide(c, sel, 'Expired', me, 0); toast(`Access revoked for ${sel.org}; open links stop working immediately`); }}><Ban size={13} /> Revoke access</Btn>
            ) : (
              <Btn onClick={() => { trDecide(c, sel, 'Pending', me, null); toast(`${sel.org} request re-opened for a decision`); }}><Clock size={13} /> Re-open</Btn>
            )
          }
        >
          <div className="stack" style={{ gap: 14 }}>
            <KV
              rows={[
                ['Status', <Pill color={TR_REQ_COLOR[sel.status]}>{sel.status}</Pill>],
                ['Contact', <>{sel.contact}<div className="muted" style={{ fontSize: 11 }}>{sel.email}</div></>],
                ['Reason', sel.reason],
                ['Requested', fmtAgo(sel.requestedMinAgo)],
                ['NDA', <Pill color={TR_NDA_COLOR[sel.nda]}>{sel.nda}</Pill>],
                ...(sel.status === 'Approved' && sel.accessDays ? [['Access expires', `${fmtDate(daysAhead(sel.accessDays))} (in ${sel.accessDays} days)`] as [string, string]] : []),
                ...(sel.decidedBy ? [['Decided by', sel.decidedBy] as [string, string]] : []),
                ...(sel.qnId ? [['Linked questionnaire', <a style={{ cursor: 'pointer', color: TRUST_TONE }} onClick={() => nav(`/trust/questionnaires?q=${sel.qnId}`)}>{sel.qnId}</a>] as [string, ReactNode]] : []),
              ]}
            />
            <div>
              <div className="section-label">Documents requested</div>
              <div className="tr-docs">
                {sel.docs.map((id) => {
                  const d = docById.get(id);
                  if (!d) return null;
                  return (
                    <button key={id} type="button" className="tr-doc" onClick={() => nav(d.to)} title={`Open the source in ${d.source}`}>
                      <FileText size={15} style={{ color: TR_GATE_COLOR[d.gate] }} />
                      <span style={{ minWidth: 0 }}><b>{d.name}</b><span>{d.gate} · {d.source}</span></span>
                      <Pill color={TR_GATE_COLOR[d.gate]}>{d.gate === 'Approval required' ? 'Approval' : d.gate.replace(' NDA', '')}</Pill>
                    </button>
                  );
                })}
              </div>
            </div>
            {sel.status === 'Pending' && (
              <>
                {needsSigned(sel) ? (
                  sel.nda === 'Signed' ? <Callout kind="good">Signed NDA on file. You can approve access.</Callout> : (
                    <Callout kind="warn">
                      These documents need a signed NDA. {sel.nda === 'Pending signature' ? 'The NDA was sent and is awaiting signature.' : 'Send the standard mutual NDA for e-signature first.'}
                      <div className="row" style={{ gap: 8, marginTop: 8 }}>
                        {sel.nda !== 'Pending signature' && <Btn sm onClick={() => { trSendNda(c, sel, me); toast(`Mutual NDA sent to ${sel.email} for e-signature`); }}><Send size={13} /> Send NDA</Btn>}
                        {sel.nda === 'Pending signature' && <Btn sm onClick={() => { trMarkNdaSigned(c, sel, me); toast(`NDA signed by ${sel.contact} (${sel.org}); countersigned copy filed`); }}><FileSignature size={13} /> Record signature</Btn>}
                      </div>
                    </Callout>
                  )
                ) : <Callout kind="info">Click-through NDA accepted on the portal; no signature needed for these documents.</Callout>}
                <label className="stack" style={{ gap: 4, fontSize: 12 }}>
                  Access window
                  <select className="select" value={expiry} onChange={(e) => setExpiry(Number(e.target.value))}>
                    {[7, 30, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
                  </select>
                </label>
                <Callout kind="info">Risk class: low. Documents open in a watermarked viewer tied to {sel.email}; downloads carry a per-recipient forensic watermark and every view is logged.</Callout>
              </>
            )}
            <div>
              <div className="section-label">Activity for {sel.org}</div>
              {(() => {
                const items = acl.filter((a) => a.org === sel.org).slice(0, 8);
                return items.length ? <Timeline items={items.map((a) => ({ time: fmtAgo(a.minAgo), title: `${a.action} · ${docById.get(a.docId)?.name ?? a.docId}`, body: `${a.who} from ${a.from} · ${a.watermark}` }))} /> : <div className="empty">No document access yet.</div>;
              })()}
            </div>
          </div>
        </Drawer>
      )}
    </>
  );
}

