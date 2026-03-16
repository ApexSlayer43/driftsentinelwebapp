"use client";

import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  blur?: number;
  spread?: number;
  borderWidth?: number;
  proximity?: number;
  inactiveZone?: number;
  glow?: boolean;
  disabled?: boolean;
}

/**
 * GlowCard — wraps any panel with the white/silver GlowingEffect.
 */
export function GlowCard({
  children,
  className,
  blur = 0,
  spread = 20,
  borderWidth = 1,
  proximity = 0,
  inactiveZone = 0.7,
  glow = false,
  disabled = false,
}: GlowCardProps) {
  return (
    <div className={cn("relative rounded-[inherit]", className)}>
      <GlowingEffect
        blur={blur}
        spread={spread}
        borderWidth={borderWidth}
        proximity={proximity}
        inactiveZone={inactiveZone}
        glow={glow}
        disabled={disabled}
      />
      {children}
    </div>
  );
}
