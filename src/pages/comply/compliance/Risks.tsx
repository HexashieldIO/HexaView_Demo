import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../state/AppContext';
import { scopedConnectors } from '../../../data/customers';
import { MODULE_BY_ID } from '../../../modules/registry';
import { RISK_LEVEL_COLOR, L_LABELS, type RiskItem, type RiskLevel } from '../../../data/modules/comply';
import { riskDetail, RISK_DIMS } from '../../../data/modules/complyRegisters';
import { Card, Badge, Tabs } from '../../../components/ui';
import { DataTable } from '../../../components/DataTable';
import { fmtMoney, fmtNum } from '../../../lib/format';
import { MetricBand, HeatGrid, Facet, StateKey } from '../parts';
import { useRiskData, useContinuityData, useWorkspaceData } from '../useComply';
import { useQuery, useDeepLink, SectionHead, Toggles, CountLine, RecordDrawer, RSec, LinkedRecords, Cia, ago, ahead } from './shared';
import { forCustomer } from '../../../data/customerMap';

const tone = MODULE_BY_ID.comply.tone;
const LEVELS: RiskLevel[] = ['High', 'Medium', 'Low'];
export const TREATMENTS: RiskItem['treatment'][] = ['Mitigate', 'Accept', 'Transfer', 'Avoid', 'Not set'];
export const TREAT_COLOR: Record<RiskItem['treatment'], string> = { Mitigate: '#2e6fdb', Accept: '#c2590b', Transfer: '#7c5cd6', Avoid: '#0e9a6a', 'Not set': '#7e8aa0' };

function ScoreCell({ score, level }: { score: number | null; level: RiskLevel | null }) {
  if (score === null || level === null) return <span className="t-sub">Not scored</span>;
  return <span className="cmp-score"><b>{score}</b><Badge color={RISK_LEVEL_COLOR[level]}>{level}</Badge></span>;
}
function Lvl({ v }: { v: number }) {
  return <span className="cmp-lvl">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= v ? `on${v}` : ''} />)}</span>;
}

