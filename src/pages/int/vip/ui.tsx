import { useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, UserRoundSearch } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { tenantName } from '../../../data/customers';
import {
  FINDING_KINDS, FINDING_COLOR, FINDING_STATUS_COLOR, IMP_COLOR, IMP_STATUS_COLOR, THREAT_COLOR, TIER_COLOR, scoreBand,
  type ProtectedPerson, type FindingKind, type FindingStatus,
} from '../../../data/modules/vip';
import { Badge, Btn, Callout, KV, Ring, SectionLabel, SevBadge, Sources, StatusBadge } from '../../../components/ui';
import { Drawer } from '../../../components/Overlay';
import { Chart } from '../../../components/Chart';
import { Modal } from '../../../components/Overlay';
import { RISK_CLASS_COLOR, type RiskClass } from '../parts';
import { useVip, initials } from './state';

export function Avatar({ name, color, size }: { name: string; color?: string; size?: 'sm' | 'lg' }) {
  return <span className={`vip-av ${size ?? ''}`} style={{ '--tone': color } as CSSProperties}>{initials(name)}</span>;
}

export function Spark({ data, color, w = 90, h = 26 }: { data: number[]; color: string; w?: number; h?: number }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(1, max - min);
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`);
  return (
    <svg className="vip-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r={2.4} fill={color} />
    </svg>
  );
}

export const kindCount = (p: ProtectedPerson, k: FindingKind): number =>
  k === 'Leaked credential' ? p.creds : k === 'Home address' ? (p.home ? 1 : 0) : k === 'Personal phone' ? (p.phone ? 1 : 0) : k === 'Family & social' ? p.family : k === 'Data-broker listing' ? p.brokers : k === 'Impersonating account' ? p.impersonations : p.lookalikes;

export const KIND_SHORT: Record<FindingKind, string> = {
  'Leaked credential': 'Creds', 'Home address': 'Home', 'Personal phone': 'Phone', 'Family & social': 'Family', 'Data-broker listing': 'Brokers', 'Impersonating account': 'Impers.', 'Lookalike domain': 'Domains',
};

/** Detail drawer for one protected person (advisory-level: what is exposed, never the data). */
export function PersonDrawer({ p, onClose }: { p: ProtectedPerson; onClose: () => void }) {
  const { c, imps, brokers, trips, go, notified, notify, watch, addWatch, setRemoval } = useVip();
  const { toast } = useApp();
  const nav = useNavigate();
  const [ask, setAsk] = useState(false);
  const band = scoreBand(p.score);
  const mine = imps.filter((i) => i.personId === p.id);
  const recs = brokers.filter((b) => b.personId === p.id);
  const pending = recs.filter((b) => b.state === 'Found' || b.state === 'Re-listed');
  const myTrips = trips.filter((t) => t.personId === p.id);
  const removalAsked = notified[`rem:${p.id}`];
  const statusOf = (k: FindingKind, s: FindingStatus): FindingStatus => (removalAsked && s === 'Open' && (k === 'Home address' || k === 'Personal phone' || k === 'Data-broker listing') ? 'Removal requested' : s);
  const first = p.name.replace(/^(Dr|Sir|Capt)\.?\s+/i, '').split(' ')[0];

  return (
    <>
      <Drawer
        wide
        title={p.name}
        sub={`${p.role} · ${tenantName(c, p.tenantId)}`}
        icon={<Avatar name={p.name} color={TIER_COLOR[p.tier]} />}
        onClose={onClose}
        footer={
          <>
            <Btn ghost onClick={() => { onClose(); nav('/int/exposure?view=vips'); }}>Credential exposure</Btn>
            <Btn disabled={notified[p.id]} onClick={() => { notify(p.id); toast(`Briefing sent to ${p.name} through the executive-protection channel; their assistant is copied.`); }}>{notified[p.id] ? 'Briefed' : `Brief ${first}`}</Btn>
            <Btn primary color="var(--m-int)" disabled={!pending.length || removalAsked} onClick={() => setAsk(true)}>{removalAsked ? 'Removals requested' : `Request removals (${pending.length})`}</Btn>
          </>
        }
      >
        <div className="row" style={{ gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <Ring value={p.score} size={92} stroke={9} color={band.color} sub={band.label} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <Chart
              height={110}
              option={{
                grid: { left: 4, right: 8, top: 10, bottom: 4, containLabel: true },
                tooltip: { trigger: 'axis' },
                xAxis: { type: 'category', data: p.trend.map((_, i) => (i === p.trend.length - 1 ? 'Now' : `W-${p.trend.length - 1 - i}`)), axisLabel: { fontSize: 10.5, interval: 2 } },
                yAxis: { type: 'value', min: 0, max: 100, splitNumber: 2, axisLabel: { fontSize: 10.5 } },
                series: [{ type: 'line', data: p.trend, smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#4f8cff' }, areaStyle: { color: 'rgba(79,140,255,0.12)' } }],
              }}
            />
            <div className="vip-note">Exposure score over 12 weeks · {p.delta > 0 ? `up ${p.delta}` : p.delta < 0 ? `down ${-p.delta}` : 'flat'} since last quarter’s review</div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <KV rows={[
            ['Tier', <Badge color={TIER_COLOR[p.tier]}>{p.tier}</Badge>],
            ['Public profile', p.publicProfile],
            ['Deepfake risk', <Badge color={p.deepfake === 'High' ? 'var(--bad)' : p.deepfake === 'Medium' ? 'var(--sev-medium)' : 'var(--good)'}>{p.deepfake}</Badge>],
            ['Family monitoring', p.family_enrolled || watch[`fam:${p.id}`] ? <Badge color="var(--good)" dot>Enrolled with consent</Badge> : <span className="row" style={{ gap: 8 }}><span className="muted">Not enrolled</span><Btn sm onClick={() => { addWatch(`fam:${p.id}`); toast(`Consent request sent to ${p.name} for family monitoring.`); }}>Offer enrolment</Btn></span>],
            ['Protected since', `${p.enrolledDays} days`],
          ]} />
        </div>

        <SectionLabel>What is exposed</SectionLabel>
        <div className="vip-chips">
          {FINDING_KINDS.map((k) => {
            const n = kindCount(p, k);
            return <span key={k} className={`vip-chip ${n ? '' : 'off'}`} style={{ '--tone': FINDING_COLOR[k] } as CSSProperties}><b>{n}</b>{k}</span>;
          })}
        </div>

        <SectionLabel>Findings ({p.findings.length})</SectionLabel>
        <div>
          {p.findings.map((f) => {
            const st = statusOf(f.kind, f.status);
            return (
              <div key={f.id} className="vip-find">
                <i style={{ background: FINDING_COLOR[f.kind] }} />
                <div>
                  <b>{f.title}</b>
                  <p>{f.detail}</p>
                  <small>{f.kind} · {f.source} · found {f.foundDays === 0 ? 'today' : `${f.foundDays}d ago`}</small>
                </div>
                <div className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                  <SevBadge sev={f.sev} />
                  <StatusBadge value={st} map={FINDING_STATUS_COLOR} />
                </div>
              </div>
            );
          })}
          {!p.findings.length && <div className="empty">No findings for this person.</div>}
        </div>

        {mine.length > 0 && (
          <>
            <SectionLabel>Impersonation ({mine.length})</SectionLabel>
            {mine.map((i) => (
              <button key={i.id} type="button" className="vip-imp" style={{ '--tone': IMP_COLOR[i.kind] } as CSSProperties} onClick={() => { onClose(); go('impersonation', { id: i.id }); }}>
                <span className="vip-imp-ico"><UserRoundSearch /></span>
                <span><h4>{i.title}</h4><span className="vip-imp-meta"><span>{i.kind}</span><span>{i.channel}</span></span></span>
                <span className="vip-imp-side"><StatusBadge value={i.status} map={IMP_STATUS_COLOR} /></span>
              </button>
            ))}
          </>
        )}

        {myTrips.length > 0 && (
          <>
            <SectionLabel>Upcoming travel</SectionLabel>
            {myTrips.map((t) => (
              <button key={t.id} type="button" className="vip-imp" style={{ '--tone': THREAT_COLOR[t.threat] } as CSSProperties} onClick={() => { onClose(); go('travel', { id: t.id }); }}>
                <span className="vip-imp-ico"><ShieldAlert /></span>
                <span><h4>{t.destination} · {t.purpose}</h4><span className="vip-imp-meta"><span>departs in {t.departsIn} days · {t.nights} nights</span></span></span>
                <span className="vip-imp-side"><Badge color={THREAT_COLOR[t.threat]}>{t.threat}</Badge></span>
              </button>
            ))}
          </>
        )}

        <div style={{ marginTop: 14 }}>
          <Callout>Advisory only: HexaView records that personal data is exposed and where, never the data itself. Family accounts are monitored only with written consent.</Callout>
        </div>
        <SectionLabel>Sources</SectionLabel>
        <Sources items={[{ name: 'HexaInt breach & stealer collection' }, { name: 'HexaInt social monitoring' }, { name: 'Data-broker sweep' }, { name: 'CT logs · zone files' }]} />
      </Drawer>

      {ask && (
        <ActionModal
          title="Request data-broker removals"
          sub={p.name}
          risk="low"
          approvers={1}
          confirmLabel={`Request ${pending.length} removal${pending.length === 1 ? '' : 's'}`}
          onDone={`${pending.length} removal request${pending.length === 1 ? '' : 's'} filed for ${p.name}; progress tracked under Data-broker & personal exposure.`}
          onClose={() => setAsk(false)}
          onConfirm={() => { setRemoval(pending.map((b) => b.id), 'Requested'); notify(`rem:${p.id}`); }}
          change={[
            ['Person', p.name],
            ['Listings', `${pending.length} found or re-listed across ${new Set(pending.map((b) => b.cat)).size} broker categories`],
            ['Legal basis', pending[0]?.legal ?? 'Privacy-law deletion request'],
            ['Action', 'File removal requests with each broker and re-check weekly for re-listing'],
            ['Tracked in', 'HexaInt removal queue + HexaCore audit ledger'],
          ]}
        />
      )}
    </>
  );
}


/** Write-back confirmation (LLD 8.2) that also commits in-session state on confirm. */
export function ActionModal({ title, sub, change, risk, approvers, confirmLabel, onDone, onClose, onConfirm }: {
  title: string; sub?: string; change: [ReactNode, ReactNode][]; risk: RiskClass; approvers: number; confirmLabel: string; onDone: string; onClose: () => void; onConfirm: () => void;
}) {
  const { toast } = useApp();
  return (
    <Modal
      title={title}
      sub={sub}
      onClose={onClose}
      footer={<><Btn ghost onClick={onClose}>Cancel</Btn><Btn primary color={RISK_CLASS_COLOR[risk]} onClick={() => { onConfirm(); toast(onDone); onClose(); }}>{confirmLabel}</Btn></>}
    >
      <Callout kind={risk === 'low' ? 'info' : 'warn'} color={RISK_CLASS_COLOR[risk]}>
        <b>{risk === 'high' ? 'High-risk action' : risk === 'medium' ? 'Medium-risk action' : 'Low-risk action'}</b> · requires {approvers} approver{approvers > 1 ? 's' : ''} and is written to the HexaCore audit ledger.
      </Callout>
      <div style={{ marginTop: 12 }}><KV rows={change} /></div>
    </Modal>
  );
}
