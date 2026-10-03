import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Download, Copy, Save, ExternalLink } from 'lucide-react';
import { Card, Btn, Chip, Callout } from '../../../components/ui';
import { useApp } from '../../../state/AppContext';
import { tenantName } from '../../../data/customers';
import { fmtDur, plural } from '../../../lib/format';
import { rng } from '../../../lib/rng';
import { vrSaveStatement, vrStatementSaved, vrItsm, VR_SOURCE_META, VR_STATUSES, VR_STATUS_HEX, VR_VERDICT_COLOR, type VrAssetSource } from '../../../data/modules/vulnresponse';
import { useVr } from './state';
import { stamp } from './ui';

const AUDIENCES = ['Customer', 'Board', 'Regulator', 'Insurer'] as const;
type Audience = (typeof AUDIENCES)[number];

export function Statement() {
  const { c, tenantId, adv, rows, tally, verdict, sups, timeline, detections, checks, me, version } = useVr();
  const { toast } = useApp();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const aud = (AUDIENCES as readonly string[]).includes(sp.get('aud') ?? '') ? (sp.get('aud') as Audience) : 'Customer';
  const [made, setMade] = useState<Record<string, boolean>>({});
  const key = `${c.id}:${adv.id}:${aud}`;
  const generated = !!made[key];
  const saved = useMemo(() => vrStatementSaved(c, adv, aud), [c, adv, aud, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const ciso = c.people.ciso;
  const grcLead = c.people.grcLead;
  const itsm = vrItsm(c);
  const reg = c.frameworks.find((f) => f.kind === 'Regulation');
  const scopeName = tenantName(c, tenantId);
  const detail = aud === 'Regulator' || aud === 'Insurer';
  const asked = sups.filter((s) => s.asked);
  const supAff = sups.filter((s) => s.reply === 'Affected – patching' || s.reply === 'Affected – patched');
  const supPatching = sups.filter((s) => s.reply === 'Affected – patching');
  const supNone = asked.filter((s) => !s.reply || s.reply === 'No response');
  const tickets = rows.filter((a) => a.ticket).length;
  const scans = rows.filter((a) => a.scan).length;
  const openRows = rows.filter((a) => a.status === 'Unpatched' || a.status === 'Mitigated');
  const target = openRows.length ? Math.min(...openRows.map((a) => a.dueInMin)) : 0;
  const lastDue = openRows.length ? Math.max(...openRows.map((a) => a.dueInMin)) : 0;
  const ref = `VRS-${adv.cve.slice(4)}-${aud.slice(0, 3).toUpperCase()}`;
  const hash = `sha256:${rng(`${key}-${tally.Patched}-${tally.Mitigated}`).hex(32)}`;
  const answer = verdict === 'Affected' ? 'Yes' : verdict === 'Investigating' ? 'Under investigation' : 'No';
  const srcRows = (['core', 'tooling', 'ot'] as VrAssetSource[]).map((s) => ({ s, n: tally.bySource[s] }));
  const tenants = [...new Set(rows.map((a) => a.tenantName))];
  const services = c.vocab.businessServices.slice(0, 2).join(' and ');

  const intro: Record<Audience, string> = {
    Customer: `You asked whether ${c.name} uses ${adv.product}, affected by ${adv.cve}, and whether it is patched. This statement answers both from live data in HexaView, as at ${stamp(0)}.`,
    Board: `${adv.cve} is a critical (CVSS ${adv.cvss.toFixed(1)}) vulnerability in ${adv.product}${adv.exploited ? ', already exploited by criminal groups' : ''}. This briefing sets out whether we are exposed, what has been done, and what remains, in plain terms.`,
    Regulator: `Statement of exposure and response for ${adv.cve}${reg ? `, prepared to support ${reg.short} supervisory engagement` : ''}. All figures are drawn from HexaView and cite their source system; supporting evidence is listed in section 6.`,
    Insurer: `Statement for ${c.insurance.carrier} via ${c.insurance.broker} on ${adv.cve}, covering exposure, containment and current status. ${detections.length ? 'Detections against affected assets have been reviewed by HexaSOC; no indicators of compromise have been identified to date.' : 'No detections against affected assets have been recorded.'}`,
  };

  const summary = [
    `${c.name} · ${adv.cve} (${adv.product}, CVSS ${adv.cvss.toFixed(1)}${adv.kev ? ', KEV' : ''}) · exposure statement for ${aud.toLowerCase()} · ${stamp(0)}`,
    `Affected: ${answer}.${rows.length ? ` ${plural(rows.length, 'asset')} matched (${srcRows.filter((x) => x.n).map((x) => `${x.n} ${VR_SOURCE_META[x.s].short}`).join(', ')}) within ${adv.matchedAfterMin} min of disclosure.` : ''}`,
    rows.length ? `Status: ${tally.Patched} patched, ${tally.Mitigated} mitigated, ${tally['Not applicable']} not applicable, ${tally.Unpatched} still exposed (${tally.internetOpen} internet-facing).` : '',
    asked.length ? `Suppliers: ${asked.length} asked; ${supAff.length} affected (${supPatching.length} still patching); ${supNone.length} awaiting answers.` : '',
    `Signed off: ${ciso.name}, ${ciso.role}. Ref ${ref}.`,
  ].filter(Boolean).join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      toast('Summary copied to the clipboard');
    } catch {
      toast('Copy is not available in this browser; select the text in the statement instead');
    }
  };
  const setAud = (a: Audience) => { const n = new URLSearchParams(sp); n.set('aud', a); setSp(n, { replace: true }); };

  return (
    <div className="vr-stack">
      <Card
        className="vr-noprint"
        title="Exposure statement"
        sub="A polished, printable answer to “are you affected, and is it fixed?”, built from live data and signed off by the CISO"
        actions={
          <div className="vr-row">
            {generated && <Btn sm onClick={() => window.print()}><Download size={13} /> Download PDF</Btn>}
            {generated && <Btn sm onClick={copy}><Copy size={13} /> Copy summary</Btn>}
            {generated && (saved !== null
              ? <Btn sm onClick={() => nav('/reports/builder?tpl=vuln-exposure')}><ExternalLink size={13} /> Saved · open in Reporting</Btn>
              : <Btn sm onClick={() => { vrSaveStatement(c, adv, aud, me); toast(`Saved to Reporting · ${ref} filed under the “Critical vulnerability exposure statement” template`); }}><Save size={13} /> Save to Reporting</Btn>)}
            {!generated && <Btn primary color="var(--m-int)" onClick={() => { setMade((m) => ({ ...m, [key]: true })); toast(`Exposure statement generated for ${aud.toLowerCase()} · ${ref}`); }}><FileText size={13} /> Generate exposure statement</Btn>}
          </div>
        }
      >
        <div className="vr-row">
          <span className="int-flabel">Audience</span>
          <div className="vr-aud">
            {AUDIENCES.map((a) => <Chip key={a} on={a === aud} onClick={() => setAud(a)} color="var(--m-int)">{a}</Chip>)}
          </div>
          <span className="vr-spacer" />
          <span className="muted" style={{ fontSize: 11.5 }}>{aud === 'Customer' || aud === 'Board' ? 'Hostnames and addresses withheld for this audience' : 'Full evidence trail with hostnames and hashes'}</span>
        </div>
        {!generated && (
          <div style={{ marginTop: 12 }}>
            <Callout>One click drafts the statement for the {aud.toLowerCase()} from the advisory, matched assets, patch evidence, HexaSOC detections, HexaStrike checks and supplier answers. Nothing leaves HexaView until you download, copy or save it.</Callout>
          </div>
        )}
      </Card>

      {generated && (
        <article className="vr-doc vr-print">
          <div className="vr-doc-head">
            <div>
              <div className="vr-doc-org">{c.name} · {scopeName}</div>
              <h1>Critical vulnerability exposure statement</h1>
              <div style={{ color: '#5a6478' }}>{adv.cve} · {adv.product} ({adv.vendor}) · CVSS {adv.cvss.toFixed(1)}{adv.kev ? ' · CISA KEV' : ''}{adv.exploited ? ' · exploited in the wild' : ''}</div>
            </div>
            <div className="vr-doc-meta">
              <div><b>Audience:</b> {aud}</div>
              <div><b>Reference:</b> {ref}</div>
              <div><b>As at:</b> {stamp(0)}</div>
              <div><b>Classification:</b> {aud === 'Customer' ? 'Shareable with the requesting customer' : aud === 'Board' ? 'Board confidential' : 'Confidential'}</div>
            </div>
          </div>

          <div className="vr-answer" style={{ ['--tc' as string]: verdict === 'Affected' ? (tally.Unpatched ? '#e0345e' : '#0f9f8a') : verdict === 'Investigating' ? '#f0a338' : '#0f9f8a' }}>
            <b>{answer}</b>
            <p>
              {verdict === 'Affected'
                ? <>{c.short} runs affected versions on {plural(rows.length, 'asset')}{tenants.length ? ` in ${tenants.join(', ')}` : ''}. <b>{tally.Patched} patched</b>, {tally.Mitigated} mitigated with compensating controls{tally['Not applicable'] ? `, ${tally['Not applicable']} not applicable` : ''}; <b>{tally.Unpatched} remain{tally.Unpatched === 1 ? 's' : ''} exposed</b>{tally.internetOpen ? `, ${tally.internetOpen} of them internet-facing` : ', none internet-facing'}.</>
                : verdict === 'Investigating' ? <>{adv.candidates} hosts may run the product; versions are being confirmed by credentialed scan. No asset is confirmed affected.</>
                : <>No asset, security tool, OT device or recorded supplier in {scopeName} runs an affected version.</>}
            </p>
          </div>

          <h2>1 · Summary</h2>
          <p>{intro[aud]}</p>
          {aud === 'Board' && verdict === 'Affected' && <p>Business services that depend on affected systems: {services}. {tally.Unpatched ? `Remaining exposure is due to close by ${stamp(-lastDue)}.` : 'No exposure remains.'}</p>}

          <h2>2 · What we found</h2>
          <p>The advisory was ingested by HexaInt {fmtDur(adv.matchedAfterMin)} after publication and matched against four sources.</p>
          <table>
            <thead><tr><th>Source</th><th>What was checked</th><th className="r">Affected</th></tr></thead>
            <tbody>
              {srcRows.map((x) => <tr key={x.s}><td>{VR_SOURCE_META[x.s].label}</td><td>{x.s === 'core' ? 'Servers, cloud workloads and endpoints (scanners and EDR)' : x.s === 'tooling' ? 'The security tools we run' : 'OT and connected devices (passive monitoring)'}</td><td className="r">{x.n}</td></tr>)}
              <tr><td>{VR_SOURCE_META.tprm.label}</td><td>Suppliers recorded as running the product</td><td className="r">{sups.filter((s) => s.runsProduct).length}</td></tr>
            </tbody>
          </table>

          <h2>3 · What we did</h2>
          <ul>
            {rows.length > 0 && <li>Raised {plural(tickets, 'ticket')} in {itsm.name} with owners and SLA due dates ({rows.some((a) => a.internet) ? '24 h for internet-facing systems' : '72 h for internal systems'}{rows.some((a) => a.source === 'ot') ? ', 7 days with compensating controls for OT' : ''}).</li>}
            {tally.Mitigated > 0 && <li>Applied interim mitigation on {plural(tally.Mitigated, 'asset')}: {adv.mitigation}</li>}
            {tally.Patched > 0 && <li>Upgraded {plural(tally.Patched, 'asset')} to {adv.fixedIn} and confirmed {scans} by rescan with timestamped, hashed results.</li>}
            <li>HexaSOC monitored affected assets: {detections.length ? `${plural(detections.length, 'detection')} reviewed, ${detections.filter((d) => /Blocked/.test(d.outcome)).length} blocked at the perimeter, no confirmed compromise` : 'no related detections'}.</li>
            {checks.length > 0 && <li>HexaStrike ran non-exploiting validation checks: {checks.filter((k) => k.result === 'Passed').length} passed, {checks.filter((k) => k.result === 'Failed').length} failed, {checks.filter((k) => k.result === 'Scheduled').length} scheduled.</li>}
            {asked.length > 0 ? <li>Asked {plural(asked.length, 'supplier')} whether they are affected: {supAff.length} affected ({supPatching.length} still patching), {asked.length - supAff.length - supNone.length} not affected, {supNone.length} awaiting answers.</li> : sups.length > 0 ? <li>Supplier outreach to {plural(sups.length, 'supplier')} is being prepared.</li> : null}
          </ul>

          {rows.length > 0 && (
            <>
              <h2>4 · Current status</h2>
              <div className="vr-doc-bar">
                {VR_STATUSES.map((s) => (tally[s] ? <i key={s} style={{ width: `${(tally[s] / tally.total) * 100}%`, background: VR_STATUS_HEX[s] }} /> : null))}
              </div>
              <div className="vr-doc-legend">
                {VR_STATUSES.map((s) => <span key={s}><i style={{ background: VR_STATUS_HEX[s] }} />{s} {tally[s]}</span>)}
              </div>
              <p style={{ marginTop: 8 }}>{openRows.length ? `Next SLA deadline ${stamp(-target)}; all remaining work is due by ${stamp(-lastDue)}.` : 'All affected assets are patched or not applicable.'}</p>
            </>
          )}

          <h2>{rows.length ? 5 : 4} · Timeline</h2>
          <table>
            <thead><tr><th style={{ width: 130 }}>When</th><th>Event</th></tr></thead>
            <tbody>
              {timeline.filter((e) => detail || !/Ticket|Chased|scan requested/i.test(e.title)).slice(0, detail ? 14 : 8).map((e, i) => (
                <tr key={i}><td className="mono">{stamp(e.minAgo)}</td><td>{e.title}{e.body && detail ? <span style={{ color: '#8b94a8' }}> · {e.body}</span> : null}</td></tr>
              ))}
            </tbody>
          </table>

          {rows.length > 0 && (
            <>
              <h2>{6} · Evidence trail</h2>
              {detail ? (
                <table>
                  <thead><tr><th>Asset</th><th>Status</th><th>Ticket</th><th>Confirmation</th><th>Hash</th></tr></thead>
                  <tbody>
                    {rows.slice().sort((a, b) => VR_STATUSES.indexOf(b.status) - VR_STATUSES.indexOf(a.status)).map((a) => (
                      <tr key={a.id}>
                        <td className="mono">{a.name}<div style={{ color: '#8b94a8', fontFamily: 'inherit' }}>{a.site}</div></td>
                        <td>{a.status}</td>
                        <td className="mono">{a.ticket ?? '—'}</td>
                        <td>{a.scan ? `${a.scan.tool} · ${stamp(a.scan.minAgo)}` : a.scanRequested ? 'Requested' : '—'}</td>
                        <td className="mono">{a.scan ? a.scan.hash : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table>
                  <thead><tr><th>Evidence</th><th className="r">Items</th><th>Held in</th></tr></thead>
                  <tbody>
                    <tr><td>Patch and change tickets</td><td className="r">{tickets}</td><td>{itsm.name}</td></tr>
                    <tr><td>Rescan confirmations (timestamped, SHA-256)</td><td className="r">{scans}</td><td>{[...new Set(rows.filter((a) => a.scan).map((a) => a.scan!.tool))].join(', ') || '—'}</td></tr>
                    <tr><td>Validation checks</td><td className="r">{checks.length}</td><td>HexaStrike</td></tr>
                    <tr><td>Detections reviewed</td><td className="r">{detections.length}</td><td>HexaSOC</td></tr>
                  </tbody>
                </table>
              )}
            </>
          )}

          <div className="vr-sign">
            <div>
              <div className="vr-sign-sig">{ciso.name.replace(/^Dr\. /, '')}</div>
              <div className="vr-sign-line"><b>{ciso.name}</b>{ciso.role}, {c.name}<br />Signed {stamp(0)}</div>
            </div>
            <div>
              <div className="vr-sign-sig" style={{ fontFamily: 'inherit', fontSize: 12, color: '#5a6478', paddingTop: 14 }}>Prepared by HexaView</div>
              <div className="vr-sign-line"><b>{grcLead.name}</b>{grcLead.role}</div>
            </div>
          </div>

          <div className="vr-doc-foot">
            <span>{ref} · every figure cites its source system in HexaView</span>
            <span className="mono">{hash}</span>
          </div>
        </article>
      )}
      {generated && <div className="vr-noprint muted" style={{ fontSize: 11.5, textAlign: 'center' }}>Verdict colour: <span style={{ color: VR_VERDICT_COLOR[verdict] }}>{verdict}</span> · Download PDF uses your browser&rsquo;s print to PDF with an A4 layout.</div>}
    </div>
  );
}
