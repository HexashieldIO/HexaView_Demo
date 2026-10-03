import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Send, Landmark, Clapperboard, Anchor, AlertTriangle, HeartPulse, Car, ClipboardList } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { headlines } from '../../data/core';
import { tenantName } from '../../data/customers';
import { MODULE_BY_ID } from '../../modules/registry';
import { vendors, ratingsSource, doraRegister, type Vendor, type AssessStatus, type TpnStatus } from '../../data/modules/comply';
import { Card, KpiStrip, Badge, Bar, Stacked, Legend, Sources, Freshness, Btn, KV, Chip, Callout, SectionLabel, StatusBadge, MiniStat } from '../../components/ui';
import { Chart, PALETTE } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { fmtMoney, fmtNum, monthLabels, scoreTone } from '../../lib/format';
import { rng } from '../../lib/rng';
import { WriteBackModal, RequestEvidenceModal, Field, MetricBand } from './parts';
import './comply.css';

const tone = MODULE_BY_ID.comply.tone;
const ASSESS_COLOR: Record<AssessStatus, string> = {
  Complete: 'var(--good)', 'In progress': 'var(--m-matrix)', 'Under review': 'var(--m-core)', Sent: 'var(--sev-info)', Overdue: 'var(--bad)', 'Not started': 'var(--sev-low)',
};
const ASSESS_HEX: Record<AssessStatus, string> = { Complete: '#2dd4bf', 'In progress': '#4f8cff', 'Under review': '#22b8d8', Sent: '#8a9bc0', Overdue: '#f8646f', 'Not started': '#ecc873' };
const TPN_COLOR: Record<TpnStatus, string> = { 'Gold Shield': 'var(--m-custody)', 'Blue Shield': 'var(--m-matrix)', 'Self-reported': 'var(--sev-info)', 'Not assessed': 'var(--sev-medium)', Expired: 'var(--bad)' };
const TIER_COLOR = { 1: 'var(--sev-high)', 2: 'var(--sev-medium)', 3: 'var(--sev-info)' } as const;

function Tick({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div>
      {ok ? <CheckCircle2 color="var(--good)" /> : <XCircle color="var(--bad)" />}
      <span>{children}</span>
    </div>
  );
}

