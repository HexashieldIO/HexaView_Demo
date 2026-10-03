import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, History, Filter } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { loops, loopSummary, LOOP_STATUS_COLOR, LINK_ORDER, type Loop, type LoopStatus, type LinkKey } from '../../data/core';
import { tenantName, scopedConnectors, isStale } from '../../data/customers';
import { frameworkStatus, loopTransitions, siemFor, type LoopTransition } from '../../data/modules/comply';
import { Card, KpiStrip, Badge, Bar, Legend, Sources, Freshness, Btn, KV, Chip, Callout, SectionLabel, StatusBadge, Tabs } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { fmtAgo, fmtNum } from '../../lib/format';
import { LoopChain, CloseLoopWizard, LINK_STATE_COLOR } from './loopParts';
import './board.css';

const tone = 'var(--m-view)';
const STATUS_ORDER: LoopStatus[] = ['closed', 'stale', 'partial', 'broken', 'not_applicable'];
const STATUS_HEX: Record<LoopStatus, string> = { closed: '#2dd4bf', stale: '#e8cf4f', partial: '#f5a83d', broken: '#f87171', not_applicable: '#8593b4' };
const STATUS_LABEL: Record<LoopStatus, string> = { closed: 'Closed', stale: 'Stale', partial: 'Partial', broken: 'Broken', not_applicable: 'N/A' };

interface LocalTransition extends LoopTransition { local?: boolean }

