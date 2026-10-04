import { useMemo, useState } from 'react';
import { Users, Cloud, Building2, UserX, ShieldAlert, KeyRound, UserCheck, Fingerprint, Crown } from 'lucide-react';
import { Card, Badge, KV, Btn, Callout, cap } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { identityUsers, incidents, hasBadgeTap, type IdUser } from '../../data/modules/soc';
import { forCustomer, type CustomerMap } from '../../data/customerMap';

const ID_INTRO: CustomerMap<string> = {
  maritime: '',
  finserv: '',
  media: '',
  healthcare: ' Shared clinical workstations sign in by Imprivata badge tap; help-desk-resettable accounts are watched for social engineering.',
  automotive: ' Supplier, dealer and robot-OEM guests are tracked separately; plant shared logons are limited to Level 3 hosts.',
  insurance: ' Agents and brokers federate through Okta; BPO servicing staff reach PolicyCenter only through Island Browser.',
  defence: ' The CUI enclave runs on Entra ID (GCC High) with FIPS YubiKeys; the commercial tenant is tracked separately and never holds CUI.',
  pharma: ' CRO partners sign in through the Okta partner org; plant shared logons are limited to MES terminals and QC lab benches.',
  sghospital: ' Shared ward workstations sign in by Imprivata badge tap; help-desk-resettable clinical accounts are watched for social engineering.',
  studio: ' Freelancers and VFX vendors reach content through Island Browser; ride operations use shared consoles on isolated park networks.',
};
const GUEST_LABEL: CustomerMap<string> = {
  maritime: 'Guests (B2B)',
  finserv: 'Guests (B2B)',
  media: 'Guests (B2B)',
  healthcare: 'Vendor & agency guests',
  automotive: 'Supplier & dealer guests',
  insurance: 'BPO & vendor guests',
  defence: 'OEM & assessor guests',
  pharma: 'CRO & OEM guests',
  sghospital: 'Vendor & locum guests',
  studio: 'Vendor & freelancer guests',
};
import { fmtAgo, fmtNum } from '../../lib/format';
import { rng } from '../../lib/rng';
import { useSoc, tenantShort, StatTile, Pills, SegBar, RecordsDrawer, WriteBackModal, useParamFilter, AV_COLORS, initials, type WriteBack } from './parts';

type StatusF = 'all' | 'enabled' | 'disabled';
type SourceF = 'all' | IdUser['source'];
type CaF = 'all' | IdUser['ca'];
const RISK_COLOR: Record<IdUser['risk'], string> = { none: 'var(--good)', low: 'var(--sev-low)', medium: 'var(--sev-medium)', high: 'var(--sev-critical)' };
const CA_COLOR: Record<IdUser['ca'], string> = { Passed: 'var(--good)', 'Not applied': 'var(--sev-info)', Failed: 'var(--bad)' };

