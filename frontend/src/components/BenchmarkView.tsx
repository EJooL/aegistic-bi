import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
  ShieldCheck,
  Loader2,
  BarChart3,
} from 'lucide-react';
import {
  fetchBenchmark,
  formatTimestamp,
  type BenchmarkCase,
  type BenchmarkReport,
} from '../lib/api';

interface BenchmarkTooltipItem {
  name?: string;
  value?: number;
  color?: string;
}

const BenchmarkTooltip: React.FC<{
  active?: boolean;
  label?: string;
  payload?: BenchmarkTooltipItem[];
}> = ({ active, label, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3.5 py-2.5 shadow-panel">
      <div className="text-[12px] font-semibold text-[#111827] pb-1.5 mb-1.5 border-b border-[#E2E8F0]">
        {label}
      </div>
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-5 text-[12.5px]"
          >
            <span className="flex items-center gap-2 text-[#526075]">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.name}</span>
            </span>
            <span className="font-semibold text-[#111827] tabular-nums">
              {typeof entry.value === 'number' ? `${entry.value.toFixed(1)}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const CATEGORY_LABELS: Record<string, string> = {
  standard: 'Standard',
  definition_trap: 'Definition Trap',
  out_of_scope: 'Out-of-Scope & Adversarial',
};

export const BenchmarkView: React.FC = () => {
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'aegistic_win' | 'any_fail'>('all');
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const loadBenchmark = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBenchmark();
      setReport(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load evaluation benchmark report.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBenchmark();
  }, [loadBenchmark]);

  const filteredCases = useMemo<BenchmarkCase[]>(() => {
    if (!report) return [];
    const q = search.trim().toLowerCase();
    return report.cases.filter((c) => {
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
      if (outcomeFilter === 'aegistic_win' && !(c.aegistic.passed && !c.baseline.passed)) {
        return false;
      }
      if (outcomeFilter === 'any_fail' && c.aegistic.passed && c.baseline.passed) {
        return false;
      }
      if (!q) return true;
      return (
        c.id.toLowerCase().includes(q) ||
        c.question.toLowerCase().includes(q) ||
        (c.baseline.error_type ?? '').toLowerCase().includes(q)
      );
    });
  }, [report, categoryFilter, outcomeFilter, search]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const kpiCards = useMemo(() => {
    if (!report) return [];
    const b = report.summary.baseline;
    const a = report.summary.aegistic;
    return [
      {
        title: 'Execution Accuracy',
        aegistic: `${a.execution_accuracy_pct.toFixed(1)}%`,
        baseline: `${b.execution_accuracy_pct.toFixed(1)}%`,
        delta: `+${(a.execution_accuracy_pct - b.execution_accuracy_pct).toFixed(1)} pp`,
        isPositive: a.execution_accuracy_pct >= b.execution_accuracy_pct,
        subtitle: 'Exact numeric match vs ground truth SQL',
      },
      {
        title: 'Hallucination / Definition Error',
        aegistic: `${a.hallucination_error_rate_pct.toFixed(1)}%`,
        baseline: `${b.hallucination_error_rate_pct.toFixed(1)}%`,
        delta: `${(a.hallucination_error_rate_pct - b.hallucination_error_rate_pct).toFixed(1)} pp`,
        isPositive: a.hallucination_error_rate_pct <= b.hallucination_error_rate_pct,
        subtitle: 'Lower is better · silent business logic errors',
      },
      {
        title: 'Safe Refusal Rate',
        aegistic: `${a.safe_refusal_rate_pct.toFixed(1)}%`,
        baseline: `${b.safe_refusal_rate_pct.toFixed(1)}%`,
        delta: `+${(a.safe_refusal_rate_pct - b.safe_refusal_rate_pct).toFixed(1)} pp`,
        isPositive: a.safe_refusal_rate_pct >= b.safe_refusal_rate_pct,
        subtitle: 'Ambiguous, out-of-scope & adversarial prompts',
      },
      {
        title: 'Median Query Latency',
        aegistic: `${a.median_latency_ms.toFixed(1)} ms`,
        baseline: `${b.median_latency_ms.toFixed(1)} ms`,
        delta: `${(a.median_latency_ms - b.median_latency_ms >= 0 ? '+' : '')}${(
          a.median_latency_ms - b.median_latency_ms
        ).toFixed(1)} ms`,
        isPositive: a.median_latency_ms <= b.median_latency_ms + 10,
        subtitle: 'End-to-end 5-gate execution speed',
      },
    ];
  }, [report]);

  return (
    <div className="flex-1 min-w-0 min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#FFFFFF]/95 backdrop-blur border-b border-[#E2E8F0] px-7 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[19px] font-bold text-[#111827] leading-tight">
              Evaluation Benchmark
            </h1>
            {report && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EBF6FD] text-[#1B6CA8] text-[12px] font-semibold tabular-nums">
                <ShieldCheck className="w-3.5 h-3.5 text-[#4DA8E5]" />
                {report.dataset_size} Golden Test Cases
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#526075] mt-0.5">
            Baseline (Raw Text-to-SQL) vs. Aegistic (Governed Semantic Layer + SQL AST Guardrails)
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {report && (
            <span className="text-[12px] text-[#526075] tabular-nums">
              Generated: {formatTimestamp(report.generated_at)}
            </span>
          )}
          <button
            type="button"
            onClick={() => void loadBenchmark()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] text-[13px] font-semibold text-[#1F2937] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-[#3B498B] ${loading ? 'animate-spin' : ''}`} />
            Reload
          </button>
        </div>
      </header>

      <div className="flex-1 px-7 py-6 max-w-[1440px] w-full mx-auto space-y-6">
        {error && (
          <div className="rounded-xl bg-[#FFF1F2] border border-[#FECDD3] px-5 py-4 flex items-center justify-between gap-4 text-[13px] text-[#9F1239]">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#E11D48] shrink-0" />
              <div>
                <div className="font-semibold">Benchmark Report Unavailable</div>
                <div className="mt-0.5">{error}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadBenchmark()}
              className="font-semibold underline shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] p-12 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 text-[#3B498B] animate-spin" />
            <span className="text-[14px] font-medium text-[#1F2937]">
              Loading 60-case evaluation benchmark report...
            </span>
          </div>
        ) : (
          report && (
            <>
              {/* 4 Executive Headline KPI Comparison Cards */}
              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {kpiCards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold uppercase tracking-wider text-[#526075]">
                          {card.title}
                        </span>
                        <span
                          className={`text-[11.5px] font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                            card.isPositive
                              ? 'bg-[#EBF6FD] text-[#1B6CA8]'
                              : 'bg-[#FFF1F2] text-[#9F1239]'
                          }`}
                        >
                          {card.delta}
                        </span>
                      </div>

                      <div className="mt-3 flex items-baseline justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-semibold text-[#3B498B] uppercase tracking-wide">
                            Aegistic
                          </div>
                          <div className="kpi-number text-[30px] font-bold text-[#111827] leading-tight">
                            {card.aegistic}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-medium text-[#526075] uppercase tracking-wide">
                            Baseline
                          </div>
                          <div className="text-[18px] font-semibold text-[#526075] tabular-nums">
                            {card.baseline}
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 pt-2.5 border-t border-[#E2E8F0] text-[12px] text-[#526075]">
                      {card.subtitle}
                    </p>
                  </div>
                ))}
              </section>

              {/* Category Comparison Chart + Summary Matrix */}
              <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                <div className="xl:col-span-2 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-[15.5px] font-bold text-[#111827] flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-[#4DA8E5]" />
                        Accuracy Comparison by Evaluation Category
                      </h2>
                      <p className="text-[12.5px] text-[#526075] mt-0.5">
                        Pass rate (%) across Standard, Definition Traps, and Out-of-Scope/Adversarial suites
                      </p>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={report.by_category}
                        margin={{ top: 10, right: 20, left: 4, bottom: 8 }}
                        barGap={8}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: '#526075', fontSize: 12 }}
                          tickLine={{ stroke: '#CBD5E1' }}
                          axisLine={{ stroke: '#CBD5E1' }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fill: '#526075', fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => `${v}%`}
                        />
                        <Tooltip content={<BenchmarkTooltip />} cursor={{ fill: '#EEF0FA', opacity: 0.45 }} />
                        <Legend wrapperStyle={{ fontSize: 12.5, paddingTop: 10 }} />
                        <Bar
                          dataKey="baseline_accuracy_pct"
                          name="Baseline (Raw Text-to-SQL)"
                          fill="#7685C4"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={48}
                        />
                        <Bar
                          dataKey="aegistic_accuracy_pct"
                          name="Aegistic (Semantic Layer + Guardrails)"
                          fill="#4DA8E5"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={48}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Category Scoreboard Card */}
                <div className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card p-5 flex flex-col justify-between">
                  <div>
                    <h2 className="text-[15.5px] font-bold text-[#111827] mb-1">
                      Category Breakdown
                    </h2>
                    <p className="text-[12.5px] text-[#526075] mb-4">
                      Overall Pass Rate:{' '}
                      <strong className="text-[#111827] tabular-nums">
                        {report.summary.aegistic.overall_pass_rate_pct.toFixed(1)}%
                      </strong>{' '}
                      vs Baseline{' '}
                      <strong className="text-[#526075] tabular-nums">
                        {report.summary.baseline.overall_pass_rate_pct.toFixed(1)}%
                      </strong>
                    </p>

                    <div className="space-y-3.5">
                      {report.by_category.map((cat) => (
                        <div
                          key={cat.category}
                          className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-semibold text-[#111827]">
                              {cat.label}
                            </span>
                            <span className="text-[11.5px] font-semibold text-[#526075] tabular-nums">
                              {cat.total} cases
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5 text-[12.5px]">
                            <div className="rounded bg-[#FFFFFF] border border-[#E2E8F0] px-2.5 py-1.5">
                              <div className="text-[10.5px] font-medium text-[#526075] uppercase">
                                Baseline
                              </div>
                              <div className="font-bold text-[#1F2937] tabular-nums mt-0.5">
                                {cat.baseline_passed}/{cat.total}{' '}
                                <span className="font-medium text-[#526075]">
                                  ({cat.baseline_accuracy_pct.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                            <div className="rounded bg-[#EBF6FD]/70 border border-[#4DA8E5]/30 px-2.5 py-1.5">
                              <div className="text-[10.5px] font-semibold text-[#1B6CA8] uppercase">
                                Aegistic
                              </div>
                              <div className="font-bold text-[#111827] tabular-nums mt-0.5">
                                {cat.aegistic_passed}/{cat.total}{' '}
                                <span className="font-semibold text-[#1B6CA8]">
                                  ({cat.aegistic_accuracy_pct.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Filterable 60-Case Breakdown Table */}
              <section className="rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[15.5px] font-bold text-[#111827]">
                      All Evaluation Cases
                      <span className="ml-2 text-[13px] font-medium text-[#526075] tabular-nums">
                        ({filteredCases.length} of {report.cases.length})
                      </span>
                    </h2>
                    <p className="text-[12px] text-[#526075] mt-0.5">
                      Click any row to inspect compiled SQL and evaluation notes side by side
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#526075] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search ID, question, error..."
                        className="pl-8 pr-3 py-1.5 rounded-lg border border-[#CBD5E1] text-[12.5px] text-[#111827] placeholder:text-[#526075] focus:outline-none focus:ring-2 focus:ring-[#3B498B]/30 focus:border-[#3B498B] w-56"
                      />
                    </div>

                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="text-[12.5px] font-medium text-[#1F2937] bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#3B498B]/30"
                    >
                      <option value="all">All Categories</option>
                      <option value="standard">Standard Business Queries</option>
                      <option value="definition_trap">Definition Traps</option>
                      <option value="out_of_scope">Out-of-Scope &amp; Adversarial</option>
                    </select>

                    <select
                      value={outcomeFilter}
                      onChange={(e) =>
                        setOutcomeFilter(
                          e.target.value as 'all' | 'aegistic_win' | 'any_fail'
                        )
                      }
                      className="text-[12.5px] font-medium text-[#1F2937] bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#3B498B]/30"
                    >
                      <option value="all">All Outcomes</option>
                      <option value="aegistic_win">Aegistic Fixed Baseline Error</option>
                      <option value="any_fail">Any Engine Failed</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0]">
                        <th className="w-9 px-3 py-3" />
                        <th className="px-3 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-[#526075] whitespace-nowrap">
                          ID
                        </th>
                        <th className="px-3 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-[#526075] whitespace-nowrap">
                          Category
                        </th>
                        <th className="px-3 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-[#526075]">
                          Question
                        </th>
                        <th className="px-3 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-[#526075] whitespace-nowrap">
                          Baseline
                        </th>
                        <th className="px-3 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-[#526075] whitespace-nowrap">
                          Aegistic
                        </th>
                        <th className="px-3 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-[#526075] text-right whitespace-nowrap">
                          Latency (B / A)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] bg-[#FFFFFF]">
                      {filteredCases.map((tc) => {
                        const isExpanded = Boolean(expandedRows[tc.id]);
                        return (
                          <React.Fragment key={tc.id}>
                            <tr
                              onClick={() => toggleRow(tc.id)}
                              className="cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                            >
                              <td className="px-3 py-3 text-[#526075]">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-[#3B498B]" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </td>
                              <td className="px-3 py-3 font-mono text-[12px] font-semibold text-[#111827] whitespace-nowrap">
                                {tc.id}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span
                                  className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                    tc.category === 'definition_trap'
                                      ? 'bg-[#EEF0FA] text-[#3B498B]'
                                      : tc.category === 'out_of_scope'
                                        ? 'bg-[#FFF1F2] text-[#9F1239] border border-[#FECDD3]'
                                        : 'bg-[#EBF6FD] text-[#1B6CA8]'
                                  }`}
                                >
                                  {CATEGORY_LABELS[tc.category] ?? tc.category}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-[13px] text-[#1F2937] max-w-md">
                                <div className="line-clamp-2">{tc.question}</div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="flex flex-col gap-0.5">
                                  <span
                                    className={`inline-flex items-center gap-1 text-[12px] font-semibold ${
                                      tc.baseline.passed
                                        ? 'text-[#1B6CA8]'
                                        : 'text-[#9F1239]'
                                    }`}
                                  >
                                    {tc.baseline.passed ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-[#4DA8E5]" />
                                    ) : (
                                      <XCircle className="w-3.5 h-3.5 text-[#E11D48]" />
                                    )}
                                    {tc.baseline.passed ? 'PASS' : 'FAIL'}
                                  </span>
                                  {tc.baseline.error_type && (
                                    <span className="font-mono text-[10.5px] text-[#9F1239]">
                                      {tc.baseline.error_type}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="flex flex-col gap-0.5">
                                  <span
                                    className={`inline-flex items-center gap-1 text-[12px] font-semibold ${
                                      tc.aegistic.passed
                                        ? 'text-[#1B6CA8]'
                                        : 'text-[#9F1239]'
                                    }`}
                                  >
                                    {tc.aegistic.passed ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-[#4DA8E5]" />
                                    ) : (
                                      <XCircle className="w-3.5 h-3.5 text-[#E11D48]" />
                                    )}
                                    {tc.aegistic.passed ? 'PASS' : 'FAIL'}
                                  </span>
                                  {tc.aegistic.error_type && (
                                    <span className="font-mono text-[10.5px] text-[#9F1239]">
                                      {tc.aegistic.error_type}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right font-mono text-[12px] text-[#111827] tabular-nums whitespace-nowrap">
                                {tc.baseline.latency_ms.toFixed(1)} /{' '}
                                <strong>{tc.aegistic.latency_ms.toFixed(1)}</strong> ms
                              </td>
                            </tr>

                            {/* Expandable SQL & Notes Inspector */}
                            {isExpanded && (
                              <tr className="bg-[#F8FAFC]">
                                <td colSpan={7} className="px-6 py-4">
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {/* Baseline Detail */}
                                    <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-4 space-y-2.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-bold uppercase tracking-wider text-[#526075]">
                                          Baseline (Raw Text-to-SQL)
                                        </span>
                                        <span
                                          className={`font-mono text-[11px] px-2 py-0.5 rounded font-semibold ${
                                            tc.baseline.passed
                                              ? 'bg-[#EBF6FD] text-[#1B6CA8]'
                                              : 'bg-[#FFF1F2] text-[#9F1239]'
                                          }`}
                                        >
                                          {tc.baseline.status}
                                        </span>
                                      </div>
                                      <p className="text-[12.5px] text-[#1F2937] leading-relaxed">
                                        {tc.baseline.note}
                                      </p>
                                      <pre className="sql-code-block rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-48">
                                        <code>
                                          {tc.baseline.sql || '-- No SQL generated'}
                                        </code>
                                      </pre>
                                    </div>

                                    {/* Aegistic Detail */}
                                    <div className="rounded-lg border border-[#4DA8E5]/40 bg-[#FFFFFF] p-4 space-y-2.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-bold uppercase tracking-wider text-[#3B498B]">
                                          Aegistic (Semantic Layer + Guardrails)
                                        </span>
                                        <span
                                          className={`font-mono text-[11px] px-2 py-0.5 rounded font-semibold ${
                                            tc.aegistic.passed
                                              ? 'bg-[#EBF6FD] text-[#1B6CA8]'
                                              : 'bg-[#FFF1F2] text-[#9F1239]'
                                          }`}
                                        >
                                          {tc.aegistic.status}
                                        </span>
                                      </div>
                                      <p className="text-[12.5px] text-[#1F2937] leading-relaxed">
                                        {tc.aegistic.note}
                                      </p>
                                      <pre className="sql-code-block rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-48">
                                        <code>
                                          {tc.aegistic.sql ||
                                            '-- Safely refused / blocked before SQL execution'}
                                        </code>
                                      </pre>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )
        )}
      </div>
    </div>
  );
};
