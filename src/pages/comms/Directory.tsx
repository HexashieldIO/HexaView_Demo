import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MessageSquare, Phone, UserPlus, Globe2, Search, Mail, Clock, Hexagon, Users } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Btn, Chip, KV, Legend, Callout, BarRow, Ring } from '../../components/ui';
import { Drawer, Modal } from '../../components/Overlay';
import { DataTable } from '../../components/DataTable';
import { fmtAgo } from '../../lib/format';
import { tenantName } from '../../data/customers';
import {
  channels as channelList, licenceUse, localTime, LICENCES, LICENCE_META, PRESENCE_COLOR, PARTY_LABEL,
  type CommsPerson, type Licence, type Party, type Presence, type Team,
} from '../../data/modules/comms';
import { useComms, Avatar, PresenceDot, LicenceBadge, PartyTag, COMMS_TONE } from './parts';

type PartyF = 'all' | Party;
const TEAMS: Team[] = ['Security leadership', 'SOC', 'OT engineering', 'Risk & GRC', 'Platform', 'Finance', 'Legal & privacy', 'Board & executive', 'Business & sites'];
const GUEST_KINDS = ['Insurance broker', 'Insurer / claims', 'External auditor', 'Breach counsel', 'Vendor contact', 'Regulator liaison', 'Other'];

export default function Directory() {
  const { customer, tenantId, persona } = useApp();
  return <DirectoryInner key={`${customer.id}-${tenantId}-${persona}`} />;
}

