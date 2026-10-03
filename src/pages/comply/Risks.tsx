import { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, ShieldCheck, ArrowRight } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { loops, loopSummary } from '../../data/core';
import { scopedConnectors, tenantName } from '../../data/customers';
import { MODULE_BY_ID } from '../../modules/registry';
import { RISK_LEVEL_COLOR, L_LABELS, type RiskItem, type RiskLevel } from '../../data/modules/comply';
import { Card, KpiStrip, Badge, Bar, Btn, KV, Callout, SectionLabel, Tabs } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { fmtMoney, fmtNum } from '../../lib/format';
import { WriteBackModal, Field, HeatGrid, ShiftRow, Facet, StateKey } from './parts';
import { useRiskData } from './useComply';

const tone = MODULE_BY_ID.comply.tone;
const LEVELS: RiskLevel[] = ['High', 'Medium', 'Low'];
const TREATMENTS: RiskItem['treatment'][] = ['Mitigate', 'Accept', 'Transfer', 'Avoid', 'Not set'];
const TREAT_COLOR: Record<RiskItem['treatment'], string> = { Mitigate: '#2e6fdb', Accept: '#c2590b', Transfer: '#7c5cd6', Avoid: '#0e9a6a', 'Not set': '#7e8aa0' };

function ScoreCell({ score, level }: { score: number | null; level: RiskLevel | null }) {
  if (score === null || level === null) return <span className="t-sub">Not scored</span>;
  return <span className="row" style={{ gap: 6 }}><b className="num" style={{ fontSize: 14 }}>{score}</b><Badge color={RISK_LEVEL_COLOR[level]}>{level}</Badge></span>;
}

