import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';

interface ScenarioTab {
  id: 'verified' | 'trap' | 'blocked';
  index: string;
  label: string;
}

const SCENARIOS: ScenarioTab[] = [
  { id: 'verified', index: '01', label: 'Verified Query' },
  { id: 'trap', index: '02', label: 'Trap Caught' },
  { id: 'blocked', index: '03', label: 'SQL Blocked' },
];

const VERIFIED_BARS = [
  { label: 'Electronics', value: 'Rp 4,5 M', widthPct: 100 },
  { label: 'Fashion', value: 'Rp 3,2 M', widthPct: 71 },
  { label: 'Home & Living', value: 'Rp 2,6 M', widthPct: 58 },
  { label: 'Beauty', value: 'Rp 1,9 M', widthPct: 42 },
];

const CYCLE_MS = 5500;

const FlowRule: React.FC = () => (
  <div className="flex justify-center py-1" aria-hidden="true">
    <svg width="16" height="22" viewBox="0 0 16 22" fill="none">
      <line
        x1="8"
        y1="0"
        x2="8"
        y2="16"
        stroke="#BDC4D0"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        className="animate-dash-flow"
      />
      <path
        d="M4.5 13.5L8 17.5L11.5 13.5"
        stroke="#9CA3AF"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  </div>
);

