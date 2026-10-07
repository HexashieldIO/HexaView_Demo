import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Save } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { headlines } from '../../../data/core';
import { scopedConnectors } from '../../../data/customers';
import { MODULE_BY_ID } from '../../../modules/registry';
import type { VendorRec, VendorClass, RecordedRisk, Clauses, RegStatus } from '../../../data/modules/complyRegisters';
import { VENDOR_INFO_TYPES } from '../../../data/modules/comply';
import { forCustomer } from '../../../data/customerMap';
import { Card, Badge, Btn, StatusBadge } from '../../../components/ui';
import { Modal } from '../../../components/Overlay';
import { DataTable } from '../../../components/DataTable';
import { fmtNum } from '../../../lib/format';
import { MetricBand, Facet } from '../parts';
import { useContinuityData, useWorkspaceData } from '../useComply';
import { useQuery, useDeepLink, useLocal, SectionHead, Toggles, CountLine, RecordDrawer, RSec, LinkedRecords, Monogram, ago, ahead } from './shared';
import { DatePicker } from '../../../components/DatePicker';

const tone = MODULE_BY_ID.comply.tone;
const CLASSES: VendorClass[] = ['Restricted', 'Confidential', 'Internal', 'Public'];
const RISKS: RecordedRisk[] = ['High', 'Medium', 'Low'];
const STATUSES: RegStatus[] = ['Draft', 'AI Draft', 'Confirmed'];
const CLAUSES: Clauses[] = ['Contract + NDA', 'In contract', 'NDA', 'None'];
const RISK_COLOR: Record<string, string> = { High: 'var(--sev-critical)', Medium: 'var(--sev-medium)', Low: 'var(--good)' };
const CLASS_COLOR: Record<string, string> = { Restricted: '#a3184e', Confidential: '#d2512f', Internal: '#2e6fdb', Public: '#7e8aa0' };
const STATUS_COLOR: Record<string, string> = { Confirmed: 'var(--good)', Draft: 'var(--sev-info)', 'AI Draft': 'var(--m-ai)' };
const first = (s: string) => s.split(/[\s(]/)[0].toLowerCase();

export default function VendorsSection() {
  const { customer: c, tenantId, toast } = useApp();
  const nav = useNavigate();
  const { p, set, go } = useQuery();
  const h = headlines(c, tenantId);
  const { vendorsReg, incidents } = useWorkspaceData();
  const { bia, assets } = useContinuityData();
  const local = useLocal();
  const all = useMemo(() => [...local.vendors, ...vendorsReg], [local.vendors, vendorsReg]);
  const grc = scopedConnectors(c, tenantId).find((k) => k.category === 'GRC');
  const src = `${grc ? `${grc.vendor} ${grc.product}` : 'HexaComply'} vendor register`;

  const cls = p('classification') ?? 'all';
  const risk = p('risk') ?? 'all';
  const status = p('status') ?? 'all';
  const overdue = p('lifecycle') === 'overdue';
  const clauses = p('clauses') ?? 'all';
  const clear = () => set({ classification: null, risk: null, status: null, lifecycle: null, clauses: null, id: null });
  const rows = all.filter((v) => (cls === 'all' || v.classification === cls) && (risk === 'all' || v.risk === risk) && (status === 'all' || v.status === status) && (!overdue || v.nextReviewDays < 0) && (clauses === 'all' || v.clauses === clauses));
  const filtered = cls !== 'all' || risk !== 'all' || status !== 'all' || overdue || clauses !== 'all';

  const [open, setOpen] = useState<VendorRec | null>(null);
  const [creating, setCreating] = useState(false);
  // Accepts the register id (VEN-…), the TPRM supplier id (VND-…) or the vendor name.
  const match = useCallback((v: VendorRec, id: string) => v.id === id || v.id === id.replace(/^VND-/, 'VEN-') || v.name.toLowerCase() === id.toLowerCase(), []);
  useDeepLink(all, match, setOpen);
  const n = (f: (v: VendorRec) => boolean) => all.filter(f).length;

  return (
    <>
      <SectionHead intro={<>Third parties, the information they touch, and the contractual and access safeguards around them. The recorded risk level is supplied by the assessor; scoring and questionnaires live on the Third-Party Risk tab.</>}
        actions={<><Btn onClick={() => nav('/comply/tprm')}>Third-Party Risk</Btn><Btn primary color={tone} onClick={() => setCreating(true)}><Plus /> New vendor</Btn></>} />
      <MetricBand tone={tone} items={[
        { ac: 'Vendors', word: 'On the register', value: fmtNum(all.length), unit: `of ${fmtNum(h.comply.vendors)} in scope`, active: !filtered, onClick: clear, source: src },
        { ac: 'High risk', word: 'Recorded', value: n((v) => v.risk === 'High'), unit: 'vendors', color: 'var(--sev-critical)', active: risk === 'High', onClick: () => { clear(); set({ risk: 'High' }); }, source: src },
        { ac: 'Restricted', word: 'Information shared', value: n((v) => v.classification === 'Restricted'), unit: 'vendors', active: cls === 'Restricted', onClick: () => { clear(); set({ classification: 'Restricted' }); }, source: src },
        { ac: 'Review overdue', word: 'Lifecycle', value: n((v) => v.nextReviewDays < 0), unit: 'vendors', color: 'var(--bad)', active: overdue, onClick: () => { clear(); set({ lifecycle: 'overdue' }); }, source: src },
        { ac: 'No clauses', word: 'Contract', value: n((v) => v.clauses === 'None'), unit: 'vendors', color: 'var(--sev-medium)', active: clauses === 'None', onClick: () => { clear(); set({ clauses: 'None' }); }, source: src },
      ]} />
      <Card flush>
        <div className="comply-facets">
          <Facet label="Classification" value={cls} onChange={(v) => set({ classification: v })} options={CLASSES.map((x) => ({ id: x as string, label: x, n: n((v) => v.classification === x) }))} />
          <Facet label="Recorded risk" value={risk} onChange={(v) => set({ risk: v })} options={RISKS.map((x) => ({ id: x as string, label: x, n: n((v) => v.risk === x) }))} />
          <Facet label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUSES.map((x) => ({ id: x as string, label: x, n: n((v) => v.status === x) }))} />
          <Facet label="Clauses" value={clauses} onChange={(v) => set({ clauses: v })} options={CLAUSES.map((x) => ({ id: x as string, label: x === 'None' ? 'None recorded' : x, n: n((v) => v.clauses === x) }))} />
          <Toggles label="Lifecycle" items={[{ label: 'Review overdue', on: overdue, onChange: (on) => set({ lifecycle: on ? 'overdue' : null }), n: n((v) => v.nextReviewDays < 0) }]} />
        </div>
        <CountLine filtered={filtered} onClear={clear}>{fmtNum(rows.length)} of {fmtNum(all.length)} vendors · recorded risk supplied by the assessor · source {src}</CountLine>
        <DataTable<VendorRec>
          rows={rows}
          rowKey={(v) => v.id}
          onRowClick={setOpen}
          search={(v) => `${v.id} ${v.name} ${v.contact.name} ${v.services} ${v.category}`}
          searchPlaceholder="Search vendors, contacts, services…"
          pageSize={25}
          initialSort={{ key: 'risk', dir: 'asc' }}
          columns={[
            { key: 'name', header: 'Vendor', sort: (v) => v.name, render: (v) => <span className="comply-vname"><Monogram name={v.name} /><span><div className="t-main">{v.name}</div><div className="t-sub"><span className="mono">{v.id}</span> · {v.contact.name}</div></span></span> },
            { key: 'svc', header: 'Services', sort: (v) => v.services, render: (v) => <><div className="t-main" style={{ fontSize: 12, maxWidth: 240, whiteSpace: 'normal' }}>{v.services}</div><div className="t-sub">{v.category}</div></> },
            { key: 'cls', header: 'Classification', sort: (v) => CLASSES.indexOf(v.classification), render: (v) => <Badge color={CLASS_COLOR[v.classification]}>{v.classification}</Badge> },
            { key: 'risk', header: 'Recorded risk', sort: (v) => RISKS.indexOf(v.risk), render: (v) => <Badge color={RISK_COLOR[v.risk]} dot>{v.risk}</Badge> },
            { key: 'cl', header: 'Clauses', sort: (v) => CLAUSES.indexOf(v.clauses), render: (v) => <span className="t-sub" style={{ color: v.clauses === 'None' ? 'var(--sev-medium)' : undefined }}>{v.clauses === 'None' ? 'None recorded' : v.clauses}</span> },
            { key: 'rev', header: 'Next review', align: 'right', sort: (v) => v.nextReviewDays, render: (v) => <span className="t-sub" style={{ color: v.nextReviewDays < 0 ? 'var(--bad)' : undefined, fontWeight: v.nextReviewDays < 0 ? 700 : undefined }}>{v.nextReviewDays < 0 ? `${-v.nextReviewDays} d overdue` : ahead(v.nextReviewDays)}</span> },
            { key: 'st', header: 'Status', sort: (v) => v.status, render: (v) => <StatusBadge value={v.status} map={STATUS_COLOR} /> },
          ]}
        />
      </Card>

      {open && (() => {
        const v = open;
        const svc = bia.filter((b) => b.suppliers.some((s) => first(s) === first(v.name) || v.name.toLowerCase().includes(first(s))));
        const inc = incidents.filter((x) => x.vendor === v.name);
        const ast = assets.filter((a) => a.base === v.name);
        const close = () => { setOpen(null); set({ id: null }); };
        return (
          <RecordDrawer id={v.id} recordId={`vendor ${v.id.toLowerCase()}`} updatedDays={Math.min(v.lastReviewDays, 60)} title={v.name}
            badges={<><Badge color={RISK_COLOR[v.risk]} solid>{v.risk} recorded risk</Badge><Badge color={CLASS_COLOR[v.classification]}>{v.classification}</Badge><StatusBadge value={v.status} map={STATUS_COLOR} /><Badge>Tier {v.tier}</Badge></>}
            onClose={close}>
            <RSec title="Engagement" rows={[['Contact', `${v.contact.name} · ${v.contact.email}`], ['Services', v.services], ['Category', v.category], ['Information shared', v.info.join(', ')], ['Classification', v.classification], ['Country', v.country]]} />
            <RSec title="Contract" rows={[['Start', ago(v.startDays)], ['End', v.endDays < 0 ? `Ended ${ago(-v.endDays)}` : ahead(v.endDays)], ['Security clauses', v.clauses === 'None' ? 'None recorded' : v.clauses], ['SLAs', v.slas], ['Compliance requirements', v.compliance.join(' · ')]]} />
            <RSec title="Access" rows={[['Rights', v.rights], ['Duration', v.duration], ['Control methods', v.methods]]} />
            <RSec title="Assurance" rows={[['Recorded risk', v.risk], ['Certifications', v.certs.join(' · ')], ['Mitigation', v.mitigation], ['Monitoring schedule', v.monitoring], ['Incident reporting', v.incident]]} />
            <RSec title="Review" rows={[['Last review', ago(v.lastReviewDays)], ['Next review', v.nextReviewDays < 0 ? <span key="n" style={{ color: 'var(--bad)', fontWeight: 700 }}>{-v.nextReviewDays} days overdue</span> : ahead(v.nextReviewDays)], ['Reviewer', v.reviewer], ['Status', v.status]]} />
            <LinkedRecords items={[
              { label: 'Third-party risk score and questionnaires', sub: 'Third-Party Risk tab', onClick: () => nav('/comply/tprm') },
              ...svc.map((b) => ({ label: `Business service: ${b.name}`, sub: `${b.id} · RTO ${b.rtoH} h`, onClick: () => go('bia', { id: b.id }) })),
              ...ast.slice(0, 1).map((a) => ({ label: `Asset ${a.id}`, sub: `${a.category} · ${a.sub}`, count: ast.length, onClick: () => go('assets', { base: a.base }) })),
              ...inc.map((x) => ({ label: `Incident ${x.id}`, sub: x.title, onClick: () => go('incidents', { id: x.id }) })),
              { label: 'Third-party risks on the register', sub: 'Risks where the vulnerability is supplier due diligence', onClick: () => go('risks', { q: 'third-party' }) },
            ]} />
          </RecordDrawer>
        );
      })()}

      {creating && <NewVendorModal count={all.length} c={c} onClose={() => setCreating(false)} onSave={(v) => { local.addVendor(v); setCreating(false); toast(`${v.id} ${v.name} added as a draft vendor · assessor to record the risk level`); clear(); }} />}
    </>
  );
}

