import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { ArrowLeft, Undo2, Redo2, Workflow, ZoomIn, ZoomOut, Maximize2, Play, Square, Trash2, History, CheckCircle2, AlertTriangle, XCircle, Pause, Upload, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../state/AppContext';
import { rng } from '../../../lib/rng';
import { reducedMotion } from '../../../lib/useIntro';
import { signedIn, RISK_RULES } from '../../../data/modules/ops';
import {
  OP, OPS, AUTO_RULES, NODE_W, NODE_H, GRID, RISK_APPROVERS, CAP_LABEL, autoLayout, validate, toolsFor, toolName, paramDefaults, simResult, triggerLabel,
  type Playbook, type PbNode, type PbEdge, type Port, type PbRisk, type Sample, type Issue, type PbRun, type RunAction,
} from '../../../data/modules/playbooks';
import { Badge, Btn, Callout, KV, MiniStat, Timeline, cap } from '../../../components/ui';
import { Drawer } from '../../../components/Overlay';
import { approversFor, OtReadOnly } from '../parts';
import { fmtAgo } from '../../../lib/format';
import { usePlaybookStore, agoOf } from './store';
import { KIND_META, PB_RISK_COLOR, STATUS_COLOR, STATUS_LABEL, isOtWrite, nodeColor, nodeIcon, type CVars } from './meta';

interface Graph {
  nodes: PbNode[];
  edges: PbEdge[];
}
type Sel = { type: 'node' | 'edge'; id: string } | null;
type Drag =
  | { kind: 'node'; id: string; dx: number; dy: number; sx: number; sy: number; moved: boolean; before: Graph; x: number; y: number }
  | { kind: 'wire'; from: string; port: Port }
  | { kind: 'pal'; op: string; sx: number; sy: number; moved: boolean };

const LIFECYCLE = ['Signed', 'Dispatched', 'Applied', 'Verified'] as const;
const snap = (v: number) => Math.max(0, Math.round(v / GRID) * GRID);
const uid = (p: string) => `${p}${Math.random().toString(36).slice(2, 8)}`;

function portPos(n: PbNode, port: Port | 'in'): [number, number] {
  if (port === 'in') return [n.x + NODE_W / 2, n.y];
  if (port === 'yes') return [n.x + NODE_W * 0.28, n.y + NODE_H];
  if (port === 'no') return [n.x + NODE_W * 0.72, n.y + NODE_H];
  return [n.x + NODE_W / 2, n.y + NODE_H];
}
function bez(x1: number, y1: number, x2: number, y2: number) {
  const dy = Math.max(40, Math.abs(y2 - y1) * 0.5);
  return { d: `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`, p: [x1, y1, x1, y1 + dy, x2, y2 - dy, x2, y2] as const };
}
function bezAt(p: readonly number[], t: number): [number, number] {
  const u = 1 - t;
  const x = u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6];
  const y = u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7];
  return [x, y];
}
function outPorts(n: PbNode): Port[] {
  if (n.kind === 'end') return [];
  if (n.kind === 'condition' || n.kind === 'approval') return ['yes', 'no'];
  return ['out'];
}
function portLabel(n: PbNode, p: Port) {
  if (n.kind === 'approval') return p === 'yes' ? 'approved' : 'denied';
  return p;
}
function edgeColor(from: PbNode | undefined, e: PbEdge) {
  if (e.port === 'yes') return 'var(--good)';
  if (e.port === 'no') return from?.kind === 'approval' ? 'var(--bad)' : 'var(--sev-medium)';
  return 'var(--text-muted)';
}

/* ---------------- Simulation state ---------------- */
interface LogRow {
  t: number;
  nodeId?: string;
  color: string;
  title: string;
  text: string;
  lc?: number;
  bad?: boolean;
}
interface Sim {
  status: 'idle' | 'running' | 'waiting' | 'done';
  active?: string;
  visited: Record<string, 'done' | 'blocked'>;
  results: Record<string, { text: string; bad?: boolean }>;
  lifecycle: Record<string, number>;
  edgesRun: string[];
  token?: { edge: string; t: number };
  waiting?: { nodeId: string; need: number; got: string[]; risk: PbRisk };
  log: LogRow[];
  machineSec: number;
  manualMin: number;
  verified: number;
  blocked: number;
}
const SIM0: Sim = { status: 'idle', visited: {}, results: {}, lifecycle: {}, edgesRun: [], log: [], machineSec: 0, manualMin: 0, verified: 0, blocked: 0 };

