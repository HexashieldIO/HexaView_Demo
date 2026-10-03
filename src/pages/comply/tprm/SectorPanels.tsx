import type { ReactNode } from 'react';
import { Landmark, Clapperboard, Anchor, HeartPulse, Car, Radar } from 'lucide-react';
import { Card, Btn, Callout, Sources, Freshness, Badge } from '../../../components/ui';
import { doraRegister, ratingsSource } from '../../../data/modules/comply';
import type { TpSupplier } from '../../../data/modules/tprm';
import { useApp } from '../../../state/AppContext';
import { useTprm } from './state';
import { Mono, Pill, ScoreBar } from './ui';

function Seg({ parts, onPick }: { parts: { key: string; n: number; color: string; label: string }[]; onPick: (k: string) => void }) {
  const total = parts.reduce((a, p) => a + p.n, 0) || 1;
  return (
    <>
      <div className="tp-seg">
        {parts.filter((p) => p.n > 0).map((p) => (
          <button key={p.key} type="button" style={{ flexGrow: p.n, background: p.color }} title={`${p.label}: ${p.n}`} onClick={() => onPick(p.key)}>
            {p.n / total > 0.08 ? p.n : ''}
          </button>
        ))}
      </div>
      <div className="tp-legend">
        {parts.map((p) => <button key={p.key} type="button" onClick={() => onPick(p.key)}><i style={{ background: p.color }} />{p.label} <b>{p.n}</b></button>)}
      </div>
    </>
  );
}

function SupList({ items, right }: { items: TpSupplier[]; right: (s: TpSupplier) => ReactNode }) {
  const { openSupplier } = useTprm();
  return (
    <div className="tp-list" style={{ marginTop: 10 }}>
      {items.map((s) => (
        <button key={s.id} type="button" onClick={() => openSupplier(s.id)}>
          <Mono s={s} size="sm" />
          <span className="tp-list-main"><b>{s.name}</b><span>{s.v.access} · {s.service}</span></span>
          <span className="tp-row" style={{ gap: 6 }}>{right(s)}</span>
        </button>
      ))}
    </div>
  );
}

function Stat({ value, label, color, onClick, source }: { value: ReactNode; label: string; color?: string; onClick: () => void; source: string }) {
  return (
    <button type="button" className="tp-stat" onClick={onClick} title={`Source: ${source} · click to filter the register`}>
      <b style={color ? { color } : undefined}>{value}</b><span>{label}</span>
    </button>
  );
}

