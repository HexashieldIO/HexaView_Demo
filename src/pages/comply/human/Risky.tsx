import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { tenantName } from '../../../data/customers';
import { identitySource, type RiskyUser, type UserAction, type MfaState } from '../../../data/modules/human';
import { Badge, Btn, Card, KV, Ring, SectionLabel, Sources } from '../../../components/ui';
import { Drawer } from '../../../components/Overlay';
import { DataTable, type Column } from '../../../components/DataTable';
import { useApp } from '../../../state/AppContext';
import { WriteBackModal, SegBar } from '../parts';
import { useHr, riskColor, riskLabel } from './state';

const FACTORS: { id: string; label: string; test: (u: RiskyUser) => boolean }[] = [
  { id: 'submit', label: 'Entered credentials', test: (u) => u.submits12m > 0 },
  { id: 'repeat', label: 'Repeat clicker (3+)', test: (u) => u.clicks12m >= 3 },
  { id: 'training', label: 'Training overdue', test: (u) => u.training === 'Overdue' },
  { id: 'mfa', label: 'No or SMS-only MFA', test: (u) => u.mfa === 'None' || u.mfa === 'SMS' },
  { id: 'priv', label: 'Privileged access', test: (u) => u.privileged },
  { id: 'stealer', label: 'Infostealer hit', test: (u) => u.stealerHit },
  { id: 'incident', label: 'In a real incident', test: (u) => u.incidents.length > 0 },
];
const MFA_COLOR: Record<MfaState, string> = { 'Phishing-resistant': 'var(--good)', 'Push / app': 'var(--accent)', SMS: 'var(--sev-medium)', None: 'var(--bad)' };
const ACTION_RISK: Record<UserAction, 'low' | 'medium' | 'high'> = { 'Enrol in coaching': 'low', 'Assign micro-training': 'low', 'Manager conversation': 'low', 'Enforce MFA': 'medium', 'Remove standing admin': 'high' };

