'use client';

import { useEffect, useState } from 'react';
import { getTierStyle, getStateStyle } from '@/lib/tokens';

interface BssGaugeProps {
  score: number;
  tier: string;
  state: string;
  delta: number;
  yesterdayScore: number;
  size?: 'lg' | 'sm';
  isBuilding?: boolean;
  buildProgress?: { collected: number; required: number };
}

/**
 * BSS Precision Gauge
 *
 * Thin arc ring with inward-facing tick marks — like a watch bezel.
 * Ticks point toward center. Arc is 2px (lg) / 1px (sm) — just a ring.
 * Score centered. Delta below. Tier badge underneath.
 */
export function BssGauge({
  score,
  tier,
  state,
  delta,
  yesterdayScore,
  size = 'lg',
  isBuilding = false,
  buildProgress,
}: BssGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const tierStyle = getTierStyle(tier);

  const dimension = size === 'lg' ? 380 : 180;
  const cx = dimension / 2;
  const cy = dimension / 2;
  const radius = (dimension / 2) - 24;
  const arcStroke = size === 'lg' ? 2 : 1; // Thin precision ring

  // Arc: 270° sweep (wider than before for more instrument feel)
  const startAngle = 135;
  const sweepAngle = 270;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (sweepAngle / 360) * circumference;

  const progressValue = isBuilding && buildProgress
    ? buildProgress.collected / buildProgress.required
    : score / 100;
  const dashOffset = arcLength * (1 - Math.min(progressValue, 1));

  // Spring-physics animation for score counter
  useEffect(() => {
    const target = score;
    let current = 0;
    let velocity = 0;
    const stiffness = 0.04;
    const damping = 0.2;
    let raf: number;

    function animate() {
      const force = (target - current) * stiffness;
      velocity = (velocity + force) * (1 - damping);
      current += velocity;

      if (Math.abs(target - current) < 0.5 && Math.abs(velocity) < 0.1) {
        setAnimatedScore(target);
        return;
      }

      setAnimatedScore(Math.round(current));
      raf = requestAnimationFrame(animate);
    }

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const deltaColor = delta > 0 ? '#ede9e1' : delta < 0 ? '#7a766d' : '#4a473f';
  const deltaSymbol = delta > 0 ? '\u25B2' : delta < 0 ? '\u25BC' : '\u2014';
  const deltaText = delta !== 0 ? `${Math.abs(delta)}` : '';

  const shouldPulse = ['DRIFT_FORMING', 'COMPROMISED', 'BREAKDOWN'].includes(state);

  // Tick config — inward-facing from the arc ring
  const tickCount = 60;
  const majorEvery = 5; // Major tick every 5th mark

  return (
    <div className="bss-orb relative flex flex-col items-center gap-2">
      <svg
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
      >
        {/* Inward-facing tick marks */}
        {Array.from({ length: tickCount + 1 }).map((_, i) => {
          const angle = startAngle + (sweepAngle / tickCount) * i;
          const rad = (angle * Math.PI) / 180;
          const isMajor = i % majorEvery === 0;
          const tickLen = size === 'lg' ? (isMajor ? 12 : 6) : (isMajor ? 6 : 3);

          // Outer end sits on the arc ring, inner end points toward center
          const outerR = radius;
          const innerR = radius - tickLen;
          const tickProgress = i / tickCount;
          const isActive = tickProgress <= progressValue;

          return (
            <line
              key={i}
              x1={cx + outerR * Math.cos(rad)}
              y1={cy + outerR * Math.sin(rad)}
              x2={cx + innerR * Math.cos(rad)}
              y2={cy + innerR * Math.sin(rad)}
              stroke={isActive ? tierStyle.color : 'rgba(200,169,110,0.1)'}
              strokeWidth={isMajor ? 1.5 : 0.75}
              strokeLinecap="butt"
              opacity={isActive ? (isMajor ? 0.9 : 0.5) : 0.25}
            />
          );
        })}

        {/* Background arc — thin ring track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="rgba(200,169,110,0.08)"
          strokeWidth={arcStroke}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(${startAngle + 90} ${cx} ${cy})`}
        />

        {/* Score arc — thin tier-colored ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={tierStyle.color}
          strokeWidth={arcStroke}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(${startAngle + 90} ${cx} ${cy})`}
          style={{
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            ...(isBuilding ? { strokeDasharray: `${arcStroke * 4} ${arcStroke * 6}` } : {}),
          }}
          className={shouldPulse ? 'animate-pulse' : ''}
        />

        {/* Score number */}
        <text
          x={cx}
          y={cy - (size === 'lg' ? 10 : 2)}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ede9e1"
          fontFamily="var(--font-mono)"
          fontWeight="700"
          fontSize={size === 'lg' ? 64 : 32}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {isBuilding ? `${Math.round(progressValue * 100)}%` : animatedScore}
        </text>

        {/* Delta indicator */}
        {!isBuilding && (
          <text
            x={cx}
            y={cy + (size === 'lg' ? 36 : 18)}
            textAnchor="middle"
            dominantBaseline="central"
            fill={deltaColor}
            fontFamily="var(--font-mono)"
            fontWeight="500"
            fontSize={size === 'lg' ? 14 : 10}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {deltaSymbol} {deltaText}
          </text>
        )}
      </svg>

      {/* Tier badge */}
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[14px] font-medium"
        style={{
          color: tierStyle.color,
          backgroundColor: `${tierStyle.color}15`,
          border: `1px solid ${tierStyle.color}25`,
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: tierStyle.color }}
        />
        {isBuilding ? 'BUILDING' : tier}
      </span>
    </div>
  );
}
