import { useEffect, type ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { Badge } from '../../components/ui';
import { SECTIONS, LocalProvider, type SectionId } from './compliance/shared';
import StreamSection from './compliance/Stream';
import FrameworksSection from './compliance/Frameworks';
import TasksSection from './compliance/Tasks';
import DriveSection from './compliance/Drive';
import RisksSection from './compliance/Risks';
import AssetsSection from './compliance/Assets';
import VendorsSection from './compliance/Vendors';
import IncidentsSection from './compliance/Incidents';
import BiaSection from './compliance/Bia';

const tone = MODULE_BY_ID.comply.tone;
const BODY: Record<SectionId, ComponentType> = {
  stream: StreamSection, frameworks: FrameworksSection, tasks: TasksSection, drive: DriveSection, risks: RisksSection,
  assets: AssetsSection, vendors: VendorsSection, incidents: IncidentsSection, bia: BiaSection,
};
const IDS = new Set<string>(SECTIONS.map((s) => s.id));

/** Map the older `?view=` deep links onto the sectioned workspace. */
function legacy(sp: URLSearchParams): URLSearchParams | null {
  if (sp.get('section')) return null;
  const view = sp.get('view');
  const next = new URLSearchParams(sp);
  const move = (section: SectionId, v?: string | null) => {
    next.set('section', section);
    if (v) next.set('view', v); else next.delete('view');
    return next;
  };
  if (view === 'controls' || view === 'frameworks') return move('frameworks');
  if (view === 'requirements' || view === 'soa') return move('frameworks', view);
  if (view === 'tasks') return move('tasks');
  if (view === 'evidence') return move('tasks', 'evidence');
  if (view === 'workflows') return move('stream');
  if (sp.get('status') === 'overdue') { next.delete('status'); next.set('overdue', '1'); return move('tasks'); }
  if (sp.get('overdue') === '1') return move('tasks');
  return null;
}

export default function ComplyCaas() {
  const { customer: c, tenantId } = useApp();
  const [sp, setSp] = useSearchParams();
  const fix = legacy(sp);
  useEffect(() => {
    if (fix) setSp(fix, { replace: true });
  }, [fix, setSp]);
  const params = fix ?? sp;
  const raw = params.get('section');
  const section: SectionId = raw && IDS.has(raw) ? (raw as SectionId) : 'frameworks';
  const Body = BODY[section];
  const pick = (id: SectionId) => {
    if (id === section) return;
    const next = new URLSearchParams();
    next.set('section', id);
    setSp(next);
  };

  return (
    <LocalProvider key={`${c.id}-${tenantId}`}>
      <nav className="cmp-subtabs" aria-label="Compliance registers">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" className={`cmp-subtab ${section === s.id ? 'on' : ''}`} onClick={() => pick(s.id)} aria-current={section === s.id ? 'page' : undefined}>
            {s.label}
          </button>
        ))}
        <span className="cmp-subtabs-end"><Badge color={tone} dot>Compliance authority: HexaShield</Badge></span>
      </nav>
      <Body key={section} />
    </LocalProvider>
  );
}
