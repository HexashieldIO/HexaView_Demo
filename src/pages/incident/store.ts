// In-session store for Incident Response. One slot per customer, shared by
// every tab, persisted to sessionStorage (`hv.ir.<customerId>`) so it survives
// navigation and reloads in the same session; Reset demo clears hv.* keys.
// Every change that matters is written to the incident's hash-chained timeline.
import { useSyncExternalStore } from 'react';
import type { CustomerProfile } from '../../data/types';
import {
  seedState, declareFromEscalation, guidedEscalation, escalationFromSoc, chainAppend, irPeople, irTools, playbookFor, sha256,
  PHASES, PHASE_LABEL, SEV_LABEL, TL_TYPE, DEST_META, IR_SECTIONS,
  type IrState, type IrIncident, type Escalation, type DeclareForm, type TimelineEntry, type TlType, type Phase, type Task, type TaskStatus,
  type Stream, type Stakeholder, type EvidenceItem, type ReportState, type ReviewAction, type ActionDest, type RoleName,
} from '../../data/modules/incident';

const MIN = 60_000;
const slots = new Map<string, IrState>();
const listeners = new Set<() => void>();
const keyOf = (c: CustomerProfile) => `hv.ir.${String(c.id)}`;

function load(c: CustomerProfile): IrState {
  const k = keyOf(c);
  const hit = slots.get(k);
  if (hit) return hit;
  let s: IrState | null = null;
  try {
    const raw = sessionStorage.getItem(k);
    if (raw) {
      const p = JSON.parse(raw) as IrState;
      if (p && p.v === 2 && Array.isArray(p.incidents) && Array.isArray(p.escalations)) s = p;
    }
  } catch {
    /* storage unavailable or corrupt: reseed */
  }
  if (!s) {
    s = seedState(c);
    persist(k, s);
  }
  slots.set(k, s);
  return s;
}

function persist(k: string, s: IrState) {
  try {
    sessionStorage.setItem(k, JSON.stringify(s));
  } catch {
    // Quota: drop other customers' IR slots (they reseed on demand) and retry once.
    try {
      Object.keys(sessionStorage).filter((x) => x.startsWith('hv.ir.') && x !== k).forEach((x) => sessionStorage.removeItem(x));
      sessionStorage.setItem(k, JSON.stringify(s));
    } catch {
      /* module state still holds it */
    }
  }
}

