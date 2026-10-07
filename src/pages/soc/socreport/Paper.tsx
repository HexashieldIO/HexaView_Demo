import type { CustomerProfile } from '../../../data/types';
import { PERIOD_KINDS, type Format } from '../../../data/modules/reports';
import type { SocAudience, SocDoc, SocReportData } from '../../../data/modules/socReport';
import { tenantName } from '../../../data/customers';
import { CustomerLogo } from '../../../components/CustomerLogo';
import { fmtDate, NOW } from '../../../lib/format';
import { SocSectionVisual } from './Visuals';

/**
 * The SOC / MDR report document. Same paper, cover, numbering and citation
 * appendix as the Reporting Centre's ReportPaper (rep-* classes), retoned to
 * HexaSOC by the socr-scope wrapper; sections and visuals are SOC-specific.
 */
export function SocReportPaper({
  c, tenantId, title, audience, format, doc, data, compare, signedBy, generatedAt,
}: {
  c: CustomerProfile; tenantId: string; title: string; audience: SocAudience; format: Format; doc: SocDoc; data: SocReportData; compare: boolean; signedBy?: string; generatedAt?: Date;
}) {
  const { period } = data;
  return (
    <div className={`rep-paper socr-paper ${format === 'PPTX' ? 'rep-slides' : ''}`}>
      {!signedBy && <div className="rep-watermark">DRAFT</div>}
      <div className="rep-cover">
        <div className="rep-cover-top">
          <CustomerLogo c={c} size={40} className="rep-logo" />
          <div>
            <small>HexaSOC · Managed SOC / MDR · {PERIOD_KINDS.find((k) => k.id === period.kind)?.adj} report</small>
            <b>{c.name}</b>
          </div>
          <span className="rep-class">Confidential · {audience}</span>
        </div>
        <h2>{title}</h2>
        <div className="rep-cover-meta">
          <span className="rep-period-chip">{period.label}</span>
          {period.label !== period.range && period.kind !== 'daily' && <span>{period.range}</span>}
          <span>Generated {fmtDate(generatedAt ?? NOW)}</span>
          <span>Prepared for {audience === 'Executive / Board' ? 'the executive team and board' : audience === 'Customer IT' ? `${c.short} IT` : `the ${audience}`} · {tenantName(c, tenantId)}</span>
          {compare && <span>Compared with {period.prev.label}</span>}
        </div>
        <p>
          Monitored 24/7 by HexaSOC through {data.tools.siemShort}{data.tools.edr ? `, ${data.tools.edrShort}` : ''} and {data.tools.idpShort}. Every statement is cited to a versioned record.
        </p>
      </div>
      {doc.sections.map((s, i) => (
        <section key={s.id} className="rep-sec">
          <h4><em>{String(i).padStart(2, '0')}</em>{s.title}</h4>
          <p className="rep-lead">{s.lead}</p>
          <p className="rep-p socr-narr">
            {s.statements.map((st, j) => (
              <span key={j}>
                {st.text}
                {st.refs.map((n) => <sup key={n}>[{n}]</sup>)}{' '}
              </span>
            ))}
          </p>
          <SocSectionVisual id={s.id} data={data} compare={compare} c={c} />
        </section>
      ))}
      {doc.citations.length > 0 && (
        <section className="rep-sec rep-appendix">
          <h4><em>A</em>Citation appendix</h4>
          <table className="rep-table">
            <thead>
              <tr><th>#</th><th>Record</th><th>Source</th><th>Version</th><th>Retrieved</th></tr>
            </thead>
            <tbody>
              {doc.citations.map((x) => (
                <tr key={x.n}>
                  <td>[{x.n}]</td>
                  <td className="mono">{x.id}</td>
                  <td>{x.source}</td>
                  <td>{x.version}</td>
                  <td>{x.retrievedMin} min before generation</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <div className="rep-foot">
        <span>{c.short} · {title} · {period.label}</span>
        <span>{signedBy ? `Signed off by ${signedBy} · SHA-256 anchored to the audit ledger` : 'Unsigned draft · nothing is released until a named approver signs'}</span>
      </div>
    </div>
  );
}
