import { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Wrench } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import type { CustomerProfile } from '../../data/types';
import { MODULE_BY_ID } from '../../modules/registry';
import { Badge, Btn, Callout, Freshness, KV, SectionLabel, Sources } from '../../components/ui';
import { Drawer, Modal } from '../../components/Overlay';
import { fmtAgo, fmtMoney } from '../../lib/format';
import { tenantName } from '../../data/customers';
import { CONTROL_STATUS_COLOR, type ControlStatus, type KeyControl, type SourceRef } from '../../data/modules/insurance';
import './insurance.css';

export const INS_TONE = MODULE_BY_ID.insurance.tone;
export const INS_HEX = '#2ec4a8';

/** Money from millions in the customer's currency. */
export function money(m: number, c: CustomerProfile): string {
  return fmtMoney(m * 1e6, c.currency);
}

export function ControlStatusBadge({ status }: { status: ControlStatus }) {
  const Icon = status === 'attested' ? CheckCircle2 : status === 'partial' ? AlertTriangle : XCircle;
  return (
    <Badge color={CONTROL_STATUS_COLOR[status]}>
      <Icon size={11} style={{ marginRight: 3, verticalAlign: -1 }} />
      {status === 'attested' ? 'Attested' : status === 'partial' ? 'Partial' : 'Gap'}
    </Badge>
  );
}

/** Source chips plus the freshness of the worst contributing connector. */
export function SourceLine({ sources, compact }: { sources: SourceRef[]; compact?: boolean }) {
  if (!sources.length) return <span className="muted" style={{ fontSize: 11 }}>No connector: manual evidence</span>;
  const worst = sources.slice().sort((a, b) => Number(b.stale) - Number(a.stale) || b.lastSyncMin - a.lastSyncMin)[0];
  return (
    <div className="ins-src">
      <Sources items={sources.map((s) => ({ name: s.name, status: s.stale && s.status === 'healthy' ? 'degraded' : s.status }))} />
      {!compact && <Freshness minutes={worst.lastSyncMin} stale={worst.stale} label={worst.stale ? worst.name : undefined} />}
    </div>
  );
}

/** Intro line naming the customer, scope and the tools behind the view. */
export function Intro({ children, ids }: { children: React.ReactNode; ids: string[] }) {
  const { customer: c, tenantId } = useApp();
  const tools = ids.map((id) => c.connectors.find((k) => k.id === id)).filter(Boolean).map((k) => k!.product);
  return (
    <p className="page-intro">
      <b>{c.name}</b>
      {tenantId !== 'all' ? ` · ${tenantName(c, tenantId)}` : ''} · {children} Evidence from {tools.slice(0, -1).join(', ')}
      {tools.length > 1 ? ' and ' : ''}
      {tools[tools.length - 1]}.
    </p>
  );
}

export function TenantNote() {
  const { customer: c, tenantId } = useApp();
  if (tenantId === 'all') return null;
  return (
    <Callout>
      The {c.insurance.carrier.split(' ')[0]} programme is placed at group level, so limits, premium and the insurer view stay group-wide. Rows touching <b>{tenantName(c, tenantId)}</b> are highlighted.
    </Callout>
  );
}

