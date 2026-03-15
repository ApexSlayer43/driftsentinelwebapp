'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * LiquidGlassCard — 21st.dev-inspired multi-layer glass effect.
 *
 * Layers (bottom → top):
 *  1. Bend   — backdrop-blur + SVG distortion filter
 *  2. Face   — outer glow / shadow
 *  3. Edge   — inner highlight (inset shadows)
 *  4. Content
 *
 * Adapted for dark theme (#0F1117 void).
 */

type GlassVariant = 'card' | 'raised' | 'elevated' | 'inset';
type BlurIntensity = 'sm' | 'md' | 'lg' | 'xl';
type GlowIntensity = 'none' | 'xs' | 'sm' | 'md';

interface LiquidGlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: GlassVariant;
  blur?: BlurIntensity;
  glow?: GlowIntensity;
  borderRadius?: string;
  animate?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

// ── Blur classes ────────────────────────────────────────────
const BLUR: Record<BlurIntensity, string> = {
  sm: 'backdrop-blur-sm',
  md: 'backdrop-blur-md',
  lg: 'backdrop-blur-lg',
  xl: 'backdrop-blur-xl',
};

// ── Edge layer (inner highlights) — tuned for dark backgrounds ──
const EDGE: Record<GlassVariant, string> = {
  card: 'inset 1px 1px 1px 0 rgba(255,255,255,0.04), inset -1px -1px 1px 0 rgba(255,255,255,0.02)',
  raised: 'inset 2px 2px 2px 0 rgba(255,255,255,0.05), inset -1px -1px 1px 0 rgba(255,255,255,0.03)',
  elevated: 'inset 1px 1px 2px 0 rgba(255,255,255,0.06), inset -1px -1px 1px 0 rgba(255,255,255,0.03)',
  inset: 'inset 0 2px 6px 0 rgba(0,0,0,0.35), inset 0 -1px 2px 0 rgba(255,255,255,0.02)',
};

// ── Face layer (outer glow/shadow) ──────────────────────────
const GLOW: Record<GlowIntensity, string> = {
  none: '0 2px 8px rgba(0,0,0,0.2)',
  xs: '0 4px 12px rgba(0,0,0,0.25), 0 0 8px rgba(255,255,255,0.02)',
  sm: '0 4px 16px rgba(0,0,0,0.3), 0 0 16px rgba(255,255,255,0.03)',
  md: '0 8px 32px rgba(0,0,0,0.35), 0 0 24px rgba(255,255,255,0.04)',
};

// ── Variant presets ─────────────────────────────────────────
const VARIANT_DEFAULTS: Record<GlassVariant, {
  bg: string;
  border: string;
  blur: BlurIntensity;
  glow: GlowIntensity;
  radius: string;
}> = {
  card: {
    bg: 'rgba(30, 36, 51, 0.55)',
    border: '1px solid rgba(255,255,255,0.05)',
    blur: 'lg',
    glow: 'xs',
    radius: '24px',
  },
  raised: {
    bg: 'rgba(26, 29, 39, 0.75)',
    border: '1px solid rgba(255,255,255,0.07)',
    blur: 'xl',
    glow: 'sm',
    radius: '24px',
  },
  elevated: {
    bg: 'rgba(36, 40, 54, 0.70)',
    border: '1px solid rgba(255,255,255,0.06)',
    blur: 'xl',
    glow: 'md',
    radius: '20px',
  },
  inset: {
    bg: 'rgba(15, 17, 23, 0.55)',
    border: '1px solid rgba(255,255,255,0.02)',
    blur: 'sm',
    glow: 'none',
    radius: '16px',
  },
};

export function LiquidGlassCard({
  children,
  className,
  variant = 'card',
  blur,
  glow,
  borderRadius,
  animate = true,
  style,
  onClick,
}: LiquidGlassCardProps) {
  const preset = VARIANT_DEFAULTS[variant];
  const resolvedBlur = blur ?? preset.blur;
  const resolvedGlow = glow ?? preset.glow;
  const resolvedRadius = borderRadius ?? preset.radius;

  const Wrapper = animate ? motion.div : 'div';
  const motionProps = animate
    ? {
        whileHover: { scale: 1.008 },
        whileTap: { scale: 0.995 },
        transition: { duration: 0.2 },
      }
    : {};

  return (
    <Wrapper
      className={cn('relative', className)}
      style={{ borderRadius: resolvedRadius, ...style }}
      onClick={onClick}
      {...(motionProps as Record<string, unknown>)}
    >
      {/* Layer 1: Bend — backdrop-blur + SVG distortion */}
      <div
        className={`absolute inset-0 z-0 overflow-hidden ${BLUR[resolvedBlur]}`}
        style={{
          borderRadius: resolvedRadius,
          filter: 'url(#container-glass)',
        }}
      />

      {/* Layer 2: Face — background + outer glow */}
      <div
        className="absolute inset-0 z-10"
        style={{
          borderRadius: resolvedRadius,
          background: preset.bg,
          border: preset.border,
          boxShadow: GLOW[resolvedGlow],
        }}
      />

      {/* Layer 3: Edge — inner highlights */}
      <div
        className="absolute inset-0 z-20"
        style={{
          borderRadius: resolvedRadius,
          boxShadow: EDGE[variant],
        }}
      />

      {/* Layer 4: Content */}
      <div className="relative z-30">{children}</div>
    </Wrapper>
  );
}

/**
 * SVG distortion filter — render once in the root layout.
 * Already exists via GlassFilter in liquid-glass-button.tsx.
 * This re-export provides a standalone option.
 */
export function LiquidGlassFilter() {
  return (
    <svg className="hidden" aria-hidden="true">
      <defs>
        <filter
          id="container-glass"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05 0.05"
            numOctaves="1"
            seed="1"
            result="turbulence"
          />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            scale="70"
            xChannelSelector="R"
            yChannelSelector="B"
            result="displaced"
          />
          <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}
