import { useMemo, useState, type CSSProperties } from 'react';
import { UserRound, Laptop, KeyRound } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { headlines } from '../../data/core';
import { tenantName } from '../../data/customers';
import {
  credExposure, idpMatches, vipExposure, idpOf, tally, CRED_RESPONSES,
  type StealerMachine, type IdpMatch, type VipExposure, type ExposedCred,
} from '../../data/modules/int';
import { Card, KpiStrip, SevBadge, Badge, Btn, KV, SectionLabel, Sources, Callout, Tabs } from '../../components/ui';
import { PALETTE } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { fmtNum } from '../../lib/format';
import { WriteBack, FilterGroup, useParamFilter, useParamPatch, HBarList, RecordsDrawer, Masked, Dot, CRED_COLUMNS } from './parts';
import './int.css';

const tone = MODULE_BY_ID.int.tone;
const MAL_COLOR: Record<StealerMachine['malware'], string> = {
  Lumma: PALETTE[0], RedLine: PALETTE[4], Vidar: PALETTE[2], StealC: PALETTE[3], Raccoon: PALETTE[1],
};
const RESP_COLOR: Record<string, string> = { 'Reset forced': 'var(--good)', Investigating: '#4f8cff', 'No action — personal service': 'var(--text-muted)' };
type View = 'creds' | 'machines' | 'idp' | 'vips';

function riskColor(s: number): string {
  return s >= 75 ? 'var(--bad)' : s >= 55 ? 'var(--sev-medium)' : 'var(--good)';
}

