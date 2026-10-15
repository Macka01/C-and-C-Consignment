import { formatDate, formatMoney } from "@/lib/format";
import { grainLabel, salesRange, salesSeries } from "@/lib/sales-series";
import type { Movement } from "@/lib/types";

function axisMoney(value: number): string {
  if (value >= 1000) {
    const thousands = value / 1000;
    return `$${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1)}k`;
  }
  return `$${Math.round(value)}`;
}

export function SalesChart({ sales, from, to }: { sales: Movement[]; from: string; to: string }) {
  const range = salesRange(sales, from, to);
  const { grain, points } = salesSeries(sales, from, to);
  const peak = Math.max(0, ...points.map((point) => point.total));
  const width = 640;
  const height = 240;
  const padLeft = 52;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 36;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;
  const slot = points.length > 0 ? innerWidth / points.length : innerWidth;
  const barWidth = Math.max(2, Math.min(28, slot * 0.62));
  const labelStep = points.length > 16 ? Math.ceil(points.length / 8) : points.length > 8 ? 2 : 1;

  if (points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Choose a date range to plot sales. Nothing is recorded yet.</p>
    );
  }

  return (
    <figure className="grid gap-3">
      <figcaption className="text-sm text-muted-foreground">
        {range.from && range.to ? `${formatDate(range.from)} – ${formatDate(range.to)}` : "No dates yet"}, {grainLabel(grain)}.
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Sales over time, ${grainLabel(grain)}. Highest column ${formatMoney(peak)}.`}
        className="h-auto w-full"
      >
        <title>Sales over time</title>
        {[0, 0.5, 1].map((step) => {
          const value = peak * step;
          const y = padTop + innerHeight - (peak === 0 ? 0 : (value / peak) * innerHeight);
          return (
            <g key={step}>
              <line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.12" />
              <text x={padLeft - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground" fontSize="11">
                {axisMoney(value)}
              </text>
            </g>
          );
        })}
        {points.map((point, index) => {
          const barHeight = peak === 0 ? 0 : (point.total / peak) * innerHeight;
          const x = padLeft + index * slot + (slot - barWidth) / 2;
          const y = padTop + innerHeight - barHeight;
          return (
            <g key={point.key}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, point.total > 0 ? 2 : 0)}
                rx="3"
                className="fill-primary"
              >
                <title>
                  {point.label}: {formatMoney(point.total)} · {point.units} {point.units === 1 ? "piece" : "pieces"}
                </title>
              </rect>
              {index % labelStep === 0 ? (
                <text
                  x={padLeft + index * slot + slot / 2}
                  y={height - 12}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize="11"
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
