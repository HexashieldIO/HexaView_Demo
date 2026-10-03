import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, Cpu, Monitor, Server, Boxes, Cloud, MonitorSmartphone } from 'lucide-react';
import { Card, KpiStrip, Bar, Badge, Btn, Stacked, Legend, Timeline, KV, Callout } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { dayLabels, fmtAgo, fmtNum } from '../../lib/format';
import { aisecSensors, ENV_HEX, SENSOR_ENVS, type SensorEnv } from '../../data/modules/aisec';
import { AS_TONE, AS_HEX, ActionModal, RecordsDrawer, toneStyle, useAs } from './parts';

const ENV_ICON: Record<SensorEnv, typeof Monitor> = { Endpoints: Monitor, Servers: Server, Kubernetes: Boxes, 'Cloud workloads': Cloud, VDI: MonitorSmartphone };
const MECH: Record<SensorEnv, string> = {
  Endpoints: 'Kernel driver (Windows) · System Extension (macOS)',
  Servers: 'Kernel driver (Windows) · eBPF (Linux)',
  Kubernetes: 'eBPF DaemonSet, one per node',
  'Cloud workloads': 'eBPF / kernel driver via cloud image pipeline',
  VDI: 'Baked into golden images; per-session attribution',
};

export default function AisecSensors() {
  const { c, tenantId, scope, toast } = useAs();
  const s = useMemo(() => aisecSensors(c, tenantId), [c, tenantId]);
  const [params, setParams] = useSearchParams();
  const env = params.get('env') as SensorEnv | null;
  const [wave, setWave] = useState<(typeof s.rollout)[number] | null>(null);
  const [drill, setDrill] = useState<'tamper' | 'unhealthy' | null>(null);
  const setEnv = (e: SensorEnv | null) => setParams((p) => { const n = new URLSearchParams(p); if (e) n.set('env', e); else n.delete('env'); return n; }, { replace: true });
  const envs = env ? s.envs.filter((e) => e.env === env) : s.envs;
  const healthy = envs.reduce((a, e) => a + e.healthy, 0);
  const degraded = envs.reduce((a, e) => a + e.degraded, 0);
  const offline = envs.reduce((a, e) => a + e.offline, 0);
  const current = s.versions.filter((v) => v.current).reduce((a, v) => a + v.n, 0);
  const hosts = envs.reduce((a, e) => a + e.hosts, 0);
  const covered = envs.reduce((a, e) => a + e.covered, 0);
  const VCOL = ['#2dd4bf', '#4f8cff', '#f0a338', '#f0466e'];

  return (
    <div className="stack" style={{ gap: 16, ...toneStyle }}>
      <p className="page-intro">
        <b>{c.name}</b> · {scope}. The <b>runtime sensor by Nexovern</b> sits on the execution path, below the application: it sees process, memory, network and system calls, enforces guardrails and the kill switch, and is built to resist being disabled by a rogue administrator or high-privilege malware. HexaShield deploys and operates the fleet as part of the managed service.
      </p>
      <KpiStrip
        toneColor={AS_TONE}
        items={[
          { label: 'AI-estate hosts', value: fmtNum(hosts), onClick: () => setEnv(null), source: 'HexaAI estate model · CMDB and cloud inventories' },
          { label: 'Covered', value: `${hosts ? Math.round((covered / hosts) * 1000) / 10 : 0}%`, unit: `${fmtNum(covered)} sensors`, bar: hosts ? (covered / hosts) * 100 : 0, onClick: () => setEnv(null), source: 'Nexovern sensor fleet' },
          { label: 'Healthy', value: fmtNum(healthy), toneColor: 'var(--good)', source: 'Sensor heartbeats', onClick: () => setDrill('unhealthy') },
          { label: 'Degraded / offline', value: `${fmtNum(degraded)} / ${fmtNum(offline)}`, toneColor: 'var(--sev-medium)', onClick: () => setDrill('unhealthy'), source: 'Sensor heartbeats' },
          { label: 'Tamper attempts resisted', value: s.tamperTotal, unit: '90 days', toneColor: 'var(--bad)', onClick: () => setDrill('tamper'), source: 'Nexovern sensor self-protection' },
          { label: 'On current version', value: `${Math.round((current / Math.max(1, s.covered)) * 100)}%`, unit: '3.4.x', source: 'Sensor version reports', onClick: () => document.getElementById('as-versions')?.scrollIntoView({ behavior: 'smooth' }) },
        ]}
      />

      <div className="grid g5">
        {s.envs.map((e) => {
          const Icon = ENV_ICON[e.env];
          return (
            <button key={e.env} className={`as-env ${env === e.env ? 'on' : ''}`} style={{ ['--ec' as string]: ENV_HEX[e.env] }} onClick={() => setEnv(env === e.env ? null : e.env)}>
              <div className="row" style={{ gap: 8 }}>
                <span className="ico-box" style={{ ['--tone' as string]: ENV_HEX[e.env] }}><Icon /></span>
                <b style={{ fontSize: 12.5 }}>{e.env}</b>
              </div>
              <div className="kpi-value" style={{ marginTop: 0 }}>{e.pct}%<small>{fmtNum(e.covered)}/{fmtNum(e.hosts)}</small></div>
              <Bar value={e.pct} color={ENV_HEX[e.env]} />
              <span className="muted" style={{ fontSize: 11 }}>{e.note}</span>
              <span style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>{MECH[e.env]}</span>
            </button>
          );
        })}
      </div>

      <div className="grid g-3-2">
        <Card title="Coverage vs AI estate" sub={env ? `${env} · click a card above to change` : 'Covered, degraded, offline and uncovered hosts by environment'} actions={<Legend items={[{ label: 'Healthy', color: '#2dd4bf' }, { label: 'Degraded', color: '#f0a338' }, { label: 'Offline', color: '#f0466e' }, { label: 'Not covered', color: '#8593b4' }]} />}>
          <Chart
            height={250}
            option={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              grid: { left: 8, right: 16, top: 6, bottom: 6, containLabel: true },
              xAxis: { type: 'value' },
              yAxis: { type: 'category', data: envs.map((e) => e.env), axisLabel: { fontSize: 10.5 } },
              series: [
                { name: 'Healthy', type: 'bar', stack: 'h', data: envs.map((e) => e.healthy), itemStyle: { color: '#2dd4bf' }, barMaxWidth: 20 },
                { name: 'Degraded', type: 'bar', stack: 'h', data: envs.map((e) => e.degraded), itemStyle: { color: '#f0a338' } },
                { name: 'Offline', type: 'bar', stack: 'h', data: envs.map((e) => e.offline), itemStyle: { color: '#f0466e' } },
                { name: 'Not covered', type: 'bar', stack: 'h', data: envs.map((e) => e.hosts - e.covered), itemStyle: { color: 'rgba(133,147,180,.45)', borderRadius: [0, 3, 3, 0] } },
              ],
            }}
          />
        </Card>
        <Card title="Footprint vs app-layer agents" sub="Per host, measured on the reference workload · lower is better">
          <div className="as-fp">
            {s.footprint.map((f) => {
              const max = Math.max(f.sensor, f.app);
              return (
                <div key={f.label} style={{ display: 'contents' }}>
                  <span className="muted">{f.label}</span>
                  <div className="as-fp-bars">
                    <div className="row" style={{ gap: 8 }}><div style={{ width: `${(f.sensor / max) * 72}%`, height: 9, borderRadius: 4, background: AS_HEX }} /><span style={{ fontSize: 11 }}><b>{f.sensor}</b> kernel sensor</span></div>
                    <div className="row" style={{ gap: 8 }}><div style={{ width: `${(f.app / max) * 72}%`, height: 9, borderRadius: 4, background: '#8593b4' }} /><span style={{ fontSize: 11 }} className="muted">{f.app} app-layer</span></div>
                  </div>
                </div>
              );
            })}
          </div>
          <Callout kind="good">Operating at the lowest level gives a lighter footprint than application-layer agents, lowering infrastructure overhead as the AI estate grows.</Callout>
        </Card>
      </div>

      <div className="grid g3">
        <div id="as-versions">
          <Card title="Version distribution" sub={`${fmtNum(s.covered)} sensors`}>
            <Stacked tall showLabels parts={s.versions.map((v, i) => ({ value: v.n, color: VCOL[i], label: v.v }))} />
            <div className="stack" style={{ gap: 6, marginTop: 12 }}>
              {s.versions.map((v, i) => (
                <div key={v.v} className="row" style={{ fontSize: 12 }}>
                  <i className="dot" style={{ background: VCOL[i] }} />
                  <span className="mono" style={{ flex: 1 }}>nxv-sensor {v.v}</span>
                  {v.current ? <Badge color="var(--good)">Current</Badge> : <Badge color="var(--sev-medium)">Upgrade queued</Badge>}
                  <b className="num" style={{ width: 60, textAlign: 'right' }}>{fmtNum(v.n)}</b>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <Card title="Fleet health" sub="Healthy share of covered sensors · 30 days">
          <Chart
            height={200}
            option={{
              tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => `${v}%` },
              grid: { left: 8, right: 8, top: 10, bottom: 6, containLabel: true },
              xAxis: { type: 'category', data: dayLabels(30), axisLabel: { interval: 6 } },
              yAxis: { type: 'value', min: 94, max: 100 },
              series: [{ type: 'line', data: s.healthTrend, symbol: 'none', lineStyle: { color: '#2dd4bf', width: 2 }, areaStyle: { color: 'rgba(45,212,191,.12)' } }],
            }}
          />
        </Card>
        <Card title={<><ShieldCheck size={15} style={{ color: '#f0466e' }} /> Tamper attempts resisted</>} count={s.tamperTotal} sub="Notable attempts · every attempt opens a HexaSOC case">
          <Timeline items={s.tamper.map((t) => ({ time: fmtAgo(t.ageH * 60), title: `${t.title} · ${t.host}`, body: t.detail, color: '#f0466e' }))} />
        </Card>
      </div>

      <Card title="Deployment rollout plan" sub="Waves agreed in phase 1 (onboard & baseline) · run by HexaShield" actions={<Badge color={AS_TONE}><Cpu size={11} /> {fmtNum(s.rollout.reduce((a, w) => a + w.done, 0))} of {fmtNum(s.rollout.reduce((a, w) => a + w.hosts, 0))} deployed</Badge>}>
        <div className="stack" style={{ gap: 12 }}>
          {s.rollout.map((w) => {
            const pct = w.hosts ? Math.round((w.done / w.hosts) * 100) : 0;
            return (
              <div key={w.wave} className="row" style={{ gap: 14 }}>
                <b style={{ width: 60, fontSize: 12.5 }}>{w.wave}</b>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row between" style={{ fontSize: 12 }}><span>{w.scope}</span><span className="muted">{fmtNum(w.done)} / {fmtNum(w.hosts)} · {pct}%</span></div>
                  <div style={{ marginTop: 4 }}><Bar value={pct} color={pct === 100 ? 'var(--good)' : AS_TONE} /></div>
                </div>
                <Badge color={pct === 100 ? 'var(--good)' : w.when.startsWith('In progress') ? AS_TONE : undefined}>{w.when}</Badge>
                {pct < 100 && <Btn sm onClick={() => setWave(w)}>Schedule</Btn>}
              </div>
            );
          })}
        </div>
      </Card>

      {wave && (
        <ActionModal
          title={`Schedule ${wave.wave}: ${wave.scope}`}
          target={`${fmtNum(wave.hosts - wave.done)} hosts · change window agreed with ${c.people.admin.name}`}
          operation="sensor.deploy(wave, ring=canary→broad)"
          risk="medium"
          approvers={[c.people.admin.name]}
          change={<>Deploys the sensor in rings: 5% canary for 48 hours, then the rest. No reboot needed on Linux (eBPF); Windows hosts take the driver at the next maintenance reboot. Rollback is one click per ring.</>}
          submitLabel="Schedule deployment"
          onClose={() => setWave(null)}
          onSubmit={() => { setWave(null); toast(`${wave.wave} scheduled: canary ring starts in the next change window`); }}
        >
          <KV rows={[['Scope', wave.scope], ['Remaining', fmtNum(wave.hosts - wave.done)], ['Mechanism', 'Intune / SCCM, Ansible, image pipeline, DaemonSet']]} />
        </ActionModal>
      )}
      {drill === 'tamper' && <RecordsDrawer title="Tamper attempts resisted" sub="Notable attempts; full log in HexaSOC" source="Nexovern sensor self-protection" onClose={() => setDrill(null)} rows={s.tamper.map((t) => ({ key: t.host + t.ageH, main: t.title, sub: `${t.host} · ${t.detail}`, right: <span className="muted" style={{ fontSize: 11 }}>{fmtAgo(t.ageH * 60)}</span> }))} />}
      {drill === 'unhealthy' && <RecordsDrawer title="Sensor health by environment" source="Sensor heartbeats" onClose={() => setDrill(null)} rows={SENSOR_ENVS.map((e) => { const x = s.envs.find((k) => k.env === e)!; return { key: e, main: e, sub: `${fmtNum(x.healthy)} healthy · ${fmtNum(x.degraded)} degraded · ${fmtNum(x.offline)} offline`, right: <Badge color={x.offline ? 'var(--sev-medium)' : 'var(--good)'}>{x.pct}% covered</Badge>, onClick: () => { setDrill(null); setEnv(e); } }; })} />}
    </div>
  );
}
