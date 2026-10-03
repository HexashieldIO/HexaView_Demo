import type { ReactNode } from 'react';
import { EyeOff, Factory, Lock } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Btn, Card, IcoBox, KV, Badge, Sources, Freshness, SevBadge } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { MODULE_BY_ID } from '../../modules/registry';
import { headlines } from '../../data/core';
import { LEVEL_HEX, PURDUE, OT_CVE_BY_ID, type OtAsset, type OtScope } from '../../data/modules/ot';
import { fmtAgo, fmtNum } from '../../lib/format';
import './ot.css';

export const OT_TONE = MODULE_BY_ID.ot.tone;

/** The standing policy marker: HexaOT never writes to OT. */
export function ReadOnlyBadge() {
  return (
    <span className="ot-ro" title="HexaOT and HexaView never send commands or write-backs to OT systems">
      <Lock /> Read-only by policy · passive monitoring
    </span>
  );
}

export function OtIntro({ children }: { children: ReactNode }) {
  return (
    <div className="ot-intro-row">
      <p className="page-intro">{children}</p>
      <ReadOnlyBadge />
    </div>
  );
}

/** Honest empty state for tenants with no OT in scope (never show zeros). */
export function NoOtState({ what }: { what: string }) {
  const { customer: c, tenantId, setTenantId } = useApp();
  const t = c.tenants.find((x) => x.id === tenantId);
  const otTenants = c.tenants.filter((x) => x.env.includes('ot'));
  return (
    <>
      <OtIntro>
        <b>{c.name}</b> · {t?.name ?? tenantId}. {what}
      </OtIntro>
      <Card>
        <div className="ot-empty">
          <IcoBox color={OT_TONE}>
            <EyeOff />
          </IcoBox>
          <h3>No OT in this tenant&rsquo;s scope</h3>
          <p>
            {t?.name ?? 'This tenant'} ({t?.kind}) has no operational technology connected to HexaView: no sensors, no OT connectors and no Purdue-modelled assets. That is not the same as zero risk, it is simply out of scope here. Switch to a tenant that runs OT:
          </p>
          <div className="chips" style={{ justifyContent: 'center' }}>
            {otTenants.map((x) => (
              <Btn key={x.id} sm color={OT_TONE} onClick={() => setTenantId(x.id)}>
                <Factory /> {x.short} · {fmtNum(headlines(c, x.id).ot.otAssets)} assets
              </Btn>
            ))}
            <Btn sm primary color={OT_TONE} onClick={() => setTenantId('all')}>
              Group view
            </Btn>
          </div>
        </div>
      </Card>
    </>
  );
}

export function OtSources({ sc }: { sc: OtScope }) {
  const stale = sc.sources.filter((s) => s.lastSyncMin > s.intervalMin * 2 || s.status !== 'healthy');
  return (
    <span className="row wrap" style={{ gap: 8 }}>
      <Sources items={sc.sources.map((s) => ({ name: s.name, status: s.status }))} />
      {stale.slice(0, 1).map((s) => (
        <Freshness key={s.name} minutes={s.lastSyncMin} stale label={s.name} />
      ))}
    </span>
  );
}

/** Risk score chip 0–10, coloured by band (the original's square badge). */
export function RiskChip({ n }: { n: number }) {
  const col = n >= 9 ? 'var(--sev-critical)' : n >= 7 ? 'var(--sev-high)' : n >= 4 ? 'var(--sev-medium)' : 'var(--text-muted)';
  return <span className="ot-risk" style={{ ['--rc' as string]: col }}>{n}</span>;
}

export function PeakBadge({ n }: { n: number }) {
  const label = n >= 9 ? 'Very high' : n >= 7 ? 'High' : n >= 4 ? 'Medium' : 'Low';
  const col = n >= 9 ? 'var(--sev-critical)' : n >= 7 ? 'var(--sev-high)' : 'var(--sev-medium)';
  return <Badge color={col} solid={n >= 9}>{n} · {label}</Badge>;
}

