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
  const stateStyle = getStateStyle(state);

  const dimension = size === 'lg' ? 380 : 180;
  const cx = dimension / 2;
  const cy = dimension / 2;
  const radius = (dimension / 2) - 24;
  const strokeWidth = size === 'lg' ? 10 : 5;

  // Arc calculation: 240° sweep from -210° to +30° (bottom gap)
  const startAngle = 150; // degrees from 3-o'clock, clockwise
  const sweepAngle = 240;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (sweepAngle / 360) * circumference;

  // Build progress or score progress
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

  // Delta display
  const deltaColor = delta > 0 ? '#00D4AA' : delta < 0 ? '#FF3B5C' : '#4A5568';
  const deltaSymbol = delta > 0 ? '\u25B2' : delta < 0 ? '\u25BC' : '\u2014';
  const deltaText = delta !== 0 ? `${Math.abs(delta)}` : '';

  // Pulse animation for drift states
  const shouldPulse = ['DRIFT_FORMING', 'COMPROMISED', 'BREAKDOWN'].includes(state);

  // Tick marks — thinner, more refined
  const tickCount = 48;

  return (
    <div className="bss-orb relative flex flex-col items-center gap-2">
      <svg
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
        className="drop-shadow-lg"
      >
        <defs>
          <linearGradient id={`gauge-grad-${tier}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={tierStyle.color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={tierStyle.color} stopOpacity="1" />
          </linearGradient>
          <filter id="gauge-glow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feFlood floodColor={tierStyle.color} floodOpacity="0.35" result="flood" />
            <feComposite in="flood" in2="blur" operator="in" result="colorBlur" />
            <feMerge>
              <feMergeNode in="colorBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Tick marks around the arc */}
        {Array.from({ length: tickCount + 1 }).map((_, i) => {
          const angle = startAngle + (sweepAngle / tickCount) * i;
          const rad = (angle * Math.PI) / 180;
          const isMajor = i % 6 === 0;
          const innerR = radius - (isMajor ? 14 : 9);
          const outerR = radius - 4;
          const tickProgress = i / tickCount;
          const isActive = tickProgress <= progressValue;

          return (
            <line
              key={i}
              x1={cx + innerR * Math.cos(rad)}
              y1={cy + innerR * Math.sin(rad)}
              x2={cx + outerR * Math.cos(rad)}
              y2={cy + outerR * Math.sin(rad)}
              stroke={isActive ? tierStyle.color : 'rgba(255,255,255,0.05)'}
              strokeWidth={isMajor ? 1.5 : 0.75}
              strokeLinecap="round"
              opacity={isActive ? (isMajor ? 0.75 : 0.4) : 0.25}
            />
          );
        })}

        {/* Background arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(${startAngle + 90} ${cx} ${cy})`}
        />

        {/* Score arc — tier-colored with glow */}
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
            transition: 'stroke-dashoffset 1.2s ease-out',
            ...(isBuilding ? { strokeDasharray: `${strokeWidth * 2} ${strokeWidth * 3}` } : {}),
          }}
          className={shouldPulse ? 'animate-pulse' : ''}
        />

        {/* Score number — JetBrains Mono */}
        <text
          x={cx}
          y={cy - (size === 'lg' ? 10 : 2)}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#E8EDF5"
          fontFamily="var(--font-mono)"
          fontWeight="700"
          fontSize={size === 'lg' ? 72 : 32}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {isBuilding ? `${Math.round(progressValue * 100)}%` : animatedScore}
        </text>

        {/* Delta indicator below score */}
        {!isBuilding && (
          <text
            x={cx}
            y={cy + (size === 'lg' ? 38 : 18)}
            textAnchor="middle"
            dominantBaseline="central"
            fill={deltaColor}
            fontFamily="var(--font-mono)"
            fontWeight="500"
            fontSize={size === 'lg' ? 16 : 10}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {deltaSymbol} {deltaText}
          </text>
        )}
      </svg>

      {/* Tier label */}
      <span
        className="font-display text-xs font-bold uppercase tracking-[0.14em]"
        style={{ color: tierStyle.color }}
      >
        {isBuilding ? 'BUILDING' : tier}
      </span>
    </div>
  );
}
