import { useMemo, useState, type CSSProperties } from 'react';
import { Grid3x3, ArrowRight, FlaskConical, Users, Lightbulb, Target, Activity, ScrollText, Siren } from 'lucide-react';
import { Card, Badge, KV, Btn, Tabs, Chip, IcoBox, Callout, Sources, SevBadge, Ring, HealthBadge } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { hexaMatrix, coverage, matrixTactics, actorTechniques, toolShort, type FullCell, type FullCov, type Matrix, type CovLevel } from '../../data/modules/soc';
import { FULL_TACTICS, TACTIC_COLOR, parentId } from '../../data/attackFull';
import { fmtAgo, fmtNum } from '../../lib/format';
import { useSoc, ScopeNote, StatTile, Pills, RecordsDrawer, WriteBackModal, useParamFilter, type WriteBack } from './parts';
import type { CustomerId } from '../../data/types';

const LEVEL_LABEL: Record<FullCov, string> = { full: 'Full coverage', partial: 'Partial', none: 'No coverage' };
const LEVEL_COLOR: Record<FullCov, string> = { full: '#4f8cff', partial: '#f5a83d', none: '#8a9bc0' };
const EXTRA_TAC = ['#38bdf8', '#34d399', '#a78bfa', '#2dd4bf', '#fbbf24', '#f472b6', '#fb923c', '#22d3ee', '#a3e635', '#818cf8', '#e879f9', '#4ade80', '#60a5fa', '#f87171'];

const OVERLAY: Record<CustomerId, { label: string; techs: string[]; note: string }> = {
  maritime: {
    label: 'Maritime overlay',
    techs: ['T1133', 'T1078', 'T1219', 'T1199', 'T1190', 'T1486', 'T1490', 'T1566', 'T1657', 'T1091', 'T0886', 'T0883', 'T0847', 'T0843', 'T0855', 'T0832', 'T0836', 'T0814', 'T0826'],
    note: 'The maritime overlay (ports, terminals and vessels: GNSS/AIS integrity, vendor remote access, removable media on board) is maintained by HexaShield, not by MITRE.',
  },
  finserv: {
    label: 'Financial services overlay',
    techs: ['T1078', 'T1621', 'T1098', 'T1539', 'T1550', 'T1003', 'T1558', 'T1021', 'T1657', 'T1565', 'T1114', 'T1048', 'T1190', 'T1486', 'AML.T0051', 'AML.T0057'],
    note: 'Financial services overlay maintained by HexaShield and aligned to FS-ISAC reporting, SWIFT CSP and DORA TLPT scenarios.',
  },
  media: {
    label: 'Media & entertainment overlay',
    techs: ['T1567', 'T1530', 'T1213', 'T1199', 'T1078', 'T1621', 'T1098', 'T1539', 'T1560', 'T1041', 'T1486', 'T1110', 'T0886', 'T0814', 'AML.T0057'],
    note: 'Media overlay maintained by HexaShield and aligned to MPA CSBP and TPN: pre-release exfiltration, vendor access and screener abuse.',
  },
  healthcare: {
    label: 'Healthcare overlay',
    techs: ['T1078', 'T1098', 'T1621', 'T1566', 'T1133', 'T1190', 'T1219', 'T1213', 'T1530', 'T1486', 'T1490', 'T1489', 'T1657', 'T1114', 'T0883', 'T0886', 'T0843', 'T0836', 'T0866'],
    note: 'Healthcare overlay maintained by HexaShield and aligned to HHS HC3 / Health-ISAC reporting and the HPH CPGs: help-desk reset abuse, Citrix and VPN exploitation, EHR snooping and medical-device reachability.',
  },
  automotive: {
    label: 'Automotive overlay',
    techs: ['T1078', 'T1195', 'T1190', 'T1133', 'T1219', 'T1567', 'T1213', 'T1565', 'T1657', 'T1486', 'T1490', 'T1550', 'T1552', 'T1566', 'T0843', 'T0886', 'T0866', 'T0847', 'T0855', 'AML.T0051'],
    note: 'Automotive overlay maintained by HexaShield and aligned to Auto-ISAC, UNECE R155 Annex 5 threats and IEC 62443: OTA signing, vehicle APIs, plant ransomware and design IP.',
  },
};

const MAP_LEVEL: Record<CovLevel, FullCov> = { validated: 'full', detected: 'full', logged: 'partial', none: 'none' };

type CovFilter = 'all' | FullCov;

