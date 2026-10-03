import { useMemo, useState } from 'react';
import { ArrowRight, ExternalLink, Fingerprint } from 'lucide-react';
import { Card, KpiStrip, Chip, Btn, Badge, KV, Bar, Legend } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { Drawer } from '../../components/Overlay';
import { dayLabels, fmtAgo, fmtNum, hourLabels } from '../../lib/format';
import { aisecEvidence, EVSTATUS_HEX, STANDARDS, STANDARD_HEX, type EvidenceItem, type EvStatus, type Standard } from '../../data/modules/aisec';
import { AS_TONE, SensorNote, toneStyle, useAs } from './parts';

const AIGOV = '/comply/aigov';

export default function AisecCompliance() {
  const { c, tenantId, days, inv, scope, rl, nav, toast, comply } = useAs();
  const ev = useMemo(() => aisecEvidence(c, tenantId, days, inv), [c, tenantId, days, inv]);
  const [std, setStd] = useState<Standard | null>(null);
  const [status, setStatus] = useState<EvStatus | null>(null);
  const [sel, setSel] = useState<EvidenceItem | null>(null);
  const labels = days === 1 ? hourLabels(24) : dayLabels(ev.volume.n);
  const shown = ev.items.filter((e) => (!std || e.controls.some((k) => k.std === std)) && (!status || e.status === status));
  const by = (s: EvStatus) => ev.items.filter((e) => e.status === s).length;
  const freshPct = Math.round(ev.coverage.reduce((s, x) => s + x.fresh, 0) / ev.coverage.reduce((s, x) => s + x.total, 0) * 100);
  const records = ev.volume.pushed.reduce((s, v) => s + v, 0);

  return (
    <div className="stack" style={{ gap: 16, ...toneStyle }}>
      <p className="page-intro">
        <b>{c.name}</b> · {scope}. The runtime evidence HexaAI captures on the execution path and pushes to HexaComply, hashed and timestamped, so ISO/IEC 42001, EU AI Act and NIST AI RMF controls are proven continuously rather than at audit time. {rl}.
      </p>

      <button className="as-hero-link" onClick={() => nav(AIGOV)}>
        <div>
          <h3>Manage the AI management system in HexaComply</h3>
          <p>AI register and EU AI Act classes, ISO/IEC 42001 Annex A controls, NIST AI RMF maturity, impact assessments, model cards and the certification pathway live in HexaComply. This tab is the evidence feed into it.</p>
        </div>
        <span className="as-hero-cta">Open AI Management System <ArrowRight size={14} style={{ verticalAlign: -2 }} /></span>
      </button>

      <KpiStrip
        toneColor={AS_TONE}
        items={[
          { label: 'Evidence items', value: ev.items.length, unit: rl.replace('Last ', ''), onClick: () => { setStd(null); setStatus(null); }, source: 'HexaAI → HexaComply evidence API' },
          { label: 'Records attested', value: fmtNum(records), onClick: () => setStatus(null), source: 'Nexovern sensor via HexaAI' },
          { label: 'Accepted', value: by('accepted'), toneColor: EVSTATUS_HEX.accepted, onClick: () => setStatus('accepted'), source: 'HexaComply evidence review' },
          { label: 'Pushed, awaiting review', value: by('pushed'), toneColor: EVSTATUS_HEX.pushed, onClick: () => setStatus('pushed'), source: 'HexaComply evidence queue' },
          { label: 'Needs review', value: by('needs review'), toneColor: EVSTATUS_HEX['needs review'], onClick: () => setStatus('needs review'), source: 'HexaComply evidence review' },
          { label: 'Controls with fresh evidence', value: `${freshPct}%`, bar: freshPct, to: AIGOV, source: 'HexaComply AI Management System' },
        ]}
      />

      <div className="as-stdstrip">
        {ev.coverage.map((s) => (
          <button key={s.std} className="as-std" style={{ ['--sc' as string]: STANDARD_HEX[s.std] }} onClick={() => nav(AIGOV)} title={`Open ${s.std} in HexaComply`}>
            <div className="as-std-top"><b>{s.std}</b><span>{s.pct}%</span></div>
            <Bar value={s.pct} color={STANDARD_HEX[s.std]} size="thin" />
            <small>{s.fresh} of {s.total} controls with fresh runtime evidence →</small>
          </button>
        ))}
      </div>

      <div className="grid g-3-2">
        <Card
          title="Evidence feed"
          count={shown.length}
          sub="Newest first · SHA-256 of each signed evidence bundle · click for detail"
          flush
          actions={
            <div className="row wrap" style={{ gap: 6 }}>
              {STANDARDS.map((s) => <Chip key={s} on={std === s} color={STANDARD_HEX[s]} onClick={() => setStd(std === s ? null : s)}>{s}</Chip>)}
              {status && <Chip on color={EVSTATUS_HEX[status]} onClick={() => setStatus(null)}>{status} ×</Chip>}
            </div>
          }
        >
          <div style={{ maxHeight: 640, overflowY: 'auto' }}>
            {shown.map((e) => (
              <button key={e.id} className="as-evrow" onClick={() => setSel(e)}>
                <i style={{ background: EVSTATUS_HEX[e.status] }} />
                <div style={{ minWidth: 0 }}>
                  <b>{e.title}</b>
                  <p>{e.detail}</p>
                  <div className="row wrap" style={{ gap: 4 }}>
                    {e.controls.map((k) => <Badge key={`${k.std}${k.ref}`} color={STANDARD_HEX[k.std]}>{k.std.replace('OWASP LLM Top 10', 'OWASP').replace('MITRE ATLAS', 'ATLAS')} {k.ref}</Badge>)}
                  </div>
                  <span className="as-sha" style={{ marginTop: 5 }}><Fingerprint size={10} style={{ verticalAlign: -1 }} /> sha256:{e.sha}</span>
                </div>
                <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge color={EVSTATUS_HEX[e.status]} dot>{e.status}</Badge>
                  <span className="muted" style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>{fmtAgo(e.minAgo)}</span>
                  <span className="muted" style={{ fontSize: 10.5 }}>{e.source}</span>
                </div>
              </button>
            ))}
            {shown.length === 0 && <div className="empty">No evidence matches these filters.</div>}
          </div>
        </Card>

        <div className="stack" style={{ gap: 16 }}>
          <Card title="Evidence volume" sub={`${rl} · records pushed to HexaComply and accepted`} actions={<Legend items={[{ label: 'Pushed', color: EVSTATUS_HEX.pushed }, { label: 'Accepted', color: EVSTATUS_HEX.accepted }]} />}>
            <Chart
              height={230}
              option={{
                tooltip: { trigger: 'axis' },
                grid: { left: 8, right: 8, top: 12, bottom: 6, containLabel: true },
                xAxis: { type: 'category', data: labels, axisLabel: { interval: Math.max(0, Math.floor(labels.length / 6) - 1) } },
                yAxis: { type: 'value' },
                series: [
                  { name: 'Pushed', type: 'bar', data: ev.volume.pushed, itemStyle: { color: 'rgba(104,177,255,.5)' } },
                  { name: 'Accepted', type: 'line', data: ev.volume.accepted, symbol: 'none', lineStyle: { color: EVSTATUS_HEX.accepted, width: 2 } },
                ],
              }}
            />
          </Card>
          <Card title="Evidence by kind" sub="What the runtime proves">
            <div className="stack" style={{ gap: 8 }}>
              {Object.entries(ev.items.reduce<Record<string, number>>((a, e) => ({ ...a, [e.kind]: (a[e.kind] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                <div key={k} className="row" style={{ gap: 10, fontSize: 12 }}>
                  <span style={{ width: 120 }}>{k}</span>
                  <div style={{ flex: 1 }}><Bar value={n} max={ev.items.length / 3} color={AS_TONE} size="thin" /></div>
                  <b className="num" style={{ width: 28, textAlign: 'right' }}>{n}</b>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <SensorNote>evidence is captured below the application layer and signed before it leaves the host</SensorNote>
            </div>
          </Card>
          <Card title="Where this evidence lands">
            <div className="stack" style={{ gap: 8 }}>
              <Btn onClick={() => nav(AIGOV)}><ExternalLink size={13} /> HexaComply · AI Management System (ISO 42001)</Btn>
              <Btn onClick={() => nav('/comply/caas')}><ExternalLink size={13} /> HexaComply · Compliance (cross-framework mapping)</Btn>
            </div>
            {comply && <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>HexaComply connector {comply.version} · last sync {fmtAgo(comply.lastSyncMin)}</p>}
          </Card>
        </div>
      </div>

      {sel && (
        <Drawer
          title={sel.title}
          sub={`${sel.id} · ${fmtAgo(sel.minAgo)} · ${sel.tenant}`}
          onClose={() => setSel(null)}
          footer={<>
            {sel.status === 'needs review' && <Btn onClick={() => { toast(`Review requested from ${c.people.grcLead.name} for ${sel.id}`); setSel(null); }}>Request review</Btn>}
            <Btn primary color={AS_TONE} onClick={() => nav(AIGOV)}>Open in HexaComply</Btn>
          </>}
        >
          <div className="row" style={{ gap: 6 }}><Badge color={EVSTATUS_HEX[sel.status]} dot>{sel.status}</Badge><Badge>{sel.kind}</Badge></div>
          <KV rows={[
            ['Detail', sel.detail],
            ['Supports', <span className="chips">{sel.controls.map((k) => <Badge key={k.ref} color={STANDARD_HEX[k.std]}>{k.std} {k.ref}</Badge>)}</span>],
            ['Captured', `${fmtAgo(sel.minAgo)} by ${sel.source}`],
            ['Records', fmtNum(sel.items)],
            ['SHA-256', <span className="mono" style={{ fontSize: 10.5, wordBreak: 'break-all' }}>{sel.sha}</span>],
            ['Chain of custody', 'Signed on host → HexaAI → HexaComply evidence store (WORM) · hash anchored in the audit ledger'],
          ]} />
          <SensorNote />
        </Drawer>
      )}
    </div>
  );
}
