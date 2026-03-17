'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getSeverityColor, getModeLabel, getModeIcon } from '@/lib/tokens';
import { DynamicIcon } from '@/components/dynamic-icon';
import type { ViolationToday } from '@/lib/types';

interface ViolationRowProps {
  violation: ViolationToday;
}

export function ViolationRow({ violation }: ViolationRowProps) {
  const [expanded, setExpanded] = useState(false);
  const sevColor = getSeverityColor(violation.severity);
  const modeLabel = getModeLabel(violation.mode);
  const modeIcon = getModeIcon(violation.mode);

  const time = new Date(violation.first_seen_utc).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <div className="group">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 rounded-lg bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-3 transition-colors hover:border-white/[0.12]"
      >
        <DynamicIcon name={modeIcon} size={14} className="shrink-0 text-text-muted" />
        <div className="flex-1 text-left">
          <div className="font-mono text-[12px] font-semibold text-text-primary">
            {modeLabel}
          </div>
          <div className="font-mono text-[12px] text-text-muted">{time}</div>
        </div>
        <span
          className="rounded-full px-2 py-0.5 font-mono text-[12px] font-bold uppercase"
          style={{ color: sevColor, backgroundColor: sevColor + '14' }}
        >
          {violation.severity}
        </span>
        <span
          className="font-display text-sm font-bold"
          style={{ color: sevColor }}
        >
          -{violation.points}
        </span>
        {expanded ? (
          <ChevronDown size={12} className="text-text-muted" />
        ) : (
          <ChevronRight size={12} className="text-text-muted" />
        )}
      </button>
      {expanded && (
        <div className="ml-6 mt-1 rounded-lg bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-3">
          <div className="grid grid-cols-2 gap-2 font-mono text-[12px]">
            <div>
              <span className="text-text-muted">Rule: </span>
              <span className="text-text-secondary">{violation.rule_id}</span>
            </div>
            <div>
              <span className="text-text-muted">Points: </span>
              <span className="text-text-secondary">{violation.points}</span>
            </div>
            <div>
              <span className="text-text-muted">First seen: </span>
              <span className="text-text-secondary">{time}</span>
            </div>
            <div>
              <span className="text-text-muted">ID: </span>
              <span className="text-text-secondary">{violation.violation_id.slice(0, 8)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
