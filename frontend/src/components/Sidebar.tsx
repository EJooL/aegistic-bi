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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [infoOpen]);

  return (
    <aside
      className="w-[240px] shrink-0 h-screen sticky top-0 bg-[#FFFFFF] border-r border-[#E5E7EB] flex flex-col justify-between select-none"
      aria-label="Workspace Navigation"
    >
      <div>
        {/* Clickable Brand Header -> Returns to / */}
        <div className="px-5 h-[68px] border-b border-[#E5E7EB] flex items-center">
          <AegisticLogo onClick={onNavigateHome} showSubtitle size="sm" />
        </div>

        {/* Navigation Links */}
        <nav className="py-4">
          <div className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4B5563]">
            Workspace
          </div>
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
                  onClick={() => onSelectTab(item.id)}
                  className={`relative w-full flex items-center justify-between pl-5 pr-4 py-2.5 text-left transition-colors focus:outline-none focus:bg-[#F7F8FA] ${
                    isActive
                      ? 'bg-[#F7F8FA] text-[#09090B]'
                      : 'text-[#4B5563] hover:bg-[#F7F8FA] hover:text-[#09090B]'
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
                        isActive ? 'text-[#09090B]' : 'text-[#4B5563]'
                      }`}
                    />
                    <span
                      className={`text-[13.5px] truncate ${
                        isActive ? 'font-bold text-[#09090B]' : 'font-medium'
                      }`}
                    >
                      {item.label}
                    </span>
                  </span>
                  {count && (
                    <span className="ml-2 text-[11.5px] font-semibold text-[#4B5563] tabular-nums">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Compact Unobtrusive Engine Status + "Engine Info" Popover */}
      <div className="relative p-3 border-t border-[#E5E7EB]" ref={popoverRef}>
        {infoOpen && (
          <div className="absolute left-3 right-3 bottom-[60px] z-30 bg-[#FFFFFF] border border-[#BDC4D0] rounded-md p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#09090B]">
                Engine Telemetry
              </span>
              <button
                type="button"
                onClick={onRefreshHealth}
                title="Refresh backend health"
                className="p-1 rounded text-[#4B5563] hover:text-[#09090B] hover:bg-[#F7F8FA] transition-colors"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin' : ''}`}
                />
              </button>
            </div>

            {isOnline && health ? (
              <div className="space-y-2 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[#4B5563]">
                    <Database className="w-3.5 h-3.5 text-[#5BC2F4]" />
                    DuckDB Gold
                  </span>
                  <span className="font-semibold text-[#09090B] tabular-nums">
                    {health.gold_tables?.length ?? 0} tables
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#4B5563]">Semantic Contract</span>
                  <span className="font-semibold text-[#09090B] tabular-nums">
                    {health.metrics_loaded}M · {health.dimensions_loaded}D
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#4B5563]">Server Parser</span>
                  <span className="font-semibold text-[#09090B] capitalize">
                    {health.parser_mode}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-[#FF0F5B] leading-snug">
                {healthError
                  ? `API unreachable: ${healthError}`
                  : 'FastAPI offline on localhost:8000.'}
              </p>
            )}

            <div className="pt-2 border-t border-[#E5E7EB] space-y-1.5">
              <label
                htmlFor="sidebar-parser-mode"
                className="block text-[11px] font-semibold text-[#4B5563]"
              >
                Query Parser Override
              </label>
              <select
                id="sidebar-parser-mode"
                value={parserMode}
                onChange={(e) => onParserModeChange(e.target.value as ParserMode | '')}
                className="w-full text-[12px] font-medium text-[#09090B] bg-[#F7F8FA] border border-[#BDC4D0] rounded px-2 py-1.5 focus:outline-none focus:border-[#09090B]"
              >
                <option value="">Server Default</option>
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
          className="w-full flex items-center justify-between px-2.5 py-2 rounded border border-[#E5E7EB] bg-[#FFFFFF] hover:bg-[#F7F8FA] transition-colors text-left focus:outline-none focus:border-[#09090B]"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                healthLoading
                  ? 'bg-[#5BC2F4] animate-pulse'
                  : isOnline
                    ? 'bg-[#5BC2F4]'
                    : 'bg-[#FF0F5B]'
              }`}
            />
            <span className="text-[12px] font-semibold text-[#09090B] truncate">
              {healthLoading ? 'Checking...' : isOnline ? 'Engine Info' : 'Engine Offline'}
            </span>
          </span>
          {infoOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#4B5563] shrink-0" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-[#4B5563] shrink-0" />
          )}
        </button>
      </div>
    </aside>
  );
};
