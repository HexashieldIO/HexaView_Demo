import { useMemo, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { tenantName } from '../../data/customers';
import { surfaceHosts, tally, OWNERSHIP, connectorOf, type SurfaceHost, type SurfaceCve } from '../../data/modules/int';
import { Card, KpiStrip, Badge, SevBadge, Btn, KV, SectionLabel, Sources, Freshness, SEV_COLOR, cap } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import type { Severity } from '../../data/types';
import { HBarList, FilterGroup, useParamFilter, WriteBack } from './parts';
import './int.css';

const tone = MODULE_BY_ID.int.tone;
const SEVS = ['Critical', 'High', 'Medium', 'Low'] as const;
const SEV_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

function epssColor(p: number): string {
  return p >= 60 ? 'var(--bad)' : p >= 30 ? 'var(--sev-high)' : p >= 10 ? 'var(--sev-medium)' : 'var(--m-int)';
}

export default function IntSurface() {
  const { customer: c, tenantId } = useApp();
  const hosts = useMemo(() => surfaceHosts(c, tenantId), [c, tenantId]);
  const [sev, setSev] = useParamFilter('sev');
  const [own, setOwn] = useParamFilter('own');
  const [kev, setKev] = useParamFilter('kev', '0');
  const [svc, setSvc] = useParamFilter('svc');
  const [clean, setClean] = useParamFilter('clean', '0');
  const [sel, setSel] = useState<SurfaceHost | null>(null);
  const [ticket, setTicket] = useState<SurfaceHost | null>(null);

  const itsm = connectorOf(c, 'ITSM');
  const allCves = hosts.flatMap((h) => h.cves);
  const patchFirst = [...allCves].sort((a, b) => b.epss - a.epss).slice(0, 5);
  const ports = hosts.flatMap((h) => h.ports);
  const services = tally(ports, (p) => p.svc);
  const crit = allCves.filter((v) => v.sev === 'critical').length;
  const kevCount = allCves.filter((v) => v.kev).length;
  const unmanaged = hosts.filter((h) => h.ownership === 'Unmanaged — owner unknown').length;
  const cleanHosts = hosts.filter((h) => h.cves.length === 0).length;
  const sevLower = sev.toLowerCase() as Severity;

  const rows = hosts
    .filter((h) => sev === 'All' || h.cves.some((v) => v.sev === sevLower))
    .filter((h) => own === 'All' || h.ownership === own)
    .filter((h) => kev !== '1' || h.kev)
    .filter((h) => svc === 'All' || h.ports.some((p) => p.svc === svc))
    .filter((h) => clean !== '1' || h.cves.length === 0)
    .sort((a, b) => b.epss - a.epss);

  const hostOf = (v: SurfaceCve) => hosts.find((h) => h.host === v.host) ?? null;

  return (
    <>
      <p className="page-intro">
        Everything about <b>{c.name}</b> · {tenantName(c, tenantId)} that is reachable from the internet, discovered by HexaInt&rsquo;s own scanner and enriched with vulnerability data from NVD and exploit probability from FIRST EPSS. {hosts.length} hosts across {new Set(hosts.map((h) => h.location)).size} hosting locations.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Hosts', hint: 'internet-facing', value: hosts.length, unit: 'hosts', to: '/int/surface', source: 'HexaInt external scanner' },
          { label: 'Open ports', hint: 'reachable', value: ports.length, unit: 'ports', to: '/int/surface', source: 'HexaInt external scanner' },
          { label: 'Critical', hint: 'findings', value: crit, unit: 'to fix', toneColor: 'var(--sev-critical)', to: '/int/surface?sev=Critical', source: 'HexaInt scanner · NVD CVSS' },
          { label: 'Exploited', hint: 'on CISA KEV', value: kevCount, unit: 'listed', toneColor: 'var(--bad)', to: '/int/surface?kev=1', source: 'CISA Known Exploited Vulnerabilities' },
          { label: 'No owner', hint: 'unmanaged', value: unmanaged, unit: 'hosts', toneColor: 'var(--sev-medium)', to: `/int/surface?own=${encodeURIComponent('Unmanaged — owner unknown')}`, source: itsm ? `${itsm.vendor} ${itsm.product} CMDB` : 'CMDB' },
          { label: 'Clean', hint: 'no findings', value: cleanHosts, unit: 'hosts', toneColor: 'var(--good)', to: '/int/surface?clean=1', source: 'HexaInt external scanner' },
        ]}
      />

      <div className="grid g2">
        <Card title="Exposed services" sub="Open ports by service · click to filter the hosts" actions={<span>open ports by service</span>}>
          <HBarList rows={services.map((s) => ({ key: s.key, label: s.key, n: s.n }))} onPick={(k) => setSvc(svc === k ? 'All' : k)} />
        </Card>
        <Card title="Patch these first" sub="Highest exploit probability (EPSS) · click for the host" actions={<Freshness minutes={38} label="last sweep" />}>
          <div>
            {patchFirst.map((v) => (
              <button key={v.id} className="int-cve" onClick={() => setSel(hostOf(v))}>
                <span>
                  <b>{v.id} · {v.title}</b>
                  <small className="mono">{v.host} · CVSS {v.cvss.toFixed(1)} · EPSS {v.epss}%</small>
                </span>
                <span className="chips" style={{ flexShrink: 0, alignSelf: 'center' }}>
                  {v.kev && <Badge color="var(--bad)" solid>KEV</Badge>}
                  <SevBadge sev={v.sev} />
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="int-filters">
        <FilterGroup label="Severity" value={sev} options={SEVS} onChange={setSev} />
        <FilterGroup label="Ownership" value={own} options={OWNERSHIP} onChange={setOwn} />
        <div className="int-fgroup">
          <span className="int-flabel">Exploited</span>
          <button type="button" className={`int-fchip ${kev === '1' ? 'on' : ''}`} onClick={() => setKev(kev === '1' ? '0' : '1')}>On the KEV list</button>
          {svc !== 'All' && <button type="button" className="int-fchip on" onClick={() => setSvc('All')}>Service: {svc} ×</button>}
          {clean === '1' && <button type="button" className="int-fchip on" onClick={() => setClean('0')}>Clean only ×</button>}
        </div>
      </div>

      <Card title="Internet-facing hosts" count={`${rows.length} of ${hosts.length}`} sub="Sorted by exploit likelihood · click a host for its findings and owner" flush>
        <DataTable
          rows={rows}
          rowKey={(h) => h.id}
          onRowClick={setSel}
          search={(h) => `${h.host} ${h.ip} ${h.ports.map((p) => `${p.port}/${p.svc}`).join(' ')} ${h.location}`}
          searchPlaceholder="Search host, IP, service…"
          pageSize={20}
          columns={[
            { key: 'host', header: 'Host', sort: (h) => h.host, render: (h) => (<div className="int-cell"><span className="int-ico"><Globe2 /></span><span><div className="t-main mono">{h.host}</div><div className="t-sub">{h.ip} · {h.location}</div></span></div>) },
            { key: 'ports', header: 'Open ports', align: 'right', sort: (h) => h.ports.length, render: (h) => <b>{h.ports.length}</b> },
            { key: 'svc', header: 'Services', render: (h) => <span className="chips">{h.ports.map((p) => <span key={p.port} className="int-port">{p.port}/{p.svc}</span>)}</span> },
            { key: 'find', header: 'Findings', sort: (h) => (h.worst ? 10 - SEV_RANK[h.worst] : 0) * 10 + h.cves.length, render: (h) => h.worst ? (<span className="chips"><Badge color={SEV_COLOR[h.worst]}>{h.cves.length} · {cap(h.worst)}</Badge>{h.kev && <Badge color="var(--bad)" solid>KEV</Badge>}</span>) : <Badge color="var(--good)">None</Badge> },
            { key: 'epss', header: 'Exploit likelihood', sort: (h) => h.epss, render: (h) => h.cves.length ? (<span className="int-epss"><span className="int-hbar-t"><i style={{ width: `${Math.max(3, h.epss)}%`, background: epssColor(h.epss) }} /></span><b>{h.epss}%</b></span>) : <span className="muted">—</span> },
            { key: 'own', header: 'Ownership', sort: (h) => h.ownership, render: (h) => <span style={{ color: h.ownership === 'Confirmed' ? 'var(--text-secondary)' : 'var(--sev-medium)', fontSize: 12 }}>{h.ownership}</span> },
          ]}
        />
      </Card>

      {sel && (
        <Drawer
          wide
          title={sel.host}
          sub={`${sel.ip} · ${sel.location}`}
          icon={<span className="int-ico"><Globe2 /></span>}
          onClose={() => setSel(null)}
          footer={<><Btn ghost onClick={() => setSel(null)}>Close</Btn><Btn primary color={tone} onClick={() => { setTicket(sel); setSel(null); }}>Send to owner</Btn></>}
        >
          <KV
            rows={[
              ['Ownership', sel.ownership],
              ['Tenant', tenantName(c, sel.tenantId)],
              ['Technology', sel.tech],
              ['Open ports', <span className="chips">{sel.ports.map((p) => <span key={p.port} className="int-port">{p.port}/{p.svc}</span>)}</span>],
              ['First seen', `${sel.firstSeenDays} days ago`],
              ['Highest EPSS', sel.cves.length ? `${sel.epss}%` : '—'],
            ]}
          />
          <SectionLabel>Findings ({sel.cves.length})</SectionLabel>
          {sel.cves.length === 0 && <div className="empty">No findings at the last sweep. Still monitored.</div>}
          {sel.cves.map((v) => (
            <div key={v.id} className="int-cve" style={{ cursor: 'default' }}>
              <span>
                <b>{v.id} · {v.title}</b>
                <small>CVSS {v.cvss.toFixed(1)} · EPSS {v.epss}%{v.kev ? ' · on the CISA KEV list, patch by the KEV due date' : ''}</small>
              </span>
              <span className="chips" style={{ flexShrink: 0 }}>{v.kev && <Badge color="var(--bad)" solid>KEV</Badge>}<SevBadge sev={v.sev} /></span>
            </div>
          ))}
          <SectionLabel>Sources</SectionLabel>
          <Sources items={[{ name: 'HexaInt external scanner' }, { name: 'NVD' }, { name: 'FIRST EPSS' }, { name: 'CISA KEV' }, ...(itsm ? [{ name: `${itsm.vendor} CMDB` }] : [])]} />
        </Drawer>
      )}

      {ticket && (
        <WriteBack
          title="Send finding to the asset owner"
          sub={ticket.host}
          risk="low"
          approvers={1}
          confirmLabel="Create ticket"
          onDone={`Ticket raised in ${itsm ? itsm.vendor : 'ITSM'} for ${ticket.host}; HexaStrike ASM retest scheduled after the fix.`}
          onClose={() => setTicket(null)}
          change={[
            ['Host', <span className="mono">{ticket.host}</span>],
            ['Findings', ticket.cves.map((v) => v.id).join(', ') || 'None'],
            ['Owner', ticket.ownership === 'Confirmed' ? 'From CMDB' : 'Unknown: routed to the security platform owner to assign'],
            ['System', itsm ? `${itsm.vendor} ${itsm.product}` : 'ITSM'],
            ['Then', 'HexaStrike ASM re-scans the host when the ticket closes'],
          ]}
        />
      )}
    </>
  );
}
