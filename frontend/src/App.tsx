import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchHealth,
  fetchDashboards,
  type HealthResponse,
} from './lib/api';
import { Sidebar, type NavTab } from './components/Sidebar';
import { QueryWorkspace } from './components/QueryWorkspace';
import { PinnedDashboardView } from './components/PinnedDashboardView';
import { MetricCatalogView } from './components/MetricCatalogView';
import { BenchmarkView } from './components/BenchmarkView';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('ask');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [pinnedCount, setPinnedCount] = useState(0);
  const [queuedQuestion, setQueuedQuestion] = useState<string | null>(null);

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
      // Ignore if backend is offline; Sidebar displays health error
    }
  }, []);

  useEffect(() => {
    void loadHealth();
    void loadPinnedCount();
  }, [loadHealth, loadPinnedCount]);

  const handleAskQuestion = useCallback((q: string) => {
    setActiveTab('ask');
    if (q.trim()) {
      setQueuedQuestion(q);
    }
  }, []);

  const handleExternalQuestionConsumed = useCallback(() => {
    setQueuedQuestion(null);
  }, []);

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-[#1F2937]">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        health={health}
        healthLoading={healthLoading}
        healthError={healthError}
        onRefreshHealth={() => void loadHealth()}
        pinnedCount={pinnedCount}
      />

      <main className="flex-1 min-w-0 flex flex-col">
        {activeTab === 'ask' && (
          <QueryWorkspace
            externalQuestion={queuedQuestion}
            onExternalQuestionConsumed={handleExternalQuestionConsumed}
            onCardPinned={() => void loadPinnedCount()}
            onNavigateDashboard={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'dashboard' && (
          <PinnedDashboardView
            onCardsChanged={setPinnedCount}
            onAskQuestion={handleAskQuestion}
          />
        )}

        {activeTab === 'catalog' && (
          <MetricCatalogView onAskMetric={handleAskQuestion} />
        )}

        {activeTab === 'benchmark' && <BenchmarkView />}
      </main>
    </div>
  );
};

export default App;
