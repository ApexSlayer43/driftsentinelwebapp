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

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
    const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(month);

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
    <div className="rounded-xl bg-[rgba(13,15,21,0.85)] backdrop-blur-xl border border-white/[0.04] p-5">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={prevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-all text-text-muted hover:text-text-secondary"
        >
          <ChevronLeft size={14} />
        </button>
        <h3 className="font-mono text-sm font-bold uppercase tracking-[0.15em] text-text-primary">
          {monthLabel}
        </h3>
        <button
          onClick={nextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-all text-text-muted hover:text-text-secondary"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center py-1">
            <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.15em] text-text-dim">
              {d}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid gap-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1.5">
            {week.map((dateStr, di) => {
              if (!dateStr) {
                return <div key={`empty-${wi}-${di}`} className="aspect-square rounded-lg" />;
              }

              const session = sessionMap.get(dateStr);
              const dayNum = parseInt(dateStr.split('-')[2], 10);
              const isSelected = session?.session_id === selectedId;
              const isToday = dateStr === new Date().toISOString().slice(0, 10);

              if (!session) {
                return (
                  <div
                    key={dateStr}
                    className={`aspect-square rounded-lg flex items-center justify-center transition-colors ${
                      isToday
                        ? 'border border-white/[0.12] bg-white/[0.02]'
                        : 'border border-white/[0.03] bg-white/[0.01]'
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
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all duration-300 border ${
                    isSelected ? 'scale-110 z-10' : 'hover:scale-105 hover:z-10'
                  }`}
                  style={{
                    backgroundColor: style.bg,
                    borderColor: isSelected ? style.color : style.border,
                    boxShadow: isSelected
                      ? `0 0 16px ${style.bg}, 0 0 4px ${style.color}30`
                      : 'none',
                  }}
                  title={`${dateStr} — ${style.label} (${session.fills_count} fills)`}
                >
                  <span className="font-mono text-[10px] font-bold" style={{ color: style.color }}>
                    {dayNum}
                  </span>
                  <span className="font-mono text-[7px] text-text-muted mt-0.5">
                    {session.fills_count}f
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Stats summary — improved */}
      {sessions.length > 0 && (
        <div className="mt-5 pt-3 border-t border-white/[0.04] flex items-center justify-between">
          <span className="font-mono text-[9px] text-text-muted uppercase tracking-wider">
            {sessions.length} sessions
          </span>
          <div className="flex items-center gap-3">
            {(['CLEAN', 'MINOR', 'DEGRADED', 'COMPROMISED', 'BREAKDOWN'] as const).map((q) => {
              const count = sessions.filter((s) => s.session_quality === q).length;
              if (count === 0) return null;
              const style = getSessionQualityStyle(q);
              return (
                <div key={q} className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: style.color }}
                  />
                  <span className="font-mono text-[9px] font-semibold" style={{ color: style.color }}>
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
