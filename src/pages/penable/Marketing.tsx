import { useMemo, useState } from 'react';
import { Megaphone, Plus, Upload, Rocket } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Badge, Btn, Callout, KV, Legend, SectionLabel, Stacked, StatusBadge, IcoBox } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer, Modal } from '../../components/Overlay';
import { FlowMap, type FlowLink } from '../../components/FlowMap';
import { PARTNER, campaigns, mdfClaims, type Campaign, type MdfClaim } from '../../data/modules/partner';
import { daysAhead, daysAgo, fmtDateShort } from '../../lib/format';
import { Field, PT_TONE, money, moneyFull } from '../partner/parts';

const CLAIM_COLOR: Record<MdfClaim['status'], string> = { Paid: 'var(--good)', Approved: '#2dd4bf', Submitted: 'var(--m-matrix)', 'Needs proof': 'var(--bad)', 'Pre-approved': 'var(--sev-medium)' };
const CAMP_COLOR = { Live: 'var(--good)', Planned: 'var(--sev-medium)', Completed: 'var(--sev-info)' };
const KITS = [
  { name: 'DORA readiness in 90 days', sector: 'Financial Services', assets: 9, leadsAvg: 180 },
  { name: 'HHS HPH CPGs for hospitals', sector: 'Healthcare', assets: 8, leadsAvg: 140 },
  { name: 'UNECE R155 / R156 for suppliers', sector: 'Automotive', assets: 7, leadsAvg: 60 },
  { name: 'NIS2 for the mid-market', sector: 'Cross-sector', assets: 11, leadsAvg: 260 },
  { name: 'Agentic SOC, safely', sector: 'Cross-sector', assets: 6, leadsAvg: 210 },
  { name: 'Ports & terminals OT', sector: 'Maritime', assets: 6, leadsAvg: 45 },
];

