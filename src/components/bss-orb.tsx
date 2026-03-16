'use client';

import { useEffect, useState } from 'react';
import { getTierStyle, getStateStyle } from '@/lib/tokens';

interface BssOrbProps {
  score: number;
  tier: string;
  state: string;
  yesterdayScore?: number;
  size?: 'lg' | 'sm';
  isBuilding?: boolean;
  buildProgress?: { collected: number; required: number };
}

export function BssOrb({
  score,
  tier,
  state,
  yesterdayScore,
  size = 'lg',
  isBuilding = false,
  buildProgress,
}: BssOrbProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const tierStyle = getTierStyle(tier);
  const stateStyle = getStateStyle(state);

  const dimension = size === 'lg' ? 300 : 200;
  const cx = dimension / 2;
  const cy = dimension / 2;
  const radius = (dimension / 2) - 20;
  const strokeWidth = size === 'lg' ? 6 : 4;
  const tickCount = 60;

  // Arc calculation: 270° sweep from -135° to +135°
  const startAngle = -135;
  const endAngle = 135;
  const sweepAngle = endAngle - startAngle; // 270°
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

  // Trajectory
  const diff = yesterdayScore !== undefined ? score - yesterdayScore : 0;
  const trajectoryColor = diff > 0 ? '#22D3EE' : diff < 0 ? '#FB923C' : '#4A5568';
  const trajectorySymbol = diff > 0 ? '\u2191' : diff < 0 ? '\u2193' : '\u2014';
  const trajectoryText = diff !== 0 ? `${Math.abs(diff)}` : '';

  // Pulse animation for drift states
  const shouldPulse = ['DRIFT_FORMING', 'COMPROMISED', 'BREAKDOWN'].includes(state);

  return (
    <div className="bss-orb relative flex flex-col items-center gap-3">
      <svg
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
        className="drop-shadow-lg"
      >
        <defs>
          <linearGradient id={`grad-${tier}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={tierStyle.color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={tierStyle.color} stopOpacity="1" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feFlood floodColor={tierStyle.color} floodOpacity="0.4" result="flood" />
            <feComposite in="flood" in2="blur" operator="in" result="colorBlur" />
            <feMerge>
              <feMergeNode in="colorBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Tick marks */}
        {Array.from({ length: tickCount }).map((_, i) => {
          const angle = startAngle + (sweepAngle / tickCount) * i;
          const rad = (angle * Math.PI) / 180;
          const isMajor = i % 5 === 0;
          const innerR = radius - (isMajor ? 12 : 8);
          const outerR = radius - 3;
          const tickProgress = i / tickCount;
          const isActive = tickProgress <= progressValue;

          return (
            <line
              key={i}
              x1={cx + innerR * Math.cos(rad)}
              y1={cy + innerR * Math.sin(rad)}
              x2={cx + outerR * Math.cos(rad)}
              y2={cy + outerR * Math.sin(rad)}
              stroke={isActive ? tierStyle.color : 'rgba(255,255,255,0.06)'}
              strokeWidth={isMajor ? 1.5 : 0.75}
              strokeLinecap="round"
              opacity={isActive ? (isMajor ? 0.8 : 0.5) : 0.3}
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

        {/* Score arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={`url(#grad-${tier})`}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(${startAngle + 90} ${cx} ${cy})`}
          filter="url(#glow)"
          style={{
            transition: 'stroke-dashoffset 1.2s ease-out',
            ...(isBuilding ? { strokeDasharray: `${strokeWidth * 2} ${strokeWidth * 3}` } : {}),
          }}
          className={shouldPulse ? 'animate-pulse' : ''}
        />

        {/* Score number */}
        <text
          x={cx}
          y={cy - (size === 'lg' ? 4 : 2)}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#E8EDF5"
          fontFamily="var(--font-mono)"
          fontWeight="700"
          fontSize={size === 'lg' ? 56 : 36}
        >
          {isBuilding ? `${Math.round(progressValue * 100)}%` : animatedScore}
        </text>

        {/* Trajectory */}
        {!isBuilding && yesterdayScore !== undefined && (
          <text
            x={cx}
            y={cy + (size === 'lg' ? 32 : 22)}
            textAnchor="middle"
            dominantBaseline="central"
            fill={trajectoryColor}
            fontFamily="var(--font-mono)"
            fontWeight="500"
            fontSize={size === 'lg' ? 14 : 11}
          >
            {trajectorySymbol} {trajectoryText}
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
