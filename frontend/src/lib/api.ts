// Strict TypeScript API Client & Data Formatters matching docs/api_contract.md

export const SERIES_PALETTE = [
  '#3B498B',
  '#4DA8E5',
  '#7685C4',
  '#2A7EB5',
  '#9BCBF0',
] as const;

export const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL ?? ''
).replace(/\/$/, '');

// ---------------------------------------------------------------------------
// 1. Health Check — GET /api/v1/health
// ---------------------------------------------------------------------------
export interface HealthResponse {
  status: string;
  service: string;
  duckdb_connected: boolean;
  dwh_path: string;
  parser_mode: string;
  metrics_loaded: number;
  dimensions_loaded: number;
  gold_tables: string[];
}

// ---------------------------------------------------------------------------
// 2. Metric Catalog — GET /api/v1/metrics
// ---------------------------------------------------------------------------
export type ValueFormat =
  | 'currency_idr'
  | 'percentage'
  | 'integer'
  | 'decimal'
  | 'string'
  | 'date'
  | string;

export interface MetricDefinition {
  key: string;
  label: string;
  description: string;
  formula_display: string;
  sql_expression: string;
  format: ValueFormat;
  grain: string;
  base_table: string;
  mandatory_filters: string[];
  allowed_dimensions: string[];
  caveats: string[];
  owner: string;
}

export interface DimensionDefinition {
  key: string;
  label: string;
  table: string;
  column: string;
  type: string;
  supported_grains?: string[];
  description: string;
}

export interface MetricCatalogResponse {
  model_name: string;
  display_name: string;
  version: string;
  currency: string;
  description: string;
  metrics: MetricDefinition[];
  dimensions: DimensionDefinition[];
}

// ---------------------------------------------------------------------------
// 3. Conversational Analytics Query — POST /api/v1/query
// ---------------------------------------------------------------------------
export type ParserMode = 'deterministic' | 'openai' | 'gemini';

export interface QueryRequest {
  question: string;
  parser_mode?: ParserMode | null;
}

export type QueryStatus =
  | 'verified'
  | 'clarification_required'
  | 'refused'
  | 'guardrail_blocked';

export interface DateRangeSpec {
  preset?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterSpec {
  dimension: string;
  operator: string;
  value: string | number | string[];
}

export interface QueryPlan {
  metrics: string[];
  dimensions: string[];
  time_grain?: string | null;
  filters: FilterSpec[];
  date_range?: DateRangeSpec | null;
  sort: SortSpec[];
  limit: number;
}

export interface ColumnMeta {
  key: string;
  label: string;
  format: ValueFormat;
  is_metric: boolean;
}

export interface ChartSeriesSpec {
  key: string;
  label: string;
  format: ValueFormat;
  color?: string;
}

export type ChartType = 'line' | 'bar' | 'kpi' | 'table';

export interface ChartSpec {
  chart_type: ChartType;
  title: string;
  x_key: string | null;
  x_label: string | null;
  y_keys: ChartSeriesSpec[];
}

export interface AuditMetricUsed {
  key: string;
  label: string;
  formula_display: string;
  mandatory_filters: string[];
  caveats: string[];
}

export interface GuardrailCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface SanityCheck {
  name: string;
  passed: boolean;
  severity: 'info' | 'warning' | 'error' | string;
  detail: string;
}

export interface AuditTrail {
  verified: boolean;
  parser_used: string;
  metrics_used: AuditMetricUsed[];
  compiled_sql: string | null;
  guardrail_checks: GuardrailCheck[];
  sanity_checks: SanityCheck[];
  latency_ms: number;
  row_count: number;
  tables_accessed: string[];
}

export interface WarningItem {
  code: string;
  severity: 'info' | 'warning' | 'error' | string;
  title: string;
  message: string;
}

export interface SuggestionObject {
  label?: string;
  question?: string;
  metric_key?: string;
  description?: string;
  text?: string;
}

export type SuggestionItem = string | SuggestionObject;

export type DataRow = Record<string, string | number | boolean | null>;

export interface QueryResponse {
  status: QueryStatus;
  question: string;
  summary: string;
  query_plan: QueryPlan | null;
  columns: ColumnMeta[];
  data: DataRow[];
  chart_spec: ChartSpec | null;
  audit_trail: AuditTrail;
  warnings: WarningItem[];
  suggestions: SuggestionItem[];
}

// ---------------------------------------------------------------------------
// 4. Live Dashboard Persistence
// ---------------------------------------------------------------------------
export interface DashboardCard {
  id: string;
  title: string;
  question: string;
  created_at: string;
  refreshed_at: string;
  response: QueryResponse;
}

export interface DashboardListResponse {
  cards: DashboardCard[];
}

export interface PinRequest {
  title: string;
  question: string;
}

export interface DeleteDashboardResponse {
  deleted: boolean;
  id: string;
}

// ---------------------------------------------------------------------------
// 5. Evaluation Benchmark — GET /api/v1/benchmark
// ---------------------------------------------------------------------------
export interface BenchmarkSummaryMetrics {
  execution_accuracy_pct: number;
  hallucination_error_rate_pct: number;
  safe_refusal_rate_pct: number;
  median_latency_ms: number;
  overall_pass_rate_pct: number;
}

export interface BenchmarkCategoryStat {
  category: string;
  label: string;
  total: number;
  baseline_passed: number;
  aegistic_passed: number;
  baseline_accuracy_pct: number;
  aegistic_accuracy_pct: number;
}

export interface BenchmarkEngineCaseResult {
  status: string;
  passed: boolean;
  error_type: string | null;
  latency_ms: number;
  sql: string | null;
  note: string;
}

export interface BenchmarkCase {
  id: string;
  category: string;
  question: string;
  expected_behavior: string;
  baseline: BenchmarkEngineCaseResult;
  aegistic: BenchmarkEngineCaseResult;
}

export interface BenchmarkReport {
  generated_at: string;
  dataset_size: number;
  summary: {
    baseline: BenchmarkSummaryMetrics;
    aegistic: BenchmarkSummaryMetrics;
  };
  by_category: BenchmarkCategoryStat[];
  cases: BenchmarkCase[];
}

// ---------------------------------------------------------------------------
// HTTP Helpers
// ---------------------------------------------------------------------------
export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status} ${res.statusText}`;
    try {
      const payload = await res.json();
      if (typeof payload?.detail === 'string') {
        detail = payload.detail;
      } else if (payload?.detail) {
        detail = JSON.stringify(payload.detail);
      }
    } catch {
      // Ignore JSON parse errors on error body
    }
    throw new ApiError(res.status, detail);
  }

  return (await res.json()) as T;
}

export function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/api/v1/health');
}

export function fetchMetrics(): Promise<MetricCatalogResponse> {
  return apiFetch<MetricCatalogResponse>('/api/v1/metrics');
}

export function runQuery(
  question: string,
  parserMode?: ParserMode | null
): Promise<QueryResponse> {
  const body: QueryRequest = {
    question,
    parser_mode: parserMode ?? null,
  };
  return apiFetch<QueryResponse>('/api/v1/query', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchDashboards(): Promise<DashboardListResponse> {
  return apiFetch<DashboardListResponse>('/api/v1/dashboards');
}

export function pinToDashboard(payload: PinRequest): Promise<DashboardCard> {
  return apiFetch<DashboardCard>('/api/v1/dashboards/pin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function refreshDashboardCard(cardId: string): Promise<DashboardCard> {
  return apiFetch<DashboardCard>(
    `/api/v1/dashboards/${encodeURIComponent(cardId)}/refresh`,
    { method: 'POST' }
  );
}

export function deleteDashboardCard(
  cardId: string
): Promise<DeleteDashboardResponse> {
  return apiFetch<DeleteDashboardResponse>(
    `/api/v1/dashboards/${encodeURIComponent(cardId)}`,
    { method: 'DELETE' }
  );
}

export function fetchBenchmark(): Promise<BenchmarkReport> {
  return apiFetch<BenchmarkReport>('/api/v1/benchmark');
}

// ---------------------------------------------------------------------------
// Formatting Utilities (IDR, Percentage, Integer, Axis Ticks, Timestamps)
// ---------------------------------------------------------------------------
const idrIntegerFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

export function formatIDR(value: number, compact = false): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (compact) {
    if (abs >= 1_000_000_000_000) {
      return `${sign}Rp ${(abs / 1_000_000_000_000).toFixed(2).replace('.', ',')} T`;
    }
    if (abs >= 1_000_000_000) {
      return `${sign}Rp ${(abs / 1_000_000_000).toFixed(2).replace('.', ',')} M`;
    }
    if (abs >= 1_000_000) {
      return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace('.', ',')} Jt`;
    }
    if (abs >= 1_000) {
      return `${sign}Rp ${(abs / 1_000).toFixed(0)} Rb`;
    }
  }

  return `${sign}Rp ${idrIntegerFormatter.format(Math.round(abs))}`;
}

