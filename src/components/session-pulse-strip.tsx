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
      <div className="flex items-center h-10 rounded-lg bg-white/[0.02] border border-white/[0.04] px-4">
        <p className="font-mono text-[9px] text-text-dim tracking-wider">
          No sessions yet
        </p>
      </div>
    );
  }

  const ordered = [...sessions].reverse();

  return (
    <div className="flex items-center gap-3">
      {/* Dots — inline flex-wrap, not full-width bar */}
      <div className="flex items-center gap-[4px] flex-wrap py-1">
        {ordered.map((session) => {
          const style = getSessionQualityStyle(session.session_quality);
          const isSelected = session.session_id === selectedId;
          const isHovered = session.session_id === hoveredId;

          return (
            <div key={session.session_id} className="relative">
              <button
                onClick={() => onSelect(session)}
                onMouseEnter={() => setHoveredId(session.session_id)}
                onMouseLeave={() => setHoveredId(null)}
                className="relative flex items-center justify-center transition-all duration-200"
                style={{
                  width: isSelected ? 16 : isHovered ? 12 : 10,
                  height: isSelected ? 16 : isHovered ? 12 : 10,
                }}
                title={`${session.trading_date} — ${style.label}`}
              >
                <span
                  className="block rounded-full transition-all duration-200"
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: style.color,
                    opacity: isSelected ? 1 : isHovered ? 0.85 : 0.55,
                    boxShadow: isSelected
                      ? `0 0 8px ${style.color}, 0 0 16px ${style.bg}`
                      : 'none',
                  }}
                />
                {isSelected && (
                  <span
                    className="absolute inset-[-3px] rounded-full border-[1.5px] animate-pulse"
                    style={{ borderColor: `${style.color}50` }}
                  />
                )}
              </button>

              {isHovered && (
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap rounded-lg bg-[rgba(13,15,21,0.95)] backdrop-blur-xl border border-white/[0.06] px-3 py-2 pointer-events-none"
                  style={{ boxShadow: '0 6px 16px rgba(0,0,0,0.4)' }}
                >
                  <p className="font-mono text-[9px] text-text-primary font-semibold">
                    {session.trading_date}
                  </p>
                  <p className="font-mono text-[8px] mt-0.5" style={{ color: style.color }}>
                    {style.label} — {session.fills_count}f, {session.violation_count}v
                  </p>
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-1.5 h-1.5 rotate-45 border-r border-b border-white/[0.06]"
                    style={{ background: 'rgba(13,15,21,0.95)' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Inline legend — compact */}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        {(['CLEAN', 'MINOR', 'DEGRADED', 'COMPROMISED', 'BREAKDOWN'] as const).map((q) => {
          const style = getSessionQualityStyle(q);
          return (
            <div key={q} className="flex items-center gap-1">
              <span
                className="block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: style.color, opacity: 0.7 }}
              />
              <span className="font-mono text-[7px] uppercase tracking-wider text-text-dim">
                {style.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
