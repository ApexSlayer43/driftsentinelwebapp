'use client';

import { GlowPanel } from '@/components/ui/glow-panel';

interface MetricCardProps {
  label: string;
  value: string | number;
  accent?: string;
}

export function MetricCard({ label, value, accent }: MetricCardProps) {
  return (
    <GlowPanel className="p-5">
      <div className="font-mono text-[7px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </div>
      <div
        className="mt-1.5 font-mono text-xl font-bold text-text-primary"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
    </GlowPanel>
  );
}
