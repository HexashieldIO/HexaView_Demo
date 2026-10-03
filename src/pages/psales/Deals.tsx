import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, ShieldCheck, Clock, CheckCircle2, AlertTriangle, RefreshCw, Calculator, Ban, Users } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, Badge, Btn, Callout, KV, SectionLabel, Ring, Legend, KpiStrip } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer, Modal } from '../../components/Overlay';
import {
  CAP_LIST, REG_COLOR, REG_LABEL, STAGES, STAGE_PROB, TIERS, conflictCheck, deals, bookingsHistory, PARTNER, STAFF,
  type Deal, type DealStage, type RegStatus,
} from '../../data/modules/partner';
import type { CapabilityId, Tier } from '../../data/types';
import { daysAhead, daysAgo, fmtDate, fmtDateShort } from '../../lib/format';
import { CapPills, Field, PT_TONE, Steps, money } from '../partner/parts';

type RegFilter = 'all' | 'inflight' | 'approved' | 'pending' | 'expiring' | 'closed';
const QUARTERS = ['Q4 2026', 'Q1 2027', 'Q2 2027', 'Q3 2027', 'Q4 2027'];
const CONFLICT_COLOR = { clear: 'var(--good)', existing: 'var(--m-matrix)', own: 'var(--sev-medium)', 'other-partner': 'var(--bad)', direct: 'var(--sev-high)' } as const;

