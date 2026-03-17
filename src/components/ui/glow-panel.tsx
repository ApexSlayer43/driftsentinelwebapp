"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface GlowPanelProps {
  children: React.ReactNode;
  className?: string;
  /** Outer wrapper classes (border container) */
  outerClassName?: string;
  /** Variant controls glass intensity */
  variant?: "default" | "raised" | "elevated" | "inset";
}

/**
 * GlowPanel — Glassmorphism card primitive.
 *
 * Frosted glass card with subtle border, backdrop-blur, and optional
 * teal ambient inner glow. Used as the standard panel wrapper across
 * the entire dashboard.
 */
export function GlowPanel({
  children,
  className,
  outerClassName,
  variant = "default",
}: GlowPanelProps) {
  const variantStyles = {
    default:
      "bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]",
    raised:
      "bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]",
    elevated:
      "bg-white/[0.06] backdrop-blur-2xl border border-white/[0.1] shadow-[0_12px_40px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]",
    inset:
      "bg-white/[0.02] backdrop-blur-md border border-white/[0.04] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]",
  };

  return (
    <div
      className={cn(
        "relative rounded-2xl md:rounded-3xl overflow-hidden",
        outerClassName
      )}
    >
      {/* Subtle teal ambient inner glow — top-right corner */}
      {(variant === "default" || variant === "raised" || variant === "elevated") && (
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#22D3EE]/[0.04] blur-3xl pointer-events-none" />
      )}

      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-2xl md:rounded-3xl p-6",
          variantStyles[variant],
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