function NewVendorModal({ c, count, onClose, onSave }: { c: import('../../../data/types').CustomerProfile; count: number; onClose: () => void; onSave: (v: VendorRec) => void }) {
  const [f, setF] = useState({ name: '', services: '', contact: '', email: '', classification: 'Internal' as VendorClass, info: [] as string[], clauses: 'In contract' as Clauses, tier: '2', end: '', review: '' });
  const up = <K extends keyof typeof f>(k: K, val: (typeof f)[K]) => setF((x) => ({ ...x, [k]: val }));
  const infos = forCustomer(VENDOR_INFO_TYPES, c);
  const missing = [f.name.trim(), f.services.trim()].filter((x) => !x).length;
  const save = () => {
    if (missing) return;
    const end = f.end ? Math.round((new Date(f.end).getTime() - Date.now()) / 86400000) : 365;
    const review = f.review ? Math.round((new Date(f.review).getTime() - Date.now()) / 86400000) : 30;
    onSave({
      id: `VEN-${2000 + count}`, name: f.name.trim(), category: 'New supplier', tier: Number(f.tier) as 1 | 2 | 3, country: '—', contact: { name: f.contact || 'Not recorded', email: f.email || '—' },
      services: f.services.trim(), info: f.info.length ? f.info : ['Internal'], classification: f.classification, risk: 'Medium', clauses: f.clauses, nextReviewDays: review, status: 'Draft',
      startDays: 0, endDays: end, slas: 'Not recorded', compliance: [], rights: 'Not recorded', duration: 'Not recorded', methods: 'Not recorded', certs: ['None on file'],
      mitigation: 'Not recorded', monitoring: 'To be set by the assessor', incident: 'Not recorded', lastReviewDays: 0, reviewer: c.people.grcLead.name, tenants: [], local: true,
    });
  };
  return (
    <Modal title="New vendor" sub="Saved as a draft; the assessor records the risk level after review." onClose={onClose}
      footer={<><span className={`cmp-req ${missing ? '' : 'ok'}`}>{missing ? `${missing} required field${missing === 1 ? '' : 's'} to go` : 'Ready to save'}</span><span className="spacer" /><Btn onClick={onClose}>Cancel <span className="cmp-kbd">Esc</span></Btn><Btn primary color={tone} disabled={!!missing} onClick={save}><Save /> Save <span className="cmp-kbd">Ctrl+Enter</span></Btn></>}>
      <div className="cmp-form" onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } }}>
        <div className="cmp-form-sec">
          <h5>Engagement</h5>
          <div className="cmp-fgrid">
            <label className="cmp-f"><span>Vendor name <b>*</b></span><input className="input" autoFocus value={f.name} onChange={(e) => up('name', e.target.value)} /></label>
            <label className="cmp-f"><span>Services <b>*</b></span><input className="input" value={f.services} onChange={(e) => up('services', e.target.value)} placeholder="What they do for us" /></label>
            <label className="cmp-f"><span>Contact</span><input className="input" value={f.contact} onChange={(e) => up('contact', e.target.value)} /></label>
            <label className="cmp-f"><span>Contact email</span><input className="input" type="email" value={f.email} onChange={(e) => up('email', e.target.value)} /></label>
            <label className="cmp-f"><span>Classification</span><select className="select" value={f.classification} onChange={(e) => up('classification', e.target.value as VendorClass)}>{CLASSES.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="cmp-f"><span>Tier</span><select className="select" value={f.tier} onChange={(e) => up('tier', e.target.value)}><option value="1">Tier 1 · critical</option><option value="2">Tier 2</option><option value="3">Tier 3</option></select></label>
          </div>
          <div className="comply-facet" style={{ marginTop: 10 }}>
            <span className="comply-facet-l">Information shared</span>
            <div className="comply-facet-opts">{infos.map((x) => <button key={x} type="button" className={`comply-fchip ${f.info.includes(x) ? 'on' : ''}`} onClick={() => up('info', f.info.includes(x) ? f.info.filter((y) => y !== x) : [...f.info, x])}>{x}</button>)}</div>
          </div>
        </div>
        <div className="cmp-form-sec">
          <h5>Contract</h5>
          <div className="cmp-fgrid g3">
            <label className="cmp-f"><span>Security clauses</span><select className="select" value={f.clauses} onChange={(e) => up('clauses', e.target.value as Clauses)}>{CLAUSES.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="cmp-f"><span>Contract end</span><DatePicker value={f.end} onChange={(v) => up('end', v)} /></label>
            <label className="cmp-f"><span>Next review</span><DatePicker value={f.review} onChange={(v) => up('review', v)} /></label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