function save(c: CustomerProfile, s: IrState) {
  const k = keyOf(c);
  slots.set(k, s);
  persist(k, s);
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useIrState(c: CustomerProfile): IrState {
  return useSyncExternalStore(subscribe, () => load(c));
}
export function getIrState(c: CustomerProfile): IrState {
  return load(c);
}
export function resetIr(c: CustomerProfile) {
  slots.delete(keyOf(c));
  try { sessionStorage.removeItem(keyOf(c)); } catch { /* ignore */ }
  save(c, seedState(c));
}

/* ---------------------------------------------------------------------
   Mutation helpers
   --------------------------------------------------------------------- */
function mutate(c: CustomerProfile, fn: (s: IrState) => IrState) {
  save(c, fn(load(c)));
}
function patchInc(s: IrState, id: string, fn: (i: IrIncident) => IrIncident): IrState {
  return { ...s, incidents: s.incidents.map((i) => (i.id === id ? fn(i) : i)) };
}
interface LogIn { type: TlType; actor: string; source: string; text: string; to?: string; key?: boolean; evidence?: string[]; t?: number }
function log(inc: IrIncident, e: LogIn): IrIncident {
  const t = e.t ?? Date.now();
  return { ...inc, timeline: chainAppend(inc.timeline, { t, type: e.type, actor: e.actor, source: e.source, text: e.text, to: e.to, key: e.key, evidence: e.evidence, phase: inc.phase, auto: TL_TYPE[e.type].auto }, inc.id) };
}

/** Guided steps (index): 0 accept, 1 war room, 2 stakeholders, 3 timeline, 4 notifications, 5 report, 6 done. */
function guideDone(s: IrState, incId: string | null, step: number): IrState {
  if (!s.guided || s.guided.step !== step) return s;
  if (step > 0 && s.guided.incidentId !== incId) return s;
  return { ...s, guided: { ...s.guided, step: step + 1 } };
}

const nextId = (s: IrState) => `IR-${new Date().getFullYear()}-${String(s.seq).padStart(4, '0')}`;

/* ---------------------------------------------------------------------
   Actions
   --------------------------------------------------------------------- */
export const ir = {
  focus(c: CustomerProfile, id: string | null) {
    mutate(c, (s) => (s.focus === id ? s : { ...s, focus: id }));
  },

  /* ---- Escalations ---- */
  accept(c: CustomerProfile, escId: string, form: DeclareForm, actor: string): string | null {
    let created: string | null = null;
    mutate(c, (s) => {
      const esc = s.escalations.find((e) => e.id === escId);
      if (!esc || esc.status === 'accepted' || esc.status === 'merged') return s;
      const id = nextId(s);
      created = id;
      let inc = declareFromEscalation(c, esc, form, id);
      inc = log(inc, { type: 'note', actor, source: 'HexaView IR', text: `Declare form submitted by ${actor}: ${SEV_LABEL[form.sev]}, commander ${form.commander}${form.scope ? `; initial scope "${form.scope}"` : ''}` });
      let next: IrState = {
        ...s,
        seq: s.seq + 1,
        focus: id,
        escalations: s.escalations.map((e) => (e.id === escId ? { ...e, status: 'accepted' as const, incidentId: id } : e)),
        incidents: [inc, ...s.incidents],
      };
      if (next.guided && next.guided.escalationId === escId) next = { ...next, guided: { ...next.guided, step: Math.max(1, next.guided.step), incidentId: id } };
      return next;
    });
    return created;
  },
  requestInfo(c: CustomerProfile, escId: string, ask: string) {
    mutate(c, (s) => ({ ...s, escalations: s.escalations.map((e) => (e.id === escId ? { ...e, status: 'info' as const, infoAsk: ask } : e)) }));
  },
  reEscalate(c: CustomerProfile, escId: string) {
    mutate(c, (s) => ({
      ...s,
      escalations: s.escalations.map((e) => (e.id === escId ? { ...e, status: 'awaiting' as const, escalatedAt: Date.now(), notes: `${e.notes} · L3 reply: ${e.infoAsk ? `answered "${e.infoAsk}"` : 'more detail added'}; re-escalated.`, infoAsk: undefined } : e)),
    }));
  },
  merge(c: CustomerProfile, escId: string, incId: string, actor: string) {
    mutate(c, (s) => {
      const esc = s.escalations.find((e) => e.id === escId);
      if (!esc) return s;
      const s2 = patchInc(s, incId, (i) => log({ ...i, escalationIds: [...i.escalationIds, escId], assets: Array.from(new Set([...i.assets, ...esc.assets])), tenantIds: Array.from(new Set([...i.tenantIds, esc.tenantId])) }, { type: 'escalation', actor, source: 'HexaView IR', text: `Escalation ${esc.id} (${esc.socId ?? 'SOC case'}) merged: ${esc.title}`, key: true, to: '/incident-response/escalations' }));
      return { ...s2, escalations: s2.escalations.map((e) => (e.id === escId ? { ...e, status: 'merged' as const, incidentId: incId } : e)) };
    });
  },

  /* ---- War room ---- */
  advancePhase(c: CustomerProfile, incId: string, actor: string, note: string) {
    mutate(c, (s) => {
      const s2 = patchInc(s, incId, (i) => {
        const ix = PHASES.indexOf(i.phase);
        if (ix >= PHASES.length - 1) return i;
        const phase = PHASES[ix + 1] as Phase;
        const now = Date.now();
        const next = { ...i, phase, phaseAt: { ...i.phaseAt, [phase]: now } };
        return log(next, { type: 'phase', actor, source: 'HexaView IR', text: `Phase advanced to ${PHASE_LABEL[phase]}${note ? ` · ${note}` : ''}`, key: true, to: '/incident-response/warroom' });
      });
      return s2;
    });
  },
  closeIncident(c: CustomerProfile, incId: string, actor: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => log({ ...i, status: 'closed', closedAt: Date.now() }, { type: 'phase', actor, source: 'HexaView IR', text: `Incident closed by ${actor}`, key: true })));
  },
  addTask(c: CustomerProfile, incId: string, t: { title: string; stream: Stream; owner: string; dueMin: number }, actor: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => {
      const task: Task = { id: `${i.id}-T${i.tasks.length + 1}`, title: t.title, stream: t.stream, owner: t.owner, dueAt: Date.now() + t.dueMin * MIN, status: 'todo' };
      return log({ ...i, tasks: [...i.tasks, task] }, { type: 'note', actor, source: 'War room', text: `Task added (${t.stream}): ${t.title} · owner ${t.owner}`, to: '/incident-response/warroom' });
    }));
  },
  moveTask(c: CustomerProfile, incId: string, taskId: string, status: TaskStatus, actor: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => {
      const t = i.tasks.find((x) => x.id === taskId);
      if (!t || t.status === status) return i;
      return log({ ...i, tasks: i.tasks.map((x) => (x.id === taskId ? { ...x, status } : x)) }, { type: 'note', actor, source: 'War room', text: `Task "${t.title}" → ${status === 'doing' ? 'in progress' : status}` });
    }));
  },
  addDecision(c: CustomerProfile, incId: string, d: { decision: string; rationale: string; by: string }, actor: string) {
    mutate(c, (s) => {
      const s2 = patchInc(s, incId, (i) => log({ ...i, decisions: [...i.decisions, { id: `${i.id}-D${i.decisions.length + 1}`, t: Date.now(), ...d }] }, { type: 'decision', actor: d.by, source: 'War room', text: `${d.decision}${d.rationale ? ` · rationale: ${d.rationale}` : ''} (recorded by ${actor})`, key: true, to: '/incident-response/warroom' }));
      return guideDone(s2, incId, 1);
    });
  },
  assignRole(c: CustomerProfile, incId: string, role: RoleName, name: string, actor: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => log({ ...i, roles: i.roles.map((r) => (r.role === role ? { ...r, name } : r)), commander: role === 'Incident Commander' ? name : i.commander }, { type: 'note', actor, source: 'War room', text: `${role} assigned to ${name}` })));
  },
  joinBridge(c: CustomerProfile, incId: string, actor: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => log(i, { type: 'stakeholder', actor, source: 'Comms Hub', text: `${actor} joined the bridge (${i.bridge})`, to: '/comms/bridges' })));
  },

  /* ---- Stakeholders ---- */
  addStakeholder(c: CustomerProfile, incId: string, st: Omit<Stakeholder, 'id'>, actor: string) {
    mutate(c, (s) => {
      const s2 = patchInc(s, incId, (i) => log({ ...i, stakeholders: [...i.stakeholders, { ...st, id: `SH-${i.stakeholders.length + 1}-${Date.now().toString(36).slice(-3)}` }] }, { type: 'stakeholder', actor, source: 'HexaView IR', text: `Stakeholder added: ${st.name} (${st.kind}) as ${st.raci} · ${st.incidentRole}`, to: '/incident-response/stakeholders' }));
      return guideDone(s2, incId, 2);
    });
  },
  notify(c: CustomerProfile, incId: string, ids: string[], channel: string, actor: string) {
    mutate(c, (s) => {
      const now = Date.now();
      const s2 = patchInc(s, incId, (i) => {
        const names = i.stakeholders.filter((x) => ids.includes(x.id)).map((x) => x.name);
        if (!names.length) return i;
        return log({ ...i, stakeholders: i.stakeholders.map((x) => (ids.includes(x.id) ? { ...x, notifiedAt: now, channel } : x)) }, { type: 'stakeholder', actor, source: 'Comms Hub', text: `Notified via ${channel}: ${names.join(', ')}`, to: '/comms/inbox' });
      });
      return guideDone(s2, incId, 2);
    });
  },
  ack(c: CustomerProfile, incId: string, id: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => {
      const p = i.stakeholders.find((x) => x.id === id);
      if (!p) return i;
      return log({ ...i, stakeholders: i.stakeholders.map((x) => (x.id === id ? { ...x, ackAt: Date.now(), notifiedAt: x.notifiedAt ?? Date.now() } : x)) }, { type: 'stakeholder', actor: p.name, source: 'Comms Hub', text: `${p.name} acknowledged and joined` });
    }));
  },
  setFlags(c: CustomerProfile, incId: string, id: string, f: Partial<Pick<Stakeholder, 'raci' | 'privileged' | 'nda'>>, actor: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => {
      const p = i.stakeholders.find((x) => x.id === id);
      if (!p) return i;
      const what = f.raci ? `RACI → ${f.raci}` : f.privileged !== undefined ? `privilege ${f.privileged ? 'on' : 'off'}` : `NDA ${f.nda ? 'on file' : 'removed'}`;
      return log({ ...i, stakeholders: i.stakeholders.map((x) => (x.id === id ? { ...x, ...f } : x)) }, { type: 'stakeholder', actor, source: 'HexaView IR', text: `${p.name}: ${what}` });
    }));
  },

  /* ---- Timeline ---- */
  addEntry(c: CustomerProfile, incId: string, e: { type: TlType; text: string; key: boolean; evidence?: string[] }, actor: string) {
    mutate(c, (s) => {
      const s2 = patchInc(s, incId, (i) => log(i, { type: e.type, actor, source: 'HexaView IR (manual)', text: e.text, key: e.key, evidence: e.evidence }));
      return guideDone(s2, incId, 3);
    });
  },
  toggleKey(c: CustomerProfile, incId: string, entryId: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => ({ ...i, timeline: i.timeline.map((e: TimelineEntry) => (e.id === entryId ? { ...e, key: !e.key } : e)) })));
  },

  /* ---- Playbooks ---- */
  toggleCheck(c: CustomerProfile, incId: string, itemId: string, actor: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => {
      const pb = playbookFor(i.type, irTools(c));
      const item = PHASES.flatMap((p) => pb[p]).find((x) => x.id === itemId);
      const checks = { ...i.checks };
      const on = !checks[itemId];
      if (on) checks[itemId] = { t: Date.now(), by: actor };
      else delete checks[itemId];
      return log({ ...i, checks }, { type: 'note', actor, source: 'IR Playbooks', text: `Playbook step ${on ? 'completed' : 'reopened'}: ${item?.text ?? itemId}`, to: '/incident-response/playbooks' });
    }));
  },
  runAutomated(c: CustomerProfile, incId: string, itemId: string, actor: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => {
      const pb = playbookFor(i.type, irTools(c));
      const item = PHASES.flatMap((p) => pb[p]).find((x) => x.id === itemId);
      const next = { ...i, checks: { ...i.checks, [itemId]: { t: Date.now(), by: 'HexaSOC playbook' } } };
      return log(next, { type: 'automation', actor: 'HexaSOC playbook', source: 'HexaSOC Playbooks', text: `Automated step run (requested by ${actor}, approvals per risk class): ${item?.text ?? itemId}`, to: '/soc/playbooks' });
    }));
  },

  /* ---- Evidence ---- */
  addEvidence(c: CustomerProfile, incId: string, e: Omit<EvidenceItem, 'id' | 'sha256' | 'custody' | 't'>, actor: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => {
      const t = Date.now();
      const id = `${i.id}-E${i.evidence.length + 1}`;
      const hash = sha256(`${id}|${e.name}|${t}`);
      const item: EvidenceItem = { ...e, id, t, sha256: hash, custody: [{ t, from: e.tool, to: e.collectedBy, action: 'Collected; SHA-256 computed at source' }, { t: t + 1000, from: e.collectedBy, to: e.location, action: 'Sealed into the evidence vault' }] };
      return log({ ...i, evidence: [...i.evidence, item] }, { type: 'evidence', actor, source: e.tool, text: `${e.type} collected: ${e.name} · SHA-256 ${hash.slice(0, 12)}…`, evidence: [id], to: '/incident-response/evidence' });
    }));
  },
  transfer(c: CustomerProfile, incId: string, evId: string, to: string, action: string, actor: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => {
      const e = i.evidence.find((x) => x.id === evId);
      if (!e) return i;
      const from = e.custody[e.custody.length - 1]?.to ?? e.location;
      return log({ ...i, evidence: i.evidence.map((x) => (x.id === evId ? { ...x, custody: [...x.custody, { t: Date.now(), from, to, action }] } : x)) }, { type: 'evidence', actor, source: 'HexaCustody', text: `Custody transfer ${e.id}: ${from} → ${to} (${action}); hash re-verified`, evidence: [evId], to: '/custody/evidence' });
    }));
  },
  legalHold(c: CustomerProfile, incId: string, evId: string, on: boolean, actor: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => {
      const e = i.evidence.find((x) => x.id === evId);
      if (!e) return i;
      return log({ ...i, evidence: i.evidence.map((x) => (x.id === evId ? { ...x, legalHold: on } : x)) }, { type: 'evidence', actor, source: 'HexaCustody', text: `Legal hold ${on ? 'placed on' : 'released from'} ${e.name}`, evidence: [evId] });
    }));
  },

  /* ---- Notifications ---- */
  approveNotice(c: CustomerProfile, incId: string, nId: string, actor: string) {
    mutate(c, (s) => {
      const s2 = patchInc(s, incId, (i) => {
        const n = i.notices.find((x) => x.id === nId);
        if (!n || n.status !== 'draft') return i;
        return log({ ...i, notices: i.notices.map((x) => (x.id === nId ? { ...x, status: 'approved' as const, approvedBy: actor, approvedAt: Date.now() } : x)) }, { type: 'notification', actor, source: 'HexaView IR', text: `Approved: ${n.name} → ${n.recipient}`, to: '/incident-response/notifications' });
      });
      return guideDone(s2, incId, 4);
    });
  },
  sendNotice(c: CustomerProfile, incId: string, nId: string, actor: string) {
    mutate(c, (s) => {
      const s2 = patchInc(s, incId, (i) => {
        const n = i.notices.find((x) => x.id === nId);
        if (!n || n.status === 'sent') return i;
        return log({ ...i, notices: i.notices.map((x) => (x.id === nId ? { ...x, status: 'sent' as const, approvedBy: x.approvedBy ?? actor, approvedAt: x.approvedAt ?? Date.now(), sentAt: Date.now() } : x)) }, { type: 'notification', actor, source: 'Comms Hub', text: `Sent: ${n.name} → ${n.recipient} via ${n.channel}`, key: n.kind === 'regulator', to: '/comms/inbox' });
      });
      return guideDone(s2, incId, 4);
    });
  },
  notApplicable(c: CustomerProfile, incId: string, nId: string, actor: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => {
      const n = i.notices.find((x) => x.id === nId);
      if (!n) return i;
      return log({ ...i, notices: i.notices.map((x) => (x.id === nId ? { ...x, status: 'na' as const } : x)) }, { type: 'notification', actor, source: 'HexaView IR', text: `Marked not required: ${n.name} (threshold assessment recorded)` });
    }));
  },

  /* ---- Report ---- */
  setReport(c: CustomerProfile, incId: string, r: Partial<ReportState>) {
    mutate(c, (s) => patchInc(s, incId, (i) => ({ ...i, report: { ...i.report, ...r } })));
  },
  generate(c: CustomerProfile, incId: string, actor: string) {
    mutate(c, (s) => {
      const s2 = patchInc(s, incId, (i) => {
        const report: ReportState = { ...i.report, status: 'generated', version: i.report.version + 1, generatedAt: Date.now(), requestedAt: undefined, legal: undefined, ciso: undefined, issuedAt: undefined, hash: undefined };
        return log({ ...i, report }, { type: 'report', actor, source: 'HexaView Reporting', text: `Incident report v${report.version} generated for ${report.audience} (${report.sections.length} sections: ${report.sections.map((x) => IR_SECTIONS.find((y) => y.id === x)?.label).join(', ')})`, to: '/incident-response/report' });
      });
      return s2;
    });
  },
  requestSignoff(c: CustomerProfile, incId: string, actor: string, note: string) {
    mutate(c, (s) => {
      const ppl = irPeople(c);
      const s2 = patchInc(s, incId, (i) => log({ ...i, report: { ...i.report, status: 'requested', requestedAt: Date.now() } }, { type: 'report', actor, source: 'HexaView Reporting', text: `Sign-off requested from ${ppl.legal.name} (legal) and ${ppl.ciso.name} (CISO)${note ? `: "${note}"` : ''}` }));
      return s2;
    });
  },
  sign(c: CustomerProfile, incId: string, who: 'legal' | 'ciso', name: string) {
    mutate(c, (s) => {
      const s2 = patchInc(s, incId, (i) => {
        const report = { ...i.report, [who]: { name, t: Date.now() } } as ReportState;
        if (report.legal && report.ciso) { report.status = 'signed'; report.hash = sha256(`${i.id}|v${report.version}|${report.legal.name}|${report.ciso.name}|${report.ciso.t}`); }
        return log({ ...i, report }, { type: 'report', actor: name, source: 'HexaView Reporting', text: `${who === 'legal' ? 'Legal' : 'CISO'} sign-off on report v${report.version} by ${name}${report.status === 'signed' ? ' · DRAFT watermark removed' : ''}`, key: report.status === 'signed' });
      });
      const inc = s2.incidents.find((i) => i.id === incId);
      return inc && (inc.report.status === 'signed' || inc.report.status === 'issued') ? guideDone(s2, incId, 5) : s2;
    });
  },
  issue(c: CustomerProfile, incId: string, actor: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => log({ ...i, report: { ...i.report, status: 'issued', issuedAt: Date.now() } }, { type: 'report', actor, source: 'HexaView Reporting', text: `Report v${i.report.version} issued to ${i.report.audience} · SHA-256 ${(i.report.hash ?? '').slice(0, 12)}… anchored to the audit ledger`, key: true, to: '/ops/audit' })));
  },

  /* ---- Review ---- */
  scheduleReview(c: CustomerProfile, incId: string, whenMin: number, actor: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => log({ ...i, review: { ...i.review, status: 'scheduled', scheduledAt: Date.now() + whenMin * MIN } }, { type: 'note', actor, source: 'HexaView IR', text: `Post-incident review scheduled (facilitator ${i.review.facilitator})`, to: '/incident-response/review' })));
  },
  setReview(c: CustomerProfile, incId: string, patch: Partial<IrIncident['review']>) {
    mutate(c, (s) => patchInc(s, incId, (i) => ({ ...i, review: { ...i.review, ...patch } })));
  },
  completeReview(c: CustomerProfile, incId: string, actor: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => log({ ...i, review: { ...i.review, status: 'complete', completedAt: Date.now() } }, { type: 'report', actor, source: 'HexaView IR', text: `Post-incident review completed; ${i.review.actions.length} actions`, key: true, to: '/incident-response/review' })));
  },
  addAction(c: CustomerProfile, incId: string, a: { title: string; owner: string; dueDays: number; dest: ActionDest }, actor: string) {
    mutate(c, (s) => patchInc(s, incId, (i) => {
      const action: ReviewAction = { id: `${i.id}-R${i.review.actions.length + 1}`, title: a.title, owner: a.owner, dueAt: Date.now() + a.dueDays * 1440 * MIN, dest: a.dest, pushed: false };
      return log({ ...i, review: { ...i.review, status: i.review.status === 'complete' ? 'complete' : 'in_progress', actions: [...i.review.actions, action] } }, { type: 'note', actor, source: 'HexaView IR', text: `Review action added: ${a.title} · ${a.owner}` });
    }));
  },
  pushAction(c: CustomerProfile, incId: string, aId: string, actor: string): string | null {
    let ref: string | null = null;
    mutate(c, (s) => patchInc(s, incId, (i) => {
      const a = i.review.actions.find((x) => x.id === aId);
      if (!a || a.pushed) return i;
      const n = 1000 + ((parseInt(sha256(a.id).slice(0, 4), 16) % 900) + i.review.actions.length);
      ref = a.dest === 'comply' ? `TSK-${n}` : a.dest === 'programme' ? `INI-${n % 100}` : a.dest === 'detection' ? `DET-${n % 900}` : `EX-${n % 80}`;
      return log({ ...i, review: { ...i.review, actions: i.review.actions.map((x) => (x.id === aId ? { ...x, pushed: true, ref: ref ?? undefined } : x)) } }, { type: 'automation', actor, source: DEST_META[a.dest].label, text: `Action pushed to ${DEST_META[a.dest].label} as ${ref}: ${a.title}`, to: DEST_META[a.dest].to });
    }));
    return ref;
  },

  /** Find or create the L4 escalation for a HexaSOC case; returns where to go. */
  escalateSoc(c: CustomerProfile, socId: string): { esc?: string; inc?: string } {
    const s0 = load(c);
    const inc = s0.incidents.find((i) => i.socId === socId);
    if (inc) return { inc: inc.id };
    const ex = s0.escalations.find((e) => e.socId === socId);
    if (ex) return ex.incidentId ? { inc: ex.incidentId } : { esc: ex.id };
    const esc = escalationFromSoc(c, socId, s0.seq + s0.escalations.length);
    if (!esc) return {};
    mutate(c, (s) => ({ ...s, escalations: [esc, ...s.escalations] }));
    return { esc: esc.id };
  },

  /* ---- Guided scenario ---- */
  startGuided(c: CustomerProfile): string {
    let escId = '';
    mutate(c, (s) => {
      const esc: Escalation = guidedEscalation(c, s.seq + s.escalations.length);
      escId = esc.id;
      const escalations = [esc, ...s.escalations.filter((e) => e.id !== esc.id)];
      return { ...s, escalations, guided: { step: 0, escalationId: esc.id, incidentId: null } };
    });
    return escId;
  },
  setGuidedStep(c: CustomerProfile, step: number) {
    mutate(c, (s) => (s.guided ? { ...s, guided: { ...s.guided, step } } : s));
  },
  exitGuided(c: CustomerProfile) {
    mutate(c, (s) => ({ ...s, guided: null }));
  },
};

export type IrActions = typeof ir;
export { MIN };
