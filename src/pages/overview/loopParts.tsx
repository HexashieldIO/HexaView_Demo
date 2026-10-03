import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { BookOpen, ShieldCheck, FileCheck2, Crosshair, Radar, FlaskConical, Check, Loader2, Send, Sparkles, Clock } from 'lucide-react';
import { LINK_ORDER, type Loop, type LinkKey, type LinkState } from '../../data/core';
import type { CustomerProfile } from '../../data/types';
import { ruleSuggestions, siemFor, type RuleSuggestion } from '../../data/modules/comply';
import { Badge, Btn, Callout, KV, SectionLabel, hexPath } from '../../components/ui';
import { Modal } from '../../components/Overlay';
import { RequestEvidenceModal } from '../comply/parts';
import { useApp } from '../../state/AppContext';

export const LINK_ICON: Record<LinkKey, typeof BookOpen> = {
  requirement: BookOpen, control: ShieldCheck, evidence: FileCheck2, technique: Crosshair, detection: Radar, validation: FlaskConical,
};
export const LINK_STATE_COLOR: Record<LinkState | 'requested', string> = {
  ok: 'var(--good)', missing: 'var(--sev-medium)', stale: 'var(--sev-low)', failed: 'var(--bad)', requested: 'var(--m-matrix)',
};

function Hex({ color, children, size = 52 }: { color: string; children: ReactNode; size?: number }) {
  return (
    <div className="loop-hex" style={{ '--state': color, width: size, height: size } as CSSProperties}>
      <svg className="loop-hex-bg" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <path d={hexPath(size / 2, size / 2, size / 2 - 3)} fill={`color-mix(in srgb, ${color} 16%, transparent)`} stroke={color} strokeWidth={2} strokeLinejoin="round" />
      </svg>
      {children}
    </div>
  );
}

/** The six-link chain. With `loop`, each link shows its state, source, reference and age. */
export function LoopChain({ loop, compact, captions, evidenceRequested }: { loop?: Loop; compact?: boolean; captions?: Partial<Record<LinkKey, string>>; evidenceRequested?: boolean }) {
  return (
    <div>
      <div className={`loop-chain ${compact ? 'compact' : ''}`}>
        {LINK_ORDER.map((l, i) => {
          const Icon = LINK_ICON[l.key];
          const link = loop?.links[l.key];
          const state: LinkState | 'requested' = link ? (l.key === 'evidence' && evidenceRequested && link.state !== 'ok' ? 'requested' : link.state) : 'ok';
          const color = loop ? LINK_STATE_COLOR[state] : 'var(--m-view)';
          const next = LINK_ORDER[i + 1];
          const nextState = next && loop ? loop.links[next.key].state : 'ok';
          const linkColor = !loop ? 'color-mix(in srgb, var(--m-view) 55%, transparent)' : link?.state === 'ok' && nextState === 'ok' ? 'var(--good)' : 'var(--track)';
          return (
            <div key={l.key} className="loop-node" style={{ '--state': color, '--link-color': linkColor } as CSSProperties}>
              <Hex color={color} size={compact ? 40 : 52}><Icon /></Hex>
              <b>{l.label}</b>
              {loop && link ? (
                <>
                  <em>{state === 'ok' ? 'OK' : state === 'requested' ? 'Requested' : state.charAt(0).toUpperCase() + state.slice(1)}</em>
                  <span className="loop-ref">{link.ref}</span>
                  <small>{link.source}{link.daysAgo !== undefined ? ` · ${link.daysAgo} d` : ''}</small>
                </>
              ) : (
                <small>{captions?.[l.key] ?? l.from}</small>
              )}
            </div>
          );
        })}
      </div>
      {!compact && <div className="loop-return"><span>validation result feeds back into control assurance</span></div>}
    </div>
  );
}

type Stage = 'start' | 'suggest' | 'approval' | 'lifecycle' | 'validate' | 'validating' | 'done';
const LIFE = ['Signed', 'Dispatched', 'Applied', 'Verified'] as const;