/** Sector regulatory lens kept from the previous page: DORA RoI, BAAs, TISAX, TPN, OT vendor access. */
export function SectorPanel() {
  const { c, sup, setParams, grc, addLog } = useTprm();
  const { toast } = useApp();
  const pam = c.connectors.find((k) => k.category === 'PAM');
  const ot = sup.filter((s) => s.v.otRemote);

  if (c.id === 'finserv') {
    const dora = doraRegister(c);
    const cif = sup.filter((s) => s.v.cif);
    const noLei = sup.filter((s) => s.v.lei === false);
    const noExit = cif.filter((s) => !s.v.obligations.exitPlan);
    return (
      <Card title={<><Landmark size={15} /> DORA Register of Information</>} sub="Art. 28(3) · ICT third-party arrangements · Aldersgate Europe S.A." toneColor="var(--m-comply)" tinted actions={<Badge color="var(--sev-medium)">CSSF submission in {dora.dueInDays} d</Badge>}>
        <div className="tp-statgrid">
          <Stat value={dora.contracts} label="Contractual arrangements" onClick={() => setParams({ flag: null, scope: 'DORA CIF' })} source="HexaComply DORA RoI" />
          <Stat value={cif.length} label="ICT providers supporting critical or important functions" color="var(--sev-high)" onClick={() => setParams({ flag: 'cif' })} source="HexaComply DORA RoI" />
          <Stat value={noLei.length} label="Providers missing an LEI on the register" color="var(--bad)" onClick={() => setParams({ flag: 'lei' })} source="HexaComply · GLEIF" />
          <Stat value={noExit.length} label="Critical providers without a tested exit plan" color="var(--sev-high)" onClick={() => setParams({ flag: 'exit' })} source="HexaComply DORA RoI" />
          <Stat value={`${dora.subcontractingMapped}%`} label="Subcontracting chain mapped" onClick={() => setParams({ flag: 'cif' })} source="HexaComply DORA RoI" />
        </div>
        <div style={{ marginTop: 14 }}>
          <div className="tp-label">Template completeness ({dora.submission})</div>
          {([['RT.01 Entity maintaining the register', 100], ['RT.02 Contractual arrangements', 86], ['RT.05 ICT third-party providers (LEI)', Math.round(((sup.length - noLei.length) / Math.max(1, sup.length)) * 100)], ['RT.06 Functions identification', 94], ['RT.07 Assessment of ICT services (exit, substitutability)', 71]] as [string, number][]).map(([l, v]) => (
            <div key={l} className="tp-mini"><span>{l}</span><span className="tp-score-bar" style={{ width: '100%' }}><i style={{ width: `${v}%`, background: v < 85 ? 'var(--sev-medium)' : 'var(--m-comply)' }} /></span><b>{v}%</b></div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="tp-label">Critical or important functions</div>
          <div className="tp-tags">{dora.functions.map((f) => <Pill key={f.name} color={f.critical ? 'var(--sev-high)' : 'var(--text-muted)'}>{f.name} · {f.providers}</Pill>)}</div>
        </div>
        <div className="card-foot">
          <Btn sm primary color="var(--m-comply)" onClick={() => { toast(`LEI enrichment requested for ${noLei.length} providers via GLEIF lookup; matches return to ${grc} for confirmation`); noLei.slice(0, 1).forEach((s) => addLog(s.id, 'LEI enrichment requested from GLEIF', 'Updated')); }}>Enrich missing LEIs</Btn>
          <Btn sm onClick={() => toast(`DORA RoI draft exported (xBRL-CSV) for review by ${c.people.grcLead.name}`)}>Export draft (xBRL-CSV)</Btn>
        </div>
      </Card>
    );
  }

  if (c.id === 'media') {
    const COL = { 'Gold Shield': 'var(--m-custody)', 'Blue Shield': 'var(--m-matrix)', 'Self-reported': 'var(--sev-info)', 'Not assessed': 'var(--sev-medium)', Expired: 'var(--bad)' } as const;
    const keys = Object.keys(COL) as (keyof typeof COL)[];
    const pre = sup.filter((s) => s.v.dataAccess.includes('Pre-release'));
    const gap = pre.filter((s) => s.v.tpn === 'Not assessed' || s.v.tpn === 'Expired');
    return (
      <Card title={<><Clapperboard size={15} /> TPN status across the vendor chain</>} sub="Trusted Partner Network · vendors receiving pre-release content must hold a current shield" toneColor="var(--m-comply)" tinted>
        <Seg parts={keys.map((k) => ({ key: k, n: sup.filter((s) => s.v.tpn === k).length, color: COL[k], label: k }))} onPick={(k) => setParams({ flag: k === 'Not assessed' || k === 'Expired' ? 'tpn' : null, scope: 'TPN' })} />
        <div style={{ marginTop: 10 }}>
          <Callout kind="warn"><button type="button" className="link" onClick={() => setParams({ flag: 'tpn' })}><b>{gap.length} vendors</b></button> receive pre-release content without a current TPN shield. HexaCustody policy can hold delivery to them until they are assessed.</Callout>
        </div>
        <SupList items={[...gap, ...pre.filter((s) => s.v.tier === 1 && !gap.includes(s))].slice(0, 6)} right={(s) => <>{s.v.tpn && <Pill color={COL[s.v.tpn]}>{s.v.tpn}</Pill>}<ScoreBar score={s.score} /></>} />
      </Card>
    );
  }

  if (c.id === 'maritime') {
    return (
      <Card title={<><Anchor size={15} /> OT vendor remote access</>} sub={`Vendors that can reach cranes, AGVs, vessel automation or connectivity · brokered via ${pam?.product ?? 'PAM'} jump hosts`} toneColor="var(--m-ot)" tinted>
        <Callout kind="warn">OT is read-only by policy in HexaView: no write-back actions are offered for these vendors. Changes go through the terminal or vessel change process.</Callout>
        <div className="tp-statgrid" style={{ marginTop: 10 }}>
          <Stat value={ot.length} label="Vendors with remote OT access" color="var(--m-ot)" onClick={() => setParams({ flag: 'ot' })} source={`${pam?.product ?? 'PAM'} · ${grc}`} />
          <Stat value={ot.filter((s) => !s.v.obligations.rightToAudit).length} label="Without a right to audit sessions" color="var(--bad)" onClick={() => setParams({ flag: 'ot' })} source={grc} />
          <Stat value={ot.filter((s) => s.results.access === false).length} label="Access controls not recorded" color="var(--sev-high)" onClick={() => setParams({ flag: 'ot' })} source={grc} />
        </div>
        <SupList items={[...ot].sort((a, b) => b.score - a.score).slice(0, 7)} right={(s) => <>{/Konecranes|Kongsberg/.test(s.name) && <Pill color="var(--m-ot)">Named OEM</Pill>}<ScoreBar score={s.score} /></>} />
        <div className="card-foot"><Sources items={c.connectors.filter((k) => ['PAM', 'OT'].includes(k.category)).map((k) => ({ name: k.product, status: k.status }))} /></div>
      </Card>
    );
  }

  if (c.id === 'healthcare') {
    const phi = sup.filter((s) => s.v.dataAccess.includes('PHI'));
    const COL = { Signed: 'var(--good)', Missing: 'var(--bad)', Expired: 'var(--sev-high)' } as const;
    const keys = ['Signed', 'Missing', 'Expired'] as const;
    const bad = phi.filter((s) => s.v.baa === 'Missing' || s.v.baa === 'Expired');
    return (
      <Card title={<><HeartPulse size={15} /> Business associates and device OEMs</>} sub={`HIPAA 164.308(b): every vendor that touches ePHI needs a signed BAA · biomed remote access brokered via ${pam?.product ?? 'PAM'}`} toneColor="var(--m-comply)" tinted>
        <div className="tp-statgrid">
          {keys.map((k) => <Stat key={k} value={phi.filter((s) => s.v.baa === k).length} label={`BAA ${k.toLowerCase()}`} color={COL[k]} onClick={() => setParams({ flag: k === 'Signed' ? null : 'baa', scope: 'HIPAA' })} source={`${grc} BAA register`} />)}
          <Stat value={ot.length} label="With remote device access" color="var(--m-ot)" onClick={() => setParams({ flag: 'ot' })} source={`${pam?.product ?? 'PAM'} session broker`} />
        </div>
        <div style={{ marginTop: 10 }}>
          <Seg parts={keys.map((k) => ({ key: k, n: phi.filter((s) => s.v.baa === k).length, color: COL[k], label: `BAA ${k.toLowerCase()}` }))} onPick={(k) => setParams({ flag: k === 'Signed' ? null : 'baa', scope: 'HIPAA' })} />
        </div>
        <SupList items={[...bad, ...ot.filter((s) => s.v.tier === 1 && !bad.includes(s))].slice(0, 6)} right={(s) => <>{s.v.baa && s.v.baa !== 'Not required' && <Pill color={s.v.baa === 'Signed' ? 'var(--good)' : 'var(--bad)'}>BAA {s.v.baa.toLowerCase()}</Pill>}{s.v.otRemote && <Pill color="var(--m-ot)">Device access</Pill>}</>} />
        <div style={{ marginTop: 10 }}><Callout kind="warn">Medical devices are read-only in HexaView by policy: OEM sessions are recorded in {pam?.product ?? 'the PAM broker'} and reviewed, never changed from here.</Callout></div>
      </Card>
    );
  }

  // automotive
  const LABELS = ['AL3 valid', 'AL2 valid', 'Expiring', 'Expired', 'No label'] as const;
  const LCOL = { 'AL3 valid': 'var(--good)', 'AL2 valid': 'var(--m-matrix)', Expiring: 'var(--sev-medium)', Expired: 'var(--sev-high)', 'No label': 'var(--bad)' } as const;
  const proto = sup.filter((s) => s.v.dataAccess.includes('Prototype'));
  const gap = proto.filter((s) => s.v.tisax !== 'AL3 valid');
  return (
    <Card title={<><Car size={15} /> TISAX labels across the supply chain</>} sub="VDA ISA · suppliers receiving prototype or design data must hold an AL3 label with prototype protection" toneColor="var(--m-comply)" tinted>
      <Seg parts={LABELS.map((l) => ({ key: l, n: sup.filter((s) => s.v.tisax === l).length, color: LCOL[l], label: l }))} onPick={(k) => setParams({ flag: k === 'AL3 valid' ? null : 'tisax', scope: 'TISAX' })} />
      <div style={{ marginTop: 10 }}>
        <Callout kind="warn"><button type="button" className="link" onClick={() => setParams({ flag: 'tisax' })}><b>{gap.length} suppliers</b></button> receive prototype data without a valid AL3 label. HexaCustody can hold OFTP2 transfers to them until assessed. {ot.length} robot and automation vendors reach plant cells remotely (read-only here).</Callout>
      </div>
      <SupList items={[...gap].sort((a, b) => a.v.tier - b.v.tier || b.score - a.score).slice(0, 4).concat(ot.filter((s) => s.v.tier === 1).slice(0, 2))} right={(s) => <>{s.v.tisax && <Pill color={LCOL[s.v.tisax]}>{s.v.tisax}</Pill>}{s.v.otRemote && <Pill color="var(--m-ot)">Robot cell access</Pill>}</>} />
      <div className="card-foot"><Sources items={c.connectors.filter((k) => ['Ratings', 'PAM', 'GRC'].includes(k.category)).map((k) => ({ name: k.product, status: k.status }))} /></div>
    </Card>
  );
}

/** Outside-in ratings and hosting concentration, with the ratings connector (or HexaInt fallback) named. */
export function RatingsPanel() {
  const { c, sup, setParams } = useTprm();
  const src = ratingsSource(c);
  const conn = c.connectors.find((k) => k.category === 'Ratings');
  const bands = [
    { key: 'lt60', label: 'Below 60', n: sup.filter((s) => s.v.rating < 60).length, color: 'var(--bad)' },
    { key: '60', label: '60–69', n: sup.filter((s) => s.v.rating >= 60 && s.v.rating < 70).length, color: 'var(--sev-high)' },
    { key: '70', label: '70–79', n: sup.filter((s) => s.v.rating >= 70 && s.v.rating < 80).length, color: 'var(--sev-medium)' },
    { key: '80', label: '80+', n: sup.filter((s) => s.v.rating >= 80).length, color: 'var(--good)' },
  ];
  const drops = sup.filter((s) => s.v.ratingDelta <= -5);
  const mean = Math.round(sup.reduce((a, s) => a + s.v.rating, 0) / Math.max(1, sup.length));
  const critical = sup.filter((s) => s.v.tier === 1 || s.v.cif || s.v.otRemote);
  const hosts = (['AWS', 'Azure', 'GCP', 'On-prem'] as const).map((h) => ({ h, n: critical.filter((s) => s.v.hosting === h).length }));
  const top = [...hosts].sort((a, b) => b.n - a.n)[0];
  const pct = Math.round((top.n / Math.max(1, critical.length)) * 100);
  return (
    <Card title={<><Radar size={15} /> Outside-in ratings</>} sub={src.connector ? `${src.name} · continuous rating of every supplier's attack surface` : 'No ratings connector: HexaShield scans the supplier attack surface through HexaInt'}
      actions={conn ? <Freshness minutes={conn.lastSyncMin} stale={src.stale} label={conn.vendor} /> : <Badge>HexaInt scan · daily</Badge>}>
      <div className="tp-statgrid">
        <Stat value={mean} label="Mean rating (higher is better)" onClick={() => setParams({ flag: null })} source={src.name} />
        <Stat value={drops.length} label="Dropped 5+ points in 30 days" color="var(--bad)" onClick={() => setParams({ flag: 'drops' })} source={src.name} />
        <Stat value={`${pct}%`} label={`Critical suppliers hosted on ${top.h}`} color={pct > 35 ? 'var(--sev-medium)' : undefined} onClick={() => setParams({ flag: null, risk: null })} source={`${src.name} · hosting fingerprint`} />
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="tp-label">Rating bands</div>
        <Seg parts={bands} onPick={() => setParams({ flag: 'drops' })} />
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="tp-label">Biggest drops</div>
        <SupList items={[...drops].sort((a, b) => a.v.ratingDelta - b.v.ratingDelta).slice(0, 4)} right={(s) => <span style={{ fontSize: 12 }}><b>{s.v.rating}</b> <span style={{ color: 'var(--bad)' }}>{s.v.ratingDelta}</span></span>} />
      </div>
      {pct > 35 && <div style={{ marginTop: 8 }}><Callout kind="warn"><b>{pct}%</b> of critical suppliers run on {top.h}. {c.id === 'finserv' ? 'DORA Art. 29 requires a concentration assessment before new arrangements.' : 'A single provider outage would hit several critical services at once.'}</Callout></div>}
      <div className="card-foot"><Sources items={[{ name: src.name, status: src.status }, ...c.connectors.filter((k) => k.category === 'GRC').map((k) => ({ name: k.product, status: k.status }))]} /></div>
    </Card>
  );
}

