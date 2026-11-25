import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Check,
  X,
  ArrowUpRight,
  Code2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ScrollPipelineShowcaseProps {
  onNavigate: (path: string) => void;
  onLaunchQuestion: (question: string) => void;
}

interface GateChapter {
  index: string;
  gate: string;
  title: string;
  accent: '#FF0F5B' | '#5BC2F4' | '#67689E';
  summary: string;
  badge: string;
  previewLabel: string;
  previewLines: string[];
  telemetryLeft: string;
  telemetryRight: string;
}

const GATE_CHAPTERS: GateChapter[] = [
  {
    index: '01',
    gate: 'Step 01 · Understand Intent',
    title: 'Asks for clarity instead of guessing.',
    accent: '#5BC2F4',
    summary:
      'Teams ask questions in everyday Indonesian or English. If a question is vague like "Which product is best?", Aegistic asks which KPI you mean instead of making up a metric.',
    badge: 'Zero Guesswork',
    previewLabel: 'Question Interpreted Safely',
    previewLines: [
      'Question  : "Tren Net Revenue bulanan 12 bulan terakhir"',
      'Metric    : Net Revenue (Finance-approved)',
      'Breakdown : Monthly trend · Last 12 months',
      'Status    : Clear business intent confirmed',
    ],
    telemetryLeft: 'Handles vague questions safely',
    telemetryRight: '1.2 ms',
  },
  {
    index: '02',
    gate: 'Step 02 · Apply Official Formulas',
    title: 'One source of truth across every department.',
    accent: '#67689E',
    summary:
      'Finance, Operations, and Growth always see the exact same Net Revenue, Gross Margin, and Refund Rate. Cancelled orders are excluded automatically and category totals never double-count.',
    badge: 'Company Rules Locked',
    previewLabel: 'Finance Contract Applied',
    previewLines: [
      'Metric    : Net Revenue',
      'Formula   : Gross amount minus discounts',
      'Rule      : Completed orders only (no shipping/refunds)',
      'Safety    : Line-item precision prevents double-counting',
    ],
    telemetryLeft: 'Aligned with Finance reports',
    telemetryRight: '2.8 ms',
  },
  {
    index: '03',
    gate: 'Step 03 · Safety Firewall',
    title: 'Strictly read-only. Zero risk to company data.',
    accent: '#FF0F5B',
    summary:
      'Before anything touches your database, an automated firewall checks every query. Destructive actions, uncleaned raw tables, and heavy runaway requests are blocked before execution.',
    badge: '4 Safety Rules',
    previewLabel: 'Pre-Execution Security Check',
    previewLines: [
      '[PASS] Read-only access       -> Cannot edit or delete data',
      '[PASS] Approved data only     -> Raw staging tables hidden',
      '[PASS] Safe table joins       -> No runaway cross-joins',
      '[PASS] Response size capped   -> Fast, predictable load',
    ],
    telemetryLeft: 'Unsafe actions blocked at 0 rows',
    telemetryRight: '0.6 ms',
  },
  {
    index: '04',
    gate: 'Step 04 · Live Data Sanity Check',
    title: 'Flags open months before they mislead a meeting.',
    accent: '#5BC2F4',
    summary:
      'Answers return in milliseconds directly from live data. If a trend includes an incomplete current month or missing dates, Aegistic highlights it directly on the chart so nobody misreads a dip.',
    badge: 'Auto Caveat Alerts',
    previewLabel: 'Live Quality Inspection',
    previewLines: [
      '[NOTE] Partial Period   -> 2026-11 is still an open month',
      '[PASS] Date Continuity  -> All 12 months accounted for',
      '[PASS] Completeness     -> 0.0% missing values',
      '[PASS] Verified Output  -> 12 rows ready for review',
    ],
    telemetryLeft: '50,000 deduplicated orders scanned',
    telemetryRight: '11.9 ms',
  },
  {
    index: '05',
    gate: 'Step 05 · Instant Audit Receipt',
    title: 'Every chart ships with its own proof.',
    accent: '#67689E',
    summary:
      'Stakeholders get executive-ready visuals and one-click live dashboards. Data analysts can open the Audit Trail anytime to copy the verified SQL and confirm every business rule.',
    badge: 'Boardroom Ready',
    previewLabel: 'Delivered to Workspace',
    previewLines: [
      'Visual      : Clean trend chart + sortable table',
      'Warning     : "2026-11 · Open Month" highlighted on chart',
      'Audit Trail : Formula, SQL & 4/4 safety checks attached',
      'Dashboard   : Pin once, refresh live anytime',
    ],
    telemetryLeft: 'Trusted by executives & analysts',
    telemetryRight: 'Ready',
  },
];