export function formatPercentage(value: number): string {
  if (!Number.isFinite(value)) return '—';
  // DuckDB ratios may arrive as 0..1 (e.g. 0.245) or already in 0..100 (e.g. 24.5)
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${normalized.toFixed(1)}%`;
}

export function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return integerFormatter.format(Math.round(value));
}

export function formatDecimal(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return decimalFormatter.format(value);
}

export function formatValue(
  raw: string | number | boolean | null | undefined,
  format: ValueFormat = 'string',
  options?: { compactCurrency?: boolean }
): string {
  if (raw === null || raw === undefined || raw === '') return '—';
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';

  if (format === 'currency_idr') {
    const num = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(num)
      ? formatIDR(num, Boolean(options?.compactCurrency))
      : String(raw);
  }

  if (format === 'percentage') {
    const num = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(num) ? formatPercentage(num) : String(raw);
  }

  if (format === 'integer') {
    const num = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(num) ? formatInteger(num) : String(raw);
  }

  if (format === 'decimal') {
    const num = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(num) ? formatDecimal(num) : String(raw);
  }

  return String(raw);
}

export function formatAxisTick(value: number, format: ValueFormat): string {
  if (!Number.isFinite(value)) return '';
  if (format === 'currency_idr') {
    return formatIDR(value, true);
  }
  if (format === 'percentage') {
    const normalized = Math.abs(value) <= 1 && value !== 0 ? value * 100 : value;
    return `${normalized.toFixed(0)}%`;
  }
  if (format === 'integer') {
    if (Math.abs(value) >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1_000) {
      return `${(value / 1_000).toFixed(0)}k`;
    }
    return String(Math.round(value));
  }
  return String(value);
}

export function formatTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function isNumericFormat(format: ValueFormat): boolean {
  return (
    format === 'currency_idr' ||
    format === 'percentage' ||
    format === 'integer' ||
    format === 'decimal'
  );
}

export interface NormalizedSuggestion {
  label: string;
  question: string;
  metricKey?: string;
}

export function normalizeSuggestion(
  item: SuggestionItem
): NormalizedSuggestion {
  if (typeof item === 'string') {
    return { label: item, question: item };
  }
  const question = item.question ?? item.text ?? item.label ?? '';
  const label = item.label ?? item.question ?? item.text ?? '';
  return {
    label,
    question,
    metricKey: item.metric_key,
  };
}