export const HeroGuardrailStage: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isManualLocked, setIsManualLocked] = useState(false);
  const [barsExpanded, setBarsExpanded] = useState(false);

  // Auto-cycle every 5.5s, pausing cleanly on hover or manual click
  useEffect(() => {
    if (isHovered || isManualLocked) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % SCENARIOS.length);
    }, CYCLE_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isHovered, isManualLocked]);

  // Smoothly expand horizontal bars when Scenario 01 enters
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

  const handleSelectTab = (idx: number) => {
    setActiveIndex(idx);
    setIsManualLocked(true);
  };

  const activeScenario = SCENARIOS[activeIndex];

  return (
    <div
      className="w-full max-w-[540px] mx-auto lg:ml-auto rounded-lg border border-[#BDC4D0] overflow-hidden dot-grid-canvas"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="Interactive Aegistic Guardrail Stage"
    >
      {/* 3-Tab Interactive Switcher */}
      <div
        className="grid grid-cols-3 bg-[#FFFFFF] border-b border-[#E5E7EB]"
        role="tablist"
        aria-label="Guardrail Scenarios"
      >
        {SCENARIOS.map((tab, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`hero-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`hero-panel-${tab.id}`}
              onClick={() => handleSelectTab(idx)}
              className={`relative px-2.5 sm:px-3.5 py-2.5 sm:py-3.5 text-left transition-colors duration-150 focus:outline-none focus-visible:underline ${
                idx > 0 ? 'border-l border-[#E5E7EB]' : ''
              } ${
                isActive
                  ? 'bg-[#FFFFFF] text-[#09090B]'
                  : 'bg-[#F7F8FA] text-[#4B5563] hover:text-[#09090B] hover:bg-[#FFFFFF]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 text-[12.5px] sm:text-[13px] font-semibold leading-tight">
                <span
                  className={`tabular-nums shrink-0 ${
                    isActive ? 'text-[#FF0F5B]' : 'text-[#4B5563]'
                  }`}
                >
                  {tab.index}
                </span>
                <span className="whitespace-nowrap">{tab.label}</span>
              </div>

              {isActive && (
                <span
                  key={`${tab.id}-${isManualLocked ? 'locked' : 'auto'}`}
                  className={`absolute left-0 right-0 bottom-0 h-[2px] bg-[#FF0F5B] ${
                    isManualLocked ? 'w-full' : 'animate-tab-progress'
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

      {/* Stage Body */}
      <div
        role="tabpanel"
        id={`hero-panel-${activeScenario.id}`}
        aria-labelledby={`hero-tab-${activeScenario.id}`}
        className="p-5 sm:p-6 min-h-[388px] flex flex-col justify-center"
      >
        {/* SCENARIO 01: VERIFIED QUERY */}
        {activeScenario.id === 'verified' && (
          <div key="verified" className="animate-stage-fade">
            {/* Prompt Surface */}
            <div className="rounded-md border border-[#BDC4D0] bg-[#FFFFFF] px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-[#4B5563]">
                  Natural-language prompt
                </div>
                <div className="text-[14px] font-semibold text-[#09090B] truncate mt-0.5">
                  &ldquo;Net Revenue by category, last 6 months&rdquo;
                </div>
              </div>
              <span
                className="w-2 h-2 rounded-full bg-[#5BC2F4] shrink-0"
                aria-hidden="true"
              />
            </div>

            <FlowRule />

            {/* Dark Obsidian Governance Strip */}
            <div className="rounded-md bg-[#09090B] text-[#FFFFFF] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[13px] font-medium">
                <span
                  className="w-2 h-2 rounded-full bg-[#5BC2F4] shrink-0"
                  aria-hidden="true"
                />
                <span className="text-[#FFFFFF] font-semibold">net_revenue</span>
                <span className="text-[#4B5563]" aria-hidden="true">
                  ·
                </span>
                <span className="text-[#D1D5DB]">5/5 AST gates passed</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#5BC2F4]">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Verified
              </span>
            </div>

            <FlowRule />

            {/* White Verified Output Surface */}
            <div className="rounded-md border border-[#BDC4D0] bg-[#FFFFFF] p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#E5E7EB]">
                <span className="text-[13.5px] font-bold text-[#09090B]">
                  Verified output
                </span>
                <span className="text-[13px] font-semibold text-[#09090B] tabular-nums">
                  11.9 ms
                </span>
              </div>

              <div className="space-y-3">
                {VERIFIED_BARS.map((bar, idx) => (
                  <div
                    key={bar.label}
                    className="grid grid-cols-[100px_1fr_64px] items-center gap-3"
                  >
                    <span className="text-[13px] font-medium text-[#4B5563] truncate">
                      {bar.label}
                    </span>
                    <div className="h-3.5 w-full bg-[#F7F8FA] rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-[#5BC2F4] transition-[width] duration-500 ease-swiss"
                        style={{
                          width: barsExpanded ? `${bar.widthPct}%` : '0%',
                          transitionDelay: `${idx * 55}ms`,
                        }}
                      />
                    </div>
                    <span className="text-[13px] font-semibold text-[#09090B] text-right tabular-nums">
                      {bar.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO 02: TRAP CAUGHT */}
        {activeScenario.id === 'trap' && (
          <div key="trap" className="animate-stage-fade">
            {/* Prompt Surface */}
            <div className="rounded-md border border-[#BDC4D0] bg-[#FFFFFF] px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-[#4B5563]">
                  Definition trap prompt
                </div>
                <div className="text-[14px] font-semibold text-[#09090B] truncate mt-0.5">
                  &ldquo;Total revenue including all orders?&rdquo;
                </div>
              </div>
              <span
                className="w-2 h-2 rounded-full bg-[#67689E] shrink-0"
                aria-hidden="true"
              />
            </div>

            <FlowRule />

            {/* Visual Diff Surface */}
            <div className="rounded-md overflow-hidden border border-[#BDC4D0]">
              {/* Hallucinated Raw SQL Guess (Struck Through) */}
              <div className="bg-[#FFFFFF] px-4 py-3.5 border-b border-[#E5E7EB] space-y-2">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-semibold text-[#4B5563]">
                    Raw SQL guess
                  </span>
                  <span className="font-semibold text-[#FF0F5B]">Rejected</span>
                </div>
                <pre className="font-mono text-[12.5px] leading-relaxed text-[#4B5563] line-through decoration-[#FF0F5B] decoration-2 overflow-x-auto whitespace-pre-wrap">
                  <code>SUM(total_amount) -- includes refunded &amp; cancelled</code>
                </pre>
              </div>

              {/* Governed YAML Override in Deep Obsidian */}
              <div className="bg-[#09090B] text-[#FFFFFF] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#5BC2F4]">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    Governed YAML contract enforced
                  </span>
                  <span className="text-[13px] font-medium text-[#9CA3AF]">
                    commerce.yaml
                  </span>
                </div>

                <pre className="sql-code-block-dark rounded px-3.5 py-2.5 overflow-x-auto whitespace-pre-wrap">
                  <code>
                    <span className="text-[#F9FAFB]">SUM(gross - discount) </span>
                    <span className="text-[#5BC2F4] font-semibold">
                      WHERE status = &apos;completed&apos;
                    </span>
                  </code>
                </pre>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#27272A] text-[13px] text-[#9CA3AF]">
                  <span>Cancelled &amp; refunded excluded</span>
                  <span className="text-[#5BC2F4] font-semibold tabular-nums">
                    0% drift
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO 03: SQL BLOCKED */}
        {activeScenario.id === 'blocked' && (
          <div key="blocked" className="animate-stage-fade">
            {/* Prompt Surface */}
            <div className="rounded-md border border-[#BDC4D0] bg-[#FFFFFF] px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-[#4B5563]">
                  Adversarial input
                </div>
                <div className="text-[14px] font-semibold text-[#09090B] truncate mt-0.5">
                  DROP TABLE gold.fact_orders
                </div>
              </div>
              <span
                className="w-2 h-2 rounded-full bg-[#FF0F5B] shrink-0"
                aria-hidden="true"
              />
            </div>

            <FlowRule />

            {/* Dark Obsidian Firewall Interception Panel */}
            <div className="rounded-md bg-[#09090B] text-[#FFFFFF] p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FF0F5B] text-[#FFFFFF] text-[13px] font-semibold">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  Blocked at Gate 3
                </span>
                <span className="text-[13px] font-medium text-[#D1D5DB] tabular-nums">
                  0 rows touched
                </span>
              </div>

              <pre className="sql-code-block-dark rounded px-3.5 py-3 overflow-x-auto whitespace-pre-wrap">
                <code>
                  <span className="px-1.5 py-0.5 rounded bg-[#FF0F5B] text-[#FFFFFF] font-semibold">
                    DROP TABLE
                  </span>
                  <span className="text-[#D1D5DB]"> gold.fact_orders</span>
                </code>
              </pre>

              <p className="text-[13.5px] text-[#D1D5DB] leading-relaxed">
                Non-SELECT DDL statement intercepted by sqlglot AST verification
                before reaching the read-only DuckDB Gold warehouse.
              </p>

              <div className="pt-2.5 border-t border-[#27272A] flex items-center justify-between gap-2 text-[13px] text-[#9CA3AF] tabular-nums">
                <span>Read-only AST policy enforced</span>
                <span className="text-[#FFFFFF] font-semibold">0.4 ms</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