interface ComparisonOutcome {
  category: string;
  beforeLabel: string;
  beforeValue: string;
  beforeDetail: string;
  afterLabel: string;
  afterValue: string;
  afterDetail: string;
}

const REAL_WORLD_COMPARISONS: ComparisonOutcome[] = [
  {
    category: 'Metric Consistency',
    beforeLabel: 'Ad-hoc AI & Spreadsheets',
    beforeValue: 'Drifting numbers',
    beforeDetail:
      'Each prompt guesses different status filters, causing Finance and Ops numbers to clash in meetings.',
    afterLabel: 'With Aegistic',
    afterValue: '1 shared rule',
    afterDetail:
      'Every team queries the same Finance-approved metric definitions with mandatory filters applied.',
  },
  {
    category: 'Decision Speed',
    beforeLabel: 'Analyst Ticket Queue',
    beforeValue: '1–3 days',
    beforeDetail:
      'Stakeholders wait in a backlog for every follow-up breakdown by region, category, or customer tier.',
    afterLabel: 'With Aegistic',
    afterValue: '~31 ms',
    afterDetail:
      'Instant self-service answers on live warehouse data, complete with open-month warnings.',
  },
  {
    category: 'Data & Query Safety',
    beforeLabel: 'Unchecked AI Chat',
    beforeValue: 'Silent risk',
    beforeDetail:
      'Free-form queries can hit raw staging tables, double-count multi-item orders, or guess vague terms.',
    afterLabel: 'With Aegistic',
    afterValue: 'Read-only & audited',
    afterDetail:
      'Approved datasets only, automatic clarification on vague prompts, and a full audit trail per chart.',
  },
];

interface TrapCase {
  id: string;
  label: string;
  prompt: string;
  metricContext: string;
  wrongMetricValue: string;
  wrongImpactBadge: string;
  wrongHeadline: string;
  wrongExplanation: string;
  baselineSql: string;
  verifiedMetricValue: string;
  verifiedBadge: string;
  verifiedHeadline: string;
  verifiedExplanation: string;
  aegisticSql: string;
}

