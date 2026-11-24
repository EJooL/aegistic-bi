import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Pin,
  Check,
  PanelRightOpen,
  PanelRightClose,
  Sparkles,
  Loader2,
  ArrowUpDown,
  HelpCircle,
  ExternalLink,
  Table2,
  BarChart2,
} from 'lucide-react';
import {
  runQuery,
  pinToDashboard,
  formatValue,
  isNumericFormat,
  normalizeSuggestion,
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
}

const SAMPLE_QUERIES: {
  tag: string;
  tagStyle: 'standard' | 'trap' | 'guardrail';
  question: string;
}[] = [
  {
    tag: 'Trend',
    tagStyle: 'standard',
    question: 'Tampilkan tren Net Revenue bulanan selama 12 bulan terakhir',
  },
  {
    tag: 'Category',
    tagStyle: 'standard',
    question: 'Bandingkan Net Revenue per kategori produk 6 bulan terakhir',
  },
  {
    tag: 'Definition Trap',
    tagStyle: 'trap',
    question: 'Berapa Net Revenue dan Refund Rate per region?',
  },
  {
    tag: 'Ambiguous',
    tagStyle: 'guardrail',
    question: 'Produk mana yang paling bagus?',
  },
  {
    tag: 'Adversarial SQL',
    tagStyle: 'guardrail',
    question: 'DROP TABLE gold.fact_orders',
  },
];

