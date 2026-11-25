import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pin,
  Check,
  PanelRightOpen,
  PanelRightClose,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Search,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import {
  runQuery,
  pinToDashboard,
  formatValue,
  isNumericFormat,
  normalizeSuggestion,
  formatEditorialWarning,
  hasPartialPeriodWarning,
  type ParserMode,
  type QueryResponse,
} from '../lib/api';
import { ChartRenderer } from './ChartRenderer';
import { AuditTrailDrawer } from './AuditTrailDrawer';

interface QueryWorkspaceProps {
  externalQuestion: string | null;
  onExternalQuestionConsumed: () => void;
  onCardPinned: () => void;
  onNavigateDashboard: () => void;
  parserMode: ParserMode | '';
}

const STARTER_QUERY =
  'Tampilkan tren Net Revenue bulanan selama 12 bulan terakhir';

const SAMPLE_QUERIES: {
  tag: string;
  dotColor: '#5BC2F4' | '#67689E' | '#FF0F5B';
  question: string;
}[] = [
  {
    tag: 'Trend',
    dotColor: '#5BC2F4',
    question: 'Tampilkan tren Net Revenue bulanan selama 12 bulan terakhir',
  },
  {
    tag: 'Category',
    dotColor: '#5BC2F4',
    question: 'Bandingkan Net Revenue per kategori produk 6 bulan terakhir',
  },
  {
    tag: 'Definition Trap',
    dotColor: '#67689E',
    question: 'Berapa Net Revenue dan Refund Rate per region?',
  },
  {
    tag: 'Ambiguous',
    dotColor: '#FF0F5B',
    question: 'Produk mana yang paling bagus?',
  },
  {
    tag: 'Adversarial SQL',
    dotColor: '#FF0F5B',
    question: 'DROP TABLE gold.fact_orders',
  },
];

const CHART_TYPE_LABELS: Record<string, string> = {
  line: 'Line chart',
  bar: 'Bar chart',
  kpi: 'KPI summary',
  table: 'Table view',
};

const DANGEROUS_SQL_PATTERN =
  /(DROP\s+TABLE|DROP\s+DATABASE|DELETE\s+FROM|TRUNCATE\s+TABLE|ALTER\s+TABLE|CROSS\s+JOIN|bronze\.[a-zA-Z0-9_]+|silver\.[a-zA-Z0-9_]+|\bDROP\b|\bDELETE\b|\bUPDATE\b|\bINSERT\b|\bALTER\b|\bCOPY\b|\bATTACH\b)/gi;

function renderHighlightedSqlSnippet(snippet: string): React.ReactNode {
  const parts = snippet.split(DANGEROUS_SQL_PATTERN);
  return parts.map((part, idx) => {
    if (!part) return null;
    const isDangerous = new RegExp(`^${DANGEROUS_SQL_PATTERN.source}$`, 'i').test(
      part
    );
    if (isDangerous) {
      return (
        <span
          key={idx}
          className="px-1.5 py-0.5 rounded bg-[#FF0F5B] text-[#FFFFFF] font-semibold"
        >
          {part}
        </span>
      );
    }
    return (
      <span key={idx} className="text-[#D1D5DB]">
        {part}
      </span>
    );
  });
}

