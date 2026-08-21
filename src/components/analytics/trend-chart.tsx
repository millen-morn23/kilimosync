"use client";

import { useId, useMemo, useState } from "react";

type Point = { label: string; value: number };

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

/**
 * A single-series trend line — deliberately single-series (see
 * docs/ARCHITECTURE.md §Analytics) so it never needs a legend or a
 * categorical palette; one axis, one accent color from the existing
 * design system. Ships its own hover crosshair/tooltip and a collapsible
 * data table for keyboard/screen-reader access, per the dataviz
 * accessibility pass.
 */
export function TrendChart({
  title,
  points,
  formatValue = (v) => v.toLocaleString("en-KE"),
  color = "var(--color-primary)",
}: {
  title: string;
  points: Point[];
  formatValue?: (value: number) => string;
  color?: string;
}) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { path, area, coords, maxValue } = useMemo(() => {
    if (points.length === 0) {
      return { path: "", area: "", coords: [] as { x: number; y: number }[], maxValue: 0 };
    }
    const max = Math.max(...points.map((p) => p.value), 1);
    const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
    const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;

    const computed = points.map((p, i) => ({
      x: PAD_LEFT + stepX * i,
      y: PAD_TOP + innerHeight - (p.value / max) * innerHeight,
    }));

    const linePath = computed.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
    const areaPath =
      computed.length > 0
        ? `${linePath} L${computed[computed.length - 1].x},${PAD_TOP + innerHeight} L${computed[0].x},${PAD_TOP + innerHeight} Z`
        : "";

    return { path: linePath, area: areaPath, coords: computed, maxValue: max };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No data for this period yet.
      </div>
    );
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const hoveredCoord = hoverIndex !== null ? coords[hoverIndex] : null;

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`${title} trend chart`}
          className="w-full"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Recessive gridlines */}
          {[0, 0.5, 1].map((f) => {
            const y = PAD_TOP + (HEIGHT - PAD_TOP - PAD_BOTTOM) * f;
            return (
              <line
                key={f}
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
            );
          })}
          <text x={4} y={PAD_TOP + 4} className="fill-muted-foreground text-[10px]">
            {formatValue(maxValue)}
          </text>
          <text x={4} y={HEIGHT - PAD_BOTTOM + 4} className="fill-muted-foreground text-[10px]">
            0
          </text>

          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {hoveredCoord && (
            <>
              <line
                x1={hoveredCoord.x}
                x2={hoveredCoord.x}
                y1={PAD_TOP}
                y2={HEIGHT - PAD_BOTTOM}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
              <circle cx={hoveredCoord.x} cy={hoveredCoord.y} r={4} fill={color} />
            </>
          )}

          {/* Invisible hit targets, one per point, larger than the mark */}
          {coords.map((c, i) => (
            <rect
              key={i}
              x={c.x - (coords.length > 1 ? (WIDTH - PAD_LEFT - PAD_RIGHT) / (coords.length - 1) / 2 : 20)}
              y={PAD_TOP}
              width={coords.length > 1 ? (WIDTH - PAD_LEFT - PAD_RIGHT) / (coords.length - 1) : 40}
              height={HEIGHT - PAD_TOP - PAD_BOTTOM}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
            />
          ))}
        </svg>

        {hovered && hoveredCoord && (
          <div
            className="pointer-events-none absolute rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: `${(hoveredCoord.x / WIDTH) * 100}%`,
              top: `${(hoveredCoord.y / HEIGHT) * 100}%`,
              transform: "translate(-50%, -130%)",
            }}
          >
            <p className="font-medium text-foreground">{formatValue(hovered.value)}</p>
            <p className="text-muted-foreground">{hovered.label}</p>
          </div>
        )}
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          View as table
        </summary>
        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-muted/50">
              <tr>
                <th className="px-3 py-1.5 font-medium text-muted-foreground">Period</th>
                <th className="px-3 py-1.5 font-medium text-muted-foreground">{title}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.label} className="border-t border-border">
                  <td className="px-3 py-1.5 text-foreground">{p.label}</td>
                  <td className="px-3 py-1.5 text-foreground">{formatValue(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
