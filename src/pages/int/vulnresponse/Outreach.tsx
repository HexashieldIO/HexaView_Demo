import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Send, BellRing } from 'lucide-react';
import { Card, Btn, Callout, Stacked, Sources } from '../../../components/ui';
import { DataTable, type Column } from '../../../components/DataTable';
import { useApp } from '../../../state/AppContext';
import { fmtAgo } from '../../../lib/format';
import { vrSendOutreach, vrChase, VR_REPLY_COLOR, type VrSupplier, type VrReply } from '../../../data/modules/vulnresponse';
import { useVr } from './state';
import { ReplyPill, VrTiles, Confirm } from './ui';

type Bucket = VrReply | 'Awaiting reply' | 'Not asked';
const bucketOf = (s: VrSupplier): Bucket => s.reply ?? (s.asked ? 'No response' : 'Not asked');
const HEX: Record<Bucket, string> = { 'Not affected': '#2dd4bf', 'Affected – patched': '#68b1ff', 'Affected – patching': '#f2643f', 'No response': '#e0345e', 'Awaiting reply': '#f0a338', 'Not asked': '#8593b4' };

export function Outreach() {
  const { c, adv, sups, me } = useVr();
  const { toast } = useApp();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [ask, setAsk] = useState(false);
  const filter = (sp.get('reply') as Bucket | null) ?? null;
  const grc = c.connectors.find((k) => k.category === 'GRC')?.product ?? 'HexaComply';
  const sent = sups.some((s) => s.asked);
  const count = (b: Bucket) => sups.filter((s) => bucketOf(s) === b).length;
  const shown = sups.filter((s) => !filter || bucketOf(s) === filter);
  const setFilter = (b: Bucket | null) => { const n = new URLSearchParams(sp); if (b && b !== filter) n.set('reply', b); else n.delete('reply'); setSp(n, { replace: true }); };
  const pending = sups.filter((s) => s.asked && (!s.reply || s.reply === 'No response'));
  const live = adv.phase === 'Active response';

  const cols: Column<VrSupplier>[] = [
    { key: 'n', header: 'Supplier', sort: (s) => s.name, render: (s) => (<><div className="t-main">{s.name}</div><div className="muted" style={{ fontSize: 11 }}>{s.category} · tier {s.tier} · {s.contact}</div></>) },
    { key: 'w', header: 'Why they are asked', render: (s) => (<><div style={{ fontSize: 12 }}>{s.runsProduct ? <b style={{ color: 'var(--sev-high)' }}>Runs the product</b> : 'Possible use'}</div><div className="muted" style={{ fontSize: 11 }}>{s.why}</div></>) },
    { key: 'a', header: 'Asked', sort: (s) => s.askedMinAgo ?? 1e9, render: (s) => (s.askedMinAgo !== null ? <span className="muted">{fmtAgo(s.askedMinAgo)}</span> : <span className="muted">—</span>) },
    { key: 'r', header: 'Answer', sort: (s) => bucketOf(s), render: (s) => (<><ReplyPill r={bucketOf(s)} />{s.repliedMinAgo !== null && <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>{fmtAgo(s.repliedMinAgo)}{s.note ? ` · ${s.note}` : ''}</div>}</>) },
    { key: 'act', header: '', render: (s) => (s.asked && (!s.reply || s.reply === 'No response') ? (
      <Btn sm onClick={() => { vrChase(c, adv, s, me); toast(`Reminder sent to ${s.name} (${s.contact}) · escalated to the relationship owner`); }}><BellRing size={12} /> Chase{s.chases ? ` (${s.chases})` : ''}</Btn>
    ) : null) },
  ];

  return (
    <div className="vr-stack">
      <Card
        title={<>&ldquo;Are you affected?&rdquo; · {adv.cve}</>}
        sub={`${sups.length} suppliers from the ${grc} register: those recorded as running ${adv.product}, plus suppliers with privileged or remote access who may`}
        actions={
          <>
            <Sources items={[{ name: `${grc} TPRM` }, { name: 'Supplier portal' }]} />
            <Btn primary color="var(--m-comply)" disabled={sent || !sups.length} onClick={() => setAsk(true)}><Send size={13} /> {sent ? 'Questionnaire sent' : 'Ask affected suppliers'}</Btn>
          </>
        }
      >
        {!sent && live && sups.length > 0 && (
          <Callout kind="warn" color="var(--m-comply)"><b>Not asked yet.</b> One click sends a three-question &ldquo;Are you affected?&rdquo; questionnaire to {sups.length} suppliers through the {grc} supplier portal; answers land here and on each supplier record.</Callout>
        )}
        {!sups.length && <div className="empty">No supplier in scope runs or is likely to run {adv.product}.</div>}
        {sent && (
          <>
            <VrTiles
              items={(['Not affected', 'Affected – patched', 'Affected – patching', 'No response'] as Bucket[]).map((b) => ({
                label: b, value: count(b), color: VR_REPLY_COLOR[b], on: filter === b, onClick: () => setFilter(b), source: `${grc} supplier questionnaire responses`,
                bar: sups.length ? (count(b) / sups.length) * 100 : 0,
              }))}
            />
            <div style={{ marginTop: 10 }}>
              <Stacked tall parts={(Object.keys(HEX) as Bucket[]).map((b) => ({ value: count(b), color: HEX[b], label: b }))} />
            </div>
            {pending.length > 0 && <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{pending.length} supplier{pending.length === 1 ? '' : 's'} still to answer. Chasing sends a reminder and escalates to the relationship owner.</div>}
          </>
        )}
      </Card>

      <Card title="Suppliers" count={shown.length} sub="Click a row to open the supplier in Third-Party Risk" flush actions={<button className="link" onClick={() => nav('/comply/tprm?section=suppliers')}>Open Third-Party Risk →</button>}>
        <DataTable rows={shown} columns={cols} rowKey={(s) => s.id} onRowClick={(s) => nav(`/comply/tprm?section=suppliers&id=${s.id}`)} empty="No suppliers for this filter." />
      </Card>

      {ask && (
        <Confirm
          title="Ask affected suppliers"
          sub={`${adv.cve} · ${adv.product}`}
          risk="low"
          approvers={1}
          change={[
            ['Recipients', `${sups.length} suppliers (${sups.filter((s) => s.runsProduct).length} recorded as running the product)`],
            ['Q1', `Do you run ${adv.product} (any version) in services you provide to ${c.short}?`],
            ['Q2', `If yes, is it on ${adv.fixedIn} or mitigated? Please attach evidence.`],
            ['Q3', 'Have you seen any related compromise indicators since disclosure?'],
            ['Due', 'Within 24 hours · automatic reminder at 12 hours'],
            ['Sent via', `${grc} supplier portal, recorded on each supplier`],
          ]}
          confirmLabel={`Send to ${sups.length} suppliers`}
          onConfirm={() => { vrSendOutreach(c, adv, sups, me); toast(`Questionnaire sent to ${sups.length} suppliers · answers will appear as they arrive`); }}
          onClose={() => setAsk(false)}
        />
      )}
    </div>
  );
}
