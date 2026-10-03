import { useMemo, useState, type CSSProperties } from 'react';
import { RefreshCw, Globe, ShieldCheck, Copy } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Badge, Btn, Callout, KV, SectionLabel, StatusBadge } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { CUSTOMERS } from '../../data/customers';
import { clientBook, type PartnerClient } from '../../data/modules/partner';
import { rng } from '../../lib/rng';
import { fmtAgo } from '../../lib/format';
import { ClientAvatar, Field, PT_TONE, Seg, Toggle } from '../partner/parts';
import { setBrand, useBrand, type Brand } from './brand';
import { LoginPreview } from './Preview';

const DNS_COLOR = { verified: 'var(--good)', pending: 'var(--sev-medium)', failed: 'var(--bad)' };
const IDPS = ['Microsoft Entra ID', 'Okta', 'Google Workspace', 'Ping Identity'];

interface ClientDomain {
  c: PartnerClient;
  sub: string;
  status: 'verified' | 'pending' | 'failed';
  idp: string;
  protocol: 'SAML 2.0' | 'OIDC';
  scim: boolean;
  mfa: number;
  users: number;
  lastSignInMin: number;
}

export default function WhiteLabelDomains() {
  const brand = useBrand();
  const { toast } = useApp();
  const book = useMemo(() => clientBook(), []);
  const base = brand.domain.replace(/^portal\./, '');
  const [sel, setSel] = useState<ClientDomain | null>(null);
  const [sso, setSso] = useState<string[]>(['Microsoft Entra ID', 'Okta']);
  const [jit, setJit] = useState(true);
  const [session, setSession] = useState('8h');
  const [consent, setConsent] = useState(true);

  const rows: ClientDomain[] = useMemo(() => book.map((c) => {
    const r = rng(`dom-${c.id}`);
    const idConn = c.demoId ? CUSTOMERS[c.demoId].connectors.find((k) => k.category === 'Identity') : undefined;
    const idp = idConn ? `${idConn.vendor} ${idConn.product}`.replace('Microsoft Microsoft', 'Microsoft') : r.pick(IDPS);
    return {
      c, sub: `${c.short.toLowerCase().replace(/[^a-z]+/g, '')}.${base}`,
      status: c.status === 'onboarding' && c.short === 'Calder Valley' ? 'pending' : 'verified',
      idp, protocol: idp.includes('Google') ? 'OIDC' : r.chance(0.7) ? 'SAML 2.0' : 'OIDC', scim: c.tier !== 'Essentials' || r.chance(0.4),
      mfa: c.status === 'onboarding' ? r.int(60, 85) : r.int(94, 100), users: c.users, lastSignInMin: r.int(1, 240),
    };
  }), [book, base]);

  const dns = [
    { type: 'CNAME', host: brand.domain, value: 'partners.eu1.hexaview.app', status: 'verified' as const },
    { type: 'TXT', host: `_hexaview-verify.${base}`, value: 'hv-site-verification=7f3a9c1e5b2d', status: 'verified' as const },
    { type: 'CAA', host: base, value: '0 issue "pki.hexaview.app"', status: 'verified' as const },
    { type: 'CNAME', host: `*.${base}`, value: 'tenants.eu1.hexaview.app', status: 'verified' as const },
    { type: 'TXT', host: `hv1._domainkey.${base}`, value: 'v=DKIM1; k=rsa; p=MIIBIjANBgkq…', status: 'pending' as const },
  ];
  const set = (p: Partial<Brand>) => setBrand(p);

  return (
    <>
      <p className="page-intro">
        Your clients sign in at <b>{brand.domain}</b> (or their own subdomain) with their own identity provider, and never see a HexaShield URL. Your staff sign in once with your IdP and reach client tenants through time-bound, consented and audited delegated access.
      </p>
      <KpiStrip
        toneColor={PT_TONE}
        items={[
          { label: 'Portal domain', value: 'Verified', hint: brand.domain, onClick: () => document.getElementById('pt-dns')?.scrollIntoView({ behavior: 'smooth' }), source: 'White-label service · DNS verification' },
          { label: 'TLS certificate', value: 61, unit: 'days', hint: 'auto-renew', onClick: () => document.getElementById('pt-dns')?.scrollIntoView({ behavior: 'smooth' }), source: 'HexaView managed PKI' },
          { label: 'Client subdomains', value: `${rows.filter((r) => r.status === 'verified').length}/${rows.length}`, onClick: () => setSel(rows.find((r) => r.status !== 'verified') ?? rows[0]), source: 'White-label service · DNS verification' },
          { label: 'Federated IdPs', value: new Set(rows.map((r) => r.idp)).size, hint: `${rows.filter((r) => r.scim).length} with SCIM`, onClick: () => document.getElementById('pt-sub')?.scrollIntoView({ behavior: 'smooth' }), source: 'Identity broker' },
          { label: 'MFA enforced', value: `${Math.round(rows.reduce((s, r) => s + r.mfa * r.users, 0) / rows.reduce((s, r) => s + r.users, 0))}%`, hint: 'of client users', onClick: () => setSel(rows.slice().sort((a, b) => a.mfa - b.mfa)[0]), source: 'Identity broker · sign-in logs' },
        ]}
      />

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 16 }} id="pt-dns">
          <Card title="Portal domain" sub="Point your domain at HexaView; we manage the certificate" toneColor={PT_TONE} actions={<Btn sm onClick={() => toast(`DNS re-checked for ${brand.domain}: 4 of 5 records verified, DKIM still propagating`)}><RefreshCw /> Verify DNS</Btn>}>
            <div className="pt-form">
              <Field label="Client portal domain" full><input className="input" value={brand.domain} onChange={(e) => set({ domain: e.target.value })} /></Field>
            </div>
            <table className="tbl" style={{ marginTop: 12 }}>
              <thead><tr><th>Type</th><th>Host</th><th>Value</th><th>Status</th></tr></thead>
              <tbody>
                {dns.map((d, i) => (
                  <tr key={i}>
                    <td><Badge>{d.type}</Badge></td>
                    <td className="pt-dns">{d.host}</td>
                    <td className="pt-dns"><span className="row" style={{ gap: 4 }}>{d.value}<button className="link" title="Copy" onClick={() => toast('Copied to clipboard')} style={{ background: 'none', border: 0 }}><Copy size={12} /></button></span></td>
                    <td><StatusBadge value={d.status} map={DNS_COLOR} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 12 }}>
              <KV rows={[['Certificate', 'Managed by HexaView PKI · RSA 2048 + ECDSA P-256'], ['Expires', '61 days · auto-renews at 30 days'], ['HSTS', 'Enabled · 1 year · includeSubDomains'], ['Email sender', `notifications@${base} (SPF pass, DKIM pending, DMARC p=quarantine)`]]} />
            </div>
          </Card>

          <Card title="Your staff sign-in" sub="Northwind identity provider and how roles map into client tenants" toneColor={PT_TONE}>
            <KV
              rows={[
                ['Identity provider', 'Microsoft Entra ID (northwindcyber.com) · SAML 2.0'],
                ['Role mapping', <span className="chips"><Badge>NW-HexaView-Admins → Partner admin</Badge><Badge>NW-SOC → Analyst</Badge><Badge>NW-Sales → Account manager</Badge><Badge>NW-GRC → Compliance lead</Badge></span>],
                ['Phishing-resistant MFA', 'Required (FIDO2 / Windows Hello)'],
              ]}
            />
            <div className="stack" style={{ gap: 10, marginTop: 12 }}>
              <div className="row"><Toggle on={jit} onChange={setJit} /><span style={{ fontSize: 12.5 }}>Just-in-time provisioning of partner staff on first sign-in</span></div>
              <div className="row"><Toggle on={consent} onChange={(v) => { setConsent(v); if (!v) toast('Client consent can only be relaxed by HexaShield for Essentials clients; change not applied'); }} /><span style={{ fontSize: 12.5 }}>Require client consent for delegated access (time-bound, 8 h)</span></div>
              <div className="row"><span style={{ fontSize: 12.5, flex: 1 }}>Idle session timeout</span><Seg options={[{ id: '1h', label: '1 h' }, { id: '8h', label: '8 h' }, { id: '12h', label: '12 h' }]} value={session} onChange={setSession} /></div>
            </div>
          </Card>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <Card title="Client sign-in page" sub="Live preview of what your clients see" toneColor={PT_TONE}>
            <LoginPreview brand={brand} sso={sso} />
            <div className="pt-form" style={{ marginTop: 14 }}>
              <Field label="Headline" full><input className="input" value={brand.loginHeadline} onChange={(e) => set({ loginHeadline: e.target.value })} /></Field>
              <Field label="Sub-heading" full><input className="input" value={brand.loginSub} onChange={(e) => set({ loginSub: e.target.value })} /></Field>
              <Field label="Background"><Seg options={[{ id: 'gradient', label: 'Gradient' }, { id: 'grid', label: 'Grid' }, { id: 'solid', label: 'Solid' }]} value={brand.loginArt} onChange={(v) => set({ loginArt: v })} /></Field>
              <Field label="Support address"><input className="input" value={brand.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} /></Field>
              <div className="pt-field full">
                <span className="pt-label">Sign-in buttons</span>
                <div className="chips">
                  {IDPS.map((i) => (
                    <label key={i} className={`pt-check ${sso.includes(i) ? 'on' : ''}`} style={{ '--tone': PT_TONE } as CSSProperties}>
                      <input type="checkbox" checked={sso.includes(i)} onChange={(e) => setSso(e.target.checked ? [...sso, i] : sso.filter((x) => x !== i))} />
                      {i}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div id="pt-sub">
        <Card title="Client subdomains and identity federation" count={rows.length} sub="Each client signs in with its own IdP; SCIM keeps users in step" flush>
          <DataTable
            rows={rows}
            rowKey={(r) => r.c.id}
            onRowClick={setSel}
            search={(r) => `${r.c.name} ${r.sub} ${r.idp}`}
            searchPlaceholder="Filter clients, domains, IdPs…"
            columns={[
              { key: 'c', header: 'Client', sort: (r) => r.c.name, render: (r) => <div className="row" style={{ gap: 8 }}><ClientAvatar c={r.c} size={24} /><span className="t-main">{r.c.short}</span></div> },
              { key: 'sub', header: 'Subdomain', sort: (r) => r.sub, render: (r) => <span className="mono" style={{ fontSize: 11.5 }}><Globe size={12} style={{ verticalAlign: -2 }} /> {r.sub}</span> },
              { key: 'st', header: 'DNS', sort: (r) => r.status, render: (r) => <StatusBadge value={r.status} map={DNS_COLOR} /> },
              { key: 'idp', header: 'Identity provider', sort: (r) => r.idp, render: (r) => <><div className="t-main" style={{ fontWeight: 500 }}>{r.idp}</div><div className="t-sub">{r.protocol}</div></> },
              { key: 'scim', header: 'SCIM', render: (r) => (r.scim ? <Badge color="var(--good)">On</Badge> : <Badge>Off</Badge>) },
              { key: 'mfa', header: 'MFA', align: 'right', sort: (r) => r.mfa, render: (r) => <span className="num" style={{ color: r.mfa < 90 ? 'var(--sev-medium)' : undefined }}>{r.mfa}%</span> },
              { key: 'u', header: 'Users', align: 'right', sort: (r) => r.users, render: (r) => r.users },
              { key: 'last', header: 'Last sign-in', sort: (r) => r.lastSignInMin, render: (r) => <span className="t-sub">{fmtAgo(r.lastSignInMin)}</span> },
            ]}
          />
        </Card>
      </div>

      {sel && (
        <Drawer
          title={sel.sub}
          sub={`${sel.c.name} · ${sel.idp}`}
          icon={<ClientAvatar c={sel.c} size={34} />}
          onClose={() => setSel(null)}
          footer={<><Btn primary color={PT_TONE} onClick={() => { toast(`SSO test sign-in started for ${sel.c.short}: result appears in the identity log`); }}><ShieldCheck /> Test SSO</Btn><Btn onClick={() => toast(`DNS re-checked for ${sel.sub}`)}><RefreshCw /> Re-check DNS</Btn></>}
        >
          {sel.status !== 'verified' && <div style={{ marginBottom: 12 }}><Callout kind="warn">CNAME for {sel.sub} not found yet. Ask the client's DNS admin to add <span className="mono">CNAME → tenants.eu1.hexaview.app</span>.</Callout></div>}
          <KV
            rows={[
              ['DNS', <StatusBadge value={sel.status} map={DNS_COLOR} />],
              ['Identity provider', `${sel.idp} · ${sel.protocol}`],
              ['Entity ID', <span className="mono" style={{ fontSize: 11 }}>https://{sel.sub}/saml/metadata</span>],
              ['ACS URL', <span className="mono" style={{ fontSize: 11 }}>https://{sel.sub}/saml/acs</span>],
              ['SCIM provisioning', sel.scim ? 'On · last sync 14 min ago' : 'Off (manual invites)'],
              ['MFA enforced', `${sel.mfa}% of users`],
              ['Users', sel.users],
              ['Delegated partner access', 'Consent required · 8-hour grants · every session in the client audit ledger'],
            ]}
          />
          <SectionLabel>Recent sign-ins</SectionLabel>
          <div className="list">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="list-row" style={{ fontSize: 12 }}>
                <span className="list-main"><b>{i === 1 ? 'Marcus Chen (Northwind, delegated)' : `${['CISO', 'SOC lead', 'GRC lead', 'IT admin'][i]} · ${sel.c.short}`}</b><span>{i === 1 ? 'Partner staff · consent grant #4471' : `${sel.idp} · MFA`}</span></span>
                <span className="muted" style={{ fontSize: 11 }}>{fmtAgo(sel.lastSignInMin + i * 47)}</span>
              </div>
            ))}
          </div>
        </Drawer>
      )}
    </>
  );
}