export const QueryWorkspace: React.FC<QueryWorkspaceProps> = ({
  externalQuestion,
  onExternalQuestionConsumed,
  onCardPinned,
  onNavigateDashboard,
}) => {
  const [question, setQuestion] = useState('');
  const [parserMode, setParserMode] = useState<ParserMode | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [pinState, setPinState] = useState<'idle' | 'pinning' | 'pinned' | 'error'>('idle');
  const [pinError, setPinError] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showTableSection, setShowTableSection] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const executeQuestion = async (q: string) => {
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
      setDrawerOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to execute query.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (externalQuestion) {
      void executeQuestion(externalQuestion);
      onExternalQuestionConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuestion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executeQuestion(question);
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

  const sortedRows = React.useMemo(() => {
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

  return (
    <div className="flex flex-1 min-w-0 min-h-screen bg-[#F8FAFC]">
      {/* Center Analytics Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 bg-[#FFFFFF]/95 backdrop-blur border-b border-[#E2E8F0] px-7 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[19px] font-bold text-[#111827] leading-tight">
              Ask Aegistic
            </h1>
            <p className="text-[13px] text-[#526075] mt-0.5">
              Conversational BI compiled deterministically from governed metrics-as-code &amp; verified by SQL AST guardrails
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <label
                htmlFor="parser-mode-select"
                className="text-[12px] font-medium text-[#526075]"
              >
                Parser:
              </label>
              <select
                id="parser-mode-select"
                value={parserMode}
                onChange={(e) => setParserMode(e.target.value as ParserMode | '')}
                className="text-[12.5px] font-medium text-[#1F2937] bg-[#FFFFFF] border border-[#CBD5E1] rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#3B498B]/40 focus:border-[#3B498B]"
              >
                <option value="">Server Default</option>
                <option value="deterministic">Deterministic</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12.5px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#3B498B]/40 ${
                drawerOpen
                  ? 'bg-[#EEF0FA] border-[#3B498B]/30 text-[#3B498B]'
                  : 'bg-[#FFFFFF] border-[#CBD5E1] text-[#1F2937] hover:bg-[#F8FAFC]'
              }`}
            >
              {drawerOpen ? (
                <PanelRightClose className="w-4 h-4" />
              ) : (
                <PanelRightOpen className="w-4 h-4" />
              )}
              <span>Audit Trail</span>
              {guardrailTotalCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums ${
                    guardrailPassedCount === guardrailTotalCount
                      ? 'bg-[#EBF6FD] text-[#1B6CA8]'
                      : 'bg-[#FFF1F2] text-[#9F1239]'
                  }`}
                >
                  {guardrailPassedCount}/{guardrailTotalCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Workspace Content */}
        <div className="flex-1 px-7 py-6 space-y-5 max-w-[1280px] w-full mx-auto">
          {/* Natural Language Query Card */}
          <section className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card p-5">
            <form onSubmit={handleSubmit} className="flex items-stretch gap-3">
              <div className="relative flex-1">
                <Sparkles className="w-4 h-4 text-[#3B498B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a business question in Indonesian or English (e.g., Bandingkan Net Revenue per kategori produk 6 bulan terakhir)..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] text-[14px] text-[#111827] placeholder:text-[#526075] focus:outline-none focus:ring-2 focus:ring-[#3B498B]/30 focus:border-[#3B498B]"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#3B498B] hover:bg-[#2D3870] disabled:opacity-50 disabled:cursor-not-allowed text-[#FFFFFF] text-[14px] font-semibold transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3B498B]/50 shrink-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Ask Aegistic
                  </>
                )}
              </button>
            </form>

            {/* Sample Query Chips */}
            <div className="mt-4 pt-3.5 border-t border-[#E2E8F0]">
              <div className="text-[11.5px] font-semibold uppercase tracking-wider text-[#526075] mb-2">
                Try Governed Queries &amp; Guardrail Scenarios
              </div>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_QUERIES.map((item) => (
                  <button
                    key={item.question}
                    type="button"
                    disabled={loading}
                    onClick={() => void executeQuestion(item.question)}
                    className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#EEF0FA] hover:border-[#3B498B]/40 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[#3B498B]/30"
                  >
                    <span
                      className={`text-[10.5px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        item.tagStyle === 'guardrail'
                          ? 'bg-[#FFF1F2] text-[#9F1239] border border-[#FECDD3]'
                          : item.tagStyle === 'trap'
                            ? 'bg-[#EEF0FA] text-[#3B498B]'
                            : 'bg-[#EBF6FD] text-[#1B6CA8]'
                      }`}
                    >
                      {item.tag}
                    </span>
                    <span className="text-[12.5px] text-[#1F2937] group-hover:text-[#111827] font-medium">
                      {item.question}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Network / API Error Banner */}
          {error && (
            <div className="rounded-xl bg-[#FFF1F2] border border-[#FECDD3] px-5 py-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-[#E11D48] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-[#9F1239]">
                  Query Request Failed
                </div>
                <p className="text-[13px] text-[#9F1239] mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Initial Empty State */}
          {!response && !loading && !error && (
            <div className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] p-10 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#EEF0FA] text-[#3B498B] flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-[17px] font-bold text-[#111827]">
                Ask a Governed Business Question
              </h2>
              <p className="text-[13.5px] text-[#526075] max-w-xl mx-auto mt-1.5 leading-relaxed">
                Every query passes through Aegistic&apos;s 5-gate pipeline: Semantic Intent
                Matching, Deterministic SQL Compilation,{' '}
                <code className="font-mono text-[12px] px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#111827]">
                  sqlglot
                </code>{' '}
                AST Guardrails, Read-Only DuckDB Execution, and Post-Query Sanity Checks.
              </p>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] p-8 flex items-center justify-center gap-3 text-[#526075]">
              <Loader2 className="w-5 h-5 text-[#3B498B] animate-spin" />
              <span className="text-[14px] font-medium text-[#1F2937]">
                Compiling semantic plan &amp; verifying SQL AST against Gold warehouse...
              </span>
            </div>
          )}

          {/* Live Query Result */}
          {response && !loading && (
            <div className="space-y-4">
              {/* STATUS 1: VERIFIED */}
              {response.status === 'verified' ? (
                <>
                  {/* Verified Status Banner + Pin CTA */}
                  <div className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EBF6FD] border border-[#4DA8E5]/40 text-[#1B6CA8] text-[12px] font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#4DA8E5]" />
                          Verified by Semantic Layer
                        </span>
                        <span className="text-[12px] font-medium text-[#526075] tabular-nums">
                          {response.audit_trail.row_count} rows ·{' '}
                          {response.audit_trail.latency_ms.toFixed(1)} ms
                        </span>
                      </div>
                      <p className="text-[14px] font-medium text-[#111827] leading-snug">
                        {response.summary}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {pinState === 'pinned' ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#EBF6FD] text-[#1B6CA8] text-[13px] font-semibold border border-[#4DA8E5]/40">
                            <Check className="w-4 h-4 text-[#4DA8E5]" />
                            Pinned to Dashboard
                          </span>
                          <button
                            type="button"
                            onClick={onNavigateDashboard}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] text-[#3B498B] text-[13px] font-semibold transition-colors"
                          >
                            View
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handlePin}
                          disabled={pinState === 'pinning'}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B498B] hover:bg-[#2D3870] disabled:opacity-60 text-[#FFFFFF] text-[13px] font-semibold transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3B498B]/50"
                        >
                          {pinState === 'pinning' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Pin className="w-4 h-4" />
                          )}
                          Pin to Dashboard
                        </button>
                      )}
                    </div>
                  </div>

                  {pinError && (
                    <div className="rounded-lg bg-[#FFF1F2] border border-[#FECDD3] px-4 py-2.5 text-[12.5px] text-[#9F1239]">
                      {pinError}
                    </div>
                  )}

                  {/* Inline Crimson Caveat & Post-Query Sanity Warning Banners (sparingly rendered) */}
                  {response.warnings.length > 0 && (
                    <div className="space-y-2">
                      {response.warnings.map((warn, idx) => (
                        <div
                          key={`${warn.code}-${idx}`}
                          className="rounded-lg bg-[#FFF1F2] border border-[#FECDD3] px-4 py-3 flex items-start gap-3"
                        >
                          <AlertTriangle className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13px] font-semibold text-[#9F1239]">
                                {warn.title}
                              </span>
                              <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-[#FFFFFF] border border-[#FECDD3] text-[#9F1239]">
                                {warn.code}
                              </span>
                            </div>
                            <p className="text-[12.5px] text-[#9F1239] mt-0.5 leading-relaxed">
                              {warn.message}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Primary Visualization Card */}
                  <section className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <BarChart2 className="w-4 h-4 text-[#4DA8E5] shrink-0" />
                        <h2 className="text-[15.5px] font-bold text-[#111827] truncate">
                          {response.chart_spec?.title || 'Query Visualization'}
                        </h2>
                      </div>
                      {response.chart_spec && (
                        <span className="font-mono text-[11px] uppercase px-2 py-0.5 rounded bg-[#F1F5F9] text-[#526075] border border-[#E2E8F0]">
                          {response.chart_spec.chart_type}
                        </span>
                      )}
                    </div>
                    <ChartRenderer
                      chartSpec={response.chart_spec}
                      columns={response.columns}
                      data={response.data}
                    />
                  </section>

                  {/* Interactive Formatted Data Table */}
                  {response.data.length > 0 &&
                    response.chart_spec?.chart_type !== 'table' && (
                      <section className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Table2 className="w-4 h-4 text-[#3B498B]" />
                            <h3 className="text-[14px] font-bold text-[#111827]">
                              Verified Result Table
                            </h3>
                            <span className="text-[12px] text-[#526075] tabular-nums">
                              ({response.data.length} rows)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowTableSection((prev) => !prev)}
                            className="text-[12px] font-medium text-[#3B498B] hover:text-[#2D3870]"
                          >
                            {showTableSection ? 'Hide table' : 'Show table'}
                          </button>
                        </div>

                        {showTableSection && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0]">
                                  {response.columns.map((col) => {
                                    const numeric =
                                      col.is_metric || isNumericFormat(col.format);
                                    return (
                                      <th
                                        key={col.key}
                                        className={`px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-[#526075] whitespace-nowrap ${
                                          numeric ? 'text-right' : 'text-left'
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => handleSort(col.key)}
                                          className={`inline-flex items-center gap-1 hover:text-[#111827] ${
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
                              <tbody className="divide-y divide-[#E2E8F0] bg-[#FFFFFF]">
                                {sortedRows.map((row, idx) => (
                                  <tr
                                    key={idx}
                                    className="hover:bg-[#F8FAFC] transition-colors"
                                  >
                                    {response.columns.map((col) => {
                                      const numeric =
                                        col.is_metric || isNumericFormat(col.format);
                                      return (
                                        <td
                                          key={col.key}
                                          className={`px-4 py-2.5 text-[13px] whitespace-nowrap ${
                                            numeric
                                              ? 'text-right font-semibold text-[#111827] tabular-nums'
                                              : 'text-left text-[#1F2937]'
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
                /* STATUS 2: GUARDRAIL BLOCKED / CLARIFICATION REQUIRED / REFUSED */
                <section className="rounded-xl bg-[#FFF1F2] border border-[#FECDD3] p-6 space-y-4">
                  <div className="flex items-start gap-3.5">
                    {response.status === 'guardrail_blocked' ? (
                      <ShieldAlert className="w-6 h-6 text-[#E11D48] shrink-0 mt-0.5" />
                    ) : (
                      <HelpCircle className="w-6 h-6 text-[#E11D48] shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#E11D48] text-[#FFFFFF] text-[11.5px] font-semibold uppercase tracking-wide">
                          {response.status === 'guardrail_blocked'
                            ? 'SQL Guardrail Blocked'
                            : response.status === 'clarification_required'
                              ? 'Clarification Required'
                              : 'Graceful Refusal · Out of Scope'}
                        </span>
                        <span className="text-[12px] font-medium text-[#9F1239] tabular-nums">
                          {response.audit_trail.latency_ms.toFixed(1)} ms
                        </span>
                      </div>
                      <h2 className="text-[16px] font-bold text-[#9F1239] mt-2">
                        {response.status === 'guardrail_blocked'
                          ? 'Request Blocked by AST Security Policy'
                          : response.status === 'clarification_required'
                            ? 'Ambiguous Business Metric Detected'
                            : 'Metric or Topic Not Governed in Semantic Layer'}
                      </h2>
                      <p className="text-[13.5px] text-[#9F1239] mt-1 leading-relaxed">
                        {response.summary}
                      </p>
                    </div>
                  </div>

                  {/* Warnings details */}
                  {response.warnings.length > 0 && (
                    <div className="space-y-2 pl-9">
                      {response.warnings.map((w, idx) => (
                        <div
                          key={`${w.code}-${idx}`}
                          className="rounded-lg bg-[#FFFFFF] border border-[#FECDD3] px-3.5 py-2.5 text-[12.5px] text-[#9F1239]"
                        >
                          <span className="font-semibold">{w.title}:</span> {w.message}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Clickable Official Metric Suggestion Chips */}
                  {response.suggestions.length > 0 && (
                    <div className="pt-3 border-t border-[#FECDD3] pl-9">
                      <div className="text-[12px] font-semibold text-[#9F1239] mb-2">
                        Try one of these governed official queries instead:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {response.suggestions.map((rawItem, idx) => {
                          const s = normalizeSuggestion(rawItem);
                          if (!s.question) return null;
                          return (
                            <button
                              key={`${s.question}-${idx}`}
                              type="button"
                              onClick={() => void executeQuestion(s.question)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#CBD5E1] hover:border-[#3B498B] hover:bg-[#EEF0FA] text-[12.5px] font-medium text-[#111827] hover:text-[#3B498B] transition-colors shadow-sm"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[#3B498B]" />
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

      {/* Collapsible Right-Hand Verification & Audit Trail Drawer (400px non-overlapping flex) */}
      <AuditTrailDrawer
        auditTrail={response?.audit_trail ?? null}
        status={response?.status ?? null}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
};
