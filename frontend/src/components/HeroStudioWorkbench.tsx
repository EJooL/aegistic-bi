import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Database,
  Layers,
  Lock,
  ArrowUpRight,
  Table2,
  Sliders,
} from 'lucide-react';

interface HeroStudioWorkbenchProps {
  scrollY: number;
  onLaunchQuestion: (question: string) => void;
  onNavigate: (path: string) => void;
}

type ScenarioId = 'verified' | 'trap' | 'blocked';
type LeftTab = 'metrics' | 'tables' | 'gates';

interface ScenarioConfig {
  id: ScenarioId;
  index: string;
  label: string;
  mobileLabel: string;
  prompt: string;
  latencyMs: string;
  rowCount: string;
  dataAccess: string;
  safeguard: string;
  accuracyPolicy: string;
  astStatus: 'verified' | 'blocked';
  checks: { label: string; passed: boolean }[];
}

const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'verified',
    index: '01',
    label: 'Verified Answer',
    mobileLabel: 'Verified Answer',
    prompt: 'Bandingkan Net Revenue per kategori produk 6 bulan terakhir',
    latencyMs: '11.9 ms',
    rowCount: '6 categories',
    dataAccess: 'Approved data only',
    safeguard: 'Read-only mode',
    accuracyPolicy: 'No double-counting',
    astStatus: 'verified',
    checks: [
      { label: 'Read-only access', passed: true },
      { label: 'Approved business data', passed: true },
      { label: 'No double-counting', passed: true },
      { label: 'Safe query size', passed: true },
    ],
  },
  {
    id: 'trap',
    index: '02',
    label: 'Wrong Math Caught',
    mobileLabel: 'Math Caught',
    prompt: 'Berapa Net Revenue dan Refund Rate per region?',
    latencyMs: '16.4 ms',
    rowCount: '6 regions',
    dataAccess: 'Approved data only',
    safeguard: 'Read-only mode',
    accuracyPolicy: 'Finance rule locked',
    astStatus: 'verified',
    checks: [
      { label: 'Read-only access', passed: true },
      { label: 'Approved business data', passed: true },
      { label: 'No double-counting', passed: true },
      { label: 'Safe query size', passed: true },
    ],
  },
  {
    id: 'blocked',
    index: '03',
    label: 'Unsafe Query Blocked',
    mobileLabel: 'Unsafe Blocked',
    prompt: 'DROP TABLE gold.fact_orders',
    latencyMs: '0.4 ms',
    rowCount: '0 records touched',
    dataAccess: 'Request rejected',
    safeguard: 'Write blocked',
    accuracyPolicy: 'Stopped instantly',
    astStatus: 'blocked',
    checks: [
      { label: 'Read-only access', passed: false },
      { label: 'Approved business data', passed: true },
      { label: 'No double-counting', passed: true },
      { label: 'Safe query size', passed: false },
    ],
  },
];

const METRIC_TREE = [
  {
    key: 'net_revenue',
    label: 'Net Revenue',
    format: 'IDR',
    prompt: 'Tampilkan tren Net Revenue bulanan selama 12 bulan terakhir',
  },
  {
    key: 'gross_revenue',
    label: 'Gross Revenue (GMV)',
    format: 'IDR',
    prompt: 'Show GMV by customer segment',
  },
  {
    key: 'total_orders',
    label: 'Completed Orders',
    format: 'COUNT',
    prompt: 'Show monthly Completed Orders for the last 6 months',
  },
  {
    key: 'aov',
    label: 'Average Order Value',
    format: 'IDR',
    prompt: 'What is the Average Order Value (AOV) by region?',
  },
  {
    key: 'gross_margin_pct',
    label: 'Gross Margin (%)',
    format: 'PCT',
    prompt: 'Tampilkan Gross Margin (%) per kategori produk',
  },
  {
    key: 'repeat_purchase_rate',
    label: 'Repeat Purchase Rate',
    format: 'PCT',
    prompt: 'Berapa Repeat Purchase Rate per segmen pelanggan?',
  },
  {
    key: 'refund_rate',
    label: 'Refund & Cancel Rate',
    format: 'PCT',
    prompt: 'Berapa Net Revenue dan Refund Rate per region?',
  },
];