export default function IntExposure() {
  const { customer: c, tenantId } = useApp();
  const h = headlines(c, tenantId);
  const { machines, creds } = useMemo(() => credExposure(c, tenantId), [c, tenantId]);
  const matches = useMemo(() => idpMatches(c, tenantId), [c, tenantId]);
  const vips = useMemo(() => vipExposure(c), [c]);

  const [view, setView] = useParamFilter('view', 'creds');
  const [source, setSource] = useParamFilter('source');
  const [resp, setResp] = useParamFilter('response');
  const [country, setCountry] = useParamFilter('country');
  const [app, setApp] = useParamFilter('app');
  const [newOnly] = useParamFilter('new', '0');
const patch = useParamPatch();
  const [priv] = useParamFilter('priv', '0');
  const [cookies, setCookies] = useParamFilter('cookies', '0');

  const [sm, setSm] = useState<StealerMachine | null>(null);
  const [cred, setCred] = useState<ExposedCred | null>(null);
  const [vip, setVip] = useState<VipExposure | null>(null);
  const [reset, setReset] = useState<IdpMatch | null>(null);
  const [drawer, setDrawer] = useState<'accounts' | 'apps' | null>(null);

  const idp = idpOf(c);
  const idpLabel = idp ? (idp.vendor === 'Microsoft' ? 'Entra ID' : `${idp.vendor} ${idp.product}`) : 'identity provider';
  const SRC = ['HexaInt stealer-log collection', 'HexaInt combolist collection', `Matched to ${idpLabel}`];
  const stealerN = creds.filter((k) => k.source === 'Infostealer').length;
  const accounts = tally(creds, (k) => k.account);
  const apps = tally(creds, (k) => k.usedOn);
  const countries = tally(creds, (k) => k.country);
  const machCountries = tally(machines, (m) => m.country);
  const new30 = creds.filter((k) => k.foundDays <= 30).length;
  const privN = new Set(creds.filter((k) => k.privileged).map((k) => k.account)).size;

  const rows = creds
    .filter((k) => source === 'All' || k.source === source)
    .filter((k) => resp === 'All' || k.response === resp)
    .filter((k) => country === 'All' || k.country === country)
    .filter((k) => app === 'All' || k.usedOn === app)
    .filter((k) => newOnly !== '1' || k.foundDays <= 30)
    .filter((k) => priv !== '1' || k.privileged);
  const machRows = machines.filter((m) => (cookies !== '1' || m.ssoCookies) && (country === 'All' || m.country === country));
  const filtered = source !== 'All' || resp !== 'All' || country !== 'All' || app !== 'All' || newOnly === '1' || priv === '1';
  const clearAll = () => patch({ source: null, response: null, country: null, app: null, new: null, priv: null });

  return (
    <>
      <p className="page-intro">
        Corporate logins for <b>{c.domain}</b> · {tenantName(c, tenantId)} found in infostealer logs and credential combolists, wherever they were used, and matched to {idpLabel}. Last sync {Math.max(2, (c.connectors.find((k) => k.product === 'HexaInt')?.lastSyncMin ?? 4))} minutes ago.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Credentials', hint: 'corporate', value: fmtNum(h.int.exposedCredentials), unit: `exposed · ${stealerN} stealer · ${creds.length - stealerN} combo`, to: '/int/exposure', source: SRC.join(' · ') },
          { label: 'Accounts', hint: 'staff', value: accounts.length, unit: 'affected', onClick: () => setDrawer('accounts'), source: `HexaInt matched to ${idpLabel}` },
          { label: 'Machines', hint: 'infected', value: machines.length, unit: 'seen', toneColor: 'var(--sev-high)', to: '/int/exposure?view=machines', source: 'HexaInt infostealer logs' },
          { label: 'Apps', hint: 'third-party', value: apps.length, unit: 'involved', onClick: () => setDrawer('apps'), source: 'Saved-login URLs in stealer logs' },
          { label: 'New', hint: 'last 30 days', value: new30, unit: 'found', toneColor: 'var(--sev-medium)', to: '/int/exposure?new=1', source: SRC[0] },
          { label: 'Privileged', hint: 'accounts', value: privN, unit: 'admins', toneColor: 'var(--bad)', to: '/int/exposure?priv=1', source: `${idpLabel} role membership` },
        ]}
      />

      <Callout kind="warn" color="var(--bad)">
        Passwords are requested masked from the intelligence source and are never stored or shown here. Every confirmed exposure is reset by HexaSOC; the record stays so you can see the pattern.
      </Callout>

      <div className="row between wrap">
        <Tabs<View>
          color={tone}
          value={view as View}
          onChange={(v) => setView(v)}
          tabs={[
            { id: 'creds', label: `Exposed credentials · ${creds.length}` },
            { id: 'machines', label: `Infected machines · ${machines.length}` },
            { id: 'idp', label: `${idpLabel} matches · ${matches.length}` },
            { id: 'vips', label: `Executives & VIPs · ${vips.length}` },
          ]}
        />
      </div>

      {view === 'creds' && (
        <>
          <div className="int-filters">
            <FilterGroup label="Source" value={source} options={['Infostealer', 'Combolist']} onChange={setSource} />
            <FilterGroup label="Response" value={resp} options={CRED_RESPONSES} onChange={setResp} />
            {filtered && <button type="button" className="int-fchip" onClick={clearAll}>Clear filters ×</button>}
            {country !== 'All' && <span className="int-fchip on">Country: {country}</span>}
            {app !== 'All' && <span className="int-fchip on">App: {app}</span>}
            {newOnly === '1' && <span className="int-fchip on">Last 30 days</span>}
            {priv === '1' && <span className="int-fchip on">Privileged</span>}
          </div>
          <Card title="Exposed credentials" count={`${rows.length} of ${creds.length}`} sub="Newest first · click a row for the record" flush>
            <DataTable
              rows={rows}
              rowKey={(k) => k.id}
              onRowClick={setCred}
              search={(k) => `${k.account} ${k.usedOn} ${k.machine ?? ''} ${k.country ?? ''}`}
              searchPlaceholder="Search account or application…"
              initialSort={{ key: 'found', dir: 'asc' }}
              pageSize={10}
              columns={[
                { key: 'acc', header: 'Account', sort: (k) => k.account, render: (k) => (<div className="int-cell"><span className="int-ico"><KeyRound /></span><span><div className="t-main">{k.account}{k.privileged && <> <Badge color="var(--bad)">Privileged</Badge></>}</div><div className="t-sub">{k.machine ?? 'From a credential list, no machine'}</div></span></div>) },
                { key: 'used', header: 'Used on', sort: (k) => k.usedOn, render: (k) => k.usedOn },
                { key: 'pw', header: 'Password', render: () => <Masked /> },
                { key: 'src', header: 'Source', sort: (k) => k.source, render: (k) => <Badge color={k.source === 'Infostealer' ? 'var(--bad)' : 'var(--sev-medium)'}>{k.source}</Badge> },
                { key: 'found', header: 'Found', sort: (k) => k.foundDays, render: (k) => (<><div className="t-main">{k.foundDays === 0 ? 'Today' : `${k.foundDays}d ago`}</div><div className="t-sub">stolen {k.stolenDays}d ago</div></>) },
                { key: 'resp', header: 'Response', sort: (k) => k.response, render: (k) => <Badge color={RESP_COLOR[k.response]}>{k.response}</Badge> },
              ]}
            />
          </Card>
          <div className="grid g2">
            <Card title="Where the logins were used" sub="Third-party and corporate applications · click to filter" actions={<span>{apps.length} applications</span>}>
              <HBarList rows={apps.slice(0, 9).map((a) => ({ key: a.key, label: a.key, n: a.n }))} onPick={(k) => setApp(app === k ? 'All' : k)} />
            </Card>
            <Card title="Where the machines were" sub="Infection country · click to filter" actions={<span>{machines.length} machines</span>}>
              <HBarList rows={countries.slice(0, 9).map((a) => ({ key: a.key, label: a.key, sub: `${machCountries.find((m) => m.key === a.key)?.n ?? 0} machines`, n: a.n }))} onPick={(k) => setCountry(country === k ? 'All' : k)} />
            </Card>
          </div>
        </>
      )}

      {view === 'machines' && (
        <>
          <div className="int-filters">
            <div className="int-fgroup">
              <span className="int-flabel">Signal</span>
              <button type="button" className={`int-fchip ${cookies === '1' ? 'on' : ''}`} onClick={() => setCookies(cookies === '1' ? '0' : '1')}>Holding SSO cookies</button>
              {country !== 'All' && <button type="button" className="int-fchip on" onClick={() => setCountry('All')}>Country: {country} ×</button>}
            </div>
          </div>
          <Card title="Stealer-log infected machines" count={`${machRows.length} of ${machines.length}`} sub="Malware family, device, credentials taken, and whether SSO cookies or antivirus were present" flush>
            <DataTable
              rows={machRows}
              rowKey={(m) => m.id}
              onRowClick={setSm}
              search={(m) => `${m.malware} ${m.country} ${m.host} ${m.owner}`}
              searchPlaceholder="Filter machines…"
              initialSort={{ key: 'creds', dir: 'desc' }}
              columns={[
                { key: 'host', header: 'Machine', sort: (m) => m.host, render: (m) => (<div className="int-cell"><span className="int-ico"><Laptop /></span><span><div className="t-main mono">{m.host}</div><div className="t-sub">{m.owner} · {m.managed ? 'Managed device' : 'Personal / unmanaged'}</div></span></div>) },
                { key: 'mal', header: 'Malware', sort: (m) => m.malware, render: (m) => <Dot color={MAL_COLOR[m.malware]}>{m.malware}</Dot> },
                { key: 'country', header: 'Country', sort: (m) => m.country, render: (m) => m.country },
                { key: 'creds', header: 'Credentials', align: 'right', sort: (m) => m.credCount, render: (m) => <b>{m.credCount}</b> },
                { key: 'acc', header: 'Accounts', align: 'right', sort: (m) => m.corpAccounts, render: (m) => m.corpAccounts },
                { key: 'cookie', header: 'SSO cookies', render: (m) => m.ssoCookies ? <Badge color="var(--bad)" dot>Present</Badge> : <span className="muted">No</span> },
                { key: 'av', header: 'Antivirus', render: (m) => m.avPresent ? <span className="muted">Present</span> : <Badge color="var(--sev-medium)">None</Badge> },
                { key: 'cap', header: 'Captured', align: 'right', sort: (m) => m.capturedDays, render: (m) => <span className="muted">{m.capturedDays}d ago</span> },
              ]}
            />
          </Card>
        </>
      )}

      {view === 'idp' && (
        <Card title={`Credential matches to ${idpLabel}`} count={matches.length} sub="Live accounts whose exposed password or session is still valid · worst first" flush>
          <DataTable
            rows={matches}
            rowKey={(m) => m.id}
            initialSort={{ key: 'risk', dir: 'asc' }}
            columns={[
              { key: 'risk', header: 'Risk', sort: (m) => ['critical', 'high', 'medium', 'low', 'info'].indexOf(m.risk), render: (m) => <SevBadge sev={m.risk} /> },
              { key: 'user', header: 'User', render: (m) => (<><div className="t-main">{m.user} {m.privileged && <Badge color="var(--bad)">Privileged</Badge>}</div><div className="t-sub mono">{m.email} · {m.dept}</div></>) },
              { key: 'src', header: 'Source', sort: (m) => m.source, render: (m) => m.source },
              { key: 'pw', header: 'Password', render: (m) => <Badge color={m.password === 'Plaintext' ? 'var(--bad)' : m.password === 'Reused' ? 'var(--sev-medium)' : 'var(--text-muted)'}>{m.password}</Badge> },
              { key: 'cookie', header: 'Session', render: (m) => m.sessionCookie ? <Badge color="var(--bad)" dot>Cookie</Badge> : <span className="muted">—</span> },
              { key: 'mfa', header: 'MFA', sort: (m) => m.mfa, render: (m) => <span style={m.mfa === 'None' ? { color: 'var(--bad)' } : { color: 'var(--text-muted)' }}>{m.mfa}</span> },
              { key: 'act', header: '', render: (m) => <Btn sm danger onClick={() => setReset(m)}>Force reset</Btn> },
            ]}
          />
        </Card>
      )}

      {view === 'vips' && (
        <Card title="Executive & VIP exposure" count={vips.length} sub="Personal breaches, phone, home address, impersonation and deepfake risk · click for detail" flush>
          <DataTable
            rows={vips}
            rowKey={(v) => v.name}
            onRowClick={setVip}
            search={(v) => `${v.name} ${v.role}`}
            searchPlaceholder="Filter VIPs…"
            initialSort={{ key: 'score', dir: 'desc' }}
            columns={[
              { key: 'name', header: 'Executive', render: (v) => (<><div className="t-main">{v.name}</div><div className="t-sub">{v.role}</div></>) },
              { key: 'score', header: 'Risk score', align: 'right', sort: (v) => v.riskScore, render: (v) => <span className="int-vip-score" style={{ color: riskColor(v.riskScore) }}>{v.riskScore}</span> },
              { key: 'br', header: 'Breaches', align: 'right', sort: (v) => v.personalBreaches, render: (v) => v.personalBreaches },
              { key: 'contact', header: 'Contact exposed', render: (v) => (<span className="chips">{v.phoneExposed && <Badge color="var(--sev-medium)">Phone</Badge>}{v.homeAddress && <Badge color="var(--bad)">Home</Badge>}{!v.phoneExposed && !v.homeAddress && <span className="muted">—</span>}</span>) },
              { key: 'imp', header: 'Impersonation', align: 'right', sort: (v) => v.impersonationAccounts, render: (v) => v.impersonationAccounts || <span className="muted">0</span> },
              { key: 'deep', header: 'Deepfake risk', sort: (v) => v.deepfakeRisk, render: (v) => <Badge color={v.deepfakeRisk === 'High' ? 'var(--bad)' : v.deepfakeRisk === 'Medium' ? 'var(--sev-medium)' : 'var(--text-muted)'} dot>{v.deepfakeRisk}</Badge> },
            ]}
          />
        </Card>
      )}

      {cred && (
        <Drawer
          title={cred.account}
          sub={`${cred.usedOn} · ${cred.source}`}
          icon={<span className="int-ico"><KeyRound /></span>}
          onClose={() => setCred(null)}
          footer={<>
            <Btn ghost onClick={() => setCred(null)}>Close</Btn>
            {cred.machineId && <Btn color={tone} onClick={() => { setSm(machines.find((m) => m.id === cred.machineId) ?? null); setCred(null); }}>Open machine</Btn>}
          </>}
        >
          <KV
            rows={[
              ['Account', <span className="mono">{cred.account}</span>],
              ['Privileged', cred.privileged ? <Badge color="var(--bad)">Yes</Badge> : 'No'],
              ['Used on', cred.usedOn],
              ['Application type', cred.appKind],
              ['Password', <Masked />],
              ['Source', cred.source],
              ['Machine', cred.machine ? <span className="mono">{cred.machine}</span> : 'None (credential list)'],
              ['Country', cred.country ?? 'Unknown'],
              ['Stolen', `${cred.stolenDays} days ago`],
              ['Found', `${cred.foundDays} days ago`],
              ['Response', <Badge color={RESP_COLOR[cred.response]}>{cred.response}</Badge>],
              ['Tenant', tenantName(c, cred.tenantId)],
            ]}
          />
          <SectionLabel>Sources</SectionLabel>
          <Sources items={[{ name: cred.source === 'Infostealer' ? 'HexaInt stealer-log collection' : 'HexaInt combolist collection' }, { name: idpLabel }, { name: 'HexaSOC reset workflow' }]} />
        </Drawer>
      )}

      {sm && (
        <Drawer
          wide
          title={`${sm.malware} infection`}
          sub={`${sm.host} · ${sm.country}`}
          icon={<span className="ico-box" style={{ '--tone': MAL_COLOR[sm.malware] } as CSSProperties}><Laptop /></span>}
          onClose={() => setSm(null)}
          footer={<Btn primary color={tone} onClick={() => setSm(null)}>Close</Btn>}
        >
          <KV
            rows={[
              ['Malware family', sm.malware],
              ['Machine', <span className="mono">{sm.host}</span>],
              ['Device', sm.managed ? 'Managed corporate device' : 'Personal or unmanaged device'],
              ['Owner', sm.owner],
              ['Country', sm.country],
              ['Credentials taken', <b>{sm.credCount}</b>],
              ['Corporate accounts', sm.corpAccounts],
              ['SSO cookies', sm.ssoCookies ? <Badge color="var(--bad)" dot>Present: session hijack risk</Badge> : 'None found'],
              ['Antivirus', sm.avPresent ? 'Present (bypassed)' : 'None'],
              ['Captured', `${sm.capturedDays} days ago`],
              ['Tenant', tenantName(c, sm.tenantId)],
            ]}
          />
          <SectionLabel>Credentials from this machine</SectionLabel>
          <div className="card flush" style={{ boxShadow: 'none' }}>
            <DataTable rows={creds.filter((k) => k.machineId === sm.id)} columns={CRED_COLUMNS} pageSize={8} />
          </div>
          <SectionLabel>Recommended</SectionLabel>
          <p className="secondary" style={{ fontSize: 12.5 }}>
            Force password reset and revoke active sessions for the {sm.corpAccounts} matched account{sm.corpAccounts === 1 ? '' : 's'}
            {sm.ssoCookies ? '; SSO cookies present means tokens must be revoked even where MFA is enforced.' : '.'}
            {!sm.managed ? ' The device is unmanaged: block it from corporate access until reimaged.' : ''}
          </p>
          <Sources items={[{ name: 'HexaInt stealer collection' }, { name: idpLabel }, { name: 'HexaSOC' }]} />
        </Drawer>
      )}

      {vip && (
        <Drawer
          wide
          title={vip.name}
          sub={vip.role}
          icon={<span className="ico-box" style={{ '--tone': riskColor(vip.riskScore) } as CSSProperties}><UserRound /></span>}
          onClose={() => setVip(null)}
          footer={<Btn primary color={tone} onClick={() => setVip(null)}>Close</Btn>}
        >
          <div className="row" style={{ gap: 18, alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div className="int-vip-score" style={{ fontSize: 40, color: riskColor(vip.riskScore) }}>{vip.riskScore}</div>
              <div className="stat-label">digital-footprint risk</div>
            </div>
            <p className="secondary" style={{ fontSize: 12.5, flex: 1 }}>{vip.notes}</p>
          </div>
          <KV
            rows={[
              ['Personal email in breaches', `${vip.personalBreaches} breach${vip.personalBreaches > 1 ? 'es' : ''}`],
              ['Phone exposed', vip.phoneExposed ? <Badge color="var(--sev-medium)" dot>Yes</Badge> : 'No'],
              ['Home address', vip.homeAddress ? <Badge color="var(--bad)" dot>Found</Badge> : 'Not found'],
              ['Impersonation accounts', vip.impersonationAccounts],
              ['Deepfake risk', <Badge color={vip.deepfakeRisk === 'High' ? 'var(--bad)' : vip.deepfakeRisk === 'Medium' ? 'var(--sev-medium)' : 'var(--text-muted)'} dot>{vip.deepfakeRisk}</Badge>],
            ]}
          />
          <SectionLabel>Feeds</SectionLabel>
          <Sources items={[{ name: 'HexaInt OSINT' }, { name: 'Breach corpus' }, { name: 'Social monitoring' }]} />
        </Drawer>
      )}

      {drawer === 'accounts' && (
        <RecordsDrawer
          title="Affected accounts"
          sub={`${accounts.length} accounts · ${creds.length} credentials`}
          rows={accounts}
          source={SRC}
          onClose={() => setDrawer(null)}
          columns={[
            { key: 'a', header: 'Account', sort: (a) => a.key, render: (a) => <span className="mono">{a.key}</span> },
            { key: 'p', header: 'Privileged', render: (a) => creds.some((k) => k.account === a.key && k.privileged) ? <Badge color="var(--bad)">Yes</Badge> : <span className="muted">No</span> },
            { key: 'n', header: 'Credentials', align: 'right', sort: (a) => a.n, render: (a) => <b>{a.n}</b> },
          ]}
        />
      )}
      {drawer === 'apps' && (
        <RecordsDrawer
          title="Applications involved"
          sub={`${apps.length} applications where stolen logins were used`}
          rows={apps}
          source={['Saved-login URLs in stealer logs', 'Combolist service tags']}
          onClose={() => setDrawer(null)}
          onRow={(a) => { setDrawer(null); patch({ view: null, app: a.key }); }}
          columns={[
            { key: 'a', header: 'Application', sort: (a) => a.key, render: (a) => a.key },
            { key: 'k', header: 'Type', render: (a) => creds.find((k) => k.usedOn === a.key)?.appKind ?? '' },
            { key: 'n', header: 'Credentials', align: 'right', sort: (a) => a.n, render: (a) => <b>{a.n}</b> },
          ]}
        />
      )}

      {reset && (
        <WriteBack
          title="Force reset + revoke sessions"
          sub={`${reset.user} · ${idpLabel}`}
          risk="high"
          approvers={2}
          confirmLabel="Force reset + revoke"
          onDone={`Password reset forced and sessions revoked for ${reset.user} in ${idpLabel}.`}
          onClose={() => setReset(null)}
          change={[
            ['User', `${reset.user} (${reset.email})`],
            ['Identity provider', idpLabel],
            ['Action', 'Force password reset + revoke all active sessions / refresh tokens'],
            ['Reason', `Credential found in ${reset.source}${reset.sessionCookie ? ' with a live session cookie' : ''}`],
            ['Approvals', '2 approvers (high-risk per LLD 8.2)'],
          ]}
        />
      )}
    </>
  );
}
