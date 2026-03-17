'use client';

/**
 * Gauge loading skeleton — pulse animation, no spinner.
 * Matches BssGauge dimensions for seamless swap on load.
 */
export function GaugeSkeleton({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const dimension = size === 'lg' ? 280 : 180;
  const radius = (dimension / 2) - 24;
  const cx = dimension / 2;
  const cy = dimension / 2;

  // 240° arc ghost
  const startAngle = 150;
  const sweepAngle = 240;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (sweepAngle / 360) * circumference;

  return (
    <div className="flex flex-col items-center gap-2 animate-pulse">
      <svg
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
      >
        {/* Ghost arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="rgba(200,169,110,0.03)"
          strokeWidth={size === 'lg' ? 8 : 5}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(${startAngle + 90} ${cx} ${cy})`}
        />

        {/* Ghost score placeholder */}
        <rect
          x={cx - 32}
          y={cy - 14}
          width="64"
          height="28"
          rx="6"
          fill="rgba(200,169,110,0.03)"
        />
      </svg>

      {/* Ghost tier label */}
      <div className="h-3 w-16 rounded bg-[rgba(200,169,110,0.03)]" />
    </div>
  );
}