export default function PartnerDeals() {
  const [params, setParams] = useSearchParams();
  const { toast } = useApp();
  const nav = useNavigate();
  const [list, setList] = useState<Deal[]>(() => deals());
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Deal | null>(() => deals().find((d) => d.id === params.get('deal')) ?? null);
  const [showReg, setShowReg] = useState(false);
  const filter = ((params.get('reg') as RegFilter) ?? 'inflight') as RegFilter;
  const setFilter = (f: RegFilter) => {
    const p = new URLSearchParams(params);
    p.set('reg', f);
    setParams(p, { replace: true });
  };

  const live = list.filter((d) => d.stage !== 'Closed won' && d.stage !== 'Closed lost');
  const counts = {
    inflight: live.length,
    approved: live.filter((d) => d.reg === 'approved').length,
    pending: live.filter((d) => d.reg === 'pending' || d.reg === 'renewal').length,
    expiring: live.filter((d) => d.reg === 'expiring' || (d.protectedDays !== null && d.protectedDays > 0 && d.protectedDays <= 14)).length,
    closed: list.length - live.length,
  };
  const rows = list.filter((d) => {
    const isLive = d.stage !== 'Closed won' && d.stage !== 'Closed lost';
    if (filter === 'inflight' && !isLive) return false;
    if (filter === 'approved' && !(isLive && d.reg === 'approved')) return false;
    if (filter === 'pending' && !(isLive && (d.reg === 'pending' || d.reg === 'renewal'))) return false;
    if (filter === 'expiring' && !(isLive && (d.reg === 'expiring' || (d.protectedDays !== null && d.protectedDays > 0 && d.protectedDays <= 14)))) return false;
    if (filter === 'closed' && isLive) return false;
    if (q && !`${d.opportunity} ${d.endClient} ${d.id}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const protectedValue = live.filter((d) => d.reg === 'approved' || d.reg === 'expiring' || d.reg === 'renewal').reduce((s, d) => s + d.valueUsd, 0);
  const desk = list.filter((d) => d.reg === 'pending' || d.reg === 'renewal');
  const winRate = useMemo(() => { const h = bookingsHistory(); const w = h.reduce((s, x) => s + x.won, 0); return Math.round((w / (w + h.reduce((s, x) => s + x.lost, 0))) * 100); }, []);

  const update = (id: string, patch: Partial<Deal>) => {
    setList((ls) => ls.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    setSel((s) => (s && s.id === id ? { ...s, ...patch } : s));
  };

  return (
    <>
      <p className="page-intro">
        Register opportunities with HexaShield to protect them. An approved registration locks the opportunity to <b>{PARTNER.name}</b> for <b>90 days</b>, renewable while the deal is live; the deal desk reviews within <b>2 business days</b>. Approved deals unlock partner pricing (+{PARTNER.discount.dealReg} pts) and a named solutions engineer.
      </p>
      <KpiStrip
        toneColor={PT_TONE}
        items={[
          { label: 'In flight', value: counts.inflight, hint: money(live.reduce((s, d) => s + d.valueUsd, 0)), onClick: () => setFilter('inflight'), source: 'HexaShield deal registration' },
          { label: 'Protected', value: counts.approved, hint: money(protectedValue), onClick: () => setFilter('approved'), source: 'HexaShield deal desk' },
          { label: 'With the deal desk', value: counts.pending, hint: '2 business days', onClick: () => setFilter('pending'), source: 'HexaShield deal desk queue' },
          { label: 'Expiring ≤ 14 d', value: counts.expiring, onClick: () => setFilter('expiring'), source: 'Deal registration · protection windows' },
          { label: 'Conflicts', value: list.filter((d) => d.conflict).length, onClick: () => setSel(list.find((d) => d.conflict) ?? null), source: 'Deal desk conflict check' },
          { label: 'Win rate (12 mo)', value: `${winRate}%`, to: '/partner-sales/pipeline', source: 'Closed registrations, last 12 months' },
        ]}
      />

      <div className="row wrap" style={{ gap: 10 }}>
        <span className="pt-pills">
          <button className={filter === 'inflight' ? 'on' : ''} onClick={() => setFilter('inflight')}><b>{counts.inflight}</b> in flight</button>
          <button className={filter === 'approved' ? 'on' : ''} onClick={() => setFilter('approved')}><i style={{ background: 'var(--good)' }} /><b>{counts.approved}</b> approved</button>
          <button className={filter === 'pending' ? 'on' : ''} onClick={() => setFilter('pending')}><i style={{ background: 'var(--sev-medium)' }} /><b>{counts.pending}</b> pending review</button>
          <button className={filter === 'expiring' ? 'on' : ''} onClick={() => setFilter('expiring')}><i style={{ background: 'var(--bad)' }} /><b>{counts.expiring}</b> expiring</button>
          <button className={filter === 'closed' ? 'on' : ''} onClick={() => setFilter('closed')}><i style={{ background: 'var(--sev-info)' }} /><b>{counts.closed}</b> closed</button>
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
        </span>
        <span className="spacer" />
        <label className="search" style={{ width: 230 }}>
          <Search size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deals…" />
        </label>
        <Btn primary color={PT_TONE} onClick={() => setShowReg(true)}><Plus /> Register a deal</Btn>
      </div>

      <div className="pt-split">
        <Card flush foot={<span>{rows.length} of {list.length} registrations shown · pick one to update its stage or scope</span>}>
          <DataTable
            rows={rows}
            rowKey={(d) => d.id}
            onRowClick={setSel}
            pageSize={20}
            initialSort={{ key: 'prot', dir: 'asc' }}
            columns={[
              { key: 'opp', header: 'Opportunity', sort: (d) => d.opportunity, render: (d) => <><div className="t-main" style={{ maxWidth: 250 }}>{d.opportunity}</div><div className="t-sub">{d.endClient} · {d.id}{d.kind !== 'new logo' ? ` · ${d.kind}` : ''}</div></> },
              { key: 'mods', header: 'Modules', render: (d) => <div style={{ maxWidth: 150 }}><CapPills caps={d.modules} /></div> },
              { key: 'val', header: 'Value', align: 'right', sort: (d) => d.valueUsd, render: (d) => <span className="num">{money(d.valueUsd)}</span> },
              { key: 'stage', header: 'Stage', sort: (d) => STAGES.indexOf(d.stage), render: (d) => <span style={{ fontSize: 12 }}>{d.stage}</span> },
              { key: 'reg', header: 'Registration', sort: (d) => d.reg, render: (d) => <span className="row" style={{ gap: 4 }}><Badge color={REG_COLOR[d.reg]}>{REG_LABEL[d.reg]}</Badge>{d.conflict && <span title={d.conflict}><AlertTriangle size={13} color="var(--bad)" /></span>}</span> },
              { key: 'prot', header: 'Protected to', align: 'right', sort: (d) => (d.protectedDays === null ? 999 : d.protectedDays < 0 ? 900 - d.protectedDays : d.protectedDays), render: (d) => d.protectedDays === null || d.protectedDays < 0 ? <span className="muted">—</span> : <span className="nowrap" style={{ color: d.protectedDays <= 14 ? 'var(--bad)' : undefined }}>{fmtDate(daysAhead(d.protectedDays))}</span> },
            ]}
          />
        </Card>

        <div className="stack" style={{ gap: 16 }}>
          <Card title="How registration protects you" toneColor={PT_TONE} tinted>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.65 }} className="secondary">
              <li>An approved registration locks the opportunity to you for <b>90 days</b>, renewable while the deal is live.</li>
              <li>The HexaShield deal desk reviews within <b>2 business days</b> and confirms in this console.</li>
              <li>Approved deals unlock partner pricing and a named solutions engineer ({PARTNER.partnerSe.name}).</li>
              <li>Upsells to existing clients within current scope are auto-approved.</li>
              <li>Conflicts (another partner, or a HexaShield direct account) go to co-sell review.</li>
            </ul>
          </Card>
          <Card title="Deal desk" count={desk.length} sub="Business-day SLA clock on your submissions">
            {desk.map((d) => (
              <button key={d.id} className="list-row" onClick={() => setSel(d)}>
                <Ring value={16 - (d.deskHoursLeft ?? 0) / 3} max={16} size={42} stroke={5} color={(d.deskHoursLeft ?? 0) < 8 ? 'var(--bad)' : 'var(--sev-medium)'}>
                  <span style={{ fontSize: 10.5 }}>{d.deskHoursLeft}h</span>
                </Ring>
                <span className="list-main">
                  <b>{d.opportunity}</b>
                  <span>{d.reg === 'renewal' ? 'Renewal of protection' : 'New registration'} · submitted {d.submittedDaysAgo} d ago{d.conflict ? ' · conflict check' : ''}</span>
                </span>
              </button>
            ))}
            {desk.length === 0 && <div className="empty">Nothing waiting on the desk.</div>}
          </Card>
        </div>
      </div>

      <Card title="Protection windows" sub="90-day locks from approval, today marked · renew before the bar runs out" toneColor={PT_TONE} actions={<Legend items={[{ label: 'Protected', color: 'var(--good)' }, { label: 'Last 14 days', color: 'var(--bad)' }, { label: 'Awaiting desk', color: 'var(--sev-medium)' }]} />}>
        <ProtectionGantt deals={live} onPick={setSel} />
      </Card>

      {sel && <DealDrawer d={sel} onClose={() => setSel(null)} onUpdate={update} onQuote={() => nav(`/partner-sales/quotes?deal=${sel.id}`)} toast={toast} />}
      {showReg && (
        <RegisterModal
          nextId={`DR-${2059 + list.length - deals().length}`}
          onClose={() => setShowReg(false)}
          onSubmit={(d) => {
            setList((ls) => [d, ...ls]);
            setShowReg(false);
            setFilter('pending');
            toast(`${d.id} submitted: the deal desk reviews within 2 business days. It opens at Discovery with the registration pending.`);
          }}
        />
      )}
    </>
  );
}

function ProtectionGantt({ deals: ds, onPick }: { deals: Deal[]; onPick: (d: Deal) => void }) {
  // Window: 100 days back to 100 days ahead.
  const span = 200;
  const pos = (dayOffset: number) => `${((dayOffset + 100) / span) * 100}%`;
  const sorted = ds.slice().sort((a, b) => (a.protectedDays ?? 200) - (b.protectedDays ?? 200));
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '6px 12px', alignItems: 'center' }}>
        <span />
        <div style={{ position: 'relative', height: 16, fontSize: 10.5 }} className="muted">
          {[-90, -60, -30, 0, 30, 60, 90].map((d) => (
            <span key={d} style={{ position: 'absolute', left: pos(d), transform: 'translateX(-50%)', fontWeight: d === 0 ? 700 : 400, color: d === 0 ? 'var(--text-primary)' : undefined }}>{d === 0 ? 'Today' : fmtDateShort(daysAhead(d))}</span>
          ))}
        </div>
        {sorted.map((d) => {
          const start = -d.submittedDaysAgo;
          const end = d.protectedDays;
          const pending = d.reg === 'pending';
          const warn = end !== null && end <= 14;
          return (
            <div key={d.id} style={{ display: 'contents' }}>
              <button className="link" style={{ textAlign: 'left', background: 'none', border: 0, padding: 0, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }} onClick={() => onPick(d)} title={d.opportunity}>
                {d.opportunity}
              </button>
              <button onClick={() => onPick(d)} style={{ position: 'relative', height: 18, background: 'var(--surface-sunken)', borderRadius: 5, border: 0, padding: 0, cursor: 'pointer' }} title={`${d.id} · ${REG_LABEL[d.reg]}`}>
                {pending ? (
                  <i style={{ position: 'absolute', left: pos(start), width: `${(2 / span) * 100 + 1}%`, top: 3, bottom: 3, borderRadius: 4, background: 'var(--sev-medium)' }} />
                ) : end !== null ? (
                  <>
                    <i style={{ position: 'absolute', left: pos(Math.max(-100, end - 90)), width: `calc(${pos(Math.min(100, end))} - ${pos(Math.max(-100, end - 90))})`, top: 3, bottom: 3, borderRadius: 4, background: 'color-mix(in srgb, var(--good) 70%, transparent)' }} />
                    {warn && <i style={{ position: 'absolute', left: pos(Math.max(-100, end - 14)), width: `calc(${pos(end)} - ${pos(Math.max(-100, end - 14))})`, top: 3, bottom: 3, borderRadius: 4, background: 'var(--bad)' }} />}
                  </>
                ) : (
                  <span className="muted" style={{ position: 'absolute', left: pos(start), top: 2, fontSize: 10.5 }}>{REG_LABEL[d.reg]}</span>
                )}
                <i style={{ position: 'absolute', left: pos(0), top: -3, bottom: -3, width: 2, background: 'var(--text-primary)', opacity: 0.6 }} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DealDrawer({ d, onClose, onUpdate, onQuote, toast }: { d: Deal; onClose: () => void; onUpdate: (id: string, p: Partial<Deal>) => void; onQuote: () => void; toast: (t: string) => void }) {
  const live = d.stage !== 'Closed won' && d.stage !== 'Closed lost';
  const canRenew = live && (d.reg === 'approved' || d.reg === 'expiring');
  return (
    <Drawer
      title={d.opportunity}
      sub={`${d.endClient} · ${d.id} · ${d.sector}`}
      icon={<span className="ico-box" style={{ '--tone': REG_COLOR[d.reg] } as CSSProperties}>{d.reg === 'approved' ? <ShieldCheck /> : d.reg === 'rejected' ? <Ban /> : <Clock />}</span>}
      onClose={onClose}
      footer={
        <>
          {canRenew && <Btn primary color={PT_TONE} onClick={() => { onUpdate(d.id, { reg: 'renewal', deskHoursLeft: 16 }); toast(`Renewal of ${d.id} sent to the deal desk: protection continues while it is reviewed`); }}><RefreshCw /> Renew registration</Btn>}
          {d.reg === 'rejected' && <Btn primary color={PT_TONE} onClick={() => toast(`Co-sell request for ${d.endClient} sent to ${PARTNER.channelManager.name}`)}><Users /> Request co-sell</Btn>}
          {live && <Btn onClick={onQuote}><Calculator /> Build quote</Btn>}
        </>
      }
    >
      {d.conflict && <div style={{ marginBottom: 12 }}><Callout kind="warn">{d.conflict}</Callout></div>}
      {d.note && <div style={{ marginBottom: 12 }}><Callout>{d.note}</Callout></div>}
      <SectionLabel>Stage</SectionLabel>
      <div style={{ margin: '6px 0 14px' }}><Steps steps={STAGES.slice(0, 5)} step={d.stage === 'Closed lost' ? 4 : STAGES.indexOf(d.stage)} failed={d.stage === 'Closed lost'} /></div>
      {live && (
        <div className="row" style={{ marginBottom: 14 }}>
          <span className="muted" style={{ fontSize: 12 }}>Update stage</span>
          <select className="select" value={d.stage} onChange={(e) => { onUpdate(d.id, { stage: e.target.value as DealStage }); toast(`${d.id} moved to ${e.target.value}`); }}>
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      )}
      <KV
        rows={[
          ['Registration', <Badge color={REG_COLOR[d.reg]}>{REG_LABEL[d.reg]}</Badge>],
          ['Protected to', d.protectedDays === null ? 'Not protected' : d.protectedDays < 0 ? `Ended ${fmtDate(daysAgo(-d.protectedDays))}` : `${fmtDate(daysAhead(d.protectedDays))} (${d.protectedDays} days)`],
          ['Submitted', `${fmtDate(daysAgo(d.submittedDaysAgo))} by ${d.owner}`],
          ['Value', `${money(d.valueUsd)} first year · ${STAGE_PROB[d.stage]}% weighted ${money((d.valueUsd * STAGE_PROB[d.stage]) / 100)}`],
          ['Modules', <CapPills caps={d.modules} />],
          ['Tier', d.tier],
          ['Expected close', d.closeQuarter],
          ['Type', d.kind],
          ['Competition', d.competitor],
          ['HexaShield SE', d.se ?? 'Assigned on approval'],
        ]}
      />
      <SectionLabel>Desk history</SectionLabel>
      <div className="stack" style={{ gap: 6, fontSize: 12 }}>
        <div className="row"><CheckCircle2 size={14} color="var(--good)" /> Submitted by {d.owner} · {fmtDateShort(daysAgo(d.submittedDaysAgo))}</div>
        <div className="row"><CheckCircle2 size={14} color="var(--good)" /> Automatic conflict check run against partner registrations and direct accounts</div>
        {d.reg !== 'pending' && <div className="row">{d.reg === 'rejected' ? <Ban size={14} color="var(--bad)" /> : <CheckCircle2 size={14} color="var(--good)" />} Deal desk decision · {fmtDateShort(daysAgo(Math.max(0, d.submittedDaysAgo - 2)))}</div>}
        {d.reg === 'pending' && <div className="row"><Clock size={14} color="var(--sev-medium)" /> Awaiting decision · {d.deskHoursLeft} business hours left on the SLA</div>}
      </div>
    </Drawer>
  );
}

function RegisterModal({ nextId, onClose, onSubmit }: { nextId: string; onClose: () => void; onSubmit: (d: Deal) => void }) {
  const [f, setF] = useState({ opportunity: '', endClient: '', sector: 'Utilities', value: 120000, close: QUARTERS[1], tier: 'Professional' as Tier, competitor: '', notes: '', owner: STAFF[1].name });
  const [mods, setMods] = useState<CapabilityId[]>(['soc']);
  const check = useMemo(() => conflictCheck(f.endClient), [f.endClient]);
  const valid = f.opportunity.trim().length > 2 && f.endClient.trim().length > 2 && mods.length > 0 && check.state !== 'other-partner';
  const reg: RegStatus = check.state === 'existing' ? 'approved' : 'pending';
  return (
    <Modal
      title="New registration"
      sub="Four required fields. The desk fills in the rest."
      onClose={onClose}
      footer={
        <>
          <span className="muted" style={{ fontSize: 11.5, marginRight: 'auto' }}>It opens at Discovery with the registration {reg === 'approved' ? 'auto-approved (existing client)' : 'pending'}.</span>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn primary color={PT_TONE} disabled={!valid} onClick={() => onSubmit({
            id: nextId, opportunity: f.opportunity, endClient: f.endClient, sector: f.sector, modules: mods, tier: f.tier, valueUsd: f.value, stage: 'Discovery',
            reg, submittedDaysAgo: 0, protectedDays: reg === 'approved' ? 90 : null, owner: f.owner, competitor: f.competitor || 'Not stated', closeQuarter: f.close, deskHoursLeft: 16,
            conflict: check.state === 'direct' ? check.text : undefined, kind: check.state === 'existing' ? 'upsell' : 'new logo', note: f.notes || undefined,
          })}>Submit for approval</Btn>
        </>
      }
    >
      <div className="pt-form">
        <Field label="Opportunity · required" full><input className="input" value={f.opportunity} onChange={(e) => setF({ ...f, opportunity: e.target.value })} placeholder="e.g. Brightwater Rail: OT monitoring" autoFocus /></Field>
        <Field label="End client · required" full><input className="input" value={f.endClient} onChange={(e) => setF({ ...f, endClient: e.target.value })} placeholder="Legal entity name" /></Field>
        <div className="full">
          <Callout kind={check.state === 'clear' || check.state === 'existing' ? (f.endClient.length > 2 ? 'good' : 'info') : 'warn'} color={f.endClient.length > 2 ? CONFLICT_COLOR[check.state] : undefined}>
            <b>Conflict check:</b> {check.text}
          </Callout>
        </div>
        <div className="pt-field full">
          <span className="pt-label">Modules · required</span>
          <div className="chips">
            {CAP_LIST.map((cap) => (
              <label key={cap.id} className={`pt-check ${mods.includes(cap.id) ? 'on' : ''}`} style={{ '--tone': cap.tone } as CSSProperties}>
                <input type="checkbox" checked={mods.includes(cap.id)} onChange={(e) => setMods(e.target.checked ? [...mods, cap.id] : mods.filter((m) => m !== cap.id))} />
                {cap.product}
              </label>
            ))}
          </div>
        </div>
        <Field label="Expected close · required"><select className="select" value={f.close} onChange={(e) => setF({ ...f, close: e.target.value })}>{QUARTERS.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Estimated first-year value (US$)"><input className="input" type="number" step={1000} value={f.value} onChange={(e) => setF({ ...f, value: Number(e.target.value) || 0 })} /></Field>
        <Field label="Tier"><select className="select" value={f.tier} onChange={(e) => setF({ ...f, tier: e.target.value as Tier })}>{TIERS.map((t) => <option key={t.id}>{t.id}</option>)}</select></Field>
        <Field label="Owner"><select className="select" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>{STAFF.filter((s) => s.team === 'Sales' || s.team === 'Leadership').map((s) => <option key={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Sector"><input className="input" value={f.sector} onChange={(e) => setF({ ...f, sector: e.target.value })} /></Field>
        <Field label="Competition"><input className="input" value={f.competitor} onChange={(e) => setF({ ...f, competitor: e.target.value })} placeholder="Incumbent or rival" /></Field>
        <Field label="Anything the desk should know" full><textarea className="input" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
