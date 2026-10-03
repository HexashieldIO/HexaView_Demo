import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Plus, Save } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { scopedConnectors } from '../../../data/customers';
import { MODULE_BY_ID } from '../../../modules/registry';
import { ASSET_CATEGORIES, EQUIPMENT_SUB, type AssetCategory, type AssetClass, type AssetStatus, type CiaLevel, type RegAsset } from '../../../data/modules/comply';
import { assetDetail } from '../../../data/modules/complyRegisters';
import type { CustomerProfile } from '../../../data/types';
import { Card, Badge, Btn, StatusBadge } from '../../../components/ui';
import { Modal } from '../../../components/Overlay';
import { DataTable } from '../../../components/DataTable';
import { fmtNum } from '../../../lib/format';
import { MetricBand, Facet } from '../parts';
import { useContinuityData, useRiskData, useWorkspaceData } from '../useComply';
import { useQuery, useDeepLink, useLocal, SectionHead, Toggles, CountLine, RecordDrawer, RSec, LinkedRecords, Cia, LEVEL_WORD, ago, ahead } from './shared';

const tone = MODULE_BY_ID.comply.tone;
const STATUSES: AssetStatus[] = ['Active', 'Planned', 'Retired', 'Legacy'];
const CLASSES: AssetClass[] = ['Physical', 'Digital', 'HR', 'Logical'];
const CRITS: RegAsset['criticality'][] = ['Critical', 'Moderate', 'Non-Critical'];
const CRIT_COLOR: Record<string, string> = { Critical: 'var(--sev-critical)', Moderate: 'var(--sev-medium)', 'Non-Critical': 'var(--text-muted)' };
const STATUS_COLOR: Record<string, string> = { Active: 'var(--good)', Planned: 'var(--m-matrix)', Retired: 'var(--sev-info)', Legacy: 'var(--sev-high)', Draft: 'var(--sev-medium)' };
const DEPTS = ['Company-wide IT', 'Finance & reporting', 'Operations', 'Engineering', 'Sales & marketing', 'HR & payroll', 'Security', 'Customer support'];
const isEos = (a: RegAsset) => a.supportEndDays !== null && a.supportEndDays < 0 && (a.status === 'Active' || a.status === 'Legacy');

function subOptions(c: CustomerProfile, cat: AssetCategory | ''): string[] {
  switch (cat) {
    case 'Applications & Databases': return ['Line-of-business application', 'Database', 'Integration / middleware'];
    case 'Documentation': return ['Plan', 'Policy & procedure', 'Design documentation'];
    case 'Hardware': return ['End-user device', 'Network device', 'Server hardware', 'Storage'];
    case 'IT/Communication & Other Equipment': return [EQUIPMENT_SUB[c.id], 'Telephony & radio', 'Building systems'];
    case 'Information': return ['Confidential information', 'Personal data', 'Intellectual property'];
    case 'Infrastructure': return ['Server', 'Virtualisation host', 'Cloud account'];
    case 'Outsourced Services': return [...new Set(c.thirdParties.map((t) => t.category))];
    case 'People': return ['Key person', 'Privileged user group', 'Workforce group'];
    case 'SaaS': return ['Security tooling', 'Business SaaS'];
    case 'Software': return ['Endpoint software', 'Operating system image', 'Engineering tooling'];
    default: return [];
  }
}

