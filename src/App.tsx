import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { AppProvider, useApp } from './state/AppContext';
import { ROLE_BY_ID, canAccess } from './modules/roles';
import { Shell } from './components/Shell';
import { ModuleLayout } from './components/ModuleLayout';
import { MODULES } from './modules/registry';
import { PAGES } from './pages/registry';
import { isSignedIn } from './pages/auth/SignIn';

const SignIn = lazy(() => import('./pages/auth/SignIn'));
const CommandCentre = lazy(() => import('./pages/overview/CommandCentre'));
const BoardView = lazy(() => import('./pages/overview/BoardView'));
const ClosedLoop = lazy(() => import('./pages/overview/ClosedLoop'));

function Loading() {
  return <div className="empty">Loading…</div>;
}

// Tabs that were folded into another tab's sections keep working as links.
const REDIRECTS: Record<string, string> = {
  'comply/risks': '/comply/caas?section=risks',
  'comply/continuity': '/comply/caas?section=bia',
  'ops/trust': '/trust/portal',
};

/** Blocks a module the signed-in role is not licensed for, even via a typed URL. */
function RoleGuard({ moduleId, children }: { moduleId: string; children: ReactNode }) {
  const { persona, account, setPersona } = useApp();
  const nav = useNavigate();
  const mod = MODULES.find((m) => m.id === moduleId);
  const role = ROLE_BY_ID[persona] ?? ROLE_BY_ID.ciso;
  if (account !== 'customer' || !mod || mod.group === 'partner' || canAccess(role, moduleId)) return <>{children}</>;
  return (
    <div className="locked-page">
      <span className="lp-ico"><Lock size={24} /></span>
      <h2>{mod.product} is locked</h2>
      <p>{mod.title} is not included in the <b>{role.label}</b> role. Ask your Master user (Admin) for access.</p>
      <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
        <button className="btn primary" onClick={() => nav(role.landing)}>Go to my workspace</button>
        <button className="btn" onClick={() => setPersona('master')}>Switch to Master user (Admin)</button>
      </div>
    </div>
  );
}

function ModuleRoute({ moduleId }: { moduleId: string }) {
  const { tab } = useParams();
  const { search } = useLocation();
  const mod = MODULES.find((m) => m.id === moduleId)!;
  const redirect = REDIRECTS[`${moduleId}/${tab}`];
  if (redirect) return <Navigate to={redirect + (search ? `&${search.slice(1)}` : '')} replace />;
  const Page = tab ? PAGES[`${moduleId}/${tab}`] : undefined;
  if (!Page) return <Navigate to={`${mod.basePath}/${mod.tabs[0].id}`} replace />;
  return (
    <RoleGuard moduleId={moduleId}>
      <ModuleLayout moduleId={moduleId} tabId={tab}>
        <Suspense fallback={<Loading />}>
          <Page />
        </Suspense>
      </ModuleLayout>
    </RoleGuard>
  );
}

/** The signed-in app. Without a session, go to the branded sign-in first and come back. */
function Authed() {
  const { pathname, search } = useLocation();
  if (!isSignedIn()) return <Navigate to={`/signin${pathname !== '/' || search ? `?next=${encodeURIComponent(pathname + search)}` : ''}`} replace />;
  return (
        <Shell>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<CommandCentre />} />
              <Route
                path="/board"
                element={
                  <RoleGuard moduleId="board">
                    <ModuleLayout moduleId="board">
                      <BoardView />
                    </ModuleLayout>
                  </RoleGuard>
                }
              />
              <Route
                path="/loop"
                element={
                  <RoleGuard moduleId="loop">
                    <ModuleLayout moduleId="loop">
                      <ClosedLoop />
                    </ModuleLayout>
                  </RoleGuard>
                }
              />
              {MODULES.filter((m) => m.tabs.length).map((m) => (
                <Route key={m.id} path={`${m.basePath}`}>
                  <Route index element={<Navigate to={`${m.basePath}/${m.tabs[0].id}`} replace />} />
                  <Route path=":tab" element={<ModuleRoute moduleId={m.id} />} />
                </Route>
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Shell>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/signin" element={<Suspense fallback={null}><SignIn /></Suspense>} />
          <Route path="*" element={<Authed />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
