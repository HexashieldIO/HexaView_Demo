import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Chip, Badge, HealthBadge } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { toolProfiles, ENTITIES, ENTITY_HEX, ENTITY_LABEL, MODULE_LABEL, type ToolProfile } from '../../data/modules/tooling';
import { ENV_HEX, ENV_LABEL, connectorHealth } from '../../data/modules/fabric';
import { fmtAgo } from '../../lib/format';
import { ToolDrawer, ToolMark, TONE, toneStyle } from './parts';

export default function ToolingMatrix() {
  const { customer: c, tenantId } = useApp();
  const [params, setParams] = useSearchParams();
  const tools = useMemo(() => toolProfiles(c, tenantId), [c, tenantId]);
  const [open, setOpen] = useState<ToolProfile | null>(null);
  const write = params.get('write');
  const setWrite = (v: string | null) => {
    if (v) params.set('write', v);
    else params.delete('write');
    setParams(params, { replace: true });
  };
  const rows = tools.filter((t) => !write || (write === 'yes' ? !t.readOnly : t.readOnly));
  const modules = [...new Set(tools.flatMap((t) => t.modules))];
  const methods = [...new Set(tools.map((t) => t.method))];

  return (
    <div className="stack" style={{ gap: 16, ...toneStyle }}>
      <p className="page-intro">
        <b>{c.name}</b> · exactly how each tool is connected: integration method, authentication, where its credentials live, how often it syncs, what HexaView may read and what it may (with approval) write back, and which canonical entities and modules it feeds.
      </p>

      <KpiStrip
        toneColor={TONE}
        items={[
          { label: 'Integrations', value: tools.length, onClick: () => setWrite(null), source: 'Connector registry' },
          { label: 'Read + gated write', value: tools.filter((t) => !t.readOnly).length, onClick: () => setWrite('yes'), source: 'Connector manifests' },
          { label: 'Read-only', value: tools.filter((t) => t.readOnly).length, onClick: () => setWrite('no'), source: 'Connector manifests' },
          { label: 'Integration methods', value: methods.length, onClick: () => setWrite(null), source: 'Connector SDK' },
          { label: 'Credential stores', value: new Set(c.dataPlanes.map((d) => d.vault)).size, to: '/fabric/dataplanes', source: 'Data plane vaults (BYOK where enabled)' },
        ]}
      />

      <Card
        title="How each tool is integrated"
        count={rows.length}
        flush
        actions={
          <div className="row" style={{ gap: 6 }}>
            <Chip on={!write} onClick={() => setWrite(null)} color={TONE}>All</Chip>
            <Chip on={write === 'yes'} onClick={() => setWrite('yes')} color="#f97316">Read + write</Chip>
            <Chip on={write === 'no'} onClick={() => setWrite('no')}>Read-only</Chip>
          </div>
        }
      >
        <DataTable
          rows={rows}
          rowKey={(t) => t.k.id}
          onRowClick={setOpen}
          search={(t) => `${t.name} ${t.method} ${t.auth} ${t.k.category}`}
          searchPlaceholder="Filter tools, methods, auth…"
          columns={[
            { key: 'tool', header: 'Tool', sort: (t) => t.name, render: (t) => (<div className="row" style={{ gap: 8 }}><ToolMark t={t} size={26} /><div><div className="t-main">{t.short}</div><div className="t-sub">{t.k.category} · {ENV_LABEL[t.k.env]}</div></div></div>) },
            { key: 'method', header: 'Method', sort: (t) => t.method, render: (t) => <span className="t-sub" style={{ color: 'var(--text-secondary)' }}>{t.method}</span> },
            { key: 'auth', header: 'Auth', render: (t) => <span className="t-sub">{connectorHealth(c, t.k).authType}</span> },
            { key: 'dp', header: 'Data plane · vault', render: (t) => { const d = c.dataPlanes.find((x) => x.id === t.k.dataPlaneId); return (<><div className="t-main" style={{ fontWeight: 500 }}>{d?.name}</div><div className="t-sub">{d?.vault}</div></>); } },
            { key: 'sync', header: 'Sync', sort: (t) => t.k.intervalMin, render: (t) => (<><div>every {t.k.intervalMin} min</div><div className="t-sub">last {fmtAgo(t.k.lastSyncMin)}</div></>) },
            { key: 'read', header: 'Reads', render: (t) => <span className="t-sub">{t.k.read.slice(0, 3).join(', ')}{t.k.read.length > 3 ? '…' : ''}</span> },
            { key: 'write', header: 'Writes (gated)', render: (t) => (t.k.write.length && !t.readOnly ? <Badge color="#f97316">{t.k.write[0]}{t.k.write.length > 1 ? ` +${t.k.write.length - 1}` : ''}</Badge> : <span className="muted">{t.k.env === 'ot' ? 'None (OT policy)' : 'None'}</span>) },
            { key: 'ver', header: 'Version', render: (t) => <span className="mono">{t.k.version}</span> },
            { key: 'health', header: 'Health', sort: (t) => t.health, render: (t) => <HealthBadge status={t.health} /> },
          ]}
        />
      </Card>

      <Card title="What each tool contributes" sub="Canonical entities it produces and the modules that use them · click a row for the tool">
        <div className="tbl-wrap">
          <table className="tbl tl-mx">
            <thead>
              <tr>
                <th>Tool</th>
                {ENTITIES.map((e) => <th key={e} className="rot" style={{ color: ENTITY_HEX[e] }}>{ENTITY_LABEL[e]}</th>)}
                <th style={{ width: 16 }} />
                {modules.map((m) => <th key={m} className="rot">{MODULE_LABEL[m]}</th>)}
              </tr>
            </thead>
            <tbody>
              {tools.map((t) => (
                <tr key={t.k.id} className="clickable" onClick={() => setOpen(t)}>
                  <td><div className="row" style={{ gap: 8 }}><span className="tl-dot" style={{ background: ENV_HEX[t.k.env] }} /><span className="t-main">{t.short}</span></div></td>
                  {ENTITIES.map((e) => (
                    <td key={e} className="c">{t.entities.includes(e) ? <span className="tl-dot" style={{ background: ENTITY_HEX[e] }} /> : <span className="muted" style={{ opacity: 0.3 }}>·</span>}</td>
                  ))}
                  <td />
                  {modules.map((m) => (
                    <td key={m} className="c">{t.modules.includes(m) ? <span className="tl-dot" style={{ background: '#8b5cf6' }} /> : <span className="muted" style={{ opacity: 0.3 }}>·</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {open && <ToolDrawer t={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
