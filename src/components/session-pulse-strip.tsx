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

  const ordered = [...sessions].reverse();

  return (
    <div className="relative">
      <div
        className="flex items-center gap-[5px] overflow-x-auto py-4 px-5 rounded-xl bg-[rgba(13,15,21,0.85)] backdrop-blur-xl border border-white/[0.04]"
        style={{ scrollbarWidth: 'thin' }}
      >
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
                className="relative flex items-center justify-center transition-all duration-300"
                style={{
                  width: isSelected ? 20 : isHovered ? 16 : 12,
                  height: isSelected ? 20 : isHovered ? 16 : 12,
                }}
                title={`${session.trading_date} — ${style.label}`}
              >
                <span
                  className="block rounded-full transition-all duration-300"
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: style.color,
                    opacity: isSelected ? 1 : isHovered ? 0.9 : 0.6,
                    boxShadow: isSelected
                      ? `0 0 10px ${style.color}, 0 0 20px ${style.bg}`
                      : isHovered
                        ? `0 0 6px ${style.color}60`
                        : 'none',
                  }}
                />

                {isSelected && (
                  <span
                    className="absolute inset-[-4px] rounded-full border-2 animate-pulse"
                    style={{ borderColor: `${style.color}60` }}
                  />
                )}
              </button>

              {isHovered && (
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 whitespace-nowrap rounded-xl bg-[rgba(13,15,21,0.95)] backdrop-blur-xl border border-white/[0.06] px-4 py-2.5 pointer-events-none"
                  style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                >
                  <p className="font-mono text-[10px] text-text-primary font-semibold">
                    {session.trading_date}
                  </p>
                  <p className="font-mono text-[9px] mt-0.5" style={{ color: style.color }}>
                    {style.label} — {session.fills_count} fills, {session.violation_count} violations
                  </p>
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 border-r border-b border-white/[0.06]"
                    style={{ background: 'rgba(13,15,21,0.95)' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2.5 px-5">
        {(['CLEAN', 'MINOR', 'DEGRADED', 'COMPROMISED', 'BREAKDOWN'] as const).map((q) => {
          const style = getSessionQualityStyle(q);
          return (
            <div key={q} className="flex items-center gap-1.5">
              <span
                className="block h-2 w-2 rounded-full"
                style={{ backgroundColor: style.color, opacity: 0.7 }}
              />
              <span className="font-mono text-[8px] uppercase tracking-wider text-text-dim">
                {style.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
