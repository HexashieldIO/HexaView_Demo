import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../../../components/ui';
import { DataTable } from '../../../components/DataTable';
import { TP_LOG_COLOR, TP_LOG_TYPES, type TpLogEntry, type TpLogType } from '../../../data/modules/tprm';
import { ago, fmtNum, isoDate, fmtTime } from '../../../lib/format';
import { useTprm } from './state';
import { FacetSelect, Mono, Pill } from './ui';

export function ChangeLog() {
  const { log, byId, openSupplier, grc } = useTprm();
  const [sp, setSp] = useSearchParams();
  const typeF = (sp.get('type') as TpLogType | null) ?? 'all';
  const supF = sp.get('supplier') ?? 'all';
  const setParam = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v === null || v === 'all') n.delete(k); else n.set(k, v); setSp(n, { replace: true }); };
  const bySup = log.filter((e) => supF === 'all' || e.supplierId === supF);
  const shown = bySup.filter((e) => typeF === 'all' || e.type === typeF);
  const supOpts = useMemo(() => [...new Map(log.map((e) => [e.supplierId, e.supplierName])).entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, label]) => ({ id, label })), [log]);
  const yours = log.filter((e) => e.minutesAgo === 0).length;

  return (
    <div className="tp-stack">
      <p className="tp-intro">Every change to a supplier record, newest first, with the person who made it. Written by {grc} and by actions taken on this page{yours ? <> · <b>{yours}</b> from this session</> : ''}.</p>
      <div className="tp-counters">
        <button type="button" className={`tp-counter ${typeF === 'all' ? 'on' : ''}`} style={{ ['--tc' as string]: 'var(--m-comply)' }} onClick={() => setParam('type', null)} title={`Source: ${grc} audit trail`}>
          <span><i />All</span><b>{fmtNum(bySup.length)}</b>
        </button>
        {TP_LOG_TYPES.map((t) => (
          <button key={t} type="button" className={`tp-counter ${typeF === t ? 'on' : ''}`} style={{ ['--tc' as string]: TP_LOG_COLOR[t] }} onClick={() => setParam('type', typeF === t ? null : t)} title={`Source: ${grc} audit trail · click to filter`}>
            <span><i />{t}</span><b>{bySup.filter((e) => e.type === t).length}</b>
          </button>
        ))}
      </div>
      <Card flush>
        <div className="tp-facets">
          <FacetSelect label="Supplier" value={supF} all="All suppliers" options={supOpts} onChange={(v) => setParam('supplier', v)} />
          <span className="tp-foot-note">{fmtNum(shown.length)} of {fmtNum(log.length)} entries · hash-chained in the audit ledger</span>
        </div>
        <div style={{ paddingTop: 10 }}>
          <DataTable<TpLogEntry>
            rows={shown}
            rowKey={(e) => e.id}
            onRowClick={(e) => byId.has(e.supplierId) && openSupplier(e.supplierId)}
            search={(e) => `${e.supplierName} ${e.event} ${e.by} ${e.type}`}
            searchPlaceholder="Search events, suppliers, people…"
            initialSort={{ key: 'when', dir: 'asc' }}
            pageSize={20}
            columns={[
              { key: 'when', header: 'When', sort: (e) => e.minutesAgo, render: (e) => { const d = ago(e.minutesAgo); return <span className={`tp-when ${e.minutesAgo === 0 ? 'tp-new' : ''}`}><b>{isoDate(d)}</b><span>{e.minutesAgo === 0 ? 'just now' : fmtTime(d)}</span></span>; } },
              { key: 'sup', header: 'Supplier', sort: (e) => e.supplierName, render: (e) => { const s = byId.get(e.supplierId); return <span className="tp-sup">{s && <Mono s={s} size="sm" />}<span className="tp-sup-name">{e.supplierName}</span></span>; } },
              { key: 'event', header: 'Event', render: (e) => <span style={{ fontSize: 12.5 }}>{e.event}</span> },
              { key: 'type', header: 'Type', sort: (e) => e.type, render: (e) => <Pill color={TP_LOG_COLOR[e.type]}>{e.type}</Pill> },
              { key: 'by', header: 'Made by', sort: (e) => e.by, render: (e) => <span style={{ fontSize: 12 }}>{e.by}</span> },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
