import { useMemo, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Link2 } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { signedIn } from '../../data/modules/ops';
import {
  trSubscribe, trVersion, trQuestionnaires, trLibraryView, trRequests, trDocuments, trEvidence, trAccessLog, trActivity, trPortalStats,
  TR_EV_COLOR, TR_STATUS_COLOR, TR_QSTATE_COLOR, type TrEvidence, type TrStatus, type TrQState,
} from '../../data/modules/trust';
import { fmtNum } from '../../lib/format';
import './trust.css';

export const TRUST_TONE = MODULE_BY_ID.trust.tone;

type TC = CSSProperties & { '--tc'?: string };

/** Shared, store-backed view of the Trust Centre for the current customer and scope. */
export function useTrust() {
  const { customer: c, tenantId, persona, toast } = useApp();
  const version = useSyncExternalStore(trSubscribe, trVersion);
  const data = useMemo(() => ({
    qns: trQuestionnaires(c, tenantId),
    lib: trLibraryView(c),
    reqs: trRequests(c, tenantId),
    docs: trDocuments(c),
    ev: trEvidence(c),
    acl: trAccessLog(c),
    activity: trActivity(c),
    portal: trPortalStats(c),
  // version re-derives when the in-session store changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [c, tenantId, version]);
  const me = signedIn(c, persona).name;
  const grc = c.connectors.find((k) => k.category === 'GRC')?.product ?? 'HexaComply';
  return { c, tenantId, me, grc, toast, version, ...data };
}

export function Pill({ color, children, title }: { color: string; children: ReactNode; title?: string }) {
  return <span className="tr-pill" style={{ '--tc': color } as TC} title={title}>{children}</span>;
}
export function StatusPill({ s }: { s: TrStatus }) {
  return <Pill color={TR_STATUS_COLOR[s]}>{s}</Pill>;
}
export function QStatePill({ s }: { s: TrQState }) {
  return <Pill color={TR_QSTATE_COLOR[s]}>{s}</Pill>;
}
export function confColor(n: number): string {
  return n >= 85 ? '#2dd4bf' : n >= 65 ? '#f0a338' : '#f8646f';
}
export function Conf({ n }: { n: number }) {
  return (
    <span className="tr-conf" title="Draft confidence: how closely the question matches an approved answer and how fresh its evidence is">
      <span className="tr-conf-bar"><i style={{ width: `${Math.max(3, n)}%`, background: confColor(n) }} /></span>
      <b style={{ color: confColor(n) }}>{n}%</b>
    </span>
  );
}

/** Evidence chip: names the source and pivots to the record behind it. */
export function EvChip({ e }: { e: TrEvidence }) {
  const nav = useNavigate();
  return (
    <button type="button" className="tr-ev" style={{ '--tc': TR_EV_COLOR[e.kind] } as TC} onClick={(ev) => { ev.stopPropagation(); nav(e.to); }} title={`${e.kind} · ${e.detail}\nSource: ${e.source} · evidence ${e.ageDays === 0 ? 'live' : `${e.ageDays} d old`}\nClick to open`}>
      <i />
      <span>{e.label}</span>
      <ArrowUpRight size={11} />
    </button>
  );
}

export function LibChip({ id, stale }: { id: string; stale?: boolean }) {
  const nav = useNavigate();
  return (
    <button type="button" className={`tr-lib ${stale ? 'stale' : ''}`} onClick={(e) => { e.stopPropagation(); nav(`/trust/answers?id=${id}`); }} title={stale ? 'Library answer is stale: underlying evidence changed' : 'Approved library answer'}>
      <Link2 size={11} /> {id}{stale ? ' · stale' : ''}
    </button>
  );
}

/** Segmented progress: approved / drafted / flagged / needs input. */
export function QProgress({ approved, drafted, flagged, needs, total, wide }: { approved: number; drafted: number; flagged: number; needs: number; total: number; wide?: boolean }) {
  const seg = (n: number, col: string, label: string) => (n > 0 ? <i key={label} style={{ flexGrow: n, background: col }} title={`${label}: ${fmtNum(n)}`} /> : null);
  return (
    <span className={`tr-prog ${wide ? 'wide' : ''}`} title={`${approved} of ${total} approved`}>
      <span className="tr-prog-bar">
        {seg(approved, TR_QSTATE_COLOR.Approved, 'Approved')}
        {seg(drafted, TR_QSTATE_COLOR.Drafted, 'Drafted')}
        {seg(flagged, TR_QSTATE_COLOR.Flagged, 'Flagged')}
        {seg(needs, TR_QSTATE_COLOR['Needs input'], 'Needs input')}
      </span>
      <em>{Math.round((approved / Math.max(1, total)) * 100)}%</em>
    </span>
  );
}

export function dueText(d: number, sent?: boolean): { text: string; color: string } {
  if (sent) return { text: 'Returned', color: 'var(--text-muted)' };
  if (d < 0) return { text: `${-d}d overdue`, color: 'var(--bad)' };
  if (d === 0) return { text: 'Due today', color: 'var(--sev-high)' };
  if (d <= 3) return { text: `${d}d left`, color: 'var(--sev-high)' };
  if (d <= 7) return { text: `${d}d left`, color: 'var(--sev-medium)' };
  return { text: `${d}d left`, color: 'var(--good)' };
}

/** Links between the five Trust Centre tabs. */
export function TrustNav({ here }: { here: 'overview' | 'questionnaires' | 'answers' | 'portal' | 'requests' }) {
  const nav = useNavigate();
  const items: [typeof here, string, string][] = [
    ['questionnaires', 'Questionnaires', '/trust/questionnaires'],
    ['answers', 'Answer Library', '/trust/answers'],
    ['portal', 'Trust Portal', '/trust/portal'],
    ['requests', 'Access & NDAs', '/trust/requests'],
  ];
  return (
    <span className="tr-nav">
      {items.filter(([id]) => id !== here).map(([id, label, to]) => (
        <button key={id} type="button" onClick={() => nav(to)}>{label} <ArrowUpRight size={11} /></button>
      ))}
    </span>
  );
}