export default function ComplyRisks() {
  const { customer: c, tenantId, toast } = useApp();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const risks = useRiskData();
  const grc = scopedConnectors(c, tenantId).find((k) => k.category === 'GRC');
  const grcName = grc ? `${grc.vendor} ${grc.product}` : 'HexaComply';
  const src = `${grcName} risk register`;

  const p = (k: string) => sp.get(k);
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === 'all' ? next.delete(k) : next.set(k, v)));
    setSp(next, { replace: true });
  };
  const level = (p('level') as RiskLevel | null) ?? 'all';
  const residual = p('residual') ?? 'all';
  const treatment = (p('treatment') as RiskItem['treatment'] | null) ?? 'all';
  const config = p('config') ?? 'all';
  const pastDue = p('lifecycle') === 'pastdue';
  const mode = (p('mode') as 'inherent' | 'residual' | null) ?? 'residual';
  const cell: [number, number] | null = p('l') && p('i') ? [Number(p('l')), Number(p('i'))] : null;
  const openId = p('id');
  const clearAll = () => setSp(new URLSearchParams(), { replace: true });

  const rows = risks.filter((r) =>
    (level === 'all' || r.level === level) &&
    (residual === 'all' || (residual === 'none' ? r.residualLevel === null : r.residualLevel === residual)) &&
    (treatment === 'all' || r.treatment === treatment) && (config === 'all' || r.config === config) &&
    (!pastDue || (r.dueDays !== null && r.dueDays < 0)) &&
    (!cell || (r[mode] && r[mode]!.l === cell[0] && r[mode]!.i === cell[1])));

  const [open, setOpen] = useState<RiskItem | null>(null);
  const [handled, setHandled] = useState<string | null>(null);
  if (openId && handled !== openId) {
    setHandled(openId);
    const r = risks.find((x) => x.id === openId);
    if (r) setOpen(r);
  }
  const [taskModal, setTaskModal] = useState<RiskItem | null>(null);
  const [acceptModal, setAcceptModal] = useState<RiskItem | null>(null);
  const [due, setDue] = useState('30');

  const scored = risks.filter((r) => r.residual);
  const highInh = risks.filter((r) => r.level === 'High').length;
  const highRes = scored.filter((r) => r.residualLevel === 'High').length;
  const late = risks.filter((r) => r.dueDays !== null && r.dueDays < 0);
  const notScored = risks.length - scored.length;
  const accepted = risks.filter((r) => r.treatment === 'Accept').length;
  const loss = risks.slice().sort((a, b) => b.lossK - a.lossK).slice(0, 10).reduce((s, r) => s + r.lossK, 0) * 1000;
  const lvCount = (lv: RiskLevel, m: 'inherent' | 'residual') => scored.filter((r) => (m === 'inherent' ? r.level : r.residualLevel) === lv).length;
  const lvMax = Math.max(1, ...LEVELS.flatMap((x) => [lvCount(x, 'inherent'), lvCount(x, 'residual')]));
  const threats = [...new Set(risks.map((r) => r.category))].map((t) => ({ t, n: risks.filter((r) => r.category === t).length, high: risks.filter((r) => r.category === t && (r.residualLevel ?? r.level) === 'High').length })).sort((a, b) => b.n - a.n).slice(0, 8);
  const curated = risks.filter((r) => r.curated);

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · {tenantName(c, tenantId)}: {fmtNum(risks.length)} threat-driven risk scenarios with inherent and residual assessments, treatments and owners, held in {grcName}. Scores and potential loss are computed by HexaComply; treatments link to the controls and loops that prove them.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Risks on register', value: fmtNum(risks.length), unit: `${curated.length} board-level`, onClick: clearAll, source: src },
          { label: 'High inherent', value: highInh, toneColor: 'var(--sev-critical)', bar: (highInh / risks.length) * 100, onClick: () => set({ level: 'High', residual: null }), source: src },
          { label: 'High after treatment', value: highRes, toneColor: 'var(--sev-critical)', onClick: () => set({ residual: 'High', level: null }), source: src, delta: { text: `${highInh - highRes} brought down`, good: true } },
          { label: 'Treatments past due', value: late.length, toneColor: 'var(--bad)', onClick: () => set({ lifecycle: 'pastdue' }), source: src },
          { label: 'Not yet scored', hint: 'residual', value: notScored, onClick: () => set({ residual: 'none' }), source: src },
          { label: 'Accepted', value: accepted, unit: 'with owner sign-off', onClick: () => set({ treatment: 'Accept' }), source: src },
          { label: 'Top-10 potential loss', hint: 'modelled', value: fmtMoney(loss, c.currency), onClick: () => nav('/insurance/quantification'), source: 'HexaComply · HexaView loss model' },
        ]}
      />

      <div className="grid comply-split">
        <Card title="Likelihood × impact" sub={`${risks.filter((r) => r[mode]).length} risks placed · click a cell to filter the register`} actions={<Tabs color={tone} value={mode} onChange={(v) => set({ mode: v, l: null, i: null })} tabs={[{ id: 'inherent', label: 'Inherent' }, { id: 'residual', label: 'Residual' }]} />}>
          <HeatGrid items={risks} mode={mode} selected={cell} onPick={(x) => set({ l: x ? String(x[0]) : null, i: x ? String(x[1]) : null })} />
          <div className="comply-keys">
            {LEVELS.map((lv) => <StateKey key={lv} color={RISK_LEVEL_COLOR[lv]} label={`${lv} zone`} n={risks.filter((r) => (mode === 'inherent' ? r.level : r.residualLevel) === lv).length} onClick={() => set(mode === 'inherent' ? { level: lv } : { residual: lv })} />)}
            {cell && <button className="link" onClick={() => set({ l: null, i: null })}>Clear cell ({L_LABELS[cell[0] - 1]} × {L_LABELS[cell[1] - 1]}) ×</button>}
          </div>
        </Card>

        <Card title="Treatment and posture" sub="How risks are being handled, and what treatment changed">
          <SectionLabel>Treatment actions</SectionLabel>
          {TREATMENTS.map((t) => {
            const n = risks.filter((r) => r.treatment === t).length;
            return (
              <button key={t} type="button" className="comply-dom" style={{ width: '100%', gridTemplateColumns: '90px minmax(0,1fr) 46px' }} onClick={() => set({ treatment: treatment === t ? null : t })}>
                <span>{t}</span>
                <span className="comply-dom-track"><span className="comply-dom-fill" style={{ width: `${(n / risks.length) * 100}%`, background: TREAT_COLOR[t] }} /></span>
                <span className="comply-dom-val"><b>{n}</b></span>
              </button>
            );
          })}
          <SectionLabel>Inherent → residual (same {scored.length} risks)</SectionLabel>
          {LEVELS.map((lv) => <ShiftRow key={lv} name={lv} from={lvCount(lv, 'inherent')} to={lvCount(lv, 'residual')} max={lvMax} onClick={() => set({ residual: lv })} />)}
          <SectionLabel>Most frequent threats</SectionLabel>
          {threats.slice(0, 5).map((x) => (
            <div key={x.t} className="bar-row" style={{ padding: '3px 0' }}>
              <div className="bar-label"><b>{x.t}</b><span>{x.high} high</span></div>
              <Bar value={x.n} max={threats[0].n} color="var(--m-comply)" size="thin" />
              <div className="bar-val">{x.n}</div>
            </div>
          ))}
        </Card>
      </div>

      <Card title="Board-level risks" sub="Curated scenarios the executive committee reviews quarterly · inherent → residual" count={curated.length}>
        <div className="grid g2" style={{ gap: '0 24px' }}>
          {curated.map((r) => (
            <button key={r.id} type="button" className="comply-cap-row" onClick={() => setOpen(r)}>
              <span className="comply-cap-main"><b>{r.title}</b><span>{r.id} · {r.category} · {r.owner} · {r.treatment}</span></span>
              <span className="comply-shift-vals"><b style={{ color: RISK_LEVEL_COLOR[r.level] }}>{r.inherentScore}</b><i>→</i><b style={{ color: r.residualLevel ? RISK_LEVEL_COLOR[r.residualLevel] : undefined }}>{r.residualScore ?? '—'}</b></span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Risk register" count={rows.length} flush sub="Every record is read-only here: scores, levels and potential loss are computed by HexaComply" actions={<Btn sm ghost onClick={clearAll}>Clear filters</Btn>}>
        <div className="comply-facets">
          <Facet label="Inherent level" value={level} onChange={(v) => set({ level: v })} options={LEVELS.map((l) => ({ id: l, label: l, n: risks.filter((r) => r.level === l).length }))} />
          <Facet label="Residual" value={residual} onChange={(v) => set({ residual: v })} options={[...LEVELS.map((l) => ({ id: l as string, label: l, n: scored.filter((r) => r.residualLevel === l).length })), { id: 'none', label: 'Not scored', n: notScored }]} />
          <Facet label="Treatment" value={treatment} onChange={(v) => set({ treatment: v })} options={TREATMENTS.map((t) => ({ id: t, label: t, n: risks.filter((r) => r.treatment === t).length }))} />
          <Facet label="Config" value={config} onChange={(v) => set({ config: v })} options={[{ id: 'Asset risk', label: 'Asset risk' }, { id: 'Category risk', label: 'Category risk' }]} />
          <Facet label="Lifecycle" value={pastDue ? 'pastdue' : 'all'} onChange={(v) => set({ lifecycle: v })} options={[{ id: 'pastdue', label: 'Treatment past due', n: late.length }]} />
        </div>
        <div className="comply-count-line">{fmtNum(rows.length)} of {fmtNum(risks.length)} risks{cell ? ` · cell ${L_LABELS[cell[0] - 1]} likelihood × ${L_LABELS[cell[1] - 1].toLowerCase()} impact (${mode})` : ''} · source {src}</div>
        <DataTable<RiskItem>
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={setOpen}
          search={(r) => `${r.id} ${r.title} ${r.asset} ${r.owner} ${r.threat}`}
          searchPlaceholder="Search risks, assets, owners…"
          initialSort={{ key: 'res', dir: 'desc' }}
          pageSize={20}
          columns={[
            { key: 'risk', header: 'Risk', sort: (r) => r.id, render: (r) => <><div className="t-main" style={{ maxWidth: 420, whiteSpace: 'normal' }}>{r.title}</div><div className="t-sub">{r.id}{r.curated ? ' · board-level' : ''}</div></> },
            { key: 'threat', header: 'Threat', sort: (r) => r.threat, render: (r) => <span className="t-sub">{r.threat}</span> },
            { key: 'asset', header: 'Asset / category', sort: (r) => r.asset, render: (r) => <><div className="t-main" style={{ fontSize: 12 }}>{r.asset}</div><div className="t-sub">{r.config}</div></> },
            { key: 'inh', header: 'Inherent', sort: (r) => r.inherentScore, render: (r) => <ScoreCell score={r.inherentScore} level={r.level} /> },
            { key: 'res', header: 'Residual', sort: (r) => r.residualScore ?? -1, render: (r) => <ScoreCell score={r.residualScore} level={r.residualLevel} /> },
            { key: 'treat', header: 'Treatment', sort: (r) => r.treatment, render: (r) => <Badge color={TREAT_COLOR[r.treatment]} dot>{r.treatment}</Badge> },
            { key: 'due', header: 'Due', align: 'right', sort: (r) => r.dueDays ?? 9999, render: (r) => (r.dueDays === null ? <span className="t-sub">—</span> : <span className="t-sub" style={{ color: r.dueDays < 0 ? 'var(--bad)' : undefined, fontWeight: r.dueDays < 0 ? 700 : undefined }}>{r.dueDays < 0 ? `${-r.dueDays} d over` : `in ${r.dueDays} d`}</span>) },
            { key: 'owner', header: 'Owner', sort: (r) => r.owner, render: (r) => <span className="t-sub">{r.owner}</span> },
          ]}
        />
      </Card>

      {open && (
        <Drawer
          wide
          title={open.title}
          sub={`${open.id} · ${open.config} · ${open.category}`}
          onClose={() => { setOpen(null); set({ id: null }); }}
          footer={
            <>
              {open.treatment === 'Accept' ? <Btn onClick={() => setAcceptModal(open)}><ShieldCheck /> Re-confirm acceptance</Btn> : null}
              <Btn primary color={tone} onClick={() => setTaskModal(open)}><ClipboardList /> Raise treatment task</Btn>
            </>
          }
        >
          <div className="grid g2" style={{ gap: 18 }}>
            <KV rows={[
              ['Threat', open.threat],
              ['Vulnerability', open.vulnerability],
              ['Consequence', open.consequence],
              ['Asset / category', `${open.asset} (${open.config})`],
              ['Tenant', c.tenants.find((t) => t.id === open.tenant)?.name ?? '—'],
              ['Owner', open.owner],
            ]} />
            <KV rows={[
              ['Inherent', <span key="i">L{open.inherent.l} {L_LABELS[open.inherent.l - 1].toLowerCase()} × I{open.inherent.i} {L_LABELS[open.inherent.i - 1].toLowerCase()} = <b>{open.inherentScore}</b> <Badge color={RISK_LEVEL_COLOR[open.level]}>{open.level}</Badge></span>],
              ['Residual', open.residual ? <span key="r">L{open.residual.l} × I{open.residual.i} = <b>{open.residualScore}</b> <Badge color={RISK_LEVEL_COLOR[open.residualLevel!]}>{open.residualLevel}</Badge></span> : 'Not yet scored after treatment'],
              ['Treatment', open.treatment],
              ['Treatment due', open.dueDays === null ? '—' : open.dueDays < 0 ? `${-open.dueDays} days past due` : `in ${open.dueDays} days`],
              ['Potential loss', fmtMoney(open.lossK * 1000, c.currency)],
              ['Last reviewed', `${open.reviewDays} days ago`],
            ]} />
          </div>
          {open.dueDays !== null && open.dueDays < 0 && <Callout kind="warn">The treatment date has passed. Until it is complete the residual score is a target, not a measured position.</Callout>}
          <div>
            <SectionLabel>Mitigating controls and their loops</SectionLabel>
            {open.controls.length ? (
              <div className="list">
                {open.controls.map((ctl) => {
                  const ls = loops(c, tenantId).filter((l) => l.controlId === ctl);
                  const s = loopSummary(ls);
                  return (
                    <button key={ctl} className="list-row" onClick={() => nav(`/loop?control=${ctl}`)}>
                      <span className="list-main"><b>{ctl}</b><span>{ls[0]?.control ?? '—'} · {ls[0]?.requirement ?? ''}</span></span>
                      <span style={{ width: 140 }}><Bar value={s.assuredPct} color="var(--m-view)" size="thin" /><span className="t-sub muted" style={{ fontSize: 11 }}>{s.closed}/{s.applicable} loops closed</span></span>
                      <ArrowRight size={14} className="muted" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 12 }}>
                {open.treatment === 'Transfer' ? `Transferred to cyber insurance: ${c.insurance.carrier}, limit ${fmtMoney(c.insurance.limitM * 1e6, c.currency)}.` : open.treatment === 'Accept' ? 'Accepted by the owner; no technical control mapped. Acceptance expires in 12 months.' : 'No technical control mapped yet. Raise a treatment task to link one.'}
              </div>
            )}
          </div>
        </Drawer>
      )}

      {taskModal && (
        <WriteBackModal
          title="Raise treatment task"
          target={grcName}
          risk="low"
          approvals="No approval needed"
          submitLabel="Create task"
          onClose={() => setTaskModal(null)}
          onSubmit={() => { toast(`Treatment task created in ${grcName} for ${taskModal.id} · owner ${taskModal.owner} · due in ${due} days`); setTaskModal(null); }}
          changes={[['Risk', `${taskModal.id} · ${taskModal.title}`], ['Treatment', taskModal.treatment === 'Not set' ? 'Mitigate' : taskModal.treatment], ['Owner', taskModal.owner], ['Due', `${due} days`]] as [ReactNode, ReactNode][]}
        >
          <Field label="Due in">
            <select className="select" value={due} onChange={(e) => setDue(e.target.value)}>{['14', '30', '60', '90'].map((d) => <option key={d} value={d}>{d} days</option>)}</select>
          </Field>
        </WriteBackModal>
      )}

      {acceptModal && (
        <WriteBackModal
          title="Re-confirm risk acceptance"
          target={grcName}
          risk="medium"
          approvals={`Approval: ${c.people.ciso.name} (CISO)`}
          submitLabel="Send for sign-off"
          onClose={() => setAcceptModal(null)}
          onSubmit={() => { toast(`Acceptance of ${acceptModal.id} sent to ${c.people.ciso.name} for sign-off · audited`); setAcceptModal(null); }}
          changes={[['Risk', `${acceptModal.id} · ${acceptModal.title}`], ['Residual', `${acceptModal.residualScore ?? acceptModal.inherentScore}`], ['Acceptance period', '12 months'], ['Approver', c.people.ciso.name]]}
        />
      )}
    </>
  );
}
