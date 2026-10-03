import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, PenLine } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Drawer } from '../../components/Overlay';
import { Badge, HealthBadge, KV, SectionLabel, Btn, Freshness } from '../../components/ui';
import { CSF_HEX, ENTITY_HEX, ENTITY_LABEL, MODULE_LABEL, type ToolProfile } from '../../data/modules/tooling';
import { ENV_HEX, ENV_LABEL, connectorHealth, manifestYaml } from '../../data/modules/fabric';
import { isStale } from '../../data/customers';
import { fmtAgo, fmtCompact, fmtNum } from '../../lib/format';
import './tooling.css';

export const TONE = 'var(--m-tooling)';
export const toneStyle = { '--tone': TONE } as CSSProperties;

/** Square monogram tile in the tool's environment colour. */
export function ToolMark({ t, size = 34 }: { t: ToolProfile; size?: number }) {
  const c = ENV_HEX[t.k.env];
  return (
    <span className="tl-mark" style={{ width: size, height: size, fontSize: size * 0.36, color: c, background: `${c}1f`, borderColor: `${c}55` }}>
      {t.monogram}
    </span>
  );
}

/** Tiny inline sparkline (crisp SVG). */
export function Spark({ data, color = '#38bdf8', w = 120, h = 28 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * w},${h - 2 - (v / max) * (h - 4)}`).join(' ');
  return (
    <svg width={w} height={h} className="tl-spark" aria-hidden>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity={0.12} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/** Full profile of one tool: what it does and exactly how it is integrated. */
export function ToolDrawer({ t, onClose }: { t: ToolProfile; onClose: () => void }) {
  const { customer: c, toast } = useApp();
  const nav = useNavigate();
  const h = connectorHealth(c, t.k);
  const dp = c.dataPlanes.find((d) => d.id === t.k.dataPlaneId);
  const tenants = t.k.tenants === 'all' ? 'All tenants' : t.k.tenants.map((id) => c.tenants.find((x) => x.id === id)?.short ?? id).join(', ');
  return (
    <Drawer
      wide
      title={t.name}
      sub={`${t.k.category} · ${ENV_LABEL[t.k.env]} · ${tenants}`}
      icon={<ToolMark t={t} size={40} />}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={() => toast(`Sync requested for ${t.short}`)}>Sync now</Btn>
          <Btn onClick={() => nav(`/fabric/integrations?connector=${t.k.id}`)}>Connector health</Btn>
          <Btn primary color={TONE} onClick={() => nav(`/tooling/topology?tool=${t.k.id}`)}>
            Show in topology <ArrowRight size={13} />
          </Btn>
        </>
      }
    >
      <div className="tl-drawer-role">{t.role}.</div>
      <div className="row wrap" style={{ gap: 6 }}>
        <HealthBadge status={t.health} />
        {t.csf.map((f) => (
          <Badge key={f} color={CSF_HEX[f]}>{f}</Badge>
        ))}
        {t.readOnly ? <Badge color="var(--text-muted)"><Lock size={10} /> Read-only</Badge> : <Badge color="var(--sev-medium)"><PenLine size={10} /> Read + gated write</Badge>}
        <Freshness minutes={t.k.lastSyncMin} stale={isStale(t.k)} label={t.short} />
      </div>

      <div>
        <SectionLabel>What it is doing (last 24 h)</SectionLabel>
        <div className="row" style={{ gap: 18, alignItems: 'flex-end' }}>
          <Spark data={t.hourly} w={300} h={56} color={ENV_HEX[t.k.env]} />
          <div className="mini-stats" style={{ flex: 1 }}>
            <div className="mini-stat"><b>{fmtNum(t.eventsPerMin)}</b><span>events / min</span></div>
            <div className="mini-stat"><b>{fmtCompact(t.hourly.reduce((a, b) => a + b, 0))}</b><span>events today</span></div>
            <div className="mini-stat"><b>{fmtCompact(t.k.records)}</b><span>records held</span></div>
          </div>
        </div>
      </div>

      <div>
        <SectionLabel>How it is integrated</SectionLabel>
        <div className="tl-chain">
          {[
            [t.short, t.k.category],
            [dp?.name ?? 'Data plane', dp?.placement ?? ''],
            ['hv-gateway', 'mTLS · outbound 443'],
            ['HexaCore', 'canonical model (OCSF)'],
            [t.modules.map((m) => MODULE_LABEL[m]).join(' · '), 'HexaView modules'],
          ].map(([a, b], i) => (
            <div key={i} className="tl-chain-step">
              <b>{a}</b>
              <span>{b}</span>
            </div>
          ))}
        </div>
        <KV
          rows={[
            ['Method', t.method],
            ['Authentication', `${t.auth} · ${h.authType}`],
            ['Credential store', `${dp?.vault ?? 'Customer vault'} (${h.secretRef})`],
            ['Sync', `every ${t.k.intervalMin} min · last ${fmtAgo(t.k.lastSyncMin)} · ${h.syncs24h} syncs in 24 h`],
            ['Reads', t.k.read.join(', ')],
            ['Writes (gated)', t.k.write.length ? t.k.write.join(', ') : t.k.env === 'ot' ? 'None: OT is read-only by policy' : 'None'],
            ['OCSF classes', t.ocsf.join(', ')],
            ['Connector', `${h.manifestVersion} · runtime ${h.runtimeVersion}`],
            ['Schema drift', `${h.drift.unknown} unknown · ${h.drift.missing} missing · ${h.drift.typeMismatch} type`],
          ]}
        />
      </div>

      <div>
        <SectionLabel>Feeds these canonical entities and modules</SectionLabel>
        <div className="chips">
          {t.entities.map((e) => (
            <span key={e} className="chip" style={{ color: ENTITY_HEX[e], background: `${ENTITY_HEX[e]}1c` }}>{ENTITY_LABEL[e]}</span>
          ))}
          <span className="muted" style={{ margin: '0 4px' }}>→</span>
          {t.modules.map((m) => (
            <span key={m} className="chip">{MODULE_LABEL[m]}</span>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Connector manifest (excerpt)</SectionLabel>
        <pre className="tl-code">{manifestYaml(c, t.k).split('\n').slice(0, 18).join('\n')}</pre>
      </div>
    </Drawer>
  );
}