export default function ComplyTprm() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const days = rangeDays(timeRange);
  const h = headlines(c, tenantId);
  const vs = useMemo(() => vendors(c, tenantId), [c, tenantId]);
  const src = ratingsSource(c);
  const ratingConn = c.connectors.find((k) => k.category === 'Ratings');
  const grc = c.connectors.find((k) => k.category === 'GRC');
  const [sp, setSp] = useSearchParams();
  const setP = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === 'all' ? next.delete(k) : next.set(k, v)));
    setSp(next, { replace: true });
  };
  const [open, setOpen] = useState<Vendor | null>(null);
  const tierF = (Number(sp.get('tier') ?? 0) || 0) as 0 | 1 | 2 | 3;
  const setTierF = (t: number) => setP({ tier: t ? String(t) : null });
  const highOnly = sp.get('risk') === 'high';
  const setHighOnly = (b: boolean) => setP({ risk: b ? 'high' : null });
  const statusF = sp.get('status') as AssessStatus | null;
  const setStatusF = (s: AssessStatus | null) => setP({ status: s });
  const stateF = sp.get('state') as Vendor['state'] | null;
  const flagF = sp.get('flag');
  const [handled, setHandled] = useState<string | null>(null);
  const openParam = sp.get('id');
  if (openParam && handled !== openParam) {
    setHandled(openParam);
    const v = vs.find((x) => x.id === openParam || x.name === openParam);
    if (v) setOpen(v);
  }
  const [reassess, setReassess] = useState<Vendor | null>(null);
  const [questionnaire, setQuestionnaire] = useState('Tier 1 · full (SIG Core + sector annex)');
  const [evReq, setEvReq] = useState<Vendor | null>(null);

  const tier1 = vs.filter((v) => v.tier === 1);
  const high = vs.filter((v) => v.highRisk);
  const overdue = vs.filter((v) => v.assessment === 'Overdue');
  const avgRating = Math.round(vs.reduce((s, v) => s + v.rating, 0) / vs.length);
  const expiring = vs.filter((v) => v.contractEndDays <= 90).length;
  const r = rng(`tprm-range-${c.id}-${tenantId}`);
  const completedInRange = Math.max(days > 1 ? 1 : 0, Math.round(vs.filter((v) => v.assessment === 'Complete').length * Math.min(1, days / 365) * r.float(0.9, 1.3)));
  const ratingDrops = vs.filter((v) => v.ratingDelta <= -5).slice(0, Math.max(1, Math.round((vs.filter((v) => v.ratingDelta <= -5).length * Math.min(90, days)) / 90)));

  const FLAGS: Record<string, { label: string; test: (v: Vendor) => boolean }> = {
    drops: { label: 'Rating dropped ≥ 5', test: (v) => v.ratingDelta <= -5 },
    expiring: { label: 'Contract ends ≤ 90 d', test: (v) => v.contractEndDays <= 90 },
    complete: { label: 'Assessment complete', test: (v) => v.assessment === 'Complete' },
    baa: { label: 'PHI without valid BAA', test: (v) => v.baa === 'Missing' || v.baa === 'Expired' },
    tisax: { label: 'Prototype data without AL3', test: (v) => v.dataAccess.includes('Prototype') && v.tisax !== 'AL3 valid' },
    ot: { label: 'Remote OT / device access', test: (v) => !!v.otRemote },
    tpn: { label: 'Pre-release without current TPN', test: (v) => v.dataAccess.includes('Pre-release') && (v.tpn === 'Not assessed' || v.tpn === 'Expired') },
    lei: { label: 'Missing LEI', test: (v) => v.lei === false },
  };
  const shown = vs.filter((v) => (tierF ? v.tier === tierF : true) && (highOnly ? v.highRisk : true) && (statusF ? v.assessment === statusF : true) && (stateF ? v.state === stateF : true) && (flagF && FLAGS[flagF] ? FLAGS[flagF].test(v) : true));
  const ratingSrc = `${src.name} · ${grc ? grc.product : 'HexaComply'}`;
  const STATES: Vendor['state'][] = ['Active', 'Under review', 'Pending docs', 'Escalated', 'Archived'];

  const statusCounts = (Object.keys(ASSESS_COLOR) as AssessStatus[]).map((s) => ({ s, n: vs.filter((v) => v.assessment === s).length }));
  const dueBuckets = [
    { label: 'Overdue', n: overdue.length, color: 'var(--bad)' },
    { label: '≤ 30 d', n: vs.filter((v) => v.dueInDays >= 0 && v.dueInDays <= 30).length, color: 'var(--sev-high)' },
    { label: '31–60 d', n: vs.filter((v) => v.dueInDays > 30 && v.dueInDays <= 60).length, color: 'var(--sev-medium)' },
    { label: '61–90 d', n: vs.filter((v) => v.dueInDays > 60 && v.dueInDays <= 90).length, color: 'var(--sev-low)' },
  ];

  // Concentration: which hosting providers sit under tier-1 / critical services.
  const critical = vs.filter((v) => v.tier === 1 || v.cif || v.otRemote);
  const hostCounts = ['AWS', 'Azure', 'GCP', 'On-prem'].map((p) => ({ p, n: critical.filter((v) => v.hosting === p).length }));
  const fourth = new Map<string, number>();
  vs.forEach((v) => v.fourthParties.forEach((f) => fourth.set(f, (fourth.get(f) ?? 0) + 1)));
  const fourthTop = [...fourth.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  const dataKinds = new Map<string, number>();
  vs.forEach((v) => v.dataAccess.forEach((d) => dataKinds.set(d, (dataKinds.get(d) ?? 0) + 1)));

  const dora = c.id === 'finserv' ? doraRegister(c) : null;
  const tpnCounts = c.id === 'media' ? (['Gold Shield', 'Blue Shield', 'Self-reported', 'Not assessed', 'Expired'] as TpnStatus[]).map((s) => ({ s, n: vs.filter((v) => v.tpn === s).length, pre: vs.filter((v) => v.tpn === s && v.dataAccess.includes('Pre-release')).length })) : [];
  const otVendors = vs.filter((v) => v.otRemote);

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · {tenantName(c, tenantId)}: {fmtNum(h.comply.vendors)} third parties in one register. Outside-in ratings from{' '}
        <b>{src.name}</b>{src.connector ? '' : ' (no ratings connector: HexaShield scans the vendor attack surface)'}, assessments and contract obligations in {grc ? grc.product : 'HexaComply'}, access evidence from{' '}
        {c.connectors.filter((k) => ['PAM', 'Identity'].includes(k.category)).map((k) => k.product).join(' and ')}.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Vendors', value: fmtNum(h.comply.vendors), unit: `${tier1.length} tier 1`, onClick: () => setSp(new URLSearchParams(), { replace: true }), source: ratingSrc },
          { label: 'High risk', value: h.comply.highRiskVendors, toneColor: 'var(--bad)', bar: (h.comply.highRiskVendors / vs.length) * 100, onClick: () => setP({ risk: 'high', tier: null, status: null, state: null, flag: null }), source: ratingSrc },
          { label: 'Assessments overdue', value: overdue.length, onClick: () => setP({ status: 'Overdue', risk: null }), source: grc ? grc.product : 'HexaComply' },
          { label: 'Completed', hint: timeRange, value: completedInRange, delta: { text: rangeLabel(timeRange), good: true }, onClick: () => setP({ flag: 'complete' }), source: grc ? grc.product : 'HexaComply' },
          { label: 'Mean rating', hint: src.connector ? src.name.split(' ')[0] : 'HexaInt', value: avgRating, bar: avgRating, toneColor: scoreTone(avgRating), onClick: () => setP({ flag: 'drops' }), source: src.name },
          { label: 'Rating drops', hint: '≥ 5 pts', value: ratingDrops.length, delta: { text: rangeLabel(timeRange), good: false }, onClick: () => setP({ flag: 'drops' }), source: src.name },
          { label: 'Contracts expiring', hint: '90 d', value: expiring, onClick: () => setP({ flag: 'expiring' }), source: grc ? grc.product : 'HexaComply' },
        ]}
      />

      <MetricBand
        tone={tone}
        items={[
          { ac: 'Register', word: 'All', value: fmtNum(vs.length), unit: 'suppliers', active: !stateF, onClick: () => setP({ state: null }), source: ratingSrc },
          ...STATES.map((s) => ({ ac: 'State', word: s, value: vs.filter((v) => v.state === s).length, unit: 'suppliers', active: stateF === s, color: s === 'Escalated' ? 'var(--bad)' : undefined, onClick: () => setP({ state: stateF === s ? null : s }), source: grc ? grc.product : 'HexaComply' })),
        ]}
      />

      <div className="grid g-3-2">
        {dora && (
          <Card title={<><Landmark size={15} /> DORA Register of Information</>} sub="Art. 28(3) · ICT third-party arrangements · Aldersgate Europe S.A." toneColor={tone} tinted actions={<Badge color="var(--sev-medium)">CSSF submission in {dora.dueInDays} d</Badge>}>
            <div className="mini-stats">
              <MiniStat value={dora.contracts} label="Contractual arrangements" />
              <MiniStat value={dora.cifProviders} label="ICT providers supporting critical or important functions" />
              <MiniStat value={dora.missingLei} label="Contracts missing LEI" color="var(--bad)" />
              <MiniStat value={dora.exitPlansMissing} label="Critical providers without tested exit plan" color="var(--sev-high)" />
              <MiniStat value={`${dora.subcontractingMapped}%`} label="Subcontracting chain mapped" />
            </div>
            <div style={{ marginTop: 14 }}>
              <SectionLabel>Template completeness ({dora.submission})</SectionLabel>
              {[['RT.01 Entity maintaining the register', 100], ['RT.02 Contractual arrangements', 86], ['RT.05 ICT third-party providers (LEI)', Math.round(((dora.contracts - dora.missingLei) / dora.contracts) * 100)], ['RT.06 Functions identification', 94], ['RT.07 Assessment of ICT services (exit, substitutability)', 71]].map(([l, v]) => (
                <div key={l as string} className="comply-mini" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr) 40px' }}>
                  <span>{l}</span><Bar value={v as number} color={(v as number) < 85 ? 'var(--sev-medium)' : tone} size="thin" /><b>{v}%</b>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <SectionLabel>Critical or important functions</SectionLabel>
              <div className="chips">
                {dora.functions.map((f) => <Badge key={f.name} color={f.critical ? 'var(--sev-high)' : 'var(--text-muted)'}>{f.name} · {f.providers}</Badge>)}
              </div>
            </div>
            <div className="card-foot">
              <Btn sm primary color={tone} onClick={() => toast('LEI enrichment requested for 31 contracts via GLEIF lookup; 24 auto-matched, 7 sent to procurement')}>Enrich missing LEIs</Btn>
              <Btn sm onClick={() => toast('DORA RoI draft exported (xBRL-CSV) for review by ' + c.people.grcLead.name)}>Export draft (xBRL-CSV)</Btn>
            </div>
          </Card>
        )}
        {c.id === 'media' && (
          <Card title={<><Clapperboard size={15} /> TPN status across the vendor chain</>} sub="Trusted Partner Network · vendors receiving pre-release content must hold a current shield" toneColor={tone} tinted>
            <Stacked tall showLabels parts={tpnCounts.map((t) => ({ value: t.n, color: TPN_COLOR[t.s], label: t.s }))} />
            <Legend items={tpnCounts.map((t) => ({ label: `${t.s} ${t.n}`, color: TPN_COLOR[t.s] }))} />
            <Callout kind="warn">
              <b>{tpnCounts.filter((t) => t.s === 'Not assessed' || t.s === 'Expired').reduce((s, t) => s + t.pre, 0)} vendors</b> receive pre-release content without a current TPN shield. Custody policy can block delivery to them until assessed.
            </Callout>
            <div className="list" style={{ marginTop: 8 }}>
              {vs.filter((v) => v.dataAccess.includes('Pre-release') && v.tier === 1).slice(0, 6).map((v) => (
                <button key={v.id} className="list-row" onClick={() => setOpen(v)}>
                  <span className="list-main"><b>{v.name}</b><span>{v.access}</span></span>
                  {v.tpn && <Badge color={TPN_COLOR[v.tpn]} dot>{v.tpn}</Badge>}
                </button>
              ))}
            </div>
          </Card>
        )}
        {c.id === 'maritime' && (
          <Card title={<><Anchor size={15} /> OT vendor remote access</>} sub="Vendors that can reach cranes, AGVs, vessel automation or connectivity · brokered via CyberArk jump hosts" toneColor="var(--m-ot)" tinted>
            <Callout kind="warn">OT is read-only by policy in HexaView: no write-back actions are offered for these sessions. Changes go through the site change process.</Callout>
            <div className="list" style={{ marginTop: 8 }}>
              {otVendors.sort((a, b) => a.rating - b.rating).slice(0, 7).map((v) => {
                const named = /Konecranes|Kongsberg/.test(v.name);
                return (
                  <button key={v.id} className="list-row" onClick={() => setOpen(v)} style={named ? { background: 'color-mix(in srgb, var(--m-ot) 8%, transparent)' } : undefined}>
                    <span className="list-main">
                      <b>{v.name} {named && <Badge color="var(--m-ot)">Remote OT access</Badge>}</b>
                      <span>{v.access} · sessions via PAM · {v.obligations.rightToAudit ? 'right to audit' : 'no audit clause'}</span>
                    </span>
                    <span className="num" style={{ fontWeight: 700, color: scoreTone(v.rating + 10) }}>{v.rating}</span>
                    {v.highRisk && <Badge color="var(--bad)" solid>High risk</Badge>}
                  </button>
                );
              })}
            </div>
            <div className="card-foot">
              <span>{otVendors.length} vendors with OT access</span>
              <span>{otVendors.filter((v) => !v.obligations.rightToAudit).length} without right to audit</span>
              <Sources items={c.connectors.filter((k) => ['PAM', 'OT'].includes(k.category)).map((k) => ({ name: k.product, status: k.status }))} />
            </div>
          </Card>
        )}
        {c.id === 'healthcare' && (() => {
          const phi = vs.filter((v) => v.dataAccess.includes('PHI'));
          const baa = (['Signed', 'Missing', 'Expired'] as const).map((s) => ({ s, n: phi.filter((v) => v.baa === s).length }));
          const BAA_COLOR = { Signed: 'var(--good)', Missing: 'var(--bad)', Expired: 'var(--sev-high)' } as const;
          return (
            <Card title={<><HeartPulse size={15} /> Business associates and device OEMs</>} sub="HIPAA 164.308(b): every vendor that touches ePHI needs a signed BAA · biomed remote access brokered via CyberArk" toneColor={tone} tinted>
              <div className="mini-stats">
                {baa.map((b) => (
                  <button key={b.s} type="button" className="mini-stat" style={{ background: 'none', border: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => setP({ flag: b.s === 'Signed' ? null : 'baa' })} title={`Source: ${grc ? grc.product : 'HexaComply'} BAA register`}>
                    <b style={{ color: BAA_COLOR[b.s] }}>{b.n}</b><span>BAA {b.s.toLowerCase()}</span>
                  </button>
                ))}
                <button type="button" className="mini-stat" style={{ background: 'none', border: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => setP({ flag: 'ot' })}><b style={{ color: 'var(--m-ot)' }}>{otVendors.length}</b><span>with remote device access</span></button>
              </div>
              <Stacked tall showLabels parts={baa.map((b) => ({ value: b.n, color: BAA_COLOR[b.s], label: `BAA ${b.s}` }))} />
              <div className="list" style={{ marginTop: 8 }}>
                {phi.filter((v) => v.baa !== 'Signed').concat(otVendors.filter((v) => v.tier === 1)).slice(0, 6).map((v) => (
                  <button key={v.id} className="list-row" onClick={() => setOpen(v)}>
                    <span className="list-main"><b>{v.name}</b><span>{v.access} · {v.category}</span></span>
                    {v.baa && v.baa !== 'Not required' && <Badge color={v.baa === 'Signed' ? 'var(--good)' : 'var(--bad)'} dot>BAA {v.baa.toLowerCase()}</Badge>}
                    {v.otRemote && <Badge color="var(--m-ot)">Device access</Badge>}
                  </button>
                ))}
              </div>
              <Callout kind="warn">Medical devices are read-only in HexaView by policy: OEM sessions are recorded in CyberArk and reviewed, never changed from here.</Callout>
            </Card>
          );
        })()}
        {c.id === 'automotive' && (() => {
          const LABELS = ['AL3 valid', 'AL2 valid', 'Expiring', 'Expired', 'No label'] as const;
          const LCOL = { 'AL3 valid': 'var(--good)', 'AL2 valid': 'var(--m-matrix)', Expiring: 'var(--sev-medium)', Expired: 'var(--sev-high)', 'No label': 'var(--bad)' } as const;
          const proto = vs.filter((v) => v.dataAccess.includes('Prototype'));
          const gap = proto.filter((v) => v.tisax !== 'AL3 valid');
          return (
            <Card title={<><Car size={15} /> TISAX labels across the supply chain</>} sub="VDA ISA · suppliers receiving prototype or design data must hold an AL3 label with prototype protection" toneColor={tone} tinted>
              <Stacked tall showLabels parts={LABELS.map((l) => ({ value: vs.filter((v) => v.tisax === l).length, color: LCOL[l], label: l }))} />
              <div className="chips" style={{ marginTop: 8 }}>
                {LABELS.map((l) => <Badge key={l} color={LCOL[l]} dot>{l} · {vs.filter((v) => v.tisax === l).length}</Badge>)}
              </div>
              <Callout kind="warn">
                <button type="button" className="link" onClick={() => setP({ flag: 'tisax' })}><b>{gap.length} suppliers</b></button> receive prototype data without a valid AL3 label. OFTP2 transfers to them can be held by custody policy until assessed.
              </Callout>
              <div className="list" style={{ marginTop: 8 }}>
                {gap.sort((a, b) => a.tier - b.tier).slice(0, 4).concat(otVendors.filter((v) => v.tier === 1).slice(0, 2)).map((v) => (
                  <button key={v.id} className="list-row" onClick={() => setOpen(v)}>
                    <span className="list-main"><b>{v.name}</b><span>{v.access} · {v.category}</span></span>
                    {v.tisax && <Badge color={LCOL[v.tisax]} dot>{v.tisax}</Badge>}
                    {v.otRemote && <Badge color="var(--m-ot)">Robot cell access</Badge>}
                  </button>
                ))}
              </div>
              <div className="card-foot"><Sources items={c.connectors.filter((k) => ['Ratings', 'PAM', 'GRC'].includes(k.category)).map((k) => ({ name: k.product, status: k.status }))} /></div>
            </Card>
          );
        })()}

        <Card title="Tiering and outside-in rating" sub={`Each dot is a vendor · lower is worse · ${src.name}`} actions={ratingConn ? <Freshness minutes={ratingConn.lastSyncMin} stale={isStaleConn(ratingConn.lastSyncMin, ratingConn.intervalMin)} label={ratingConn.vendor} /> : <Badge>HexaInt scan · daily</Badge>}>
          <Chart
            height={300}
            onClick={(p) => {
              const d = (p as { data?: { id?: string } }).data;
              const v = vs.find((x) => x.id === d?.id);
              if (v) setOpen(v);
            }}
            option={{
              tooltip: { formatter: (p: unknown) => { const d = (p as { data: { name: string; value: number[] } }).data; return `${d.name}<br/>Rating ${d.value[1]} · ${d.value[2]} findings`; } },
              grid: { left: 8, right: 16, top: 16, bottom: 34, containLabel: true },
              xAxis: { type: 'value', min: 0, max: 4, interval: 1, axisLabel: { formatter: (v: number) => (v >= 1 && v <= 3 && Math.abs(v - Math.round(v)) < 0.01 ? `Tier ${Math.round(v)}` : '') }, splitLine: { show: false } },
              yAxis: { type: 'value', min: 40, max: 100, name: 'Rating' },
              series: [
                { type: 'scatter', name: 'Vendors', symbolSize: (v: number[]) => 6 + v[2] * 1.6, itemStyle: { color: PALETTE[0], opacity: 0.55 }, data: vs.filter((v) => !v.highRisk).map((v) => ({ id: v.id, name: v.name, value: [v.tier + (((v.rating * 7) % 10) - 5) / 18, v.rating, v.findings] })) },
                { type: 'scatter', name: 'High risk', symbolSize: (v: number[]) => 8 + v[2] * 1.6, itemStyle: { color: '#f8646f' }, data: high.map((v) => ({ id: v.id, name: v.name, value: [v.tier + (((v.rating * 7) % 10) - 5) / 18, v.rating, v.findings] })) },
              ],
              legend: { bottom: 0 },
            }}
          />
        </Card>
      </div>

      <div className="grid g3">
        <Card title="Assessment status" sub="Click a status to filter the register">
          <Chart
            height={180}
            onClick={(p) => setStatusF((p as { name: AssessStatus }).name)}
            option={{
              tooltip: { trigger: 'item' },
              series: [{ type: 'pie', radius: ['55%', '82%'], label: { show: false }, data: statusCounts.map((s) => ({ name: s.s, value: s.n, itemStyle: { color: ASSESS_HEX[s.s] } })) }],
            }}
          />
          <div className="chips" style={{ justifyContent: 'center' }}>
            {statusCounts.map((s) => <Chip key={s.s} on={statusF === s.s} color={ASSESS_COLOR[s.s]} onClick={() => setStatusF(statusF === s.s ? null : s.s)}>{s.s} {s.n}</Chip>)}
          </div>
          <div style={{ marginTop: 14 }}>
            <SectionLabel>Reassessments due</SectionLabel>
            {dueBuckets.map((b) => <div key={b.label} className="comply-mini" style={{ gridTemplateColumns: '60px minmax(0,1fr) 30px' }}><span>{b.label}</span><Bar value={b.n} max={Math.max(...dueBuckets.map((x) => x.n), 1)} color={b.color} size="thin" /><b>{b.n}</b></div>)}
          </div>
        </Card>

        <Card title="Concentration risk" sub="Where tier-1 and critical vendors host the services you depend on">
          <Chart
            height={170}
            option={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              grid: { left: 8, right: 30, top: 6, bottom: 4, containLabel: true },
              xAxis: { type: 'value', show: false },
              yAxis: { type: 'category', data: hostCounts.map((x) => x.p).reverse() },
              series: [{ type: 'bar', data: hostCounts.map((x) => x.n).reverse(), barWidth: 16, label: { show: true, position: 'right', formatter: (p: unknown) => `${Math.round(((p as { value: number }).value / Math.max(1, critical.length)) * 100)}%` }, itemStyle: { color: '#6db33f', borderRadius: [0, 4, 4, 0] } }],
            }}
          />
          {(() => {
            const top = [...hostCounts].sort((a, b) => b.n - a.n)[0];
            const pct = Math.round((top.n / Math.max(1, critical.length)) * 100);
            return pct > 35 ? <Callout kind="warn"><b>{pct}%</b> of critical vendors run on {top.p}. {c.id === 'finserv' ? 'DORA Art. 29 requires a concentration assessment before new arrangements.' : 'A single provider outage would hit several critical services at once.'}</Callout> : <Callout kind="good">No single provider hosts more than a third of critical vendors.</Callout>;
          })()}
        </Card>

        <Card title="Fourth parties and data access" sub="Your vendors' own critical suppliers, and what your vendors can touch">
          <div className="list">
            {fourthTop.map(([name, n]) => (
              <div key={name} className="bar-row" style={{ padding: '3px 0' }}>
                <div className="bar-label"><b>{name}</b></div>
                <Bar value={n} max={fourthTop[0][1]} color="var(--m-matrix)" size="thin" />
                <div className="bar-val">{n}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <SectionLabel>Data access</SectionLabel>
            <div className="chips">
              {[...dataKinds.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => <Badge key={k} color={k === 'Pre-release' || k === 'OT' || k === 'Payments' ? 'var(--sev-high)' : k === 'Personal data' ? 'var(--sev-medium)' : 'var(--text-muted)'}>{k} · {n}</Badge>)}
            </div>
          </div>
        </Card>
      </div>

      <Card
        title="Vendor register"
        count={shown.length}
        sub="Tiering, ratings, assessments and obligations · click a vendor"
        flush
        actions={
          <div className="chips">
            {([0, 1, 2, 3] as const).map((t) => <Chip key={t} on={tierF === t} color={tone} onClick={() => setTierF(t)}>{t ? `Tier ${t}` : 'All tiers'}</Chip>)}
            <Chip on={highOnly} color="var(--bad)" onClick={() => setHighOnly(!highOnly)}><AlertTriangle size={11} /> High risk</Chip>
            {statusF && <Chip on color={ASSESS_COLOR[statusF]} onClick={() => setStatusF(null)}>{statusF} ×</Chip>}
            {stateF && <Chip on color={tone} onClick={() => setP({ state: null })}>{stateF} ×</Chip>}
            {flagF && FLAGS[flagF] && <Chip on color="var(--sev-high)" onClick={() => setP({ flag: null })}>{FLAGS[flagF].label} ×</Chip>}
          </div>
        }
      >
        <DataTable<Vendor>
          rows={shown}
          rowKey={(v) => v.id}
          onRowClick={setOpen}
          search={(v) => `${v.name} ${v.category} ${v.access} ${v.country} ${v.fourthParties.join(' ')}`}
          searchPlaceholder="Search vendors, categories, fourth parties…"
          initialSort={{ key: 'score', dir: 'desc' }}
          columns={[
            { key: 'name', header: 'Supplier', sort: (v) => v.name, render: (v) => <span className="comply-vname"><span className="comply-vavatar">{v.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span><span><div className="t-main">{v.name}</div><div className="t-sub">{v.id} · {v.category} · {v.country}</div></span></span> },
            { key: 'score', header: 'Score', align: 'right', sort: (v) => v.gapScore, render: (v) => <span title="Higher is worse: failed register checks weighted by tier and rating"><span className="comply-score" style={{ color: v.gapScore >= 65 ? 'var(--sev-critical)' : v.gapScore >= 45 ? 'var(--sev-medium)' : 'var(--good)' }}>{v.gapScore}</span><div className="t-sub">{v.gaps.length} of 12 gaps</div></span> },
            { key: 'state', header: 'State', sort: (v) => v.state, render: (v) => <Badge color={v.state === 'Escalated' ? 'var(--bad)' : v.state === 'Active' ? 'var(--good)' : v.state === 'Archived' ? 'var(--text-muted)' : 'var(--sev-medium)'} dot>{v.state}</Badge> },
            { key: 'tier', header: 'Tier', sort: (v) => -v.tier, render: (v) => <Badge color={TIER_COLOR[v.tier]}>Tier {v.tier}</Badge> },
            { key: 'risk', header: 'Risk', sort: (v) => (v.highRisk ? 2 : 0) + (4 - v.tier) / 10 + (100 - v.rating) / 1000, render: (v) => (v.highRisk ? <Badge color="var(--bad)" solid>High</Badge> : <span className="t-sub">Managed</span>) },
            { key: 'rating', header: 'Rating', align: 'right', sort: (v) => v.rating, render: (v) => <span className="num" style={{ fontWeight: 700, color: scoreTone(v.rating + 10) }}>{v.rating}<span className="t-sub" style={{ marginLeft: 4, color: v.ratingDelta < 0 ? 'var(--bad)' : 'var(--good)' }}>{v.ratingDelta > 0 ? '+' : ''}{v.ratingDelta}</span></span> },
            { key: 'assess', header: 'Assessment', sort: (v) => v.assessment, render: (v) => <><StatusBadge value={v.assessment} map={ASSESS_COLOR} /><div className="t-sub">{v.dueInDays < 0 ? `${-v.dueInDays} d overdue` : `due in ${v.dueInDays} d`}</div></> },
            { key: 'data', header: 'Data access', render: (v) => <span className="t-sub">{v.access}<br />{v.dataAccess.join(', ')}</span> },
            ...(c.id === 'finserv' ? [{ key: 'dora', header: 'DORA', render: (v: Vendor) => <span className="chips">{v.cif && <Badge color="var(--sev-high)">CIF</Badge>}{v.lei === false && <Badge color="var(--bad)">No LEI</Badge>}{!v.obligations.exitPlan && v.tier === 1 && <Badge color="var(--sev-medium)">No exit plan</Badge>}</span> }] : []),
            ...(c.id === 'media' ? [{ key: 'tpn', header: 'TPN', sort: (v: Vendor) => v.tpn ?? '', render: (v: Vendor) => (v.tpn ? <Badge color={TPN_COLOR[v.tpn]} dot>{v.tpn}</Badge> : '—') }] : []),
            ...(c.id === 'healthcare' ? [{ key: 'baa', header: 'BAA', sort: (v: Vendor) => v.baa ?? '', render: (v: Vendor) => (v.baa && v.baa !== 'Not required' ? <Badge color={v.baa === 'Signed' ? 'var(--good)' : 'var(--bad)'} dot>{v.baa}</Badge> : <span className="t-sub">Not required</span>) }] : []),
            ...(c.id === 'automotive' ? [{ key: 'tisax', header: 'TISAX', sort: (v: Vendor) => v.tisax ?? '', render: (v: Vendor) => (v.tisax ? <Badge color={v.tisax === 'AL3 valid' ? 'var(--good)' : v.tisax === 'AL2 valid' ? 'var(--m-matrix)' : v.tisax === 'Expiring' ? 'var(--sev-medium)' : 'var(--bad)'} dot>{v.tisax}</Badge> : '—') }] : []),
            ...(c.id === 'maritime' || c.id === 'automotive' || c.id === 'healthcare' ? [{ key: 'ot', header: c.id === 'healthcare' ? 'Device access' : 'OT access', sort: (v: Vendor) => (v.otRemote ? 1 : 0), render: (v: Vendor) => (v.otRemote ? <Badge color="var(--m-ot)">{c.id === 'healthcare' ? 'Remote device' : 'Remote OT'}</Badge> : <span className="t-sub">—</span>) }] : []),
            { key: 'fourth', header: 'Fourth parties', render: (v) => <span className="t-sub">{v.fourthParties.join(', ')}</span> },
            { key: 'contract', header: 'Contract ends', align: 'right', sort: (v) => v.contractEndDays, render: (v) => <span className="t-sub" style={{ color: v.contractEndDays < 90 ? 'var(--sev-medium)' : undefined }}>{v.contractEndDays} d</span> },
          ]}
        />
      </Card>

      {open && (
        <Drawer
          wide
          title={open.name}
          sub={`${open.id} · ${open.category} · Tier ${open.tier}${open.highRisk ? ' · high risk' : ''}`}
          onClose={() => { setOpen(null); setP({ id: null }); }}
          footer={
            <>
              <Btn onClick={() => setEvReq(open)}>Request evidence</Btn>
              <Btn primary color={tone} onClick={() => setReassess(open)}><Send /> Send reassessment</Btn>
            </>
          }
        >
          {(() => {
            const AREAS = ['Cyber security', 'Data privacy', 'Business continuity', 'Incident reporting', 'Oversight & review'] as const;
            const areaScore = (a: (typeof AREAS)[number]) => Math.min(100, Math.round((open.gaps.filter((g) => g.area === a).length / (a === 'Oversight & review' || a === 'Cyber security' ? 3 : 2)) * 100));
            return (
              <>
                <div className="row wrap" style={{ gap: 16, alignItems: 'center' }}>
                  <span className="comply-vavatar" style={{ width: 44, height: 44, fontSize: 15 }}>{open.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>
                  <div>
                    <div className="comply-score" style={{ fontSize: 30, color: open.gapScore >= 65 ? 'var(--sev-critical)' : open.gapScore >= 45 ? 'var(--sev-medium)' : 'var(--good)' }}>{open.gapScore}</div>
                    <div className="muted" style={{ fontSize: 12 }}>Risk score · {open.gaps.length} of 12 applicable checks failed · higher is worse</div>
                  </div>
                  <Badge color={open.state === 'Escalated' ? 'var(--bad)' : 'var(--sev-medium)'} dot>{open.state}</Badge>
                </div>
                <div className="comply-gauge5">
                  {AREAS.map((a) => <div key={a}><b style={{ color: areaScore(a) >= 67 ? 'var(--sev-critical)' : areaScore(a) >= 34 ? 'var(--sev-medium)' : 'var(--good)' }}>{areaScore(a)}</b><span>{a}</span></div>)}
                </div>
                <div>
                  <SectionLabel>What is driving it ({open.gaps.length})</SectionLabel>
                  <div className="stack" style={{ gap: 8 }}>
                    {open.gaps.map((g, i) => (
                      <div key={i} className="comply-gap">
                        <small>{g.area}</small>
                        <b>{g.title}</b>
                        <span>{g.fix}</span>
                        <div>{g.tasked ? <Badge color="var(--m-matrix)">On the task list</Badge> : <Btn sm onClick={() => toast(`Task raised in ${grc ? grc.product : 'HexaComply'} for ${open.name}: ${g.title}`)}><ClipboardList /> Raise a task</Btn>}</div>
                      </div>
                    ))}
                    {open.gaps.length === 0 && <Callout kind="good">All twelve register checks pass for this supplier.</Callout>}
                  </div>
                </div>
              </>
            );
          })()}
          <div className="grid g2" style={{ gap: 18 }}>
            <KV rows={[
              ['Access', open.access],
              ['Data', open.dataAccess.join(', ')],
              ['Tenants served', open.tenants.map((t) => c.tenants.find((x) => x.id === t)?.short).join(', ')],
              ['Country', open.country],
              ['Hosting', open.hosting ?? '—'],
              ['Annual spend', fmtMoney(open.spendK * 1000, c.currency)],
              ['Contract ends', `in ${open.contractEndDays} days`],
            ]} />
            <KV rows={[
              ['Assessment', <StatusBadge key="a" value={open.assessment} map={ASSESS_COLOR} />],
              ['Due', open.dueInDays < 0 ? `${-open.dueInDays} days overdue` : `in ${open.dueInDays} days`],
              ['Last assessed', `${open.lastAssessedDays} days ago`],
              ['Open findings', String(open.findings)],
              ['Outside-in rating', <span key="r" style={{ fontWeight: 700, color: scoreTone(open.rating + 10) }}>{open.rating} ({open.ratingDelta > 0 ? '+' : ''}{open.ratingDelta} in 30 d)</span>],
              ['Rating source', src.name],
              ...(open.tpn ? [['TPN', <Badge key="t" color={TPN_COLOR[open.tpn]} dot>{open.tpn}</Badge>] as [string, ReactNode]] : []),
              ...(open.baa ? [['BAA', open.baa] as [string, ReactNode]] : []),
              ...(open.tisax ? [['TISAX label', open.tisax] as [string, ReactNode]] : []),
              ...(open.cif !== undefined ? [['DORA', `${open.cif ? 'Supports critical or important function' : 'Not CIF'} · LEI ${open.lei ? 'present' : 'missing'}`] as [string, ReactNode]] : []),
            ]} />
          </div>
          <div>
            <SectionLabel>Rating, 12 months · dashed line is the 70 threshold</SectionLabel>
            <Chart height={130} option={{
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: monthLabels(12) },
              yAxis: { type: 'value', min: 30, max: 100 },
              series: [{ type: 'line', data: (() => { const rr = rng(`vr-${open.id}`); const s = rr.series(11, open.rating - open.ratingDelta, 2.5, 0, 30, 100).map(Math.round); return [...s, open.rating]; })(), lineStyle: { color: '#6db33f' }, itemStyle: { color: '#6db33f' }, markLine: { silent: true, symbol: 'none', data: [{ yAxis: 70, lineStyle: { color: '#f5a83d', type: 'dashed' }, label: { show: false } }] } }],
            }} />
          </div>
          <div className="grid g2" style={{ gap: 18 }}>
            <div>
              <SectionLabel>Contract obligations</SectionLabel>
              <div className="comply-oblig">
                <Tick ok={open.obligations.rightToAudit}>Right to audit</Tick>
                <Tick ok={open.obligations.breachNotifyHrs <= 24}>Breach notification within {open.obligations.breachNotifyHrs} h{open.obligations.breachNotifyHrs > 24 ? ' (policy: 24 h)' : ''}</Tick>
                <Tick ok={open.obligations.subprocessorApproval}>Sub-processor approval</Tick>
                <Tick ok={open.obligations.cyberInsurance}>Cyber insurance evidenced</Tick>
                <Tick ok={open.obligations.exitPlan}>Exit plan documented and tested</Tick>
              </div>
            </div>
            <div>
              <SectionLabel>Fourth parties</SectionLabel>
              <div className="chips">{open.fourthParties.map((f) => <Badge key={f}>{f}</Badge>)}</div>
              {open.otRemote && <div style={{ marginTop: 12 }}><Callout kind="warn">Remote access to {c.id === 'healthcare' ? 'medical devices' : 'OT'}. Sessions are brokered and recorded in {c.connectors.find((k) => k.category === 'PAM')?.product ?? 'the PAM jump host'}; HexaView is read-only here by policy.</Callout></div>}
            </div>
          </div>
        </Drawer>
      )}

      {reassess && (
        <WriteBackModal
          title="Send reassessment questionnaire"
          target={grc ? `${grc.vendor} ${grc.product}` : 'HexaComply'}
          risk="low"
          approvals="No approval needed"
          submitLabel="Send questionnaire"
          onClose={() => setReassess(null)}
          onSubmit={() => { toast(`Reassessment sent to ${reassess.name} · ${questionnaire} · due in 21 days`); setReassess(null); }}
          changes={[['Vendor', reassess.name], ['Questionnaire', questionnaire], ['Due', '21 days'], ['Reminder cadence', 'Every 7 days, escalate to vendor owner at due date']]}
        >
          <Field label="Questionnaire">
            <select className="select" value={questionnaire} onChange={(e) => setQuestionnaire(e.target.value)}>
              <option>Tier 1 · full (SIG Core + sector annex)</option>
              <option>Tier 2 · SIG Lite</option>
              {c.id === 'finserv' && <option>DORA ICT third-party annex</option>}
              {c.id === 'media' && <option>TPN+ self-assessment</option>}
              {c.id === 'maritime' && <option>IEC 62443-2-4 service provider annex</option>}
              {c.id === 'healthcare' && <option>HIPAA business associate questionnaire + MDS2</option>}
              {c.id === 'automotive' && <option>VDA ISA self-assessment (TISAX AL3 + prototype)</option>}
            </select>
          </Field>
        </WriteBackModal>
      )}

      {evReq && (
        <RequestEvidenceModal what="Current security attestation (SOC 2 / ISO certificate)" owner={`${evReq.name} (vendor contact)`} control="CTL third-party assurance" onClose={() => setEvReq(null)} />
      )}
    </>
  );
}

function isStaleConn(last: number, interval: number) {
  return last > interval * 2;
}
