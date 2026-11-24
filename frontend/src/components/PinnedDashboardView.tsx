import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  Trash2,
  AlertTriangle,
  ArrowUpRight,
  ArrowRight,
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
        err instanceof Error
          ? err.message
          : 'Failed to fetch pinned dashboard cards.'
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
        err instanceof Error
          ? err.message
          : 'Failed to refresh all dashboard cards.'
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
    <div className="flex-1 min-w-0 min-h-screen bg-[#FFFFFF] flex flex-col">
      {/* Flat Header */}
      <header className="sticky top-0 z-10 bg-[#FFFFFF] border-b border-[#E5E7EB] px-8 h-[68px] flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[20px] font-bold text-[#09090B] leading-tight">
            Live Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {cards.length > 0 && (
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={refreshingAll || loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded border border-[#BDC4D0] bg-[#FFFFFF] hover:border-[#09090B] text-[13px] font-semibold text-[#09090B] transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#67689E] ${
                  refreshingAll ? 'animate-spin' : ''
                }`}
              />
              Refresh All
            </button>
          )}
          <button
            type="button"
            onClick={() => onAskQuestion('')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#67689E] hover:bg-[#545588] text-[#FFFFFF] text-[13px] font-semibold transition-colors"
          >
            <span>New Query</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 px-8 py-6 max-w-[1400px] w-full mx-auto space-y-6">
        {error && (
          <div className="rounded border border-[#E5E7EB] border-l-4 border-l-[#FF0F5B] bg-[#FFFFFF] px-4 py-3 flex items-center justify-between gap-3 text-[13px] text-[#09090B]">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#FF0F5B] shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadCards()}
              className="font-semibold text-[#67689E] hover:underline shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex items-center gap-3 text-[#4B5563]">
            <Loader2 className="w-4 h-4 text-[#67689E] animate-spin" />
            <span className="text-[13.5px] font-medium text-[#09090B]">
              Loading live dashboard panels...
            </span>
          </div>
        ) : cards.length === 0 ? (
          <div className="border-t-2 border-t-[#67689E] border border-[#E5E7EB] rounded-md p-8 max-w-lg mt-4 space-y-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#4B5563]">
              Live Persistence
            </div>
            <h2 className="font-display text-[20px] font-bold text-[#09090B]">
              No pinned views yet
            </h2>
            <p className="text-[14px] text-[#4B5563] leading-relaxed">
              Run any verified query in Ask Aegistic and click{' '}
              <strong className="text-[#09090B]">Pin to Dashboard</strong> to track live
              Gold warehouse metrics here with one-click refresh.
            </p>
            <button
              type="button"
              onClick={() => onAskQuestion('')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#67689E] hover:bg-[#545588] text-[#FFFFFF] text-[13.5px] font-semibold transition-colors"
            >
              <span>Open Ask Aegistic</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {cards.map((card) => {
              const isRefreshing = Boolean(refreshingIds[card.id]);
              const isDeleting = Boolean(deletingIds[card.id]);
              const res = card.response;

              return (
                <article
                  key={card.id}
                  className="rounded-md bg-[#FFFFFF] border border-[#BDC4D0] flex flex-col overflow-hidden"
                >
                  {/* Panel Header */}
                  <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-2 h-2 rounded-full bg-[#5BC2F4] shrink-0" />
                        <h2 className="font-display text-[15.5px] font-bold text-[#09090B] leading-snug">
                          {card.title}
                        </h2>
                      </div>
                      <p
                        className="text-[12.5px] text-[#4B5563] mt-1 truncate"
                        title={card.question}
                      >
                        {card.question}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        title="Open in Ask Aegistic"
                        onClick={() => onAskQuestion(card.question)}
                        className="p-1.5 rounded text-[#4B5563] hover:text-[#09090B] hover:bg-[#F7F8FA] transition-colors"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Refresh live from DuckDB"
                        disabled={isRefreshing || isDeleting}
                        onClick={() => void handleRefreshCard(card.id)}
                        className="p-1.5 rounded text-[#4B5563] hover:text-[#67689E] hover:bg-[#F7F8FA] transition-colors disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#67689E]' : ''}`}
                        />
                      </button>
                      <button
                        type="button"
                        title="Delete pinned view"
                        disabled={isDeleting}
                        onClick={() => void handleDeleteCard(card.id)}
                        className="p-1.5 rounded text-[#4B5563] hover:text-[#FF0F5B] hover:bg-[#F7F8FA] transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Warning Strip */}
                  {res.warnings && res.warnings.length > 0 && (
                    <div className="px-5 py-2 border-b border-[#E5E7EB] border-l-4 border-l-[#FF0F5B] bg-[#F7F8FA] flex items-center gap-2 text-[12px] text-[#09090B]">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#FF0F5B] shrink-0" />
                      <span className="font-semibold">{res.warnings[0].title}:</span>
                      <span className="text-[#4B5563] truncate">
                        {res.warnings[0].message}
                      </span>
                    </div>
                  )}

                  {/* Chart Body */}
                  <div className="p-5 flex-1">
                    <ChartRenderer
                      chartSpec={res.chart_spec}
                      columns={res.columns}
                      data={res.data}
                      compact
                    />
                  </div>

                  {/* Flat Footer */}
                  <div className="px-5 py-2.5 bg-[#F7F8FA] border-t border-[#E5E7EB] flex items-center justify-between text-[11.5px] font-mono text-[#4B5563] tabular-nums">
                    <span>Refreshed {formatTimestamp(card.refreshed_at)}</span>
                    <span>
                      {res.audit_trail.row_count} rows ·{' '}
                      {res.audit_trail.latency_ms.toFixed(1)} ms
                    </span>
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