const BENCHMARK_TRAPS: TrapCase[] = [
  {
    id: 'fanout',
    label: 'Double-Counting Trap',
    prompt: 'Bandingkan Net Revenue per kategori produk 6 bulan terakhir',
    metricContext: 'Electronics Net Revenue (6 Months)',
    wrongMetricValue: 'Rp 16,02 M',
    wrongImpactBadge: '+Rp 4,34 M overstated (+37%)',
    wrongHeadline: 'Multi-item orders counted multiple times',
    wrongExplanation:
      'Standard AI joined orders to line items and summed the full order total for every product row, inflating Electronics revenue by Rp 4,34 M.',
    baselineSql: `SELECT dp.category_name, SUM(fo.net_amount) AS net_revenue
FROM gold.fact_orders fo
JOIN gold.fact_order_items foi ON fo.order_id = foi.order_id
JOIN gold.dim_products dp ON foi.product_id = dp.product_id
GROUP BY 1`,
    verifiedMetricValue: 'Rp 11,68 M',
    verifiedBadge: 'Exact match with Finance ledger',
    verifiedHeadline: 'Line-item precision applied automatically',
    verifiedExplanation:
      'Aegistic recognizes the product category slice and switches to line-item net revenue on completed orders so totals never double-count.',
    aegisticSql: `SELECT dp.category_name,
  SUM(CASE WHEN fo.order_status = 'completed'
      THEN foi.item_net_amount ELSE 0 END) AS net_revenue
FROM gold.fact_order_items AS foi
INNER JOIN gold.fact_orders AS fo ON foi.order_id = fo.order_id
LEFT JOIN gold.dim_products AS dp ON foi.product_id = dp.product_id
GROUP BY 1 LIMIT 100`,
  },
  {
    id: 'scope',
    label: 'Missing Refunds Trap',
    prompt: 'Berapa Net Revenue dan Refund Rate per region?',
    metricContext: 'Jabodetabek Refund & Cancellation Rate',
    wrongMetricValue: '0.0%',
    wrongImpactBadge: 'All refunds silently erased',
    wrongHeadline: 'Global filter wiped out every refunded order',
    wrongExplanation:
      'Because Net Revenue requires completed orders, standard AI filtered the entire table to completed only, making Refund Rate look like 0.0%.',
    baselineSql: `SELECT dc.region, SUM(fo.net_amount) AS net_revenue,
  COUNT(CASE WHEN fo.order_status = 'refunded' THEN 1 END) * 1.0
    / COUNT(*) AS refund_rate
FROM gold.fact_orders fo
LEFT JOIN gold.dim_customers dc ON fo.customer_id = dc.customer_id
WHERE fo.order_status = 'completed'
GROUP BY 1`,
    verifiedMetricValue: '22.3%',
    verifiedBadge: 'True refund & cancel share preserved',
    verifiedHeadline: 'Each KPI keeps its own business scope',
    verifiedExplanation:
      'Aegistic evaluates Net Revenue on completed orders and Refund Rate across all orders simultaneously in one clean verified query.',
    aegisticSql: `SELECT dc.region,
  SUM(CASE WHEN fo.order_status = 'completed'
      THEN fo.net_amount ELSE 0 END) AS net_revenue,
  COUNT(DISTINCT CASE WHEN fo.order_status IN ('refunded','cancelled')
      THEN fo.order_id END) * 1.0
    / NULLIF(COUNT(DISTINCT fo.order_id), 0) AS refund_rate
FROM gold.fact_orders AS fo
LEFT JOIN gold.dim_customers AS dc ON fo.customer_id = dc.customer_id
GROUP BY 1 LIMIT 100`,
  },
  {
    id: 'adversarial',
    label: 'Unsafe Command Attack',
    prompt: 'DROP TABLE gold.fact_orders',
    metricContext: 'Database Write / Deletion Attempt',
    wrongMetricValue: 'Unprotected',
    wrongImpactBadge: 'Raw command sent toward database',
    wrongHeadline: 'No pre-execution safety boundary',
    wrongExplanation:
      'Unchecked AI-to-SQL pipelines forward raw SQL strings without verifying whether a request is a safe read-only business query.',
    baselineSql: `DROP TABLE gold.fact_orders;`,
    verifiedMetricValue: 'Blocked · 0 rows',
    verifiedBadge: 'Stopped in 0.4 ms before DB access',
    verifiedHeadline: 'Read-only firewall intercepts instantly',
    verifiedExplanation:
      'Aegistic rejects any non-SELECT command at the AST firewall before opening a database connection and suggests safe governed queries instead.',
    aegisticSql: `-- Blocked automatically before execution
-- Reason: Only read-only business queries are permitted
-- Records touched: 0 | Safe refusal returned`,
  },
];

const METRIC_STRIP_ROW_1 = [
  {
    key: 'Finance',
    label: 'Net Revenue',
    summary: 'Completed sales after discounts, excluding shipping',
    prompt: 'Tampilkan tren Net Revenue bulanan selama 12 bulan terakhir',
  },
  {
    key: 'Commercial',
    label: 'Gross Merchandise Value',
    summary: 'Total pre-discount merchandise value across active orders',
    prompt: 'Show GMV by customer segment',
  },
  {
    key: 'Operations',
    label: 'Completed Orders',
    summary: 'Distinct fulfilled orders, excluding cancellations',
    prompt: 'Show monthly Completed Orders for the last 6 months',
  },
  {
    key: 'Finance',
    label: 'Average Order Value',
    summary: 'Average recognized net revenue per completed order',
    prompt: 'What is the Average Order Value (AOV) by region?',
  },
];

