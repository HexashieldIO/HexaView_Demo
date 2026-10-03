import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Lock } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { otScope, otAlertLog, alertBands, distribute, bundleAgeMin, BAND_HEX, type OtAlertRow, type RiskBand } from '../../data/modules/ot';
import { TECHNIQUE_BY_ID } from '../../data/reference';
import { KpiStrip, Card, Badge, StatusBadge, Chip, IcoBox, Callout } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { dayLabels, fmtAgo, fmtDateTime, ago, fmtNum } from '../../lib/format';
import { rng } from '../../lib/rng';
import { OT_TONE, OtIntro, NoOtState, RiskChip, srcNames } from './parts';

const STATUS_COLOR: Record<string, string> = { Open: 'var(--accent)', Acknowledged: 'var(--text-muted)', Closed: 'var(--good)' };
const BANDS: RiskBand[] = ['Very high', 'High', 'Medium', 'Low'];

export default function OtAlerts() {
  const { customer: c, tenantId } = useApp();
  const [params, setParams] = useSearchParams();
  const sc = useMemo(() => otScope(c, tenantId), [c, tenantId]);
  const log = useMemo(() => otAlertLog(c, tenantId), [c, tenantId]);
  const bands = useMemo(() => alertBands(c, tenantId), [c, tenantId]);
  const band = params.get('band');
  const status = params.get('status');
  const site = params.get('site');
  const sec = params.get('kind') === 'security';
  const q = params.get('q');
  const openId = params.get('id');
  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    p.delete('id');
    if (v === null || p.get(k) === v) p.delete(k);
    else p.set(k, v);
    setParams(p, { replace: true });
  };

  const heat = useMemo(() => {
    const r = rng(`ot-heat-${c.id}-${tenantId}`);
    return sc.sites.map((s) => ({ s, days: distribute(bands.siteTotals[s.id] ?? 0, Array.from({ length: 14 }, (_, i) => r.float(0.5, 1.4, 2) * (i === 9 ? 1.7 : 1) * (s.airGapped && i === 13 ? 0.35 : 1))) }));
  }, [c, tenantId, sc, bands]);

  if (!sc.hasOt) return <NoOtState what="OT alerts cover sites that run operational technology." />;
  const src = srcNames(sc);
  const rows = log.filter((a) =>
    (!band || (band === 'High+' ? a.risk >= 7 : a.band === band)) && (!status || a.status === status) && (!site || a.siteId === site) && (!sec || a.kind === 'Security-relevant') &&
    (!q || `${a.title} ${a.src.name} ${a.dst.name} ${a.siteName} ${a.zone} ${a.protocol}`.toLowerCase().includes(q.toLowerCase())));
  const sel = log.find((a) => a.id === openId) ?? null;
  const open = log.filter((a) => a.status === 'Open').length;
  const peak = Math.max(0, ...log.map((a) => a.risk));
  const heatMax = Math.max(1, ...heat.flatMap((h) => h.days));
  const labels = dayLabels(14);
  const gapSite = sc.sites.find((s) => s.airGapped);

  return (
    <>
      <OtIntro>
        <b>{c.name}</b> · every alert the sensors raised in the last 14 days, scored 0–10 on what it touched as well as what it was, from {src}. The {log.length} most recent are listed with what our analysts found. Nothing on this page sends anything to a device.
      </OtIntro>

      <KpiStrip
        toneColor={OT_TONE}
        items={[
          { label: 'Raised', hint: 'last 14 days', value: fmtNum(bands.total), onClick: () => setParams(new URLSearchParams(), { replace: true }), source: src },
          { label: 'High & above', hint: 'needed a look', value: fmtNum(bands.bands['Very high'] + bands.bands.High), toneColor: 'var(--sev-high)', onClick: () => setParams(new URLSearchParams({ band: 'High+' }), { replace: true }), source: src },
          { label: 'Peak risk', hint: 'highest scored', value: peak, unit: 'of 10', toneColor: 'var(--sev-critical)', onClick: () => setParams(new URLSearchParams({ band: 'Very high' }), { replace: true }), source: src },
          { label: 'Listed here', hint: 'most recent', value: log.length, onClick: () => setParams(new URLSearchParams(), { replace: true }), source: src },
          { label: 'Still open', hint: 'of those listed', value: open, bar: (open / Math.max(1, log.length)) * 100, onClick: () => setParams(new URLSearchParams({ status: 'Open' }), { replace: true }), source: `${src} · HexaSOC case status` },
        ]}
      />

      {gapSite && (
        <Callout kind="info" color={OT_TONE}>
          Alerts from {gapSite.name} arrive with the signed bundle every {gapSite.bundleHours ?? 6} h (last {fmtAgo(bundleAgeMin(c))}). Times shown are when the sensor saw them, not when HexaView received them.
        </Callout>
      )}

      <Card title="Where and when" sub="Alerts per site per day, last 14 days · click a row to filter the list" actions={<span className="t-sub">darker = more alerts</span>}>
        <div className="ot-heat" style={{ gridTemplateColumns: `minmax(140px, 220px) repeat(14, minmax(0, 1fr)) 64px` }}>
          <span />
          {labels.map((d, i) => <span key={i} className="day">{i % 2 === 0 ? d : ''}</span>)}
          <span className="day">Total</span>
          {heat.map(({ s, days }) => (
            <FragmentRow key={s.id} name={s.name} days={days} max={heatMax} total={bands.siteTotals[s.id] ?? 0} on={site === s.id} onClick={() => set('site', s.id)} labels={labels} />
          ))}
        </div>
      </Card>

      <div className="ot-filters">
        <span>
          <em>Risk band</em>
          <Chip on={!band} onClick={() => set('band', null)} color={OT_TONE}>All</Chip>
          {BANDS.map((b) => <Chip key={b} on={band === b} onClick={() => set('band', b)} color={BAND_HEX[b]}>{b}</Chip>)}
        </span>
        <span>
          <em>Status</em>
          <Chip on={!status} onClick={() => set('status', null)} color={OT_TONE}>All</Chip>
          {['Open', 'Acknowledged', 'Closed'].map((s) => <Chip key={s} on={status === s} onClick={() => set('status', s)} color={STATUS_COLOR[s]}>{s}</Chip>)}
        </span>
        <span>
          <em>Kind</em>
          <Chip on={sec} onClick={() => set('kind', 'security')} color="var(--sev-high)">Security-relevant only</Chip>
        </span>
        {(site || q) && (
          <span>
            {site && <Chip on onClick={() => set('site', null)} color={OT_TONE}>{sc.sites.find((s) => s.id === site)?.name} ✕</Chip>}
            {q && <Chip on onClick={() => set('q', null)} color={OT_TONE}>“{q}” ✕</Chip>}
          </span>
        )}
      </div>

      <Card title="Alerts" count={rows.length} sub={`${rows.length} of the ${log.length} most recent · ${fmtNum(bands.total)} raised in total · click for what our analysts found`} flush>
        <DataTable
          rows={rows}
          rowKey={(a) => a.id}
          onRowClick={(a) => setParams((p) => { const n = new URLSearchParams(p); n.set('id', a.id); return n; }, { replace: true })}
          search={(a) => `${a.title} ${a.src.name} ${a.dst.name} ${a.siteName} ${a.zone} ${a.protocol} ${a.src.ip} ${a.dst.ip}`}
          searchPlaceholder="Search alert, asset, address…"
          initialSort={{ key: 'when', dir: 'desc' }}
          pageSize={10}
          columns={[
            { key: 'risk', header: 'Risk', sort: (a) => a.risk, render: (a) => <RiskChip n={a.risk} /> },
            { key: 'alert', header: 'Alert', sort: (a) => a.title, render: (a) => (<><div className="t-main" style={{ whiteSpace: 'normal' }}>{a.title}</div><div className="t-sub">{a.kind} · {a.protocol}</div></>) },
            { key: 'when', header: 'When', sort: (a) => -a.ageMin, render: (a) => (<><div>{fmtDateTime(ago(a.ageMin))}</div><div className="t-sub">{fmtAgo(a.ageMin)}</div></>) },
            { key: 'site', header: 'Site & zone', sort: (a) => a.siteName, render: (a) => (<><div>{a.siteName}</div><div className="t-sub">{a.zone}</div></>) },
            { key: 'conv', header: 'Conversation', render: (a) => (<span className="ot-conv"><b>{a.src.name} → {a.dst.name}</b><span>{a.src.ip} → {a.dst.ip}</span></span>) },
            { key: 'st', header: 'Status', sort: (a) => a.status, render: (a) => <StatusBadge value={a.status} map={STATUS_COLOR} /> },
          ]}
          empty="No alerts match these filters."
        />
      </Card>

      {sel && <AlertDrawer a={sel} onClose={() => set('id', null)} />}
    </>
  );
}