export default function ClosedLoop() {
  const { customer: c, tenantId, timeRange } = useApp();
  const nav = useNavigate();
  const days = rangeDays(timeRange);
  const base = useMemo(() => loops(c, tenantId), [c, tenantId]);
  const [overrides, setOverrides] = useState<Record<string, Loop>>({});
  const [evReq, setEvReq] = useState<Record<string, string>>({});
  const [localTx, setLocalTx] = useState<LocalTransition[]>([]);
  useEffect(() => { setOverrides({}); setEvReq({}); setLocalTx([]); }, [c.id]);

  const ls = useMemo(() => base.map((l) => overrides[l.id] ?? l), [base, overrides]);
  const sum = loopSummary(ls);
  const fws = useMemo(() => frameworkStatus(c, tenantId), [c, tenantId]);
  const baseTx = useMemo(() => loopTransitions(c, tenantId, days), [c, tenantId, days]);
  const transitions: LocalTransition[] = [...localTx.filter((t) => tenantId === 'all' || t.tenant === tenantId), ...baseTx];
  const siem = siemFor(c);
  const conns = scopedConnectors(c, tenantId).filter((k) => ['SIEM', 'EDR / XDR', 'GRC', 'Validation'].includes(k.category));
  const tenantsInScope = tenantId === 'all' ? c.tenants : c.tenants.filter((t) => t.id === tenantId);
  const loopSrc = `HexaComply · ${siem.short} · HexaStrike · HexaMatrix`;

  // Filters
  const [fStatus, setFStatus] = useState<LoopStatus | 'all'>('all');
  const [fFw, setFFw] = useState('all');
  const [fTenant, setFTenant] = useState('all');
  const [fOwner, setFOwner] = useState('all');
  const [fMissing, setFMissing] = useState<LinkKey | 'all'>('all');
  const [fTech, setFTech] = useState<string | null>(null);
  const [byDim, setByDim] = useState<'tenant' | 'framework'>('tenant');
  const [open, setOpen] = useState<Loop | null>(null);
  useEffect(() => { setFTenant('all'); setFFw('all'); setFOwner('all'); setOpen(null); }, [c.id, tenantId]);
  // Deep links from the Command Centre, HexaComply and the Board view: ?status=&framework=&tenant=&control=
  const [sp] = useSearchParams();
  const [fControl, setFControl] = useState<string | null>(null);
  useEffect(() => {
    const st = sp.get('status');
    const fw = sp.get('framework');
    const tn = sp.get('tenant');
    const ct = sp.get('control');
    if (st && (STATUS_ORDER as string[]).includes(st)) setFStatus(st as LoopStatus);
    if (fw) {
      const short = c.frameworks.find((f) => f.id === fw || f.short === fw)?.short;
      setFFw(short ?? 'all');
    }
    if (tn && c.tenants.some((t) => t.id === tn)) setFTenant(tn);
    setFControl(ct);
  }, [sp, c]);

  const owners = [...new Set(ls.map((l) => l.owner))];
  const frameworksUsed = [...new Set(ls.map((l) => l.framework))];
  const rows = ls.filter((l) =>
    (fStatus === 'all' || l.status === fStatus) && (fFw === 'all' || l.framework === fFw) && (fTenant === 'all' || l.tenantId === fTenant) &&
    (fOwner === 'all' || l.owner === fOwner) && (fMissing === 'all' || l.missing.includes(fMissing) || l.links[fMissing].state !== 'ok') && (!fTech || l.technique === fTech) && (!fControl || l.controlId === fControl));

  const closedInRange = transitions.filter((t) => t.to === 'closed').length;
  const brokeInRange = transitions.filter((t) => t.to === 'broken' || t.to === 'stale').length;

  // Status by tenant / framework
  const dims = byDim === 'tenant' ? tenantsInScope.map((t) => ({ key: t.id, label: t.short })) : frameworksUsed.map((f) => ({ key: f, label: f }));
  const dimLoops = (k: string) => ls.filter((l) => (byDim === 'tenant' ? l.tenantId === k : l.framework === k));

  // ATT&CK heat
  const techs = [...new Set(ls.map((l) => l.technique))]
    .map((t) => ({ t, name: ls.find((l) => l.technique === t)!.techniqueName, n: ls.filter((l) => l.technique === t).length }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 16);
  const heatMax = Math.max(1, ...techs.flatMap((x) => STATUS_ORDER.map((s) => ls.filter((l) => l.technique === x.t && l.status === s).length)));

  const openRef = useRef<Loop | null>(null);
  openRef.current = open;
  const onClosed = useCallback((l: Loop) => {
    const from = base.find((b) => b.id === l.id)?.status ?? 'partial';
    setOverrides((o) => ({ ...o, [l.id]: l }));
    setLocalTx((tx) => [{ minAgo: 0, loopId: l.id, control: l.controlId, technique: l.technique, tenant: l.tenantId, from, to: l.status, reason: l.status === 'closed' ? 'HexaStrike validation passed, detection fired' : 'Validation passed; evidence outstanding', actor: 'HexaStrike', auditId: `AUD-${Math.random().toString(16).slice(2, 10)}`, local: true }, ...tx]);
  }, [base]);
  const onTransition = useCallback((text: string) => {
    const cur = openRef.current;
    if (!cur) return;
    const auditId = `AUD-${Math.random().toString(16).slice(2, 10)}`;
    setLocalTx((tx) => [{ minAgo: 0, loopId: cur.id, control: cur.controlId, technique: cur.technique, tenant: cur.tenantId, from: cur.status, to: cur.status, reason: text, actor: 'You (via HexaView)', auditId, local: true }, ...tx]);
  }, []);

  const effectiveOpen = open ? overrides[open.id] ?? open : null;
  const captions: Partial<Record<LinkKey, string>> = {
    requirement: `${c.frameworks.slice(0, 3).map((f) => f.short).join(', ')}…`,
    control: 'HexaComply controls',
    evidence: 'GRC + connector snapshots',
    technique: 'HexaMatrix mappings',
    detection: `${siem.short} · ${c.connectors.find((k) => k.category === 'EDR / XDR')?.product ?? 'EDR'}`,
    validation: 'HexaStrike · BAS',
  };

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · {tenantName(c, tenantId)}. A loop is one control proven against one ATT&CK technique: requirement, control and evidence from HexaComply, technique mapping from HexaMatrix, detection live in {siem.short} and{' '}
        {c.connectors.find((k) => k.category === 'EDR / XDR')?.product}, validated by HexaStrike. A loop is closed only when all six links are present and fresh.
      </p>

      <Card title="The six-link loop" sub="Every link is read from a live tool; when any link is missing, stale or failing, the loop is not closed" actions={<Sources items={conns.slice(0, 6).map((k) => ({ name: k.product, status: k.status }))} />}>
        <LoopChain captions={captions} />
      </Card>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Assured', value: `${sum.assuredPct}%`, bar: sum.assuredPct, unit: 'stale counts half', onClick: () => setFStatus('closed'), source: loopSrc },
          { label: 'Loops', value: fmtNum(sum.total), unit: `${sum.applicable} applicable`, onClick: () => { setFStatus('all'); setFFw('all'); setFTenant('all'); setFOwner('all'); setFMissing('all'); setFTech(null); setFControl(null); }, source: loopSrc },
          { label: 'Closed', value: sum.closed, toneColor: 'var(--good)', onClick: () => setFStatus('closed'), delta: { text: `+${closedInRange} · ${rangeLabel(timeRange).toLowerCase()}`, good: true }, source: loopSrc },
          { label: 'Partial', value: sum.partial, toneColor: 'var(--sev-medium)', onClick: () => setFStatus('partial'), source: loopSrc },
          { label: 'Broken', value: sum.broken, toneColor: 'var(--bad)', onClick: () => setFStatus('broken'), source: loopSrc },
          { label: 'Stale', value: sum.stale, toneColor: 'var(--sev-low)', onClick: () => setFStatus('stale'), delta: { text: `${brokeInRange} regressions · ${timeRange}`, good: false }, source: loopSrc },
          { label: 'Not applicable', value: sum.na, toneColor: 'var(--sev-info)', onClick: () => setFStatus('not_applicable'), source: 'HexaComply applicability decisions' },
        ]}
      />

      <div className="grid g-1-2">
        <Card title="Documented vs assured" sub="Documented: control implemented with fresh evidence · Assured: its loops proven closed">
          <div className="stack" style={{ gap: 9 }}>
            {fws.map((f) => (
              <button key={f.fw.id} className="row" style={{ fontSize: 12, background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => setFFw(frameworksUsed.includes(f.fw.short) ? f.fw.short : 'all')}>
                <span style={{ width: 92, fontWeight: 600 }}>{f.fw.short}</span>
                <div style={{ flex: 1, display: 'grid', gap: 3 }}>
                  <Bar value={f.documented} color="var(--m-comply)" size="thin" />
                  <Bar value={f.assured} color={tone} size="thin" />
                </div>
                <span className="muted" style={{ width: 92, textAlign: 'right' }}>{f.documented}% / <b style={{ color: 'var(--text-primary)' }}>{f.assured}%</b></span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 10 }}><Legend items={[{ label: 'Documented', color: 'var(--m-comply)' }, { label: 'Assured (loop-proven)', color: tone }]} /></div>
        </Card>

        <Card title="Loop status" sub={`By ${byDim} · click a bar to filter`} actions={<Tabs color={tone} value={byDim} onChange={setByDim} tabs={[{ id: 'tenant', label: 'Tenant' }, { id: 'framework', label: 'Framework' }]} />}>
          <Chart
            height={Math.max(200, dims.length * 34 + 40)}
            onClick={(p) => {
              const name = (p as { name: string }).name;
              const d = dims.find((x) => x.label === name);
              if (!d) return;
              if (byDim === 'tenant') setFTenant(d.key); else setFFw(d.key);
            }}
            option={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              legend: { bottom: 0 },
              grid: { left: 8, right: 16, top: 6, bottom: 28, containLabel: true },
              xAxis: { type: 'value' },
              yAxis: { type: 'category', data: dims.map((d) => d.label).reverse() },
              series: STATUS_ORDER.map((s) => ({
                name: STATUS_LABEL[s], type: 'bar', stack: 'st', barWidth: 16, itemStyle: { color: STATUS_HEX[s], borderRadius: 0 },
                data: dims.map((d) => dimLoops(d.key).filter((l) => l.status === s).length).reverse(),
              })),
            }}
          />
        </Card>
      </div>

      <div className="grid g-3-2">
        <Card title="ATT&CK coverage by loop status" sub="Priority techniques × loop status · click a technique to filter" actions={fTech && <Chip on color={tone} onClick={() => setFTech(null)}>{fTech} ×</Chip>}>
          <div className="loop-heat">
            <div className="loop-heat-row">
              <span />
              {STATUS_ORDER.map((s) => <span key={s} className="loop-heat-head">{STATUS_LABEL[s]}</span>)}
            </div>
            {techs.map((x) => (
              <div key={x.t} className="loop-heat-row">
                <span title={x.name}><button className="link" style={{ fontSize: 11 }} onClick={() => setFTech(fTech === x.t ? null : x.t)}>{x.t}</button> <span className="muted">{x.name}</span></span>
                {STATUS_ORDER.map((s) => {
                  const n = ls.filter((l) => l.technique === x.t && l.status === s).length;
                  return (
                    <button key={s} type="button" className="loop-heat-cell" onClick={() => { setFTech(x.t); setFStatus(s); }}
                      style={{ background: n ? `color-mix(in srgb, ${LOOP_STATUS_COLOR[s]} ${20 + (n / heatMax) * 65}%, transparent)` : 'var(--surface-sunken)' }}>
                      {n || ''}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>

        <Card title={<><History size={14} /> Recent loop transitions</>} sub={`Audited, hash-chained · ${rangeLabel(timeRange).toLowerCase()}`} flush actions={<button className="link" onClick={() => nav('/ops/audit')}>Audit ledger →</button>}>
          <div className="list" style={{ padding: '0 18px 8px', maxHeight: 470, overflowY: 'auto' }}>
            {transitions.slice(0, 30).map((t, i) => (
              <button key={`${t.auditId}-${i}`} className="list-row" onClick={() => { const l = ls.find((x) => x.id === t.loopId); if (l) setOpen(base.find((b) => b.id === l.id) ?? l); }} style={t.local ? { background: 'color-mix(in srgb, var(--m-view) 8%, transparent)' } : undefined}>
                <span className="list-main">
                  <b style={{ whiteSpace: 'normal' }}>
                    {t.control} × {t.technique}{' '}
                    {t.from !== t.to ? <><StatusBadge value={t.from} map={LOOP_STATUS_COLOR} /> → <StatusBadge value={t.to} map={LOOP_STATUS_COLOR} /></> : <Badge color={tone}>step</Badge>}
                  </b>
                  <span>{t.reason} · {t.actor} · {c.tenants.find((x) => x.id === t.tenant)?.short}</span>
                </span>
                <span className="stack" style={{ alignItems: 'flex-end', gap: 2 }}>
                  <span className="muted" style={{ fontSize: 10.5 }}>{t.local ? 'just now' : fmtAgo(t.minAgo)}</span>
                  <span className="mono muted" style={{ fontSize: 9.5 }}>{t.auditId}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card
        title="Loops"
        count={rows.length}
        sub="Click a loop to see its six links; partial loops can be closed from the drawer"
        flush
        toneColor={tone}
        actions={
          <div className="row wrap" style={{ gap: 6 }}>
            <Filter size={13} className="muted" />
            <select className="select" value={fStatus} onChange={(e) => setFStatus(e.target.value as LoopStatus | 'all')} aria-label="Status">
              <option value="all">All statuses</option>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <select className="select" value={fFw} onChange={(e) => setFFw(e.target.value)} aria-label="Framework">
              <option value="all">All frameworks</option>
              {frameworksUsed.map((f) => <option key={f}>{f}</option>)}
            </select>
            {tenantId === 'all' && (
              <select className="select" value={fTenant} onChange={(e) => setFTenant(e.target.value)} aria-label="Tenant">
                <option value="all">All tenants</option>
                {c.tenants.map((t) => <option key={t.id} value={t.id}>{t.short}</option>)}
              </select>
            )}
            <select className="select" value={fOwner} onChange={(e) => setFOwner(e.target.value)} aria-label="Owner">
              <option value="all">All owners</option>
              {owners.map((o) => <option key={o}>{o}</option>)}
            </select>
            <select className="select" value={fMissing} onChange={(e) => setFMissing(e.target.value as LinkKey | 'all')} aria-label="Missing link">
              <option value="all">Any links</option>
              {LINK_ORDER.map((l) => <option key={l.key} value={l.key}>Gap: {l.label}</option>)}
            </select>
            {fControl && <Chip on color={tone} onClick={() => setFControl(null)}>{fControl} ×</Chip>}
            {(fStatus !== 'all' || fFw !== 'all' || fTenant !== 'all' || fOwner !== 'all' || fMissing !== 'all' || fTech || fControl) && (
              <Btn sm ghost onClick={() => { setFStatus('all'); setFFw('all'); setFTenant('all'); setFOwner('all'); setFMissing('all'); setFTech(null); setFControl(null); }}>Clear</Btn>
            )}
          </div>
        }
      >
        <DataTable<Loop>
          rows={rows}
          rowKey={(l) => l.id}
          onRowClick={(l) => setOpen(base.find((b) => b.id === l.id) ?? l)}
          search={(l) => `${l.id} ${l.control} ${l.controlId} ${l.technique} ${l.techniqueName} ${l.requirement} ${l.owner}`}
          searchPlaceholder="Search control, technique, requirement…"
          initialSort={{ key: 'status', dir: 'desc' }}
          pageSize={15}
          columns={[
            { key: 'status', header: 'Status', sort: (l) => ['closed', 'not_applicable', 'stale', 'partial', 'broken'].indexOf(l.status), render: (l) => <StatusBadge value={l.status} map={LOOP_STATUS_COLOR} /> },
            { key: 'control', header: 'Control', sort: (l) => l.controlId, render: (l) => <><div className="t-main">{l.controlId}</div><div className="t-sub" style={{ maxWidth: 280, whiteSpace: 'normal' }}>{l.control}</div></> },
            { key: 'tech', header: 'Technique', sort: (l) => l.technique, render: (l) => <><div className="t-main mono">{l.technique}</div><div className="t-sub">{l.techniqueName}</div></> },
            { key: 'fw', header: 'Framework', sort: (l) => l.framework, render: (l) => <><Badge>{l.framework}</Badge><div className="t-sub">{l.requirement.split(' · ')[0]}</div></> },
            { key: 'tenant', header: 'Tenant', sort: (l) => l.tenantId, render: (l) => c.tenants.find((t) => t.id === l.tenantId)?.short },
            { key: 'links', header: 'Links', render: (l) => (
              <span className="row" style={{ gap: 3 }}>
                {LINK_ORDER.map((k) => <i key={k.key} title={`${k.label}: ${l.links[k.key].state}`} className="dot" style={{ background: LINK_STATE_COLOR[k.key === 'evidence' && evReq[l.id] && l.links.evidence.state !== 'ok' ? 'requested' : l.links[k.key].state] }} />)}
              </span>
            ) },
            { key: 'missing', header: 'Gaps', sort: (l) => l.missing.length, render: (l) => (l.missing.length ? <span className="t-sub" style={{ color: 'var(--sev-medium)' }}>{l.missing.join(', ')}</span> : l.status === 'stale' || l.status === 'broken' ? <span className="t-sub" style={{ color: LOOP_STATUS_COLOR[l.status] }}>{LINK_ORDER.filter((k) => l.links[k.key].state !== 'ok').map((k) => `${k.label.toLowerCase()} ${l.links[k.key].state}`).join(', ')}</span> : <span className="t-sub">—</span>) },
            { key: 'owner', header: 'Owner', sort: (l) => l.owner, render: (l) => <span className="t-sub">{l.owner}</span> },
            { key: 'eval', header: 'Evaluated', align: 'right', sort: (l) => -l.evaluatedMinAgo, render: (l) => <span className="t-sub">{fmtAgo(l.evaluatedMinAgo)}</span> },
          ]}
        />
      </Card>

      <div className="row wrap" style={{ gap: 10 }}>
        {conns.map((k) => <Freshness key={k.id} minutes={k.lastSyncMin} stale={isStale(k) || k.status !== 'healthy'} label={k.product} />)}
      </div>

      {open && effectiveOpen && (
        <Drawer
          wide
          title={`${effectiveOpen.controlId} × ${effectiveOpen.technique}`}
          sub={`${effectiveOpen.control} · ${effectiveOpen.techniqueName} · ${c.tenants.find((t) => t.id === effectiveOpen.tenantId)?.name}`}
          onClose={() => setOpen(null)}
          footer={
            <>
              <Btn onClick={() => nav('/soc/attack')}>ATT&CK coverage <ArrowRight /></Btn>
              <Btn onClick={() => nav(`/comply/caas?view=controls&framework=${c.frameworks.find((f) => f.short === effectiveOpen.framework)?.id ?? ''}`)}>Control in HexaComply <ArrowRight /></Btn>
            </>
          }
        >
          <div className="row wrap" style={{ gap: 8 }}>
            <StatusBadge value={effectiveOpen.status} map={LOOP_STATUS_COLOR} />
            <Badge>{effectiveOpen.framework}</Badge>
            <Badge>Owner: {effectiveOpen.owner}</Badge>
            <span className="muted" style={{ fontSize: 11 }}>Evaluated {fmtAgo(effectiveOpen.evaluatedMinAgo)} · {effectiveOpen.id}</span>
          </div>
          <LoopChain loop={effectiveOpen} evidenceRequested={!!evReq[effectiveOpen.id]} />
          <div>
            <SectionLabel>Links</SectionLabel>
            <KV rows={LINK_ORDER.map((k) => {
              const ln = effectiveOpen.links[k.key];
              const st = k.key === 'evidence' && evReq[effectiveOpen.id] && ln.state !== 'ok' ? 'requested' : ln.state;
              return [k.label, <span key={k.key}><Badge color={LINK_STATE_COLOR[st]} dot>{st}</Badge> <span className="mono" style={{ fontSize: 11 }}>{ln.ref}</span> <span className="muted"> · {ln.source}{ln.daysAgo !== undefined ? ` · ${ln.daysAgo} d ago` : ''}{st === 'requested' ? ` · due in ${evReq[effectiveOpen.id]} d` : ''}</span></span>];
            })} />
          </div>
          <KV rows={[['Requirement', effectiveOpen.requirement], ['Framework', effectiveOpen.framework]]} />

          {open.status !== 'closed' && open.status !== 'not_applicable' ? (
            <CloseLoopWizard
              key={open.id}
              c={c}
              loop={open}
              onClosed={onClosed}
              evidenceRequested={!!evReq[open.id]}
              onEvidenceRequested={(due) => setEvReq((m) => ({ ...m, [open.id]: due }))}
              onTransition={onTransition}
            />
          ) : open.status === 'closed' ? (
            <Callout kind="good">All six links are present and fresh. The loop engine re-checks on every connector sync and on each HexaStrike run; it will move to stale if evidence or validation passes 90 days.</Callout>
          ) : (
            <Callout>Marked not applicable for this tenant (technique cannot occur on its estate). Justification recorded in HexaComply.</Callout>
          )}
          {effectiveOpen.status === 'closed' && open.status !== 'closed' && (
            <Callout kind="good"><b>Loop closed in this session.</b> {effectiveOpen.controlId} × {effectiveOpen.technique} now counts towards {effectiveOpen.framework} assured coverage; the transition is in the audit ledger.</Callout>
          )}
        </Drawer>
      )}
    </>
  );
}
