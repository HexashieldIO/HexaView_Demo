import { useState } from 'react';
import { AlertTriangle, ArrowLeft, FileText, Printer, Send } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { Card, KpiStrip, Badge, Bar, Btn, Callout, Chip, Ring, SevBadge, Legend } from '../../../components/ui';
import { Drawer } from '../../../components/Overlay';
import { DataTable, type Column } from '../../../components/DataTable';
import { PARTNER } from '../../../data/modules/partner';
import { DD_TARGETS, DD_CATEGORIES, ddImpact, type DdFinding, type DdTarget, type DdSev } from '../../../data/modules/portfolio';
import { NOW, fmtDate, fmtNum, scoreTone } from '../../../lib/format';
import { CoAvatar, PF_TONE, usdK, usdM, usePfNav } from './parts';

const SEV_HEX: Record<DdSev, string> = { critical: '#e0345e', high: '#f2643f', medium: '#f0a338', low: '#e2c73f' };
const SEVS: DdSev[] = ['critical', 'high', 'medium', 'low'];
const CERT_COLOR = { valid: 'var(--good)', expired: 'var(--bad)', claimed: 'var(--sev-medium)', none: 'var(--text-muted)' } as const;
const CERT_LABEL = { valid: 'Valid', expired: 'Expired', claimed: 'Claimed, unverified', none: 'None' } as const;
const initials = (t: DdTarget) => t.short.slice(0, 2).toUpperCase();

function Report({ t, onBack }: { t: DdTarget; onBack: () => void }) {
  const im = ddImpact(t);
  const flags = t.findings.filter((f) => f.redFlag);
  return (
    <>
      <div className="row wrap no-print" style={{ gap: 8 }}>
        <Btn onClick={onBack}><ArrowLeft /> Back to due diligence</Btn>
        <span className="spacer" />
        <Btn primary color={PF_TONE} onClick={() => window.print()}><Printer /> Print or save as PDF</Btn>
      </div>
      <article className="pf-report">
        <header>
          <div className="muted" style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>Cyber due diligence report · confidential · prepared by {PARTNER.name} on HexaView</div>
          <h1>{t.name}</h1>
          <p>{t.sector} · {t.hq} · {fmtNum(t.employees)} employees · deal stage: {t.stage} · {fmtDate(NOW)}</p>
        </header>
        <div className="pf-report-meta">
          <div><small>Outside-in score</small><b style={{ color: scoreTone(t.outsideIn) }}>{t.outsideIn}</b> <span className="muted">peer {t.peer}</span></div>
          <div><small>Red flags</small><b>{im.flags}</b></div>
          <div><small>Remediation estimate</small><b>{usdK(im.lo)}–{usdK(im.hi)}</b></div>
          <div><small>Questionnaire</small><b>{im.qPct}%</b> <span className="muted">{im.flagged} answers flagged</span></div>
        </div>
        <section><h2>Summary</h2><p>{t.summary}</p></section>
        <section>
          <h2>Deal impact</h2>
          <table>
            <tbody>
              <tr><td>Deal value</td><td><b>{usdM(t.dealValueM)}</b></td></tr>
              <tr><td>Estimated remediation cost (first 12 months)</td><td><b>{usdK(im.lo)} to {usdK(im.hi)}</b></td></tr>
              <tr><td>Suggested price adjustment</td><td><b>{usdK(im.adjustK)}</b> ({im.adjustPct.toFixed(2)}% of deal value)</td></tr>
              <tr><td>Suggested escrow / holdback</td><td><b>{usdK(im.escrowK)}</b> ({im.escrowPct.toFixed(1)}%), released on evidence of red-flag remediation</td></tr>
              {t.breaches.length > 0 && <tr><td>Specific indemnity</td><td>Recommended for losses arising from: {t.breaches.map((b) => `${b.year} ${b.what.toLowerCase()}`).join('; ')}</td></tr>}
              <tr><td>Conditions precedent</td><td>{flags.slice(0, 3).map((f) => f.title.split(';')[0]).join('; ')}</td></tr>
            </tbody>
          </table>
        </section>
        <section>
          <h2>Red flags</h2>
          <table>
            <thead><tr><th>Ref</th><th>Finding</th><th>Severity</th><th>Source</th></tr></thead>
            <tbody>{flags.map((f) => <tr key={f.id}><td>{f.id}</td><td><b>{f.title}</b><br /><span className="muted">{f.detail}</span></td><td>{f.sev}</td><td>{f.source}</td></tr>)}</tbody>
          </table>
        </section>
        <section>
          <h2>All findings</h2>
          <table>
            <thead><tr><th>Ref</th><th>Category</th><th>Finding</th><th>Severity</th><th>Fix estimate</th></tr></thead>
            <tbody>{t.findings.map((f) => <tr key={f.id}><td>{f.id}</td><td>{f.category}</td><td>{f.title}</td><td>{f.sev}</td><td>{f.fixHighK ? `${usdK(f.fixLowK)}–${usdK(f.fixHighK)}` : 'n/a'}</td></tr>)}</tbody>
          </table>
        </section>
        <section>
          <h2>Certifications and breach history</h2>
          <p>{t.certifications.map((c) => `${c.name}: ${CERT_LABEL[c.state].toLowerCase()}`).join(' · ')}</p>
          <p style={{ marginTop: 6 }}>{t.breaches.length ? t.breaches.map((b) => `${b.year}: ${b.what}${b.records ? ` (${b.records})` : ''}`).join(' · ') : 'No public breaches or regulatory notifications found.'}</p>
        </section>
        <div className="pf-report-foot">
          Method: outside-in assessment by HexaInt (attack surface, leaked credentials, dark-web and code-leak monitoring, domain intelligence), public breach and certificate registries, and the target's questionnaire responses ({im.answered} of {im.total} answered). No intrusive testing was performed. Cost estimates are indicative ranges for planning, not quotes. Deal lead: {t.dealLead}.
        </div>
      </article>
    </>
  );
}

