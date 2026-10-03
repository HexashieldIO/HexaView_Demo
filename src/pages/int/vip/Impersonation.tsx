import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AtSign, Banknote, Globe2, MessageCircle, Mic, UserRoundX, Video } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { IMP_KINDS, IMP_COLOR, IMP_STATUSES, IMP_STATUS_COLOR, impTrend, type ImpItem, type ImpKind } from '../../../data/modules/vip';
import { Badge, Btn, Card, Freshness, KV, SectionLabel, SevBadge, Sources, StatusBadge, SEV_COLOR } from '../../../components/ui';
import { Chart } from '../../../components/Chart';
import { Drawer } from '../../../components/Overlay';
import { fmtAgo, fmtMoney, fmtNum } from '../../../lib/format';
import { FilterGroup, HBarList } from '../parts';
import { useVip } from './state';
import { ActionModal } from './ui';

export const IMP_ICON: Record<ImpKind, ReactNode> = {
  'Fake social profile': <UserRoundX />, 'Voice clone': <Mic />, 'Deepfake video': <Video />, 'Lookalike domain': <Globe2 />,
  'Email spoof': <AtSign />, 'CEO fraud / payment diversion': <Banknote />, 'Messaging-app impersonation': <MessageCircle />,
};
const TAKEDOWN: ImpKind[] = ['Fake social profile', 'Deepfake video', 'Lookalike domain', 'Messaging-app impersonation'];
const OPEN = (i: ImpItem) => i.status === 'New' || i.status === 'Takedown requested';