export default function SocAttack() {
  const { c, tenantId, h, tools, tone, scopeLabel, tenants, nav } = useSoc();
  const [m, setM] = useState<Matrix>('enterprise');
  const [actor, setActor] = useState<string>('');
  const [overlay, setOverlay] = useState(false);
  const [lvl, setLvl] = useParamFilter<CovFilter>('coverage', ['all', 'full', 'partial', 'none'] as const, 'all');
  const [sel, setSel] = useState<FullCell | null>(null);
  const [panel, setPanel] = useState<'recs' | 'health' | 'rules' | null>(null);
  const [tacSel, setTacSel] = useState<string | null>(null);
  const [wb, setWb] = useState<WriteBack | null>(null);

  const ent = useMemo(() => hexaMatrix(c, tenantId), [c, tenantId]);
  const other = useMemo(() => (m === 'enterprise' ? null : coverage(c, tenantId, m)), [c, tenantId, m]);

  // Normalise ICS / ATLAS to the same card model.
  const cells: FullCell[] = useMemo(() => {
    if (m === 'enterprise' || !other) return ent.cells;
    return other.cells.map((x) => ({
      tech: { id: x.tech.id, name: x.tech.name, tactics: [x.tech.tactic] },
      level: MAP_LEVEL[x.level],
      rules: Array.from({ length: x.rules }, (_, j) => ({ id: `HV-${x.tech.id}-${j + 1}`, name: `${x.sources[0] ?? tools.siemShort} - ${x.tech.name}: ${['behavioural sequence', 'asset baseline deviation', 'known tool signature'][j % 3]} (HexaSOC)`, platform: x.sources[0] ?? tools.siemShort, sev: 'high' as const, hits7d: (j * 7) % 23, enabled: true, validatedDaysAgo: x.validatedDaysAgo })),
      sources: x.sources,
      validatedDaysAgo: x.validatedDaysAgo,
      incidents: 0,
      why: x.level === 'logged' ? 'Telemetry exists but no detection is live' : x.level === 'none' ? 'No source collects this behaviour' : undefined,
    }));
  }, [m, other, ent, tools.siemShort]);

  const tactics = m === 'enterprise' ? FULL_TACTICS.map((t) => t.name) : matrixTactics(m);
  const tacColor = (t: string, i: number) => (m === 'enterprise' ? TACTIC_COLOR[t] : EXTRA_TAC[i % EXTRA_TAC.length]);
  const hasOt = tenants.some((t) => t.env.includes('ot'));
  const ov = OVERLAY[c.id];
  const actorSet = new Set(actor ? actorTechniques(actor).map((x) => (m === 'enterprise' ? parentId(x) : x)) : []);
  const ovSet = new Set(overlay ? ov.techs : []);
  const highlight = actor ? actorSet : ovSet;
  const focus = !!actor || overlay;
  const covered = (x: FullCell) => x.level !== 'none';

  const full = cells.filter((x) => x.level === 'full').length;
  const partial = cells.filter((x) => x.level === 'partial').length;
  const none = cells.length - full - partial;
  const pct = Math.round(((full + partial) / Math.max(1, cells.length)) * 1000) / 10;
  const actorsUsing = (id: string) => c.vocab.threatActors.filter((a) => actorTechniques(a).map(parentId).includes(parentId(id)) || actorTechniques(a).includes(id));

  const gaps = cells
    .filter((x) => x.level !== 'full' && (actor ? actorSet.has(x.tech.id) : actorsUsing(x.tech.id).length > 0 || ov.techs.includes(x.tech.id)))
    .map((x) => ({ cell: x, actors: actorsUsing(x.tech.id), overlay: ov.techs.includes(x.tech.id) }))
    .sort((a, b) => (a.cell.level === 'none' ? 0 : 1) - (b.cell.level === 'none' ? 0 : 1) || b.actors.length - a.actors.length);

  const actorCov = actor ? Math.round((cells.filter((x) => actorSet.has(x.tech.id) && covered(x)).length / Math.max(1, cells.filter((x) => actorSet.has(x.tech.id)).length)) * 100) : null;
  const tacStats = tactics.map((t, i) => {
    const cs = cells.filter((x) => x.tech.tactics.includes(t));
    return { t, color: tacColor(t, i), total: cs.length, full: cs.filter((x) => x.level === 'full').length, partial: cs.filter((x) => x.level === 'partial').length };
  });
  const src = `${tools.siemShort}${tools.edr ? ` · ${tools.edrShort}` : ''} · HexaStrike`;

  return (
    <>
      <p className="page-intro">
        <b>{scopeLabel}</b> · HexaMatrix: MITRE ATT&CK Enterprise (all 14 tactics, {fmtNum(ent.total)} techniques), ATT&CK for ICS and ATLAS, recalculated continuously from live rules in {tools.siemShort}
        {tools.edr ? ` and ${tools.edrShort}` : ''}, telemetry health and HexaStrike validation{tools.ot.length ? `, with ${tools.ot.map((k) => k.product).join(' and ')} for ICS` : ''}.
      </p>

      <div className="soc-stats">
        <StatTile icon={<Lightbulb />} value={ent.recommendations.length} label="Recommendations" tone="#a78bfa" onClick={() => setPanel('recs')} source="HexaMatrix gap analysis · HexaInt actor profiles" />
        <StatTile icon={<Target />} value={`${m === 'enterprise' ? ent.pct : pct}%`} label={`Coverage (${full + partial}/${cells.length} techniques)`} bar={m === 'enterprise' ? ent.pct : pct} tone="#2dd4bf" onClick={() => setLvl(lvl === 'none' ? 'all' : 'none')} source={src} />
        <StatTile icon={<ScrollText />} value={fmtNum(m === 'enterprise' ? ent.rulesTotal : cells.reduce((s, x) => s + x.rules.length, 0))} label="Rules mapped to techniques" tone="#4f8cff" onClick={() => setPanel('rules')} source={`${tools.siemShort} analytic rules${tools.edr ? ` · ${tools.edrShort} custom detections` : ''}`} />
        <StatTile icon={<Activity />} value={`${ent.health}%`} label="System health (feeding connectors)" bar={ent.health} tone={ent.health === 100 ? '#34d399' : '#f5a83d'} onClick={() => setPanel('health')} source="HexaView connector heartbeat" />
      </div>

      <Card
        title={<><Grid3x3 size={15} style={{ verticalAlign: -2 }} /> HexaMatrix</>}
        sub={`${m === 'enterprise' ? 'MITRE ATT&CK Enterprise' : m === 'ics' ? 'ATT&CK for ICS' : 'MITRE ATLAS (AI systems)'} · ${full} full · ${partial} partial · ${none} no coverage`}
        actions={
          <span className="row wrap" style={{ gap: 8 }}>
            <Tabs tabs={[{ id: 'enterprise' as Matrix, label: 'Enterprise' }, { id: 'ics' as Matrix, label: 'ICS' }, { id: 'atlas' as Matrix, label: 'ATLAS' }]} value={m} onChange={setM} color={tone} />
            <select className="select" value={actor} onChange={(e) => { setActor(e.target.value); if (e.target.value) setOverlay(false); }} aria-label="Threat actor overlay">
              <option value="">Threat actor overlay: none</option>
              {c.vocab.threatActors.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <Chip on={overlay} onClick={() => { setOverlay(!overlay); setActor(''); }} color={tone}>{ov.label}</Chip>
          </span>
        }
      >
        <div className="row wrap between" style={{ marginBottom: 12, gap: 10 }}>
          <Pills
            value={lvl}
            onChange={(v) => setLvl(v === lvl ? 'all' : v)}
            tone="#4f8cff"
            items={[
              { id: 'all', label: 'All', n: cells.length },
              { id: 'full', label: 'Full coverage', n: full, dot: <span className="soc-legend-dot full" /> },
              { id: 'partial', label: 'Partial', n: partial, dashed: true, dot: <span className="soc-legend-dot partial" /> },
              { id: 'none', label: 'No coverage', n: none, dot: <span className="soc-legend-dot none" /> },
            ]}
          />
          <span className="muted" style={{ fontSize: 11.5 }}>
            {actor ? `${actor}: ${actorCov}% of its techniques covered · purple outline covered, red outline gap` : overlay ? `${ov.label} highlighted` : 'Click a coverage level to highlight it, or a technique for the rules behind it'}
          </span>
        </div>
        {m === 'ics' && !hasOt && (
          <div style={{ marginBottom: 12 }}>
            <Callout kind="warn">
              <b>Out of scope for {tenantId === 'all' ? `${c.short}'s tenants` : tenants[0]?.short}:</b> no OT tenant is in this scope. ICS coverage is shown for reference only.
            </Callout>
          </div>
        )}
        {m === 'ics' && hasOt && <div style={{ marginBottom: 10 }}><ScopeNote text={`ICS scope: ${tenants.filter((t) => t.env.includes('ot')).map((t) => t.short).join(', ')} · passive monitoring only, OT is read-only by policy`} /></div>}
        {m === 'atlas' && <div style={{ marginBottom: 10 }}><ScopeNote text={`ATLAS scope: ${c.vocab.aiSystems.length} AI systems governed by HexaAI (${c.vocab.aiSystems.slice(0, 3).join(', ')}…)`} /></div>}
        {overlay && <div style={{ marginBottom: 10 }}><Callout>{ov.note}</Callout></div>}

        <div className="soc-hm-scroll">
          <div className="soc-hm">
            {tacStats.map((ts) => {
              const cs = cells.filter((x) => x.tech.tactics.includes(ts.t)).sort((a, b) => a.tech.name.localeCompare(b.tech.name));
              const cov = ts.full + ts.partial;
              return (
                <section key={ts.t} className="soc-hm-col" style={{ '--tac': ts.color } as CSSProperties}>
                  <button type="button" className="soc-hm-head" onClick={() => setTacSel(ts.t)} title={`Open ${ts.t}`}>
                    <h4>{ts.t}</h4>
                    <span><b>{cov}/{ts.total}</b> covered · {ts.full} full</span>
                    <span className="soc-hm-bar"><i style={{ width: `${(cov / Math.max(1, ts.total)) * 100}%` }} /></span>
                  </button>
                  {cs.map((x) => {
                    const hi = highlight.has(x.tech.id);
                    const dimByLvl = lvl !== 'all' && x.level !== lvl;
                    const dim = dimByLvl || (focus && !hi);
                    return (
                      <button key={x.tech.id} type="button" className={`soc-hm-card ${x.level} ${dim ? 'dim' : ''} ${focus && hi ? (covered(x) ? 'actor' : 'gap') : ''}`} onClick={() => setSel(x)} title={`${x.tech.id} ${x.tech.name}: ${LEVEL_LABEL[x.level]}`}>
                        <span className="id"><span className="soc-hm-dot" />{x.tech.id}</span>
                        <span className="nm">{x.tech.name}</span>
                        {x.rules.length > 0 && <span className="meta">{x.rules.length} rule{x.rules.length === 1 ? '' : 's'}{x.incidents ? ` · ${x.incidents} incident${x.incidents === 1 ? '' : 's'}` : ''}</span>}
                      </button>
                    );
                  })}
                </section>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="grid g-3-2">
        <Card title="Coverage by tactic" sub="Full and partial technique coverage per tactic · click a row">
          <div className="stack" style={{ gap: 4 }}>
            {tacStats.map((ts) => (
              <button key={ts.t} type="button" className="soc-funnel-row" onClick={() => setTacSel(ts.t)} style={{ gridTemplateColumns: '160px minmax(0,1fr) 70px' }}>
                <span className="l"><b style={{ fontSize: 12 }}>{ts.t}</b></span>
                <span className="bar" style={{ height: 12, display: 'flex' }}>
                  <i style={{ width: `${(ts.full / Math.max(1, ts.total)) * 100}%`, background: ts.color, borderRadius: 0 }} />
                  <i style={{ width: `${(ts.partial / Math.max(1, ts.total)) * 100}%`, background: ts.color, opacity: 0.4, borderRadius: 0 }} />
                </span>
                <span className="v" style={{ fontSize: 12 }}>{ts.full + ts.partial}/{ts.total}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Priority gaps" count={gaps.length} sub={actor ? `${actor} techniques without full coverage` : `Used by your threat actors or in the ${ov.label.toLowerCase()}, not fully covered`} flush>
          <div className="list" style={{ padding: '0 18px 8px', maxHeight: 420, overflowY: 'auto' }}>
            {gaps.slice(0, 16).map((g) => (
              <div key={g.cell.tech.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => setSel(g.cell)}>
                <span className="soc-tech">{g.cell.tech.id}</span>
                <span className="list-main">
                  <b>{g.cell.tech.name}</b>
                  <span>{LEVEL_LABEL[g.cell.level]} · {g.actors.length ? g.actors.slice(0, 2).join(', ') + (g.actors.length > 2 ? ` +${g.actors.length - 2}` : '') : ov.label}</span>
                </span>
                <ArrowRight size={13} className="muted" />
              </div>
            ))}
            {gaps.length === 0 && <div className="empty">No priority gaps in this matrix for the selected overlay.</div>}
          </div>
        </Card>
      </div>

      {sel && (() => {
        const covPct = sel.level === 'full' ? 100 : sel.level === 'partial' ? 50 : 0;
        const users = actorsUsing(sel.tech.id);
        return (
          <Drawer
            title={`${sel.tech.id} · ${sel.tech.name}`}
            sub={`${sel.tech.tactics.join(' · ')} · ${m === 'enterprise' ? 'ATT&CK Enterprise' : m === 'ics' ? 'ATT&CK for ICS' : 'ATLAS'}`}
            icon={<IcoBox color={tone}><Grid3x3 /></IcoBox>}
            onClose={() => setSel(null)}
            footer={
              <>
                <Btn onClick={() => nav('/strike/purple')}><FlaskConical size={14} /> Validate with HexaStrike</Btn>
                {sel.level !== 'full' && m !== 'ics' ? (
                  <Btn primary onClick={() => setWb({ title: `Deploy detection for ${sel.tech.id}`, system: tools.siemShort, target: `${sel.tech.name} (${sel.tech.id})`, changes: [`Create scheduled rule "HexaSOC - ${sel.tech.name}" in ${tools.siemShort}`, 'Run replay test against 30 days of telemetry', 'Enable in staged mode for 7 days, then promote'], risk: 'medium', done: `Rule for ${sel.tech.id} queued for ${tools.siemShort}`, rollback: 'Disable the rule; no data is changed' })}>Close the gap <ArrowRight size={14} /></Btn>
                ) : (
                  <Btn onClick={() => nav('/soc/detection')}>Open in Detection Engineering <ArrowRight size={14} /></Btn>
                )}
              </>
            }
          >
            <div className="stack" style={{ gap: 16 }}>
              <div className="row" style={{ gap: 16, padding: 14, border: '1px solid var(--card-border)', borderRadius: 12 }}>
                <Ring value={covPct} size={78} stroke={7} color={LEVEL_COLOR[sel.level]} label={`${covPct}%`} />
                <div className="stack" style={{ gap: 4 }}>
                  <Badge color={LEVEL_COLOR[sel.level]} solid={sel.level === 'full'}>{LEVEL_LABEL[sel.level]}</Badge>
                  <span style={{ fontSize: 12.5 }}>{sel.rules.length ? `${sel.rules.length} rule${sel.rules.length === 1 ? '' : 's'} name this technique.` : 'No rule names this technique.'}</span>
                  {sel.why && <span className="muted" style={{ fontSize: 12 }}>{sel.why}</span>}
                </div>
              </div>
              <div>
                <div className="section-label">Related rules · {sel.rules.length}</div>
                {sel.rules.map((x) => (
                  <div key={x.id} className="soc-rule">
                    <i style={{ background: x.enabled ? 'var(--good)' : 'var(--text-muted)' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontWeight: 600 }}>{x.name}</b>
                      <span className="muted" style={{ display: 'block', fontSize: 11 }}>
                        {x.enabled ? 'Enabled' : 'Disabled for tuning'} · {x.hits7d} hits in 7 d{x.validatedDaysAgo !== undefined ? ` · validated ${x.validatedDaysAgo} d ago` : ''}
                      </span>
                    </span>
                    <SevBadge sev={x.sev} />
                  </div>
                ))}
                {sel.rules.length === 0 && <div className="empty">No detection content yet.</div>}
                <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>Rules and mappings read from {tools.siemShort}{tools.edr ? ` and ${tools.edrShort}` : ''}</div>
              </div>
              <KV rows={[
                ['Telemetry', sel.sources.length ? <Sources key="s" items={sel.sources.map((n) => ({ name: n, status: c.connectors.find((k) => toolShort(k) === n)?.status ?? 'healthy' }))} /> : 'No source collects this behaviour'],
                ['Last validation', sel.validatedDaysAgo !== undefined ? `${sel.validatedDaysAgo} days ago (HexaStrike)` : 'Never validated'],
                ['In sector overlay', ov.techs.includes(sel.tech.id) ? `Yes · ${ov.label}` : 'No'],
                ['Incidents (90 d)', sel.incidents ? <button key="i" className="link" onClick={() => nav('/soc/ir?status=all')}>{sel.incidents} incident{sel.incidents === 1 ? '' : 's'} <ArrowRight size={11} style={{ verticalAlign: -1 }} /></button> : 'None'],
              ]} />
              <div>
                <div className="section-label"><Users size={11} style={{ verticalAlign: -1 }} /> Your threat actors using it</div>
                {users.length ? (
                  <span className="chips">{users.map((a) => <Chip key={a} on={a === actor} onClick={() => { setActor(a); setOverlay(false); setSel(null); }} color="var(--m-int)">{a}</Chip>)}</span>
                ) : (
                  <span className="muted" style={{ fontSize: 12 }}>None of {c.short}'s tracked actors are known to use it.</span>
                )}
              </div>
            </div>
          </Drawer>
        );
      })()}

      {tacSel && (() => {
        const cs = cells.filter((x) => x.tech.tactics.includes(tacSel)).sort((a, b) => ['none', 'partial', 'full'].indexOf(a.level) - ['none', 'partial', 'full'].indexOf(b.level));
        return (
          <RecordsDrawer
            title={tacSel}
            sub={`${cs.filter(covered).length} of ${cs.length} techniques covered`}
            source={src}
            icon={<Grid3x3 />}
            onClose={() => setTacSel(null)}
            rows={cs.map((x) => ({ id: x.tech.id, title: `${x.tech.id} · ${x.tech.name}`, sub: `${x.rules.length} rules${x.why ? ` · ${x.why}` : ''}`, right: <Badge color={LEVEL_COLOR[x.level]}>{LEVEL_LABEL[x.level]}</Badge>, onClick: () => { setTacSel(null); setSel(x); } }))}
          />
        );
      })()}

      {panel === 'recs' && (
        <RecordsDrawer
          title="HexaMatrix recommendations"
          sub="Techniques your threat actors use that are not fully covered, ranked by how many actors use them"
          source="HexaMatrix gap analysis · HexaInt actor profiles"
          icon={<Lightbulb />}
          onClose={() => setPanel(null)}
          rows={ent.recommendations.map((x) => ({ id: x.cell.tech.id, title: `${x.cell.level === 'none' ? 'Write a detection' : 'Complete coverage'} for ${x.cell.tech.id} ${x.cell.tech.name}`, sub: `${x.actors.length ? `Used by ${x.actors.join(', ')}` : 'Sector overlay'} · ${x.cell.why ?? ''}`, right: <Badge color={LEVEL_COLOR[x.cell.level]}>{LEVEL_LABEL[x.cell.level]}</Badge>, onClick: () => { setPanel(null); setM('enterprise'); setSel(x.cell); } }))}
        />
      )}
      {panel === 'health' && (
        <RecordsDrawer
          title="System health"
          sub="Connectors whose telemetry and rules feed HexaMatrix"
          source="HexaView connector heartbeat"
          icon={<Activity />}
          onClose={() => setPanel(null)}
          rows={ent.feeding.map((k) => ({ id: k.id, title: `${k.vendor} ${k.product}`, sub: `${k.category} · last sync ${fmtAgo(k.lastSyncMin)} · ${fmtNum(k.records)} records`, right: <HealthBadge status={k.status} />, onClick: () => nav('/fabric/integrations') }))}
        />
      )}
      {panel === 'rules' && (
        <RecordsDrawer
          title="Rules mapped to techniques"
          sub={`${fmtNum(cells.reduce((s, x) => s + x.rules.length, 0))} rules across ${cells.filter(covered).length} techniques · top 60 by hits`}
          source={`${tools.siemShort}${tools.edr ? ` · ${tools.edrShort}` : ''}`}
          icon={<Siren />}
          onClose={() => setPanel(null)}
          footer={<Btn onClick={() => nav('/soc/detection')}>Open Detection Engineering <ArrowRight size={14} /></Btn>}
          rows={cells.flatMap((x) => x.rules.map((r) => ({ r, x }))).sort((a, b) => b.r.hits7d - a.r.hits7d).slice(0, 60).map(({ r, x }) => ({ id: r.id, title: r.name, sub: `${x.tech.id} ${x.tech.name} · ${r.hits7d} hits 7 d`, right: <SevBadge sev={r.sev} />, onClick: () => { setPanel(null); setSel(x); } }))}
        />
      )}
      {wb && <WriteBackModal wb={wb} onClose={() => setWb(null)} />}
      <div className="muted" style={{ fontSize: 11 }}>Coverage {h.soc.attackCoveragePct}% matches the Command Centre headline (full + partial over all Enterprise techniques).</div>
    </>
  );
}