export default function SocIdentity() {
  const { c, tenantId, days, tools, tone, scopeLabel, nav } = useSoc();
  const d = useMemo(() => identityUsers(c, tenantId), [c, tenantId]);
  const incs = useMemo(() => incidents(c, tenantId, days), [c, tenantId, days]);
  const [status, setStatus] = useParamFilter<StatusF>('status', ['all', 'enabled', 'disabled'] as const, 'all');
  const [source, setSource] = useState<SourceF>('all');
  const [ca, setCa] = useParamFilter<CaF>('ca', ['all', 'Passed', 'Not applied', 'Failed'] as const, 'all');
  const [riskOnly, setRiskOnly] = useState(false);
  const [sel, setSel] = useState<IdUser | null>(null);
  const [panel, setPanel] = useState<'risky' | 'ca' | 'mfa' | 'priv' | null>(null);
  const [wb, setWb] = useState<WriteBack | null>(null);
  const idp = tools.idps[0];
  const pam = c.connectors.find((k) => k.category === 'PAM');
  const src = `${tools.idpShort}${c.connectors.some((k) => k.id === 'c-imprivata') ? ' · Imprivata OneSign' : ''}${pam ? ` · ${pam.vendor} ${pam.product}` : ''}`;

  const rows = d.users.filter((u) => (status === 'all' || (status === 'enabled' ? u.enabled : !u.enabled)) && (source === 'all' || u.source === source) && (ca === 'all' || u.ca === ca) && (!riskOnly || u.risk === 'high' || u.risk === 'medium'));
  const sources: IdUser['source'][] = ['Hybrid', 'Cloud only', 'Guest (B2B)', 'Shared / kiosk'];

  return (
    <>
      <p className="page-intro">
        <b>{scopeLabel}</b> · user connectivity, sync source, Conditional Access and sign-in risk across {src}.
        {forCustomer(ID_INTRO, c)}
      </p>

      <div className="soc-stats">
        <StatTile icon={<Users />} value={fmtNum(d.total)} label="Total users" tone={tone} onClick={() => { setStatus('all'); setSource('all'); setCa('all'); setRiskOnly(false); }} source={src} />
        <StatTile icon={<Building2 />} value={fmtNum(d.hybrid)} label="Hybrid (AD synced)" tone="#4f8cff" onClick={() => setSource('Hybrid')} source={`${tools.idpShort} Connect sync`} />
        <StatTile icon={<Cloud />} value={fmtNum(d.cloud)} label="Cloud only" tone="#2dd4bf" onClick={() => setSource('Cloud only')} source={tools.idpShort} />
        <StatTile icon={<UserCheck />} value={fmtNum(d.guests)} label={forCustomer(GUEST_LABEL, c)} tone="#a78bfa" onClick={() => setSource('Guest (B2B)')} source={tools.idpShort} />
        <StatTile icon={<UserX />} value={fmtNum(d.disabled)} label="Disabled" tone="#8a9bc0" onClick={() => setStatus('disabled')} source={tools.idpShort} />
      </div>
      <div className="soc-stats">
        <StatTile icon={<ShieldAlert />} value={fmtNum(d.risky)} label="Risky users (medium / high)" tone="#e0345e" onClick={() => setPanel('risky')} source={`${tools.idpShort} Identity Protection`} />
        <StatTile icon={<KeyRound />} value={fmtNum(d.caFailed)} label="Conditional Access failures (7 d)" tone="#f2643f" onClick={() => setPanel('ca')} source={`${tools.idpShort} sign-in logs`} />
        <StatTile icon={<Fingerprint />} value={`${d.mfaPct}%`} label="MFA registered" bar={d.mfaPct} tone="#2dd4bf" onClick={() => setPanel('mfa')} source={`${tools.idpShort} authentication methods`} />
        <StatTile icon={<Crown />} value={fmtNum(d.privileged)} label="Privileged accounts" tone="#f5a83d" onClick={() => setPanel('priv')} source={pam ? `${pam.vendor} ${pam.product}` : tools.idpShort} />
      </div>

      <div className="grid g-2-1">
        <Card title="Users" count={`${rows.length} shown`} sub={`VIPs, privileged, service, guest and shared identities, plus everyone flagged · of ${fmtNum(d.total)} in ${tools.idpShort}`} flush>
          <div className="row wrap" style={{ padding: '0 18px 12px', gap: 10 }}>
            <Pills label="Status" value={status} onChange={setStatus} tone={tone} items={[{ id: 'all', label: 'All' }, { id: 'enabled', label: 'Enabled' }, { id: 'disabled', label: 'Disabled' }]} />
            <Pills label="Source" value={source} onChange={setSource} tone={tone} items={[{ id: 'all', label: 'All' }, ...sources.map((s) => ({ id: s, label: s }))]} />
            <Pills label="CA" value={ca} onChange={setCa} tone={tone} items={[{ id: 'all', label: 'All' }, { id: 'Passed', label: 'Passed' }, { id: 'Not applied', label: 'Not applied' }, { id: 'Failed', label: 'Failed' }]} />
            <button type="button" className={`soc-pill ${riskOnly ? 'on' : ''}`} onClick={() => setRiskOnly(!riskOnly)}>At risk only</button>
          </div>
          <DataTable
            rows={rows}
            rowKey={(r) => r.upn}
            onRowClick={setSel}
            pageSize={14}
            search={(r) => `${r.name} ${r.upn} ${r.role} ${r.lastApp} ${r.lastLoc}`}
            searchPlaceholder="Search name, UPN, app…"
            columns={[
              { key: 'u', header: 'User', sort: (r) => r.name, render: (r) => { const i = r.name.length % AV_COLORS.length; return (<span className="soc-user"><span className="soc-av" style={{ background: AV_COLORS[i] }}>{initials(r.name)}</span><span style={{ minWidth: 0 }}><b>{r.name}{r.vip ? ' ★' : ''}</b><span>{r.upn}</span></span></span>); } },
              { key: 'src', header: 'Source', sort: (r) => r.source, render: (r) => <span className="t-sub">{r.source}</span> },
              { key: 'ca', header: 'Conditional Access', sort: (r) => r.ca, render: (r) => <Badge color={CA_COLOR[r.ca]} dot>{r.ca}</Badge> },
              { key: 'risk', header: 'Risk', sort: (r) => ['none', 'low', 'medium', 'high'].indexOf(r.risk), render: (r) => <Badge color={RISK_COLOR[r.risk]}>{cap(r.risk)}</Badge> },
              { key: 'last', header: 'Last activity', sort: (r) => -r.lastMin, render: (r) => (<><div className="nowrap" style={{ fontSize: 12 }}>{fmtAgo(r.lastMin)}</div><div className="t-sub">{r.lastApp} · {r.lastLoc}</div></>) },
              { key: 'st', header: 'Status', sort: (r) => (r.enabled ? 1 : 0), render: (r) => <Badge color={r.enabled ? 'var(--good)' : 'var(--sev-info)'} dot>{r.enabled ? 'Enabled' : 'Disabled'}</Badge> },
            ]}
          />
        </Card>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Sign-in methods" sub="Share of interactive sign-ins, 7 d">
            <SegBar parts={d.methods.map((m, i) => ({ id: m.name, label: m.name, value: m.value, color: ['#4f8cff', '#2dd4bf', '#a78bfa', '#0d9488', '#f5a83d'][i % 5] }))} onPick={() => setPanel('mfa')} />
          </Card>
          <Card title="Identity source mix" sub="All users">
            <SegBar parts={[{ id: 'Hybrid', label: 'Hybrid', value: d.hybrid, color: '#4f8cff' }, { id: 'Cloud only', label: 'Cloud only', value: d.cloud, color: '#2dd4bf' }, { id: 'Guest (B2B)', label: 'Guests', value: d.guests, color: '#a78bfa' }]} onPick={(id) => setSource(id as SourceF)} />
          </Card>
          <Card title="Identity incidents" sub="Open and recent, from the incident queue">
            <div className="list">
              {incs.filter((i) => i.techniques.some((t) => ['T1078', 'T1098', 'T1621', 'T1110.003', 'T1539', 'T1550.001'].includes(t))).slice(0, 5).map((i) => (
                <div key={i.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => nav(`/soc/ir?status=${i.status === 'closed' ? 'closed' : 'open'}&id=${i.id}`)}>
                  <span className="list-main"><b>{i.title}</b><span>{i.id} · {tenantShort(c, i.tenantId)} · {i.status}</span></span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {sel && (() => {
        const r = rng(`soc-user-${sel.upn}`);
        const signins = Array.from({ length: 6 }, (_, i) => ({ min: sel.lastMin + i * r.int(30, 600), app: r.pick([sel.lastApp, 'Outlook Web', 'Microsoft Teams', 'Windows Sign In']), loc: i === 2 && sel.risk === 'high' ? r.pick(['Lagos, NG', 'Bucharest, RO', 'Residential proxy (US)']) : sel.lastLoc, ok: !(i === 2 && sel.risk !== 'none') }));
        return (
          <Drawer
            title={sel.name}
            sub={`${sel.role} · ${sel.upn}`}
            icon={<span className="soc-av" style={{ background: AV_COLORS[sel.name.length % AV_COLORS.length], width: 36, height: 36 }}>{initials(sel.name)}</span>}
            onClose={() => setSel(null)}
            footer={idp ? (
              <>
                <Btn onClick={() => setWb({ title: `Require MFA re-registration for ${sel.name}`, system: tools.idpShort, target: sel.upn, changes: ['Existing MFA methods removed', (c.dataKey === 'healthcare' || c.dataKey === 'finserv' || c.id === 'studio') ? 'Re-registration only after verified call-back by the service desk (help-desk social-engineering control)' : 'Re-registration with a Temporary Access Pass issued in person', 'User notified by their manager'], risk: 'high', done: `MFA re-registration for ${sel.name} requested` })}>Reset MFA</Btn>
                <Btn primary onClick={() => setWb({ title: `Revoke sessions for ${sel.name}`, system: tools.idpShort, target: sel.upn, changes: [`${idp.write[0] ?? 'Revoke sessions'} on all devices`, 'Refresh tokens invalidated; user re-authenticates with MFA', sel.vip ? 'VIP: executive assistant informed' : 'Service desk briefed'], risk: 'high', done: `Session revocation for ${sel.name} requested` })}>Revoke sessions</Btn>
              </>
            ) : undefined}
          >
            <div className="stack" style={{ gap: 16 }}>
              <KV rows={[
                ['Tenant', tenantShort(c, sel.tenantId)],
                ['Source', sel.source],
                ['Status', sel.enabled ? 'Enabled' : 'Disabled'],
                ['Conditional Access', <Badge key="c" color={CA_COLOR[sel.ca]} dot>{sel.ca}</Badge>],
                ['Sign-in risk', <Badge key="r" color={RISK_COLOR[sel.risk]}>{cap(sel.risk)}</Badge>],
                ['MFA method', sel.mfa],
                ['Privileged', sel.privileged ? `Yes${pam ? ` · vaulted in ${pam.product}` : ''}` : 'No'],
                ['Sign-ins (7 d)', `${sel.signins7d} · ${sel.failed7d} failed`],
              ]} />
              {sel.source === 'Shared / kiosk' && <Callout>{hasBadgeTap(c) ? 'Shared clinical workstation: clinicians tap their badge to switch user (Imprivata). Activity is attributed to the tapped user, not this account.' : 'Shared logon: restricted to designated hosts and no email or internet access.'}</Callout>}
              {sel.mfa === 'SMS' && <Callout kind="warn">SMS MFA is vulnerable to SIM swap and real-time phishing. Move this user to number matching or FIDO2.</Callout>}
              <div>
                <div className="section-label">Recent sign-ins · {tools.idpShort}</div>
                <div className="list">
                  {signins.map((s, i) => (
                    <div key={i} className="list-row" style={{ padding: '7px 0' }}>
                      <span className="list-main"><b style={{ fontWeight: 600 }}>{s.app}</b><span>{s.loc} · {fmtAgo(s.min)}</span></span>
                      <Badge color={s.ok ? 'var(--good)' : 'var(--bad)'}>{s.ok ? 'Success' : 'Blocked by CA'}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Drawer>
        );
      })()}

      {panel && (
        <RecordsDrawer
          title={panel === 'risky' ? 'Risky users' : panel === 'ca' ? 'Conditional Access failures' : panel === 'mfa' ? 'Weak or missing MFA' : 'Privileged accounts'}
          source={panel === 'priv' && pam ? `${pam.vendor} ${pam.product}` : src}
          icon={<ShieldAlert />}
          onClose={() => setPanel(null)}
          rows={d.users
            .filter((u) => (panel === 'risky' ? u.risk === 'high' || u.risk === 'medium' : panel === 'ca' ? u.ca === 'Failed' || u.failed7d > 5 : panel === 'mfa' ? u.mfa === 'SMS' || u.mfa === 'None' || u.mfa === 'Authenticator push' : u.privileged || u.role.includes('Service')))
            .map((u) => ({ id: u.upn, title: u.name, sub: `${u.role} · ${u.mfa} · ${u.failed7d} failed sign-ins`, right: <Badge color={RISK_COLOR[u.risk]}>{cap(u.risk)}</Badge>, onClick: () => { setPanel(null); setSel(u); } }))}
        />
      )}
      {wb && <WriteBackModal wb={wb} onClose={() => setWb(null)} />}
    </>
  );
}
