import { formatMoney, monthLabel } from "@suite/budget-core";
import type { ReactNode } from "react";

export type ChartPoint = { label: string; value: number };

export function LineChart({
  points,
  format,
  color = "var(--chart-1)",
  height = 200,
  ariaLabel,
}: {
  points: ChartPoint[];
  format: (value: number) => string;
  color?: string;
  height?: number;
  ariaLabel: string;
}) {
  const width = 640;
  const padding = { top: 16, right: 12, bottom: 24, left: 12 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const values = points.map((point) => point.value);
  const min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (min === max) {
    max = min + 1;
  }
  const span = max - min;
  const x = (index: number) =>
    padding.left +
    (points.length <= 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
  const y = (value: number) => padding.top + innerHeight - ((value - min) / span) * innerHeight;

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.value)}`)
    .join(" ");
  const area = `${line} L ${x(points.length - 1)} ${padding.top + innerHeight} L ${x(0)} ${
    padding.top + innerHeight
  } Z`;
  const zeroY = y(0);

  return (
    <figure className="m-0">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
      >
        <title>{ariaLabel}</title>
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--line)"
          strokeWidth={1}
        />
        <path d={area} fill={color} opacity={0.12} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {points.map((point, index) => (
          <circle
            key={`${point.label}-${point.value}`}
            cx={x(index)}
            cy={y(point.value)}
            r={3}
            fill={color}
          >
            <title>{`${point.label}: ${format(point.value)}`}</title>
          </circle>
        ))}
        <text x={padding.left} y={height - 6} fill="var(--ink-faint)" fontSize={10}>
          {points[0]?.label ?? ""}
        </text>
        {points.length > 2 ? (
          <text
            x={width - padding.right}
            y={height - 6}
            fill="var(--ink-faint)"
            fontSize={10}
            textAnchor="end"
          >
            {points[points.length - 1]?.label ?? ""}
          </text>
        ) : null}
        <text
          x={width - padding.right}
          y={padding.top + 10}
          fill="var(--ink-faint)"
          fontSize={10}
          textAnchor="end"
        >
          {format(max)}
        </text>
        {min < 0 ? (
          <text
            x={width - padding.right}
            y={height - padding.bottom - 4}
            fill="var(--ink-faint)"
            fontSize={10}
            textAnchor="end"
          >
            {format(min)}
          </text>
        ) : null}
      </svg>
      <ChartTable
        columns={["Period", "Value"]}
        rows={points.map((point) => [point.label, format(point.value)])}
      />
    </figure>
  );
}

export function BarChart({
  labels,
  series,
  format,
  height = 220,
  ariaLabel,
}: {
  labels: string[];
  series: { label: string; color: string; values: number[] }[];
  format: (value: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  const width = 640;
  const padding = { top: 16, right: 12, bottom: 26, left: 12 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const all = series.flatMap((item) => item.values);
  const min = Math.min(0, ...all);
  let max = Math.max(0, ...all);
  if (min === max) max = min + 1;
  const span = max - min;
  const groupWidth = innerWidth / Math.max(1, labels.length);
  const barWidth = Math.max(2, (groupWidth * 0.7) / Math.max(1, series.length));
  const zeroY = padding.top + innerHeight - ((0 - min) / span) * innerHeight;

  return (
    <figure className="m-0">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
      >
        <title>{ariaLabel}</title>
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--line)"
          strokeWidth={1}
        />
        {labels.map((label, groupIndex) =>
          series.map((item, seriesIndex) => {
            const value = item.values[groupIndex] ?? 0;
            const barHeight = Math.abs(value / span) * innerHeight;
            const x =
              padding.left + groupIndex * groupWidth + groupWidth * 0.15 + seriesIndex * barWidth;
            const y = value >= 0 ? zeroY - barHeight : zeroY;
            return (
              <rect
                key={`${label}-${item.label}`}
                x={x}
                y={y}
                width={barWidth - 2}
                height={Math.max(1, barHeight)}
                rx={2}
                fill={item.color}
              >
                <title>{`${label} · ${item.label}: ${format(value)}`}</title>
              </rect>
            );
          }),
        )}
        {labels.map((label, index) => (
          <text
            key={label}
            x={padding.left + index * groupWidth + groupWidth / 2}
            y={height - 8}
            fill="var(--ink-faint)"
            fontSize={9}
            textAnchor="middle"
          >
            {label}
          </text>
        ))}
      </svg>
      <ChartTable
        columns={["Period", ...series.map((item) => item.label)]}
        rows={labels.map((label, index) => [
          label,
          ...series.map((item) => format(item.values[index] ?? 0)),
        ])}
      />
    </figure>
  );
}

export function BarList({
  rows,
  format,
}: {
  rows: { label: string; value: number; meta?: string }[];
  format: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  if (rows.length === 0) {
    return <p className="text-[12px] text-faint">No data for this range.</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-[12px]">
            <span className="min-w-0 truncate text-ink">{row.label}</span>
            <span className="tnum shrink-0 text-muted">{format(row.value)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-chart-1"
              style={{ width: `${(Math.abs(row.value) / max) * 100}%` }}
            />
          </div>
          {row.meta ? <p className="mt-0.5 text-[10px] text-faint">{row.meta}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function ChartTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-faint">
        Data table
      </summary>
      <div className="mt-2 max-h-48 overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-faint">
              {columns.map((column) => (
                <th key={column} className="py-1 pr-3 text-left font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.join("|")} className="border-t border-line/50">
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${columns[cellIndex] ?? "col"}-${cell}`}
                    className={`py-1 pr-3 ${cellIndex === 0 ? "text-muted" : "tnum text-ink"}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function moneyFormatter(currency: string, scale: number) {
  return (value: number) => formatMoney(value, currency, undefined, scale);
}

export function monthLabels(months: string[]): string[] {
  return months.map((month) =>
    monthLabel(month)
      .replace(/\s+\d{4}$/, "")
      .slice(0, 3),
  );
}

export function Stat({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</p>
      <p className="tnum mt-1 text-[18px] font-medium text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-faint">{hint}</p> : null}
      {children}
    </div>
  );
}