function FragmentRow({ name, days, max, total, on, onClick, labels }: { name: string; days: number[]; max: number; total: number; on: boolean; onClick: () => void; labels: string[] }) {
  return (
    <>
      <span className="lbl" style={{ fontWeight: on ? 700 : undefined, color: on ? 'var(--text-primary)' : undefined }} title={name}>{name}</span>
      {days.map((n, i) => (
        <button key={i} className="cell" onClick={onClick} title={`${name} · ${labels[i]}: ${n} alerts`} style={{ background: `rgba(245, 168, 61, ${0.08 + (n / max) * 0.85})`, outline: on ? '1px solid var(--m-ot)' : undefined }} />
      ))}
      <span className="lbl" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtNum(total)}</span>
    </>
  );
}

function AlertDrawer({ a, onClose }: { a: OtAlertRow; onClose: () => void }) {
  return (
    <Drawer
      wide
      title={a.title}
      sub={`${fmtDateTime(ago(a.ageMin))} · ${a.siteName} · ${a.zone}`}
      icon={<IcoBox color={BAND_HEX[a.band]}><AlertTriangle /></IcoBox>}
      onClose={onClose}
      footer={<span className="muted" style={{ fontSize: 11.5 }}><Lock size={12} style={{ verticalAlign: -2 }} /> Observed passively · read-only view · acknowledging and closing happens in HexaSOC, not here.</span>}
    >
      <div className="chips" style={{ marginBottom: 12 }}>
        <Badge color={BAND_HEX[a.band]} solid={a.risk >= 9}>risk {a.risk} · {a.band}</Badge>
        <StatusBadge value={a.status} map={STATUS_COLOR} />
        <Badge color="var(--text-muted)">{a.kind}</Badge>
        <Badge color="var(--text-muted)">{a.id}</Badge>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{a.desc}</p>
      <div className="section-label">The conversation</div>
      <div className="ot-conv-grid">
        <span /><span className="h">Source</span><span className="h">Destination</span>
        <span className="k">Address</span><span className="m">{a.src.ip}</span><span className="m">{a.dst.ip}</span>
        <span className="k">Asset</span><span className="m">{a.src.name}</span><span className="m">{a.dst.name}</span>
        <span className="k">Role</span><span>{a.src.role}</span><span>{a.dst.role}</span>
        <span className="k">Zone</span><span>{a.src.zone}</span><span>{a.dst.zone}</span>
      </div>
      <div className="t-sub" style={{ marginTop: 6 }}>Protocol {a.protocol} · seen by {a.source}</div>
      <div className="section-label" style={{ marginTop: 16 }}>Why this fires</div>
      <p style={{ margin: 0, fontSize: 13 }}>{a.why}</p>
      <div className="section-label" style={{ marginTop: 16 }}>What we did</div>
      <p style={{ margin: 0, fontSize: 13 }}>{a.what}</p>
      {a.techniques.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 16 }}>If this were an attack</div>
          <div className="list">
            {a.techniques.map((t) => (
              <div key={t} className="list-row" style={{ padding: '6px 0' }}>
                <Badge color="#a07cfb">{TECHNIQUE_BY_ID[t]?.tactic ?? 'ICS'}</Badge>
                <span className="list-main"><b>{TECHNIQUE_BY_ID[t]?.name ?? t}</b></span>
                <span className="mono t-sub">{t}</span>
              </div>
            ))}
          </div>
          <div className="t-sub" style={{ marginTop: 4 }}>MITRE ATT&CK for ICS techniques this traffic pattern would fit.</div>
        </>
      )}
    </Drawer>
  );
}
