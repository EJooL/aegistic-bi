import React from 'react';
import { ArrowRight } from 'lucide-react';
import { AegisticLogo } from './AegisticLogo';
import { HeroGuardrailStage } from './HeroGuardrailStage';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

const HALLUCINATION_PILLARS = [
  {
    index: '01',
    accent: '#FF0F5B',
    title: 'Semantic Layer',
    description:
      'Metrics locked as versioned YAML code with mandatory filters and safe join paths—never improvised or guessed by an LLM.',
  },
  {
    index: '02',
    accent: '#5BC2F4',
    title: 'SQL AST Guardrails',
    description:
      'sqlglot verifies every compiled query AST, blocking destructive DDL/DML, enforcing Gold-layer tables only, and capping row limits.',
  },
  {
    index: '03',
    accent: '#67689E',
    title: 'Transparent Audit Trail',
    description:
      'Every visualization ships with its exact business formula, compiled SQL, post-query sanity checks, and explicit domain caveats.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#09090B] flex flex-col">
      {/* Minimalist Swiss Top Navbar */}
      <header className="w-full bg-[#FFFFFF] border-b border-[#E5E7EB]">
        <div className="max-w-[1280px] mx-auto px-8 h-[72px] flex items-center justify-between gap-6">
          <AegisticLogo onClick={() => onNavigate('/')} />

          <nav className="flex items-center gap-7" aria-label="Landing Navigation">
            <button
              type="button"
              onClick={() => onNavigate('/app?view=metrics')}
              className="text-[14px] font-medium text-[#4B5563] hover:text-[#09090B] transition-colors"
            >
              Metric Catalog
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/app?view=benchmark')}
              className="text-[14px] font-medium text-[#4B5563] hover:text-[#09090B] transition-colors"
            >
              Benchmark
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#FF0F5B] hover:bg-[#DC0A4D] active:bg-[#BE0842] text-[#FFFFFF] text-[13.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF0F5B] focus:ring-offset-2"
            >
              Launch Workspace
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Asymmetric 2-Column Hero Section */}
        <section className="max-w-[1280px] mx-auto px-8 pt-14 pb-20 lg:pt-18 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
            {/* Left Column (7 cols) */}
            <div className="lg:col-span-7 space-y-7">
              <div className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4B5563]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF0F5B]" aria-hidden="true" />
                <span>Verified Self-Service Analytics</span>
              </div>

              <h1 className="font-display text-[48px] sm:text-[58px] xl:text-[64px] font-bold leading-[1.03] tracking-[-0.035em] text-[#09090B]">
                Ask your data anything.{' '}
                <span className="text-[#FF0F5B]">Audit every number.</span>
              </h1>

              <p className="text-[16.5px] leading-[1.65] text-[#4B5563] max-w-[560px]">
                Aegistic is a Verified Self-Service BI platform powered by a governed
                Semantic Layer and deterministic SQL AST Guardrails. Eliminate LLM metric
                hallucinations with auditable, read-only execution over your Gold data
                warehouse.
              </p>

              {/* Action Row */}
              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('/app')}
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded bg-[#FF0F5B] hover:bg-[#DC0A4D] active:bg-[#BE0842] text-[#FFFFFF] text-[14.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF0F5B] focus:ring-offset-2"
                >
                  <span>Launch Workspace →</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/app?view=benchmark')}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded border border-[#09090B] bg-[#FFFFFF] hover:bg-[#F7F8FA] text-[#09090B] text-[14.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF0F5B] focus:ring-offset-2"
                >
                  Inspect Benchmark
                </button>
              </div>

              {/* Bottom 3-Column Swiss Stat Strip */}
              <div className="pt-8 mt-4 border-t border-[#BDC4D0] grid grid-cols-3 gap-6 max-w-[580px]">
                <div>
                  <div className="kpi-number text-[32px] font-bold text-[#09090B] leading-none">
                    7
                  </div>
                  <div className="text-[12.5px] font-medium text-[#4B5563] mt-2">
                    Governed Metrics
                  </div>
                </div>
                <div className="border-l border-[#E5E7EB] pl-6">
                  <div className="kpi-number text-[32px] font-bold text-[#09090B] leading-none">
                    5-Gate
                  </div>
                  <div className="text-[12.5px] font-medium text-[#4B5563] mt-2">
                    SQL AST Guardrails
                  </div>
                </div>
                <div className="border-l border-[#E5E7EB] pl-6">
                  <div className="kpi-number text-[32px] font-bold text-[#09090B] leading-none">
                    100%
                  </div>
                  <div className="text-[12.5px] font-medium text-[#4B5563] mt-2">
                    Read-Only &amp; Auditable
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (5 cols): Interactive 3-Scenario Guardrail Stage */}
            <div className="lg:col-span-5">
              <HeroGuardrailStage />
            </div>
          </div>
        </section>

        {/* Below the Fold: "How Aegistic Prevents Hallucinations" 3-Column Strip */}
        <section className="max-w-[1280px] mx-auto px-8 pb-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#4B5563]">
                Architecture Guarantee
              </div>
              <h2 className="font-display text-[26px] font-bold text-[#09090B] mt-1">
                How Aegistic Prevents Hallucinations
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/app?view=metrics')}
              className="text-[13.5px] font-semibold text-[#FF0F5B] hover:text-[#DC0A4D] inline-flex items-center gap-1.5"
            >
              <span>Browse Official Metric Contracts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HALLUCINATION_PILLARS.map((pillar) => (
              <div
                key={pillar.index}
                className="border-t border-[#BDC4D0] pt-5 flex flex-col gap-2.5"
              >
                <div className="flex items-center gap-2 text-[13px] font-semibold">
                  <span style={{ color: pillar.accent }} className="tabular-nums">
                    {pillar.index}
                  </span>
                  <span className="text-[#BDC4D0]">/</span>
                  <span className="text-[#09090B] font-display text-[17px] font-bold tracking-[-0.015em]">
                    {pillar.title}
                  </span>
                </div>
                <p className="text-[14px] leading-[1.6] text-[#4B5563]">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-[#E5E7EB] bg-[#FFFFFF]">
        <div className="max-w-[1280px] mx-auto px-8 py-5 flex flex-wrap items-center justify-between gap-4 text-[12.5px] text-[#4B5563]">
          <span>Aegistic — Governed Self-Service BI Engine</span>
          <span className="text-[12px] font-medium">
            DuckDB Gold · YAML Semantic Layer · sqlglot AST Guardrails
          </span>
        </div>
      </footer>
    </div>
  );
};
