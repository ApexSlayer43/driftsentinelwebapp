'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getTierStyle } from '@/lib/tokens';

interface ProtocolGridProps {
  accountRef?: string;
}

interface DayCell {
  date: string;       // YYYY-MM-DD
  bss: number | null;  // null = no data
  dsi: number | null;
  isClean: boolean;
  fillCount: number;
}

/**
 * 5-Week Protocol Compliance Grid — GitHub contribution calendar style.
 * Each cell represents one day. Color intensity = BSS score mapped to tier colors.
 * Tooltip shows date, BSS, DSI, and fill count.
 * Queries daily_scores from Supabase directly (same pattern as evidence-sessions).
 */
export function ProtocolGrid({ accountRef }: ProtocolGridProps) {
  const [days, setDays] = useState<Map<string, DayCell>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      let ref = accountRef;

      if (!ref) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const { data: accounts } = await supabase
          .from('accounts')
          .select('account_ref')
          .eq('user_id', user.id)
          .limit(1);
        if (!accounts || accounts.length === 0) { setLoading(false); return; }
        ref = accounts[0].account_ref;
      }

      const since = new Date();
      since.setDate(since.getDate() - 35);

      const { data, error } = await supabase
        .from('daily_scores')
        .select('trading_date, bss_score, dsi_score, fills_count, violation_count')
        .eq('account_ref', ref)
        .gte('trading_date', since.toISOString().slice(0, 10))
        .order('trading_date', { ascending: true });

      if (!error && data) {
        const map = new Map<string, DayCell>();
        for (const row of data) {
          map.set(row.trading_date, {
            date: row.trading_date,
            bss: row.bss_score,
            dsi: row.dsi_score,
            isClean: row.violation_count === 0,
            fillCount: row.fills_count,
          });
        }
        setDays(map);
      }
      setLoading(false);
    }

    load();
  }, [accountRef]);

  // Generate 35-day date grid (5 weeks × 7 days)
  const grid = useMemo(() => {
    const today = new Date();
    const cells: string[] = [];
    for (let i = 34; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      cells.push(d.toISOString().slice(0, 10));
    }
    return cells;
  }, []);

  // Split into weeks (columns)
  const weeks = useMemo(() => {
    const result: string[][] = [];
    for (let i = 0; i < grid.length; i += 7) {
      result.push(grid.slice(i, i + 7));
    }
    return result;
  }, [grid]);

  // Map BSS to fill color using tier system
  function getCellColor(bss: number | null): string {
    if (bss === null) return 'rgba(255, 255, 255, 0.02)'; // no data
    if (bss >= 90) return getTierStyle('SOVEREIGN').color;
    if (bss >= 80) return getTierStyle('PROVEN').color;
    if (bss >= 65) return getTierStyle('GROUNDED').color;
    if (bss >= 50) return getTierStyle('DEFINED').color;
    if (bss >= 30) return getTierStyle('FORMING').color;
    return getTierStyle('DORMANT').color;
  }

  // Opacity scales with BSS magnitude
  function getCellOpacity(bss: number | null): number {
    if (bss === null) return 0.15;
    if (bss >= 80) return 1.0;
    if (bss >= 65) return 0.85;
    if (bss >= 50) return 0.65;
    if (bss >= 30) return 0.45;
    return 0.3;
  }

  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-stable border-t-transparent" />
      </div>
    );
  }

  // Calculate streak (consecutive clean days ending today)
  const todayStr = new Date().toISOString().slice(0, 10);
  let streak = 0;
  for (let i = 0; i < grid.length; i++) {
    const dateStr = grid[grid.length - 1 - i];
    const day = days.get(dateStr);
    if (day && day.isClean && day.fillCount > 0) {
      streak++;
    } else if (day && day.fillCount > 0) {
      break;
    }
    // Skip days with no data (weekends / no trading)
  }

  // Summary stats
  const totalDays = Array.from(days.values()).filter(d => d.fillCount > 0).length;
  const cleanDays = Array.from(days.values()).filter(d => d.isClean && d.fillCount > 0).length;
  const complianceRate = totalDays > 0 ? Math.round((cleanDays / totalDays) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-text-muted">
          5-Week Protocol Compliance
        </span>
        <span className="font-mono text-[9px] font-bold text-text-secondary">
          {complianceRate}%
        </span>
      </div>

      {/* Grid */}
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-[3px] pr-1">
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="flex h-[14px] w-3 items-center justify-center font-mono text-[7px] text-text-dim"
            >
              {i % 2 === 0 ? label : ''}
            </div>
          ))}
        </div>

        {/* Week columns */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((dateStr) => {
              const day = days.get(dateStr);
              const bss = day?.bss ?? null;
              const color = getCellColor(bss);
              const opacity = getCellOpacity(bss);
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={dateStr}
                  className="group relative"
                >
                  <div
                    className="h-[14px] w-[14px] rounded-[3px] transition-transform hover:scale-125"
                    style={{
                      backgroundColor: color,
                      opacity,
                      boxShadow: isToday
                        ? `0 0 0 1px rgba(255,255,255,0.2)`
                        : day && !day.isClean
                        ? `inset 0 0 0 1px rgba(245,166,35,0.3)`
                        : 'none',
                    }}
                  />

                  {/* Tooltip */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 shadow-lg group-hover:block">
                    <div className="font-mono text-[9px] font-bold text-text-primary">
                      {dateStr}
                    </div>
                    {day ? (
                      <div className="mt-0.5 space-y-0.5 font-mono text-[8px] text-text-muted">
                        <div>BSS: <span style={{ color }}>{bss}</span></div>
                        <div>DSI: {day.dsi ?? '—'}</div>
                        <div>{day.fillCount} fills {day.isClean ? '· clean' : '· violations'}</div>
                      </div>
                    ) : (
                      <div className="mt-0.5 font-mono text-[8px] text-text-dim">No data</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Summary row */}
      <div className="flex items-center gap-4 font-mono text-[8px] text-text-muted">
        <span>{cleanDays}/{totalDays} clean days</span>
        {streak > 0 && (
          <span className="text-stable">{streak}d streak</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-text-dim">Less</span>
          {[0.15, 0.3, 0.5, 0.7, 1.0].map((op, i) => (
            <div
              key={i}
              className="h-[10px] w-[10px] rounded-[2px]"
              style={{ backgroundColor: '#00D4AA', opacity: op }}
            />
          ))}
          <span className="text-text-dim">More</span>
        </div>
      </div>
    </div>
  );
}
