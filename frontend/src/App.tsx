import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchHealth,
  fetchDashboards,
  type HealthResponse,
  type ParserMode,
} from './lib/api';
import { LandingPage } from './components/LandingPage';
import { Sidebar, type NavTab } from './components/Sidebar';
import { QueryWorkspace } from './components/QueryWorkspace';
import { PinnedDashboardView } from './components/PinnedDashboardView';
import { MetricCatalogView } from './components/MetricCatalogView';
import { BenchmarkView } from './components/BenchmarkView';

interface RouteState {
  page: 'landing' | 'app';
  view: NavTab;
}

function parseLocation(): RouteState {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/app') {
    const params = new URLSearchParams(window.location.search);
    const rawView = params.get('view');
    if (rawView === 'dashboard') return { page: 'app', view: 'dashboard' };
    if (rawView === 'metrics' || rawView === 'catalog') {
      return { page: 'app', view: 'metrics' };
    }
    if (rawView === 'benchmark') return { page: 'app', view: 'benchmark' };
    return { page: 'app', view: 'ask' };
  }
  return { page: 'landing', view: 'ask' };
}

export const App: React.FC = () => {
  const [route, setRoute] = useState<RouteState>(() => parseLocation());
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [pinnedCount, setPinnedCount] = useState(0);
  const [queuedQuestion, setQueuedQuestion] = useState<string | null>(null);
  const [parserMode, setParserMode] = useState<ParserMode | ''>('');

  const navigate = useCallback((targetPath: string) => {
    const normalized = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
    if (`${window.location.pathname}${window.location.search}` !== normalized) {
      window.history.pushState({}, '', normalized);
    }
    setRoute(parseLocation());
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseLocation());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const data = await fetchHealth();
      setHealth(data);
    } catch (err) {
      setHealth(null);
      setHealthError(
        err instanceof Error ? err.message : 'Unable to connect to backend.'
      );
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const loadPinnedCount = useCallback(async () => {
    try {
      const data = await fetchDashboards();
      setPinnedCount(data.cards.length);
    } catch {
      // Handled via sidebar health status
    }
  }, []);

  useEffect(() => {
    if (route.page === 'app') {
      void loadHealth();
      void loadPinnedCount();
    }
  }, [route.page, loadHealth, loadPinnedCount]);

  const handleSelectTab = useCallback(
    (tab: NavTab) => {
      const target = tab === 'ask' ? '/app' : `/app?view=${tab}`;
      navigate(target);
    },
    [navigate]
  );

  const handleAskQuestion = useCallback(
    (q: string) => {
      navigate('/app');
      if (q.trim()) {
        setQueuedQuestion(q);
      }
    },
    [navigate]
  );

  const handleExternalQuestionConsumed = useCallback(() => {
    setQueuedQuestion(null);
  }, []);

  if (route.page === 'landing') {
    return <LandingPage onNavigate={navigate} />;
  }

  return (
    <div className="min-h-screen flex bg-[#FFFFFF] text-[#09090B]">
      <Sidebar
        activeTab={route.view}
        onSelectTab={handleSelectTab}
        onNavigateHome={() => navigate('/')}
        health={health}
        healthLoading={healthLoading}
        healthError={healthError}
        onRefreshHealth={() => void loadHealth()}
        pinnedCount={pinnedCount}
        parserMode={parserMode}
        onParserModeChange={setParserMode}
      />

      <main className="flex-1 min-w-0 flex flex-col">
        {route.view === 'ask' && (
          <QueryWorkspace
            externalQuestion={queuedQuestion}
            onExternalQuestionConsumed={handleExternalQuestionConsumed}
            onCardPinned={() => void loadPinnedCount()}
            onNavigateDashboard={() => handleSelectTab('dashboard')}
            parserMode={parserMode}
          />
        )}

        {route.view === 'dashboard' && (
          <PinnedDashboardView
            onCardsChanged={setPinnedCount}
            onAskQuestion={handleAskQuestion}
          />
        )}

        {route.view === 'metrics' && (
          <MetricCatalogView onAskMetric={handleAskQuestion} />
        )}

        {route.view === 'benchmark' && <BenchmarkView />}
      </main>
    </div>
  );
};

export default App;
