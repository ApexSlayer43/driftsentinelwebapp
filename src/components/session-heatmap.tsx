'use client';

import { useMemo } from 'react';
import type { Session } from '@/lib/types';
import { getSessionQualityStyle } from '@/lib/tokens';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SessionHeatmapProps {
  sessions: Session[];
  selectedId: string | null;
  onSelect: (session: Session) => void;
  month: Date;              // Which month to display
  onMonthChange: (d: Date) => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function SessionHeatmap({ sessions, selectedId, onSelect, month, onMonthChange }: SessionHeatmapProps) {
  // Build a map: date string → session
  const sessionMap = useMemo(() => {
    const map = new Map<string, Session>();
    for (const s of sessions) {
      map.set(s.trading_date, s);
    }
    return map;
  }, [sessions]);

  // Generate calendar grid for the month
  const { weeks, monthLabel } = useMemo(() => {
    const year = month.getFullYear();
    const mo = month.getMonth();
    const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(month);

    // First day of month
    const firstDay = new Date(year, mo, 1);
    // Day of week (0=Sun, adjust to Mon=0)
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    // Days in month
    const daysInMonth = new Date(year, mo + 1, 0).getDate();

    const weeks: (string | null)[][] = [];
    let currentWeek: (string | null)[] = [];

    // Fill leading empty cells
    for (let i = 0; i < startDow; i++) {
      currentWeek.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      currentWeek.push(dateStr);

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Fill trailing empty cells
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    return { weeks, monthLabel: label };
  }, [month]);

  function prevMonth() {
    const d = new Date(month);
    d.setMonth(d.getMonth() - 1);
    onMonthChange(d);
  }

  function nextMonth() {
    const d = new Date(month);
    d.setMonth(d.getMonth() + 1);
    onMonthChange(d);
  }

  return (
    <div className="rounded-xl liquid-glass p-5">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg liquid-glass-tab text-text-muted hover:text-text-secondary transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.15em] text-text-secondary">
          {monthLabel}
        </h3>
        <button
          onClick={nextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg liquid-glass-tab text-text-muted hover:text-text-secondary transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center">
            <span className="font-mono text-[7px] uppercase tracking-wider text-text-muted">
              {d}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((dateStr, di) => {
              if (!dateStr) {
                return <div key={`empty-${wi}-${di}`} className="aspect-square rounded-lg" />;
              }

              const session = sessionMap.get(dateStr);
              const dayNum = parseInt(dateStr.split('-')[2], 10);
              const isSelected = session?.session_id === selectedId;
              const isToday = dateStr === new Date().toISOString().slice(0, 10);

              if (!session) {
                // No session this day
                return (
                  <div
                    key={dateStr}
                    className={`aspect-square rounded-lg flex items-center justify-center border transition-colors ${
                      isToday
                        ? 'border-border-active'
                        : 'border-border-dim'
                    }`}
                  >
                    <span className="font-mono text-[8px] text-text-dim">
                      {dayNum}
                    </span>
                  </div>
                );
              }

              const style = getSessionQualityStyle(session.session_quality);

              return (
                <button
                  key={dateStr}
                  onClick={() => onSelect(session)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all duration-200 border ${
                    isSelected ? 'scale-110 z-10' : 'hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: style.bg,
                    borderColor: isSelected ? style.color : style.border,
                    boxShadow: isSelected ? `0 0 12px ${style.bg}` : 'none',
                  }}
                  title={`${dateStr} — ${style.label} (${session.fills_count} fills)`}
                >
                  <span className="font-mono text-[9px] font-semibold" style={{ color: style.color }}>
                    {dayNum}
                  </span>
                  <span className="font-mono text-[6px] text-text-muted">
                    {session.fills_count}f
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Stats summary */}
      {sessions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border-dim flex items-center justify-between">
          <span className="font-mono text-[8px] text-text-muted uppercase tracking-wider">
            {sessions.length} sessions this window
          </span>
          <div className="flex items-center gap-2">
            {(['CLEAN', 'MINOR', 'DEGRADED', 'COMPROMISED', 'BREAKDOWN'] as const).map((q) => {
              const count = sessions.filter((s) => s.session_quality === q).length;
              if (count === 0) return null;
              const style = getSessionQualityStyle(q);
              return (
                <span key={q} className="font-mono text-[8px] font-semibold" style={{ color: style.color }}>
                  {count} {style.label.toLowerCase()}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