/**
 * "Close the loop" guided workflow (LLD 7.4): suggest detections for the missing
 * technique, raise an action request, simulate approval and the action lifecycle,
 * then schedule a HexaStrike validation. Calls onClosed with the repaired loop.
 */
export function CloseLoopWizard({ c, loop, onClosed, onEvidenceRequested, evidenceRequested, onTransition }: {
  c: CustomerProfile;
  loop: Loop;
  onClosed: (l: Loop) => void;
  onEvidenceRequested: (due: string) => void;
  evidenceRequested: boolean;
  onTransition: (text: string) => void;
}) {
  const { toast } = useApp();
  const siem = siemFor(c);
  const needDetection = loop.links.detection.state === 'missing' || loop.links.detection.state === 'failed';
  const needValidation = needDetection || loop.links.validation.state !== 'ok';
  const needEvidence = loop.links.evidence.state === 'missing' || loop.links.evidence.state === 'stale';
  const needControl = loop.links.control.state === 'missing';
  const rules = useMemo(() => ruleSuggestions(c, loop.technique, loop.techniqueName), [c, loop.technique, loop.techniqueName]);
  const [stage, setStage] = useState<Stage>(needDetection ? 'start' : needValidation ? 'validate' : 'done');
  const [pick, setPick] = useState<RuleSuggestion>(rules[0]);
  const [modal, setModal] = useState(false);
  const [life, setLife] = useState(-1);
  const [evModal, setEvModal] = useState(false);
  const [actionId] = useState(() => `ACT-${Math.floor(Math.random() * 90000 + 10000)}`);
  const [fireSec] = useState(() => Math.floor(Math.random() * 50 + 12));
  const requester = c.people.socLead;
  const approver = c.people.ciso;

  // Action lifecycle ticks every ~1 s once approved.
  useEffect(() => {
    if (stage !== 'lifecycle') return;
    if (life >= LIFE.length - 1) {
      const t = setTimeout(() => {
        setStage('validate');
        onTransition(`Detection ${pick.id} applied and verified in ${siem.short}`);
      }, 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLife((x) => x + 1), 1000);
    return () => clearTimeout(t);
  }, [stage, life, pick.id, siem.short, onTransition]);

  useEffect(() => {
    if (stage !== 'validating') return;
    const t = setTimeout(() => {
      setStage('done');
      const fixed: Loop = {
        ...loop,
        links: {
          ...loop.links,
          detection: needDetection ? { state: 'ok', ref: `${siem.short} · ${pick.id}`, source: siem.short, daysAgo: 0 } : loop.links.detection,
          validation: { state: 'ok', ref: `VAL-${Math.floor(Math.random() * 90000 + 10000)}`, source: 'HexaStrike', daysAgo: 0 },
        },
      };
      const notOk = (Object.keys(fixed.links) as LinkKey[]).filter((k) => fixed.links[k].state !== 'ok');
      const stillMissing = notOk.filter((k) => fixed.links[k].state === 'missing');
      const closed = notOk.length === 0;
      onClosed({ ...fixed, status: closed ? 'closed' : stillMissing.length ? 'partial' : 'stale', missing: stillMissing, evaluatedMinAgo: 0 });
      toast(closed ? `Loop closed: ${loop.controlId} × ${loop.technique}. Detection fired in ${fireSec} s` : `Validation passed for ${loop.technique}; loop still waiting on ${notOk.join(', ')}`);
    }, 1800);
    return () => clearTimeout(t);
  }, [stage, loop, needDetection, pick.id, siem.short, onClosed, toast, fireSec]);

  const steps: { key: string; label: string; done: boolean; active: boolean }[] = [
    ...(needDetection ? [{ key: 'det', label: 'Deploy detection', done: ['validate', 'validating', 'done'].includes(stage), active: ['start', 'suggest', 'approval', 'lifecycle'].includes(stage) }] : []),
    ...(needValidation ? [{ key: 'val', label: 'Validate with HexaStrike', done: stage === 'done', active: stage === 'validate' || stage === 'validating' }] : []),
    ...(needEvidence ? [{ key: 'ev', label: 'Evidence from owner', done: evidenceRequested, active: !evidenceRequested }] : []),
  ];

  return (
    <div className="loop-wizard">
      <div className="row between wrap">
        <b style={{ fontSize: 13 }}><Sparkles size={14} style={{ verticalAlign: -2, color: 'var(--m-view)' }} /> Close the loop</b>
        <div className="loop-steps">
          {steps.map((s) => <span key={s.key} className={`loop-step ${s.done ? 'done' : s.active ? 'active' : ''}`}>{s.done ? <Check /> : <Clock />}{s.label}</span>)}
        </div>
      </div>

      {needControl && <Callout kind="warn">No control is mapped for this requirement yet. Map one in HexaComply first; the loop engine re-evaluates automatically.</Callout>}

      {needDetection && stage === 'start' && (
        <>
          <Callout kind="warn">
            <b>Missing detection.</b> No enabled rule in {siem.short} covers {loop.technique} ({loop.techniqueName}) for this tenant{loop.links.detection.state === 'failed' ? ' (the previous rule is disabled)' : ''}.
          </Callout>
          <div><Btn primary color="var(--m-view)" onClick={() => setStage('suggest')}><Sparkles /> Suggest detections</Btn></div>
        </>
      )}

      {stage === 'suggest' && (
        <>
          <SectionLabel>3 rules from the detection library for {loop.technique} · {siem.short} ({siem.lang})</SectionLabel>
          <div className="stack" style={{ gap: 8 }}>
            {rules.map((r) => (
              <button key={r.id} type="button" className={`loop-rule ${pick.id === r.id ? 'on' : ''}`} onClick={() => setPick(r)}>
                <div className="row between">
                  <b style={{ fontSize: 12.5 }}>{r.name}</b>
                  <span className="row" style={{ gap: 4 }}>
                    <Badge color={r.fidelity === 'High' ? 'var(--good)' : 'var(--sev-medium)'}>{r.fidelity} fidelity</Badge>
                    <Badge>~{r.fpPerWeek} FP/week</Badge>
                  </span>
                </div>
                <span className="muted" style={{ fontSize: 11 }}>{r.id} · {r.source} · {r.coverage} · data: {r.dataSources.join(', ')}</span>
                <pre>{r.query}</pre>
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Btn onClick={() => setStage('start')}>Back</Btn>
            <Btn primary color="var(--m-view)" onClick={() => setModal(true)}><Send /> Request deployment</Btn>
          </div>
        </>
      )}

      {stage === 'approval' && (
        <>
          <Callout>
            Action request <b className="mono">{actionId}</b> is waiting for approval from someone other than the requester. It expires in 24 h.
          </Callout>
          <KV rows={[['Action', 'deploy_scheduled_rule'], ['Rule', pick.id], ['Requested by', `${requester.name}`], ['Approver', `${approver.name} (${approver.role})`]]} />
          <div><Btn primary color="var(--m-view)" onClick={() => { setStage('lifecycle'); setLife(0); toast(`${approver.name} approved ${actionId}`); }}><Check /> Simulate approval by {approver.name.split(' ')[0]}</Btn></div>
        </>
      )}

      {(stage === 'lifecycle' || (needDetection && ['validate', 'validating', 'done'].includes(stage))) && (
        <div>
          <SectionLabel>Action {actionId} · deploy_scheduled_rule → {siem.short}</SectionLabel>
          <div className="loop-life">
            {LIFE.map((s, i) => {
              const done = stage !== 'lifecycle' || i < life || (i === life && life === LIFE.length - 1);
              const active = stage === 'lifecycle' && i === life && !done;
              return <div key={s} className={done ? 'done' : active ? 'active' : ''}>{done ? '✓ ' : ''}{s}</div>;
            })}
          </div>
        </div>
      )}

      {stage === 'validate' && (
        <>
          <Callout>
            Detection {needDetection ? 'deployed' : 'in place'}. Prove it works: HexaStrike emulates {loop.technique} on a safe test asset in this tenant and checks that {siem.short} raises an alert.
          </Callout>
          <div><Btn primary color="var(--m-view)" onClick={() => { setStage('validating'); onTransition(`HexaStrike validation scheduled for ${loop.technique}`); }}><FlaskConical /> Schedule HexaStrike validation</Btn></div>
        </>
      )}

      {stage === 'validating' && (
        <div className="row" style={{ gap: 8, fontSize: 12.5 }}>
          <Loader2 size={15} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          HexaStrike is running atomic test for {loop.technique} on {c.vocab.hostPrefix}-HV-TEST-01…
          <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
        </div>
      )}

      {stage === 'done' && needValidation && (
        <Callout kind="good">
          <b>Test passed.</b> {siem.short} alert fired {fireSec} s after the emulated {loop.techniqueName.toLowerCase()} and was auto-triaged by HexaSOC. Validation evidence attached to {loop.controlId}.
        </Callout>
      )}

      {needEvidence && (
        <div className="row between wrap" style={{ gap: 8 }}>
          <span style={{ fontSize: 12.5 }}>
            <b>Evidence {loop.links.evidence.state}.</b> {evidenceRequested ? `Requested from ${loop.owner}; the loop closes when it is approved.` : `Ask ${loop.owner} to provide fresh evidence for ${loop.controlId}.`}
          </span>
          {!evidenceRequested && <Btn sm onClick={() => setEvModal(true)}><Send /> Request evidence from owner</Btn>}
        </div>
      )}

      {modal && (
        <Modal
          title="Action request: deploy detection"
          sub={`Write-back to ${siem.name}`}
          onClose={() => setModal(false)}
          footer={
            <>
              <Btn onClick={() => setModal(false)}>Cancel</Btn>
              <Btn primary color="var(--m-view)" onClick={() => { setModal(false); setStage('approval'); onTransition(`Action ${actionId} requested: deploy ${pick.id}`); toast(`Action ${actionId} submitted for approval`); }}>Submit for approval</Btn>
            </>
          }
        >
          <div className="row wrap" style={{ gap: 8 }}>
            <Badge color="var(--sev-medium)" dot>Risk class: medium</Badge>
            <Badge color="var(--accent)">1 approver, not the requester</Badge>
            <Badge>Expires in 24 h</Badge>
          </div>
          <KV rows={[
            ['Action type', <span key="a" className="mono">deploy_scheduled_rule</span>],
            ['Target', `${siem.name} · ${c.tenants.find((t) => t.id === loop.tenantId)?.name}`],
            ['Rule', `${pick.name} (${pick.id})`],
            ['Language', pick.lang],
            ['Schedule', 'Every 5 min, look-back 15 min'],
            ['Severity on match', 'High · routes to HexaSOC'],
            ['Loop', `${loop.controlId} × ${loop.technique}`],
            ['Requester', `${requester.name} · ${requester.role}`],
            ['Eligible approvers', `${approver.name}, ${c.people.admin.name}`],
            ['Rollback', 'Disable rule (automatic if error rate > 5%)'],
          ]} />
          <pre className="comply-code" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'pre-wrap', margin: 0, padding: 10, border: '1px solid var(--card-border)', borderRadius: 8 }}>{pick.query}</pre>
        </Modal>
      )}

      {evModal && (
        <RequestEvidenceModal
          what={`Evidence for ${loop.control}`}
          owner={loop.owner}
          control={loop.controlId}
          onClose={() => setEvModal(false)}
          onDone={(due) => { onEvidenceRequested(due); onTransition(`Evidence requested from ${loop.owner} (due ${due} d)`); }}
        />
      )}
    </div>
  );
}