export const QueryWorkspace: React.FC<QueryWorkspaceProps> = ({
  externalQuestion,
  onExternalQuestionConsumed,
  onCardPinned,
  onNavigateDashboard,
  parserMode,
}) => {
  const [question, setQuestion] = useState(STARTER_QUERY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<QueryResponse | null>(null);

  // Audit Trail Drawer starts collapsed by default and slides open smoothly
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  const [pinState, setPinState] = useState<'idle' | 'pinning' | 'pinned' | 'error'>('idle');
  const [pinError, setPinError] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showTableSection, setShowTableSection] = useState(true);
  const didInitialLoad = useRef(false);

  const executeQuestion = async (
    q: string,
    options: { openAudit: boolean } = { openAudit: true }
  ) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    setLoading(true);
    setError(null);
    setPinState('idle');
    setPinError(null);
    setSortCol(null);

    try {
      const res = await runQuery(trimmed, parserMode || null);
      setResponse(res);
      if (options.openAudit) {
        setIsAuditOpen(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to execute query.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load verified starter query on first /app visit with Audit Trail staying collapsed
  useEffect(() => {
    if (externalQuestion) {
      didInitialLoad.current = true;
      void executeQuestion(externalQuestion, { openAudit: true });
      onExternalQuestionConsumed();
      return;
    }
    if (!didInitialLoad.current) {
      didInitialLoad.current = true;
      void executeQuestion(STARTER_QUERY, { openAudit: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuestion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executeQuestion(question, { openAudit: true });
  };

  const handlePin = async () => {
    if (!response || response.status !== 'verified') return;
    setPinState('pinning');
    setPinError(null);
    try {
      const title =
        response.chart_spec?.title ||
        (response.question.length > 64
          ? `${response.question.slice(0, 61)}...`
          : response.question);
      await pinToDashboard({
        title,
        question: response.question,
      });
      setPinState('pinned');
      onCardPinned();
    } catch (err) {
      setPinState('error');
      setPinError(err instanceof Error ? err.message : 'Failed to pin card.');
    }
  };

  const handleSort = (colKey: string) => {
    if (sortCol === colKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(colKey);
      setSortDir('desc');
    }
  };

  const sortedRows = useMemo(() => {
    if (!response?.data) return [];
    if (!sortCol) return response.data;
    return [...response.data].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [response?.data, sortCol, sortDir]);

  const guardrailPassedCount =
    response?.audit_trail?.guardrail_checks.filter((c) => c.passed).length ?? 0;
  const guardrailTotalCount =
    response?.audit_trail?.guardrail_checks.length ?? 0;

  const editorialWarnings = useMemo(
    () => (response?.warnings ?? []).map((w) => formatEditorialWarning(w)),
    [response?.warnings]
  );

  const partialPeriodActive = useMemo(
    () => hasPartialPeriodWarning(response?.warnings),
    [response?.warnings]
  );

  return (
    <div className="flex flex-1 min-w-0 min-h-screen bg-[#FFFFFF]">
      {/* Center Analytics Canvas */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Minimal Workspace Header */}
        <header className="sticky top-[60px] lg:top-0 z-10 bg-[#FFFFFF]/95 backdrop-blur-sm border-b border-[#E5E7EB] px-5 sm:px-8 h-[68px] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[20px] font-bold text-[#09090B] leading-tight">
              Ask Aegistic
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setIsAuditOpen((prev) => !prev)}
            aria-expanded={isAuditOpen}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded border text-[13px] font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0F5B] shrink-0 ${
              isAuditOpen
                ? 'border-[#09090B] bg-[#F7F8FA] text-[#09090B]'
                : 'border-[#BDC4D0] bg-[#FFFFFF] text-[#09090B] hover:border-[#09090B]'
            }`}
          >
            {isAuditOpen ? (
              <PanelRightClose className="w-4 h-4 text-[#FF0F5B]" />
            ) : (
              <PanelRightOpen className="w-4 h-4 text-[#4B5563]" />
            )}
            <span className="hidden sm:inline">Inspect Audit Trail</span>
            <span className="sm:hidden">Audit Trail</span>
            {guardrailTotalCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold tabular-nums pl-2 border-l border-[#E5E7EB]">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    guardrailPassedCount === guardrailTotalCount
                      ? 'bg-[#5BC2F4]'
                      : 'bg-[#FF0F5B]'
                  }`}
                  aria-hidden="true"
                />
                {guardrailPassedCount}/{guardrailTotalCount}
              </span>
            )}
          </button>
        </header>

        {/* Main Workspace Body */}
        <div className="flex-1 px-5 sm:px-8 py-6 space-y-7 max-w-[1160px] w-full mx-auto">
          {/* Command Bar & Scenario Chips */}
          <section className="space-y-3.5" aria-label="Query Command Bar">
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row items-stretch gap-2.5"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#4B5563] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a governed question in Indonesian or English..."
                  aria-label="Analytics question"
                  className="w-full pl-10 pr-4 py-3 rounded border border-[#09090B] bg-[#FFFFFF] text-[14px] text-[#09090B] placeholder:text-[#4B5563] transition-colors duration-150 focus:outline-none focus:border-[#FF0F5B] focus:ring-1 focus:ring-[#FF0F5B]"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded bg-[#FF0F5B] hover:bg-[#DC0A4D] active:bg-[#BE0842] disabled:opacity-60 disabled:cursor-not-allowed text-[#FFFFFF] text-[14px] font-semibold transition-colors duration-150 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0F5B] focus-visible:ring-offset-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Running</span>
                  </>
                ) : (
                  <>
                    <span>Run Query</span>
                    <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </form>

            {/* Clean White Scenario Trigger Chips with 6px Solid Color Dots */}
            <div className="flex flex-wrap items-center gap-2">
              {SAMPLE_QUERIES.map((item) => {
                const isSelected = response?.question === item.question;
                return (
                  <button
                    key={item.question}
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      void executeQuestion(item.question, { openAudit: true })
                    }
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border text-left transition-colors duration-150 focus:outline-none focus-visible:border-[#FF0F5B] ${
                      isSelected
                        ? 'border-[#09090B] bg-[#F7F8FA]'
                        : 'border-[#E5E7EB] bg-[#FFFFFF] hover:border-[#09090B] hover:bg-[#F7F8FA]'
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.dotColor }}
                      aria-hidden="true"
                    />
                    <span className="text-[12px] font-semibold text-[#4B5563] shrink-0">
                      {item.tag}
                    </span>
                    <span className="text-[12.5px] font-medium text-[#09090B]">
                      {item.question}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Network Error Strip (Dark Obsidian) */}
          {error && (
            <div className="rounded-md bg-[#09090B] text-[#FFFFFF] px-5 py-4 flex items-start gap-3">
              <span
                className="w-2 h-2 rounded-full bg-[#FF0F5B] shrink-0 mt-1.5"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="text-[14px] font-bold text-[#FFFFFF]">
                  Query request failed
                </div>
                <p className="text-[13.5px] text-[#D1D5DB] mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="border-t border-[#E5E7EB] py-10 flex items-center gap-3 text-[#4B5563]">
              <Loader2 className="w-4 h-4 text-[#FF0F5B] animate-spin shrink-0" />
              <span className="text-[14px] font-medium text-[#09090B]">
                Compiling semantic query plan and verifying SQL AST...
              </span>
            </div>
          )}

          {/* Query Results */}
          {response && !loading && (
            <div className="space-y-6 animate-stage-fade">
              {response.status === 'verified' ? (
                <>
                  {/* Verified Summary Header Strip */}
                  <div className="border-t border-b border-[#E5E7EB] py-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#09090B]">
                          <span
                            className="w-2 h-2 rounded-full bg-[#5BC2F4]"
                            aria-hidden="true"
                          />
                          Verified by Semantic Layer
                        </span>
                        <span className="text-[12.5px] font-medium text-[#4B5563] tabular-nums">
                          {response.audit_trail.row_count} rows ·{' '}
                          {response.audit_trail.latency_ms.toFixed(1)} ms
                        </span>
                      </div>
                      <p className="text-[15px] font-medium text-[#09090B] leading-snug">
                        {response.summary}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {pinState === 'pinned' ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-[#5BC2F4] bg-[#FFFFFF] text-[#09090B] text-[13px] font-semibold">
                            <Check className="w-3.5 h-3.5 text-[#5BC2F4]" />
                            Pinned
                          </span>
                          <button
                            type="button"
                            onClick={onNavigateDashboard}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-[#BDC4D0] bg-[#FFFFFF] hover:border-[#09090B] text-[#09090B] text-[13px] font-semibold transition-colors duration-150"
                          >
                            <span>View Dashboard</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={handlePin}
                          disabled={pinState === 'pinning'}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#FF0F5B] hover:bg-[#DC0A4D] active:bg-[#BE0842] disabled:opacity-60 text-[#FFFFFF] text-[13px] font-semibold transition-colors duration-150"
                        >
                          {pinState === 'pinning' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Pin className="w-3.5 h-3.5" />
                          )}
                          <span>Pin to Dashboard</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {pinError && (
                    <div className="rounded bg-[#FFF5F8] border border-[#E5E7EB] px-4 py-2.5 text-[13px] text-[#09090B] flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[#FF0F5B] shrink-0"
                        aria-hidden="true"
                      />
                      <span>{pinError}</span>
                    </div>
                  )}

                  {/* Primary Visualization Frame with Docked Tier-A Caveat Header Band */}
                  <section className="rounded-md border border-[#BDC4D0] bg-[#FFFFFF] overflow-hidden">
                    {/* Chart Title Bar */}
                    <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between gap-3">
                      <h2 className="font-display text-[17px] font-bold text-[#09090B] truncate">
                        {response.chart_spec?.title || 'Query visualization'}
                      </h2>
                      {response.chart_spec && (
                        <span className="text-[12px] font-medium text-[#4B5563] shrink-0">
                          {CHART_TYPE_LABELS[response.chart_spec.chart_type] ??
                            response.chart_spec.chart_type}
                        </span>
                      )}
                    </div>

                    {/* Tier A — Seamless Docked Data Caveat Band (Zero border-l-4, Zero Raw Enum) */}
                    {editorialWarnings.length > 0 && (
                      <div className="divide-y divide-[#E5E7EB] border-b border-[#E5E7EB] bg-[#FFF5F8]">
                        {editorialWarnings.map((warn, idx) => (
                          <div
                            key={`${warn.label}-${idx}`}
                            className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5"
                          >
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span
                                className="relative flex h-2 w-2 shrink-0"
                                aria-hidden="true"
                              >
                                <span className="animate-live-ring absolute inline-flex h-full w-full rounded-full bg-[#FF0F5B]" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF0F5B]" />
                              </span>
                              <span className="text-[13px] font-bold text-[#09090B]">
                                {warn.label}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#E5E7EB] text-[12px] font-semibold text-[#09090B] tabular-nums">
                                {warn.pill}
                              </span>
                            </div>
                            <p className="text-[13px] text-[#4B5563] leading-snug">
                              {warn.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Chart Body */}
                    <div className="p-5">
                      <ChartRenderer
                        chartSpec={response.chart_spec}
                        columns={response.columns}
                        data={response.data}
                        hasPartialPeriod={partialPeriodActive}
                      />
                    </div>
                  </section>

                  {/* Sortable Data Table */}
                  {response.data.length > 0 &&
                    response.chart_spec?.chart_type !== 'table' && (
                      <section className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-[15.5px] font-bold text-[#09090B]">
                            Verified data table{' '}
                            <span className="text-[13px] font-medium text-[#4B5563] tabular-nums">
                              ({response.data.length} rows)
                            </span>
                          </h3>
                          <button
                            type="button"
                            onClick={() => setShowTableSection((prev) => !prev)}
                            className="text-[13px] font-semibold text-[#09090B] hover:text-[#FF0F5B] transition-colors duration-150"
                          >
                            {showTableSection ? 'Hide table' : 'Show table'}
                          </button>
                        </div>

                        {showTableSection && (
                          <div className="overflow-x-auto rounded border border-[#E5E7EB]">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-[#F7F8FA] border-b border-[#BDC4D0]">
                                  {response.columns.map((col) => {
                                    const numeric =
                                      col.is_metric || isNumericFormat(col.format);
                                    const isSorted = sortCol === col.key;
                                    return (
                                      <th
                                        key={col.key}
                                        className={`px-4 py-3 text-[12.5px] font-semibold text-[#4B5563] whitespace-nowrap ${
                                          numeric ? 'text-right' : 'text-left'
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => handleSort(col.key)}
                                          className={`inline-flex items-center gap-1.5 hover:text-[#09090B] transition-colors duration-150 ${
                                            numeric ? 'flex-row-reverse' : ''
                                          } ${isSorted ? 'text-[#09090B]' : ''}`}
                                        >
                                          <span>{col.label}</span>
                                          {isSorted ? (
                                            sortDir === 'asc' ? (
                                              <ArrowUp className="w-3.5 h-3.5 text-[#FF0F5B]" />
                                            ) : (
                                              <ArrowDown className="w-3.5 h-3.5 text-[#FF0F5B]" />
                                            )
                                          ) : (
                                            <ArrowUpDown className="w-3.5 h-3.5 text-[#9CA3AF]" />
                                          )}
                                        </button>
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#E5E7EB] bg-[#FFFFFF]">
                                {sortedRows.map((row, idx) => (
                                  <tr
                                    key={idx}
                                    className="hover:bg-[#F7F8FA] transition-colors duration-150"
                                  >
                                    {response.columns.map((col) => {
                                      const numeric =
                                        col.is_metric || isNumericFormat(col.format);
                                      return (
                                        <td
                                          key={col.key}
                                          className={`px-4 py-2.5 text-[13.5px] whitespace-nowrap ${
                                            numeric
                                              ? 'text-right font-semibold text-[#09090B] tabular-nums'
                                              : 'text-left text-[#09090B]'
                                          }`}
                                        >
                                          {formatValue(row[col.key], col.format)}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    )}
                </>
              ) : (
                /* Tier B — Dark Obsidian Interception Panel (Guardrail Blocks / Ambiguous / Refusals) */
                <section className="rounded-lg bg-[#09090B] text-[#FFFFFF] p-6 sm:p-7 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#FF0F5B] text-[#FFFFFF] text-[12.5px] font-bold">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      {response.status === 'guardrail_blocked'
                        ? 'AST Guardrail Blocked'
                        : response.status === 'clarification_required'
                          ? 'Clarification Required'
                          : 'Metric Out of Scope'}
                    </span>

                    <span className="text-[13px] font-medium text-[#9CA3AF] tabular-nums">
                      {response.status === 'guardrail_blocked'
                        ? 'Gate 3 · 0 rows touched'
                        : 'Gate 1 · 0 rows touched'}{' '}
                      · {response.audit_trail.latency_ms.toFixed(1)} ms
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h2 className="font-display text-[20px] font-bold text-[#FFFFFF]">
                      {response.status === 'guardrail_blocked'
                        ? 'Request intercepted by SQL AST security policy'
                        : response.status === 'clarification_required'
                          ? 'Ambiguous business metric detected'
                          : 'Metric not governed in Semantic Layer'}
                    </h2>
                    <p className="text-[14.5px] text-[#D1D5DB] leading-relaxed max-w-[64ch]">
                      {response.summary}
                    </p>
                  </div>

                  {/* Highlighted Intercepted SQL Snippet */}
                  {response.status === 'guardrail_blocked' && (
                    <pre className="sql-code-block-dark rounded-md px-4 py-3.5 overflow-x-auto whitespace-pre-wrap break-words">
                      <code>
                        {renderHighlightedSqlSnippet(
                          response.audit_trail.compiled_sql || response.question
                        )}
                      </code>
                    </pre>
                  )}

                  {/* Policy Notes (Humanized, Zero Raw Enums) */}
                  {editorialWarnings.length > 0 && (
                    <div className="divide-y divide-[#27272A] border-t border-[#27272A] pt-2">
                      {editorialWarnings.map((w, idx) => (
                        <div
                          key={`${w.label}-${idx}`}
                          className="py-2.5 text-[13px] text-[#D1D5DB] flex items-start gap-2.5"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-[#FF0F5B] shrink-0 mt-1.5"
                            aria-hidden="true"
                          />
                          <div>
                            <span className="font-semibold text-[#FFFFFF]">
                              {w.label}:
                            </span>{' '}
                            <span>{w.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* One-Click Dark Refinement Chips */}
                  {response.suggestions.length > 0 && (
                    <div className="pt-4 border-t border-[#27272A] space-y-3">
                      <div className="text-[13px] font-semibold text-[#9CA3AF]">
                        Recover with a governed query
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {response.suggestions.map((rawItem, idx) => {
                          const s = normalizeSuggestion(rawItem);
                          if (!s.question) return null;
                          return (
                            <button
                              key={`${s.question}-${idx}`}
                              type="button"
                              onClick={() =>
                                void executeQuestion(s.question, { openAudit: true })
                              }
                              className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#141417] border border-[#27272A] hover:border-[#FF0F5B] text-[13px] font-semibold text-[#FFFFFF] transition-colors duration-150"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-[#5BC2F4] shrink-0"
                                aria-hidden="true"
                              />
                              <span>{s.label}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-[#9CA3AF]" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Smoothly Sliding Verification & Audit Trail Drawer */}
      <AuditTrailDrawer
        auditTrail={response?.audit_trail ?? null}
        status={response?.status ?? null}
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
      />
    </div>
  );
};
