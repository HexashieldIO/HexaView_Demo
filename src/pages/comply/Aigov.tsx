import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bot, ExternalLink, UserCheck, CheckCircle2, Circle } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { headlines } from '../../data/core';
import { scopedConnectors, tenantName } from '../../data/customers';
import { MODULE_BY_ID } from '../../modules/registry';
import { aiRegister, iso42001Progress, nistAiRmf, aiPolicyAck, type AiSystemGov, type EuAiClass } from '../../data/modules/comply';
import { Card, KpiStrip, Badge, Bar, Btn, KV, Callout, SectionLabel, StatusBadge, SevBadge, Sources, Legend, Chip } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Overlay';
import { fmtAgo, fmtNum, scoreTone } from '../../lib/format';
import { rng } from '../../lib/rng';
import { WriteBackModal, Field } from './parts';
import './comply.css';

const tone = MODULE_BY_ID.comply.tone;
const CLASS_COLOR: Record<EuAiClass, string> = { Prohibited: 'var(--sev-critical)', High: 'var(--sev-high)', Limited: 'var(--sev-medium)', Minimal: 'var(--good)' };
const CLASSES: EuAiClass[] = ['Prohibited', 'High', 'Limited', 'Minimal'];
const CLASS_NOTE: Record<EuAiClass, string> = {
  Prohibited: 'Art. 5 practices: must not be used. Applies since Feb 2025.',
  High: 'Annex I / III systems: conformity, risk management, oversight, logging. From Aug 2026.',
  Limited: 'Art. 50 transparency: tell users, mark synthetic content.',
  Minimal: 'No specific obligations beyond AI literacy (Art. 4).',
};
const APPROVAL_COLOR = { Approved: 'var(--good)', Conditional: 'var(--sev-medium)', Pending: 'var(--m-matrix)', Rejected: 'var(--bad)', 'Not submitted': 'var(--sev-info)' };
const IMPACT_COLOR = { Complete: 'var(--good)', 'In progress': 'var(--m-matrix)', 'Not started': 'var(--sev-medium)', 'Not required': 'var(--sev-info)' };
const CARD_COLOR = { Published: 'var(--good)', Draft: 'var(--sev-medium)', Missing: 'var(--bad)', 'Vendor-supplied': 'var(--m-matrix)' };

