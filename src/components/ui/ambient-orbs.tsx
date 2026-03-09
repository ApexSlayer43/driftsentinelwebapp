"use client"

import { cn } from "@/lib/utils"

interface AmbientOrbsProps {
  className?: string
}

export function AmbientOrbs({ className }: AmbientOrbsProps) {
  return (
    <div className={cn("pointer-events-none", className)} aria-hidden="true">
      {/* Primary orb — teal, left-center */}
      <div
        className="absolute rounded-full animate-pulse"
        style={{
          width: "340px",
          height: "340px",
          top: "25%",
          left: "30%",
          background:
            "radial-gradient(circle, rgba(0,180,160,0.18) 0%, rgba(0,180,160,0.06) 50%, transparent 70%)",
          filter: "blur(40px)",
          animationDuration: "8s",
        }}
      />
      {/* Secondary orb — green-teal, overlapping right */}
      <div
        className="absolute rounded-full animate-pulse"
        style={{
          width: "300px",
          height: "300px",
          top: "28%",
          left: "42%",
          background:
            "radial-gradient(circle, rgba(0,160,120,0.15) 0%, rgba(0,160,120,0.05) 50%, transparent 70%)",
          filter: "blur(45px)",
          animationDuration: "10s",
          animationDelay: "2s",
        }}
      />
      {/* Subtle accent orb — smaller, dimmer */}
      <div
        className="absolute rounded-full animate-pulse"
        style={{
          width: "180px",
          height: "180px",
          top: "55%",
          left: "65%",
          background:
            "radial-gradient(circle, rgba(0,212,170,0.10) 0%, rgba(0,212,170,0.03) 50%, transparent 70%)",
          filter: "blur(35px)",
          animationDuration: "12s",
          animationDelay: "4s",
        }}
      />
    </div>
  )
}