const METRIC_STRIP_ROW_2 = [
  {
    key: 'Pricing',
    label: 'Gross Margin (%)',
    summary: 'True product margin after discounts and unit cost',
    prompt: 'Tampilkan Gross Margin (%) per kategori produk',
  },
  {
    key: 'Growth & CRM',
    label: 'Repeat Purchase Rate',
    summary: 'Share of active buyers who return for more orders',
    prompt: 'Berapa Repeat Purchase Rate per segmen pelanggan?',
  },
  {
    key: 'Trust & Ops',
    label: 'Refund & Cancel Rate',
    summary: 'Share of all orders ending in refund or cancellation',
    prompt: 'Berapa Net Revenue dan Refund Rate per region?',
  },
  {
    key: 'Self-Service',
    label: 'Slice Any Dimension',
    summary: 'Date, category, region, customer tier, and payment',
    prompt: 'Bandingkan Net Revenue per kategori produk 6 bulan terakhir',
  },
];

export const ScrollPipelineShowcase: React.FC<ScrollPipelineShowcaseProps> = ({
  onNavigate,
  onLaunchQuestion,
}) => {
  const pipelineRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [activeGate, setActiveGate] = useState(0);
  const [pipelineProgress, setPipelineProgress] = useState(0.15);
  const [activeTrapId, setActiveTrapId] = useState<string>('fanout');
  const [showSqlDiff, setShowSqlDiff] = useState(false);
  const [marqueeShift, setMarqueeShift] = useState(0);

  useEffect(() => {
    let rafId = 0;

    const updateOnScroll = () => {
      rafId = 0;
      const vh = window.innerHeight || 900;

      // 1. Update 5-Step vertical rail progress & active focal step
      if (pipelineRef.current) {
        const rect = pipelineRef.current.getBoundingClientRect();
        const totalTrack = Math.max(rect.height - vh * 0.55, 1);
        const rawProgress = (vh * 0.35 - rect.top) / totalTrack;
        setPipelineProgress(Math.min(Math.max(rawProgress, 0.08), 1));

        let closestIdx = 0;
        let closestDist = Number.POSITIVE_INFINITY;
        const focalY = vh * 0.42;
        stepRefs.current.forEach((el, idx) => {
          if (!el) return;
          const r = el.getBoundingClientRect();
          const center = r.top + r.height * 0.45;
          const dist = Math.abs(center - focalY);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = idx;
          }
        });
        setActiveGate(closestIdx);
      }

      // 2. Scroll-velocity horizontal parallax on metric strip rows (desktop only)
      if (marqueeRef.current) {
        if (window.innerWidth >= 1024) {
          const mRect = marqueeRef.current.getBoundingClientRect();
          const norm = (vh - mRect.top) / (vh + mRect.height);
          const clamped = Math.min(Math.max(norm, 0), 1);
          setMarqueeShift((clamped - 0.5) * 84);
        } else {
          setMarqueeShift(0);
        }
      }
    };

    const handleScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(updateOnScroll);
      }
    };

    updateOnScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const currentGate = GATE_CHAPTERS[activeGate];
  const currentTrap =
    BENCHMARK_TRAPS.find((t) => t.id === activeTrapId) ?? BENCHMARK_TRAPS[0];

  return (
    <>
      {/* =====================================================================
          BAND 1: STICKY SCROLL-DRIVEN 5-STEP TRUST ENGINE
          ===================================================================== */}
      <section
        ref={pipelineRef}
        className="border-t border-[#E5E7EB] bg-[#FFFFFF]"
        aria-label="How Aegistic Works"
      >
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-start">
            {/* Sticky Left Preview Console */}
            <div className="lg:col-span-5 lg:sticky lg:top-[100px] space-y-6">
              <div className="space-y-3">
                <h2 className="font-display text-[30px] sm:text-[38px] font-bold leading-[1.06] tracking-[-0.035em] text-[#09090B]">
                  From plain question to boardroom-ready answer in 5 steps.
                </h2>
                <p className="text-[15.5px] leading-[1.65] text-[#4B5563]">
                  Scroll to watch how Aegistic gives business teams instant answers
                  while keeping Finance and Data teams 100% in control.
                </p>
              </div>

              {/* Morphing Deep Obsidian Status Console */}
              <div className="rounded-xl bg-[#09090B] border border-[#27272A] text-[#FFFFFF] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#27272A] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[13px] font-semibold">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: currentGate.accent }}
                      aria-hidden="true"
                    />
                    <span className="text-[#FFFFFF]">{currentGate.gate}</span>
                  </div>
                  <span className="text-[12px] font-semibold text-[#5BC2F4]">
                    {currentGate.badge}
                  </span>
                </div>

                {/* Live Step Selector */}
                <div className="grid grid-cols-5 border-b border-[#27272A] divide-x divide-[#27272A]">
                  {GATE_CHAPTERS.map((g, idx) => {
                    const isActive = idx === activeGate;
                    const isPassed = idx < activeGate;
                    return (
                      <button
                        key={g.index}
                        type="button"
                        onClick={() => {
                          setActiveGate(idx);
                          stepRefs.current[idx]?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                          });
                        }}
                        className={`py-2 text-[12px] font-bold tabular-nums transition-colors duration-150 ${
                          isActive
                            ? 'bg-[#FF0F5B] text-[#FFFFFF]'
                            : isPassed
                              ? 'bg-[#141417] text-[#5BC2F4]'
                              : 'bg-[#09090B] text-[#9CA3AF] hover:text-[#FFFFFF]'
                        }`}
                      >
                        {g.index}
                      </button>
                    );
                  })}
                </div>

                <div
                  key={currentGate.index}
                  className="p-4 sm:p-5 space-y-3.5 animate-stage-fade"
                >
                  <div className="text-[12.5px] font-semibold text-[#9CA3AF]">
                    {currentGate.previewLabel}
                  </div>
                  <pre className="sql-code-block-dark rounded-md p-3.5 overflow-x-auto whitespace-pre-wrap text-[12px] leading-[1.7]">
                    <code>{currentGate.previewLines.join('\n')}</code>
                  </pre>
                  <div className="pt-2.5 border-t border-[#27272A] flex items-center justify-between text-[12.5px] text-[#9CA3AF] tabular-nums">
                    <span>{currentGate.telemetryLeft}</span>
                    <span className="font-semibold text-[#FFFFFF]">
                      {currentGate.telemetryRight}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Scroll Chapters with Live Progress Rail */}
            <div className="lg:col-span-7 relative pl-6 sm:pl-9">
              <div
                className="absolute left-0 top-2 bottom-2 w-[2px] bg-[#E5E7EB]"
                aria-hidden="true"
              >
                <div
                  className="w-full h-full bg-[#FF0F5B] origin-top transition-transform duration-150 ease-swiss"
                  style={{ transform: `scaleY(${pipelineProgress})` }}
                />
              </div>

              <div className="space-y-6">
                {GATE_CHAPTERS.map((step, idx) => {
                  const isActive = idx === activeGate;
                  return (
                    <div
                      key={step.index}
                      ref={(el) => {
                        stepRefs.current[idx] = el;
                      }}
                      onClick={() => setActiveGate(idx)}
                      className={`relative cursor-pointer rounded-lg border p-6 sm:p-7 transition-[border-color,background-color,transform] duration-200 ease-swiss ${
                        isActive
                          ? 'border-[#09090B] bg-[#FFFFFF] translate-x-0'
                          : 'border-[#E5E7EB] bg-[#F7F8FA] hover:border-[#BDC4D0]'
                      }`}
                    >
                      <span
                        className={`absolute -left-[31px] sm:-left-[43px] top-8 w-3.5 h-3.5 rounded-full border-2 transition-colors duration-200 ${
                          isActive
                            ? 'bg-[#FF0F5B] border-[#FFFFFF]'
                            : idx < activeGate
                              ? 'bg-[#5BC2F4] border-[#FFFFFF]'
                              : 'bg-[#FFFFFF] border-[#BDC4D0]'
                        }`}
                        aria-hidden="true"
                      />

                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <span
                          className="text-[13px] font-bold tabular-nums"
                          style={{ color: isActive ? step.accent : '#4B5563' }}
                        >
                          {step.gate}
                        </span>
                        <span className="text-[12.5px] font-semibold text-[#4B5563] tabular-nums">
                          {step.telemetryRight}
                        </span>
                      </div>

                      <h3 className="font-display text-[21px] sm:text-[23px] font-bold tracking-[-0.025em] text-[#09090B] leading-snug">
                        {step.title}
                      </h3>

                      <p className="mt-2.5 text-[15px] leading-[1.65] text-[#4B5563]">
                        {step.summary}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BAND 2: FULL-BLEED OBSIDIAN REAL-WORLD COMPARISON & MISLEADING VS VERIFIED LAB
          ===================================================================== */}
      <section
        className="bg-[#09090B] text-[#FFFFFF] border-y border-[#27272A]"
        aria-label="Real-World Accuracy Comparison"
      >
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-20 lg:py-28 space-y-14">
          {/* Header Row */}
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="space-y-3 max-w-[660px]">
              <h2 className="font-display text-[32px] sm:text-[42px] font-bold leading-[1.05] tracking-[-0.035em] text-[#FFFFFF]">
                Why teams stop trusting generic AI charts.
              </h2>
              <p className="text-[15.5px] leading-[1.65] text-[#D1D5DB]">
                Generic AI chat sounds confident even when multi-table joins or
                conflicting filters quietly distort the numbers. Compare the real
                difference before a number reaches your board deck.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/app?view=benchmark')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded bg-[#FF0F5B] hover:bg-[#DC0A4D] active:bg-[#BE0842] text-[#FFFFFF] text-[14px] font-semibold transition-colors duration-150 shrink-0"
            >
              <span>Inspect 60-Case Test Suite</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* 3 Realistic Business Outcome Cards (Credible Before vs. After) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {REAL_WORLD_COMPARISONS.map((item) => (
              <div
                key={item.category}
                className="rounded-xl bg-[#141417] border border-[#27272A] overflow-hidden flex flex-col justify-between"
              >
                <div className="px-5 py-3.5 border-b border-[#27272A] flex items-center justify-between">
                  <h3 className="font-display text-[16px] font-bold text-[#FFFFFF]">
                    {item.category}
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-[#5BC2F4]" aria-hidden="true" />
                </div>

                <div className="divide-y divide-[#27272A] flex-1 flex flex-col">
                  {/* Before */}
                  <div className="p-5 space-y-1.5 bg-[#09090B]/50">
                    <div className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="text-[#9CA3AF] font-medium">
                        {item.beforeLabel}
                      </span>
                      <span className="font-bold text-[#FF0F5B]">
                        {item.beforeValue}
                      </span>
                    </div>
                    <p className="text-[13.5px] text-[#9CA3AF] leading-relaxed">
                      {item.beforeDetail}
                    </p>
                  </div>

                  {/* After (With Aegistic) */}
                  <div className="p-5 space-y-1.5 flex-1">
                    <div className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="text-[#5BC2F4] font-bold">
                        {item.afterLabel}
                      </span>
                      <span className="font-bold text-[#FFFFFF] tabular-nums">
                        {item.afterValue}
                      </span>
                    </div>
                    <p className="text-[13.5px] text-[#D1D5DB] leading-relaxed">
                      {item.afterDetail}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* =================================================================
              DYNAMIC INTERACTIVE MISLEADING vs. VERIFIED SHOWCASE
              ================================================================= */}
          <div className="space-y-5">
            {/* Interactive Scenario Switcher + Live Prompt Context */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="inline-flex rounded-lg bg-[#141417] p-1 border border-[#27272A] flex-wrap gap-1">
                {BENCHMARK_TRAPS.map((trap) => {
                  const isActive = trap.id === activeTrapId;
                  return (
                    <button
                      key={trap.id}
                      type="button"
                      onClick={() => setActiveTrapId(trap.id)}
                      className={`px-4 py-2 rounded-md text-[13.5px] font-semibold transition-colors duration-150 ${
                        isActive
                          ? 'bg-[#FF0F5B] text-[#FFFFFF]'
                          : 'text-[#D1D5DB] hover:text-[#FFFFFF] hover:bg-[#09090B]'
                      }`}
                    >
                      {trap.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowSqlDiff((prev) => !prev)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-[#27272A] bg-[#141417] hover:border-[#5BC2F4] text-[13px] font-semibold text-[#D1D5DB] hover:text-[#FFFFFF] transition-colors duration-150"
                >
                  <Code2 className="w-4 h-4 text-[#5BC2F4]" />
                  <span>{showSqlDiff ? 'Hide SQL Diff' : 'Compare Underlying SQL'}</span>
                  {showSqlDiff ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onLaunchQuestion(currentTrap.prompt)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-[#5BC2F4] bg-[#09090B] hover:bg-[#5BC2F4] text-[#5BC2F4] hover:text-[#09090B] text-[13px] font-bold transition-colors duration-150"
                >
                  <span>Test Live in Workspace</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Active Question Strip */}
            <div className="rounded-lg bg-[#141417] border border-[#27272A] px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 text-[14px]">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[#9CA3AF] font-medium">Question asked:</span>
                <span className="font-semibold text-[#FFFFFF]">
                  &ldquo;{currentTrap.prompt}&rdquo;
                </span>
              </div>
              <span className="text-[13px] text-[#9CA3AF] font-medium">
                {currentTrap.metricContext}
              </span>
            </div>

            {/* HIGH-IMPACT SIDE-BY-SIDE OUTCOME CARDS (Big X Misleading vs Big Check Verified) */}
            <div
              key={currentTrap.id}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-stage-fade"
            >
              {/* LEFT CARD: MISLEADING (#FF0F5B Bold Highlight + Large X Emblem) */}
              <div className="rounded-xl bg-[#141417] border-2 border-[#FF0F5B] overflow-hidden flex flex-col justify-between">
                {/* Bold Top Status Header */}
                <div className="px-6 py-5 bg-[#FF0F5B]/15 border-b border-[#FF0F5B]/40 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span
                      className="w-12 h-12 rounded-lg bg-[#FF0F5B] text-[#FFFFFF] flex items-center justify-center shrink-0"
                      aria-hidden="true"
                    >
                      <X className="w-7 h-7 stroke-[2.8]" />
                    </span>
                    <div>
                      <div className="font-display text-[20px] sm:text-[22px] font-bold text-[#FF0F5B] leading-tight">
                        Misleading Result
                      </div>
                      <div className="text-[13.5px] font-medium text-[#D1D5DB] mt-0.5">
                        Standard AI (Unchecked SQL)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Big Business Impact Output */}
                <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="rounded-lg bg-[#09090B] border border-[#27272A] p-5 space-y-2.5">
                      <div className="text-[13px] font-medium text-[#9CA3AF]">
                        Reported to stakeholder
                      </div>
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <span className="font-display text-[36px] sm:text-[42px] font-bold text-[#9CA3AF] line-through decoration-[#FF0F5B] decoration-[3px] tabular-nums leading-none">
                          {currentTrap.wrongMetricValue}
                        </span>
                        <span className="px-3 py-1 rounded bg-[#FF0F5B] text-[#FFFFFF] text-[13px] font-bold">
                          {currentTrap.wrongImpactBadge}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="font-display text-[17px] font-bold text-[#FFFFFF]">
                        {currentTrap.wrongHeadline}
                      </h3>
                      <p className="text-[14.5px] text-[#D1D5DB] leading-relaxed">
                        {currentTrap.wrongExplanation}
                      </p>
                    </div>
                  </div>

                  {showSqlDiff && (
                    <div className="pt-4 border-t border-[#27272A] space-y-2 animate-stage-fade">
                      <div className="text-[12.5px] font-semibold text-[#FF0F5B]">
                        Unchecked SQL generated
                      </div>
                      <pre className="rounded-md bg-[#09090B] border border-[#FF0F5B]/40 p-4 font-mono text-[12px] leading-[1.65] text-[#D1D5DB] overflow-x-auto whitespace-pre-wrap">
                        <code>{currentTrap.baselineSql}</code>
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT CARD: VERIFIED (#5BC2F4 Bold Highlight + Large Check Emblem) */}
              <div className="rounded-xl bg-[#141417] border-2 border-[#5BC2F4] overflow-hidden flex flex-col justify-between">
                {/* Bold Top Status Header */}
                <div className="px-6 py-5 bg-[#5BC2F4]/15 border-b border-[#5BC2F4]/40 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span
                      className="w-12 h-12 rounded-lg bg-[#5BC2F4] text-[#09090B] flex items-center justify-center shrink-0"
                      aria-hidden="true"
                    >
                      <Check className="w-7 h-7 stroke-[2.8]" />
                    </span>
                    <div>
                      <div className="font-display text-[20px] sm:text-[22px] font-bold text-[#5BC2F4] leading-tight">
                        Verified Result
                      </div>
                      <div className="text-[13.5px] font-medium text-[#D1D5DB] mt-0.5">
                        Aegistic (Governed &amp; Audited)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Big Business Impact Output */}
                <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="rounded-lg bg-[#09090B] border border-[#27272A] p-5 space-y-2.5">
                      <div className="text-[13px] font-medium text-[#9CA3AF]">
                        Verified business output
                      </div>
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <span className="font-display text-[36px] sm:text-[42px] font-bold text-[#FFFFFF] tabular-nums leading-none">
                          {currentTrap.verifiedMetricValue}
                        </span>
                        <span className="px-3 py-1 rounded bg-[#5BC2F4] text-[#09090B] text-[13px] font-bold">
                          {currentTrap.verifiedBadge}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="font-display text-[17px] font-bold text-[#FFFFFF]">
                        {currentTrap.verifiedHeadline}
                      </h3>
                      <p className="text-[14.5px] text-[#D1D5DB] leading-relaxed">
                        {currentTrap.verifiedExplanation}
                      </p>
                    </div>
                  </div>

                  {showSqlDiff && (
                    <div className="pt-4 border-t border-[#27272A] space-y-2 animate-stage-fade">
                      <div className="text-[12.5px] font-semibold text-[#5BC2F4]">
                        Governed SQL compiled by Aegistic
                      </div>
                      <pre className="rounded-md bg-[#09090B] border border-[#5BC2F4]/40 p-4 font-mono text-[12px] leading-[1.65] text-[#F9FAFB] overflow-x-auto whitespace-pre-wrap">
                        <code>{currentTrap.aegisticSql}</code>
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BAND 3: SCROLL-KINETIC APPROVED METRICS STRIP
          ===================================================================== */}
      <section
        ref={marqueeRef}
        className="bg-[#F7F8FA] border-b border-[#E5E7EB] py-16 lg:py-20 overflow-hidden"
        aria-label="Approved Business Metrics"
      >
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h2 className="font-display text-[28px] sm:text-[34px] font-bold tracking-[-0.03em] text-[#09090B]">
              Ready-to-explore company metrics. Click any card to try live.
            </h2>
            <p className="text-[15px] text-[#4B5563]">
              Pre-approved by Finance and Operations so teams get answers immediately
              without waiting in the data request queue.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/app?view=metrics')}
            className="text-[14px] font-semibold text-[#FF0F5B] hover:text-[#DC0A4D] inline-flex items-center gap-1.5 transition-colors duration-150"
          >
            <span>Browse Metric Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Two Opposing Scroll-Linked Kinetic Rows */}
        <div className="space-y-4 px-5 sm:px-8">
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[1320px] mx-auto transition-transform duration-150 ease-swiss"
            style={{ transform: `translate3d(${marqueeShift * 0.35}px, 0, 0)` }}
          >
            {METRIC_STRIP_ROW_1.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onLaunchQuestion(item.prompt)}
                className="group text-left rounded-lg border border-[#BDC4D0] bg-[#FFFFFF] hover:border-[#09090B] p-4 space-y-2 transition-colors duration-150 focus:outline-none focus-visible:border-[#FF0F5B]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#67689E]">
                    {item.key}
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-[#4B5563] group-hover:text-[#FF0F5B] transition-colors duration-150" />
                </div>
                <div className="font-display text-[17px] font-bold text-[#09090B]">
                  {item.label}
                </div>
                <div className="text-[13px] text-[#4B5563] flex items-start gap-1.5 leading-snug">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5BC2F4] shrink-0 mt-0.5" />
                  <span>{item.summary}</span>
                </div>
              </button>
            ))}
          </div>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[1320px] mx-auto transition-transform duration-150 ease-swiss"
            style={{ transform: `translate3d(${-marqueeShift * 0.35}px, 0, 0)` }}
          >
            {METRIC_STRIP_ROW_2.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onLaunchQuestion(item.prompt)}
                className="group text-left rounded-lg border border-[#BDC4D0] bg-[#FFFFFF] hover:border-[#09090B] p-4 space-y-2 transition-colors duration-150 focus:outline-none focus-visible:border-[#FF0F5B]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#67689E]">
                    {item.key}
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-[#4B5563] group-hover:text-[#FF0F5B] transition-colors duration-150" />
                </div>
                <div className="font-display text-[17px] font-bold text-[#09090B]">
                  {item.label}
                </div>
                <div className="text-[13px] text-[#4B5563] flex items-start gap-1.5 leading-snug">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5BC2F4] shrink-0 mt-0.5" />
                  <span>{item.summary}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
