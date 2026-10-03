import { useMemo, useState, type CSSProperties } from 'react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip } from '../../components/ui';
import { FlowMap, type FlowLink } from '../../components/FlowMap';
import { toolProfiles, ENTITIES, ENTITY_HEX, ENTITY_LABEL, MODULE_LABEL, type Entity, type ToolProfile } from '../../data/modules/tooling';
import { ENV_HEX } from '../../data/modules/fabric';
import { fmtNum } from '../../lib/format';
import { ToolDrawer, ToolMark, TONE, toneStyle } from './parts';

export default function ToolingLineage() {
  const { customer: c, tenantId } = useApp();
  const tools = useMemo(() => toolProfiles(c, tenantId), [c, tenantId]);
  const [open, setOpen] = useState<ToolProfile | null>(null);
  const [entity, setEntity] = useState<Entity | null>(null);

  // Category → canonical entity → module, weighted by tool event rate.
  const cats = [...new Set(tools.map((t) => t.k.category))];
  const used = ENTITIES.filter((e) => tools.some((t) => t.entities.includes(e)));
  const modules = [...new Set(tools.flatMap((t) => t.modules))];
  const links: FlowLink[] = [];
  const add = (from: string, to: string, v: number, color?: string) => {
    const ex = links.find((l) => l.from === from && l.to === to);
    if (ex) ex.value += v;
    else links.push({ from, to, value: v, color });
  };
  for (const t of tools) {
    const w = Math.max(1, Math.sqrt(t.eventsPerMin));
    for (const e of t.entities) add(`c-${t.k.category}`, `e-${e}`, w, ENTITY_HEX[e]);
    for (const e of t.entities) for (const m of t.modules) add(`e-${e}`, `m-${m}`, w / t.modules.length, ENTITY_HEX[e]);
  }
  const shownLinks = entity ? links.filter((l) => l.from === `e-${entity}` || l.to === `e-${entity}`) : links;

  const sourcesOf = (e: Entity) => tools.filter((t) => t.entities.includes(e));

  return (
    <div className="stack" style={{ gap: 16, ...toneStyle }}>
      <p className="page-intro">
        <b>{c.name}</b> · data lineage from tool to decision. Every tool maps into one canonical model, so a new connector inherits every view for free. Where several tools see the same thing (an asset in the EDR, the scanner and the CMDB), HexaCore resolves them into one entity.
      </p>

      <KpiStrip
        toneColor={TONE}
        items={[
          { label: 'Tool categories', value: cats.length, to: '/tooling/overview', source: 'Connector registry' },
          { label: 'Canonical entities fed', value: used.length, unit: `of ${ENTITIES.length}`, onClick: () => setEntity(null), source: 'HexaCore model (OCSF 1.x)' },
          { label: 'Modules fed', value: modules.length, to: '/', source: 'HexaView view definitions' },
          { label: 'Asset sources', value: sourcesOf('asset').length, onClick: () => setEntity('asset'), source: 'Entity resolution' },
          { label: 'Identity sources', value: sourcesOf('identity').length, onClick: () => setEntity('identity'), source: 'Entity resolution' },
        ]}
      />

      <Card title="From tool to module" sub={entity ? `Showing ${ENTITY_LABEL[entity].toLowerCase()} only · click it again to clear` : 'Tool category → canonical entity → HexaView module · click an entity to isolate it'}>
        <FlowMap
          height={Math.max(420, used.length * 46)}
          columns={[
            { label: 'Tool category', nodes: cats.filter((k) => !entity || shownLinks.some((l) => l.from === `c-${k}`)).map((k) => ({ id: `c-${k}`, title: k, count: tools.filter((t) => t.k.category === k).length, sub: 'tools', color: TONE })) },
            { label: 'Canonical entity', nodes: used.filter((e) => !entity || e === entity).map((e) => ({ id: `e-${e}`, title: ENTITY_LABEL[e], count: sourcesOf(e).length, sub: 'sources', color: ENTITY_HEX[e], onClick: () => setEntity(entity === e ? null : e) })) },
            { label: 'HexaView module', nodes: modules.filter((m) => !entity || shownLinks.some((l) => l.to === `m-${m}`)).map((m) => ({ id: `m-${m}`, title: MODULE_LABEL[m], color: '#8b5cf6' })) },
          ]}
          links={shownLinks}
        />
      </Card>

      <div className="grid g3">
        {used.map((e) => (
          <Card key={e} title={<><span className="tl-dot" style={{ background: ENTITY_HEX[e] }} /> {ENTITY_LABEL[e]}</>} sub={`${sourcesOf(e).length} contributing tools`} onClick={() => setEntity(e)} style={{ '--tone': ENTITY_HEX[e] } as CSSProperties}>
            <div className="list">
              {sourcesOf(e).slice(0, 6).map((t) => (
                <button key={t.k.id} className="list-row" onClick={(ev) => { ev.stopPropagation(); setOpen(t); }}>
                  <ToolMark t={t} size={24} />
                  <span className="list-main"><b>{t.short}</b><span>{t.k.category}</span></span>
                  <span className="mono" style={{ color: ENV_HEX[t.k.env] }}>{fmtNum(t.eventsPerMin)}/min</span>
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {open && <ToolDrawer t={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
