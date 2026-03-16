"use client";

import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "white" | "teal" | "gold" | "teal-gold";
  blur?: number;
  spread?: number;
  borderWidth?: number;
  proximity?: number;
  inactiveZone?: number;
  glow?: boolean;
  disabled?: boolean;
}

/**
 * GlowCard — wraps any panel with the Aceternity-style GlowingEffect.
 * Default variant is "gold" to match the DS eye logo.
 * Just replace `<div className="glass-card ...">` with `<GlowCard className="glass-card ...">`.
 */
export function GlowCard({
  children,
  className,
  variant = "gold",
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
        variant={variant}
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
