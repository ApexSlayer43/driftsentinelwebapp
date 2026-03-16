'use client';

import { getTierStyle } from '@/lib/tokens';

interface SparklineProps {
  /** Array of up to 7 daily BSS scores, oldest to newest */
  data: number[];
  /** Current tier — determines the line/dot color */
  tier: string;
  /** Width of the sparkline SVG */
  width?: number;
  /** Height of the sparkline SVG */
  height?: number;
}

/**
 * 7-day BSS sparkline. SVG polyline + dots.
 * Color: tier color for the line, with per-day cyan/orange dots
 * showing direction (up vs down from previous day).
 */
export function Sparkline({
  data,
  tier,
  width = 140,
  height = 36,
}: SparklineProps) {
  if (!data || data.length < 2) return null;

  const tierStyle = getTierStyle(tier);
  const padding = 6;
  const dotRadius = 3;

  // Normalize values to SVG coordinates
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
    const normalizedValue = (value - min) / range;
    const y = height - normalizedValue * (height - 2 * padding) - padding;
    return { x, y, value };
  });

  // Polyline path
  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block"
      aria-label={`7-day BSS trend: ${data.join(', ')}`}
    >
      {/* Connecting line — tier-colored, subtle */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={tierStyle.color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.4"
      />

      {/* Day dots — cyan for up, orange for down, muted for flat */}
      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        const isUp = i > 0 && data[i] > data[i - 1];
        const isDown = i > 0 && data[i] < data[i - 1];

        // Last dot uses tier color and is slightly larger
        const fill = isLast
          ? tierStyle.color
          : isUp
            ? '#22D3EE'
            : isDown
              ? '#FB923C'
              : '#4A5568';

        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={isLast ? dotRadius + 1 : dotRadius}
            fill={fill}
            opacity={isLast ? 1 : 0.8}
          />
        );
      })}
    </svg>
  );
}
