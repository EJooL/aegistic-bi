import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, ArrowRight, Loader2 } from 'lucide-react';
import {
  fetchMetrics,
  humanizeIdentifier,
  type MetricCatalogResponse,
} from '../lib/api';

interface MetricCatalogViewProps {
  onAskMetric: (question: string) => void;
}

const FORMAT_LABELS: Record<string, string> = {
  currency_idr: 'IDR Currency',
  percentage: 'Percentage',
  integer: 'Integer',
  decimal: 'Decimal',
  float: 'Float',
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
    <div className="flex-1 min-w-0 min-h-screen bg-[#FFFFFF] flex flex-col">
      {/* Header */}
      <header className="sticky top-[60px] lg:top-0 z-10 bg-[#FFFFFF]/95 backdrop-blur-sm border-b border-[#E5E7EB] px-5 sm:px-8 h-[68px] flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="font-display text-[20px] font-bold text-[#09090B] leading-tight shrink-0">
            Metric Catalog
          </h1>
          {catalog && (
            <span className="hidden sm:inline text-[13px] font-medium text-[#4B5563] truncate">
              {catalog.model_name} v{catalog.version} · {catalog.currency}
            </span>
          )}
        </div>

        {catalog && (
          <div className="flex items-center gap-4 text-[13px] text-[#4B5563] tabular-nums shrink-0">
            <span>
              <strong className="font-bold text-[#09090B]">
                {catalog.metrics.length}
              </strong>{' '}
              metrics
            </span>
            <span>
              <strong className="font-bold text-[#09090B]">
                {catalog.dimensions.length}
              </strong>{' '}
              dimensions
            </span>
          </div>
        )}
      </header>

      <div className="flex-1 px-5 sm:px-8 py-6 max-w-[1400px] w-full mx-auto space-y-8">
        {/* Search & Connected Segmented Format Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#E5E7EB]">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-[#4B5563] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search metrics, formulas, owners, dimensions..."
              aria-label="Search metric catalog"
              className="w-full pl-9 pr-3.5 py-2 rounded border border-[#BDC4D0] bg-[#FFFFFF] text-[13.5px] text-[#09090B] placeholder:text-[#4B5563] transition-colors duration-150 focus:outline-none focus:border-[#09090B]"
            />
          </div>

          <div
            className="inline-flex rounded border border-[#BDC4D0] overflow-hidden divide-x divide-[#E5E7EB] bg-[#FFFFFF]"
            role="group"
            aria-label="Filter metrics by value format"
          >
            <button
              type="button"
              onClick={() => setFormatFilter('all')}
              aria-pressed={formatFilter === 'all'}
              className={`px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors duration-150 ${
                formatFilter === 'all'
                  ? 'bg-[#09090B] text-[#FFFFFF]'
                  : 'bg-[#FFFFFF] text-[#4B5563] hover:bg-[#F7F8FA] hover:text-[#09090B]'
              }`}
            >
              All formats
            </button>
            {availableFormats.map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setFormatFilter(fmt)}
                aria-pressed={formatFilter === fmt}
                className={`px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors duration-150 ${
                  formatFilter === fmt
                    ? 'bg-[#09090B] text-[#FFFFFF]'
                    : 'bg-[#FFFFFF] text-[#4B5563] hover:bg-[#F7F8FA] hover:text-[#09090B]'
                }`}
              >
                {FORMAT_LABELS[fmt] ?? humanizeIdentifier(fmt)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-[#09090B] text-[#FFFFFF] px-4 py-3.5 flex items-center justify-between text-[13.5px]">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#FF0F5B] shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadCatalog()}
              className="font-semibold text-[#FF0F5B] hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex items-center gap-3 text-[#4B5563]">
            <Loader2 className="w-4 h-4 text-[#FF0F5B] animate-spin" />
            <span className="text-[14px] font-medium text-[#09090B]">
              Loading governed metrics from semantic_models/commerce.yaml...
            </span>
          </div>
        ) : (
          <div className="space-y-10 animate-stage-fade">
            {/* Governed Metrics Grid */}
            <section className="space-y-4">
              <h2 className="font-display text-[17px] font-bold text-[#09090B]">
                Official governed metrics{' '}
                <span className="text-[13.5px] font-medium text-[#4B5563] tabular-nums">
                  ({filteredMetrics.length})
                </span>
              </h2>

              {filteredMetrics.length === 0 ? (
                <div className="border border-[#E5E7EB] rounded-md p-8 text-center text-[14px] text-[#4B5563]">
                  No metrics match your current search filter.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {filteredMetrics.map((metric) => {
                    const showRawSql = Boolean(expandedSql[metric.key]);
                    return (
                      <article
                        key={metric.key}
                        className="rounded-md border border-[#BDC4D0] bg-[#FFFFFF] p-5 flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="font-display text-[17px] font-bold text-[#09090B] leading-snug">
                                {metric.label}
                              </h3>
                              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[12.5px]">
                                <span className="font-semibold text-[#67689E]">
                                  {metric.key}
                                </span>
                                <span className="inline-flex items-center gap-1.5 font-medium text-[#09090B]">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full bg-[#5BC2F4]"
                                    aria-hidden="true"
                                  />
                                  {FORMAT_LABELS[metric.format] ??
                                    humanizeIdentifier(metric.format)}
                                </span>
                                <span className="text-[#4B5563]">
                                  {metric.base_table} · {metric.grain} grain
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
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#FF0F5B] hover:bg-[#DC0A4D] active:bg-[#BE0842] text-[#FFFFFF] text-[12.5px] font-semibold transition-colors duration-150 shrink-0"
                            >
                              <span>Query</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <p className="text-[13.5px] text-[#4B5563] leading-relaxed">
                            {metric.description}
                          </p>

                          {/* Formula / SQL Code Block (strictly JetBrains Mono inside pre/code) */}
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[12.5px] font-semibold text-[#09090B]">
                                {showRawSql
                                  ? 'Compiled SQL expression'
                                  : 'Business formula'}
                              </span>
                              <div
                                className="inline-flex rounded border border-[#E5E7EB] overflow-hidden divide-x divide-[#E5E7EB]"
                                role="group"
                                aria-label={`Inspect formula or SQL for ${metric.label}`}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedSql((prev) => ({
                                      ...prev,
                                      [metric.key]: false,
                                    }))
                                  }
                                  className={`px-2.5 py-0.5 text-[12px] font-semibold transition-colors duration-150 ${
                                    !showRawSql
                                      ? 'bg-[#09090B] text-[#FFFFFF]'
                                      : 'bg-[#FFFFFF] text-[#4B5563] hover:text-[#09090B]'
                                  }`}
                                >
                                  Formula
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedSql((prev) => ({
                                      ...prev,
                                      [metric.key]: true,
                                    }))
                                  }
                                  className={`px-2.5 py-0.5 text-[12px] font-semibold transition-colors duration-150 ${
                                    showRawSql
                                      ? 'bg-[#09090B] text-[#FFFFFF]'
                                      : 'bg-[#FFFFFF] text-[#4B5563] hover:text-[#09090B]'
                                  }`}
                                >
                                  SQL
                                </button>
                              </div>
                            </div>
                            <pre
                              className={`${
                                showRawSql ? 'sql-code-block-dark' : 'sql-code-block'
                              } rounded px-3.5 py-2.5 overflow-x-auto whitespace-pre-wrap break-words`}
                            >
                              <code>
                                {showRawSql
                                  ? metric.sql_expression
                                  : metric.formula_display}
                              </code>
                            </pre>
                          </div>

                          {/* Mandatory Filters & Allowed Dimensions */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                            <div>
                              <div className="text-[12px] font-semibold text-[#4B5563] mb-1.5">
                                Mandatory filters
                              </div>
                              {metric.mandatory_filters.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {metric.mandatory_filters.map((f, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[12px] font-medium px-2 py-0.5 rounded bg-[#F7F8FA] border border-[#E5E7EB] text-[#09090B]"
                                    >
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[12.5px] text-[#4B5563]">
                                  None (all statuses included)
                                </span>
                              )}
                            </div>

                            <div>
                              <div className="text-[12px] font-semibold text-[#4B5563] mb-1.5">
                                Allowed dimensions
                              </div>
                              <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[12.5px] font-medium text-[#09090B]">
                                {metric.allowed_dimensions.map((dim) => (
                                  <span key={dim}>{dim}</span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Flat Business Caveats Strip (Zero border-l-4) */}
                          {metric.caveats.length > 0 && (
                            <div className="rounded border border-[#E5E7EB] bg-[#FFF5F8] px-3.5 py-2.5 space-y-1">
                              <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#09090B]">
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-[#FF0F5B]"
                                  aria-hidden="true"
                                />
                                <span>Business caveats</span>
                              </div>
                              {metric.caveats.map((caveat, cIdx) => (
                                <p
                                  key={cIdx}
                                  className="text-[12.5px] text-[#4B5563] leading-relaxed"
                                >
                                  {caveat}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-[#E5E7EB] text-[12.5px] text-[#4B5563]">
                          Owner:{' '}
                          <strong className="font-semibold text-[#09090B]">
                            {metric.owner}
                          </strong>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Official Dimensions Table */}
            <section className="space-y-3.5">
              <h2 className="font-display text-[17px] font-bold text-[#09090B]">
                Official dimensions{' '}
                <span className="text-[13.5px] font-medium text-[#4B5563] tabular-nums">
                  ({filteredDimensions.length})
                </span>
              </h2>

              <div className="overflow-x-auto rounded border border-[#E5E7EB]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F7F8FA] border-b border-[#BDC4D0]">
                      <th className="px-4 py-3 text-[12.5px] font-semibold text-[#4B5563]">
                        Dimension
                      </th>
                      <th className="px-4 py-3 text-[12.5px] font-semibold text-[#4B5563]">
                        Gold source
                      </th>
                      <th className="px-4 py-3 text-[12.5px] font-semibold text-[#4B5563]">
                        Type &amp; grains
                      </th>
                      <th className="px-4 py-3 text-[12.5px] font-semibold text-[#4B5563]">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] bg-[#FFFFFF]">
                    {filteredDimensions.map((dim) => (
                      <tr
                        key={dim.key}
                        className="hover:bg-[#F7F8FA] transition-colors duration-150"
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="text-[13.5px] font-bold text-[#09090B]">
                            {dim.label}
                          </div>
                          <div className="text-[12.5px] font-medium text-[#67689E] mt-0.5">
                            {dim.key}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="text-[12.5px] font-medium px-2 py-0.5 rounded bg-[#F7F8FA] border border-[#E5E7EB] text-[#09090B]">
                            {dim.table}.{dim.column}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center flex-wrap gap-2 text-[12.5px]">
                            <span className="font-semibold text-[#09090B]">
                              {humanizeIdentifier(dim.type)}
                            </span>
                            {dim.supported_grains && dim.supported_grains.length > 0 && (
                              <span className="text-[#4B5563]">
                                · {dim.supported_grains.join(', ')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-[13.5px] text-[#4B5563]">
                          {dim.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
