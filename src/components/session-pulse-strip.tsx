'use client';

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Session } from '@/lib/types';
import { getSessionQualityStyle } from '@/lib/tokens';

interface SessionPulseStripProps {
  sessions: Session[];
  selectedId: string | null;
  onSelect: (session: Session) => void;
}

interface TooltipPos {
  x: number;
  y: number;
}

export function SessionPulseStrip({ sessions, selectedId, onSelect }: SessionPulseStripProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null);
  const hoveredSession = sessions.find((s) => s.session_id === hoveredId) ?? null;

  const handleMouseEnter = useCallback((session: Session, e: React.MouseEvent<HTMLButtonElement>) => {
    setHoveredId(session.session_id);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredId(null);
    setTooltipPos(null);
  }, []);

  if (sessions.length === 0) {
    return (
      <div className="flex items-center h-8 rounded-lg bg-white/[0.02] border border-white/[0.04] px-4">
        <p className="font-mono text-[9px] text-text-dim tracking-wider">
          No sessions yet
        </p>
      </div>
    );
  }

  const ordered = [...sessions].reverse();

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Dots */}
        <div className="flex items-center gap-[4px] flex-wrap py-1">
          {ordered.map((session) => {
            const style = getSessionQualityStyle(session.session_quality);
            const isSelected = session.session_id === selectedId;
            const isHovered = session.session_id === hoveredId;

            return (
              <button
                key={session.session_id}
                onClick={() => onSelect(session)}
                onMouseEnter={(e) => handleMouseEnter(session, e)}
                onMouseLeave={handleMouseLeave}
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
            );
          })}
        </div>

        {/* Inline legend */}
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

      {/* Fixed-position tooltip portal — never clipped by overflow */}
      {hoveredSession && tooltipPos && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] whitespace-nowrap rounded-lg bg-white/[0.06] backdrop-blur-2xl border border-white/[0.1] px-3 py-2 pointer-events-none"
          style={{
            left: Math.max(8, tooltipPos.x),
            top: tooltipPos.y - 8,
            transform: 'translate(-50%, -100%)',
            boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
          }}
        >
          <p className="font-mono text-[9px] text-text-primary font-semibold">
            {hoveredSession.trading_date}
          </p>
          <p className="font-mono text-[8px] mt-0.5" style={{ color: getSessionQualityStyle(hoveredSession.session_quality).color }}>
            {getSessionQualityStyle(hoveredSession.session_quality).label} — {hoveredSession.fills_count}f, {hoveredSession.violation_count}v
          </p>
        </div>,
        document.body,
      )}
    </>
  );
}
