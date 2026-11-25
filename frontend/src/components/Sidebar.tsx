import React, { useEffect, useRef, useState } from 'react';
import {
  Terminal,
  LayoutGrid,
  BookOpen,
  BarChart3,
  RefreshCw,
  Database,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import type { HealthResponse, ParserMode } from '../lib/api';
import { AegisticLogo } from './AegisticLogo';

export type NavTab = 'ask' | 'dashboard' | 'metrics' | 'benchmark';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onNavigateHome: () => void;
  health: HealthResponse | null;
  healthLoading: boolean;
  healthError: string | null;
  onRefreshHealth: () => void;
  pinnedCount: number;
  parserMode: ParserMode | '';
  onParserModeChange: (mode: ParserMode | '') => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const NAV_ITEMS: {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'ask', label: 'Ask Aegistic', icon: Terminal },
  { id: 'dashboard', label: 'Live Dashboard', icon: LayoutGrid },
  { id: 'metrics', label: 'Metric Catalog', icon: BookOpen },
  { id: 'benchmark', label: 'Evaluation Benchmark', icon: BarChart3 },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onNavigateHome,
  health,
  healthLoading,
  healthError,
  onRefreshHealth,
  pinnedCount,
  parserMode,
  onParserModeChange,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const [infoOpen, setInfoOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isOnline = Boolean(
    health && health.status === 'ok' && health.duckdb_connected
  );

  useEffect(() => {
    if (!infoOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setInfoOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInfoOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [infoOpen]);

  const handleNavClick = (id: NavTab) => {
    onSelectTab(id);
    onCloseMobile?.();
  };

  const sidebarContent = (
    <>
      <div>
        {/* Clickable Brand Header -> Returns to / */}
        <div className="px-5 h-[68px] border-b border-[#27272A] flex items-center justify-between gap-2">
          <AegisticLogo
            onClick={onNavigateHome}
            showSubtitle
            size="sm"
            variant="dark"
          />
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="lg:hidden p-1.5 rounded text-[#9CA3AF] hover:text-[#FFFFFF] hover:bg-[#141417] transition-colors duration-150"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Workspace Navigation */}
        <nav className="py-4" aria-label="Workspace Modules">
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const count =
                item.id === 'dashboard' && pinnedCount > 0
                  ? String(pinnedCount)
                  : item.id === 'metrics' && health?.metrics_loaded
                    ? String(health.metrics_loaded)
                    : null;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative w-full flex items-center justify-between pl-5 pr-4 py-2.5 text-left transition-colors duration-150 focus:outline-none focus-visible:bg-[#141417] ${
                    isActive
                      ? 'bg-[#141417] text-[#FFFFFF]'
                      : 'text-[#9CA3AF] hover:bg-[#141417] hover:text-[#FFFFFF]'
                  }`}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF0F5B]"
                      aria-hidden="true"
                    />
                  )}
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-[16px] h-[16px] shrink-0 ${
                        isActive ? 'text-[#FFFFFF]' : 'text-[#9CA3AF]'
                      }`}
                    />
                    <span
                      className={`text-[14px] truncate ${
                        isActive ? 'font-bold text-[#FFFFFF]' : 'font-medium'
                      }`}
                    >
                      {item.label}
                    </span>
                  </span>
                  {count && (
                    <span
                      className={`ml-2 text-[12px] font-semibold tabular-nums ${
                        isActive ? 'text-[#FFFFFF]' : 'text-[#9CA3AF]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Compact Collapsible Engine Info Popover (Obsidian Dark Surface) */}
      <div className="relative p-3.5 border-t border-[#27272A]" ref={popoverRef}>
        {infoOpen && (
          <div className="absolute left-3.5 right-3.5 bottom-[62px] z-30 bg-[#141417] border border-[#27272A] rounded-md p-3.5 space-y-3 text-[#FFFFFF] animate-stage-fade">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-2">
              <span className="text-[12.5px] font-bold text-[#FFFFFF]">
                Engine status
              </span>
              <button
                type="button"
                onClick={onRefreshHealth}
                title="Refresh backend health"
                aria-label="Refresh backend health"
                className="p-1 rounded text-[#9CA3AF] hover:text-[#FFFFFF] hover:bg-[#27272A] transition-colors duration-150"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin' : ''}`}
                />
              </button>
            </div>

            {isOnline && health ? (
              <div className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[#9CA3AF]">
                    <Database className="w-3.5 h-3.5 text-[#5BC2F4] shrink-0" />
                    DuckDB Gold
                  </span>
                  <span className="font-semibold text-[#FFFFFF] tabular-nums">
                    {health.gold_tables?.length ?? 0} tables
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#9CA3AF]">Semantic model</span>
                  <span className="font-semibold text-[#FFFFFF] tabular-nums">
                    {health.metrics_loaded} metrics · {health.dimensions_loaded} dims
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#9CA3AF]">Server parser</span>
                  <span className="font-semibold text-[#FFFFFF] capitalize">
                    {health.parser_mode}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[12.5px] text-[#FF0F5B] leading-snug">
                {healthError
                  ? `API unreachable: ${healthError}`
                  : 'FastAPI offline on localhost:8000.'}
              </p>
            )}

            <div className="pt-2.5 border-t border-[#27272A] space-y-1.5">
              <label
                htmlFor="sidebar-parser-mode"
                className="block text-[12px] font-semibold text-[#9CA3AF]"
              >
                Parser override
              </label>
              <select
                id="sidebar-parser-mode"
                value={parserMode}
                onChange={(e) => onParserModeChange(e.target.value as ParserMode | '')}
                className="w-full text-[12.5px] font-medium text-[#FFFFFF] bg-[#09090B] border border-[#27272A] rounded px-2.5 py-1.5 focus:outline-none focus:border-[#5BC2F4]"
              >
                <option value="">Server default</option>
                <option value="deterministic">Deterministic</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setInfoOpen((prev) => !prev)}
          aria-expanded={infoOpen}
          className="w-full flex items-center justify-between px-3 py-2 rounded border border-[#27272A] bg-[#141417] hover:border-[#4B5563] transition-colors duration-150 text-left focus:outline-none focus-visible:border-[#5BC2F4]"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                healthLoading
                  ? 'bg-[#5BC2F4]'
                  : isOnline
                    ? 'bg-[#5BC2F4]'
                    : 'bg-[#FF0F5B]'
              }`}
              aria-hidden="true"
            />
            <span className="text-[13px] font-semibold text-[#FFFFFF] truncate">
              {healthLoading ? 'Checking...' : isOnline ? 'Engine Info' : 'Engine Offline'}
            </span>
          </span>
          {infoOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sticky Deep Obsidian Sidebar */}
      <aside
        className="hidden lg:flex w-[244px] shrink-0 h-screen sticky top-0 bg-[#09090B] text-[#FFFFFF] border-r border-[#27272A] flex-col justify-between select-none"
        aria-label="Workspace Navigation"
      >
        {sidebarContent}
      </aside>

      {/* Mobile Slide-In Deep Obsidian Sidebar Drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-40 transition-opacity duration-200 ease-swiss ${
          mobileOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!mobileOpen}
      >
        <div
          className="absolute inset-0 bg-[#09090B]/50"
          onClick={onCloseMobile}
        />
        <aside
          className={`relative w-[264px] max-w-[82vw] h-full bg-[#09090B] text-[#FFFFFF] border-r border-[#27272A] flex flex-col justify-between select-none transition-transform duration-200 ease-swiss ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-label="Mobile Workspace Navigation"
        >
          {sidebarContent}
        </aside>
      </div>
    </>
  );
};
