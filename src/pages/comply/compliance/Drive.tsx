import { useMemo, useState } from 'react';
import { File, FileImage, FileSpreadsheet, FileText, Folder, FolderPlus, Paperclip, RefreshCw, Upload } from 'lucide-react';
import { useApp } from '../../../state/AppContext';
import { scopedConnectors } from '../../../data/customers';
import { MODULE_BY_ID } from '../../../modules/registry';
import { taskState, type ComplyTask } from '../../../data/modules/comply';
import type { DriveItem, DriveType } from '../../../data/modules/complyRegisters';
import { Card, Badge, Btn, StatusBadge } from '../../../components/ui';
import { Modal } from '../../../components/Overlay';
import { DataTable } from '../../../components/DataTable';
import { fmtNum } from '../../../lib/format';
import { MetricBand } from '../parts';
import { useComplyData, useWorkspaceData } from '../useComply';
import { useQuery, useLocal, SectionHead, ago, ahead } from './shared';

const tone = MODULE_BY_ID.comply.tone;
const STATUS_COLOR: Record<string, string> = { accepted: 'var(--good)', uploaded: 'var(--m-matrix)', scanning: 'var(--sev-medium)', failed: 'var(--bad)' };
const STATUS_LABEL: Record<string, string> = { accepted: 'accepted', uploaded: 'uploaded', scanning: 'scanning', failed: 'processing failed' };
const MAX_KB = 10 * 1024;

function Icon({ d }: { d: DriveItem }) {
  if (d.kind === 'folder') return <Folder size={16} />;
  if (d.type === 'PNG') return <FileImage size={16} />;
  if (d.type === 'XLSX' || d.type === 'CSV') return <FileSpreadsheet size={16} />;
  if (d.type === 'PDF' || d.type === 'DOCX') return <FileText size={16} />;
  return <File size={16} />;
}