export function Risky() {
  const { c, users, depts, deptName, param, patch, applied, apply } = useHr();
  const { toast } = useApp();
  const factor = param('factor');
  const dept = param('dept');
  const id = param('id');
  const sel = id ? users.find((u) => u.id === id) : undefined;
  const [bulk, setBulk] = useState<UserAction | null>(null);
  const f = FACTORS.find((x) => x.id === factor);
  const rows = users.filter((u) => (!f || f.test(u)) && (!dept || u.deptId === dept));
  const bands = [
    { key: 'Critical', value: users.filter((u) => u.score >= 70).length, color: '#e0345e', label: 'Critical (70+)' },
    { key: 'High', value: users.filter((u) => u.score >= 55 && u.score < 70).length, color: '#f2643f', label: 'High (55–69)' },
    { key: 'Moderate', value: users.filter((u) => u.score < 55).length, color: '#f0a338', label: 'Moderate (<55)' },
  ];
  const bulkTargets = bulk ? rows.filter((u) => u.actions.includes(bulk) && !(applied[u.id] ?? []).includes(bulk)) : [];
  const maxF = Math.max(1, ...FACTORS.map((x) => users.filter(x.test).length));

  const cols: Column<RiskyUser>[] = [
    { key: 'n', header: 'Person', sort: (u) => u.name, render: (u) => (<><div className="t-main">{u.name}</div><div className="t-sub">{u.role} · {deptName(u.deptId)} · {tenantName(c, u.tenantId)}</div></>) },
    { key: 's', header: 'Risk', align: 'right', sort: (u) => u.score, render: (u) => <b style={{ color: riskColor(u.score), fontFamily: 'var(--font-display)', fontSize: 14 }}>{u.score}</b> },
    { key: 'p', header: 'Phishing 12m', sort: (u) => u.clicks12m * 10 + u.submits12m, render: (u) => <span style={{ fontSize: 12 }}>{u.clicks12m} clicked · <b style={{ color: u.submits12m ? 'var(--bad)' : undefined }}>{u.submits12m} creds</b> · {u.reports12m} reported</span> },
    { key: 't', header: 'Training', sort: (u) => u.training, render: (u) => <Badge color={u.training === 'Overdue' ? 'var(--sev-high)' : u.training === 'In progress' ? 'var(--sev-medium)' : 'var(--good)'}>{u.training}</Badge> },
    { key: 'm', header: 'MFA', sort: (u) => u.mfa, render: (u) => <Badge color={MFA_COLOR[u.mfa]} dot>{u.mfa}</Badge> },
    { key: 'f', header: 'Signals', render: (u) => <span className="row wrap" style={{ gap: 4 }}>{u.privileged && <Badge color="#a07cfb">Privileged</Badge>}{u.stealerHit && <Badge color="var(--bad)">Stealer</Badge>}{u.incidents.length > 0 && <Badge color="var(--sev-critical)">Incident</Badge>}</span> },
    { key: 'a', header: 'Actions', render: (u) => { const done = applied[u.id] ?? []; return <span className="muted" style={{ fontSize: 11.5 }}>{done.length ? <b style={{ color: 'var(--good)' }}>{done.length}/{u.actions.length} applied</b> : `${u.actions.length} recommended`}</span>; } },
  ];

  return (
    <>
      <div className="grid g-1-2">
        <Card title="Risky users" count={users.length} sub="Combined score: phishing behaviour, training, identity and real incidents">
          <SegBar parts={bands} height={28} />
          <div className="row wrap" style={{ gap: 12, marginTop: 8 }}>
            {bands.map((b) => <span key={b.key} className="src-chip"><i style={{ background: b.color }} />{b.label} · <b>{b.value}</b></span>)}
          </div>
          <SectionLabel>Department</SectionLabel>
          <div className="hr-pick">
            <button type="button" className={!dept ? 'on' : ''} onClick={() => patch({ dept: null })}>All</button>
            {depts.map((d) => {
              const n = users.filter((u) => u.deptId === d.id).length;
              return n ? <button key={d.id} type="button" className={dept === d.id ? 'on' : ''} onClick={() => patch({ dept: dept === d.id ? null : d.id })}>{d.name} · {n}</button> : null;
            })}
          </div>
        </Card>
        <Card title="What makes them risky" sub="Users with each signal · click to filter">
          <div className="int-hbars">
            {FACTORS.map((x) => {
              const n = users.filter(x.test).length;
              return (
                <button key={x.id} type="button" className="int-hbar click" style={factor === x.id ? { background: 'var(--surface-hover)' } : undefined} onClick={() => patch({ factor: factor === x.id ? null : x.id })}>
                  <span className="int-hbar-l"><b>{x.label}</b><small>{Math.round((n / Math.max(1, users.length)) * 100)}% of risky users</small></span>
                  <span className="int-hbar-t"><i style={{ width: `${Math.max(3, (n / maxF) * 100)}%`, background: x.id === 'incident' || x.id === 'submit' ? '#f8646f' : x.id === 'mfa' || x.id === 'priv' ? '#a07cfb' : '#f5a83d' }} /></span>
                  <span className="int-hbar-n">{n}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <Card
        flush
        title="People to act on"
        count={`${rows.length} of ${users.length}`}
        sub="Highest risk first · click a person for drivers and recommended actions"
        actions={
          <span className="row wrap" style={{ gap: 8 }}>
            {(f || dept) && <button type="button" className="int-fchip on" onClick={() => patch({ factor: null, dept: null })}>{[f?.label, dept && deptName(dept)].filter(Boolean).join(' · ')} ×</button>}
            <Btn sm onClick={() => setBulk('Enrol in coaching')}>Enrol in coaching</Btn>
            <Btn sm primary color="var(--m-comply)" onClick={() => setBulk('Enforce MFA')}>Enforce MFA</Btn>
          </span>
        }
        foot={<Sources items={[{ name: 'Phishing simulations' }, { name: 'Training platform' }, { name: identitySource(c) }, { name: 'HexaInt credential exposure' }, { name: 'HexaSOC incidents' }]} />}
      >
        <DataTable rows={rows} columns={cols} onRowClick={(u) => patch({ id: u.id })} search={(u) => `${u.name} ${u.role} ${deptName(u.deptId)}`} searchPlaceholder="Filter people…" pageSize={15} />
      </Card>

      {sel && <UserDrawer u={sel} onClose={() => patch({ id: null })} />}

      {bulk && (
        <WriteBackModal
          title={bulk === 'Enforce MFA' ? 'Enforce phishing-resistant MFA' : bulk}
          target={bulk === 'Enforce MFA' ? identitySource(c) : 'Awareness platform'}
          risk={ACTION_RISK[bulk]}
          approvals={ACTION_RISK[bulk] === 'low' ? 'No approval needed' : '1 approver: Identity owner'}
          onClose={() => setBulk(null)}
          submitLabel={`Apply to ${bulkTargets.length}`}
          onSubmit={() => { apply(bulkTargets.map((u) => u.id), bulk); toast(`${bulk}: applied to ${bulkTargets.length} people.`); setBulk(null); }}
          changes={[
            ['People', `${bulkTargets.length} in the current view where this is recommended and not yet applied`],
            ['Change', bulk === 'Enforce MFA' ? 'Add to the “Phishing-resistant MFA required” Conditional Access group; registration prompt at next sign-in' : 'Enrol in the 4-week coaching track with monthly targeted simulations'],
            ['Rollback', bulk === 'Enforce MFA' ? 'Remove from the group' : 'Unenrol'],
          ]}
        />
      )}
    </>
  );
}

function UserDrawer({ u, onClose }: { u: RiskyUser; onClose: () => void }) {
  const { c, deptName, applied, apply } = useHr();
  const { toast } = useApp();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState<UserAction | null>(null);
  const done = applied[u.id] ?? [];
  const run = (a: UserAction) => {
    if (ACTION_RISK[a] === 'low') { apply([u.id], a); toast(`${a}: done for ${u.name}.`); } else setConfirm(a);
  };
  return (
    <>
      <Drawer
        wide
        title={u.name}
        sub={`${u.role} · ${deptName(u.deptId)} · ${tenantName(c, u.tenantId)}`}
        onClose={onClose}
        footer={<><Btn ghost onClick={onClose}>Close</Btn><Btn onClick={() => nav(`/fabric/identity?filter=${u.privileged ? 'privileged' : u.mfa === 'None' || u.mfa === 'SMS' ? 'nomfa' : 'high'}`)}>Open in Identity</Btn></>}
      >
        <div className="row" style={{ gap: 18, alignItems: 'center' }}>
          <Ring value={u.score} size={88} stroke={9} color={riskColor(u.score)} sub={riskLabel(u.score)} />
          <div style={{ flex: 1 }}>
            <SectionLabel>Why this person is risky</SectionLabel>
            <ul className="hr-drivers">{u.drivers.map((d) => <li key={d}>{d}</li>)}</ul>
          </div>
        </div>
        <SectionLabel>Signals</SectionLabel>
        <KV rows={[
          ['Phishing (12 months)', `${u.clicks12m} clicked · ${u.submits12m} entered credentials · ${u.reports12m} reported`],
          ['Last click', u.lastClickDays !== null ? `${u.lastClickDays} days ago` : 'Never'],
          ['Training', <Badge color={u.training === 'Overdue' ? 'var(--sev-high)' : u.training === 'In progress' ? 'var(--sev-medium)' : 'var(--good)'}>{u.training}{u.overdueCourses ? ` · ${u.overdueCourses} course${u.overdueCourses > 1 ? 's' : ''}` : ''}</Badge>],
          ['MFA', <Badge color={MFA_COLOR[u.mfa]} dot>{u.mfa}</Badge>],
          ['Privileged access', u.privileged ? <Badge color="#a07cfb">Yes · standing admin rights</Badge> : 'No'],
          ['Credential exposure', u.stealerHit ? <button type="button" className="link" style={{ background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer' }} onClick={() => nav('/int/exposure')}>Seen in an infostealer log (HexaInt)</button> : 'None found'],
          ['Incidents', u.incidents.length ? <span className="stack" style={{ gap: 2 }}>{u.incidents.map((i) => <button key={i.id} type="button" className="link" style={{ background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer', textAlign: 'left' }} onClick={() => nav(`/soc/ir?id=${i.id}`)}>{i.id} · {i.title}</button>)}</span> : 'None in 90 days'],
        ] as [ReactNode, ReactNode][]} />
        <SectionLabel>Recommended actions</SectionLabel>
        <div className="stack" style={{ gap: 6 }}>
          {u.actions.map((a) => {
            const isDone = done.includes(a);
            return (
              <div key={a} className="row between" style={{ gap: 10, padding: '6px 0', borderBottom: '1px solid var(--hairline-soft)' }}>
                <span><b style={{ fontSize: 12.5 }}>{a}</b> <Badge color={ACTION_RISK[a] === 'low' ? 'var(--good)' : ACTION_RISK[a] === 'medium' ? 'var(--sev-medium)' : 'var(--bad)'}>{ACTION_RISK[a]} risk</Badge></span>
                <Btn sm primary={!isDone} color="var(--m-comply)" disabled={isDone} onClick={() => run(a)}>{isDone ? 'Applied' : 'Apply'}</Btn>
              </div>
            );
          })}
        </div>
        <p className="hr-note" style={{ marginTop: 10 }}>Coaching is supportive, not punitive: people who report simulations quickly lower their score as fast as clicks raise it.</p>
      </Drawer>
      {confirm && (
        <WriteBackModal
          title={confirm}
          target={identitySource(c)}
          risk={ACTION_RISK[confirm]}
          approvals={ACTION_RISK[confirm] === 'high' ? '2 approvers: Identity owner + CISO' : '1 approver: Identity owner'}
          onClose={() => setConfirm(null)}
          submitLabel="Submit for approval"
          onSubmit={() => { apply([u.id], confirm); toast(`${confirm} for ${u.name} submitted for approval.`); setConfirm(null); }}
          changes={[
            ['Person', `${u.name} · ${u.role}`],
            ['Change', confirm === 'Enforce MFA' ? 'Require phishing-resistant MFA (FIDO2 / passkey); SMS removed as a method' : 'Remove standing admin; elevate just-in-time through PAM'],
            ['Current', confirm === 'Enforce MFA' ? u.mfa : 'Standing privileged group membership'],
            ['Rollback', 'Revert the group membership'],
          ]}
        />
      )}
    </>
  );
}
