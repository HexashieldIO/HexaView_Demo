import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, MinusCircle, Send, ExternalLink } from 'lucide-react';
import { Drawer, Modal } from '../../../components/Overlay';
import { Btn, Callout } from '../../../components/ui';
import { ratingsSource } from '../../../data/modules/comply';
import { TP_CHECKS, TP_DOMAINS, TP_LEVEL_COLOR, TP_STATE_COLOR, type QSetId, type TpSupplier } from '../../../data/modules/tprm';
import { scoreColor, Mono, Pill, ScopeTags, ScoreRing, GapCard } from './ui';
import { useTprm } from './state';

export function SupplierDrawer({ s, onClose }: { s: TpSupplier; onClose: () => void }) {
  const { c, qas, qsets, sendQa, grc } = useTprm();
  const nav = useNavigate();
  const [send, setSend] = useState(false);
  const src = ratingsSource(c);
  const qa = qas.filter((q) => q.supplierId === s.id).slice(-1)[0];
  const pam = c.connectors.find((k) => k.category === 'PAM')?.product;
  const v = s.v;
  const rows: [ReactNode, ReactNode][] = [
    ['Service provided', s.service],
    ['Contact', s.contact],
    ['Recorded risk level', <span key="r" style={{ color: TP_LEVEL_COLOR[s.recordedRisk], fontWeight: 600 }}>{s.recordedRisk}</span>],
    ['Information shared', v.dataAccess.join(', ')],
    ['Information classification', s.classification],
    ['Access', v.access],
    ['Access controls', s.accessControls],
    ['Certifications', s.certifications.length ? s.certifications.join(' · ') : '—'],
    ['Service levels', s.slas],
    ['Incident reporting', s.incidentRoute],
    ['Monitoring', s.monitoring],
    ['Contract start', s.contractStart],
    ['Contract end', s.renewal.kind === 'open' ? 'Open-ended' : s.renewal.kind === 'overdue' ? <span key="o" className="tp-renew-over">{-s.renewal.days}d overdue</span> : s.renewal.date],
    ['Last review', s.lastReview],
    ['Next review', <span key="n" style={v.dueInDays < 0 ? { color: 'var(--bad)', fontWeight: 600 } : undefined}>{s.nextReview}{v.dueInDays < 0 ? ` · ${-v.dueInDays}d overdue` : ''}</span>],
    ['Tier · tenants', `Tier ${v.tier} · ${v.tenants.map((t) => c.tenants.find((x) => x.id === t)?.short ?? t).join(', ')}`],
    ['Outside-in rating', <span key="ra"><b style={{ color: v.rating < 65 ? 'var(--bad)' : v.rating < 75 ? 'var(--sev-medium)' : 'var(--good)' }}>{v.rating}</b> <span className="tp-muted">({v.ratingDelta > 0 ? '+' : ''}{v.ratingDelta} in 30 d · {src.name}{src.stale ? ' · stale' : ''})</span></span>],
    ['Fourth parties', v.fourthParties.join(', ')],
  ];
  if (v.cif !== undefined) rows.push(['DORA', `${v.cif ? 'Supports a critical or important function' : 'Not CIF'} · LEI ${v.lei ? 'present' : 'missing'}`]);
  if (v.baa) rows.push(['Business Associate Agreement', v.baa]);
  if (v.tisax) rows.push(['TISAX label', v.tisax]);
  if (v.tpn) rows.push(['TPN status', v.tpn]);
  if (v.otRemote) rows.push([c.id === 'healthcare' ? 'Remote device access' : 'Remote OT access', `Brokered via ${pam ?? 'PAM jump host'} · read-only in HexaView`]);
  const gapsByDomain = TP_DOMAINS.flatMap((d) => s.gaps.filter((g) => g.domain === d));
  const defaultSet: QSetId = v.tier === 1 ? 'critical' : s.state === 'Pending docs' ? 'initial' : 'annual';
  const [setId, setSetId] = useState<QSetId>(defaultSet);

  return (
    <Drawer
      wide
      title={<span className="tp-row" style={{ gap: 10 }}><Mono s={s} size="lg" />{s.name}</span>}
      sub={<span className="tp-row" style={{ gap: 6, marginTop: 6 }}>
        <span className="tp-muted" style={{ fontFamily: 'var(--font-mono)' }}>{s.id}</span>
        <Pill color={TP_STATE_COLOR[s.state]}>{s.state}</Pill>
        <Pill color={TP_LEVEL_COLOR[s.level]}>{s.level} risk · {s.score}</Pill>
        <ScopeTags s={s} />
      </span>}
      onClose={onClose}
      footer={<>
        <Btn onClick={() => nav(`/comply/caas?section=vendors&id=${encodeURIComponent(s.id)}`)}><ExternalLink /> Open the register record</Btn>
        <Btn primary color="var(--m-comply)" onClick={() => setSend(true)}><Send /> Send questionnaire</Btn>
      </>}
    >
      <div className="tp-dhead">
        <div>
          <ScoreRing score={s.score} sub="of 100" />
          <div className="tp-ring-cap"><b>Risk score</b><span>{s.failed} of {s.applicable} applicable checks failed</span></div>
        </div>
        <div className="tp-dbars">
          {TP_DOMAINS.map((d) => {
            const val = s.domains[d];
            return (
              <div key={d} className={`tp-dbar ${val === null ? 'na' : ''}`}>
                <span>{d}</span>
                <span className="tp-score-bar" style={{ width: '100%' }}><i style={{ width: `${Math.max(val ? 3 : 0, val ?? 0)}%`, background: val === null ? 'transparent' : scoreColor(val) }} /></span>
                <b>{val === null ? 'n/a' : val}</b>
              </div>
            );
          })}
          <div className="tp-foot-note">Each domain is the share of its applicable checks that failed · higher is worse</div>
        </div>
      </div>

      <div>
        <div className="tp-label">What is driving it ({s.gaps.length})</div>
        {s.gaps.length ? <div className="tp-gaps">{gapsByDomain.map((g) => <GapCard key={g.key} gap={g} />)}</div> : <Callout kind="good">Every applicable check passes on this supplier's record.</Callout>}
      </div>

      <div>
        <div className="tp-label">The twelve checks</div>
        <div className="grid g2" style={{ gap: '4px 18px' }}>
          {TP_CHECKS.map((k) => {
            const r = s.results[k.id];
            return (
              <div key={k.id} className="tp-row" style={{ gap: 8, fontSize: 12, color: r === undefined ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                {r === undefined ? <MinusCircle size={14} /> : r ? <CheckCircle2 size={14} color="var(--good)" /> : <XCircle size={14} color="var(--bad)" />}
                <span>{k.label}</span>
                <span className="tp-muted" style={{ marginLeft: 'auto', fontSize: 10.5 }}>{r === undefined ? 'not applicable' : k.domain}</span>
              </div>
            );
          })}
        </div>
      </div>

      {v.otRemote && <Callout kind="warn">{c.id === 'healthcare' ? 'Medical devices' : 'OT'} are read-only in HexaView by policy. Sessions from this vendor are brokered and recorded in {pam ?? 'the PAM jump host'}; changes go through the site change process, never from here.</Callout>}

      <div>
        <div className="tp-label">On the register</div>
        <dl className="tp-kv">{rows.map(([k, val], i) => <div key={i} style={{ display: 'contents' }}><dt>{k}</dt><dd>{val}</dd></div>)}</dl>
      </div>
      {qa && <div className="tp-foot-note">Latest questionnaire: {qa.id} · {qsets.find((x) => x.id === qa.set)?.name} · {qa.col}</div>}
      <div className="tp-foot-note">Scored from this supplier's own vendor register record in {grc}{src.connector ? `, with outside-in ratings from ${src.name}` : ', with outside-in signals from a HexaInt scan (no ratings connector)'}.</div>

      {send && (
        <Modal
          title="Send questionnaire"
          sub={<>To <b>{s.name}</b> ({s.contact}) via {grc}</>}
          onClose={() => setSend(false)}
          footer={<><Btn onClick={() => setSend(false)}>Cancel</Btn><Btn primary color="var(--m-comply)" onClick={() => { sendQa(s.id, setId); setSend(false); }}><Send /> Send</Btn></>}
        >
          <div className="tp-pick">
            {qsets.map((q) => (
              <button key={q.id} type="button" className={setId === q.id ? 'on' : ''} onClick={() => setSetId(q.id)}>
                <span className="tp-pill" style={{ ['--tc' as string]: 'var(--m-comply)' }}>{q.questions} q</span>
                <span><b>{q.name}</b><span>{q.annex} · {q.use}</span></span>
              </button>
            ))}
          </div>
          <Callout>The supplier gets 21 days and a reminder every 7. Answers return to the Submitted column for review; nothing on the register changes until you approve them.</Callout>
        </Modal>
      )}
    </Drawer>
  );
}
