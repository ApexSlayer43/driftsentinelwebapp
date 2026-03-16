'use client';

import { useState } from 'react';
import type { Session } from '@/lib/types';
import { getSessionQualityStyle } from '@/lib/tokens';

interface SessionPulseStripProps {
  sessions: Session[];
  selectedId: string | null;
  onSelect: (session: Session) => void;
}

export function SessionPulseStrip({ sessions, selectedId, onSelect }: SessionPulseStripProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-16 rounded-xl bg-[rgba(13,15,21,0.85)] backdrop-blur-xl border border-white/[0.04] px-6">
        <p className="font-mono text-[10px] text-text-muted tracking-wider">
          No sessions recorded yet. Upload a CSV to begin.
        </p>
      </div>
    );
  }

  // Show sessions oldest → newest (left to right)
  const ordered = [...sessions].reverse();

  return (
    <div className="relative">
      <div className="flex items-center gap-1 overflow-x-auto py-3 px-4 rounded-xl bg-[rgba(13,15,21,0.85)] backdrop-blur-xl border border-white/[0.04] scrollbar-thin">
        {ordered.map((session) => {
          const style = getSessionQualityStyle(session.session_quality);
          const isSelected = session.session_id === selectedId;
          const isHovered = session.session_id === hoveredId;

          return (
            <div key={session.session_id} className="relative flex-shrink-0">
              <button
                onClick={() => onSelect(session)}
                onMouseEnter={() => setHoveredId(session.session_id)}
                onMouseLeave={() => setHoveredId(null)}
                className="relative flex items-center justify-center transition-all duration-200"
                style={{
                  width: isSelected ? 16 : 12,
                  height: isSelected ? 16 : 12,
                }}
                title={`${session.trading_date} — ${style.label}`}
              >
                <span
                  className="block rounded-full transition-all duration-200"
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: style.color,
                    opacity: isSelected ? 1 : 0.7,
                    boxShadow: isSelected
                      ? `0 0 8px ${style.color}, 0 0 16px ${style.bg}`
                      : 'none',
                  }}
                />

                {/* Selection ring */}
                {isSelected && (
                  <span
                    className="absolute inset-[-3px] rounded-full border"
                    style={{ borderColor: style.color, opacity: 0.5 }}
                  />
                )}
              </button>

              {/* Tooltip */}
              {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap rounded-lg bg-[rgba(13,15,21,0.85)] backdrop-blur-xl border border-white/[0.04] px-3 py-1.5 pointer-events-none">
                  <p className="font-mono text-[9px] text-text-primary font-semibold">
                    {session.trading_date}
                  </p>
                  <p className="font-mono text-[8px]" style={{ color: style.color }}>
                    {style.label} — {session.fills_count} fills, {session.violation_count} violations
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 px-4">
        {(['CLEAN', 'MINOR', 'DEGRADED', 'COMPROMISED', 'BREAKDOWN'] as const).map((q) => {
          const style = getSessionQualityStyle(q);
          return (
            <div key={q} className="flex items-center gap-1">
              <span
                className="block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: style.color }}
              />
              <span className="font-mono text-[7px] uppercase tracking-wider text-text-muted">
                {style.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