const APPROVED_DATASETS = [
  { name: 'Verified Orders', role: '50,000 deduplicated orders' },
  { name: 'Order Line Items', role: '90,000 product items' },
  { name: 'Product Catalog', role: '120 active products' },
  { name: 'Customer Directory', role: '12,000 customer profiles' },
  { name: 'Business Calendar', role: '18 months of daily history' },
];

const SAFETY_STEPS = [
  { step: 'Step 01', name: 'Intent Check' },
  { step: 'Step 02', name: 'Official Formula' },
  { step: 'Step 03', name: 'Read-Only Firewall' },
  { step: 'Step 04', name: 'Data Sanity Check' },
  { step: 'Step 05', name: 'Audit Receipt' },
];

const VERIFIED_BARS = [
  { label: 'Electronics', value: 'Rp 4,5 M', widthPct: 100 },
  { label: 'Fashion', value: 'Rp 3,2 M', widthPct: 71 },
  { label: 'Home & Living', value: 'Rp 2,6 M', widthPct: 58 },
  { label: 'Beauty', value: 'Rp 1,9 M', widthPct: 42 },
];

const CYCLE_MS = 5500;

export const HeroStudioWorkbench: React.FC<HeroStudioWorkbenchProps> = ({
  scrollY,
  onLaunchQuestion,
  onNavigate,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isManualLocked, setIsManualLocked] = useState(false);
  const [barsExpanded, setBarsExpanded] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>('metrics');
  const [popoverTab, setPopoverTab] = useState<'rule' | 'sql'>('rule');

  // Auto-cycle scenarios every 5.5s unless hovered or manually selected
  useEffect(() => {
    if (isHovered || isManualLocked) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % SCENARIOS.length);
    }, CYCLE_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isHovered, isManualLocked]);

  // Animate bars smoothly whenever Scenario 01 enters
  useEffect(() => {
    if (activeIndex !== 0) {
      setBarsExpanded(false);
      return;
    }
    setBarsExpanded(false);
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setBarsExpanded(true);
      });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activeIndex]);

  const handleSelectScenario = (idx: number) => {
    setActiveIndex(idx);
    setIsManualLocked(true);
  };

  const scenario = SCENARIOS[activeIndex];
  const passedCount = scenario.checks.filter((c) => c.passed).length;

  // Subtle GPU-accelerated scroll parallax on the floating inspector popover
  const scrollProgress = Math.min(Math.max(scrollY / 520, 0), 1);
  const popoverLiftY = Math.round(scrollProgress * -18);

  return (
    <div
      className="w-full rounded-xl border border-[#27272A] bg-[#09090B] text-[#FFFFFF] overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="Interactive Aegistic BI Studio Preview"
    >
      {/* Top Studio Toolbar */}
      <div className="bg-[#09090B] border-b border-[#27272A]">
        <div className="px-3 sm:px-4 h-12 flex items-center justify-between gap-3">
          {/* Left: Window Dots + Desktop Scenario Tabs */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5 sm:pr-3 sm:border-r sm:border-[#27272A] shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#27272A]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#27272A]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#5BC2F4]" />
            </div>
            <span className="sm:hidden text-[13px] font-bold text-[#FFFFFF]">
              Aegistic Preview
            </span>

            <div
              className="hidden sm:flex items-center gap-1"
              role="tablist"
              aria-label="Live Product Scenarios"
            >
              {SCENARIOS.map((tab, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleSelectScenario(idx)}
                    className={`relative px-3 py-1.5 rounded text-[13px] font-semibold transition-colors duration-150 whitespace-nowrap focus:outline-none focus-visible:underline ${
                      isActive
                        ? 'bg-[#141417] text-[#FFFFFF]'
                        : 'text-[#9CA3AF] hover:text-[#FFFFFF] hover:bg-[#141417]'
                    }`}
                  >
                    <span
                      className={`mr-1.5 tabular-nums ${
                        isActive ? 'text-[#FF0F5B]' : 'text-[#6B7280]'
                      }`}
                    >
                      {tab.index}
                    </span>
                    <span>{tab.label}</span>
                    {isActive && (
                      <span
                        key={`${tab.id}-${isManualLocked ? 'locked' : 'auto'}`}
                        className={`absolute left-1 right-1 bottom-0 h-[2px] bg-[#FF0F5B] ${
                          isManualLocked ? 'w-auto' : 'animate-tab-progress'
                        }`}
                        style={
                          !isManualLocked && isHovered
                            ? { animationPlayState: 'paused' }
                            : undefined
                        }
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Live Verification Status + Try Live Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#141417] border border-[#27272A] text-[12.5px] font-semibold tabular-nums text-[#D1D5DB]">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  scenario.astStatus === 'verified' ? 'bg-[#5BC2F4]' : 'bg-[#FF0F5B]'
                }`}
                aria-hidden="true"
              />
              {scenario.astStatus === 'verified'
                ? `${passedCount}/4 Checks Passed · ${scenario.latencyMs}`
                : `Blocked Safely · ${scenario.latencyMs}`}
            </span>
            <button
              type="button"
              onClick={() => onLaunchQuestion(scenario.prompt)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FF0F5B] hover:bg-[#DC0A4D] active:bg-[#BE0842] text-[#FFFFFF] text-[13px] font-semibold transition-colors duration-150"
            >
              <span>Try Live</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mobile Full-Width 3-Tab Sub-Bar */}
        <div
          className="sm:hidden grid grid-cols-3 border-t border-[#27272A] divide-x divide-[#27272A]"
          role="tablist"
          aria-label="Mobile Product Scenarios"
        >
          {SCENARIOS.map((tab, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={`mobile-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleSelectScenario(idx)}
                className={`relative px-2 py-2.5 text-left transition-colors duration-150 focus:outline-none ${
                  isActive
                    ? 'bg-[#141417] text-[#FFFFFF]'
                    : 'bg-[#09090B] text-[#9CA3AF]'
                }`}
              >
                <div className="flex flex-col gap-0.5 text-[11.5px] font-semibold leading-tight">
                  <span
                    className={`tabular-nums ${
                      isActive ? 'text-[#FF0F5B]' : 'text-[#6B7280]'
                    }`}
                  >
                    {tab.index}
                  </span>
                  <span className="whitespace-nowrap">{tab.mobileLabel}</span>
                </div>
                {isActive && (
                  <span
                    key={`m-${tab.id}-${isManualLocked ? 'locked' : 'auto'}`}
                    className={`absolute left-0 right-0 bottom-0 h-[2px] bg-[#FF0F5B] ${
                      isManualLocked ? 'w-full' : 'animate-tab-progress'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3-Pane Desktop Studio Body */}
      <div className="grid grid-cols-1 lg:grid-cols-[232px_1fr_248px] min-h-[472px]">
        {/* LEFT PANE: Approved Business Metrics & Data */}
        <div className="hidden lg:flex flex-col bg-[#09090B] border-r border-[#27272A]">
          <div className="p-2.5 border-b border-[#27272A]">
            <div className="grid grid-cols-3 rounded bg-[#141417] p-0.5 border border-[#27272A]">
              {(
                [
                  { id: 'metrics', label: 'Metrics' },
                  { id: 'tables', label: 'Data' },
                  { id: 'gates', label: 'Checks' },
                ] as { id: LeftTab; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setLeftTab(t.id)}
                  className={`py-1 rounded text-[12.5px] font-semibold transition-colors duration-150 ${
                    leftTab === t.id
                      ? 'bg-[#27272A] text-[#FFFFFF]'
                      : 'text-[#9CA3AF] hover:text-[#FFFFFF]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-3.5 py-2.5 border-b border-[#27272A] flex items-center justify-between text-[12.5px] text-[#9CA3AF]">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#D1D5DB]">
              <Layers className="w-3.5 h-3.5 text-[#5BC2F4]" />
              Approved KPIs
            </span>
            <span className="tabular-nums text-[#9CA3AF]">7 live</span>
          </div>

          <div className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {leftTab === 'metrics' &&
              METRIC_TREE.map((m) => {
                const isSelected =
                  (scenario.id === 'verified' && m.key === 'net_revenue') ||
                  (scenario.id === 'trap' &&
                    (m.key === 'net_revenue' || m.key === 'refund_rate'));
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => onLaunchQuestion(m.prompt)}
                    title={`Explore live ${m.label}`}
                    className={`w-full px-2.5 py-2 rounded flex items-center justify-between gap-2 text-left text-[13px] transition-colors duration-150 ${
                      isSelected
                        ? 'bg-[#5BC2F4] text-[#09090B] font-bold'
                        : 'text-[#D1D5DB] hover:bg-[#141417] hover:text-[#FFFFFF] font-medium'
                    }`}
                  >
                    <span className="truncate">{m.label}</span>
                    <span
                      className={`text-[11.5px] tabular-nums shrink-0 ${
                        isSelected ? 'text-[#09090B]' : 'text-[#9CA3AF]'
                      }`}
                    >
                      {m.format}
                    </span>
                  </button>
                );
              })}

            {leftTab === 'tables' &&
              APPROVED_DATASETS.map((ds) => (
                <button
                  key={ds.name}
                  type="button"
                  onClick={() => onNavigate('/app?view=metrics')}
                  className="w-full px-2.5 py-2 rounded flex flex-col gap-0.5 text-left hover:bg-[#141417] transition-colors duration-150"
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#FFFFFF]">
                    <Table2 className="w-3.5 h-3.5 text-[#5BC2F4] shrink-0" />
                    <span className="truncate">{ds.name}</span>
                  </span>
                  <span className="text-[12px] text-[#9CA3AF] pl-5 tabular-nums">
                    {ds.role}
                  </span>
                </button>
              ))}

            {leftTab === 'gates' &&
              SAFETY_STEPS.map((g, idx) => {
                const isTripped = scenario.id === 'blocked' && idx === 2;
                return (
                  <div
                    key={g.step}
                    className={`px-2.5 py-2 rounded flex items-center justify-between gap-2 text-[13px] ${
                      isTripped
                        ? 'bg-[#FF0F5B] text-[#FFFFFF] font-bold'
                        : 'text-[#D1D5DB] font-medium'
                    }`}
                  >
                    <span className="truncate">{g.name}</span>
                    <span
                      className={`text-[12px] tabular-nums shrink-0 ${
                        isTripped ? 'text-[#FFFFFF]' : 'text-[#5BC2F4]'
                      }`}
                    >
                      {isTripped ? 'Blocked' : 'Pass'}
                    </span>
                  </div>
                );
              })}
          </div>

          <div className="p-3 border-t border-[#27272A]">
            <button
              type="button"
              onClick={() => onNavigate('/app?view=metrics')}
              className="w-full py-1.5 px-2.5 rounded border border-[#27272A] bg-[#141417] hover:border-[#5BC2F4] text-[12.5px] font-semibold text-[#D1D5DB] hover:text-[#FFFFFF] flex items-center justify-between transition-colors duration-150"
            >
              <span>View All Definitions</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#5BC2F4]" />
            </button>
          </div>
        </div>

        {/* CENTER PANE: Live Analytics Canvas + Floating Official Rule Card */}
        <div className="relative dot-grid-canvas p-4 sm:p-6 flex flex-col justify-between gap-4 overflow-hidden">
          <div className="flex items-center justify-between gap-2 text-[13px]">
            <span className="inline-flex items-center gap-2 font-semibold text-[#09090B]">
              <span
                className={`w-2 h-2 rounded-full ${
                  scenario.id === 'blocked'
                    ? 'bg-[#FF0F5B]'
                    : scenario.id === 'trap'
                      ? 'bg-[#67689E]'
                      : 'bg-[#5BC2F4]'
                }`}
                aria-hidden="true"
              />
              <span>Live Business Answer</span>
            </span>
            <span className="text-[#4B5563] font-medium tabular-nums">
              {scenario.rowCount} · {scenario.latencyMs}
            </span>
          </div>

          <div className="relative flex-1 flex flex-col justify-center">
            {scenario.id === 'verified' && (
              <div key="studio-verified" className="animate-stage-fade space-y-4">
                <div className="rounded-lg border border-[#BDC4D0] bg-[#FFFFFF] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold text-[#09090B] truncate">
                        Net Revenue by Product Category (Last 6 Months)
                      </div>
                      <div className="text-[13px] text-[#4B5563] truncate">
                        &ldquo;{scenario.prompt}&rdquo;
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#09090B] shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-[#5BC2F4]" />
                      Verified
                    </span>
                  </div>

                  {/* Docked Open-Month Warning */}
                  <div className="px-4 py-2 border-b border-[#E5E7EB] bg-[#FFF5F8] flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                      <span className="animate-live-ring absolute inline-flex h-full w-full rounded-full bg-[#FF0F5B]" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF0F5B]" />
                    </span>
                    <span className="font-bold text-[#09090B]">Open Month Notice</span>
                    <span className="px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#E5E7EB] font-semibold text-[#09090B] tabular-nums">
                      2026-11 · Open Month
                    </span>
                  </div>

                  {/* Animated Horizontal Bars */}
                  <div className="p-4 sm:p-5 space-y-3.5 lg:pr-[278px]">
                    {VERIFIED_BARS.map((bar, idx) => (
                      <div
                        key={bar.label}
                        className="grid grid-cols-[90px_1fr_62px] items-center gap-2.5"
                      >
                        <span className="text-[13px] font-medium text-[#4B5563] truncate">
                          {bar.label}
                        </span>
                        <div className="h-3.5 w-full bg-[#F7F8FA] rounded-sm overflow-hidden">
                          <div
                            className="h-full bg-[#5BC2F4] transition-[width] duration-500 ease-swiss"
                            style={{
                              width: barsExpanded ? `${bar.widthPct}%` : '0%',
                              transitionDelay: `${idx * 60}ms`,
                            }}
                          />
                        </div>
                        <span className="text-[13px] font-semibold text-[#09090B] text-right tabular-nums whitespace-nowrap">
                          {bar.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating Dark Obsidian Audit Card (Business Rule + Optional SQL for Analysts) */}
                <div
                  className="lg:absolute lg:right-3 lg:bottom-1 lg:w-[252px] rounded-lg bg-[#09090B] border border-[#27272A] text-[#FFFFFF] p-4 space-y-3 transition-transform duration-150 ease-swiss"
                  style={{ transform: `translate3d(0, ${popoverLiftY}px, 0)` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-[#FFFFFF]">
                      Audit Receipt
                    </span>
                    <div className="inline-flex rounded bg-[#141417] p-0.5 border border-[#27272A]">
                      <button
                        type="button"
                        onClick={() => setPopoverTab('rule')}
                        className={`px-2 py-0.5 rounded text-[12px] font-semibold transition-colors duration-150 ${
                          popoverTab === 'rule'
                            ? 'bg-[#27272A] text-[#FFFFFF]'
                            : 'text-[#9CA3AF] hover:text-[#FFFFFF]'
                        }`}
                      >
                        Rule
                      </button>
                      <button
                        type="button"
                        onClick={() => setPopoverTab('sql')}
                        className={`px-2 py-0.5 rounded text-[12px] font-semibold transition-colors duration-150 ${
                          popoverTab === 'sql'
                            ? 'bg-[#27272A] text-[#FFFFFF]'
                            : 'text-[#9CA3AF] hover:text-[#FFFFFF]'
                        }`}
                      >
                        SQL
                      </button>
                    </div>
                  </div>

                  {/* Crisp Trend Preview Curve */}
                  <div className="rounded bg-[#141417] border border-[#27272A] px-3 py-2.5">
                    <svg
                      viewBox="0 0 220 44"
                      className="w-full h-[44px]"
                      aria-hidden="true"
                    >
                      <line
                        x1="0"
                        y1="36"
                        x2="220"
                        y2="36"
                        stroke="#27272A"
                        strokeWidth="1"
                      />
                      <path
                        d="M4 34 C 30 30, 52 10, 86 18 C 118 26, 146 8, 180 14 C 196 17, 206 12, 214 16"
                        fill="none"
                        stroke="#5BC2F4"
                        strokeWidth="2.2"
                      />
                      <circle cx="86" cy="18" r="3" fill="#09090B" stroke="#5BC2F4" strokeWidth="2" />
                      <circle cx="180" cy="14" r="3" fill="#09090B" stroke="#5BC2F4" strokeWidth="2" />
                      <circle cx="214" cy="16" r="5" fill="none" stroke="#FF0F5B" strokeWidth="1.5" strokeDasharray="2 2" />
                      <circle cx="214" cy="16" r="2.5" fill="#FF0F5B" />
                    </svg>
                  </div>

                  {popoverTab === 'rule' ? (
                    <div className="rounded bg-[#141417] border border-[#27272A] px-3 py-2.5 space-y-1.5 text-[12px] leading-snug text-[#D1D5DB]">
                      <div className="font-semibold text-[#FFFFFF]">
                        Finance-approved Net Revenue
                      </div>
                      <div>Excludes cancelled orders, refunds, and shipping fees.</div>
                    </div>
                  ) : (
                    <pre className="sql-code-block-dark rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap text-[12px]">
                      <code>{`SELECT category_name,\n  SUM(item_net_amount)\nFROM gold.fact_order_items\nLIMIT 100`}</code>
                    </pre>
                  )}

                  <div className="flex items-center justify-between text-[12.5px] text-[#9CA3AF] pt-1 border-t border-[#27272A] tabular-nums">
                    <span>Matches Finance</span>
                    <span className="text-[#5BC2F4] font-semibold">100% exact</span>
                  </div>
                </div>
              </div>
            )}

            {scenario.id === 'trap' && (
              <div key="studio-trap" className="animate-stage-fade space-y-3.5">
                <div className="rounded-lg border border-[#BDC4D0] bg-[#FFFFFF] px-4 py-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="font-semibold text-[#4B5563]">
                      Typical AI Guess
                    </span>
                    <span className="font-bold text-[#FF0F5B]">Wrong Answer</span>
                  </div>
                  <div className="text-[14px] font-semibold text-[#4B5563] line-through decoration-[#FF0F5B] decoration-2">
                    Filters all orders to &ldquo;completed&rdquo; first, silently reporting Refund Rate as 0.0%.
                  </div>
                  <p className="text-[13px] text-[#4B5563]">
                    Looks plausible on a slide, but hides millions in actual customer refunds.
                  </p>
                </div>

                <div className="rounded-lg bg-[#09090B] border border-[#27272A] text-[#FFFFFF] p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#5BC2F4]">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      Official Company Definitions Enforced
                    </span>
                    <span className="text-[13px] font-medium text-[#9CA3AF]">
                      Finance &amp; Ops
                    </span>
                  </div>

                  <p className="text-[14px] text-[#D1D5DB] leading-relaxed">
                    Aegistic automatically calculates <strong className="text-[#FFFFFF]">Net Revenue</strong> on completed orders only while measuring <strong className="text-[#FFFFFF]">Refund Rate</strong> across every order in the same table.
                  </p>

                  <pre className="sql-code-block-dark rounded px-3.5 py-2.5 overflow-x-auto whitespace-pre-wrap text-[12px]">
                    <code>
                      <span className="text-[#F9FAFB]">
                        Net Revenue  = completed orders after discount{'\n'}
                      </span>
                      <span className="text-[#5BC2F4] font-semibold">
                        Refund Rate  = (refunded + cancelled) / all orders
                      </span>
                    </code>
                  </pre>

                  <div className="flex items-center justify-between text-[13px] text-[#9CA3AF] pt-2 border-t border-[#27272A] tabular-nums">
                    <span>Zero conflicting filters or silent errors</span>
                    <span className="text-[#5BC2F4] font-semibold">20/20 traps passed</span>
                  </div>
                </div>
              </div>
            )}

            {scenario.id === 'blocked' && (
              <div key="studio-blocked" className="animate-stage-fade space-y-3.5">
                <div className="rounded-lg bg-[#09090B] border border-[#27272A] text-[#FFFFFF] p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#FF0F5B] text-[#FFFFFF] text-[13px] font-bold">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      Blocked Before Reaching Data
                    </span>
                    <span className="text-[13px] font-medium text-[#D1D5DB] tabular-nums">
                      0 records touched · 0.4 ms
                    </span>
                  </div>

                  <pre className="sql-code-block-dark rounded px-4 py-3.5 overflow-x-auto whitespace-pre-wrap">
                    <code>
                      <span className="px-1.5 py-0.5 rounded bg-[#FF0F5B] text-[#FFFFFF] font-semibold">
                        DROP TABLE
                      </span>
                      <span className="text-[#D1D5DB]"> gold.fact_orders</span>
                    </code>
                  </pre>

                  <p className="text-[14px] text-[#D1D5DB] leading-relaxed">
                    Any attempt to alter, delete, or bypass company data is stopped
                    instantly. Every self-service session runs strictly read-only.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#27272A] text-[13px]">
                    <div className="rounded bg-[#141417] border border-[#27272A] px-3 py-2">
                      <div className="text-[#9CA3AF]">Action Taken</div>
                      <div className="font-bold text-[#FF0F5B] mt-0.5">Blocked</div>
                    </div>
                    <div className="rounded bg-[#141417] border border-[#27272A] px-3 py-2">
                      <div className="text-[#9CA3AF]">Data Access</div>
                      <div className="font-bold text-[#FFFFFF] mt-0.5">Strictly Read-Only</div>
                    </div>
                    <div className="rounded bg-[#141417] border border-[#27272A] px-3 py-2">
                      <div className="text-[#9CA3AF]">Safe Refusal</div>
                      <div className="font-bold text-[#5BC2F4] mt-0.5 tabular-nums">100.0%</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Trust & Safety Summary */}
        <div className="hidden lg:flex flex-col bg-[#09090B] border-l border-[#27272A] divide-y divide-[#27272A]">
          <div className="px-4 py-3 flex items-center justify-between text-[13px]">
            <span className="inline-flex items-center gap-1.5 font-bold text-[#FFFFFF]">
              <Sliders className="w-3.5 h-3.5 text-[#5BC2F4]" />
              Trust &amp; Safety
            </span>
            <Lock className="w-3.5 h-3.5 text-[#9CA3AF]" />
          </div>

          <div className="p-4 space-y-3 text-[13px]">
            <div className="font-semibold text-[#9CA3AF]">Active Safeguards</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#9CA3AF]">Scope</span>
                <span className="px-2 py-0.5 rounded bg-[#141417] border border-[#27272A] font-semibold text-[#FFFFFF]">
                  {scenario.dataAccess}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#9CA3AF]">Mode</span>
                <span className="px-2 py-0.5 rounded bg-[#141417] border border-[#27272A] font-semibold text-[#FFFFFF]">
                  {scenario.safeguard}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#9CA3AF]">Math</span>
                <span className="px-2 py-0.5 rounded bg-[#141417] border border-[#27272A] font-semibold text-[#FFFFFF]">
                  {scenario.accuracyPolicy}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-2.5 flex-1">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-semibold text-[#9CA3AF]">Safety Checks</span>
              <span
                className={`font-bold tabular-nums ${
                  scenario.astStatus === 'verified'
                    ? 'text-[#5BC2F4]'
                    : 'text-[#FF0F5B]'
                }`}
              >
                {passedCount}/4
              </span>
            </div>
            <div className="space-y-2">
              {scenario.checks.map((check) => (
                <div
                  key={check.label}
                  className="px-2.5 py-2 rounded bg-[#141417] border border-[#27272A] flex items-center justify-between gap-2 text-[12.5px]"
                >
                  <span className="text-[#D1D5DB] truncate">{check.label}</span>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      check.passed ? 'bg-[#5BC2F4]' : 'bg-[#FF0F5B]'
                    }`}
                    aria-label={check.passed ? 'Passed' : 'Blocked'}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-3 flex items-center justify-between text-[12.5px] text-[#9CA3AF]">
            <span className="inline-flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#5BC2F4]" />
              Live Warehouse
            </span>
            <span className="font-semibold text-[#FFFFFF] tabular-nums">
              {scenario.latencyMs}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