export default function AssetsSection() {
  const { customer: c, tenantId, toast } = useApp();
  const { p, set, go } = useQuery();
  const { assets: base, bia } = useContinuityData();
  const risks = useRiskData();
  const { incidents } = useWorkspaceData();
  const local = useLocal();
  const assets = useMemo(() => [...local.assets, ...base], [local.assets, base]);
  const grc = scopedConnectors(c, tenantId).find((k) => k.category === 'GRC');
  const src = `${grc ? `${grc.vendor} ${grc.product}` : 'HexaComply'} asset register · ${scopedConnectors(c, tenantId).filter((k) => k.category === 'Asset / CMDB' || k.category === 'ITSM').map((k) => k.product).slice(0, 2).join(', ') || 'CMDB'}`;

  const status = p('status') ?? 'all';
  const cls = p('class') ?? 'all';
  const cat = p('category') ?? 'all';
  const crit = p('criticality') ?? 'all';
  const eos = p('lifecycle') === 'eos';
  const baseName = p('base');
  const confH = p('conf') === 'H';
  const clear = () => set({ status: null, class: null, category: null, criticality: null, lifecycle: null, base: null, conf: null, id: null });
  const rows = assets.filter((a) => (status === 'all' || a.status === status) && (cls === 'all' || a.cls === cls) && (cat === 'all' || a.category === cat) && (crit === 'all' || a.criticality === crit) && (!eos || isEos(a)) && (!baseName || a.base === baseName) && (!confH || a.cia[0] === 'H'));
  const filtered = status !== 'all' || cls !== 'all' || cat !== 'all' || crit !== 'all' || eos || !!baseName || confH;

  const [open, setOpen] = useState<RegAsset | null>(null);
  const [creating, setCreating] = useState(false);
  const match = useCallback((a: RegAsset, id: string) => a.id === id, []);
  useDeepLink(assets, match, setOpen);
  const eosN = assets.filter(isEos).length;
  const n = (f: (a: RegAsset) => boolean) => assets.filter(f).length;

  return (
    <>
      <SectionHead intro={<>Everything <b>{c.name}</b> holds — people, software, hardware, {c.id === 'healthcare' ? 'medical devices' : 'OT'} and information — with CIA levels and business criticality. Records reconcile with the CMDB; risks and business services link back here.</>}
        actions={<Btn primary color={tone} onClick={() => setCreating(true)}><Plus /> New asset</Btn>} />
      <MetricBand tone={tone} items={[
        { ac: 'Assets', word: 'On the register', value: fmtNum(assets.length), unit: `${n((a) => a.status === 'Active')} active`, active: !filtered, onClick: clear, source: src },
        { ac: 'Critical', word: 'Business criticality', value: n((a) => a.criticality === 'Critical'), unit: 'assets', color: 'var(--sev-critical)', active: crit === 'Critical', onClick: () => { clear(); set({ criticality: 'Critical' }); }, source: src },
        { ac: 'Past support end', word: 'Still in use', value: eosN, unit: 'assets', color: 'var(--bad)', active: eos, onClick: () => { clear(); set({ lifecycle: 'eos' }); }, source: src },
        { ac: 'Legacy', word: 'Status', value: n((a) => a.status === 'Legacy'), unit: 'assets', active: status === 'Legacy', onClick: () => { clear(); set({ status: 'Legacy' }); }, source: src },
        { ac: 'High confidentiality', word: 'C = H', value: n((a) => a.cia[0] === 'H'), unit: 'assets', active: confH, onClick: () => { clear(); set({ conf: 'H' }); }, source: src },
      ]} />
      <Card flush>
        <div className="comply-facets">
          <Facet label="Status" value={status} onChange={(v) => set({ status: v })} options={[...STATUSES, ...(local.assets.length ? ['Draft' as AssetStatus] : [])].map((s) => ({ id: s as string, label: s, n: n((a) => a.status === s) }))} />
          <Facet label="Class" value={cls} onChange={(v) => set({ class: v })} options={CLASSES.map((s) => ({ id: s as string, label: s, n: n((a) => a.cls === s) }))} />
          <Facet label="Category" value={cat} onChange={(v) => set({ category: v })} options={ASSET_CATEGORIES.filter((k) => n((a) => a.category === k)).map((s) => ({ id: s as string, label: s, n: n((a) => a.category === s) }))} />
          <Facet label="Criticality" value={crit} onChange={(v) => set({ criticality: v })} options={CRITS.map((s) => ({ id: s as string, label: s, n: n((a) => a.criticality === s) }))} />
          {confH && <Facet label="Confidentiality" value="H" onChange={() => set({ conf: null })} options={[{ id: 'H', label: 'High' }]} />}
          {baseName && <Facet label="Asset" value={baseName} onChange={() => set({ base: null })} options={[{ id: baseName, label: baseName }]} />}
          <Toggles label="Lifecycle" items={[{ label: 'Past support end', on: eos, onChange: (on) => set({ lifecycle: on ? 'eos' : null }), n: eosN }]} />
        </div>
        <CountLine filtered={filtered} onClear={clear}>{fmtNum(rows.length)} of {fmtNum(assets.length)} assets · CIA levels and criticality set by the asset owner · source {src}</CountLine>
        <DataTable<RegAsset>
          rows={rows}
          rowKey={(a) => a.id}
          onRowClick={setOpen}
          search={(a) => `${a.id} ${a.name} ${a.category} ${a.sub} ${a.owner}`}
          searchPlaceholder="Search assets…"
          initialSort={eos ? { key: 'eos', dir: 'asc' } : undefined}
          pageSize={25}
          columns={[
            { key: 'name', header: 'Asset', sort: (a) => a.id, render: (a) => <><div className="t-main" style={{ maxWidth: 380, whiteSpace: 'normal' }}>{a.name}</div><div className="t-sub mono">{a.id}</div></> },
            { key: 'cat', header: 'Category', sort: (a) => a.category, render: (a) => <><div className="t-main" style={{ fontSize: 12 }}>{a.category}</div><div className="t-sub">{a.sub}</div></> },
            { key: 'cls', header: 'Class', sort: (a) => a.cls, render: (a) => <span className="t-sub">{a.cls}</span> },
            { key: 'crit', header: 'Criticality', sort: (a) => CRITS.indexOf(a.criticality), render: (a) => <Badge color={CRIT_COLOR[a.criticality]} dot>{a.criticality}</Badge> },
            { key: 'cia', header: 'C · I · A', render: (a) => <Cia v={a.cia} /> },
            { key: 'eos', header: 'Support end', align: 'right', sort: (a) => a.supportEndDays ?? 99999, render: (a) => (a.supportEndDays === null ? <span className="t-sub">—</span> : <span className="t-sub" style={{ color: isEos(a) ? 'var(--bad)' : undefined, fontWeight: isEos(a) ? 700 : undefined }}>{a.supportEndDays < 0 ? ago(-a.supportEndDays) : ahead(a.supportEndDays)}</span>) },
            { key: 'status', header: 'Status', sort: (a) => a.status, render: (a) => <StatusBadge value={a.status} map={STATUS_COLOR} /> },
          ]}
        />
      </Card>

      {open && (() => {
        const a = open;
        const d = assetDetail(c, a, base);
        const ar = risks.filter((r) => r.asset === a.base);
        const svc = bia.filter((b) => b.systems.some((s) => a.base.toLowerCase().includes(s.split(' ')[0].toLowerCase()) || s.toLowerCase().includes(a.base.split(' ')[0].toLowerCase())));
        const inc = incidents.filter((x) => x.asset === a.base);
        const sameBase = assets.filter((x) => x.base === a.base).length;
        const close = () => { setOpen(null); set({ id: null }); };
        return (
          <RecordDrawer id={a.id} recordId={`asset ${a.id.toLowerCase().replace('ast-', 'ast-n')}`} updatedDays={(parseInt(a.id.slice(-3), 10) * 7) % 90} title={a.name}
            badges={<><StatusBadge value={a.status} map={STATUS_COLOR} /><Badge color={CRIT_COLOR[a.criticality]}>{a.criticality}</Badge><Badge>{a.category}</Badge>{isEos(a) && <Badge color="var(--bad)" solid>Past support end</Badge>}</>}
            onClose={close}>
            <RSec title="Classification" rows={[
              ['Category', a.category], ['Sub-category', a.sub], ['Class', a.cls], ['Business criticality', a.criticality],
              ['Confidentiality', LEVEL_WORD[a.cia[0]]], ['Integrity', LEVEL_WORD[a.cia[1]]], ['Availability', LEVEL_WORD[a.cia[2]]], ['C · I · A', <Cia key="c" v={a.cia} />],
              ['Exposure to external networks', d.exposure ? 'Yes — reachable from outside' : 'No'], ['Relevant regulations', d.regulations.join(' · ')],
              ['Legacy', d.legacy ? 'Yes' : 'No'], ['Unique (no substitute)', d.unique ? 'Yes' : 'No'],
            ]} />
            <RSec title="Ownership & location" rows={[['Owner', a.owner], ['Responsible manager', d.manager], ['Location', d.location], ['Business function', a.department]]} />
            <RSec title="Lifecycle" rows={[
              ['Issue date', ago(d.issuedDays)], ['Support end', a.supportEndDays === null ? 'Not applicable' : a.supportEndDays < 0 ? <span key="e" style={{ color: 'var(--bad)', fontWeight: 700 }}>{ago(-a.supportEndDays)} · {-a.supportEndDays} days ago</span> : ahead(a.supportEndDays)],
              ['Decommissioning', d.decommissionDays === null ? 'Not planned' : d.decommissionDays < 0 ? `Done ${ago(-d.decommissionDays)}` : `Planned ${ahead(d.decommissionDays)}`],
              ['Retention', d.retention], ['Disposal', d.disposal], ['Backup status', d.backup],
            ]} />
            <RSec title="Continuity" rows={[['Requirements', d.continuity], ['Interdependencies', d.interdeps.join(' · ') || 'None recorded'], ['Documentation', d.documentation]]} />
            <LinkedRecords items={[
              { label: ar.length ? `View the ${ar.length} risk${ar.length === 1 ? '' : 's'} raised against this asset →` : 'View risks raised against this asset →', sub: ar.length ? `Highest residual ${Math.max(...ar.map((r) => r.residualScore ?? r.inherentScore))}` : 'None raised yet', count: ar.length, onClick: () => go('risks', { asset: a.base }) },
              ...svc.slice(0, 3).map((b) => ({ label: `Business service: ${b.name}`, sub: `${b.id} · criticality ${b.criticality}`, onClick: () => go('bia', { id: b.id }) })),
              ...inc.map((x) => ({ label: `Incident ${x.id}`, sub: x.title, onClick: () => go('incidents', { id: x.id }) })),
              ...(sameBase > 1 ? [{ label: `${sameBase} records of ${a.base}`, sub: 'Same asset across departments', count: sameBase, onClick: () => { close(); set({ base: a.base }); } }] : []),
            ]} />
          </RecordDrawer>
        );
      })()}

      {creating && <NewAssetModal c={c} count={assets.length} onClose={() => setCreating(false)} onSave={(a) => { local.addAsset(a); setCreating(false); toast(`${a.id} ${a.name} saved as a draft asset · owner ${a.owner}`); set({ status: null, id: null }); }} />}
    </>
  );
}

