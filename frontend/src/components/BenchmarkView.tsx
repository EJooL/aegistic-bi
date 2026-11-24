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
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
  Loader2,
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
    <div className="bg-[#FFFFFF] border border-[#09090B] rounded px-3.5 py-2.5">
      <div className="text-[12px] font-bold text-[#09090B] pb-1.5 mb-1.5 border-b border-[#E5E7EB]">
        {label}
      </div>
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-5 text-[12.5px]"
          >
            <span className="flex items-center gap-2 text-[#4B5563]">
              <span
                className="w-2 h-2 shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.name}</span>
            </span>
            <span className="font-semibold text-[#09090B] tabular-nums">
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
        accent: '#5BC2F4',
        subtitle: 'Exact numeric match vs ground truth SQL',
      },
      {
        title: 'Hallucination / Def. Error',
        aegistic: `${a.hallucination_error_rate_pct.toFixed(1)}%`,
        baseline: `${b.hallucination_error_rate_pct.toFixed(1)}%`,
        delta: `${(a.hallucination_error_rate_pct - b.hallucination_error_rate_pct).toFixed(1)} pp`,
        accent: '#FF0F5B',
        subtitle: 'Lower is better · silent business logic errors',
      },
      {
        title: 'Safe Refusal Rate',
        aegistic: `${a.safe_refusal_rate_pct.toFixed(1)}%`,
        baseline: `${b.safe_refusal_rate_pct.toFixed(1)}%`,
        delta: `+${(a.safe_refusal_rate_pct - b.safe_refusal_rate_pct).toFixed(1)} pp`,
        accent: '#67689E',
        subtitle: 'Ambiguous, out-of-scope & adversarial prompts',
      },
      {
        title: 'Median Query Latency',
        aegistic: `${a.median_latency_ms.toFixed(1)} ms`,
        baseline: `${b.median_latency_ms.toFixed(1)} ms`,
        delta: `${a.median_latency_ms - b.median_latency_ms >= 0 ? '+' : ''}${(
          a.median_latency_ms - b.median_latency_ms
        ).toFixed(1)} ms`,
        accent: '#09090B',
        subtitle: 'End-to-end 5-gate execution speed',
      },
    ];
  }, [report]);

  return (
    <div className="flex-1 min-w-0 min-h-screen bg-[#FFFFFF] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#FFFFFF] border-b border-[#E5E7EB] px-8 h-[68px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="font-display text-[20px] font-bold text-[#09090B] leading-tight">
            Evaluation Benchmark
          </h1>
          {report && (
            <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded bg-[#F7F8FA] border border-[#BDC4D0] text-[#09090B] tabular-nums">
              {report.dataset_size} Golden Cases
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {report && (
            <span className="text-[12px] font-medium text-[#4B5563] tabular-nums">
              {formatTimestamp(report.generated_at)}
            </span>
          )}
          <button
            type="button"
            onClick={() => void loadBenchmark()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded border border-[#BDC4D0] bg-[#FFFFFF] hover:border-[#09090B] text-[13px] font-semibold text-[#09090B] transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#09090B] ${loading ? 'animate-spin' : ''}`}
            />
            Reload
          </button>
        </div>
      </header>

      <div className="flex-1 px-8 py-6 max-w-[1400px] w-full mx-auto space-y-8">
        {error && (
          <div className="rounded-md bg-[#09090B] text-[#FFFFFF] px-5 py-4 flex items-center justify-between gap-4 text-[13px]">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#FF0F5B] shrink-0" />
              <div>
                <div className="font-bold">Benchmark Report Unavailable</div>
                <div className="text-[#D1D5DB] mt-0.5">{error}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadBenchmark()}
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
              Loading 60-case evaluation benchmark report...
            </span>
          </div>
        ) : (
          report && (
            <>
              {/* 4 Swiss Stat Strip KPI Blocks */}
              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                {kpiCards.map((card) => (
                  <div
                    key={card.title}
                    className="border-t-2 border-x border-b border-x-[#E5E7EB] border-b-[#E5E7EB] rounded-b bg-[#FFFFFF] p-5 flex flex-col justify-between"
                    style={{ borderTopColor: card.accent }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#4B5563]">
                          {card.title}
                        </span>
                        <span className="text-[11.5px] font-bold text-[#09090B] tabular-nums">
                          {card.delta}
                        </span>
                      </div>

                      <div className="mt-4 flex items-baseline justify-between gap-2">
                        <div>
                          <div className="text-[10.5px] uppercase tracking-wider text-[#FF0F5B] font-semibold">
                            Aegistic
                          </div>
                          <div className="kpi-number text-[32px] font-bold text-[#09090B] leading-tight">
                            {card.aegistic}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10.5px] uppercase tracking-wider text-[#4B5563] font-medium">
                            Baseline
                          </div>
                          <div className="text-[18px] font-semibold text-[#4B5563] tabular-nums">
                            {card.baseline}
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 pt-2.5 border-t border-[#E5E7EB] text-[12px] text-[#4B5563]">
                      {card.subtitle}
                    </p>
                  </div>
                ))}
              </section>

              {/* Category Comparison Chart + Scoreboard */}
              <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 rounded-md border border-[#BDC4D0] bg-[#FFFFFF] p-5">
                  <div className="pb-4 mb-4 border-b border-[#E5E7EB]">
                    <h2 className="font-display text-[16px] font-bold text-[#09090B]">
                      Accuracy Comparison by Evaluation Category
                    </h2>
                    <p className="text-[12.5px] text-[#4B5563] mt-0.5">
                      Pass rate (%) across Standard, Definition Traps, and Out-of-Scope/Adversarial suites
                    </p>
                  </div>

                  <div style={{ width: '100%', height: 290 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={report.by_category}
                        margin={{ top: 10, right: 16, left: 4, bottom: 6 }}
                        barGap={8}
                      >
                        <CartesianGrid stroke="#E5E7EB" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: '#4B5563', fontSize: 11.5 }}
                          tickLine={{ stroke: '#BDC4D0' }}
                          axisLine={{ stroke: '#BDC4D0' }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fill: '#4B5563', fontSize: 11.5 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => `${v}%`}
                        />
                        <Tooltip content={<BenchmarkTooltip />} cursor={{ fill: '#F7F8FA' }} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                        <Bar
                          dataKey="baseline_accuracy_pct"
                          name="Baseline (Raw Text-to-SQL)"
                          fill="#67689E"
                          radius={[2, 2, 0, 0]}
                          maxBarSize={44}
                        />
                        <Bar
                          dataKey="aegistic_accuracy_pct"
                          name="Aegistic (Semantic Layer + Guardrails)"
                          fill="#5BC2F4"
                          radius={[2, 2, 0, 0]}
                          maxBarSize={44}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Category Scoreboard */}
                <div className="rounded-md border border-[#BDC4D0] bg-[#FFFFFF] p-5 flex flex-col justify-between">
                  <div>
                    <h2 className="font-display text-[16px] font-bold text-[#09090B]">
                      Category Scoreboard
                    </h2>
                    <p className="text-[12.5px] text-[#4B5563] mt-1 pb-4 border-b border-[#E5E7EB]">
                      Overall Pass Rate:{' '}
                      <strong className="text-[#09090B] tabular-nums">
                        {report.summary.aegistic.overall_pass_rate_pct.toFixed(1)}%
                      </strong>{' '}
                      vs Baseline{' '}
                      <strong className="text-[#4B5563] tabular-nums">
                        {report.summary.baseline.overall_pass_rate_pct.toFixed(1)}%
                      </strong>
                    </p>

                    <div className="divide-y divide-[#E5E7EB]">
                      {report.by_category.map((cat) => (
                        <div key={cat.category} className="py-3.5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13.5px] font-bold text-[#09090B]">
                              {cat.label}
                            </span>
                            <span className="text-[12px] font-medium text-[#4B5563] tabular-nums">
                              {cat.total} cases
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[12.5px] tabular-nums">
                            <span className="text-[#4B5563]">
                              Baseline:{' '}
                              <strong className="text-[#09090B]">
                                {cat.baseline_passed}/{cat.total}
                              </strong>{' '}
                              ({cat.baseline_accuracy_pct.toFixed(1)}%)
                            </span>
                            <span className="inline-flex items-center gap-1.5 font-semibold text-[#09090B]">
                              <span className="w-2 h-2 rounded-full bg-[#5BC2F4]" />
                              {cat.aegistic_passed}/{cat.total} (
                              {cat.aegistic_accuracy_pct.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Filterable 60-Case Breakdown Table */}
              <section className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-[16px] font-bold text-[#09090B]">
                      All Evaluation Cases{' '}
                      <span className="text-[13px] font-medium text-[#4B5563] tabular-nums">
                        ({filteredCases.length} of {report.cases.length})
                      </span>
                    </h2>
                    <p className="text-[12.5px] text-[#4B5563] mt-0.5">
                      Click any row to inspect Baseline vs. Aegistic SQL side by side
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#4B5563] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search ID, question, error..."
                        className="pl-8 pr-3 py-1.5 rounded border border-[#BDC4D0] bg-[#FFFFFF] text-[12.5px] text-[#09090B] placeholder:text-[#4B5563] focus:outline-none focus:border-[#09090B] w-56"
                      />
                    </div>

                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="text-[12.5px] font-medium text-[#09090B] bg-[#FFFFFF] border border-[#BDC4D0] rounded px-2.5 py-1.5 focus:outline-none focus:border-[#09090B]"
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
                      className="text-[12.5px] font-medium text-[#09090B] bg-[#FFFFFF] border border-[#BDC4D0] rounded px-2.5 py-1.5 focus:outline-none focus:border-[#09090B]"
                    >
                      <option value="all">All Outcomes</option>
                      <option value="aegistic_win">Aegistic Fixed Baseline Error</option>
                      <option value="any_fail">Any Engine Failed</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto rounded border border-[#E5E7EB]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F7F8FA] border-b border-[#BDC4D0]">
                        <th className="w-9 px-3 py-3" />
                        <th className="px-3 py-3 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[#4B5563] whitespace-nowrap">
                          ID
                        </th>
                        <th className="px-3 py-3 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[#4B5563] whitespace-nowrap">
                          Category
                        </th>
                        <th className="px-3 py-3 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[#4B5563]">
                          Question
                        </th>
                        <th className="px-3 py-3 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[#4B5563] whitespace-nowrap">
                          Baseline
                        </th>
                        <th className="px-3 py-3 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[#4B5563] whitespace-nowrap">
                          Aegistic
                        </th>
                        <th className="px-3 py-3 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[#4B5563] text-right whitespace-nowrap">
                          Latency (B / A)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] bg-[#FFFFFF]">
                      {filteredCases.map((tc) => {
                        const isExpanded = Boolean(expandedRows[tc.id]);
                        const dotColor =
                          tc.category === 'definition_trap'
                            ? '#67689E'
                            : tc.category === 'out_of_scope'
                              ? '#FF0F5B'
                              : '#5BC2F4';
                        return (
                          <React.Fragment key={tc.id}>
                            <tr
                              onClick={() => toggleRow(tc.id)}
                              className="cursor-pointer hover:bg-[#F7F8FA] transition-colors"
                            >
                              <td className="px-3 py-3 text-[#4B5563]">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-[#FF0F5B]" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </td>
                              <td className="px-3 py-3 text-[12.5px] font-bold text-[#09090B] tabular-nums whitespace-nowrap">
                                {tc.id}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#09090B]">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: dotColor }}
                                  />
                                  {CATEGORY_LABELS[tc.category] ?? tc.category}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-[13px] text-[#09090B] max-w-md">
                                <div className="line-clamp-2">{tc.question}</div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#09090B]">
                                    {tc.baseline.passed ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-[#5BC2F4]" />
                                    ) : (
                                      <XCircle className="w-3.5 h-3.5 text-[#FF0F5B]" />
                                    )}
                                    {tc.baseline.passed ? 'PASS' : 'FAIL'}
                                  </span>
                                  {tc.baseline.error_type && (
                                    <span className="text-[11px] font-medium text-[#FF0F5B]">
                                      {tc.baseline.error_type}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#09090B]">
                                    {tc.aegistic.passed ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-[#5BC2F4]" />
                                    ) : (
                                      <XCircle className="w-3.5 h-3.5 text-[#FF0F5B]" />
                                    )}
                                    {tc.aegistic.passed ? 'PASS' : 'FAIL'}
                                  </span>
                                  {tc.aegistic.error_type && (
                                    <span className="text-[11px] font-medium text-[#FF0F5B]">
                                      {tc.aegistic.error_type}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right text-[12.5px] text-[#09090B] tabular-nums whitespace-nowrap">
                                {tc.baseline.latency_ms.toFixed(1)} /{' '}
                                <strong>{tc.aegistic.latency_ms.toFixed(1)}</strong> ms
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr className="bg-[#F7F8FA]">
                                <td colSpan={7} className="px-6 py-4">
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="rounded border border-[#BDC4D0] bg-[#FFFFFF] p-4 space-y-2.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#4B5563]">
                                          Baseline (Raw Text-to-SQL)
                                        </span>
                                        <span
                                          className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                                            tc.baseline.passed
                                              ? 'border border-[#5BC2F4] text-[#09090B]'
                                              : 'bg-[#FF0F5B] text-[#FFFFFF]'
                                          }`}
                                        >
                                          {tc.baseline.status}
                                        </span>
                                      </div>
                                      <p className="text-[12.5px] text-[#4B5563] leading-relaxed">
                                        {tc.baseline.note}
                                      </p>
                                      <pre className="sql-code-block font-mono rounded p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-48">
                                        <code>
                                          {tc.baseline.sql || '-- No SQL generated'}
                                        </code>
                                      </pre>
                                    </div>

                                    <div className="rounded border border-[#5BC2F4] bg-[#FFFFFF] p-4 space-y-2.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#67689E]">
                                          Aegistic (Semantic Layer + Guardrails)
                                        </span>
                                        <span
                                          className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                                            tc.aegistic.passed
                                              ? 'border border-[#5BC2F4] text-[#09090B]'
                                              : 'bg-[#FF0F5B] text-[#FFFFFF]'
                                          }`}
                                        >
                                          {tc.aegistic.status}
                                        </span>
                                      </div>
                                      <p className="text-[12.5px] text-[#4B5563] leading-relaxed">
                                        {tc.aegistic.note}
                                      </p>
                                      <pre className="sql-code-block font-mono rounded p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-48">
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