export default function ComplyAigov() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const nav = useNavigate();
  const days = rangeDays(timeRange);
  const h = headlines(c, tenantId);
  const reg = useMemo(() => aiRegister(c, tenantId), [c, tenantId]);
  const iso = useMemo(() => iso42001Progress(c, tenantId), [c, tenantId]);
  const rmf = useMemo(() => nistAiRmf(c, tenantId), [c, tenantId]);
  const ack = useMemo(() => aiPolicyAck(c, tenantId), [c, tenantId]);
  const [sp, setSp] = useSearchParams();
  const cls = (sp.get('class') as EuAiClass | null) ?? null;
  const setCls = (k: EuAiClass | null) => { const n = new URLSearchParams(sp); if (k) n.set('class', k); else n.delete('class'); setSp(n, { replace: true }); };
  const [regF, setRegF] = useState<'unsanctioned' | 'impact' | 'card' | null>(null);
  const [open, setOpen] = useState<AiSystemGov | null>(null);
  const [assign, setAssign] = useState<AiSystemGov | null>(null);
  const [owner, setOwner] = useState(c.people.grcLead.name);
  const [decided, setDecided] = useState<Record<string, AiSystemGov['approval']>>({});

  const governed = reg.filter((s) => s.euClass !== 'Prohibited');
  const effective = (s: AiSystemGov) => ({ ...s, approval: decided[s.id] ?? s.approval, owner: decided[s.id] ? owner : s.owner });
  const rows = reg.map(effective).filter((s) => (cls ? s.euClass === cls : true) && (regF === 'unsanctioned' ? s.source === 'Unsanctioned' : regF === 'impact' ? s.impact !== 'Complete' && s.impact !== 'Not required' : regF === 'card' ? s.modelCard === 'Missing' || s.modelCard === 'Draft' : true));
  const isoImpl = iso.reduce((s, g) => s + g.implemented, 0);
  const isoTotal = iso.reduce((s, g) => s + g.total, 0);
  const ackPct = Math.round(ack.reduce((s, a) => s + a.pct * a.people, 0) / Math.max(1, ack.reduce((s, a) => s + a.people, 0)));
  const impactDone = governed.filter((s) => s.impact === 'Complete').length;
  const impactNeeded = governed.filter((s) => s.impact !== 'Not required').length;
  const unsanctioned = governed.filter((s) => s.source === 'Unsanctioned');
  const aiFeeds = scopedConnectors(c, tenantId).filter((k) => ['DLP', 'SASE', 'AI', 'Identity'].includes(k.category));
  const runtimeEvidence = useMemo(() => {
    const r = rng(`aigov-evidence-${c.id}-${tenantId}`);
    const sys = c.vocab.aiSystems;
    const items: { title: string; control: string; status: 'Accepted' | 'Pushed' | 'Needs review'; minAgo: number; hash: string }[] = [
      { title: `Kill-switch test executed on ${sys[0]}`, control: 'ISO 42001 A.6.2.6 · EU AI Act Art. 14' },
      { title: `Guardrail policy v12 enforced on ${r.int(18, 60)} agents`, control: 'ISO 42001 A.9.2 · NIST AI RMF MANAGE 2.4' },
      { title: 'MCP server and agent inventory snapshot', control: 'ISO 42001 A.4.2 · NIST AI RMF MAP 1.1' },
      { title: `Sensitive-data flow attestation for ${sys[1]}`, control: 'ISO 42001 A.7.4 · EU AI Act Art. 10' },
      { title: 'Prompt-injection detections mapped to OWASP LLM01', control: 'ISO 42001 A.6.2.4 · NIST AI RMF MEASURE 2.7' },
      { title: `Human approval gate log for ${sys[2] ?? sys[0]}`, control: 'EU AI Act Art. 14 · ISO 42001 A.9.3' },
      { title: 'Shadow AI discovery report (weekly)', control: 'ISO 42001 A.4.3 · NIST AI RMF GOVERN 1.6' },
      { title: 'Model-vendor residency attestation', control: 'ISO 42001 A.10.3 · EU AI Act Art. 26' },
    ].map((e, i) => ({ ...e, status: (i === 4 ? 'Needs review' : i < 3 ? 'Accepted' : 'Pushed') as 'Accepted' | 'Pushed' | 'Needs review', minAgo: 20 + i * r.int(60, 400), hash: r.hex(12) }));
    return items;
  }, [c, tenantId]);

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · {tenantName(c, tenantId)}: the AI management system (AIMS) for {h.ai.aiSystems} AI systems you build and buy, run in HexaComply towards ISO/IEC 42001 certification, with EU AI Act and NIST AI RMF obligations mapped once. Discovery, runtime enforcement, AI usage and ROI live in HexaAI Governance, and its runtime evidence flows in here automatically{' '}
        <button className="link" onClick={() => nav('/ai-governance/overview')}>open HexaAI Governance <ExternalLink size={11} /></button>
      </p>
      {c.id === 'healthcare' && (
        <Callout>
          <b>US health system.</b> The EU AI Act classes below are used as the risk taxonomy; the binding regimes are FDA software-as-a-medical-device rules, ONC HTI-1 transparency for predictive decision support in Epic, HIPAA for PHI in prompts, and state laws such as the Colorado AI Act.
        </Callout>
      )}
      {c.id === 'automotive' && (
        <Callout>
          <b>Vehicle AI.</b> In-car AI also falls under UNECE R155 (threat analysis for the vehicle type) and ISO/SAE 21434 TARA; manufacturing AI that acts as a machine safety component falls under the Machinery Regulation 2023/1230.
        </Callout>
      )}

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'AI systems', hint: 'governed', value: h.ai.aiSystems, unit: `+1 rejected at intake`, onClick: () => { setCls(null); setRegF(null); }, source: 'HexaComply AI register · HexaAI discovery' },
          { label: 'High risk', hint: 'EU AI Act', value: governed.filter((s) => s.euClass === 'High').length, toneColor: 'var(--sev-high)', onClick: () => setCls('High'), source: 'HexaComply AI register' },
          { label: 'Runtime evidence', hint: 'from HexaAI', value: runtimeEvidence.length, delta: { text: `${runtimeEvidence.filter((e) => e.status === 'Needs review').length} need review · ${unsanctioned.length} awaiting decision`, good: true }, onClick: () => document.getElementById('aigov-evidence')?.scrollIntoView({ behavior: 'smooth' }), source: 'HexaAI runtime (Nexovern kernel sensor) · pushed to HexaComply' },
          { label: 'Impact assessments', value: `${impactDone}/${impactNeeded}`, bar: (impactDone / Math.max(1, impactNeeded)) * 100, onClick: () => { setCls(null); setRegF('impact'); }, source: 'HexaComply AI register' },
          { label: 'ISO/IEC 42001', hint: 'Annex A', value: `${Math.round((isoImpl / isoTotal) * 100)}%`, unit: `${isoImpl}/${isoTotal}`, bar: (isoImpl / isoTotal) * 100, onClick: () => document.getElementById('aigov-42001')?.scrollIntoView({ behavior: 'smooth' }), source: 'HexaComply · ISO/IEC 42001 pack' },
          { label: 'Policy acknowledged', value: `${ackPct}%`, bar: ackPct, toneColor: scoreTone(ackPct), onClick: () => document.getElementById('aigov-ack')?.scrollIntoView({ behavior: 'smooth' }), source: c.connectors.find((k) => k.category === 'Identity')?.product ?? 'HexaComply' },
          { label: 'Model cards', value: `${governed.filter((s) => s.modelCard === 'Published' || s.modelCard === 'Vendor-supplied').length}/${governed.length}`, onClick: () => { setCls(null); setRegF('card'); }, source: 'HexaComply AI register' },
        ]}
      />

      <div id="aigov-evidence">
        <Card
          title="Evidence from HexaAI runtime"
          count={runtimeEvidence.length}
          sub="Captured on the execution path by HexaAI (Nexovern kernel sensor) and pushed here as AIMS evidence · click an item for its control"
          actions={<Btn sm primary color={tone} onClick={() => nav('/ai-governance/compliance')}><Bot /> Open evidence feed in HexaAI</Btn>}
          flush
        >
          <div className="list" style={{ padding: '0 18px 8px' }}>
            {runtimeEvidence.map((e) => (
              <button key={e.hash} className="list-row" onClick={() => nav('/ai-governance/compliance')}>
                <span className="list-main">
                  <b>{e.title}</b>
                  <span>{e.control} · sha256 {e.hash}… · {fmtAgo(e.minAgo)}</span>
                </span>
                <Badge color={e.status === 'Accepted' ? 'var(--good)' : e.status === 'Pushed' ? 'var(--accent)' : 'var(--sev-medium)'} dot>{e.status}</Badge>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g-3-2">
        <Card title="EU AI Act risk classification" sub="Click a class to filter the register · obligations follow the class and your role (provider or deployer)">
          <div className="comply-class">
            {CLASSES.map((k) => {
              const n = reg.filter((s) => s.euClass === k).length;
              return (
                <button key={k} type="button" className={`comply-class-tile ${cls === k ? 'on' : ''}`} style={{ '--tone': CLASS_COLOR[k] } as CSSProperties} onClick={() => setCls(cls === k ? null : k)}>
                  <b>{n}</b>
                  <span>{k === 'High' ? 'High risk' : k === 'Limited' ? 'Limited (transparency)' : k}</span>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 12 }}>
            <Callout color={CLASS_COLOR[cls ?? 'High']}>
              <b>{cls ?? 'High'}:</b> {CLASS_NOTE[cls ?? 'High']}
            </Callout>
          </div>
          <div className="list" style={{ marginTop: 8 }}>
            {reg.filter((s) => s.euClass === (cls ?? 'High')).map(effective).map((s) => (
              <button key={s.id} className="list-row" onClick={() => setOpen(s)}>
                <span className="list-main"><b>{s.name}</b><span>{s.basis}</span></span>
                <StatusBadge value={s.approval} map={APPROVAL_COLOR} />
              </button>
            ))}
          </div>
        </Card>

        <Card title="NIST AI RMF maturity" sub="Current vs target, scale 1–5 · assessed by HexaShield">
          <div className="comply-rmf">
            {rmf.map((f) => (
              <div key={f.fn}>
                <small>{f.fn}</small>
                <div><b>{f.current.toFixed(1)}</b> <small>/ {f.target}</small></div>
                <div className="comply-dots">
                  {[1, 2, 3, 4, 5].map((i) => <i key={i} className={`${i <= Math.round(f.current) ? 'on' : ''} ${i <= f.target && i > Math.round(f.current) ? 'tgt' : ''}`} />)}
                </div>
              </div>
            ))}
          </div>
          <Chart
            height={170}
            option={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              legend: { bottom: 0 },
              grid: { left: 8, right: 12, top: 12, bottom: 28, containLabel: true },
              xAxis: { type: 'category', data: rmf.map((f) => f.fn) },
              yAxis: { type: 'value', max: 5 },
              series: [
                { name: 'Current', type: 'bar', data: rmf.map((f) => f.current), itemStyle: { color: '#6db33f' } },
                { name: 'Target', type: 'bar', data: rmf.map((f) => f.target), itemStyle: { color: 'rgba(138,155,192,.35)' } },
              ],
            }}
          />
        </Card>
      </div>

      <div className="grid g3">
        <Card className="" style={{ scrollMarginTop: 80 }} title={<span id="aigov-42001">ISO/IEC 42001 Annex A</span>} sub={`${isoImpl} of ${isoTotal} controls implemented`}>
          <Chart
            height={280}
            option={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              legend: { bottom: 0 },
              grid: { left: 8, right: 12, top: 6, bottom: 28, containLabel: true },
              xAxis: { type: 'value' },
              yAxis: { type: 'category', data: iso.map((g) => `${g.id} ${g.name.length > 22 ? `${g.name.slice(0, 21)}…` : g.name}`).reverse(), axisLabel: { fontSize: 10 } },
              series: [
                { name: 'Implemented', type: 'bar', stack: 'a', data: iso.map((g) => g.implemented).reverse(), itemStyle: { color: '#6db33f', borderRadius: 0 } },
                { name: 'Partial', type: 'bar', stack: 'a', data: iso.map((g) => g.partial).reverse(), itemStyle: { color: '#f5a83d', borderRadius: 0 } },
                { name: 'Missing', type: 'bar', stack: 'a', data: iso.map((g) => g.missing).reverse(), itemStyle: { color: '#3a4566', borderRadius: 0 } },
              ],
            }}
          />
        </Card>

        <Card title="Impact assessments and model cards" sub="Per governed system">
          <div className="list">
            {governed.map(effective).map((s) => (
              <button key={s.id} className="list-row" onClick={() => setOpen(s)}>
                <span className="list-main"><b>{s.name}</b><span>{s.role} · {s.source}</span></span>
                <span className="stack" style={{ alignItems: 'flex-end', gap: 3 }}>
                  <Badge color={IMPACT_COLOR[s.impact]}>AIIA: {s.impact}</Badge>
                  <Badge color={CARD_COLOR[s.modelCard]}>Card: {s.modelCard}</Badge>
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card style={{ scrollMarginTop: 80 }} title={<span id="aigov-ack">AI policy acknowledgement</span>} sub={`Acceptable use of AI policy v2.1 · ${fmtNum(ack.reduce((s, a) => s + a.people, 0))} people`}>
          {ack.map((a) => (
            <div key={a.tenant.id} className="bar-row">
              <div className="bar-label"><b>{a.tenant.short}</b><span>{fmtNum(a.people)} people</span></div>
              <Bar value={a.pct} color={scoreTone(a.pct)} />
              <div className="bar-val">{a.pct}%</div>
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <SectionLabel>AI literacy (Art. 4)</SectionLabel>
            <div className="row" style={{ gap: 10 }}>
              <Bar value={Math.max(30, ackPct - 9)} color="var(--m-ai)" />
              <b className="num">{Math.max(30, ackPct - 9)}%</b>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Training completion · {rangeLabel(timeRange)}: +{Math.round(days * 3.2)} completions</div>
          </div>
          <div className="card-foot"><Sources items={aiFeeds.slice(0, 4).map((k) => ({ name: k.product, status: k.status }))} /></div>
        </Card>
      </div>

      <Card
        title="AI system register"
        count={rows.length}
        sub="Owner, approval, classification and obligations · click a system"
        flush
        actions={
          <div className="chips">
            <Chip on={!cls && !regF} color={tone} onClick={() => { setCls(null); setRegF(null); }}>All</Chip>
            {regF && <Chip on color="var(--sev-high)" onClick={() => setRegF(null)}>{regF === "unsanctioned" ? "Unsanctioned" : regF === "impact" ? "Impact assessment open" : "Model card missing"} ×</Chip>}
            {CLASSES.map((k) => <Chip key={k} on={cls === k} color={CLASS_COLOR[k]} onClick={() => setCls(k)}>{k}</Chip>)}
            <Btn sm onClick={() => nav('/ai-governance/inventory')}><Bot /> HexaAI inventory</Btn>
          </div>
        }
      >
        <DataTable<AiSystemGov>
          rows={rows}
          rowKey={(s) => s.id}
          onRowClick={setOpen}
          search={(s) => `${s.name} ${s.owner} ${s.basis}`}
          initialSort={{ key: 'class', dir: 'desc' }}
          columns={[
            { key: 'name', header: 'System', sort: (s) => s.name, render: (s) => <><div className="t-main">{s.name}</div><div className="t-sub">{s.id} · {s.source} · {s.role}</div></> },
            { key: 'class', header: 'EU AI Act', sort: (s) => 4 - CLASSES.indexOf(s.euClass), render: (s) => <><Badge color={CLASS_COLOR[s.euClass]} solid={s.euClass === 'Prohibited'}>{s.euClass}</Badge><div className="t-sub" style={{ maxWidth: 260, whiteSpace: 'normal' }}>{s.basis}</div></> },
            { key: 'owner', header: 'Owner', sort: (s) => s.owner, render: (s) => <span style={{ color: s.owner === 'Unassigned' ? 'var(--bad)' : undefined }}>{s.owner}</span> },
            { key: 'approval', header: 'Approval', sort: (s) => s.approval, render: (s) => <StatusBadge value={s.approval} map={APPROVAL_COLOR} /> },
            { key: 'impact', header: 'Impact assessment', sort: (s) => s.impact, render: (s) => <StatusBadge value={s.impact} map={IMPACT_COLOR} /> },
            { key: 'iso', header: '42001 controls', sort: (s) => s.iso42001, render: (s) => <div style={{ minWidth: 90 }}><Bar value={s.iso42001} color={scoreTone(s.iso42001 + 10)} size="thin" /><span className="t-sub">{s.iso42001}%</span></div> },
            { key: 'risk', header: 'Risk', sort: (s) => ['low', 'medium', 'high', 'critical'].indexOf(s.risk), render: (s) => <SevBadge sev={s.risk} /> },
            { key: 'users', header: 'Users', align: 'right', sort: (s) => s.users, render: (s) => fmtNum(s.users) },
          ]}
        />
      </Card>
      <Legend items={CLASSES.map((k) => ({ label: `${k}: ${CLASS_NOTE[k]}`, color: CLASS_COLOR[k] }))} />

      {open && (
        <Drawer
          title={open.name}
          sub={`${open.id} · ${open.source} · ${open.role}`}
          onClose={() => setOpen(null)}
          footer={
            open.euClass === 'Prohibited' ? <Btn onClick={() => setOpen(null)}>Close</Btn> : (
              <>
                <Btn onClick={() => nav('/ai-governance/runtime')}><Bot /> Runtime in HexaAI</Btn>
                <Btn primary color={tone} onClick={() => setAssign(open)}><UserCheck /> {open.source === 'Unsanctioned' ? 'Assign owner & request approval' : 'Record approval decision'}</Btn>
              </>
            )
          }
        >
          <KV rows={[
            ['EU AI Act class', <Badge key="c" color={CLASS_COLOR[open.euClass]} solid={open.euClass === 'Prohibited'}>{open.euClass}</Badge>],
            ['Basis', open.basis],
            ['Owner', open.owner],
            ['Approval', <StatusBadge key="a" value={open.approval} map={APPROVAL_COLOR} />],
            ['Impact assessment', open.impact],
            ['Model card', open.modelCard],
            ['Data used', open.dataTypes.join(', ')],
            ['Users', fmtNum(open.users)],
            ['Tenant', c.tenants.find((t) => t.id === open.tenant)?.name ?? '—'],
            ['Last reviewed', `${open.lastReviewDays} days ago`],
          ]} />
          <div>
            <SectionLabel>Obligations</SectionLabel>
            <div className="comply-oblig">
              {open.obligations.map((o, i) => {
                const done = open.euClass !== 'Prohibited' && i < Math.round((open.iso42001 / 100) * open.obligations.length);
                return <div key={o}>{done ? <CheckCircle2 color="var(--good)" /> : <Circle color="var(--text-muted)" />}<span>{o}</span></div>;
              })}
            </div>
          </div>
          {open.euClass === 'Prohibited' && <Callout kind="warn">Rejected at intake under Art. 5(1)(f). HexaAI watches for any deployment of this capability and raises an alert if one appears.</Callout>}
          {open.source === 'Unsanctioned' && <Callout kind="warn">Discovered by HexaAI Governance at runtime; not yet submitted for approval. Usage continues until an owner decides to approve, restrict or block.</Callout>}
        </Drawer>
      )}

      {assign && (
        <WriteBackModal
          title={assign.source === 'Unsanctioned' ? 'Assign owner and request approval' : 'Record approval decision'}
          target="HexaComply AI register"
          risk="low"
          approvals="Approval decision by AI governance board"
          submitLabel="Save to register"
          onClose={() => setAssign(null)}
          onSubmit={() => {
            setDecided((d) => ({ ...d, [assign.id]: assign.source === 'Unsanctioned' ? 'Pending' : 'Approved' }));
            toast(`AI register updated: ${assign.name} → ${assign.source === 'Unsanctioned' ? `owner ${owner}, approval requested` : 'approved'}`);
            setAssign(null);
            setOpen(null);
          }}
          changes={[
            ['System', assign.name],
            ['Owner', owner],
            ['Approval', assign.source === 'Unsanctioned' ? 'Not submitted → Pending' : `${assign.approval} → Approved`],
            ['Class', `${assign.euClass} (${assign.basis})`],
          ]}
        >
          <Field label="Owner">
            <select className="select" value={owner} onChange={(e) => setOwner(e.target.value)}>
              {[c.people.grcLead, c.people.ciso, c.people.admin, ...c.people.staff.slice(0, 5)].map((p) => <option key={p.email} value={p.name}>{p.name} · {p.role}</option>)}
            </select>
          </Field>
        </WriteBackModal>
      )}
    </>
  );
}
