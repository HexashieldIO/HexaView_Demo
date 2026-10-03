import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RingLegend, SegRows, scrollToId } from '../insurance/viz';
import { ShieldAlert, Ticket } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import type { Severity } from '../../data/types';
import {
  exposureSummary, vulnRows, vulnSources, ENV_LABEL, connShort,
  type VulnRow,
} from '../../data/modules/fabric';
import { byCat } from '../../data/modules/fabric';
import { scopedConnectors } from '../../data/customers';
import { Card, KpiStrip, Badge, Btn, Callout, KV, Chip, SevBadge, Sources } from '../../components/ui';
import { Chart, SEV_HEX } from '../../components/Chart';
import { Drawer, Modal } from '../../components/Overlay';
import { DataTable } from '../../components/DataTable';
import { fmtCompact, fmtNum } from '../../lib/format';
import { TONE, EnvBadge, EnvDot, toneStyle } from './parts';
import './fabric.css';

export default function FabricExposure() {
  const { customer: c, tenantId, toast } = useApp();
  const sum = useMemo(() => exposureSummary(c, tenantId), [c, tenantId]);
  const rows = useMemo(() => vulnRows(c, tenantId), [c, tenantId]);
  const srcs = useMemo(() => vulnSources(c, tenantId), [c, tenantId]);
  const itsm = byCat(scopedConnectors(c, tenantId), 'ITSM')[0];
  const ticketTarget = itsm?.vendor === 'Atlassian' ? 'Jira' : 'ServiceNow';
  const [sel, setSel] = useState<VulnRow | null>(null);
  const [ticket, setTicket] = useState<VulnRow | null>(null);
  const [params] = useSearchParams();
  const [sevF, setSevF] = useState<Severity | 'all' | 'kev'>('all');
  const [extra, setExtra] = useState<null | 'overdue' | 'internet' | 'epss' | 'ot' | 'cloud' | 'onprem' | 'saas'>(null);
  useEffect(() => {
    const s = params.get('sev');
    setSevF(s && ['critical', 'high', 'medium', 'low', 'kev'].includes(s) ? (s as Severity | 'kev') : 'all');
    const f = params.get('filter');
    setExtra(f && ['overdue', 'internet', 'epss', 'ot', 'cloud', 'onprem', 'saas'].includes(f) ? (f as 'overdue') : null);
    if (s || f) scrollToId('fab-vulns');
  }, [params]);
  const pick = (s: Severity | 'all' | 'kev', x: typeof extra = null) => { setSevF(s); setExtra(x); scrollToId('fab-vulns'); };
  const srcNames = srcs.slice(0, 5).map(connShort).join(' · ');

  const shown = rows.filter((v) => (sevF === 'all' ? true : sevF === 'kev' ? v.cve.kev : v.sev === sevF) && (extra === null || (extra === 'overdue' ? v.overdue : extra === 'internet' ? v.internetFacing : extra === 'epss' ? v.cve.epss > 0.5 : v.env === extra)));

  return (
    <div style={toneStyle()}>
      <p className="page-intro">
        <b>{c.name}</b> · vulnerabilities de-duplicated across {srcs.length} scanners, EDR and cloud tools ({srcs.slice(0, 3).map(connShort).join(', ')}{srcs.length > 3 ? '…' : ''}). {fmtCompact(sum.raw)} raw findings resolve to <b>{fmtNum(sum.unique)}</b> unique issues, ranked by KEV, EPSS, asset criticality and age.
      </p>

      <KpiStrip
        toneColor={TONE}
        items={[
          { label: 'Unique vulns', value: fmtCompact(sum.unique), hint: `${fmtCompact(sum.raw)} raw`, toneColor: TONE, onClick: () => pick('all'), source: srcNames },
          { label: 'Critical', value: sum.bySev.critical, toneColor: 'var(--sev-critical)', delta: { text: `${sum.bySev.high} high`, good: false }, onClick: () => pick('critical'), source: srcNames },
          { label: 'KEV-listed', value: sum.kev, hint: 'known exploited', toneColor: 'var(--sev-high)', onClick: () => pick('kev'), source: `CISA KEV × ${srcNames}` },
          { label: 'EPSS > 50%', value: sum.epssHigh, hint: 'likely exploited', toneColor: 'var(--sev-medium)', onClick: () => pick('all', 'epss'), source: `FIRST EPSS × ${srcNames}` },
          { label: 'Past SLA', value: fmtNum(sum.overdue), toneColor: 'var(--bad)', onClick: () => pick('all', 'overdue'), source: `${srcNames} · SLA policy` },
          { label: 'Internet-facing', value: sum.internet, hint: 'edge assets', toneColor: 'var(--sev-high)', onClick: () => pick('all', 'internet'), source: 'HexaStrike ASM × scanners' },
          { label: 'Mean time to fix', value: `${sum.mttrDays} d`, toneColor: 'var(--m-core)', onClick: () => scrollToId('fab-burn'), source: `${ticketTarget} ticket close times` },
        ]}
      />

      <div className="grid g3">
        <Card title="By severity" sub="De-duplicated across all sources">
          <RingLegend
            value={sum.bySev.critical + sum.bySev.high}
            max={Math.max(1, sum.unique)}
            color={SEV_HEX.high}
            center={fmtCompact(sum.unique)}
            centerSub="unique"
            size={112}
            rows={(['critical', 'high', 'medium', 'low'] as Severity[]).map((s) => ({ label: s[0].toUpperCase() + s.slice(1), value: fmtNum(sum.bySev[s]), color: SEV_HEX[s], onClick: () => pick(s) }))}
          />
        </Card>
        <Card title="By environment" sub="Severity split per environment">
          <SegRows
            legend
            labelWidth={70}
            format={(v) => fmtCompact(v)}
            rows={sum.byEnv.map((e) => ({ label: ENV_LABEL[e.env], onClick: () => pick('all', e.env), parts: (['critical', 'high', 'medium', 'low'] as Severity[]).map((s) => ({ label: s[0].toUpperCase() + s.slice(1), value: e.sev[s], color: SEV_HEX[s] })) }))}
          />
        </Card>
        <Card title="SLA ageing" sub="Open vulns by age and severity — red is past SLA">
          <SegRows
            legend
            labelWidth={62}
            format={(v) => fmtCompact(v)}
            rows={sum.ageing.map((a) => ({ label: a.bucket, onClick: () => pick('all', 'overdue'), parts: (['critical', 'high', 'medium', 'low'] as Severity[]).map((s) => ({ label: s[0].toUpperCase() + s.slice(1), value: a.sev[s], color: SEV_HEX[s] })) }))}
          />
        </Card>
      </div>

      <div className="grid g-3-2">
        <Card title={<span id="fab-burn">Remediation burn-down</span>} sub="Open vulnerabilities, newly opened and closed per week (12 weeks)">
          <Chart height={240} option={{
            tooltip: { trigger: 'axis' },
            legend: { top: 0, data: ['Open (end of week)', 'Opened', 'Closed'] },
            grid: { left: 8, right: 14, top: 34, bottom: 6, containLabel: true },
            xAxis: { type: 'category', data: sum.burn.labels },
            yAxis: [{ type: 'value', name: 'open' }, { type: 'value', name: 'flow', position: 'right' }],
            series: [
              { name: 'Open (end of week)', type: 'line', data: sum.burn.open, smooth: true, symbol: 'none', lineStyle: { color: '#4f8cff', width: 2.4 }, areaStyle: { color: 'rgba(79,140,255,.16)' } },
              { name: 'Opened', type: 'bar', yAxisIndex: 1, data: sum.burn.opened, itemStyle: { color: SEV_HEX.high }, barMaxWidth: 12 },
              { name: 'Closed', type: 'bar', yAxisIndex: 1, data: sum.burn.closed.map((x) => -x), itemStyle: { color: '#2dd4bf' }, barMaxWidth: 12 },
            ],
          }} />
        </Card>
        <Card title="Top risky assets" sub="Most exposed, weighted by severity and criticality">
          <div className="list">
            {[...rows].sort((a, b) => b.affected * (b.cve.kev ? 2 : 1) - a.affected * (a.cve.kev ? 2 : 1)).slice(0, 7).map((v) => (
              <button key={v.id} className="list-row" onClick={() => setSel(v)}>
                <EnvDot env={v.env} />
                <span className="list-main"><b>{v.assets[0] ?? v.cve.product}</b><span>{v.cve.id} · {v.affected} affected · {v.sources.join(', ')}</span></span>
                <span className="stack" style={{ alignItems: 'flex-end', gap: 3 }}><SevBadge sev={v.sev} />{v.cve.kev && <Badge color="var(--sev-high)">KEV</Badge>}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card title={<span id="fab-vulns">Vulnerabilities</span>} count={shown.length} sub="Aggregated and de-duplicated across your tools · click for detail and remediation" flush>
        <div className="row wrap" style={{ gap: 8, padding: '0 18px 2px' }}>
          {extra && <Chip on onClick={() => setExtra(null)} color={TONE}>{extra === 'overdue' ? 'Past SLA' : extra === 'internet' ? 'Internet-facing' : extra === 'epss' ? 'EPSS > 50%' : ENV_LABEL[extra]} ×</Chip>}
          <Chip on={sevF === 'all'} onClick={() => setSevF('all')} color={TONE}>All</Chip>
          <Chip on={sevF === 'kev'} onClick={() => setSevF('kev')} color="var(--sev-high)">KEV only</Chip>
          {(['critical', 'high', 'medium', 'low'] as Severity[]).map((s) => <Chip key={s} on={sevF === s} onClick={() => setSevF(s)} color={SEV_HEX[s]}>{s[0].toUpperCase() + s.slice(1)}</Chip>)}
        </div>
        <DataTable
          rows={shown}
          rowKey={(v) => v.id}
          onRowClick={(v) => setSel(v)}
          search={(v) => `${v.cve.id} ${v.cve.product} ${v.cve.title} ${v.tenantShort}`}
          searchPlaceholder="Search CVE, product…"
          initialSort={{ key: 'risk', dir: 'desc' }}
          pageSize={14}
          columns={[
            { key: 'cve', header: 'CVE', sort: (v) => v.cve.id, render: (v) => (<><div className="t-main">{v.cve.id}{v.cve.kev && <Badge color="var(--sev-high)">KEV</Badge>}{v.internetFacing && <Badge color="var(--m-core)">Internet</Badge>}</div><div className="t-sub">{v.cve.product} — {v.cve.title}</div></>) },
            { key: 'env', header: 'Env', sort: (v) => v.env, render: (v) => <EnvBadge env={v.env} /> },
            { key: 'sev', header: 'Severity', sort: (v) => v.cve.cvss, render: (v) => <span className="stack" style={{ gap: 2 }}><SevBadge sev={v.sev} /><span className="t-sub">CVSS {v.cve.cvss.toFixed(1)}</span></span> },
            { key: 'epss', header: 'EPSS', align: 'right', sort: (v) => v.cve.epss, render: (v) => <span className="num" style={{ color: v.cve.epss > 0.5 ? 'var(--sev-high)' : undefined }}>{Math.round(v.cve.epss * 100)}%</span> },
            { key: 'aff', header: 'Affected', align: 'right', sort: (v) => v.affected, render: (v) => <span className="num">{fmtNum(v.affected)}</span> },
            { key: 'src', header: 'Sources', render: (v) => <span className="muted" style={{ fontSize: 11 }}>{v.sources.join(', ')}</span> },
            { key: 'age', header: 'Oldest', align: 'right', sort: (v) => v.oldestDays, render: (v) => <span style={{ color: v.overdue ? 'var(--bad)' : undefined, fontWeight: v.overdue ? 700 : 400 }}>{v.oldestDays} d{v.overdue ? ' · SLA' : ''}</span> },
            { key: 'status', header: 'Status', sort: (v) => v.status, render: (v) => <Badge color={v.status === 'Open' ? 'var(--sev-high)' : v.status === 'Risk accepted' ? 'var(--sev-info)' : 'var(--m-matrix)'}>{v.status}</Badge> },
            { key: 'risk', header: '', render: (v) => v.env !== 'ot' && (v.sev === 'low' || v.sev === 'medium') && v.status === 'Open' ? <Btn sm onClick={(() => { setTicket(v); }) as unknown as () => void}><Ticket size={12} /> Ticket</Btn> : null },
          ]}
        />
      </Card>

      {sel && (
        <Drawer wide onClose={() => setSel(null)} title={sel.cve.id} sub={sel.cve.product}
          icon={<span className="ico-box" style={{ '--tone': SEV_HEX[sel.sev] } as React.CSSProperties}><ShieldAlert /></span>}
          footer={sel.env === 'ot' ? <Badge color="var(--m-ot)">OT target · remediation via maintenance window only, no remote action</Badge> : (sel.sev === 'low' || sel.sev === 'medium') && sel.status === 'Open' ? <Btn primary color={TONE} onClick={() => { setTicket(sel); setSel(null); }}><Ticket size={14} /> Create ticket in {ticketTarget}</Btn> : <Badge>{sel.status}</Badge>}>
          <div className="fab-kvgrid">
            <div><b style={{ color: SEV_HEX[sel.sev] }}>{sel.cve.cvss.toFixed(1)}</b><span>CVSS</span></div>
            <div><b style={{ color: sel.cve.epss > 0.5 ? 'var(--sev-high)' : undefined }}>{Math.round(sel.cve.epss * 100)}%</b><span>EPSS</span></div>
            <div><b style={{ color: sel.cve.kev ? 'var(--sev-high)' : undefined }}>{sel.cve.kev ? 'Yes' : 'No'}</b><span>In CISA KEV</span></div>
            <div><b style={{ color: sel.overdue ? 'var(--bad)' : undefined }}>{sel.oldestDays} d</b><span>Oldest / SLA {sel.slaDays} d</span></div>
          </div>
          {sel.cve.kev && <Callout kind="warn"><b>Known exploited.</b> Listed in CISA KEV with EPSS {Math.round(sel.cve.epss * 100)}% — prioritise ahead of CVSS alone.</Callout>}
          <KV rows={[
            ['Title', sel.cve.title],
            ['Environment', <EnvBadge env={sel.env} />],
            ['Tenant', sel.tenantShort],
            ['Affected assets', `${fmtNum(sel.affected)} (${fmtNum(sel.rawFindings)} raw findings de-duplicated)`],
            ['Seen by', <Sources items={sel.sources.map((s) => ({ name: s }))} />],
            ['Owner', sel.owner],
            ['Status', sel.ticket ? `${sel.status} · ${sel.ticket}` : sel.status],
            ['Remediation', sel.fix],
          ]} />
          <div>
            <div className="section-label">Example affected assets</div>
            <div className="chips">{sel.assets.map((a) => <Chip key={a}>{a}</Chip>)}</div>
          </div>
        </Drawer>
      )}

      {ticket && (
        <Modal title={`Create ticket in ${ticketTarget}`} sub={`${ticket.cve.id} on ${ticket.affected} assets`} onClose={() => setTicket(null)}
          footer={<><Btn onClick={() => setTicket(null)}>Cancel</Btn><Btn primary color={TONE} onClick={() => { toast(`Ticket created in ${ticketTarget} for ${ticket.cve.id} — assigned to ${ticket.owner}`); setTicket(null); }}>Create ticket</Btn></>}>
          <Callout kind="info"><b>Low-risk write-back.</b> Creating a ticket is a low-risk action (LLD 8.2): one approver, no change to the target system. The intent is signed and applied through {ticketTarget}.</Callout>
          <KV rows={[
            ['Summary', `Remediate ${ticket.cve.id} (${ticket.cve.product})`],
            ['Severity', <SevBadge sev={ticket.sev} />],
            ['Assets', `${ticket.affected} (${ticket.assets.slice(0, 3).join(', ')}${ticket.affected > 3 ? '…' : ''})`],
            ['Assignee', ticket.owner],
            ['Due', `${ticket.slaDays} days (SLA)`],
            ['Action', <span className="mono">servicenow.create_ticket</span>],
          ]} />
        </Modal>
      )}
    </div>
  );
}
