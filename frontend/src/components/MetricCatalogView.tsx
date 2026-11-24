import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  BookOpenCheck,
  AlertTriangle,
  Database,
  Filter,
  UserCheck,
  Code2,
  Sparkles,
  Loader2,
  Layers,
} from 'lucide-react';
import { fetchMetrics, type MetricCatalogResponse } from '../lib/api';

interface MetricCatalogViewProps {
  onAskMetric: (question: string) => void;
}

const FORMAT_LABELS: Record<string, string> = {
  currency_idr: 'IDR Currency',
  percentage: 'Percentage',
  integer: 'Integer',
  decimal: 'Decimal',
};

export const MetricCatalogView: React.FC<MetricCatalogViewProps> = ({
  onAskMetric,
}) => {
  const [catalog, setCatalog] = useState<MetricCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [expandedSql, setExpandedSql] = useState<Record<string, boolean>>({});

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMetrics();
      setCatalog(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load metric catalog.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const filteredMetrics = useMemo(() => {
    if (!catalog) return [];
    const q = search.trim().toLowerCase();
    return catalog.metrics.filter((m) => {
      if (formatFilter !== 'all' && m.format !== formatFilter) return false;
      if (!q) return true;
      return (
        m.key.toLowerCase().includes(q) ||
        m.label.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.formula_display.toLowerCase().includes(q) ||
        m.owner.toLowerCase().includes(q)
      );
    });
  }, [catalog, search, formatFilter]);

  const filteredDimensions = useMemo(() => {
    if (!catalog) return [];
    const q = search.trim().toLowerCase();
    if (!q) return catalog.dimensions;
    return catalog.dimensions.filter(
      (d) =>
        d.key.toLowerCase().includes(q) ||
        d.label.toLowerCase().includes(q) ||
        d.table.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
    );
  }, [catalog, search]);

  const availableFormats = useMemo(() => {
    if (!catalog) return [];
    return Array.from(new Set(catalog.metrics.map((m) => m.format)));
  }, [catalog]);

  return (
    <div className="flex-1 min-w-0 min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#FFFFFF]/95 backdrop-blur border-b border-[#E2E8F0] px-7 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[19px] font-bold text-[#111827] leading-tight">
              Metric Catalog
            </h1>
            {catalog && (
              <span className="font-mono text-[11.5px] font-medium px-2 py-0.5 rounded bg-[#EBF6FD] text-[#1B6CA8] border border-[#4DA8E5]/30">
                {catalog.model_name} v{catalog.version}
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#526075] mt-0.5">
            {catalog?.description ||
              'Read-only governed semantic layer rendered live from semantic_models/commerce.yaml'}
          </p>
        </div>

        {catalog && (
          <div className="flex items-center gap-3 text-[12.5px]">
            <span className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] font-semibold text-[#111827] tabular-nums">
              {catalog.metrics.length} Metrics
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] font-semibold text-[#111827] tabular-nums">
              {catalog.dimensions.length} Dimensions
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-[#EEF0FA] text-[#3B498B] font-semibold">
              {catalog.currency}
            </span>
          </div>
        )}
      </header>

      <div className="flex-1 px-7 py-6 max-w-[1440px] w-full mx-auto space-y-6">
        {/* Search & Format Filter Bar */}
        <div className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-[#526075] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search metrics, formulas, owners, or dimensions..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#CBD5E1] text-[13.5px] text-[#111827] placeholder:text-[#526075] focus:outline-none focus:ring-2 focus:ring-[#3B498B]/30 focus:border-[#3B498B]"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setFormatFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors ${
                formatFilter === 'all'
                  ? 'bg-[#3B498B] text-[#FFFFFF]'
                  : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#1F2937] hover:bg-[#EEF0FA]'
              }`}
            >
              All Formats
            </button>
            {availableFormats.map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setFormatFilter(fmt)}
                className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors ${
                  formatFilter === fmt
                    ? 'bg-[#3B498B] text-[#FFFFFF]'
                    : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#1F2937] hover:bg-[#EEF0FA]'
                }`}
              >
                {FORMAT_LABELS[fmt] ?? fmt}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-[#FFF1F2] border border-[#FECDD3] px-5 py-4 flex items-center justify-between text-[13px] text-[#9F1239]">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#E11D48]" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadCatalog()}
              className="font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] p-12 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 text-[#3B498B] animate-spin" />
            <span className="text-[14px] font-medium text-[#1F2937]">
              Loading semantic layer definitions...
            </span>
          </div>
        ) : (
          <>
            {/* Official Metrics Grid */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[15.5px] font-bold text-[#111827] flex items-center gap-2">
                  <BookOpenCheck className="w-4 h-4 text-[#3B498B]" />
                  Official Governed Metrics
                  <span className="text-[13px] font-medium text-[#526075] tabular-nums">
                    ({filteredMetrics.length})
                  </span>
                </h2>
              </div>

              {filteredMetrics.length === 0 ? (
                <div className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] p-8 text-center text-[13.5px] text-[#526075]">
                  No metrics match your current search filter.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {filteredMetrics.map((metric) => {
                    const showRawSql = Boolean(expandedSql[metric.key]);
                    return (
                      <article
                        key={metric.key}
                        className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card p-5 flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-3.5">
                          {/* Title & Badges */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-[16px] font-bold text-[#111827] leading-snug">
                                {metric.label}
                              </h3>
                              <div className="flex items-center flex-wrap gap-2 mt-1.5">
                                <span className="font-mono text-[11.5px] px-2 py-0.5 rounded bg-[#EEF0FA] text-[#3B498B] font-semibold">
                                  {metric.key}
                                </span>
                                <span className="text-[11.5px] px-2 py-0.5 rounded bg-[#EBF6FD] text-[#1B6CA8] font-semibold">
                                  {FORMAT_LABELS[metric.format] ?? metric.format}
                                </span>
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-[#F1F5F9] text-[#526075]">
                                  <Database className="w-3 h-3" />
                                  {metric.base_table} ({metric.grain})
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                onAskMetric(
                                  `Tampilkan ${metric.label} per bulan selama 6 bulan terakhir`
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3B498B] hover:bg-[#2D3870] text-[#FFFFFF] text-[12px] font-semibold transition-colors shrink-0"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              Query
                            </button>
                          </div>

                          <p className="text-[13px] text-[#1F2937] leading-relaxed">
                            {metric.description}
                          </p>

                          {/* Formula Block */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#526075]">
                                {showRawSql ? 'Compiled SQL Expression' : 'Business Formula'}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedSql((prev) => ({
                                    ...prev,
                                    [metric.key]: !prev[metric.key],
                                  }))
                                }
                                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#3B498B] hover:text-[#2D3870]"
                              >
                                <Code2 className="w-3.5 h-3.5" />
                                {showRawSql ? 'Show formula' : 'Inspect SQL'}
                              </button>
                            </div>
                            <pre className="sql-code-block rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-words">
                              <code>
                                {showRawSql
                                  ? metric.sql_expression
                                  : metric.formula_display}
                              </code>
                            </pre>
                          </div>

                          {/* Mandatory Filters & Allowed Dimensions */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div>
                              <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#526075] mb-1.5">
                                <Filter className="w-3 h-3 text-[#3B498B]" />
                                Mandatory Filters
                              </div>
                              {metric.mandatory_filters.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {metric.mandatory_filters.map((f, idx) => (
                                    <span
                                      key={idx}
                                      className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#EBF6FD] text-[#1B6CA8] border border-[#4DA8E5]/30"
                                    >
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[12px] text-[#526075]">
                                  None (all order statuses included)
                                </span>
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#526075] mb-1.5">
                                <Layers className="w-3 h-3 text-[#4DA8E5]" />
                                Allowed Dimensions
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {metric.allowed_dimensions.map((dim) => (
                                  <span
                                    key={dim}
                                    className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#F1F5F9] text-[#1F2937] border border-[#E2E8F0]"
                                  >
                                    {dim}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Crimson Caveat Callouts */}
                          {metric.caveats.length > 0 && (
                            <div className="rounded-lg bg-[#FFF1F2] border border-[#FECDD3] px-3.5 py-2.5 space-y-1">
                              <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#9F1239]">
                                <AlertTriangle className="w-3.5 h-3.5 text-[#E11D48]" />
                                Business Caveats
                              </div>
                              {metric.caveats.map((caveat, cIdx) => (
                                <p
                                  key={cIdx}
                                  className="text-[12px] text-[#9F1239] leading-relaxed"
                                >
                                  • {caveat}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Owner Footer */}
                        <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-[12px] text-[#526075]">
                          <span className="inline-flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-[#3B498B]" />
                            Owner:{' '}
                            <strong className="font-semibold text-[#111827]">
                              {metric.owner}
                            </strong>
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Official Dimensions Table */}
            <section className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                <h2 className="text-[15.5px] font-bold text-[#111827] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#4DA8E5]" />
                  Official Dimensions
                  <span className="text-[13px] font-medium text-[#526075] tabular-nums">
                    ({filteredDimensions.length})
                  </span>
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0]">
                      <th className="px-5 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-[#526075]">
                        Dimension
                      </th>
                      <th className="px-5 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-[#526075]">
                        Gold Source
                      </th>
                      <th className="px-5 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-[#526075]">
                        Type &amp; Grains
                      </th>
                      <th className="px-5 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-[#526075]">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] bg-[#FFFFFF]">
                    {filteredDimensions.map((dim) => (
                      <tr key={dim.key} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="text-[13.5px] font-semibold text-[#111827]">
                            {dim.label}
                          </div>
                          <div className="font-mono text-[11.5px] text-[#3B498B] mt-0.5">
                            {dim.key}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="font-mono text-[12px] px-2 py-1 rounded bg-[#F1F5F9] text-[#111827] border border-[#E2E8F0]">
                            {dim.table}.{dim.column}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="text-[11.5px] font-semibold uppercase px-2 py-0.5 rounded bg-[#EBF6FD] text-[#1B6CA8]">
                              {dim.type}
                            </span>
                            {dim.supported_grains?.map((g) => (
                              <span
                                key={g}
                                className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#EEF0FA] text-[#3B498B]"
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-[#1F2937]">
                          {dim.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};
