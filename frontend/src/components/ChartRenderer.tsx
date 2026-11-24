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
    <div className="bg-[#FFFFFF] border border-[#09090B] rounded px-3.5 py-2.5">
      {label !== undefined && label !== null && (
        <div className="text-[12px] font-bold text-[#09090B] pb-1.5 mb-1.5 border-b border-[#E5E7EB]">
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
              <span className="flex items-center gap-2 text-[#4B5563]">
                <span
                  className="w-2 h-2 shrink-0"
                  style={{ backgroundColor: entry.color ?? '#5BC2F4' }}
                />
                <span>{entry.name}</span>
              </span>
              <span className="font-semibold text-[#09090B] tabular-nums">
                {formatValue(entry.value ?? null, fmt, { compactCurrency: false })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Always map series strictly to the locked Swiss Geometric palette:
// Primary #5BC2F4, Secondary #67689E, Anomaly/Refund highlight #FF0F5B.
function resolveSwissSeriesColor(index: number, key: string): string {
  const lower = key.toLowerCase();
  if (lower.includes('refund') || lower.includes('cancel') || lower.includes('error')) {
    return '#FF0F5B';
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
      <div className="flex items-center justify-center h-44 rounded border border-dashed border-[#BDC4D0] bg-[#F7F8FA] text-[13px] text-[#4B5563]">
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
  // 1. Flat Swiss KPI Strip
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
        className={`grid gap-6 ${
          cardsToShow.length === 1
            ? 'grid-cols-1'
            : cardsToShow.length === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {cardsToShow.map((m, idx) => {
          const rawVal = firstRow[m.key];
          const accent = resolveSwissSeriesColor(idx, m.key);
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
              className="border-t-2 pt-4 pb-2 flex flex-col justify-between bg-[#FFFFFF]"
              style={{ borderTopColor: accent }}
            >
              <div className="text-[12px] font-mono uppercase tracking-[0.06em] text-[#4B5563] mb-2">
                {m.label}
              </div>
              <div
                className={`kpi-number font-bold text-[#09090B] ${
                  compact ? 'text-[28px]' : 'text-[38px]'
                } leading-none`}
              >
                {primaryText}
              </div>
              {fullPrecision && (
                <div className="mt-2 text-[12px] font-mono text-[#4B5563] tabular-nums">
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
  // 2. Flat Table View
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
      <div className="overflow-x-auto border border-[#E5E7EB] rounded">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F7F8FA] border-b border-[#BDC4D0]">
              {visibleCols.map((col) => {
                const numeric = col.is_metric || isNumericFormat(col.format);
                return (
                  <th
                    key={col.key}
                    className={`px-3.5 py-2.5 text-[11px] font-mono font-semibold uppercase tracking-[0.06em] text-[#4B5563] whitespace-nowrap ${
                      numeric ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB] bg-[#FFFFFF]">
            {rowsToRender.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-[#F7F8FA] transition-colors">
                {visibleCols.map((col) => {
                  const numeric = col.is_metric || isNumericFormat(col.format);
                  return (
                    <td
                      key={col.key}
                      className={`px-3.5 py-2.5 text-[13px] whitespace-nowrap ${
                        numeric
                          ? 'text-right font-semibold text-[#09090B] tabular-nums'
                          : 'text-left text-[#09090B]'
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
  // 3. Recharts Line & Bar Charts (Swiss Geometric Palette on #FFFFFF)
  // -------------------------------------------------------------------------
  const xKey = chartSpec.x_key;
  const chartHeight = compact ? 235 : 330;

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
      <div style={{ width: '100%', height: chartHeight }} className="bg-[#FFFFFF]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 12,
              right: hasDualAxis ? 16 : 18,
              left: 8,
              bottom: 6,
            }}
          >
            <CartesianGrid stroke="#E5E7EB" vertical={false} />
            <XAxis
              dataKey={xKey}
              tick={{ fill: '#4B5563', fontSize: 11.5 }}
              tickLine={{ stroke: '#BDC4D0' }}
              axisLine={{ stroke: '#BDC4D0' }}
              minTickGap={20}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#4B5563', fontSize: 11.5 }}
              tickLine={false}
              axisLine={false}
              width={78}
              tickFormatter={(v: number) => formatAxisTick(v, yKeys[0].format)}
            />
            {hasDualAxis && secondarySeries && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#4B5563', fontSize: 11.5 }}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={(v: number) =>
                  formatAxisTick(v, secondarySeries.format)
                }
              />
            )}
            <Tooltip
              content={<CustomChartTooltip formatByKey={formatByKey} />}
              cursor={{ stroke: '#BDC4D0', strokeWidth: 1 }}
            />
            {yKeys.length > 1 && (
              <Legend
                wrapperStyle={{ fontSize: 12, color: '#09090B', paddingTop: 10 }}
              />
            )}
            {yKeys.map((series, idx) => {
              const color = resolveSwissSeriesColor(idx, series.key);
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
                  activeDot={{ r: 5, fill: color, stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: chartHeight }} className="bg-[#FFFFFF]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{
            top: 12,
            right: hasDualAxis ? 16 : 18,
            left: 8,
            bottom: 6,
          }}
        >
          <CartesianGrid stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: '#4B5563', fontSize: 11.5 }}
            tickLine={{ stroke: '#BDC4D0' }}
            axisLine={{ stroke: '#BDC4D0' }}
            interval={0}
            angle={chartData.length > 6 ? -20 : 0}
            textAnchor={chartData.length > 6 ? 'end' : 'middle'}
            height={chartData.length > 6 ? 54 : 30}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#4B5563', fontSize: 11.5 }}
            tickLine={false}
            axisLine={false}
            width={78}
            tickFormatter={(v: number) => formatAxisTick(v, yKeys[0].format)}
          />
          {hasDualAxis && secondarySeries && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#4B5563', fontSize: 11.5 }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v: number) => formatAxisTick(v, secondarySeries.format)}
            />
          )}
          <Tooltip
            content={<CustomChartTooltip formatByKey={formatByKey} />}
            cursor={{ fill: '#F7F8FA' }}
          />
          {yKeys.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: 12, color: '#09090B', paddingTop: 10 }}
            />
          )}
          {yKeys.map((series, idx) => {
            const color = resolveSwissSeriesColor(idx, series.key);
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
                radius={[2, 2, 0, 0]}
                maxBarSize={52}
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