function shortName(name: string): string {
  const n = name.split(/[:(,]/)[0].trim();
  return n.length > 22 ? `${n.slice(0, 21)}…` : n;
}

export default function EnablementMarketing() {
  const { toast } = useApp();
  const camps = useMemo(() => campaigns(), []);
  const [claims, setClaims] = useState(() => mdfClaims());
  const [selCamp, setSelCamp] = useState<Campaign | null>(null);
  const [claimFilter, setClaimFilter] = useState<MdfClaim['status'] | null>(null);
  const [modal, setModal] = useState<'request' | 'claim' | null>(null);
  const [req, setReq] = useState({ name: '', type: 'Webinar' as Campaign['type'], sector: 'Cross-sector', budget: 8000, mdf: 4000 });
  const [claim, setClaim] = useState({ campaignId: camps[2].id, amount: 3000 });

  const alloc = PARTNER.mdfAllocation;
  const sumBy = (s: MdfClaim['status'][]) => claims.filter((c) => s.includes(c.status)).reduce((a, c) => a + c.amount, 0);
  const paid = sumBy(['Paid']);
  const approved = sumBy(['Approved']);
  const pending = sumBy(['Submitted', 'Needs proof']);
  const pre = sumBy(['Pre-approved']);
  const remaining = alloc - paid - approved - pending - pre;
  const pipeline = camps.reduce((s, c) => s + c.pipelineUsd, 0);
  const won = camps.reduce((s, c) => s + c.wonUsd, 0);
  const mdfSpent = paid + approved + pending;

  const flow = useMemo(() => {
    const done = camps.filter((c) => c.pipelineUsd > 0);
    const sectors = [...new Set(done.map((c) => c.sector))];
    const links: FlowLink[] = [];
    for (const c of done) links.push({ from: c.id, to: `s-${c.sector}`, value: c.pipelineUsd });
    for (const s of sectors) {
      const cs = done.filter((c) => c.sector === s);
      const w = cs.reduce((a, c) => a + c.wonUsd, 0);
      const o = cs.reduce((a, c) => a + c.pipelineUsd - c.wonUsd, 0);
      if (w) links.push({ from: `s-${s}`, to: 'won', value: w, color: '#2dd4bf' });
      if (o) links.push({ from: `s-${s}`, to: 'open', value: o });
    }
    return {
      columns: [
        { label: 'Campaign', nodes: done.map((c) => ({ id: c.id, title: shortName(c.name), count: c.mqls, sub: 'MQLs', color: PT_TONE, onClick: () => setSelCamp(c) })) },
        { label: 'Sector', nodes: sectors.map((s) => ({ id: `s-${s}`, title: s, count: money(done.filter((c) => c.sector === s).reduce((a, c) => a + c.pipelineUsd, 0)), sub: 'pipeline' })) },
        { label: 'Outcome', nodes: [{ id: 'won', title: 'Closed won', count: money(won), sub: 'first-year', state: 'good' as const }, { id: 'open', title: 'Open pipeline', count: money(pipeline - won), sub: 'registered', color: '#fb923c' }] },
      ],
      links,
    };
  }, [camps, pipeline, won]);

  return (
    <>
      <p className="page-intro">
        Co-marketing with HexaShield: plan campaigns, request market development funds (MDF, up to 50% of eligible cost) and claim them with proof of execution. {PARTNER.fiscalYear} allocation for {PARTNER.short}: <b>{moneyFull(alloc)}</b>, use-it-or-lose-it at year end.
      </p>
      <KpiStrip
        toneColor={PT_TONE}
        items={[
          { label: `MDF allocation ${PARTNER.fiscalYear}`, value: money(alloc), onClick: () => setClaimFilter(null), source: 'HexaShield partner programme' },
          { label: 'Paid & approved', value: money(paid + approved), onClick: () => setClaimFilter('Paid'), source: 'MDF claims ledger' },
          { label: 'Awaiting decision', value: money(pending), hint: `${claims.filter((c) => c.status === 'Needs proof').length} need proof`, onClick: () => setClaimFilter('Needs proof'), source: 'MDF claims ledger' },
          { label: 'Unallocated', value: money(remaining), hint: '87 days left', onClick: () => setModal('request'), source: 'MDF claims ledger' },
          { label: 'Pipeline sourced', value: money(pipeline), hint: `${money(won)} won`, onClick: () => setSelCamp(camps[3]), source: 'Campaign attribution · deal registration' },
          { label: 'Pipeline per MDF $', value: `${Math.round(pipeline / Math.max(1, mdfSpent))}×`, source: 'Campaign attribution ÷ MDF spent' },
        ]}
      />

      <div className="grid g-2-1">
        <Card title="Where the campaigns led" sub="Campaign → sector → outcome, weighted by registered pipeline · click a campaign" toneColor={PT_TONE}>
          <FlowMap columns={flow.columns} links={flow.links} goodColor="#fb923c" />
        </Card>
        <Card title="MDF fund" sub={`${PARTNER.fiscalYear} · ${moneyFull(alloc)}`} toneColor={PT_TONE} actions={<Btn sm primary color={PT_TONE} onClick={() => setModal('request')}><Plus /> Request MDF</Btn>}>
          <div className="stat-big" style={{ fontSize: 32 }}>{money(remaining)}</div>
          <div className="stat-label">unallocated of {money(alloc)}</div>
          <div style={{ margin: '14px 0 8px' }}>
            <Stacked tall showLabels parts={[{ value: paid, color: CLAIM_COLOR.Paid, label: 'Paid' }, { value: approved, color: CLAIM_COLOR.Approved, label: 'Approved' }, { value: pending, color: CLAIM_COLOR.Submitted, label: 'Awaiting' }, { value: pre, color: CLAIM_COLOR['Pre-approved'], label: 'Pre-approved' }, { value: remaining, color: 'var(--track)', label: 'Unallocated' }]} />
          </div>
          <Legend items={[{ label: `Paid ${money(paid)}`, color: CLAIM_COLOR.Paid }, { label: `Approved ${money(approved)}`, color: CLAIM_COLOR.Approved }, { label: `Awaiting ${money(pending)}`, color: CLAIM_COLOR.Submitted }, { label: `Pre-approved ${money(pre)}`, color: CLAIM_COLOR['Pre-approved'] }]} />
          <div className="list" style={{ marginTop: 12 }}>
            {claims.filter((c) => !claimFilter || c.status === claimFilter || (claimFilter === 'Paid' && c.status === 'Approved')).slice(0, 6).map((c) => {
              const camp = camps.find((x) => x.id === c.campaignId);
              return (
                <button key={c.id} className="list-row" onClick={() => camp && setSelCamp(camp)}>
                  <span className="list-main"><b>{camp?.name}</b><span>{c.id} · {fmtDateShort(daysAgo(c.daysAgo))} · {c.proof.join(', ')}</span></span>
                  <span className="stack" style={{ alignItems: 'flex-end', gap: 3 }}><b className="num">{money(c.amount)}</b><StatusBadge value={c.status} map={CLAIM_COLOR} /></span>
                </button>
              );
            })}
          </div>
          <Btn sm onClick={() => setModal('claim')}><Upload /> Submit a claim</Btn>
        </Card>
      </div>

      <Card title="Campaigns" count={camps.length} sub="Live, planned and completed, with attribution from deal registration" flush>
        <DataTable
          rows={camps}
          rowKey={(c) => c.id}
          onRowClick={setSelCamp}
          initialSort={{ key: 'start', dir: 'desc' }}
          columns={[
            { key: 'name', header: 'Campaign', sort: (c) => c.name, render: (c) => <><div className="t-main">{c.name}</div><div className="t-sub">{c.id} · {c.type} · {c.sector}</div></> },
            { key: 'start', header: 'Date', sort: (c) => c.startDays, render: (c) => <span className="t-sub">{fmtDateShort(daysAhead(c.startDays))}</span> },
            { key: 'st', header: 'Status', sort: (c) => c.status, render: (c) => <StatusBadge value={c.status} map={CAMP_COLOR} /> },
            { key: 'mdf', header: 'Budget · MDF', align: 'right', sort: (c) => c.budget, render: (c) => <span className="num">{money(c.budget)} · {money(c.mdf)}</span> },
            { key: 'leads', header: 'Leads', align: 'right', sort: (c) => c.leads, render: (c) => c.leads || '—' },
            { key: 'mql', header: 'MQLs', align: 'right', sort: (c) => c.mqls, render: (c) => c.mqls || '—' },
            { key: 'pipe', header: 'Pipeline', align: 'right', sort: (c) => c.pipelineUsd, render: (c) => (c.pipelineUsd ? <span className="num">{money(c.pipelineUsd)}</span> : '—') },
            { key: 'won', header: 'Won', align: 'right', sort: (c) => c.wonUsd, render: (c) => (c.wonUsd ? <span className="num" style={{ color: 'var(--good)' }}>{money(c.wonUsd)}</span> : '—') },
            { key: 'roi', header: 'Pipeline ÷ cost', align: 'right', sort: (c) => c.pipelineUsd / c.budget, render: (c) => (c.pipelineUsd ? <b className="num">{Math.round(c.pipelineUsd / c.budget)}×</b> : '—') },
          ]}
        />
      </Card>

      <Card title="Campaign in a box" sub="Ready-made by HexaShield partner marketing: emails, landing page, social, webinar deck, all co-branded" toneColor={PT_TONE}>
        <div className="grid g3" style={{ gap: 10 }}>
          {KITS.map((k) => (
            <div key={k.name} className="pt-tierCard" style={{ cursor: 'default' }}>
              <div className="row"><IcoBox color={PT_TONE}><Megaphone /></IcoBox><b style={{ fontSize: 13, flex: 1 }}>{k.name}</b></div>
              <span className="muted" style={{ fontSize: 11.5 }}>{k.sector} · {k.assets} assets · partners average {k.leadsAvg} leads</span>
              <div className="row"><span className="spacer" /><Btn sm onClick={() => toast(`“${k.name}” kit cloned into your campaigns with your branding; MDF pre-approval requested`)}><Rocket /> Launch</Btn></div>
            </div>
          ))}
        </div>
      </Card>

      {selCamp && (
        <Drawer title={selCamp.name} sub={`${selCamp.id} · ${selCamp.type} · ${selCamp.sector}`} onClose={() => setSelCamp(null)} footer={<Btn primary color={PT_TONE} onClick={() => { setClaim({ campaignId: selCamp.id, amount: selCamp.mdf }); setSelCamp(null); setModal('claim'); }}><Upload /> Claim MDF</Btn>}>
          <KV rows={[['Status', <StatusBadge value={selCamp.status} map={CAMP_COLOR} />], ['Date', fmtDateShort(daysAhead(selCamp.startDays))], ['Budget', moneyFull(selCamp.budget)], ['MDF (50%)', moneyFull(selCamp.mdf)], ['Owner', selCamp.owner]]} />
          <SectionLabel>Funnel</SectionLabel>
          <div className="pt-funnel">
            {[['Leads', selCamp.leads, selCamp.leads], ['MQLs', selCamp.mqls, selCamp.leads], ['Registered deals', Math.round(selCamp.mqls * 0.3), selCamp.leads], ['Won', selCamp.wonUsd ? Math.max(1, Math.round(selCamp.mqls * 0.08)) : 0, selCamp.leads]].map(([l, v, m]) => (
              <button key={String(l)} style={{ cursor: 'default' }}>
                <span style={{ fontSize: 12 }}>{l}</span>
                <div className="pt-fbar" style={{ width: `${Math.max(6, (Number(v) / Math.max(1, Number(m))) * 100)}%`, background: '#fb923c' }}>{v}</div>
                <span />
              </button>
            ))}
          </div>
          <div className="mini-stats" style={{ marginTop: 14 }}>
            <div className="mini-stat"><b>{money(selCamp.pipelineUsd)}</b><span>pipeline</span></div>
            <div className="mini-stat"><b style={{ color: 'var(--good)' }}>{money(selCamp.wonUsd)}</b><span>won</span></div>
            <div className="mini-stat"><b>{selCamp.leads ? money(selCamp.budget / selCamp.leads) : '—'}</b><span>cost per lead</span></div>
          </div>
          {selCamp.status === 'Planned' && <div style={{ marginTop: 12 }}><Callout>MDF pre-approved. Claim within 60 days of the event with invoices and the attendee list.</Callout></div>}
        </Drawer>
      )}

      {modal === 'request' && (
        <Modal title="Request MDF" sub="Pre-approval within 5 business days · up to 50% of eligible cost" onClose={() => setModal(null)} footer={<><Btn onClick={() => setModal(null)}>Cancel</Btn><Btn primary color={PT_TONE} disabled={req.name.length < 3 || req.mdf > req.budget / 2 || req.mdf > remaining} onClick={() => { setClaims((c) => [...c, { id: `MDF-0${874 + c.length - 8}`, campaignId: 'CMP-NEW', amount: req.mdf, status: 'Pre-approved', daysAgo: 0, proof: ['Plan & budget'] }]); toast(`MDF request for “${req.name}” (${moneyFull(req.mdf)}) sent to ${PARTNER.channelManager.name}`); setModal(null); }}>Submit request</Btn></>}>
          <div className="pt-form">
            <Field label="Campaign name" full><input className="input" value={req.name} onChange={(e) => setReq({ ...req, name: e.target.value })} autoFocus /></Field>
            <Field label="Type"><select className="select" value={req.type} onChange={(e) => setReq({ ...req, type: e.target.value as Campaign['type'] })}>{['Webinar', 'Event', 'ABM', 'Paid social', 'Email nurture', 'Roundtable'].map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Sector"><input className="input" value={req.sector} onChange={(e) => setReq({ ...req, sector: e.target.value })} /></Field>
            <Field label="Total budget (US$)"><input className="input" type="number" step={500} value={req.budget} onChange={(e) => setReq({ ...req, budget: Number(e.target.value) || 0 })} /></Field>
            <Field label="MDF requested (US$)" hint={req.mdf > req.budget / 2 ? 'Above 50% of budget' : req.mdf > remaining ? 'Above unallocated funds' : `${money(remaining)} unallocated`}><input className="input" type="number" step={500} value={req.mdf} onChange={(e) => setReq({ ...req, mdf: Number(e.target.value) || 0 })} /></Field>
          </div>
        </Modal>
      )}
      {modal === 'claim' && (
        <Modal title="Submit an MDF claim" sub="Attach proof of execution; paid as a credit on your next HexaShield invoice" onClose={() => setModal(null)} footer={<><Btn onClick={() => setModal(null)}>Cancel</Btn><Btn primary color={PT_TONE} onClick={() => { setClaims((c) => [...c, { id: `MDF-0${874 + c.length - 8}`, campaignId: claim.campaignId, amount: claim.amount, status: 'Submitted', daysAgo: 0, proof: ['Invoice', 'Attendee list'] }]); toast(`Claim for ${moneyFull(claim.amount)} submitted: decision within 10 business days`); setModal(null); }}>Submit claim</Btn></>}>
          <div className="pt-form">
            <Field label="Campaign" full><select className="select" value={claim.campaignId} onChange={(e) => setClaim({ ...claim, campaignId: e.target.value })}>{camps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Amount (US$)"><input className="input" type="number" value={claim.amount} onChange={(e) => setClaim({ ...claim, amount: Number(e.target.value) || 0 })} /></Field>
            <Field label="Proof of execution"><span className="chips"><Badge>Invoice.pdf</Badge><Badge>Attendees.csv</Badge><Badge>Photos.zip</Badge></span></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