function DirectoryInner() {
  const { tenantId, toast } = useApp();
  const nav = useNavigate();
  const { c, me, people, mid } = useComms();
  const [sp] = useSearchParams();
  const chs = useMemo(() => channelList(c, me, people), [c, me, people]);
  const [invited, setInvited] = useState<CommsPerson[]>([]);
  const everyone = useMemo(() => [...invited, ...people.filter((p) => !p.bot)], [invited, people]);
  const inScope = everyone.filter((p) => p.party !== 'colleague' || tenantId === 'all' || !p.tenantId || p.tenantId === tenantId);
  const seats = licenceUse(c, everyone);
  const pp = sp.get('party');
  const pl = sp.get('licence');
  const [party, setParty] = useState<PartyF>(pp === 'external' || pp === 'colleague' || pp === 'hexashield' ? pp : 'all');
  const [lic, setLic] = useState<Licence | 'all'>(LICENCES.includes(pl as Licence) ? (pl as Licence) : 'all');
  const [pres, setPres] = useState<Presence | 'all'>('all');
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [sel, setSel] = useState<CommsPerson | null>(null);
  const [modal, setModal] = useState<'colleague' | 'guest' | null>(null);
  const [form, setForm] = useState({ name: '', email: '', team: 'SOC' as Team, licence: 'Viewer' as Licence, kind: GUEST_KINDS[0], org: '', expiry: 30, channels: new Set<string>(), tenant: tenantId === 'all' ? '' : tenantId });

  const shown = inScope.filter((p) =>
    (party === 'all' || p.party === party) && (lic === 'all' || p.licence === lic) && (pres === 'all' || p.presence === pres) &&
    (!q || `${p.name} ${p.role} ${p.org} ${p.team} ${p.email}`.toLowerCase().includes(q.toLowerCase())));
  const online = inScope.filter((p) => p.presence === 'online');
  const guests = inScope.filter((p) => p.party === 'external');
  const hx = inScope.filter((p) => p.party === 'hexashield');
  const colleagues = inScope.filter((p) => p.party === 'colleague');
  const free = seats.reduce((s, x) => s + x.free, 0);
  const totalSynced = seats.reduce((s, x) => s + x.synced, 0);
  const expiring = guests.filter((g) => (g.guestExpiryDays ?? 99) <= 45).sort((a, b) => (a.guestExpiryDays ?? 0) - (b.guestExpiryDays ?? 0));
  const scroll = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const chat = (p: CommsPerson) => nav(`/comms/inbox?with=${p.id}`);
  const presCount = (['online', 'busy', 'away', 'offline'] as Presence[]).map((x) => ({ x, n: inScope.filter((p) => p.presence === x).length }));
  const teamCounts = TEAMS.map((t) => ({ t, n: colleagues.filter((p) => p.team === t).length })).filter((x) => x.n);

  const openInvite = (kind: 'colleague' | 'guest') => {
    setForm({ name: '', email: '', team: 'SOC', licence: kind === 'guest' ? 'Guest' : 'Viewer', kind: GUEST_KINDS[0], org: '', expiry: 30, channels: new Set(), tenant: tenantId === 'all' ? '' : tenantId });
    setModal(kind);
  };
  const submit = () => {
    const guest = modal === 'guest';
    const p: CommsPerson = {
      id: `inv-${Date.now()}`, name: form.name, role: guest ? form.kind : `${form.team} (invited)`, org: guest ? form.org || 'External' : c.name, party: guest ? 'external' : 'colleague',
      team: guest ? (form.kind.includes('auditor') ? 'Audit' : form.kind.includes('counsel') ? 'Legal (external)' : form.kind.includes('Vendor') ? 'Vendor' : 'Insurance') : form.team,
      licence: guest ? 'Guest' : form.licence, presence: 'offline', tz: guest ? '—' : 'Invited', tzOffset: 0, tenantId: form.tenant || undefined, lastActiveMin: 0,
      modules: guest ? ['Shared channels only'] : [LICENCE_META[form.licence].can.split(';')[0]], email: form.email, guestExpiryDays: guest ? form.expiry : undefined,
      status: 'Invitation pending', channels: [...form.channels].map((x) => `#${x}`),
    };
    setInvited((xs) => [p, ...xs]);
    setModal(null);
    toast(guest
      ? `Guest invitation sent to ${form.email}: ${form.expiry}-day access to ${form.channels.size || 'no'} shared channel${form.channels.size === 1 ? '' : 's'}; written to the audit ledger`
      : `Invitation sent to ${form.email} with a ${LICENCE_META[form.licence].label} licence; provisioned via SSO on first sign-in`);
  };
  const seatFor = (l: Licence) => seats.find((s) => s.licence === l);
  const valid = form.name.trim() && /.+@.+\..+/.test(form.email) && (modal === 'colleague' ? (seatFor(form.licence)?.free ?? 0) > 0 : (seatFor('Guest')?.free ?? 0) > 0);

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · everyone you can reach in the Communications Hub{tenantId !== 'all' ? `, colleagues scoped to ${tenantName(c, tenantId)}` : ''}: licensed colleagues provisioned from {c.connectors.find((k) => k.category === 'Identity')?.product ?? 'your IdP'}, external guests on time-boxed licences, and your HexaShield team. Licences decide which modules and channels each person can use.
      </p>

      <KpiStrip toneColor={COMMS_TONE} items={[
        { label: 'People', value: inScope.length, unit: `+${totalSynced} synced`, onClick: () => { setParty('all'); setLic('all'); setPres('all'); }, source: `${c.connectors.find((k) => k.category === 'Identity')?.product ?? 'IdP'} SCIM · Communications Hub` },
        { label: 'Online now', value: online.length, unit: `of ${inScope.length}`, onClick: () => setPres('online'), source: 'Communications Hub presence service' },
        { label: 'Colleagues', value: colleagues.length, unit: 'licensed', onClick: () => setParty('colleague'), source: `${c.connectors.find((k) => k.category === 'Identity')?.product ?? 'IdP'} SCIM` },
        { label: 'External guests', value: guests.length, unit: `${expiring.length} expiring ≤45 d`, onClick: () => setParty('external'), source: 'Guest licences · HexaView Administration', toneColor: 'var(--warn)' },
        { label: 'HexaShield staff', value: hx.length, unit: 'no data access', onClick: () => setParty('hexashield'), source: 'HexaShield staff directory · support-access broker' },
        { label: 'Seats available', value: free, unit: `of ${seats.reduce((s, x) => s + x.seats, 0)}`, onClick: () => scroll('cm-seats'), source: 'HexaView licence entitlement (contract)' },
      ]} />

      <div className="grid g-2-1">
        <Card title="Directory" count={shown.length} flush
          actions={<><Btn sm onClick={() => openInvite('colleague')}><UserPlus /> Invite colleague</Btn><Btn sm primary color={COMMS_TONE} onClick={() => openInvite('guest')}><Globe2 /> Invite external guest</Btn></>}>
          <div style={{ padding: '0 18px 10px', display: 'grid', gap: 8 }}>
            <label className="search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, role, organisation, email" /></label>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <span className="chips">{(['all', 'colleague', 'external', 'hexashield'] as PartyF[]).map((x) => <Chip key={x} on={party === x} onClick={() => setParty(x)} color={COMMS_TONE}>{x === 'all' ? 'Everyone' : PARTY_LABEL[x]}</Chip>)}</span>
              <span className="chips">{(['all', ...LICENCES] as (Licence | 'all')[]).map((x) => <Chip key={x} on={lic === x} onClick={() => setLic(x)} color={x === 'all' ? COMMS_TONE : LICENCE_META[x].color}>{x === 'all' ? 'Any licence' : LICENCE_META[x].label}</Chip>)}</span>
              {pres !== 'all' && <Chip on onClick={() => setPres('all')} color={PRESENCE_COLOR[pres]}>{pres} ✕</Chip>}
            </div>
          </div>
          <DataTable
            rows={shown}
            rowKey={(p) => p.id}
            onRowClick={(p) => setSel(p)}
            initialSort={{ key: 'name', dir: 'asc' }}
            columns={[
              { key: 'name', header: 'Person', sort: (p) => p.name, render: (p) => (
                <div className="row" style={{ gap: 9 }}>
                  <Avatar p={p} size={30} />
                  <div style={{ minWidth: 0, maxWidth: 230 }}><div className="t-main" style={{ whiteSpace: 'nowrap' }}>{p.name}{p.id === mid ? ' (you)' : ''} {p.vip && <span className="cm-tag appt">VIP</span>}</div><div className="t-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.role}>{p.role}</div></div>
                </div>) },
              { key: 'org', header: 'Organisation', sort: (p) => p.org, render: (p) => <div><div className="t-main" style={{ fontWeight: 500 }}>{p.party === 'colleague' ? (p.tenantId ? c.tenants.find((t) => t.id === p.tenantId)?.short : 'Group') : p.org}</div><div className="t-sub">{p.team}</div></div> },
              { key: 'lic', header: 'Licence', sort: (p) => LICENCES.indexOf(p.licence), render: (p) => <><LicenceBadge l={p.licence} />{p.guestExpiryDays !== undefined && <div className="t-sub" style={{ marginTop: 2 }}>expires in {p.guestExpiryDays} d</div>}</> },
              { key: 'pres', header: 'Presence · local time', sort: (p) => ['online', 'busy', 'away', 'offline'].indexOf(p.presence), render: (p) => <div><div style={{ fontSize: 12, whiteSpace: 'nowrap' }}><PresenceDot p={p.presence} /> {p.status === 'Invitation pending' ? 'Invited' : p.presence}{p.tz !== 'Invited' && p.tz !== '—' ? <span className="muted"> · {localTime(p.tzOffset)} {p.tz.split(' (')[0]}</span> : null}</div><div className="t-sub">{p.presence === 'online' ? 'active now' : `last active ${fmtAgo(p.lastActiveMin)}`}</div></div> },
              { key: 'mods', header: 'Can access', render: (p) => <span className="t-sub" title={p.modules.join(', ')} style={{ whiteSpace: 'nowrap' }}>{p.modules[0]}{p.modules.length > 1 ? ` +${p.modules.length - 1}` : ''}</span> },
              { key: 'act', header: '', render: (p) => p.id === mid ? null : (
                <span className="row" style={{ gap: 4 }}>
                  <button className="cm-icon-btn" title={`Message ${p.name}`} onClick={(e) => { e.stopPropagation(); chat(p); }}><MessageSquare /></button>
                  <button className="cm-icon-btn" title={`Call ${p.name}`} onClick={(e) => { e.stopPropagation(); toast(`Calling ${p.name} · end-to-end encrypted`); }}><Phone /></button>
                </span>) },
            ]}
          />
        </Card>

        <div className="stack" style={{ gap: 16, minWidth: 0 }}>
          <div id="cm-seats" style={{ scrollMarginTop: 80 }}>
            <Card title="Licence utilisation" sub="Seats used (named + synced from IdP) against your entitlement">
              {seats.map((s) => {
                const m = LICENCE_META[s.licence];
                return (
                  <button key={s.licence} className="cm-seat" onClick={() => { setLic(s.licence); setParty('all'); }} title={m.can}>
                    <span><LicenceBadge l={s.licence} /></span>
                    <span className="cm-seat-bar">
                      <i style={{ width: `${(s.named / s.seats) * 100}%`, background: m.color }} />
                      <i style={{ width: `${(s.synced / s.seats) * 100}%`, background: m.color, opacity: 0.45 }} />
                    </span>
                    <span className="cm-seat-val"><b>{s.used}</b> / {s.seats}<small>{s.free} free</small></span>
                  </button>
                );
              })}
              <div style={{ marginTop: 8 }}><Legend items={[{ label: 'Named in directory', color: 'var(--text-secondary)' }, { label: 'Synced users', color: 'var(--neutral-fill)' }]} /></div>
              <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                <Btn sm onClick={() => nav('/ops/admin')}>Manage in Administration</Btn>
                <Btn sm onClick={() => toast(`Licence change request sent to your CSM (${people.find((p) => p.id === 'hx-csm')?.name})`)}>Request more seats</Btn>
              </div>
            </Card>
          </div>
          <Card title="Presence" sub="Right now, people in scope">
            <div className="row" style={{ gap: 16, alignItems: 'center' }}>
              <button className="cc-link" onClick={() => setPres('online')} title="Show who is online">
                <Ring value={online.length} max={Math.max(1, inScope.length)} size={84} color={PRESENCE_COLOR.online} label={online.length} sub="ONLINE" />
              </button>
              <div style={{ flex: 1, display: 'grid', gap: 2 }}>
                {presCount.map(({ x, n }) => (
                  <button key={x} className="cm-seat" style={{ gridTemplateColumns: '70px 1fr 30px' }} onClick={() => setPres(x)}>
                    <span style={{ fontSize: 12, textTransform: 'capitalize' }}><PresenceDot p={x} /> {x}</span>
                    <span className="cm-seat-bar" style={{ height: 8 }}><i style={{ width: `${(n / Math.max(1, inScope.length)) * 100}%`, background: PRESENCE_COLOR[x] }} /></span>
                    <span className="cm-seat-val">{n}</span>
                  </button>
                ))}
              </div>
            </div>
          </Card>
          <Card title="Guest access expiring" count={expiring.length} sub="Guests lose access automatically; extend or let lapse">
            <div className="list">
              {expiring.map((g) => (
                <button key={g.id} className="list-row" onClick={() => setSel(g)}>
                  <Avatar p={g} size={28} />
                  <span className="list-main"><b>{g.name}</b><span>{g.org} · {g.role}</span></span>
                  <span className="cm-sla risk" style={{ color: (g.guestExpiryDays ?? 99) <= 14 ? 'var(--bad)' : undefined }}><Clock size={12} /> {g.guestExpiryDays} d</span>
                </button>
              ))}
              {!expiring.length && <div className="empty">No guest access expiring soon.</div>}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid g2">
        <Card title="Colleagues by function" sub="Licensed colleagues in scope · click to filter">
          {teamCounts.map(({ t, n }) => (
            <button key={t} style={{ all: 'unset', display: 'block', cursor: 'pointer' }} onClick={() => { setParty('colleague'); setQ(t); }}>
              <BarRow label={t} value={n} max={Math.max(...teamCounts.map((x) => x.n))} color={COMMS_TONE} />
            </button>
          ))}
        </Card>
        <Card title="What each licence can do" sub="Guests and HexaShield staff never get standing data access">
          <div className="stack" style={{ gap: 8 }}>
            {LICENCES.map((l) => (
              <div key={l} className="row" style={{ gap: 10, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setLic(l)}>
                <span style={{ width: 120, flexShrink: 0 }}><LicenceBadge l={l} /></span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{LICENCE_META[l].can}</span>
                <span className="num muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{inScope.filter((p) => p.licence === l).length}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {sel && (
        <Drawer title={sel.name} sub={`${sel.role} · ${sel.org}`} icon={<Avatar p={sel} size={40} />} onClose={() => setSel(null)}
          footer={sel.id !== mid ? <>
            <Btn primary color={COMMS_TONE} onClick={() => chat(sel)}><MessageSquare /> Start chat</Btn>
            <Btn onClick={() => toast(`Calling ${sel.name} · end-to-end encrypted`)}><Phone /> Call</Btn>
            {sel.party === 'external' && <Btn onClick={() => { toast(`Guest access for ${sel.name} extended by 30 days; logged`); setSel(null); }}><Clock /> Extend 30 days</Btn>}
          </> : undefined}>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}><PartyTag p={sel} /> <LicenceBadge l={sel.licence} /></div>
          <KV rows={[
            ['Presence', <span><PresenceDot p={sel.presence} /> {sel.presence}{sel.presence !== 'online' ? ` · last active ${fmtAgo(sel.lastActiveMin)}` : ''}</span>],
            ['Local time', sel.tz === 'Invited' || sel.tz === '—' ? '—' : `${localTime(sel.tzOffset)} · ${sel.tz}`],
            ['Email', <span className="mono" style={{ fontSize: 12 }}><Mail size={11} /> {sel.email}</span>],
            ['Function', sel.team],
            ...(sel.tenantId ? [['Tenant', c.tenants.find((t) => t.id === sel.tenantId)?.name ?? sel.tenantId] as [string, string]] : []),
            ...(sel.guestExpiryDays !== undefined ? [['Guest access', `Expires in ${sel.guestExpiryDays} days · sees shared channels and records only`] as [string, string]] : []),
            ...(sel.status ? [['Status', sel.status] as [string, string]] : []),
          ]} />
          <div className="section-label" style={{ marginTop: 16 }}>Can access</div>
          <div className="chips">{sel.modules.map((m) => <Chip key={m}>{m}</Chip>)}</div>
          <div className="section-label" style={{ marginTop: 16 }}>Channels</div>
          <div className="chips">{sel.channels.length ? sel.channels.map((ch) => <Chip key={ch} onClick={() => nav(`/comms/channels?channel=${ch.slice(1)}`)}>{ch}</Chip>) : <span className="muted" style={{ fontSize: 12 }}>None</span>}</div>
          {sel.party === 'hexashield' && <div style={{ marginTop: 16 }}><Callout><Hexagon size={12} /> HexaShield staff can message you but cannot see tenant data. Support sessions are requested per ticket and approved by a Tenant Admin.</Callout></div>}
          {sel.party === 'external' && <div style={{ marginTop: 16 }}><Callout kind="warn">External guest: can only see conversations and channels they are invited to, and records explicitly shared there.</Callout></div>}
        </Drawer>
      )}

      {modal && (
        <Modal title={modal === 'guest' ? 'Invite an external guest' : 'Invite a colleague'}
          sub={modal === 'guest' ? 'Brokers, carriers, auditors, counsel and vendors. Time-boxed; sees only what is shared with them.' : `Provisioned through ${c.connectors.find((k) => k.category === 'Identity')?.product ?? 'SSO'} on first sign-in`}
          onClose={() => setModal(null)}
          footer={<><Btn onClick={() => setModal(null)}>Cancel</Btn><Btn primary color={COMMS_TONE} disabled={!valid} onClick={submit}><UserPlus /> Send invitation</Btn></>}>
          <div className="cm-form">
            <div className="row2">
              <label>Full name<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></label>
              <label>Email<input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={modal === 'guest' ? 'name@partner.com' : `name@${c.domain}`} /></label>
            </div>
            {modal === 'guest' ? (
              <>
                <div className="row2">
                  <label>Role<select className="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{GUEST_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
                  <label>Organisation<input className="input" value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} placeholder={c.insurance.broker} /></label>
                </div>
                <label>Access expires after
                  <div className="cm-choice">{[7, 30, 60, 90].map((d) => <button key={d} className={form.expiry === d ? 'on' : ''} onClick={() => setForm({ ...form, expiry: d })}>{d} days</button>)}</div>
                </label>
              </>
            ) : (
              <div className="row2">
                <label>Function<select className="select" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value as Team })}>{TEAMS.map((t) => <option key={t}>{t}</option>)}</select></label>
                <label>Tenant<select className="select" value={form.tenant} onChange={(e) => setForm({ ...form, tenant: e.target.value })}><option value="">Group-wide</option>{c.tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
              </div>
            )}
            <label>Licence
              <div className="cm-choice">
                {(modal === 'guest' ? (['Guest'] as Licence[]) : (['Full', 'Approver', 'Viewer'] as Licence[])).map((l) => {
                  const s = seatFor(l);
                  return <button key={l} className={form.licence === l ? 'on' : ''} disabled={!s?.free} onClick={() => setForm({ ...form, licence: l })}>{LICENCE_META[l].label} · {s?.free ?? 0} free</button>;
                })}
              </div>
              <span className="muted" style={{ fontWeight: 400 }}>{LICENCE_META[modal === 'guest' ? 'Guest' : form.licence].can}</span>
            </label>
            <label>Channels
              <div className="cm-choice">
                {chs.map((ch) => {
                  const allowed = ch.gate.includes(modal === 'guest' ? 'Guest' : form.licence);
                  const on = form.channels.has(ch.id);
                  return (
                    <button key={ch.id} className={on ? 'on' : ''} disabled={!allowed} title={allowed ? ch.gateNote : `Not allowed for this licence: ${ch.gateNote}`}
                      onClick={() => setForm((f) => { const n = new Set(f.channels); if (n.has(ch.id)) n.delete(ch.id); else n.add(ch.id); return { ...f, channels: n }; })}>
                      #{ch.name}
                    </button>
                  );
                })}
              </div>
            </label>
            <Callout kind={modal === 'guest' ? 'warn' : 'info'}>
              {modal === 'guest'
                ? <>Guests cannot open any HexaView module. They see only the channels selected here and records explicitly shared with them. The invitation and every share are written to the audit ledger.</>
                : <>Seats: {seatFor(form.licence)?.used} of {seatFor(form.licence)?.seats} {LICENCE_META[form.licence].label} used. Role-based access inside modules still follows their HexaView role.</>}
            </Callout>
          </div>
        </Modal>
      )}
      <div className="muted" style={{ fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}><Users size={12} /> Directory synced {fmtAgo(12)} from {c.connectors.find((k) => k.category === 'Identity')?.product ?? 'your IdP'} · guest and HexaShield entries managed in HexaView Administration.</div>
    </>
  );
}
