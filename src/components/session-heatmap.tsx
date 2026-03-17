'use client';

import { useMemo } from 'react';
import type { Session } from '@/lib/types';
import { getSessionQualityStyle } from '@/lib/tokens';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SessionHeatmapProps {
  sessions: Session[];
  selectedId: string | null;
  onSelect: (session: Session) => void;
  month: Date;
  onMonthChange: (d: Date) => void;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function SessionHeatmap({ sessions, selectedId, onSelect, month, onMonthChange }: SessionHeatmapProps) {
  const sessionMap = useMemo(() => {
    const map = new Map<string, Session>();
    for (const s of sessions) {
      map.set(s.trading_date, s);
    }
    return map;
  }, [sessions]);

  const { weeks, monthLabel } = useMemo(() => {
    const year = month.getFullYear();
    const mo = month.getMonth();
    const label = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(month);

    const firstDay = new Date(year, mo, 1);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const daysInMonth = new Date(year, mo + 1, 0).getDate();

    const weeks: (string | null)[][] = [];
    let currentWeek: (string | null)[] = [];

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
    <div className="rounded-xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-4">
      {/* Month navigation — compact */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.03] hover:bg-white/[0.06] transition-all text-text-muted hover:text-text-secondary"
        >
          <ChevronLeft size={12} />
        </button>
        <h3 className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-text-primary">
          {monthLabel}
        </h3>
        <button
          onClick={nextMonth}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.03] hover:bg-white/[0.06] transition-all text-text-muted hover:text-text-secondary"
        >
          <ChevronRight size={12} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-center">
            <span className="font-mono text-[7px] font-semibold uppercase tracking-wider text-text-dim">
              {d}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar grid — compact fixed-height cells */}
      <div className="grid gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((dateStr, di) => {
              if (!dateStr) {
                return <div key={`empty-${wi}-${di}`} className="h-8 rounded-md" />;
              }

              const session = sessionMap.get(dateStr);
              const dayNum = parseInt(dateStr.split('-')[2], 10);
              const isSelected = session?.session_id === selectedId;
              const isToday = dateStr === new Date().toISOString().slice(0, 10);

              if (!session) {
                return (
                  <div
                    key={dateStr}
                    className={`h-8 rounded-md flex items-center justify-center transition-colors ${
                      isToday
                        ? 'border border-white/[0.12] bg-white/[0.02]'
                        : 'bg-white/[0.01]'
                    }`}
                  >
                    <span className={`font-mono text-[9px] ${isToday ? 'text-text-muted font-semibold' : 'text-text-dim'}`}>
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
                  className={`h-8 rounded-md flex items-center justify-center transition-all duration-200 border ${
                    isSelected ? 'scale-105 z-10' : 'hover:scale-105 hover:z-10'
                  }`}
                  style={{
                    backgroundColor: style.bg,
                    borderColor: isSelected ? style.color : 'transparent',
                    boxShadow: isSelected
                      ? `0 0 8px ${style.bg}, 0 0 2px ${style.color}40`
                      : 'none',
                  }}
                  title={`${dateStr} — ${style.label} (${session.fills_count} fills)`}
                >
                  <span className="font-mono text-[9px] font-bold" style={{ color: style.color }}>
                    {dayNum}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Stats footer — inline */}
      {sessions.length > 0 && (
        <div className="mt-3 pt-2 border-t border-white/[0.04] flex items-center justify-between">
          <span className="font-mono text-[8px] text-text-dim">
            {sessions.length} sessions
          </span>
          <div className="flex items-center gap-2.5">
            {(['CLEAN', 'MINOR', 'DEGRADED', 'COMPROMISED', 'BREAKDOWN'] as const).map((q) => {
              const count = sessions.filter((s) => s.session_quality === q).length;
              if (count === 0) return null;
              const style = getSessionQualityStyle(q);
              return (
                <div key={q} className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.color }} />
                  <span className="font-mono text-[8px] font-semibold" style={{ color: style.color }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
