import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  RefreshCw,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  MessageSquareCode,
  Loader2,
} from 'lucide-react';
import {
  fetchDashboards,
  refreshDashboardCard,
  deleteDashboardCard,
  formatTimestamp,
  type DashboardCard,
} from '../lib/api';
import { ChartRenderer } from './ChartRenderer';

interface PinnedDashboardViewProps {
  onCardsChanged: (count: number) => void;
  onAskQuestion: (question: string) => void;
}

export const PinnedDashboardView: React.FC<PinnedDashboardViewProps> = ({
  onCardsChanged,
  onAskQuestion,
}) => {
  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingIds, setRefreshingIds] = useState<Record<string, boolean>>({});
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [refreshingAll, setRefreshingAll] = useState(false);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDashboards();
      setCards(res.cards);
      onCardsChanged(res.cards.length);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch pinned dashboard cards.'
      );
    } finally {
      setLoading(false);
    }
  }, [onCardsChanged]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const handleRefreshCard = async (cardId: string) => {
    setRefreshingIds((prev) => ({ ...prev, [cardId]: true }));
    setError(null);
    try {
      const updated = await refreshDashboardCard(cardId);
      setCards((prev) => prev.map((c) => (c.id === cardId ? updated : c)));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to refresh dashboard card.'
      );
    } finally {
      setRefreshingIds((prev) => ({ ...prev, [cardId]: false }));
    }
  };

  const handleRefreshAll = async () => {
    if (cards.length === 0) return;
    setRefreshingAll(true);
    setError(null);
    try {
      const updated = await Promise.all(
        cards.map((card) => refreshDashboardCard(card.id))
      );
      setCards(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to refresh all dashboard cards.'
      );
    } finally {
      setRefreshingAll(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    setDeletingIds((prev) => ({ ...prev, [cardId]: true }));
    setError(null);
    try {
      await deleteDashboardCard(cardId);
      setCards((prev) => {
        const next = prev.filter((c) => c.id !== cardId);
        onCardsChanged(next.length);
        return next;
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete dashboard card.'
      );
    } finally {
      setDeletingIds((prev) => ({ ...prev, [cardId]: false }));
    }
  };

  return (
    <div className="flex-1 min-w-0 min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#FFFFFF]/95 backdrop-blur border-b border-[#E2E8F0] px-7 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[19px] font-bold text-[#111827] leading-tight">
            Live Dashboard
          </h1>
          <p className="text-[13px] text-[#526075] mt-0.5">
            Persistent executive views backed by live DuckDB Gold queries and semantic guardrails
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {cards.length > 0 && (
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={refreshingAll || loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] text-[13px] font-semibold text-[#1F2937] transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 text-[#3B498B] ${refreshingAll ? 'animate-spin' : ''}`}
              />
              Refresh All
            </button>
          )}
          <button
            type="button"
            onClick={() => onAskQuestion('')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B498B] hover:bg-[#2D3870] text-[#FFFFFF] text-[13px] font-semibold transition-colors shadow-sm"
          >
            <MessageSquareCode className="w-4 h-4" />
            Ask Aegistic
          </button>
        </div>
      </header>

      <div className="flex-1 px-7 py-6 max-w-[1440px] w-full mx-auto space-y-5">
        {error && (
          <div className="rounded-xl bg-[#FFF1F2] border border-[#FECDD3] px-5 py-3.5 flex items-center justify-between gap-3 text-[13px] text-[#9F1239]">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#E11D48] shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadCards()}
              className="font-semibold underline hover:no-underline shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] p-12 flex items-center justify-center gap-3 text-[#526075]">
            <Loader2 className="w-5 h-5 text-[#3B498B] animate-spin" />
            <span className="text-[14px] font-medium text-[#1F2937]">
              Loading live dashboard cards...
            </span>
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card p-12 text-center max-w-xl mx-auto mt-8">
            <div className="w-12 h-12 rounded-xl bg-[#EEF0FA] text-[#3B498B] flex items-center justify-center mx-auto mb-4">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <h2 className="text-[17px] font-bold text-[#111827]">
              No Pinned Insights Yet
            </h2>
            <p className="text-[13.5px] text-[#526075] mt-1.5 leading-relaxed">
              Run a verified question in Ask Aegistic and click{' '}
              <strong className="text-[#111827]">Pin to Dashboard</strong> to save live,
              one-click refreshable charts here.
            </p>
            <button
              type="button"
              onClick={() => onAskQuestion('')}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#3B498B] hover:bg-[#2D3870] text-[#FFFFFF] text-[13.5px] font-semibold transition-colors shadow-sm"
            >
              <MessageSquareCode className="w-4 h-4" />
              Go to Ask Aegistic
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {cards.map((card) => {
              const isRefreshing = Boolean(refreshingIds[card.id]);
              const isDeleting = Boolean(deletingIds[card.id]);
              const res = card.response;

              return (
                <article
                  key={card.id}
                  className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card flex flex-col overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-[15px] font-bold text-[#111827] leading-snug">
                          {card.title}
                        </h2>
                        {res.status === 'verified' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EBF6FD] text-[#1B6CA8] text-[11px] font-semibold">
                            <ShieldCheck className="w-3 h-3 text-[#4DA8E5]" />
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="text-[12.5px] text-[#526075] mt-1 truncate" title={card.question}>
                        &ldquo;{card.question}&rdquo;
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        title="Open query in Ask Aegistic"
                        onClick={() => onAskQuestion(card.question)}
                        className="p-1.5 rounded-md text-[#526075] hover:text-[#3B498B] hover:bg-[#EEF0FA] transition-colors"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Refresh live from DuckDB"
                        disabled={isRefreshing || isDeleting}
                        onClick={() => void handleRefreshCard(card.id)}
                        className="p-1.5 rounded-md text-[#526075] hover:text-[#3B498B] hover:bg-[#EEF0FA] transition-colors disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#3B498B]' : ''}`}
                        />
                      </button>
                      <button
                        type="button"
                        title="Delete pinned card"
                        disabled={isDeleting}
                        onClick={() => void handleDeleteCard(card.id)}
                        className="p-1.5 rounded-md text-[#526075] hover:text-[#E11D48] hover:bg-[#FFF1F2] transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Card Warning Strip (if any) */}
                  {res.warnings && res.warnings.length > 0 && (
                    <div className="px-5 py-2 bg-[#FFF1F2] border-b border-[#FECDD3] flex items-center gap-2 text-[12px] text-[#9F1239]">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#E11D48] shrink-0" />
                      <span className="font-semibold">{res.warnings[0].title}:</span>
                      <span className="truncate">{res.warnings[0].message}</span>
                    </div>
                  )}

                  {/* Card Visualization Body */}
                  <div className="p-5 flex-1">
                    <ChartRenderer
                      chartSpec={res.chart_spec}
                      columns={res.columns}
                      data={res.data}
                      compact
                    />
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-[12px] text-[#526075]">
                    <div className="flex items-center gap-1.5 tabular-nums">
                      <Clock className="w-3.5 h-3.5 text-[#4DA8E5]" />
                      <span>Refreshed: {formatTimestamp(card.refreshed_at)}</span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span>{res.audit_trail.row_count} rows</span>
                      <span>{res.audit_trail.latency_ms.toFixed(1)} ms</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
