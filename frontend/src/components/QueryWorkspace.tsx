import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pin,
  Check,
  PanelRightOpen,
  PanelRightClose,
  Loader2,
  ArrowUpDown,
  ExternalLink,
  Search,
  ShieldAlert,
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

  // Audit Trail Drawer starts collapsed by default (eliminates double empty state)
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
        {/* Clean Minimal Top Header */}
        <header className="sticky top-0 z-10 bg-[#FFFFFF] border-b border-[#E5E7EB] px-8 h-[68px] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[20px] font-bold text-[#09090B] leading-tight">
              Ask Aegistic
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setIsAuditOpen((prev) => !prev)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded border text-[12.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF0F5B] ${
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
            <span>Inspect Audit Trail</span>
            {guardrailTotalCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold tabular-nums pl-1.5 border-l border-[#E5E7EB]">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    guardrailPassedCount === guardrailTotalCount
                      ? 'bg-[#5BC2F4]'
                      : 'bg-[#FF0F5B]'
                  }`}
                />
                {guardrailPassedCount}/{guardrailTotalCount}
              </span>
            )}
          </button>
        </header>

        {/* Main Workspace Body */}
        <div className="flex-1 px-8 py-6 space-y-7 max-w-[1160px] w-full mx-auto">
          {/* High-Contrast Command Bar & Flat Scenario Triggers */}
          <section className="space-y-3.5">
            <form onSubmit={handleSubmit} className="flex items-stretch gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#4B5563] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a governed question in Indonesian or English..."
                  className="w-full pl-10 pr-4 py-3 rounded border border-[#09090B] bg-[#FFFFFF] text-[14px] text-[#09090B] placeholder:text-[#4B5563] focus:outline-none focus:border-[#FF0F5B] focus:ring-1 focus:ring-[#FF0F5B]"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded bg-[#FF0F5B] hover:bg-[#DC0A4D] active:bg-[#BE0842] disabled:opacity-60 disabled:cursor-not-allowed text-[#FFFFFF] text-[14px] font-semibold transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-[#FF0F5B] focus:ring-offset-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Running</span>
                  </>
                ) : (
                  <span>Run Query →</span>
                )}
              </button>
            </form>

            {/* Flat Scenario Chips with 6px solid color dots */}
            <div className="flex flex-wrap items-center gap-2">
              {SAMPLE_QUERIES.map((item) => (
                <button
                  key={item.question}
                  type="button"
                  disabled={loading}
                  onClick={() => void executeQuestion(item.question, { openAudit: true })}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#BDC4D0] bg-[#FFFFFF] hover:border-[#09090B] hover:bg-[#F7F8FA] text-left transition-colors focus:outline-none focus:border-[#FF0F5B]"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.dotColor }}
                    aria-hidden="true"
                  />
                  <span className="text-[11.5px] font-semibold text-[#4B5563]">
                    {item.tag}
                  </span>
                  <span className="text-[12.5px] font-medium text-[#09090B]">
                    {item.question}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Network Error Strip (Dark Obsidian) */}
          {error && (
            <div className="rounded-md bg-[#09090B] text-[#FFFFFF] px-5 py-4 flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-[#FF0F5B] shrink-0 mt-1.5" />
              <div className="min-w-0">
                <div className="text-[13.5px] font-bold text-[#FFFFFF]">
                  Query Request Failed
                </div>
                <p className="text-[13px] text-[#D1D5DB] mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="border-t border-[#E5E7EB] pt-10 pb-10 flex items-center gap-3 text-[#4B5563]">
              <Loader2 className="w-4 h-4 text-[#FF0F5B] animate-spin" />
              <span className="text-[13.5px] font-medium text-[#09090B]">
                Compiling semantic query plan &amp; verifying SQL AST...
              </span>
            </div>
          )}

          {/* Query Results */}
          {response && !loading && (
            <div className="space-y-6">
              {response.status === 'verified' ? (
                <>
                  {/* Verified Summary Header Bar */}
                  <div className="border-t border-b border-[#E5E7EB] py-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[#09090B]">
                          <span className="w-2 h-2 rounded-full bg-[#5BC2F4]" />
                          Verified by Semantic Layer
                        </span>
                        <span className="text-[12px] font-medium text-[#4B5563] tabular-nums">
                          {response.audit_trail.row_count} rows ·{' '}
                          {response.audit_trail.latency_ms.toFixed(1)} ms
                        </span>
                      </div>
                      <p className="text-[14.5px] font-medium text-[#09090B] leading-snug">
                        {response.summary}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {pinState === 'pinned' ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-[#5BC2F4] bg-[#FFFFFF] text-[#09090B] text-[12.5px] font-semibold">
                            <Check className="w-3.5 h-3.5 text-[#5BC2F4]" />
                            Pinned
                          </span>
                          <button
                            type="button"
                            onClick={onNavigateDashboard}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-[#BDC4D0] bg-[#FFFFFF] hover:border-[#09090B] text-[#09090B] text-[12.5px] font-semibold transition-colors"
                          >
                            Dashboard
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={handlePin}
                          disabled={pinState === 'pinning'}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#FF0F5B] hover:bg-[#DC0A4D] active:bg-[#BE0842] disabled:opacity-60 text-[#FFFFFF] text-[13px] font-semibold transition-colors"
                        >
                          {pinState === 'pinning' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Pin className="w-3.5 h-3.5" />
                          )}
                          Pin to Dashboard
                        </button>
                      )}
                    </div>
                  </div>

                  {pinError && (
                    <div className="rounded bg-[#FFF5F8] border border-[#E5E7EB] px-4 py-2.5 text-[12.5px] text-[#09090B] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF0F5B] shrink-0" />
                      <span>{pinError}</span>
                    </div>
                  )}

                  {/* Flat Primary Visualization Frame with Docked Tier-A Sanity Band */}
                  <section className="rounded-md border border-[#BDC4D0] bg-[#FFFFFF] overflow-hidden">
                    {/* Chart Title Bar */}
                    <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between gap-3">
                      <h2 className="font-display text-[16px] font-bold text-[#09090B] truncate">
                        {response.chart_spec?.title || 'Query Visualization'}
                      </h2>
                      {response.chart_spec && (
                        <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] px-2 py-0.5 rounded bg-[#F7F8FA] border border-[#E5E7EB] text-[#4B5563]">
                          {response.chart_spec.chart_type}
                        </span>
                      )}
                    </div>

                    {/* Tier A — Docked Contextual Data Sanity Caveat Strip (zero left stripe, zero raw enum) */}
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
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF0F5B] opacity-60" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF0F5B]" />
                              </span>
                              <span className="text-[12.5px] font-bold text-[#09090B]">
                                {warn.label}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#E5E7EB] text-[11.5px] font-semibold text-[#09090B] tabular-nums">
                                {warn.pill}
                              </span>
                            </div>
                            <p className="text-[12.5px] text-[#4B5563] leading-snug">
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

                  {/* Flat Sortable Data Table */}
                  {response.data.length > 0 &&
                    response.chart_spec?.chart_type !== 'table' && (
                      <section className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-[14.5px] font-bold text-[#09090B]">
                            Verified Data Table{' '}
                            <span className="text-[12.5px] font-medium text-[#4B5563] tabular-nums">
                              ({response.data.length} rows)
                            </span>
                          </h3>
                          <button
                            type="button"
                            onClick={() => setShowTableSection((prev) => !prev)}
                            className="text-[12.5px] font-semibold text-[#09090B] hover:text-[#FF0F5B]"
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
                                    return (
                                      <th
                                        key={col.key}
                                        className={`px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[#4B5563] whitespace-nowrap ${
                                          numeric ? 'text-right' : 'text-left'
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => handleSort(col.key)}
                                          className={`inline-flex items-center gap-1 hover:text-[#09090B] ${
                                            numeric ? 'flex-row-reverse' : ''
                                          }`}
                                        >
                                          <span>{col.label}</span>
                                          <ArrowUpDown className="w-3 h-3" />
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
                                    className="hover:bg-[#F7F8FA] transition-colors"
                                  >
                                    {response.columns.map((col) => {
                                      const numeric =
                                        col.is_metric || isNumericFormat(col.format);
                                      return (
                                        <td
                                          key={col.key}
                                          className={`px-4 py-2.5 text-[13px] whitespace-nowrap ${
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
                /* TIER B — DARK OBSIDIAN INTERCEPTION CARD (Guardrail Block / Ambiguous / Refusal) */
                <section className="rounded-md bg-[#09090B] text-[#FFFFFF] p-6 space-y-4">
                  {/* Top Badge + Telemetry Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FF0F5B] text-[#FFFFFF] text-[11.5px] font-bold">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {response.status === 'guardrail_blocked'
                        ? 'AST Guardrail Blocked'
                        : response.status === 'clarification_required'
                          ? 'Clarification Required'
                          : 'Out of Scope'}
                    </span>

                    <span className="text-[12px] font-medium text-[#9CA3AF] tabular-nums">
                      {response.status === 'guardrail_blocked'
                        ? 'Gate 3 · 0 rows touched'
                        : 'Gate 1 · 0 rows touched'}{' '}
                      · {response.audit_trail.latency_ms.toFixed(1)} ms
                    </span>
                  </div>

                  {/* Crisp White Heading & High-Contrast Summary */}
                  <div className="space-y-1.5">
                    <h2 className="font-display text-[18px] font-bold text-[#FFFFFF]">
                      {response.status === 'guardrail_blocked'
                        ? 'Request Intercepted by SQL AST Security Policy'
                        : response.status === 'clarification_required'
                          ? 'Ambiguous Business Metric Detected'
                          : 'Metric Not Governed in Semantic Layer'}
                    </h2>
                    <p className="text-[14px] text-[#D1D5DB] leading-relaxed">
                      {response.summary}
                    </p>
                  </div>

                  {/* Highlighted Blocked SQL / Adversarial Snippet */}
                  {response.status === 'guardrail_blocked' && (
                    <pre className="font-mono text-[12.5px] leading-relaxed bg-[#18181B] border border-[#27272A] rounded px-4 py-3 overflow-x-auto whitespace-pre-wrap break-words">
                      <code>
                        {renderHighlightedSqlSnippet(
                          response.audit_trail.compiled_sql || response.question
                        )}
                      </code>
                    </pre>
                  )}

                  {/* Secondary Policy Notes (Humanized, never raw enum code) */}
                  {editorialWarnings.length > 0 && (
                    <div className="space-y-2">
                      {editorialWarnings.map((w, idx) => (
                        <div
                          key={`${w.label}-${idx}`}
                          className="rounded bg-[#18181B] border border-[#27272A] px-3.5 py-2.5 text-[12.5px] text-[#D1D5DB] flex items-start gap-2.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF0F5B] shrink-0 mt-1.5" />
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

                  {/* Dark-Surface Quick-Refinement Suggestions */}
                  {response.suggestions.length > 0 && (
                    <div className="pt-3 border-t border-[#27272A] space-y-2.5">
                      <div className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[#9CA3AF]">
                        Recover with a Governed Metric Query
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
                              className="inline-flex items-center gap-2 px-3 py-2 rounded bg-[#18181B] border border-[#27272A] hover:border-[#FF0F5B] text-[12.5px] font-semibold text-[#FFFFFF] transition-colors"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-[#5BC2F4] shrink-0" />
                              <span>{s.label}</span>
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

      {/* Collapsible Right-Hand Verification & Audit Trail Drawer (collapsed by default) */}
      <AuditTrailDrawer
        auditTrail={response?.audit_trail ?? null}
        status={response?.status ?? null}
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
      />
    </div>
  );
};
