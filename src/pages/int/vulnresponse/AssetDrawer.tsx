import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, ScanLine, FileCheck2, ShieldCheck, Lock } from 'lucide-react';
import { Drawer } from '../../../components/Overlay';
import { KV, Btn, Callout, Badge, Sources, SectionLabel } from '../../../components/ui';
import { useApp } from '../../../state/AppContext';
import { fmtAgo } from '../../../lib/format';
import { vrSetStatus, vrRaiseTicket, vrRequestScan, vrItsm, vrScanner, VR_SOURCE_META, type VrAsset, type VrStatus } from '../../../data/modules/vulnresponse';
import { useVr } from './state';
import { StatusPill, SourceTag, ValPill, Confirm, fmtDue, stamp } from './ui';

const OPEN_IN: Record<VrAsset['source'], { to: string; label: string }> = {
  core: { to: '/fabric/assets', label: 'Open in HexaCore assets' },
  tooling: { to: '/tooling/overview', label: 'Open in Security Tooling' },
  ot: { to: '/ot/assets', label: 'Open in HexaOT assets' },
};

export function AssetDrawer({ a, onClose }: { a: VrAsset; onClose: () => void }) {
  const { c, adv, detections, me } = useVr();
  const { toast } = useApp();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState<null | 'ticket' | 'scan' | VrStatus>(null);
  const itsm = vrItsm(c);
  const due = fmtDue(a.dueInMin);
  const dets = detections.filter((d) => d.asset === a.name);
  const isOt = a.source === 'ot';

  const doStatus = (s: VrStatus) => {
    vrSetStatus(c, a, s, me);
    toast(`${a.name} marked ${s.toLowerCase()} · ${s === 'Patched' ? `${isOt ? 'passive re-fingerprint' : `${vrScanner(c)} rescan`} queued to confirm` : 'compensating control recorded'}`);
  };

  return (
    <Drawer
      wide
      title={<span className="mono">{a.name}</span>}
      sub={`${a.kind} · ${a.site} · ${adv.cve}`}
      onClose={onClose}
      footer={
        <>
          <Btn ghost onClick={() => { onClose(); nav(OPEN_IN[a.source].to); }}>{OPEN_IN[a.source].label}</Btn>
          <span className="spacer" />
          <Btn sm onClick={() => setConfirm('ticket')} disabled={!!a.ticket}><Ticket size={13} /> {a.ticket ? a.ticket : 'Raise ticket'}</Btn>
          <Btn sm onClick={() => setConfirm('scan')} disabled={a.scanRequested}><ScanLine size={13} /> {a.scanRequested ? 'Scan requested' : 'Request validation scan'}</Btn>
          <Btn sm color="var(--sev-medium)" onClick={() => setConfirm('Mitigated')} disabled={a.status === 'Mitigated' || a.status === 'Patched'}>Mark mitigated</Btn>
          <Btn sm primary color="var(--good)" onClick={() => setConfirm('Patched')} disabled={a.status === 'Patched'}>Mark patched</Btn>
        </>
      }
    >
      <div className="vr-row" style={{ marginBottom: 12 }}>
        <StatusPill s={a.status} />
        <SourceTag s={a.source} />
        {a.internet && <Badge color="var(--bad)" dot>Internet-facing</Badge>}
        {a.airGapped && <Badge color="var(--sev-info)" dot>Air-gapped</Badge>}
        <ValPill v={a.validation} />
        <span className="vr-spacer" />
        <Sources items={[{ name: a.tool }, { name: itsm.name }, { name: 'HexaStrike' }]} />
      </div>

      {isOt && (
        <Callout kind="info" color="var(--m-ot)">
          <Lock size={12} style={{ verticalAlign: -1 }} /> <b>OT is read-only by policy.</b> HexaView records status and raises tickets; nothing is written to the controller. {a.airGapped ? 'This plant is air-gapped: evidence arrives by offline import from the sealed HexaOT store.' : 'Plant or terminal engineers apply the fix in a maintenance window.'}
        </Callout>
      )}

      <div className="grid g2" style={{ marginTop: 12, alignItems: 'start' }}>
        <div>
          <SectionLabel>Asset</SectionLabel>
          <KV
            rows={[
              ['Kind', a.kind],
              ['Tenant · site', a.site],
              ['Address', <span className="mono">{a.ip}</span>],
              ['Installed version', <span className="mono">{a.version}</span>],
              ['Fixed in', adv.fixedIn],
              ['Matched by', <><SourceTag s={a.source} /> {a.tool} · +{a.matchedAfterMin} min after disclosure</>],
              ['Owner', a.owner],
            ]}
          />
        </div>
        <div>
          <SectionLabel>Response</SectionLabel>
          <KV
            rows={[
              ['Status', <><StatusPill s={a.status} /> {a.statusMinAgo !== null && <span className="muted" style={{ fontSize: 11.5 }}>{fmtAgo(a.statusMinAgo)}</span>}</>],
              ['SLA', `${a.slaHours} h (${a.internet ? 'internet-facing' : isOt ? 'OT, compensating controls allowed' : 'internal'}${adv.kev ? ', KEV' : ''})`],
              ['Due', a.status === 'Patched' || a.status === 'Not applicable' ? <span className="vr-yes">Met</span> : <span style={{ color: due.color, fontWeight: 600 }}>{due.text} · {stamp(-a.dueInMin)}</span>],
              ['Ticket', a.ticket ? <span className="mono">{a.ticket} ({itsm.name})</span> : <span className="muted">None yet</span>],
              ['HexaSOC detections', dets.length ? `${dets.length} since disclosure` : 'None'],
              ['Validation', <ValPill v={a.validation} />],
              ...(a.note ? [['Note', a.note] as [string, string]] : []),
            ]}
          />
        </div>
      </div>

      <SectionLabel>Remediation steps</SectionLabel>
      <ol className="vr-steps">
        {adv.remediation.map((s, i) => <li key={i}>{s}</li>)}
      </ol>

      <div style={{ marginTop: 14 }}><SectionLabel>Evidence</SectionLabel></div>
      <div className="vr-evidence">
        <div className="vr-ev">
          <Ticket size={15} />
          <div>
            <b>Patch ticket</b>
            {a.ticket ? <span>{a.ticket} in {itsm.name} · owner {a.owner} · {a.status === 'Patched' ? 'resolved' : 'in progress'}</span> : <span>No ticket yet. Raise one to assign the work to {a.owner}.</span>}
          </div>
        </div>
        <div className="vr-ev">
          <FileCheck2 size={15} />
          <div>
            <b>Scan confirmation</b>
            {a.scan ? (
              <>
                <span>{a.scan.result} · {a.scan.tool} · {stamp(a.scan.minAgo)} ({fmtAgo(a.scan.minAgo)})</span>
                <div className="vr-hash">{a.scan.hash}</div>
              </>
            ) : <span>{a.scanRequested ? 'Validation scan requested; result will attach here.' : 'No confirmation yet. Request a validation scan once the fix is applied.'}</span>}
          </div>
        </div>
        <div className="vr-ev">
          <ShieldCheck size={15} />
          <div>
            <b>HexaStrike validation</b>
            <span>{a.validation === 'Passed' ? 'Non-exploiting version and exposure check passed.' : a.validation === 'Failed' ? 'Still reports a vulnerable version from the outside.' : a.validation === 'Scheduled' ? 'Check scheduled.' : 'Not run.'}</span>
          </div>
        </div>
        {dets.slice(0, 3).map((d) => (
          <div key={d.id} className="vr-ev">
            <ScanLine size={15} />
            <div>
              <b>{d.title}</b>
              <span>{d.tool} · {d.outcome} · {fmtAgo(d.minAgo)}</span>
            </div>
          </div>
        ))}
      </div>

      {confirm === 'ticket' && (
        <Confirm
          title={`Raise ticket in ${itsm.name}`}
          sub={`${a.name} · ${adv.cve}`}
          risk="low"
          approvers={1}
          change={[['Ticket type', 'Emergency change · P1 vulnerability'], ['Assigned to', a.owner], ['Due', stamp(-a.dueInMin)], ['Includes', 'Advisory summary, remediation steps, affected version']]}
          confirmLabel="Raise ticket"
          onConfirm={() => { const id = vrRaiseTicket(c, a, me); toast(`${id} raised in ${itsm.name} · ${a.name} · owner ${a.owner}`); }}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'scan' && (
        <Confirm
          title="Request validation scan"
          sub={`${a.name} · ${adv.cve}`}
          risk="low"
          approvers={1}
          change={[['Rescan', isOt ? `Passive re-fingerprint via ${a.tool} (read-only)` : `${vrScanner(c)} credentialed check`], ['Validation', 'HexaStrike non-exploiting version and exposure check'], ['Evidence', 'Result, timestamp and SHA-256 attached to this asset']]}
          confirmLabel="Request scan"
          onConfirm={() => { vrRequestScan(c, a, me); toast(`Validation scan requested for ${a.name}`); }}
          onClose={() => setConfirm(null)}
        />
      )}
      {(confirm === 'Patched' || confirm === 'Mitigated') && (
        <Confirm
          title={`Mark ${a.name} ${confirm.toLowerCase()}`}
          sub={`${VR_SOURCE_META[a.source].short} · ${adv.cve}`}
          risk="low"
          approvers={1}
          change={[
            ['Status', `${a.status} → ${confirm}`],
            ['Recorded by', me],
            ['Confirmation', confirm === 'Patched' ? (isOt ? 'Passive re-fingerprint queued' : `${vrScanner(c)} rescan queued`) : 'Compensating control noted; patch still required'],
            ['Written to', isOt ? 'HexaView record only (OT read-only by policy)' : `HexaView record and ${a.ticket ?? itsm.name}`],
          ]}
          confirmLabel={`Mark ${confirm.toLowerCase()}`}
          onConfirm={() => doStatus(confirm)}
          onClose={() => setConfirm(null)}
        />
      )}
    </Drawer>
  );
}
