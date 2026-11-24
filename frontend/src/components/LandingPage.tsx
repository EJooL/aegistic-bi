import React from 'react';
import { ArrowRight } from 'lucide-react';
import { AegisticLogo } from './AegisticLogo';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

const HALLUCINATION_PILLARS = [
  {
    index: '01',
    accent: '#67689E',
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
    accent: '#FF0F5B',
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
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#67689E] hover:bg-[#545588] text-[#FFFFFF] text-[13.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#67689E] focus:ring-offset-2"
            >
              Launch Workspace
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Asymmetric 2-Column Hero Section */}
        <section className="max-w-[1280px] mx-auto px-8 pt-16 pb-20 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
            {/* Left Column (7 cols) */}
            <div className="lg:col-span-7 space-y-8">
              <div className="inline-flex items-center gap-2.5 text-[12px] font-mono font-medium uppercase tracking-[0.1em] text-[#4B5563]">
                <span className="w-2 h-2 bg-[#FF0F5B]" aria-hidden="true" />
                <span>Verified Self-Service Analytics</span>
              </div>

              <h1 className="font-display text-[48px] sm:text-[58px] xl:text-[64px] font-bold leading-[1.03] tracking-[-0.035em] text-[#09090B]">
                Ask your data anything.{' '}
                <span className="text-[#67689E]">Audit every number.</span>
              </h1>

              <p className="text-[17px] leading-[1.65] text-[#4B5563] max-w-[560px]">
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
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded bg-[#67689E] hover:bg-[#545588] text-[#FFFFFF] text-[14.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#67689E] focus:ring-offset-2"
                >
                  <span>Launch Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/app?view=benchmark')}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded border border-[#09090B] bg-[#FFFFFF] hover:bg-[#F7F8FA] text-[#09090B] text-[14.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#67689E] focus:ring-offset-2"
                >
                  Inspect Benchmark
                </button>
              </div>

              {/* Bottom 3-Column Swiss Stat Strip (Zero card boxes, crisp hairline rules) */}
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

            {/* Right Column (5 cols): Flat Bauhaus / Swiss Geometric SVG Composition */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="w-full max-w-[440px]">
                <svg
                  viewBox="0 0 400 400"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  role="img"
                  aria-label="Swiss geometric composition representing structured data governance"
                  className="w-full h-auto block"
                >
                  {/* Structural Architectural Grid Lines */}
                  <rect
                    x="0.5"
                    y="0.5"
                    width="399"
                    height="399"
                    stroke="#E5E7EB"
                    strokeWidth="1"
                  />
                  <line x1="200" y1="0" x2="200" y2="400" stroke="#E5E7EB" strokeWidth="1" />
                  <line x1="0" y1="200" x2="400" y2="200" stroke="#E5E7EB" strokeWidth="1" />
                  <line x1="100" y1="0" x2="100" y2="400" stroke="#E5E7EB" strokeWidth="1" />
                  <line x1="300" y1="0" x2="300" y2="400" stroke="#E5E7EB" strokeWidth="1" />
                  <line x1="0" y1="100" x2="400" y2="100" stroke="#E5E7EB" strokeWidth="1" />
                  <line x1="0" y1="300" x2="400" y2="300" stroke="#E5E7EB" strokeWidth="1" />

                  {/* Top-Left: #FF0F5B Rounded Half-Pill (Guardrail Gate) */}
                  <path
                    d="M24 24H126C165.765 24 198 56.2355 198 96C198 135.765 165.765 168 126 168H24V24Z"
                    fill="#FF0F5B"
                  />

                  {/* Top-Right: #BDC4D0 Outlined Structural Square + Inner Crosshair */}
                  <rect
                    x="224"
                    y="24"
                    width="152"
                    height="152"
                    stroke="#BDC4D0"
                    strokeWidth="2"
                    fill="#FFFFFF"
                  />
                  <rect
                    x="252"
                    y="52"
                    width="96"
                    height="96"
                    stroke="#BDC4D0"
                    strokeWidth="1.5"
                    fill="#F7F8FA"
                  />
                  <rect x="288" y="88" width="24" height="24" fill="#67689E" />

                  {/* Bottom-Left: #67689E Rotated Diamond (Semantic Contract) */}
                  <polygon points="100,214 186,300 100,386 14,300" fill="#67689E" />
                  <polygon
                    points="100,256 144,300 100,344 56,300"
                    fill="#FFFFFF"
                  />
                  <circle cx="100" cy="300" r="12" fill="#FF0F5B" />

                  {/* Bottom-Right: #5BC2F4 Large Semicircle (Verified Data Viz) */}
                  <path
                    d="M200 376C200 284.321 274.321 210 366 210H376V376H200Z"
                    fill="#5BC2F4"
                  />

                  {/* Precision Quarter-Circle Arc Overlay (#BDC4D0) */}
                  <path
                    d="M200 200A100 100 0 0 1 300 300"
                    stroke="#BDC4D0"
                    strokeWidth="2"
                  />
                  <path
                    d="M200 100A100 100 0 0 0 100 200"
                    stroke="#BDC4D0"
                    strokeWidth="2"
                  />

                  {/* Crisp Geometric Registration Marks */}
                  <rect x="195" y="195" width="10" height="10" fill="#09090B" />
                  <rect x="372" y="20" width="8" height="8" fill="#09090B" />
                  <rect x="20" y="372" width="8" height="8" fill="#BDC4D0" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* Below the Fold: "How Aegistic Prevents Hallucinations" 3-Column Strip */}
        <section className="max-w-[1280px] mx-auto px-8 pb-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11.5px] font-mono uppercase tracking-[0.1em] text-[#4B5563]">
                Architecture Guarantee
              </div>
              <h2 className="font-display text-[26px] font-bold text-[#09090B] mt-1">
                How Aegistic Prevents Hallucinations
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/app?view=metrics')}
              className="text-[13.5px] font-semibold text-[#67689E] hover:text-[#545588] inline-flex items-center gap-1.5"
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
                <div className="flex items-center gap-2 font-mono text-[12.5px] font-semibold">
                  <span style={{ color: pillar.accent }}>{pillar.index}</span>
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
          <span className="font-mono text-[12px]">
            DuckDB Gold · YAML Semantic Layer · sqlglot AST Guardrails
          </span>
        </div>
      </footer>
    </div>
  );
};
