'use client';

import { getStateStyle } from '@/lib/tokens';

interface StateBadgeProps {
  state: string;
}

const STATE_LABELS: Record<string, string> = {
  STABLE: 'Stable',
  DRIFT_FORMING: 'Drift Forming',
  COMPROMISED: 'Compromised',
  BREAKDOWN: 'Breakdown',
  BUILDING: 'Building',
};

export function StateBadge({ state }: StateBadgeProps) {
  const style = getStateStyle(state);
  const label = STATE_LABELS[state] ?? state;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
      style={{
        borderColor: style.border,
        backgroundColor: style.bg,
        color: style.solid,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: style.solid }}
      />
      {label}
    </div>
  );
}
