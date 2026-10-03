import { useMemo, useState } from 'react';
import { Card, KpiStrip, Tabs, BarRow, Ring, Btn, Stacked, Legend, Badge } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { dayLabels, fmtCompact, fmtMoney, fmtNum, hourLabels } from '../../lib/format';
import { aisecUsage, VENDOR_HEX, STATUS_HEX, type AsItem } from '../../data/modules/aisec';
import { AS_TONE, AS_HEX, BASE, ActionModal, ItemDrawer, RecordsDrawer, StatusPill, itemRows, toneStyle, useAs } from './parts';

type Metric = 'sessions' | 'prompts' | 'tokens';

export default function AisecUsage() {
  const { c, tenantId, days, inv, scope, rl, toast, nav } = useAs();
  const u = useMemo(() => aisecUsage(c, tenantId, days, inv), [c, tenantId, days, inv]);
  const [metric, setMetric] = useState<Metric>('sessions');
  const [open, setOpen] = useState<AsItem | null>(null);
  const [list, setList] = useState<{ title: string; items: AsItem[] } | null>(null);
  const [reclaim, setReclaim] = useState<(typeof u.licences)[number] | null>(null);
  const labels = days === 1 ? hourLabels(24) : dayLabels(u.n);
  const activeUsers = u.deptUsers.reduce((s, d) => s + d.users, 0);
  const headcount = u.deptUsers.reduce((s, d) => s + d.headcount, 0);
  const prompts = u.prompts.reduce((s, v) => s + v, 0);
  const lic0 = u.licences[0];
  const tokenCost = u.costByModel.reduce((s, x) => s + x.cost, 0);
  const monthly = u.licenceMonthly + (tokenCost * 30) / days;
  const shadowPct = Math.round((u.shadowSessions / Math.max(1, u.sessions)) * 100);
  const topApps = u.apps.slice().sort((a, b) => b.sessions - a.sessions).slice(0, 8);
  const maxDept = Math.max(1, ...u.deptUsers.map((d) => d.headcount));
  const series = metric === 'sessions' ? u.sess : metric === 'prompts' ? u.prompts : u.tokens;

  return (
    <div className="stack" style={{ gap: 16, ...toneStyle }}>
      <p className="page-intro">
        <b>{c.name}</b> · {scope}. How {c.short} actually uses AI: who, how much, which apps and models, what it costs and whether paid licences are used. Counted on the execution path, so shadow use is included. {rl}.
      </p>
      <KpiStrip
        toneColor={AS_TONE}
        items={[
          { label: 'Active AI users', value: fmtNum(activeUsers), unit: `${Math.round((activeUsers / Math.max(1, headcount)) * 100)}% of staff`, onClick: () => document.getElementById('as-depts')?.scrollIntoView({ behavior: 'smooth' }), source: 'Nexovern sensor · Entra / Okta identity join' },
          { label: 'Sessions', value: fmtCompact(u.sessions), to: `${BASE}/runtime`, source: 'Nexovern sensor via HexaAI' },
          { label: 'Prompts', value: fmtCompact(prompts), onClick: () => setMetric('prompts'), source: 'Nexovern sensor (prompt buffer count)' },
          { label: 'Tokens', value: fmtCompact(u.totalTokens), onClick: () => setMetric('tokens'), source: 'Model gateway usage APIs' },
          { label: `${lic0.name.replace('Microsoft 365 ', 'M365 ')} seats`, value: `${Math.round((lic0.active / lic0.paid) * 100)}%`, unit: `${fmtNum(lic0.active)}/${fmtNum(lic0.paid)} used`, bar: (lic0.active / lic0.paid) * 100, onClick: () => setReclaim(lic0), source: `${lic0.vendor} licence reports` },
          { label: 'AI cost / month', value: fmtMoney(monthly, c.currency), to: `${BASE}/roi`, source: 'Licences + token metering' },
          { label: 'Shadow share', value: `${shadowPct}%`, unit: 'of sessions', toneColor: 'var(--bad)', onClick: () => setList({ title: 'Shadow AI by sessions', items: u.apps.filter((x) => x.status === 'shadow') }), source: 'Nexovern sensor · egress fingerprint' },
        ]}
      />

      <div className="grid g-3-2">
        <Card title={`AI ${metric} over time`} sub={rl} actions={<Tabs value={metric} onChange={setMetric} color={AS_TONE} tabs={[{ id: 'sessions', label: 'Sessions' }, { id: 'prompts', label: 'Prompts' }, { id: 'tokens', label: 'Tokens' }]} />}>
          <Chart
            height={260}
            option={{
              tooltip: { trigger: 'axis' },
              grid: { left: 8, right: 8, top: 14, bottom: 6, containLabel: true },
              xAxis: { type: 'category', data: labels, axisLabel: { interval: Math.max(0, Math.floor(labels.length / 7) - 1) } },
              yAxis: { type: 'value', axisLabel: { formatter: (v: number) => fmtCompact(v) } },
              series: [{ type: 'line', data: series, symbol: 'none', lineStyle: { color: AS_HEX, width: 2 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(139,92,246,.32)' }, { offset: 1, color: 'rgba(139,92,246,0)' }] } } }],
            }}
          />
        </Card>
        <Card title="Shadow vs sanctioned" sub="Share of sessions on the execution path">
          <div className="row" style={{ gap: 18, alignItems: 'center' }}>
            <Ring value={100 - shadowPct} size={110} stroke={12} color="#2dd4bf" track="#f0466e55" sub="sanctioned" />
            <div className="stack" style={{ gap: 6, flex: 1 }}>
              {(['sanctioned', 'pilot', 'in review', 'shadow'] as const).map((st) => {
                const n = u.apps.filter((x) => x.status === st).reduce((s, x) => s + x.sessions, 0);
                return (
                  <button key={st} className="row cc-row" style={{ background: 'none', border: 0, padding: 0, color: 'inherit', fontSize: 12 }} onClick={() => setList({ title: `${st} AI by sessions`, items: u.apps.filter((x) => x.status === st) })}>
                    <i className="dot" style={{ background: STATUS_HEX[st] }} />
                    <span style={{ flex: 1, textAlign: 'left', textTransform: 'capitalize' }}>{st}</span>
                    <b className="num">{fmtCompact(n)}</b>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="section-label">By model vendor</div>
            <Stacked tall showLabels parts={u.byVendor.map((v) => ({ value: v.sessions, color: VENDOR_HEX[v.v], label: v.v }))} />
            <div style={{ marginTop: 8 }}><Legend items={u.byVendor.map((v) => ({ label: v.v === 'Self-hosted (open source)' ? 'Self-hosted' : v.v, color: VENDOR_HEX[v.v] }))} /></div>
          </div>
        </Card>
      </div>

      <div className="grid g2">
        <div id="as-depts">
          <Card title="Active users by department" sub="Bar = active AI users of headcount · red share = shadow users">
            <div className="stack" style={{ gap: 9 }}>
              {u.deptUsers.slice().sort((a, b) => b.users - a.users).map((d) => (
                <button key={d.dept} className="row cc-row" style={{ background: 'none', border: 0, padding: 0, color: 'inherit', gap: 10 }} onClick={() => setList({ title: `AI used by ${d.dept}`, items: u.apps.filter((x) => x.department === d.dept) })}>
                  <span style={{ width: 170, fontSize: 12, fontWeight: 600, textAlign: 'left' }}>{d.dept}</span>
                  <div style={{ flex: 1, height: 12, background: 'var(--track)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                    <i style={{ width: `${((d.users - d.shadow) / maxDept) * 100}%`, background: AS_HEX }} />
                    <i style={{ width: `${(d.shadow / maxDept) * 100}%`, background: '#f0466e' }} />
                  </div>
                  <span className="num" style={{ width: 96, textAlign: 'right', fontSize: 11.5 }}>{fmtNum(d.users)} / {fmtNum(d.headcount)}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
        <Card title="Top AI apps" sub="By sessions · click for the profile">
          <div className="stack" style={{ gap: 6 }}>
            {topApps.map((a) => (
              <button key={a.id} style={{ background: 'none', border: 0, padding: 0, color: 'inherit', textAlign: 'left' }} onClick={() => setOpen(a)}>
                <BarRow label={a.name} sub={`${a.modelVendor} · ${fmtNum(a.users)} users`} value={a.sessions} max={topApps[0]?.sessions ?? 1} color={a.status === 'shadow' ? '#f0466e' : VENDOR_HEX[a.modelVendor]} display={fmtCompact(a.sessions)} />
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Licence utilisation" sub="Paid seats vs active in the last 30 days · reclaim idle seats with one approval">
        <div className="grid g3">
          {u.licences.map((l) => {
            const pct = Math.round((l.active / l.paid) * 100);
            return (
              <div key={l.name} className="row" style={{ gap: 14, alignItems: 'center' }}>
                <Ring value={pct} size={86} stroke={9} color={pct >= 80 ? '#2dd4bf' : pct >= 65 ? '#f0a338' : '#f0466e'} label={`${pct}%`} sub="used" />
                <div className="stack" style={{ gap: 3, flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 13 }}>{l.name}</b>
                  <span className="muted" style={{ fontSize: 11.5 }}>{fmtNum(l.active)} of {fmtNum(l.paid)} seats · {fmtMoney(l.price, c.currency, false)}/seat/month</span>
                  <span style={{ fontSize: 11.5, color: l.idle ? 'var(--sev-medium)' : 'var(--good)' }}>{fmtNum(l.idle)} idle · {fmtMoney(l.wasteMonthly, c.currency)}/month</span>
                  {l.idle > 0 && <div><Btn sm onClick={() => setReclaim(l)}>Reclaim {fmtNum(l.idle)} seats</Btn></div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid g2">
        <Card title="Cost per department" sub={`${rl} · licences apportioned by active users + metered tokens`}>
          <Chart
            height={260}
            option={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              grid: { left: 8, right: 16, top: 6, bottom: 6, containLabel: true },
              xAxis: { type: 'value', axisLabel: { formatter: (v: number) => fmtMoney(v, c.currency) } },
              yAxis: { type: 'category', data: u.costByDept.slice().sort((a, b) => a.cost - b.cost).map((d) => d.dept), axisLabel: { fontSize: 10.5 } },
              series: [{ type: 'bar', data: u.costByDept.slice().sort((a, b) => a.cost - b.cost).map((d) => d.cost), itemStyle: { color: AS_HEX, borderRadius: [0, 3, 3, 0] }, barMaxWidth: 16 }],
            }}
          />
        </Card>
        <Card title="Token cost per model vendor" sub={`${rl} · metered API and gateway usage`}>
          <Chart
            height={260}
            option={{
              tooltip: { trigger: 'item', formatter: (p: unknown) => { const q = p as { name: string; value: number; percent: number }; return `${q.name}: ${fmtMoney(q.value, c.currency)} (${q.percent}%)`; } },
              legend: { orient: 'vertical', right: 0, top: 'middle' },
              series: [{ type: 'pie', radius: ['48%', '74%'], center: ['34%', '50%'], label: { show: false }, data: u.costByModel.filter((x) => x.cost > 0).map((x) => ({ name: x.v, value: x.cost, itemStyle: { color: VENDOR_HEX[x.v] } })) }],
            }}
          />
        </Card>
      </div>

      <Card title="Use-case catalogue" count={u.useCases.length} sub={`What people use AI for at ${c.short} · hours saved feed the Board ROI`}>
        <div className="as-matrix">
          {u.useCases.map((uc) => {
            const it = inv.find((x) => x.name.startsWith(uc.system) || uc.system.startsWith(x.name));
            return (
              <button key={uc.name} className="as-tile" style={{ ['--kc' as string]: AS_HEX }} onClick={() => (it ? setOpen(it) : nav(`${BASE}/roi`))}>
                <div className="as-tile-head"><b>{uc.name}</b>{it && <StatusPill status={it.status} />}</div>
                <div className="as-tile-meta">{uc.dept} · {uc.system}</div>
                <div className="row" style={{ gap: 14 }}>
                  <div><b style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>{fmtNum(uc.users)}</b><div className="muted" style={{ fontSize: 10.5 }}>users</div></div>
                  <div><b style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>{uc.hours}h</b><div className="muted" style={{ fontSize: 10.5 }}>saved / user / week</div></div>
                  <div><b style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>{fmtCompact(uc.sessions)}</b><div className="muted" style={{ fontSize: 10.5 }}>sessions</div></div>
                </div>
                <Badge color={AS_TONE}>{fmtNum(Math.round(uc.users * uc.hours * 46))} hours / year</Badge>
              </button>
            );
          })}
        </div>
      </Card>

      {open && <ItemDrawer item={open} onClose={() => setOpen(null)} />}
      {list && <RecordsDrawer title={list.title} source="Nexovern sensor via HexaAI" onClose={() => setList(null)} rows={itemRows(list.items.slice().sort((a, b) => b.sessions - a.sessions), (x) => { setList(null); setOpen(x); }, (x) => <span className="num" style={{ fontSize: 11.5 }}>{fmtCompact(x.sessions)}</span>)} />}
      {reclaim && (
        <ActionModal
          title={`Reclaim ${fmtNum(reclaim.idle)} idle ${reclaim.name} seats`}
          target={`${reclaim.vendor} licence admin`}
          operation="licence.unassign(idle > 30 d) + notify(users, managers)"
          risk="low"
          approvers={[c.people.admin.name]}
          change={<>Seats unused for 30 days are returned to the pool, saving <b>{fmtMoney(reclaim.wasteMonthly, c.currency)}/month</b>. Users get a notice and can request the seat back in one click.</>}
          submitLabel="Reclaim seats"
          onClose={() => setReclaim(null)}
          onSubmit={() => { setReclaim(null); toast(`Reclaim request for ${fmtNum(reclaim.idle)} ${reclaim.name} seats sent to ${c.people.admin.name}`); }}
        />
      )}
    </div>
  );
}