export default function RisksSection() {
  const { customer: c, tenantId } = useApp();
  const nav = useNavigate();
  const { p, set, go } = useQuery();
  const risks = useRiskData();
  const { assets, bia } = useContinuityData();
  const { incidents } = useWorkspaceData();
  const grc = scopedConnectors(c, tenantId).find((k) => k.category === 'GRC');
  const src = `${grc ? `${grc.vendor} ${grc.product}` : 'HexaComply'} risk register`;

  const level = (p('level') as RiskLevel | null) ?? 'all';
  const residual = p('residual') ?? 'all';
  const treatment = (p('treatment') as RiskItem['treatment'] | null) ?? 'all';
  const config = p('config') ?? 'all';
  const pastDue = p('lifecycle') === 'pastdue';
  const mode = (p('mode') as 'inherent' | 'residual' | null) ?? 'residual';
  const cell: [number, number] | null = p('l') && p('i') ? [Number(p('l')), Number(p('i'))] : null;
  const asset = p('asset');
  const threat = p('threat');
  const q = p('q');
  const clear = () => set({ level: null, residual: null, treatment: null, config: null, lifecycle: null, l: null, i: null, asset: null, threat: null, q: null, id: null });

  const rows = risks.filter((r) =>
    (level === 'all' || r.level === level) &&
    (residual === 'all' || (residual === 'none' ? r.residualLevel === null : r.residualLevel === residual)) &&
    (treatment === 'all' || r.treatment === treatment) && (config === 'all' || r.config === config) &&
    (!pastDue || (r.dueDays !== null && r.dueDays < 0)) &&
    (!asset || r.asset === asset) && (!threat || r.threat === threat) && (!q || r.title.toLowerCase().includes(q.toLowerCase())) &&
    (!cell || (r[mode] && r[mode]!.l === cell[0] && r[mode]!.i === cell[1])));
  const filtered = level !== 'all' || residual !== 'all' || treatment !== 'all' || config !== 'all' || pastDue || !!cell || !!asset || !!threat || !!q;

  const [open, setOpen] = useState<RiskItem | null>(null);
  const match = useCallback((r: RiskItem, id: string) => r.id === id, []);
  useDeepLink(risks, match, setOpen);

  const scored = risks.filter((r) => r.residual);
  const late = risks.filter((r) => r.dueDays !== null && r.dueDays < 0);
  const tCount = (t: RiskItem['treatment']) => risks.filter((r) => r.treatment === t).length;
  const tMax = Math.max(1, ...TREATMENTS.map(tCount));
  const totalLoss = useMemo(() => risks.reduce((s, r) => s + r.lossK, 0) * 1000, [risks]);

  return (
    <>
      <SectionHead intro={<>Threat-driven risk scenarios with inherent and residual assessments for <b>{c.name}</b>. Scores, levels and potential loss are computed by HexaComply — read-only register. Score = likelihood × impact × 4 on a 0–100 scale.</>} />
      <MetricBand tone={tone} items={[
        { ac: 'Risks', word: 'On the register', value: fmtNum(risks.length), unit: `${risks.filter((r) => r.curated).length} board-level`, active: !filtered, onClick: clear, source: src },
        { ac: 'High', word: 'Inherent', value: risks.filter((r) => r.level === 'High').length, unit: 'before treatment', color: 'var(--sev-critical)', active: level === 'High', onClick: () => { clear(); set({ level: 'High' }); }, source: src },
        { ac: 'High', word: 'Residual', value: scored.filter((r) => r.residualLevel === 'High').length, unit: 'after treatment', color: 'var(--sev-critical)', active: residual === 'High', onClick: () => { clear(); set({ residual: 'High' }); }, source: src },
        { ac: 'Past due', word: 'Treatments', value: late.length, unit: 'risks', color: 'var(--bad)', active: pastDue, onClick: () => { clear(); set({ lifecycle: 'pastdue' }); }, source: src },
        { ac: 'Not scored', word: 'Residual', value: risks.length - scored.length, unit: 'awaiting assessment', active: residual === 'none', onClick: () => { clear(); set({ residual: 'none' }); }, source: src },
        { ac: 'Potential loss', word: 'Modelled', value: fmtMoney(totalLoss, c.currency), unit: 'across the register', onClick: () => nav('/insurance/quantification'), source: 'HexaComply loss model' },
      ]} />

      <div className="grid comply-split">
        <Card title="Likelihood × impact" sub={`${risks.filter((r) => r[mode]).length} risks placed · click a cell to filter the register`} actions={<Tabs color={tone} value={mode} onChange={(v) => set({ mode: v === 'residual' ? null : v, l: null, i: null })} tabs={[{ id: 'inherent', label: 'Inherent' }, { id: 'residual', label: 'Residual' }]} />}>
          <HeatGrid items={risks} mode={mode} selected={cell} onPick={(x) => set({ l: x ? String(x[0]) : null, i: x ? String(x[1]) : null })} />
          <div className="comply-keys">
            {LEVELS.map((lv) => <StateKey key={lv} color={RISK_LEVEL_COLOR[lv]} label={`${lv} zone`} n={risks.filter((r) => (mode === 'inherent' ? r.level : r.residualLevel) === lv).length} on={mode === 'inherent' ? level === lv : residual === lv} onClick={() => set(mode === 'inherent' ? { level: level === lv ? null : lv } : { residual: residual === lv ? null : lv })} />)}
            {cell && <button className="link" onClick={() => set({ l: null, i: null })}>Clear cell ({L_LABELS[cell[0] - 1]} × {L_LABELS[cell[1] - 1]}) ×</button>}
          </div>
        </Card>
        <Card title="Treatment actions" sub="How each risk is being handled · click to filter">
          {TREATMENTS.map((t) => {
            const n = tCount(t);
            return (
              <button key={t} type="button" className="comply-dom" style={{ width: '100%', gridTemplateColumns: '90px minmax(0,1fr) 46px', padding: '9px 4px' }} onClick={() => set({ treatment: treatment === t ? null : t })}>
                <span style={{ color: treatment === t ? 'var(--text-primary)' : undefined }}>{t}</span>
                <span className="comply-dom-track" style={{ height: 14 }}><span className="comply-dom-fill" style={{ width: `${(n / tMax) * 100}%`, background: TREAT_COLOR[t] }} /></span>
                <span className="comply-dom-val"><b>{n}</b></span>
              </button>
            );
          })}
          <div className="comply-meta">
            <button type="button" onClick={() => set({ lifecycle: 'pastdue' })}><strong className="bad">{late.length}</strong>treatments past due</button>
            <button type="button" onClick={() => set({ config: 'Asset risk' })}><strong>{risks.filter((r) => r.config === 'Asset risk').length}</strong>asset risks</button>
            <button type="button" onClick={() => set({ config: 'Category risk' })}><strong>{risks.filter((r) => r.config === 'Category risk').length}</strong>category risks</button>
          </div>
        </Card>
      </div>

      <Card flush>
        <div className="comply-facets">
          <Facet label="Level" value={level} onChange={(v) => set({ level: v })} options={LEVELS.map((l) => ({ id: l, label: l, n: risks.filter((r) => r.level === l).length }))} />
          <Facet label="Residual" value={residual} onChange={(v) => set({ residual: v })} options={[...LEVELS.map((l) => ({ id: l as string, label: l, n: scored.filter((r) => r.residualLevel === l).length })), { id: 'none', label: 'Not scored', n: risks.length - scored.length }]} />
          <Facet label="Treatment" value={treatment} onChange={(v) => set({ treatment: v })} options={TREATMENTS.map((t) => ({ id: t, label: t, n: tCount(t) }))} />
          <Facet label="Config" value={config} onChange={(v) => set({ config: v })} options={[{ id: 'Asset risk', label: 'Asset risk' }, { id: 'Category risk', label: 'Category risk' }]} />
          {q && <Facet label="Scenario" value={q} onChange={() => set({ q: null })} options={[{ id: q, label: `contains “${q}”` }]} />}
          {(asset || threat) && <Facet label={asset ? 'Asset' : 'Threat'} value={(asset ?? threat)!} onChange={() => set({ asset: null, threat: null })} options={[{ id: (asset ?? threat)!, label: (asset ?? threat)! }]} />}
          <Toggles label="Lifecycle" items={[{ label: 'Treatment past due', on: pastDue, onChange: (on) => set({ lifecycle: on ? 'pastdue' : null }), n: late.length }]} />
        </div>
        <CountLine filtered={filtered} onClear={clear}>
          {fmtNum(rows.length)} of {fmtNum(risks.length)} risks{cell ? ` · ${L_LABELS[cell[0] - 1].toLowerCase()} likelihood × ${L_LABELS[cell[1] - 1].toLowerCase()} impact (${mode})` : ''} · source {src}
        </CountLine>
        <DataTable<RiskItem>
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={setOpen}
          search={(r) => `${r.id} ${r.title} ${r.asset} ${r.owner} ${r.threat}`}
          searchPlaceholder="Search risks, assets, owners…"
          initialSort={{ key: 'res', dir: 'desc' }}
          pageSize={25}
          columns={[
            { key: 'risk', header: 'Risk', sort: (r) => r.id, render: (r) => <><div className="t-main" style={{ maxWidth: 420, whiteSpace: 'normal' }}>{r.title}</div><div className="t-sub">{r.id}{r.curated ? ' · board-level' : ''}</div></> },
            { key: 'threat', header: 'Threat', sort: (r) => r.threat, render: (r) => <span className="t-sub">{r.threat}</span> },
            { key: 'asset', header: 'Asset / category', sort: (r) => r.asset, render: (r) => <><div className="t-main" style={{ fontSize: 12 }}>{r.asset}</div><div className="t-sub">{r.config}</div></> },
            { key: 'inh', header: 'Inherent', sort: (r) => r.inherentScore, render: (r) => <ScoreCell score={r.inherentScore} level={r.level} /> },
            { key: 'res', header: 'Residual', sort: (r) => r.residualScore ?? -1, render: (r) => <ScoreCell score={r.residualScore} level={r.residualLevel} /> },
            { key: 'treat', header: 'Treatment', sort: (r) => r.treatment, render: (r) => <Badge color={TREAT_COLOR[r.treatment]} dot>{r.treatment}</Badge> },
            { key: 'due', header: 'Due', align: 'right', sort: (r) => r.dueDays ?? 9999, render: (r) => (r.dueDays === null ? <span className="t-sub">—</span> : <span className="t-sub" style={{ color: r.dueDays < 0 ? 'var(--bad)' : undefined, fontWeight: r.dueDays < 0 ? 700 : undefined }}>{r.dueDays < 0 ? `${-r.dueDays} d past due` : ahead(r.dueDays)}</span>) },
          ]}
        />
      </Card>

      {open && (() => {
        const r = open;
        const d = riskDetail(c, r, assets);
        const dimNames = forCustomer(RISK_DIMS, c);
        const close = () => { setOpen(null); set({ id: null }); };
        const assetRec = assets.filter((a) => a.base === r.asset);
        const biaHits = bia.filter((b) => b.systems.some((s) => r.asset.toLowerCase().includes(s.split(' ')[0].toLowerCase())) || (r.asset && b.name.toLowerCase().includes(r.asset.split(' ')[0].toLowerCase())));
        const incHits = incidents.filter((x) => x.asset === r.asset);
        const sameAsset = risks.filter((k) => k.asset === r.asset).length;
        const Table = ({ label, v, l, i, score, lv }: { label: string; v: number[]; l: number; i: number; score: number; lv: RiskLevel }) => (
          <table className="cmp-dimtbl">
            <caption>{label}</caption>
            <tbody>
              {dimNames.map((n, k) => <tr key={n}><td>{n}</td><td><Lvl v={v[k]} />{L_LABELS[v[k] - 1]}</td></tr>)}
              <tr><td>Likelihood</td><td><Lvl v={l} />{L_LABELS[l - 1]}</td></tr>
              <tr><td>Total impact</td><td><Lvl v={i} />{L_LABELS[i - 1]}</td></tr>
              <tr className="tot"><td>Score · level</td><td>{score} · <span style={{ color: RISK_LEVEL_COLOR[lv] }}>{lv}</span></td></tr>
            </tbody>
          </table>
        );
        return (
          <RecordDrawer id={r.id} recordId={`risk ${d.uniqueId.toLowerCase()}`} updatedDays={r.reviewDays} title={r.title}
            badges={<><Badge color={RISK_LEVEL_COLOR[r.level]} solid>Inherent {r.level}</Badge>{r.residualLevel ? <Badge color={RISK_LEVEL_COLOR[r.residualLevel]}>Residual {r.residualLevel}</Badge> : <Badge>Residual not scored</Badge>}<Badge color={TREAT_COLOR[r.treatment]} dot>{r.treatment}</Badge>{r.curated && <Badge color={tone}>Board-level</Badge>}</>}
            onClose={close}>
            <div className="cmp-bigscores">
              <div><small>Inherent score</small><b style={{ color: RISK_LEVEL_COLOR[r.level] }}>{r.inherentScore}</b><span>{r.level}</span></div>
              <div><small>Residual score</small><b style={{ color: r.residualLevel ? RISK_LEVEL_COLOR[r.residualLevel] : undefined }}>{r.residualScore ?? '—'}</b><span>{r.residualLevel ?? 'Not yet scored'}</span></div>
              <div><small>After treatment</small><b style={{ color: d.cutPct !== null && d.cutPct < 0 ? 'var(--good)' : undefined }}>{d.cutPct === null ? '—' : `${d.cutPct}%`}</b><span>{d.cutPct === null ? 'no residual yet' : 'change in score'}</span></div>
              <div><small>Potential loss</small><b>{fmtMoney(r.lossK * 1000, c.currency, false)}</b><span>computed by HexaComply</span></div>
            </div>
            <RSec title="Scenario" rows={[
              ['Threat', `${r.threat} · ${d.threatId}`], ['Vulnerability', r.vulnerability], ['Impact', r.consequence], ['Asset category', d.assetCategory],
              ...(r.config === 'Asset risk' ? [['Asset', r.asset] as [string, string]] : []), ['Config', r.config], ['Risk date', ago(d.riskDays)],
              ['C · I · A', <Cia key="c" v={d.cia} />], ['Total criticality', `${d.totalCrit} of 9`],
            ]} />
            <RSec title="Assessment">
              <div className="cmp-dims">
                <Table label="Inherent" v={d.inh} l={r.inherent.l} i={r.inherent.i} score={r.inherentScore} lv={r.level} />
                {r.residual && d.res ? <Table label="Residual" v={d.res} l={r.residual.l} i={r.residual.i} score={r.residualScore!} lv={r.residualLevel!} /> : <div className="cmp-none" style={{ alignSelf: 'center' }}>Residual not yet assessed: shown honestly as unscored, never as zero.</div>}
              </div>
            </RSec>
            <RSec title="Treatment" rows={[
              ['Action', r.treatment], ['Existing controls', d.existing.join(' · ')], ['Proposed control', d.proposed], ['Responsible team / function', d.responsible],
              ['Due', r.dueDays === null ? 'No date set' : r.dueDays < 0 ? <span key="d" style={{ color: 'var(--bad)', fontWeight: 700 }}>{ago(-r.dueDays)} · {-r.dueDays} days past due</span> : ahead(r.dueDays)],
              ['Potential loss', fmtMoney(r.lossK * 1000, c.currency, false)], ['Report to board', d.boardReport ? 'Yes' : 'No'], ['Comment', d.comment],
            ]} />
            <RSec title="Ownership" rows={[['Owner', r.owner], ['Unique id', <span key="u" className="mono">{d.uniqueId}</span>], ['Tenant', c.tenants.find((t) => t.id === r.tenant)?.name ?? '—'], ['Last reviewed', ago(r.reviewDays)]]} />
            <LinkedRecords items={[
              ...(assetRec.length ? [{ label: `Asset: ${r.asset}`, sub: `${assetRec.length} record${assetRec.length === 1 ? '' : 's'} in the asset register`, count: assetRec.length, onClick: () => go('assets', { base: r.asset, ...(assetRec.length === 1 ? { id: assetRec[0].id } : {}) }) }] : []),
              { label: sameAsset > 1 ? `${sameAsset} risks against ${r.asset}` : `Other ${r.threat} risks`, count: sameAsset > 1 ? sameAsset : risks.filter((k) => k.threat === r.threat).length, onClick: () => { close(); set(sameAsset > 1 ? { asset: r.asset, threat: null } : { threat: r.threat, asset: null }); } },
              ...biaHits.slice(0, 2).map((b) => ({ label: `Business service: ${b.name}`, sub: `${b.id} · RTO ${b.rtoH} h`, onClick: () => go('bia', { id: b.id }) })),
              ...incHits.map((x) => ({ label: `Incident ${x.id}`, sub: x.title, onClick: () => go('incidents', { id: x.id }) })),
              ...r.controls.filter((k) => k.startsWith('CTL-')).map((k) => ({ label: `Control ${k} in the loop engine`, sub: 'Closed-loop assurance', onClick: () => nav(`/loop?control=${k}`) })),
            ]} />
          </RecordDrawer>
        );
      })()}
    </>
  );
}
