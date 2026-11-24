import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  Trash2,
  ArrowUpRight,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  fetchDashboards,
  refreshDashboardCard,
  deleteDashboardCard,
  formatTimestamp,
  formatEditorialWarning,
  hasPartialPeriodWarning,
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
                className={`w-3.5 h-3.5 text-[#09090B] ${
                  refreshingAll ? 'animate-spin' : ''
                }`}
              />
              Refresh All
            </button>
          )}
          <button
            type="button"
            onClick={() => onAskQuestion('')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#FF0F5B] hover:bg-[#DC0A4D] active:bg-[#BE0842] text-[#FFFFFF] text-[13px] font-semibold transition-colors"
          >
            <span>New Query</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 px-8 py-6 max-w-[1400px] w-full mx-auto space-y-6">
        {error && (
          <div className="rounded-md bg-[#09090B] text-[#FFFFFF] px-4 py-3 flex items-center justify-between gap-3 text-[13px]">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#FF0F5B] shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadCards()}
              className="font-semibold text-[#FF0F5B] hover:underline shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex items-center gap-3 text-[#4B5563]">
            <Loader2 className="w-4 h-4 text-[#FF0F5B] animate-spin" />
            <span className="text-[13.5px] font-medium text-[#09090B]">
              Loading live dashboard panels...
            </span>
          </div>
        ) : cards.length === 0 ? (
          <div className="border-t-2 border-t-[#FF0F5B] border border-[#E5E7EB] rounded-md p-8 max-w-lg mt-4 space-y-4">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#4B5563]">
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
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#FF0F5B] hover:bg-[#DC0A4D] active:bg-[#BE0842] text-[#FFFFFF] text-[13.5px] font-semibold transition-colors"
            >
              <span>Ask Aegistic</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {cards.map((card) => {
              const isRefreshing = Boolean(refreshingIds[card.id]);
              const isDeleting = Boolean(deletingIds[card.id]);
              const res = card.response;
              const primaryWarning =
                res.warnings && res.warnings.length > 0
                  ? formatEditorialWarning(res.warnings[0])
                  : null;
              const partialActive = hasPartialPeriodWarning(res.warnings);

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
                        className="p-1.5 rounded text-[#4B5563] hover:text-[#09090B] hover:bg-[#F7F8FA] transition-colors disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#FF0F5B]' : ''}`}
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

                  {/* Docked Tier-A Sanity Band (Zero left border stripe, humanized pill) */}
                  {primaryWarning && (
                    <div className="px-5 py-2 border-b border-[#E5E7EB] bg-[#FFF5F8] flex flex-wrap items-center gap-2 text-[12px]">
                      <span
                        className="relative flex h-2 w-2 shrink-0"
                        aria-hidden="true"
                      >
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF0F5B] opacity-60" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF0F5B]" />
                      </span>
                      <span className="font-bold text-[#09090B]">
                        {primaryWarning.label}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#E5E7EB] text-[11px] font-semibold text-[#09090B] tabular-nums">
                        {primaryWarning.pill}
                      </span>
                      <span className="text-[#4B5563] truncate flex-1 min-w-[160px]">
                        {primaryWarning.message}
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
                      hasPartialPeriod={partialActive}
                    />
                  </div>

                  {/* Flat Footer */}
                  <div className="px-5 py-2.5 bg-[#F7F8FA] border-t border-[#E5E7EB] flex items-center justify-between text-[12px] font-medium text-[#4B5563] tabular-nums">
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
