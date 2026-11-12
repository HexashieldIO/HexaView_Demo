import type { CustomerProfile } from '../types';
import { headlines, loops, loopSummary } from '../core';
import { rng } from '../../lib/rng';

/**
 * "What needs you": the short queue of things waiting on the signed-in person,
 * by role. Counts come from the same anchor numbers as the modules they link
 * to, so the homepage never disagrees with the page it opens.
 */
export type NeedKind = 'approve' | 'sign' | 'review' | 'fix' | 'answer';

export interface NeedItem {
  id: string;
  kind: NeedKind;
  title: string;
  meta: string;
  tone: string;
  sev: 'high' | 'medium' | 'low';
  path: string;
}

const ago = (min: number) => (min < 60 ? `${min} min ago` : min < 1440 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`);
/** "1 escalation" not "1 escalations". */
const pl = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const due = (d: number) => (d < 0 ? `${Math.abs(d)} d overdue` : d === 0 ? 'due today' : `due in ${d} d`);

/** Up to four items, most pressing first. */
export function needsYou(c: CustomerProfile, tenantId: string, persona: string): NeedItem[] {
  const h = headlines(c, tenantId);
  const r = rng(`needs-${c.id}-${tenantId}-${persona}`);
  const ls = loopSummary(loops(c, tenantId));
  const out: NeedItem[] = [];
  const add = (i: NeedItem) => { if (out.length < 4) out.push(i); };

  const boardDays = r.int(3, 21);
  const packPct = r.int(58, 92);

  switch (persona) {
    case 'executive':
    case 'finance':
      add({ id: 'pack', kind: 'review', title: 'Board pack ready for your review', meta: `${packPct}% drafted · board meets in ${boardDays} d`, tone: 'var(--m-reports)', sev: 'high', path: '/reports/library' });
      add({ id: 'ins', kind: 'sign', title: 'Insurance renewal attestation', meta: `${h.insurance.attestedControls} of ${h.insurance.totalControls} controls attested`, tone: 'var(--m-insurance)', sev: 'medium', path: '/insurance/overview' });
      add({ id: 'risk', kind: 'sign', title: `${r.int(2, 5)} risk acceptances await your signature`, meta: `oldest ${ago(r.int(2, 9) * 1440)}`, tone: 'var(--m-comply)', sev: 'medium', path: '/comply/risk' });
      break;
    case 'ciso':
      add({ id: 'sign', kind: 'sign', title: `${r.int(2, 4)} reports await your sign-off`, meta: `oldest ${ago(r.int(6, 40) * 60)}`, tone: 'var(--m-reports)', sev: 'high', path: '/reports/library' });
      add({ id: 'loops', kind: 'fix', title: `${pl(ls.broken, 'loop')} broken`, meta: 'a detection or validation stopped working', tone: 'var(--m-strike)', sev: 'high', path: '/loop?status=broken' });
      add({ id: 'risk', kind: 'review', title: `${r.int(2, 6)} risk acceptances to review`, meta: due(r.int(-3, 9)), tone: 'var(--m-comply)', sev: 'medium', path: '/comply/risk' });
      add({ id: 'prog', kind: 'review', title: 'Programme gate decision', meta: `${r.int(2, 5)} initiatives waiting on you`, tone: 'var(--m-programme)', sev: 'low', path: '/programme/initiatives' });
      break;
    case 'master':
    case 'admin':
      add({ id: 'appr', kind: 'approve', title: `${pl(h.ops.pendingApprovals, 'write-back action')} ${h.ops.pendingApprovals === 1 ? 'awaits' : 'await'} approval`, meta: `oldest ${ago(r.int(8, 90))}`, tone: 'var(--m-ops)', sev: 'high', path: '/ops/actions' });
      add({ id: 'access', kind: 'approve', title: pl(r.int(1, 4), 'access request'), meta: 'new users and role changes', tone: 'var(--m-ops)', sev: 'medium', path: '/ops/admin' });
      add({ id: 'conn', kind: 'fix', title: `${pl(Math.max(1, h.fabric.connectors - h.fabric.healthy), 'integration')} ${h.fabric.connectors - h.fabric.healthy === 1 ? 'needs' : 'need'} attention`, meta: 'credentials or collection errors', tone: 'var(--m-core)', sev: 'medium', path: '/fabric/integrations?health=issue' });
      add({ id: 'support', kind: 'approve', title: 'HexaShield support access request', meta: `requested ${ago(r.int(20, 300))}`, tone: 'var(--m-view)', sev: 'low', path: '/ops/admin' });
      break;
    case 'socmanager': {
      const esc = r.int(1, 3);
      add({ id: 'esc', kind: 'approve', title: `${pl(esc, 'escalation')} awaiting L4`, meta: `oldest ${ago(r.int(10, 120))} · accept or send back`, tone: 'var(--m-ir)', sev: 'high', path: '/incident-response/escalations' });
      add({ id: 'crit', kind: 'fix', title: `${h.soc.critical} critical, ${h.soc.high} high incidents open`, meta: `MTTR ${h.soc.mttrMin} min against target`, tone: 'var(--m-soc)', sev: 'high', path: '/soc/ir' });
      add({ id: 'det', kind: 'approve', title: `${r.int(2, 6)} detections staged for release`, meta: 'from HexaStrike findings', tone: 'var(--m-soc)', sev: 'medium', path: '/soc/detection' });
      add({ id: 'shift', kind: 'review', title: 'Shift handover to confirm', meta: `${r.int(3, 9)} open items carried over`, tone: 'var(--m-soc)', sev: 'low', path: '/soc/mdr' });
      break;
    }
    case 'analyst': {
      const tix = r.int(1, 5);
      add({ id: 'mine', kind: 'fix', title: `${pl(r.int(2, 6), 'incident')} assigned to you`, meta: `${h.soc.critical} critical · SLA ${h.soc.slaPct}%`, tone: 'var(--m-soc)', sev: 'high', path: '/soc/ir' });
      add({ id: 'tick', kind: 'answer', title: `${pl(tix, 'ticket')} awaiting your response`, meta: `oldest ${ago(r.int(15, 180))}`, tone: 'var(--m-soc)', sev: 'medium', path: '/soc/tickets' });
      add({ id: 'hunt', kind: 'review', title: `${pl(h.soc.huntsActive, 'hunt')} in progress`, meta: 'findings to write up', tone: 'var(--m-soc)', sev: 'low', path: '/soc/hunting' });
      break;
    }
    case 'grc':
      add({ id: 'ev', kind: 'fix', title: `${pl(h.comply.overdueTasks, 'evidence task')} overdue`, meta: `across ${h.comply.frameworks} frameworks`, tone: 'var(--m-comply)', sev: 'high', path: '/comply/caas?section=tasks' });
      add({ id: 'att', kind: 'sign', title: `${r.int(3, 11)} control attestations due`, meta: due(r.int(-2, 10)), tone: 'var(--m-comply)', sev: 'medium', path: '/comply/controls' });
      add({ id: 'vend', kind: 'review', title: `${pl(h.comply.highRiskVendors, 'high-risk vendor')} to review`, meta: `of ${h.comply.vendors.toLocaleString()} in scope`, tone: 'var(--m-trust)', sev: 'medium', path: '/comply/tprm' });
      add({ id: 'loops', kind: 'fix', title: `${pl(ls.partial, 'loop')} missing a link`, meta: 'evidence or validation not in place', tone: 'var(--m-matrix)', sev: 'low', path: '/loop?status=partial' });
      break;
    case 'risk':
      add({ id: 'rev', kind: 'review', title: `${r.int(3, 8)} risks due for review`, meta: due(r.int(-4, 12)), tone: 'var(--m-comply)', sev: 'high', path: '/comply/risk' });
      add({ id: 'vend', kind: 'review', title: `${pl(h.comply.highRiskVendors, 'high-risk vendor assessment')}`, meta: 'concentration and fourth-party risk', tone: 'var(--m-trust)', sev: 'medium', path: '/comply/tprm' });
      add({ id: 'ex', kind: 'review', title: 'Crisis exercise actions outstanding', meta: `${r.int(2, 7)} from the last run`, tone: 'var(--m-ops)', sev: 'low', path: '/ops/exercises' });
      break;
    case 'privacy': {
      const dsar = r.int(1, 5);
      const dpia = r.int(1, 4);
      add({ id: 'dsar', kind: 'answer', title: `${pl(dsar, 'data subject request')} open`, meta: due(r.int(-1, 14)), tone: 'var(--m-comply)', sev: 'high', path: '/comply/privacy' });
      add({ id: 'dpia', kind: 'review', title: `${pl(dpia, 'DPIA')} awaiting your opinion`, meta: `${h.ai.aiSystems} AI systems in scope`, tone: 'var(--m-aisec)', sev: 'medium', path: '/comply/privacy' });
      add({ id: 'vend', kind: 'review', title: 'Processor contracts to re-paper', meta: `${r.int(2, 9)} vendors`, tone: 'var(--m-trust)', sev: 'low', path: '/comply/tprm' });
      break;
    }
    case 'ot':
      add({ id: 'otal', kind: 'fix', title: `${h.ot.otAlerts.toLocaleString()} OT alerts open`, meta: `${h.ot.sites} sites · Purdue coverage ${h.ot.purdueCoveragePct}%`, tone: 'var(--m-ot)', sev: 'high', path: '/ot/alerts' });
      add({ id: 'chg', kind: 'approve', title: `${pl(r.int(1, 4), 'change window')} to confirm`, meta: 'plant maintenance this week', tone: 'var(--m-ot)', sev: 'medium', path: '/ot/visibility' });
      add({ id: 'sens', kind: 'fix', title: 'Sensor coverage gap', meta: `${h.ot.sensors} sensors deployed`, tone: 'var(--m-ot)', sev: 'low', path: '/ot/visibility' });
      break;
    case 'cloud':
      add({ id: 'conn', kind: 'fix', title: `${pl(Math.max(1, h.fabric.connectors - h.fabric.healthy), 'integration')} unhealthy`, meta: 'collection stopped or degraded', tone: 'var(--m-core)', sev: 'high', path: '/fabric/integrations?health=issue' });
      add({ id: 'find', kind: 'fix', title: `${pl(h.strike.criticalFindings, 'critical finding')} on your estate`, meta: `${h.strike.openFindings} open in total`, tone: 'var(--m-strike)', sev: 'medium', path: '/strike/pentest' });
      add({ id: 'keys', kind: 'review', title: 'Access keys past rotation', meta: `${r.int(2, 9)} to rotate`, tone: 'var(--m-core)', sev: 'low', path: '/fabric/cloud' });
      break;
    case 'threat':
      add({ id: 'tri', kind: 'review', title: `${h.int.prioritisedItems} intel items to triage`, meta: `${h.int.darkWebMentions} dark-web mentions`, tone: 'var(--m-int)', sev: 'high', path: '/int/overview' });
      add({ id: 'cred', kind: 'fix', title: `${h.int.exposedCredentials} exposed credentials`, meta: `${h.int.stealerMachines} infected machines`, tone: 'var(--m-int)', sev: 'medium', path: '/int/credentials' });
      add({ id: 'dom', kind: 'answer', title: `${pl(h.int.lookalikeDomains, 'lookalike domain')}`, meta: 'takedowns to request', tone: 'var(--m-int)', sev: 'low', path: '/int/domains' });
      break;
    default:
      add({ id: 'loops', kind: 'fix', title: `${pl(ls.broken + ls.partial, 'loop')} ${ls.broken + ls.partial === 1 ? 'needs' : 'need'} a link`, meta: `${ls.assuredPct}% assured`, tone: 'var(--m-view)', sev: 'medium', path: '/loop?status=partial' });
      add({ id: 'ev', kind: 'fix', title: `${h.comply.overdueTasks} evidence tasks overdue`, meta: `across ${h.comply.frameworks} frameworks`, tone: 'var(--m-comply)', sev: 'medium', path: '/comply/caas?section=tasks' });
      break;
  }
  return out;
}

export const NEED_VERB: Record<NeedKind, string> = {
  approve: 'Approve', sign: 'Sign off', review: 'Review', fix: 'Fix', answer: 'Respond',
};
