import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  SERIES_PALETTE,
  formatAxisTick,
  formatValue,
  isNumericFormat,
  type ChartSpec,
  type ColumnMeta,
  type DataRow,
  type ValueFormat,
} from '../lib/api';

interface ChartRendererProps {
  chartSpec: ChartSpec | null;
  columns: ColumnMeta[];
  data: DataRow[];
  compact?: boolean;
}

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: CustomTooltipPayloadItem[];
  formatByKey: Record<string, ValueFormat>;
}

const CustomChartTooltip: React.FC<CustomTooltipProps> = ({
  active,
  label,
  payload,
  formatByKey,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3.5 py-2.5 shadow-panel">
      {label !== undefined && label !== null && (
        <div className="text-[12px] font-semibold text-[#111827] pb-1.5 mb-1.5 border-b border-[#E2E8F0]">
          {String(label)}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const dataKey = String(entry.dataKey ?? '');
          const fmt = formatByKey[dataKey] ?? 'decimal';
          return (
            <div
              key={`${dataKey}-${idx}`}
              className="flex items-center justify-between gap-5 text-[12.5px]"
            >
              <span className="flex items-center gap-2 text-[#526075]">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: entry.color ?? '#4DA8E5' }}
                />
                <span>{entry.name}</span>
              </span>
              <span className="font-semibold text-[#111827] tabular-nums">
                {formatValue(entry.value ?? null, fmt, { compactCurrency: false })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function getSeriesColor(index: number, totalSeries: number, explicit?: string): string {
  if (explicit && /^#[0-9A-Fa-f]{6}$/.test(explicit)) {
    return explicit;
  }
  if (totalSeries === 1) {
    return '#4DA8E5';
  }
  return SERIES_PALETTE[index % SERIES_PALETTE.length];
}

function getFormatFamily(fmt: ValueFormat): string {
  if (fmt === 'percentage') return 'percentage';
  if (fmt === 'currency_idr') return 'currency_idr';
  return 'number';
}

export const ChartRenderer: React.FC<ChartRendererProps> = ({
  chartSpec,
  columns,
  data,
  compact = false,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-[13px] text-[#526075]">
        No data rows returned for this query.
      </div>
    );
  }

  const effectiveType = chartSpec?.chart_type ?? 'table';
  const yKeys = chartSpec?.y_keys ?? [];
  const formatByKey: Record<string, ValueFormat> = {};
  columns.forEach((col) => {
    formatByKey[col.key] = col.format;
  });
  yKeys.forEach((y) => {
    formatByKey[y.key] = y.format;
  });

  // -------------------------------------------------------------------------
  // 1. KPI Card View
  // -------------------------------------------------------------------------
  if (effectiveType === 'kpi') {
    const firstRow = data[0];
    const metricCols =
      yKeys.length > 0
        ? yKeys.map((y) => ({ key: y.key, label: y.label, format: y.format }))
        : columns
            .filter((c) => c.is_metric)
            .map((c) => ({ key: c.key, label: c.label, format: c.format }));

    const cardsToShow =
      metricCols.length > 0
        ? metricCols
        : columns.map((c) => ({ key: c.key, label: c.label, format: c.format }));

    return (
      <div
        className={`grid gap-4 ${
          cardsToShow.length === 1
            ? 'grid-cols-1'
            : cardsToShow.length === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {cardsToShow.map((m, idx) => {
          const rawVal = firstRow[m.key];
          const primaryText = formatValue(rawVal, m.format, {
            compactCurrency: m.format === 'currency_idr' && compact,
          });
          const fullPrecision =
            m.format === 'currency_idr' && compact
              ? formatValue(rawVal, m.format, { compactCurrency: false })
              : null;

          return (
            <div
              key={m.key}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-5 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[12.5px] font-semibold uppercase tracking-wide text-[#526075]">
                  {m.label}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: getSeriesColor(idx, cardsToShow.length),
                  }}
                />
              </div>
              <div
                className={`kpi-number font-bold text-[#111827] ${
                  compact ? 'text-[26px]' : 'text-[34px]'
                } leading-tight`}
              >
                {primaryText}
              </div>
              {fullPrecision && (
                <div className="mt-1.5 text-[12px] font-medium text-[#526075] tabular-nums">
                  {fullPrecision}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 2. Table View (when chart_type === 'table' or missing x_key/y_keys)
  // -------------------------------------------------------------------------
  if (effectiveType === 'table' || !chartSpec?.x_key || yKeys.length === 0) {
    const visibleCols =
      columns.length > 0
        ? columns
        : Object.keys(data[0]).map((k) => ({
            key: k,
            label: k,
            format: typeof data[0][k] === 'number' ? 'decimal' : 'string',
            is_metric: typeof data[0][k] === 'number',
          }));

    const rowsToRender = compact ? data.slice(0, 6) : data;

    return (
      <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0]">
              {visibleCols.map((col) => {
                const numeric = col.is_metric || isNumericFormat(col.format);
                return (
                  <th
                    key={col.key}
                    className={`px-3.5 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-[#526075] whitespace-nowrap ${
                      numeric ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] bg-[#FFFFFF]">
            {rowsToRender.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-[#F8FAFC] transition-colors">
                {visibleCols.map((col) => {
                  const numeric = col.is_metric || isNumericFormat(col.format);
                  return (
                    <td
                      key={col.key}
                      className={`px-3.5 py-2.5 text-[13px] whitespace-nowrap ${
                        numeric
                          ? 'text-right font-medium text-[#111827] tabular-nums'
                          : 'text-left text-[#1F2937]'
                      }`}
                    >
                      {formatValue(row[col.key], col.format)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 3. Line & Bar Charts (Recharts with Palette 1 Indigo-Sky Ramp)
  // -------------------------------------------------------------------------
  const xKey = chartSpec.x_key;
  const chartHeight = compact ? 240 : 340;

  // Detect mixed units across series (e.g., Net Revenue in IDR + Refund Rate in %)
  const primaryFamily = getFormatFamily(yKeys[0].format);
  const secondarySeries = yKeys.find(
    (y) => getFormatFamily(y.format) !== primaryFamily
  );
  const hasDualAxis = Boolean(secondarySeries);

  const chartData = data.map((row) => {
    const normalized: Record<string, string | number | null> = {
      [xKey]: row[xKey] !== null && row[xKey] !== undefined ? String(row[xKey]) : '—',
    };
    yKeys.forEach((y) => {
      const val = row[y.key];
      const num = typeof val === 'number' ? val : Number(val);
      normalized[y.key] = Number.isFinite(num) ? num : 0;
    });
    return normalized;
  });

  if (effectiveType === 'line') {
    return (
      <div style={{ width: '100%', height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 12,
              right: hasDualAxis ? 18 : 20,
              left: 10,
              bottom: 8,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey={xKey}
              tick={{ fill: '#526075', fontSize: 12 }}
              tickLine={{ stroke: '#CBD5E1' }}
              axisLine={{ stroke: '#CBD5E1' }}
              minTickGap={20}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#526075', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={78}
              tickFormatter={(v: number) => formatAxisTick(v, yKeys[0].format)}
            />
            {hasDualAxis && secondarySeries && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#526075', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={54}
                tickFormatter={(v: number) => formatAxisTick(v, secondarySeries.format)}
              />
            )}
            <Tooltip
              content={<CustomChartTooltip formatByKey={formatByKey} />}
              cursor={{ stroke: '#CBD5E1', strokeDasharray: '4 4' }}
            />
            {yKeys.length > 1 && (
              <Legend
                wrapperStyle={{ fontSize: 12, color: '#1F2937', paddingTop: 8 }}
              />
            )}
            {yKeys.map((series, idx) => {
              const color = getSeriesColor(idx, yKeys.length, series.color);
              const axisId =
                hasDualAxis && getFormatFamily(series.format) !== primaryFamily
                  ? 'right'
                  : 'left';
              return (
                <Line
                  key={series.key}
                  yAxisId={axisId}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={color}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#FFFFFF', stroke: color, strokeWidth: 2 }}
                  activeDot={{ r: 5.5, fill: color, stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Default: Bar Chart
  return (
    <div style={{ width: '100%', height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{
            top: 12,
            right: hasDualAxis ? 18 : 20,
            left: 10,
            bottom: 8,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: '#526075', fontSize: 12 }}
            tickLine={{ stroke: '#CBD5E1' }}
            axisLine={{ stroke: '#CBD5E1' }}
            interval={0}
            angle={chartData.length > 6 ? -20 : 0}
            textAnchor={chartData.length > 6 ? 'end' : 'middle'}
            height={chartData.length > 6 ? 56 : 32}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#526075', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={78}
            tickFormatter={(v: number) => formatAxisTick(v, yKeys[0].format)}
          />
          {hasDualAxis && secondarySeries && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#526075', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={54}
              tickFormatter={(v: number) => formatAxisTick(v, secondarySeries.format)}
            />
          )}
          <Tooltip
            content={<CustomChartTooltip formatByKey={formatByKey} />}
            cursor={{ fill: '#EEF0FA', opacity: 0.45 }}
          />
          {yKeys.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: 12, color: '#1F2937', paddingTop: 8 }}
            />
          )}
          {yKeys.map((series, idx) => {
            const color = getSeriesColor(idx, yKeys.length, series.color);
            const axisId =
              hasDualAxis && getFormatFamily(series.format) !== primaryFamily
                ? 'right'
                : 'left';
            return (
              <Bar
                key={series.key}
                yAxisId={axisId}
                dataKey={series.key}
                name={series.label}
                fill={color}
                radius={[4, 4, 0, 0]}
                maxBarSize={56}
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