export default function DriveSection() {
  const { customer: c, tenantId, toast } = useApp();
  const { p, set, go } = useQuery();
  const { drive: base } = useWorkspaceData();
  const { tasks } = useComplyData();
  const local = useLocal();
  const items = useMemo(() => [...base, ...local.drive], [base, local.drive]);
  const grc = scopedConnectors(c, tenantId).find((k) => k.category === 'GRC');
  const src = `${grc ? `${grc.vendor} ${grc.product}` : 'HexaComply'} Drive`;
  const folderId = p('folder');
  const folder = items.find((d) => d.id === folderId && d.kind === 'folder') ?? null;
  const here = items.filter((d) => d.parent === (folder?.id ?? null));
  const childCount = (id: string) => items.filter((d) => d.parent === id).length;
  const files = items.filter((d) => d.kind === 'file');
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const [newFolder, setNewFolder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attach, setAttach] = useState<DriveItem | null>(null);
  const [folderName, setFolderName] = useState('');

  const addFiles = (list: { name: string; sizeKb: number }[]) => {
    list.forEach((f, i) => {
      const ext = (f.name.split('.').pop() ?? 'pdf').toUpperCase();
      const type: DriveType = (['PDF', 'PNG', 'DOCX', 'XLSX', 'CSV'] as DriveType[]).includes(ext as DriveType) ? (ext as DriveType) : 'PDF';
      const id = `DOC-U${Date.now().toString(36)}${i}`;
      local.addDrive({ id, parent: folder?.id ?? null, kind: 'file', name: f.name.replace(/\.[^.]+$/, ''), filename: f.name, type, sizeKb: f.sizeKb, status: 'scanning', createdDays: 0, modifiedDays: 0 });
      window.setTimeout(() => local.patchDrive(id, { status: 'accepted' }), 2600 + i * 400);
    });
    toast(`${list.length} file${list.length === 1 ? '' : 's'} uploaded to ${folder?.name ?? c.short} · scanning before evidence can reference ${list.length === 1 ? 'it' : 'them'}`);
  };

  return (
    <>
      <SectionHead intro={<>Every document {c.short} holds. <b>Evidences</b> carries the files attached to compliance evidence — those rows show the task they satisfy and when they expire. The rest is yours to organise.</>}
        actions={<>
          <Btn onClick={() => toast(`Drive refreshed · ${fmtNum(files.length)} files in sync with ${src}`)}><RefreshCw /> Refresh</Btn>
          <Btn onClick={() => { setFolderName(''); setNewFolder(true); }}><FolderPlus /> New folder</Btn>
          <Btn primary color={tone} onClick={() => setUploading(true)}><Upload /> Upload</Btn>
        </>} />
      <MetricBand tone={tone} items={[
        { ac: 'Documents', word: 'Held', value: fmtNum(files.length), unit: `${items.filter((d) => d.kind === 'folder').length} folders`, active: !folderId, onClick: () => set({ folder: null }), source: src },
        { ac: 'Evidences', word: 'Attached to evidence', value: fmtNum(files.filter((d) => d.parent === 'f-ev').length), unit: 'files', active: folderId === 'f-ev', onClick: () => set({ folder: 'f-ev' }), source: src },
        { ac: 'Expiring', word: 'Within 30 days', value: files.filter((d) => d.expiresDays !== undefined && d.expiresDays >= 0 && d.expiresDays <= 30).length, unit: 'evidence files', color: 'var(--sev-medium)', onClick: () => go('tasks', { view: 'evidence', state: 'approved', expiring: '30' }), source: src },
        { ac: 'Failed', word: 'Processing', value: files.filter((d) => d.status === 'failed').length, unit: 'files', color: 'var(--bad)', onClick: () => go('tasks', { view: 'evidence', state: 'failed' }), source: src },
      ]} />
      <Card flush>
        <div className="cmp-crumb">
          {folder ? <button type="button" onClick={() => set({ folder: null })}>{c.name}</button> : <b>{c.name}</b>}
          {folder && <><span className="muted">›</span><b>{folder.name}</b></>}
          <em>{here.filter((d) => d.kind === 'folder').length} folders · {here.filter((d) => d.kind === 'file').length} files{folder?.system ? ' · attached to evidence, managed by HexaComply' : ''}</em>
        </div>
        <DataTable<DriveItem>
          rows={here}
          rowKey={(d) => d.id}
          onRowClick={(d) => (d.kind === 'folder' ? set({ folder: d.id }) : setAttach(d))}
          search={(d) => `${d.name} ${d.filename ?? ''} ${d.taskRef ?? ''}`}
          searchPlaceholder="Search this folder…"
          pageSize={30}
          initialSort={{ key: 'name', dir: 'asc' }}
          columns={[
            { key: 'name', header: 'Name', sort: (d) => `${d.kind === 'folder' ? 0 : 1}${d.name}`, render: (d) => <span className={`cmp-fname ${d.kind}`}><Icon d={d} /><span><div className="t-main">{d.name}</div><div className="t-sub">{d.kind === 'folder' ? `${childCount(d.id)} items${d.system ? ' · attached to evidence' : ''}` : `${d.filename} · ${fmtNum(d.sizeKb ?? 0)} KB`}</div></span></span> },
            { key: 'exp', header: 'Expiry date', sort: (d) => d.expiresDays ?? 99999, render: (d) => (d.expiresDays === undefined ? <span className="t-sub">—</span> : <span className="t-sub" style={{ color: d.expiresDays < 0 ? 'var(--bad)' : d.expiresDays <= 30 ? 'var(--sev-medium)' : undefined }}>{d.expiresDays < 0 ? `expired ${ago(-d.expiresDays)}` : ahead(d.expiresDays)}</span>) },
            { key: 'task', header: 'Task', sort: (d) => d.taskRef ?? '', render: (d) => (d.taskId ? <button type="button" className="link" onClick={(e) => { e.stopPropagation(); go('tasks', { id: d.taskId! }); }}>{d.taskRef}</button> : <span className="t-sub">—</span>) },
            { key: 'type', header: 'Type', sort: (d) => d.type ?? '', render: (d) => (d.kind === 'folder' ? <span className="t-sub">Folder</span> : <span className="cmp-ftype">{d.type}</span>) },
            { key: 'st', header: 'Status', sort: (d) => d.status ?? '', render: (d) => (d.status ? <StatusBadge value={STATUS_LABEL[d.status]} map={{ [STATUS_LABEL[d.status]]: STATUS_COLOR[d.status] }} /> : <span className="t-sub">—</span>) },
            { key: 'cr', header: 'Created', align: 'right', sort: (d) => -d.createdDays, render: (d) => <span className="t-sub">{d.createdDays === 0 ? 'today' : ago(d.createdDays)}</span> },
            { key: 'mod', header: 'Modified', align: 'right', sort: (d) => -d.modifiedDays, render: (d) => <span className="t-sub">{d.modifiedDays === 0 ? 'today' : ago(d.modifiedDays)}</span> },
            { key: 'act', header: 'Actions', render: (d) => (d.kind === 'folder'
              ? <Btn sm onClick={() => set({ folder: d.id })}>Open</Btn>
              : <Btn sm disabled={d.status === 'failed' || d.status === 'scanning'} title={d.status === 'scanning' ? 'Scanning: available once accepted' : d.status === 'failed' ? 'Processing failed: upload again' : 'Attach to a task as evidence'} onClick={() => setAttach(d)}><Paperclip /> Attach</Btn>) },
          ]}
        />
        <div className="cmp-foot">Uploads are capped at 10 MB per file and are scanned before evidence can reference them. Files under Evidences are managed by HexaComply.</div>
      </Card>

      {newFolder && (
        <Modal title="New folder" sub={`In ${folder?.name ?? c.name}`} onClose={() => setNewFolder(false)}
          footer={<><Btn onClick={() => setNewFolder(false)}>Cancel</Btn><Btn primary color={tone} disabled={!folderName.trim()} onClick={() => {
            local.addDrive({ id: `f-u${Date.now().toString(36)}`, parent: null, kind: 'folder', name: folderName.trim(), createdDays: 0, modifiedDays: 0 });
            toast(`Folder "${folderName.trim()}" created`); setNewFolder(false);
          }}><FolderPlus /> Create</Btn></>}>
          <label className="cmp-f"><span>Folder name</span><input className="input" autoFocus value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="e.g. Q4 access reviews" /></label>
          {folder && <span className="muted" style={{ fontSize: 12 }}>Folders sit at the top level of Drive.</span>}
        </Modal>
      )}
      {uploading && <UploadModal folder={folder?.name ?? c.name} onClose={() => setUploading(false)} onUpload={(l) => { addFiles(l); setUploading(false); }} />}
      {attach && <AttachModal file={attach} tasks={tasks} taskById={taskById} onClose={() => setAttach(null)} onAttach={(t, comment) => {
        local.addEvidence({ id: `EV-N${String(local.evidence.length + 1).padStart(4, '0')}`, title: `Manual upload: ${comment || attach.name}`, source: 'Manual upload', automated: false, state: 'draft', taskId: t.id, controlRef: t.controlRef, fwShort: t.fwShort, collectedDays: 0, expiresDays: 180, hash: Math.random().toString(16).slice(2, 14), comment: comment || attach.name, docs: [attach.name] });
        toast(`${attach.name} attached to ${t.ref} as draft evidence`); setAttach(null);
      }} onOpenTask={(t) => go('tasks', { id: t.id })} />}
    </>
  );
}

