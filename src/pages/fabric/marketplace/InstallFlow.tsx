import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Circle, ArrowUpRight, Lock, KeyRound, Send } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { RISK_COLOR, type Listing } from '../../../data/modules/marketplace';
import { Badge, Btn, Callout, HealthBadge, cap } from '../../../components/ui';
import { Modal } from '../../../components/Overlay';
import { TONE } from '../parts';
import { addInstall, addRequest } from './store';
import { Monogram } from './parts';

type Step = 0 | 1 | 2 | 3;
const STEPS = ['Scope & data plane', 'Consent', 'Test connection', 'Connected'];

export function InstallFlow({ l, planeId, onClose, onDone }: { l: Listing; planeId: string; onClose: () => void; onDone?: () => void }) {
  const { customer: c, toast } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const otOnly = l.envs.every((e) => e === 'ot');
  const relevant = otOnly ? c.tenants.filter((t) => t.env.includes('ot')) : c.tenants;
  const [tenants, setTenants] = useState<string[]>(() => (relevant.length ? relevant : c.tenants).map((t) => t.id));
  const [plane, setPlane] = useState(planeId || c.dataPlanes[0]?.id || '');
  const [ack, setAck] = useState(false);
  const ot = l.envs.includes('ot') && l.envs.length === 1;
  const [writeOn, setWriteOn] = useState(false);
  const [checks, setChecks] = useState(0);
  const p = c.dataPlanes.find((x) => x.id === plane);

  const tests = [
    `Reach data plane "${p?.name ?? plane}" over mTLS`,
    `Resolve credential from ${p?.vault ?? 'vault'}`,
    `Authenticate to ${l.vendor === 'Generic' ? 'source' : l.vendor} (${l.methods[0]})`,
    `Verify scopes are least-privilege (${l.scopes.length} requested)`,
    'Contract test: recorded response schema',
    `Sample sync → ${l.ocsf[0] ?? 'OCSF'} mapping`,
  ];

  useEffect(() => {
    if (step !== 2) return;
    setChecks(0);
    const id = setInterval(() => setChecks((n) => n + 1), 620);
    return () => clearInterval(id);
  }, [step]);
  useEffect(() => {
    if (step === 2 && checks > tests.length) {
      addInstall(c, { listingId: l.id, name: l.name, tenants: tenants.length === c.tenants.length ? 'all' : tenants, dataPlaneId: plane, writeBack: writeOn, at: Date.now() });
      toast(`${l.name} connected — first sync scheduled on ${p?.name ?? plane}`);
      setStep(3);
      onDone?.();
    }
  }, [checks, step, tests.length, c, l, tenants, plane, writeOn, toast, p, onDone]);

  const toggle = (id: string) => setTenants((ts) => (ts.includes(id) ? ts.filter((x) => x !== id) : [...ts, id]));

  return (
    <Modal
      title={<span className="row" style={{ gap: 10 }}><Monogram l={l} size={30} /> Install {l.name}</span>}
      sub={`${l.category} · ${l.cert} · runs on your data plane`}
      onClose={onClose}
      footer={
        step === 0 ? (<><Btn onClick={onClose}>Cancel</Btn><Btn primary color={TONE} disabled={!tenants.length || !plane} onClick={() => setStep(1)}>Continue</Btn></>)
        : step === 1 ? (<><Btn onClick={() => setStep(0)}>Back</Btn><Btn primary color={TONE} disabled={!ack} onClick={() => setStep(2)}>Grant &amp; test connection</Btn></>)
        : step === 2 ? (<Btn disabled><Loader2 size={14} className="mkt-spin" /> Testing…</Btn>)
        : (<><Btn onClick={onClose}>Back to Marketplace</Btn><Btn primary color={TONE} onClick={() => { onClose(); nav('/fabric/integrations'); }}>Open in Integrations <ArrowUpRight size={13} /></Btn></>)
      }
    >
      <div className="mkt-steps">
        {STEPS.map((s, i) => (
          <span key={s} className={i < step ? 'done' : i === step ? 'cur' : ''}><i>{i < step ? <CheckCircle2 size={13} /> : i + 1}</i>{s}</span>
        ))}
      </div>

      {step === 0 && (
        <>
          <div>
            <div className="section-label">Tenants in scope</div>
            <div className="mkt-checks">
              {c.tenants.map((t) => (
                <label key={t.id} className={`mkt-check ${tenants.includes(t.id) ? 'on' : ''}`}>
                  <input type="checkbox" checked={tenants.includes(t.id)} onChange={() => toggle(t.id)} />
                  <span><b>{t.short}</b><em>{t.kind}</em></span>
                </label>
              ))}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              <Btn sm ghost onClick={() => setTenants(c.tenants.map((t) => t.id))}>Select all</Btn>
              <Btn sm ghost onClick={() => setTenants([])}>Clear</Btn>
            </div>
          </div>
          <div>
            <div className="section-label">Data plane (where the connector runs)</div>
            <div className="mkt-planes">
              {c.dataPlanes.map((d) => (
                <label key={d.id} className={`mkt-plane ${plane === d.id ? 'on' : ''}`}>
                  <input type="radio" name="mkt-plane" checked={plane === d.id} onChange={() => setPlane(d.id)} />
                  <span className="list-main"><b>{d.name}</b><span>{d.placement} · {d.region}</span></span>
                  <HealthBadge status={d.status} />
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <Callout kind="info">HexaView will request these scopes from {l.vendor === 'Generic' ? 'the source' : l.vendor}. The credential is stored in <b>{p?.vault ?? 'your vault'}</b> and never leaves {p?.name ?? 'the data plane'}.</Callout>
          <div className="list">
            {l.scopes.map((s) => (
              <div key={s} className="list-row">
                {s.includes('(gated)') ? <Lock size={14} style={{ color: 'var(--sev-medium)' }} /> : <KeyRound size={14} style={{ color: 'var(--m-core)' }} />}
                <span className="list-main"><b className="mono">{s.replace(' (gated)', '')}</b></span>
                <Badge color={s.includes('(gated)') ? 'var(--sev-medium)' : 'var(--m-core)'}>{s.includes('(gated)') ? 'Write · gated' : 'Read'}</Badge>
              </div>
            ))}
          </div>
          {l.write.length > 0 && !ot && (
            <label className={`mkt-check wide ${writeOn ? 'on' : ''}`}>
              <input type="checkbox" checked={writeOn} onChange={(e) => setWriteOn(e.target.checked)} />
              <span><b>Enable write-back now (optional)</b><em>{l.write.map((a) => `${a.name} (${cap(a.risk)})`).join(' · ')}. Every action still needs its approval gate.</em></span>
            </label>
          )}
          {ot && <Callout kind="warn">OT target: installed read-only by policy. No write scopes are requested.</Callout>}
          {l.write.length > 0 && !ot && (
            <div className="chips">{l.write.map((a) => <Badge key={a.name} color={RISK_COLOR[a.risk]}>{a.name} · {a.gate}</Badge>)}</div>
          )}
          <label className={`mkt-check wide ${ack ? 'on' : ''}`}>
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span><b>I consent to these scopes for {tenants.length} tenant{tenants.length > 1 ? 's' : ''}</b><em>Logged to the audit trail as {c.people.admin.name} ({c.people.admin.role}).</em></span>
          </label>
        </>
      )}

      {step >= 2 && (
        <div className="mkt-tests">
          {tests.map((t, i) => {
            const state = step === 3 || checks > i ? 'ok' : checks === i ? 'run' : 'wait';
            return (
              <div key={t} className={`mkt-test ${state}`}>
                {state === 'ok' ? <CheckCircle2 size={15} /> : state === 'run' ? <Loader2 size={15} className="mkt-spin" /> : <Circle size={15} />}
                <span>{t}</span>
                <em>{state === 'ok' ? `${80 + ((i * 137) % 400)} ms` : state === 'run' ? 'running' : ''}</em>
              </div>
            );
          })}
        </div>
      )}

      {step === 3 && (
        <Callout kind="good">
          <b>{l.name} is connected.</b> Scoped to {tenants.length === c.tenants.length ? 'all tenants' : tenants.map((id) => c.tenants.find((t) => t.id === id)?.short ?? id).join(', ')} on {p?.name}. First full sync is running; records appear in the canonical model within {Math.max(5, Math.round(l.setupMin / 4))} minutes. {writeOn ? 'Write-back enabled behind approval gates.' : 'Write-back is off until an admin opts in.'}
        </Callout>
      )}
    </Modal>
  );
}

export function RequestModal({ initial, onClose }: { initial?: string; onClose: () => void }) {
  const { customer: c, toast } = useApp();
  const [vendor, setVendor] = useState(initial ?? '');
  const [product, setProduct] = useState('');
  const [useCase, setUseCase] = useState('');
  const ok = vendor.trim().length > 1;
  const submit = () => {
    addRequest(c, { vendor: vendor.trim(), name: product.trim() || vendor.trim(), useCase: useCase.trim(), at: Date.now() });
    toast(`Integration request for ${vendor.trim()} sent to HexaShield product — typical turnaround 3–6 weeks, or use OCSF push today`);
    onClose();
  };
  return (
    <Modal title="Request an integration" sub="Tell HexaShield which tool you need; requests are prioritised by demand and certified before release." onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn primary color={TONE} disabled={!ok} onClick={submit}><Send size={13} /> Submit request</Btn></>}>
      <label className="mkt-field"><span>Vendor</span><input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Kongsberg" /></label>
      <label className="mkt-field"><span>Product</span><input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="e.g. K-Chief alarm & monitoring" /></label>
      <label className="mkt-field"><span>What should HexaView do with it?</span><textarea rows={3} value={useCase} onChange={(e) => setUseCase(e.target.value)} placeholder="Read alarms and asset inventory for HexaOT; evidence IACS E26 controls" /></label>
      <Callout kind="info">Need it sooner? Any tool that can emit syslog/CEF, webhooks or OCSF can be connected today through the Standards connectors, mapped on {c.dataPlanes[0]?.name ?? 'your data plane'}.</Callout>
    </Modal>
  );
}