export function Impersonation() {
  const { c, tenantId, imps, people, param, patch } = useVip();
  const trend = useMemo(() => impTrend(c, tenantId), [c, tenantId]);
  const kind = param('kind') ?? 'All';
  const status = param('status') ?? 'All';
  const who = param('who');
  const id = param('id');
  const live = id ? imps.find((i) => i.id === id) ?? null : null;
  const email = c.connectors.find((k) => k.category === 'Email' && k.vendor !== 'KnowBe4');
  const intel = c.connectors.find((k) => k.product === 'HexaInt');

  const feed = imps
    .filter((i) => kind === 'All' || i.kind === kind)
    .filter((i) => status === 'All' || (status === 'open' ? OPEN(i) : i.status === status))
    .filter((i) => !who || i.personId === who);
  const fraud = imps.filter((i) => i.kind === 'CEO fraud / payment diversion');
  const whoRows = people
    .map((p) => ({ key: p.id, label: p.name, sub: p.role, n: imps.filter((i) => i.personId === p.id).length }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 7);

  return (
    <>
      <Card title="What is being impersonated" sub="Detections by type · click a tile to filter the feed" actions={<Freshness minutes={intel?.lastSyncMin ?? 2} label="HexaInt" />}>
        <div className="vip-kinds">
          {IMP_KINDS.map((k) => {
            const all = imps.filter((i) => i.kind === k);
            return (
              <button key={k} type="button" className={`vip-kind ${kind === k ? 'on' : ''}`} style={{ '--tone': IMP_COLOR[k] } as CSSProperties} onClick={() => patch({ kind: kind === k ? null : k, id: null })} title="Source: HexaInt social & media monitoring, email gateway, employee reports">
                <b>{all.length}</b>
                <span>{k}<small>{all.filter(OPEN).length} open</small></span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid g-3-2">
        <Card title="Impersonation & deepfake feed" count={`${feed.length} of ${imps.length}`} sub="Newest first · click for detail and takedown">
          <div className="row wrap" style={{ gap: 10, marginBottom: 8 }}>
            <FilterGroup label="Status" value={status === 'open' ? 'All' : status} options={IMP_STATUSES} onChange={(v) => patch({ status: v, id: null })} counts={Object.fromEntries(IMP_STATUSES.map((s) => [s, imps.filter((i) => i.status === s).length]))} />
            {(status === 'open' || who || kind !== 'All') && (
              <button type="button" className="int-fchip on" onClick={() => patch({ status: null, who: null, kind: null, id: null })}>
                {[status === 'open' && 'Open', who && people.find((p) => p.id === who)?.name, kind !== 'All' && kind].filter(Boolean).join(' · ')} ×
              </button>
            )}
          </div>
          <div style={{ maxHeight: 620, overflowY: 'auto' }}>
            {feed.map((i) => (
              <button key={i.id} type="button" className="vip-imp" style={{ '--tone': IMP_COLOR[i.kind] } as CSSProperties} onClick={() => patch({ id: i.id })}>
                <span className="vip-imp-ico">{IMP_ICON[i.kind]}</span>
                <span>
                  <h4>{i.title}</h4>
                  <span className="vip-imp-meta">
                    <span>{i.kind}</span>
                    <span>Target <b>{i.personName}</b></span>
                    <span>Channel <b>{i.channel}</b></span>
                    {i.amount !== undefined && <span>Amount <b style={{ color: 'var(--bad)' }}>{fmtMoney(i.amount, c.currency)}</b></span>}
                    {i.incidentId && <span>Incident <b>{i.incidentId}</b></span>}
                  </span>
                </span>
                <span className="vip-imp-side">
                  <span className="row" style={{ gap: 4 }}><SevBadge sev={i.sev} /><StatusBadge value={i.status} map={IMP_STATUS_COLOR} /></span>
                  <small>{fmtAgo(i.foundMin)} · {i.source}</small>
                </span>
              </button>
            ))}
            {!feed.length && <div className="empty">Nothing matches these filters.</div>}
          </div>
        </Card>

        <div className="stack" style={{ gap: 16 }}>
          <Card title="Detections per week" sub="By type · 12 weeks">
            <Chart
              height={210}
              onClick={(p) => { const n = (p as { seriesName?: string }).seriesName; if (n) patch({ kind: n, id: null }); }}
              option={{
                legend: { bottom: 0, itemGap: 8, itemWidth: 10, itemHeight: 8, textStyle: { fontSize: 10.5 } },
                grid: { left: 6, right: 8, top: 10, bottom: 64, containLabel: true },
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                xAxis: { type: 'category', data: trend.labels, axisLabel: { fontSize: 10.5, interval: 1 } },
                yAxis: { type: 'value', minInterval: 1 },
                series: IMP_KINDS.map((k) => ({ name: k, type: 'bar', stack: 'k', data: trend.series[k], itemStyle: { color: IMP_COLOR[k] }, barMaxWidth: 16 })),
              }}
            />
          </Card>
          <Card title="Payment-diversion attempts" count={fraud.length} sub={`CEO fraud in executives’ names · ${fmtMoney(fraud.reduce((s, i) => s + (i.amount ?? 0), 0), c.currency)} requested, none paid`}>
            <div className="list">
              {fraud.map((i) => (
                <button key={i.id} type="button" className="list-row" style={{ width: '100%', cursor: 'pointer', background: 'none', border: 0, font: 'inherit', color: 'inherit', textAlign: 'left' }} onClick={() => patch({ id: i.id })}>
                  <span className="list-main"><b>{fmtMoney(i.amount ?? 0, c.currency)} · {i.personName}</b><span>{i.incidentId ? `HexaSOC ${i.incidentId} · ` : ''}{fmtAgo(i.foundMin)}</span></span>
                  <StatusBadge value={i.status} map={IMP_STATUS_COLOR} />
                </button>
              ))}
            </div>
          </Card>
          <Card title="Who is impersonated most" sub="Click to filter the feed">
            <HBarList rows={whoRows} color="#ef6aae" onPick={(k) => patch({ who: who === k ? null : k, id: null })} />
          </Card>
        </div>
      </div>

      <Card>
        <Sources items={[{ name: 'HexaInt social & media monitoring' }, { name: email ? `${email.vendor} ${email.product}` : 'Email gateway', status: email?.status }, { name: 'CT logs · zone files' }, { name: 'Employee reports' }, { name: 'HexaSOC incidents' }]} />
      </Card>

      {live && <ImpDrawer i={live} onClose={() => patch({ id: null })} onPerson={(pid) => patch({ id: null, person: pid })} />}
    </>
  );
}

function ImpDrawer({ i, onClose, onPerson }: { i: ImpItem; onClose: () => void; onPerson: (id: string) => void }) {
  const { c, setImp, notified, notify, watch, addWatch } = useVip();
  const { toast } = useApp();
  const nav = useNavigate();
  const [ask, setAsk] = useState(false);
  const canTake = TAKEDOWN.includes(i.kind) && (i.status === 'New' || i.status === 'Monitoring');
  return (
    <>
      <Drawer
        wide
        title={i.title}
        sub={`${i.kind} · ${i.channel}`}
        icon={<span className="vip-imp-ico" style={{ '--tone': IMP_COLOR[i.kind] } as CSSProperties}>{IMP_ICON[i.kind]}</span>}
        onClose={onClose}
        footer={
          <>
            {i.incidentId && <Btn ghost onClick={() => nav(`/soc/ir?id=${i.incidentId}`)}>Open {i.incidentId} in HexaSOC</Btn>}
            <Btn disabled={notified[i.id]} onClick={() => { notify(i.id); toast(`${i.personName} notified about this ${i.kind.toLowerCase()}, with guidance on what to tell their contacts.`); }}>{notified[i.id] ? 'Person notified' : 'Notify person'}</Btn>
            <Btn disabled={watch[i.id]} onClick={() => { addWatch(i.id); toast(`Added to the HexaInt watchlist: re-checked every 6 hours and alerted to HexaSOC on change.`); }}>{watch[i.id] ? 'On watchlist' : 'Add to watchlist'}</Btn>
            <Btn primary color="var(--m-int)" disabled={!canTake} onClick={() => setAsk(true)} title={TAKEDOWN.includes(i.kind) ? undefined : 'Takedown does not apply to this type; it was handled at the email gateway or by the recipient'}>Request takedown</Btn>
          </>
        }
      >
        <SectionLabel>Analyst summary</SectionLabel>
        <div className="int-snippet">{i.detail}</div>
        <div style={{ marginTop: 14 }}>
          <KV rows={[
            ['Severity', <SevBadge sev={i.sev} />],
            ['Status', <StatusBadge value={i.status} map={IMP_STATUS_COLOR} />],
            ['Impersonates', <button type="button" className="link" style={{ background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer' }} onClick={() => onPerson(i.personId)}>{i.personName}</button>],
            ['Channel', i.channel],
            ['Reach', i.reach ? `${fmtNum(i.reach)} ${i.reachLabel}` : 'Not yet used'],
            ...(i.amount !== undefined ? [['Amount requested', <b style={{ color: 'var(--bad)' }}>{fmtMoney(i.amount, c.currency)}</b>] as [ReactNode, ReactNode]] : []),
            ['Confidence', `${i.confidence}%`],
            ['First seen', fmtAgo(i.foundMin)],
            ['Detected by', i.source],
            ...(i.incidentId ? [['HexaSOC incident', <span className="mono">{i.incidentId}</span>] as [ReactNode, ReactNode]] : []),
          ]} />
        </div>
        <SectionLabel>Recommended response</SectionLabel>
        <ul className="vip-adv">
          {i.kind === 'CEO fraud / payment diversion' && <><li>Confirm no payment left: finance call-back to the directory number, never the number in the message.</li><li>Remind finance staff that bank-detail changes need dual approval.</li></>}
          {i.kind === 'Voice clone' && <><li>Reinforce the call-back rule for any payment or access request by phone.</li><li>Agree a verbal passphrase between the executive and their assistant.</li></>}
          {i.kind === 'Deepfake video' && <><li>Request removal under the platform’s synthetic-media policy; keep the evidence package.</li><li>Prepare a holding statement with communications in case the clip spreads.</li></>}
          {(i.kind === 'Fake social profile' || i.kind === 'Messaging-app impersonation') && <><li>Request removal through the platform’s impersonation process.</li><li>Warn staff and suppliers who connected with the profile.</li></>}
          {i.kind === 'Lookalike domain' && <><li>Block the domain at the email gateway and web proxy.</li><li>File an abuse report with the registrar and host.</li></>}
          {i.kind === 'Email spoof' && <><li>Keep DMARC at reject on {c.domain}; display-name protection stays on.</li><li>Use this lure in the next phishing simulation for finance.</li></>}
        </ul>
        <SectionLabel>Sources</SectionLabel>
        <Sources items={[{ name: i.source }, { name: 'HexaInt evidence capture' }, { name: 'HexaCore audit ledger' }]} />
      </Drawer>
      {ask && (
        <ActionModal
          title="Request takedown"
          sub={i.title}
          risk="low"
          approvers={1}
          confirmLabel="Submit takedown request"
          onDone={`Takedown requested for the ${i.kind.toLowerCase()} impersonating ${i.personName}; evidence package sent to ${i.channel === 'DNS' ? 'registrar and host' : i.channel}.`}
          onClose={() => setAsk(false)}
          onConfirm={() => setImp(i.id, 'Takedown requested')}
          change={[
            ['Item', i.title],
            ['Channel', i.channel],
            ['Status', <><StatusBadge value={i.status} map={IMP_STATUS_COLOR} /> → <Badge color={IMP_STATUS_COLOR['Takedown requested']} dot>Takedown requested</Badge></>],
            ['Action', i.kind === 'Lookalike domain' ? 'Abuse report to registrar, host and CERT with evidence' : 'Impersonation report to the platform with identity evidence and screenshots'],
            ['Severity', <span style={{ color: SEV_COLOR[i.sev] }}>{i.sev}</span>],
            ['Tracked in', 'HexaInt takedown queue + HexaCore audit ledger'],
          ]}
        />
      )}
    </>
  );
}
