"use client";

import React from "react";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";

interface GlowPanelProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "teal" | "gold" | "teal-gold" | "white";
  /** Outer wrapper classes (border container) */
  outerClassName?: string;
  /** Disable the glow effect (static border only) */
  disabled?: boolean;
  spread?: number;
  proximity?: number;
  borderWidth?: number;
  inactiveZone?: number;
}

/**
 * GlowPanel — replacement for GlowCard/liquid-glass.
 * Wraps content in a card with a mouse-tracking glowing border effect.
 */
export function GlowPanel({
  children,
  className,
  variant = "default",
  outerClassName,
  disabled = false,
  spread = 40,
  proximity = 64,
  borderWidth = 3,
  inactiveZone = 0.01,
}: GlowPanelProps) {
  return (
    <div
      className={cn(
        "relative rounded-[1.25rem] border-[0.75px] border-white/[0.06] p-2 md:rounded-[1.5rem] md:p-3",
        outerClassName
      )}
    >
      <GlowingEffect
        spread={spread}
        glow={true}
        disabled={disabled}
        proximity={proximity}
        inactiveZone={inactiveZone}
        borderWidth={borderWidth}
        variant={variant}
      />
      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-xl border-[0.75px] border-white/[0.04] p-6 shadow-sm",
          "bg-[rgba(13,15,21,0.85)]",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
