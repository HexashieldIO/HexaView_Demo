import type { Campaign } from '../../../data/modules/human';
import { fmtNum } from '../../../lib/format';

export function Funnel({ camp }: { camp: Pick<Campaign, 'sent' | 'opened' | 'clicked' | 'submitted' | 'reported'> }) {
  const steps = [
    { label: 'Sent', n: camp.sent, color: '#8a9bc0' },
    { label: 'Opened', n: camp.opened, color: '#68b1ff' },
    { label: 'Clicked', n: camp.clicked, color: '#f5a83d' },
    { label: 'Entered creds', n: camp.submitted, color: '#f8646f' },
    { label: 'Reported', n: camp.reported, color: '#2dd4bf' },
  ];
  const max = Math.max(1, camp.sent);
  return (
    <div className="hr-funnel">
      {steps.map((s) => (
        <div key={s.label} className="hr-fstep">
          <span>{s.label}</span>
          <span className="hr-fbar"><i style={{ width: `${Math.max(1.5, (s.n / max) * 100)}%`, background: s.color }} /></span>
          <b>{fmtNum(s.n)}<small>{s.label === 'Sent' ? '' : `${((s.n / max) * 100).toFixed(1)}%`}</small></b>
        </div>
      ))}
    </div>
  );
}

export function Stars({ n }: { n: number }) {
  return <span className="hr-stars" title={`Difficulty ${n} of 5`}>{'★'.repeat(n)}<i>{'★'.repeat(5 - n)}</i></span>;
}