/** Drawer for one insurer key control, with a write-back request to fix the gap. */
export function ControlDrawer({ control: k, onClose }: { control: KeyControl; onClose: () => void }) {
  const { customer: c, toast } = useApp();
  const [ask, setAsk] = useState(false);
  const itsm = c.connectors.find((x) => x.category === 'ITSM');
  const owner = k.id === 'seg' && c.people.otLead ? c.people.otLead : k.id === 'tprm' || k.id === 'ir' ? c.people.grcLead : k.id === 'awareness' ? c.people.admin : c.people.socLead;
  return (
    <>
      <Drawer
        title={k.name}
        sub={<>Insurer key control · weight {'●'.repeat(k.weight)}{'○'.repeat(3 - k.weight)} · {k.ok} of {k.tests.length} tests attested</>}
        onClose={onClose}
        footer={
          k.status !== 'attested' ? (
            <Btn primary color={INS_TONE} onClick={() => setAsk(true)}>
              <Wrench size={14} /> Request fix in {itsm?.product ?? 'ITSM'}
            </Btn>
          ) : (
            <span className="muted" style={{ fontSize: 12 }}>Fully attested: included in the next signed pack automatically.</span>
          )
        }
      >
        <div className="row" style={{ marginBottom: 12 }}>
          <ControlStatusBadge status={k.status} />
          <span className="muted" style={{ fontSize: 12 }}>
            Last renewal: <ControlStatusBadge status={k.lastStatus} />
          </span>
        </div>
        <div className="ins-metric">{k.metric}</div>
        <p className="secondary" style={{ margin: '10px 0 14px' }}>{k.why}</p>
        {k.gapNote && <Callout kind="warn">{k.gapNote}</Callout>}
        <SectionLabel>Control tests as the insurer asks them</SectionLabel>
        <div className="stack" style={{ gap: 8 }}>
          {k.tests.map((t) => (
            <div key={t.id} className="ins-test" style={{ borderLeftColor: t.ok ? 'var(--good)' : k.ok === 0 ? 'var(--bad)' : 'var(--sev-medium)' }}>
              <div className="row between">
                <b>{t.q}</b>
                <span className="mono muted" style={{ fontSize: 10.5 }}>{t.id}</span>
              </div>
              <div>{t.a}</div>
              <div className="muted" style={{ fontSize: 11 }}>Evidence {t.evidenceRef} · {t.ok ? 'attested' : 'not attested'}</div>
            </div>
          ))}
        </div>
        <SectionLabel>
          <span style={{ display: 'block', marginTop: 16 }}>Auto-evidenced from</span>
        </SectionLabel>
        <div className="stack" style={{ gap: 6 }}>
          {k.sources.map((s) => (
            <div key={s.id} className="row between ins-src-row">
              <Sources items={[{ name: s.name, status: s.status }]} />
              <Freshness minutes={s.lastSyncMin} stale={s.stale} label={s.stale ? s.name : undefined} />
            </div>
          ))}
          {!k.sources.length && <span className="muted">No connector: manual evidence only.</span>}
        </div>
        {k.fix && (
          <>
            <SectionLabel>
              <span style={{ display: 'block', marginTop: 16 }}>What turns it green</span>
            </SectionLabel>
            <p className="secondary">{k.fix}</p>
            <KV rows={[['Suggested owner', `${owner.name} (${owner.role})`], ['Re-attestation', 'Automatic on next connector sync'], ['Premium effect', 'Shown on the Insurability tab']]} />
          </>
        )}
      </Drawer>
      {ask && (
        <Modal
          title="Request remediation"
          sub={`Write-back to ${itsm?.vendor ?? ''} ${itsm?.product ?? 'ITSM'}`}
          onClose={() => setAsk(false)}
          footer={
            <>
              <Btn ghost onClick={() => setAsk(false)}>Cancel</Btn>
              <Btn primary color={INS_TONE} onClick={() => { setAsk(false); toast(`Ticket created in ${itsm?.product ?? 'ITSM'} for ${owner.name}: ${k.name}`); }}>Create ticket</Btn>
            </>
          }
        >
          <KV
            rows={[
              ['What changes', `New ticket "${k.name}: insurer evidence gap" with the failing tests and evidence links`],
              ['Assigned to', `${owner.name} · ${owner.role}`],
              ['Risk class', <Badge color="var(--good)">Low (LLD 8.2): ticket only, no system change</Badge>],
              ['Approvals', 'None required; logged to the audit ledger'],
              ['Due', `Before broker submission (${Math.max(1, c.insurance.renewalDays - 50)} days)`],
            ]}
          />
        </Modal>
      )}
    </>
  );
}

export function agoText(min: number): string {
  return fmtAgo(min);
}
