import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Card, KpiStrip, Chip, Btn, Badge, KV, SevBadge } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { Drawer } from '../../components/Overlay';
import { DataTable } from '../../components/DataTable';
import { dayLabels, fmtAgo, fmtNum, hourLabels } from '../../lib/format';
import { OWASP_LLM } from '../../data/modules/ai';
import {
  aisecOwasp, aisecAtlas, aisecDetections, aisecIncidents, aisecThreatTrend, ATLAS_TACTICS, DET_HEX, VERDICT_HEX,
  type Detection, type DetType,
} from '../../data/modules/aisec';
import { AS_TONE, AS_HEX, HeatMatrix, ItemDrawer, RecordsDrawer, SensorNote, toneStyle, useAs } from './parts';
import type { AsItem } from '../../data/modules/aisec';

const DET_TYPES: DetType[] = ['Prompt injection', 'Jailbreak', 'Data leakage', 'Excessive agency', 'System prompt leakage', 'Unbounded consumption'];

export default function AisecThreats() {
  const { c, tenantId, days, inv, scope, rl, nav, siem } = useAs();
  const [params, setParams] = useSearchParams();
  const owaspFilter = params.get('owasp');
  const [typeFilter, setTypeFilter] = useState<DetType | null>(null);
  const [det, setDet] = useState<Detection | null>(null);
  const [open, setOpen] = useState<AsItem | null>(null);
  const [cell, setCell] = useState<{ title: string; rows: Detection[] } | null>(null);

  const owasp = useMemo(() => aisecOwasp(c, tenantId, days, inv), [c, tenantId, days, inv]);
  const atlas = useMemo(() => aisecAtlas(c, tenantId, days), [c, tenantId, days]);
  const dets = useMemo(() => aisecDetections(c, tenantId, days), [c, tenantId, days]);
  const incidents = aisecIncidents(c, tenantId);
  const trend = aisecThreatTrend(c, tenantId, days);
  const labels = days === 1 ? hourLabels(24) : dayLabels(trend.n);
  const owaspTotal = owasp.rows.reduce((s, r) => s + r.cells.reduce((a, b) => a + b, 0), 0);
  const count = (t: DetType) => owasp.rows.filter((r) => (t === 'Prompt injection' ? r.id === 'LLM01' : t === 'Data leakage' ? r.id === 'LLM02' : t === 'Excessive agency' ? r.id === 'LLM06' : false)).reduce((s, r) => s + r.cells.reduce((a, b) => a + b, 0), 0);
  const jail = Math.round(count('Prompt injection') * 0.42);
  const shownDets = dets.filter((d) => (!typeFilter || d.type === typeFilter) && (!owaspFilter || d.owasp === owaspFilter));
  const atlasMax = Math.max(1, ...atlas.map((a) => a.count));
  const findItem = (name: string) => inv.find((x) => x.name === name || x.name.startsWith(name));

  return (
    <div className="stack" style={{ gap: 16, ...toneStyle }}>
      <p className="page-intro">
        <b>{c.name}</b> · {scope}. Every AI session is mapped to the <b>OWASP Top 10 for LLM Applications (2025)</b> and <b>MITRE ATLAS</b>. Prompt injection, jailbreaks, data leakage and excessive agency are detected at runtime; AI incidents are forwarded to the 24/7 SOC through HexaSOC{siem ? ` and ${siem.vendor} ${siem.product}` : ''}. {rl}.
      </p>
      <KpiStrip
        toneColor={AS_TONE}
        items={[
          { label: 'Sessions mapped', value: fmtNum(owaspTotal), unit: 'detections', onClick: () => setTypeFilter(null), source: 'HexaAI OWASP / ATLAS mapping' },
          { label: 'Prompt injection', value: fmtNum(count('Prompt injection')), toneColor: DET_HEX['Prompt injection'], to: '/ai-governance/threats?owasp=LLM01', source: 'HexaAI · Prompt Shields' },
          { label: 'Jailbreaks', value: fmtNum(jail), toneColor: DET_HEX.Jailbreak, onClick: () => setTypeFilter('Jailbreak'), source: 'HexaAI · Prompt Shields' },
          { label: 'Data leakage', value: fmtNum(count('Data leakage')), toneColor: DET_HEX['Data leakage'], to: '/ai-governance/threats?owasp=LLM02', source: 'Nexovern sensor (memory scan)' },
          { label: 'Excessive agency', value: fmtNum(count('Excessive agency')), toneColor: DET_HEX['Excessive agency'], to: '/ai-governance/threats?owasp=LLM06', source: 'Nexovern sensor (tool & MCP calls)' },
          { label: 'AI incidents → HexaSOC', value: incidents.length, unit: `${incidents.filter((i) => i.status !== 'Resolved').length} open`, toneColor: 'var(--bad)', to: '/soc/ir', source: 'HexaSOC case management' },
        ]}
      />

      <div className="grid g-3-2">
        <Card title="OWASP Top 10 for LLM Applications (2025)" sub="Detections by risk and AI estate segment · click a cell for the sessions">
          <HeatMatrix
            rows={owasp.rows.map((r) => ({ id: r.id, label: <><b className="mono" style={{ fontSize: 10.5, color: 'var(--text-primary)' }}>{r.id}</b> {r.name}</> }))}
            cols={[...owasp.cols]}
            cells={owasp.rows.map((r) => r.cells)}
            color={AS_HEX}
            rowW={230}
            onCell={(ri, ci) => { const id = owasp.rows[ri].id; setCell({ title: `${id} ${owasp.rows[ri].name} · ${owasp.cols[ci]}`, rows: dets.filter((d) => d.owasp === id) }); }}
          />
          <div className="row between" style={{ marginTop: 10 }}>
            <SensorNote>agent and MCP rows rely on execution-path telemetry, invisible to app-layer tools</SensorNote>
            {owaspFilter && <Chip on color={AS_TONE} onClick={() => setParams((p) => { p.delete('owasp'); return p; })}>{owaspFilter} ×</Chip>}
          </div>
        </Card>
        <Card title="Threat trend" sub={rl}>
          <Chart
            height={300}
            option={{
              legend: { top: 0, left: 0 },
              tooltip: { trigger: 'axis' },
              grid: { left: 8, right: 8, top: 34, bottom: 6, containLabel: true },
              xAxis: { type: 'category', data: labels, axisLabel: { interval: Math.max(0, Math.floor(labels.length / 6) - 1) } },
              yAxis: { type: 'value' },
              series: Object.entries(trend.series).map(([k, v]) => ({ name: k, type: 'line', data: v, symbol: 'none', lineStyle: { color: DET_HEX[k as DetType], width: 2 }, itemStyle: { color: DET_HEX[k as DetType] } })),
            }}
          />
        </Card>
      </div>

      <Card title="MITRE ATLAS techniques observed" sub="Tiles shaded by detections in the range · grouped by tactic · click a technique">
        <div className="as-atlas">
          {ATLAS_TACTICS.map((t) => (
            <div key={t} className="as-atlas-col">
              <div className="as-atlas-head">{t}</div>
              {atlas.filter((a) => a.tactic === t).map((a) => {
                const k = a.count / atlasMax;
                return (
                  <button
                    key={a.id}
                    className="as-atlas-tile"
                    style={{ background: `color-mix(in srgb, #f0466e ${Math.round(8 + k * 70)}%, var(--surface-sunken))`, color: k > 0.55 ? '#fff' : undefined }}
                    onClick={() => setCell({ title: `${a.id} ${a.name}`, rows: dets.filter((d) => d.atlas === a.id) })}
                    title={`${a.id} ${a.name}: ${a.count}`}
                  >
                    <em>{a.id}</em>
                    <span>{a.name}</span>
                    <b>{fmtNum(a.count)}</b>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid g-3-2">
        <Card
          title="Detections"
          count={shownDets.length}
          sub="Prompt injection, jailbreak, leakage and agency detections with verdict"
          flush
          actions={<div className="row wrap" style={{ gap: 6 }}>{DET_TYPES.map((t) => <Chip key={t} on={typeFilter === t} color={DET_HEX[t]} onClick={() => setTypeFilter(typeFilter === t ? null : t)}>{t}</Chip>)}</div>}
        >
          <DataTable
            rows={shownDets}
            rowKey={(d) => d.id}
            onRowClick={setDet}
            initialSort={{ key: 'when', dir: 'asc' }}
            pageSize={10}
            search={(d) => `${d.type} ${d.system} ${d.sample} ${d.owasp} ${d.atlas}`}
            columns={[
              { key: 'when', header: 'When', sort: (d) => d.minAgo, render: (d) => <span className="t-sub">{fmtAgo(d.minAgo)}</span> },
              { key: 'type', header: 'Detection', sort: (d) => d.type, render: (d) => <Badge color={DET_HEX[d.type]}>{d.type}</Badge> },
              { key: 'sys', header: 'AI system', sort: (d) => d.system, render: (d) => (<><div className="t-main">{d.system}</div><div className="t-sub" style={{ whiteSpace: 'normal', maxWidth: 360 }}>{d.sample}</div></>) },
              { key: 'map', header: 'Mapping', render: (d) => <span className="mono" style={{ fontSize: 11 }}>{d.owasp} · {d.atlas}</span> },
              { key: 'sev', header: 'Severity', sort: (d) => ['critical', 'high', 'medium', 'low'].indexOf(d.sev), render: (d) => <SevBadge sev={d.sev} /> },
              { key: 'v', header: 'Verdict', sort: (d) => d.verdict, render: (d) => <Badge color={VERDICT_HEX[d.verdict]} dot>{d.verdict}</Badge> },
            ]}
          />
        </Card>
        <Card title="AI incidents forwarded to HexaSOC" count={incidents.length} sub="Opened by HexaAI, worked by the 24/7 SOC" flush actions={<button className="link" onClick={() => nav('/soc/ir')}>Incidents & Response →</button>}>
          <div className="list" style={{ padding: '0 18px 8px' }}>
            {incidents.map((x) => (
              <button key={x.id} className="list-row" onClick={() => nav('/soc/ir')}>
                <span className="list-main">
                  <b style={{ whiteSpace: 'normal' }}>{x.title}</b>
                  <span>{x.id} · {x.owasp} {OWASP_LLM.find((o) => o.id === x.owasp)?.name} · {x.atlas} · {x.analyst}</span>
                </span>
                <span className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <SevBadge sev={x.sev} />
                  <Badge color={x.status === 'Resolved' ? 'var(--good)' : x.status === 'Contained' ? 'var(--sev-medium)' : 'var(--bad)'}>{x.status}</Badge>
                  <span className="muted" style={{ fontSize: 10.5 }}>{fmtAgo(x.ageH * 60)}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {det && (
        <Drawer title={`${det.type} · ${det.system}`} sub={`${det.id} · ${fmtAgo(det.minAgo)}`} onClose={() => setDet(null)} footer={<>{findItem(det.system) && <Btn onClick={() => { const it = findItem(det.system); setDet(null); if (it) setOpen(it); }}>Open AI system</Btn>}<Btn primary color={AS_TONE} onClick={() => nav('/soc/ir')}><ExternalLink size={13} /> Escalate in HexaSOC</Btn></>}>
          <div className="row" style={{ gap: 6 }}><Badge color={DET_HEX[det.type]}>{det.type}</Badge><SevBadge sev={det.sev} /><Badge color={VERDICT_HEX[det.verdict]} dot>{det.verdict}</Badge></div>
          <KV rows={[
            ['Evidence (redacted)', <span className="mono" style={{ fontSize: 11.5 }}>{det.sample}</span>],
            ['OWASP LLM', `${det.owasp} ${OWASP_LLM.find((o) => o.id === det.owasp)?.name ?? ''}`],
            ['MITRE ATLAS', det.atlas],
            ['Host', det.host],
            ['User', det.user],
            ['Detected by', det.type === 'Excessive agency' || det.type === 'Data leakage' ? 'Nexovern sensor (execution path)' : 'HexaAI Prompt Shields on the session'],
            ['Forwarded', det.sev === 'critical' || det.sev === 'high' ? 'HexaSOC case opened automatically' : 'Logged; correlated by HexaSOC'],
          ]} />
          <SensorNote />
        </Drawer>
      )}
      {cell && <RecordsDrawer title={cell.title} source="HexaAI session mapping" onClose={() => setCell(null)} rows={cell.rows.map((d) => ({ key: d.id, main: `${d.type} · ${d.system}`, sub: d.sample, right: <Badge color={VERDICT_HEX[d.verdict]} dot>{d.verdict}</Badge>, onClick: () => { setCell(null); setDet(d); } }))} />}
      {open && <ItemDrawer item={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
