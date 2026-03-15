'use client';

import { getModeLabel, getModeIcon } from '@/lib/tokens';
import { DynamicIcon } from '@/components/dynamic-icon';
import type { DriftDriver } from '@/lib/types';

interface DriverRowProps {
  driver: DriftDriver;
  rank: number;
}

export function DriverRow({ driver, rank }: DriverRowProps) {
  const modeLabel = getModeLabel(driver.mode);
  const modeIcon = getModeIcon(driver.mode);

  const sevClass =
    driver.points >= 15 ? '#FF3B5C' :
    driver.points >= 10 ? '#FF6B35' :
    driver.points >= 5  ? '#F5A623' :
    '#8A9BB8';

  const onset = driver.onset_utc
    ? new Date(driver.onset_utc).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '\u2014';

  return (
    <div
      className="flex items-center gap-3 rounded-lg glass p-3 transition-colors hover:border-border-active"
    >
      <span className="w-4 text-center font-mono text-[12px] font-bold text-text-dim">
        {rank}
      </span>
      <DynamicIcon name={modeIcon} size={14} className="shrink-0 text-text-muted" />
      <div className="flex-1">
        <div className="font-mono text-[12px] font-semibold text-text-primary">
          {modeLabel}
        </div>
        <div className="font-mono text-[12px] text-text-muted">
          Onset: {onset}
        </div>
      </div>
      <span
        className="font-display text-sm font-bold"
        style={{ color: sevClass }}
      >
        {driver.points}
      </span>
    </div>
  );
}
