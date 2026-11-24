import React, { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, CheckCircle2 } from 'lucide-react';

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
  { label: 'Home', value: 'Rp 2,6 M', widthPct: 58 },
  { label: 'Beauty', value: 'Rp 1,9 M', widthPct: 42 },
];

const CYCLE_MS = 5500;

const DashedFlowConnector: React.FC = () => (
  <div className="flex justify-center py-0.5" aria-hidden="true">
    <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
      <line
        x1="8"
        y1="0"
        x2="8"
        y2="18"
        stroke="#9CA3AF"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        className="animate-dash-flow"
      />
      <path
        d="M4.5 15.5L8 19.5L11.5 15.5"
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

  // Auto-cycle every 5500ms unless hovered or manually clicked
  useEffect(() => {
    if (isHovered || isManualLocked) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % SCENARIOS.length);
    }, CYCLE_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isHovered, isManualLocked]);

  // Trigger smooth 0% -> target width animation whenever Scenario 1 activates
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
      className="w-full max-w-[490px] mx-auto lg:ml-auto rounded-lg border border-[#E5E7EB] overflow-hidden"
      style={{
        backgroundColor: '#F9FAFB',
        backgroundImage: 'radial-gradient(#D1D5DB 1px, transparent 1px)',
        backgroundSize: '16px 16px',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="Interactive Aegistic Guardrail Stage"
    >
      {/* Top 3-Scenario Segmented Control Bar */}
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
              aria-selected={isActive}
              onClick={() => handleSelectTab(idx)}
              className={`relative px-3 py-3 text-left transition-colors focus:outline-none ${
                idx > 0 ? 'border-l border-[#E5E7EB]' : ''
              } ${
                isActive
                  ? 'bg-[#FFFFFF] text-[#09090B]'
                  : 'bg-[#F7F8FA] text-[#4B5563] hover:text-[#09090B]'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[11.5px] font-semibold truncate">
                <span
                  className={`tabular-nums ${
                    isActive ? 'text-[#FF0F5B]' : 'text-[#4B5563]'
                  }`}
                >
                  {tab.index}
                </span>
                <span className="truncate">{tab.label}</span>
              </div>

              {/* Animated #FF0F5B Progress Underline */}
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

      {/* Stage Canvas */}
      <div className="p-5 min-h-[346px] flex flex-col justify-center">
        {/* SCENARIO 01: VERIFIED QUERY */}
        {activeScenario.id === 'verified' && (
          <div key="verified" className="animate-stage-fade">
            {/* Prompt Bar */}
            <div className="rounded border border-[#BDC4D0] bg-[#FFFFFF] px-3.5 py-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#4B5563]">
                  Natural-Language Prompt
                </div>
                <div className="text-[13px] font-semibold text-[#09090B] truncate mt-0.5">
                  &ldquo;Net Revenue by category, last 6 months&rdquo;
                </div>
              </div>
              <span
                className="w-2 h-2 rounded-full bg-[#5BC2F4] shrink-0"
                aria-hidden="true"
              />
            </div>

            <DashedFlowConnector />

            {/* Dark Obsidian Governance Strip */}
            <div className="rounded bg-[#09090B] text-[#FFFFFF] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12px] font-medium">
                <span
                  className="w-2 h-2 rounded-full bg-[#5BC2F4] shrink-0"
                  aria-hidden="true"
                />
                <span className="text-[#FFFFFF]">metric: net_revenue</span>
                <span className="text-[#4B5563]">·</span>
                <span className="text-[#D1D5DB]">AST: Read-Only Pass</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5BC2F4]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified
              </span>
            </div>

            <DashedFlowConnector />

            {/* Pure White Output Card */}
            <div className="rounded border border-[#BDC4D0] bg-[#FFFFFF] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-bold text-[#09090B]">
                  Verified Output
                </span>
                <span className="px-2 py-0.5 rounded bg-[#F7F8FA] border border-[#E5E7EB] text-[11px] font-semibold text-[#09090B] tabular-nums">
                  11.9 ms
                </span>
              </div>

              <div className="space-y-2.5">
                {VERIFIED_BARS.map((bar) => (
                  <div
                    key={bar.label}
                    className="grid grid-cols-[74px_1fr_54px] items-center gap-2.5"
                  >
                    <span className="text-[12px] font-medium text-[#4B5563] truncate">
                      {bar.label}
                    </span>
                    <div className="h-3.5 w-full bg-[#F7F8FA] rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-[#5BC2F4] transition-all duration-500 ease-out"
                        style={{ width: barsExpanded ? `${bar.widthPct}%` : '0%' }}
                      />
                    </div>
                    <span className="text-[11.5px] font-semibold text-[#09090B] text-right tabular-nums">
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
            {/* Prompt Bar */}
            <div className="rounded border border-[#BDC4D0] bg-[#FFFFFF] px-3.5 py-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#4B5563]">
                  Definition Trap Prompt
                </div>
                <div className="text-[13px] font-semibold text-[#09090B] truncate mt-0.5">
                  &ldquo;Total revenue including all orders?&rdquo;
                </div>
              </div>
              <span
                className="w-2 h-2 rounded-full bg-[#67689E] shrink-0"
                aria-hidden="true"
              />
            </div>

            <DashedFlowConnector />

            {/* Visual Diff Panel */}
            <div className="space-y-3">
              {/* Faded Strikethrough Raw LLM Guess */}
              <div className="rounded border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#4B5563]">
                  <span>Raw LLM Guess</span>
                  <span className="text-[#FF0F5B]">Rejected</span>
                </div>
                <div className="text-[12.5px] font-medium text-[#4B5563] opacity-75 line-through decoration-[#FF0F5B] decoration-2">
                  SUM(total_amount) — includes refunded
                </div>
              </div>

              {/* Active Dark Obsidian Governed Override Card */}
              <div className="rounded bg-[#09090B] text-[#FFFFFF] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18181B] border border-[#27272A] text-[11px] font-semibold text-[#5BC2F4]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Semantic Contract Enforced
                  </span>
                  <span className="text-[11px] font-medium text-[#9CA3AF]">
                    commerce.yaml
                  </span>
                </div>

                <pre className="font-mono text-[12px] leading-relaxed text-[#FFFFFF] bg-[#18181B] border border-[#27272A] rounded px-3 py-2.5 overflow-x-auto whitespace-pre-wrap">
                  <code>
                    SUM(gross - discount) WHERE status = &apos;completed&apos;
                  </code>
                </pre>

                <div className="flex items-center justify-between text-[11.5px] text-[#9CA3AF] pt-1 border-t border-[#27272A]">
                  <span>Cancelled &amp; refunded orders excluded</span>
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
            {/* Prompt Bar */}
            <div className="rounded border border-[#BDC4D0] bg-[#FFFFFF] px-3.5 py-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#4B5563]">
                  Adversarial Input
                </div>
                <div className="text-[13px] font-semibold text-[#09090B] truncate mt-0.5">
                  DROP TABLE gold.fact_orders
                </div>
              </div>
              <span
                className="w-2 h-2 rounded-full bg-[#FF0F5B] shrink-0"
                aria-hidden="true"
              />
            </div>

            <DashedFlowConnector />

            {/* Dark Obsidian Firewall Interception Panel */}
            <div className="rounded bg-[#09090B] text-[#FFFFFF] p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FF0F5B] text-[#FFFFFF] text-[11.5px] font-bold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Blocked at Gate 3 · sqlglot AST
                </span>
                <span className="text-[11px] font-medium text-[#9CA3AF]">
                  DDL Violation
                </span>
              </div>

              <pre className="font-mono text-[12.5px] leading-relaxed bg-[#18181B] border border-[#27272A] rounded px-3.5 py-3 overflow-x-auto whitespace-pre-wrap">
                <code>
                  <span className="px-1.5 py-0.5 rounded bg-[#FF0F5B] text-[#FFFFFF] font-semibold">
                    DROP TABLE
                  </span>
                  <span className="text-[#D1D5DB]"> gold.fact_orders</span>
                </code>
              </pre>

              <p className="text-[12.5px] text-[#D1D5DB] leading-relaxed">
                Non-SELECT statement rejected at AST verification before reaching
                the read-only DuckDB Gold connection.
              </p>

              <div className="pt-2.5 border-t border-[#27272A] flex items-center justify-between text-[11.5px] text-[#9CA3AF] tabular-nums">
                <span>0 rows accessed · Read-only enforced</span>
                <span className="text-[#FFFFFF] font-semibold">0.4 ms</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
