import React, { useEffect, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { AegisticLogo } from './AegisticLogo';
import { HeroStudioWorkbench } from './HeroStudioWorkbench';
import { ScrollPipelineShowcase } from './ScrollPipelineShowcase';

interface LandingPageProps {
  onNavigate: (path: string) => void;
  onLaunchQuestion: (question: string) => void;
}

const EDITORIAL_PILLARS = [
  {
    index: '01',
    accent: '#FF0F5B',
    title: 'One Official Definition',
    description:
      'Lock how your company calculates Revenue, Margin, and AOV once. Every department sees the exact same verified number with zero spreadsheet drift.',
  },
  {
    index: '02',
    accent: '#5BC2F4',
    title: 'Built-In Safety Guardrails',
    description:
      'Business teams explore freely while automated read-only guardrails stop broken math, uncleaned data, and unsafe commands before they ever run.',
  },
  {
    index: '03',
    accent: '#67689E',
    title: 'Click-to-Audit Transparency',
    description:
      'Never question where a presentation number came from. Every chart ships with its plain-English formula, open-month caveats, and verifiable SQL.',
  },
];

const QUICK_LAUNCH_PROMPTS: {
  label: string;
  dotColor: '#5BC2F4' | '#67689E' | '#FF0F5B';
  question: string;
}[] = [
  {
    label: '12-Month Net Revenue Trend',
    dotColor: '#5BC2F4',
    question: 'Tampilkan tren Net Revenue bulanan selama 12 bulan terakhir',
  },
  {
    label: 'Net Revenue & Refund Rate by Region',
    dotColor: '#67689E',
    question: 'Berapa Net Revenue dan Refund Rate per region?',
  },
  {
    label: 'See Safety Guardrail Block an Unsafe Request',
    dotColor: '#FF0F5B',
    question: 'DROP TABLE gold.fact_orders',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigate,
  onLaunchQuestion,
}) => {
  const [scrollY, setScrollY] = useState(0);
  const [quickPrompt, setQuickPrompt] = useState('');

  useEffect(() => {
    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        setScrollY(window.scrollY || 0);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const isScrolled = scrollY > 12;

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickPrompt.trim();
    if (trimmed) {
      onLaunchQuestion(trimmed);
    } else {
      onNavigate('/app');
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#09090B] flex flex-col">
      {/* Minimalist Single-Line Sticky Navbar */}
      <header
        className={`sticky top-0 z-30 w-full transition-colors duration-200 ${
          isScrolled
            ? 'bg-[#FFFFFF]/95 backdrop-blur-sm border-b border-[#E5E7EB]'
            : 'bg-[#FFFFFF] border-b border-transparent'
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 h-[72px] flex items-center justify-between gap-4">
          <AegisticLogo onClick={() => onNavigate('/')} />

          {/* Centered Stakeholder-Friendly Navigation */}
          <nav
            className="hidden md:flex items-center gap-8"
            aria-label="Primary Navigation"
          >
            <a
              href="#how-it-works"
              className="text-[14px] font-medium text-[#4B5563] hover:text-[#09090B] transition-colors duration-150"
            >
              How It Works
            </a>
            <button
              type="button"
              onClick={() => onNavigate('/app?view=metrics')}
              className="text-[14px] font-medium text-[#4B5563] hover:text-[#09090B] transition-colors duration-150 focus:outline-none focus-visible:text-[#FF0F5B]"
            >
              Metric Catalog
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/app?view=benchmark')}
              className="text-[14px] font-medium text-[#4B5563] hover:text-[#09090B] transition-colors duration-150 focus:outline-none focus-visible:text-[#FF0F5B]"
            >
              Accuracy Proof
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/app?view=dashboard')}
              className="text-[14px] font-medium text-[#4B5563] hover:text-[#09090B] transition-colors duration-150 focus:outline-none focus-visible:text-[#FF0F5B]"
            >
              Live Dashboard
            </button>
          </nav>

          {/* Right CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded bg-[#FF0F5B] hover:bg-[#DC0A4D] active:bg-[#BE0842] text-[#FFFFFF] text-[14px] font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0F5B] focus-visible:ring-offset-2 whitespace-nowrap"
            >
              Launch Workspace
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* ===================================================================
            HERO: Executive Value Proposition + Full-Width Live Studio Preview
            =================================================================== */}
        <section className="max-w-[1280px] mx-auto px-5 sm:px-8 pt-10 pb-16 lg:pt-14 lg:pb-24">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 lg:gap-10 mb-10 lg:mb-12">
            <div className="max-w-[740px] space-y-4">
              <h1 className="font-display text-[40px] sm:text-[54px] lg:text-[62px] font-bold leading-[1.02] tracking-[-0.04em] text-[#09090B]">
                Ask your data anything.{' '}
                <span className="text-[#FF0F5B] block sm:inline">
                  Audit every number.
                </span>
              </h1>
              <p className="text-[16px] leading-[1.6] text-[#4B5563] max-w-[58ch]">
                Give every team instant self-service answers in plain language without
                risking bad math. Every chart follows your official company definitions
                and comes ready to verify in one click.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0 lg:pb-1">
              <button
                type="button"
                onClick={() => onNavigate('/app')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded bg-[#FF0F5B] hover:bg-[#DC0A4D] active:bg-[#BE0842] text-[#FFFFFF] text-[14.5px] font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0F5B] focus-visible:ring-offset-2"
              >
                <span>Launch Workspace</span>
                <span aria-hidden="true">→</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/app?view=benchmark')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded border border-[#09090B] bg-[#FFFFFF] hover:bg-[#09090B] hover:text-[#FFFFFF] text-[#09090B] text-[14.5px] font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0F5B] focus-visible:ring-offset-2"
              >
                See Accuracy Proof
              </button>
            </div>
          </div>

          {/* Full-Width 3-Pane Interactive Studio Preview */}
          <HeroStudioWorkbench
            scrollY={scrollY}
            onLaunchQuestion={onLaunchQuestion}
            onNavigate={onNavigate}
          />

          {/* Executive Proof Bar beneath the Studio Frame */}
          <div className="pt-8 mt-8 border-t border-[#E5E7EB] grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex items-baseline gap-3">
              <span className="kpi-number text-[30px] font-bold text-[#09090B] leading-none">
                7
              </span>
              <span className="text-[14px] font-medium text-[#4B5563]">
                Finance-Approved Business Metrics
              </span>
            </div>
            <div className="sm:border-l sm:border-[#E5E7EB] sm:pl-6 flex items-baseline gap-3">
              <span className="kpi-number text-[30px] font-bold text-[#09090B] leading-none">
                &lt; 1 sec
              </span>
              <span className="text-[14px] font-medium text-[#4B5563]">
                Verified Answers with Audit Receipts
              </span>
            </div>
            <div className="sm:border-l sm:border-[#E5E7EB] sm:pl-6 flex items-baseline gap-3">
              <span className="kpi-number text-[30px] font-bold text-[#09090B] leading-none">
                Read-Only
              </span>
              <span className="text-[14px] font-medium text-[#4B5563]">
                Protected Access to Approved Data
              </span>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SCROLL-DRIVEN DYNAMIC STORYTELLING
            =================================================================== */}
        <div id="how-it-works">
          <ScrollPipelineShowcase
            onNavigate={onNavigate}
            onLaunchQuestion={onLaunchQuestion}
          />
        </div>

        {/* ===================================================================
            3-COLUMN VALUE PROPOSITION STRIP
            =================================================================== */}
        <section className="max-w-[1280px] mx-auto px-5 sm:px-8 py-20 lg:py-24">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-[28px] sm:text-[34px] font-bold tracking-[-0.03em] text-[#09090B]">
              Built for business speed. Engineered for finance-grade trust.
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('/app?view=metrics')}
              className="text-[14px] font-semibold text-[#FF0F5B] hover:text-[#DC0A4D] inline-flex items-center gap-1.5 transition-colors duration-150"
            >
              <span>Browse Metric Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
            {EDITORIAL_PILLARS.map((pillar) => (
              <div
                key={pillar.index}
                className="relative border-t border-[#BDC4D0] pt-6 flex flex-col gap-3"
              >
                <span
                  className="absolute top-[-1px] left-0 w-10 h-[2px]"
                  style={{ backgroundColor: pillar.accent }}
                  aria-hidden="true"
                />
                <div className="flex items-baseline gap-2.5">
                  <span
                    style={{ color: pillar.accent }}
                    className="text-[14px] font-bold tabular-nums"
                  >
                    {pillar.index}
                  </span>
                  <h3 className="font-display text-[19px] font-bold tracking-[-0.02em] text-[#09090B]">
                    {pillar.title}
                  </h3>
                </div>
                <p className="text-[15px] leading-[1.65] text-[#4B5563]">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ===================================================================
            FINALE INTERACTIVE LAUNCHPAD
            =================================================================== */}
        <section className="dot-grid-canvas border-t border-[#E5E7EB]">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-16 lg:py-20">
            <div className="rounded-xl bg-[#09090B] border border-[#27272A] text-[#FFFFFF] p-6 sm:p-10 space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-2 max-w-[620px]">
                  <h2 className="font-display text-[28px] sm:text-[36px] font-bold leading-[1.08] tracking-[-0.035em] text-[#FFFFFF]">
                    See verified answers on live business data in seconds.
                  </h2>
                  <p className="text-[15px] text-[#D1D5DB] leading-relaxed">
                    Type any question in Indonesian or English below, or pick an
                    example to test boardroom-ready self-service BI right now.
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleQuickSubmit}
                className="flex flex-col sm:flex-row items-stretch gap-3"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#9CA3AF] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={quickPrompt}
                    onChange={(e) => setQuickPrompt(e.target.value)}
                    placeholder="Try: Tampilkan tren Net Revenue bulanan selama 12 bulan terakhir"
                    aria-label="Ask Aegistic directly from home page"
                    className="w-full pl-11 pr-4 py-3.5 rounded bg-[#141417] border border-[#27272A] text-[14.5px] text-[#FFFFFF] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#FF0F5B] transition-colors duration-150"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded bg-[#FF0F5B] hover:bg-[#DC0A4D] active:bg-[#BE0842] text-[#FFFFFF] text-[14.5px] font-semibold transition-colors duration-150 shrink-0"
                >
                  <span>Try It Live</span>
                  <span aria-hidden="true">→</span>
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {QUICK_LAUNCH_PROMPTS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => onLaunchQuestion(item.question)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#141417] border border-[#27272A] hover:border-[#5BC2F4] text-[13px] font-semibold text-[#FFFFFF] transition-colors duration-150"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.dotColor }}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-[#E5E7EB] bg-[#FFFFFF]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-6 flex flex-wrap items-center justify-between gap-4 text-[13.5px] text-[#4B5563]">
          <span className="font-medium text-[#09090B]">
            Aegistic · Verified Self-Service BI
          </span>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => onNavigate('/app?view=metrics')}
              className="md:hidden font-medium text-[#09090B] hover:text-[#FF0F5B]"
            >
              Metric Catalog
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/app?view=benchmark')}
              className="md:hidden font-medium text-[#09090B] hover:text-[#FF0F5B]"
            >
              Accuracy Proof
            </button>
            <span>Approved Business Metrics · Read-Only Security · Full Audit Trail</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