/** Thin labelled meter used inside table cells. */
export function CellMeter({ value, max, color = 'var(--m-ot)', label }: { value: number; max: number; color?: string; label: ReactNode }) {
  return (
    <span className="ot-cellmeter">
      <i><b style={{ width: `${Math.max(2, Math.min(100, (value / Math.max(1, max)) * 100))}%`, background: color }} /></i>
      <span>{label}</span>
    </span>
  );
}

export function srcNames(sc: OtScope): string {
  return sc.sources.map((s) => s.name).join(' · ');
}

export function levelLabel(id: string): string {
  return PURDUE.find((p) => p.id === id)?.label ?? id;
}

export function LevelBadge({ level }: { level: OtAsset['level'] }) {
  return <Badge color={LEVEL_HEX[level]}>{levelLabel(level)}</Badge>;
}

export function ConsequenceDots({ value }: { value: number }) {
  return (
    <span title={`Consequence ${value} of 5`} style={{ letterSpacing: 1, color: value >= 5 ? 'var(--sev-critical)' : value >= 4 ? 'var(--sev-high)' : 'var(--sev-medium)' }}>
      {'●'.repeat(value)}
      <span style={{ opacity: 0.2 }}>{'●'.repeat(5 - value)}</span>
    </span>
  );
}

export function AssetDrawer({ a, onClose }: { a: OtAsset; onClose: () => void }) {
  const sevOf = (cvss: number) => (cvss >= 9 ? 'critical' : cvss >= 7 ? 'high' : cvss >= 4 ? 'medium' : 'low') as 'critical' | 'high' | 'medium' | 'low';
  return (
    <Drawer
      title={a.name}
      sub={`${a.type} · ${a.siteName}`}
      icon={<IcoBox color={LEVEL_HEX[a.level]}><Factory /></IcoBox>}
      onClose={onClose}
      footer={<span className="muted" style={{ fontSize: 11.5 }}><Lock size={12} style={{ verticalAlign: -2 }} /> No actions available: OT assets are observed passively and are never changed from HexaView.</span>}
    >
      <KV
        rows={[
          ['Purdue level', <LevelBadge level={a.level} />],
          ['Zone', a.zone],
          ['Vendor / model', `${a.vendor} · ${a.model}`],
          ['Firmware', <span>{a.firmware} {a.fwBehind > 0 ? <Badge color="var(--sev-medium)">{a.fwBehind} behind {a.latestFirmware}</Badge> : <Badge color="var(--good)">Current</Badge>}</span>],
          ['IP / MAC', <span className="mono">{a.ip} · {a.mac}</span>],
          ['Protocols', a.protocols.length ? a.protocols.join(', ') : '—'],
          ['Last seen', fmtAgo(a.lastSeenMin)],
          ['Consequence', <span><ConsequenceDots value={a.consequence} /> {a.consequenceText}</span>],
          ['Risk score', <b>{a.risk}</b>],
          ['Seen by', <Sources items={a.sources.map((s) => ({ name: s }))} />],
          ...(a.vessel ? ([['Vessel', a.vessel]] as [ReactNode, ReactNode][]) : []),
        ]}
      />
      <div className="section-label" style={{ marginTop: 18 }}>Known vulnerabilities</div>
      {a.cves.length === 0 && <div className="muted" style={{ fontSize: 12 }}>No matched advisories for this firmware.</div>}
      <div className="list">
        {a.cves.map((id) => {
          const v = OT_CVE_BY_ID[id];
          return (
            <div key={id} className="list-row">
              <span className="list-main">
                <b className="mono">{id}</b>
                <span>{v?.product} · {v?.title}</span>
              </span>
              {v?.kev && <Badge color="var(--sev-critical)" solid>KEV</Badge>}
              {v && <SevBadge sev={sevOf(v.cvss)} />}
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}
