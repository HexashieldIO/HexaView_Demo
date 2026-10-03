import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppProvider } from './state/AppContext';
import { Shell } from './components/Shell';
import { ModuleLayout } from './components/ModuleLayout';
import { MODULES } from './modules/registry';
import { PAGES } from './pages/registry';

const CommandCentre = lazy(() => import('./pages/overview/CommandCentre'));
const BoardView = lazy(() => import('./pages/overview/BoardView'));
const ClosedLoop = lazy(() => import('./pages/overview/ClosedLoop'));

function Loading() {
  return <div className="empty">Loading…</div>;
}

function ModuleRoute({ moduleId }: { moduleId: string }) {
  const { tab } = useParams();
  const mod = MODULES.find((m) => m.id === moduleId)!;
  const Page = tab ? PAGES[`${moduleId}/${tab}`] : undefined;
  if (!Page) return <Navigate to={`${mod.basePath}/${mod.tabs[0].id}`} replace />;
  return (
    <ModuleLayout moduleId={moduleId} tabId={tab}>
      <Suspense fallback={<Loading />}>
        <Page />
      </Suspense>
    </ModuleLayout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Shell>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<CommandCentre />} />
              <Route
                path="/board"
                element={
                  <ModuleLayout moduleId="board">
                    <BoardView />
                  </ModuleLayout>
                }
              />
              <Route
                path="/loop"
                element={
                  <ModuleLayout moduleId="loop">
                    <ClosedLoop />
                  </ModuleLayout>
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
      </BrowserRouter>
    </AppProvider>
  );
}
