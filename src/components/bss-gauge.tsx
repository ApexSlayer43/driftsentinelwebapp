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
 * BSS Score Gauge — spec Section 7
 *
 * 240° arc (150°→390°), 14px stroke, stroke-linecap: round
 * Track color: #242836
 * Score: 48px JetBrains Mono 700, #E2E8F0 (neutral — tier info is in badge)
 * Delta: 12px, cyan positive (#22D3EE), orange negative (#FB923C)
 * Tier badge: below score, color-coded capsule
 * Tick marks at tier boundaries (6 segments)
 * 1.2s transition with cubic-bezier(0.4, 0, 0.2, 1)
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
  const strokeWidth = size === 'lg' ? 14 : 5;

  // Arc calculation: 240° sweep
  const startAngle = 150;
  const sweepAngle = 240;
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

  // Delta display — monochrome: brighter white for positive, dimmer for negative
  const deltaColor = delta > 0 ? '#FFFFFF' : delta < 0 ? '#8891A0' : '#4A5568';
  const deltaSymbol = delta > 0 ? '\u25B2' : delta < 0 ? '\u25BC' : '\u2014';
  const deltaText = delta !== 0 ? `${Math.abs(delta)}` : '';

  // Pulse animation for drift states
  const shouldPulse = ['DRIFT_FORMING', 'COMPROMISED', 'BREAKDOWN'].includes(state);

  // Precision tick marks — outside the arc, clean separation
  const tickCount = 48;
  const tickRadius = radius + (size === 'lg' ? 16 : 8); // Outside the arc

  return (
    <div className="bss-orb relative flex flex-col items-center gap-2">
      <svg
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
      >
        <defs>
          <linearGradient id={`gauge-grad-${tier}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={tierStyle.color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={tierStyle.color} stopOpacity="1" />
          </linearGradient>
          <filter id="gauge-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feFlood floodColor={tierStyle.color} floodOpacity="0.25" result="flood" />
            <feComposite in="flood" in2="blur" operator="in" result="colorBlur" />
            <feMerge>
              <feMergeNode in="colorBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Precision tick marks — outside the arc */}
        {Array.from({ length: tickCount + 1 }).map((_, i) => {
          const angle = startAngle + (sweepAngle / tickCount) * i;
          const rad = (angle * Math.PI) / 180;
          const isMajor = i % 8 === 0;
          const tickLen = size === 'lg' ? (isMajor ? 10 : 5) : (isMajor ? 5 : 3);
          const innerR = tickRadius;
          const outerR = tickRadius + tickLen;
          const tickProgress = i / tickCount;
          const isActive = tickProgress <= progressValue;

          return (
            <line
              key={i}
              x1={cx + innerR * Math.cos(rad)}
              y1={cy + innerR * Math.sin(rad)}
              x2={cx + outerR * Math.cos(rad)}
              y2={cy + outerR * Math.sin(rad)}
              stroke={isActive ? tierStyle.color : 'rgba(255,255,255,0.08)'}
              strokeWidth={isMajor ? 1.5 : 0.75}
              strokeLinecap="round"
              opacity={isActive ? (isMajor ? 0.8 : 0.35) : 0.2}
            />
          );
        })}

        {/* Background arc — subtle dark track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(${startAngle + 90} ${cx} ${cy})`}
        />

        {/* Score arc — tier-colored, precision glow */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={`url(#gauge-grad-${tier})`}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(${startAngle + 90} ${cx} ${cy})`}
          filter="url(#gauge-glow)"
          style={{
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            ...(isBuilding ? { strokeDasharray: `${strokeWidth * 2} ${strokeWidth * 3}` } : {}),
          }}
          className={shouldPulse ? 'animate-pulse' : ''}
        />

        {/* Score number — 48px JetBrains Mono 700 in #E2E8F0 (neutral) */}
        <text
          x={cx}
          y={cy - (size === 'lg' ? 10 : 2)}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#E2E8F0"
          fontFamily="var(--font-mono)"
          fontWeight="700"
          fontSize={size === 'lg' ? 64 : 32}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {isBuilding ? `${Math.round(progressValue * 100)}%` : animatedScore}
        </text>

        {/* Delta indicator — 12px, cyan/orange */}
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

      {/* Tier badge — color-coded capsule below score */}
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
