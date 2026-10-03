import { useEffect, useMemo, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Btn, Badge, Chip } from '../../components/ui';
import { toolProfiles, activityStream, ENTITY_HEX, ENTITY_LABEL, type ToolProfile } from '../../data/modules/tooling';
import { ENV_HEX } from '../../data/modules/fabric';
import { fmtCompact, fmtNum, hourLabels } from '../../lib/format';
import { ToolDrawer, ToolMark, TONE, toneStyle } from './parts';

export default function ToolingActivity() {
  const { customer: c, tenantId } = useApp();
  const tools = useMemo(() => toolProfiles(c, tenantId), [c, tenantId]);
  const [tick, setTick] = useState(1000);
  const [live, setLive] = useState(true);
  const [onlyWrites, setOnlyWrites] = useState(false);
  const [open, setOpen] = useState<ToolProfile | null>(null);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setTick((x) => x + 1), 2200);
    return () => clearInterval(t);
  }, [live]);

  const events = activityStream(c, tools, tick, 40).filter((e) => !onlyWrites || e.write).slice(0, 16);
  const busiest = tools.slice().sort((a, b) => b.eventsPerMin - a.eventsPerMin);
  const maxEpm = Math.max(1, ...busiest.map((t) => t.eventsPerMin));
  const heatTools = busiest.slice(0, 14);
  const heatMax = Math.max(1, ...heatTools.flatMap((t) => t.hourly));
  const hours = hourLabels(24);
  const epm = tools.reduce((s, t) => s + t.eventsPerMin, 0);
  const writes = tools.reduce((s, t) => s + t.actions30d, 0);

  return (
    <div className="stack" style={{ gap: 16, ...toneStyle }}>
      <p className="page-intro">
        <b>{c.name}</b> · what every integrated tool is doing right now, normalised into HexaCore&rsquo;s canonical entities as it happens. Reads stream in continuously; <span style={{ color: '#f97316', fontWeight: 600 }}>write-back</span> appears only after a human approved it in the Action Centre.
      </p>

      <KpiStrip
        toneColor={TONE}
        items={[
          { label: 'Events / min', value: fmtCompact(epm), onClick: () => setOnlyWrites(false), source: 'hv-gateway throughput' },
          { label: 'Events today', value: fmtCompact(tools.reduce((s, t) => s + t.hourly.reduce((a, b) => a + b, 0), 0)), to: '/fabric/pipeline', source: 'HexaCore metering' },
          { label: 'Tools active', value: tools.filter((t) => t.eventsPerMin > 0).length, unit: `of ${tools.length}`, to: '/tooling/overview', source: 'Connector heartbeats' },
          { label: 'Write-backs (30 d)', value: writes, onClick: () => setOnlyWrites(true), source: 'Audit ledger (action.verified)' },
          { label: 'Busiest tool', value: busiest[0]?.short ?? '—', onClick: () => busiest[0] && setOpen(busiest[0]), source: 'hv-gateway throughput' },
        ]}
      />

      <div className="grid g-3-2">
        <Card
          title={<><span className="live-dot" /> Live tool activity</>}
          sub="Newest first · click a line for the tool"
          actions={
            <div className="row" style={{ gap: 6 }}>
              <Chip on={onlyWrites} onClick={() => setOnlyWrites((v) => !v)} color="#f97316">Write-back only</Chip>
              <Btn sm onClick={() => setLive((v) => !v)}>{live ? <Pause size={13} /> : <Play size={13} />}{live ? 'Pause' : 'Resume'}</Btn>
            </div>
          }
        >
          <div className="tl-feed">
            {events.map((e) => (
              <div key={e.id} className="tl-feed-row" onClick={() => setOpen(e.tool)} role="button">
                <ToolMark t={e.tool} size={30} />
                <div style={{ minWidth: 0 }}>
                  <b style={e.write ? { color: '#f97316' } : undefined}>{e.tool.short}</b> <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{e.text}</span>
                  <span style={{ display: 'block' }}>→ HexaCore <span style={{ color: ENTITY_HEX[e.entity], fontWeight: 600 }}>{ENTITY_LABEL[e.entity].toLowerCase()}</span> · {e.secAgo < 2 ? 'just now' : `${e.secAgo}s ago`}</span>
                </div>
                {e.write ? <Badge color="#f97316">Write</Badge> : <Badge color={ENV_HEX[e.tool.k.env]}>Read</Badge>}
              </div>
            ))}
            {events.length === 0 && <div className="empty">No write-back in the current window.</div>}
          </div>
        </Card>

        <Card title="Throughput by tool" sub="Events per minute, now · click a bar">
          <div className="tl-bars">
            {busiest.slice(0, 16).map((t) => (
              <div key={t.k.id} className="tl-bar-row" onClick={() => setOpen(t)} role="button">
                <span className="tl-bar-label">{t.short}</span>
                <span className="tl-bar-track"><i style={{ width: `${Math.max(2, (t.eventsPerMin / maxEpm) * 100)}%`, background: ENV_HEX[t.k.env] }} /></span>
                <span className="tl-bar-val">{fmtNum(t.eventsPerMin)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Activity over the last 24 hours" sub="Events per hour by tool · darker is busier · click a row">
        <div className="tl-heat" style={{ gridTemplateColumns: `170px repeat(24, minmax(0, 1fr))` }}>
          <span />
          {hours.map((h, i) => (
            <span key={i} className="muted" style={{ textAlign: 'center', fontSize: 9.5 }}>{i % 3 === 0 ? h.slice(0, 2) : ''}</span>
          ))}
          {heatTools.map((t) => (
            <div key={t.k.id} style={{ display: 'contents' }}>
              <span className="tl-heat-label" onClick={() => setOpen(t)}>{t.short}</span>
              {t.hourly.map((v, i) => (
                <span
                  key={i}
                  className="tl-heat-cell"
                  title={`${t.short} · ${hours[i]} · ${fmtNum(v)} events`}
                  style={{ background: ENV_HEX[t.k.env], opacity: 0.08 + (v / heatMax) * 0.92 }}
                  onClick={() => setOpen(t)}
                />
              ))}
            </div>
          ))}
        </div>
      </Card>

      {open && <ToolDrawer t={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