function F({ label, req, children }: { label: string; req?: boolean; children: ReactNode }) {
  return <label className="cmp-f"><span>{label}{req && <b> *</b>}</span>{children}</label>;
}

function NewAssetModal({ c, count, onClose, onSave }: { c: CustomerProfile; count: number; onClose: () => void; onSave: (a: RegAsset) => void }) {
  const people = [c.people.grcLead, c.people.ciso, c.people.socLead, c.people.admin, ...(c.people.otLead ? [c.people.otLead] : []), ...c.people.staff].map((x) => x.name);
  const [f, setF] = useState({
    name: '', category: '' as AssetCategory | '', sub: '', cls: 'Digital' as AssetClass, status: 'Planned' as AssetStatus,
    owner: people[0], manager: people[3], tenant: c.tenants[0].id, dept: DEPTS[0],
    c: 'M' as CiaLevel, i: 'M' as CiaLevel, a: 'M' as CiaLevel, crit: 'Moderate' as RegAsset['criticality'], external: false, legacy: false, unique: false, regs: [] as string[],
    issue: '', supportEnd: '', decom: '', retention: '', disposal: '', backup: 'Backed up', warranty: '', lastReview: '', nextReview: '', contract: '',
    continuity: '', interdeps: '', docs: '',
  });
  const up = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const missing = [f.name.trim(), f.category, f.sub].filter((x) => !x).length;
  const save = () => {
    if (missing) return;
    const days = f.supportEnd ? Math.round((new Date(f.supportEnd).getTime() - Date.now()) / 86400000) : null;
    onSave({
      id: `AST-${String(count + 1).padStart(4, '0')}`, name: f.name.trim(), base: f.name.trim(), category: f.category as AssetCategory, sub: f.sub, cls: f.cls, criticality: f.crit,
      cia: [f.c, f.i, f.a], supportEndDays: days, status: 'Draft', owner: f.owner, tenant: f.tenant, department: f.dept,
    });
  };
  const lvl = (k: 'c' | 'i' | 'a', label: string) => (
    <F label={label}><select className="select" value={f[k]} onChange={(e) => up(k, e.target.value as CiaLevel)}>{(['L', 'M', 'H'] as CiaLevel[]).map((v) => <option key={v} value={v}>{LEVEL_WORD[v]}</option>)}</select></F>
  );
  const date = (k: 'issue' | 'supportEnd' | 'decom' | 'warranty' | 'lastReview' | 'nextReview', label: string) => <F label={label}><input type="date" className="input" value={f[k]} onChange={(e) => up(k, e.target.value)} /></F>;
  return (
    <Modal title="New asset" sub="Saved as a draft on the register; the owner confirms classification." onClose={onClose}
      footer={<>
        <span className={`cmp-req ${missing ? '' : 'ok'}`}>{missing ? `${missing} required field${missing === 1 ? '' : 's'} to go` : 'Ready to save'}</span>
        <span className="spacer" />
        <Btn onClick={onClose}>Cancel <span className="cmp-kbd">Esc</span></Btn>
        <Btn primary color={tone} disabled={!!missing} onClick={save}><Save /> Save <span className="cmp-kbd">Ctrl+Enter</span></Btn>
      </>}>
      <div className="cmp-form" onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } }}>
        <div className="cmp-form-sec">
          <h5>What it is</h5>
          <div className="cmp-fgrid">
            <F label="Name" req><input className="input" autoFocus value={f.name} onChange={(e) => up('name', e.target.value)} placeholder={`e.g. ${c.vocab.crownJewels[0]}`} /></F>
            <F label="Category" req><select className="select" value={f.category} onChange={(e) => setF((x) => ({ ...x, category: e.target.value as AssetCategory, sub: '' }))}><option value="">Choose…</option>{ASSET_CATEGORIES.map((k) => <option key={k}>{k}</option>)}</select></F>
            <F label="Sub-category" req><select className="select" value={f.sub} disabled={!f.category} onChange={(e) => up('sub', e.target.value)}><option value="">{f.category ? 'Choose…' : 'Pick a category first'}</option>{subOptions(c, f.category).map((k) => <option key={k}>{k}</option>)}</select></F>
            <F label="Class"><select className="select" value={f.cls} onChange={(e) => up('cls', e.target.value as AssetClass)}>{CLASSES.map((k) => <option key={k}>{k}</option>)}</select></F>
            <F label="Status"><select className="select" value={f.status} onChange={(e) => up('status', e.target.value as AssetStatus)}>{STATUSES.map((k) => <option key={k}>{k}</option>)}</select></F>
          </div>
        </div>
        <div className="cmp-form-sec">
          <h5>Who owns it</h5>
          <div className="cmp-fgrid">
            <F label="Owner"><select className="select" value={f.owner} onChange={(e) => up('owner', e.target.value)}>{people.map((k) => <option key={k}>{k}</option>)}</select></F>
            <F label="Responsible manager"><select className="select" value={f.manager} onChange={(e) => up('manager', e.target.value)}>{people.map((k) => <option key={k}>{k}</option>)}</select></F>
            <F label="Location"><select className="select" value={f.tenant} onChange={(e) => up('tenant', e.target.value)}>{c.tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></F>
            <F label="Business function"><select className="select" value={f.dept} onChange={(e) => up('dept', e.target.value)}>{DEPTS.map((k) => <option key={k}>{k}</option>)}</select></F>
          </div>
        </div>
        <div className="cmp-form-sec">
          <h5>Classification</h5>
          <div className="cmp-fgrid g3">
            {lvl('c', 'Confidentiality')}{lvl('i', 'Integrity')}{lvl('a', 'Availability')}
            <F label="Business criticality"><select className="select" value={f.crit} onChange={(e) => up('crit', e.target.value as RegAsset['criticality'])}>{CRITS.map((k) => <option key={k}>{k}</option>)}</select></F>
          </div>
          <div className="cmp-checks" style={{ marginTop: 10 }}>
            <label><input type="checkbox" checked={f.external} onChange={(e) => up('external', e.target.checked)} /> Reachable from outside</label>
            <label><input type="checkbox" checked={f.legacy} onChange={(e) => up('legacy', e.target.checked)} /> Legacy</label>
            <label><input type="checkbox" checked={f.unique} onChange={(e) => up('unique', e.target.checked)} /> Unique (no substitute)</label>
          </div>
          <div className="comply-facet" style={{ marginTop: 10 }}>
            <span className="comply-facet-l">Relevant regulations</span>
            <div className="comply-facet-opts">{c.frameworks.map((fw) => <button key={fw.id} type="button" className={`comply-fchip ${f.regs.includes(fw.short) ? 'on' : ''}`} onClick={() => up('regs', f.regs.includes(fw.short) ? f.regs.filter((x) => x !== fw.short) : [...f.regs, fw.short])}>{fw.short}</button>)}</div>
          </div>
        </div>
        <div className="cmp-form-sec">
          <h5>Lifecycle</h5>
          <div className="cmp-fgrid">
            {date('issue', 'Issue date')}{date('supportEnd', 'Support end')}{date('decom', 'Decommissioning date')}{date('warranty', 'Warranty end')}
            <F label="Retention period"><input className="input" value={f.retention} onChange={(e) => up('retention', e.target.value)} placeholder="e.g. 7 years" /></F>
            <F label="Disposal method"><select className="select" value={f.disposal} onChange={(e) => up('disposal', e.target.value)}><option value="">Choose…</option>{['Certified wipe (NIST 800-88)', 'Physical destruction with certificate', 'Secure deletion by supplier', 'Return to lessor'].map((k) => <option key={k}>{k}</option>)}</select></F>
            <F label="Backup status"><select className="select" value={f.backup} onChange={(e) => up('backup', e.target.value)}>{['Backed up · immutable copy', 'Backed up', 'Not backed up', 'Not applicable'].map((k) => <option key={k}>{k}</option>)}</select></F>
            {date('lastReview', 'Last review')}{date('nextReview', 'Next review')}
            <F label="Licence / contract reference"><input className="input" value={f.contract} onChange={(e) => up('contract', e.target.value)} placeholder="e.g. PO-2026-0412" /></F>
          </div>
        </div>
        <div className="cmp-form-sec">
          <h5>Continuity</h5>
          <div className="cmp-fgrid">
            <F label="Continuity requirements"><input className="input" value={f.continuity} onChange={(e) => up('continuity', e.target.value)} placeholder="e.g. restore within 8 h" /></F>
            <F label="Interdependencies"><input className="input" value={f.interdeps} onChange={(e) => up('interdeps', e.target.value)} placeholder="Systems this depends on" /></F>
            <F label="Documentation"><input className="input" value={f.docs} onChange={(e) => up('docs', e.target.value)} placeholder="Where the runbook lives" /></F>
          </div>
        </div>
      </div>
    </Modal>
  );
}
