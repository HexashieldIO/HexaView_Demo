import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarList, RecordsDrawer, Stat, scrollToId } from '../insurance/viz';
import { effHealth } from '../../data/modules/fabric';
import { UserX, ShieldAlert, Bot, Fingerprint } from 'lucide-react';
import { useApp, rangeDays } from '../../state/AppContext';
import type { Severity } from '../../data/types';
import {
  identitySummary, identitySources, mfaMethods, riskySignins, itdrDetections, serviceAccounts,
  sodConflicts, sodMeta, standingAdminNote, riskyIdentities, connShort, techName,
  type RiskyIdentity, type ItdrDetection,
} from '../../data/modules/fabric';
import { Card, KpiStrip, Badge, Btn, Callout, KV, Chip, SevBadge } from '../../components/ui';
import { Chart, SEV_HEX } from '../../components/Chart';
import { Drawer, Modal } from '../../components/Overlay';
import { DataTable } from '../../components/DataTable';
import { fmtAgo, fmtCompact, fmtNum, fmtPct } from '../../lib/format';
import { TONE, toneStyle } from './parts';
import './fabric.css';

export default function FabricIdentity() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const days = rangeDays(timeRange);
  const sum = useMemo(() => identitySummary(c, tenantId), [c, tenantId]);
  const srcs = useMemo(() => identitySources(c, tenantId), [c, tenantId]);
  const methods = useMemo(() => mfaMethods(c), [c]);
  const signins = useMemo(() => riskySignins(c, tenantId, days), [c, tenantId, days]);
  const itdr = useMemo(() => itdrDetections(c, tenantId, days), [c, tenantId, days]);
  const svc = useMemo(() => serviceAccounts(c, tenantId), [c, tenantId]);
  const sod = useMemo(() => sodConflicts(c, tenantId), [c, tenantId]);
  const sodInfo = sodMeta(c);
  const risky = useMemo(() => riskyIdentities(c, tenantId), [c, tenantId]);
  const [sel, setSel] = useState<RiskyIdentity | null>(null);
  const [det, setDet] = useState<ItdrDetection | null>(null);
  const [revoke, setRevoke] = useState<RiskyIdentity | null>(null);
  type RF = 'all' | 'high' | 'privileged' | 'dormant' | 'vendor' | 'service' | 'nomfa';
  const [params] = useSearchParams();
  const [rf, setRf] = useState<RF>('all');
  const [rec, setRec] = useState<null | 'mfa'>(null);
  useEffect(() => {
    const f = params.get('filter') as RF | null;
    if (f && ['high', 'privileged', 'dormant', 'vendor', 'service', 'nomfa'].includes(f)) { setRf(f); scrollToId('fab-risky'); }
  }, [params]);
  const showRisky = (f: RF) => { setRf(f); scrollToId('fab-risky'); };
  const idSrc = srcs.map(connShort).join(' · ');
  const riskyRows = risky.filter((r) => rf === 'all' || (rf === 'high' ? r.risk === 'high' || r.risk === 'critical' : rf === 'privileged' ? r.privileged : rf === 'dormant' ? r.signals.some((s) => /Dormant/.test(s)) : rf === 'vendor' ? r.kind === 'Guest / vendor' : rf === 'service' ? r.kind === 'Service' : r.mfa === 'None'));

  const phishResistant = methods.filter((m) => m.phish).reduce((s, m) => s + m.pct, 0);

  return (
    <div style={toneStyle()}>
      <p className="page-intro">
        <b>{c.name}</b> · identities unified from {srcs.map(connShort).join(', ')}. <b>{fmtCompact(sum.total)}</b> identities — {fmtCompact(sum.human)} human, {fmtCompact(sum.service)} service. ITDR detections and risky sign-ins are correlated across every identity provider.
      </p>

      <KpiStrip
        toneColor={TONE}
        items={[
          { label: 'Identities', value: fmtCompact(sum.total), hint: `${fmtCompact(sum.service)} service`, toneColor: TONE, onClick: () => showRisky('all'), source: idSrc },
          { label: 'MFA coverage', value: fmtPct(sum.mfaPct, 1), bar: sum.mfaPct, toneColor: sum.mfaPct > 98 ? 'var(--good)' : 'var(--sev-medium)', onClick: () => setRec('mfa'), source: `${idSrc} · authentication methods` },
          { label: 'Phishing-resistant', value: `${phishResistant}%`, bar: phishResistant, toneColor: phishResistant > 60 ? 'var(--good)' : 'var(--sev-medium)', onClick: () => setRec('mfa'), source: `${idSrc} · authentication methods` },
          { label: 'Privileged', value: fmtNum(sum.privileged), hint: `${sum.standing} standing admin`, toneColor: 'var(--sev-medium)', onClick: () => showRisky('privileged'), source: srcs.filter((k) => k.category === 'PAM').map(connShort).join(' · ') || idSrc },
          { label: 'Dormant / stale', value: fmtNum(sum.dormant), toneColor: 'var(--sev-medium)', onClick: () => showRisky('dormant'), source: `${idSrc} · last sign-in` },
          { label: 'Risky now', value: sum.risky, hint: 'high + medium', toneColor: 'var(--sev-high)', onClick: () => showRisky('high'), source: `${idSrc} · HexaInt leaked credentials` },
          ...(sum.sod !== null ? [{ label: 'SoD conflicts', value: sum.sod, hint: sodInfo?.hint ?? 'SailPoint', toneColor: 'var(--bad)', onClick: () => scrollToId('fab-sod'), source: sodInfo?.source ?? 'SailPoint' }] : []),
        ]}
      />

      <div className="grid g3">
        <Card title="MFA methods" sub="Phishing-resistant vs push / SMS">
          <BarList
            labelWidth={150}
            max={Math.max(...methods.map((m) => m.pct))}
            items={methods.map((m) => ({ label: m.method, sub: m.phish ? 'phishing-resistant' : m.method === 'None' ? 'no second factor' : 'phishable', value: m.pct, display: `${m.pct}%`, color: m.phish ? '#2dd4bf' : m.method === 'None' ? SEV_HEX.critical : '#f5a83d', onClick: m.method === 'None' ? () => showRisky('nomfa') : () => setRec('mfa') }))}
          />
        </Card>

        <Card title="Privileged & standing access" sub="Least privilege is the goal">
          <div className="ins-stats" style={{ marginBottom: 12 }}>
            <Stat value={fmtNum(sum.privileged)} label="Privileged accounts" onClick={() => showRisky('privileged')} source={idSrc} />
            <Stat value={sum.standing} label="Standing admin" color="var(--sev-high)" onClick={() => showRisky('privileged')} source={idSrc} />
            <Stat value={fmtNum(sum.guests)} label="Guests / external" onClick={() => showRisky('vendor')} source={idSrc} />
            <Stat value={sum.oldSecrets} label="Service secrets > 1 yr" color="var(--sev-medium)" onClick={() => scrollToId('fab-svc')} source={idSrc} />
          </div>
          <Callout kind="warn"><b>{sum.standing} standing admin accounts</b> should move to just-in-time elevation. {standingAdminNote(c)}</Callout>
        </Card>

        <Card title="Risky sign-ins over time" sub={`High / medium / low · ${timeRange}`}>
          <Chart height={210} option={{
            tooltip: { trigger: 'axis' },
            legend: { top: 0, data: ['High', 'Medium', 'Low'] },
            grid: { left: 8, right: 12, top: 30, bottom: 6, containLabel: true },
            xAxis: { type: 'category', data: signins.labels, boundaryGap: false, axisLabel: { show: days > 1 } },
            yAxis: { type: 'value', minInterval: 1 },
            series: [
              { name: 'High', type: 'line', stack: 'x', areaStyle: { color: 'rgba(242,100,63,.3)' }, data: signins.high, symbol: 'none', lineStyle: { color: SEV_HEX.high }, itemStyle: { color: SEV_HEX.high } },
              { name: 'Medium', type: 'line', stack: 'x', areaStyle: { color: 'rgba(240,163,56,.24)' }, data: signins.medium, symbol: 'none', lineStyle: { color: SEV_HEX.medium }, itemStyle: { color: SEV_HEX.medium } },
              { name: 'Low', type: 'line', stack: 'x', areaStyle: { color: 'rgba(226,199,63,.18)' }, data: signins.low, symbol: 'none', lineStyle: { color: SEV_HEX.low }, itemStyle: { color: SEV_HEX.low } },
            ],
          }} />
        </Card>
      </div>

      <div className="grid g-3-2">
        <Card title="ITDR detections" count={itdr.length} sub="Identity threat detection & response, correlated across providers" flush>
          <div className="list" style={{ padding: '0 18px 8px' }}>
            {itdr.map((d) => (
              <button key={d.id} className="list-row" onClick={() => setDet(d)}>
                <ShieldAlert size={15} style={{ color: SEV_HEX[d.sev] }} />
                <span className="list-main"><b>{d.title}</b><span>{d.user} · {d.source} · {d.technique} {techName(d.technique)}</span></span>
                <span className="stack" style={{ alignItems: 'flex-end', gap: 3 }}><SevBadge sev={d.sev} /><span className="muted" style={{ fontSize: 10.5 }}>{fmtAgo(d.ageMin)}</span></span>
              </button>
            ))}
          </div>
        </Card>

        <Card title={<><Bot size={15} style={{ verticalAlign: -2, color: 'var(--m-core)' }} /> <span id="fab-svc">Service accounts with old secrets</span></>} sub="Non-interactive identities — a common blind spot" flush>
          <DataTable
            rows={svc}
            rowKey={(s) => s.name}
            initialSort={{ key: 'age', dir: 'desc' }}
            pageSize={8}
            columns={[
              { key: 'name', header: 'Account', sort: (s) => s.name, render: (s) => (<><div className="t-main mono">{s.name}</div><div className="t-sub">{s.system} · {s.source}</div></>) },
              { key: 'age', header: 'Secret age', align: 'right', sort: (s) => s.secretAgeDays, render: (s) => <span style={{ color: s.secretAgeDays > 365 ? 'var(--bad)' : s.secretAgeDays > 180 ? 'var(--warn)' : undefined, fontWeight: s.secretAgeDays > 365 ? 700 : 400 }}>{s.secretAgeDays} d</span> },
              { key: 'vault', header: 'Vaulted', sort: (s) => Number(s.vaulted), render: (s) => <Badge color={s.vaulted ? 'var(--good)' : 'var(--sev-high)'} dot>{s.vaulted ? 'Vaulted' : 'Not vaulted'}</Badge> },
              { key: 'priv', header: 'Priv', render: (s) => s.privileged ? <Badge color="var(--sev-medium)">Privileged</Badge> : <span className="muted">—</span> },
              { key: 'owner', header: 'Owner', render: (s) => s.owner ?? <Badge color="var(--sev-medium)">Unknown</Badge> },
            ]}
          />
        </Card>
      </div>

      {sod.length > 0 && (
        <Card title={<><Fingerprint size={15} style={{ verticalAlign: -2, color: 'var(--m-core)' }} /> <span id="fab-sod">Segregation-of-duties conflicts</span></>} sub={sodInfo?.sub ?? 'Toxic entitlement combinations'} flush>
          <DataTable
            rows={sod}
            rowKey={(s) => s.rule}
            initialSort={{ key: 'users', dir: 'desc' }}
            columns={[
              { key: 'rule', header: 'Conflict', sort: (s) => s.rule, render: (s) => (<><div className="t-main">{s.rule}</div><div className="t-sub">{s.process}</div></>) },
              { key: 'users', header: 'Users', align: 'right', sort: (s) => s.users, render: (s) => <span className="num" style={{ fontWeight: 700, color: 'var(--bad)' }}>{s.users}</span> },
              { key: 'regime', header: 'Regime', render: (s) => <span className="t-sub">{s.regime}</span> },
              { key: 'src', header: 'Source', render: (s) => s.source },
            ]}
          />
        </Card>
      )}

      <Card title={<span id="fab-risky">Risky identities</span>} count={riskyRows.length} sub="Humans, service accounts and vendor guests ranked by risk · click for signals" flush>
        <div className="row wrap" style={{ gap: 8, padding: '0 18px 10px' }}>
          {([['all', 'All'], ['high', 'High risk'], ['privileged', 'Privileged'], ['dormant', 'Dormant'], ['vendor', 'Vendors'], ['service', 'Service'], ['nomfa', 'No MFA']] as [RF, string][]).map(([k, l]) => <Chip key={k} on={rf === k} onClick={() => setRf(k)} color={TONE}>{l}</Chip>)}
        </div>
        <DataTable
          rows={riskyRows}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSel(r)}
          search={(r) => `${r.name} ${r.upn} ${r.role} ${r.kind}`}
          searchPlaceholder="Search identities…"
          initialSort={{ key: 'risk', dir: 'desc' }}
          pageSize={12}
          columns={[
            { key: 'name', header: 'Identity', sort: (r) => r.name, render: (r) => (<><div className="t-main">{r.name}</div><div className="t-sub">{r.upn}</div></>) },
            { key: 'kind', header: 'Type', sort: (r) => r.kind, render: (r) => <Badge color={r.kind === 'Human' ? 'var(--m-matrix)' : r.kind === 'Service' ? 'var(--m-ai)' : 'var(--sev-medium)'}>{r.kind}</Badge> },
            { key: 'tenant', header: 'Tenant', render: (r) => <span className="t-sub">{r.tenantShort}</span> },
            { key: 'mfa', header: 'MFA', render: (r) => <Badge color={r.mfa === 'None' ? 'var(--sev-critical)' : r.mfa.includes('FIDO') || r.mfa.includes('Hello') || r.mfa.includes('Passkey') || r.mfa.includes('FastPass') ? 'var(--good)' : 'var(--sev-medium)'}>{r.mfa.split(' (')[0]}</Badge> },
            { key: 'priv', header: 'Priv', render: (r) => r.privileged ? <Badge color="var(--sev-medium)">Yes</Badge> : <span className="muted">—</span> },
            { key: 'signals', header: 'Signals', render: (r) => <span className="chips">{r.signals.slice(0, 2).map((s) => <Chip key={s}>{s}</Chip>)}{r.signals.length > 2 && <Chip>+{r.signals.length - 2}</Chip>}</span> },
            { key: 'risk', header: 'Risk', sort: (r) => ({ critical: 4, high: 3, medium: 2, low: 1, info: 0 } as Record<Severity, number>)[r.risk], render: (r) => <SevBadge sev={r.risk} /> },
          ]}
        />
      </Card>

      {rec === 'mfa' && (
        <RecordsDrawer title="Authentication methods" sub={`MFA coverage ${fmtPct(sum.mfaPct, 1)} · phishing-resistant ${phishResistant}%`} sources={srcs.map((k) => ({ name: connShort(k), status: effHealth(k) }))} onClose={() => setRec(null)}
          rows={methods.map((m) => ({ key: m.method, title: m.method, sub: `≈ ${fmtCompact(Math.round((sum.human * m.pct) / 100))} people`, right: `${m.pct}%`, badge: <Badge color={m.phish ? 'var(--good)' : m.method === 'None' ? 'var(--bad)' : 'var(--sev-medium)'}>{m.phish ? 'Phishing-resistant' : m.method === 'None' ? 'None' : 'Phishable'}</Badge>, onClick: m.method === 'None' ? () => { setRec(null); showRisky('nomfa'); } : undefined }))} />
      )}
      {det && (
        <Drawer onClose={() => setDet(null)} title={det.title} sub={`${det.technique} · ${techName(det.technique)}`}
          icon={<span className="ico-box" style={{ '--tone': SEV_HEX[det.sev] } as React.CSSProperties}><ShieldAlert /></span>}>
          <div className="row" style={{ gap: 8 }}><SevBadge sev={det.sev} solid /><Badge>{det.source}</Badge><span className="muted">{fmtAgo(det.ageMin)}</span></div>
          <KV rows={[['Identity', det.user], ['Technique', `${det.technique} · ${techName(det.technique)}`], ['Source', det.source], ['Detail', det.detail]]} />
          <Callout kind="info">Correlated into HexaCore from the identity providers; the SOC sees it alongside EDR and network context in HexaSOC.</Callout>
        </Drawer>
      )}

      {sel && (
        <Drawer onClose={() => setSel(null)} title={sel.name} sub={sel.role}
          icon={<span className="ico-box" style={{ '--tone': SEV_HEX[sel.risk] } as React.CSSProperties}>{sel.kind === 'Service' ? <Bot /> : sel.kind === 'Human' ? <Fingerprint /> : <UserX />}</span>}
          footer={<Btn primary danger onClick={() => { setRevoke(sel); }}>Revoke sessions</Btn>}>
          <div className="row" style={{ gap: 8 }}><SevBadge sev={sel.risk} solid /><Badge color={sel.kind === 'Human' ? 'var(--m-matrix)' : sel.kind === 'Service' ? 'var(--m-ai)' : 'var(--sev-medium)'}>{sel.kind}</Badge>{sel.privileged && <Badge color="var(--sev-medium)">Privileged</Badge>}</div>
          <KV rows={[
            ['UPN', <span className="mono">{sel.upn}</span>],
            ['Tenant', sel.tenantShort],
            ['Role / access', sel.role],
            ['MFA', sel.mfa],
            ['Last sign-in', fmtAgo(sel.lastSignInMin)],
            ['Sources', sel.sources.join(', ')],
          ]} />
          <div>
            <div className="section-label">Risk signals</div>
            <div className="chips">{sel.signals.map((s) => <Badge key={s} color="var(--sev-medium)">{s}</Badge>)}</div>
          </div>
        </Drawer>
      )}

      {revoke && (
        <Modal title="Revoke sessions" sub={revoke.name} onClose={() => setRevoke(null)}
          footer={<><Btn onClick={() => setRevoke(null)}>Cancel</Btn><Btn primary danger onClick={() => { toast(`Revoke-sessions intent raised for ${revoke.name} — awaiting 2 approvals (incl. Tenant Admin)`); setRevoke(null); setSel(null); }}>Raise for approval</Btn></>}>
          <Callout kind="warn"><b>High-risk action (LLD 8.2).</b> Revoking sessions requires <b>two approvers</b> other than the requester, at least one holding the Tenant Admin role. The signed intent is applied through {revoke.sources[0] ?? 'the identity provider'}; it is logged in the tamper-evident audit ledger.</Callout>
          <KV rows={[
            ['Target', `${revoke.name} (${revoke.upn})`],
            ['Action', <span className="mono">{revoke.sources[0]?.includes('Okta') ? 'okta.clear_user_sessions' : 'entra.revoke_sessions'}</span>],
            ['Effect', 'All active tokens and refresh tokens invalidated; user must re-authenticate with MFA'],
            ['Risk class', <Badge color="var(--bad)">High</Badge>],
            ['Approvals', '2 required · incl. Tenant Admin · expires in 4 h'],
            ['Requested by', c.people.socLead.name],
          ]} />
        </Modal>
      )}
    </div>
  );
}
