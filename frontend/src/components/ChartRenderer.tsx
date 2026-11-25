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
  hasPartialPeriod?: boolean;
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
  partialLabel?: string | null;
}

const CustomChartTooltip: React.FC<CustomTooltipProps> = ({
  active,
  label,
  payload,
  formatByKey,
  partialLabel,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const isPartialPoint = Boolean(partialLabel && String(label) === partialLabel);

  return (
    <div className="bg-[#FFFFFF] border border-[#09090B] rounded px-3.5 py-2.5 min-w-[180px]">
      {label !== undefined && label !== null && (
        <div className="flex items-center justify-between gap-3 pb-1.5 mb-1.5 border-b border-[#E5E7EB]">
          <span className="text-[12.5px] font-bold text-[#09090B] tabular-nums">
            {String(label)}
          </span>
          {isPartialPoint && (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#FF0F5B]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF0F5B]" />
              Open month
            </span>
          )}
        </div>
      )}
      <div className="space-y-1.5">
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
                  className="w-2 h-2 shrink-0 rounded-[1px]"
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

interface LineDotProps {
  cx?: number;
  cy?: number;
  index?: number;
  color: string;
  lastIndex: number;
  hasPartialPeriod: boolean;
}

const renderSeriesDot = ({
  cx,
  cy,
  index,
  color,
  lastIndex,
  hasPartialPeriod,
}: LineDotProps) => {
  if (typeof cx !== 'number' || typeof cy !== 'number') return <g />;

  const isPartialLastPoint =
    hasPartialPeriod && typeof index === 'number' && index === lastIndex;

  if (isPartialLastPoint) {
    return (
      <g key={`partial-dot-${index}`}>
        <circle
          cx={cx}
          cy={cy}
          r={9}
          fill="#FFF5F8"
          stroke="#FF0F5B"
          strokeWidth={1.5}
          strokeDasharray="3 2"
        />
        <circle
          cx={cx}
          cy={cy}
          r={4.2}
          fill="#FFFFFF"
          stroke="#FF0F5B"
          strokeWidth={2.2}
        />
      </g>
    );
  }

  return (
    <circle
      key={`dot-${index}`}
      cx={cx}
      cy={cy}
      r={3.5}
      fill="#FFFFFF"
      stroke={color}
      strokeWidth={2}
    />
  );
};

// Map chart series strictly to locked Swiss tokens:
// Primary #5BC2F4, Secondary #67689E, Anomaly/Refund/Alert #FF0F5B.
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

const AXIS_TICK_STYLE = {
  fill: '#4B5563',
  fontSize: 12,
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  fontVariantNumeric: 'tabular-nums',
};

export const ChartRenderer: React.FC<ChartRendererProps> = ({
  chartSpec,
  columns,
  data,
  compact = false,
  hasPartialPeriod = false,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 rounded border border-dashed border-[#BDC4D0] bg-[#F7F8FA] text-[13.5px] text-[#4B5563]">
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
              <div className="text-[13px] font-semibold text-[#4B5563] mb-2">
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
                <div className="mt-2 text-[12.5px] font-medium text-[#4B5563] tabular-nums">
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
                    className={`px-3.5 py-2.5 text-[12.5px] font-semibold text-[#4B5563] whitespace-nowrap ${
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
              <tr key={rIdx} className="hover:bg-[#F7F8FA] transition-colors duration-150">
                {visibleCols.map((col) => {
                  const numeric = col.is_metric || isNumericFormat(col.format);
                  return (
                    <td
                      key={col.key}
                      className={`px-3.5 py-2.5 text-[13.5px] whitespace-nowrap ${
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
  // 3. Recharts Line & Bar Charts (Swiss Flat Palette on #FFFFFF)
  // -------------------------------------------------------------------------
  const xKey = chartSpec.x_key;
  const chartHeight = compact ? 240 : 340;

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

  const lastIndex = chartData.length - 1;
  const lastXLabel =
    hasPartialPeriod && lastIndex >= 0 ? String(chartData[lastIndex][xKey]) : null;

  if (effectiveType === 'line') {
    return (
      <div style={{ width: '100%', height: chartHeight }} className="bg-[#FFFFFF]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 14,
              right: hasDualAxis ? 18 : 22,
              left: 8,
              bottom: 6,
            }}
          >
            <CartesianGrid stroke="#E5E7EB" vertical={false} />
            <XAxis
              dataKey={xKey}
              tick={AXIS_TICK_STYLE}
              tickLine={{ stroke: '#BDC4D0' }}
              axisLine={{ stroke: '#BDC4D0' }}
              minTickGap={22}
            />
            <YAxis
              yAxisId="left"
              tick={AXIS_TICK_STYLE}
              tickLine={false}
              axisLine={false}
              width={82}
              tickFormatter={(v: number) => formatAxisTick(v, yKeys[0].format)}
            />
            {hasDualAxis && secondarySeries && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={AXIS_TICK_STYLE}
                tickLine={false}
                axisLine={false}
                width={54}
                tickFormatter={(v: number) =>
                  formatAxisTick(v, secondarySeries.format)
                }
              />
            )}
            <Tooltip
              content={
                <CustomChartTooltip
                  formatByKey={formatByKey}
                  partialLabel={lastXLabel}
                />
              }
              cursor={{ stroke: '#BDC4D0', strokeWidth: 1 }}
            />
            {yKeys.length > 1 && (
              <Legend
                wrapperStyle={{
                  fontSize: 12.5,
                  color: '#09090B',
                  paddingTop: 10,
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                }}
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
                  dot={(dotProps) =>
                    renderSeriesDot({
                      cx: dotProps.cx,
                      cy: dotProps.cy,
                      index: dotProps.index,
                      color,
                      lastIndex,
                      hasPartialPeriod,
                    })
                  }
                  activeDot={{ r: 5.5, fill: color, stroke: '#FFFFFF', strokeWidth: 2 }}
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
            tick={AXIS_TICK_STYLE}
            tickLine={{ stroke: '#BDC4D0' }}
            axisLine={{ stroke: '#BDC4D0' }}
            interval={0}
            angle={chartData.length > 6 ? -18 : 0}
            textAnchor={chartData.length > 6 ? 'end' : 'middle'}
            height={chartData.length > 6 ? 54 : 30}
          />
          <YAxis
            yAxisId="left"
            tick={AXIS_TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={82}
            tickFormatter={(v: number) => formatAxisTick(v, yKeys[0].format)}
          />
          {hasDualAxis && secondarySeries && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={AXIS_TICK_STYLE}
              tickLine={false}
              axisLine={false}
              width={54}
              tickFormatter={(v: number) => formatAxisTick(v, secondarySeries.format)}
            />
          )}
          <Tooltip
            content={<CustomChartTooltip formatByKey={formatByKey} />}
            cursor={{ fill: '#F7F8FA' }}
          />
          {yKeys.length > 1 && (
            <Legend
              wrapperStyle={{
                fontSize: 12.5,
                color: '#09090B',
                paddingTop: 10,
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}
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
