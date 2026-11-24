import React from 'react';
import {
  MessageSquareCode,
  LayoutDashboard,
  BookOpenCheck,
  BarChart3,
  RefreshCw,
  Database,
} from 'lucide-react';
import type { HealthResponse } from '../lib/api';

export type NavTab = 'ask' | 'dashboard' | 'catalog' | 'benchmark';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  health: HealthResponse | null;
  healthLoading: boolean;
  healthError: string | null;
  onRefreshHealth: () => void;
  pinnedCount: number;
}

const NAV_ITEMS: {
  id: NavTab;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'ask',
    label: 'Ask Aegistic',
    subtitle: 'Conversational BI',
    icon: MessageSquareCode,
  },
  {
    id: 'dashboard',
    label: 'Live Dashboard',
    subtitle: 'Pinned insights',
    icon: LayoutDashboard,
  },
  {
    id: 'catalog',
    label: 'Metric Catalog',
    subtitle: 'Metrics-as-code',
    icon: BookOpenCheck,
  },
  {
    id: 'benchmark',
    label: 'Evaluation Benchmark',
    subtitle: 'Baseline vs Aegistic',
    icon: BarChart3,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  health,
  healthLoading,
  healthError,
  onRefreshHealth,
  pinnedCount,
}) => {
  const isOnline = Boolean(health && health.status === 'ok' && health.duckdb_connected);

  return (
    <aside
      className="w-[240px] shrink-0 h-screen sticky top-0 bg-[#FFFFFF] border-r border-[#E2E8F0] flex flex-col justify-between select-none"
      aria-label="Primary Navigation"
    >
      <div>
        {/* Brand Header */}
        <div className="px-5 py-5 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#3B498B] flex items-center justify-center shadow-sm shrink-0">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M12 2L4 5.5V11.5C4 16.85 7.41 21.74 12 23C16.59 21.74 20 16.85 20 11.5V5.5L12 2Z"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M8.5 12.2L10.9 14.6L15.8 9.5"
                  stroke="#4DA8E5"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-[17px] font-bold text-[#111827] leading-tight tracking-tight">
                Aegistic
              </div>
              <div className="text-[11px] font-medium text-[#526075] tracking-wide uppercase mt-0.5">
                Verified Semantic BI
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          <div className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[#526075]">
            Workspace
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const badge =
              item.id === 'dashboard' && pinnedCount > 0
                ? String(pinnedCount)
                : item.id === 'catalog' && health?.metrics_loaded
                  ? String(health.metrics_loaded)
                  : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`group relative w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[#3B498B]/40 ${
                  isActive
                    ? 'bg-[#EEF0FA] text-[#3B498B]'
                    : 'text-[#1F2937] hover:bg-[#F8FAFC] hover:text-[#111827]'
                }`}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-[#3B498B]"
                    aria-hidden="true"
                  />
                )}
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 ${
                      isActive ? 'text-[#3B498B]' : 'text-[#526075] group-hover:text-[#3B498B]'
                    }`}
                  />
                  <div className="min-w-0">
                    <div
                      className={`text-[13.5px] leading-snug truncate ${
                        isActive ? 'font-semibold text-[#3B498B]' : 'font-medium text-[#1F2937]'
                      }`}
                    >
                      {item.label}
                    </div>
                  </div>
                </div>
                {badge && (
                  <span
                    className={`ml-2 px-1.5 py-0.5 text-[11px] font-semibold rounded-md tabular-nums ${
                      isActive
                        ? 'bg-[#3B498B] text-[#FFFFFF]'
                        : 'bg-[#F1F5F9] text-[#526075]'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Live Backend & DuckDB Health Footer */}
      <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC]/70">
        <div className="rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  healthLoading
                    ? 'bg-[#4DA8E5] animate-pulse'
                    : isOnline
                      ? 'bg-[#4DA8E5]'
                      : 'bg-[#E11D48]'
                }`}
              />
              <span className="text-[12px] font-semibold text-[#111827]">
                {healthLoading
                  ? 'Checking API...'
                  : isOnline
                    ? 'Engine Online'
                    : 'Engine Offline'}
              </span>
            </div>
            <button
              type="button"
              onClick={onRefreshHealth}
              title="Refresh backend health"
              className="p-1 rounded text-[#526075] hover:text-[#3B498B] hover:bg-[#EEF0FA] transition-colors focus:outline-none focus:ring-2 focus:ring-[#3B498B]/40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {isOnline && health ? (
            <div className="space-y-1.5 text-[11.5px] text-[#526075]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Database className="w-3 h-3 text-[#4DA8E5]" />
                  DuckDB Gold
                </span>
                <span className="font-semibold text-[#1F2937] tabular-nums">
                  {health.gold_tables?.length ?? 0} tables
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Semantic Model</span>
                <span className="font-semibold text-[#1F2937] tabular-nums">
                  {health.metrics_loaded}M · {health.dimensions_loaded}D
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Parser Mode</span>
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#EBF6FD] text-[#1B6CA8] font-medium">
                  {health.parser_mode}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[11.5px] text-[#9F1239] leading-relaxed">
              {healthError
                ? `Cannot reach FastAPI: ${healthError}`
                : 'Start FastAPI on localhost:8000 to query live DuckDB data.'}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
};
