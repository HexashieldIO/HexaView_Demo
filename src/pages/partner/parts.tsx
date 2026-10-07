import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import './partner.css';
import { useApp } from '../../state/AppContext';
import { CAP_LIST, MODE_COLOR, type ModMode, type PartnerClient } from '../../data/modules/partner';
import type { CapabilityId } from '../../data/types';
import { fmtMoney } from '../../lib/format';
import { CustomerLogo } from '../../components/CustomerLogo';

export const PT_TONE = 'var(--m-partner)';
export const money = (n: number) => fmtMoney(n, 'USD');
export const moneyFull = (n: number) => fmtMoney(Math.round(n), 'USD', false);

export function ClientAvatar({ c, size = 30 }: { c: Pick<PartnerClient, 'initials' | 'colour'> & { demoId?: PartnerClient['demoId'] }; size?: number }) {
  if (c.demoId) return <CustomerLogo c={{ id: c.demoId, initials: c.initials, colour: c.colour }} size={size} radius={Math.round(size * 0.3)} />;
  return (
    <span className="pt-avatar" style={{ width: size, height: size, background: c.colour, fontSize: Math.round(size * 0.38) }}>
      {c.initials}
    </span>
  );
}

/** Product pills for every capability that is not switched off. */
export function ModPills({ modules, showOff }: { modules: Record<CapabilityId, ModMode>; showOff?: boolean }) {
  return (
    <span className="pt-mods">
      {CAP_LIST.filter((cap) => showOff || modules[cap.id] !== 'Off').map((cap) => (
        <span key={cap.id} className={`pt-mod ${modules[cap.id] === 'Advisory' || modules[cap.id] === 'Off' ? 'dim' : ''}`} style={{ '--tone': cap.tone } as CSSProperties} title={`${cap.product}: ${modules[cap.id]}`}>
          {cap.product}
        </span>
      ))}
    </span>
  );
}
export function CapPills({ caps }: { caps: CapabilityId[] }) {
  return (
    <span className="pt-mods">
      {caps.map((id) => {
        const cap = CAP_LIST.find((x) => x.id === id)!;
        return <span key={id} className="pt-mod" style={{ '--tone': cap.tone } as CSSProperties}>{cap.product}</span>;
      })}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: ModMode }) {
  return (
    <span className="badge" style={{ '--tone': MODE_COLOR[mode] } as CSSProperties}>
      {mode}
    </span>
  );
}

export function Toggle({ on, onChange, disabled, title }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; title?: string }) {
  return <button type="button" className={`pt-toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} disabled={disabled} title={title} aria-pressed={on} />;
}

export function Field({ label, hint, children, full }: { label: ReactNode; hint?: ReactNode; children: ReactNode; full?: boolean }) {
  return (
    <div className={`pt-field ${full ? 'full' : ''}`}>
      <span className="pt-label">{label}</span>
      {children}
      {hint && <span className="pt-hint">{hint}</span>}
    </div>
  );
}

export function Seg<T extends string>({ options, value, onChange }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <span className="pt-seg">
      {options.map((o) => (
        <button key={o.id} type="button" className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </span>
  );
}

export function Steps({ steps, step, failed, compact }: { steps: string[]; step: number; failed?: boolean; compact?: boolean }) {
  return (
    <div>
      <div className="pt-steps">
        {steps.map((s, i) => (
          <div key={s} className={`pt-step ${i < step ? 'done' : i === step ? (failed ? 'fail cur' : 'cur') : ''}`} title={s}>
            <i />
            {!compact && <span>{s}</span>}
          </div>
        ))}
      </div>
      {compact && (
        <div style={{ fontSize: 10.5, marginTop: 3, color: failed ? 'var(--bad)' : 'var(--text-muted)' }}>
          {step >= steps.length ? 'Complete' : `Step ${step + 1} of ${steps.length}: ${steps[step]}`}
        </div>
      )}
    </div>
  );
}

/** Opens a client's own HexaView (demo customers only) at the Command Centre. */
export function useOpenClient() {
  const { setCustomerId, toast } = useApp();
  const nav = useNavigate();
  return (c: PartnerClient) => {
    if (c.demoId) {
      setCustomerId(c.demoId);
      nav('/');
      toast(`Viewing ${c.name} as ${'Northwind Cyber Partners'} (delegated partner access, audited)`);
    } else {
      toast(`${c.name} is a sample client in this build: open one of the five demo clients to see a full tenant.`);
    }
  };
}

const CAP_ABBR: Record<CapabilityId, string> = { soc: 'SOC', int: 'INT', strike: 'STR', ot: 'OT', comply: 'GRC', custody: 'CUS' };
/** Compact capability strip: filled = fully managed, outlined = co-managed, dashed = advisory, grey = off. */
export function ModDots({ modules }: { modules: Record<CapabilityId, ModMode> }) {
  return (
    <span className="pt-dots">
      {CAP_LIST.map((cap) => {
        const m = modules[cap.id];
        return (
          <span key={cap.id} className={`pt-dot pt-dot-${m === 'Fully managed' ? 'fm' : m === 'Co-managed' ? 'cm' : m === 'Advisory' ? 'adv' : 'off'}`} style={{ '--tone': cap.tone } as CSSProperties} title={`${cap.product}: ${m}`}>
            {CAP_ABBR[cap.id]}
          </span>
        );
      })}
    </span>
  );
}
