import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Building2, Check, ChevronDown, Factory, Fingerprint, KeyRound, Loader2, Lock, RefreshCcw, Server, ShieldCheck } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { CUSTOMER_LIST } from '../../data/customers';
import { resilienceIndex } from '../../data/core';
import { ROLES, ROLE_BY_ID, initialsOf } from '../../modules/roles';
import { MODULES } from '../../modules/registry';
import type { CustomerId, Persona } from '../../data/types';
import { BrandMark } from '../../components/BrandMark';
import { APP_VERSION } from '../../version';
import { usePublishedBrand } from '../whitelabel/brand';
import './auth.css';
import { CustomerLogo } from '../../components/CustomerLogo';

export const SESSION_KEY = 'hv.session';

/** Hero statements from the HexaView messaging pack, one per angle (first is the recommended lead). */
const HERO = [
  { angle: 'Visibility', line: 'Every security tool you run, in one pane you control.' },
  { angle: 'Proof', line: 'Turn a compliance control into a live, validated defence.' },
  { angle: 'Control', line: 'Not another dashboard. A console that writes back.' },
  { angle: 'Assurance', line: 'Know your security works. Prove it in one view.' },
];

export function isSignedIn(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return true; }
}
export function signOut() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* storage unavailable */ }
}

type Method = 'sso' | 'passkey';
type Idp = 'entra' | 'okta';
const IDP_NAME: Record<Idp, string> = { entra: 'Microsoft Entra ID', okta: 'Okta' };
type Phase = 'form' | 'auth' | 'enter';

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function SignIn() {
  const { customer, persona, setCustomerId, setPersona, setAccount, setTenantId } = useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get('next');
  const [orgOpen, setOrgOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [method, setMethod] = useState<Method>('sso');
  const [step, setStep] = useState(0);
  const role = ROLE_BY_ID[persona] ?? ROLE_BY_ID.master;
  const person = role.person(customer);
  const ids = customer.connectors.filter((k) => k.category === 'Identity');
  const idpConn = ids.find((k) => /Entra|Okta|Workforce|Ping/i.test(`${k.vendor} ${k.product}`)) ?? ids[0];
  // Both enterprise IdPs are offered; the customer's own one is highlighted and used by Enter.
  const homeIdp: Idp = idpConn && /okta|workforce/i.test(`${idpConn.vendor} ${idpConn.product}`) ? 'okta' : 'entra';
  const [chosenIdp, setChosenIdp] = useState<Idp>(homeIdp);
  const idp = IDP_NAME[chosenIdp];
  const ri = resilienceIndex(customer, 'all').value;
  const region = customer.hq.split(',').slice(-1)[0]?.trim() ?? '';
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const steps = useMemo(() => [
    method === 'sso'
      ? { icon: KeyRound, text: `Redirecting to ${idp} for ${customer.domain}`, done: `Signed in with ${idp} single sign-on` }
      : { icon: Fingerprint, text: 'Waiting for your passkey', done: 'Passkey verified (FIDO2, device-bound)' },
    { icon: ShieldCheck, text: 'Checking device and session policy', done: `Device compliant · MFA satisfied · ${region}` },
    { icon: Building2, text: `Opening ${customer.short} · ${customer.tenants.length} tenants`, done: `${customer.tenants.length} tenants · ${customer.dataPlanes.length} data planes · ${customer.connectors.length} integrations` },
    { icon: Lock, text: 'Applying your role and licence', done: `${role.label} · ${role.licence} licence` },
    { icon: Check, text: 'Computing your Resilience Index', done: `Resilience Index ${ri} · ready` },
  ], [method, idp, customer, region, role, ri]);

  const start = (m: Method, via?: Idp) => {
    if (phase !== 'form') return;
    if (via) setChosenIdp(via);
    setMethod(m);
    setPhase('auth');
    setStep(0);
    const fast = reduced();
    const gaps = fast ? [80, 80, 80, 80, 80] : [m === 'passkey' ? 1300 : 1100, 650, 700, 550, 750];
    let t = 0;
    gaps.forEach((g, i) => {
      t += g;
      timers.current.push(window.setTimeout(() => setStep(i + 1), t));
    });
    timers.current.push(window.setTimeout(() => setPhase('enter'), t + (fast ? 50 : 450)));
    timers.current.push(window.setTimeout(() => {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* storage unavailable */ }
      setAccount('customer');
      setTenantId('all');
      nav(next && next.startsWith('/') && !next.startsWith('/signin') ? next : role.landing, { replace: true });
    }, t + (fast ? 100 : 1500)));
  };

  // Enter starts SSO, the presenter's quickest path.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && phase === 'form' && !(e.target instanceof HTMLSelectElement)) start('sso', homeIdp);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // A published partner white-label replaces HexaView's own messaging here.
  const wl = usePublishedBrand();
  const dots = MODULES.filter((m) => m.group !== 'partner' && m.group !== 'overview');
  const [hero, setHero] = useState(0);
  const [pause, setPause] = useState(false);
  useEffect(() => {
    if (pause || reduced()) return;
    const t = setInterval(() => setHero((h) => (h + 1) % HERO.length), 6000);
    return () => clearInterval(t);
  }, [pause]);

  return (
    <div className={`auth ${phase}`}>
      <Backdrop />
      <div className="auth-version" title={`HexaView version ${APP_VERSION}`}>v{APP_VERSION}</div>

      <div className="auth-side">
        <BrandMark className="auth-logo" large />
        {!wl && <span className="auth-slogan">The trust console. Visibility you can act on.</span>}
        <div className="auth-hero" onMouseEnter={() => setPause(true)} onMouseLeave={() => setPause(false)}>
          <h1 key={wl ? 'wl' : hero}>{wl ? wl.loginHeadline : HERO[hero].line}</h1>
          {!wl && <div className="auth-angles" role="tablist" aria-label="Hero statements">
            {HERO.map((x, i) => (
              <button key={x.angle} role="tab" aria-selected={i === hero} className={i === hero ? 'on' : ''} onClick={() => setHero(i)}>
                <i />{x.angle}
              </button>
            ))}
          </div>}
        </div>
        <p>{wl ? wl.loginSub : 'The trust console for security: one bidirectional pane over every tool you run, across IT and OT, that lets you see your posture, act on it, and prove it works.'}</p>
        <div className="auth-dots">
          <span className="auth-dot-row">
            {dots.map((m, i) => (
              <i key={m.id} title={m.product} style={{ '--c': m.tone, animationDelay: `${i * 0.18}s` } as CSSProperties} />
            ))}
          </span>
          <span className="auth-dots-cap">One pane. Every function. Full control.</span>
        </div>
        <div className="auth-trust">
          <span><RefreshCcw size={13} /> Two-way control</span>
          <span><Factory size={13} /> IT and OT together</span>
          <span><Server size={13} /> SaaS, dedicated, customer-hosted or air-gapped</span>
        </div>
        {wl ? (
          <div className="auth-brand">
            <span>{wl.productName} · <b>{wl.domain}</b></span>
            {wl.poweredBy && <em>Powered by HexaShield</em>}
          </div>
        ) : <div className="auth-brand">
          <span>A platform by HexaShield · <b>Cyber Resilience. Trusted Partner.</b></span>
          <em>Integrated, not assembled.</em>
        </div>}
      </div>

      <div className="auth-card-wrap">
        <div className="auth-card">
          {phase === 'form' ? (
            <>
              <div className="auth-card-head">
                <h2>Sign in to HexaView</h2>
                <span>Trust Console</span>
              </div>

              <label className="auth-label">Organisation</label>
              <div className="auth-org">
                <button className="auth-org-btn" onClick={() => setOrgOpen((o) => !o)} aria-expanded={orgOpen}>
                  <CustomerLogo c={customer} size={34} radius={9} />
                  <span className="auth-org-meta">
                    <b>{customer.name}</b>
                    <small>{customer.domain} · {customer.sector}</small>
                  </span>
                  <ChevronDown size={15} />
                </button>
                {orgOpen && (
                  <div className="auth-org-list" role="listbox">
                    {CUSTOMER_LIST.map((c) => (
                      <button key={c.id} role="option" aria-selected={c.id === customer.id} onClick={() => { setCustomerId(c.id as CustomerId); setOrgOpen(false); }}>
                        <CustomerLogo c={c} size={28} radius={8} />
                        <span className="auth-org-meta"><b>{c.name}</b><small>{c.domain}</small></span>
                        {c.id === customer.id && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <label className="auth-label" htmlFor="auth-role">Sign in as</label>
              <div className="auth-who">
                <span className="auth-av" style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}>{initialsOf(person.name)}</span>
                <span className="auth-org-meta">
                  <b>{person.name}</b>
                  <small>{person.email}</small>
                </span>
              </div>
              <select id="auth-role" className="auth-select" value={persona} onChange={(e) => setPersona(e.target.value as Persona)}>
                {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>

              <div className="auth-idps">
                {(homeIdp === 'okta' ? (['okta', 'entra'] as Idp[]) : (['entra', 'okta'] as Idp[])).map((id) => (
                  <button key={id} className={id === homeIdp ? 'auth-primary auth-idp' : 'auth-secondary auth-idp'} onClick={() => start('sso', id)}>
                    <IdpMark id={id} />
                    <span className="auth-idp-txt">
                      <b>Continue with {IDP_NAME[id]}</b>
                      {id === homeIdp && <small>{customer.short}'s identity provider</small>}
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
              <div className="auth-or"><span>or</span></div>
              <button className="auth-secondary" onClick={() => start('passkey')}>
                <Fingerprint size={16} /> Sign in with a passkey
              </button>

              <p className="auth-fine">
                Access is governed by {customer.short}'s identity provider and conditional access. Sessions time out after 30 minutes idle. Demo environment with illustrative data.
              </p>
            </>
          ) : (
            <div className="auth-progress">
              <div className={`auth-badge ${method}`}>
                {method === 'passkey' ? <Fingerprint size={34} /> : <KeyRound size={30} />}
                <span className="auth-badge-ring" />
              </div>
              <h2>{step >= steps.length ? `Welcome, ${person.name.split(' ')[0]}` : method === 'passkey' ? 'Verifying your passkey' : `Signing in with ${idp}`}</h2>
              <span className="auth-sub">{customer.name}</span>
              <ol className="auth-steps">
                {steps.map((s, i) => {
                  const Icon = s.icon;
                  const state = i < step ? 'done' : i === step ? 'now' : 'todo';
                  return (
                    <li key={i} className={state}>
                      <span className="auth-step-ico">{state === 'done' ? <Check size={13} /> : state === 'now' ? <Loader2 size={13} className="spin" /> : <Icon size={13} />}</span>
                      <span>{state === 'done' ? s.done : s.text}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="auth-bar"><i style={{ width: `${(step / steps.length) * 100}%` }} /></div>
            </div>
          )}
        </div>
        <div className="auth-foot">{wl ? `Help: ${wl.supportEmail} · Demo environment, illustrative data` : 'HexaView™ Trust Console · Demo environment, illustrative data'}</div>
      </div>

      {phase === 'enter' && (
        <div className="auth-enter" aria-hidden>
          <div className="auth-enter-hex">
            <svg viewBox="0 0 120 120" width="120" height="120">
              <defs>
                <linearGradient id="auth-hexg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient>
              </defs>
              <path d="M60 6 L106.8 33 L106.8 87 L60 114 L13.2 87 L13.2 33 Z" fill="none" stroke="url(#auth-hexg)" strokeWidth="6" strokeLinejoin="round" className="auth-enter-path" />
            </svg>
            <b>{ri}</b>
          </div>
        </div>
      )}
    </div>
  );
}

const WAVE_S = 10;

/** Simple marks for the two identity providers (drawn inline, no external assets). */
function IdpMark({ id }: { id: Idp }) {
  if (id === 'entra') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <rect x="1" y="1" width="8.5" height="8.5" fill="#f25022" /><rect x="10.5" y="1" width="8.5" height="8.5" fill="#7fba00" />
        <rect x="1" y="10.5" width="8.5" height="8.5" fill="#00a4ef" /><rect x="10.5" y="10.5" width="8.5" height="8.5" fill="#ffb900" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="8.6" fill="#ffffff" /><circle cx="10" cy="10" r="6.2" fill="none" stroke="#007dc1" strokeWidth="3.4" />
    </svg>
  );
}

/** Honeycomb with a band of light rolling across it in a gentle wave. */
function Backdrop() {
  const cells = useMemo(() => {
    const R = 34;
    const w = Math.sqrt(3) * R;
    const out: { d: string; delay: number }[] = [];
    for (let row = -1; row < 18; row++) {
      for (let col = -1; col < 28; col++) {
        const cx = col * w + (row % 2 ? w / 2 : 0);
        const cy = row * R * 1.5;
        const r = R - 3;
        const pts = Array.from({ length: 6 }, (_, k) => {
          const ang = (Math.PI / 3) * k - Math.PI / 2;
          return `${(cx + r * Math.cos(ang)).toFixed(1)},${(cy + r * Math.sin(ang)).toFixed(1)}`;
        });
        // Wave front: left to right, bowed by a slow sine so it reads as a wave, not a wipe.
        const front = (cx + 150 * Math.sin(cy / 170)) / 1600;
        out.push({ d: `M${pts.join('L')}Z`, delay: front * WAVE_S });
      }
    }
    return out;
  }, []);
  const motion = !reduced();
  return (
    <svg className="auth-bg" viewBox="0 0 1500 820" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id="auth-glow" cx="30%" cy="40%" r="65%">
          <stop offset="0" stopColor="#1d4ed8" stopOpacity=".32" />
          <stop offset="1" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="auth-beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2dd4bf" stopOpacity="0" />
          <stop offset=".5" stopColor="#2dd4bf" stopOpacity=".1" />
          <stop offset="1" stopColor="#2dd4bf" stopOpacity="0" />
        </linearGradient>
        <filter id="auth-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="30" /></filter>
      </defs>
      <rect width="1500" height="820" fill="url(#auth-glow)" />
      {motion && (
        <g className="auth-beam-g">
          <rect x="-420" y="-200" width="420" height="1220" fill="url(#auth-beam)" filter="url(#auth-blur)" transform="skewX(-12)" className="auth-beam" />
        </g>
      )}
      <g className={motion ? 'auth-comb wave' : 'auth-comb'}>
        {cells.map((c, i) => (
          <path key={i} d={c.d} className="auth-cell" style={motion ? { animationDelay: `${c.delay.toFixed(2)}s, ${(c.delay + WAVE_S / 2).toFixed(2)}s` } : undefined} />
        ))}
      </g>
    </svg>
  );
}