function UploadModal({ folder, onClose, onUpload }: { folder: string; onClose: () => void; onUpload: (l: { name: string; sizeKb: number }[]) => void }) {
  const [list, setList] = useState<{ name: string; sizeKb: number }[]>([]);
  const tooBig = list.filter((f) => f.sizeKb > MAX_KB);
  return (
    <Modal title="Upload" sub={`To ${folder} · files stay in this demo session`} onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn primary color={tone} disabled={!list.length || tooBig.length > 0} onClick={() => onUpload(list)}><Upload /> Upload {list.length || ''}</Btn></>}>
      <label className="cmp-drop">
        <Upload size={20} />
        <span>Choose files (PDF, PNG, DOCX, XLSX, CSV) · 10 MB maximum each</span>
        <input type="file" multiple style={{ display: 'none' }} onChange={(e) => setList(Array.from(e.target.files ?? []).map((f) => ({ name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)) })))} />
        <span className="link">Browse…</span>
      </label>
      <button type="button" className="link" onClick={() => setList([{ name: 'quarterly-access-review-signed.pdf', sizeKb: 412 }, { name: 'backup-restore-test-screenshot.png', sizeKb: 1180 }])}>Or use two sample files</button>
      {list.length > 0 && <div className="cmp-list">{list.map((f) => <div key={f.name} className="cmp-list-row"><span><b>{f.name}</b><span className="s">{fmtNum(f.sizeKb)} KB</span></span>{f.sizeKb > MAX_KB ? <Badge color="var(--bad)">Over 10 MB</Badge> : <Badge color="var(--sev-medium)">Will be scanned</Badge>}</div>)}</div>}
    </Modal>
  );
}

function AttachModal({ file, tasks, taskById, onClose, onAttach, onOpenTask }: { file: DriveItem; tasks: ComplyTask[]; taskById: Map<string, ComplyTask>; onClose: () => void; onAttach: (t: ComplyTask, comment: string) => void; onOpenTask: (t: ComplyTask) => void }) {
  const open = tasks.filter((t) => t.status !== 'Not applicable' && taskState(t.status) !== 'Compliant');
  const linked = file.taskId ? taskById.get(file.taskId) : undefined;
  const [tid, setTid] = useState(linked?.id ?? open.find((t) => t.overdue)?.id ?? open[0]?.id ?? '');
  const [q, setQ] = useState('');
  const [comment, setComment] = useState('');
  const list = open.filter((t) => !q || `${t.ref} ${t.title} ${t.fwShort}`.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  const t = taskById.get(tid);
  return (
    <Modal title="Attach to a task" sub={<><b>{file.name}</b> · {file.filename}</>} onClose={onClose}
      footer={<>{linked && <Btn onClick={() => onOpenTask(linked)}>Open {linked.ref}</Btn>}<span className="spacer" /><Btn onClick={onClose}>Cancel</Btn><Btn primary color={tone} disabled={!t} onClick={() => t && onAttach(t, comment.trim())}><Paperclip /> Attach as draft evidence</Btn></>}>
      {linked && <span className="muted" style={{ fontSize: 12 }}>Already attached to {linked.ref} · {linked.title}. Attaching again creates a new evidence item.</span>}
      <input className="input" placeholder="Find a task…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="cmp-docpick">
        {list.map((k) => (
          <label key={k.id} className={tid === k.id ? 'on' : ''}>
            <input type="radio" name="task" checked={tid === k.id} onChange={() => setTid(k.id)} />
            <span>{k.ref} · {k.title}<span className="s">{k.fwShort} · {k.owner} · {k.status}</span></span>
            {k.overdue ? <Badge color="var(--bad)">Overdue</Badge> : <span className="cmp-ftype">{k.fwShort}</span>}
          </label>
        ))}
      </div>
      <label className="cmp-f"><span>Comment</span><input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What this file shows" /></label>
    </Modal>
  );
}