export function Editor({ pb, onBack, onPick, all }: { pb: Playbook; onBack: () => void; onPick: (id: string) => void; all: Playbook[] }) {
  const { customer: c, persona, toast, tenantId } = useApp();
  const me = useMemo(() => signedIn(c, persona), [c, persona]);
  const { updatePb, update } = usePlaybookStore(c);
  const [graph, setGraph] = useState<Graph>({ nodes: pb.nodes, edges: pb.edges });
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const [past, setPast] = useState<Graph[]>([]);
  const [future, setFuture] = useState<Graph[]>([]);
  const [sel, setSel] = useState<Sel>(null);
  const [zoom, setZoom] = useState(0.8);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const [wire, setWire] = useState<{ from: string; port: Port; x: number; y: number; hot?: string } | null>(null);
  const [ghost, setGhost] = useState<{ op: string; x: number; y: number; over: boolean } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  const [sample, setSample] = useState<Sample>('tp');
  const [sim, setSim] = useState<Sim>(SIM0);
  const drag = useRef<Drag | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const runRef = useRef(0);
  const decideRef = useRef<((d: 'approve' | 'deny' | 'cancel') => void) | null>(null);
  const simRef = useRef(sim);
  simRef.current = sim;
  const approvalsRef = useRef<string[]>([]);
  const nav = useNavigate();

  const issues = useMemo(() => validate(c, graph.nodes, graph.edges), [c, graph]);
  const errors = issues.filter((i) => i.level === 'error');
  const warns = issues.filter((i) => i.level === 'warn');
  const nodeIssue = useMemo(() => {
    const m = new Map<string, Issue['level']>();
    issues.forEach((i) => {
      if (i.nodeId && m.get(i.nodeId) !== 'error') m.set(i.nodeId, i.level);
    });
    return m;
  }, [issues]);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const simBusy = sim.status === 'running' || sim.status === 'waiting';

  /* ---------- persistence and history ---------- */
  const persist = useCallback(
    (g: Graph) =>
      updatePb(pb.id, (p) => ({
        ...p, nodes: g.nodes, edges: g.edges, dirty: true, status: p.status === 'review' ? 'draft' : p.status, submittedBy: p.status === 'review' ? undefined : p.submittedBy,
        editedBy: me.name, editedAt: Date.now(), editedMinAgo: 0,
      })),
    [updatePb, pb.id, me.name],
  );
  const commit = useCallback(
    (next: Graph, before: Graph = graphRef.current) => {
      setPast((p) => [...p.slice(-49), before]);
      setFuture([]);
      setGraph(next);
      persist(next);
    },
    [persist],
  );
  const undo = useCallback(() => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setFuture((f) => [graphRef.current, ...f]);
    setPast(past.slice(0, -1));
    setGraph(prev);
    persist(prev);
  }, [past, persist]);
  const redo = useCallback(() => {
    if (!future.length) return;
    const next = future[0];
    setPast((p) => [...p, graphRef.current]);
    setFuture(future.slice(1));
    setGraph(next);
    persist(next);
  }, [future, persist]);
  /** Live edit without a history entry (typing in the properties panel). */
  const editLive = (fn: (g: Graph) => Graph) => {
    const next = fn(graphRef.current);
    setGraph(next);
    persist(next);
  };
  const snapshot = () => {
    setPast((p) => [...p.slice(-49), graphRef.current]);
    setFuture([]);
  };
  const patchNode = (id: string, patch: Partial<PbNode>, live = false) => {
    const fn = (g: Graph) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
    if (live) editLive(fn);
    else commit(fn(graphRef.current));
  };

  /* ---------- geometry ---------- */
  const worldPoint = (cx: number, cy: number) => {
    const r = worldRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (cx - r.left) / zoomRef.current, y: (cy - r.top) / zoomRef.current };
  };
  const overCanvas = (cx: number, cy: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return !!r && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  };
  const worldW = Math.max(1000, ...graph.nodes.map((n) => n.x + NODE_W + 260));
  const worldH = Math.max(560, ...graph.nodes.map((n) => n.y + NODE_H + 160));

  const freeSpot = (): { x: number; y: number } => {
    const el = canvasRef.current;
    const z = zoomRef.current;
    let x = snap(el ? (el.scrollLeft + el.clientWidth / 2) / z - NODE_W / 2 : 80);
    let y = snap(el ? (el.scrollTop + el.clientHeight / 3) / z : 80);
    const hit = (px: number, py: number) => graphRef.current.nodes.some((n) => Math.abs(n.x - px) < NODE_W && Math.abs(n.y - py) < NODE_H + 20);
    let guard = 0;
    while (hit(x, y) && guard++ < 40) {
      y += NODE_H + 40;
      if (guard % 6 === 0) {
        x += NODE_W + 40;
        y = snap(el ? el.scrollTop / z + 40 : 40);
      }
    }
    return { x, y };
  };

  const addNode = (opId: string, at?: { x: number; y: number }) => {
    const def = OP[opId];
    const pos = at ?? freeSpot();
    const tool = def.caps ? toolsFor(c, def.caps)[0]?.id : undefined;
    const n: PbNode = {
      id: uid('n'), kind: def.kind, op: opId, label: def.label, x: snap(pos.x), y: snap(pos.y), tool, params: paramDefaults(c, opId),
      ...(def.kind === 'approval' ? { risk: 'medium' as PbRisk, auto: AUTO_RULES[0], label: 'Approve (medium risk)' } : {}),
    };
    commit({ ...graphRef.current, nodes: [...graphRef.current.nodes, n] });
    setSel({ type: 'node', id: n.id });
    if (def.ot) toast('OT write node added: HexaView will refuse to run it (OT is read-only by policy)');
  };

  const removeSel = useCallback(() => {
    if (!sel) return;
    const g = graphRef.current;
    if (sel.type === 'node') commit({ nodes: g.nodes.filter((n) => n.id !== sel.id), edges: g.edges.filter((e) => e.from !== sel.id && e.to !== sel.id) });
    else commit({ ...g, edges: g.edges.filter((e) => e.id !== sel.id) });
    setSel(null);
  }, [sel, commit]);

  /* ---------- pointer interactions ---------- */
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (d.kind === 'node') {
        if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
        d.moved = true;
        const p = worldPoint(e.clientX, e.clientY);
        d.x = Math.max(0, p.x - d.dx);
        d.y = Math.max(0, p.y - d.dy);
        setDragging(d.id);
        setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === d.id ? { ...n, x: d.x, y: d.y } : n)) }));
      } else if (d.kind === 'wire') {
        const p = worldPoint(e.clientX, e.clientY);
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const hot = el?.closest<HTMLElement>('[data-node]')?.dataset.node;
        setWire((w) => (w ? { ...w, x: p.x, y: p.y, hot: hot && hot !== w.from ? hot : undefined } : w));
      } else if (d.kind === 'pal') {
        if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
        d.moved = true;
        setGhost({ op: d.op, x: e.clientX, y: e.clientY, over: overCanvas(e.clientX, e.clientY) });
      }
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      if (d.kind === 'node') {
        setDragging(null);
        if (d.moved) {
          const next = { ...d.before, nodes: d.before.nodes.map((n) => (n.id === d.id ? { ...n, x: snap(d.x), y: snap(d.y) } : n)) };
          commit(next, d.before);
        }
      } else if (d.kind === 'wire') {
        setWire(null);
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const to = el?.closest<HTMLElement>('[data-node]')?.dataset.node;
        const g = graphRef.current;
        const target = to ? g.nodes.find((n) => n.id === to) : undefined;
        if (!target || target.id === d.from) return;
        if (target.kind === 'trigger') {
          toast('A trigger starts the playbook; it cannot have an incoming connection');
          return;
        }
        if (g.edges.some((x) => x.from === d.from && x.to === target.id && x.port === d.port)) return;
        commit({ ...g, edges: [...g.edges, { id: uid('e'), from: d.from, to: target.id, port: d.port }] });
      } else if (d.kind === 'pal') {
        setGhost(null);
        if (d.moved) {
          if (overCanvas(e.clientX, e.clientY)) {
            const p = worldPoint(e.clientX, e.clientY);
            addNode(d.op, { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 });
          }
        } else addNode(d.op);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  });

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (document.querySelector('.modal, .drawer')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !simBusy) {
        e.preventDefault();
        removeSel();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [sel, simBusy, removeSel, undo, redo]);

  const onNodeDown = (e: RPointerEvent, n: PbNode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSel({ type: 'node', id: n.id });
    if (simBusy) return;
    const p = worldPoint(e.clientX, e.clientY);
    drag.current = { kind: 'node', id: n.id, dx: p.x - n.x, dy: p.y - n.y, sx: e.clientX, sy: e.clientY, moved: false, before: graphRef.current, x: n.x, y: n.y };
  };
  const onPortDown = (e: RPointerEvent, n: PbNode, port: Port) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    if (simBusy) return;
    const p = worldPoint(e.clientX, e.clientY);
    drag.current = { kind: 'wire', from: n.id, port };
    setWire({ from: n.id, port, x: p.x, y: p.y });
  };
  const onPalDown = (e: RPointerEvent, op: string) => {
    if (e.button !== 0 || simBusy) return;
    e.preventDefault();
    drag.current = { kind: 'pal', op, sx: e.clientX, sy: e.clientY, moved: false };
  };

  const layout = () => commit({ ...graphRef.current, nodes: autoLayout(graphRef.current.nodes, graphRef.current.edges) });
  const fit = (whole = true) => {
    const el = canvasRef.current;
    if (!el || !graph.nodes.length) return;
    const w = Math.max(...graph.nodes.map((n) => n.x + NODE_W)) + 60;
    const h = Math.max(...graph.nodes.map((n) => n.y + NODE_H)) + 60;
    setZoom(whole ? Math.max(0.4, Math.min(1, +Math.min(el.clientWidth / w, el.clientHeight / h).toFixed(2))) : Math.max(0.7, Math.min(1, +(el.clientWidth / w).toFixed(2))));
    el.scrollTo({ left: 0, top: 0 });
  };
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useLayoutEffect(() => {
    fitRef.current(false);
  }, []);
  const focusNode = (id?: string) => {
    if (!id) return;
    setSel({ type: 'node', id });
    const n = graphRef.current.nodes.find((x) => x.id === id);
    const el = canvasRef.current;
    if (n && el) el.scrollTo({ left: Math.max(0, n.x * zoom - el.clientWidth / 3), top: Math.max(0, n.y * zoom - el.clientHeight / 3), behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  /* ---------- simulation ---------- */
  const stopSim = useCallback(() => {
    runRef.current++;
    decideRef.current?.('cancel');
    decideRef.current = null;
    setSim((s) => ({ ...s, status: s.status === 'idle' ? 'idle' : 'done', token: undefined, active: undefined, waiting: undefined }));
  }, []);
  // Keep the active node in view while a simulation runs.
  useEffect(() => {
    const id = sim.active ?? sim.waiting?.nodeId;
    const n = id ? graphRef.current.nodes.find((x) => x.id === id) : undefined;
    const el = canvasRef.current;
    if (!n || !el) return;
    const top = n.y * zoomRef.current;
    const left = n.x * zoomRef.current;
    if (top < el.scrollTop + 20 || top + NODE_H * zoomRef.current > el.scrollTop + el.clientHeight - 200 || left < el.scrollLeft || left + NODE_W * zoomRef.current > el.scrollLeft + el.clientWidth) {
      el.scrollTo({ top: Math.max(0, top - el.clientHeight / 3), left: Math.max(0, left - el.clientWidth / 3), behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }, [sim.active, sim.waiting?.nodeId]);
  useEffect(() => () => {
    runRef.current++;
    decideRef.current?.('cancel');
  }, []);

  const runSim = async () => {
    const my = ++runRef.current;
    const alive = () => runRef.current === my;
    const reduced = reducedMotion();
    const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, reduced ? Math.min(ms, 60) : ms));
    const g = graphRef.current;
    const trig = g.nodes.find((n) => n.kind === 'trigger');
    if (!trig) {
      toast('Add a Trigger node before running a simulation');
      return;
    }
    const vIssues = validate(c, g.nodes, g.edges);
    const r = rng(`pb-sim-${c.id}-${pb.id}-${sample}`);
    let clock = 0;
    let manual = 0;
    let verified = 0;
    let blocked = 0;
    approvalsRef.current = [];
    const actionsDone: RunAction[] = [];
    let outcome = 'Completed';
    setSim({ ...SIM0, status: 'running' });
    setSel(null);
    const log = (row: Omit<LogRow, 't'>) => setSim((s) => ({ ...s, log: [...s.log, { ...row, t: clock }] }));
    const animate = (edgeId: string) =>
      new Promise<void>((res) => {
        if (reduced) {
          setSim((s) => ({ ...s, edgesRun: [...s.edgesRun, edgeId] }));
          res();
          return;
        }
        const start = performance.now();
        const dur = 620;
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          if (alive()) setSim((s) => ({ ...s, token: undefined, edgesRun: [...s.edgesRun, edgeId] }));
          res();
        };
        const step = (now: number) => {
          if (finished || !alive()) return finish();
          const t = Math.min(1, (now - start) / dur);
          setSim((s) => ({ ...s, token: { edge: edgeId, t } }));
          if (t < 1) requestAnimationFrame(step);
          else finish();
        };
        requestAnimationFrame(step);
        // Guarantee progress where animation frames are throttled (hidden tab).
        setTimeout(finish, dur + 120);
      });
    const stack: { id: string; via?: string }[] = [{ id: trig.id }];
    const seen = new Set<string>();
    while (stack.length) {
      if (!alive()) return;
      const { id, via } = stack.pop()!;
      if (via) await animate(via);
      if (!alive()) return;
      if (seen.has(id)) continue;
      seen.add(id);
      const n = g.nodes.find((x) => x.id === id);
      if (!n) continue;
      const def = OP[n.op];
      const color = nodeColor(c, n);
      setSim((s) => ({ ...s, active: id }));
      await sleep(380);
      if (!alive()) return;
      clock += def?.machineSec ?? 1;
      manual += def?.manualMin ?? 0;
      let ports: Port[] | 'all' = 'all';
      let bad = false;
      let text = simResult(c, n, sample, r);
      if (n.kind === 'condition') {
        ports = [sample === 'tp' ? 'yes' : 'no'];
      } else if (n.kind === 'approval') {
        const risk = n.risk ?? 'medium';
        const need = RISK_APPROVERS[risk];
        if (need === 0) text = 'Low risk: auto-approved and logged to the audit ledger';
        else if (risk === 'medium' && n.auto && n.auto !== AUTO_RULES[0] && sample === 'tp') text = `Auto-approved by policy: ${n.auto}`;
        else {
          setSim((s) => ({ ...s, status: 'waiting', waiting: { nodeId: id, need, got: [], risk } }));
          log({ nodeId: id, color, title: n.label, text: `Paused for ${need === 2 ? 'two approvers incl. a Tenant Admin' : 'one approver'} (${risk} risk)` });
          const decision = await new Promise<'approve' | 'deny' | 'cancel'>((res) => (decideRef.current = res));
          decideRef.current = null;
          if (decision === 'cancel' || !alive()) return;
          setSim((s) => ({ ...s, status: 'running', waiting: undefined }));
          ports = [decision === 'approve' ? 'yes' : 'no'];
          text = decision === 'approve' ? 'Approved and signed (ES256)' : 'Denied by approver: write-backs on this branch skipped';
          if (decision === 'deny') outcome = 'Denied at approval gate';
        }
        if (ports === 'all') ports = ['yes'];
      } else if (n.kind === 'action') {
        const k = c.connectors.find((x) => x.id === n.tool);
        const ungated = vIssues.some((i) => i.nodeId === id && i.id.startsWith('gate-') && i.level === 'error');
        const refuse = isOtWrite(c, n) ? 'PolicyDenied: OT is read-only by policy. No command was sent; site engineers act under the OT playbook'
          : !k ? 'PolicyDenied: target tool is not connected'
            : ungated ? 'PolicyDenied: the action broker refuses high-risk write-backs that did not pass an approval gate'
              : null;
        if (refuse) {
          bad = true;
          blocked++;
          text = refuse;
          setSim((s) => ({ ...s, lifecycle: { ...s.lifecycle, [id]: -1 } }));
          ports = [];
          outcome = 'Blocked by policy';
          actionsDone.push({ label: n.label, tool: k?.product ?? 'Not connected', state: 'PolicyDenied', risk: def?.risk ?? 'low' });
        } else {
          log({ nodeId: id, color, title: n.label, text: `${toolName(k!)} · ${def?.openc2 ? `OpenC2 ${def.openc2.action} ${def.openc2.target}` : 'write-back'}`, lc: 0 });
          for (let i = 1; i <= LIFECYCLE.length; i++) {
            await sleep(300);
            if (!alive()) return;
            setSim((s) => ({ ...s, lifecycle: { ...s.lifecycle, [id]: i }, log: s.log.map((row, j) => (j === s.log.length - 1 && row.nodeId === id ? { ...row, lc: i } : row)) }));
          }
          verified++;
          actionsDone.push({ label: n.label, tool: k!.product, state: 'Verified', risk: def?.risk ?? 'low' });
        }
      }
      if (!(n.kind === 'action' && !bad)) log({ nodeId: id, color: bad ? 'var(--bad)' : color, title: n.label, text, bad });
      setSim((s) => ({ ...s, results: { ...s.results, [id]: { text, bad } }, visited: { ...s.visited, [id]: bad ? 'blocked' : 'done' }, machineSec: clock, manualMin: manual, verified, blocked }));
      if (n.kind === 'end') outcome = n.params.outcome ?? outcome;
      const outs = g.edges.filter((e) => e.from === id && (ports === 'all' || ports.includes(e.port)));
      for (let i = outs.length - 1; i >= 0; i--) stack.push({ id: outs[i].to, via: outs[i].id });
    }
    if (!alive()) return;
    setSim((s) => ({ ...s, status: 'done', active: undefined, token: undefined }));
    const savedMin = Math.max(0, Math.round(manual - clock / 60));
    toast(`Simulation finished: ${verified} write-back${verified === 1 ? '' : 's'} verified${blocked ? `, ${blocked} blocked by policy` : ''}; ${savedMin} analyst minutes saved`);
    const run: PbRun = {
      id: `SIM-${String(Date.now()).slice(-5)}`, pbId: pb.id, pbName: pb.name, category: pb.category, minAgo: 0, at: Date.now(),
      status: blocked ? 'denied' : outcome.startsWith('Denied') ? 'denied' : 'success', entity: sample === 'tp' ? 'Test event (true positive)' : 'Test event (benign)',
      tenantId: tenantId === 'all' ? c.tenants[0]?.id ?? 'all' : tenantId, durationSec: Math.round(clock), savedMin, approvers: [...new Set(approvalsRef.current)], actions: actionsDone,
      note: `Simulation by ${me.name}: ${outcome}`, autoClosed: sample === 'benign', test: true,
    };
    update((s) => ({ ...s, sessionRuns: [run, ...s.sessionRuns].slice(0, 40) }));
  };

  const approveAs = (name: string) => {
    const w = simRef.current.waiting;
    if (!w || w.got.includes(name)) return;
    const got = [...w.got, name];
    approvalsRef.current.push(name);
    simRef.current = { ...simRef.current, waiting: { ...w, got } };
    setSim((s) => ({ ...s, waiting: s.waiting ? { ...s.waiting, got } : s.waiting, log: [...s.log, { t: s.machineSec, nodeId: w.nodeId, color: 'var(--good)', title: 'Approval recorded', text: `${name} (${got.length} of ${w.need})` }] }));
    if (got.length >= w.need) decideRef.current?.('approve');
  };
  const deny = () => decideRef.current?.('deny');

  /* ---------- publish flow ---------- */
  const reviewer = me.name === c.people.socLead.name ? c.people.admin.name : c.people.socLead.name;
  const submit = () => {
    updatePb(pb.id, (p) => ({ ...p, status: 'review', submittedBy: me.name }));
    toast(`Submitted ${pb.name} for approval; ${reviewer} notified`);
  };
  const approvePublish = () => {
    updatePb(pb.id, (p) => {
      const v = p.version + (p.status === 'draft' && p.version === 1 && p.versions.length === 1 && !p.runs30 ? 0 : 1);
      const versions = v === p.version ? p.versions.map((x, i) => (i === 0 ? { ...x, by: reviewer, at: Date.now(), minAgo: 0, note: `Published (${graphRef.current.nodes.length} nodes)` } : x)) : [{ v, by: reviewer, minAgo: 0, at: Date.now(), note: `Published from builder (${graphRef.current.nodes.length} nodes, ${graphRef.current.edges.length} links)` }, ...p.versions];
      return { ...p, status: 'active', dirty: false, version: v, versions, submittedBy: undefined };
    });
    toast(`${pb.name} published and active · approved by ${reviewer}; signed and written to the audit ledger`);
  };
  const setPaused = (paused: boolean) => {
    updatePb(pb.id, (p) => ({ ...p, status: paused ? 'paused' : 'active' }));
    toast(paused ? `${pb.name} paused; new triggers queue for analysts` : `${pb.name} resumed`);
  };

  /* ---------- render helpers ---------- */
  const selNode = sel?.type === 'node' ? byId.get(sel.id) : undefined;
  const selEdge = sel?.type === 'edge' ? graph.edges.find((e) => e.id === sel.id) : undefined;
  const waitingNode = sim.waiting ? byId.get(sim.waiting.nodeId) : undefined;
  const waitingApprovers = sim.waiting ? approversFor(c, sim.waiting.risk) : [];
  const palette: { label: string; ops: string[] }[] = [
    { label: 'Trigger', ops: OPS.filter((o) => o.kind === 'trigger').map((o) => o.id) },
    { label: 'Enrich', ops: OPS.filter((o) => o.kind === 'enrich').map((o) => o.id) },
    { label: 'Decide', ops: ['cond', 'appr'] },
    { label: 'Act (write-back)', ops: OPS.filter((o) => o.kind === 'action').map((o) => o.id) },
    { label: 'Flow', ops: OPS.filter((o) => o.kind === 'notify' || o.kind === 'wait' || o.kind === 'end').map((o) => o.id) },
  ];

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="pb-ed">
        <div className="pb-ed-bar">
          <button className="pb-ico-btn" onClick={onBack} title="Back to library"><ArrowLeft /></button>
          <div className="pb-ed-title">
            <b>{pb.name}</b>
            <span>{pb.id} · v{pb.version}{pb.dirty ? ' + unpublished changes' : ''} · edited by {pb.editedBy} {fmtAgo(agoOf(pb.editedMinAgo, pb.editedAt))}</span>
          </div>
          <select className="select" style={{ width: 170 }} value={pb.id} onChange={(e) => onPick(e.target.value)} title="Open another playbook">
            {all.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Badge color={STATUS_COLOR[pb.status]} dot>{STATUS_LABEL[pb.status]}</Badge>
          <span className="grow" />
          <button className="pb-ico-btn" onClick={undo} disabled={!past.length || simBusy} title="Undo (Ctrl+Z)"><Undo2 /></button>
          <button className="pb-ico-btn" onClick={redo} disabled={!future.length || simBusy} title="Redo (Ctrl+Y)"><Redo2 /></button>
          <button className="pb-ico-btn" onClick={layout} disabled={simBusy} title="Auto-layout"><Workflow /></button>
          <span className="sep" />
          <button className="pb-ico-btn" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} title="Zoom out"><ZoomOut /></button>
          <span className="pb-zoom">{Math.round(zoom * 100)}%</span>
          <button className="pb-ico-btn" onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))} title="Zoom in"><ZoomIn /></button>
          <button className="pb-ico-btn" onClick={() => fit()} title="Fit to view"><Maximize2 /></button>
          <span className="sep" />
          <button className="pb-ico-btn" onClick={() => setHistory(true)} title="Version history"><History /></button>
          <button className="link" onClick={() => setSel(null)} title="Show validation" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: errors.length ? 'var(--bad)' : warns.length ? 'var(--sev-medium)' : 'var(--good)' }}>
            {errors.length ? <XCircle size={14} /> : warns.length ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            {errors.length || warns.length ? `${errors.length} error${errors.length === 1 ? '' : 's'} · ${warns.length} warning${warns.length === 1 ? '' : 's'}` : 'Valid'}
          </button>
          <span className="sep" />
          {(pb.status === 'draft' || pb.dirty) && pb.status !== 'review' && (
            <Btn sm onClick={submit} disabled={errors.length > 0} title={errors.length ? 'Fix validation errors before submitting' : 'Send to an approver'}><Upload /> Submit for approval</Btn>
          )}
          {pb.status === 'review' && <Btn sm primary color="var(--m-soc)" onClick={approvePublish} title={`Approve as ${reviewer}`}><CheckCircle2 /> Approve and publish</Btn>}
          {pb.status === 'active' && <Btn sm ghost onClick={() => setPaused(true)}><Pause /> Pause</Btn>}
          {pb.status === 'paused' && <Btn sm ghost onClick={() => setPaused(false)}><Play /> Resume</Btn>}
          <select className="select" style={{ width: 130 }} value={sample} onChange={(e) => setSample(e.target.value as Sample)} disabled={simBusy} title="Sample event for the simulation">
            <option value="tp">True positive</option>
            <option value="benign">Benign event</option>
          </select>
          {simBusy ? (
            <Btn sm danger onClick={stopSim}><Square /> Stop</Btn>
          ) : (
            <Btn sm primary color="var(--m-soc)" onClick={() => void runSim()}><Play /> Run simulation</Btn>
          )}
        </div>

        {/* Palette */}
        <div className="pb-pal">
          <div className="pb-pal-hint">Drag onto the canvas (or click to add). Connect by dragging from a node's right-hand port to another node.</div>
          {palette.map((grp) => (
            <div key={grp.label} className="pb-pal-g">
              <div className="section-label">{grp.label}</div>
              {grp.ops.map((id) => {
                const o = OP[id];
                const avail = !o.caps || toolsFor(c, o.caps).length > 0;
                const col = o.kind === 'action' ? (o.ot ? 'var(--bad)' : PB_RISK_COLOR[o.risk ?? 'low']) : KIND_META[o.kind].color;
                return (
                  <div
                    key={id}
                    className={`pb-pal-item ${avail ? '' : 'na'}`}
                    style={{ '--pb-c': col, '--pb-r': col } as CVars}
                    onPointerDown={(e) => onPalDown(e, id)}
                    title={`${o.blurb}${avail ? '' : ` · no ${o.caps!.map((x) => CAP_LABEL[x]).join(' / ')} connected for ${c.short}`}`}
                    role="button"
                    aria-label={`Add ${o.label}`}
                  >
                    {o.ot ? nodeIcon(c, { id: '', kind: 'action', op: id, label: '', x: 0, y: 0, params: {} }) : KIND_META[o.kind].icon}
                    <span>{o.label}</span>
                    {o.kind === 'action' && <em>{o.ot ? 'OT' : o.risk === 'medium' ? 'med' : o.risk}</em>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div ref={canvasRef} className={`pb-canvas ${ghost?.over ? 'drop' : ''}`} style={{ '--pb-grid': `${GRID * zoom}px` } as CVars} onPointerDown={() => !simBusy && setSel(null)}>
          <div style={{ width: worldW * zoom, height: worldH * zoom, position: 'relative' }}>
            <div ref={worldRef} className="pb-world" style={{ width: worldW, height: worldH, transform: `scale(${zoom})` }}>
              <svg className="pb-svg" width={worldW} height={worldH} aria-hidden>
                <defs>
                  <filter id="pb-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="5" /></filter>
                </defs>
                {graph.edges.map((e) => {
                  const a = byId.get(e.from);
                  const b = byId.get(e.to);
                  if (!a || !b) return null;
                  const [x1, y1] = portPos(a, e.port);
                  const [x2, y2] = portPos(b, 'in');
                  const { d } = bez(x1, y1, x2, y2);
                  const isSel = sel?.type === 'edge' && sel.id === e.id;
                  const ran = sim.edgesRun.includes(e.id);
                  const col = ran ? 'var(--m-soc)' : isSel ? 'var(--m-soc)' : edgeColor(a, e);
                  return (
                    <g key={e.id}>
                      <path d={d} className={`pb-edge ${isSel ? 'sel' : ''} ${ran ? 'run' : ''}`} style={{ stroke: col, opacity: sim.status !== 'idle' && !ran ? 0.45 : 0.9 }} />
                      {ran && <path d={d} className="pb-edge-flow" style={{ stroke: 'var(--m-soc)' }} />}
                      <path
                        d={d}
                        className="hit"
                        style={{ stroke: 'transparent', strokeWidth: 14, fill: 'none' }}
                        onPointerDown={(ev) => {
                          ev.stopPropagation();
                          if (!simBusy) setSel({ type: 'edge', id: e.id });
                        }}
                      />
                    </g>
                  );
                })}
                {wire && byId.get(wire.from) && (() => {
                  const [x1, y1] = portPos(byId.get(wire.from)!, wire.port);
                  const hot = wire.hot ? byId.get(wire.hot) : undefined;
                  const [x2, y2] = hot ? portPos(hot, 'in') : [wire.x, wire.y];
                  return <path d={bez(x1, y1, x2, y2).d} className="pb-edge" style={{ stroke: 'var(--m-soc)', strokeDasharray: '6 5' }} />;
                })()}
                {sim.token && (() => {
                  const e = graph.edges.find((x) => x.id === sim.token!.edge);
                  const a = e && byId.get(e.from);
                  const b = e && byId.get(e.to);
                  if (!e || !a || !b) return null;
                  const [x1, y1] = portPos(a, e.port);
                  const [x2, y2] = portPos(b, 'in');
                  const { p } = bez(x1, y1, x2, y2);
                  const [x, y] = bezAt(p, sim.token!.t);
                  const [tx, ty] = bezAt(p, Math.max(0, sim.token!.t - 0.08));
                  return (
                    <g className="pb-token">
                      <circle cx={x} cy={y} r={12} filter="url(#pb-glow)" style={{ fill: 'var(--m-soc)', opacity: 0.85 }} />
                      <line x1={tx} y1={ty} x2={x} y2={y} strokeWidth={4} strokeLinecap="round" style={{ stroke: 'var(--m-soc)', opacity: 0.6 }} />
                      <circle cx={x} cy={y} r={5} style={{ fill: '#fff' }} />
                    </g>
                  );
                })()}
              </svg>

              {graph.nodes.map((n) => {
                const col = nodeColor(c, n);
                const def = OP[n.op];
                const k = c.connectors.find((x) => x.id === n.tool);
                const iss = nodeIssue.get(n.id);
                const vis = sim.visited[n.id];
                const lc = sim.lifecycle[n.id];
                const res = sim.results[n.id];
                const ot = isOtWrite(c, n);
                const sub = n.kind === 'condition' ? n.params.expr
                  : n.kind === 'approval' ? `${RISK_APPROVERS[n.risk ?? 'medium'] || 'Auto'} ${RISK_APPROVERS[n.risk ?? 'medium'] ? `approver${RISK_APPROVERS[n.risk ?? 'medium'] > 1 ? 's' : ''}` : '(logged)'} · ${n.risk ?? 'medium'} risk`
                    : ot ? 'Blocked: OT is read-only'
                      : def?.caps ? (k ? toolName(k) : 'No tool connected')
                        : n.params.channel ?? n.params.who ?? n.params.duration ?? n.params.outcome ?? '';
                const cls = ['pb-node', sel?.type === 'node' && sel.id === n.id ? 'sel' : '', dragging === n.id ? 'dragging' : '', sim.active === n.id ? 'active' : '', sim.waiting?.nodeId === n.id ? 'waiting' : '', vis === 'done' ? 'done' : '', vis === 'blocked' ? 'blocked' : ''].join(' ');
                return (
                  <div key={n.id} data-node={n.id} className={cls} style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H, '--pb-c': col } as CVars} onPointerDown={(e) => onNodeDown(e, n)}>
                    <div className="pb-node-k">{nodeIcon(c, n)}{n.kind === 'action' ? `${ot ? 'OT write' : 'Write-back'} · ${ot ? 'blocked' : def?.risk ?? 'low'}` : KIND_META[n.kind].label}</div>
                    <div className="pb-node-t" title={n.label}>{n.label}</div>
                    {n.kind === 'action' && lc !== undefined ? (
                      <div className="pb-lc" title={lc < 0 ? 'PolicyDenied' : LIFECYCLE.slice(0, lc).join(' → ')}>
                        {LIFECYCLE.map((s, i) => <i key={s} className={lc < 0 ? 'bad' : i < lc ? 'on' : ''} />)}
                      </div>
                    ) : res ? (
                      <div className={`pb-node-s res ${res.bad ? 'bad' : ''}`} title={res.text}>{res.text}</div>
                    ) : (
                      <div className={`pb-node-s ${ot || (def?.caps && !k) ? 'bad' : ''}`} title={sub}>{sub}</div>
                    )}
                    {iss && <span className="pb-node-flag" style={{ '--pb-f': iss === 'error' ? 'var(--bad)' : 'var(--sev-medium)' } as CVars} title={issues.filter((i) => i.nodeId === n.id).map((i) => i.text).join('\n')}>!</span>}
                    {n.kind !== 'trigger' && <span className={`pb-port in ${wire?.hot === n.id ? 'hot' : ''}`} data-in={n.id} style={{ left: NODE_W / 2, top: 0 }} />}
                    {outPorts(n).map((p) => {
                      const left = portPos(n, p)[0] - n.x;
                      return (
                        <span key={p}>
                          <span className={`pb-port ${p}`} style={{ left, top: NODE_H }} onPointerDown={(e) => onPortDown(e, n, p)} title={`Drag to connect (${portLabel(n, p)})`} />
                          {p !== 'out' && <span className="pb-port-lbl" style={{ left: left + 10, top: NODE_H + 9, color: p === 'yes' ? 'var(--good)' : n.kind === 'approval' ? 'var(--bad)' : 'var(--sev-medium)' }}>{portLabel(n, p)}</span>}
                        </span>
                      );
                    })}
                                      </div>
                );
              })}

              {waitingNode && sim.waiting && (
                <div className="pb-approve-pop" style={{ left: waitingNode.x + NODE_W + 16, top: waitingNode.y - 6 }} onPointerDown={(e) => e.stopPropagation()}>
                  <b>Approval needed · {sim.waiting.risk} risk</b>
                  <span className="muted">{sim.waiting.need === 2 ? 'Two approvers incl. a Tenant Admin' : 'One approver'} ({sim.waiting.got.length} of {sim.waiting.need})</span>
                  <div className="row">
                    {waitingApprovers.map((a) => {
                      const name = a.split(' (')[0];
                      const done = sim.waiting!.got.includes(name);
                      return <Btn key={a} sm primary={!done} color="var(--good)" disabled={done} onClick={() => approveAs(name)}>{done ? <CheckCircle2 /> : null}{done ? name.split(' ')[0] : `Approve as ${name.split(' ')[0]}`}</Btn>;
                    })}
                    <Btn sm danger onClick={deny}>Deny</Btn>
                  </div>
                </div>
              )}
            </div>
          </div>
          {!graph.nodes.length && <div className="pb-empty-canvas">Drag a Trigger from the palette to start</div>}
        </div>

        {/* Properties */}
        <div className="pb-props">
          {selNode ? (
            <NodeProps
              key={selNode.id}
              node={selNode}
              issues={issues.filter((i) => i.nodeId === selNode.id)}
              onPatch={(patch, live) => patchNode(selNode.id, patch, live)}
              onFocusEdit={snapshot}
              onDelete={removeSel}
              disabled={simBusy}
            />
          ) : selEdge ? (
            <div className="stack">
              <div className="section-label">Connection</div>
              <PRows rows={[['From', byId.get(selEdge.from)?.label ?? '?'], ['Port', cap(portLabel(byId.get(selEdge.from)!, selEdge.port))], ['To', byId.get(selEdge.to)?.label ?? '?']]} />
              <Btn sm danger onClick={removeSel} disabled={simBusy}><Trash2 /> Delete connection</Btn>
            </div>
          ) : (
            <Overview pb={pb} issues={issues} onIssue={(i) => focusNode(i.nodeId)} onRename={(name) => updatePb(pb.id, (p) => ({ ...p, name, dirty: true }))} />
          )}
        </div>
      </div>

      <div className="grid g-3-2">
        <section className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">Run log {sim.log.length > 0 && <span className="count">{sim.log.length}</span>}</h3>
              <div className="card-sub">Test run against a {sample === 'tp' ? 'true-positive' : 'benign'} sample event; write-backs go to a dry-run endpoint and nothing changes in {c.short}'s tools</div>
            </div>
          </div>
          {sim.log.length ? (
            <div className="pb-log">
              {sim.log.map((row, i) => (
                <div key={i} className="pb-log-row" style={{ '--pb-c': row.color } as CVars}>
                  <span className="t">+{row.t.toFixed(0)}s</span>
                  <i className="d" />
                  <div>
                    <b style={row.bad ? { color: 'var(--bad)' } : undefined}>{row.title}</b> <span>{row.text}</span>
                    {row.lc !== undefined && (
                      <div className="pb-lifecycle">
                        {LIFECYCLE.map((s, j) => <em key={s} className={j < row.lc! ? 'on' : ''}>{s}</em>)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Press <b>Run simulation</b> to watch a token travel the graph: enrichments return values, decisions branch, approval gates pause for you, and write-backs go Signed → Dispatched → Applied → Verified.</div>
          )}
        </section>
        <section className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">Simulation result</h3>
              <div className="card-sub">{sim.status === 'idle' ? 'No run yet in this session' : sim.status === 'done' ? 'Finished' : sim.status === 'waiting' ? 'Paused at an approval gate' : 'Running…'}</div>
            </div>
            <button className="link" onClick={() => nav('/ops/actions')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Inbox size={13} /> Approvals inbox</button>
          </div>
          <div className="pb-sum">
            <MiniStat value={`${Math.round(sim.machineSec)} s`} label="Machine time" />
            <MiniStat value={`${sim.manualMin} min`} label="Manual equivalent" />
            <MiniStat value={`${Math.max(0, Math.round(sim.manualMin - sim.machineSec / 60))} min`} label="Analyst time saved" color="var(--good)" />
            <MiniStat value={sim.verified} label="Write-backs verified" color="var(--good)" />
            <MiniStat value={sim.blocked} label="Blocked by policy" color={sim.blocked ? 'var(--bad)' : undefined} />
            <MiniStat value={Object.keys(sim.visited).length} label={`Nodes run of ${graph.nodes.length}`} />
          </div>
          {sim.waiting && (
            <div style={{ marginTop: 12 }}>
              <Callout kind="warn">
                <b>Waiting at "{waitingNode?.label}".</b> {sim.waiting.need === 2 ? 'High risk: two approvers incl. a Tenant Admin, 4 h expiry.' : 'One approver with the Approver role, 24 h expiry.'} Approve or deny on the canvas.
              </Callout>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Callout kind="info">Live runs hold medium and high-risk write-backs in the <b>Action Centre</b> for approval; every write-back is signed, dispatched to the customer's data plane and verified, and OT is never written to.</Callout>
          </div>
        </section>
      </div>

      {history && (
        <Drawer title="Version history" sub={`${pb.name} · ${pb.versions.length} versions`} onClose={() => setHistory(false)}>
          <div className="stack" style={{ gap: 12 }}>
            <KV rows={[['Status', <Badge key="s" color={STATUS_COLOR[pb.status]} dot>{STATUS_LABEL[pb.status]}</Badge>], ['Current', `v${pb.version}${pb.dirty ? ' (draft changes pending)' : ''}`], ['Trigger', triggerLabel(c, pb)], ['Publishing', `Submit → approval by an Approver → active. Signed and written to the audit ledger.`]]} />
            {pb.status === 'review' && <Callout kind="info">Submitted by {pb.submittedBy ?? me.name}; awaiting approval by {reviewer}.</Callout>}
            <Timeline items={pb.versions.map((v) => ({ time: fmtAgo(agoOf(v.minAgo, v.at)), title: `v${v.v} · ${v.note}`, body: `by ${v.by}`, color: v.v === pb.version ? 'var(--m-soc)' : undefined }))} />
          </div>
        </Drawer>
      )}
      {ghost && <div className="pb-ghost" style={{ left: ghost.x, top: ghost.y }}>{OP[ghost.op].label}</div>}
    </div>
  );
}

/* ---------------- Properties: node ---------------- */
function NodeProps({ node: n, issues, onPatch, onFocusEdit, onDelete, disabled }: { node: PbNode; issues: Issue[]; onPatch: (p: Partial<PbNode>, live?: boolean) => void; onFocusEdit: () => void; onDelete: () => void; disabled: boolean }) {
  const { customer: c } = useApp();
  const def = OP[n.op];
  const tools = def?.caps ? toolsFor(c, def.caps) : [];
  const k = c.connectors.find((x) => x.id === n.tool);
  const ot = isOtWrite(c, n);
  const sameKind = OPS.filter((o) => o.kind === n.kind);
  const params = def?.params?.(c) ?? [];
  const risk = n.risk ?? 'medium';
  const col = nodeColor(c, n);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="pb-head" style={{ '--pb-c': col } as CVars}>
        <span className="ico">{nodeIcon(c, n)}</span>
        <div style={{ minWidth: 0 }}>
          <div className="section-label" style={{ margin: 0 }}>{KIND_META[n.kind].label}</div>
          <div className="muted" style={{ fontSize: 11 }}>{def?.blurb}</div>
        </div>
      </div>
      {issues.length > 0 && (
        <div className="pb-issues">
          {issues.map((i) => (
            <div key={i.id} className="pb-issue" style={{ '--pb-f': i.level === 'error' ? 'var(--bad)' : 'var(--sev-medium)' } as CVars}>
              {i.level === 'error' ? <XCircle /> : <AlertTriangle />}<span>{i.text}</span>
            </div>
          ))}
        </div>
      )}
      <label>Name<input className="input" value={n.label} disabled={disabled} onFocus={onFocusEdit} onChange={(e) => onPatch({ label: e.target.value }, true)} /></label>
      {sameKind.length > 1 && (
        <label>
          {n.kind === 'action' ? 'Write-back' : 'Type'}
          <select className="select" value={n.op} disabled={disabled} onChange={(e) => {
            const nd = OP[e.target.value];
            onPatch({ op: nd.id, label: nd.label, tool: nd.caps ? toolsFor(c, nd.caps)[0]?.id : undefined, params: { ...paramDefaults(c, nd.id) } });
          }}>
            {sameKind.map((o) => <option key={o.id} value={o.id}>{o.label}{o.caps && !toolsFor(c, o.caps).length ? ' (not connected)' : ''}{o.ot ? ' (blocked)' : ''}</option>)}
          </select>
        </label>
      )}
      {def?.caps && (
        <label>
          Tool ({def.caps.map((x) => CAP_LABEL[x]).join(' / ')})
          {tools.length ? (
            <select className="select" value={n.tool ?? ''} disabled={disabled} onChange={(e) => onPatch({ tool: e.target.value || undefined })}>
              {!k && <option value="">Choose a connected tool…</option>}
              {tools.map((t) => <option key={t.id} value={t.id}>{toolName(t)}{t.status !== 'healthy' ? ` (${t.status})` : ''}{n.kind === 'action' && !t.write.length ? ' · read-only' : ''}</option>)}
            </select>
          ) : (
            <Callout kind="warn">No {def.caps.map((x) => CAP_LABEL[x]).join(' / ')} tool is connected for {c.short}. Connect one in Integration Fabric or use a ticket instead.</Callout>
          )}
        </label>
      )}
      {k && <span className="src-chip" style={{ alignSelf: 'flex-start' }}>{k.env.toUpperCase()} · {k.dataPlaneId} · {k.write.length ? `write: ${k.write.join(', ')}` : 'read-only connector'}</span>}
      {ot && <OtReadOnly>This node would send a command to an OT system. HexaView refuses it at the action broker; replace it with "Open ITSM ticket" and "Page on-call" for the site engineer.</OtReadOnly>}
      {params.map(([key, label]) => (
        <label key={key}>
          {label}
          {key === 'expr' ? (
            <textarea className="input" rows={3} value={n.params[key] ?? ''} disabled={disabled} onFocus={onFocusEdit} onChange={(e) => onPatch({ params: { ...n.params, [key]: e.target.value } }, true)} />
          ) : (
            <input className="input" value={n.params[key] ?? ''} disabled={disabled} onFocus={onFocusEdit} onChange={(e) => onPatch({ params: { ...n.params, [key]: e.target.value } }, true)} />
          )}
        </label>
      ))}
      {n.kind === 'condition' && <div className="muted" style={{ fontSize: 11 }}>Fields from the trigger and enrichment steps are in scope. The <b style={{ color: 'var(--good)' }}>yes</b> port fires when true, <b style={{ color: 'var(--sev-medium)' }}>no</b> otherwise.</div>}
      {n.kind === 'approval' && (
        <>
          <label>
            Risk class approved
            <select className="select" value={risk} disabled={disabled} onChange={(e) => {
              const rk = e.target.value as PbRisk;
              onPatch({ risk: rk, label: n.label.startsWith('Approve (') || n.label === 'Two-person approval' ? (rk === 'high' ? 'Two-person approval' : `Approve (${rk} risk)`) : n.label, auto: rk === 'high' ? AUTO_RULES[0] : n.auto });
            }}>
              <option value="low">Low: auto-approve, logged</option>
              <option value="medium">Medium: one approver</option>
              <option value="high">High: two approvers incl. Tenant Admin</option>
            </select>
          </label>
          <PRows rows={[
            ['Approvers', approversFor(c, risk).length ? approversFor(c, risk).join(', ') : 'None (auto)'],
            ['Rule', RISK_RULES[risk].who],
            ['Expiry', RISK_RULES[risk].expiryH ? `${RISK_RULES[risk].expiryH} h, then the run is cancelled` : '—'],
          ]} />
          <label>
            Auto-approve rule
            <select className="select" value={risk === 'high' ? AUTO_RULES[0] : n.auto ?? AUTO_RULES[0]} disabled={disabled || risk !== 'medium'} onChange={(e) => onPatch({ auto: e.target.value })}>
              {AUTO_RULES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          {risk === 'high' && <div className="muted" style={{ fontSize: 11 }}>High-risk gates never auto-approve: a requester cannot approve their own request, and HexaSOC agents never execute these alone.</div>}
        </>
      )}
      {n.kind === 'action' && def && !ot && (
        <>
          <PRows rows={[
            ['Risk class', <Badge key="r" color={PB_RISK_COLOR[def.risk ?? 'low']} solid={def.risk === 'high'}>{(def.risk ?? 'low').toUpperCase()}</Badge>],
            ['Approval', RISK_RULES[def.risk ?? 'low'].who],
            ['Gate', issues.some((i) => i.id.startsWith('gate-')) ? <span key="g" style={{ color: def.risk === 'high' ? 'var(--bad)' : 'var(--sev-medium)' }}>Missing or too weak</span> : <span key="g" style={{ color: 'var(--good)' }}>{def.risk === 'low' ? 'Not needed (logged)' : 'Covered'}</span>],
            ['Rollback', def.risk === 'high' ? 'Automatic rollback for 24 h' : 'Reversible from the Action Centre'],
          ]} />
          {def.openc2 && (
            <div>
              <div className="section-label">OpenC2 envelope (signed ES256)</div>
              <div className="pb-envelope">{JSON.stringify({ action: def.openc2.action, target: { [def.openc2.target]: '{{entity}}' }, args: { 'x-hexaview': { connector: n.tool ?? null, risk: def.risk, approvals: RISK_APPROVERS[def.risk ?? 'low'], verify: true } } }, null, 1)}</div>
            </div>
          )}
        </>
      )}
      <Btn sm danger onClick={onDelete} disabled={disabled}><Trash2 /> Delete node</Btn>
    </div>
  );
}

/* ---------------- Properties: playbook overview ---------------- */
function Overview({ pb, issues, onIssue, onRename }: { pb: Playbook; issues: Issue[]; onIssue: (i: Issue) => void; onRename: (name: string) => void }) {
  const { customer: c } = useApp();
  const acts = pb.nodes.filter((n) => n.kind === 'action');
  const tools = [...new Set(pb.nodes.map((n) => c.connectors.find((k) => k.id === n.tool)).filter((k) => !!k).map((k) => k!.product))];
  return (
    <div className="stack" style={{ gap: 12 }}>
      <label>Playbook name<input className="input" value={pb.name} onChange={(e) => onRename(e.target.value)} /></label>
      <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.45 }}>{pb.summary}</div>
      <PRows rows={[
        ['Scope', pb.tenants === 'all' ? `All ${c.tenants.length} tenants` : pb.tenants.map((t) => c.tenants.find((x) => x.id === t)?.short ?? t).join(', ')],
        ['Write-backs', `${acts.length} (${acts.filter((a) => OP[a.op]?.risk === 'high').length} high risk)`],
        ['Tools', tools.join(', ') || '—'],
      ]} />
      <div>
        <div className="section-label">Validation</div>
        {issues.length ? (
          <div className="pb-issues">
            {issues.map((i) => (
              <button key={i.id} type="button" className="pb-issue" style={{ '--pb-f': i.level === 'error' ? 'var(--bad)' : 'var(--sev-medium)' } as CVars} onClick={() => onIssue(i)}>
                {i.level === 'error' ? <XCircle /> : <AlertTriangle />}<span>{i.text}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="pb-ok"><CheckCircle2 /> Every write-back is gated, every tool is connected, nothing writes to OT.</div>
        )}
      </div>
      <div>
        <div className="section-label">Gate policy</div>
        <div className="stack" style={{ gap: 4, fontSize: 11.5 }}>
          {(['low', 'medium', 'high'] as PbRisk[]).map((r) => (
            <div key={r} className="row" style={{ gap: 6 }}><Badge color={PB_RISK_COLOR[r]}>{r}</Badge><span className="muted">{RISK_RULES[r].who}</span></div>
          ))}
          <div className="row" style={{ gap: 6 }}><Badge color="var(--bad)">OT</Badge><span className="muted">Never: read-only by policy</span></div>
        </div>
      </div>
      <div className="muted" style={{ fontSize: 11 }}>Select a node to edit it. Delete removes the selection; Ctrl+Z / Ctrl+Y undo and redo.</div>
    </div>
  );
}


function PRows({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <div className="pb-rows">
      {rows.map(([k, v], i) => (
        <div key={i}>
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}