export default function Diligence() {
  const { toast } = useApp();
  const { sp, set, patch } = usePfNav();
  const t = DD_TARGETS.find((x) => x.id === sp.get('target')) ?? DD_TARGETS[0];
  const im = ddImpact(t);
  const [cat, setCat] = useState<string>('all');
  const [sel, setSel] = useState<DdFinding | null>(null);
  const flagsOnly = sp.get('flags') === '1';
  if (sp.get('report') === '1') return <Report t={t} onBack={() => set('report', null)} />;

  const all = DD_TARGETS.map((x) => ({ x, im: ddImpact(x) }));
  const worst = all.slice().sort((a, b) => b.im.flags - a.im.flags)[0];
  const rows = t.findings.filter((f) => (cat === 'all' || f.category === cat) && (!flagsOnly || f.redFlag));

  const cols: Column<DdFinding>[] = [
    { key: 'id', header: 'Ref', sort: (f) => f.id, render: (f) => <span className="num muted" style={{ whiteSpace: 'nowrap' }}>{f.id}</span> },
    { key: 'sev', header: 'Severity', sort: (f) => SEVS.indexOf(f.sev), render: (f) => <SevBadge sev={f.sev} /> },
    { key: 'cat', header: 'Category', sort: (f) => f.category, render: (f) => f.category },
    { key: 'title', header: 'Finding', render: (f) => <span>{f.redFlag && <AlertTriangle size={12} style={{ color: 'var(--bad)', marginRight: 4, verticalAlign: -1 }} />}{f.title}</span> },
    { key: 'src', header: 'Source', render: (f) => <span className="muted" style={{ fontSize: 11.5 }}>{f.source}</span> },
    { key: 'fix', header: 'Fix estimate', align: 'right', sort: (f) => f.fixHighK, render: (f) => (f.fixHighK ? `${usdK(f.fixLowK)}–${usdK(f.fixHighK)}` : <span className="muted">n/a</span>) },
  ];

  return (
    <>
      <KpiStrip
        toneColor={PF_TONE}
        items={[
          { label: 'Targets in diligence', value: DD_TARGETS.length, hint: usdM(DD_TARGETS.reduce((s, x) => s + x.dealValueM, 0)), onClick: () => patch({ target: null, flags: null }), source: 'Deal team pipeline' },
          { label: 'Red flags', value: all.reduce((s, a) => s + a.im.flags, 0), hint: `most: ${worst.x.short}`, onClick: () => patch({ target: worst.x.id, flags: '1' }), source: 'HexaInt outside-in · questionnaire' },
          { label: `${t.short} outside-in score`, value: t.outsideIn, hint: `peer ${t.peer}`, bar: t.outsideIn, onClick: () => setCat('Attack surface'), source: 'HexaInt attack-surface and exposure scoring' },
          { label: `${t.short} remediation`, value: usdK(Math.round((im.lo + im.hi) / 2)), hint: `range ${usdK(im.lo)}–${usdK(im.hi)}`, onClick: () => set('flags', null), source: 'HexaShield remediation cost model' },
          { label: 'Questionnaire', value: im.qPct, unit: '%', hint: `${im.flagged} flagged`, bar: im.qPct, onClick: () => setCat('Questionnaire'), source: 'HexaComply TPRM questionnaire' },
          { label: 'Signing in', value: t.signingIn, unit: 'days', hint: t.stage, onClick: () => set('report', '1'), source: 'Deal timetable' },
        ]}
      />

      <div className="pf-targets">
        {all.map(({ x, im: xi }) => (
          <button key={x.id} type="button" className={`pf-target ${x.id === t.id ? 'on' : ''}`} onClick={() => patch({ target: x.id, flags: null })}>
            <div className="pf-target-top">
              <CoAvatar co={{ initials: initials(x), colour: x.colour }} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 13 }}>{x.name}</b>
                <span className="muted" style={{ fontSize: 11 }}>{x.sector} · {x.hq}</span>
              </div>
              <Badge color={PF_TONE}>{x.stage}</Badge>
            </div>
            <div className="pf-target-stats">
              <span><b>{usdM(x.dealValueM)}</b>deal value</span>
              <span><b style={{ color: scoreTone(x.outsideIn) }}>{x.outsideIn}</b>outside-in</span>
              <span><b style={{ color: xi.flags ? 'var(--bad)' : undefined }}>{xi.flags}</b>red flags</span>
            </div>
          </button>
        ))}
      </div>

      <div className="grid g-3-2">
        <Card
          title={`Outside-in findings · ${t.short}`}
          sub={`${t.domains} domains and ${t.externalAssets} internet-facing assets assessed without touching the target's network · click a category`}
          toneColor={PF_TONE}
          actions={<Btn sm primary color={PF_TONE} onClick={() => set('report', '1')}><FileText size={13} /> Generate DD report</Btn>}
        >
          <div className="row" style={{ gap: 18, marginBottom: 12 }}>
            <Ring value={t.outsideIn} size={92} stroke={9} color={scoreTone(t.outsideIn)} sub="SCORE" />
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 12 }}>Peer median for {t.sector.toLowerCase()}: <b style={{ color: 'var(--text-primary)' }}>{t.peer}</b> · {t.outsideIn < t.peer ? `${t.peer - t.outsideIn} points below peers` : `${t.outsideIn - t.peer} points above peers`}</div>
              <div className="row wrap" style={{ gap: 14, marginTop: 8, fontSize: 12 }}>
                <span><b style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{t.darkWeb.credentials}</b> <span className="muted">leaked credentials</span></span>
                <span><b style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{t.darkWeb.stealerHosts}</b> <span className="muted">infected hosts</span></span>
                <span><b style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{t.darkWeb.mentions}</b> <span className="muted">dark-web mentions</span></span>
                <span><b style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{t.breaches.length}</b> <span className="muted">known breaches</span></span>
              </div>
            </div>
          </div>
          <div className="pf-cats">
            {DD_CATEGORIES.map((c) => {
              const fs = t.findings.filter((f) => f.category === c);
              return (
                <button key={c} type="button" className={`pf-cat ${cat === c ? 'on' : ''}`} onClick={() => setCat(cat === c ? 'all' : c)} title="Source: HexaInt · click to filter findings">
                  <small>{c}</small>
                  <b>{fs.length}</b>
                  <div className="pf-sevs">{SEVS.map((s) => { const n = fs.filter((f) => f.sev === s).length; return n ? <i key={s} style={{ flex: n, background: SEV_HEX[s] }} /> : null; })}</div>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 8 }}><Legend items={SEVS.map((s) => ({ label: s, color: SEV_HEX[s] }))} /></div>
        </Card>

        <Card title="Deal impact" sub="Indicative, for the investment committee and the SPA negotiation" toneColor={PF_TONE}>
          <div className="pf-impact big">
            <div><span>Remediation, first 12 months</span><b>{usdK(im.lo)}–{usdK(im.hi)}</b></div>
            <div><span>Suggested price adjustment</span><b>{usdK(im.adjustK)} <span className="muted" style={{ fontSize: 11 }}>({im.adjustPct.toFixed(2)}%)</span></b></div>
            <div><span>Suggested escrow / holdback</span><b>{usdK(im.escrowK)} <span className="muted" style={{ fontSize: 11 }}>({im.escrowPct.toFixed(1)}%)</span></b></div>
            <div><span>Specific indemnity</span><b style={{ fontSize: 13 }}>{t.breaches.length ? `Yes: ${t.breaches[0].year} event` : 'Not needed'}</b></div>
            <div><span>W&amp;I insurance</span><b style={{ fontSize: 13 }}>{im.flags >= 3 ? 'Expect cyber exclusion' : 'Standard cover likely'}</b></div>
          </div>
          <div style={{ marginTop: 10 }}>
            <Callout kind={im.flags >= 3 ? 'warn' : 'info'}>{t.summary}</Callout>
          </div>
        </Card>
      </div>

      <div className="grid g-2-1">
        <Card
          title="Findings"
          count={rows.length}
          sub="Click a finding for evidence and remediation"
          flush
          actions={
            <span className="chips">
              <Chip on={!flagsOnly} onClick={() => set('flags', null)}>All</Chip>
              <Chip on={flagsOnly} color="var(--bad)" onClick={() => set('flags', flagsOnly ? null : '1')}>Red flags only</Chip>
              {cat !== 'all' && <Chip on onClick={() => setCat('all')}>{cat} ✕</Chip>}
            </span>
          }
        >
          <DataTable columns={cols} rows={rows} rowKey={(f) => f.id} onRowClick={setSel} initialSort={{ key: 'sev', dir: 'asc' }} pageSize={20} />
        </Card>
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <Card title="Questionnaire" sub={`${im.answered} of ${im.total} answered · ${im.flagged} answers flagged`} toneColor={PF_TONE} actions={<Btn sm onClick={() => toast(`Reminder sent to ${t.short}'s data-room contact for ${im.total - im.answered} open questions`)}><Send size={13} /> Chase</Btn>}>
            {t.questionnaire.map((q) => (
              <div key={q.section} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 64px', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 7 }}>
                <span>{q.section}</span>
                <Bar value={q.answered} max={q.total} color={q.answered === q.total ? 'var(--good)' : PF_TONE} />
                <span className="muted" style={{ textAlign: 'right' }}>{q.answered}/{q.total}{q.flagged ? <b style={{ color: 'var(--bad)' }}> · {q.flagged}⚑</b> : ''}</span>
              </div>
            ))}
          </Card>
          <Card title="Certifications" toneColor={PF_TONE}>
            {t.certifications.map((c) => (
              <div key={c.name} className="row" style={{ gap: 8, padding: '5px 0', fontSize: 12.5 }}>
                <span style={{ flex: 1 }}>{c.name}</span>
                <Badge color={CERT_COLOR[c.state]} dot>{CERT_LABEL[c.state]}</Badge>
              </div>
            ))}
          </Card>
          <Card title="Red flags" count={im.flags} toneColor="var(--bad)">
            {t.findings.filter((f) => f.redFlag).map((f) => (
              <div key={f.id} className="pf-flag"><AlertTriangle /><div><b>{f.title}</b><span>{f.id} · {f.source}</span></div></div>
            ))}
          </Card>
        </div>
      </div>

      {sel && (
        <Drawer
          title={sel.title}
          sub={`${sel.id} · ${sel.category} · ${t.name}`}
          onClose={() => setSel(null)}
          footer={<><Btn primary color={PF_TONE} onClick={() => { toast(`${sel.id} added to the ${t.short} 100-day plan as a day-0 condition`); setSel(null); }}>Add to 100-day plan</Btn><Btn onClick={() => { toast(`Evidence request for ${sel.id} posted to the ${t.short} data room`); }}>Request evidence</Btn></>}
        >
          <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
            <SevBadge sev={sel.sev} />
            {sel.redFlag && <Badge color="var(--bad)" solid>Red flag</Badge>}
            <Badge color={PF_TONE}>{sel.source}</Badge>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', marginTop: 0 }}>{sel.detail}</p>
          <Callout color={PF_TONE}>Remediation estimate: <b>{sel.fixHighK ? `${usdK(sel.fixLowK)} to ${usdK(sel.fixHighK)}` : 'no direct cost (legal or disclosure matter)'}</b>. {sel.redFlag ? 'Recommended as a condition precedent or escrow release condition.' : 'Recommended for the first 100 days.'}</Callout>
        </Drawer>
      )}
    </>
  );
}
