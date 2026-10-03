import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileArchive, Fingerprint, Loader2, ShieldCheck, AlertTriangle, FileText } from 'lucide-react';
import { useApp, rangeDays, rangeLabel } from '../../state/AppContext';
import { custodyScope, custodyAssets } from '../../data/modules/custody';
import { KpiStrip, Card, Badge, Btn, MiniStat, Callout, Sources } from '../../components/ui';
import { fmtAgo, fmtDateTime, ago, fmtNum } from '../../lib/format';
import { rng } from '../../lib/rng';
import { CUSTODY_TONE } from './parts';

export default function CustodyEvidence() {
  const { customer: c, tenantId, timeRange, toast } = useApp();
  const days = rangeDays(timeRange);
  const sc = useMemo(() => custodyScope(c, tenantId), [c, tenantId]);
  const assets = useMemo(() => custodyAssets(c, tenantId), [c, tenantId]);
  const [selId, setSelId] = useState<string | null>(null);
  const [step, setStep] = useState(-1); // -1 idle; 0..n verifying link i; n = done
  const sel = assets.find((a) => a.id === selId) ?? assets.find((a) => a.integrity === 'flagged') ?? assets[0];
  const n = sel?.lineage.length ?? 0;
  const verifying = step >= 0 && step < n;

  useEffect(() => setStep(-1), [sel?.id, c.id]);
  useEffect(() => {
    if (!verifying) return;
    const t = setTimeout(() => setStep((s) => s + 1), 520);
    return () => clearTimeout(t);
  }, [verifying, step]);
  useEffect(() => {
    if (sel && step === n && n > 0) {
      const flags = sel.lineage.filter((l) => l.flag).length;
      toast(`Chain verified for ${sel.name}: ${n} of ${n} links signed, hashes ${flags ? 'checked' : 'match'}${flags ? `; ${flags} hand-off flagged for review` : ''}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const r = rng(`custody-evidence-${c.id}-${tenantId}`);
  const verifiedToday = r.int(40, 160);
  const packs = r.int(6, 28);
  const handoffs = Math.round((sc.h.transfers7d * days) / 7);
  const flaggedAssets = assets.filter((a) => a.integrity === 'flagged').length;

  const linkState = (i: number) => (step < 0 ? 'idle' : i < step || step >= n ? (sel?.lineage[i].flag ? 'flag' : 'ok') : i === step ? 'verifying' : 'idle');

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · {sc.tenantName}. Every hand-off of {sc.label.toLowerCase()} is hashed (SHA-256), signed by the custody agent that witnessed it and bound to a {c.id === 'maritime' ? 'package ID' : 'forensic watermark'}, so you can prove where an asset has been and who held it.
      </p>

      <KpiStrip
        toneColor={CUSTODY_TONE}
        items={[
          { label: 'Assets under custody', value: fmtNum(sc.h.assetsUnderCustody), to: '/custody/lineage', source: 'HexaCustody agents · signed custody ledger' },
          { label: 'Signed hand-offs', hint: rangeLabel(timeRange).toLowerCase(), value: fmtNum(handoffs), to: '/custody/lineage', source: 'HexaCustody agents · signed custody ledger' },
          { label: 'Chains verified', hint: 'today', value: verifiedToday, to: '/custody/lineage?status=verified', source: 'HexaCustody agents · signed custody ledger' },
          { label: 'Integrity', value: `${sc.integrityPct}%`, bar: sc.integrityPct, to: '/custody/lineage?status=broken', source: 'HexaCustody agents · signed custody ledger' },
          { label: 'Flagged chains', value: flaggedAssets, toneColor: 'var(--bad)', to: '/custody/lineage?status=broken', source: 'HexaCustody agents · signed custody ledger' },
          { label: 'Evidence packs', hint: '30 d', value: packs, to: '/reports/history', source: 'HexaCustody evidence packs · Reporting Centre' },
        ]}
      />

      <div className="grid g-1-2">
        <Card title="Assets" count={assets.length} sub="Highest-value items under custody · pick one to trace" flush>
          <div className="custody-assets" style={{ padding: '0 10px 10px' }}>
            {assets.map((a) => (
              <button key={a.id} className={`custody-asset ${a.id === sel?.id ? 'on' : ''}`} onClick={() => setSelId(a.id)}>
                <span className="ico-box" style={{ ['--tone' as string]: a.integrity === 'flagged' ? 'var(--bad)' : CUSTODY_TONE }}>
                  {a.integrity === 'flagged' ? <AlertTriangle /> : <FileText />}
                </span>
                <span className="list-main">
                  <b>{a.name}</b>
                  <span>{a.project} · {a.lineage.length} hand-offs · {a.holders} organisations</span>
                </span>
                {a.integrity === 'flagged' ? <Badge color="var(--bad)">Flagged</Badge> : <Badge color="var(--good)">Verified</Badge>}
              </button>
            ))}
          </div>
        </Card>

        {sel && (
          <div className="stack" style={{ gap: 16 }}>
            <Card
              title={sel.name}
              sub={`${sel.id} · ${sel.classification}`}
              toneColor={CUSTODY_TONE}
              tinted
              actions={
                <>
                  <Btn sm primary color={CUSTODY_TONE} disabled={verifying} onClick={() => setStep(0)}>
                    {verifying ? <Loader2 className="custody-spin" /> : <ShieldCheck />} {verifying ? `Verifying ${step + 1}/${n}…` : 'Verify chain'}
                  </Btn>
                  <Btn sm onClick={() => toast(`Evidence pack for ${sel.name} exported: ${n} signed hand-offs, hashes, watermark register and agent attestations (PDF + JSON, sealed)`)}>
                    <FileArchive /> Export evidence pack
                  </Btn>
                </>
              }
            >
              <div className="mini-stats">
                <MiniStat value={sel.lineage.length} label="Hand-offs" />
                <MiniStat value={sel.holders} label="Organisations" />
                <MiniStat value={sel.copies} label="Tracked copies" />
                <MiniStat value={sel.sizeLabel} label="Size" />
                <MiniStat value={sel.lineage.filter((l) => l.transformed).length} label="New versions" />
                <MiniStat value={sel.lineage.filter((l) => l.flag).length} label="Flags" color={sel.integrity === 'flagged' ? 'var(--bad)' : 'var(--good)'} />
              </div>
              <div className="card-foot">
                <Sources items={sc.sources.map((s) => ({ name: s.name, status: s.status }))} />
              </div>
            </Card>

            <Card title={<><Fingerprint size={15} /> Lineage</>} sub="Oldest first · each link is signed by the witnessing agent">
              <div className="custody-chain">
                {sel.lineage.map((l, i) => {
                  const st = linkState(i);
                  const prev = sel.lineage[i - 1];
                  return (
                    <div key={l.seq} className={`custody-link ${st}`}>
                      <div className="custody-seq">
                        {st === 'ok' ? <CheckCircle2 size={16} /> : st === 'flag' ? <AlertTriangle size={16} /> : st === 'verifying' ? <Loader2 size={16} className="custody-spin" /> : l.seq}
                      </div>
                      <div className="custody-card">
                        <div className="custody-card-head">
                          <b>{l.action}</b>
                          <span className="row" style={{ gap: 6 }}>
                            {l.transformed && <Badge color="var(--accent)">New version</Badge>}
                            {l.flag && <Badge color="var(--bad)" solid>Flagged</Badge>}
                            <span className="muted" style={{ fontSize: 11 }}>{fmtDateTime(ago(l.minAgo))} · {fmtAgo(l.minAgo)}</span>
                          </span>
                        </div>
                        <div className="custody-meta">
                          <span><em>Organisation</em>{l.org}</span>
                          <span><em>User</em>{l.user}</span>
                          <span><em>Machine</em><span className="mono">{l.machine}</span></span>
                          <span><em>{c.id === 'maritime' ? 'Package' : 'Watermark'}</em><span className="mono">{l.watermark}</span></span>
                        </div>
                        <div className="custody-hash"><b>SHA-256</b> {l.sha256}{prev && prev.sha256 === l.sha256 ? ' · unchanged from previous link' : prev ? ' · derived from previous version' : ''}</div>
                        <div className="custody-hash"><b>Signature</b> {l.signature}</div>
                        {l.flag && <div style={{ marginTop: 8 }}><Callout kind="warn" color="var(--bad)">{l.flag}</Callout></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {step >= n && n > 0 && (
                <Callout kind={sel.integrity === 'flagged' ? 'warn' : 'good'}>
                  Verified {n} of {n} signatures against the custody agents&rsquo; public keys; every hash recomputed from the stored copy.{sel.integrity === 'flagged' ? ' One hand-off is outside policy and is recorded as evidence, not hidden.' : ' The chain is complete and unbroken.'}
                </Callout>
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
